import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = path.resolve(".env.local");

if (fs.existsSync(envPath)) {
  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Supabase URL/service role env is required.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const resetTables = [
  "payment_events",
  "notifications",
  "reviews",
  "order_photos",
  "reservations",
  "payments",
  "job_status_logs",
  "jobs",
  "order_items",
  "addresses",
  "orders",
  "customers",
  "product_options",
  "products"
];

const serviceItems = [
  ["bathroom_basic", "욕실 기본 점검/소모품 교체", 60000, 60, { category: "bathroom" }],
  ["kitchen_faucet", "주방 수전 교체", 90000, 90, { category: "kitchen" }],
  ["light_replace", "조명 교체", 40000, 40, { category: "lighting" }],
  ["door_handle", "도어 핸들 교체", 35000, 30, { category: "door" }],
  ["toilet_replace", "변기 교체", 80000, 120, { category: "bathroom" }],
  ["bath_fan", "욕실 환풍기 교체", 70000, 80, { category: "bathroom" }],
  ["slide_bar", "샤워 슬라이드바 교체", 45000, 45, { category: "bathroom" }],
  ["drain_replace", "욕실 유가 교체", 50000, 50, { category: "bathroom" }]
].map(([service_type_code, display_name, base_price, estimated_minutes, metadata]) => ({
  service_type_code,
  display_name,
  base_price,
  estimated_minutes,
  metadata,
  is_active: true
}));

const products = [
  {
    sku: "TEMP-TOILET-BASIC",
    name: "임시 변기 교체 일반형",
    category: "bathroom",
    grade: "basic",
    material_cost: 120000,
    install_cost: 80000,
    estimated_minutes: 120,
    as_months: 12,
    is_active: true
  },
  {
    sku: "TEMP-FAUCET-BASIC",
    name: "임시 수전 교체 일반형",
    category: "kitchen",
    grade: "basic",
    material_cost: 50000,
    install_cost: 90000,
    estimated_minutes: 90,
    as_months: 12,
    is_active: true
  }
];

async function deleteAll(table) {
  const { error } = await supabase.from(table).delete().not("id", "is", null);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function countRows(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function main() {
  for (const table of resetTables) {
    await deleteAll(table);
  }

  const { error: serviceError } = await supabase
    .from("service_items")
    .upsert(serviceItems, { onConflict: "service_type_code" });
  if (serviceError) throw new Error(`service_items: ${serviceError.message}`);

  const { error: productError } = await supabase
    .from("products")
    .upsert(products, { onConflict: "sku" });
  if (productError) throw new Error(`products: ${productError.message}`);

  const { data: toiletProduct, error: toiletError } = await supabase
    .from("products")
    .select("id")
    .eq("sku", "TEMP-TOILET-BASIC")
    .single();
  if (toiletError) throw new Error(`product lookup: ${toiletError.message}`);

  const { error: optionError } = await supabase.from("product_options").insert({
    product_id: toiletProduct.id,
    name: "앵글밸브 추가",
    price_delta: 15000,
    is_active: true
  });
  if (optionError) {
    throw new Error(`product_options: ${optionError.message}`);
  }

  const summary = {};
  for (const table of [...resetTables, "product_options", "service_items"]) {
    summary[table] = await countRows(table);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

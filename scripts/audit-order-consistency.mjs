import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function count(rows) {
  return Array.isArray(rows) ? rows.length : 0;
}

function briefRows(rows, fields) {
  return (rows ?? []).map((row) => {
    const output = {};
    for (const field of fields) output[field] = row?.[field] ?? null;
    return output;
  });
}

const cwd = process.cwd();
loadEnvFile(path.join(cwd, ".env.local"));
loadEnvFile(path.join(cwd, ".tmp-vercel-env"));

const orderNumber = process.argv[2];
if (!orderNumber) {
  console.error("Usage: node scripts/audit-order-consistency.mjs <order-number>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: orders, error: orderError } = await supabase
  .from("orders")
  .select("id,order_number,status,customer_id,home_id,total_amount,subtotal_amount,online_payment_amount,onsite_payment_amount,service_type_code,reason,channel,is_test,deleted_at,created_at,updated_at,skus")
  .eq("order_number", orderNumber)
  .order("created_at", { ascending: false });

if (orderError) {
  console.error(JSON.stringify({ ok: false, table: "orders", error: orderError.message }, null, 2));
  process.exit(1);
}

const report = {
  ok: true,
  orderNumber,
  orderCount: count(orders),
  orders: [],
  consistency: []
};

for (const order of orders ?? []) {
  const [
    customerResult,
    homeResult,
    quoteResult,
    paymentResult,
    jobResult,
    eventResult,
    diagnosisResult,
    warrantyResult,
    manualQuoteResult
  ] = await Promise.all([
    order.customer_id ? supabase.from("customers").select("id,name,phone,address_full,address_apt,created_at").eq("id", order.customer_id).maybeSingle() : { data: null, error: null },
    order.home_id ? supabase.from("homes").select("id,customer_id,address_full,address_apt,postal_code,created_at").eq("id", order.home_id).maybeSingle() : { data: null, error: null },
    supabase.from("quotes").select("id,version,total_material,total_labor,total_final,accepted_at,created_at,items").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("payments").select("id,status,amount,provider,online_payment_amount,onsite_payment_amount,total_amount,paid_at,created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("jobs").select("id,status,scheduled_at,time_slot,assigned_technician_name,technician_id,created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("events").select("id,event_type,created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("diagnoses").select("id,result,is_test,created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("warranty_cases").select("id,status,created_at").eq("order_id", order.id).order("created_at", { ascending: false }),
    supabase.from("manual_quotes").select("id,quote_number,total_final,converted_at,created_at").eq("converted_order_id", order.id).order("created_at", { ascending: false })
  ]);

  const relatedErrors = [
    ["customers", customerResult.error],
    ["homes", homeResult.error],
    ["quotes", quoteResult.error],
    ["payments", paymentResult.error],
    ["jobs", jobResult.error],
    ["events", eventResult.error],
    ["diagnoses", diagnosisResult.error],
    ["warranty_cases", warrantyResult.error],
    ["manual_quotes", manualQuoteResult.error]
  ].filter(([, error]) => error);

  const quotes = quoteResult.data ?? [];
  const payments = paymentResult.data ?? [];
  const jobs = jobResult.data ?? [];
  const latestQuote = quotes[0] ?? null;
  const latestPayment = payments[0] ?? null;
  const latestJob = jobs[0] ?? null;

  const issues = [];
  if (order.customer_id && !customerResult.data) issues.push("orders.customer_id points to missing customers row");
  if (order.home_id && !homeResult.data) issues.push("orders.home_id points to missing homes row");
  if (homeResult.data?.customer_id && order.customer_id && homeResult.data.customer_id !== order.customer_id) issues.push("homes.customer_id does not match orders.customer_id");
  if (quotes.length === 0) issues.push("no quotes row linked to this order");
  if (payments.length === 0) issues.push("no payments row linked to this order");
  if (jobs.length === 0) issues.push("no jobs row linked to this order");
  if (latestQuote && Number(latestQuote.total_final ?? 0) !== Number(order.total_amount ?? 0)) issues.push("latest quote total_final differs from orders.total_amount");
  if (latestPayment && Number(latestPayment.total_amount ?? latestPayment.amount ?? 0) !== Number(order.total_amount ?? 0)) issues.push("latest payment total differs from orders.total_amount");
  if (order.status === "scheduled" && latestJob?.status !== "scheduled") issues.push("orders.status is scheduled but latest job is not scheduled");
  if (order.deleted_at) issues.push("order is soft-deleted but still exists in orders table");
  if (relatedErrors.length > 0) issues.push(`related query errors: ${relatedErrors.map(([table, error]) => `${table}:${error.message}`).join(", ")}`);

  report.orders.push({
    order: {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      service_type_code: order.service_type_code,
      reason: order.reason,
      channel: order.channel,
      total_amount: order.total_amount,
      is_test: order.is_test,
      deleted_at: order.deleted_at,
      created_at: order.created_at,
      updated_at: order.updated_at,
      skuCount: count(order.skus)
    },
    customer: customerResult.data ? { id: customerResult.data.id, name: customerResult.data.name, phone: customerResult.data.phone } : null,
    home: homeResult.data ? { id: homeResult.data.id, customer_id: homeResult.data.customer_id, address_full: homeResult.data.address_full } : null,
    counts: {
      quotes: count(quotes),
      payments: count(payments),
      jobs: count(jobs),
      events: count(eventResult.data),
      diagnoses: count(diagnosisResult.data),
      warrantyCases: count(warrantyResult.data),
      convertedManualQuotes: count(manualQuoteResult.data)
    },
    latest: {
      quote: latestQuote ? { id: latestQuote.id, version: latestQuote.version, total_final: latestQuote.total_final, created_at: latestQuote.created_at, itemCount: count(latestQuote.items) } : null,
      payment: latestPayment ? { id: latestPayment.id, status: latestPayment.status, amount: latestPayment.amount, total_amount: latestPayment.total_amount, provider: latestPayment.provider, paid_at: latestPayment.paid_at } : null,
      job: latestJob ? { id: latestJob.id, status: latestJob.status, scheduled_at: latestJob.scheduled_at, time_slot: latestJob.time_slot, assigned_technician_name: latestJob.assigned_technician_name } : null
    },
    related: {
      payments: briefRows(payments, ["id", "status", "amount", "total_amount", "provider", "paid_at"]),
      jobs: briefRows(jobs, ["id", "status", "scheduled_at", "time_slot", "assigned_technician_name"]),
      manualQuotes: briefRows(manualQuoteResult.data, ["id", "quote_number", "total_final", "converted_at"])
    },
    issues
  });

  report.consistency.push({
    orderId: order.id,
    orderNumber: order.order_number,
    issueCount: issues.length,
    issues
  });
}

console.log(JSON.stringify(report, null, 2));

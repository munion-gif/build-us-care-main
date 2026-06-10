import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const toiletPath = path.join(root, "lib", "toilet-products.generated.json");
const replacementPath = path.join(root, "lib", "replacement-products.generated.json");
const outPath = path.join(root, "public", "builduscare", "product-catalog.generated.js");

const serviceLabels = {
  toilet_replace: "양변기 교체",
  basin_replace: "세면대 교체",
  faucet_replace: "수전 교체",
  bidet_install: "비데 설치",
  ventilator_replace: "환풍기 교체",
  sash_handle: "샷시손잡이",
  door_handle: "도어핸들",
  silicone_repair: "실리콘 재시공",
  bath_accessory: "욕실 악세서리",
};

const labelOrder = [
  "양변기 교체",
  "세면대 교체",
  "수전 교체",
  "비데 설치",
  "환풍기 교체",
  "샷시손잡이",
  "도어핸들",
  "실리콘 재시공",
  "욕실 악세서리",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function compactProduct(product, fallbackServiceCode) {
  const serviceCode = product.serviceCode || fallbackServiceCode || "";
  const rec = Boolean(product.rec || product.popular || product.isRecommended || product.recommendLabel);
  return {
    id: product.id,
    serviceCode,
    categoryId: product.categoryId || "",
    categoryName: product.categoryName || "",
    categorySummary: product.categorySummary || "",
    decisionHint: product.decisionHint || "",
    brand: product.brand || "",
    name: product.name || product.model || product.sku || "",
    model: product.model || product.name || product.sku || "",
    sku: product.sku || "",
    color: product.color || "",
    size: product.size || "",
    price: Number(product.price || 0),
    note: product.note || "",
    popular: Boolean(product.popular),
    rec,
    recommendLabel: product.recommendLabel || (rec ? "대표" : ""),
    recommendDescription: product.recommendDescription || "",
    image: product.image || "",
    sourceWorkbook: product.sourceWorkbook || "",
    sourceSheet: product.sourceSheet || "",
    sourceRow: product.sourceRow || null,
  };
}

const catalog = {};

for (const product of readJson(toiletPath)) {
  const normalized = compactProduct(product, "toilet_replace");
  const label = serviceLabels[normalized.serviceCode] || "양변기 교체";
  catalog[label] ||= [];
  catalog[label].push(normalized);
}

for (const product of readJson(replacementPath)) {
  const normalized = compactProduct(product);
  const label = serviceLabels[normalized.serviceCode];
  if (!label) continue;
  catalog[label] ||= [];
  catalog[label].push(normalized);
}

const orderedCatalog = {};
for (const label of labelOrder) {
  if (catalog[label]?.length) orderedCatalog[label] = catalog[label];
}

const body = JSON.stringify(orderedCatalog, null, 2);
fs.writeFileSync(
  outPath,
  `/* Generated from C:/Users/user/Desktop/build_us_care catalogs. Do not edit by hand. */\nwindow.BUILDUS_CARE_CATALOG = ${body};\n`,
  "utf8",
);

const counts = Object.fromEntries(Object.entries(orderedCatalog).map(([label, rows]) => [label, rows.length]));
console.log(JSON.stringify({ output: outPath, counts }, null, 2));

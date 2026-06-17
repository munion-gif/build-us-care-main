import type { BuilduscarePublicProduct } from "@/lib/builduscare-public-products";

function productNoteSegments(product: BuilduscarePublicProduct) {
  const raw = String(product.note || "").replace(/\r\n?/g, "\n").trim();
  if (!raw) return [];
  if (raw.includes("\n")) return raw.split("\n").map((line) => line.trim()).filter(Boolean);
  return raw.split(/\s*,\s*/u).map((line) => line.trim()).filter(Boolean);
}

function isSizeSegment(value: string) {
  return /^사이즈(?:\s|$)/u.test(value);
}

function isColorSegment(value: string) {
  return /^색상(?:\s|$)/u.test(value);
}

export function primarySpec(product: BuilduscarePublicProduct) {
  if (product.sizeLabel) return product.sizeLabel;
  const segments = productNoteSegments(product);
  const size = segments.find(isSizeSegment)
    ?? segments.find((segment) => /(?:[LWHØ]?\d|x|×|\[W\]|mm)/iu.test(segment) && !isColorSegment(segment));
  if (size) return size;
  return segments.find((segment) => !isColorSegment(segment)) || product.categorySummary || "사진 확인 후 규격을 확정합니다.";
}

export function featureSpec(product: BuilduscarePublicProduct, primary: string) {
  const lines = product.featureText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== primary && !isColorSegment(line));
  return lines.join("\n") || product.categorySummary || "사진 확인 후 세부 특징을 확정합니다.";
}

export function skuSpec(product: BuilduscarePublicProduct) {
  return product.sku || product.model || product.displayModel || "제품 정보 확인";
}

import { randomUUID } from "node:crypto";
import path from "node:path";

export const ORDER_PHOTOS_BUCKET = "buildus-order-photos";
export const ORDER_PHOTO_UPLOAD_EXPIRES_IN = 60 * 60 * 2;
export const ORDER_PHOTO_VIEW_EXPIRES_IN = 60 * 15;

export const ALLOWED_PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif"
};

export function isAllowedPhotoContentType(contentType: string) {
  return ALLOWED_PHOTO_CONTENT_TYPES.includes(contentType as (typeof ALLOWED_PHOTO_CONTENT_TYPES)[number]);
}

export function sanitizeFileName(fileName: string, contentType: string) {
  const parsed = path.parse(fileName);
  const base = parsed.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const safeBase = base || "photo";
  const ext = EXTENSION_BY_CONTENT_TYPE[contentType] ?? parsed.ext.toLowerCase();

  return `${safeBase}${ext}`;
}

export function createOrderPhotoPath(orderId: string, fileName: string, contentType: string) {
  return `orders/${orderId}/original/${randomUUID()}_${sanitizeFileName(fileName, contentType)}`;
}

export function createOrderInquiryMediaPath(orderId: string, fileName: string, contentType: string) {
  return `orders/${orderId}/inquiry/${randomUUID()}_${sanitizeFileName(fileName, contentType)}`;
}

export function createJobMediaPath(jobId: string, type: string, fileName: string, contentType: string) {
  return `jobs/${jobId}/${type}/${randomUUID()}_${sanitizeFileName(fileName, contentType)}`;
}

export function createDiagnosisTempPhotoPath(fileName: string, contentType: string) {
  return `diagnoses/temp/${randomUUID()}_${sanitizeFileName(fileName, contentType)}`;
}

export function isOrderPhotoPath(orderId: string, filePath: string) {
  return filePath.startsWith(`orders/${orderId}/`) && !filePath.includes("..") && !filePath.startsWith("/");
}

export function isOrderInquiryMediaPath(orderId: string, filePath: string) {
  return filePath.startsWith(`orders/${orderId}/inquiry/`) && !filePath.includes("..") && !filePath.startsWith("/");
}

export function isJobMediaPath(jobId: string, type: string, filePath: string) {
  return filePath.startsWith(`jobs/${jobId}/${type}/`) && !filePath.includes("..") && !filePath.startsWith("/");
}

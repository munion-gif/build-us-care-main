import {
  createOrderInquiryMediaPath,
  isAllowedPhotoContentType,
  MAX_PHOTO_UPLOAD_BYTES,
  ORDER_PHOTOS_BUCKET
} from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabase";

export function builduscarePhotoFiles(formData: FormData) {
  return formData
    .getAll("photos")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

export async function attachBuilduscareOrderPhotos(orderId: string, files: File[]) {
  if (files.length === 0) return [];

  const supabase = getSupabaseAdmin();
  const uploads = await Promise.all(files.slice(0, 12).map(async (file, index) => {
    if (!isAllowedPhotoContentType(file.type)) {
      throw new Error("지원하지 않는 사진 형식이 포함되어 있습니다.");
    }
    if (file.size > MAX_PHOTO_UPLOAD_BYTES) {
      throw new Error("사진은 장당 10MB 이하만 업로드할 수 있습니다.");
    }

    const filePath = createOrderInquiryMediaPath(orderId, file.name || `photo-${index + 1}.jpg`, file.type);
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(ORDER_PHOTOS_BUCKET).upload(filePath, buffer, {
      contentType: file.type,
      upsert: false
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    return {
      filePath,
      mediaRow: {
        order_id: orderId,
        job_id: null,
        type: "inquiry",
        url: `storage://${ORDER_PHOTOS_BUCKET}/${filePath}`,
        file_path: filePath,
        angle: null,
        tags: ["customer", "builduscare-static"],
        sort_order: index
      }
    };
  }));

  const uploaded = uploads.map((upload) => upload.filePath);
  const mediaRows: Array<Record<string, unknown>> = uploads.map((upload) => upload.mediaRow);

  if (mediaRows.length === 0) return uploaded;

  const { data: existingOrder, error: lookupError } = await supabase
    .from("orders")
    .select("inquiry_photos")
    .eq("id", orderId)
    .single();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  const existingPhotos = Array.isArray(existingOrder?.inquiry_photos) ? existingOrder.inquiry_photos : [];
  const updatedPhotos = Array.from(new Set([...existingPhotos, ...uploaded]));
  const [mediaResult, orderResult] = await Promise.all([
    supabase.from("media").insert(mediaRows),
    supabase
      .from("orders")
      .update({ inquiry_photos: updatedPhotos })
      .eq("id", orderId)
  ]);

  if (mediaResult.error) {
    throw new Error(mediaResult.error.message);
  }
  if (orderResult.error) {
    throw new Error(orderResult.error.message);
  }

  return updatedPhotos;
}

export async function upsertBuilduscarePhotoDiagnosis(params: {
  orderId: string;
  orderNumber: string;
  serviceCode: string;
  photoPaths: string[];
  name: string;
  phone: string;
  roadAddress: string;
  detailAddress: string;
  postalCode: string;
  item: string;
}) {
  if (params.photoPaths.length === 0) return null;

  const supabase = getSupabaseAdmin();
  const rawResponse = {
    source: "builduscare_photo_check",
    receipt_number: params.orderNumber,
    order_number: params.orderNumber,
    order_id: params.orderId,
    service_code: params.serviceCode,
    item: params.item,
    customer: {
      name: params.name,
      phone: params.phone
    },
    address: {
      roadAddress: params.roadAddress,
      detailAddress: params.detailAddress,
      postalCode: params.postalCode,
      full: [params.roadAddress, params.detailAddress].filter(Boolean).join(" ")
    },
    photo_count: params.photoPaths.length
  };

  const { data: existing, error: lookupError } = await supabase
    .from("diagnoses")
    .select("id")
    .eq("order_id", params.orderId)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);

  const row = {
    order_id: params.orderId,
    service_type_code: params.serviceCode,
    service_code: params.serviceCode,
    image_urls: params.photoPaths,
    photos: params.photoPaths,
    result: null,
    confidence: null,
    reason: null,
    details: "Build us Care 사진 확인 접수",
    recommendation: null,
    customer_name: params.name,
    customer_phone: params.phone,
    raw_response: rawResponse,
    is_test: false
  };

  if (existing?.id) {
    const { data, error } = await supabase
      .from("diagnoses")
      .update(row)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("diagnoses")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

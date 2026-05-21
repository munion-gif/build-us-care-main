import { z } from "zod";
import { OPERATIONAL_ORDER_STATUSES, normalizeOrderStatusAlias } from "@/lib/types";

export const uuidSchema = z.string().uuid();
export const phoneSchema = z.string().min(8).max(20);
export const accessTokenSchema = z.string().regex(/^[a-f0-9]{48}$/);

export const quoteOptionSchema = z.object({
  name: z.string().min(1),
  price_delta: z.number().int().min(0)
});

export const quoteItemSchema = z.object({
  service_type_code: z.string().min(1).optional(),
  product_id: z.string().uuid().optional(),
  item_name: z.string().min(1),
  qty: z.number().int().positive(),
  unit_price: z.number().int().min(0),
  options: z.array(quoteOptionSchema).default([]),
  metadata: z.record(z.unknown()).optional()
});

export const quoteRequestSchema = z.object({
  order_id: z.string().uuid().optional(),
  visit_fee: z.number().int().min(0).optional(),
  items: z.array(quoteItemSchema).min(1),
  discount: z.number().int().min(0).default(0)
});

export const addressSchema = z.object({
  road_address: z.string().min(1),
  detail_address: z.string().default(""),
  postal_code: z.string().default(""),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional()
});

export const homeSchema = z.object({
  address_full: z.string().min(1).optional(),
  address_dong: z.string().min(1).default("unknown"),
  address_apt: z.string().optional(),
  postal_code: z.string().default(""),
  size_pyung: z.coerce.number().int().min(0).default(0),
  building_type: z.enum(["apartment", "villa", "house", "officetel", "commercial", "unknown"]).default("unknown"),
  year_built: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
  housing_type: z.enum(["owner", "jeonse", "monthly_rent", "unknown"]).default("unknown"),
  floor: z.string().max(40).optional(),
  complex_id: z.string().max(120).optional()
});

export const createOrderSchema = z.object({
  customer: z.object({
    phone: phoneSchema,
    name: z.string().min(1).optional(),
    acquisition_source: z.string().min(1).default("unknown"),
    household_size: z.coerce.number().int().min(1).max(20).optional(),
    has_kids: z.boolean().optional(),
    has_elderly: z.boolean().optional(),
    utm_source: z.string().optional(),
    utm_campaign: z.string().optional(),
    utm_medium: z.string().optional(),
    referrer_url: z.string().optional()
  }),
  address: addressSchema,
  home: homeSchema.optional(),
  order: z
    .object({
      channel: z.string().min(1).default("web"),
      reason: z.string().min(1).default("unknown"),
      urgency: z.string().min(1).default("flexible"),
      self_diagnosis: z.string().optional(),
      skus: z.array(z.record(z.unknown())).optional()
    })
    .optional(),
  channel: z.string().min(1).optional(),
  reason: z.string().min(1).optional(),
  urgency: z.string().min(1).optional(),
  self_diagnosis: z.string().optional(),
  utm_source: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_medium: z.string().optional(),
  referrer_url: z.string().optional(),
  session_id: z.string().min(1).max(160).optional(),
  landing_path: z.string().max(300).optional(),
  device_type: z.enum(["mobile", "desktop"]).optional(),
  region_code: z.string().max(120).optional(),
  service_type_code: z.string().min(1).optional(),
  special_requests: z.string().optional(),
  visit_fee: z.number().int().min(0).optional(),
  items: z.array(quoteItemSchema).min(1)
});

export const uploadPhotosSchema = z.object({
  accessToken: accessTokenSchema.optional(),
  photos: z
    .array(
      z.object({
        file_path: z.string().min(1),
        sort_order: z.number().int().min(0).default(0)
      })
    )
    .min(1)
    .max(10)
});

export const createPhotoUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  accessToken: accessTokenSchema.optional()
});

export const mediaTypeSchema = z.enum(["inquiry", "before", "during", "after", "material", "issue", "report_video"]);
export const jobMediaTypeSchema = z.enum(["before", "during", "after", "material", "issue"]);

export const createOrderMediaUploadUrlSchema = createPhotoUploadUrlSchema;

export const createJobMediaUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]),
  type: jobMediaTypeSchema
});

export const createOrderMediaSchema = z.object({
  accessToken: accessTokenSchema.optional(),
  file_path: z.string().min(1),
  url: z.string().min(1).optional(),
  angle: z.string().min(1).optional(),
  tags: z.array(z.string()).default([]),
  ai_detected: z.record(z.unknown()).nullable().optional()
}).strict();

export const createJobMediaSchema = z.object({
  file_path: z.string().min(1),
  url: z.string().min(1).optional(),
  type: jobMediaTypeSchema,
  angle: z.string().min(1).optional(),
  tags: z.array(z.string()).default([]),
  ai_detected: z.record(z.unknown()).nullable().optional()
}).strict();

export const createMediaSchema = z.object({
  order_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  type: mediaTypeSchema,
  file_path: z.string().min(1),
  url: z.string().min(1).optional(),
  angle: z.string().min(1).optional(),
  tags: z.array(z.string()).default([]),
  ai_detected: z.record(z.unknown()).nullable().optional()
});

export const reservationSchema = z.object({
  reserved_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_slot: z.enum(["morning", "afternoon", "all_day"]),
  status: z.enum(["pending", "confirmed"]).default("confirmed"),
  notes: z.string().optional()
});

export const tossConfirmSchema = z.object({
  orderId: z.string().uuid(),
  paymentKey: z.string().min(1).max(200),
  amount: z.number().int().min(0),
  orderName: z.string().min(1).optional()
});

export const tossWebhookSchema = z
  .object({
    eventType: z
      .enum(["PAYMENT_STATUS_CHANGED", "DEPOSIT_CALLBACK", "CANCEL_STATUS_CHANGED", "METHOD_UPDATED", "CUSTOMER_STATUS_CHANGED"])
      .or(z.string().min(1)),
    paymentKey: z.string().min(1).max(200).optional(),
    orderId: z.string().min(1).optional(),
    status: z.string().min(1).optional()
  })
  .passthrough();

export const orderStatusQuerySchema = z.object({
  accessToken: accessTokenSchema
});

export const reviewSchema = z.object({
  order_id: z.string().uuid(),
  access_token: z.string().min(16),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});

export const feedbackCategoryScoresSchema = z
  .object({
    speed: z.number().int().min(1).max(5).optional(),
    kindness: z.number().int().min(1).max(5).optional(),
    quality: z.number().int().min(1).max(5).optional(),
    cleanliness: z.number().int().min(1).max(5).optional(),
    price: z.number().int().min(1).max(5).optional()
  })
  .strict();

export const createFeedbackSchema = z
  .object({
    accessToken: accessTokenSchema.optional(),
    rating: z.number().int().min(1).max(5),
    nps: z.number().int().min(0).max(10),
    comment: z.string().optional(),
    categories: feedbackCategoryScoresSchema.default({}),
    score_time: z.number().int().min(1).max(5).optional(),
    score_quality: z.number().int().min(1).max(5).optional(),
    score_response: z.number().int().min(1).max(5).optional(),
    score_clean: z.number().int().min(1).max(5).optional(),
    score_price: z.number().int().min(1).max(5).optional(),
    would_recommend: z.boolean().optional(),
    would_repurchase: z.boolean().optional()
  })
  .strict();

export const feedbackQuerySchema = z.object({
  accessToken: accessTokenSchema.optional()
});

export const operationalOrderStatusSchema = z.enum(OPERATIONAL_ORDER_STATUSES);
export const orderStatusInputSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return normalizeOrderStatusAlias(value);
}, operationalOrderStatusSchema);

export const orderStatusPatchSchema = z.object({
  status: orderStatusInputSchema
});

export const assignJobSchema = z.object({
  assigned_technician_name: z.string().min(1),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const createAdminJobSchema = z
  .object({
    order_id: z.string().uuid(),
    technician_id: z.string().uuid(),
    scheduled_at: z.string().datetime({ offset: true }),
    expected_minutes: z.number().int().min(0).optional()
  })
  .strict();

export const startJobSchema = z
  .object({
    expected_minutes: z.number().int().min(0).optional()
  })
  .strict();

export const completeJobSchema = z
  .object({
    actual_minutes: z.number().int().min(0).optional(),
    materials_used: z.array(z.object({ sku: z.string().min(1), qty: z.number().int().positive() })).default([]),
    extra_materials: z.array(z.object({ sku: z.string().min(1), reason: z.string().optional() })).default([]),
    completion_notes: z.string().optional(),
    issues: z.string().optional()
  })
  .strict();

export const inspectJobSchema = z
  .object({
    passed: z.boolean(),
    inspector_note: z.string().optional(),
    checklist_results: z.array(z.object({ item: z.string().min(1), ok: z.boolean(), note: z.string().optional() })).default([])
  })
  .strict();

export const jobStatusPatchSchema = z.object({
  status: z.enum([
    "received",
    "material_ready",
    "assigned",
    "scheduled",
    "in_progress",
    "completed",
    "cancelled"
  ]),
  memo: z.string().optional()
});

export const reportVideoSchema = z.object({
  report_video_url: z.string().url()
});

export const createWarrantyCaseSchema = z
  .object({
    accessToken: accessTokenSchema.optional(),
    type: z.enum(["leak", "falling", "noise", "other"]),
    description: z.string().min(1).max(2000)
  })
  .strict();

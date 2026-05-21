import { fail, ok } from "@/lib/api-response";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";
import { validationError } from "@/lib/errors";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required to read diagnoses.", 500);
  }

  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);

  if (!parsed.success) {
    return validationError(parsed.error, "Invalid diagnosis id.");
  }

  const { data, error } = await getSupabaseAdmin().from("diagnoses").select("*").eq("id", parsed.data).maybeSingle();

  if (error) {
    return fail("internal_error", error.message, 500);
  }

  if (!data) {
    return fail("not_found", "Diagnosis not found.", 404);
  }

  const isManualPhotoCheck = data.raw_response?.mode === "manual_photo_consultation";

  return ok({
    diagnosis: isManualPhotoCheck ? { ...data, result: "photo_check_received" } : data,
    pending: data.result === null && !isManualPhotoCheck
  });
}

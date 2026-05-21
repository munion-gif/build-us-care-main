import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  result: z.enum(["교체추천", "교체불필요", "보류", "현장확인필요", "replace_recommended", "replacement_recommended", "hold", "no_replacement_needed", "not_needed", "site_check_required"]),
  result_message: z.string().optional(),
  reason: z.string().optional(),
  suggested_service_code: z.string().optional()
});

export async function PATCH(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);
  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return validationError(parsedId.error, "Invalid diagnosis id.");
  const body = await readJson(request);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, "Invalid diagnosis update.");
  const resultMap: Record<string, string> = {
    replacement_recommended: "replace_recommended",
    not_needed: "no_replacement_needed"
  };
  const { data, error } = await getSupabaseAdmin()
    .from("diagnoses")
    .update({ ...parsed.data, result: resultMap[parsed.data.result] ?? parsed.data.result, reviewed_by: "admin", reviewed_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .select("*")
    .single();
  if (error) return fail("internal_error", error.message, 500);
  return ok({ diagnosis: data });
}

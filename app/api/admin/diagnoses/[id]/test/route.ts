import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { getAdminKeyId, requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";
import { uuidSchema } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({
  is_test: z.boolean(),
  note: z.string().max(300).optional()
});

function adminActor(request: Request) {
  return getAdminKeyId(request) ?? "admin_session";
}

export async function PATCH(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) return validationError(parsedId.error, "Invalid diagnosis id.");

  const body = await readJson(request);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error, "Invalid test flag update.");

  const now = new Date().toISOString();
  const patch = parsed.data.is_test
    ? {
        is_test: true,
        test_marked_at: now,
        test_marked_by: adminActor(request),
        test_note: parsed.data.note?.trim() || null
      }
    : {
        is_test: false,
        test_marked_at: now,
        test_marked_by: adminActor(request),
        test_note: parsed.data.note?.trim() || null
      };

  const { data, error } = await getSupabaseAdmin()
    .from("diagnoses")
    .update(patch)
    .eq("id", parsedId.data)
    .select("id,is_test,test_marked_at,test_note")
    .single();

  if (error) return fail("internal_error", error.message, 500);
  return ok({ diagnosis: data });
}

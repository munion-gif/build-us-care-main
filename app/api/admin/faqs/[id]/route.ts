import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

type Context = {
  params: Promise<{ id: string }>;
};

const updateSchema = z.object({
  question: z.string().trim().min(1).optional(),
  answer: z.string().trim().min(1).optional(),
  category: z.string().trim().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional()
});

export async function PATCH(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid FAQ update request.");
  if (Object.keys(parsed.data).length === 0) return fail("BAD_REQUEST", "No fields to update.", 400);

  const { data, error } = await getSupabaseAdmin()
    .from("faqs")
    .update(parsed.data)
    .eq("id", id)
    .select("id,question,answer,category,display_order,is_active")
    .single();

  if (error) return fail("internal_error", error.message, 500);
  return ok({ faq: data });
}

export async function DELETE(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const { error } = await getSupabaseAdmin().from("faqs").delete().eq("id", id);
  if (error) return fail("internal_error", error.message, 500);
  return ok({ deleted: true });
}

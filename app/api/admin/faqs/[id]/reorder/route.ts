import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

type Context = {
  params: Promise<{ id: string }>;
};

const reorderSchema = z.object({
  display_order: z.coerce.number().int().min(0)
});

export async function PATCH(request: Request, context: Context) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { id } = await context.params;
  const parsed = reorderSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid FAQ reorder request.");

  const { data, error } = await getSupabaseAdmin()
    .from("faqs")
    .update({ display_order: parsed.data.display_order })
    .eq("id", id)
    .select("id,question,answer,category,display_order,is_active")
    .single();

  if (error) return fail("internal_error", error.message, 500);
  return ok({ faq: data });
}

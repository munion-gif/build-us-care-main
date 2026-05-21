import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const createSchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
  category: z.string().trim().optional(),
  display_order: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional()
});

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const { data, error } = await getSupabaseAdmin()
    .from("faqs")
    .select("id,question,answer,category,display_order,is_active,created_at")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return fail("internal_error", error.message, 500);
  return ok({ faqs: data ?? [] });
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);

  const parsed = createSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid FAQ request.");

  const { data, error } = await getSupabaseAdmin()
    .from("faqs")
    .insert({
      question: parsed.data.question,
      answer: parsed.data.answer,
      category: parsed.data.category || "general",
      display_order: parsed.data.display_order ?? 0,
      is_active: parsed.data.is_active ?? true
    })
    .select("id,question,answer,category,display_order,is_active")
    .single();

  if (error) return fail("internal_error", error.message, 500);
  return ok({ faq: data }, { status: 201 });
}

import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { requireAdmin } from "@/lib/admin-auth";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const schema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  type: z.enum(["direct", "contractor"]),
  grade: z.enum(["bronze", "silver", "gold", "premium"]).optional(),
  skills: z.array(z.string()).default([]),
  region: z.string().trim().optional(),
  note: z.string().trim().optional(),
  experience_years: z.coerce.number().int().min(0).max(80).optional(),
  specialties: z.array(z.string()).default([]),
  bio: z.string().trim().optional(),
  profile_image_url: z.string().trim().optional(),
  is_active: z.boolean().optional()
});

const patchSchema = z.object({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
  region: z.string().trim().optional(),
  note: z.string().trim().optional(),
  experience_years: z.coerce.number().int().min(0).max(80).optional(),
  specialties: z.array(z.string()).optional(),
  bio: z.string().trim().optional(),
  profile_image_url: z.string().trim().optional()
});

export async function GET(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);
  const { data, error } = await getSupabaseAdmin().from("technicians").select("*").order("created_at", { ascending: false });
  if (error) return fail("internal_error", error.message, 500);
  return ok({ technicians: data });
}

export async function POST(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid technician request.");
  const { data, error } = await getSupabaseAdmin().from("technicians").insert(parsed.data).select("*").single();
  if (error) return fail("internal_error", error.message, 500);
  return ok({ technician: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const authError = requireAdmin(request);
  if (authError) return authError;
  if (!hasSupabaseEnv()) return fail("supabase_not_configured", "Supabase is required.", 500);
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid technician update request.");
  const { id, ...patch } = parsed.data;
  if (Object.keys(patch).length === 0) return fail("BAD_REQUEST", "No fields to update.", 400);
  const { data, error } = await getSupabaseAdmin().from("technicians").update(patch).eq("id", id).select("*").single();
  if (error) return fail("internal_error", error.message, 500);
  return ok({ technician: data });
}

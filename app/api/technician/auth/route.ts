import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { readJson, validationError } from "@/lib/errors";
import { getSupabaseAdmin, hasSupabaseEnv } from "@/lib/supabase";

const schema = z.object({
  token: z.string().min(16)
});

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return fail("supabase_not_configured", "Supabase is required.", 500);
  }

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error, "Invalid technician token.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("technicians")
    .select("id,name")
    .eq("access_token", parsed.data.token)
    .eq("is_active", true)
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500);
  if (!data) return fail("UNAUTHORIZED", "기사 토큰이 올바르지 않아요.", 401);

  await supabase.from("technicians").update({ last_login_at: new Date().toISOString() }).eq("id", data.id);

  const response = NextResponse.json({ ok: true, data: { technician: data } });
  response.cookies.set("tech_session", parsed.data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/technician",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}

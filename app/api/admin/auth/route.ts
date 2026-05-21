import { NextResponse } from "next/server";
import { readJson } from "@/lib/errors";

export async function POST(request: Request) {
  const body = await readJson(request);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: { code: "unauthorized", message: "비밀번호가 올바르지 않아요" } }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("admin_session", process.env.ADMIN_SESSION_SECRET, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24
  });
  return response;
}

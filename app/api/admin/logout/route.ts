import { NextResponse } from "next/server";

export async function POST() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://127.0.0.1:3000";
  const response = NextResponse.redirect(new URL("/admin/login", baseUrl));
  response.cookies.set("admin_session", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}

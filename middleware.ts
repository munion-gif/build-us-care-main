import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin") && req.nextUrl.pathname !== "/admin/login") {
    const cookie = req.cookies.get("admin_session")?.value;
    if (!process.env.ADMIN_SESSION_SECRET || cookie !== process.env.ADMIN_SESSION_SECRET) {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  if (req.nextUrl.pathname.startsWith("/technician") && req.nextUrl.pathname !== "/technician/login") {
    const token = req.nextUrl.searchParams.get("token");
    if (token) {
      const redirectUrl = new URL("/technician", req.url);
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.set("tech_session", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/technician",
        maxAge: 60 * 60 * 24 * 30
      });
      return response;
    }

    const cookie = req.cookies.get("tech_session")?.value;
    if (!cookie) {
      return NextResponse.redirect(new URL("/technician/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*", "/technician/:path*"] };

import { NextResponse } from "next/server";
import { consumeMagicLink, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { ensurePlans } from "@/db/client";
import { appUrl } from "@/lib/env";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  await ensurePlans();
  const consumed = token ? await consumeMagicLink(token) : null;
  if (!consumed) {
    return NextResponse.redirect(new URL("/login?error=expired", appUrl()));
  }
  const response = NextResponse.redirect(new URL("/dashboard", appUrl()));
  response.cookies.set(SESSION_COOKIE, consumed.sessionToken, sessionCookieOptions());
  return response;
}

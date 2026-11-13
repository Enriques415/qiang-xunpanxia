import { NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { appUrl } from "@/lib/env";

export async function POST() {
  await destroySession();
  const response = NextResponse.redirect(new URL("/login", appUrl()), 303);
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}

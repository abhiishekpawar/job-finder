import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getSessionCookieOptions } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  // Clear current and legacy cookie names.
  for (const name of [AUTH_COOKIE_NAME, "job_hunter_session"]) {
    response.cookies.set(name, "", {
      ...getSessionCookieOptions(0),
      maxAge: 0
    });
  }
  return response;
}

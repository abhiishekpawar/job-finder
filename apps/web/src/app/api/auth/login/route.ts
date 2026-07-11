import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getSessionCookieOptions,
  verifyCredentials
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());

    if (!verifyCredentials(body.username, body.password)) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const token = await createSessionToken(body.username.trim());
    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, token, getSessionCookieOptions());
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

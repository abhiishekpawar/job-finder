export const AUTH_COOKIE_NAME = "job_hunter_session_v2";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function getAuthConfig() {
  const username = process.env.AUTH_USERNAME?.trim() || "abhiiishek.pawar";
  const password = process.env.AUTH_PASSWORD?.trim() || "jobHunter00@";
  const secret = process.env.AUTH_SECRET?.trim() || `${username}:${password}:job-hunter-dev`;
  return { username, password, secret };
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 1) binary += String.fromCharCode(view[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + "=".repeat(padLength);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function fromUtf8(value: string) {
  return new TextEncoder().encode(value);
}

async function importHmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    fromUtf8(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(value: string, secret: string) {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, fromUtf8(value));
  return toBase64Url(signature);
}

function timingSafeEqualStrings(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export function verifyCredentials(username: string, password: string) {
  const config = getAuthConfig();
  const userOk = timingSafeEqualStrings(username.trim(), config.username);
  const passOk = timingSafeEqualStrings(password, config.password);
  return userOk && passOk;
}

export async function createSessionToken(username: string) {
  const { secret } = getAuthConfig();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  // Base64url username so dots in names like "abhiiishek.pawar" don't break parsing.
  const encodedUsername = toBase64Url(fromUtf8(username.trim()));
  const payload = `${encodedUsername}.${expiresAt}`;
  const signature = await sign(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined | null
): Promise<{ username: string } | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedUsername, expiresAtRaw, signature] = parts;
  const payload = `${encodedUsername}.${expiresAtRaw}`;
  const { secret } = getAuthConfig();
  const expected = await sign(payload, secret);

  if (!timingSafeEqualStrings(signature, expected)) return null;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  try {
    return { username: fromBase64Url(encodedUsername) };
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds
  };
}

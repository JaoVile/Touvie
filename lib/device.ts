import { fromHex, hmacKey, sign, toHex } from "@/lib/crypto";

export const TRUSTED_COOKIE = "rotina_edit";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function signTrustedDevice(userId: string): Promise<string> {
  const nonceBuf = new ArrayBuffer(12);
  crypto.getRandomValues(new Uint8Array(nonceBuf));
  const nonce = toHex(nonceBuf);
  const payload = `${userId}.${nonce}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifyTrustedDevice(
  token: string | undefined,
  userId: string | undefined,
): Promise<boolean> {
  if (!token || !userId) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenUserId, nonce, sig] = parts;
  if (tokenUserId !== userId) return false;
  const key = await hmacKey();
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    fromHex(sig),
    new TextEncoder().encode(`${tokenUserId}.${nonce}`),
  );
  return ok;
}

export function trustedCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

import { fromHex, hmacKey, sign } from "@/lib/crypto";
import bcrypt from "bcryptjs";

export const DIARY_COOKIE = "diary_unlocked";
const DIARY_TTL_SECONDS = 30 * 60;
const BCRYPT_COST = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, BCRYPT_COST);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

export async function signDiaryToken(userId: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + DIARY_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const sig = await sign(payload);
  return `${payload}.${sig}`;
}

export async function verifyDiaryToken(
  token: string | undefined,
  userId: string | undefined,
): Promise<boolean> {
  if (!token || !userId) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenUserId, expiresStr, sig] = parts;
  if (tokenUserId !== userId) return false;
  const expires = Number.parseInt(expiresStr, 10);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const key = await hmacKey();
  return crypto.subtle.verify(
    "HMAC",
    key,
    fromHex(sig),
    new TextEncoder().encode(`${tokenUserId}.${expiresStr}`),
  );
}

export function diaryCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DIARY_TTL_SECONDS,
  };
}

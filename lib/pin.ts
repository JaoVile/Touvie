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

function secret(): string {
  const s = process.env.TRUSTED_DEVICE_SECRET;
  if (!s) throw new Error("TRUSTED_DEVICE_SECRET not set");
  return s;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): ArrayBuffer {
  const out = new ArrayBuffer(hex.length / 2);
  const view = new Uint8Array(out);
  for (let i = 0; i < view.length; i++) {
    view[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(sig);
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

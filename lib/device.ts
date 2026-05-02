export const TRUSTED_COOKIE = "rotina_edit";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

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

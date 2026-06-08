// Primitivas HMAC-SHA256 sobre TRUSTED_DEVICE_SECRET, compartilhadas
// entre pin.ts (token de leitura do diário) e device.ts (cookie de
// device confiável). Web Crypto pra rodar igual em edge/node.

function secret(): string {
  const s = process.env.TRUSTED_DEVICE_SECRET;
  if (!s) throw new Error("TRUSTED_DEVICE_SECRET not set");
  return s;
}

export function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): ArrayBuffer {
  const out = new ArrayBuffer(hex.length / 2);
  const view = new Uint8Array(out);
  for (let i = 0; i < view.length; i++) {
    view[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function sign(payload: string): Promise<string> {
  const key = await hmacKey();
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(sig);
}

/**
 * Cripto zero-knowledge do diário — roda SÓ no navegador (Web Crypto API).
 * O servidor NUNCA vê PIN, palavra-chave, código de recuperação, a DEK ou o
 * texto puro. Ele só guarda blobs cifrados.
 *
 * Modelo: uma DEK (Data Encryption Key) aleatória cifra todas as anotações.
 * A DEK é "trancada" por 3 portas independentes — PIN, palavra-chave e código
 * de recuperação. Qualquer uma destranca; perder as 3 = dado perdido (é o preço
 * do "nem eu leio"). Ver [[feedback-communication-focus]] / decisão do usuário.
 */

const PBKDF2_ITERATIONS = 250_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const DEK_BYTES = 32;
const ENTRY_PREFIX = "enc:v1:";

export interface WrappedKey {
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64 — a DEK cifrada
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Normaliza a palavra-chave (igual ao servidor) pra derivar sempre a mesma key. */
export function normalizePhrase(phrase: string): string {
  return phrase.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Normaliza o código de recuperação (sem hífens/espaços, maiúsculas). */
export function normalizeCode(code: string): string {
  return code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

/** DEK aleatória de 256 bits. */
export function generateDEK(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(DEK_BYTES));
}

/**
 * Código de recuperação legível: 4 grupos de 5 (base32 Crockford, sem I/L/O/U
 * pra não confundir). ~100 bits de entropia.
 */
export function generateRecoveryCode(): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let s = "";
  for (let i = 0; i < 20; i++) s += alphabet[bytes[i] % 32];
  return `${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10, 15)}-${s.slice(15, 20)}`;
}

/**
 * Coage um Uint8Array para um ArrayBuffer "limpo" (não SharedArrayBuffer). O
 * TS novo exige isso nas APIs do Web Crypto (BufferSource ⊂ ArrayBuffer).
 */
function ab(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Deriva uma chave AES-GCM de um segredo + salt (PBKDF2-SHA256). */
async function deriveKEK(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", ab(enc.encode(secret)), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ab(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** "Tranca" a DEK com um segredo → {salt, iv, ct}. */
export async function wrapDEK(dek: Uint8Array, secret: string): Promise<WrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const kek = await deriveKEK(secret, salt);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(iv) }, kek, ab(dek));
  return { salt: toB64(salt), iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

/** "Destranca" a DEK com um segredo. Lança se o segredo estiver errado. */
export async function unwrapDEK(wrapped: WrappedKey, secret: string): Promise<Uint8Array> {
  const kek = await deriveKEK(secret, fromB64(wrapped.salt));
  const dek = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ab(fromB64(wrapped.iv)) },
    kek,
    ab(fromB64(wrapped.ct)),
  );
  return new Uint8Array(dek);
}

/** É uma anotação cifrada? (prefixo enc:v1:) */
export function isEncrypted(content: string): boolean {
  return content.startsWith(ENTRY_PREFIX);
}

/** Cifra um texto com a DEK → "enc:v1:<iv>:<ct>". */
export async function encryptEntry(plaintext: string, dek: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey("raw", ab(dek), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: ab(iv) }, key, ab(enc.encode(plaintext)));
  return `${ENTRY_PREFIX}${toB64(iv)}:${toB64(new Uint8Array(ct))}`;
}

/** Decifra "enc:v1:<iv>:<ct>" com a DEK. Texto não-cifrado volta como veio. */
export async function decryptEntry(content: string, dek: Uint8Array): Promise<string> {
  if (!isEncrypted(content)) return content;
  const parts = content.split(":"); // ["enc","v1",iv,ct] — base64 não tem ":"
  const key = await crypto.subtle.importKey("raw", ab(dek), "AES-GCM", false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ab(fromB64(parts[2])) },
    key,
    ab(fromB64(parts[3])),
  );
  return dec.decode(pt);
}

// --- DEK na sessão do navegador (só na aba atual; some ao fechar) ----------

const DEK_SESSION_KEY = "touvie:diary:dek";

export function storeSessionDEK(dek: Uint8Array): void {
  sessionStorage.setItem(DEK_SESSION_KEY, toB64(dek));
}

export function loadSessionDEK(): Uint8Array | null {
  const s = sessionStorage.getItem(DEK_SESSION_KEY);
  return s ? fromB64(s) : null;
}

export function clearSessionDEK(): void {
  sessionStorage.removeItem(DEK_SESSION_KEY);
}

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

/**
 * Normaliza a palavra-chave de recuperação antes de hashear/comparar, pra que
 * "Minha Frase " e "minha frase" sejam a mesma coisa (trim + espaços colapsados
 * + minúsculas). Usada no cadastro e no fluxo de redefinir PIN.
 */
export function normalizeRecovery(phrase: string): string {
  return phrase.trim().replace(/\s+/g, " ").toLowerCase();
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

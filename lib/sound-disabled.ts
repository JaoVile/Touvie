// Curadoria de variantes: quais takes de cada textura o usuário DESLIGOU (saem do
// shuffle do engine). Preferência persistente e ortogonal ao SoundState (que é a
// mix do momento). Guardado no localStorage; o SoundscapeLayer alimenta o engine.
//
// Também mora aqui o evento de PREVIEW (tocar um take isolado a partir dos créditos),
// porque é a mesma feature "curar variantes na lista de créditos".

import type { TextureKey } from "./soundscape";

/** id do arquivo: "<key>-<n>" (multi-variante) ou "<key>" (arquivo único). */
export function variantId(key: TextureKey | string, variant?: number): string {
  return variant ? `${key}-${variant}` : `${key}`;
}

export const DISABLED_KEY = "touvie:sound-disabled";
export const DISABLED_EVENT = "touvie:sound-disabled";
/** Pedido de preview (créditos → SoundscapeLayer → engine.preview). */
export const PREVIEW_EVENT = "touvie:sound-preview";
/** Engine → UI: ids das variantes tocando AGORA (detail = string[] no formato variantId). */
export const NOWPLAYING_EVENT = "touvie:sound-nowplaying";
/** UI → engine: "me diga o que está tocando agora" (o engine responde reemitindo NOWPLAYING_EVENT).
 * Necessário porque quem abre os créditos DEPOIS do som começar perdeu o último evento. */
export const NOWPLAYING_REQUEST_EVENT = "touvie:sound-nowplaying-request";

export type PreviewDetail = { key: TextureKey; variant?: number };

export function readDisabled(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISABLED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? new Set(arr.filter((x): x is string => typeof x === "string"))
      : new Set();
  } catch {
    return new Set();
  }
}

export function isDisabled(id: string): boolean {
  return readDisabled().has(id);
}

export function writeDisabled(set: Set<string>): void {
  const arr = [...set];
  localStorage.setItem(DISABLED_KEY, JSON.stringify(arr));
  // O SoundscapeLayer escuta e repassa pro engine (reconcilia a rotação ao vivo).
  window.dispatchEvent(new CustomEvent(DISABLED_EVENT, { detail: arr }));
}

/**
 * Liga/desliga um take. Ao DESLIGAR, recusa se isso zeraria as habilitadas entre
 * `siblingIds` (as variantes da mesma textura) — toda textura selecionada mantém
 * ≥1 take tocável. Retorna true se aplicou, false se foi barrado.
 */
export function toggleDisabled(id: string, siblingIds: string[]): boolean {
  const set = readDisabled();
  if (set.has(id)) {
    set.delete(id);
    writeDisabled(set);
    return true;
  }
  const enabledLeft = siblingIds.filter((s) => s !== id && !set.has(s)).length;
  if (enabledLeft === 0) return false; // impede desligar a última
  set.add(id);
  writeDisabled(set);
  return true;
}

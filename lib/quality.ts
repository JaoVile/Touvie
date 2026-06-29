// Nível de qualidade visual — fonte ÚNICA de verdade pros efeitos caros do app
// (cursor-fita, glass/backdrop-filter, StarField, animações decorativas). Em vez
// de toggles soltos espalhados, cada efeito caro lê este nível. Espelha o padrão
// de `lib/soundscape.ts`: estado em localStorage + evento pra atualizar ao vivo.
//
// Dois níveis (decisão de produto):
//  - "completo"   → experiência premium, todos os efeitos.
//  - "desempenho" → leve: sem cursor/estrelas, sem backdrop-filter, sem animações
//                   decorativas. Para máquinas modestas ou quem prefere fluidez.
//
// Na 1ª vez (sem preferência salva) é AUTO-DETECTADO pelo dispositivo, igual jogo
// detectando a GPU: reduced-motion ou hardware modesto → "desempenho".

export type QualityTier = "completo" | "desempenho";

export const QUALITY_KEY = "touvie:quality";
export const QUALITY_EVENT = "touvie:quality";
export const DEFAULT_QUALITY: QualityTier = "completo";

/** Heurística de auto-detecção (só roda no cliente). */
export function detectQuality(): QualityTier {
  if (typeof window === "undefined") return DEFAULT_QUALITY;
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "desempenho";
    const cores = navigator.hardwareConcurrency || 8;
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    if (cores <= 4 || mem <= 4) return "desempenho";
  } catch {
    /* APIs indisponíveis → assume o padrão */
  }
  return DEFAULT_QUALITY;
}

/** Lê a preferência salva; sem ela, auto-detecta (não persiste — readequa por device). */
export function readQuality(): QualityTier {
  if (typeof window === "undefined") return DEFAULT_QUALITY;
  const v = window.localStorage.getItem(QUALITY_KEY);
  if (v === "completo" || v === "desempenho") return v;
  return detectQuality();
}

/** Salva a escolha do usuário, aplica no <html> e avisa os componentes ao vivo. */
export function writeQuality(tier: QualityTier): void {
  window.localStorage.setItem(QUALITY_KEY, tier);
  document.documentElement.dataset.quality = tier;
  window.dispatchEvent(new CustomEvent(QUALITY_EVENT, { detail: tier }));
}

// Som de fundo do Touvie — DUAS camadas que o usuário mistura livremente:
//
//  1. FREQUÊNCIA (opcional): uma onda cerebral tocada como TOM ISÓCRONO (pulso
//     no mesmo canal) — funciona sem fone, no alto-falante. É a "camada de baixo"
//     que guia o estado mental. Ver music.md.
//  2. TEXTURAS (várias, à escolha): camadas ambientes sintetizadas (chuva, mar,
//     ruídos, floresta, vento) + instrumentos (violinos, violão, piano) — a
//     "música/textura agradável por cima que segura o ouvido" e evita enjoo.
//
// Frequência e texturas têm VOLUMES INDEPENDENTES. Tudo síntese Web Audio, sem
// arquivos. Estado no localStorage (opt-in, mas sticky — começa em silêncio e
// volta como você deixou). O SoundscapeLayer escuta o CustomEvent e reage ao vivo.

export type SoundscapeKey = "calma" | "foco" | "reflexao" | "soneca";

/**
 * Nome do ícone Lucide (monocromático) usado na UI — substitui os emojis pra
 * manter o tom sóbrio. O componente cliente resolve o nome → componente.
 */
export type IconName =
  | "waves"
  | "target"
  | "moon"
  | "moon-star"
  | "bed"
  | "cloud-rain"
  | "audio-lines"
  | "audio-waveform"
  | "trees"
  | "wind"
  | "music"
  | "guitar"
  | "piano"
  | "heart-pulse"
  | "sunrise"
  | "leaf"
  | "coffee"
  | "brain"
  | "book";

export type Soundscape = {
  key: SoundscapeKey;
  name: string;
  icon: IconName;
  /** Nome da onda cerebral (Alpha/Beta/…), só pra exibir. */
  wave: string;
  desc: string;
  /** Frequência guia em Hz — o pulso isócrono. */
  beatHz: number;
  /** Tônica do pad/portadora em Hz. */
  rootHz: number;
  /** Aviso opcional (ex.: Soneca só antes de dormir). */
  warn?: string;
};

// Veredito do music.md: Alpha (Calma), Beta baixo (Foco), Theta (Reflexão),
// Delta com aviso (Soneca). Gamma fica de fora (intenso, difícil soar bem).
export const FREQUENCIES: Soundscape[] = [
  {
    key: "calma",
    name: "Calma",
    icon: "waves",
    wave: "Alpha",
    beatHz: 10,
    rootHz: 196,
    desc: "Relaxamento consciente e foco leve — bom pra atravessar o dia.",
  },
  {
    key: "foco",
    name: "Foco",
    icon: "target",
    wave: "Beta",
    beatHz: 16,
    rootHz: 220,
    desc: "Estado alerta pra raciocínio e tarefas que pedem atenção.",
  },
  {
    key: "reflexao",
    name: "Reflexão",
    icon: "moon",
    wave: "Theta",
    beatHz: 6,
    rootHz: 174,
    desc: "Introspecção e calma profunda — combina com o diário.",
  },
  {
    key: "soneca",
    name: "Soneca",
    icon: "bed",
    wave: "Delta",
    beatHz: 2.5,
    rootHz: 146,
    desc: "Ondas lentas de descanso.",
    warn: "Melhor só nos momentos antes de dormir.",
  },
];

export type TextureKey =
  | "chuva"
  | "mar"
  | "ruido-rosa"
  | "ruido-marrom"
  | "floresta"
  | "vento"
  | "violinos"
  | "violao"
  | "piano";

export type Texture = {
  key: TextureKey;
  name: string;
  icon: IconName;
  desc: string;
  /** Agrupa na UI: "ambiente" (natureza/ruído) vs "instrumentos". */
  group: "ambiente" | "instrumento";
  /**
   * Nº de variações do arquivo (`<key>-1.mp3` … `<key>-N.mp3`). Quando > 1, o
   * engine ALTERNA entre elas ao vivo (crossfade) pra não enjoar. Ausente/1 =
   * arquivo único `<key>.mp3`.
   */
  variants?: number;
};

export const TEXTURES: Texture[] = [
  {
    key: "chuva",
    name: "Chuva",
    icon: "cloud-rain",
    group: "ambiente",
    desc: "Chuva suave — alterna entre 3 takes.",
    variants: 3,
  },
  {
    key: "mar",
    name: "Ondas do mar",
    icon: "waves",
    group: "ambiente",
    desc: "Ondas indo e voltando — alterna entre 3 takes.",
    variants: 3,
  },
  {
    key: "ruido-rosa",
    name: "Ruído rosa",
    icon: "audio-lines",
    group: "ambiente",
    desc: "Base macia que enche o silêncio.",
  },
  {
    key: "ruido-marrom",
    name: "Ruído marrom",
    icon: "audio-waveform",
    group: "ambiente",
    desc: "Grave e aveludado, mais fundo.",
  },
  {
    key: "floresta",
    name: "Floresta",
    icon: "trees",
    group: "ambiente",
    desc: "Folhas + pássaros distantes — alterna entre 3 takes.",
    variants: 3,
  },
  {
    key: "vento",
    name: "Vento",
    icon: "wind",
    group: "ambiente",
    desc: "Vento contínuo, respirando — alterna entre 3 takes.",
    variants: 3,
  },
  {
    key: "violinos",
    name: "Violinos",
    icon: "music",
    group: "instrumento",
    desc: "Cordas suaves sustentadas — alterna entre 3 takes.",
    variants: 3,
  },
  {
    key: "violao",
    name: "Violão",
    icon: "guitar",
    group: "instrumento",
    desc: "Dedilhado leve — alterna entre 3 takes.",
    variants: 3,
  },
  {
    key: "piano",
    name: "Piano",
    icon: "piano",
    group: "instrumento",
    desc: "Notas esparsas e calmas — alterna entre 3 takes.",
    variants: 3,
  },
];

// ─────────────────────────── JORNADAS ───────────────────────────
// Uma jornada CONDUZ a camada de frequência ao longo do tempo: começa onde a
// pessoa está e vai migrando (princípio ISO da musicoterapia — não se joga
// direto no Foco quem está acelerado; acalma e só então sobe). Cada estágio
// crossfadeia no próximo. O ÚLTIMO estágio é "infinito" (segura até parar);
// `seconds` dele é ignorado. As texturas continuam de mistura livre por cima.

export type JourneyKey = "aterrissar" | "desacelerar" | "despertar" | "reset";

export type JourneyStage = {
  freq: SoundscapeKey;
  /** Duração deste estágio em segundos (ignorado no último = segura). */
  seconds: number;
};

export type Journey = {
  key: JourneyKey;
  name: string;
  icon: IconName;
  desc: string;
  stages: JourneyStage[];
};

export const JOURNEYS: Journey[] = [
  {
    key: "aterrissar",
    name: "Aterrissar e focar",
    icon: "heart-pulse",
    desc: "Coração acelerado? Acalma primeiro (Alpha), depois entra no Foco.",
    stages: [
      { freq: "calma", seconds: 180 },
      { freq: "foco", seconds: 0 },
    ],
  },
  {
    key: "desacelerar",
    name: "Desacelerar",
    icon: "moon",
    desc: "Fim do dia: desce de Calma a Reflexão até a Soneca, pouco a pouco.",
    stages: [
      { freq: "calma", seconds: 180 },
      { freq: "reflexao", seconds: 240 },
      { freq: "soneca", seconds: 0 },
    ],
  },
  {
    key: "despertar",
    name: "Despertar",
    icon: "sunrise",
    desc: "Acordar devagar: sai do torpor (Delta) e engata no Foco.",
    stages: [
      { freq: "soneca", seconds: 90 },
      { freq: "calma", seconds: 180 },
      { freq: "foco", seconds: 0 },
    ],
  },
  {
    key: "reset",
    name: "Reset de 5 min",
    icon: "leaf",
    desc: "Pausa curta: respira em Reflexão e volta leve na Calma.",
    stages: [
      { freq: "reflexao", seconds: 150 },
      { freq: "calma", seconds: 0 },
    ],
  },
];

/** Compara duas listas de texturas ignorando a ordem. */
export function sameTextures(a: TextureKey[], b: TextureKey[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((t) => set.has(t));
}

/** Duração guiada (soma de todos os estágios menos o último, que é infinito). */
export function journeyGuidedSeconds(j: Journey): number {
  return j.stages.slice(0, -1).reduce((s, st) => s + st.seconds, 0);
}

/** Índice do estágio atual dado o tempo decorrido (último segura pra sempre). */
export function journeyStageAt(j: Journey, elapsedSeconds: number): number {
  let acc = 0;
  for (let i = 0; i < j.stages.length - 1; i++) {
    acc += j.stages[i].seconds;
    if (elapsedSeconds < acc) return i;
  }
  return j.stages.length - 1;
}

// ─────────────────────────── CENAS PRONTAS ───────────────────────────
// Combos de 1 clique: monta a mistura inteira de uma vez (frequência OU jornada
// + texturas base + volumes). "Música 1 → já seleciona as bases." O usuário
// pode ajustar tudo depois; a cena é só o ponto de partida.

export type Scene = {
  key: string;
  name: string;
  icon: IconName;
  desc: string;
  /** Frequência avulsa (ignorada se `journey` estiver setada). */
  freqMode?: SoundscapeKey;
  /** Jornada guiada (tem prioridade sobre `freqMode`). */
  journey?: JourneyKey;
  /** Texturas base que entram juntas. */
  textures: TextureKey[];
  /** Volumes opcionais (0–1); default 0.5. */
  freqVolume?: number;
  textureVolume?: number;
};

export const SCENES: Scene[] = [
  {
    key: "chuva-quarto",
    name: "Chuva no quarto",
    icon: "cloud-rain",
    desc: "Calma + chuva + piano esparso.",
    freqMode: "calma",
    textures: ["chuva", "piano"],
    freqVolume: 0.4,
    textureVolume: 0.6,
  },
  {
    key: "cafe-foco",
    name: "Café & foco",
    icon: "coffee",
    desc: "Foco + ruído marrom + violão.",
    freqMode: "foco",
    textures: ["ruido-marrom", "violao"],
    freqVolume: 0.45,
    textureVolume: 0.55,
  },
  {
    key: "estudo-profundo",
    name: "Estudo profundo",
    icon: "brain",
    desc: "Foco + ruído rosa + chuva.",
    freqMode: "foco",
    textures: ["ruido-rosa", "chuva"],
    freqVolume: 0.5,
    textureVolume: 0.5,
  },
  {
    key: "floresta-calma",
    name: "Floresta calma",
    icon: "trees",
    desc: "Reflexão + floresta + vento.",
    freqMode: "reflexao",
    textures: ["floresta", "vento"],
    freqVolume: 0.4,
    textureVolume: 0.6,
  },
  {
    key: "tarde-leitura",
    name: "Tarde de leitura",
    icon: "book",
    desc: "Calma + chuva + violinos.",
    freqMode: "calma",
    textures: ["chuva", "violinos"],
    freqVolume: 0.4,
    textureVolume: 0.55,
  },
  {
    key: "sala-cordas",
    name: "Sala de cordas",
    icon: "music",
    desc: "Calma + violinos + piano.",
    freqMode: "calma",
    textures: ["violinos", "piano"],
    freqVolume: 0.35,
    textureVolume: 0.6,
  },
  {
    key: "diario-noite",
    name: "Diário da noite",
    icon: "moon",
    desc: "Reflexão + chuva + piano.",
    freqMode: "reflexao",
    textures: ["chuva", "piano"],
    freqVolume: 0.4,
    textureVolume: 0.55,
  },
  {
    key: "vento-mar",
    name: "Vento e mar",
    icon: "waves",
    desc: "Calma + vento + ondas.",
    freqMode: "calma",
    textures: ["vento", "mar"],
    freqVolume: 0.4,
    textureVolume: 0.6,
  },
  {
    key: "mare-noturna",
    name: "Maré noturna",
    icon: "bed",
    desc: "Soneca + mar + ruído marrom.",
    freqMode: "soneca",
    textures: ["mar", "ruido-marrom"],
    freqVolume: 0.35,
    textureVolume: 0.55,
  },
  // Cenas que usam JORNADA (a frequência migra sozinha):
  {
    key: "acalmar-focar",
    name: "Acalmar e focar",
    icon: "heart-pulse",
    desc: "Jornada Aterrissar + chuva de fundo.",
    journey: "aterrissar",
    textures: ["chuva"],
    freqVolume: 0.4,
    textureVolume: 0.5,
  },
  {
    key: "bom-dia",
    name: "Bom dia",
    icon: "sunrise",
    desc: "Jornada Despertar + floresta.",
    journey: "despertar",
    textures: ["floresta"],
    freqVolume: 0.4,
    textureVolume: 0.55,
  },
  {
    key: "boa-noite",
    name: "Boa noite",
    icon: "moon-star",
    desc: "Jornada Desacelerar + mar.",
    journey: "desacelerar",
    textures: ["mar"],
    freqVolume: 0.35,
    textureVolume: 0.5,
  },
];

export type SoundState = {
  /** Onda cerebral ativa (manual), ou null = frequência desligada. */
  freqMode: SoundscapeKey | null;
  /** Volume da frequência, 0–1 perceptual. */
  freqVolume: number;
  /** Texturas ativas (mistura livre). */
  textures: TextureKey[];
  /** Volume das texturas, 0–1 perceptual. */
  textureVolume: number;
  /** Jornada guiada ativa (conduz a frequência), ou null. */
  journey: JourneyKey | null;
  /** Epoch (ms) em que a jornada começou — pra retomar no estágio certo. */
  journeyStartedAt: number | null;
  /**
   * "Modo profundo": liga o tom isócrono (pulso de entrainment) por cima do
   * pad quente. Opt-in, DESLIGADO por padrão — o som clínico/pulsante só toca
   * pra quem escolher. Sem ele, a frequência é só o pad com respiração suave.
   */
  deepMode: boolean;
};

export const DEFAULT_SOUND: SoundState = {
  freqMode: null,
  freqVolume: 0.5,
  textures: [],
  textureVolume: 0.5,
  journey: null,
  journeyStartedAt: null,
  deepMode: false,
};

export const SOUND_KEY = "touvie:sound";
export const SOUND_EVENT = "touvie:sound";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function readSoundState(): SoundState {
  if (typeof window === "undefined") return DEFAULT_SOUND;
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    if (!raw) return DEFAULT_SOUND;
    const p = JSON.parse(raw) as Partial<SoundState>;
    const journey = JOURNEYS.some((j) => j.key === p.journey) ? (p.journey as JourneyKey) : null;
    return {
      freqMode: FREQUENCIES.some((f) => f.key === p.freqMode)
        ? (p.freqMode as SoundscapeKey)
        : null,
      freqVolume:
        typeof p.freqVolume === "number" ? clamp01(p.freqVolume) : DEFAULT_SOUND.freqVolume,
      textures: Array.isArray(p.textures)
        ? p.textures.filter((t): t is TextureKey => TEXTURES.some((x) => x.key === t))
        : [],
      textureVolume:
        typeof p.textureVolume === "number"
          ? clamp01(p.textureVolume)
          : DEFAULT_SOUND.textureVolume,
      journey,
      // Só vale com jornada ativa; sem timestamp, assume "começou agora".
      journeyStartedAt:
        journey && typeof p.journeyStartedAt === "number"
          ? p.journeyStartedAt
          : journey
            ? Date.now()
            : null,
      deepMode: p.deepMode === true,
    };
  } catch {
    return DEFAULT_SOUND;
  }
}

export function writeSoundState(state: SoundState): void {
  localStorage.setItem(SOUND_KEY, JSON.stringify(state));
  // O SoundscapeLayer escuta isto e atualiza a mixagem na hora, sem reload.
  window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: state }));
}

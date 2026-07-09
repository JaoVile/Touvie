// Engine do som de fundo. Importado só pelo SoundscapeLayer (client) — nenhuma
// API de browser roda no import, só dentro dos métodos. Ver lib/soundscape.ts.
//
// Duas camadas:
//  - FREQUÊNCIA: sintetizada (tom isócrono + pad). Síntese é o jeito certo aqui.
//  - TEXTURAS: loops de áudio REAIS carregados de /sounds/<key>.mp3 (CC0/CC-BY,
//    baixados via scripts/fetch-sounds.mjs). Sem síntese, sem fallback.

import {
  FREQUENCIES,
  JOURNEYS,
  type JourneyKey,
  type SoundscapeKey,
  TEXTURES,
  type TextureKey,
} from "./soundscape";
import { LOUDNESS_GAIN } from "./soundscape-loudness";

/** Teto do ganho real — os volumes 0–1 do usuário multiplicam por isto. */
const MAX_GAIN = 0.5;

/** Ganho base por textura (ajuste fino de loudness entre arquivos diferentes). */
const TEXTURE_GAIN: Partial<Record<TextureKey, number>> = {
  // default 0.8 (multiplica o LOUDNESS_GAIN por variante). Ruído contínuo de banda
  // larga soa mais alto/cansativo que música no MESMO RMS — a normalização por RMS
  // o subestima. E são camadas "fill" de fundo. Então puxo de propósito: o rosa
  // (chiado agudo) mais que o marrom (grave, mais macio).
  "ruido-rosa": 0.4,
  "ruido-marrom": 0.6,
};

/**
 * Quanto tempo cada variação toca antes de trocar pra outra. Instrumentos seguram
 * mais (1:30) que ambientes (2:00) — trocar melodia rápido demais cansa; ambiente
 * pode respirar ainda mais. Clip menor que a janela dá loop (src.loop) pra preencher.
 */
const ROTATE_INSTRUMENT_MS = 90_000; // 1:30
const ROTATE_AMBIENT_MS = 120_000; // 2:00
const rotateMsOf = (key: TextureKey): number =>
  TEXTURES.find((t) => t.key === key)?.group === "instrumento"
    ? ROTATE_INSTRUMENT_MS
    : ROTATE_AMBIENT_MS;
/** Crossfade ao trocar de variação (segundos). */
const CLIP_FADE = 3;

const variantsOf = (key: TextureKey): number => TEXTURES.find((t) => t.key === key)?.variants ?? 1;
/** Ganho de normalização de loudness do arquivo (id = <key> ou <key>-<variante>). */
const loudnessOf = (key: TextureKey, variant: number): number =>
  LOUDNESS_GAIN[variantsOf(key) > 1 ? `${key}-${variant}` : key] ?? 1;
const pickVariant = (count: number, not?: number): number => {
  if (count <= 1) return 1;
  let v = 1 + Math.floor(Math.random() * count);
  while (v === not) v = 1 + Math.floor(Math.random() * count);
  return v;
};

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
type Voice = { gain: GainNode; nodes: AudioNode[] };

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private freqBus: GainNode | null = null;
  private texBus: GainNode | null = null;

  private freqVoice: Voice | null = null;
  private freqMode: SoundscapeKey | null = null;
  private texVoices = new Map<TextureKey, Voice>();

  private journey: JourneyKey | null = null;
  private journeyStartedAt: number | null = null;
  private journeyTimers: number[] = [];

  /** Modo profundo (tom isócrono opt-in). Desligado = só o pad quente. */
  private deep = false;

  private freqVolume = 0.5;
  private texVolume = 0.5;

  private bufferCache = new Map<string, AudioBuffer | null>();
  private desired = new Set<TextureKey>();
  private loading = new Set<TextureKey>();
  // Clip atual de cada textura (a variação tocando agora) + timer de rotação.
  private texClips = new Map<
    TextureKey,
    { gain: GainNode; src: AudioBufferSourceNode; variant: number }
  >();
  private texTimers = new Map<TextureKey, number>();

  // ───────────────────────── infra ─────────────────────────

  private ensure(): AudioContext {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
      const ctx = new AC!();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = MAX_GAIN;
      this.master.connect(ctx.destination);
      this.freqBus = ctx.createGain();
      this.freqBus.gain.value = this.freqVolume;
      this.freqBus.connect(this.master);
      this.texBus = ctx.createGain();
      this.texBus.gain.value = this.texVolume;
      this.texBus.connect(this.master);
    }
    return this.ctx;
  }

  get suspended(): boolean {
    return this.ctx?.state === "suspended";
  }

  resume(): void {
    void this.ctx?.resume();
  }

  /** Aplica todo o estado de uma vez (frequência/jornada + texturas + volumes). */
  apply(s: {
    freqMode: SoundscapeKey | null;
    freqVolume: number;
    textures: TextureKey[];
    textureVolume: number;
    journey: JourneyKey | null;
    journeyStartedAt: number | null;
    deepMode: boolean;
  }): void {
    this.freqVolume = s.freqVolume;
    this.texVolume = s.textureVolume;
    // Sem nada pra tocar e sem contexto ainda → não cria AudioContext (evita o
    // warning de autoplay). Guarda só os volumes pra quando algo ligar.
    if (!s.freqMode && !s.journey && s.textures.length === 0 && !this.ctx) return;

    this.ensure();
    this.rampBus(this.freqBus, this.freqVolume);
    this.rampBus(this.texBus, this.texVolume);
    // Modo profundo mudou → força reconstruir a frequência (zera o tracking pra
    // que setJourney/setFrequency não façam curto-circuito por "mesmo modo").
    if (this.deep !== s.deepMode) {
      this.deep = s.deepMode;
      this.freqMode = null;
      this.journey = null;
    }
    if (s.journey) {
      this.setJourney(s.journey, s.journeyStartedAt);
    } else {
      this.clearJourney();
      this.setFrequency(s.freqMode);
    }
    this.setTextures(s.textures);
  }

  private rampBus(bus: GainNode | null, v: number): void {
    if (!bus || !this.ctx) return;
    const t = this.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.linearRampToValueAtTime(v, t + 0.25);
  }

  stopAll(): void {
    this.clearJourney();
    if (this.freqVoice) this.stopVoice(this.freqVoice);
    this.freqVoice = null;
    this.freqMode = null;
    this.desired.clear();
    for (const key of [...this.texVoices.keys()]) this.stopTexture(key);
  }

  // ───────────────────────── jornada (agendador) ─────────────────────────

  private setJourney(key: JourneyKey, startedAt: number | null): void {
    // Já tocando exatamente esta jornada (mesmo início) → nada a refazer.
    if (this.journey === key && this.journeyStartedAt === startedAt) return;
    this.clearJourney();
    const j = JOURNEYS.find((x) => x.key === key);
    if (!j) return;
    this.journey = key;
    this.journeyStartedAt = startedAt;

    const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    let acc = 0;
    let now = j.stages[0].freq; // último estágio cujo início já passou
    for (const stage of j.stages) {
      const start = acc;
      acc += stage.seconds;
      if (elapsed >= start) {
        now = stage.freq;
      } else {
        // Estágio ainda no futuro → agenda a transição (crossfade do setFrequency).
        const id = window.setTimeout(() => this.setFrequency(stage.freq), (start - elapsed) * 1000);
        this.journeyTimers.push(id);
      }
    }
    this.setFrequency(now);
  }

  private clearJourney(): void {
    for (const id of this.journeyTimers) window.clearTimeout(id);
    this.journeyTimers = [];
    this.journey = null;
    this.journeyStartedAt = null;
  }

  // ─────────────────────── voz: fade in/out ───────────────────────

  private startVoice(bus: GainNode): Voice {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(bus);
    return { gain, nodes: [gain] };
  }

  private fadeIn(v: Voice): void {
    const t = this.ctx!.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), t);
    v.gain.gain.linearRampToValueAtTime(1, t + 1.2);
  }

  private stopVoice(v: Voice): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(t);
    v.gain.gain.linearRampToValueAtTime(0, t + 0.8);
    window.setTimeout(() => {
      for (const n of v.nodes) {
        try {
          (n as AudioBufferSourceNode).stop?.();
        } catch {
          /* já parado */
        }
        try {
          n.disconnect();
        } catch {
          /* já desconectado */
        }
      }
    }, 1000);
  }

  // ───────────────────────── frequência (síntese) ─────────────────────────

  private setFrequency(mode: SoundscapeKey | null): void {
    if (this.freqMode === mode) return;
    if (this.freqVoice) {
      this.stopVoice(this.freqVoice);
      this.freqVoice = null;
    }
    this.freqMode = mode;
    if (!mode) return;
    const v = this.buildFrequency(mode, this.deep);
    if (v) {
      this.freqVoice = v;
      this.fadeIn(v);
    }
  }

  private buildFrequency(mode: SoundscapeKey, deep: boolean): Voice | null {
    const ctx = this.ctx!;
    const preset = FREQUENCIES.find((f) => f.key === mode);
    if (!preset || !this.freqBus) return null;
    const v = this.startVoice(this.freqBus);
    const t = ctx.currentTime;

    // Pad QUENTE: um acorde (sub · tônica · terça maior · quinta · oitava) em
    // vez de só duas senoides cruas — encorpa e tira o "oco". Lowpass macio.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 720;
    padFilter.Q.value = 0.5;
    const padGain = ctx.createGain();
    padGain.gain.value = 0;
    const padBias = ctx.createConstantSource();
    padBias.offset.value = 0.46;
    padFilter.connect(padGain);
    padGain.connect(v.gain);
    padBias.connect(padGain.gain);
    padBias.start(t);

    // [razão da tônica, ganho]. Soma ≈ 0.44 (mesmo nível do pad antigo).
    const voices: [number, number][] = [
      [0.5, 0.07], // sub-oitava — fundação
      [1, 0.14], // tônica
      [1.2599, 0.06], // terça maior — calor
      [1.5, 0.11], // quinta
      [2, 0.06], // oitava — brilho
    ];
    for (const [i, [ratio, g0]] of voices.entries()) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = preset.rootHz * ratio;
      osc.detune.value = (i % 2 === 0 ? -1 : 1) * 4; // leve coro entre as vozes
      const g = ctx.createGain();
      g.gain.value = g0;
      osc.connect(g);
      g.connect(padFilter);
      osc.start(t);
      v.nodes.push(osc, g);
    }

    // Respiração lenta + TREMOLO suave: a amplitude "respira" sem nunca cortar
    // até o silêncio — é o que substitui a sensação clínica do pulso isócrono.
    const breath = ctx.createOscillator();
    breath.type = "sine";
    breath.frequency.value = 0.07;
    const breathDepth = ctx.createGain();
    breathDepth.gain.value = 0.12;
    breath.connect(breathDepth);
    breathDepth.connect(padGain.gain);
    breath.start(t);

    const trem = ctx.createOscillator();
    trem.type = "sine";
    trem.frequency.value = 0.2;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.07;
    trem.connect(tremDepth);
    tremDepth.connect(padGain.gain);
    trem.start(t);

    v.nodes.push(breath, breathDepth, trem, tremDepth, padFilter, padGain, padBias);

    // Tom isócrono: SÓ no modo profundo (opt-in). E mais gentil que antes — o
    // pulso não corta até zero (piso > 0), então pulsa em vez de "estrobar".
    if (deep) {
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = preset.rootHz * 2;
      const carrierGain = ctx.createGain();
      carrierGain.gain.value = 0;
      const beat = ctx.createOscillator();
      beat.type = "sine";
      beat.frequency.value = preset.beatHz;
      const beatDepth = ctx.createGain();
      beatDepth.gain.value = 0.035; // ~metade da profundidade antiga
      const beatBias = ctx.createConstantSource();
      beatBias.offset.value = 0.085; // piso audível → pulso, não corte seco
      beat.connect(beatDepth);
      beatDepth.connect(carrierGain.gain);
      beatBias.connect(carrierGain.gain);
      carrier.connect(carrierGain);
      carrierGain.connect(v.gain);
      carrier.start(t);
      beat.start(t);
      beatBias.start(t);
      v.nodes.push(carrier, carrierGain, beat, beatDepth, beatBias);
    }

    return v;
  }

  // ───────────────────────── texturas (arquivos) ─────────────────────────

  private setTextures(list: TextureKey[]): void {
    this.desired = new Set(list);
    // Remove as que saíram (para o timer de rotação + fade out).
    for (const key of [...this.texVoices.keys()]) {
      if (!this.desired.has(key)) this.stopTexture(key);
    }
    // Adiciona as novas (carrega o arquivo de forma assíncrona).
    for (const key of list) {
      if (this.texVoices.has(key) || this.loading.has(key)) continue;
      this.loading.add(key);
      void this.addTexture(key);
    }
  }

  private async addTexture(key: TextureKey): Promise<void> {
    const count = variantsOf(key);
    const first = pickVariant(count); // 1 se sem variações
    const buf = await this.loadBuffer(key, count > 1 ? first : undefined);
    this.loading.delete(key);
    // Pode ter sido desligada enquanto carregava.
    if (!buf || !this.desired.has(key) || this.texVoices.has(key) || !this.texBus) return;
    const voice = this.startVoice(this.texBus);
    this.texVoices.set(key, voice);
    this.playClip(key, voice, first, buf);
    this.fadeIn(voice);
    // Com mais de uma variação, agenda a troca periódica (crossfade).
    if (count > 1) {
      const timer = window.setInterval(() => void this.rotateClip(key), rotateMsOf(key));
      this.texTimers.set(key, timer);
    }
  }

  /** Toca uma variação dentro da voz da textura, crossfadeando a anterior. */
  private playClip(key: TextureKey, voice: Voice, variant: number, buf: AudioBuffer): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const level = (TEXTURE_GAIN[key] ?? 0.8) * loudnessOf(key, variant);
    const clip = ctx.createGain();
    clip.gain.setValueAtTime(0.0001, t);
    clip.gain.linearRampToValueAtTime(level, t + CLIP_FADE);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(clip);
    clip.connect(voice.gain);
    // Começa num ponto ALEATÓRIO do buffer (não sempre no 0): com loop ligado,
    // toca offset→fim→início→offset, então cada entrada de uma faixa longa expõe
    // um trecho diferente a cada janela (90-120s). É o que transforma um take longo (do qual só
    // se ouviria o começo) em vários trechos distintos ao longo do tempo, sem
    // precisar de mais arquivos. O fade-in de CLIP_FADE mascara a entrada no meio.
    const offset = Math.random() * buf.duration;
    src.start(t, offset);
    voice.nodes.push(src, clip);

    // Esmaece e para a variação anterior.
    const prev = this.texClips.get(key);
    if (prev) {
      prev.gain.gain.cancelScheduledValues(t);
      prev.gain.gain.setValueAtTime(Math.max(0.0001, prev.gain.gain.value), t);
      prev.gain.gain.linearRampToValueAtTime(0, t + CLIP_FADE);
      const dead = prev;
      window.setTimeout(
        () => {
          try {
            dead.src.stop();
          } catch {
            /* já parado */
          }
          try {
            dead.gain.disconnect();
          } catch {
            /* já desconectado */
          }
        },
        CLIP_FADE * 1000 + 200,
      );
    }
    this.texClips.set(key, { gain: clip, src, variant });
  }

  /** Troca pra outra variação (chamado pelo timer). */
  private async rotateClip(key: TextureKey): Promise<void> {
    const voice = this.texVoices.get(key);
    if (!voice || !this.desired.has(key)) return;
    const count = variantsOf(key);
    const cur = this.texClips.get(key)?.variant;
    const next = pickVariant(count, cur);
    const buf = await this.loadBuffer(key, next);
    // Pode ter sido desligada enquanto carregava o próximo take.
    if (!buf || !this.texVoices.has(key) || !this.desired.has(key)) return;
    this.playClip(key, voice, next, buf);
  }

  private stopTexture(key: TextureKey): void {
    const timer = this.texTimers.get(key);
    if (timer !== undefined) {
      window.clearInterval(timer);
      this.texTimers.delete(key);
    }
    this.texClips.delete(key);
    const voice = this.texVoices.get(key);
    if (voice) this.stopVoice(voice);
    this.texVoices.delete(key);
  }

  private async loadBuffer(key: TextureKey, variant?: number): Promise<AudioBuffer | null> {
    const id = variant ? `${key}-${variant}` : key;
    const cached = this.bufferCache.get(id);
    if (cached !== undefined) return cached; // null = já tentou e falhou
    const ctx = this.ensure();
    try {
      const res = await fetch(`/sounds/${id}.mp3`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr);
      this.bufferCache.set(id, buf);
      return buf;
    } catch (e) {
      // Arquivo ainda não baixado (rode scripts/fetch-sounds.mjs).
      console.warn(`[soundscape] textura "${id}" indisponível:`, (e as Error).message);
      this.bufferCache.set(id, null);
      return null;
    }
  }
}

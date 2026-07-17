// Voz do Toube: lê as respostas em voz alta com voz neural NATURAL (Piper, local).
// O texto vai pro endpoint /api/toube/voz, que roda o piper e devolve um WAV; aqui
// a gente só TOCA o áudio (playback de mídia normal — funciona onde o TTS do
// navegador não funciona). Só client. Singleton importado pelo ToubeConversation.
//
// Liga/desliga persistido em localStorage; default DESLIGADO.

const STORAGE_KEY = "toube-voice";
const VOICE_KEY = "toube-voice-model";

export type ToubeVoiceOption = {
  id: string;
  label: string;
  lang: "pt" | "en" | "multi";
  engine: "piper" | "kokoro" | "edge";
  /** Crédito da voz-base (a identidade exibida pode ser própria, ex.: "Toube"). */
  credit?: string;
};

/**
 * Vozes do provador em /config. Hoje só existe UMA: a voz oficial do Toube.
 * A whitelist do servidor espelha esta lista. Futuro: novas vozes entram por
 * aqui (inclusive "Minha voz" — clone/treino da voz do próprio usuário).
 */
export const TOUBE_VOICES: readonly ToubeVoiceOption[] = [
  // A VOZ DO TOUBE (default e única): identidade própria "Toube" — por baixo é
  // o Hyunsu (Edge) afinado em +8Hz; masculina, jovem, suave, multilíngue
  // (mesma identidade em pt e en pro launch bilíngue). Escolhida em 17/jul.
  { id: "hyunsu8", label: "Toube", lang: "multi", engine: "edge", credit: "Hyunsu" },
];
export type ToubeVoiceId = ToubeVoiceOption["id"];

// Correções de PRONÚNCIA só pra fala (o espeak lê nomes inventados ao pé da
// letra). O texto na tela não muda — isto vale apenas dentro do sanitize da voz.
const PRONUNCIATION: [RegExp, string][] = [
  [/\bTouvie\b/gi, "Tuvi"], // "Touvie" → soa "Tuvi"
  [/\bToube\b/gi, "Toubi"], // "Toube" → soa "toubi"
];

/**
 * Limpa o texto pra fala: tira URLs, markdown e emojis — ninguém quer ouvir
 * "asterisco asterisco" nem um link soletrado — e corrige a pronúncia dos nomes.
 */
function sanitize(text: string): string {
  let out = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/[*_#>~|]/g, "")
    .replace(/^\s*[-•]\s*/gm, "")
    .replace(/[\p{Extended_Pictographic}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  for (const [re, sub] of PRONUNCIATION) out = out.replace(re, sub);
  return out;
}

/**
 * Quebra o texto em pedaços curtos por frase (junta até ~180 chars). Pedaços
 * pequenos = a 1ª fala sai bem antes de a resposta inteira ser sintetizada;
 * juntar evita processos de síntese demais.
 */
function splitForSpeech(text: string): string[] {
  const parts = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const p of parts) {
    if (cur && (cur + p).length > 180) {
      chunks.push(cur.trim());
      cur = p;
    } else {
      cur += p;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.filter(Boolean);
}

class ToubeVoice {
  private _enabled = false;
  private _voice: string = TOUBE_VOICES[0].id;
  // Playback via Web Audio. Um "keep-alive" inaudível mantém a saída de som
  // (PipeWire/Bluetooth) SEMPRE acordada entre as falas — assim o comecinho das
  // frases não é engolido e não precisa de uma folga longa antes de cada fala.
  private ctx: AudioContext | null = null;
  private keepAlive = false;
  private nodes: AudioBufferSourceNode[] = []; // pedaços tocando/agendados
  private seq = 0; // invalida respostas fora de ordem (stop no meio de um fetch)

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this._enabled = localStorage.getItem(STORAGE_KEY) === "1";
      const v = localStorage.getItem(VOICE_KEY);
      if (v && TOUBE_VOICES.some((t) => t.id === v)) this._voice = v;
    } catch {
      /* localStorage bloqueado */
    }
  }

  /** Playback de áudio existe em qualquer navegador — o botão sempre aparece. */
  get supported(): boolean {
    return typeof window !== "undefined";
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!on) this.stop();
  }

  /** Voz escolhida no provador (/config → Voz do Toube). */
  get voice(): string {
    return this._voice;
  }

  setVoice(id: string): void {
    if (!TOUBE_VOICES.some((t) => t.id === id)) return;
    this._voice = id;
    try {
      localStorage.setItem(VOICE_KEY, id);
    } catch {
      /* ignore */
    }
  }

  /** Garante o AudioContext ligado + o keep-alive tocando (saída acordada). */
  private ensureCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ??
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    if (!this.keepAlive) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        gain.gain.value = 0; // inaudível — só mantém a stream de áudio aberta
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        this.keepAlive = true;
      } catch {
        /* ignora */
      }
    }
    return this.ctx;
  }

  /**
   * Abre o áudio DENTRO de um gesto (envio/clique) pra 1ª fala não engasgar e a
   * saída já ficar acordada durante a síntese. Chamar no send/edit/regenerate.
   */
  prime(): void {
    if (!this._enabled) return;
    this.ensureCtx();
  }

  private async synthChunk(text: string, voice: string): Promise<ArrayBuffer | null> {
    try {
      const res = await fetch("/api/toube/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      return res.ok ? await res.arrayBuffer() : null;
    } catch {
      return null;
    }
  }

  /**
   * Fala o texto. No-op se desligado / vazio. `force` fala mesmo com o toggle
   * off (é o "ouvir esta resposta"); `voice` sobrepõe a voz (o provador audita).
   * Quebra em frases e sintetiza em PARALELO, tocando em ordem — a 1ª frase
   * entra assim que fica pronta, sem esperar a resposta inteira.
   */
  async speak(text: string, opts?: { force?: boolean; voice?: string }): Promise<void> {
    if (typeof window === "undefined" || (!this._enabled && !opts?.force)) return;
    const clean = sanitize(text);
    if (!clean) return;
    this.stop();
    const mine = ++this.seq;
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const voice = opts?.voice ?? this._voice;

    const jobs = splitForSpeech(clean).map((c) => this.synthChunk(c, voice));
    let playhead = 0;
    for (const job of jobs) {
      const data = await job;
      if (mine !== this.seq) return; // interrompido por um novo speak/stop
      if (!data) continue;
      let buffer: AudioBuffer;
      try {
        buffer = await ctx.decodeAudioData(data);
      } catch {
        continue; // pedaço corrompido — pula
      }
      if (mine !== this.seq) return;
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      node.onended = () => {
        node.disconnect();
        this.nodes = this.nodes.filter((n) => n !== node);
      };
      // Emenda na linha do tempo do áudio (gapless). Folga mínima (50ms) só se o
      // pedaço anterior já acabou — com o keep-alive a saída já está acordada.
      const now = ctx.currentTime;
      if (playhead < now + 0.02) playhead = now + 0.05;
      node.start(playhead);
      playhead += buffer.duration;
      this.nodes.push(node);
    }
  }

  /** Corta a fala imediatamente e invalida qualquer síntese em andamento. */
  stop(): void {
    this.seq++;
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {
        /* ainda não tinha começado */
      }
      n.disconnect();
    }
    this.nodes = [];
  }
}

export const toubeVoice = new ToubeVoice();

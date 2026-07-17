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

class ToubeVoice {
  private _enabled = false;
  private _voice: string = TOUBE_VOICES[0].id;
  // Playback via Web Audio (não <audio>): agendar o início com uma folga corrige
  // o corte do comecinho das falas — a saída de som (PipeWire/Bluetooth) acorda
  // durante a folga em vez de engolir as primeiras sílabas.
  private ctx: AudioContext | null = null;
  private node: AudioBufferSourceNode | null = null;
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

  /**
   * Sintetiza (via Piper no servidor) e toca. No-op se desligado / texto vazio.
   * `force` fala mesmo com o toggle desligado — é o "ouvir esta resposta" que a
   * pessoa pede explicitamente clicando no botão da mensagem. `voice` sobrepõe a
   * voz escolhida (o provador usa pra auditar cada uma).
   */
  async speak(text: string, opts?: { force?: boolean; voice?: string }): Promise<void> {
    if (typeof window === "undefined" || (!this._enabled && !opts?.force)) return;
    const clean = sanitize(text);
    if (!clean) return;
    this.stop();
    const mine = ++this.seq;
    try {
      const res = await fetch("/api/toube/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, voice: opts?.voice ?? this._voice }),
      });
      if (!res.ok || mine !== this.seq) return; // falhou ou foi interrompido no meio
      const data = await res.arrayBuffer();
      if (mine !== this.seq) return;

      if (!this.ctx) {
        const Ctx =
          window.AudioContext ??
          (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
      }
      if (this.ctx.state === "suspended") await this.ctx.resume();
      const buffer = await this.ctx.decodeAudioData(data);
      if (mine !== this.seq) return;

      const node = this.ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(this.ctx.destination);
      node.onended = () => {
        if (this.node === node) this.node = null;
      };
      this.node = node;
      // A folga de 250ms é o conserto do corte: a fala só começa depois que a
      // saída de áudio já está acordada.
      node.start(this.ctx.currentTime + 0.25);
    } catch {
      /* voz indisponível (sem internet) ou áudio bloqueado — silêncio */
    }
  }

  /** Corta a fala imediatamente e invalida qualquer síntese em andamento. */
  stop(): void {
    this.seq++;
    if (this.node) {
      try {
        this.node.stop();
      } catch {
        /* ainda não tinha começado */
      }
      this.node.disconnect();
      this.node = null;
    }
  }
}

export const toubeVoice = new ToubeVoice();

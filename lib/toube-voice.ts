// Voz do Toube: lê as respostas em voz alta com voz neural NATURAL (Piper, local).
// O texto vai pro endpoint /api/toube/voz, que roda o piper e devolve um WAV; aqui
// a gente só TOCA o áudio (playback de mídia normal — funciona onde o TTS do
// navegador não funciona). Só client. Singleton importado pelo ToubeConversation.
//
// Liga/desliga persistido em localStorage; default DESLIGADO.

const STORAGE_KEY = "toube-voice";

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
  private audio: HTMLAudioElement | null = null;
  private url: string | null = null;
  private seq = 0; // invalida respostas fora de ordem (stop no meio de um fetch)

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this._enabled = localStorage.getItem(STORAGE_KEY) === "1";
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

  /** Sintetiza (via Piper no servidor) e toca. No-op se desligado / texto vazio. */
  async speak(text: string): Promise<void> {
    if (typeof window === "undefined" || !this._enabled) return;
    const clean = sanitize(text);
    if (!clean) return;
    this.stop();
    const mine = ++this.seq;
    try {
      const res = await fetch("/api/toube/voz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean }),
      });
      if (!res.ok || mine !== this.seq) return; // falhou ou foi interrompido no meio
      const blob = await res.blob();
      if (mine !== this.seq) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.audio = audio;
      this.url = url;
      audio.addEventListener("ended", () => this.release(url));
      await audio.play();
    } catch {
      /* voz indisponível (piper fora) ou autoplay bloqueado — silêncio */
    }
  }

  /** Corta a fala imediatamente e invalida qualquer síntese em andamento. */
  stop(): void {
    this.seq++;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.release(this.url);
    this.url = null;
  }

  private release(url: string | null): void {
    if (url) URL.revokeObjectURL(url);
  }
}

export const toubeVoice = new ToubeVoice();

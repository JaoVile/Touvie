// Sino de notificação AFINADO na atmosfera ativa — feedback sonoro pra eventos do
// app (quest concluída, pomodoro, avisos). Reutilizável: qualquer feature chama
// playNotification(). Sintetizado no Web Audio (sem arquivo), como o clique do cursor.
//
// Afina na mesma tônica do cursor/pad (rootHz da frequência ativa, 2 oitavas acima),
// pra "casar" com o que está tocando. Sem atmosfera → C5 neutro. Silencioso se o
// áudio estiver indisponível.

import { FREQUENCIES, type SoundState, readSoundState } from "./soundscape";

let ctx: AudioContext | null = null;

function chimeRoot(s: SoundState): number {
  const f = FREQUENCIES.find((x) => x.key === s.freqMode);
  return f ? f.rootHz * 4 : 523.25; // C5 quando nada está tocando
}

/**
 * Toca um sino curto, suave e cristalino afinado na atmosfera ativa. Feedback de
 * notificação — chame quando algo relevante acontecer (quest, pomodoro, aviso).
 */
export function playNotification(): void {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    const ac = ctx;
    const root = chimeRoot(readSoundState());
    const t0 = ac.currentTime;
    const attack = 0.008;
    const release = 1.6;
    const peak = 0.12; // sutil, no espírito do resto do som do app

    const gain = ac.createGain();
    gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);

    // Sino: fundamental + oitava + 12ª (quinta acima da oitava), decaindo — gentil.
    const partial = (mult: number, g: number) => {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = root * mult;
      const og = ac.createGain();
      og.gain.value = g;
      osc.connect(og);
      og.connect(gain);
      osc.start(t0);
      osc.stop(t0 + attack + release + 0.05);
    };
    partial(1, 1);
    partial(2, 0.5);
    partial(3, 0.18);
  } catch {
    /* áudio indisponível — silêncio */
  }
}

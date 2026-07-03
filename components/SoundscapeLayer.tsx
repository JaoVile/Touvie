"use client";

import { SOUND_EVENT, type SoundState, readSoundState } from "@/lib/soundscape";
import { SoundEngine } from "@/lib/soundscape-engine";
import { useEffect, useRef } from "react";

/**
 * Overlay global (mora no root layout, ao lado do StarField/CursorTrail) →
 * vale pro app logado E pra landpage. Não renderiza nada; só mixa o áudio.
 */
export function SoundscapeLayer() {
  const engineRef = useRef<SoundEngine | null>(null);

  useEffect(() => {
    const engine = new SoundEngine();
    engineRef.current = engine;
    let armed = false;

    // Autoplay é bloqueado → se o contexto nasce suspenso (estado sticky no
    // reload), resume no 1º gesto do usuário.
    const arm = () => {
      if (armed) return;
      armed = true;
      const wake = () => {
        engine.resume();
        armed = false;
        window.removeEventListener("pointerdown", wake);
        window.removeEventListener("touchstart", wake);
        window.removeEventListener("keydown", wake);
      };
      window.addEventListener("pointerdown", wake, { once: true });
      window.addEventListener("touchstart", wake, { once: true });
      window.addEventListener("keydown", wake, { once: true });
    };

    const apply = (s: SoundState) => {
      engine.apply(s);
      if (engine.suspended) arm();
    };

    const onEvent = (e: Event) => apply((e as CustomEvent<SoundState>).detail);
    window.addEventListener(SOUND_EVENT, onEvent);

    apply(readSoundState());

    return () => {
      window.removeEventListener(SOUND_EVENT, onEvent);
      engine.stopAll();
    };
  }, []);

  return null;
}

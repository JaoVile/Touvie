"use client";

import { NOWPLAYING_REQUEST_EVENT } from "@/lib/sound-disabled";
import { useEffect } from "react";

/**
 * Pede ao engine (via SoundscapeLayer) o estado "tocando agora" UMA vez, depois
 * que a lista de créditos montou. Fica no pai de propósito: efeito de pai roda
 * após os das linhas, então quando o request dispara todas já estão ouvindo o
 * NOWPLAYING_EVENT — sem isso, quem abre os créditos com o som já tocando não
 * veria o realce. Antes cada linha pedia sozinha (N pedidos × N linhas = O(N²)).
 */
export function NowPlayingProbe() {
  useEffect(() => {
    window.dispatchEvent(new Event(NOWPLAYING_REQUEST_EVENT));
  }, []);
  return null;
}

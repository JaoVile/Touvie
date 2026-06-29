"use client";

import {
  CURSOR_COLOR_EVENT,
  CURSOR_COLOR_KEY,
  CURSOR_CUSTOM_EVENT,
  CUSTOM_CURSOR_ID,
  type CursorColorId,
  type CustomCursor,
  DEFAULT_CURSOR_COLOR,
  DEFAULT_CUSTOM_CURSOR,
  buildCursorPreset,
  getCursorColor,
  isValidCursorColor,
  readCustomCursor,
} from "@/lib/cursor-colors";
import { QUALITY_EVENT, type QualityTier, readQuality } from "@/lib/quality";
import { FREQUENCIES, SOUND_EVENT, type SoundState, readSoundState } from "@/lib/soundscape";
import { useEffect, useState } from "react";

/**
 * Staff-ribbon cursor trail — the pointer drags a tiny musical staff: a
 * 3-line staff flanked by 2 extremely faint lines, all springing after the
 * cursor and tapering to a point.
 *
 * Each click sounds the next note of the C-major scale — dó ré mi fá sol lá
 * si — and drops a note glyph that *joins the ribbon*: it rides the spine
 * from head to tail, then streams off the tail in the ribbon's heading,
 * drifting outward and fading like a ribbon trailing away. A faint, semi-
 * transparent note is also auto-emitted every `autoInterval` ms so the
 * ribbon keeps a rhythm of its own even without clicks.
 *
 * Spine physics ported from the trail on obsidianassembly.com
 * (Fiddle.Digital). Desktop + fine-pointer + motion-allowed only.
 */
const CONFIG = {
  // --- spine: the chain the staff rides on --------------------------------
  length: 32, // chain segments — alto o bastante pra curva lisa, sem strokes demais
  damping: 0.34, // segment catch-up per frame — lower = ribbon takes
  //                longer to collapse once the pointer stops (~2× here)
  inertiaRetention: 0.95, // how much velocity carries frame to frame
  inertiaInfluence: 0.2, // loose, ribbon-like whip
  inertiaStrength: 0.06, // overshoot — the flick/curl of the tail
  speedInfluence: 0.9, // how much pointer speed feeds the inertia
  speedMax: 600, // px/s mapped to "full" speed
  speedSmoothing: 0.2,
  maxLengthVw: 0.8, // hard cap on total length, as a fraction of viewport w

  // --- staff: 3 lines + 2 extremely subtle --------------------------------
  staffLines: 3, // pauta de 3 linhas (antes 5: as 2 externas, alpha 0.1, quase
  //                não apareciam e dobravam o nº de traços/frame — cortadas)
  staffSpread: 11, // total staff height at the head, in px
  spreadGain: 0.32, // extra spread folded in per unit of pointer speed
  headWidth: 1.1, // line thickness at the head
  tailWidth: 0.34, // line thickness at the tapered tail
  alphaBase: 0.55, // opacity of the 3 inner lines — subtle, "em branco"
  alphaFaint: 0.1, // opacity of the 2 outer lines — EXTREMELY subtle
  alphaEnd: 0, // converges + fades to nothing at the tail
  glowBlur: 1.2, // base bloom radius; breathes with pointer speed

  // --- melody: clique + auto-emissão rítmica ------------------------------
  melodyVolume: 0.07, // peak gain — "bem sutil"
  attack: 0.012, // s — note onset
  release: 0.6, // s — note tail; short = esmaece rapidamente

  autoInterval: 700, // ms — emite uma nota sozinha (a fita ganha um ritmo próprio)
  autoSound: false, // auto-notas NÃO fazem barulho (só as de clique soam)
  autoVolumeMul: 0.5, // auto-notas mais baixas que as de clique (se autoSound voltar)
  autoMoveWindow: 180, // ms — só auto-emite se o mouse se moveu nesse intervalo
  autoMaxAlive: 4, // no máximo 4 auto-notas vivas ao mesmo tempo

  glyphRide: 2300, // ms — sobe a fita da cabeça (t=0) à cauda (t=1)
  glyphRideLast: 1400, // ms — a última nota (si) sobe mais rápido
  glyphExit: 500, // ms — ao chegar na cauda, sai para fora da linha e some
  glyphExitDist: 64, // px — quanto a nota se afasta na direção da cauda
  glyphSize: 15, // px
  glyphStartScale: 0.7, // scale when the note joins the ribbon
  glyphEndScale: 1.35, // scale at the tail — the note grows as it rides
  glyphAlphaClick: 0.85, // opacidade das notas de clique
  glyphAlphaAuto: 0.42, // "meias transparentes" — as notas auto
  pitchSpread: 13, // px across the staff for low → high note placement
} as const;

// C-major scale, octave 5 — the seven syllables, in order. Serve de FALLBACK
// (nenhuma frequência de fundo ligada) e fixa a contagem de 7 graus que os
// glyphs usam pra escolher a linha da pauta.
const SCALE = [
  { name: "dó", freq: 523.25 },
  { name: "ré", freq: 587.33 },
  { name: "mi", freq: 659.25 },
  { name: "fá", freq: 698.46 },
  { name: "sol", freq: 783.99 },
  { name: "lá", freq: 880.0 },
  { name: "si", freq: 987.77 },
] as const;

// Semitons dos 7 graus da escala maior — pra reconstruir a escala a partir de
// QUALQUER raiz (afinando o clique à frequência de fundo ativa).
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11] as const;
const DEFAULT_ROOT = SCALE[0].freq; // C5, quando não há frequência tocando.

// Raiz da melodia do cursor a partir do estado do som: pega a tônica da
// frequência ativa (rootHz, grave) e sobe 2 oitavas pra ficar brilhante e
// consonante com o pad. Sem frequência → C5 (comportamento original).
function melodyRootFrom(s: SoundState): number {
  const f = FREQUENCIES.find((x) => x.key === s.freqMode);
  return f ? f.rootHz * 4 : DEFAULT_ROOT;
}

// Notas especiais na fita: a DUPLA é o "♫" (duas notinhas numa só, barra em
// cima — maior que a normal pra ler de longe); a CLAVE DE SOL é a da própria
// marca (path real #6 de public/brand/touvie-mark.svg via Path2D, coordenadas
// no espaço da arte; o box centro+altura normaliza pro tamanho do trail).
// Cadência: a cada 2 normais entra uma DUPLA; a cada 5 normais, a CLAVE —
// N N D N N D N C.
const CLEF_D =
  "M1692.7 505.461C1697.68 507.491 1702.02 518.192 1702.78 523.475C1705.34 541.381 1698.6 554.602 1688.17 568.541L1691.83 582.859C1700.66 584.408 1706.93 585.603 1712.66 593.748C1716.09 598.658 1717.3 604.787 1715.99 610.633C1714.02 619.337 1708.89 623.545 1701.95 628.156C1716.74 697.721 1652.39 659.344 1678.55 643.287L1679.55 642.68C1684.36 642.741 1687.14 644.332 1689.49 648.259C1690.09 654.524 1683.71 659.656 1686.17 664.435C1688.6 665.029 1689.61 664.903 1692.09 664.324C1706.79 660.892 1701.01 640.25 1698.67 630.104C1697.69 630.162 1696.7 630.201 1695.71 630.221C1676.52 630.59 1658.6 619.913 1658.79 598.765C1658.95 580.451 1669.92 568.316 1682.28 556.216C1678.3 535.232 1676.67 521.499 1692.7 505.461ZM1694.98 612.018C1693.99 607.301 1692.88 598.416 1688.85 595.785C1679.28 598.366 1681.16 610.092 1685.76 616.725C1684.11 617.825 1684.9 617.194 1682.81 616.915C1674.9 615.858 1675.04 608.026 1676.38 601.794C1678.19 593.356 1682.44 589.007 1688.73 583.412C1687.71 579.34 1686.82 574.864 1685.03 571.123C1641.33 607.578 1684.35 635.944 1697.01 627.263C1698.17 624.371 1695.75 615.836 1694.98 612.018ZM1686.83 552.273C1692.95 543.9 1706.85 526.129 1695.05 517.216C1684.65 527.967 1681.14 537.132 1684.29 552.294C1686.11 552.66 1685.31 552.839 1686.83 552.273ZM1705.99 621.679C1712.24 607.373 1709.63 598.266 1693.73 594.099C1694.81 598.894 1699.59 622.433 1702.15 624.305C1703.26 623.555 1704.99 622.471 1705.99 621.679Z";
const CLEF_BOX = { cx: 1687.5, cy: 587, h: 164 } as const;
// Alvo de tamanho relativo ao glyphSize: especiais maiores que a normal.
const DOUBLE_SIZE = 1.35;
const CLEF_SIZE = 1.55;
// Especiais emitidas no ritmo automático não podem sumir: opacidade própria,
// acima das auto-normais (0.42) e abaixo das de clique (0.85).
const ALPHA_AUTO_SPECIAL = 0.68;

type GlyphKind = "normal" | "double" | "clef";

type Glyph = {
  born: number;
  idx: number; // scale step — also picks the staff line the note rides on
  kind: GlyphKind; // normal (♪) | colcheia dupla da marca | clave de sol
  auto?: boolean; // emitida automaticamente (mais transparente) vs. por clique
};

// Liga/desliga do rastro — escolhido em /config, persistido em localStorage.
// É um canvas de tela cheia redesenhado por frame; em máquina modesta pesa, então
// dá pra desligar de vez (evento pra refletir ao vivo, sem reload). Default ON.
const CURSOR_KEY = "touvie:cursor";
const CURSOR_EVENT = "touvie:cursor";
const readCursorOn = (): boolean =>
  typeof window === "undefined" ? true : window.localStorage.getItem(CURSOR_KEY) !== "off";

// Trail size — picked in /config, persisted in localStorage. 1× / 2× / 3×.
const SCALE_KEY = "touvie:trailScale";
const SCALE_EVENT = "touvie:trail-scale";
const readScale = (): number => {
  if (typeof window === "undefined") return 1;
  const v = Number(window.localStorage.getItem(SCALE_KEY));
  return v === 2 || v === 3 ? v : 1;
};

// Trail colour — picked in /config alongside the size. Persists in
// localStorage; the picker dispatches CURSOR_COLOR_EVENT for a live swap.
const readColor = (): CursorColorId => {
  if (typeof window === "undefined") return DEFAULT_CURSOR_COLOR;
  const v = window.localStorage.getItem(CURSOR_COLOR_KEY);
  return isValidCursorColor(v) ? v : DEFAULT_CURSOR_COLOR;
};

// Trail is desktop-only: skipped on touch/coarse pointers, narrow viewports,
// or when the user prefers reduced motion. Listed here so the gate stays in
// sync with the effect — both subscribe to the same queries.
const DENY_QUERIES = [
  "(pointer: coarse)",
  "(hover: none)",
  "(max-width: 1024px)",
  "(prefers-reduced-motion: reduce)",
] as const;

export function CursorTrail() {
  const [trailScale, setTrailScale] = useState(1);
  const [trailColor, setTrailColor] = useState<CursorColorId>(DEFAULT_CURSOR_COLOR);
  // The "Personalizar" ribbon/note colours, read live alongside the colour id.
  const [custom, setCustom] = useState<CustomCursor>(DEFAULT_CUSTOM_CURSOR);
  // null while SSR; a boolean once we've evaluated the media queries client-side.
  const [denied, setDenied] = useState<boolean | null>(null);
  // Liga/desliga manual (em /config). Default ON; reconciliado no mount.
  const [cursorOn, setCursorOn] = useState(true);
  // Nível de qualidade visual — a fita só roda em "completo" (efeito caro).
  const [quality, setQuality] = useState<QualityTier>("completo");

  useEffect(() => {
    setCursorOn(readCursorOn());
    setQuality(readQuality());
    const onToggle = (e: Event) => {
      const v = (e as CustomEvent).detail;
      setCursorOn(typeof v === "boolean" ? v : readCursorOn());
    };
    const onQuality = (e: Event) => {
      const v = (e as CustomEvent).detail;
      setQuality(v === "completo" || v === "desempenho" ? v : readQuality());
    };
    const onStorage = () => {
      setCursorOn(readCursorOn());
      setQuality(readQuality());
    };
    window.addEventListener(CURSOR_EVENT, onToggle);
    window.addEventListener(QUALITY_EVENT, onQuality);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CURSOR_EVENT, onToggle);
      window.removeEventListener(QUALITY_EVENT, onQuality);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Pick up the saved size, and react live when /config changes it.
  useEffect(() => {
    setTrailScale(readScale());
    const onEvent = (e: Event) => {
      const v = (e as CustomEvent<number>).detail;
      setTrailScale(v === 2 || v === 3 ? v : 1);
    };
    const onStorage = () => setTrailScale(readScale());
    window.addEventListener(SCALE_EVENT, onEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SCALE_EVENT, onEvent);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Pick up the saved colour (and custom palette), react live when /config
  // changes either one.
  useEffect(() => {
    setTrailColor(readColor());
    setCustom(readCustomCursor());
    const onColor = (e: Event) => {
      const v = (e as CustomEvent<CursorColorId>).detail;
      if (isValidCursorColor(v)) setTrailColor(v);
    };
    const onCustom = () => setCustom(readCustomCursor());
    const onStorage = () => {
      setTrailColor(readColor());
      setCustom(readCustomCursor());
    };
    window.addEventListener(CURSOR_COLOR_EVENT, onColor);
    window.addEventListener(CURSOR_CUSTOM_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CURSOR_COLOR_EVENT, onColor);
      window.removeEventListener(CURSOR_CUSTOM_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Re-evaluate the deny gate whenever any of the relevant media queries flip.
  // Critical for the width gate: when devtools close and the viewport crosses
  // 1024px, the trail mounts without a page refresh.
  useEffect(() => {
    const mqls = DENY_QUERIES.map((q) => window.matchMedia(q));
    const evaluate = () => setDenied(mqls.some((m) => m.matches));
    evaluate();
    for (const m of mqls) m.addEventListener("change", evaluate);
    return () => {
      for (const m of mqls) m.removeEventListener("change", evaluate);
    };
  }, []);

  useEffect(() => {
    // Desempenho corta a fita; em completo respeita o toggle individual.
    if (denied !== false || !cursorOn || quality !== "completo") return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;
    Object.assign(canvas.style, {
      position: "fixed",
      top: "0",
      left: "0",
      // 100% (não 100vw): 100vw inclui a largura da barra de rolagem vertical e
      // estourava ~15px pro lado, criando uma barra de rolagem HORIZONTAL.
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "9999",
      background: "transparent",
    });
    document.body.appendChild(canvas);

    const { length } = CONFIG;
    const N = CONFIG.staffLines;
    // Size-related values scale with the chosen trail size (1× / 2× / 3×).
    const staffSpread = CONFIG.staffSpread * trailScale;
    const headWidth = CONFIG.headWidth * trailScale;
    const tailWidth = CONFIG.tailWidth * trailScale;
    // Resolve the colour preset once per effect run — when the user picks a
    // new colour we re-run via the dep array (no manual swap needed inside).
    const palette =
      trailColor === CUSTOM_CURSOR_ID ? buildCursorPreset(custom) : getCursorColor(trailColor);
    // SEM filtro CSS aqui: aplicar drop-shadow num canvas de tela cheia que
    // redesenha todo frame força o compositor a re-filtrar a camada inteira por
    // frame — trava o app. O ribbon fica nítido; só as poucas notas (glyphs)
    // ganham um leve brilho via ctx.shadow (baixo custo, são ≤24 desenhos).
    const glyphSize = CONFIG.glyphSize * trailScale;
    const glyphExitDist = CONFIG.glyphExitDist * trailScale;
    const pitchSpread = CONFIG.pitchSpread * trailScale;
    const pts = Array.from({ length }, () => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    // One point array per staff line.
    const lines = Array.from({ length: N }, () => Array.from({ length }, () => ({ x: 0, y: 0 })));
    const cursor = { x: 0, y: 0 };
    const glyphs: Glyph[] = [];

    let w = 0;
    let h = 0;
    let speed = 0; // smoothed 0..1
    let visible = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let raf = 0;
    let paused = false;
    let lastAuto = 0; // timestamp of the last auto-emitted note

    const resize = () => {
      // clientWidth exclui a barra de rolagem (casa com o CSS width:100% e com
      // as coordenadas do pointer, que também ignoram a barra).
      w = document.documentElement.clientWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onMove = (x: number, y: number) => {
      const now = performance.now();
      if (!visible) {
        // First sighting (or re-entry): snap the whole chain here, no streak.
        visible = true;
        for (const p of pts) {
          p.x = x;
          p.y = y;
          p.vx = 0;
          p.vy = 0;
        }
        cursor.x = x;
        cursor.y = y;
        lastX = x;
        lastY = y;
        lastT = now;
        lastAuto = now; // start the beat fresh on (re-)entry, no instant dump
        speed = 1;
        return;
      }
      const dt = Math.max(1, now - lastT) / 1000;
      const inst = Math.hypot(x - lastX, y - lastY) / dt;
      const norm = Math.min(1, inst / CONFIG.speedMax);
      speed += (norm - speed) * CONFIG.speedSmoothing;
      lastX = x;
      lastY = y;
      lastT = now;
      cursor.x = x;
      cursor.y = y;
    };

    const onPointer = (e: PointerEvent) => onMove(e.clientX, e.clientY);
    const onLeave = () => {
      visible = false;
    };

    // --- audio: each click sounds the next note of the scale ---------------
    let audioCtx: AudioContext | null = null;
    let noteIndex = 0;

    // A escala do cursor se AFINA à frequência de fundo ativa: a raiz segue o
    // som que está tocando, então cada clique soa consonante com o pad. Atualiza
    // ao vivo quando o /config muda o som (mesmo evento do SoundscapeLayer).
    let melodyRoot = melodyRootFrom(readSoundState());
    const onSound = (e: Event) => {
      melodyRoot = melodyRootFrom((e as CustomEvent<SoundState>).detail);
    };
    window.addEventListener(SOUND_EVENT, onSound);
    const noteFreq = (idx: number) => melodyRoot * 2 ** (MAJOR_STEPS[idx] / 12);

    // A clave da marca, pronta pro canvas (Path2D só existe no client —
    // por isso aqui dentro do effect, não no module scope).
    const clefPath = new Path2D(CLEF_D);

    // Cadência: N N D N N D N C (5 normais por ciclo; dupla após cada 2
    // normais; a 5ª normal puxa a clave e o ciclo recomeça).
    let sincePair = 0;
    let sinceClef = 0;
    const nextKind = (): GlyphKind => {
      if (sinceClef >= 5) {
        sinceClef = 0;
        sincePair = 0;
        return "clef";
      }
      if (sincePair >= 2) {
        sincePair = 0;
        return "double";
      }
      sincePair++;
      sinceClef++;
      return "normal";
    };

    const playNote = (freq: number, vol: number = CONFIG.melodyVolume) => {
      try {
        if (!audioCtx) {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtx = new AC();
        }
        if (audioCtx.state === "suspended") void audioCtx.resume();
        const ac = audioCtx;
        const t0 = ac.currentTime;
        const dur = CONFIG.attack + CONFIG.release;

        const gain = ac.createGain();
        gain.connect(ac.destination);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(vol, t0 + CONFIG.attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        // Fundamental + a soft octave above for a gentle, bell-ish colour.
        const voice = (f: number, g: number) => {
          const osc = ac.createOscillator();
          osc.type = "sine";
          osc.frequency.value = f;
          const og = ac.createGain();
          og.gain.value = g;
          osc.connect(og);
          og.connect(gain);
          osc.start(t0);
          osc.stop(t0 + dur + 0.05);
        };
        voice(freq, 1);
        voice(freq * 2, 0.22);
      } catch {
        /* audio unavailable — fail silently */
      }
    };

    const onClick = () => {
      playNote(noteFreq(noteIndex));
      // The note joins the ribbon — no spawn position, it rides the spine.
      glyphs.push({ born: performance.now(), idx: noteIndex, kind: nextKind() });
      if (glyphs.length > 24) glyphs.shift();
      noteIndex = (noteIndex + 1) % SCALE.length;
    };

    const normal = (ox: number, oy: number): [number, number] => {
      const l2 = ox * ox + oy * oy;
      if (l2 < 1e-10) return [0, 0];
      const inv = 1 / Math.sqrt(l2);
      return [-oy * inv, ox * inv];
    };

    // Each note rides the spine from head (t=0) to tail (t=1), then enters an
    // exit phase: it leaves the tail and drifts outward along the ribbon's
    // heading, fading away — like a ribbon trailing off, not lifting up.
    const drawGlyphs = () => {
      if (!glyphs.length) return;
      const now = performance.now();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = palette.noteFill;
      ctx.shadowColor = palette.noteShadow;
      const noteGlow = (palette.glowBlur ?? 4) * trailScale;
      for (let i = glyphs.length - 1; i >= 0; i--) {
        const g = glyphs[i];
        const isLast = g.idx === SCALE.length - 1;
        const ride = isLast ? CONFIG.glyphRideLast : CONFIG.glyphRide;
        const total = ride + CONFIG.glyphExit;
        const age = now - g.born;
        if (age >= total) {
          glyphs.splice(i, 1);
          continue;
        }
        // Auto notes are half-transparent; click notes carry full presence.
        // Special kinds (dupla/clave) keep presence even when auto-emitted.
        const maxAlpha = g.auto
          ? g.kind === "normal"
            ? CONFIG.glyphAlphaAuto
            : ALPHA_AUTO_SPECIAL
          : CONFIG.glyphAlphaClick;

        let x: number;
        let y: number;
        let scale: number;
        let alpha: number;

        if (age < ride) {
          // Phase 1 — riding the ribbon, head → tail.
          const t = age / ride; // 0..1 progress along the spine

          const f = t * (length - 1);
          const ix = Math.min(length - 1, Math.floor(f));
          const jx = Math.min(length - 1, ix + 1);
          const frac = f - ix;
          const a = pts[ix];
          const b = pts[jx];
          x = a.x + (b.x - a.x) * frac;
          y = a.y + (b.y - a.y) * frac;

          // Sit on the note's own staff line; offset tapers to 0 at the tail.
          const [nx, ny] = normal(b.x - a.x, b.y - a.y);
          const pitch = (g.idx / (SCALE.length - 1) - 0.5) * pitchSpread * (1 - t);
          x += nx * pitch;
          y += ny * pitch;

          // Grows steadily as it rides the ribbon, head → tail.
          scale = CONFIG.glyphStartScale + (CONFIG.glyphEndScale - CONFIG.glyphStartScale) * t;
          alpha = (t < 0.1 ? t / 0.1 : 1) * maxAlpha;
        } else {
          // Phase 2 — exit: leave the tail and drift outward along the
          // direction the ribbon ended, decelerating and fading away.
          const e = (age - ride) / CONFIG.glyphExit; // 0..1
          const ease = 1 - (1 - e) * (1 - e); // easeOut — fluid, slows as it goes
          const tail = pts[length - 1];
          const tb = pts[Math.max(0, length - 6)]; // a few segments back = stable heading
          let dx = tail.x - tb.x;
          let dy = tail.y - tb.y;
          const dl = Math.hypot(dx, dy);
          if (dl > 1e-3) {
            dx /= dl;
            dy /= dl;
          } else {
            // Ribbon collapsed (cursor idle): no heading — drift up faintly.
            dx = 0;
            dy = -1;
          }
          x = tail.x + dx * glyphExitDist * ease;
          y = tail.y + dy * glyphExitDist * ease;
          scale = CONFIG.glyphEndScale;
          alpha = maxAlpha * (1 - e);
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = noteGlow;
        if (g.kind === "clef") {
          // A clave da MARCA (Path2D nas coordenadas da arte): normaliza
          // pelo box medido — centra no ponto e escala pra altura-alvo.
          const s = (glyphSize * CLEF_SIZE * scale) / CLEF_BOX.h;
          ctx.scale(s, s);
          ctx.translate(-CLEF_BOX.cx, -CLEF_BOX.cy);
          ctx.fill(clefPath);
          if (palette.noteOutline) {
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5 / s;
            ctx.lineJoin = "round";
            ctx.strokeStyle = palette.noteOutline;
            ctx.stroke(clefPath);
          }
        } else {
          // ♪ normal | ♫ dupla ("2 notinhas em uma só"), maior pra destacar.
          const char = g.kind === "double" ? "♫" : "♪";
          const fs = g.kind === "double" ? glyphSize * DOUBLE_SIZE : glyphSize;
          ctx.scale(scale, scale);
          ctx.font = `${fs}px "Times New Roman", serif`;
          ctx.fillText(char, 0, 0);
          // Optional crisp outline ("contorno") — drawn over the fill, with
          // the bloom switched off so the edge stays sharp.
          if (palette.noteOutline) {
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1.5;
            ctx.lineJoin = "round";
            ctx.strokeStyle = palette.noteOutline;
            ctx.strokeText(char, 0, 0);
          }
        }
        ctx.restore();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const frame = () => {
      raf = 0;
      if (paused) return;
      ctx.clearRect(0, 0, w, h);
      raf = requestAnimationFrame(frame);

      if (visible) {
        // Auto-melody: drop a faint, silent note on a steady beat — but only
        // while the pointer is actually moving (lastT updates on each move),
        // capped to a few notes alive at once.
        const nowA = performance.now();
        const moving = nowA - lastT <= CONFIG.autoMoveWindow;
        if (moving && nowA - lastAuto >= CONFIG.autoInterval) {
          lastAuto = nowA;
          // Keep at most autoMaxAlive auto-notes — drop the oldest one (glyphs
          // are stored in birth order, so the first auto found is the oldest).
          let aliveAuto = 0;
          let oldestAuto = -1;
          for (let i = 0; i < glyphs.length; i++) {
            if (glyphs[i].auto) {
              aliveAuto++;
              if (oldestAuto === -1) oldestAuto = i;
            }
          }
          if (aliveAuto >= CONFIG.autoMaxAlive && oldestAuto !== -1) {
            glyphs.splice(oldestAuto, 1);
          }
          glyphs.push({ born: nowA, idx: noteIndex, kind: nextKind(), auto: true });
          if (glyphs.length > 24) glyphs.shift();
          if (CONFIG.autoSound && audioCtx && audioCtx.state === "running") {
            playNote(noteFreq(noteIndex), CONFIG.melodyVolume * CONFIG.autoVolumeMul);
          }
          noteIndex = (noteIndex + 1) % SCALE.length;
        }

        const te = 1 + CONFIG.speedInfluence * speed;

        // Head springs toward the cursor.
        const headK = CONFIG.damping + 0.1;
        const gx = (cursor.x - pts[0].x) * headK;
        const gy = (cursor.y - pts[0].y) * headK;
        pts[0].vx = pts[0].vx * CONFIG.inertiaRetention + gx * CONFIG.inertiaInfluence * te;
        pts[0].vy = pts[0].vy * CONFIG.inertiaRetention + gy * CONFIG.inertiaInfluence * te;
        pts[0].x += gx + pts[0].vx * CONFIG.inertiaStrength * te;
        pts[0].y += gy + pts[0].vy * CONFIG.inertiaStrength * te;

        // Each following point chases the one ahead of it. Inertia fades to
        // zero toward the tail, so the tip just trails smoothly.
        for (let i = 1; i < length; i++) {
          const prev = pts[i - 1];
          const cur = pts[i];
          const tail = 1 - i / (length - 1);
          const infl = CONFIG.inertiaInfluence * 2 * tail;
          const strg = CONFIG.inertiaStrength * tail;
          const sx = (prev.x - cur.x) * CONFIG.damping;
          const sy = (prev.y - cur.y) * CONFIG.damping;
          cur.vx = cur.vx * CONFIG.inertiaRetention + sx * infl;
          cur.vy = cur.vy * CONFIG.inertiaRetention + sy * infl;
          cur.x += sx + cur.vx * strg;
          cur.y += sy + cur.vy * strg;
        }

        // Cap the overall stretch — no segment exceeds its share of the cap.
        const maxSeg = (CONFIG.maxLengthVw * w) / (length - 1);
        for (let i = 1; i < length; i++) {
          const prev = pts[i - 1];
          const cur = pts[i];
          const dx = cur.x - prev.x;
          const dy = cur.y - prev.y;
          const d = Math.hypot(dx, dy);
          if (d > maxSeg) {
            const nx = dx / d;
            const ny = dy / d;
            cur.x = prev.x + nx * maxSeg;
            cur.y = prev.y + ny * maxSeg;
            const radial = cur.vx * nx + cur.vy * ny;
            if (radial > 0) {
              cur.vx -= radial * nx;
              cur.vy -= radial * ny;
            }
          }
        }

        // Lay the staff lines off each point's normal. Spread tapers from
        // full at the head to a point at the tail.
        const spreadMul = 1 + CONFIG.spreadGain * speed;
        for (let i = 0; i < length; i++) {
          const t = i / (length - 1);
          const p = pts[i];
          const next = pts[i + 1] ?? p;
          const prev = pts[i - 1] ?? p;
          let nx: number;
          let ny: number;
          if (i === 0) {
            [nx, ny] = normal(next.x - p.x, next.y - p.y);
          } else if (i === length - 1) {
            [nx, ny] = normal(p.x - prev.x, p.y - prev.y);
          } else {
            const [ax, ay] = normal(p.x - prev.x, p.y - prev.y);
            const [bx, by] = normal(next.x - p.x, next.y - p.y);
            nx = (ax + bx) / 2;
            ny = (ay + by) / 2;
            const l2 = nx * nx + ny * ny;
            if (l2 >= 1e-10) {
              const inv = 1 / Math.sqrt(l2);
              nx *= inv;
              ny *= inv;
            }
          }
          const spread = staffSpread * (1 - t) * spreadMul;
          for (let k = 0; k < N; k++) {
            // f runs across the staff; off spans the full spread.
            const fk = k - (N - 1) / 2;
            const off = (fk * spread) / (N - 1);
            lines[k][i].x = p.x + nx * off;
            lines[k][i].y = p.y + ny * off;
          }
        }

        // O brilho agora é o drop-shadow CSS da camada (ver canvas.style.filter)
        // — nada de ctx.shadowBlur por traço, que era o gargalo.
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Stroke every staff line as a smooth curve, not a polyline. Each
        // piece is a quadratic centred on point i, running midpoint→midpoint
        // with the point itself as the control handle — so the ribbon bends
        // *through* the chain instead of kinking at every joint. That kills
        // the faceted, "quebrado/quadrado" look on fast direction changes.
        // Consecutive pieces share their midpoint endpoints and round caps
        // hide the seams; the head/tail pieces reach the true end points.
        // The 2 outer lines stay EXTREMELY faint; the 3 inner carry the staff.
        for (let i = 1; i < length - 1; i++) {
          const t = i / (length - 1);
          ctx.lineWidth = headWidth + (tailWidth - headWidth) * t;
          const atHead = i === 1;
          const atTail = i === length - 2;
          for (let k = 0; k < N; k++) {
            const L = lines[k];
            // Linhas externas só "somem" (alphaFaint) quando há 5+; numa pauta
            // de 3 todas são a linha cheia.
            const base = N >= 5 && (k === 0 || k === N - 1) ? CONFIG.alphaFaint : CONFIG.alphaBase;
            const alpha = base + (CONFIG.alphaEnd - base) * t;
            ctx.strokeStyle = `rgba(${palette.ribbonRgb},${alpha})`;
            const sx = atHead ? L[0].x : (L[i - 1].x + L[i].x) / 2;
            const sy = atHead ? L[0].y : (L[i - 1].y + L[i].y) / 2;
            const ex = atTail ? L[length - 1].x : (L[i].x + L[i + 1].x) / 2;
            const ey = atTail ? L[length - 1].y : (L[i].y + L[i + 1].y) / 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(L[i].x, L[i].y, ex, ey);
            ctx.stroke();
          }
        }
        ctx.shadowBlur = 0;
      }

      // Note glyphs live on after the cursor leaves, so draw them last and
      // outside the `visible` gate.
      drawGlyphs();
    };

    const start = () => {
      if (!raf && !paused) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const onVisibility = () => {
      paused = document.hidden;
      if (paused) stop();
      else start();
    };

    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onClick, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onClick);
      window.removeEventListener(SOUND_EVENT, onSound);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      void audioCtx?.close();
      canvas.remove();
    };
  }, [denied, cursorOn, quality, trailScale, trailColor, custom]);

  return null;
}

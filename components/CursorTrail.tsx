"use client";

import { useEffect, useState } from "react";
import {
  CURSOR_COLOR_EVENT,
  CURSOR_COLOR_KEY,
  type CursorColorId,
  DEFAULT_CURSOR_COLOR,
  getCursorColor,
  isValidCursorColor,
} from "@/lib/cursor-colors";

/**
 * Staff-ribbon cursor trail — the pointer drags a tiny musical staff: a
 * 3-line staff flanked by 2 extremely faint lines, all springing after the
 * cursor and tapering to a point.
 *
 * Each click sounds the next note of the C-major scale — dó ré mi fá sol lá
 * si — and drops a note glyph that *joins the ribbon*: it rides the spine
 * from head to tail, and only at the very end lifts up a little and shrinks
 * away ("apenas no final irão ter a animação delas saindo para cima").
 *
 * Spine physics ported from the trail on obsidianassembly.com
 * (Fiddle.Digital). Desktop + fine-pointer + motion-allowed only.
 */
const CONFIG = {
  // --- spine: the chain the staff rides on --------------------------------
  length: 40, // chain segments — keep high for a smooth, unfaceted curve
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
  staffLines: 5, // total parallel lines: 3 visible + 2 outer faint
  staffSpread: 11, // total staff height at the head, in px
  spreadGain: 0.32, // extra spread folded in per unit of pointer speed
  headWidth: 1.1, // line thickness at the head
  tailWidth: 0.34, // line thickness at the tapered tail
  alphaBase: 0.55, // opacity of the 3 inner lines — subtle, "em branco"
  alphaFaint: 0.1, // opacity of the 2 outer lines — EXTREMELY subtle
  alphaEnd: 0, // converges + fades to nothing at the tail
  glowBlur: 1.2, // base bloom radius; breathes with pointer speed

  // --- melody: a cada clique ----------------------------------------------
  melodyVolume: 0.07, // peak gain — "bem sutil"
  attack: 0.012, // s — note onset
  release: 0.6, // s — note tail; short = esmaece rapidamente
  glyphLife: 2300, // ms — rides the longer, slower-collapsing ribbon head → tail
  glyphLifeLast: 1400, // ms — the last note (si) rides + fades extra fast
  glyphSize: 15, // px
  glyphStartScale: 0.7, // scale when the note joins the ribbon
  glyphEndScale: 1.35, // scale at the tail — the note grows as it rides
  glyphEndStart: 0.78, // progress at which the end lift-off begins
  glyphEndRise: 16, // px the glyph lifts upward before fading away
  pitchSpread: 13, // px across the staff for low → high note placement
} as const;

// C-major scale, octave 5 — the seven syllables, in order.
const SCALE = [
  { name: "dó", freq: 523.25 },
  { name: "ré", freq: 587.33 },
  { name: "mi", freq: 659.25 },
  { name: "fá", freq: 698.46 },
  { name: "sol", freq: 783.99 },
  { name: "lá", freq: 880.0 },
  { name: "si", freq: 987.77 },
] as const;

const GLYPH_CHARS = ["♪", "♫"] as const;

type Glyph = {
  born: number;
  idx: number; // scale step — also picks the staff line the note rides on
};

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
  // null while SSR; a boolean once we've evaluated the media queries client-side.
  const [denied, setDenied] = useState<boolean | null>(null);

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

  // Pick up the saved colour, and react live when /config changes it.
  useEffect(() => {
    setTrailColor(readColor());
    const onEvent = (e: Event) => {
      const v = (e as CustomEvent<CursorColorId>).detail;
      if (isValidCursorColor(v)) setTrailColor(v);
    };
    const onStorage = () => setTrailColor(readColor());
    window.addEventListener(CURSOR_COLOR_EVENT, onEvent);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CURSOR_COLOR_EVENT, onEvent);
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
    if (denied !== false) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) return;
    Object.assign(canvas.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
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
    const glowBlur = CONFIG.glowBlur * trailScale;
    // Resolve the colour preset once per effect run — when the user picks a
    // new colour we re-run via the dep array (no manual swap needed inside).
    const palette = getCursorColor(trailColor);
    const glyphSize = CONFIG.glyphSize * trailScale;
    const glyphEndRise = CONFIG.glyphEndRise * trailScale;
    const pitchSpread = CONFIG.pitchSpread * trailScale;
    const pts = Array.from({ length }, () => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    // One point array per staff line.
    const lines = Array.from({ length: N }, () =>
      Array.from({ length }, () => ({ x: 0, y: 0 })),
    );
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

    const resize = () => {
      w = window.innerWidth;
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

    const playNote = (freq: number) => {
      try {
        if (!audioCtx) {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          audioCtx = new AC();
        }
        if (audioCtx.state === "suspended") void audioCtx.resume();
        const ac = audioCtx;
        const t0 = ac.currentTime;
        const dur = CONFIG.attack + CONFIG.release;

        const gain = ac.createGain();
        gain.connect(ac.destination);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(CONFIG.melodyVolume, t0 + CONFIG.attack);
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
      playNote(SCALE[noteIndex].freq);
      // The note joins the ribbon — no spawn position, it rides the spine.
      glyphs.push({ born: performance.now(), idx: noteIndex });
      if (glyphs.length > 24) glyphs.shift();
      noteIndex = (noteIndex + 1) % SCALE.length;
    };

    const normal = (ox: number, oy: number): [number, number] => {
      const l2 = ox * ox + oy * oy;
      if (l2 < 1e-10) return [0, 0];
      const inv = 1 / Math.sqrt(l2);
      return [-oy * inv, ox * inv];
    };

    // Each note rides the spine from head (t=0) to tail (t=1); only past
    // glyphEndStart does it lift up and shrink away.
    const drawGlyphs = () => {
      if (!glyphs.length) return;
      const now = performance.now();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = palette.noteShadow;
      ctx.fillStyle = palette.noteFill;
      for (let i = glyphs.length - 1; i >= 0; i--) {
        const g = glyphs[i];
        const isLast = g.idx === SCALE.length - 1;
        const life = isLast ? CONFIG.glyphLifeLast : CONFIG.glyphLife;
        const age = now - g.born;
        if (age >= life) {
          glyphs.splice(i, 1);
          continue;
        }
        const t = age / life; // 0..1 — progress along the ribbon

        // Sample the spine at parameter t.
        const f = t * (length - 1);
        const ix = Math.min(length - 1, Math.floor(f));
        const jx = Math.min(length - 1, ix + 1);
        const frac = f - ix;
        const a = pts[ix];
        const b = pts[jx];
        let x = a.x + (b.x - a.x) * frac;
        let y = a.y + (b.y - a.y) * frac;

        // Sit on the note's own staff line (low note low, high note high);
        // the offset tapers as the ribbon converges toward the tail.
        const [nx, ny] = normal(b.x - a.x, b.y - a.y);
        const pitch =
          (g.idx / (SCALE.length - 1) - 0.5) * pitchSpread * (1 - t);
        x += nx * pitch;
        y += ny * pitch;

        // Grows steadily as it rides the ribbon, head → tail.
        const scale =
          CONFIG.glyphStartScale +
          (CONFIG.glyphEndScale - CONFIG.glyphStartScale) * t;
        let alpha: number;
        if (t < CONFIG.glyphEndStart) {
          // Riding the ribbon — quick subtle settle-in, then hold.
          alpha = (t < 0.1 ? t / 0.1 : 1) * 0.85;
        } else {
          // The end: lift up a little and fade — "subirem para cima".
          const e = (t - CONFIG.glyphEndStart) / (1 - CONFIG.glyphEndStart);
          y -= glyphEndRise * e;
          alpha = 0.85 * (1 - e);
        }

        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.shadowBlur = 5;
        ctx.globalAlpha = alpha;
        ctx.font = `${glyphSize}px "Times New Roman", serif`;
        ctx.fillText(GLYPH_CHARS[g.idx % GLYPH_CHARS.length], 0, 0);
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
        const te = 1 + CONFIG.speedInfluence * speed;

        // Head springs toward the cursor.
        const headK = CONFIG.damping + 0.1;
        const gx = (cursor.x - pts[0].x) * headK;
        const gy = (cursor.y - pts[0].y) * headK;
        pts[0].vx =
          pts[0].vx * CONFIG.inertiaRetention +
          gx * CONFIG.inertiaInfluence * te;
        pts[0].vy =
          pts[0].vy * CONFIG.inertiaRetention +
          gy * CONFIG.inertiaInfluence * te;
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

        // Soft bloom — breathes with pointer speed.
        ctx.shadowColor = `rgba(${palette.glowRgb},${0.3 + speed * 0.3})`;
        ctx.shadowBlur = glowBlur * (1 + speed * 0.8);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Stroke every staff-line segment. The 2 outer lines are kept
        // EXTREMELY faint; the 3 inner lines carry the staff.
        for (let i = 0; i < length - 1; i++) {
          const t = i / (length - 1);
          ctx.lineWidth = headWidth + (tailWidth - headWidth) * t;
          for (let k = 0; k < N; k++) {
            const base =
              k === 0 || k === N - 1 ? CONFIG.alphaFaint : CONFIG.alphaBase;
            const alpha = base + (CONFIG.alphaEnd - base) * t;
            ctx.strokeStyle = `rgba(${palette.ribbonRgb},${alpha})`;
            ctx.beginPath();
            ctx.moveTo(lines[k][i].x, lines[k][i].y);
            ctx.lineTo(lines[k][i + 1].x, lines[k][i + 1].y);
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
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      void audioCtx?.close();
      canvas.remove();
    };
  }, [denied, trailScale, trailColor]);

  return null;
}

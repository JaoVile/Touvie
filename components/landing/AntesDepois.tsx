"use client";

import { Reveal } from "@/components/Reveal";
import { TouvieEmblem } from "@/components/brand/TouvieEmblem";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Dumbbell,
  type LucideIcon,
  NotebookPen,
  Repeat,
  Salad,
  Sparkles,
  StickyNote,
  Target,
  Wallet,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import {
  MiniDiario,
  MiniDieta,
  MiniFinancas,
  MiniLembretes,
  MiniMetas,
  MiniNotas,
  MiniRotina,
  MiniTreino,
  MiniVie,
} from "./MiniScreens";

/**
 * Interlúdio que paga o Manifesto ("você não precisa de dez apps"): à esquerda
 * os apps soltos; à direita o selo, um sistema só.
 *
 * Os chips do "antes" são INTERATIVOS: passar o mouse (ou clicar) faz o preview
 * da tela equivalente do Touvie tomar o LUGAR do emblema — a prova de que cada
 * aba avulsa vira módulo nativo. Clicar fixa; clicar FORA volta pro emblema
 * (que reanima na volta). Os 10 chips estão ligados a mini-telas (em
 * MiniScreens) fiéis ao layout real de cada área do app.
 */
type AppChip = { icon: LucideIcon; label: string; rot: number; preview?: ReactNode };

const SCATTERED: AppChip[] = [
  { icon: CalendarDays, label: "agenda", rot: -5, preview: <MiniRotina /> },
  { icon: Wallet, label: "gastos", rot: 3, preview: <MiniFinancas /> },
  { icon: Dumbbell, label: "treino", rot: -2, preview: <MiniTreino /> },
  { icon: StickyNote, label: "notas", rot: 4, preview: <MiniNotas /> },
  { icon: Target, label: "metas", rot: -4, preview: <MiniMetas /> },
  { icon: Repeat, label: "hábitos", rot: 2, preview: <MiniRotina /> },
  { icon: NotebookPen, label: "diário", rot: -3, preview: <MiniDiario /> },
  { icon: Bell, label: "lembretes", rot: 5, preview: <MiniLembretes /> },
  { icon: Salad, label: "dieta", rot: -2, preview: <MiniDieta /> },
  { icon: Sparkles, label: "IA", rot: 3, preview: <MiniVie /> },
];

export function AntesDepois() {
  const [active, setActive] = useState<string | null>(null); // fixado por clique
  const [hover, setHover] = useState<string | null>(null); // temporário (mouse/foco)

  // Clicar FORA dos chips e do palco volta pro emblema.
  useEffect(() => {
    if (!active) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && !t.closest("[data-ad-keep]")) setActive(null);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [active]);

  const shownLabel = hover ?? active;
  const shown = SCATTERED.find((a) => a.label === shownLabel && a.preview) ?? null;

  return (
    <section id="antes-depois" className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
      <Reveal>
        <p className="eyebrow flex items-center gap-3" style={{ color: "var(--color-fg-subtle)" }}>
          <span
            aria-hidden="true"
            className="h-px w-7"
            style={{ background: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
          />
          Antes & depois
        </p>
      </Reveal>
      <Reveal delay={120}>
        <h2
          className="display mt-4 max-w-3xl text-h2 sm:text-display"
          style={{ color: "var(--color-fg)" }}
        >
          De dez apps soltos a <span className="display-i gradient-text">um só lugar</span>.
        </h2>
      </Reveal>

      <div className="mt-16 grid items-center gap-12 sm:grid-cols-[1fr_auto_1fr] sm:gap-6">
        {/* Antes — os apps soltos, agora exploráveis */}
        <Reveal delay={200}>
          <p className="eyebrow mb-5" style={{ color: "var(--color-fg-subtle)" }}>
            antes
          </p>
          <div className="flex flex-wrap gap-3">
            {SCATTERED.map((a) => {
              const Icon = a.icon;
              const on = shownLabel === a.label;
              const hasPreview = Boolean(a.preview);
              return (
                <button
                  key={a.label}
                  type="button"
                  data-ad-keep
                  onMouseEnter={() => hasPreview && setHover(a.label)}
                  onMouseLeave={() => setHover((v) => (v === a.label ? null : v))}
                  onFocus={() => hasPreview && setHover(a.label)}
                  onBlur={() => setHover((v) => (v === a.label ? null : v))}
                  onClick={() => hasPreview && setActive((v) => (v === a.label ? null : a.label))}
                  aria-pressed={hasPreview ? active === a.label : undefined}
                  className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[15px] transition-all duration-200"
                  style={{
                    transform: `rotate(${a.rot}deg)`,
                    color: on ? "var(--color-accent)" : "var(--color-fg-muted)",
                    borderColor: on
                      ? "color-mix(in srgb, var(--color-accent) 55%, transparent)"
                      : "var(--color-border)",
                    background: on
                      ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                      : "color-mix(in srgb, var(--color-fg) 4%, transparent)",
                    cursor: hasPreview ? "pointer" : "default",
                  }}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  {a.label}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* A virada */}
        <Reveal delay={320} className="flex justify-center">
          <ArrowRight
            className="rotate-90 sm:rotate-0"
            size={28}
            strokeWidth={1.25}
            style={{ color: "var(--color-accent)" }}
          />
        </Reveal>

        {/* Agora — o palco: emblema, ou o preview da tela escolhida no lugar dele */}
        <Reveal delay={440}>
          <p className="eyebrow mb-5 text-center" style={{ color: "var(--color-accent)" }}>
            agora
          </p>
          <div
            data-ad-keep
            className="flex min-h-[340px] flex-col items-center justify-center gap-3"
          >
            <div
              key={shown ? shown.label : "emblema"}
              className="ad-stage-in flex w-full flex-col items-center gap-3"
            >
              {shown ? (
                <div className="w-full max-w-[20rem]">{shown.preview}</div>
              ) : (
                <TouvieEmblem size={320} alt="" />
              )}
              <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
                {shown ? "no seu Touvie" : "um sistema só"}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

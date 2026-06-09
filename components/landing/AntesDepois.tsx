import { Reveal } from "@/components/Reveal";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Dumbbell,
  type LucideIcon,
  NotebookPen,
  Repeat,
  Salad,
  StickyNote,
  Target,
  Wallet,
} from "lucide-react";
import { Seal } from "./Seal";

/**
 * Interlúdio que paga o Manifesto ("você não precisa de dez apps"): à esquerda
 * o de-sempre — um amontoado de apps soltos, esmaecidos e riscados, jogados em
 * ângulos distintos; à direita o selo, um sistema só. Sem número: é a virada
 * de imagem entre o manifesto (tese) e os módulos (prova).
 *
 * Os rótulos são genéricos de propósito (agenda, gastos, treino…) — não citam
 * marcas; o ponto é o *tipo* de app que vira aba esquecida.
 */
const SCATTERED: { icon: LucideIcon; label: string; rot: number }[] = [
  { icon: CalendarDays, label: "agenda", rot: -5 },
  { icon: Wallet, label: "gastos", rot: 3 },
  { icon: Dumbbell, label: "treino", rot: -2 },
  { icon: StickyNote, label: "notas", rot: 4 },
  { icon: Target, label: "metas", rot: -4 },
  { icon: Repeat, label: "hábitos", rot: 2 },
  { icon: NotebookPen, label: "diário", rot: -3 },
  { icon: Bell, label: "lembretes", rot: 5 },
  { icon: Salad, label: "dieta", rot: -2 },
];

export function AntesDepois() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
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
        {/* Antes — o amontoado disperso */}
        <Reveal delay={200}>
          <p className="eyebrow mb-5" style={{ color: "var(--color-fg-subtle)" }}>
            antes
          </p>
          <div className="flex flex-wrap gap-2.5">
            {SCATTERED.map((a) => {
              const Icon = a.icon;
              return (
                <span
                  key={a.label}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
                  style={{
                    transform: `rotate(${a.rot}deg)`,
                    color: "var(--color-fg-subtle)",
                    border: "1px solid var(--color-border)",
                    background: "color-mix(in srgb, var(--color-fg) 3%, transparent)",
                    opacity: 0.72,
                  }}
                >
                  <Icon size={13} strokeWidth={1.5} />
                  <span
                    style={{
                      textDecoration: "line-through",
                      textDecorationColor: "color-mix(in srgb, var(--color-danger) 55%, transparent)",
                    }}
                  >
                    {a.label}
                  </span>
                </span>
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

        {/* Depois — o selo, um sistema só */}
        <Reveal delay={440}>
          <p className="eyebrow mb-5 text-center" style={{ color: "var(--color-accent)" }}>
            agora
          </p>
          <div className="flex flex-col items-center gap-3">
            <Seal size={104} />
            <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
              um sistema só
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

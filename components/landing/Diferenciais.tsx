import { Parallax } from "@/components/Parallax";
import { Reveal } from "@/components/Reveal";
import { type LucideIcon, Music4, Palette, Send, ShieldCheck } from "lucide-react";
import { SectionHeading } from "./SectionHeading";

const ITEMS: { icon: LucideIcon; kicker: string; title: string; body: string; note: string }[] = [
  {
    icon: Send,
    kicker: "Bot no Telegram",
    title: "Os lembretes te encontram",
    body: "Bom dia com a rotina, à noite com o que vence amanhã, e o fechamento do mês — direto no Telegram, sem você abrir o app.",
    note: "morning · evening · monthly",
  },
  {
    icon: ShieldCheck,
    kicker: "Privacidade real",
    title: "Seu diário é só seu",
    body: "PIN separado pra leitura e escrita, dispositivo confiável e celular em modo só-leitura. A trava é server-side, não teatro.",
    note: "PIN · device confiável · só-leitura",
  },
  {
    icon: Music4,
    kicker: "Feito à mão",
    title: "Até o cursor canta",
    body: "Serifa editorial, selo em Pinyon e um cursor-fita que toca a escala de dó a si a cada clique. O capricho é o diferencial.",
    note: "dó · ré · mi · fá · sol · lá · si",
  },
  {
    icon: Palette,
    kicker: "Do seu jeito",
    title: "Você pinta o sistema",
    body: "Temas, cores e até o rastro do cursor — ajuste cada detalhe pro Touvie ter a sua cara.",
    note: "temas · cores · trilha",
  },
];

/**
 * Seção 4 — Diferenciais. Linhas editoriais alternadas (texto de um lado,
 * painel de vidro com o ícone do outro), com leve parallax pra profundidade.
 * É onde o "amplo" vira "bem-feito".
 */
export function Diferenciais() {
  return (
    <section id="diferenciais" className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
      <SectionHeading
        index="03"
        eyebrow="O diferencial"
        title={
          <>
            Não é só amplo. É <span className="display-i gradient-text">bem-feito</span>.
          </>
        }
        lead="O que separa o Touvie de mais um painel genérico está nos detalhes."
      />
      <div className="mt-14 flex flex-col gap-16 sm:gap-24">
        {ITEMS.map((it, i) => {
          const flip = i % 2 === 1;
          const Icon = it.icon;
          return (
            <div key={it.title} className="grid items-center gap-8 sm:grid-cols-2 sm:gap-14">
              <Reveal className={flip ? "sm:order-2" : ""}>
                <p className="eyebrow" style={{ color: "var(--color-accent)" }}>
                  {it.kicker}
                </p>
                <h3 className="display mt-3 text-h2" style={{ color: "var(--color-fg)" }}>
                  {it.title}
                </h3>
                <p
                  className="mt-4 max-w-md text-base sm:text-lg"
                  style={{ color: "var(--color-fg-muted)" }}
                >
                  {it.body}
                </p>
              </Reveal>
              <Reveal delay={120} className={flip ? "sm:order-1" : ""}>
                <Parallax speed={-0.06}>
                  <div className="glass flex min-h-[14rem] flex-col items-center justify-center gap-4 p-8 text-center">
                    <span
                      className="grid h-16 w-16 place-items-center rounded-2xl"
                      style={{
                        background: "color-mix(in srgb, var(--color-accent) 12%, var(--color-card))",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      <Icon size={28} strokeWidth={1.5} style={{ color: "var(--color-accent)" }} />
                    </span>
                    <p
                      className="font-mono text-[11px] uppercase tracking-[0.14em]"
                      style={{ color: "var(--color-fg-subtle)" }}
                    >
                      {it.note}
                    </p>
                  </div>
                </Parallax>
              </Reveal>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import { Reveal } from "@/components/Reveal";
import { type LucideIcon, Moon, Send, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { MiniDiario, MiniRotina, MiniTreino } from "./MiniScreens";
import { SectionHeading } from "./SectionHeading";

/**
 * Seção 03 — "Um dia no Touvie". O equivalente do "como funciona": três
 * momentos (manhã/tarde/noite), cada um com um horário em serifa, uma mini-tela
 * do app e — onde faz sentido — um "ping" simulando o lembrete que chega pelo
 * Telegram. Mostra o produto em uso e os crons (morning/evening/monthly) sem
 * depender de screenshot real.
 */
const MOMENTS: {
  time: string;
  name: string;
  screen: ReactNode;
  body: string;
  ping?: { icon: LucideIcon; text: string };
}[] = [
  {
    time: "07:00",
    name: "Manhã",
    screen: <MiniRotina />,
    body: "O dia abre com a sua rotina e o foco de hoje já montados — nada de decidir por onde começar.",
    ping: { icon: Sun, text: "Bom dia — 4 hábitos e 1 meta te esperam hoje" },
  },
  {
    time: "13:30",
    name: "Tarde",
    screen: <MiniTreino />,
    body: "No meio do corre, registra o treino, um gasto ou uma ideia — num toque, sem trocar de app.",
  },
  {
    time: "22:00",
    name: "Noite",
    screen: <MiniDiario />,
    body: "Fecha o dia no diário, protegido por PIN. Da sua cabeça pro papel — e só você lê.",
    ping: { icon: Moon, text: "Boa noite — que tal registrar como foi o dia?" },
  },
];

export function UmDia() {
  return (
    <section id="um-dia" className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
      <SectionHeading
        index="03"
        eyebrow="Um dia no Touvie"
        title={
          <>
            Do bom-dia ao <span className="display-i gradient-text">boa-noite</span>.
          </>
        }
        lead="O sistema acompanha o seu dia — e te encontra na hora certa pelo Telegram, do primeiro café ao fechamento do mês."
      />

      <div className="mt-16 grid items-start gap-12 sm:grid-cols-3 sm:gap-7">
        {MOMENTS.map((m, i) => {
          const Ping = m.ping?.icon;
          return (
            <Reveal key={m.time} delay={i * 140}>
              <div className="flex items-baseline gap-3">
                <span className="display text-h1" style={{ color: "var(--color-accent)" }}>
                  {m.time}
                </span>
                <span className="eyebrow" style={{ color: "var(--color-fg-subtle)" }}>
                  {m.name}
                </span>
              </div>

              <div className="mt-5">{m.screen}</div>

              <p className="mt-5 text-sm leading-relaxed" style={{ color: "var(--color-fg-muted)" }}>
                {m.body}
              </p>

              {m.ping && Ping ? (
                <div
                  className="mt-4 flex items-start gap-2.5 rounded-xl px-3.5 py-2.5"
                  style={{
                    background: "color-mix(in srgb, var(--color-accent) 7%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 22%, transparent)",
                  }}
                >
                  <Send
                    size={13}
                    strokeWidth={1.75}
                    className="mt-0.5 shrink-0"
                    style={{ color: "var(--color-accent)" }}
                  />
                  <p className="text-[13px] leading-snug" style={{ color: "var(--color-fg-muted)" }}>
                    {m.ping.text}
                  </p>
                </div>
              ) : null}
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

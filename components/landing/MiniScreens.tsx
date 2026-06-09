import { CalendarCheck2, Check, Dumbbell, Lock, type LucideIcon, Wallet } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Mini-telas da landing — UIs em miniatura que falam o mesmo idioma glass do
 * app, sem screenshot real (o sandbox não captura bem) nem expor dados de
 * ninguém. Cada uma é estática e puramente decorativa (`aria-hidden`): serve de
 * "prova visual" do produto na seção "Um dia no Touvie". O texto da seção é que
 * carrega a informação acessível; estas telas são a ilustração.
 */

/** Moldura comum: card glass com uma barra de título (ícone + label mono). */
function MiniWindow({
  icon: Icon,
  title,
  trailing,
  children,
}: {
  icon: LucideIcon;
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" className="glass w-full select-none overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{
          borderBottom: "1px solid var(--color-border)",
          background: "color-mix(in srgb, var(--color-accent) 5%, transparent)",
        }}
      >
        <Icon size={14} strokeWidth={1.75} style={{ color: "var(--color-accent)" }} />
        <span
          className="font-mono text-[11px] tracking-[0.06em]"
          style={{ color: "var(--color-fg-muted)" }}
        >
          {title}
        </span>
        {trailing ? <span className="ml-auto">{trailing}</span> : null}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ── Rotina (manhã) — hábitos do dia, alguns já marcados ─────────────────── */
const HABITS = [
  { label: "Beber água", done: true },
  { label: "Treino 7h", done: true },
  { label: "Ler 20 min", done: false },
  { label: "Journaling", done: false },
];

export function MiniRotina() {
  const done = HABITS.filter((h) => h.done).length;
  return (
    <MiniWindow
      icon={CalendarCheck2}
      title="Rotina · hoje"
      trailing={
        <span className="font-mono text-[11px]" style={{ color: "var(--color-accent)" }}>
          {done}/{HABITS.length}
        </span>
      }
    >
      <ul className="flex flex-col gap-2.5">
        {HABITS.map((h) => (
          <li key={h.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px]"
              style={
                h.done
                  ? { background: "var(--color-accent)" }
                  : { border: "1.5px solid var(--color-border)" }
              }
            >
              {h.done ? (
                <Check size={11} strokeWidth={3} style={{ color: "var(--color-bg)" }} />
              ) : null}
            </span>
            <span
              style={{
                color: h.done ? "var(--color-fg-subtle)" : "var(--color-fg)",
                textDecoration: h.done ? "line-through" : "none",
              }}
            >
              {h.label}
            </span>
          </li>
        ))}
      </ul>
    </MiniWindow>
  );
}

/* ── Finanças (tarde) — mini-gráfico do mês + dois lançamentos ───────────── */
const BARS = [
  { m: "jan", h: 42 },
  { m: "fev", h: 66 },
  { m: "mar", h: 38 },
  { m: "abr", h: 82 },
  { m: "mai", h: 54 },
  { m: "jun", h: 73 },
];
const TX = [
  { label: "Mercado", val: "− R$ 84", up: false },
  { label: "Salário", val: "+ R$ 3.200", up: true },
];

export function MiniFinancas() {
  return (
    <MiniWindow
      icon={Wallet}
      title="Finanças · junho"
      trailing={
        <span className="font-mono text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
          R$ 4.812
        </span>
      }
    >
      <div className="mb-3 flex h-16 items-end gap-1.5">
        {BARS.map((b) => (
          <div
            key={b.m}
            className="flex-1 rounded-t-sm"
            style={{
              height: `${b.h}%`,
              background:
                "linear-gradient(180deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 25%, transparent))",
              opacity: 0.35 + b.h / 220,
            }}
          />
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {TX.map((t) => (
          <li key={t.label} className="flex items-center justify-between">
            <span style={{ color: "var(--color-fg-muted)" }}>{t.label}</span>
            <span
              className="font-mono text-[12px]"
              style={{ color: t.up ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {t.val}
            </span>
          </li>
        ))}
      </ul>
    </MiniWindow>
  );
}

/* ── Treino (tarde, alternativa) — exercícios com séries e um PR ─────────── */
const LIFTS = [
  { name: "Supino reto", load: "60 kg", sets: 4 },
  { name: "Supino inclinado", load: "24 kg", sets: 3 },
  { name: "Crucifixo", load: "14 kg", sets: 3 },
];

export function MiniTreino() {
  return (
    <MiniWindow
      icon={Dumbbell}
      title="Treino · peito"
      trailing={
        <span
          className="rounded-full px-1.5 py-0.5 font-mono text-[9px] tracking-[0.1em]"
          style={{
            color: "var(--color-accent)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
          }}
        >
          PR
        </span>
      }
    >
      <ul className="flex flex-col gap-3 text-sm">
        {LIFTS.map((l) => (
          <li key={l.name}>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--color-fg)" }}>{l.name}</span>
              <span className="font-mono text-[12px]" style={{ color: "var(--color-accent)" }}>
                {l.load}
              </span>
            </div>
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: l.sets }, (_, i) => `${l.name}-${i}`).map((id) => (
                <span
                  key={id}
                  className="h-1.5 flex-1 rounded-full"
                  style={{ background: "color-mix(in srgb, var(--color-accent) 55%, transparent)" }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </MiniWindow>
  );
}

/* ── Diário (noite) — texto borrado sob cadeado, a privacidade como imagem ─ */
const DIARY_LINES = [92, 78, 88, 64];

export function MiniDiario() {
  return (
    <MiniWindow
      icon={Lock}
      title="Diário · 9 jun"
      trailing={
        <span className="font-mono text-[10px]" style={{ color: "var(--color-accent)" }}>
          PIN
        </span>
      }
    >
      <div className="flex flex-col gap-2.5">
        {DIARY_LINES.map((w) => (
          <div
            key={w}
            className="h-2 rounded-full"
            style={{
              width: `${w}%`,
              background: "color-mix(in srgb, var(--color-fg) 16%, transparent)",
              filter: "blur(2px)",
            }}
          />
        ))}
      </div>
      <p
        className="mt-3.5 flex items-center gap-1.5 text-[11px]"
        style={{ color: "var(--color-fg-subtle)" }}
      >
        <Lock size={11} strokeWidth={1.75} />
        Protegido — leitura por PIN
      </p>
    </MiniWindow>
  );
}

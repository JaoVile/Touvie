import { cn } from "@/lib/utils";
import {
  BellPlus,
  CalendarCheck2,
  Check,
  Dumbbell,
  Lock,
  type LucideIcon,
  Pin,
  Salad,
  Sparkles,
  StickyNote,
  Target,
  Wallet,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

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
/**
 * `becomes` marca o hábito que se completa DIANTE de quem está lendo, quando a
 * seção entra na tela. Ele é renderizado no estado FINAL (marcado): assim, sem
 * JS ou com reduced-motion, a tela continua coerente — a animação só existe
 * quando o <PlayOnView> liga o data-playing, e aí ela parte do estado vazio.
 */
const HABITS = [
  { label: "Beber água", done: true },
  { label: "Treino 7h", done: true },
  { label: "Ler 20 min", done: true, becomes: true },
  { label: "Journaling", done: false },
];

export function MiniRotina() {
  const done = HABITS.filter((h) => h.done).length;
  return (
    <MiniWindow
      icon={CalendarCheck2}
      title="Rotina · hoje"
      trailing={
        // Duas leituras empilhadas: a de antes some quando o hábito é marcado.
        <span
          className="relative grid font-mono text-[11px]"
          style={{ color: "var(--color-accent)" }}
        >
          <span className="mini-count-after col-start-1 row-start-1">
            {done}/{HABITS.length}
          </span>
          <span className="mini-count-before col-start-1 row-start-1" aria-hidden="true">
            {done - 1}/{HABITS.length}
          </span>
        </span>
      }
    >
      <ul className="flex flex-col gap-2.5">
        {HABITS.map((h) => (
          <li key={h.label} className="flex items-center gap-2.5 text-sm">
            <span
              className={cn(
                "grid h-4 w-4 shrink-0 place-items-center rounded-[5px]",
                h.becomes && "mini-check",
              )}
              style={
                h.done
                  ? { background: "var(--color-accent)" }
                  : { border: "1.5px solid var(--color-border)" }
              }
            >
              {h.done ? (
                <Check
                  size={11}
                  strokeWidth={3}
                  className={h.becomes ? "mini-check-icon" : undefined}
                  style={{ color: "var(--color-bg)" }}
                />
              ) : null}
            </span>
            <span
              className={h.becomes ? "mini-habit-label" : undefined}
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
              {Array.from({ length: l.sets }, (_, i) => `${l.name}-${i}`).map((id, i) => (
                <span
                  key={id}
                  className="mini-bar h-1.5 flex-1 rounded-full"
                  // --i escalona o preenchimento: as séries enchem uma após a
                  // outra, como quem loga o treino set a set.
                  style={
                    {
                      background: "color-mix(in srgb, var(--color-accent) 55%, transparent)",
                      "--i": i,
                    } as CSSProperties
                  }
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

/* ── Notas (cards fixáveis com tags) — espelha /notas ────────────────────── */
const NOTES = [
  {
    title: "Ideia de produto",
    body: "Plugar o Vie nos lembretes pra…",
    tags: ["vie", "ideias"],
    pin: true,
  },
  {
    title: "Lista de leitura",
    body: "Atomic Habits · Deep Work · Ess…",
    tags: ["livros"],
    pin: false,
  },
];

export function MiniNotas() {
  return (
    <MiniWindow
      icon={StickyNote}
      title="Notas"
      trailing={
        <span className="font-mono text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
          2 · 1 fixada
        </span>
      }
    >
      <ul className="flex flex-col gap-2.5">
        {NOTES.map((n) => (
          <li
            key={n.title}
            className="rounded-lg border p-2.5"
            style={{
              borderColor: "var(--color-border)",
              background: "color-mix(in srgb, var(--color-fg) 3%, transparent)",
            }}
          >
            <div className="flex items-center gap-1.5">
              {n.pin ? <Pin size={11} style={{ color: "var(--color-accent)" }} /> : null}
              <span className="text-sm" style={{ color: "var(--color-fg)" }}>
                {n.title}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--color-fg-subtle)" }}>
              {n.body}
            </p>
            <div className="mt-1.5 flex gap-1">
              {n.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full px-1.5 py-0.5 text-[10px]"
                  style={{
                    color: "var(--color-accent)",
                    border: "1px solid color-mix(in srgb, var(--color-accent) 35%, transparent)",
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </MiniWindow>
  );
}

/* ── Metas + tarefas — espelha /metas ────────────────────────────────────── */
const GOALS = [
  { t: "Correr 5km sem parar", due: "30 set" },
  { t: "Ler 12 livros no ano", due: "dez" },
];
const META_TASKS = [
  { t: "Estudar 1h de inglês", done: true },
  { t: "Revisar orçamento do mês", done: false },
];

export function MiniMetas() {
  return (
    <MiniWindow icon={Target} title="Metas">
      <ul className="flex flex-col gap-2">
        {GOALS.map((g) => (
          <li key={g.t} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2" style={{ color: "var(--color-fg)" }}>
              <Target size={12} style={{ color: "var(--color-accent)" }} />
              {g.t}
            </span>
            <span className="font-mono text-[11px]" style={{ color: "var(--color-fg-subtle)" }}>
              {g.due}
            </span>
          </li>
        ))}
      </ul>
      <div className="my-3 h-px" style={{ background: "var(--color-border)" }} />
      <ul className="flex flex-col gap-2 text-sm">
        {META_TASKS.map((t) => (
          <li key={t.t} className="flex items-center gap-2.5">
            <span
              className="grid h-4 w-4 shrink-0 place-items-center rounded-[5px]"
              style={
                t.done
                  ? { background: "var(--color-accent)" }
                  : { border: "1.5px solid var(--color-border)" }
              }
            >
              {t.done ? (
                <Check size={11} strokeWidth={3} style={{ color: "var(--color-bg)" }} />
              ) : null}
            </span>
            <span
              style={{
                color: t.done ? "var(--color-fg-subtle)" : "var(--color-fg)",
                textDecoration: t.done ? "line-through" : "none",
              }}
            >
              {t.t}
            </span>
          </li>
        ))}
      </ul>
    </MiniWindow>
  );
}

/* ── Lembretes — compositor + prévia no Telegram (espelha ReminderComposer) ─ */
export function MiniLembretes() {
  return (
    <MiniWindow icon={BellPlus} title="Lembrete">
      <div
        className="rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--color-border)", color: "var(--color-fg)" }}
      >
        Hora de beber 400ml de água
      </div>
      <div className="mt-2">
        <span
          className="inline-block rounded-full px-2 py-0.5 text-[11px]"
          style={{
            color: "var(--color-accent)",
            border: "1px solid color-mix(in srgb, var(--color-accent) 40%, transparent)",
          }}
        >
          Todo dia · 08:00
        </span>
      </div>
      <div className="mt-3 rounded-xl p-2.5" style={{ background: "#0e1621" }}>
        <div
          className="max-w-[85%] rounded-2xl rounded-bl-sm px-2.5 py-1.5"
          style={{ background: "#182533" }}
        >
          <p className="text-[11px] font-semibold" style={{ color: "#6ab3f3" }}>
            Touvie
          </p>
          <p className="mt-0.5 text-[13px]" style={{ color: "#fff" }}>
            🔔 Hora de beber 400ml de água
          </p>
        </div>
      </div>
    </MiniWindow>
  );
}

/* ── Dieta — macros do dia + refeições — espelha /dieta ──────────────────── */
const MACROS = [
  { k: "Proteína", v: 72 },
  { k: "Carbo", v: 58 },
  { k: "Gordura", v: 40 },
];
const MEALS = [
  { name: "Café da manhã", item: "Ovos + aveia · 420 kcal" },
  { name: "Almoço", item: "Frango, arroz e salada · 680 kcal" },
];

export function MiniDieta() {
  return (
    <MiniWindow
      icon={Salad}
      title="Dieta · hoje"
      trailing={
        <span className="font-mono text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
          1.840 kcal
        </span>
      }
    >
      <div className="mb-3 flex flex-col gap-1.5">
        {MACROS.map((m, i) => (
          <div key={m.k} className="flex items-center gap-2">
            <span className="w-16 text-[11px]" style={{ color: "var(--color-fg-subtle)" }}>
              {m.k}
            </span>
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: "var(--color-border)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${m.v}%`,
                  background: `color-mix(in srgb, var(--color-accent) ${90 - i * 28}%, transparent)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {MEALS.map((m) => (
          <li key={m.name} className="flex flex-col">
            <span style={{ color: "var(--color-fg)" }}>{m.name}</span>
            <span className="text-[12px]" style={{ color: "var(--color-fg-subtle)" }}>
              {m.item}
            </span>
          </li>
        ))}
      </ul>
    </MiniWindow>
  );
}

/* ── Vie — o agente de IA em conversa (a Busca que virou IA) ─────────────── */
export function MiniVie() {
  return (
    <MiniWindow icon={Sparkles} title="Vie">
      <div className="flex flex-col gap-2.5">
        <div
          className="self-end rounded-2xl rounded-br-sm px-3 py-1.5 text-[13px]"
          style={{
            background: "color-mix(in srgb, var(--color-accent) 16%, transparent)",
            color: "var(--color-fg)",
          }}
        >
          Quanto gastei esse mês?
        </div>
        <div className="flex items-start gap-2">
          <Sparkles
            size={14}
            className="mt-0.5 shrink-0"
            style={{ color: "var(--color-accent)" }}
          />
          <p className="text-[13px] leading-snug" style={{ color: "var(--color-fg-muted)" }}>
            Você gastou <span style={{ color: "var(--color-fg)" }}>R$ 1.240</span> em junho — 18% a
            menos que maio. O maior foi mercado.
          </p>
        </div>
      </div>
    </MiniWindow>
  );
}

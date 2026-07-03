"use client";

import { type ReminderSchedule, describeSchedule } from "@/lib/reminders";
import { BellPlus, CalendarDays, Clock, type LucideIcon, Repeat, Send, Trash2 } from "lucide-react";
import { type CSSProperties, useEffect, useState, useTransition } from "react";
import {
  type ReminderRow,
  createReminder,
  deleteReminder,
  listReminders,
  sendTestReminder,
  toggleReminder,
} from "./actions";

/** Sugestão de molde contextual da área (vira o texto do lembrete ao clicar). */
export type ReminderSuggestion = { emoji: string; message: string };

type TriggerType = ReminderSchedule["type"];

// Semana começando na segunda (padrão BR); `d` segue 0=Dom … 6=Sáb.
const WEEKDAYS: { d: number; label: string; full: string }[] = [
  { d: 1, label: "S", full: "Segunda" },
  { d: 2, label: "T", full: "Terça" },
  { d: 3, label: "Q", full: "Quarta" },
  { d: 4, label: "Q", full: "Quinta" },
  { d: 5, label: "S", full: "Sexta" },
  { d: 6, label: "S", full: "Sábado" },
  { d: 0, label: "D", full: "Domingo" },
];

const TRIGGERS: { id: TriggerType; label: string; icon: LucideIcon }[] = [
  { id: "daily", label: "Todo dia", icon: Clock },
  { id: "weekly", label: "Dias da semana", icon: CalendarDays },
  { id: "interval", label: "A cada X horas", icon: Repeat },
];

const inputCls = "rounded-lg border px-3 py-2 text-sm outline-none";
const inputStyle: CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
  color: "var(--color-fg)",
};
const cardStyle: CSSProperties = {
  background: "var(--color-card)",
  borderColor: "var(--color-border)",
};

/**
 * Molde reutilizável de "criar lembrete" — mensagem + quando disparar — com
 * prévia do Telegram, botão de teste (dispara na hora) e a lista do que já
 * foi cadastrado. Persiste no Supabase (user_reminders) via server actions; o
 * disparo agendado é feito pelo cron-mestre. Cada área passa suas `suggestions`.
 */
export function ReminderComposer({
  area,
  suggestions = [],
}: {
  area: string;
  suggestions?: ReminderSuggestion[];
}) {
  const [message, setMessage] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("daily");
  const [time, setTime] = useState("08:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [everyHours, setEveryHours] = useState(2);
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("20:00");
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [mutating, startMutate] = useTransition();
  const [testing, startTest] = useTransition();
  const [testFeedback, setTestFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listReminders(area).then((res) => {
      if (!alive) return;
      if (res.ok) {
        setReminders(res.reminders ?? []);
        setLoadError(null);
      } else {
        setLoadError(res.error ?? "Erro ao carregar.");
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [area]);

  async function reload() {
    const res = await listReminders(area);
    if (res.ok) {
      setReminders(res.reminders ?? []);
      setLoadError(null);
    } else {
      setLoadError(res.error ?? "Erro ao carregar.");
    }
  }

  const canCreate = message.trim().length > 0 && (trigger !== "weekly" || days.length > 0);
  // Horário que aparece na bolha da prévia (intervalo usa o início da janela).
  const previewTime = trigger === "interval" ? from : time;

  function currentSchedule(): ReminderSchedule {
    return trigger === "daily"
      ? { type: "daily", time }
      : trigger === "weekly"
        ? { type: "weekly", days: [...days].sort((a, b) => a - b), time }
        : { type: "interval", everyHours, from, to };
  }

  function create() {
    if (!canCreate) return;
    setCreateError(null);
    startMutate(async () => {
      const res = await createReminder({
        area,
        message: message.trim(),
        schedule: currentSchedule(),
      });
      if (res.ok) {
        setMessage("");
        await reload();
      } else {
        setCreateError(res.error ?? "Falhou.");
      }
    });
  }

  function sendTest() {
    const text = message.trim();
    if (!text) return;
    setTestFeedback(null);
    startTest(async () => {
      const res = await sendTestReminder(text);
      setTestFeedback(
        res.ok
          ? { ok: true, msg: "Enviado! Confere o seu Telegram 📲" }
          : { ok: false, msg: res.error ?? "Não consegui enviar." },
      );
    });
  }

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }
  function toggleActive(id: string, active: boolean) {
    startMutate(async () => {
      await toggleReminder(id, !active);
      await reload();
    });
  }
  function remove(id: string) {
    startMutate(async () => {
      await deleteReminder(id);
      await reload();
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Compositor ───────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={cardStyle}>
        <div className="mb-4 flex items-center gap-2">
          <BellPlus size={16} style={{ color: "var(--color-accent)" }} />
          <h3
            className="text-label font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-fg)" }}
          >
            Criar lembrete
          </h3>
        </div>

        {suggestions.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                type="button"
                key={s.message}
                onClick={() => setMessage(s.message)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition hover:opacity-80"
                style={{ borderColor: "var(--color-border)", color: "var(--color-fg-muted)" }}
              >
                <span aria-hidden="true">{s.emoji}</span>
                {s.message}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mb-4">
          <label
            htmlFor="reminder-message"
            className="mb-1.5 block text-xs"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Mensagem
          </label>
          <input
            id="reminder-message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={140}
            placeholder="O que você quer ser lembrado?"
            className={`${inputCls} w-full`}
            style={inputStyle}
          />
        </div>

        <span className="mb-1.5 block text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          Quando disparar
        </span>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {TRIGGERS.map((t) => {
            const active = t.id === trigger;
            const Icon = t.icon;
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTrigger(t.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
                style={{
                  background: active
                    ? "color-mix(in srgb, var(--color-accent) 14%, transparent)"
                    : "transparent",
                  borderColor: active ? "var(--color-accent)" : "var(--color-border)",
                  color: active ? "var(--color-accent)" : "var(--color-fg-muted)",
                }}
              >
                <Icon size={13} strokeWidth={1.75} />
                {t.label}
              </button>
            );
          })}
        </div>

        {trigger === "daily" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
              às
            </span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>
        ) : trigger === "weekly" ? (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              {WEEKDAYS.map((w) => {
                const on = days.includes(w.d);
                return (
                  <button
                    type="button"
                    key={w.d}
                    title={w.full}
                    onClick={() => toggleDay(w.d)}
                    className="grid h-9 w-9 place-items-center rounded-full border text-xs font-semibold transition"
                    style={{
                      background: on ? "var(--gradient-brand)" : "transparent",
                      borderColor: on ? "transparent" : "var(--color-border)",
                      color: on ? "var(--color-bg)" : "var(--color-fg-muted)",
                    }}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
                às
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>
        ) : (
          <div
            className="flex flex-wrap items-center gap-2 text-xs"
            style={{ color: "var(--color-fg-muted)" }}
          >
            <span>a cada</span>
            <select
              value={everyHours}
              onChange={(e) => setEveryHours(Number(e.target.value))}
              className={inputCls}
              style={inputStyle}
            >
              {[1, 2, 3, 4, 6, 8].map((h) => (
                <option key={h} value={h}>
                  {h}h
                </option>
              ))}
            </select>
            <span>das</span>
            <input
              type="time"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
            <span>às</span>
            <input
              type="time"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
              style={inputStyle}
            />
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={create}
            disabled={!canCreate || mutating}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
            style={{ background: "var(--gradient-brand)", color: "var(--color-bg)" }}
          >
            <BellPlus size={15} strokeWidth={2} />
            {mutating ? "Salvando…" : "Criar lembrete"}
          </button>
          <button
            type="button"
            onClick={sendTest}
            disabled={testing || message.trim().length === 0}
            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-40"
            style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)" }}
          >
            <Send size={14} strokeWidth={2} />
            {testing ? "Enviando…" : "Testar agora"}
          </button>
        </div>
        {createError ? (
          <p className="mt-2 text-xs font-medium" style={{ color: "var(--color-danger)" }}>
            {createError}
          </p>
        ) : testFeedback ? (
          <p
            className="mt-2 text-xs font-medium"
            style={{ color: testFeedback.ok ? "var(--color-success)" : "var(--color-danger)" }}
          >
            {testFeedback.msg}
          </p>
        ) : (
          <p
            className="mt-2 inline-flex items-center gap-1.5 text-xs"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            <Send size={11} />
            Testar agora manda já no seu Telegram. O disparo no horário entra com o cron.
          </p>
        )}
      </div>

      {/* ── Prévia no Telegram ───────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={cardStyle}>
        <div className="mb-4 flex items-center gap-2">
          <Send size={16} style={{ color: "var(--color-accent)" }} />
          <h3
            className="text-label font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--color-fg)" }}
          >
            Prévia no Telegram
          </h3>
        </div>
        {/* Mini-chat fiel ao Telegram dark — bolha recebida do bot. */}
        <div className="rounded-xl p-4" style={{ background: "#0e1621" }}>
          <div className="flex">
            <div
              className="max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2"
              style={{ background: "#182533" }}
            >
              <p className="text-[13px] font-semibold" style={{ color: "#6ab3f3" }}>
                Touvie
              </p>
              <p
                className="mt-0.5 whitespace-pre-wrap text-sm leading-snug"
                style={{ color: "#ffffff" }}
              >
                🔔 {message.trim() || "Sua mensagem aparece aqui…"}
              </p>
              <p className="mt-1 text-right text-[11px]" style={{ color: "#6d7f8f" }}>
                {previewTime}
              </p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          {describeSchedule(currentSchedule())}
        </p>
      </div>

      {/* ── Lista ────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={cardStyle}>
        <h3
          className="mb-4 text-label font-semibold uppercase tracking-[0.12em]"
          style={{ color: "var(--color-fg)" }}
        >
          Seus lembretes
          {reminders.length > 0 ? (
            <span style={{ color: "var(--color-fg-subtle)" }}> · {reminders.length}</span>
          ) : null}
        </h3>
        {loading ? (
          <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            Carregando…
          </p>
        ) : loadError ? (
          <p className="text-sm" style={{ color: "var(--color-danger)" }}>
            ⚠️ {loadError}
          </p>
        ) : reminders.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            Nenhum lembrete por aqui ainda. Crie o primeiro acima.
          </p>
        ) : (
          <ul className="space-y-2">
            {reminders.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                style={{ borderColor: "var(--color-border)", opacity: r.active ? 1 : 0.55 }}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" style={{ color: "var(--color-fg)" }}>
                    {r.message}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
                    {describeSchedule(r.schedule)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(r.id, r.active)}
                    disabled={mutating}
                    className="rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition disabled:opacity-50"
                    style={{
                      borderColor: r.active
                        ? "color-mix(in srgb, var(--color-success) 50%, transparent)"
                        : "var(--color-border)",
                      color: r.active ? "var(--color-success)" : "var(--color-fg-subtle)",
                    }}
                  >
                    {r.active ? "ativo" : "pausado"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={mutating}
                    aria-label="Excluir lembrete"
                    className="rounded-lg p-1.5 transition hover:opacity-70 disabled:opacity-50"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

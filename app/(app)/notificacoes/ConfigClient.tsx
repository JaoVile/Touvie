"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { useTransition, useState } from "react";
import { registerWebhook, unregisterWebhook, type WebhookStatus } from "./actions";

const CRON_SCHEDULE = [
  { label: "Treino", path: "/api/cron/training-reminder", schedule: "06:30 BRT todos os dias" },
  { label: "Lembrete matinal", path: "/api/cron/daily-reminders", schedule: "07:00 BRT todos os dias" },
  { label: "Ponto — Entrada manhã", path: "/api/cron/work-clock?type=clock-in-morning", schedule: "08:30 BRT seg–sex" },
  { label: "Ponto — Saída almoço", path: "/api/cron/work-clock?type=lunch-break", schedule: "12:00 BRT seg–sex" },
  { label: "Ponto — Entrada tarde", path: "/api/cron/work-clock?type=clock-in-afternoon", schedule: "13:00 BRT seg–sex" },
  { label: "Ponto — Saída", path: "/api/cron/work-clock?type=clock-out", schedule: "17:30 BRT seg–sex" },
  { label: "Lembrete noturno", path: "/api/cron/evening-reminders", schedule: "20:00 BRT todos os dias" },
];

export function ConfigClient({ webhookStatus }: { webhookStatus: WebhookStatus | null }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(webhookStatus);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function handleRegister() {
    startTransition(async () => {
      const res = await registerWebhook();
      if (res.ok) {
        setStatus((s) => ({ ...(s ?? { pending_update_count: 0 }), url: res.url }));
        setFeedback({ ok: true, msg: `Webhook registrado: ${res.url}` });
      } else {
        setFeedback({ ok: false, msg: res.error ?? "Erro desconhecido" });
      }
      setTimeout(() => setFeedback(null), 5000);
    });
  }

  function handleUnregister() {
    startTransition(async () => {
      const res = await unregisterWebhook();
      if (res.ok) {
        setStatus((s) => (s ? { ...s, url: "" } : null));
        setFeedback({ ok: true, msg: "Webhook removido." });
      } else {
        setFeedback({ ok: false, msg: res.error ?? "Erro desconhecido" });
      }
      setTimeout(() => setFeedback(null), 5000);
    });
  }

  const webhookActive = !!status?.url;

  return (
    <div className="space-y-4">
      {/* Webhook */}
      <GlassCard>
        <h3 className="mb-3 font-semibold">🤖 Webhook do Telegram</h3>

        <div className="mb-3 rounded-lg p-3 text-sm space-y-1" style={{ background: "var(--color-surface)" }}>
          <div className="flex items-center gap-2">
            <span className={`rounded-full w-2 h-2 shrink-0 ${webhookActive ? "bg-green-500" : "bg-zinc-500"}`} />
            <span className="opacity-60">Status:</span>
            <span className="font-medium">{webhookActive ? "Registrado" : "Não registrado"}</span>
          </div>
          {status?.url && (
            <div className="flex gap-2">
              <span className="opacity-60 shrink-0">URL:</span>
              <span className="font-mono text-xs break-all">{status.url}</span>
            </div>
          )}
          {status?.pending_update_count != null && status.pending_update_count > 0 && (
            <div className="flex gap-2">
              <span className="opacity-60">Fila:</span>
              <span>{status.pending_update_count} update(s) pendente(s)</span>
            </div>
          )}
          {status?.last_error_message && (
            <div className="flex gap-2 text-red-400">
              <span className="shrink-0">Último erro:</span>
              <span className="text-xs">{status.last_error_message}</span>
            </div>
          )}
        </div>

        {feedback && (
          <div
            className={`mb-3 rounded-lg p-3 text-sm ${feedback.ok ? "text-green-400" : "text-red-400"}`}
            style={{ background: "var(--color-surface)" }}
          >
            {feedback.msg}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleRegister}
            disabled={isPending}
            className="rounded-lg px-4 py-2 text-sm font-medium gradient-brand text-white disabled:opacity-50"
          >
            {isPending ? "Aguarde…" : webhookActive ? "Re-registrar webhook" : "Registrar webhook"}
          </button>
          {webhookActive && (
            <button
              type="button"
              onClick={handleUnregister}
              disabled={isPending}
              className="rounded-lg px-4 py-2 text-sm font-medium opacity-60 hover:opacity-80 disabled:opacity-30"
            >
              Remover
            </button>
          )}
        </div>

        <p className="mt-2 text-xs opacity-40">
          Comandos do bot: /start · /stop · /ping · /gasto · /receita · /saldo
        </p>
      </GlassCard>

      {/* Crons */}
      <GlassCard>
        <h3 className="mb-3 font-semibold">⏱️ Crons configurados</h3>
        <div className="space-y-2">
          {CRON_SCHEDULE.map((c) => (
            <div
              key={c.path}
              className="rounded-lg p-3 text-sm"
              style={{ background: "var(--color-surface)" }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{c.label}</span>
                <span className="text-xs opacity-60 shrink-0">{c.schedule}</span>
              </div>
              <p className="font-mono text-[10px] opacity-40 mt-0.5">{c.path}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs opacity-40">
          Horários em BRT (UTC-3). Os crons disparam automaticamente via Vercel.
        </p>
      </GlassCard>
    </div>
  );
}

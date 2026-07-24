"use client";

import { clearToubeHistory } from "@/app/(app)/toube/sessions-actions";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

/**
 * Uso do histórico do Toube + botão de limpeza total (confirmação em 2 passos,
 * mesmo padrão do DeleteAccountButton). Apaga toube_sessions do usuário;
 * toube_messages cai por cascade (FK 0030). Delete de sessão individual já
 * existe em app/(app)/toube (deleteSession) — este componente só cobre "tudo".
 */
export function ToubeHistoryManager({
  sessions,
  messages,
}: {
  sessions: number;
  messages: number;
}) {
  const t = useTranslations("config.histIa");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [isPending, start] = useTransition();

  const empty = sessions === 0 && messages === 0;

  function handleClear() {
    start(async () => {
      const res = await clearToubeHistory();
      if (res.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      setConfirming(false);
    });
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        {done ? t("cleared") : t("usage", { sessions, messages })}
      </p>

      {error && (
        <p className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={empty || done}
          className="w-fit rounded-lg border px-4 py-1.5 text-sm hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: "var(--color-danger)", color: "var(--color-danger)" }}
        >
          {t("clear")}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleClear}
            disabled={isPending}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "var(--color-danger)" }}
          >
            {isPending ? "…" : t("confirm")}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="rounded-lg border px-4 py-1.5 text-sm hover:opacity-80"
            style={{ borderColor: "var(--color-border)" }}
          >
            {t("cancel")}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startSession } from "./actions";

interface Props {
  programDayId: string | null;
  label: string;
}

export function StartSessionButton({ programDayId, label }: Props) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();

  function go() {
    setError(undefined);
    start(async () => {
      const res = await startSession(programDayId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--gradient-brand)" }}
      >
        {pending ? "…" : `▶︎ ${label}`}
      </button>
      {error ? (
        <span className="text-xs" style={{ color: "var(--color-danger)" }}>
          {error}
        </span>
      ) : null}
    </span>
  );
}

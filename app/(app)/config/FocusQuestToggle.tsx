"use client";

import { setFocusQuestEnabled } from "@/components/focus-quest/actions";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function FocusQuestToggle({ initial }: { initial: boolean }) {
  const t = useTranslations("focoDoDia");
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function pick(value: boolean) {
    if (busy || value === on) return;
    setOn(value);
    setBusy(true);
    const res = await setFocusQuestEnabled(value);
    setBusy(false);
    if (!res.ok) setOn(!value); // reverte se falhou
  }

  const options = [
    { on: true, label: t("enabledLabel") },
    { on: false, label: t("disabledLabel") },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => (
        <button
          type="button"
          key={o.label}
          onClick={() => pick(o.on)}
          disabled={busy}
          className={cn(
            "rounded-lg border p-3 text-left transition disabled:opacity-60",
            on === o.on ? "ring-2" : "hover:opacity-90",
          )}
          style={{
            background: "var(--color-card)",
            borderColor: on === o.on ? "var(--color-accent)" : "var(--color-border)",
            // @ts-expect-error ring-color custom property
            "--tw-ring-color": "var(--color-accent)",
          }}
        >
          <span className="font-semibold">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

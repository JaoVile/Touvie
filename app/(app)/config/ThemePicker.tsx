"use client";

import { THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { updateTheme } from "./actions";

export function ThemePicker({ currentTheme }: { currentTheme: string }) {
  const [selected, setSelected] = useState(currentTheme);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();

  function pick(id: ThemeId) {
    setSelected(id);
    setErr(undefined);
    document.documentElement.setAttribute("data-theme", id);
    start(async () => {
      const res = await updateTheme(id);
      if (res?.error) setErr(res.error);
    });
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        {THEMES.map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => pick(t.id)}
            disabled={pending}
            className={cn(
              "rounded-lg border p-3 text-left transition",
              selected === t.id ? "ring-2" : "hover:opacity-90",
            )}
            style={{
              background: "var(--color-card)",
              borderColor: selected === t.id ? "var(--color-accent)" : "var(--color-border)",
              // @ts-expect-error ring-color custom property
              "--tw-ring-color": "var(--color-accent)",
            }}
          >
            <ThemeSwatch themeId={t.id} />
            <div className="mt-2 flex items-center gap-2">
              <span className="font-semibold">{t.name}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] uppercase"
                style={{ background: "var(--color-card)", color: "var(--color-fg-subtle)" }}
              >
                {t.mode}
              </span>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--color-fg-muted)" }}>
              {t.description}
            </p>
          </button>
        ))}
      </div>
      {err ? (
        <p className="mt-2 text-xs" style={{ color: "var(--color-danger)" }}>
          {err}
        </p>
      ) : null}
    </>
  );
}

function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const presets: Record<ThemeId, { bg: string; accent: string; accent2: string }> = {
    "glass-purple": { bg: "#0a0618", accent: "#a855f7", accent2: "#ec4899" },
    "dark-minimal": { bg: "#0a0a0a", accent: "#22c55e", accent2: "#10b981" },
    "notion-clean": { bg: "#f7f6f3", accent: "#2b6cb0", accent2: "#2c5282" },
  };
  const p = presets[themeId];
  return (
    <div
      className="flex h-14 items-end gap-1 rounded p-2"
      style={{ background: p.bg, border: "1px solid var(--color-border)" }}
    >
      <div className="h-5 w-1/3 rounded" style={{ background: p.accent }} />
      <div className="h-3 w-1/4 rounded" style={{ background: p.accent2 }} />
      <div className="ml-auto h-2 w-8 rounded" style={{ background: "rgb(255 255 255 / 0.3)" }} />
    </div>
  );
}

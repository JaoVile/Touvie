"use client";

import { applyCustomColors, readCustomColors } from "@/lib/custom-colors";
import { PERSONALIZE_THEME, THEMES, type ThemeId } from "@/lib/themes";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { ColorCustomizer } from "./ColorCustomizer";
import { updateTheme } from "./actions";

export function ThemePicker({ currentTheme }: { currentTheme: string }) {
  const [selected, setSelected] = useState(currentTheme);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string>();

  function pick(id: ThemeId) {
    setSelected(id);
    setErr(undefined);
    document.documentElement.setAttribute("data-theme", id);
    // Custom colours only live on the Personalizar theme: re-apply the saved
    // palette when entering it, strip the inline overrides when leaving.
    if (id === PERSONALIZE_THEME) applyCustomColors(readCustomColors());
    else applyCustomColors({});
    start(async () => {
      const res = await updateTheme(id);
      if (res?.error) setErr(res.error);
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      {/* The Personalizar theme reveals the per-colour editor — building your
          own palette on top of the neutral base. */}
      {selected === PERSONALIZE_THEME ? (
        <div className="mt-5 border-t pt-5" style={{ borderColor: "var(--color-border)" }}>
          <h3
            className="text-eyebrow mb-3 uppercase tracking-[0.1em]"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            Suas cores
          </h3>
          <ColorCustomizer />
        </div>
      ) : null}
    </>
  );
}

function ThemeSwatch({ themeId }: { themeId: ThemeId }) {
  const presets: Record<ThemeId, { bg: string; accent: string; accent2: string }> = {
    royal: { bg: "#08112e", accent: "#e0b83e", accent2: "#3e5bb0" },
    "glass-purple": { bg: "#0a0618", accent: "#a855f7", accent2: "#ec4899" },
    "dark-minimal": { bg: "#0a0a0a", accent: "#22c55e", accent2: "#10b981" },
    personalize: { bg: "#ffffff", accent: "#4f46e5", accent2: "#7c3aed" },
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

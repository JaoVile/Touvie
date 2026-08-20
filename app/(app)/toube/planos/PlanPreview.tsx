"use client";
import type { Plan } from "@/lib/planos-draft";
import { useTranslations } from "next-intl";

export function PlanPreview({ plan }: { plan: Plan }) {
  const t = useTranslations("toube");
  const WD = t.raw("weekdays") as string[];

  if (!plan.days.length) {
    return (
      <p className="p-4 text-sm" style={{ color: "var(--color-fg-muted)" }}>
        {t("planEmpty")}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3 p-1">
      <h2 className="text-base font-semibold" style={{ color: "var(--color-fg)" }}>
        {plan.name || t("planUnnamed")}
      </h2>
      {plan.days.map((d, i) => (
        <div
          key={`${d.weekday}-${i}`}
          className="rounded-xl border p-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--color-accent)" }}>
            {WD[d.weekday]} · {d.name}
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {d.exercises.map((e, j) => (
              <li key={`${e.name}-${j}`} className="text-sm" style={{ color: "var(--color-fg)" }}>
                {e.name}
                {e.target_sets ? (
                  <span style={{ color: "var(--color-fg-muted)" }}>
                    {" "}
                    — {e.target_sets}×{e.reps_low ?? "?"}-{e.reps_high ?? "?"}
                  </span>
                ) : null}
              </li>
            ))}
            {!d.exercises.length ? (
              <li className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
                {t("planNoExercises")}
              </li>
            ) : null}
          </ul>
        </div>
      ))}
    </div>
  );
}

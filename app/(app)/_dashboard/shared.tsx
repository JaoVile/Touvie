import { Magnetic } from "@/components/Magnetic";
import { addDaysISO } from "@/lib/datetime";
import Link from "next/link";
import type { ReactNode } from "react";

export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <div className="mt-auto flex justify-end pt-4">
      <Magnetic strength={0.35} radius={70}>
        <Link
          href={href}
          className="group/lnk flex items-center gap-1 text-eyebrow font-semibold uppercase tracking-[0.1em] transition-colors"
          style={{ color: "var(--color-accent)" }}
        >
          <span className="link-underline">{children}</span>
          <span className="transition-transform group-hover/lnk:translate-x-0.5">→</span>
        </Link>
      </Magnetic>
    </div>
  );
}

export function EmptyState({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
      {children}{" "}
      <Link
        className="link-underline font-medium"
        href={href}
        style={{ color: "var(--color-accent)" }}
      >
        {label}
      </Link>
    </p>
  );
}

export function computeStreak(dates: Set<string>, today: string): number {
  let current = today;
  let streak = 0;
  if (!dates.has(current)) current = addDaysISO(current, -1);
  while (dates.has(current)) {
    streak++;
    current = addDaysISO(current, -1);
  }
  return streak;
}

export function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-success)";
  if (score >= 40) return "var(--color-accent)";
  return "var(--color-danger)";
}

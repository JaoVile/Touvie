"use client";

import { usePathname } from "next/navigation";

/**
 * Editorial wayfinder: a slim vertical label pinned to the left gutter,
 * reading bottom-to-top. Borrowed from the obsidianassembly playbook —
 * gives the canvas an "edition" feel. Tune here.
 */
const CONFIG = {
  fontSize: "0.7rem",
  letterSpacing: "0.3em",
  opacity: 0.55,
  edge: "0.75rem", // distance from viewport edge
} as const;

const SECTIONS: { prefix: string; label: string }[] = [
  { prefix: "/rotina", label: "ROTINA" },
  { prefix: "/metas", label: "METAS" },
  { prefix: "/diario", label: "DIÁRIO" },
  { prefix: "/financas", label: "FINANÇAS" },
  { prefix: "/treino", label: "TREINO" },
  { prefix: "/dieta", label: "DIETA" },
  { prefix: "/notas", label: "NOTAS" },
  { prefix: "/busca", label: "BUSCA" },
  { prefix: "/notificacoes", label: "NOTIFICAÇÕES" },
  { prefix: "/config", label: "CONFIG" },
  { prefix: "/sandbox", label: "SANDBOX" },
];

function sectionFor(pathname: string): string {
  if (pathname === "/") return "DASHBOARD";
  return SECTIONS.find((s) => pathname.startsWith(s.prefix))?.label ?? "TOUVIE";
}

export function SideLabel() {
  const pathname = usePathname();
  const section = sectionFor(pathname);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-y-0 z-30 hidden items-center 2xl:flex"
      style={{ left: CONFIG.edge }}
    >
      <span
        className="select-none font-mono font-semibold uppercase"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          color: "var(--color-fg-subtle)",
          fontSize: CONFIG.fontSize,
          letterSpacing: CONFIG.letterSpacing,
          opacity: CONFIG.opacity,
        }}
      >
        ✦&nbsp;&nbsp;{section}&nbsp;&nbsp;·&nbsp;&nbsp;Editorial&nbsp;·&nbsp;2026
      </span>
    </div>
  );
}

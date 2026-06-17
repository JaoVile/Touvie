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
  opacity: 0.7,
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
];

function sectionFor(pathname: string): string {
  if (pathname === "/") return "DASHBOARD";
  return SECTIONS.find((s) => pathname.startsWith(s.prefix))?.label ?? "TOUVIE";
}

export function SideLabel({ label }: { label?: string } = {}) {
  const pathname = usePathname();
  // A fixed label opts out of pathname mapping — the landing is served at
  // "/" too (middleware rewrite), where sectionFor would say "DASHBOARD".
  const section = label ?? sectionFor(pathname);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-y-0 z-30 hidden flex-col items-center justify-center gap-6 2xl:flex"
      style={{ left: CONFIG.edge, opacity: CONFIG.opacity }}
    >
      {/* Fio editorial — dourado desbotando pro topo. */}
      <span
        className="w-px flex-1"
        style={{
          maxHeight: "20vh",
          background:
            "linear-gradient(to bottom, transparent, color-mix(in srgb, var(--color-accent) 50%, transparent))",
        }}
      />
      <span
        className="select-none whitespace-nowrap font-mono font-semibold uppercase"
        style={{
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: CONFIG.fontSize,
          letterSpacing: CONFIG.letterSpacing,
        }}
      >
        <span style={{ color: "var(--color-accent)" }}>✦&nbsp;&nbsp;{section}</span>
        <span style={{ color: "var(--color-fg-subtle)" }}>
          &nbsp;&nbsp;·&nbsp;&nbsp;Editorial&nbsp;·&nbsp;2026
        </span>
      </span>
      {/* Fio editorial — dourado desbotando pro rodapé. */}
      <span
        className="w-px flex-1"
        style={{
          maxHeight: "20vh",
          background:
            "linear-gradient(to top, transparent, color-mix(in srgb, var(--color-accent) 50%, transparent))",
        }}
      />
    </div>
  );
}

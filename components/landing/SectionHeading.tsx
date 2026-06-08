import { Reveal } from "@/components/Reveal";
import type { ReactNode } from "react";

/**
 * Cabeçalho editorial de seção: índice numérico (mono) + eyebrow tracado com
 * hairline de ouro + título em serifa display + lead opcional. A numeração
 * dá a cadência de "capítulos" — o que puxa o ar refinado.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  index,
  align = "left",
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  index?: string;
  align?: "left" | "center";
}) {
  const center = align === "center";
  return (
    <Reveal>
      <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
        <p
          className={`eyebrow flex items-center gap-3 ${center ? "justify-center" : ""}`}
          style={{ color: "var(--color-fg-subtle)" }}
        >
          {index ? (
            <span className="font-mono" style={{ color: "var(--color-accent)", letterSpacing: "0.12em" }}>
              {index}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className="h-px w-7"
            style={{ background: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
          />
          {eyebrow}
        </p>
        <h2 className="display mt-4 text-h2 sm:text-display" style={{ color: "var(--color-fg)" }}>
          {title}
        </h2>
        {lead ? (
          <p className="mt-4 text-base sm:text-lg" style={{ color: "var(--color-fg-muted)" }}>
            {lead}
          </p>
        ) : null}
      </div>
    </Reveal>
  );
}

"use client";

import { Magnetic } from "@/components/Magnetic";
import { Marquee } from "@/components/Marquee";
import { Reveal } from "@/components/Reveal";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Seal } from "./Seal";

// Os módulos, na ordem em que viram a fita do rodapé da dobra.
const MODULES = ["rotina", "metas", "finanças", "treino", "diário", "dieta", "notas"];

/**
 * Hero "selo central, cerimonial" — primeira dobra da landing. Simétrico e
 * solene: o selo girando no centro, manifesto em serifa editorial, dois CTAs
 * e a fita dos módulos no rodapé. Entrada em cascata via <Reveal> (mesma
 * linguagem de motion do app); o cursor-fita vive no layout público.
 *
 * Layout à prova de altura: a seção é `min-h-[100svh]` em coluna — o conteúdo
 * ocupa o miolo (flex-1, centrado) e a fita assenta no rodapé EM FLUXO (não
 * absoluta), então nada se sobrepõe nem é cortado em janelas mais baixas. O
 * brilho fica num container próprio com `overflow-hidden` pra clipar só ele,
 * nunca o conteúdo.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col">
      {/* Brilho de ouro difuso atrás do selo — clipado ao próprio container
          pra não vazar scroll nem cortar o conteúdo. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute left-1/2 top-[38%] h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, transparent 62%)",
          }}
        />
      </div>

      {/* Miolo — ocupa o espaço disponível e centra vertical/horizontal. */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <Reveal>
          <Seal size={132} />
        </Reveal>

        <Reveal delay={140} className="mt-8">
          <p
            className="eyebrow flex items-center justify-center gap-3"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            <span
              aria-hidden="true"
              className="h-px w-7"
              style={{ background: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
            />
            Life OS pessoal
            <span
              aria-hidden="true"
              className="h-px w-7"
              style={{ background: "color-mix(in srgb, var(--color-accent) 60%, transparent)" }}
            />
          </p>
        </Reveal>

        <Reveal delay={240} className="mt-5">
          <h1 className="display text-display lg:text-hero" style={{ color: "var(--color-fg)" }}>
            Tudo da sua vida,
            <br />
            <span className="display-i gradient-text">em um só lugar.</span>
          </h1>
        </Reveal>

        <Reveal delay={360} className="mt-6">
          <p
            className="mx-auto max-w-[44ch] text-base sm:text-lg"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Rotina, finanças, treino, diário e mais — um sistema que te conhece.
          </p>
        </Reveal>

        <Reveal delay={480} className="mt-10">
          <div className="flex items-center justify-center gap-6">
            <Magnetic strength={0.45} radius={90}>
              <Link
                href="/login"
                className="gradient-brand inline-flex items-center rounded-full px-7 py-3 text-sm font-semibold transition-shadow duration-300 hover:shadow-[0_12px_34px_rgba(224,184,62,0.30)]"
                style={{ color: "var(--color-bg)" }}
              >
                Entrar
              </Link>
            </Magnetic>
            <button
              type="button"
              onClick={() =>
                document.getElementById("manifesto")?.scrollIntoView({ behavior: "smooth" })
              }
              className="group/lnk inline-flex items-center gap-1.5 text-sm"
              style={{ color: "var(--color-fg-muted)" }}
            >
              <span className="link-underline">conhecer</span>
              <span
                aria-hidden="true"
                className="transition-transform group-hover/lnk:translate-y-0.5"
              >
                ↓
              </span>
            </button>
          </div>
        </Reveal>
      </div>

      {/* Fita dos módulos — em fluxo no rodapé, com bordas que desbotam. */}
      <Reveal delay={620} className="pb-10">
        <Marquee
          duration={36}
          repeat={3}
          className="eyebrow"
          style={
            {
              color: "var(--color-fg-subtle)",
              opacity: 0.55,
              "--marquee-fade": "clamp(4rem, 18vw, 22rem)",
            } as CSSProperties
          }
        >
          {MODULES.map((m) => (
            <span key={m} className="inline-flex items-center gap-3">
              {m}
              <span aria-hidden="true" style={{ color: "var(--color-accent)" }}>
                ·
              </span>
            </span>
          ))}
        </Marquee>
      </Reveal>
    </section>
  );
}

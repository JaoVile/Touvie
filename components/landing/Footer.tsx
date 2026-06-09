import { TouvieLogo } from "@/components/brand/TouvieLogo";
import Link from "next/link";

/**
 * Seção 7 — Footer minimal e editorial: monograma + tagline à esquerda,
 * links no meio, copyright em mono à direita.
 */
export function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: "var(--color-border)" }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
        <div className="flex items-center gap-3">
          <TouvieLogo emblem size={46} alt="" />
          <div>
            <p className="font-semibold" style={{ color: "var(--color-fg)" }}>
              Touvie
            </p>
            <p className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
              Seu sistema. Sua vida. Todo dia.
            </p>
          </div>
        </div>

        <nav className="flex items-center gap-6 text-sm" style={{ color: "var(--color-fg-muted)" }}>
          <Link href="/login" className="group/lnk">
            <span className="link-underline">Entrar</span>
          </Link>
          <a href="#top" className="group/lnk">
            <span className="link-underline">Topo</span>
          </a>
        </nav>

        <p className="font-mono text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          © 2026 Touvie
        </p>
      </div>
    </footer>
  );
}

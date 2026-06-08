import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <p
        className="text-eyebrow font-semibold uppercase tracking-[0.18em]"
        style={{ color: "var(--color-accent)" }}
      >
        404
      </p>
      <h1 className="display mt-2 text-4xl">Página não encontrada</h1>
      <p className="mt-3 text-sm" style={{ color: "var(--color-fg-muted)" }}>
        O caminho que você seguiu não existe (ou já não existe mais).
      </p>
      <Link
        href="/"
        className="link-underline mt-6 text-sm font-medium"
        style={{ color: "var(--color-accent)" }}
      >
        ← voltar pro início
      </Link>
    </main>
  );
}

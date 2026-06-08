export default function Loading() {
  return (
    <div
      className="flex min-h-[40vh] items-center justify-center text-eyebrow uppercase tracking-[0.18em]"
      style={{ color: "var(--color-fg-subtle)" }}
    >
      <span className="animate-pulse">carregando…</span>
    </div>
  );
}

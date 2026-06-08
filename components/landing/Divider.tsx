/**
 * Filete divisor — hairline de ouro que desbota nas pontas, centrado no
 * mesmo container das seções. Marca a cadência entre os "capítulos".
 */
export function Divider() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-accent) 28%, transparent) 50%, transparent)",
        }}
      />
    </div>
  );
}

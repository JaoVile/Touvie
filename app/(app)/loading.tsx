// Skeleton INSTANTÂNEO ao navegar entre seções do app: aparece no clique (a Nav
// fica no lugar), enquanto a página real — force-dynamic: auth + queries — renderiza
// e faz streaming por baixo. É o que tira a sensação de "carrega tudo no servidor
// antes de liberar a tela". Fica no nível (app) → vale pra TODA rota logada.
export default function AppLoading() {
  return (
    <div className="w-full animate-pulse">
      {/* Cabeçalho (padrão GradientHeader: eyebrow · título · subtítulo) */}
      <div className="mb-8 space-y-3">
        <div className="h-3 w-24 rounded" style={{ background: "var(--color-border)" }} />
        <div
          className="h-9 w-64 max-w-[70%] rounded-lg"
          style={{ background: "var(--color-card)" }}
        />
        <div
          className="h-4 w-80 max-w-[85%] rounded"
          style={{ background: "var(--color-border)" }}
        />
      </div>

      {/* Grade de cards (a maioria das telas: header + cards glass) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["a", "b", "c", "d", "e", "f"].map((k, i) => (
          <div
            key={k}
            className="h-40 rounded-2xl border"
            style={{
              background: "var(--color-card)",
              borderColor: "color-mix(in srgb, var(--color-border) 50%, transparent)",
              opacity: 1 - i * 0.07,
            }}
          />
        ))}
      </div>
    </div>
  );
}

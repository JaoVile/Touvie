import { PlanosChat } from "./PlanosChat";
import { getOrCreateDraft } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const { plan } = await getOrCreateDraft();
  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-center text-lg font-semibold" style={{ color: "var(--color-fg)" }}>
        Toube Planos — monta seu treino
      </h1>
      <PlanosChat initialPlan={plan} />
    </div>
  );
}

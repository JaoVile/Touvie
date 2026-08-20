import { getTranslations } from "next-intl/server";
import { PlanosChat } from "./PlanosChat";
import { getOrCreateDraft } from "./actions";

export const dynamic = "force-dynamic";

export default async function PlanosPage() {
  const t = await getTranslations("toube");
  const { plan } = await getOrCreateDraft();
  return (
    <div className="px-4 py-6">
      <h1 className="mb-4 text-center text-lg font-semibold" style={{ color: "var(--color-fg)" }}>
        {t("planosPageTitle")}
      </h1>
      <PlanosChat initialPlan={plan} />
    </div>
  );
}

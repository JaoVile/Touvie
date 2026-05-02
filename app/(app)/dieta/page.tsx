import { GradientHeader } from "@/components/glass/GradientHeader";
import { todayBRTISO } from "@/lib/datetime";
import { createClient } from "@/lib/supabase/server";
import { AlimentosTab } from "./AlimentosTab";
import { HojeTab } from "./HojeTab";
import { MedidasTab } from "./MedidasTab";
import { type DietTab, Tabs } from "./Tabs";

export const dynamic = "force-dynamic";

type SP = Promise<{ t?: string; d?: string }>;

const VALID: DietTab[] = ["hoje", "alimentos", "medidas"];

function isTab(x: string | undefined): x is DietTab {
  return !!x && (VALID as string[]).includes(x);
}

export default async function DietaPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab: DietTab = isTab(sp?.t) ? sp.t : "hoje";
  const dateParam = sp?.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayBRTISO();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const subtitleByTab: Record<DietTab, string> = {
    hoje: "Refeições e macros do dia.",
    alimentos: "Catálogo de alimentos (TACO + seus).",
    medidas: "Peso e medidas corporais ao longo do tempo.",
  };

  return (
    <>
      <GradientHeader emoji="🥗" title="Dieta" subtitle={subtitleByTab[tab]} />
      <Tabs current={tab} />
      {tab === "hoje" ? (
        <HojeTab userId={userId} date={dateParam} />
      ) : tab === "alimentos" ? (
        <AlimentosTab userId={userId} />
      ) : (
        <MedidasTab userId={userId} />
      )}
    </>
  );
}

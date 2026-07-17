import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { todayBRTISO } from "@/lib/datetime";
import { getUserClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Salad } from "lucide-react";
import { AlimentosTab } from "./AlimentosTab";
import { HojeTab } from "./HojeTab";
import { LembretesTab } from "./LembretesTab";
import { MedidasTab } from "./MedidasTab";
import { type DietTab, Tabs } from "./Tabs";

export const dynamic = "force-dynamic";

type SP = Promise<{ t?: string; d?: string }>;

const VALID: DietTab[] = ["hoje", "alimentos", "medidas", "lembretes"];

function isTab(x: string | undefined): x is DietTab {
  return !!x && (VALID as string[]).includes(x);
}

export default async function DietaPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab: DietTab = isTab(sp?.t) ? sp.t : "hoje";
  const dateParam = sp?.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d) ? sp.d : todayBRTISO();

  const supabase = await createClient();
  const userId = (await getUserClaims())!.sub;

  const subtitleByTab: Record<DietTab, string> = {
    hoje: "Refeições e macros do dia.",
    alimentos: "Catálogo de alimentos (TACO + seus).",
    medidas: "Peso e medidas corporais ao longo do tempo.",
    lembretes: "Avise você mesmo na hora certa.",
  };

  return (
    <>
      <PageGlyphs variant="diet" />

      <Reveal>
        <GradientHeader
          icon={Salad}
          eyebrow="Nutrição · Diário"
          title="Dieta"
          subtitle={subtitleByTab[tab]}
        />
      </Reveal>

      <Tabs current={tab} />

      <Reveal delay={120}>
        {tab === "hoje" ? (
          <HojeTab userId={userId} date={dateParam} />
        ) : tab === "alimentos" ? (
          <AlimentosTab userId={userId} />
        ) : tab === "medidas" ? (
          <MedidasTab userId={userId} />
        ) : (
          <LembretesTab />
        )}
      </Reveal>
    </>
  );
}

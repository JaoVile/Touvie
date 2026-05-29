import { Dumbbell } from "lucide-react";
import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { createClient } from "@/lib/supabase/server";
import { HistoricoTab } from "./HistoricoTab";
import { HojeTab } from "./HojeTab";
import { PRsTab } from "./PRsTab";
import { ProgramasTab } from "./ProgramasTab";
import { Tabs, type WorkoutTab } from "./Tabs";

export const dynamic = "force-dynamic";

type SP = Promise<{ t?: string }>;

const VALID: WorkoutTab[] = ["hoje", "programas", "historico", "prs"];

function isTab(x: string | undefined): x is WorkoutTab {
  return !!x && (VALID as string[]).includes(x);
}

export default async function TreinoPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const tab: WorkoutTab = isTab(sp?.t) ? sp.t : "hoje";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user!.id;

  const subtitleByTab: Record<WorkoutTab, string> = {
    hoje: "O treino de hoje + logger de séries.",
    programas: "Construa programas, dias e exercícios.",
    historico: "Sessões passadas.",
    prs: "Recordes pessoais e progressão.",
  };

  return (
    <>
      <PageGlyphs variant="fitness" />
      <Reveal>
        <GradientHeader
          icon={Dumbbell}
          eyebrow="Força · Sessão"
          title="Treino"
          subtitle={subtitleByTab[tab]}
        />
      </Reveal>
      <Tabs current={tab} />
      {tab === "hoje" ? (
        <HojeTab userId={userId} />
      ) : tab === "programas" ? (
        <ProgramasTab userId={userId} />
      ) : tab === "historico" ? (
        <HistoricoTab userId={userId} />
      ) : (
        <PRsTab userId={userId} />
      )}
    </>
  );
}

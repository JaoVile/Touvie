import { GradientHeader } from "@/components/glass/GradientHeader";
import { getLogs, type LogPeriod } from "./actions";
import { LogsClient } from "./LogsClient";

export const dynamic = "force-dynamic";

const VALID_TABS: LogPeriod[] = ["hoje", "semana", "mes"];

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab: LogPeriod = VALID_TABS.includes(tab as LogPeriod)
    ? (tab as LogPeriod)
    : "hoje";

  const logs = await getLogs(activeTab);

  return (
    <>
      <GradientHeader
        emoji="🔔"
        title="Notificações"
        subtitle="Histórico de disparos e eventos do sistema."
      />
      <LogsClient logs={logs} activeTab={activeTab} />
    </>
  );
}

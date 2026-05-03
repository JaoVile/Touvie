import { GradientHeader } from "@/components/glass/GradientHeader";
import { getLogs, getTemplates, getWebhookStatus, type LogPeriod } from "./actions";
import { ConfigClient } from "./ConfigClient";
import { LogsClient } from "./LogsClient";
import { TemplatesClient } from "./TemplatesClient";

export const dynamic = "force-dynamic";

const VALID_TABS: LogPeriod[] = ["hoje", "semana", "mes"];
type Section = "logs" | "templates" | "config";

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; tab?: string }>;
}) {
  const { v, tab } = await searchParams;
  const section: Section =
    v === "templates" ? "templates" : v === "config" ? "config" : "logs";
  const activeTab: LogPeriod = VALID_TABS.includes(tab as LogPeriod)
    ? (tab as LogPeriod)
    : "hoje";

  const [logs, templates, webhookStatus] = await Promise.all([
    section === "logs" ? getLogs(activeTab) : Promise.resolve([]),
    section === "templates" ? getTemplates() : Promise.resolve([]),
    section === "config" ? getWebhookStatus() : Promise.resolve(null),
  ]);

  return (
    <>
      <GradientHeader
        emoji="🔔"
        title="Notificações"
        subtitle="Logs de eventos e configuração do bot Touvie."
      />

      <div className="mb-4 flex gap-2">
        {(["logs", "templates", "config"] as const).map((s) => (
          <a
            key={s}
            href={`?v=${s}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              section === s ? "gradient-brand text-white shadow" : "opacity-60 hover:opacity-80"
            }`}
          >
            {s === "logs" ? "📋 Logs" : s === "templates" ? "✏️ Templates" : "⚙️ Configurar"}
          </a>
        ))}
      </div>

      {section === "logs" && <LogsClient logs={logs} activeTab={activeTab} />}
      {section === "templates" && <TemplatesClient templates={templates} />}
      {section === "config" && <ConfigClient webhookStatus={webhookStatus} />}
    </>
  );
}

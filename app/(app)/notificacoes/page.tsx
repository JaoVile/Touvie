import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { Bell, type LucideIcon, PenLine, ScrollText, Settings } from "lucide-react";
import { ConfigClient } from "./ConfigClient";
import { LogsClient } from "./LogsClient";
import { TemplatesClient } from "./TemplatesClient";
import { type LogPeriod, getLogs, getTemplates, getWebhookStatus } from "./actions";

export const dynamic = "force-dynamic";

const VALID_TABS: LogPeriod[] = ["hoje", "semana", "mes"];
type Section = "logs" | "templates" | "config";

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; tab?: string }>;
}) {
  const { v, tab } = await searchParams;
  const section: Section = v === "templates" ? "templates" : v === "config" ? "config" : "logs";
  const activeTab: LogPeriod = VALID_TABS.includes(tab as LogPeriod) ? (tab as LogPeriod) : "hoje";

  const [logs, templates, webhookStatus] = await Promise.all([
    section === "logs" ? getLogs(activeTab) : Promise.resolve([]),
    section === "templates" ? getTemplates() : Promise.resolve([]),
    section === "config" ? getWebhookStatus() : Promise.resolve(null),
  ]);

  const SECTIONS: Array<{ id: Section; label: string; icon: LucideIcon }> = [
    { id: "logs", label: "Logs", icon: ScrollText },
    { id: "templates", label: "Templates", icon: PenLine },
    { id: "config", label: "Configurar", icon: Settings },
  ];

  return (
    <>
      <PageGlyphs variant="system" />

      <Reveal>
        <GradientHeader
          icon={Bell}
          eyebrow="Bot · Eventos"
          title="Notificações"
          subtitle="Logs de eventos e configuração do bot Touvie."
        />
      </Reveal>

      <div
        className="mb-6 flex gap-1 overflow-x-auto border-b"
        style={{ borderColor: "var(--color-border)" }}
      >
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <a
              key={id}
              href={`?v=${id}`}
              className="group relative flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-eyebrow font-semibold uppercase tracking-[0.1em] transition-colors"
              style={{ color: active ? "var(--color-accent)" : "var(--color-fg-subtle)" }}
            >
              <Icon size={14} strokeWidth={1.75} />
              {label}
              {active ? (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 8%, transparent) 92%)",
                  }}
                />
              ) : null}
            </a>
          );
        })}
      </div>

      <Reveal delay={120}>
        {section === "logs" && <LogsClient logs={logs} activeTab={activeTab} />}
        {section === "templates" && <TemplatesClient templates={templates} />}
        {section === "config" && <ConfigClient webhookStatus={webhookStatus} />}
      </Reveal>
    </>
  );
}

import { PageGlyphs } from "@/components/PageGlyphs";
import { Reveal } from "@/components/Reveal";
import { GradientHeader } from "@/components/glass/GradientHeader";
import { type ReminderRow, listAllReminders } from "@/components/reminders/actions";
import { Bell, BellRing, type LucideIcon, PenLine, ScrollText, Settings } from "lucide-react";
import { ConfigClient } from "./ConfigClient";
import { LogsClient } from "./LogsClient";
import { RemindersClient } from "./RemindersClient";
import { TemplatesClient } from "./TemplatesClient";
import { type LogPeriod, getLogs, getTemplates, getWebhookStatus } from "./actions";

export const dynamic = "force-dynamic";

const VALID_TABS: LogPeriod[] = ["hoje", "semana", "mes"];
type Section = "logs" | "templates" | "config" | "reminders";

export default async function NotificacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; tab?: string }>;
}) {
  const { v, tab } = await searchParams;
  const section: Section =
    v === "templates"
      ? "templates"
      : v === "config"
        ? "config"
        : v === "reminders"
          ? "reminders"
          : "logs";
  const activeTab: LogPeriod = VALID_TABS.includes(tab as LogPeriod) ? (tab as LogPeriod) : "hoje";

  const [logs, templates, webhookStatus, remindersRes] = await Promise.all([
    section === "logs" ? getLogs(activeTab) : Promise.resolve([]),
    section === "templates" ? getTemplates() : Promise.resolve([]),
    section === "config" ? getWebhookStatus() : Promise.resolve(null),
    section === "reminders"
      ? listAllReminders()
      : Promise.resolve({ ok: true as const, reminders: [] as ReminderRow[] }),
  ]);
  const reminders = remindersRes.ok ? (remindersRes.reminders ?? []) : [];
  const remindersError = remindersRes.ok ? null : (remindersRes.error ?? null);

  const SECTIONS: Array<{ id: Section; label: string; icon: LucideIcon }> = [
    { id: "reminders", label: "Lembretes", icon: BellRing },
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
        {section === "reminders" && (
          <RemindersClient initial={reminders} loadError={remindersError} />
        )}
        {section === "logs" && <LogsClient logs={logs} activeTab={activeTab} />}
        {section === "templates" && <TemplatesClient templates={templates} />}
        {section === "config" && <ConfigClient webhookStatus={webhookStatus} />}
      </Reveal>
    </>
  );
}

"use client";

import { GlassCard } from "@/components/glass/GlassCard";
import { EVENT_COLORS, EVENT_LABELS, STATUS_COLORS, fmtRelative, fmtSource } from "@/lib/log-fmt";
import Link from "next/link";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AppLog, LogPeriod } from "./actions";

const TAB_LABELS: Record<LogPeriod, string> = {
  hoje: "Hoje",
  semana: "Semana",
  mes: "Mês",
};

function fmtTime(iso: string): string {
  const brt = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(11, 16);
}

function fmtDate(iso: string): string {
  const brt = new Date(new Date(iso).getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

function buildChartData(logs: AppLog[], tab: LogPeriod) {
  if (tab === "hoje") {
    const buckets: Record<string, Record<string, number>> = {};
    for (let h = 0; h < 24; h++) {
      buckets[`${h}h`] = { cron: 0, webhook: 0, api: 0, system: 0 };
    }
    for (const log of logs) {
      const brtHour = ((new Date(log.created_at).getUTCHours() - 3 + 24) % 24).toString();
      const key = `${brtHour}h`;
      if (buckets[key]) {
        buckets[key][log.event_type] = (buckets[key][log.event_type] ?? 0) + 1;
      }
    }
    return Object.entries(buckets).map(([label, counts]) => ({ label, ...counts }));
  }

  const days = tab === "semana" ? 7 : 30;
  const buckets: Record<string, Record<string, number>> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(5, 10)] = { cron: 0, webhook: 0, api: 0, system: 0 };
  }
  for (const log of logs) {
    const brt = new Date(new Date(log.created_at).getTime() - 3 * 60 * 60 * 1000);
    const key = brt.toISOString().slice(5, 10);
    if (buckets[key]) {
      buckets[key][log.event_type] = (buckets[key][log.event_type] ?? 0) + 1;
    }
  }
  return Object.entries(buckets).map(([label, counts]) => ({ label, ...counts }));
}

export function LogsClient({ logs, activeTab }: { logs: AppLog[]; activeTab: LogPeriod }) {
  const chartData = buildChartData(logs, activeTab);

  const byType = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.event_type] = (acc[log.event_type] ?? 0) + 1;
    return acc;
  }, {});
  const errors = logs.filter((l) => l.status === "error").length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["hoje", "semana", "mes"] as const).map((tab) => (
          <Link
            key={tab}
            href={`?tab=${tab}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === tab ? "gradient-brand text-white shadow" : "opacity-60 hover:opacity-80"
            }`}
          >
            {TAB_LABELS[tab]}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlassCard>
          <p className="text-xs opacity-60">Total</p>
          <p className="text-2xl font-bold">{logs.length}</p>
        </GlassCard>
        {Object.entries(byType).map(([type, count]) => (
          <GlassCard key={type}>
            <p className="text-xs opacity-60">{EVENT_LABELS[type] ?? type}</p>
            <p className="text-2xl font-bold" style={{ color: EVENT_COLORS[type] }}>
              {count}
            </p>
          </GlassCard>
        ))}
        {errors > 0 && (
          <GlassCard>
            <p className="text-xs opacity-60">Erros</p>
            <p className="text-2xl font-bold" style={{ color: STATUS_COLORS.error }}>
              {errors}
            </p>
          </GlassCard>
        )}
      </div>

      <GlassCard>
        <h3 className="mb-3 text-sm font-semibold opacity-80">
          Disparos por {activeTab === "hoje" ? "hora (BRT)" : "dia"}
        </h3>
        {logs.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={activeTab === "hoje" ? 3 : "preserveStartEnd"}
              />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              {(["cron", "webhook", "api", "system"] as const).map((type) => (
                <Bar
                  key={type}
                  dataKey={type}
                  name={EVENT_LABELS[type]}
                  stackId="a"
                  fill={EVENT_COLORS[type]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm opacity-40">Nenhum evento neste período.</p>
        )}
      </GlassCard>

      <GlassCard>
        <h3 className="mb-3 text-sm font-semibold opacity-80">Eventos ({logs.length})</h3>
        {logs.length === 0 ? (
          <p className="text-sm opacity-40">Nenhum evento registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg p-2 text-sm"
                style={{ background: "var(--color-surface)" }}
              >
                <span
                  className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                  style={{ background: EVENT_COLORS[log.event_type] ?? "#666" }}
                >
                  {EVENT_LABELS[log.event_type] ?? log.event_type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{fmtSource(log.source)}</span>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px]"
                      style={{
                        background: `${STATUS_COLORS[log.status]}33`,
                        color: STATUS_COLORS[log.status],
                      }}
                    >
                      {log.status}
                    </span>
                  </div>
                  {log.message_preview && (
                    <p className="mt-0.5 truncate text-xs opacity-60">{log.message_preview}</p>
                  )}
                </div>
                <div className="shrink-0 text-right text-[10px] opacity-40">
                  <div>{fmtDate(log.created_at)}</div>
                  <div>{fmtTime(log.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

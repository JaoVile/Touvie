"use client";

import { EVENT_COLORS, EVENT_LABELS } from "@/lib/log-fmt";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LogPeriod } from "./actions";

// Frouxo de propósito: casa com o retorno de buildChartData ({ label, ...counts })
// e é o que o recharts precisa (só as chaves label/cron/webhook/api/system).
type ChartRow = Record<string, string | number>;

// Corpo com recharts, carregado sob demanda por LogsClient (next/dynamic) — mantém
// a lib fora do bundle inicial de /notificacoes.
export default function LogsChartCanvas({
  data,
  activeTab,
}: {
  data: ChartRow[];
  activeTab: LogPeriod;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
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
  );
}

"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Props {
  data: Array<{ date: string; e1rm: number }>;
}

// Corpo com recharts, carregado sob demanda por ProgressionChart (next/dynamic).
export default function ProgressionChartCanvas({ data }: Props) {
  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            stroke="var(--color-fg-subtle)"
            tick={{ fontSize: 9 }}
            tickFormatter={(v: string) => v.slice(5).replace("-", "/")}
          />
          <YAxis
            stroke="var(--color-fg-subtle)"
            tick={{ fontSize: 9 }}
            tickFormatter={(v: number) => `${v}kg`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              color: "var(--color-fg)",
              fontSize: 11,
            }}
            formatter={(v: number) => [`${v.toFixed(1)} kg`, "1RM est."]}
            labelFormatter={(l: string) => formatDate(l)}
          />
          <Line
            type="monotone"
            dataKey="e1rm"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={{ r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

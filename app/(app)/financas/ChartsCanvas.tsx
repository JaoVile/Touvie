"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PieDatum = { name: string; value: number; color: string };
type LineDatum = { month: string; receita: number; despesa: number; saldo: number };

type Props = { kind: "pie"; data: PieDatum[] } | { kind: "line"; data: LineDatum[] };

const fmtBRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Corpo com recharts, carregado sob demanda por Charts (next/dynamic).
export default function ChartsCanvas(props: Props) {
  if (props.kind === "pie") {
    return (
      <div className="h-[280px] w-full">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={props.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={50}
              paddingAngle={2}
            >
              {props.data.map((d, i) => (
                <Cell key={`${d.name}-${i}`} fill={d.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => fmtBRL(value)}
              contentStyle={{
                background: "var(--color-bg-elevated)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                color: "var(--color-fg)",
              }}
            />
            <Legend
              formatter={(v) => <span style={{ color: "var(--color-fg-muted)" }}>{v}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer>
        <LineChart data={props.data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="month" stroke="var(--color-fg-subtle)" tick={{ fontSize: 11 }} />
          <YAxis
            stroke="var(--color-fg-subtle)"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: number) => fmtBRL(value)}
            contentStyle={{
              background: "var(--color-bg-elevated)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              color: "var(--color-fg)",
            }}
          />
          <Legend formatter={(v) => <span style={{ color: "var(--color-fg-muted)" }}>{v}</span>} />
          <Line
            type="monotone"
            dataKey="receita"
            stroke="var(--color-success)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="despesa"
            stroke="var(--color-danger)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="saldo"
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

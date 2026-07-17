"use client";

import dynamic from "next/dynamic";

// Wrapper fino: carrega recharts sob demanda — fora do bundle inicial de /treino.
export const ProgressionChart = dynamic(() => import("./ProgressionChartCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[120px] w-full animate-pulse rounded-lg"
      style={{ background: "var(--color-card)" }}
    />
  ),
});

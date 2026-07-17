"use client";

import dynamic from "next/dynamic";

// Wrapper fino: carrega recharts sob demanda — fora do bundle inicial de /financas.
export const Charts = dynamic(() => import("./ChartsCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[280px] w-full animate-pulse rounded-lg"
      style={{ background: "var(--color-card)" }}
    />
  ),
});

"use client";

import dynamic from "next/dynamic";

// Wrapper fino: carrega o corpo (recharts) sob demanda — a lib fica fora do
// bundle inicial da rota /dieta. Skeleton com a MESMA altura pra não dar shift.
export const MeasurementChart = dynamic(() => import("./MeasurementChartCanvas"), {
  ssr: false,
  loading: () => (
    <div
      className="h-[220px] w-full animate-pulse rounded-lg"
      style={{ background: "var(--color-card)" }}
    />
  ),
});

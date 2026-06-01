import { GlassCard } from "@/components/glass/GlassCard";
import { createClient } from "@/lib/supabase/server";
import { History, TrendingUp } from "lucide-react";
import { MeasurementChart } from "./MeasurementChart";
import { MeasurementForm } from "./MeasurementForm";
import { MeasurementRow } from "./MeasurementRow";

interface Props {
  userId: string;
}

interface Measurement {
  id: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  bodyfat_pct: number | null;
  notes: string | null;
}

export async function MedidasTab({ userId }: Props) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("body_measurements")
    .select("id, measured_on, weight_kg, waist_cm, chest_cm, arm_cm, thigh_cm, bodyfat_pct, notes")
    .eq("user_id", userId)
    .order("measured_on", { ascending: false })
    .limit(180);
  const rows = (data ?? []) as Measurement[];

  // Pra gráfico, precisa em ordem cronológica e com weight_kg presente
  const weightSeries = [...rows]
    .filter((r) => r.weight_kg != null)
    .sort((a, b) => (a.measured_on < b.measured_on ? -1 : 1))
    .map((r) => ({ date: r.measured_on, weight: r.weight_kg as number }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="grid gap-4">
        <GlassCard>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp size={16} />
            Peso (últimos 180 dias)
          </h2>
          {weightSeries.length >= 2 ? (
            <MeasurementChart data={weightSeries} />
          ) : (
            <p className="text-xs italic" style={{ color: "var(--color-fg-subtle)" }}>
              Registre pelo menos 2 pesagens pra ver o gráfico.
            </p>
          )}
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <History size={16} />
            Histórico
          </h2>
          {rows.length === 0 ? (
            <p className="text-xs italic" style={{ color: "var(--color-fg-subtle)" }}>
              Sem registros ainda. Use o formulário ao lado.
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((m) => (
                <MeasurementRow key={m.id} m={m} />
              ))}
            </ul>
          )}
        </GlassCard>
      </div>

      <GlassCard className="lg:sticky lg:top-20 lg:self-start">
        <h2 className="mb-3 text-sm font-semibold">+ Novo registro</h2>
        <MeasurementForm />
      </GlassCard>
    </div>
  );
}

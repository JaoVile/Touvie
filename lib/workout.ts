// Helpers para treino: 1RM, formatação e grupos musculares.

export const MUSCLE_GROUPS = [
  "Peito",
  "Costas",
  "Ombros",
  "Bíceps",
  "Tríceps",
  "Pernas",
  "Glúteos",
  "Posterior",
  "Panturrilha",
  "Abdômen",
  "Antebraço",
  "Cardio",
  "Corpo inteiro",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];
export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Epley 1RM: weight * (1 + reps/30)
export function estimate1RM(weightKg: number | null, reps: number | null): number | null {
  if (weightKg == null || reps == null || reps <= 0) return null;
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100;
}

export function formatWeight(weightKg: number | null): string {
  if (weightKg == null) return "BW";
  return `${weightKg.toFixed(weightKg % 1 === 0 ? 0 : 1)} kg`;
}

export function formatReps(reps: number | null): string {
  if (reps == null) return "—";
  return `${reps}`;
}

export function formatSet(
  weightKg: number | null,
  reps: number | null,
  rpe?: number | null,
): string {
  const left = formatWeight(weightKg);
  const right = formatReps(reps);
  const rpeStr = rpe ? ` @${rpe}` : "";
  return `${left} × ${right}${rpeStr}`;
}

export function formatRepsTarget(low: number | null, high: number | null): string {
  if (low == null && high == null) return "—";
  if (low != null && high != null && low !== high) return `${low}–${high}`;
  return `${low ?? high}`;
}

export function totalVolume(
  logs: Array<{ weight_kg: number | null; reps: number | null }>,
): number {
  let v = 0;
  for (const l of logs) {
    if (l.weight_kg != null && l.reps != null) v += l.weight_kg * l.reps;
  }
  return Math.round(v * 100) / 100;
}

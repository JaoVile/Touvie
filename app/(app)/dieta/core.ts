import type { ToubeCtx } from "@/lib/toube-ctx";
import { z } from "zod";

export const measurementSchema = z.object({
  id: z.string().uuid().optional(),
  measured_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight_kg: z.number().min(0).max(500).nullable(),
  waist_cm: z.number().min(0).max(300).nullable(),
  chest_cm: z.number().min(0).max(300).nullable(),
  arm_cm: z.number().min(0).max(150).nullable(),
  thigh_cm: z.number().min(0).max(200).nullable(),
  bodyfat_pct: z.number().min(0).max(70).nullable(),
  notes: z.string().max(500).nullable(),
});

export async function saveMeasurementCore(
  ctx: ToubeCtx,
  input: unknown,
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = measurementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { id, ...fields } = parsed.data;
  const payload = { user_id: ctx.userId, ...fields };
  const { error } = id
    ? await ctx.supabase
        .from("body_measurements")
        .update(payload)
        .eq("id", id)
        .eq("user_id", ctx.userId)
    : await ctx.supabase.from("body_measurements").insert(payload);
  if (error) return { error: error.message };
  return { ok: true };
}

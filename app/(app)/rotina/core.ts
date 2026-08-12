import type { ToubeCtx } from "@/lib/toube-ctx";
import { z } from "zod";

export const dailySchema = z.object({
  id: z.string().uuid().optional(),
  time_slot: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida (use HH:MM)"),
  title: z.string().min(1, "Título obrigatório").max(120),
  emoji: z.string().max(8).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function saveDailyBlockCore(
  ctx: ToubeCtx,
  input: unknown,
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = dailySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const payload = {
    user_id: ctx.userId,
    time_slot: `${parsed.data.time_slot}:00`,
    title: parsed.data.title,
    emoji: parsed.data.emoji || null,
    notes: parsed.data.notes || null,
  };
  if (parsed.data.id) {
    const { error } = await ctx.supabase
      .from("routine_daily")
      .update(payload)
      .eq("id", parsed.data.id)
      .eq("user_id", ctx.userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await ctx.supabase.from("routine_daily").insert(payload);
    if (error) return { error: error.message };
  }
  return { ok: true };
}

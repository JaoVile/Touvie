import type { ToubeCtx } from "@/lib/toube-ctx";
import { z } from "zod";

export const quickNoteSchema = z.object({
  title: z.string().trim().min(1, "Título obrigatório").max(200),
  content: z.string().max(100_000),
});

export async function createQuickNoteCore(
  ctx: ToubeCtx,
  input: unknown,
): Promise<{ ok?: boolean; error?: string }> {
  const parsed = quickNoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message };
  const { error } = await ctx.supabase.from("notes").insert({
    user_id: ctx.userId,
    title: parsed.data.title,
    content: parsed.data.content,
    tags: [],
  });
  if (error) return { error: error.message };
  return { ok: true };
}

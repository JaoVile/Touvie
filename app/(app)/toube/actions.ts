"use server";

import { createClient } from "@/lib/supabase/server";
import type { ToubeAction } from "@/lib/toube";
import { executeToube } from "@/lib/toube-execute";
import { revalidatePath } from "next/cache";

/** Confirmação vinda da UI web: monta o ctx do cookie e delega ao executor. */
export async function executeToubeAction(
  action: ToubeAction,
  args: Record<string, unknown>,
): Promise<{ error?: string; ok?: boolean; note?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const res = await executeToube({ supabase, userId: user.id }, action, args);
  if (res.ok) {
    // A ação pode ter tocado qualquer módulo — revalida o dashboard e o módulo alvo.
    revalidatePath("/");
    revalidatePath("/metas");
    revalidatePath("/financas");
    revalidatePath("/rotina");
    revalidatePath("/notas");
    revalidatePath("/dieta");
    revalidatePath("/treino");
    revalidatePath("/notificacoes");
  }
  return res;
}

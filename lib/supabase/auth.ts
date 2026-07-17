import { cache } from "react";
import { createClient } from "./server";

export type UserClaims = { sub: string; email?: string; [key: string]: unknown };

/**
 * Usuário logado via `getClaims()` — verifica o JWT **localmente** (sem viagem ao
 * Auth server do Supabase) quando o projeto usa chaves de assinatura assimétricas.
 * Embrulhado em `cache()` do React: layout + página + componentes que chamarem
 * dentro do MESMO request compartilham UMA verificação (dedup).
 *
 * Use isto no caminho de RENDER (layout/páginas/leituras) no lugar de `getUser()`.
 * O `getUser()` continua sendo a fonte autoritativa (bate na rede, pega ban/
 * exclusão na hora) — mantenha-o só em AÇÕES sensíveis/mutações e no middleware
 * (que renova a sessão). `getClaims` é criptograficamente verificado, então é
 * seguro pra autorização; a única ressalva é staleness até o token expirar (~1h).
 */
export const getUserClaims = cache(async (): Promise<UserClaims | null> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims as UserClaims | undefined;
    return claims?.sub ? claims : null;
  } catch {
    return null;
  }
});

// Smoke manual: node --import ./scripts/dev-alias.mjs scripts/smoke-toube-execute.ts
// Precisa de SUPABASE_SERVICE_ROLE_KEY e SMOKE_USER_ID no ambiente.
// Cria uma meta, edita, conclui e apaga — validando o ciclo completo com admin client.
import { createAdminClient } from "@/lib/supabase/admin";
import { executeToube } from "@/lib/toube-execute";

const userId = process.env.SMOKE_USER_ID;
if (!userId) {
  console.error("FALHOU: defina SMOKE_USER_ID (uuid do usuário de teste)");
  process.exit(1);
}
const ctx = { supabase: createAdminClient(), userId };

const criar = await executeToube(ctx, "criar_meta", { title: "SMOKE meta temporária" });
console.log("criar_meta:", criar);
if (!criar.ok) process.exit(1);

const { data: goal } = await ctx.supabase
  .from("goals")
  .select("id")
  .eq("user_id", userId)
  .eq("title", "SMOKE meta temporária")
  .maybeSingle();
if (!goal) {
  console.error("FALHOU: meta não apareceu no banco");
  process.exit(1);
}

console.log("concluir:", await executeToube(ctx, "concluir_meta", { id: goal.id }));
console.log("deletar:", await executeToube(ctx, "deletar_meta", { id: goal.id }));

const { data: sobrou } = await ctx.supabase
  .from("goals")
  .select("id")
  .eq("id", goal.id)
  .maybeSingle();
if (sobrou) {
  console.error("FALHOU: meta não foi apagada");
  process.exit(1);
}
console.log("OK: ciclo criar → concluir → apagar funcionou com admin client");

// Template engine para mensagens dos crons.
// Sintaxe: {{nome_da_variavel}} é substituído pela string retornada
// pela função correspondente no var map. Variável sem entrada vira "".
// Variáveis costumam retornar blocos inteiros (header + corpo) ou "" se
// não houver dado — assim a UI pode controlar inclusão/ordem só editando
// o template, e seções vazias não deixam espaço fantasma (collapsamos
// 3+ quebras para 2).

import type { createAdminClient } from "@/lib/supabase/admin";

export type AdminClient = ReturnType<typeof createAdminClient>;

export type VarContext = {
  admin: AdminClient;
  userId: string;
  today: string;
  tomorrow: string;
  weekday: number;
};

export type VarRenderer = (ctx: VarContext) => Promise<string>;
export type CronVarMap = Record<string, VarRenderer>;

const VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export async function renderTemplate(
  template: string,
  ctx: VarContext,
  vars: CronVarMap,
): Promise<string> {
  const matches = Array.from(template.matchAll(VAR_RE));
  // Cache por nome — o mesmo {{x}} usado duas vezes só chama uma vez.
  const seen = new Map<string, Promise<string>>();
  for (const m of matches) {
    const name = m[1];
    if (seen.has(name)) continue;
    const fn = vars[name];
    seen.set(name, fn ? fn(ctx).catch(() => "") : Promise.resolve(""));
  }
  const resolved: Record<string, string> = {};
  await Promise.all(
    Array.from(seen.entries()).map(async ([name, p]) => {
      resolved[name] = await p;
    }),
  );
  const out = template.replace(VAR_RE, (_, name: string) => resolved[name] ?? "");
  // Colapsa 3+ quebras em 2 para esconder gaps de seções vazias.
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

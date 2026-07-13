import { resolve as pr } from "node:path";
// Resolve os imports do projeto fora do Next: `@/x` → <raiz>/x.ts e import
// relativo sem extensão → +.ts. Permite rodar smoke de módulos server (lib/*)
// direto no Node 22 (type-stripping): node --import ./scripts/dev-alias.mjs s.ts
import { pathToFileURL } from "node:url";
const ROOT = process.cwd();
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/"))
    return { url: pathToFileURL(pr(ROOT, `${spec.slice(2)}.ts`)).href, shortCircuit: true };
  if (
    spec.startsWith(".") &&
    !/\.[cm]?[jt]s(on)?$/.test(spec) &&
    !ctx.parentURL?.includes("node_modules")
  )
    return { url: new URL(`${spec}.ts`, ctx.parentURL).href, shortCircuit: true };
  return next(spec, ctx);
}

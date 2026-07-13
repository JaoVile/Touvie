// Uso: node --import ./scripts/dev-alias.mjs scripts/meu-smoke.ts
import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./dev-alias-hook.mjs", pathToFileURL(`${process.cwd()}/scripts/`));

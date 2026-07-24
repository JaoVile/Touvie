// Smoke manual: node --import ./scripts/dev-alias.mjs scripts/smoke-toube-compact.ts
// Precisa de GROQ_API_KEY no ambiente (.env.local). Imprime o resumo e valida
// que não veio vazio.
import { summarizeConversation } from "@/lib/toube-compact";

const older = [
  { role: "user" as const, content: "Meu nome é Rafael e treino às 6h da manhã." },
  { role: "assistant" as const, content: "Boa, Rafael! Treino cedo rende. Qual seu foco?" },
  { role: "user" as const, content: "Hipertrofia. Meta: supino 100kg até dezembro." },
  { role: "assistant" as const, content: "Anotado: hipertrofia, supino 100kg até dez." },
];

const summary = await summarizeConversation(null, older);
console.log(`=== RESUMO ===\n${summary}`);
if (!summary || summary.length < 10) {
  console.error("FALHOU: resumo vazio/curto");
  process.exit(1);
}
// Deve reter os fatos-chave.
const hits = ["Rafael", "100"].filter((k) => summary.includes(k));
console.log(`\nfatos retidos: ${hits.join(", ")} (${hits.length}/2)`);
process.exit(hits.length >= 1 ? 0 : 1);

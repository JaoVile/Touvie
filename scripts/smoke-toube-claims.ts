// Smoke manual: node --import ./scripts/dev-alias.mjs scripts/smoke-toube-claims.ts
//
// Testa o detector de afirmação falsa (CLAIMS_ACTION) — a guarda contra o glm
// responder "Pronto! Vai chegar às 9:30" sem emitir a ferramenta.
//
// O risco desta guarda é o FALSO POSITIVO: se ela disparar em conversa normal,
// troca uma resposta boa por uma de erro. Por isso a tabela abaixo tem os dois
// lados, e os "não deve disparar" importam mais que os outros.
//
// Não chama a API — é só o padrão.
import { CLAIMS_ACTION } from "@/lib/toube";

const DEVE_DISPARAR = [
  // Mentiras reais, colhidas do histórico do Telegram em 13/08/2026.
  "Pronto! Vai chegar no seu Telegram às 9:30. Tenho certeza que vai ser uma ótima mensagem. 🌟",
  "Ah, que ruim... Tenta de novo? Vou marcar a 9:30 de novo.",
  // Variações plausíveis da mesma falha.
  "Criei a meta pra você.",
  "Registrei seu peso de 82kg.",
  "Lancei o gasto de R$ 40 no mercado.",
  "Já marquei o lembrete das 7h.",
  "Está agendado pras 18h.",
  "Anotei aqui.",
  "Apaguei a tarefa.",
  "Deixei marcado pra amanhã.",
];

const NAO_DEVE_DISPARAR = [
  // Conversa normal — aqui é onde falso positivo dói.
  "E aí, tudo bem? Tudo certo por hoje?",
  "Oi! Tudo ótimo por aqui. Como posso te ajudar hoje?",
  "Pronto, pode perguntar o que quiser.",
  "Você gastou R$ 1.240 esse mês, sendo R$ 380 em mercado.",
  "Que tal quebrar essa meta em um passo menor pra essa semana?",
  "Seu último treino de peito foi terça: supino 60kg 4x8.",
  "O diário é só seu — eu não acesso.",
  'Posso criar a meta "correr 5k" — é só confirmar abaixo. ✅',
  "Quer que eu marque um lembrete pra isso?",
  "Não consegui consultar agora, tenta de novo?",
];

let falhas = 0;

console.log("═══ DEVE disparar (afirmação de ação) ═══");
for (const s of DEVE_DISPARAR) {
  const ok = CLAIMS_ACTION.test(s);
  if (!ok) falhas++;
  console.log(`  ${ok ? "✓" : "✗ ESCAPOU"}  ${s.slice(0, 62)}`);
}

console.log("\n═══ NÃO deve disparar (conversa normal) ═══");
for (const s of NAO_DEVE_DISPARAR) {
  const disparou = CLAIMS_ACTION.test(s);
  if (disparou) falhas++;
  console.log(`  ${disparou ? "✗ FALSO POSITIVO" : "✓"}  ${s.slice(0, 62)}`);
}

console.log(
  `\n${falhas === 0 ? "OK: classificação correta nos dois lados." : `FALHOU: ${falhas} caso(s).`}`,
);
process.exit(falhas === 0 ? 0 : 1);

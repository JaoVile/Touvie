import { existsSync } from "node:fs";
import { type BrowserContext, type Locator, type Page, expect, test } from "@playwright/test";

/**
 * SEGURANÇA — gate de PIN do Diário privado (zero-knowledge).
 *
 * ⚠️ REGRA DE OURO: o Diário é INTOCÁVEL. Este teste NÃO lê, escreve nem decifra
 * conteúdo — exercita SÓ o comportamento do GATE de desbloqueio: PIN errado é
 * rejeitado (segue trancado), PIN certo destranca. Nada de conteúdo é digitado
 * nem asserido.
 *
 * O diário vivo é zero-knowledge: `DiaryUnlockZK` deriva a chave do PIN no
 * navegador e tenta destrancar o `pin_wrap`. Errou → `unwrapDEK` lança → mostra
 * "PIN incorreto." e limpa o campo. NÃO há lockout server-side / contador
 * `pin_attempts` neste caminho (isso vive só na rota legada /api/diary/unlock, hoje
 * órfã da UI) — por isso o teste é do gate client-side, que é o que o usuário real
 * encontra.
 *
 * Estratégia: usamos o 2º usuário de teste (teste2) como cobaia. O `beforeAll`
 * GARANTE (idempotente) que o diário dele está em modo privado, ativando-o com um
 * PIN de TESTE conhecido (`DIARY_PIN`) — que é NOSSO, setado num throwaway, NÃO o
 * segredo de um usuário real. Cada teste abre um contexto NOVO (sem a DEK de sessão)
 * pra cair no gate trancado. teste2 fica permanentemente privado — tudo bem, é conta
 * descartável de teste.
 *
 * Pré-condição: TEST_USER2_* no .env.test (→ e2e/.auth/user2.json). Sem ele, pula.
 */

const AUTH_B = "e2e/.auth/user2.json";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3007";

// PIN de TESTE que nós definimos no diário do teste2 (throwaway). NÃO é segredo de
// usuário real — é o valor que ativamos e conferimos. 4–8 dígitos (regra do app).
const DIARY_PIN = "135790";
const WRONG_PIN = "024680";
// Palavra-chave do teste2 (a mesma do cadastro; ≥6 após normalizar). Vira a 2ª chave.
const DIARY_PHRASE = "palavra chave de recuperacao dois";

// Locators do gate de unlock (DiaryUnlockZK). Placeholder EXATO "PIN" pra não casar
// o "PIN (4–8 dígitos)" do form de ativação.
const pinField = (page: Page) => page.getByPlaceholder("PIN", { exact: true });
const unlockBtn = (page: Page) => page.getByRole("button", { name: "Desbloquear" });

/**
 * Clica `button` até `target` aparecer — cobre clique disparado antes da hidratação
 * (1º hit de rota compilada sob demanda). Re-clica só enquanto o botão existe.
 */
async function clickUntil(button: Locator, target: Locator, timeout = 25_000) {
  await expect(async () => {
    if (await button.isVisible().catch(() => false)) await button.click({ timeout: 3_000 });
    await expect(target).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout });
}

test.describe.configure({ mode: "serial" });

test.describe("segurança — gate de PIN do Diário (zero-knowledge)", () => {
  test.skip(
    !existsSync(AUTH_B),
    "Falta e2e/.auth/user2.json — configure TEST_USER2_* no .env.test (ver .env.test.example).",
  );

  // Garante, UMA vez, que o diário do teste2 está em modo privado com o DIARY_PIN.
  // Idempotente: se já estiver privado (gate de unlock presente), não faz nada.
  test.beforeAll(async ({ browser }) => {
    // A ativação é pesada e ONE-TIME: 1º compile da rota + KDF do wrapDEK (×3) +
    // router.refresh recompilando. Timeout generoso; nas próximas rodadas teste2 já
    // está privado e este hook retorna na hora (early-return abaixo).
    test.setTimeout(180_000);
    const ctx = await browser.newContext({ storageState: AUTH_B, baseURL });
    const page = await ctx.newPage();
    try {
      await page.goto("/diario", { waitUntil: "domcontentloaded" });

      // Espera a página ASSENTAR num dos dois estados antes de ramificar. Sem isso
      // há corrida: DiaryUnlockZK só renderiza após o useEffect(loadSessionDEK)
      // (retorna null até `checked`), então um isVisible() imediato daria falso e
      // cairia por engano na ativação.
      const activateBtn = page.getByRole("button", { name: "Ativar", exact: true });
      await expect(pinField(page).or(activateBtn).first()).toBeVisible({ timeout: 20_000 });

      // Já privado? O gate de unlock aparece — nada a fazer.
      if (
        await pinField(page)
          .isVisible()
          .catch(() => false)
      )
        return;

      // Não privado → ativa (teste2 é dispositivo confiável: user2.json tem rotina_edit).
      // Abre o form de ativação (botão "Ativar", exato pra não casar "Ativar diário privado").
      await clickUntil(activateBtn, page.getByPlaceholder("PIN (4–8 dígitos)"));
      await page.getByPlaceholder("PIN (4–8 dígitos)").fill(DIARY_PIN);
      await page.getByPlaceholder("Confirme o PIN").fill(DIARY_PIN);
      await page.getByPlaceholder("Palavra-chave do cadastro").fill(DIARY_PHRASE);
      await page.getByRole("button", { name: "Ativar diário privado" }).click();

      // Tela do código de recuperação (mostrado 1x) → confirmar e entrar.
      await expect(page.getByText("Guarde seu código de recuperação")).toBeVisible({
        timeout: 20_000,
      });
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Entrar no diário" }).click();
      // Confirma que ativou: caiu no editor destrancado (textarea presente).
      await expect(page.locator("textarea")).toBeVisible({ timeout: 15_000 });
    } finally {
      await ctx.close();
    }
  });

  // Cada teste abre um contexto NOVO (sem DEK de sessão) → cai no gate trancado.
  let ctx: BrowserContext;
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    test.slow();
    ctx = await browser.newContext({ storageState: AUTH_B, baseURL });
    page = await ctx.newPage();
    await page.goto("/diario", { waitUntil: "domcontentloaded" });
    // Deve estar TRANCADO: gate de unlock visível, sem editor.
    await expect(pinField(page), "o diário do teste2 deveria abrir no gate de PIN").toBeVisible({
      timeout: 15_000,
    });
  });

  test.afterEach(async () => {
    await ctx?.close();
  });

  test("PIN errado é rejeitado e o diário segue trancado", async () => {
    await pinField(page).fill(WRONG_PIN);
    await unlockBtn(page).click();

    // Mostra o erro e NÃO destranca.
    await expect(page.getByText("PIN incorreto.", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    // Gate continua de pé; nenhum editor (textarea) apareceu → conteúdo não vazou.
    await expect(unlockBtn(page), "o gate deveria continuar trancado").toBeVisible();
    await expect(page.locator("textarea"), "nada de conteúdo com PIN errado").toHaveCount(0);
  });

  test("PIN certo destranca o diário", async () => {
    await pinField(page).fill(DIARY_PIN);
    await unlockBtn(page).click();

    // Destrancou: o gate some e o editor (textarea) aparece. Não lemos/escrevemos
    // conteúdo — só provamos a transição trancado → destrancado.
    await expect(unlockBtn(page), "o gate deveria sumir após o PIN certo").toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(page.locator("textarea"), "o editor deveria aparecer destrancado").toBeVisible({
      timeout: 15_000,
    });
  });
});

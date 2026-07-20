import { expect, test } from "@playwright/test";

// Módulos logados que devem abrir sem erro pra um usuário autenticado.
// (/diario tem gate de PIN próprio — testado à parte, sem tocar no conteúdo.)
const MODULES = [
  "/",
  "/financas",
  "/treino",
  "/dieta",
  "/metas",
  "/rotina",
  "/notas",
  "/leitura",
  "/toube",
  "/config",
  "/notificacoes",
  "/busca",
];

test.describe("smoke — navegação autenticada", () => {
  test("a sessão de teste está logada (não cai no /login)", async ({ page }) => {
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
  });

  for (const path of MODULES) {
    test(`abre ${path} sem erro`, async ({ page }) => {
      const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(resp?.status(), `${path} deveria responder < 400`).toBeLessThan(400);
      await expect(page, `${path} não deve redirecionar pro login`).not.toHaveURL(/\/login/);
      // Sem tela de erro fatal do Next/React.
      await expect(page.getByText(/Application error|Unhandled Runtime|500/i)).toHaveCount(0);
    });
  }
});

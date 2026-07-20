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

// Texto de qualquer tela de falha: os erros fatais do Next/React E o error boundary
// PRÓPRIO do app ("Algo quebrou / Essa tela teve um soluço"), que responde 200 e por
// isso escapava do check de status — foi o que mascarou um crash de RSC na dieta.
const ERROR_SCREEN = /Application error|Unhandled Runtime|500|Algo quebrou|teve um soluço/i;

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
      // Sem tela de erro fatal do Next/React nem o error boundary do app.
      await expect(page.getByText(ERROR_SCREEN)).toHaveCount(0);
    });
  }

  // Buraco fechado: abrir /dieta numa conta ZERADA cai no estado vazio (foods=0) e
  // NÃO renderiza os MealCards — foi assim que um crash de RSC (ícone passado de
  // Server→Client) passou despercebido por só disparar com ≥1 alimento. Aqui semeamos
  // 1 alimento e exigimos que a aba Hoje renderize os cards de refeição de verdade.
  test("dieta: aba Hoje renderiza com ≥1 alimento (não cai no error boundary)", async ({
    page,
  }) => {
    test.slow();
    page.on("dialog", (d) => d.accept()); // "Apagar" no cleanup dispara confirm
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const foodName = `SMOKE food ${stamp}`;
    const foodRow = page.locator("li").filter({ hasText: foodName });

    try {
      // Semeia um alimento (senão a aba Hoje mostra só "sem alimentos cadastrados").
      await page.goto("/dieta?t=alimentos", { waitUntil: "domcontentloaded" });
      await page.locator('input[name="name"]').fill(foodName);
      await page.locator('input[name="kcal_per_100g"]').fill("100");
      await page.getByRole("button", { name: "Adicionar" }).click();
      await expect(foodRow, "o alimento semeado deve aparecer no catálogo").toBeVisible({
        timeout: 10_000,
      });

      // Com ≥1 alimento a aba Hoje renderiza os MealCards — o branch que crashava.
      await page.goto("/dieta?t=hoje", { waitUntil: "domcontentloaded" });
      await expect(
        page.getByRole("heading", { name: "Café da manhã" }),
        "a aba Hoje deve renderizar os cards de refeição, não o error boundary",
      ).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(ERROR_SCREEN), "a aba Hoje não pode cair em erro").toHaveCount(0);
    } finally {
      // Cleanup: remove o alimento semeado.
      await page.goto("/dieta?t=alimentos", { waitUntil: "domcontentloaded" }).catch(() => {});
      for (let i = 0; i < 3 && (await foodRow.count().catch(() => 0)) > 0; i++) {
        await foodRow.first().getByRole("button", { name: "Apagar" }).click();
        await expect(foodRow)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    }
  });
});

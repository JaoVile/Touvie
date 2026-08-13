import { expect, test } from "@playwright/test";

/**
 * Barra de navegação inferior personalizável.
 *
 * ⚠️ A barra de baixo só existe em `<sm` (no desktop a navegação é a barra de
 * cima, com todos os módulos). Sem viewport de celular ela nem é renderizada e
 * o teste passaria/falharia por motivo errado — por isso o `test.use` abaixo.
 *
 * Restaura a seleção padrão no fim, senão o teste muda a barra do usuário de
 * teste pros outros specs.
 */

test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14-ish

const DEFAULT = ["Hoje", "Finanças", "Treino", "Dieta"];

/** Rótulos visíveis na barra inferior (sem "Mais" e "Config", que são fixos). */
async function barLabels(page: import("@playwright/test").Page): Promise<string[]> {
  const nav = page.locator("nav.sm\\:hidden");
  const texts = await nav.locator("a span, button span").allInnerTexts();
  return texts.map((s) => s.trim()).filter((s) => s && s !== "Mais" && s !== "Config");
}

test.describe("Barra de navegação personalizável", () => {
  test.afterEach(async ({ page }) => {
    // Volta pro padrão pra não contaminar os outros specs.
    await page.goto("/config?tab=aparencia");
    const current = await barLabels(page).catch(() => []);
    if (JSON.stringify(current) === JSON.stringify(DEFAULT)) return;
    for (const label of ["Metas", "Notas", "Leitura", "Rotina", "Toube", "Diário", "Notifs"]) {
      const btn = page.getByRole("button", { name: label, exact: true });
      if ((await btn.count()) && (await btn.getAttribute("aria-pressed")) === "true") {
        await btn.click();
      }
    }
    for (const label of DEFAULT) {
      const btn = page.getByRole("button", { name: label, exact: true });
      if ((await btn.count()) && (await btn.getAttribute("aria-pressed")) === "false") {
        await btn.click();
      }
    }
    const save = page.getByRole("button", { name: "Salvar barra" });
    if (await save.isEnabled()) await save.click();
  });

  test("a barra de baixo reflete a escolha feita nas configurações", async ({ page }) => {
    await page.goto("/");
    expect(await barLabels(page)).toEqual(DEFAULT);

    await page.goto("/config?tab=aparencia");
    // Tira Dieta, põe Metas.
    await page.getByRole("button", { name: "Dieta", exact: true }).click();
    await page.getByRole("button", { name: "Metas", exact: true }).click();
    await page.getByRole("button", { name: "Salvar barra" }).click();
    await expect(page.getByText("Barra atualizada.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/");
    const labels = await barLabels(page);
    expect(labels).toContain("Metas");
    expect(labels).not.toContain("Dieta");
    expect(labels).toHaveLength(4);
  });

  test("não deixa passar de 4 escolhidos", async ({ page }) => {
    await page.goto("/config?tab=aparencia");
    // Com 4 já marcados, os não-marcados ficam desabilitados.
    await expect(page.getByRole("button", { name: "Metas", exact: true })).toBeDisabled();
    // Desmarcando um, o quinto volta a ser clicável.
    await page.getByRole("button", { name: "Dieta", exact: true }).click();
    await expect(page.getByRole("button", { name: "Metas", exact: true })).toBeEnabled();
  });
});

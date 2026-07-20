import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Acessibilidade (WCAG) com axe-core. Falha só em violações CRÍTICAS/SÉRIAS
// (as que realmente travam quem usa leitor de tela/teclado); as menores são
// logadas pra a gente ir limpando aos poucos, sem virar um portão irritante.
const PAGES = ["/", "/financas", "/metas", "/notas", "/config"];

for (const path of PAGES) {
  test(`a11y — ${path} sem violação crítica/séria`, async ({ page }, testInfo) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    // Anexa o relatório completo pra inspeção (inclusive as menores).
    await testInfo.attach(`axe-${path.replace(/\//g, "_") || "root"}`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: "application/json",
    });
    expect(blocking, `${path}: ${blocking.map((v) => v.id).join(", ")}`).toEqual([]);
  });
}

import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * CRUD do módulo ROTINA — aba SEMANAL (/rotina?tab=semanal).
 *
 * O `crud/rotina.spec.ts` cobre a aba Diária (bloco do dia). Este cobre a grade
 * SEMANAL (tabela `routine_weekly`): 7 cards (Segunda…Domingo), cada um com um
 * toggle "Adicionar" que abre o `WeeklyForm` (TimePicker name="block" default
 * 07:00, EmojiPicker, input[name="title"] required, notas) → "Salvar" cria o bloco.
 * Cada bloco vira um `WeeklyRow` com o horário + título + botão "×" (confirm
 * "Apagar?"). NÃO há editar in-place na Semanal — só criar e apagar.
 *
 * Seletores confirmados no código (app/(app)/rotina/WeeklyGrid.tsx). Deixo o
 * TimePicker no default "07:00" (não interajo com o popover — não preciso de um
 * horário específico). Usa a sessão autenticada global. Limpa no afterEach.
 */

const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const marker = `E2E semanal ${stamp}`;
const DAY = "Segunda"; // card onde criamos o bloco

// Card (GlassCard = div.glass) do dia cujo <h3> é `DAY`.
const dayCard = (page: Page): Locator =>
  page
    .locator("div.glass")
    .filter({ has: page.getByRole("heading", { level: 3, name: DAY, exact: true }) });
// Linha do bloco com o marcador (título único).
const blockRow = (page: Page): Locator => page.locator("li").filter({ hasText: marker });

/** Clica até o alvo aparecer — cobre clique pré-hidratação no 1º hit da rota. */
async function clickUntil(button: Locator, target: Locator, timeout = 25_000) {
  await expect(async () => {
    if (await button.isVisible().catch(() => false)) await button.click({ timeout: 3_000 });
    await expect(target).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout });
}

test.describe.configure({ mode: "serial" });

test.describe("CRUD — rotina (semanal)", () => {
  test.beforeEach(async ({ page }) => {
    // Rota compila sob demanda + Server Action revalida — fluxo multi-passo estoura
    // o timeout padrão sob contenção. slow() triplica (→90s).
    test.slow();
    // O "×" de apagar dispara confirm("Apagar?") — auto-aceita.
    page.on("dialog", (d) => d.accept());
  });

  test.afterEach(async ({ page }) => {
    // Rede de segurança: apaga qualquer bloco com o marcador.
    try {
      await page.goto("/rotina?tab=semanal", { waitUntil: "domcontentloaded" });
      const row = blockRow(page);
      for (let i = 0; i < 5 && (await row.count().catch(() => 0)) > 0; i++) {
        await row.first().getByRole("button", { name: "×" }).click();
        await expect(row)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
  });

  test("cria um bloco semanal, ele aparece no dia e é apagado", async ({ page }) => {
    await page.goto("/rotina?tab=semanal", { waitUntil: "domcontentloaded" });
    const card = dayCard(page);
    await expect(card, "o card do dia deve renderizar").toBeVisible({ timeout: 15_000 });

    // ── CRIAR ────────────────────────────────────────────────────────────────
    // "Adicionar" abre o WeeklyForm nesse card (o botão vira "Fechar"); clickUntil
    // cobre o 1º clique pré-hidratação sem re-togglar (só re-clica enquanto o texto
    // ainda é "Adicionar").
    const title = card.locator('input[name="title"]');
    await clickUntil(card.getByRole("button", { name: "Adicionar" }), title);
    await title.fill(marker);
    // TimePicker fica no default 07:00; emoji/notas ficam vazios.
    await card.getByRole("button", { name: "Salvar" }).click();

    // O bloco aparece no card do dia, com o marcador e o horário default.
    const row = blockRow(page);
    await expect(row, "o bloco criado deve aparecer no dia").toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("07:00");

    // ── PERSISTE após reload ─────────────────────────────────────────────────
    await page.reload();
    await expect(blockRow(page), "o bloco persiste após reload").toBeVisible({ timeout: 10_000 });

    // ── APAGAR ───────────────────────────────────────────────────────────────
    await blockRow(page).getByRole("button", { name: "×" }).click();
    await expect(blockRow(page), "o bloco some ao apagar").toHaveCount(0, { timeout: 10_000 });
  });
});

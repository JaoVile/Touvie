import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * CRUD do módulo Dieta — REFEIÇÕES do dia (a "cadeia funda": foods → meals →
 * meal_items).
 *
 * O `crud/dieta.spec.ts` cobre só as medidas corporais. Este spec cobre o fluxo
 * REAL da aba **Hoje** (`/dieta?t=hoje`):
 *
 *   catálogo (cria um food carimbado) → card da refeição (MealCard, ex.: Café da
 *   manhã) → "+ adicionar item" → escolhe o food no <select> → grams auto-preenche
 *   pela porção padrão (serving_g) → "+" (addMealItem cria a `meals` se faltar e
 *   insere o `meal_items`) → o item aparece com gramas + kcal e o header soma os
 *   macros → apaga o item (× "Remover").
 *
 * Macros: food com valores REDONDOS (217 kcal/100g, P30/C10/G5, porção 100g) pra a
 * asserção bater no formato da TELA — o item mostra `formatGrams(g) · round(kcal)`
 * e o header mostra `round(kcal) · P.. · C.. · G..` (macrosFor arredonda 1 casa).
 *
 * Limpeza (afterEach) respeita a FK: `meal_items.food_id` é ON DELETE RESTRICT e
 * `meal_items.meal_id` é ON DELETE CASCADE → apaga a REFEIÇÃO primeiro (cascata nos
 * itens) e SÓ DEPOIS o food do catálogo. Usa a sessão autenticada global.
 *
 * Padrões anti-flake (dev compila sob demanda):
 *  - `clickUntil` cobre cliques disparados ANTES da hidratação (toggle "+ adicionar
 *    item" no 1º hit da rota).
 *  - o submit "+" NÃO usa clickUntil pra não arriscar duplicar o item — espera o
 *    POST do server action (waitForResponse). A essa altura o card já provou estar
 *    hidratado (o toggle e o <select> funcionaram).
 *
 * Histórico: este spec revelou um bug RSC — `HojeTab` (Server) passava um componente
 * lucide como prop `icon` pro `MealCard` (Client), o que NÃO serializa e derrubava a
 * aba Hoje ("Functions cannot be passed directly to Client Components") pra qualquer
 * usuário com ≥1 alimento. CORRIGIDO: o `MealCard` (client) agora escolhe o ícone por
 * `mealType`. O spec voltou a ser um guarda de regressão verde de verdade.
 */

const HOJE_URL = "/dieta?t=hoje";
const ALIMENTOS_URL = "/dieta?t=alimentos";
const MEAL_LABEL = "Café da manhã"; // MEAL_TYPE_LABELS.breakfast

// Food carimbado com macros redondos (per 100g) pra asserção no formato da tela.
const FOOD_KCAL = "217";
const FOOD_PROTEIN = "30";
const FOOD_CARB = "10";
const FOOD_FAT = "5";
const FOOD_SERVING = "100"; // grams auto-preenche com isso ao escolher o food

/**
 * Clica `button` até `target` aparecer — cobre o clique disparado antes da
 * hidratação. Re-clica só ENQUANTO o botão segue visível; SÓ pra botões que
 * somem/trocam após a ação (não pra submits que persistem — duplicaria).
 */
async function clickUntil(button: Locator, target: Locator, timeout = 25_000) {
  await expect(async () => {
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 3_000 });
    }
    await expect(target).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout });
}

/** Espera o POST do server action de /dieta concluir (useTransition pendente). */
function dietaAction(page: Page) {
  return page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/dieta"));
}

/** O GlassCard (div.glass) do MealCard cujo <h3> é a refeição pedida. */
function mealCard(page: Page, label: string): Locator {
  const heading = page.getByRole("heading", { level: 3, name: label, exact: true });
  return page.locator("div.glass").filter({ has: heading });
}

// Carimbo do food criado, pra limpeza garantida mesmo se o teste falhar.
let createdFoodName: string | null = null;

/** Apaga a refeição de hoje pela UI (cascata nos itens), se houver. Tolerante. */
async function deleteMealForToday(page: Page, label: string) {
  await page.goto(HOJE_URL, { waitUntil: "domcontentloaded" });
  const card = mealCard(page, label);
  const clearBtn = card.getByRole("button", { name: "apagar refeição" });
  if (await clearBtn.isVisible().catch(() => false)) {
    page.once("dialog", (d) => d.accept());
    await clearBtn.click().catch(() => {});
    // Some quando a meal vai embora (o card volta ao estado sem itens/notas).
    await expect(clearBtn)
      .toHaveCount(0, { timeout: 10_000 })
      .catch(() => {});
  }
}

/** Apaga um food do catálogo pelo nome, se ainda existir. Tolerante. */
async function removeFoodByName(page: Page, name: string) {
  await page.goto(ALIMENTOS_URL, { waitUntil: "domcontentloaded" });
  const row = page.locator("li").filter({ hasText: name });
  if ((await row.count().catch(() => 0)) > 0) {
    page.once("dialog", (d) => d.accept());
    await row
      .first()
      .getByRole("button", { name: "Apagar" })
      .click()
      .catch(() => {});
    await expect(row)
      .toHaveCount(0, { timeout: 10_000 })
      .catch(() => {});
  }
}

test.describe.configure({ mode: "serial" });

test.describe("CRUD — dieta (refeições do dia)", () => {
  test.slow(); // vários passos numa rota que o dev compila sob demanda

  test.afterEach(async ({ page }) => {
    // Ordem importa: apaga a refeição (cascata nos meal_items) ANTES do food —
    // deleteFood é RESTRICT e falha se sobrar item referenciando o alimento.
    await deleteMealForToday(page, MEAL_LABEL).catch(() => {});
    if (createdFoodName) {
      await removeFoodByName(page, createdFoodName).catch(() => {});
      createdFoodName = null;
    }
  });

  test("adiciona um alimento à refeição, confere macros e apaga (com limpeza)", async ({
    page,
  }) => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const foodName = `E2E refeicao ${stamp}`;
    createdFoodName = foodName;

    // ---- SETUP: cria o food carimbado no catálogo ----
    await page.goto(ALIMENTOS_URL, { waitUntil: "domcontentloaded" });
    const nameInput = page.locator('input[name="name"]');
    await expect(nameInput, "form de novo alimento deveria estar visível").toBeVisible({
      timeout: 15_000,
    });
    await nameInput.fill(foodName);
    await page.locator('input[name="kcal_per_100g"]').fill(FOOD_KCAL);
    await page.locator('input[name="protein_g"]').fill(FOOD_PROTEIN);
    await page.locator('input[name="carb_g"]').fill(FOOD_CARB);
    await page.locator('input[name="fat_g"]').fill(FOOD_FAT);
    await page.locator('input[name="serving_g"]').fill(FOOD_SERVING);
    await page.getByRole("button", { name: "Adicionar" }).click();

    // O food aparece no catálogo (verdade renderizada no servidor, independe de
    // hidratação — cobre inclusive o caso de submit nativo pré-hidratação).
    const catalogRow = page.locator("li").filter({ hasText: foodName });
    await expect(catalogRow, "food criado deve aparecer no catálogo").toBeVisible({
      timeout: 15_000,
    });

    // ---- ABRE A REFEIÇÃO E ADICIONA O ITEM ----
    await page.goto(HOJE_URL, { waitUntil: "domcontentloaded" });
    const card = mealCard(page, MEAL_LABEL);
    await expect(card, "card da refeição deve renderizar").toBeVisible({ timeout: 15_000 });

    // Toggle "+ adicionar item" → abre o <select>. clickUntil cobre a hidratação
    // (o toggle é state client puro e some quando o form aparece).
    const addItemBtn = card.getByRole("button", { name: "+ adicionar item" });
    const select = card.locator("select");
    await clickUntil(addItemBtn, select);

    // Escolhe o food; grams auto-preenche com a porção padrão (serving_g=100).
    await select.selectOption({ label: foodName });
    const gramsInput = card.getByPlaceholder("g");
    await expect(gramsInput, "grams deve auto-preencher com a porção padrão").toHaveValue(
      FOOD_SERVING,
    );

    // O submit "+" NÃO persiste após sucesso (adding=false), mas evito clickUntil
    // pra zero risco de duplicar → espero o POST do server action. O card já está
    // hidratado (toggle + select funcionaram).
    const added = dietaAction(page);
    await card.getByRole("button", { name: "+", exact: true }).click();
    await added;

    // ---- VERIFICA o item e os macros na TELA ----
    // Item: "<nome> ... 100 g · 217 kcal" (formatGrams + Math.round(kcal)).
    const itemRow = card.locator("li").filter({ hasText: foodName });
    await expect(itemRow, "item adicionado deve aparecer no card").toBeVisible({
      timeout: 10_000,
    });
    await expect(itemRow).toContainText("100 g");
    await expect(itemRow).toContainText("217 kcal");

    // Header do card soma os macros: "217 kcal · P 30 · C 10 · G 5".
    await expect(card, "header do card deve somar kcal do item").toContainText("217 kcal");
    await expect(card).toContainText("P 30");
    await expect(card).toContainText("C 10");
    await expect(card).toContainText("G 5");

    // Persistência: num render fresco do servidor o item continua lá.
    await page.goto(HOJE_URL, { waitUntil: "domcontentloaded" });
    const cardAfter = mealCard(page, MEAL_LABEL);
    const itemAfter = cardAfter.locator("li").filter({ hasText: foodName });
    await expect(itemAfter, "item deve persistir após reload").toBeVisible({ timeout: 10_000 });
    await expect(itemAfter).toContainText("217 kcal");

    // ---- APAGA o item (× "Remover") ----
    const removed = dietaAction(page);
    await itemAfter.getByRole("button", { name: "Remover" }).click();
    await removed;

    await expect(itemAfter, "item apagado não deve mais aparecer").toHaveCount(0, {
      timeout: 10_000,
    });

    // afterEach faz o resto (apaga a refeição vazia + o food do catálogo).
  });
});

import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * CRUD do módulo Treino — LOG DE SÉRIE (a "cadeia funda", `exercise_logs`).
 *
 * O `crud/treino.spec.ts` cobre os CRUDs rasos (catálogo de exercícios e programas).
 * Este spec cobre o fluxo REAL de registrar séries na aba **Hoje** (`/treino`):
 *
 *   catálogo → sessão do dia (StartSessionButton) → adicionar exercício ad-hoc no
 *   SessionLogger → registrar UMA série (peso/reps/RPE) → ela aparece na lista →
 *   apagar a série (× "Apagar série").
 *
 * Só existe UI de EDIÇÃO de set via "apagar + registrar de novo" — o SessionLogger
 * NÃO expõe editar-in-place um `exercise_log` (embora `saveLog` suporte update por
 * id). Isso é anotado como gap, não como bug.
 *
 * Conta de teste é ZERADA: cria um exercício carimbado, abre a sessão de hoje e
 * LIMPA tudo no afterEach (apaga a sessão do dia — cascata nos logs — e depois o
 * exercício do catálogo). Usa a sessão autenticada global (storageState).
 *
 * Padrões anti-flake (dev compila sob demanda):
 *  - `clickUntil` cobre o clique disparado ANTES da hidratação no 1º hit da rota.
 *  - o submit de série (botão "+") NÃO usa clickUntil (o botão persiste pra próxima
 *    série → re-clicar duplicaria o set); usa waitForResponse do server action.
 */

const HOJE_URL = "/treino";
const PROGRAMAS_URL = "/treino?t=programas";

/**
 * Clica `button` até `target` aparecer — cobre o clique pré-hidratação (botão no
 * SSR, onClick do React ainda não conectado). Re-clica só ENQUANTO o botão segue
 * visível; SÓ para botões que somem/trocam após a ação (não pra submits que ficam).
 */
async function clickUntil(button: Locator, target: Locator, timeout = 25_000) {
  await expect(async () => {
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 3_000 });
    }
    await expect(target).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout });
}

/** Espera o POST do server action de /treino concluir (useTransition pendente). */
function treinoAction(page: Page) {
  return page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/treino"),
  );
}

// Carimbo do exercício criado, pra limpeza garantida mesmo se o teste falhar.
let createdExerciseName: string | null = null;

/** Apaga a sessão de hoje pela UI (cascata nos logs), se houver. Tolerante. */
async function deleteTodaySession(page: Page) {
  await page.goto(HOJE_URL, { waitUntil: "domcontentloaded" });
  const endBtn = page.getByRole("button", { name: "apagar sessão de hoje" });
  if (await endBtn.isVisible().catch(() => false)) {
    page.once("dialog", (d) => d.accept());
    await endBtn.click().catch(() => {});
    // Some da tela quando a sessão vai embora (volta ao preview/empty state).
    await expect(endBtn)
      .toHaveCount(0, { timeout: 10_000 })
      .catch(() => {});
  }
}

/** Apaga um exercício do catálogo pelo nome, se ainda existir. Tolerante. */
async function removeExerciseByName(page: Page, name: string) {
  await page.goto(PROGRAMAS_URL, { waitUntil: "domcontentloaded" });
  const item = page.locator("li").filter({ hasText: name });
  if ((await item.count().catch(() => 0)) > 0) {
    page.once("dialog", (d) => d.accept());
    await item
      .first()
      .getByRole("button", { name: "Apagar" })
      .click()
      .catch(() => {});
    await expect(page.getByText(name, { exact: false }))
      .toHaveCount(0, { timeout: 10_000 })
      .catch(() => {});
  }
}

test.describe.configure({ mode: "serial" });

test.describe("CRUD — treino (log de série)", () => {
  test.slow(); // vários passos numa rota que o dev compila sob demanda

  test.afterEach(async ({ page }) => {
    // Ordem importa: apaga a sessão (cascata nos logs) ANTES do exercício —
    // deleteExercise falha por FK se sobrar algum log referenciando o exercício.
    await deleteTodaySession(page).catch(() => {});
    if (createdExerciseName) {
      await removeExerciseByName(page, createdExerciseName).catch(() => {});
      createdExerciseName = null;
    }
  });

  test("registra uma série, ela aparece e é apagada (com limpeza)", async ({ page }) => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const exName = `E2E log ${stamp}`;
    createdExerciseName = exName;

    // ---- SETUP: cria um exercício no catálogo (sem grupo → label do <option> no
    // picker é exatamente o nome, sem sufixo " (Grupo)"). ----
    await page.goto(PROGRAMAS_URL);
    const addNameInput = page.getByPlaceholder("Nome (Supino reto)");
    await addNameInput.fill(exName);
    await page.getByRole("button", { name: "+", exact: true }).click();
    await expect(addNameInput, "form de exercício reseta no sucesso").toHaveValue("", {
      timeout: 10_000,
    });

    // ---- ABRE A SESSÃO DE HOJE ----
    await page.goto(HOJE_URL, { waitUntil: "domcontentloaded" });

    // Estado: ou já existe sessão ("Em andamento") ou há botão de iniciar
    // (StartSessionButton: "Iniciar treino" com dia planejado, senão "Treino livre").
    const emAndamento = page.getByText("Em andamento");
    const startBtn = page.getByRole("button", { name: /Iniciar treino|Treino livre/ });
    await expect(startBtn.or(emAndamento).first()).toBeVisible({ timeout: 15_000 });
    if (await startBtn.isVisible().catch(() => false)) {
      await clickUntil(startBtn, emAndamento);
    }
    await expect(emAndamento, "SessionLogger deve estar em andamento").toBeVisible();

    // ---- ADICIONA O EXERCÍCIO AO SessionLogger ----
    // Se a sessão já tem exercícios, o picker fica atrás de "+ Adicionar outro
    // exercício"; se está vazia, o <select> aparece direto.
    const addOther = page.getByRole("button", { name: /Adicionar outro exercício/ });
    const picker = page.locator("select").filter({ hasText: "Escolha do catálogo" });
    await expect(addOther.or(picker).first()).toBeVisible({ timeout: 10_000 });
    if (await addOther.isVisible().catch(() => false)) {
      await clickUntil(addOther, picker);
    }
    await picker.selectOption({ label: exName });
    const heading = page.getByRole("heading", { level: 3, name: exName, exact: true });
    // "Adicionar" do picker é state client puro (adhoc) → o bloco aparece; clickUntil
    // cobre a hidratação e para sozinho quando o botão some.
    await clickUntil(page.getByRole("button", { name: "Adicionar", exact: true }), heading);

    // Bloco do exercício = o GlassCard (div.glass) que contém o heading + o input "kg".
    const block = page
      .locator("div.glass")
      .filter({ has: heading })
      .filter({ has: page.getByPlaceholder("kg") });
    await expect(block).toHaveCount(1);

    // ---- REGISTRA A SÉRIE (peso 20 kg × 10 reps @RPE 8) ----
    await block.getByPlaceholder("kg").fill("20");
    await block.getByPlaceholder("reps").fill("10");
    await block.getByPlaceholder("RPE").fill("8");

    // O submit "+" persiste (pra próxima série) → nada de clickUntil; espera o POST.
    const saved = treinoAction(page);
    await block.getByRole("button", { name: "+", exact: true }).click();
    await saved;

    // A série aparece na lista do bloco: "#1  20 kg × 10 @8" (formatSet). O "×" é
    // U+00D7 → uso regex pra não depender do glifo exato.
    const setRow = block.getByText(/20\s*kg.*10.*@8/);
    await expect(setRow, "a série registrada deve aparecer no bloco").toBeVisible({
      timeout: 10_000,
    });
    await expect(block.getByText("#1")).toBeVisible();

    // Persistência: num render fresco do servidor a série continua lá.
    await page.goto(HOJE_URL, { waitUntil: "domcontentloaded" });
    const blockAfter = page
      .locator("div.glass")
      .filter({ has: page.getByRole("heading", { level: 3, name: exName, exact: true }) })
      .filter({ has: page.getByPlaceholder("kg") });
    await expect(blockAfter.getByText(/20\s*kg.*10.*@8/)).toBeVisible({ timeout: 10_000 });

    // ---- APAGA A SÉRIE (× "Apagar série") ----
    const deleted = treinoAction(page);
    await blockAfter.getByRole("button", { name: "Apagar série" }).first().click();
    await deleted;

    await expect(
      page.getByText(/20\s*kg.*10.*@8/),
      "a série apagada não deve mais aparecer",
    ).toHaveCount(0, { timeout: 10_000 });

    // afterEach faz o resto (apaga sessão do dia + exercício do catálogo).
  });
});

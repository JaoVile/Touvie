import { type Page, expect, test } from "@playwright/test";

/**
 * CRUD do módulo Treino (/treino) — aba "Programas".
 *
 * ⚠️ Treino é o módulo mais fundo do app. Logar uma SÉRIE (`exercise_logs`) exige
 * a cadeia programa → dia → exercício → sessão do dia, e só nesse ponto existe UI
 * de EDIÇÃO (SessionLogger edita/apaga sets). Pra um E2E confiável, este spec cobre
 * os dois CRUDs mais rasos e independentes que a UI expõe de fato:
 *
 *   1. Catálogo de exercícios (tabela `exercises`) — criar → editar → apagar.
 *   2. Programa (tabela `workout_programs`)         — criar → editar → apagar.
 *
 * EDIÇÃO: ambos ganharam o botão de lápis (aria-label "Editar exercício"/"Editar
 * programa") que abre o form inline preenchido, no mesmo padrão de finanças
 * (`saveExercise`/`saveProgram` já faziam UPDATE via `id`). O log de série completo
 * (com edição de set no SessionLogger) fica como spec futuro — precisa de setup
 * profundo (programa → dia → exercício → sessão) e está fora do escopo aqui.
 *
 * Conta de teste é ZERADA: cada teste cria e limpa o que criou (afterEach + nome
 * com carimbo único), sem deixar lixo no banco. Usa a sessão autenticada global.
 */

const PROGRAMAS_URL = "/treino?t=programas";

/**
 * Espera a Server Action de /treino concluir (o POST que o `useTransition` dispara).
 * Necessário porque o botão vira "Salvando…"/"…" durante o pending — então esperar
 * o form "sumir" pelo rótulo daria falso-positivo e navegar cedo abortaria o UPDATE.
 */
function treinoAction(page: Page) {
  return page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().includes("/treino"),
  );
}

// Nomes carimbados dos itens criados, pra limpeza garantida mesmo se o teste falhar.
let createdExerciseName: string | null = null;
let createdProgramName: string | null = null;

/** Remove um exercício do catálogo pelo nome, se ainda existir (tolerante). */
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

/** Remove um programa pelo nome, se ainda existir (tolerante). */
async function removeProgramByName(page: Page, name: string) {
  await page.goto(PROGRAMAS_URL, { waitUntil: "domcontentloaded" });
  const card = page.locator("div.rounded-xl").filter({ hasText: name });
  if ((await card.count().catch(() => 0)) > 0) {
    page.once("dialog", (d) => d.accept());
    await card
      .first()
      .getByRole("button", { name: "apagar", exact: true })
      .click()
      .catch(() => {});
    await expect(page.getByText(name, { exact: false }))
      .toHaveCount(0, { timeout: 10_000 })
      .catch(() => {});
  }
}

test.describe("CRUD — treino", () => {
  test.afterEach(async ({ page }) => {
    if (createdExerciseName) {
      await removeExerciseByName(page, createdExerciseName).catch(() => {});
      createdExerciseName = null;
    }
    if (createdProgramName) {
      await removeProgramByName(page, createdProgramName).catch(() => {});
      createdProgramName = null;
    }
  });

  test("catálogo de exercícios: cria e apaga (com limpeza)", async ({ page }) => {
    const name = `E2E treino ex ${Date.now()}`;
    createdExerciseName = name;

    await page.goto(PROGRAMAS_URL);

    // ---- CREATE ----
    const nameInput = page.getByPlaceholder("Nome (Supino reto)");
    await nameInput.fill(name);
    await page.locator('select[name="muscle_group"]').selectOption("Peito");
    // O botão de submit do form de exercício tem rótulo exatamente "+".
    await page.getByRole("button", { name: "+", exact: true }).click();

    // saveExercise com sucesso → o form dá reset() (input volta a vazio). Esse é o
    // sinal de que a server action concluiu sem erro de validação.
    await expect(nameInput).toHaveValue("", { timeout: 10_000 });

    // Confirma persistência num render fresco do servidor (revalidatePath).
    await page.goto(PROGRAMAS_URL);
    const item = page.locator("li").filter({ hasText: name });
    await expect(item, "o exercício criado deve aparecer no catálogo").toHaveCount(1);
    // Foi criado sob o grupo escolhido → heading "Peito" presente.
    await expect(page.getByRole("heading", { name: "Peito" })).toBeVisible();

    // ---- DELETE ----
    page.once("dialog", (d) => {
      expect(d.type()).toBe("confirm");
      expect(d.message()).toContain(name);
      d.accept();
    });
    await item.getByRole("button", { name: "Apagar" }).click();

    await expect(
      page.getByText(name, { exact: false }),
      "o exercício apagado não deve mais aparecer",
    ).toHaveCount(0, { timeout: 10_000 });

    // Delete concluído: afterEach não precisa limpar.
    createdExerciseName = null;
  });

  test("programa: cria e apaga (com limpeza)", async ({ page }) => {
    const name = `E2E treino prog ${Date.now()}`;
    createdProgramName = name;

    await page.goto(PROGRAMAS_URL);

    // ---- CREATE ----
    const nameInput = page.getByPlaceholder("Nome do programa");
    await nameInput.fill(name);
    await page.getByRole("button", { name: "Criar" }).click();

    // ProgramForm dá reset() no sucesso → input volta a vazio.
    await expect(nameInput).toHaveValue("", { timeout: 10_000 });

    // Confirma persistência num render fresco.
    await page.goto(PROGRAMAS_URL);
    await expect(
      page.getByText(name, { exact: true }),
      "o programa criado deve aparecer na lista",
    ).toBeVisible();

    // ---- DELETE ----
    const card = page.locator("div.rounded-xl").filter({ hasText: name });
    page.once("dialog", (d) => {
      expect(d.type()).toBe("confirm");
      expect(d.message()).toContain(name);
      d.accept();
    });
    await card.getByRole("button", { name: "apagar", exact: true }).click();

    await expect(
      page.getByText(name, { exact: true }),
      "o programa apagado não deve mais aparecer",
    ).toHaveCount(0, { timeout: 10_000 });

    createdProgramName = null;
  });

  test("catálogo de exercícios: edita o nome inline (com limpeza)", async ({ page }) => {
    const name = `E2E treino ex edit ${Date.now()}`;
    const renamed = `${name} atualizado`;
    createdExerciseName = name;

    await page.goto(PROGRAMAS_URL);

    // ---- CREATE ----
    const addNameInput = page.getByPlaceholder("Nome (Supino reto)").first();
    await addNameInput.fill(name);
    await page.locator('select[name="muscle_group"]').first().selectOption("Peito");
    await page.getByRole("button", { name: "+", exact: true }).click();
    await expect(addNameInput).toHaveValue("", { timeout: 10_000 });

    await page.goto(PROGRAMAS_URL);
    const item = page.locator("li").filter({ hasText: name });
    await expect(item).toHaveCount(1);

    // ---- UPDATE ----
    // Abre o form inline pelo lápis (aria-label "Editar exercício").
    await item.getByRole("button", { name: "Editar exercício" }).click();

    // O form de edição é o único com botão "Atualizar" — isola do form de adicionar
    // (que usa "+"), já que ambos compartilham o placeholder do nome.
    const editForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Atualizar" }) });
    const editNameInput = editForm.getByPlaceholder("Nome (Supino reto)");
    await expect(editNameInput).toHaveValue(name);
    await editNameInput.fill(renamed);
    createdExerciseName = renamed; // cleanup passa a mirar o nome novo
    const updated = treinoAction(page);
    await editForm.getByRole("button", { name: "Atualizar" }).click();
    await updated; // garante que o UPDATE terminou antes de navegar

    // Após revalidar, o nome novo aparece e o antigo some.
    await page.goto(PROGRAMAS_URL);
    await expect(
      page.locator("li").filter({ hasText: renamed }),
      "o exercício renomeado deve aparecer",
    ).toHaveCount(1);
    await expect(
      page.getByText(name, { exact: true }),
      "o nome antigo não deve mais existir",
    ).toHaveCount(0);

    // ---- DELETE ----
    const renamedItem = page.locator("li").filter({ hasText: renamed });
    page.once("dialog", (d) => d.accept());
    await renamedItem.getByRole("button", { name: "Apagar" }).click();
    await expect(page.getByText(renamed, { exact: false })).toHaveCount(0, { timeout: 10_000 });
    createdExerciseName = null;
  });

  test("programa: edita o nome inline (com limpeza)", async ({ page }) => {
    const name = `E2E treino prog edit ${Date.now()}`;
    const renamed = `${name} atualizado`;
    createdProgramName = name;

    await page.goto(PROGRAMAS_URL);

    // ---- CREATE ----
    const addNameInput = page.getByPlaceholder("Nome do programa");
    await addNameInput.fill(name);
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(addNameInput).toHaveValue("", { timeout: 10_000 });

    await page.goto(PROGRAMAS_URL);
    const card = page.locator("div.rounded-xl").filter({ hasText: name });
    await expect(card).toHaveCount(1);

    // ---- UPDATE ----
    await card.getByRole("button", { name: "Editar programa" }).click();

    // Form de edição isolado pelo botão "Atualizar" (o "Novo programa" usa "Criar").
    const editForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Atualizar" }) });
    const editNameInput = editForm.getByPlaceholder("Nome do programa");
    await expect(editNameInput).toHaveValue(name);
    await editNameInput.fill(renamed);
    createdProgramName = renamed;
    const updated = treinoAction(page);
    await editForm.getByRole("button", { name: "Atualizar" }).click();
    await updated; // garante que o UPDATE terminou antes de navegar

    await page.goto(PROGRAMAS_URL);
    await expect(
      page.getByText(renamed, { exact: true }),
      "o programa renomeado deve aparecer",
    ).toBeVisible();
    await expect(
      page.getByText(name, { exact: true }),
      "o nome antigo não deve mais existir",
    ).toHaveCount(0);

    // ---- DELETE ----
    const renamedCard = page.locator("div.rounded-xl").filter({ hasText: renamed });
    page.once("dialog", (d) => d.accept());
    await renamedCard.getByRole("button", { name: "apagar", exact: true }).click();
    await expect(page.getByText(renamed, { exact: true })).toHaveCount(0, { timeout: 10_000 });
    createdProgramName = null;
  });
});

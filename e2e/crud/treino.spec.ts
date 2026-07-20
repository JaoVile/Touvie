import { type Page, expect, test } from "@playwright/test";

/**
 * CRUD do módulo Treino (/treino) — aba "Programas".
 *
 * ⚠️ Treino é o módulo mais fundo do app. Logar uma SÉRIE (`exercise_logs`) exige
 * a cadeia programa → dia → exercício → sessão do dia, e só nesse ponto existe UI
 * de EDIÇÃO (SessionLogger edita/apaga sets). Pra um E2E confiável, este spec cobre
 * os dois CRUDs mais rasos e independentes que a UI expõe de fato:
 *
 *   1. Catálogo de exercícios (tabela `exercises`) — criar → apagar.
 *   2. Programa (tabela `workout_programs`)         — criar → apagar.
 *
 * INTENÇÃO / limite honesto: nem `exercises` nem `workout_programs` têm botão de
 * EDITAR na UI (o back-end suporta update via `id` em `saveExercise`/`saveProgram`,
 * mas nenhum componente expõe isso — igual ao gap de "editar lançamento" que já
 * existiu em finanças). Por isso o passo de UPDATE aqui é `test.fixme` documentando
 * o gap, em vez de forçar um teste que não corresponde à UI real. O log de série
 * completo (com edição de set) fica como spec futuro — precisa de setup profundo.
 *
 * Conta de teste é ZERADA: cada teste cria e limpa o que criou (afterEach + nome
 * com carimbo único), sem deixar lixo no banco. Usa a sessão autenticada global.
 */

const PROGRAMAS_URL = "/treino?t=programas";

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

    // ---- UPDATE (gap conhecido) ----
    // Sem botão de editar na UI do catálogo; documentado abaixo em test.fixme.

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

  // GAP de UI: `exercises` e `workout_programs` não têm affordance de EDIÇÃO na tela
  // (o back-end suporta update via `id`, mas nenhum componente o expõe). Registrado
  // como pendência — não é um bug funcional, é falta de UI. Editar de verdade só
  // existe em séries logadas (SessionLogger), que exige o setup profundo.
  test.fixme("editar exercício/programa pela UI (sem botão de editar hoje)", async () => {});
});

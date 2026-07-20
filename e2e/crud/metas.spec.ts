import { type Page, expect, test } from "@playwright/test";

/**
 * CRUD do módulo METAS (/metas) — fluxo feliz completo:
 *   Meta:   criar → editar → concluir → reativar → apagar
 *   Tarefa: criar (ligada a uma meta) → concluir → reativar → apagar
 *
 * Usa a sessão autenticada global (storageState do playwright.config). Cada
 * dado leva um marcador único (`E2E ... ${ts}`) pra localizar sem ambiguidade e
 * não colidir com rodadas paralelas. O `finally` reforça a limpeza mesmo se uma
 * asserção falhar no meio — nada de lixo no banco de teste.
 *
 * A UI de status é OTIMISTA (concluir/reativar/marcar move na hora entre listas);
 * ainda assim asserimos após a revalidação, que persiste no banco.
 */

// ── Locators (confirmados no código: GoalsPanel.tsx / TasksPanel.tsx) ──────────

// Linha de meta ATIVA = <li> com os botões de ação (Editar/Apagar).
function activeGoalRow(page: Page, marker: string) {
  return page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: "Editar meta" }) })
    .filter({ hasText: marker });
}

// Linha de meta CONCLUÍDA = <li> dentro do <details>, com o botão "reativar".
function doneGoalRow(page: Page, marker: string) {
  return page
    .locator("li")
    .filter({ has: page.getByRole("button", { name: "reativar" }) })
    .filter({ hasText: marker });
}

// Linha de tarefa = <li> com checkbox + botão "Apagar tarefa".
// Filtro por CSS (button[aria-label], não getByRole): quando a tarefa está
// concluída ela fica num <details> FECHADO e some da árvore de acessibilidade —
// getByRole não a acharia. CSS acha o elemento mesmo escondido.
function taskRow(page: Page, marker: string) {
  return page
    .locator("li")
    .filter({ has: page.locator('button[aria-label="Apagar tarefa"]') })
    .filter({ hasText: marker });
}

// Checkbox por CSS pelo mesmo motivo: dentro de um <details> fechado o input sai
// da a11y tree; o seletor CSS acha, e toBeChecked lê `checked` sem exigir
// visibilidade.
function taskCheckbox(page: Page, marker: string) {
  return taskRow(page, marker).locator('input[type="checkbox"]');
}

async function openConcludedGoals(page: Page) {
  const summary = page.locator("summary").filter({ hasText: "concluída" });
  if ((await summary.count()) > 0) {
    // <details> começa fechado; abre pra tornar os itens visíveis/clicáveis.
    const details = page.locator("details", { has: summary });
    if (!(await details.first().evaluate((el) => (el as HTMLDetailsElement).open))) {
      await summary.first().click();
    }
  }
}

/**
 * Rede de segurança: apaga toda meta cujo título contenha `marker` (ativa ou
 * concluída). Concluída só some após reativar (o botão Apagar só existe na ativa).
 */
async function cleanupGoal(page: Page, marker: string) {
  await page.goto("/metas", { waitUntil: "domcontentloaded" });

  // Reativa concluídas que casem, pra ganhar o botão Apagar.
  await openConcludedGoals(page);
  while ((await doneGoalRow(page, marker).count()) > 0) {
    await doneGoalRow(page, marker).first().getByRole("button", { name: "reativar" }).click();
    await expect(doneGoalRow(page, marker)).toHaveCount(0, { timeout: 7_000 });
    await openConcludedGoals(page);
  }

  // Apaga as ativas.
  while ((await activeGoalRow(page, marker).count()) > 0) {
    await activeGoalRow(page, marker).first().getByRole("button", { name: "Apagar meta" }).click();
    await expect(activeGoalRow(page, marker)).toHaveCount(0, { timeout: 7_000 });
  }
}

/**
 * Força ABERTO o <details> de TAREFAS concluídas. Desambigua do <details> de
 * METAS concluídas (que também diz "N concluída") pelo checkbox: só tarefas têm
 * um. Seta `open` via DOM (não clica no summary) porque a revalidação da Server
 * Action re-renderiza o <details> nativo e o reseta pra fechado — clicar uma vez
 * não segura; setar `open` na hora do uso é determinístico.
 */
async function openConcludedTasks(page: Page) {
  // Identifica o <details> de tarefas por um checkbox CSS (getByRole não veria o
  // input escondido no <details> fechado — seria impossível achar o que abrir).
  await page.locator('details:has(input[type="checkbox"])').evaluateAll((els) => {
    for (const el of els) (el as HTMLDetailsElement).open = true;
  });
}

async function cleanupTask(page: Page, marker: string) {
  await page.goto("/metas", { waitUntil: "domcontentloaded" });
  while ((await taskRow(page, marker).count()) > 0) {
    await openConcludedTasks(page); // reabre: cada delete revalida e re-fecha
    await expect(async () => {
      await openConcludedTasks(page);
      await taskRow(page, marker)
        .first()
        .getByRole("button", { name: "Apagar tarefa" })
        .click({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await expect(taskRow(page, marker)).toHaveCount(0, { timeout: 7_000 });
  }
}

// Serial: os 2 testes batem no MESMO /metas e disparam Server Actions que
// revalidam a rota. Rodar em paralelo (2 workers) sobre um dev server já
// contendido satura a compilação sob demanda e estoura o timeout. Serial mantém
// um fluxo de cada vez — determinístico, sem brigar consigo mesmo.
test.describe.configure({ mode: "serial" });

test.describe("CRUD — metas", () => {
  // Os botões Apagar/Reativar disparam window.confirm(); aceita todos.
  test.beforeEach(async ({ page }) => {
    // Dev server compila rotas sob demanda (~7s no 1º hit) e cada Server Action
    // revalida /metas — um fluxo de 5 passos estoura o timeout padrão de 30s sob
    // contenção. test.slow() triplica o limite (→90s); não afeta produção/CI.
    test.slow();
    page.on("dialog", (d) => d.accept());
  });

  test("meta: criar → editar → concluir → reativar → apagar", async ({ page }) => {
    const ts = Date.now();
    const marker = `E2E meta ${ts}`; // presente também no título editado
    const created = marker;
    const edited = `${marker} editada`;

    try {
      await page.goto("/metas", { waitUntil: "domcontentloaded" });

      // ── CRIAR ──────────────────────────────────────────────────────────────
      await page.getByRole("button", { name: "+ Nova meta" }).click();
      const form = page.locator("form").filter({ has: page.locator('input[name="title"]') });
      await form.locator('input[name="title"]').fill(created);
      await form.locator("textarea[name='description']").fill("descrição criada pelo e2e — apagar");
      await form.getByRole("button", { name: "Salvar" }).click();

      await expect(activeGoalRow(page, created)).toHaveCount(1);
      await expect(page.getByText("descrição criada pelo e2e — apagar")).toBeVisible();

      // ── EDITAR ─────────────────────────────────────────────────────────────
      await activeGoalRow(page, created).getByRole("button", { name: "Editar meta" }).click();
      const editForm = page.locator("form").filter({ has: page.locator('input[name="title"]') });
      await editForm.locator('input[name="title"]').fill(edited);
      await editForm.getByRole("button", { name: "Salvar" }).click();

      await expect(activeGoalRow(page, edited)).toHaveCount(1);
      // O título antigo (exato) não deve mais existir como meta ativa distinta.
      await expect(page.getByText(created, { exact: true })).toHaveCount(0);

      // ── CONCLUIR ───────────────────────────────────────────────────────────
      await activeGoalRow(page, edited).getByRole("button", { name: "Marcar como feita" }).click();
      await expect(activeGoalRow(page, edited)).toHaveCount(0);
      await openConcludedGoals(page);
      await expect(doneGoalRow(page, edited)).toHaveCount(1);

      // ── REATIVAR ───────────────────────────────────────────────────────────
      await doneGoalRow(page, edited).getByRole("button", { name: "reativar" }).click();
      await expect(doneGoalRow(page, edited)).toHaveCount(0);
      await expect(activeGoalRow(page, edited)).toHaveCount(1);

      // ── APAGAR ─────────────────────────────────────────────────────────────
      await activeGoalRow(page, edited).getByRole("button", { name: "Apagar meta" }).click();
      await expect(activeGoalRow(page, edited)).toHaveCount(0);
      await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
    } finally {
      await cleanupGoal(page, marker);
    }
  });

  test("tarefa: criar (ligada à meta) → concluir → reativar → apagar", async ({ page }) => {
    const ts = Date.now();
    const goalMarker = `E2E meta-tarefa ${ts}`;
    const taskMarker = `E2E tarefa ${ts}`;

    try {
      await page.goto("/metas", { waitUntil: "domcontentloaded" });

      // Meta host (a tarefa só pode ser ligada a uma meta ATIVA — vide TaskForm).
      await page.getByRole("button", { name: "+ Nova meta" }).click();
      const goalForm = page.locator("form").filter({ has: page.locator('input[name="title"]') });
      await goalForm.locator('input[name="title"]').fill(goalMarker);
      await goalForm.getByRole("button", { name: "Salvar" }).click();
      await expect(activeGoalRow(page, goalMarker)).toHaveCount(1);

      // ── CRIAR TAREFA ───────────────────────────────────────────────────────
      await page.getByRole("button", { name: "+ Nova tarefa" }).click();
      const taskForm = page.locator("form").filter({ has: page.locator('select[name="goal_id"]') });
      await taskForm.locator('input[name="title"]').fill(taskMarker);
      await taskForm.locator('select[name="goal_id"]').selectOption({ label: goalMarker });
      await taskForm.getByRole("button", { name: "Salvar" }).click();

      await expect(taskRow(page, taskMarker)).toHaveCount(1);
      await expect(taskCheckbox(page, taskMarker)).not.toBeChecked();

      // ── CONCLUIR (marca o checkbox) ────────────────────────────────────────
      // .click() e NÃO .check(): ao concluir, a tarefa migra na hora pro <details>
      // fechado (checkbox some da tela). .check() esperaria o checkbox ficar
      // visível+marcado pós-clique e travaria; .click() só dispara o onChange.
      await taskCheckbox(page, taskMarker).click();
      // Após revalidar, a tarefa cai no <details> de concluídas e vem marcada.
      await openConcludedTasks(page);
      await expect(taskCheckbox(page, taskMarker)).toBeChecked();

      // ── REATIVAR (desmarca) ────────────────────────────────────────────────
      // A revalidação pode re-fechar o <details> entre reabrir e clicar; o toPass
      // reabre e tenta de novo até o clique pegar. Sai no 1º sucesso (1 toggle só).
      await expect(async () => {
        await openConcludedTasks(page);
        await taskCheckbox(page, taskMarker).click({ timeout: 2_000 });
      }).toPass({ timeout: 20_000 });
      await expect(taskCheckbox(page, taskMarker)).not.toBeChecked();

      // ── APAGAR ─────────────────────────────────────────────────────────────
      await taskRow(page, taskMarker).getByRole("button", { name: "Apagar tarefa" }).click();
      await expect(taskRow(page, taskMarker)).toHaveCount(0);
    } finally {
      await cleanupTask(page, taskMarker);
      await cleanupGoal(page, goalMarker);
    }
  });
});

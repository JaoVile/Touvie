import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * CRUD do módulo ROTINA — aba DIÁRIA (/rotina?tab=diaria).
 *
 * Foco: o CRUD do BLOCO do dia (horário + título via DailyForm/DailyList) —
 *   criar → editar → apagar. O fluxo de "marcar feito" (toggle otimista) é
 *   coberto por outro contexto; aqui não o exercitamos.
 *
 * Seletores confirmados no código (app/(app)/rotina/):
 *   - DailyForm.tsx: <form> com TimePicker (name="time_slot", HH:MM via hidden
 *     input controlado por React → tem que interagir com o popover, não dá pra
 *     setar o value cru), EmojiPicker (name="emoji"), input[name="title"]
 *     (required), textarea[name="notes"]. Submit: "Adicionar" (novo) /
 *     "Atualizar" (edição).
 *   - DailyList.tsx: cada bloco é um <li> mostrando "HH:MM" + emoji + título +
 *     notas, com botões de texto "editar" e "apagar" (apagar dispara
 *     confirm("Apagar esse bloco?")). Ao clicar "editar", um DailyForm inline
 *     abre DENTRO do <li> (botão "Atualizar" + "cancelar").
 *
 * Usa a sessão autenticada global (storageState do playwright.config) — não loga.
 * A conta de teste vem ZERADA; o próprio teste cria o bloco e o limpa no
 * afterEach (rede de segurança) — nada de lixo no banco de teste.
 *
 * TimePicker (components/TimePicker.tsx) é custom: um botão que abre um popover
 * portado pro <body> (`.picker-pop`) com duas colunas `.picker-col` (Hora, Min).
 * O value é carregado num hidden input controlado por estado React, então NÃO dá
 * pra `fill()` — a única forma fiel é clicar hora/min no popover (helper setTime).
 */

// Marcador único por run — localiza/limpa sem colidir com paralelas ou runs
// anteriores. O título editado mantém o marcador como prefixo, então a limpeza
// por `hasText(marker)` pega original e editado.
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const marker = `E2E rotina ${stamp}`;
const edited = `${marker} editado`;

// <li> de um bloco (modo exibição): casa pelo título visível. Em modo EDIÇÃO o
// título vira value de <input> (não é "texto"), então o <li> some deste filtro —
// o que é conveniente pra distinguir exibição de edição.
function blockRow(page: Page, text: string): Locator {
  return page.locator("li").filter({ hasText: text });
}

// Seta o horário no TimePicker custom dentro de `scope` (o <form> alvo).
// O gatilho é o único botão do form cujo rótulo é HH:MM (emoji tem aria-label,
// submit tem texto). Abre o popover portado, escolhe hora/min nas colunas e
// confirma em "Pronto".
async function setTime(page: Page, scope: Locator, hh: string, mm: string) {
  const trigger = scope.getByRole("button", { name: /^\d{1,2}:\d{2}$/ }).first();
  const pop = page.locator(".picker-pop");
  // Retry a abertura: no 1º hit frio da rota o React ainda pode não ter hidratado
  // o botão (onClick não dispara → popover não abre). toPass reclica até abrir.
  await expect(async () => {
    // Só clica se ainda estiver fechado — evita que um reclique feche um popover
    // que abriu com atraso (o clique é toggle).
    if (!(await pop.isVisible())) await trigger.click();
    await expect(pop, "popover do TimePicker deveria abrir").toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  // .picker-col nth(0) = coluna Hora, nth(1) = coluna Min (ordem do DOM).
  await pop.locator(".picker-col").nth(0).getByRole("button", { name: hh, exact: true }).click();
  await pop.locator(".picker-col").nth(1).getByRole("button", { name: mm, exact: true }).click();
  await pop.getByRole("button", { name: "Pronto" }).click();
  await expect(pop, "popover do TimePicker deveria fechar").toBeHidden();
}

test.describe.configure({ mode: "serial" });

test.describe("CRUD — rotina (bloco diário)", () => {
  test.beforeEach(async ({ page }) => {
    // Dev server compila /rotina sob demanda (~7s no 1º hit) e cada Server Action
    // (saveDailyBlock/deleteDailyBlock) revalida a rota — um fluxo de vários
    // passos estoura o timeout padrão de 30s sob contenção. test.slow() → 90s.
    test.slow();
    // "apagar" dispara window.confirm — auto-aceita.
    page.on("dialog", (d) => d.accept());
  });

  // Rede de segurança: apaga qualquer bloco cujo título contenha o marcador,
  // mesmo se uma asserção falhar no meio.
  test.afterEach(async ({ page }) => {
    try {
      await page.goto("/rotina?tab=diaria", { waitUntil: "domcontentloaded" });
      const rows = blockRow(page, marker);
      for (let i = 0; i < 10 && (await rows.count()) > 0; i++) {
        await rows.first().getByRole("button", { name: "apagar" }).click();
        await expect(rows)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
  });

  test("bloco: criar → editar (horário + título) → apagar", async ({ page }) => {
    await page.goto("/rotina?tab=diaria", { waitUntil: "domcontentloaded" });

    // Antes de qualquer edição existe UM só <form> (o card "Novo bloco").
    const createForm = page.locator("form").filter({ has: page.locator('input[name="title"]') });
    await expect(createForm, "form de novo bloco deveria estar visível").toBeVisible();

    // ── CRIAR ────────────────────────────────────────────────────────────────
    await setTime(page, createForm, "08", "15");
    await createForm.locator('input[name="title"]').fill(marker);
    await createForm.locator('textarea[name="notes"]').fill("nota criada pelo e2e — apagar");
    await createForm.getByRole("button", { name: "Adicionar" }).click();

    const created = blockRow(page, marker);
    await expect(created, "bloco criado deve aparecer na lista").toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(created, "horário criado (08:15) deve aparecer no bloco").toContainText("08:15");
    await expect(created).toContainText("nota criada pelo e2e — apagar");

    // ── EDITAR (horário 08:15→09:30 e título) ─────────────────────────────────
    await created.getByRole("button", { name: "editar" }).click();
    const editLi = page
      .locator("li")
      .filter({ has: page.getByRole("button", { name: "Atualizar" }) });
    await expect(editLi, "o form de edição inline deveria abrir").toBeVisible({ timeout: 5_000 });
    const editForm = editLi.locator("form");

    await setTime(page, editForm, "09", "30");
    await editForm.locator('input[name="title"]').fill(edited);
    await editForm.getByRole("button", { name: "Atualizar" }).click();

    const editedRow = blockRow(page, edited);
    await expect(editedRow, "a edição deveria refletir na lista").toHaveCount(1, {
      timeout: 10_000,
    });
    await expect(editedRow, "novo horário (09:30) deve aparecer").toContainText("09:30");
    await expect(
      editedRow,
      "horário antigo (08:15) não deve mais estar no bloco",
    ).not.toContainText("08:15");

    // ── APAGAR ────────────────────────────────────────────────────────────────
    await editedRow.getByRole("button", { name: "apagar" }).click();
    await expect(editedRow, "bloco deve sumir após apagar").toHaveCount(0, { timeout: 10_000 });
    await expect(blockRow(page, marker), "nada com o marcador deve sobrar").toHaveCount(0);
  });
});

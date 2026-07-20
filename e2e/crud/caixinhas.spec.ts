import { expect, test } from "@playwright/test";

/**
 * CRUD do módulo Finanças — aba CAIXINHAS (/financas?t=caixinhas).
 *
 * Caixinha = envelope de orçamento (`budget_envelopes`): um LIMITE de gasto em
 * centavos, atrelado a uma categoria e a um mês. A UI mostra o progresso
 * (gasto/limite) mas o teste só exercita o CRUD do limite.
 *
 * Regras de domínio (CONTEXT.md):
 *  - Dinheiro é CENTAVOS no banco; o usuário digita REAIS no input `name="limit"`.
 *    O server faz `reaisToCents` (×100). A UI exibe via `formatBRL`, então
 *    asserimos o formato da TELA (R$ 150,00) e provamos que o centavo cru (15000)
 *    NÃO vaza.
 *  - Há UNIQUE em budget_envelopes(user_id, category_id, month). Pra não colidir
 *    com envelopes preexistentes (inclusive os "sem categoria" → category_id NULL),
 *    o teste cria uma CATEGORIA DESCARTÁVEL própria e usa ela na caixinha. Assim a
 *    chave (categoria única, mês corrente) nunca bate com nada — nem entre rodadas
 *    paralelas (o `stamp` é único por processo).
 *
 * EDITAR: diferente de lançamentos, a aba Caixinhas TEM botão "editar" na UI — o
 * EnvelopeForm reabre preenchido (defaultValues + input hidden `id`) e o server
 * faz UPDATE. Por isso o fluxo de edição é real aqui (não é test.fixme).
 *
 * Usa a sessão autenticada global (storageState) — não loga aqui.
 *
 * Pré-condição: a caixinha precisa de uma categoria pra escolher no select. Como
 * a conta de teste vem zerada, o próprio teste cria a categoria na aba Setup e a
 * ARQUIVA no cleanup (soft-delete do app — devolve a conta ao estado zerado).
 */

// Marcadores únicos pra localizar/limpar sem colidir com paralelas.
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const marker = `E2E cx ${stamp}`; // nome da caixinha
const catName = `E2E catcx ${stamp}`; // categoria descartável (pré-condição + chave única)

test.describe("CRUD finanças — caixinhas (orçamento)", () => {
  // Apagar caixinha e arquivar categoria disparam window.confirm — auto-aceita.
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
  });

  // Rede de segurança: mesmo se o teste falhar no meio, remove a caixinha e
  // arquiva a categoria criadas (via a própria UI) pra não deixar lixo no banco.
  test.afterEach(async ({ page }) => {
    // 1) Caixinha(s) com o marcador.
    try {
      await page.goto("/financas?t=caixinhas", { waitUntil: "domcontentloaded" });
      const cards = page.locator("div.rounded-lg.border.p-4").filter({ hasText: marker });
      for (let i = 0; i < 10 && (await cards.count()) > 0; i++) {
        await cards.first().getByRole("button", { name: "apagar" }).click();
        await expect(cards)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
    // 2) Categoria descartável — arquivar (soft-delete do app).
    try {
      await page.goto("/financas?t=setup", { waitUntil: "domcontentloaded" });
      const archive = page.getByRole("button", { name: `Arquivar ${catName}` });
      if ((await archive.count()) > 0) {
        await archive.first().click();
        await expect(archive)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
  });

  test("cria → edita (limite e nome) → apaga uma caixinha", async ({ page }) => {
    // --- PRÉ-CONDIÇÃO: categoria descartável (também garante chave única) ------
    await page.goto("/financas?t=setup", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="name"]').fill(catName);
    await page.getByRole("button", { name: "Adicionar categoria" }).click();
    await expect(
      page.getByRole("button", { name: `Arquivar ${catName}` }),
      "categoria de pré-condição deveria ter sido criada",
    ).toBeVisible({ timeout: 10_000 });

    // --- CRIAR ----------------------------------------------------------------
    await page.goto("/financas?t=caixinhas", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "+ Nova caixinha" }).click();

    const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Criar" }) });
    await expect(form, "form de nova caixinha deveria abrir").toBeVisible({ timeout: 5_000 });

    await form.locator('input[name="name"]').fill(marker);
    await form.locator('input[name="limit"]').fill("150.00"); // 150 reais → 15000 centavos

    // Seleciona a categoria descartável pelo VALUE (uuid) — o texto da option é
    // "{emoji} {name}" e emoji pode ser vazio, então casar por label é frágil.
    const select = page.getByLabel("Categoria da caixinha");
    const catOption = select.locator("option").filter({ hasText: catName });
    await expect(catOption, "a categoria de pré-condição deveria aparecer no select").toHaveCount(
      1,
    );
    const catValue = await catOption.getAttribute("value");
    await select.selectOption(catValue ?? "");

    await form.getByRole("button", { name: "Criar" }).click();

    // A caixinha vira um card no grid. Só o card é `div.rounded-lg.border.p-4`
    // (o form é um <form>, o grid é `.grid`), então o filtro é único.
    const card = page.locator("div.rounded-lg.border.p-4").filter({ hasText: marker });
    await expect(card, "caixinha criada deve aparecer no grid").toBeVisible({ timeout: 10_000 });

    // Limite no formato da TELA: R$ 150,00 (Intl pt-BR usa espaço não-quebrável,
    // coberto por \s). Prova centavos→reais.
    await expect(card).toContainText(/R\$\s*150,00/);
    // Sanidade: o centavo cru NÃO pode vazar pra tela.
    await expect(card).not.toContainText("15000");

    // --- EDITAR: reabre o form preenchido e muda limite + nome ----------------
    await card.getByRole("button", { name: "editar" }).click();
    const editForm = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Salvar" }) });
    await expect(editForm, "o form de edição deveria abrir preenchido").toBeVisible({
      timeout: 5_000,
    });
    // Sanidade: o form reabriu com os valores atuais (defaultValues + id hidden).
    await expect(editForm.locator('input[name="name"]')).toHaveValue(marker);
    await expect(editForm.locator('input[name="limit"]')).toHaveValue("150.00");

    await editForm.locator('input[name="name"]').fill(`${marker} (editada)`);
    await editForm.locator('input[name="limit"]').fill("275.50"); // → 27550 centavos
    await editForm.getByRole("button", { name: "Salvar" }).click();

    const edited = page
      .locator("div.rounded-lg.border.p-4")
      .filter({ hasText: `${marker} (editada)` });
    await expect(edited, "a edição deveria refletir no card").toBeVisible({ timeout: 10_000 });
    await expect(edited).toContainText(/R\$\s*275,50/);
    await expect(edited).not.toContainText(/R\$\s*150,00/);
    await expect(edited).not.toContainText("27550");

    // --- APAGAR ---------------------------------------------------------------
    await edited.getByRole("button", { name: "apagar" }).click();
    await expect(edited, "caixinha deve sumir após apagar").toHaveCount(0, { timeout: 10_000 });
  });
});

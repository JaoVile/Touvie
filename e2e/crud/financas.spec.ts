import { expect, test } from "@playwright/test";

/**
 * CRUD do módulo Finanças — aba LANÇAMENTOS (/financas).
 *
 * Regra de domínio (CONTEXT.md): dinheiro é CENTAVOS no banco, mas o usuário
 * digita em REAIS na UI. O input `name="amount"` recebe reais (ex.: 12.34) e o
 * server faz `reaisToCents` (×100 → 1234). A lista exibe via `formatBRL`, então
 * asserimos o formato da TELA (R$ 12,34), nunca o centavo cru (1234).
 *
 * Usa a sessão autenticada global (storageState) — não loga aqui.
 *
 * Pré-condição: a aba Lançamentos só renderiza o form de novo lançamento se o
 * usuário tiver ao menos UMA categoria (senão a página mostra o card "Você ainda
 * não tem categorias"). Como a conta de teste vem zerada, o próprio teste cria
 * uma categoria descartável na aba Setup e a ARQUIVA no cleanup (arquivar é o
 * soft-delete do próprio app — some da lista e devolve a conta ao estado zerado).
 *
 * EDITAR: o `TransactionRow` tem botão "Editar" (lápis) que abre o
 * `TransactionForm` inline preenchido (modo "Atualizar"). O gap de UI que a v1
 * apontou foi fechado — o fluxo de edição é exercitado no 2º teste.
 */

// Marcadores únicos pra localizar/limpar sem colidir com paralelas.
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const marker = `E2E fin ${stamp}`; // descrição do lançamento
const catName = `E2E cat ${stamp}`; // categoria descartável (pré-condição)

test.describe("CRUD finanças — lançamentos", () => {
  // Botões × disparam window.confirm ("Apagar este lançamento?" / "Arquivar ..."):
  // auto-aceita todos os diálogos.
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
  });

  // Rede de segurança: mesmo se o teste falhar no meio, remove o lançamento e
  // arquiva a categoria criados (via a própria UI) pra não deixar lixo no banco.
  test.afterEach(async ({ page }) => {
    // 1) Lançamento com o marcador.
    try {
      await page.goto("/financas?t=lancamentos", { waitUntil: "domcontentloaded" });
      const rows = page.locator("li").filter({ hasText: marker });
      for (let i = 0; i < 10 && (await rows.count()) > 0; i++) {
        await rows.first().getByRole("button", { name: "Apagar lançamento" }).click();
        await expect(rows)
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

  test("cria → (valor em R$ certo) → apaga um lançamento", async ({ page }) => {
    // --- PRÉ-CONDIÇÃO: garantir uma categoria (senão o form não aparece) -----
    await page.goto("/financas?t=setup", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="name"]').fill(catName);
    // kind fica no default "Despesa" (expense) — irrelevante pro lançamento, que
    // usa "Sem categoria". Só precisamos que EXISTA uma categoria.
    await page.getByRole("button", { name: "Adicionar categoria" }).click();
    await expect(
      page.getByRole("button", { name: `Arquivar ${catName}` }),
      "categoria de pré-condição deveria ter sido criada",
    ).toBeVisible({ timeout: 10_000 });

    // --- CRIAR --------------------------------------------------------------
    await page.goto("/financas?t=lancamentos", { waitUntil: "domcontentloaded" });
    const amount = page.locator('input[name="amount"]');
    await expect(amount, "form de novo lançamento deveria estar visível").toBeVisible();

    // Modo default é "Saiu" (expense). 12.34 reais → 1234 centavos → R$ 12,34.
    await amount.fill("12.34");
    await page.locator('input[name="description"]').fill(marker);
    // Data fica no default (hoje) — cai no mês corrente, que é o que a aba lista.
    await page.getByRole("button", { name: "Adicionar" }).click();

    const row = page.locator("li").filter({ hasText: marker });
    await expect(row, "lançamento criado deve aparecer na lista").toBeVisible({ timeout: 10_000 });

    // Valor no formato da TELA: R$ 12,34 (Intl pt-BR usa espaço não-quebrável,
    // coberto por \s). Prova centavos→reais.
    await expect(row).toContainText(/R\$\s*12,34/);
    // Sanidade: o centavo cru NÃO pode vazar pra tela.
    await expect(row).not.toContainText("1234");

    // --- EDITAR: sem UI — ver test.fixme abaixo e o relatório. --------------

    // --- APAGAR -------------------------------------------------------------
    await row.getByRole("button", { name: "Apagar lançamento" }).click();
    await expect(row, "lançamento deve sumir após apagar").toHaveCount(0, { timeout: 10_000 });
  });

  // O gap de UI (não havia como editar um lançamento) foi FECHADO: o TransactionRow
  // agora tem botão "Editar" que abre o TransactionForm inline preenchido. Este
  // teste exercita o fluxo real de edição.
  test("cria → edita (valor e descrição) → apaga um lançamento", async ({ page }) => {
    // pré-condição: uma categoria pra o form aparecer
    await page.goto("/financas?t=setup", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="name"]').fill(catName);
    await page.getByRole("button", { name: "Adicionar categoria" }).click();
    await expect(page.getByRole("button", { name: `Arquivar ${catName}` })).toBeVisible({
      timeout: 10_000,
    });

    // criar (12.34 → R$ 12,34)
    await page.goto("/financas?t=lancamentos", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="amount"]').first().fill("12.34");
    await page.locator('input[name="description"]').first().fill(marker);
    await page.getByRole("button", { name: "Adicionar" }).click();
    const row = page.locator("li").filter({ hasText: marker });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText(/R\$\s*12,34/);

    // EDITAR: abre o form inline na linha e muda valor + descrição
    await row.getByRole("button", { name: "Editar lançamento" }).click();
    const updateBtn = page.getByRole("button", { name: "Atualizar" });
    await expect(updateBtn, "o form de edição inline deveria abrir").toBeVisible({
      timeout: 5_000,
    });
    const editLi = page.locator("li").filter({ has: updateBtn });
    await editLi.locator('input[name="amount"]').fill("56.78");
    await editLi.locator('input[name="description"]').fill(`${marker} (editada)`);
    await updateBtn.click();

    // reflete o novo valor/descrição; o antigo some
    const edited = page.locator("li").filter({ hasText: `${marker} (editada)` });
    await expect(edited, "a edição deveria refletir na lista").toBeVisible({ timeout: 10_000 });
    await expect(edited).toContainText(/R\$\s*56,78/);
    await expect(edited).not.toContainText(/R\$\s*12,34/);

    // apagar
    await edited.getByRole("button", { name: "Apagar lançamento" }).click();
    await expect(edited).toHaveCount(0, { timeout: 10_000 });
  });
});

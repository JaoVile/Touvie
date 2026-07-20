import { type Locator, type Page, expect, test } from "@playwright/test";

/**
 * CRUD do módulo Finanças — aba CONTAS a pagar (/financas?t=contas → `bills`).
 *
 * Regra de domínio (CONTEXT.md): dinheiro é CENTAVOS no banco, mas o usuário
 * digita em REAIS. O input `name="amount"` recebe reais (ex.: 78.90) e o server
 * faz `reaisToCents` (×100 → 7890). A lista exibe via `formatBRL`, então asserimos
 * o formato da TELA (R$ 78,90), nunca o centavo cru (7890).
 *
 * Usa a sessão autenticada global (storageState) — não loga aqui.
 *
 * EDIÇÃO: diferente de "lançamentos" (que só ganhou editar agora), a aba Contas
 * SEMPRE teve edição inline — cada linha tem botão "editar" que abre o BillForm
 * preenchido (`defaultValue` + `<input hidden name="id">`, botão "Salvar"). Logo,
 * NÃO há gap/test.fixme aqui: o 1º teste exercita criar→editar→apagar de verdade.
 *
 * MARCAR COMO PAGA (2º teste): `toggleBillPaid` é otimista e, ao pagar, GERA uma
 * despesa linkada (`bill_id`, `description = bill.title`) que abate o saldo; ao
 * desmarcar, remove essa despesa. `deleteBill` NÃO apaga a transação linkada, então
 * o teste desmarca (pendente) ANTES de apagar a conta, e o cleanup varre também a
 * aba Lançamentos — não deixa lixo no banco.
 *
 * Pré-condição do 2º teste: a aba Lançamentos só renderiza a LISTA se o usuário
 * tiver ao menos uma categoria (senão mostra o card "Você ainda não tem categorias").
 * Como a conta de teste vem zerada, criamos uma categoria descartável no Setup e a
 * ARQUIVAMOS no cleanup (arquivar é o soft-delete do próprio app). A aba Contas em
 * si renderiza sem categoria — por isso o 1º teste dispensa essa pré-condição.
 */

// Marcadores únicos pra localizar/limpar sem colidir com paralelas.
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const base = `E2E conta ${stamp}`; // prefixo do título — cleanup varre por ele (substring)
const markerCrud = `${base} A`; // conta do teste criar→editar→apagar
const markerPaid = `${base} B`; // conta do teste marcar como paga
const catName = `E2E cat ${stamp}`; // categoria descartável (pré-condição do 2º teste)

/**
 * Clica o toggle pago/pendente de uma conta de forma resiliente. Numa navegação
 * fresca ("domcontentloaded") o clique pode cair ANTES do React hidratar o
 * onClick (vira no-op silencioso — provado por screenshot: a conta continuava
 * "PAGA"). Como o `useOptimistic` inverte o estado de forma SÍNCRONA, um clique
 * que de fato disparou troca o `title` na hora; reintentamos até isso acontecer.
 */
async function toggleBill(page: Page, marker: string, fromTitle: string): Promise<void> {
  const row = page.locator("li").filter({ hasText: marker });
  await expect(row).toBeVisible({ timeout: 10_000 });
  const flippedTitle =
    fromTitle === "Marcar como pago" ? "Marcar como pendente" : "Marcar como pago";
  await expect(async () => {
    await row.getByTitle(fromTitle).click();
    await expect(row.getByTitle(flippedTitle)).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Re-navega pra aba Lançamentos até o lançamento linkado (mesma `description` do
 * título da conta) aparecer/sumir. Absorve a janela de consistência: `toggleBillPaid`
 * faz as escritas (bill + transação) em statements separados, então há um instante
 * em que o efeito ainda não commitou — reload resolve sem depender de waitForResponse.
 */
async function assertLinkedTx(page: Page, marker: string, present: boolean): Promise<void> {
  await expect(async () => {
    await page.goto("/financas?t=lancamentos", { waitUntil: "domcontentloaded" });
    const tx = page.locator("li").filter({ hasText: marker });
    if (present) await expect(tx).toBeVisible({ timeout: 3_000 });
    else await expect(tx).toHaveCount(0, { timeout: 3_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Clica reintentando até o efeito ESPERADO aparecer. Numa nav "domcontentloaded"
 * a interatividade só existe após a hidratação, que pode não ter ocorrido no
 * primeiro clique (no-op silencioso — provado por screenshot). O guard `isVisible`
 * evita re-clicar quando o alvo some após um clique bem-sucedido (ex.: submit que
 * fecha o form, ou cujo label vira "Salvando…"), então não duplica escrita.
 */
async function clickUntil(target: Locator, expected: Locator): Promise<void> {
  await expect(async () => {
    if (await target.isVisible().catch(() => false)) await target.click();
    await expect(expected).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/** Apaga (via botão "apagar") reintentando até a linha sumir — mesmo motivo. */
async function deleteRow(row: Locator): Promise<void> {
  await expect(async () => {
    const btn = row.getByRole("button", { name: "apagar" });
    if (await btn.isVisible().catch(() => false)) await btn.click();
    await expect(row).toHaveCount(0, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("CRUD finanças — contas a pagar", () => {
  // "apagar" e o toggle usam window.confirm ("Apagar conta?"): auto-aceita tudo.
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
  });

  // Rede de segurança: mesmo se o teste quebrar no meio, remove (via a própria UI)
  // 1) qualquer transação linkada (aba Lançamentos), 2) qualquer conta (aba Contas)
  // e 3) a categoria de pré-condição — filtrando pelo prefixo `base`.
  test.afterEach(async ({ page }) => {
    // 1) Transações linkadas (do toggle "pago") — ANTES de arquivar a categoria,
    // senão a aba Lançamentos vira o card de "sem categorias" e some o botão.
    try {
      await page.goto("/financas?t=lancamentos", { waitUntil: "domcontentloaded" });
      const txRows = page.locator("li").filter({ hasText: base });
      for (let i = 0; i < 10 && (await txRows.count()) > 0; i++) {
        await txRows.first().getByRole("button", { name: "Apagar lançamento" }).click();
        await expect(txRows)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
    // 2) Contas com o prefixo.
    try {
      await page.goto("/financas?t=contas", { waitUntil: "domcontentloaded" });
      const billRows = page.locator("li").filter({ hasText: base });
      for (let i = 0; i < 10 && (await billRows.count()) > 0; i++) {
        await billRows.first().getByRole("button", { name: "apagar" }).click();
        await expect(billRows)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
    // 3) Categoria descartável — arquivar (soft-delete do app).
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

  test("cria → (valor em R$ certo) → edita → apaga uma conta", async ({ page }) => {
    await page.goto("/financas?t=contas", { waitUntil: "domcontentloaded" });

    // --- CRIAR --------------------------------------------------------------
    // clickUntil: a nav fresca pode não ter hidratado → reintenta o clique até o
    // form abrir. (Todos os cliques deste teste seguem a mesma proteção.)
    const titleInput = page.locator('input[name="title"]');
    await clickUntil(page.getByRole("button", { name: "Nova conta" }), titleInput);
    await titleInput.fill(markerCrud);
    // 78.90 reais → 7890 centavos → R$ 78,90. Vencimento fica no default (hoje),
    // que cai no mês corrente — a aba lista mês atual + atrasadas.
    await page.locator('input[name="amount"]').fill("78.90");

    const row = page.locator("li").filter({ hasText: markerCrud });
    await clickUntil(page.getByRole("button", { name: "Criar" }), row);
    // Valor no formato da TELA (Intl pt-BR usa espaço não-quebrável → \s). Prova
    // que centavos→reais; o centavo cru NÃO pode vazar.
    await expect(row).toContainText(/R\$\s*78,90/);
    await expect(row).not.toContainText("7890");

    // --- EDITAR: abre o form inline (botão "editar"), muda título e valor ----
    const saveBtn = page.getByRole("button", { name: "Salvar" });
    await clickUntil(row.getByRole("button", { name: "editar" }), saveBtn);
    // O form pré-carrega o valor em reais (defaultValue = 7890/100 = "78.90").
    await expect(page.locator('input[name="amount"]')).toHaveValue("78.90");
    await page.locator('input[name="title"]').fill(`${markerCrud} (editada)`);
    await page.locator('input[name="amount"]').fill("12.34");

    // Reflete o novo título/valor; o valor antigo some.
    const edited = page.locator("li").filter({ hasText: `${markerCrud} (editada)` });
    await clickUntil(saveBtn, edited);
    await expect(edited).toContainText(/R\$\s*12,34/);
    await expect(edited).not.toContainText(/R\$\s*78,90/);

    // --- APAGAR -------------------------------------------------------------
    await deleteRow(edited);
  });

  test("marca como paga → gera lançamento linkado → desmarca → apaga", async ({ page }) => {
    // --- PRÉ-CONDIÇÃO: uma categoria pra a aba Lançamentos renderizar a lista --
    await page.goto("/financas?t=setup", { waitUntil: "domcontentloaded" });
    await page.locator('input[name="name"]').fill(catName);
    await clickUntil(
      page.getByRole("button", { name: "Adicionar categoria" }),
      page.getByRole("button", { name: `Arquivar ${catName}` }),
    );

    // --- CRIAR a conta (45.67 → R$ 45,67) -----------------------------------
    await page.goto("/financas?t=contas", { waitUntil: "domcontentloaded" });
    const titleInput = page.locator('input[name="title"]');
    await clickUntil(page.getByRole("button", { name: "Nova conta" }), titleInput);
    await titleInput.fill(markerPaid);
    await page.locator('input[name="amount"]').fill("45.67");
    const row = page.locator("li").filter({ hasText: markerPaid });
    await clickUntil(page.getByRole("button", { name: "Criar" }), row);

    // --- MARCAR COMO PAGA (otimista) ----------------------------------------
    // O botão é só um ícone; o nome acessível vem do `title`.
    await toggleBill(page, markerPaid, "Marcar como pago");

    // --- EFEITO: a despesa linkada (bill_id) aparece nos Lançamentos --------
    await assertLinkedTx(page, markerPaid, true);
    const tx = page.locator("li").filter({ hasText: markerPaid });
    await expect(tx, "o lançamento gerado deve refletir o valor da conta (R$ 45,67)").toContainText(
      /R\$\s*45,67/,
    );

    // --- DESMARCAR (pendente) → a despesa linkada some ----------------------
    await page.goto("/financas?t=contas", { waitUntil: "domcontentloaded" });
    await toggleBill(page, markerPaid, "Marcar como pendente");
    await assertLinkedTx(page, markerPaid, false);

    // --- APAGAR a conta (já sem transação órfã) -----------------------------
    await page.goto("/financas?t=contas", { waitUntil: "domcontentloaded" });
    const rowToDelete = page.locator("li").filter({ hasText: markerPaid });
    await expect(rowToDelete).toBeVisible({ timeout: 10_000 });
    await deleteRow(rowToDelete);
  });
});

import { expect, test } from "@playwright/test";

/**
 * GERENCIADOR CENTRAL DE LEMBRETES — /notificacoes?v=reminders.
 *
 * Prova a lacuna que motivou a feature: um lembrete criado em QUALQUER área
 * (aqui, a aba Lembretes da DIETA, area="dieta") precisa aparecer no gerenciador
 * central com selo de origem amigável ("Dieta") e poder ser PAUSADO e EXCLUÍDO
 * de lá, com persistência real no banco.
 *
 * Fluxo: cria `daily` no ReminderComposer da dieta → abre a aba central → confere
 * selo → pausa (ativo→pausado) → exclui (aria "Excluir lembrete") → some.
 *
 * A aba Lembretes da dieta é um <Link href="/dieta?t=lembretes"> (NÃO role="tab",
 * como o plano supunha) — navegamos direto pela URL. `user_reminders` é tabela
 * folha (sem filhos FK); o cleanup no afterEach só apaga o próprio lembrete via UI
 * caso o teste morra no meio.
 */

const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const MSG = `E2E manager ${stamp}`;

test.describe.configure({ mode: "serial" });

test.describe("gerenciador central de lembretes", () => {
  test.beforeEach(() => {
    test.slow(); // fluxo multi-passo com server actions + reloads
  });

  test.afterEach(async ({ page }) => {
    // Rede de segurança: se o lembrete de teste sobreviveu, apaga pela aba central.
    try {
      await page.goto("/notificacoes?v=reminders", { waitUntil: "domcontentloaded" });
      for (let i = 0; i < 5; i++) {
        const row = page.locator("li", { hasText: MSG });
        if ((await row.count()) === 0) break;
        await row
          .first()
          .getByRole("button", { name: "Excluir lembrete" })
          .click()
          .catch(() => {});
        await expect(page.locator("li", { hasText: MSG })).toHaveCount(0, { timeout: 10_000 });
      }
    } catch {
      // sessão/rota indisponível no teardown — nada a limpar de forma segura.
    }
  });

  test("lista com selo Dieta, pausa e exclui na aba central", async ({ page }) => {
    // ── 1. CRIAR pelo composer da DIETA (area="dieta", schedule daily default) ──
    await page.goto("/dieta?t=lembretes");
    await page.getByPlaceholder("O que você quer ser lembrado?").fill(MSG);

    const create = page.getByRole("button", { name: "Criar lembrete" });
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().includes("/dieta") && r.status() < 400,
        { timeout: 15_000 },
      ),
      create.click(),
    ]);
    // O composer limpa a mensagem e recarrega a própria lista ao salvar.
    await expect(page.getByPlaceholder("O que você quer ser lembrado?")).toHaveValue("");

    // ── 2. ABA CENTRAL: aparece com o selo de origem "Dieta" ────────────────────
    await page.goto("/notificacoes?v=reminders");
    const row = page.locator("li", { hasText: MSG });
    await expect(row, "o lembrete da dieta deve aparecer no gerenciador central").toBeVisible({
      timeout: 10_000,
    });
    await expect(
      row.getByText("Dieta", { exact: true }),
      "deve exibir o selo de origem 'Dieta'",
    ).toBeVisible();

    // ── 3. PAUSAR (ativo → pausado) e persistir após reload ─────────────────────
    await row.getByRole("button", { name: "ativo" }).click();
    await expect(
      row.getByRole("button", { name: "pausado" }),
      "o botão deve virar 'pausado'",
    ).toBeVisible({ timeout: 10_000 });

    await page.reload();
    const rowAfter = page.locator("li", { hasText: MSG });
    await expect(
      rowAfter.getByRole("button", { name: "pausado" }),
      "a pausa deve PERSISTIR no banco (segue pausado após reload)",
    ).toBeVisible({ timeout: 10_000 });

    // ── 4. EXCLUIR e confirmar que sumiu ────────────────────────────────────────
    await rowAfter.getByRole("button", { name: "Excluir lembrete" }).click();
    await expect(
      page.locator("li", { hasText: MSG }),
      "o lembrete excluído não deve mais aparecer",
    ).toHaveCount(0, { timeout: 10_000 });

    // ── 5. PERSISTE a exclusão após reload (não volta) ──────────────────────────
    await page.reload();
    await expect(
      page.locator("li", { hasText: MSG }),
      "a exclusão deve persistir no banco",
    ).toHaveCount(0, { timeout: 10_000 });
  });
});

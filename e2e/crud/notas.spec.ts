import { expect, test } from "@playwright/test";

/**
 * CRUD do módulo Notas (/notas).
 *
 * Fluxo real observado no código:
 *  - "Nova nota" (form → server action `createNote`) cria uma nota VAZIA e
 *    redireciona pra /notas/{uuid} (o editor).
 *  - O editor (NoteEditor.tsx) faz autosave com debounce de 1200ms; o status
 *    vira "salvo" (span) quando persiste. Não há botão "salvar".
 *  - "Apagar" dispara um confirm() nativo → `deleteNote` → redireciona pra /notas.
 *
 * Usa a sessão autenticada global (storageState do playwright.config) — não loga.
 * Limpa a nota criada mesmo se o teste falhar no meio (afterEach + id capturado).
 */

const UUID_RE = /\/notas\/[0-9a-f-]{36}/;
// Segundos de folga sobre o debounce de 1200ms + round-trip do server action.
const SAVED = { name: "salvo" } as const;

// Id da nota criada, pra limpeza garantida.
let createdNoteId: string | null = null;

/** Aguarda o autosave confirmar ("salvo"). */
async function waitSaved(page: import("@playwright/test").Page) {
  await expect(page.getByText("salvo", { exact: true })).toBeVisible({ timeout: 12_000 });
}

test.describe("CRUD — notas", () => {
  test.afterEach(async ({ page }) => {
    // Limpeza defensiva: se a nota ainda existe (teste falhou antes do delete),
    // apaga via UI pra não deixar lixo no banco de teste.
    if (!createdNoteId) return;
    try {
      await page.goto(`/notas/${createdNoteId}`, { waitUntil: "domcontentloaded" });
      const apagar = page.getByRole("button", { name: "Apagar" });
      if (await apagar.isVisible().catch(() => false)) {
        page.once("dialog", (d) => d.accept());
        await apagar.click();
        await page.waitForURL(/\/notas(\?|$)/, { timeout: 10_000 }).catch(() => {});
      }
    } finally {
      createdNoteId = null;
    }
  });

  test("cria, edita e apaga uma nota (com limpeza)", async ({ page }) => {
    const stamp = Date.now();
    const titleV1 = `E2E notas ${stamp}`;
    const titleV2 = `E2E notas ${stamp} (editada)`;
    const bodyV1 = `Corpo original ${stamp}`;
    const bodyV2 = `Corpo editado ${stamp}`;

    // ---- CREATE ----
    await page.goto("/notas");
    await page.getByRole("button", { name: /Nova nota/ }).click();

    // createNote redireciona pra /notas/{uuid}.
    await page.waitForURL(UUID_RE, { timeout: 15_000 });
    createdNoteId = page.url().match(/\/notas\/([0-9a-f-]{36})/)?.[1] ?? null;
    expect(createdNoteId, "deveria capturar o id da nota recém-criada").not.toBeNull();

    const titleInput = page.getByPlaceholder("Título da nota");
    const bodyInput = page.getByPlaceholder("Escreva aqui…");

    await titleInput.fill(titleV1);
    await bodyInput.fill(bodyV1);
    await waitSaved(page);
    await expect(titleInput).toHaveValue(titleV1);

    // Confirma persistência: a nota aparece na listagem.
    await page.goto("/notas");
    const cardV1 = page.getByRole("link", { name: new RegExp(titleV1.replace(/[()]/g, "\\$&")) });
    await expect(cardV1, "a nota criada deve aparecer na lista").toBeVisible();

    // ---- UPDATE ----
    await cardV1.click();
    await page.waitForURL(UUID_RE, { timeout: 15_000 });
    await titleInput.fill(titleV2);
    await bodyInput.fill(bodyV2);
    await waitSaved(page);

    // Na listagem: título novo presente, título antigo (exato) ausente.
    await page.goto("/notas");
    await expect(
      page.getByRole("link", { name: new RegExp(titleV2.replace(/[()]/g, "\\$&")) }),
      "o título editado deve aparecer na lista",
    ).toBeVisible();
    // O preview do corpo editado também deve estar na página.
    await expect(page.getByText(bodyV2, { exact: false })).toBeVisible();

    // ---- DELETE ----
    await page.getByRole("link", { name: new RegExp(titleV2.replace(/[()]/g, "\\$&")) }).click();
    await page.waitForURL(UUID_RE, { timeout: 15_000 });
    page.once("dialog", (d) => {
      expect(d.type()).toBe("confirm");
      d.accept();
    });
    await page.getByRole("button", { name: "Apagar" }).click();
    await page.waitForURL(/\/notas(\?|$)/, { timeout: 15_000 });

    // Some da listagem.
    await expect(
      page.getByRole("link", { name: new RegExp(titleV2.replace(/[()]/g, "\\$&")) }),
      "a nota apagada não deve mais aparecer",
    ).toHaveCount(0);

    // Delete concluído: afterEach não precisa limpar.
    createdNoteId = null;
  });
});

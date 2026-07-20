import { expect, test } from "@playwright/test";

/**
 * NOTAS — extras: FIXAR (pin) + TAGS. O `crud/notas.spec.ts` cobre criar/editar/apagar
 * o corpo; aqui cobrimos o que faltava:
 *   - Tags: input `#note-tags` (separadas por vírgula), autosave (status "salvo").
 *   - Pin: botão `title="Fixar nota"` → `togglePin` → vira `title="Desafixar"`.
 * A lista (/notas) mostra a nota fixada com um ícone de pin e chips de tag.
 *
 * Usa a sessão autenticada global (storageState) — não loga. Marcador único; limpeza
 * garantida no afterEach pelo id capturado.
 */

const UUID_RE = /\/notas\/[0-9a-f-]{36}/;
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const title = `E2E nota fixar ${stamp}`;
const tag = `e2etag${stamp}`;

let noteId: string | null = null;

test.describe.configure({ mode: "serial" });

test.describe("notas — fixar (pin) + tags", () => {
  test.beforeEach(async ({ page }) => {
    test.slow();
    page.on("dialog", (d) => d.accept()); // "Apagar" dispara confirm nativo
  });

  test.afterEach(async ({ page }) => {
    // Rede de segurança: se a nota ainda existe, apaga.
    if (!noteId) return;
    try {
      await page.goto(`/notas/${noteId}`, { waitUntil: "domcontentloaded" });
      const apagar = page.getByRole("button", { name: "Apagar" });
      if (await apagar.isVisible().catch(() => false)) {
        await apagar.click();
        await page.waitForURL(/\/notas(\?|$)/, { timeout: 10_000 }).catch(() => {});
      }
    } finally {
      noteId = null;
    }
  });

  test("fixa a nota e adiciona tags; ambos persistem e aparecem na lista", async ({ page }) => {
    // ── CRIAR ────────────────────────────────────────────────────────────────
    await page.goto("/notas");
    await page.getByRole("button", { name: /Nova nota/ }).click();
    await page.waitForURL(UUID_RE, { timeout: 15_000 });
    noteId = page.url().match(/\/notas\/([0-9a-f-]{36})/)?.[1] ?? null;
    expect(noteId, "deveria capturar o id da nota").not.toBeNull();

    // ── TÍTULO + TAGS (autosave) ─────────────────────────────────────────────
    await page.getByPlaceholder("Título da nota").fill(title);
    await page.locator("#note-tags").fill(tag);
    await expect(page.getByText("salvo", { exact: true })).toBeVisible({ timeout: 12_000 });

    // ── FIXAR (togglePin) ────────────────────────────────────────────────────
    // O botão muda OTIMISTA (setPinned), mas o togglePin é um server action async —
    // esperar o POST commitar antes de recarregar (senão o reload lê pinned=false).
    await Promise.all([
      page
        .waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/notas"), {
          timeout: 10_000,
        })
        .catch(() => null),
      page.getByTitle("Fixar nota").click(),
    ]);
    await expect(page.getByTitle("Desafixar"), "a nota deveria ficar fixada").toBeVisible({
      timeout: 10_000,
    });

    // ── PERSISTE após reload: segue fixada + tags mantidas ───────────────────
    await page.reload();
    await expect(page.getByTitle("Desafixar"), "o pin deve persistir").toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator("#note-tags"), "as tags devem persistir").toHaveValue(tag);

    // ── Na LISTA: a nota aparece com a tag (chip) ────────────────────────────
    await page.goto("/notas", { waitUntil: "domcontentloaded" });
    const card = page.getByRole("link", { name: new RegExp(title) });
    await expect(card, "a nota deve aparecer na lista").toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(tag, { exact: false }),
      "a tag deve aparecer na lista",
    ).toBeVisible();

    // ── DESAFIXAR (toggle de volta) ──────────────────────────────────────────
    await card.click();
    await page.waitForURL(UUID_RE, { timeout: 15_000 });
    await page.getByTitle("Desafixar").click();
    await expect(page.getByTitle("Fixar nota"), "deveria desafixar").toBeVisible({
      timeout: 10_000,
    });

    // ── APAGAR (limpeza explícita; afterEach é rede de segurança) ────────────
    await page.getByRole("button", { name: "Apagar" }).click();
    await page.waitForURL(/\/notas(\?|$)/, { timeout: 15_000 });
    await expect(
      page.getByRole("link", { name: new RegExp(title) }),
      "a nota apagada não deve mais aparecer",
    ).toHaveCount(0);
    noteId = null;
  });
});

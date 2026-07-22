import { copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page, expect, test } from "@playwright/test";

/**
 * Feature "Ferramentas da Página" do leitor de PDF (/leitura/[id]).
 *
 * Botão varinha (aria-label "Ferramentas da página") abre o <aside> PageTools
 * com 3 abas:
 *  - Texto: extrai a camada de texto do PDF; Copiar / Baixar .txt; OCR se escaneada.
 *  - Ouvir: window.speechSynthesis (voz do navegador).
 *  - IA: Resumir / Explicar / Perguntar → POST /api/leitura/ask (Groq).
 *  - OCR: canvas da página → POST /api/leitura/ocr (Groq visão) → cacheia em
 *    reading_page_text por (book_id, page); 2ª chamada devolve { cached: true }.
 *
 * Estratégia: sobe um PDF-fixture NOSSO (com texto conhecido), roda tudo nele e
 * APAGA o livro no fim — o delete cascateia em reading_page_text (FK ON DELETE
 * CASCADE), então não deixa lixo (nem a linha de OCR).
 *
 * Usa a sessão autenticada global (storageState). Rode com --workers=1.
 */

const FIXTURE = join(process.cwd(), "e2e/fixtures/touvie-e2e-texto.pdf");
// Marcador único que existe no texto do fixture (ver scripts/gen-pdf / o .pdf).
const TEXT_MARKER = "test-marker-touvie";

let page: Page;
let bookId: string | null = null;
let bookTitle = "";

test.describe.configure({ mode: "serial" });

test.describe("Leitura — Ferramentas da Página", () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: "e2e/.auth/user.json" });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"]);
    page = await ctx.newPage();

    // Nome único por rodada → título único (o addBook usa o nome do arquivo).
    const stamp = Date.now();
    bookTitle = `touvie-e2e-${stamp}`;
    const upPath = join(tmpdir(), `${bookTitle}.pdf`);
    copyFileSync(FIXTURE, upPath);

    await page.goto("/leitura");
    await page.setInputFiles('input[type="file"]', upPath);

    // Após upload + addBook + router.refresh, o card com o título aparece.
    const card = page.getByRole("link", { name: new RegExp(bookTitle) });
    await expect(card, "o livro recém-enviado deve aparecer na biblioteca").toBeVisible({
      timeout: 30_000,
    });
    const href = await card.getAttribute("href");
    bookId = href?.match(/\/leitura\/([0-9a-f-]{36})/)?.[1] ?? null;
    expect(bookId, "deveria capturar o id do livro").not.toBeNull();

    // Abre o leitor e espera o PDF carregar (numPages resolvido → "de 1").
    await page.goto(`/leitura/${bookId}`);
    await expect(page.getByText(/Página\s+1\s+de\s+1/)).toBeVisible({ timeout: 30_000 });
  });

  test.afterAll(async () => {
    // Limpeza: apaga o livro (cascata remove reading_page_text da OCR).
    if (bookId) {
      await page.goto("/leitura");
      const del = page.getByRole("button", { name: new RegExp(`Excluir ${bookTitle}`) });
      if (await del.isVisible().catch(() => false)) {
        page.once("dialog", (d) => d.accept());
        await del.click();
        await expect(page.getByRole("link", { name: new RegExp(bookTitle) })).toHaveCount(0, {
          timeout: 15_000,
        });
      }
    }
    await page.context().close();
  });

  test("abre o painel e mostra as 3 abas", async () => {
    await page.getByRole("button", { name: "Ferramentas da página" }).click();
    const aside = page.locator("aside").filter({ hasText: "Ferramentas · pág." });
    await expect(aside).toBeVisible();
    await expect(aside.getByRole("button", { name: "texto", exact: true })).toBeVisible();
    await expect(aside.getByRole("button", { name: "ouvir", exact: true })).toBeVisible();
    await expect(aside.getByRole("button", { name: "IA", exact: true })).toBeVisible();
  });

  test("Texto: extrai a camada, Copiar e Baixar .txt funcionam", async () => {
    const aside = page.locator("aside").filter({ hasText: "Ferramentas · pág." });
    // A aba Texto é a default; o texto da camada deve conter o marcador do fixture.
    await expect(aside.getByText(new RegExp(TEXT_MARKER))).toBeVisible({ timeout: 15_000 });

    // Copiar não deve quebrar a UI (clipboard concedido no beforeAll).
    await aside.getByRole("button", { name: /Copiar/ }).click();
    await expect(aside).toBeVisible();

    // Baixar dispara um download com o nome esperado.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      aside.getByRole("button", { name: /Baixar \.txt/ }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("pagina-1.txt");
  });

  test("Ouvir: botão presente e clicável (não quebra a UI)", async () => {
    const aside = page.locator("aside").filter({ hasText: "Ferramentas · pág." });
    await aside.getByRole("button", { name: "ouvir", exact: true }).click();
    const ouvir = aside.getByRole("button", { name: /Ouvir a página/ });
    await expect(ouvir).toBeVisible();
    await ouvir.click();
    // speechSynthesis em headless pode não emitir áudio — só garantimos que a
    // UI segue de pé (o painel não sumiu / não estourou exceção).
    await expect(aside).toBeVisible();
  });

  test("IA: Resumir devolve uma resposta do Toube (Groq real)", async () => {
    const aside = page.locator("aside").filter({ hasText: "Ferramentas · pág." });
    await aside.getByRole("button", { name: "IA", exact: true }).click();
    await aside.getByRole("button", { name: "Resumir", exact: true }).click();

    const answer = aside.locator('p[class*="rounded-md"]');
    const iaError = aside.getByText("O Toube está fora do ar agora.");
    await Promise.race([
      answer.waitFor({ state: "visible", timeout: 45_000 }),
      iaError.waitFor({ state: "visible", timeout: 45_000 }),
    ]);
    await expect(iaError, "a chamada ao Groq não deveria ter falhado").toBeHidden();
    await expect(answer).toBeVisible();
    expect((await answer.innerText()).trim().length).toBeGreaterThan(10);
  });

  // BLOQUEADO por saldo: o OCR agora usa Z.ai glm-4.5v (lib/zai-vision.ts → zaiOcr), o único
  // modelo de visão vivo na conta — mas ele exige saldo/resource package na Z.ai (1113). Sem
  // saldo, /api/leitura/ocr degrada pra 503. Trocar `fixme` por `test` quando a conta tiver
  // saldo; a asserção `toBe(200)` já é o guarda de regressão.
  test.fixme("OCR ponta-a-ponta: 1ª chamada extrai, 2ª vem do cache", async () => {
    expect(bookId).not.toBeNull();
    const result = await page.evaluate(async (id) => {
      const c = document.createElement("canvas");
      c.width = 900;
      c.height = 300;
      const ctx = c.getContext("2d");
      if (!ctx) return { error: "no-canvas" } as const;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 900, 300);
      ctx.fillStyle = "#000000";
      ctx.font = "bold 64px sans-serif";
      ctx.fillText("OCR TOUVIE 4242", 40, 170);
      const image = c.toDataURL("image/webp", 0.9);
      const post = async () => {
        const r = await fetch("/api/leitura/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId: id, page: 1, image }),
        });
        return { status: r.status, body: (await r.json()) as { text?: string; cached?: boolean } };
      };
      const first = await post();
      const second = await post();
      return { first, second };
    }, bookId);

    if ("error" in result) throw new Error("canvas indisponível no browser de teste");

    // A rota deve aceitar a imagem e responder 200 nas duas chamadas.
    expect(result.first.status, "1ª chamada de OCR").toBe(200);
    expect(result.second.status, "2ª chamada de OCR").toBe(200);

    // Se o Groq leu algo (esperado), a 2ª chamada tem de vir do cache.
    if (result.first.body.text && result.first.body.text.length > 0) {
      expect(result.first.body.cached, "1ª chamada não vem do cache").toBe(false);
      expect(result.second.body.cached, "2ª chamada deve vir do cache").toBe(true);
      expect(result.second.body.text).toBe(result.first.body.text);
    } else {
      // Groq visão não devolveu texto — não é bug do app; anota e não falha o cache.
      test.info().annotations.push({
        type: "warning",
        description: `OCR retornou texto vazio (Groq): status ${result.first.status}`,
      });
    }
  });
});

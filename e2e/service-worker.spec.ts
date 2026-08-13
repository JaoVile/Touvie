import { expect, test } from "@playwright/test";

/**
 * Service worker (`public/sw.js`).
 *
 * ⚠️ Limite honesto deste arquivo: estes testes rodam contra o **dev server**,
 * e o SW desliga o cache em localhost de propósito — em dev os chunks do Next
 * mudam sem mudar de nome, e cachear deixaria você olhando pra código velho.
 * Então o que dá pra provar aqui é: o SW registra, ativa, precacheia a página
 * de offline, e NÃO cacheia mais nada em dev (a guarda funciona).
 *
 * O cache dos estáticos em si só acontece em produção (nomes com hash de
 * conteúdo). Isso é verificado à mão contra `next start` — está registrado no
 * commit.
 */

const CACHE = "touvie-v2";

/** Espera o SW assumir o controle da página. */
async function waitActive(page: import("@playwright/test").Page) {
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg?.active);
    },
    null,
    { timeout: 20_000 },
  );
}

/** Caminhos guardados no cache do SW. */
async function cachedPaths(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(async (cacheName) => {
    const c = await caches.open(cacheName);
    return (await c.keys()).map((r) => new URL(r.url).pathname);
  }, CACHE);
}

test.describe("PWA — service worker", () => {
  test("registra, ativa e precacheia a página de offline", async ({ page }) => {
    await page.goto("/");
    await waitActive(page);

    // O install escreve no cache de forma assíncrona à ativação — espera a
    // escrita em vez de ler uma vez e torcer.
    await expect.poll(() => cachedPaths(page), { timeout: 15_000 }).toContain("/offline.html");
  });

  test("em dev NÃO cacheia estáticos — a guarda de localhost segura", async ({ page }) => {
    await page.goto("/");
    await waitActive(page);
    await expect.poll(() => cachedPaths(page), { timeout: 15_000 }).toContain("/offline.html");

    // Segunda visita: se fosse cachear estático, seria agora.
    await page.reload();
    await waitActive(page);

    // Só a página de offline. Nada de /_next/static nem de ícones.
    expect(await cachedPaths(page)).toEqual(["/offline.html"]);
  });

  test("navegação continua funcionando com o SW no controle", async ({ page }) => {
    await page.goto("/");
    await waitActive(page);
    await page.goto("/metas");
    await expect(page).toHaveURL(/\/metas/);
    // Se o SW tivesse engolido a navegação, cairíamos no offline.html.
    await expect(page.getByText("Sem conexão")).toBeHidden();
  });
});

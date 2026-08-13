import { expect, test } from "@playwright/test";

/**
 * Botão "forçar atualização" (`app/(app)/config/ForceUpdate.tsx`).
 *
 * É o Ctrl+Shift+R que o Android não tem: apaga os caches do service worker,
 * desregistra o SW e recarrega. Dá pra testar de verdade — diferente do convite
 * de instalação, aqui não depende de evento do browser.
 *
 * O que NÃO pode acontecer (e o teste cobre): perder a sessão. O botão mexe em
 * cache, não em cookie/localStorage.
 */

const SEED_CACHE = "touvie-seed-de-teste";

test.describe("PWA — forçar atualização", () => {
  test("apaga os caches, recarrega e mantém a sessão", async ({ page }) => {
    // O card vive na aba "avançado" (a página abre em "geral").
    await page.goto("/config?tab=avancado");

    // Semeia um cache pra provar que o botão realmente limpa.
    await page.evaluate(async (name) => {
      const c = await caches.open(name);
      await c.put("/seed-de-teste", new Response("x"));
    }, SEED_CACHE);
    expect(await page.evaluate(() => caches.keys())).toContain(SEED_CACHE);

    await page.getByRole("button", { name: "Forçar atualização" }).click();

    // A página recarrega; espera o /config voltar a responder.
    await page.waitForLoadState("load");
    await expect(page.getByRole("button", { name: "Forçar atualização" })).toBeVisible({
      timeout: 20_000,
    });

    // Cache semeado morreu.
    await expect
      .poll(() => page.evaluate(() => caches.keys()), { timeout: 15_000 })
      .not.toContain(SEED_CACHE);

    // E continuamos logados: /config é rota autenticada, se tivesse deslogado
    // o middleware teria mandado pro /login.
    await expect(page).toHaveURL(/\/config/);
  });
});

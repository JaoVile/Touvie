import { expect, test } from "@playwright/test";

/**
 * Convite de instalação do PWA (`components/InstallPrompt.tsx`).
 *
 * O que dá pra testar aqui: o Chrome só dispara `beforeinstallprompt` de
 * verdade quando o app ainda não está instalado e ele resolve que a pessoa
 * "merece" o convite — heurística que o Playwright não controla. Então o teste
 * dispara um evento SINTÉTICO com a mesma forma (preventDefault + prompt) e
 * verifica o que é nosso: o banner aparece, o "Agora não" some com ele, e a
 * dispensa PERSISTE entre recargas.
 *
 * O `prompt()` nativo em si não é alcançável por teste — é verificado à mão.
 *
 * Usa a sessão autenticada global (storageState do playwright.config).
 */

const DISMISS_KEY = "touvie:install-dismissed";

/** Dispara um `beforeinstallprompt` com a forma que o componente espera. */
async function fireInstallPrompt(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    e.prompt = () => Promise.resolve();
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
}

/**
 * O evento só é ouvido depois que o React hidrata, e não há sinal público de
 * "hidratou". Então dispara em loop até o banner aparecer — se nunca aparecer,
 * o toPass estoura e o teste falha de verdade.
 */
async function fireUntilVisible(page: import("@playwright/test").Page) {
  await expect(async () => {
    await fireInstallPrompt(page);
    await expect(page.getByText("Instalar o Touvie")).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 20_000 });
}

test.describe("PWA — convite de instalação", () => {
  test.beforeEach(async ({ page }) => {
    // Começa sempre "nunca dispensou" — o estado mora no localStorage.
    await page.goto("/");
    await page.evaluate((k) => localStorage.removeItem(k), DISMISS_KEY);
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate((k) => localStorage.removeItem(k), DISMISS_KEY).catch(() => {});
  });

  test("não aparece sozinho: sem o evento do browser, nada é mostrado", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Instalar o Touvie")).toBeHidden();
  });

  test("aparece quando o browser oferece a instalação", async ({ page }) => {
    await page.goto("/");
    await fireUntilVisible(page);
    await expect(page.getByRole("button", { name: "Instalar" })).toBeVisible();
  });

  test("dispensar o banner NÃO tira a instalação do /config", async ({ page }) => {
    await page.goto("/");
    await fireUntilVisible(page);
    await page.getByRole("button", { name: "Agora não" }).click();
    await expect(page.getByText("Instalar o Touvie")).toBeHidden();

    // O ponto do teste: a dispensa é sobre o BANNER. Se a captura do evento
    // dependesse dela (como dependia antes), aqui não haveria o que instalar.
    // A seção de instalar mora no fim da aba "avançado".
    await page.goto("/config?tab=avancado");
    await expect(async () => {
      await fireInstallPrompt(page);
      await expect(page.getByRole("button", { name: "Instalar agora" })).toBeVisible({
        timeout: 500,
      });
    }).toPass({ timeout: 20_000 });

    // E o banner continua dispensado nesta página.
    await expect(page.getByText("Instalar o Touvie")).toBeHidden();
  });

  test("'Agora não' dispensa e a dispensa sobrevive à recarga", async ({ page }) => {
    await page.goto("/");
    await fireUntilVisible(page);

    await page.getByRole("button", { name: "Agora não" }).click();
    await expect(page.getByText("Instalar o Touvie")).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), DISMISS_KEY)).toBe("1");

    // Recarrega e oferece de novo: não pode voltar. Insiste por alguns segundos
    // pra cobrir a hidratação — se o banner fosse voltar, voltaria aqui.
    await page.reload();
    for (let i = 0; i < 6; i++) {
      await fireInstallPrompt(page);
      await page.waitForTimeout(500);
    }
    await expect(page.getByText("Instalar o Touvie")).toBeHidden();
  });
});

import { expect, test } from "@playwright/test";

/**
 * Canais de notificação (`app/(app)/config/NotifyChannels.tsx`).
 *
 * O Playwright CONSEGUE conceder a permissão de notificação, então dá pra
 * testar os estados da tela. O que ele NÃO testa é a entrega: push real exige o
 * serviço do navegador, que não existe em ambiente de teste — isso é o botão
 * "Enviar teste" no aparelho, depois do deploy.
 *
 * Restaura a preferência no fim: sem isso o spec seguinte herda o estado.
 */

// O "headless shell" (binário padrão do Playwright) sempre reporta
// `Notification.permission` como "denied", mesmo depois de
// `context.grantPermissions(["notifications"])` — não embute a API de
// notificação nativa. O canal "chromium" usa o Chromium completo em modo
// "new headless" (suporta notificações) — continua headless, roda em
// qualquer lugar, sem exigir display.
test.use({ channel: "chromium" });

const AVANCADO = "/config?tab=avancado";

/**
 * Liga/desliga garantindo o estado final, seja qual for o inicial.
 *
 * Espera o interruptor voltar a ficar habilitado (o componente o desabilita
 * enquanto a Server Action está em voo) antes de devolver o controle — sem
 * isso, um `reload()` ou `goto()` logo em seguida pode chegar antes do banco
 * confirmar a escrita e o teste lê o valor antigo. Medido neste ambiente: a
 * volta de `updateNotifyChannels` (Supabase remoto) leva ~0.6–1s.
 */
async function setChannel(page: import("@playwright/test").Page, label: string, ligado: boolean) {
  const sw = page.getByRole("switch", { name: label });
  const atual = (await sw.getAttribute("aria-checked")) === "true";
  if (atual !== ligado) {
    await sw.click();
    await expect(sw).toBeEnabled({ timeout: 10_000 });
  }
}

test.describe("Notificações — canais", () => {
  test.afterEach(async ({ page }) => {
    // Volta pro padrão (os dois ligados) e ESPERA a confirmação: a Server Action
    // é assíncrona, e sair antes dela completar deixa o banco sujo pro próximo
    // spec (aconteceu no da barra de navegação).
    await page.goto(AVANCADO);
    await setChannel(page, "Receber no app", true);
    await setChannel(page, "Receber no Telegram", true);
    await expect(page.getByText("Com os dois desligados")).toBeHidden();
  });

  test("avisa quando os dois canais estão desligados", async ({ page, context }) => {
    await context.grantPermissions(["notifications"]);
    await page.goto(AVANCADO);

    await setChannel(page, "Receber no app", false);
    await setChannel(page, "Receber no Telegram", false);

    await expect(
      page.getByText("Com os dois desligados você não vai receber lembrete em lugar nenhum."),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("a preferência sobrevive à recarga", async ({ page, context }) => {
    await context.grantPermissions(["notifications"]);
    await page.goto(AVANCADO);

    await setChannel(page, "Receber no Telegram", false);
    await page.reload();

    await expect(page.getByRole("switch", { name: "Receber no Telegram" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("com permissão concedida, oferece ativar no aparelho", async ({ page, context }) => {
    await context.grantPermissions(["notifications"]);
    await page.goto(AVANCADO);
    // Chromium concede sem diálogo; o botão de assinar tem que estar disponível.
    await expect(page.getByRole("button", { name: "Ativar no app" })).toBeVisible();
  });
});

test.describe("Notificações — canais: permissão negada", () => {
  test("explica que o navegador não pergunta de novo, sem botão morto", async ({ page }) => {
    // Simula `Notification.permission === "denied"` sem depender do diálogo do
    // OS — sobrescreve o getter ANTES de qualquer script da página rodar.
    await page.addInitScript(() => {
      Object.defineProperty(Notification, "permission", { get: () => "denied" });
    });
    await page.goto(AVANCADO);
    await expect(page.getByText("Notificações bloqueadas neste navegador.")).toBeVisible();
    await expect(
      page.getByText("O navegador não pergunta de novo — libere nas configurações do site"),
    ).toBeVisible();
    // Nada de botão de ativar nesse estado.
    await expect(page.getByRole("button", { name: "Ativar no app" })).toBeHidden();
  });
});

test.describe("Notificações — canais: iOS Safari sem instalar", () => {
  // UA de iPhone Safari real — decidirEstado() detecta por essa string
  // (isIOSSafari), então precisa bater com o regex de verdade, não um mock.
  test.use({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  });

  test("aponta pra instalar o app antes de ativar notificações", async ({ page }) => {
    await page.goto(AVANCADO);
    await expect(
      page.getByText("No iPhone, notificações só funcionam com o app instalado"),
    ).toBeVisible();
    // A ordem da decisão importa: iOS-sem-instalar vence "sem suporte", então
    // o link pra seção de instalar tem que estar lá — não uma mensagem genérica.
    await expect(page.getByRole("link", { name: "Instalar o app" })).toBeVisible();
    await expect(page.getByText("Este navegador não suporta notificações.")).toBeHidden();
  });
});

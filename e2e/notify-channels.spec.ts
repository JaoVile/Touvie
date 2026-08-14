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

// Chromium headless SEMPRE reporta `Notification.permission` como "denied",
// mesmo depois de `context.grantPermissions(["notifications"])` — é uma
// limitação conhecida do Chromium (falta de display real pra UI nativa de
// notificação), não um bug do componente. Confirmado durante a implementação:
// em modo headed (com display), a permissão concedida é refletida
// corretamente e o fluxo funciona. Este arquivo roda headed só por isso —
// o resto da suíte continua headless.
test.use({ headless: false });

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

import { existsSync } from "node:fs";
import { type BrowserContext, type Locator, type Page, expect, test } from "@playwright/test";

/**
 * Clica `button` até `target` aparecer. Cobre o clique disparado ANTES da
 * hidratação (o botão existe no HTML do SSR mas o onClick do React ainda não foi
 * conectado — comum no 1º hit de uma rota compilada sob demanda em dev). Re-clica
 * só ENQUANTO o botão ainda está visível, pra nunca disparar a ação duas vezes
 * (quando o clique pega e o botão some/troca pelo form, apenas confere o alvo).
 */
async function clickUntil(button: Locator, target: Locator, timeout = 25_000) {
  await expect(async () => {
    if (await button.isVisible().catch(() => false)) {
      await button.click({ timeout: 3_000 });
    }
    await expect(target).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout });
}

/**
 * SEGURANÇA — RLS cross-user: um usuário NÃO enxerga os dados de outro.
 *
 * Este é o teste de segurança de severidade ALTA que faltava. O `rls-anon.spec.ts`
 * prova que um ANÔNIMO é barrado; aqui provamos o degrau mais fino e mais crítico:
 * dois usuários LOGADOS e legítimos (A e B) não vazam dado um pro outro. Toda
 * tabela do app é escopada por `user_id` com RLS — se uma policy estiver frouxa,
 * é aqui que aparece.
 *
 * Como funciona: abrimos DOIS contextos de browser na mesma corrida, cada um com a
 * sessão de um usuário (storageState gravado pelo global-setup). O usuário B cria
 * um dado com marcador único; o usuário A tenta VER esse dado — na listagem e, quando
 * dá, indo direto na URL pelo id (proof mais forte: nem com o id A consegue ler). A
 * asserção-chave é sempre a MESMA: o marcador de B é INVISÍVEL pra A.
 *
 * Cobre 3 tabelas distintas: `notes` (notas), `goals` (metas), `transactions`
 * (finanças). B limpa o que criou no finally — nada de lixo no banco de teste.
 *
 * Pré-condição: o 2º usuário de teste (TEST_USER2_* no .env.test). Sem o
 * `user2.json` (global-setup só o gera quando essas vars existem), a suíte se pula
 * sozinha em vez de falhar.
 */

const AUTH_A = "e2e/.auth/user.json"; // usuário "dono" — o de sempre
const AUTH_B = "e2e/.auth/user2.json"; // 2º usuário — cria o dado que A não pode ver
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3007";

// Serial + slow: cada teste sobe 2 contextos e dispara Server Actions que
// revalidam rotas; em paralelo sobre um dev server contendido isso satura a
// compilação sob demanda e estoura timeout. Um fluxo de cada vez é determinístico.
test.describe.configure({ mode: "serial" });

test.describe("segurança — RLS cross-user (A não vê os dados de B)", () => {
  // Sem o 2º usuário configurado, não há o que testar — pula todo o grupo.
  test.skip(
    !existsSync(AUTH_B),
    "Falta e2e/.auth/user2.json — configure TEST_USER2_* no .env.test (ver .env.test.example).",
  );

  let ctxA: BrowserContext;
  let ctxB: BrowserContext;
  let pageA: Page; // sessão do dono
  let pageB: Page; // sessão do 2º usuário

  test.beforeEach(async ({ browser }) => {
    // Dev server compila sob demanda e cada Server Action revalida a rota — fluxos
    // multi-passo estouram o timeout padrão sob contenção. slow() triplica (→90s).
    test.slow();
    ctxB = await browser.newContext({ storageState: AUTH_B, baseURL });
    ctxA = await browser.newContext({ storageState: AUTH_A, baseURL });
    pageB = await ctxB.newPage();
    pageA = await ctxA.newPage();
    // Deletes disparam window.confirm(); aceita em ambos (só B apaga, A é defensivo).
    pageB.on("dialog", (d) => d.accept());
    pageA.on("dialog", (d) => d.accept());
  });

  test.afterEach(async () => {
    await ctxB?.close();
    await ctxA?.close();
  });

  test("notas: A não vê a nota de B (nem na lista, nem pela URL do id)", async () => {
    const marker = `E2E RLS nota ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    let noteId: string | null = null;

    try {
      // ── B cria uma nota com o marcador ─────────────────────────────────────
      await pageB.goto("/notas");
      await pageB.getByRole("button", { name: /Nova nota/ }).click();
      await pageB.waitForURL(/\/notas\/[0-9a-f-]{36}/, { timeout: 15_000 });
      noteId = pageB.url().match(/\/notas\/([0-9a-f-]{36})/)?.[1] ?? null;
      expect(noteId, "deveria capturar o id da nota de B").not.toBeNull();

      await pageB.getByPlaceholder("Título da nota").fill(marker);
      await pageB.getByPlaceholder("Escreva aqui…").fill(`corpo secreto de B — ${marker}`);
      // Autosave: confirma que persistiu ("salvo") antes de A tentar ver.
      await expect(pageB.getByText("salvo", { exact: true })).toBeVisible({ timeout: 12_000 });

      // ── A NÃO pode ver a nota de B ─────────────────────────────────────────
      // 1) Não aparece na listagem de A.
      await pageA.goto("/notas", { waitUntil: "domcontentloaded" });
      await expect(
        pageA.getByText(marker, { exact: false }),
        "a nota de B não pode aparecer na lista de A",
      ).toHaveCount(0);

      // 2) Nem indo DIRETO na URL pelo id (RLS de linha: a query volta vazia).
      await pageA.goto(`/notas/${noteId}`, { waitUntil: "domcontentloaded" });
      await expect(
        pageA.getByText(marker, { exact: false }),
        "A não pode ler o conteúdo da nota de B nem sabendo o id",
      ).toHaveCount(0);
      await expect(
        pageA.getByText(`corpo secreto de B — ${marker}`, { exact: false }),
        "o corpo da nota de B não pode vazar pra A",
      ).toHaveCount(0);
    } finally {
      // ── B limpa a própria nota ─────────────────────────────────────────────
      if (noteId) {
        await pageB.goto(`/notas/${noteId}`, { waitUntil: "domcontentloaded" }).catch(() => {});
        const apagar = pageB.getByRole("button", { name: "Apagar" });
        if (await apagar.isVisible().catch(() => false)) {
          await apagar.click();
          await pageB.waitForURL(/\/notas(\?|$)/, { timeout: 10_000 }).catch(() => {});
        }
      }
    }
  });

  test("metas: A não vê a meta de B", async () => {
    const marker = `E2E RLS meta ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    // <li> de meta ativa com o marcador (padrão do CRUD de metas).
    const goalRowB = pageB
      .locator("li")
      .filter({ has: pageB.getByRole("button", { name: "Editar meta" }) })
      .filter({ hasText: marker });

    try {
      // ── B cria uma meta ────────────────────────────────────────────────────
      await pageB.goto("/metas", { waitUntil: "domcontentloaded" });
      const form = pageB.locator("form").filter({ has: pageB.locator('input[name="title"]') });
      // Clicar "+ Nova meta" TROCA o botão pelo form (adding ? form : botão); o
      // clickUntil cobre o 1º hit não-hidratado sem reabrir/duplicar.
      await clickUntil(
        pageB.getByRole("button", { name: "+ Nova meta" }),
        form.locator('input[name="title"]'),
      );
      await form.locator('input[name="title"]').fill(marker);
      await form.getByRole("button", { name: "Salvar" }).click();
      await expect(goalRowB, "a meta de B deveria ter sido criada").toHaveCount(1);

      // ── A NÃO pode ver a meta de B ─────────────────────────────────────────
      await pageA.goto("/metas", { waitUntil: "domcontentloaded" });
      await expect(
        pageA.getByText(marker, { exact: false }),
        "a meta de B não pode aparecer pra A",
      ).toHaveCount(0);
    } finally {
      // ── B apaga a própria meta ─────────────────────────────────────────────
      await pageB.goto("/metas", { waitUntil: "domcontentloaded" }).catch(() => {});
      for (let i = 0; i < 5 && (await goalRowB.count().catch(() => 0)) > 0; i++) {
        await goalRowB.first().getByRole("button", { name: "Apagar meta" }).click();
        await expect(goalRowB)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    }
  });

  test("finanças: A não vê o lançamento de B", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const marker = `E2E RLS fin ${stamp}`; // descrição do lançamento de B
    const catName = `E2E RLS cat ${stamp}`; // categoria descartável (pré-condição)

    const rowB = pageB.locator("li").filter({ hasText: marker });

    try {
      // ── B: pré-condição (o form de lançamento só aparece com ≥1 categoria) ──
      await pageB.goto("/financas?t=setup", { waitUntil: "domcontentloaded" });
      await pageB.locator('input[name="name"]').fill(catName);
      // clickUntil cobre o clique pré-hidratação; o alvo (Arquivar) some no cleanup.
      await clickUntil(
        pageB.getByRole("button", { name: "Adicionar categoria" }),
        pageB.getByRole("button", { name: `Arquivar ${catName}` }),
      );

      // ── B cria um lançamento (12.34 reais → R$ 12,34) ──────────────────────
      await pageB.goto("/financas?t=lancamentos", { waitUntil: "domcontentloaded" });
      await pageB.locator('input[name="amount"]').first().fill("12.34");
      await pageB.locator('input[name="description"]').first().fill(marker);
      await clickUntil(pageB.getByRole("button", { name: "Adicionar" }), rowB);

      // ── A NÃO pode ver o lançamento de B ───────────────────────────────────
      await pageA.goto("/financas?t=lancamentos", { waitUntil: "domcontentloaded" });
      await expect(
        pageA.getByText(marker, { exact: false }),
        "o lançamento de B não pode aparecer pra A",
      ).toHaveCount(0);
    } finally {
      // ── B limpa: apaga o lançamento e arquiva a categoria ──────────────────
      try {
        await pageB.goto("/financas?t=lancamentos", { waitUntil: "domcontentloaded" });
        for (let i = 0; i < 10 && (await rowB.count().catch(() => 0)) > 0; i++) {
          await rowB.first().getByRole("button", { name: "Apagar lançamento" }).click();
          await expect(rowB)
            .toHaveCount(0, { timeout: 7_000 })
            .catch(() => {});
        }
      } catch {
        // best-effort
      }
      try {
        await pageB.goto("/financas?t=setup", { waitUntil: "domcontentloaded" });
        const archive = pageB.getByRole("button", { name: `Arquivar ${catName}` });
        // Loop: se um clique pré-hidratação tiver criado categoria duplicada,
        // arquiva todas as que casam o nome.
        for (let i = 0; i < 5 && (await archive.count().catch(() => 0)) > 0; i++) {
          await archive.first().click();
          await expect(archive)
            .toHaveCount(0, { timeout: 7_000 })
            .catch(() => {});
        }
      } catch {
        // best-effort
      }
    }
  });

  test("dieta: A não vê o alimento nem a refeição de B", async () => {
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const foodB = `E2E RLS food ${stamp}`; // alimento de B
    const foodA = `E2E RLS seed A ${stamp}`; // alimento de A (só pra a aba Hoje de A renderizar)

    // Card "Café da manhã" na sessão de B (GlassCard = div.glass com o heading).
    const cafeB = pageB
      .locator(".glass")
      .filter({ has: pageB.getByRole("heading", { name: "Café da manhã" }) });

    try {
      // ── B: cria um alimento e o adiciona a uma refeição ────────────────────
      await pageB.goto("/dieta?t=alimentos", { waitUntil: "domcontentloaded" });
      await pageB.locator('input[name="name"]').fill(foodB);
      await pageB.locator('input[name="kcal_per_100g"]').fill("100");
      await pageB.getByRole("button", { name: "Adicionar" }).click();
      await expect(
        pageB.locator("li").filter({ hasText: foodB }),
        "o alimento de B deveria ser criado",
      ).toBeVisible({ timeout: 10_000 });

      await pageB.goto("/dieta?t=hoje", { waitUntil: "domcontentloaded" });
      await clickUntil(
        cafeB.getByRole("button", { name: "+ adicionar item" }),
        cafeB.locator("select"),
      );
      await cafeB.locator("select").selectOption({ label: foodB });
      await cafeB.locator('input[placeholder="g"]').fill("50");
      await cafeB.getByRole("button", { name: "+", exact: true }).click();
      await expect(
        pageB.locator("li").filter({ hasText: foodB }),
        "a refeição de B deveria ter o item",
      ).toBeVisible({ timeout: 10_000 });

      // ── A: semeia o próprio alimento (senão a aba Hoje de A é só o estado vazio) ─
      await pageA.goto("/dieta?t=alimentos", { waitUntil: "domcontentloaded" });
      await pageA.locator('input[name="name"]').fill(foodA);
      await pageA.locator('input[name="kcal_per_100g"]').fill("100");
      await pageA.getByRole("button", { name: "Adicionar" }).click();
      await expect(
        pageA.locator("li").filter({ hasText: foodA }),
        "o alimento seed de A deveria ser criado",
      ).toBeVisible({ timeout: 10_000 });

      // ── A NÃO pode ver nada de B ───────────────────────────────────────────
      // Catálogo (tabela `foods`): o alimento de B não aparece pra A.
      await expect(
        pageA.getByText(foodB, { exact: false }),
        "o alimento de B não pode aparecer no catálogo de A",
      ).toHaveCount(0);
      // Aba Hoje (tabelas `meals`/`meal_items`): renderiza os cards de A (tem o seed);
      // o nome do alimento/refeição de B NÃO pode vazar.
      await pageA.goto("/dieta?t=hoje", { waitUntil: "domcontentloaded" });
      await expect(
        pageA.getByRole("heading", { name: "Café da manhã" }),
        "a aba Hoje de A deve renderizar (A tem 1 alimento)",
      ).toBeVisible({ timeout: 10_000 });
      await expect(
        pageA.getByText(foodB, { exact: false }),
        "a refeição/alimento de B não pode aparecer pra A",
      ).toHaveCount(0);
    } finally {
      // ── B limpa: apaga a refeição (cascata no item) e o alimento ───────────
      try {
        await pageB.goto("/dieta?t=hoje", { waitUntil: "domcontentloaded" });
        const apagarRef = cafeB.getByRole("button", { name: "apagar refeição" });
        if (await apagarRef.isVisible().catch(() => false)) {
          await apagarRef.click();
          await expect(apagarRef)
            .toHaveCount(0, { timeout: 7_000 })
            .catch(() => {});
        }
      } catch {
        // best-effort
      }
      // Apaga os alimentos de B e de A (cada um na própria sessão).
      for (const [pg, name] of [
        [pageB, foodB],
        [pageA, foodA],
      ] as const) {
        try {
          await pg.goto("/dieta?t=alimentos", { waitUntil: "domcontentloaded" });
          const row = pg.locator("li").filter({ hasText: name });
          for (let i = 0; i < 3 && (await row.count().catch(() => 0)) > 0; i++) {
            await row.first().getByRole("button", { name: "Apagar" }).click();
            await expect(row)
              .toHaveCount(0, { timeout: 7_000 })
              .catch(() => {});
          }
        } catch {
          // best-effort
        }
      }
    }
  });
});

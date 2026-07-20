import { expect, test } from "@playwright/test";

// Estes testes rodam SEM sessão (anônimo) — sobrescreve o storageState global.
test.use({ storageState: { cookies: [], origins: [] } });

// Rotas logadas que um visitante anônimo NÃO pode acessar. O middleware deve
// redirecionar pro /login (protege finanças, diário, notas, etc.).
const PROTECTED = ["/financas", "/diario", "/notas", "/metas", "/treino", "/config"];

test.describe("segurança — anônimo é barrado", () => {
  for (const path of PROTECTED) {
    test(`anônimo em ${path} vai pro /login`, async ({ page }) => {
      await page.goto(path);
      await expect(page, `${path} deveria exigir login`).toHaveURL(/\/login/);
    });
  }

  test("raiz anônima cai na landpage (rewrite), não no app", async ({ page }) => {
    await page.goto("/");
    // Anônimo vê a landing (rewrite mantém a URL em "/"); o conteúdo é público.
    await expect(page).not.toHaveURL(/\/(financas|metas|rotina)/);
  });
});

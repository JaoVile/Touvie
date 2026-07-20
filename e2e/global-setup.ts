import { type Browser, chromium } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/user.json";
const AUTH_FILE_2 = "e2e/.auth/user2.json";

/**
 * Loga um usuário pela UI e salva a sessão (cookies do @supabase/ssr) no arquivo
 * dado — os testes autenticados reusam via storageState. Login pela UI (não REST)
 * porque o app guarda a sessão em COOKIE via ssr, não em localStorage; logar pelo
 * formulário deixa o servidor setar os cookies certos.
 */
async function loginAndSave(
  browser: Browser,
  baseURL: string,
  email: string,
  password: string,
  file: string,
) {
  const page = await browser.newPage({ baseURL });
  try {
    await page.goto("/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    // Sucesso = saiu do /login (o middleware redireciona logado pra "/").
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
    await page.context().storageState({ path: file });
  } finally {
    await page.close();
  }
}

/**
 * Loga UMA vez o(s) usuário(s) de teste dedicado(s) e salva as sessões. O USER1
 * é obrigatório (toda a suíte usa). O USER2 (TEST_USER2_*) é opcional — só os
 * testes de RLS cross-user precisam; sem ele, esses specs se pulam sozinhos.
 */
export default async function globalSetup() {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3007";

  if (!email || !password) {
    throw new Error(
      "Faltam TEST_USER_EMAIL / TEST_USER_PASSWORD. Crie o .env.test na raiz " +
        "(copie de .env.test.example) com a conta de teste dedicada do Supabase.",
    );
  }

  const browser = await chromium.launch();
  try {
    await loginAndSave(browser, baseURL, email, password, AUTH_FILE);

    const email2 = process.env.TEST_USER2_EMAIL;
    const password2 = process.env.TEST_USER2_PASSWORD;
    if (email2 && password2) {
      await loginAndSave(browser, baseURL, email2, password2, AUTH_FILE_2);
    }
  } finally {
    await browser.close();
  }
}

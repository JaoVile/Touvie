import { chromium } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Loga UMA vez com o usuário de teste dedicado e salva a sessão (cookies do
 * @supabase/ssr) em e2e/.auth/user.json — todos os testes autenticados reusam.
 * Login pela UI (não REST) porque o app guarda a sessão em COOKIE via ssr, não
 * em localStorage; logar pelo formulário deixa o servidor setar os cookies certos.
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
    const page = await browser.newPage({ baseURL });
    await page.goto("/login");
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    // Sucesso = saiu do /login (o middleware redireciona logado pra "/").
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
    await page.context().storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}

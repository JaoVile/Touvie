import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Carrega .env.test (credenciais do usuário de teste dedicado) sem depender de
// dotenv. NÃO commitado — ver .env.test.example.
const envPath = join(process.cwd(), ".env.test");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3007";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Reporter mínimo no terminal (line) — o subagente testador parseia isso sem
  // entupir o contexto; HTML fica pro humano inspecionar falha.
  reporter: process.env.CI ? "line" : [["line"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Sessão autenticada gravada pelo global-setup (login uma vez).
    storageState: "e2e/.auth/user.json",
  },
  globalSetup: "./e2e/global-setup.ts",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Reusa o dev server se já estiver no ar (localhost:3007); senão sobe.
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});

import { expect, test } from "@playwright/test";

/**
 * Compactação de histórico do Toube + "limpar tudo" na config.
 *
 * Compactação: `app/api/toube/route.ts` (POST) resume+poda as mensagens mais
 * antigas de uma sessão quando ela cruza COMPACT_TRIGGER=30 mensagens cruas,
 * mantendo ~HISTORY_WINDOW=20 vivas + `toube_sessions.summary` atualizado
 * (Groq via `lib/toube-compact.ts`). Cada POST dispara uma resposta REAL do
 * Toube (Z.ai) — por isso o teste é lento (16 turnos sequenciais) e usa
 * `test.setTimeout` bem folgado.
 *
 * Limpar: `app/(app)/config/ToubeHistoryManager.tsx` (aba "avançado" de
 * /config) aciona a server action `clearToubeHistory` (apaga toube_sessions
 * do usuário; toube_messages cai por cascade — FK da migration 0030).
 *
 * Usa a sessão autenticada global (storageState). Serial: o teste de limpar
 * depende do estado deixado pelo de compactação (ou semeia o próprio dado se
 * rodar sozinho — ver fallback abaixo).
 */
test.describe.configure({ mode: "serial" });

/**
 * POST em /api/toube com retry: o Z.ai free tier ocasionalmente devolve 429
 * "temporarily overloaded" sob rajada de chamadas sequenciais (não é bug da
 * feature — é rate limit transiente do provedor). Tenta de novo com backoff
 * antes de desistir; qualquer outra falha (400/401/500...) já propaga na 1ª
 * tentativa, sem mascarar erro real.
 */
async function postToube(
  page: import("@playwright/test").Page,
  sessionId: string,
  message: string,
): Promise<{ status: number; body: unknown }> {
  const attempts = 4;
  let last: { status: number; body: unknown } = { status: 0, body: null };
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await page.evaluate(
      async ({ id, msg }) => {
        const r = await fetch("/api/toube", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: id, message: msg }),
        });
        return { status: r.status, body: await r.json().catch(() => null) };
      },
      { id: sessionId, msg: message },
    );
    if (last.status === 200) return last;
    const overloaded =
      last.status === 502 &&
      typeof last.body === "object" &&
      last.body !== null &&
      "error" in last.body &&
      /overloaded|429/i.test(String((last.body as { error?: unknown }).error));
    if (!overloaded || attempt === attempts - 1) return last;
    await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
  }
  return last;
}

test("compactação: >30 msgs cruas → summary preenchido e cruas podadas", async ({ page }) => {
  test.setTimeout(180_000);

  await page.goto("/toube");

  // Cria uma conversa NOVA e vazia (evita depender de estado deixado por
  // execuções anteriores) — ela vira a "sessão mais recente" do usuário.
  // .first(): o botão "+ Nova conversa" do topo da sidebar vem antes da lista
  // de sessões — que também pode ter uma entrada sem título ("Nova conversa"
  // é o fallback exibido pra sessão sem título ainda).
  const novaBtn = page.getByRole("button", { name: "Nova conversa" }).first();
  await novaBtn.click();
  await expect(novaBtn, "botão reabilita após createSession() resolver").toBeEnabled({
    timeout: 15_000,
  });

  const created = await page.evaluate(async () => {
    const r = await fetch("/api/toube", { method: "GET" });
    return (await r.json()) as { sessionId: string; messages: unknown[]; summary: string | null };
  });
  const sessionId = created.sessionId;
  expect(sessionId, "GET deveria resolver a sessão recém-criada").toBeTruthy();
  expect(created.messages.length, "sessão nova deveria começar vazia").toBe(0);

  // Dispara 16 turnos reais (cada um grava 1 msg user + 1 msg assistant). No
  // 16º turno o total cru cruza COMPACT_TRIGGER(30) e o motor de compactação
  // funde as mais antigas no summary rolante e poda pra ~HISTORY_WINDOW(20).
  for (let i = 0; i < 16; i++) {
    const res = await postToube(page, sessionId, `mensagem de teste número ${i}`);
    expect(
      res.status,
      `turno ${i} deveria responder 200 (corpo: ${JSON.stringify(res.body)})`,
    ).toBe(200);
  }

  const after = await page.evaluate(async () => {
    const r = await fetch("/api/toube", { method: "GET" });
    return (await r.json()) as { summary: string | null; messages: unknown[] };
  });

  expect(after.summary, "summary deve estar preenchido após compactar").toBeTruthy();
  expect(
    (after.summary ?? "").length,
    "summary deve ter conteúdo real, não só espaço em branco",
  ).toBeGreaterThan(10);
  expect(after.messages.length, "cruas podadas pra bem abaixo do gatilho de 30").toBeLessThan(30);
  expect(after.messages.length, "poda deveria ter deixado mensagens vivas").toBeGreaterThan(0);
});

test("limpar histórico: zera sessões e mensagens", async ({ page }) => {
  // Margem sobre o default de 30s do config: a semeadura + a action de limpar
  // + os GETs reais ficaram perto do teto (29.9s numa run), o que flakaria.
  test.setTimeout(60_000);
  await page.goto("/config?tab=avancado");

  const clearBtn = page.getByRole("button", { name: "Limpar todo o histórico do Toube" });
  await expect(clearBtn).toBeVisible();

  // Se rodar este teste isolado (sem o de compactação antes) e a conta de
  // teste já estiver zerada, o botão vem desabilitado (0 sessões/mensagens).
  // Semeia 1 mensagem via POST direto pra garantir que há o que limpar.
  if (await clearBtn.isDisabled()) {
    await page.evaluate(async () => {
      await fetch("/api/toube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: crypto.randomUUID(),
          message: "seed pra teste de limpar histórico",
        }),
      });
    });
    await page.reload();
  }

  await page.getByRole("button", { name: "Limpar todo o histórico do Toube" }).click();
  await page.getByRole("button", { name: "Confirmar — apagar tudo" }).click();
  await expect(page.getByText("Histórico apagado.")).toBeVisible();

  const after = await page.evaluate(async () => {
    const r = await fetch("/api/toube", { method: "GET" });
    return (await r.json()) as { summary: string | null; messages: unknown[] };
  });
  expect(after.messages.length, "sem mensagens depois de limpar tudo").toBe(0);
  expect(after.summary, "sem summary depois de limpar tudo").toBeNull();
});

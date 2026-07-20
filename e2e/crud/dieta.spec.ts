import { expect, test } from "@playwright/test";

/**
 * CRUD do módulo Dieta — aba MEDIDAS (/dieta?t=medidas).
 *
 * Fluxo mais limpo do módulo: `body_measurements` (peso + medidas corporais).
 * O form (`MeasurementForm`) é sempre INSERT — não renderiza `id` — e o
 * `MeasurementRow` só tem botão de apagar (× / aria-label="Apagar", via
 * `window.confirm`). O gráfico só pinta com ≥2 pesagens; a lista "Histórico"
 * mostra cada registro como um <li> com data + peso + medidas + notas.
 *
 * Usa a sessão autenticada global (storageState) — não loga aqui.
 *
 * Marcador único: as NOTAS do registro (`name="notes"`) carregam um stamp pra
 * localizar/limpar o <li> sem colidir com paralelas. A data fica no default do
 * DatePicker (hoje, via hidden input) — não há constraint unique em
 * (user_id, measured_on), então não há risco de colisão por data.
 *
 * EDITAR: o `MeasurementRow` tem botão "Editar medida" (lápis) que abre o
 * `MeasurementForm` inline, preenchido, com `id` escondido — o botão vira
 * "Atualizar" e `saveMeasurement` faz UPDATE por `id`. Testado abaixo.
 */

// Marcador único pra localizar/limpar sem colidir com paralelas.
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const marker = `E2E medida ${stamp}`; // vai nas NOTAS do registro
const weight = "77.7"; // peso distintivo; exibido como "77.7kg"

test.describe("CRUD dieta — medidas corporais", () => {
  // O botão × dispara window.confirm ("Apagar este registro?"): auto-aceita.
  test.beforeEach(async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
  });

  // Rede de segurança: mesmo se o teste falhar no meio, remove o registro criado
  // (via a própria UI) pra não deixar lixo no banco de teste.
  test.afterEach(async ({ page }) => {
    try {
      await page.goto("/dieta?t=medidas", { waitUntil: "domcontentloaded" });
      const rows = page.locator("li").filter({ hasText: marker });
      for (let i = 0; i < 10 && (await rows.count()) > 0; i++) {
        await rows.first().getByRole("button", { name: "Apagar" }).click();
        await expect(rows)
          .toHaveCount(0, { timeout: 7_000 })
          .catch(() => {});
      }
    } catch {
      // best-effort
    }
  });

  test("cria → (peso e notas certos) → apaga uma medida", async ({ page }) => {
    await page.goto("/dieta?t=medidas", { waitUntil: "domcontentloaded" });

    // --- CRIAR --------------------------------------------------------------
    const weightInput = page.locator('input[name="weight_kg"]');
    await expect(weightInput, "form de nova medida deveria estar visível").toBeVisible();

    // Data fica no default (hoje) via hidden input do DatePicker.
    await weightInput.fill(weight);
    await page.locator('input[name="waist_cm"]').fill("82");
    await page.locator('input[name="bodyfat_pct"]').fill("18.5");
    await page.locator('textarea[name="notes"]').fill(marker);
    await page.getByRole("button", { name: "Registrar" }).click();

    // --- VERIFICAR na lista Histórico --------------------------------------
    const row = page.locator("li").filter({ hasText: marker });
    await expect(row, "medida criada deve aparecer no histórico").toBeVisible({ timeout: 10_000 });
    // Peso exibido como "77.7kg" (toFixed(1)).
    await expect(row).toContainText("77.7kg");
    // Cintura e % gordura persistidos.
    await expect(row).toContainText("cintura 82");
    await expect(row).toContainText("18.5%");

    // --- APAGAR -------------------------------------------------------------
    await row.getByRole("button", { name: "Apagar" }).click();
    await expect(row, "medida deve sumir após apagar").toHaveCount(0, { timeout: 10_000 });
  });

  test("cria → edita o peso inline → apaga uma medida", async ({ page }) => {
    await page.goto("/dieta?t=medidas", { waitUntil: "domcontentloaded" });

    // --- CRIAR --------------------------------------------------------------
    const weightInput = page.locator('input[name="weight_kg"]');
    await expect(weightInput, "form de nova medida deveria estar visível").toBeVisible();
    await weightInput.fill(weight);
    await page.locator('textarea[name="notes"]').fill(marker);
    await page.getByRole("button", { name: "Registrar" }).click();

    const row = page.locator("li").filter({ hasText: marker });
    await expect(row, "medida criada deve aparecer no histórico").toBeVisible({ timeout: 10_000 });
    await expect(row).toContainText("77.7kg");

    // --- EDITAR inline ------------------------------------------------------
    await row.getByRole("button", { name: "Editar medida" }).click();
    // Form inline preenchido: muda só o peso. O input de peso do form de edição
    // vive DENTRO do próprio <li> (o form da sidebar fica fora dele).
    const editWeight = row.locator('input[name="weight_kg"]');
    await expect(editWeight, "form de edição deveria abrir preenchido").toHaveValue("77.7");
    await editWeight.fill("80");
    await row.getByRole("button", { name: "Atualizar" }).click();

    // --- VERIFICAR novo peso na lista --------------------------------------
    await expect(row, "peso editado deve refletir no histórico").toContainText("80.0kg", {
      timeout: 10_000,
    });
    await expect(row).not.toContainText("77.7kg");

    // --- APAGAR -------------------------------------------------------------
    await row.getByRole("button", { name: "Apagar" }).click();
    await expect(row, "medida deve sumir após apagar").toHaveCount(0, { timeout: 10_000 });
  });
});

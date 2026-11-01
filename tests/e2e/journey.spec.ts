import { expect, test } from "@playwright/test";

/**
 * Acceptance journey (sections 12.1–12.15 of the brief): sign up → company → first alert
 * profile → opportunities on the dashboard → detail with official link → save →
 * task → test email → sign out and back in with everything persisted.
 */
test("a new company finds, saves and tracks a relevant tender", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.test`;
  const password = `pw-${crypto.randomUUID()}`;

  // 1–2. Landing → sign up
  // Wait for hydration: before it, forms submit natively instead of through the app.
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("contratos públicos");
  await page.getByRole("link", { name: "Empezar gratis" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Tu nombre").fill("Ana Prueba");
  await page.getByLabel("Email profesional").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();

  // 3. Company
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Nombre de la empresa o del profesional").fill("Limpiezas Prueba S.L.");
  await page.getByRole("button", { name: "Continuar" }).click();

  // 4. Services
  await expect(page.getByRole("heading", { name: "Tu primer perfil de alertas" })).toBeVisible();
  await page.getByLabel("Nombre del perfil").fill("Limpieza de edificios");
  await page
    .getByLabel("Describe tus servicios o productos")
    .fill("Limpieza de edificios públicos, oficinas y colegios");
  await page.getByRole("button", { name: /^Limpieza/ }).click();
  await page.getByRole("button", { name: "Sugerir a partir de mi descripción" }).click();
  await page.getByRole("button", { name: "Añadir" }).first().click();
  await expect(page.getByRole("list", { name: "Códigos CPV seleccionados" })).toBeVisible();
  await page.getByLabel("Palabras clave que deben aparecer").fill("limpieza");
  await page.getByLabel("Palabras clave que deben aparecer").press("Enter");
  await page.getByRole("button", { name: "Continuar" }).click();

  // 5. Provinces: whole country
  await page.getByRole("switch", { name: "Toda España" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  // 6–7. Contract type + budget, save
  await page.getByText("Servicios", { exact: true }).click();
  await page.getByLabel("Presupuesto mínimo (€, sin IVA)").fill("1000");
  await page.getByRole("button", { name: "Guardar y ver oportunidades" }).click();

  // 8–10. Matches from imported official data appear on the dashboard
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Perfil guardado")).toBeVisible();
  const firstMatch = page.locator("table a[href^='/licitaciones/']").first();
  await expect(firstMatch).toBeVisible();

  // 11. Detail with official link
  await firstMatch.click();
  await expect(page.getByText("Por qué te lo mostramos")).toBeVisible();
  const official = page.getByRole("link", { name: "Ver expediente oficial" });
  await expect(official).toHaveAttribute("href", /contrataciondel(sector|estado)/);
  await expect(page.getByText("Presupuesto base de licitación (sin IVA)")).toBeVisible();
  await expect(page.getByText("Valor estimado del contrato")).toBeVisible();
  const tenderUrl = page.url();
  const tenderTitle = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();

  // 12. Save
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Seguimiento de tu empresa")).toBeVisible();

  // 13. Task
  await page.getByLabel("Título de la tarea").fill("Revisar pliego técnico");
  await page.getByLabel("Fecha de la tarea").fill("2030-01-15");
  await page.getByRole("button", { name: "Añadir tarea" }).click();
  await expect(page.getByText("Revisar pliego técnico")).toBeVisible();
  await page.getByLabel("Estado interno").click();
  await page.getByRole("option", { name: "Evaluando" }).click();
  await expect(page.getByText("Estado actualizado")).toBeVisible();

  // 14. Test notification (console provider in development)
  await page.goto("/ajustes", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Enviar correo de prueba" }).click();
  await expect(page.getByText(`Correo de prueba enviado a ${email}`)).toBeVisible();

  // 15. Sign out, sign back in, data is still there
  await page.goto("/dashboard");
  await page
    .getByRole("button", { name: /Limpiezas Prueba/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/login");
  await page.getByLabel("Email profesional").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/mis-licitaciones");
  await expect(page.getByRole("link", { name: tenderTitle }).first()).toBeVisible();
  await expect(page.getByText("1 tarea pendiente").first()).toBeVisible();
  await page.goto(tenderUrl);
  await expect(page.getByText("Revisar pliego técnico")).toBeVisible();
});

test("private routes redirect anonymous visitors to login", async ({ page }) => {
  await page.goto("/mis-licitaciones");
  await expect(page).toHaveURL(/\/login\?redirect=/);
});

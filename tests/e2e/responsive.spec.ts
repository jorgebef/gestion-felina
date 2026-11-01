import { expect, test, type Page } from "@playwright/test";

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test("the app is usable on a phone", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  await noHorizontalScroll(page);

  await page.goto("/login?mode=signup", { waitUntil: "networkidle" });
  await page.getByLabel("Tu nombre").fill("Móvil");
  await page.getByLabel("Email profesional").fill(`e2e-mobile-${Date.now()}@example.test`);
  await page.getByLabel("Contraseña").fill(`pw-${crypto.randomUUID()}`);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre de la empresa o del profesional").fill("Móvil S.L.");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Tu primer perfil de alertas" })).toBeVisible();
  await noHorizontalScroll(page);

  // Tables become cards; navigation moves to a sheet.
  await page.goto("/licitaciones", { waitUntil: "networkidle" });
  await expect(page.locator("ul li.surface a[href^='/licitaciones/']").first()).toBeVisible();
  await expect(page.locator("table")).toBeHidden();
  await noHorizontalScroll(page);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Mis licitaciones" }).click();
  await expect(page).toHaveURL(/mis-licitaciones/);
  await noHorizontalScroll(page);
});

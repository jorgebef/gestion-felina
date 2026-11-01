import { expect, test } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";

/** Phone layout: side menu becomes a sheet, pages fit the width. */
config({ path: [".env.local", ".env"], quiet: true });

test("works on a phone", async ({ page }) => {
  const run = Date.now();
  const name = `Gatos móvil ${run}`;
  await page.goto("/login?mode=signup", { waitUntil: "networkidle" });
  await page.getByLabel("Tu nombre").fill("Móvil");
  await page.getByLabel("Email").fill(`movil-${run}@example.test`);
  await page.getByLabel("Contraseña").fill(`pw-${crypto.randomUUID()}`);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre de la asociación").fill(name);
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByText("Pendiente de aprobación")).toBeVisible();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("update organizations set status = 'approved' where name = $1", [name]);
  await client.end();

  for (const path of ["/panel", "/colonias", "/gatos/nuevo", "/acciones/nueva", "/equipo"]) {
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal scroll on ${path}`).toBeLessThanOrEqual(0);
  }

  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Gatos" }).click();
  await expect(page.getByRole("heading", { name: "Gatos", level: 1 })).toBeVisible();
});

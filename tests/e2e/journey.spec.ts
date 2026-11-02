import { createHash, randomBytes } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { config } from "dotenv";
import { Client } from "pg";

/**
 * Full journey through the UI: an association signs up and is approved, registers a
 * colony, a cat (with photo) and an action; the town hall joins by invitation, sees the
 * action in its feed, validates it, authorizes the colony and proposes a change that
 * the association accepts. Finally the association user edits their own profile from the
 * user menu and signs back in with the new password.
 *
 * Steps that only the super admin or an email inbox can do (approval, invitation token)
 * are done straight in the database, so DATABASE_URL must point at the dev server's DB.
 */
config({ path: [".env.local", ".env"], quiet: true });

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function db<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

async function signUp(page: Page, href: string, name: string, email: string, password: string) {
  await page.goto(href, { waitUntil: "networkidle" });
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

async function pickMunicipality(page: Page, label: string, term: string, option: RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByLabel("Buscar municipio").fill(term);
  await page.getByRole("option", { name: option }).first().click();
}

test("association and town hall workflow", async ({ browser }) => {
  const run = Date.now();
  const password = `pw-${crypto.randomUUID()}`;
  const anaEmail = `ana-${run}@example.test`;
  const associationName = `Gatos E2E ${run}`;
  // A municipality nobody else uses in the dev database: Alcobendas (28006).
  const municipalityCode = "28006";
  const actionName = `Castración E2E ${run}`;

  // --- Association signs up and registers -------------------------------------------
  const ana = await (await browser.newContext()).newPage();
  await signUp(ana, "/login?mode=signup", "Ana E2E", anaEmail, password);
  await expect(ana.getByRole("heading", { name: "Registra tu asociación" })).toBeVisible();
  await ana.getByLabel("Nombre de la asociación").fill(associationName);
  await ana.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(ana.getByText("Pendiente de aprobación")).toBeVisible();

  // The super admin approves it (done in the database here).
  await db((c) =>
    c.query("update organizations set status = 'approved' where name = $1", [associationName]),
  );
  await ana.getByRole("button", { name: "Comprobar de nuevo" }).click();
  await expect(ana).toHaveURL(/\/panel/);
  await expect(ana.getByRole("heading", { name: associationName })).toBeVisible();

  // --- Colony ------------------------------------------------------------------------
  await ana.goto("/colonias/nueva", { waitUntil: "networkidle" });
  await ana.getByLabel("Nombre de la colonia").fill("Parque de Andalucía");
  await ana.getByLabel("Latitud").fill("40.5361");
  await ana.getByLabel("Longitud").fill("-3.6386");
  await pickMunicipality(ana, "Municipio", "alcobendas", /Alcobendas/);
  await ana.getByLabel("Dirección").fill("Calle Marqués de la Valdavia");
  await ana.getByRole("button", { name: "Registrar colonia" }).click();
  await expect(ana.getByRole("heading", { name: "Parque de Andalucía" })).toBeVisible();
  await expect(ana.getByText("Sin validar").first()).toBeVisible();
  const colonyUrl = ana.url();

  // --- Cat with photo ------------------------------------------------------------------
  await ana.getByRole("link", { name: "Añadir gato" }).click();
  await ana
    .locator("#photo")
    .setInputFiles({ name: "misi.png", mimeType: "image/png", buffer: PNG });
  await expect(ana.getByRole("button", { name: "Cambiar foto" })).toBeVisible();
  await ana.getByLabel("Nombre").first().fill("Misi");
  await ana.getByRole("radio", { name: "Hembra" }).click();
  await ana.getByRole("button", { name: "Registrar gato" }).click();
  await expect(ana.getByRole("heading", { name: "Misi" })).toBeVisible();
  // The photo is served by the API (only to people who can see the cat).
  const photo = ana.getByRole("img", { name: "Foto de Misi" });
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true);

  // --- Action ---------------------------------------------------------------------------
  await ana.getByRole("link", { name: "Acción" }).click();
  await ana.getByRole("combobox", { name: "Tipo de acción" }).click();
  await ana.getByRole("option", { name: "Castración" }).click();
  await ana.getByLabel("Nombre", { exact: true }).fill(actionName);
  await ana.getByLabel("Fecha y hora").fill("2030-05-04T10:30");
  await ana.getByRole("switch", { name: "Es urgente" }).click();
  await ana.getByRole("button", { name: "Guardar acción" }).click();
  await expect(ana.getByRole("heading", { name: actionName })).toBeVisible();
  await expect(ana.getByText("Urgente").first()).toBeVisible();
  await expect(ana.getByText("Sin validar").first()).toBeVisible();

  // --- Town hall joins by invitation ----------------------------------------------------
  const token = randomBytes(32).toString("base64url");
  const townHallEmail = `concejalia-${run}@example.test`;
  await db(async (c) => {
    await c.query("delete from organizations where kind = 'town_hall' and municipality_code = $1", [
      municipalityCode,
    ]);
    const { rows } = await c.query<{ id: string }>(
      `insert into organizations (kind, name, municipality_code, status)
       values ('town_hall', 'Ayuntamiento de Alcobendas', $1, 'approved') returning id`,
      [municipalityCode],
    );
    await c.query(
      `insert into organization_invitations (organization_id, email, role, token_hash, expires_at)
       values ($1, $2, 'admin', $3, now() + interval '1 day')`,
      [rows[0]!.id, townHallEmail, createHash("sha256").update(token).digest("hex")],
    );
  });
  const townHall = await (await browser.newContext()).newPage();
  await townHall.goto(`/invitacion/${token}`, { waitUntil: "networkidle" });
  await expect(townHall.getByRole("heading", { name: /Ayuntamiento de Alcobendas/ })).toBeVisible();
  await townHall.getByRole("link", { name: /Crear cuenta con/ }).click();
  await townHall.waitForLoadState("networkidle");
  await townHall.getByLabel("Tu nombre").fill("Concejalía");
  await townHall.getByLabel("Email").fill(townHallEmail);
  await townHall.getByLabel("Contraseña").fill(password);
  await townHall.getByRole("button", { name: "Crear cuenta" }).click();
  await townHall.getByRole("button", { name: "Aceptar y unirme" }).click();
  await expect(townHall).toHaveURL(/\/panel/);

  // Feed → validate.
  await townHall.goto("/feed", { waitUntil: "networkidle" });
  const row = townHall.getByRole("listitem").filter({ hasText: actionName });
  await expect(row.getByRole("link", { name: actionName })).toBeVisible();
  await row.getByRole("button", { name: "Validar", exact: true }).click();
  await expect(townHall.getByText("Acción validada")).toBeVisible();

  // Colony → validate and propose a change.
  await townHall.goto(colonyUrl, { waitUntil: "networkidle" });
  await expect(townHall.getByText(associationName).first()).toBeVisible();
  await expect(townHall.getByRole("link", { name: "Editar" })).toHaveCount(0);
  await townHall.getByRole("button", { name: "Validar colonia" }).click();
  await expect(townHall.getByRole("button", { name: "Retirar validación" })).toBeVisible();
  await townHall.getByRole("button", { name: "Proponer cambio" }).click();
  const dialog = townHall.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill("Parque de Andalucía (norte)");
  await dialog.getByLabel("Mensaje para la asociación").fill("Nombre del inventario municipal");
  await dialog.getByRole("button", { name: "Enviar propuesta" }).click();
  await expect(townHall.getByText("Propuesta enviada a la asociación gestora")).toBeVisible();

  // --- The association accepts the proposal ----------------------------------------------
  await ana.goto("/propuestas", { waitUntil: "networkidle" });
  await expect(ana.getByText("Nombre del inventario municipal")).toBeVisible();
  await ana.getByRole("button", { name: "Aceptar y aplicar" }).click();
  await expect(ana.getByText("Cambios aplicados")).toBeVisible();
  await ana.goto(colonyUrl, { waitUntil: "networkidle" });
  await expect(ana.getByRole("heading", { name: "Parque de Andalucía (norte)" })).toBeVisible();
  await expect(ana.getByText("Validada").first()).toBeVisible();

  // --- Own profile, from the user menu ------------------------------------------------------
  await ana.getByRole("button", { name: anaEmail }).click();
  await ana.getByRole("menuitem", { name: "Mi perfil" }).click();
  await expect(ana).toHaveURL(/\/perfil$/);
  await expect(ana.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
  await expect(ana.getByText("Este dispositivo")).toBeVisible();

  await ana.getByLabel("Nombre", { exact: true }).fill("Ana Martín");
  await ana.getByRole("button", { name: "Guardar nombre" }).click();
  await expect(ana.getByText("Nombre actualizado")).toBeVisible();

  const newPassword = `pw-${crypto.randomUUID()}`;
  await ana.getByLabel("Contraseña actual").fill("incorrecta");
  await ana.getByLabel("Nueva contraseña", { exact: true }).fill(newPassword);
  await ana.getByLabel("Repite la nueva contraseña").fill(newPassword);
  await ana.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(ana.getByText("La contraseña actual no es correcta.")).toBeVisible();
  await ana.getByLabel("Contraseña actual").fill(password);
  await ana.getByRole("button", { name: "Cambiar contraseña" }).click();
  await expect(ana.getByText(/Contraseña cambiada/)).toBeVisible();

  await ana.getByRole("button", { name: anaEmail }).click();
  await ana.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await ana.goto("/login", { waitUntil: "networkidle" });
  await ana.getByLabel("Email").fill(anaEmail);
  await ana.getByLabel("Contraseña").fill(newPassword);
  await ana.getByRole("button", { name: "Entrar" }).click();
  await expect(ana).toHaveURL(/\/panel/);
  await ana.goto("/perfil", { waitUntil: "networkidle" });
  await expect(ana.getByLabel("Nombre", { exact: true })).toHaveValue("Ana Martín");
});

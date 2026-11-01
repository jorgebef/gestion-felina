/**
 * Grants (or revokes) the platform super-admin role. The person must have signed up
 * first. There is deliberately no way to do this from the web app.
 *
 *   vp run admin:grant tu@email.es
 *   vp run admin:grant tu@email.es --revoke
 */
import { parseArgs } from "node:util";

import { Client } from "pg";

import { databaseUrl, loadEnv } from "./env.ts";

export async function setPlatformAdmin(
  connectionString: string,
  email: string,
  isAdmin: boolean,
): Promise<boolean> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query(
      "UPDATE users SET is_platform_admin = $2 WHERE lower(email) = lower($1)",
      [email.trim(), isAdmin],
    );
    return (result.rowCount ?? 0) > 0;
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  loadEnv();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { revoke: { type: "boolean", default: false } },
  });
  const email = positionals[0];
  if (!email) {
    console.error("Uso: vp run admin:grant <email> [--revoke]");
    process.exit(2);
  }
  const ok = await setPlatformAdmin(databaseUrl(), email, !values.revoke);
  if (!ok) {
    console.error(`No existe ninguna cuenta con el email ${email}. Regístrate primero en la web.`);
    process.exit(1);
  }
  console.log(`${email}: superadministrador ${values.revoke ? "retirado" : "concedido"}`);
}

/**
 * Aplica migration-hotfix-security-pilot.sql en Supabase.
 *
 * Requiere conexión directa a Postgres (SQL Editor alternativa):
 *
 *   DATABASE_URL='postgresql://postgres.[ref]:[PASSWORD]@...pooler.supabase.com:6543/postgres' \
 *     npm run apply-hotfix-security-pilot
 *
 * Obtén la URL en Supabase Dashboard → Project Settings → Database.
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

const migration = resolve(
  process.cwd(),
  "supabase/migration-hotfix-security-pilot.sql"
);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(
    "Falta DATABASE_URL.\n\n" +
      "Aplica manualmente en Supabase SQL Editor:\n" +
      "  supabase/migration-hotfix-security-pilot.sql\n\n" +
      "O exporta DATABASE_URL (Connection string → URI) y vuelve a ejecutar este script."
  );
  process.exit(1);
}

if (!existsSync(migration)) {
  console.error("No se encontró:", migration);
  process.exit(1);
}

try {
  execSync(`psql "${databaseUrl}" -v ON_ERROR_STOP=1 -f "${migration}"`, {
    stdio: "inherit",
  });
  console.log("\n✓ Hotfix aplicado. Ejecuta: npm run verify-hotfix-security");
} catch {
  process.exit(1);
}

/**
 * Verifica si migration-reserva-cupo-counts-no-asistio.sql está aplicada en Supabase.
 *
 *   npm run verify-cupo-migration
 *
 * Requiere .env.local con NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import { createScriptSupabaseClient } from "./lib/supabase-script-client";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error(
    "Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
  );
  process.exit(1);
}

async function main() {
  const sb = createScriptSupabaseClient(url, serviceKey);

  const { error: rpcError } = await sb.rpc("clases_cupo_ocupado", {
    p_clase_ids: [],
  });

  if (rpcError) {
    console.log("✗ RPC clases_cupo_ocupado: NO aplicada");
    console.log("  ", rpcError.message);
    console.log("\nEjecuta: npm run apply-cupo-migration");
    process.exit(1);
  }

  console.log("✓ RPC clases_cupo_ocupado existe en Supabase");
  console.log(
    "  (Trigger check_reserva_cupo e índice idx_reservas_activa se aplican con el mismo SQL.)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

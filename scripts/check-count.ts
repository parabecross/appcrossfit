import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { count: reservasCount } = await supabase
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("estado", "asistio");

  const { count: scoresCount } = await supabase
    .from("clase_scores")
    .select("clase_id", { count: "exact", head: true });

  console.log("Reservas con asistencia:", reservasCount);
  console.log("Clase scores:", scoresCount);
}

main();

/**
 * Repara eventos PR/RM huérfanos para un atleta.
 * Uso: npx tsx scripts/repair-pr-ranking-events.ts <profile_id> [box_id]
 */
import { config } from "dotenv";
import { resolve } from "path";
import { createScriptSupabaseClient } from "./lib/supabase-script-client";
import { cleanupOrphanPrRankingEvents } from "../src/lib/ranking/engine";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const profileId = process.argv[2];
const boxIdArg = process.argv[3];

async function main() {
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  if (!profileId) {
    console.error("Usage: npx tsx scripts/repair-pr-ranking-events.ts <profile_id> [box_id]");
    process.exit(1);
  }

  const admin = createScriptSupabaseClient(url, serviceKey);

  let boxId = boxIdArg;
  if (!boxId) {
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, box_id, nombre_completo")
      .eq("id", profileId)
      .single();
    if (error || !profile?.box_id) {
      console.error("Profile not found or missing box_id:", error?.message);
      process.exit(1);
    }
    boxId = profile.box_id;
    console.log(`Repairing PR ranking for ${profile.nombre_completo ?? profileId} (box ${boxId})`);
  }

  const { data: marcasBefore } = await admin
    .from("atleta_pr_marcas")
    .select("id")
    .eq("usuario_id", profileId);

  const { data: eventsBefore } = await admin
    .from("ranking_point_events")
    .select("id, points, metadata, idempotency_key")
    .eq("usuario_id", profileId)
    .eq("box_id", boxId)
    .eq("event_type", "achievement");

  const prBefore = (eventsBefore ?? []).filter((e) => {
    const badge = (e.metadata as { badge_key?: string })?.badge_key;
    return (
      badge &&
      [
        "primer_pr",
        "primer_movimiento",
        "pr_mejora",
        "racha_mejoras_mes",
        "pr_hunter",
        "best_month",
        "comeback",
        "benchmark",
      ].includes(badge)
    );
  });

  console.log(`Marcas actuales: ${marcasBefore?.length ?? 0}`);
  console.log(`Eventos PR/RM antes: ${prBefore.length}, puntos: ${prBefore.reduce((s, e) => s + e.points, 0)}`);

  const result = await cleanupOrphanPrRankingEvents({
    usuarioId: profileId,
    boxId: boxId!,
    admin,
  });

  const { data: eventsAfter } = await admin
    .from("ranking_point_events")
    .select("id, points, metadata")
    .eq("usuario_id", profileId)
    .eq("box_id", boxId)
    .eq("event_type", "achievement");

  const prAfter = (eventsAfter ?? []).filter((e) => {
    const badge = (e.metadata as { badge_key?: string })?.badge_key;
    return (
      badge &&
      [
        "primer_pr",
        "primer_movimiento",
        "pr_mejora",
        "racha_mejoras_mes",
        "pr_hunter",
        "best_month",
        "comeback",
        "benchmark",
      ].includes(badge)
    );
  });

  console.log("Result:", result);
  console.log(`Eventos PR/RM después: ${prAfter.length}, puntos: ${prAfter.reduce((s, e) => s + e.points, 0)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

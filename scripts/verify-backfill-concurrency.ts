/**
 * Compara backfill secuencial (referencia) vs paralelo por atleta.
 * Uso: npx tsx scripts/verify-backfill-concurrency.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import {
  awardAttendance,
  awardWodResult,
  backfillRankingForBox,
} from "../src/lib/ranking/engine";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.error("Missing Supabase env in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type EventSnapshot = {
  attendance: number;
  streak: number;
  wod: number;
  evolution: number;
  total: number;
  backfillCounts: { attendance: number; wod: number };
};

async function getBoxId(): Promise<string> {
  const { data } = await supabase
    .from("boxes")
    .select("id")
    .eq("slug", "parabellum-cross")
    .single();
  if (!data?.id) throw new Error("Box parabellum-cross not found");
  return data.id;
}

async function snapshotEvents(boxId: string): Promise<EventSnapshot> {
  const { data, error } = await supabase
    .from("ranking_point_events")
    .select("event_type")
    .eq("box_id", boxId);

  if (error) throw error;

  const counts = {
    attendance: 0,
    streak: 0,
    wod: 0,
    evolution: 0,
    total: data?.length ?? 0,
  };

  for (const row of data ?? []) {
    if (row.event_type === "attendance") counts.attendance++;
    else if (row.event_type === "streak") counts.streak++;
    else if (row.event_type === "wod_position") counts.wod++;
    else if (row.event_type === "evolution") counts.evolution++;
  }

  return { ...counts, backfillCounts: { attendance: 0, wod: 0 } };
}

/** Referencia: mismo algoritmo que antes del pool por atleta. */
async function backfillSequential(boxId: string) {
  const client = supabase;

  const { data: staff } = await client
    .from("profiles")
    .select("id")
    .eq("box_id", boxId)
    .in("rol", ["coach", "admin", "box_admin"]);

  const staffIds = (staff ?? []).map((s) => s.id);
  if (staffIds.length === 0) return { attendance: 0, wod: 0 };

  await client.from("ranking_point_events").delete().eq("box_id", boxId);

  const { data: asistioReservas } = await client
    .from("reservas")
    .select("id, clase:clases!inner(coach_id)")
    .eq("estado", "asistio")
    .in("clase.coach_id", staffIds);

  let attendance = 0;
  for (const r of asistioReservas ?? []) {
    const result = await awardAttendance({
      reservaId: r.id,
      admin: client as Parameters<typeof awardAttendance>[0]["admin"],
    });
    if (result.awarded) attendance++;
  }

  const { data: scores } = await client
    .from("clase_scores")
    .select("clase_id, usuario_id, clase:clases!inner(coach_id)")
    .in("clase.coach_id", staffIds);

  let wod = 0;
  for (const s of scores ?? []) {
    const result = await awardWodResult({
      claseId: s.clase_id,
      usuarioId: s.usuario_id,
      admin: client as Parameters<typeof awardWodResult>[0]["admin"],
    });
    if (result.awarded) wod++;
  }

  return { attendance, wod };
}

function compare(a: EventSnapshot, b: EventSnapshot, label: string) {
  const ok =
    a.attendance === b.attendance &&
    a.streak === b.streak &&
    a.wod === b.wod &&
    a.evolution === b.evolution &&
    a.total === b.total;

  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify(
      {
        sequential: {
          events: {
            attendance: a.attendance,
            streak: a.streak,
            wod_position: a.wod,
            evolution: a.evolution,
            total: a.total,
          },
          backfill: a.backfillCounts,
        },
        parallel: {
          events: {
            attendance: b.attendance,
            streak: b.streak,
            wod_position: b.wod,
            evolution: b.evolution,
            total: b.total,
          },
          backfill: b.backfillCounts,
        },
        match: ok,
      },
      null,
      2
    )
  );

  return ok;
}

async function main() {
  const boxId = await getBoxId();
  console.log("Box:", boxId);

  const t0 = Date.now();
  const seqBackfill = await backfillSequential(boxId);
  const seqSnap = await snapshotEvents(boxId);
  seqSnap.backfillCounts = seqBackfill;
  const seqMs = Date.now() - t0;

  const t1 = Date.now();
  const parBackfill = await backfillRankingForBox(
    boxId,
    supabase as Parameters<typeof backfillRankingForBox>[1]
  );
  const parSnap = await snapshotEvents(boxId);
  parSnap.backfillCounts = parBackfill;
  const parMs = Date.now() - t1;

  const ok = compare(seqSnap, parSnap, "Sequential vs parallel backfill");
  console.log(`\nTiming: sequential ${seqMs}ms, parallel ${parMs}ms`);

  if (!ok) {
    console.error("\nMISMATCH — parallel backfill changed results.");
    process.exit(1);
  }

  console.log("\nOK — attendance/streak/wod/evolution counts are identical.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import * as dotenv from "dotenv";
import { resolve } from "path";
import { performance } from "perf_hooks";
import { createScriptSupabaseClient } from "./lib/supabase-script-client";
import { PARABELLUM_SLUG } from "./lib/two-demo-boxes-constants";
import { APP_CONFIG } from "../src/lib/config/app-config";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

async function timeMs(label: string, fn: () => Promise<void>): Promise<number> {
  const t0 = performance.now();
  await fn();
  const ms = Math.round(performance.now() - t0);
  console.log(`${label}: ${Math.round(performance.now() - t0)}ms`);
  return ms;
}

/** Simula essential ANTES (loadDashboardContext + duplicados). */
async function simulateEssentialBefore(
  admin: ReturnType<typeof createScriptSupabaseClient>,
  boxId: string,
  today: string
) {
  let queryCount = 0;
  const q = async <T>(fn: () => Promise<T>) => {
    queryCount++;
    return fn();
  };

  await q(async () => {
    const { data } = await admin
      .from("profiles")
      .select("id, nombre_completo, estado_cuenta")
      .eq("box_id", boxId)
      .eq("rol", "socio");
    const ids = (data ?? []).map((s) => s.id);
    await admin
      .from("membresias")
      .select("id, usuario_id, estado, fecha_fin")
      .in("usuario_id", ids)
      .in("estado", ["vigente", "vencida"]);
  });

  await Promise.all([
    q(async () => {
      const { data: socios } = await admin
        .from("profiles")
        .select("id, estado_cuenta")
        .eq("box_id", boxId)
        .eq("rol", "socio");
      const ids = (socios ?? []).map((s) => s.id);
      await admin
        .from("membresias")
        .select("id, usuario_id, estado, fecha_fin")
        .in("usuario_id", ids)
        .in("estado", ["vigente", "vencida"]);
    }),
    q(async () => {
      const { data: socios } = await admin
        .from("profiles")
        .select("id, nombre_completo, telefono, user_id, estado_cuenta")
        .eq("box_id", boxId)
        .eq("rol", "socio");
      const ids = (socios ?? []).map((s) => s.id);
      await admin
        .from("membresias")
        .select("id, usuario_id, estado, fecha_fin")
        .in("usuario_id", ids)
        .in("estado", ["vigente", "vencida"]);
    }),
    q(async () => {
      const { data: clases } = await admin
        .from("clases")
        .select("id")
        .eq("box_id", boxId)
        .eq("fecha", today);
      if (clases?.length) {
        queryCount++;
        await admin.rpc("clases_cupo_ocupado", {
          p_clase_ids: clases.map((c) => c.id),
        });
      }
    }),
    q(async () => {
      const { data: socios } = await admin
        .from("profiles")
        .select("id, nombre_completo")
        .eq("box_id", boxId)
        .eq("rol", "socio");
      const ids = (socios ?? []).map((s) => s.id);
      if (ids.length) {
        queryCount++;
        await admin
          .from("atleta_perfil_deportivo")
          .select("usuario_id, fecha_nacimiento")
          .in("usuario_id", ids);
      }
    }),
  ]);

  await q(async () => {
    const { data: clases } = await admin
      .from("clases")
      .select("id")
      .eq("box_id", boxId)
      .eq("fecha", today);
    if (clases?.length) {
      await admin
        .from("reservas")
        .select("id")
        .in(
          "clase_id",
          clases.map((c) => c.id)
        );
    }
  });

  return queryCount;
}

/** Simula essential DESPUÉS (Fase A). */
async function simulateEssentialAfter(
  admin: ReturnType<typeof createScriptSupabaseClient>,
  boxId: string,
  today: string
) {
  let queryCount = 0;
  const q = async <T>(fn: () => Promise<T>) => {
    queryCount++;
    return fn();
  };

  const snapshot = await q(async () => {
    const { data: socios } = await admin
      .from("profiles")
      .select("id, nombre_completo, telefono, user_id, estado_cuenta")
      .eq("box_id", boxId)
      .eq("rol", "socio");
    const ids = (socios ?? []).map((s) => s.id);
    await admin
      .from("membresias")
      .select("id, usuario_id, estado, fecha_fin")
      .in("usuario_id", ids)
      .in("estado", ["vigente", "vencida"]);
    return { ids };
  });

  const clases = await q(async () => {
    const { data } = await admin
      .from("clases")
      .select("id")
      .eq("box_id", boxId)
      .eq("fecha", today);
    if (data?.length) {
      queryCount++;
      await admin.rpc("clases_cupo_ocupado", {
        p_clase_ids: data.map((c) => c.id),
      });
    }
    return data ?? [];
  });

  await Promise.all([
    q(async () => {
      if (snapshot.ids.length === 0) return;
      await admin
        .from("atleta_perfil_deportivo")
        .select("usuario_id, fecha_nacimiento")
        .in("usuario_id", snapshot.ids);
    }),
    q(async () => {
      if (clases.length === 0) return;
      await admin
        .from("reservas")
        .select("id")
        .in(
          "clase_id",
          clases.map((c) => c.id)
        );
    }),
  ]);

  return queryCount;
}

async function simulateHeavy(
  admin: ReturnType<typeof createScriptSupabaseClient>,
  boxId: string
) {
  const { data: pids } = await admin.from("profiles").select("id").eq("box_id", boxId);
  const profileIds = (pids ?? []).map((p) => p.id);
  const from = new Date(Date.now() - APP_CONFIG.TENDENCIA_SEMANAS * 7 * 86400000)
    .toISOString()
    .split("T")[0];

  await Promise.all([
    admin
      .from("reservas")
      .select("id")
      .gte("created_at", from)
      .in("usuario_id", profileIds),
    admin.from("clases").select("id").eq("box_id", boxId).gte("fecha", from),
  ]);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createScriptSupabaseClient(url, serviceKey);

  const box = await admin
    .from("boxes")
    .select("id")
    .eq("slug", PARABELLUM_SLUG)
    .single();
  const boxId = box.data!.id;
  const today = new Date().toISOString().split("T")[0];

  const beforeMs = await timeMs("essential_before_wall", async () => {
    await simulateEssentialBefore(admin, boxId, today);
  });
  const beforeQueries = await simulateEssentialBefore(admin, boxId, today);

  const afterMs = await timeMs("essential_after_wall", async () => {
    await simulateEssentialAfter(admin, boxId, today);
  });
  const afterQueries = await simulateEssentialAfter(admin, boxId, today);

  const heavyMs = await timeMs("heavy_wall", async () => {
    await simulateHeavy(admin, boxId);
  });

  console.log("---");
  console.log(
    JSON.stringify(
      {
        essentialBeforeMs: beforeMs,
        essentialAfterMs: afterMs,
        essentialSavedMs: beforeMs - afterMs,
        essentialBeforeQueries: beforeQueries,
        essentialAfterQueries: afterQueries,
        queriesEliminated: beforeQueries - afterQueries,
        heavyMs,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

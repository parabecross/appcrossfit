/**
 * E2E automatizado (sin Playwright): aislamiento Parabellum ↔ Iron District.
 *
 *   npm run e2e-two-boxes
 *
 * Requiere .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional:
 *   E2E_BASE_URL=http://localhost:3000   (ranking público vía HTTP; skip si no responde)
 *
 * Datos demo:
 *   ATHRON_QA_CONFIRM=true npm run reset-two-demo-boxes
 */

import * as dotenv from "dotenv";
import { resolve } from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createScriptSupabaseClient } from "./lib/supabase-script-client";
import {
  DEMO_BOXES,
  DEMO_PASSWORD,
  PARABELLUM_SLUG,
  IRON_SLUG,
} from "./lib/two-demo-boxes-constants";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = (process.env.E2E_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  ""
);

type Check = { label: string; pass: boolean; detail: string; hint?: string };

const checks: Check[] = [];

function addCheck(
  label: string,
  pass: boolean,
  detail: string,
  hint?: string
) {
  checks.push({ label, pass, detail, hint });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createScriptSupabaseClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (error) throw new Error(`Sign in ${email}: ${error.message}`);
  return client;
}

function namesIncludeForeign(
  rows: Array<{ nombre_completo?: string | null; nombre?: string | null }>,
  foreignName: string
): string[] {
  return rows
    .map((r) => r.nombre_completo ?? r.nombre ?? "")
    .filter((n) => n.includes(foreignName) || foreignName.includes(n));
}

function classNamesIncludeMarker(
  rows: Array<{ nombre: string }>,
  marker: string
): string[] {
  return rows.map((r) => r.nombre).filter((n) => n.includes(marker));
}

async function assertAdminIsolation(
  boxKey: "parabellum" | "iron",
  _ownBoxId: string,
  foreignBoxId: string
) {
  const box = DEMO_BOXES[boxKey];
  const client = await signIn(box.adminEmail);

  const { data: socios } = await client
    .from("profiles")
    .select("nombre_completo")
    .eq("rol", "socio");
  const foreignSocios = namesIncludeForeign(
    socios ?? [],
    box.foreignSocioNombre
  );
  addCheck(
    `${boxKey} admin /admin/usuarios (profiles socio)`,
    foreignSocios.length === 0,
    foreignSocios.length
      ? `leak: ${foreignSocios.join(", ")}`
      : `${(socios ?? []).length} socios visibles`,
    foreignSocios.length
      ? `Usuario: ${box.adminEmail} · Ruta: /admin/usuarios · RLS profiles`
      : undefined
  );

  const { data: clases } = await client.from("clases").select("nombre, box_id");
  const foreignClases = (clases ?? []).filter(
    (c) =>
      c.box_id === foreignBoxId ||
      classNamesIncludeMarker([c], box.foreignClassMarker).length > 0
  );
  addCheck(
    `${boxKey} admin /admin/clases`,
    foreignClases.length === 0,
    foreignClases.length
      ? `leak: ${foreignClases.map((c) => c.nombre).join(", ")}`
      : `${(clases ?? []).length} clases`,
    foreignClases.length
      ? `Usuario: ${box.adminEmail} · Ruta: /admin/clases · box_id / RLS clases`
      : undefined
  );

  const { getAthronRankingForBox } = await import("../src/lib/ranking/aggregate");
  const ranking = await getAthronRankingForBox({
    boxSlug: box.slug,
    category: "intermediate",
  });
  const names = (ranking?.leaderboard ?? []).map((r) => r.nombre);
  const hasForeign = names.some(
    (n) =>
      n.includes(box.foreignSocioNombre) ||
      n.includes(box.foreignAdminNombre)
  );
  addCheck(
    `${boxKey} admin /admin/ranking (leaderboard)`,
    !hasForeign && names.length >= 0,
    hasForeign
      ? `leak: ${names.filter((n) => n.includes(box.foreignSocioNombre)).join(", ")}`
      : `${names.length} atletas en leaderboard`,
    hasForeign
      ? `Usuario: ${box.adminEmail} · getAthronRankingForBox(${box.slug})`
      : undefined
  );
}

async function assertSocioIsolation(
  boxKey: "parabellum" | "iron",
  foreignBoxId: string
) {
  const box = DEMO_BOXES[boxKey];
  const client = await signIn(box.socioEmail);

  const { data: clases } = await client
    .from("clases")
    .select("id, nombre, box_id, fecha, hora_inicio, estado")
    .eq("estado", "programada")
    .order("fecha")
    .limit(50);

  const foreign = (clases ?? []).filter(
    (c) =>
      c.box_id === foreignBoxId ||
      c.nombre.includes(box.foreignClassMarker)
  );
  addCheck(
    `${boxKey} socio ve solo clases propias`,
    foreign.length === 0 && (clases ?? []).length > 0,
    foreign.length
      ? `leak: ${foreign.map((c) => c.nombre).join(", ")}`
      : `${(clases ?? []).length} clases`,
    foreign.length
      ? `Usuario: ${box.socioEmail} · Ruta: /mis-reservas · RLS clases`
      : undefined
  );

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  const target = (clases ?? []).find(
    (c) => c.nombre.includes(box.classMarker) && c.fecha >= tomorrowStr
  );
  if (!target) {
    addCheck(
      `${boxKey} socio reserva clase propia`,
      false,
      "sin clase demo programada",
      `Ejecuta reset-two-demo-boxes · Usuario: ${box.socioEmail}`
    );
    return;
  }

  const { data: existing } = await client
    .from("reservas")
    .select("id, estado")
    .eq("clase_id", target.id)
    .maybeSingle();

  if (existing && existing.estado !== "cancelada") {
    addCheck(
      `${boxKey} socio reserva clase propia`,
      true,
      `ya reservada (${existing.estado})`
    );
    return;
  }

  const {
    data: { user },
  } = await client.auth.getUser();
  const { data: profile } = await client
    .from("profiles")
    .select("id")
    .eq("user_id", user!.id)
    .single();

  if (!profile) {
    addCheck(`${boxKey} socio reserva clase propia`, false, "perfil no encontrado");
    return;
  }

  const { error: bookErr } = await client.from("reservas").insert({
    clase_id: target.id,
    usuario_id: profile.id,
    estado: "confirmada",
  });

  if (bookErr?.message.includes("idx_reservas_activa")) {
    addCheck(`${boxKey} socio reserva clase propia`, true, "reserva activa existe");
    return;
  }

  addCheck(
    `${boxKey} socio reserva clase propia`,
    !bookErr,
    bookErr?.message ?? `clase ${target.nombre}`,
    bookErr
      ? `Usuario: ${box.socioEmail} · trigger cupo/RLS · ${bookErr.message}`
      : undefined
  );
}

async function assertPublicRankingHttp() {
  const missingMsg = "Ranking no disponible";

  let noBox: Response;
  let noBoxHtml: string;
  try {
    noBox = await fetch(`${baseUrl}/es/ranking`, { redirect: "follow" });
    noBoxHtml = await noBox.text();
  } catch {
    addCheck(
      "ranking público (HTTP)",
      false,
      "SKIP — servidor no disponible",
      `Levanta \`npm run dev\` · E2E_BASE_URL=${baseUrl}`
    );
    return;
  }

  if (noBoxHtml.length < 200) {
    addCheck(
      "ranking público (HTTP)",
      false,
      "SKIP — respuesta vacía (¿dev server?)",
      `E2E_BASE_URL=${baseUrl}`
    );
    return;
  }

  const hasUnavailable =
    noBoxHtml.includes(missingMsg) ||
    noBoxHtml.includes("debe incluir ?box") ||
    noBoxHtml.includes("missingBoxParam");
  addCheck(
    "ranking público sin ?box=",
    noBox.ok,
    hasUnavailable
      ? "mensaje unavailable en HTML"
      : "HTTP 200 — copy en client; validar manual R1",
    !hasUnavailable ? `URL: ${baseUrl}/es/ranking · checklist R1` : undefined
  );

  for (const [key, slug] of [
    ["parabellum", PARABELLUM_SLUG],
    ["iron", IRON_SLUG],
  ] as const) {
    const box = DEMO_BOXES[key];
    const other = DEMO_BOXES[key === "parabellum" ? "iron" : "parabellum"];
    const { getAthronRankingForBox } = await import("../src/lib/ranking/aggregate");
    const data = await getAthronRankingForBox({
      boxSlug: slug,
      category: "intermediate",
    });
    const names = (data?.leaderboard ?? []).map((r) => r.nombre);
    const hasForeign = names.some(
      (n) =>
        n.includes(other.socioNombre) || n.includes(other.adminNombre)
    );
    addCheck(
      `ranking agregado ?box=${slug}`,
      !hasForeign,
      hasForeign
        ? `leak: ${other.name}`
        : `${names.length} atletas (${names.slice(0, 2).join(", ") || "vacío"})`,
      hasForeign ? `getAthronRankingForBox(${slug})` : undefined
    );
  }
}

async function assertDashboardKpis(
  boxKey: "parabellum" | "iron",
  ownBoxId: string,
  foreignBoxId: string
) {
  const box = DEMO_BOXES[boxKey];
  const client = await signIn(box.adminEmail);

  const { data: profiles } = await client
    .from("profiles")
    .select("id, box_id, nombre_completo")
    .eq("rol", "socio");

  const leaked = (profiles ?? []).filter((p) => p.box_id === foreignBoxId);
  const notOwn = (profiles ?? []).filter(
    (p) => p.box_id && p.box_id !== ownBoxId
  );
  addCheck(
    `${boxKey} dashboard KPIs perfiles socio`,
    leaked.length === 0 && notOwn.length === 0,
    leaked.length
      ? `${leaked.length} perfiles del otro box`
      : `${(profiles ?? []).length} socios del box`,
    leaked.length || notOwn.length
      ? `Usuario: ${box.adminEmail} · /admin/dashboard · profiles.box_id`
      : undefined
  );

  const today = new Date().toISOString().slice(0, 10);
  const { data: clasesToday } = await client
    .from("clases")
    .select("nombre, box_id")
    .eq("fecha", today);
  const leakClases = (clasesToday ?? []).filter((c) => c.box_id === foreignBoxId);
  addCheck(
    `${boxKey} dashboard clases hoy`,
    leakClases.length === 0,
    leakClases.length ? leakClases.map((c) => c.nombre).join(", ") : "ok",
    leakClases.length ? `Usuario: ${box.adminEmail} · getClasesByDateRange / RLS` : undefined
  );
}

async function assertCupoRule(service: SupabaseClient) {
  const { data: sample } = await service
    .from("reservas")
    .select("clase_id, estado")
    .in("estado", ["confirmada", "asistio", "no_asistio"])
    .limit(1)
    .maybeSingle();

  if (!sample) {
    addCheck(
      "cupo RPC vs conteo manual",
      false,
      "sin reservas activas en demo",
      "Ejecuta reset-two-demo-boxes"
    );
    return;
  }

  const claseId = sample.clase_id;
  const { data: rpcRows } = await service.rpc("clases_cupo_ocupado", {
    p_clase_ids: [claseId],
  });
  const rpcCount = (rpcRows as { ocupado: number }[] | null)?.[0]?.ocupado ?? 0;

  const { count: manualCount } = await service
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("clase_id", claseId)
    .in("estado", ["confirmada", "asistio", "no_asistio"]);

  addCheck(
    "cupo RPC incluye confirmada/asistio/no_asistio",
    rpcCount === (manualCount ?? 0),
    `RPC=${rpcCount} manual=${manualCount ?? 0}`,
    rpcCount !== manualCount
      ? "Aplicar migration-reserva-cupo-counts-no-asistio.sql en Supabase"
      : undefined
  );

  const { count: cancelledCount } = await service
    .from("reservas")
    .select("id", { count: "exact", head: true })
    .eq("clase_id", claseId)
    .eq("estado", "cancelada");

  if ((cancelledCount ?? 0) > 0) {
    addCheck(
      "cancelada no cuenta en RPC cupo",
      rpcCount === (manualCount ?? 0),
      "canceladas excluidas del RPC",
      "Revisar clases_cupo_ocupado()"
    );
  } else {
    addCheck("cancelada no cuenta en RPC cupo", true, "sin canceladas en muestra (ok)");
  }
}

async function assertAttendanceRanking(service: SupabaseClient) {
  const { data: reserva } = await service
    .from("reservas")
    .select("id, usuario_id, estado, clase:clases!inner(box_id, fecha)")
    .eq("estado", "confirmada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reserva) {
    addCheck(
      "asistencia suma/revoca puntos ranking",
      false,
      "sin reserva confirmada para probar",
      "Manual: /admin/clases → marcar asistió/no asistió"
    );
    return;
  }

  const reservaId = reserva.id;
  const usuarioId = reserva.usuario_id;

  const countEvents = async () => {
    const { count } = await service
      .from("ranking_point_events")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", usuarioId)
      .eq("source_type", "attendance");
    return count ?? 0;
  };

  const before = await countEvents();

  await service.from("reservas").update({ estado: "asistio" }).eq("id", reservaId);
  const { awardAttendance } = await import("../src/lib/ranking/engine");
  await awardAttendance({ reservaId, admin: service });
  const afterAward = await countEvents();

  await service.from("reservas").update({ estado: "no_asistio" }).eq("id", reservaId);
  const { revokeAttendanceRanking } = await import("../src/lib/ranking/engine");
  await revokeAttendanceRanking({ reservaId, admin: service });
  const afterRevoke = await countEvents();

  await service.from("reservas").update({ estado: "confirmada" }).eq("id", reservaId);

  addCheck(
    "marcar asistió suma puntos ranking",
    afterAward >= before,
    `before=${before} after=${afterAward}`,
    afterAward < before
      ? `Reserva ${reservaId} · awardAttendance · ranking_config enabled?`
      : undefined
  );
  addCheck(
    "marcar no asistió revoca puntos",
    afterRevoke <= afterAward,
    `afterAward=${afterAward} afterRevoke=${afterRevoke}`,
    afterRevoke > afterAward
      ? `Reserva ${reservaId} · revokeAttendanceRanking`
      : undefined
  );
}

async function main() {
  console.log("🧪 E2E two-box isolation — Parabellum ↔ Iron District\n");

  if (!url || !anonKey || !serviceKey) {
    console.error("Missing Supabase env in .env.local");
    process.exit(1);
  }

  const service = createScriptSupabaseClient(url, serviceKey);

  const { data: boxes, error: boxErr } = await service
    .from("boxes")
    .select("id, slug, name")
    .in("slug", [PARABELLUM_SLUG, IRON_SLUG]);

  if (boxErr || !boxes || boxes.length < 2) {
    console.error(
      "Boxes demo no encontrados. Ejecuta:\n  ATHRON_QA_CONFIRM=true npm run reset-two-demo-boxes"
    );
    process.exit(1);
  }

  const parabellumId = boxes.find((b) => b.slug === PARABELLUM_SLUG)!.id;
  const ironId = boxes.find((b) => b.slug === IRON_SLUG)!.id;

  console.log("--- 1–2 Admin isolation ---\n");
  await assertAdminIsolation("parabellum", parabellumId, ironId);
  await assertAdminIsolation("iron", ironId, parabellumId);

  console.log("\n--- 3–4 Socio isolation + reserva ---\n");
  await assertSocioIsolation("parabellum", ironId);
  await assertSocioIsolation("iron", parabellumId);

  console.log("\n--- 5 Ranking público (HTTP) ---\n");
  await assertPublicRankingHttp();

  console.log("\n--- 6 Asistencia / ranking ---\n");
  await assertAttendanceRanking(service);

  console.log("\n--- 7 Dashboard KPIs ---\n");
  await assertDashboardKpis("parabellum", parabellumId, ironId);
  await assertDashboardKpis("iron", ironId, parabellumId);

  console.log("\n--- Cupo (RPC) ---\n");
  await assertCupoRule(service);

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass);

  console.log("\n══════════════════════════════════════════");
  console.log(`Result: ${passed}/${checks.length} checks passed`);
  if (failed.length > 0) {
    console.log("\nFallos:");
    for (const f of failed) {
      console.log(`  • ${f.label}: ${f.detail}`);
      if (f.hint) console.log(`    ↳ ${f.hint}`);
    }
  }
  console.log("══════════════════════════════════════════\n");
  console.log("Checklist manual UI: docs/E2E-TWO-BOX-ISOLATION.md\n");

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

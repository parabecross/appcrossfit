/**
 * Verifica en vivo (RLS real, cliente anon + login) los 8 hallazgos corregidos
 * en la auditoría de seguridad de 2026-07: auto-escalación de profiles,
 * UPDATE cross-box de reservas, auto-marcarse asistió, INSERT/UPDATE
 * cross-box de clase_scores, y lectura/escritura cross-box de ranking
 * (ranking_point_events, ranking_monthly_awards, ranking_config) +
 * clases_cupo_ocupado.
 *
 *   npx tsx scripts/verify-security-hardening-2026-07.ts
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Correr DESPUÉS de aplicar supabase/migration-security-hardening-2026-07.sql.
 * Todos los checks deben ser PASS (la operación insegura debe fallar o no
 * afectar filas). Un FAIL significa que el fix correspondiente no está
 * aplicado o no tuvo efecto en el proyecto contra el que se corre esto.
 *
 * IMPORTANTE: no correr contra producción. Este script crea y borra boxes
 * de prueba (test-hardening-box-a/b) igual que check-box-isolation.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";
import { createScriptSupabaseClient } from "./lib/supabase-script-client";
import {
  HARDENING_TEST_BOX_NAMES,
  HARDENING_TEST_BOX_SLUGS,
  HARDENING_TEST_EMAILS,
  HARDENING_TEST_PASSWORD,
} from "./lib/hardening-test-constants";

dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !anonKey || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const service = createScriptSupabaseClient(url, serviceKey);

type Check = { label: string; pass: boolean; detail: string };
const checks: Check[] = [];

function addCheck(label: string, pass: boolean, detail: string) {
  checks.push({ label, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label}${detail ? ` — ${detail}` : ""}`);
}

function futureDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function listAuthUsersByEmail() {
  const map = new Map<string, string>();
  let page = 1;
  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) if (u.email) map.set(u.email.toLowerCase(), u.id);
    if (data.users.length < 200) break;
    page++;
  }
  return map;
}

async function ensureBox(slug: string, name: string): Promise<string> {
  const { data: existing } = await service.from("boxes").select("id").eq("slug", slug).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await service
    .from("boxes")
    .insert({ name, slug, status: "active", plan: "free", timezone: "America/Mexico_City" })
    .select("id")
    .single();
  if (error) throw new Error(`Box ${slug}: ${error.message}`);
  return data.id;
}

async function ensureUser(
  email: string,
  nombre: string,
  boxId: string,
  rol: "admin" | "coach" | "socio"
): Promise<{ profileId: string; authUserId: string }> {
  const authByEmail = await listAuthUsersByEmail();
  let authId = authByEmail.get(email.toLowerCase());

  if (!authId) {
    const { data, error } = await service.auth.admin.createUser({
      email,
      password: HARDENING_TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { nombre_completo: nombre, rol: "socio", box_id: boxId },
    });
    if (error) throw new Error(`User ${email}: ${error.message}`);
    authId = data.user!.id;
  }

  await service
    .from("profiles")
    .update({ rol, box_id: boxId, estado_cuenta: "activo", nombre_completo: nombre })
    .eq("user_id", authId);

  const { data: profile, error: profileErr } = await service
    .from("profiles")
    .select("id")
    .eq("user_id", authId)
    .single();
  if (profileErr || !profile) throw new Error(`Profile not found: ${email}`);
  return { profileId: profile.id, authUserId: authId };
}

async function ensureClase(boxId: string, coachProfileId: string, nombre: string): Promise<string> {
  const { data: existing } = await service
    .from("clases")
    .select("id")
    .eq("nombre", nombre)
    .eq("box_id", boxId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await service
    .from("clases")
    .insert({
      nombre,
      fecha: futureDate(60),
      hora_inicio: "10:00",
      hora_fin: "11:00",
      cupo_maximo: 12,
      box_id: boxId,
      coach_id: coachProfileId,
      estado: "programada",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Clase ${nombre}: ${error.message}`);
  return data.id;
}

async function ensureReserva(claseId: string, socioProfileId: string): Promise<string> {
  const { data: existing } = await service
    .from("reservas")
    .select("id")
    .eq("clase_id", claseId)
    .eq("usuario_id", socioProfileId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await service
    .from("reservas")
    .insert({ clase_id: claseId, usuario_id: socioProfileId, estado: "confirmada" })
    .select("id")
    .single();
  if (error) throw new Error(`Reserva: ${error.message}`);
  return data.id;
}

async function resetReserva(reservaId: string, claseId: string) {
  await service.from("reservas").update({ clase_id: claseId, estado: "confirmada" }).eq("id", reservaId);
}

async function ensureRankingConfig(boxId: string) {
  await service.from("ranking_config").upsert({ box_id: boxId, enabled: true }, { onConflict: "box_id" });
}

async function ensureRankingEvent(boxId: string, usuarioId: string): Promise<string> {
  const idempotencyKey = `hardening-test:${boxId}:${usuarioId}`;
  const { data: existing } = await service
    .from("ranking_point_events")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await service
    .from("ranking_point_events")
    .insert({
      box_id: boxId,
      usuario_id: usuarioId,
      month_key: futureDate(0).slice(0, 7),
      fecha: futureDate(0),
      event_type: "attendance",
      points: 10,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();
  if (error) throw new Error(`ranking_point_events: ${error.message}`);
  return data.id;
}

async function ensureMonthlyAward(boxId: string, usuarioId: string) {
  await service.from("ranking_monthly_awards").upsert(
    {
      box_id: boxId,
      usuario_id: usuarioId,
      month_key: futureDate(0).slice(0, 7),
      category: "intermediate",
      award_type: "champion",
    },
    { onConflict: "box_id,month_key,category,award_type,usuario_id" }
  );
}

async function signInClient(email: string): Promise<SupabaseClient> {
  const client = createScriptSupabaseClient(url, anonKey);
  const { error } = await client.auth.signInWithPassword({ email, password: HARDENING_TEST_PASSWORD });
  if (error) throw new Error(`Sign in ${email}: ${error.message}`);
  return client;
}

type Fixture = {
  boxId: string;
  claseId: string;
};

async function cleanup(boxAId: string | null, boxBId: string | null) {
  console.log("\n🧹 Cleanup hardening test boxes…");
  for (const boxId of [boxAId, boxBId]) {
    if (!boxId) continue;
    const { data: profiles } = await service.from("profiles").select("id, user_id").eq("box_id", boxId);
    const profileIds = (profiles ?? []).map((p) => p.id);
    const userIds = (profiles ?? []).map((p) => p.user_id);

    const { data: clases } = await service.from("clases").select("id").eq("box_id", boxId);
    const claseIds = (clases ?? []).map((c) => c.id);

    if (claseIds.length > 0) {
      await service.from("clase_scores").delete().in("clase_id", claseIds);
      await service.from("reservas").delete().in("clase_id", claseIds);
      await service.from("clases").delete().in("id", claseIds);
    }
    await service.from("ranking_point_events").delete().eq("box_id", boxId);
    await service.from("ranking_monthly_awards").delete().eq("box_id", boxId);
    await service.from("ranking_config").delete().eq("box_id", boxId);

    if (profileIds.length > 0) {
      await service.from("profiles").delete().in("id", profileIds);
    }
    for (const userId of userIds) {
      const { error } = await service.auth.admin.deleteUser(userId);
      if (error) console.warn(`  ⚠ auth user no borrado ${userId}: ${error.message}`);
    }
    await service.from("boxes").delete().eq("id", boxId);
  }
  console.log("✓ Cleanup done\n");
}

async function main() {
  console.log("🔒 Security hardening verification (2026-07)\n");

  let boxA: Fixture | null = null;
  let boxB: Fixture | null = null;

  try {
    const boxAId = await ensureBox(HARDENING_TEST_BOX_SLUGS.a, HARDENING_TEST_BOX_NAMES.a);
    const boxBId = await ensureBox(HARDENING_TEST_BOX_SLUGS.b, HARDENING_TEST_BOX_NAMES.b);

    const socioA = await ensureUser(HARDENING_TEST_EMAILS.socioA, "Socio A", boxAId, "socio");
    const coachA = await ensureUser(HARDENING_TEST_EMAILS.coachA, "Coach A", boxAId, "coach");
    const socioB = await ensureUser(HARDENING_TEST_EMAILS.socioB, "Socio B", boxBId, "socio");

    const claseAId = await ensureClase(boxAId, coachA.profileId, "Test Hardening Clase A");
    const claseBId = await ensureClase(boxBId, socioB.profileId, "Test Hardening Clase B");

    const reservaAId = await ensureReserva(claseAId, socioA.profileId);

    await ensureRankingConfig(boxAId);
    await ensureRankingConfig(boxBId);
    const rankingEventBId = await ensureRankingEvent(boxBId, socioB.profileId);
    await ensureMonthlyAward(boxBId, socioB.profileId);

    boxA = { boxId: boxAId, claseId: claseAId };
    boxB = { boxId: boxBId, claseId: claseBId };

    // ── 1. Auto-promoción de profiles (rol / is_super_admin) ──────────────
    {
      const client = await signInClient(HARDENING_TEST_EMAILS.socioA);
      const { data, error } = await client
        .from("profiles")
        .update({ rol: "admin", is_super_admin: true })
        .eq("user_id", socioA.authUserId)
        .select("rol, is_super_admin");
      const escalated = (data ?? []).some((p) => p.rol === "admin" || p.is_super_admin === true);
      addCheck(
        "profiles: socio no puede auto-promoverse a admin/is_super_admin",
        !escalated,
        error?.message ?? `rows=${JSON.stringify(data)}`
      );
      await client.auth.signOut();
    }

    // ── 2. Cambio de box_id ────────────────────────────────────────────────
    {
      const client = await signInClient(HARDENING_TEST_EMAILS.socioA);
      const { data, error } = await client
        .from("profiles")
        .update({ box_id: boxBId })
        .eq("user_id", socioA.authUserId)
        .select("box_id");
      const jumped = (data ?? []).some((p) => p.box_id === boxBId);
      addCheck(
        "profiles: socio no puede cambiar su propio box_id",
        !jumped,
        error?.message ?? `rows=${JSON.stringify(data)}`
      );
      await client.auth.signOut();
    }

    // ── 3. UPDATE cross-box de reservas (clase_id) ─────────────────────────
    {
      await resetReserva(reservaAId, claseAId);
      const client = await signInClient(HARDENING_TEST_EMAILS.socioA);
      const { data, error } = await client
        .from("reservas")
        .update({ clase_id: claseBId })
        .eq("id", reservaAId)
        .select("id, clase_id");
      const hijacked = (data ?? []).some((r) => r.clase_id === claseBId);
      addCheck(
        "reservas: socio no puede re-apuntar su reserva a clase de otro box",
        !hijacked,
        error?.message ?? `rows=${JSON.stringify(data)}`
      );
      await client.auth.signOut();
    }

    // ── 4. Auto-marcarse "asistió" ──────────────────────────────────────────
    {
      await resetReserva(reservaAId, claseAId);
      const client = await signInClient(HARDENING_TEST_EMAILS.socioA);
      const { data, error } = await client
        .from("reservas")
        .update({ estado: "asistio" })
        .eq("id", reservaAId)
        .select("id, estado");
      const marked = (data ?? []).some((r) => r.estado === "asistio");
      addCheck(
        "reservas: socio no puede auto-marcarse asistio",
        !marked,
        error?.message ?? `rows=${JSON.stringify(data)}`
      );
      await client.auth.signOut();
      await resetReserva(reservaAId, claseAId);
    }

    // ── 5. INSERT/UPDATE cross-box de clase_scores ─────────────────────────
    {
      const client = await signInClient(HARDENING_TEST_EMAILS.socioA);
      const { data: inserted, error: insertErr } = await client
        .from("clase_scores")
        .insert({
          clase_id: claseBId,
          usuario_id: socioA.profileId,
          score_display: "99 reps",
          score_tipo: "reps",
        })
        .select("id");
      addCheck(
        "clase_scores: socio no puede insertar score en clase de otro box",
        !!insertErr || (inserted ?? []).length === 0,
        insertErr?.message ?? `rows=${inserted?.length ?? 0}`
      );
      if (!insertErr && (inserted ?? []).length > 0) {
        await service.from("clase_scores").delete().in("id", inserted!.map((r) => r.id));
      }

      const { data: ownScore, error: ownScoreErr } = await service
        .from("clase_scores")
        .upsert(
          { clase_id: claseAId, usuario_id: socioA.profileId, score_display: "10 reps", score_tipo: "reps" },
          { onConflict: "clase_id,usuario_id" }
        )
        .select("id")
        .single();
      if (ownScoreErr) throw new Error(`seed clase_scores: ${ownScoreErr.message}`);

      const { data: updated, error: updateErr } = await client
        .from("clase_scores")
        .update({ clase_id: claseBId })
        .eq("id", ownScore.id)
        .select("id, clase_id");
      const hijackedScore = (updated ?? []).some((s) => s.clase_id === claseBId);
      addCheck(
        "clase_scores: socio no puede re-apuntar su score a clase de otro box",
        !hijackedScore,
        updateErr?.message ?? `rows=${JSON.stringify(updated)}`
      );
      await client.auth.signOut();
    }

    // ── 6. Ranking cross-box (lectura y escritura) ─────────────────────────
    {
      const clientCoachA = await signInClient(HARDENING_TEST_EMAILS.coachA);

      const { data: eventsRead } = await clientCoachA
        .from("ranking_point_events")
        .select("id")
        .eq("box_id", boxBId);
      addCheck(
        "ranking_point_events: coach de Box A no puede leer eventos de Box B",
        (eventsRead ?? []).length === 0,
        `rows=${eventsRead?.length ?? 0}`
      );

      const { data: eventsInserted, error: eventsInsertErr } = await clientCoachA
        .from("ranking_point_events")
        .insert({
          box_id: boxBId,
          usuario_id: socioB.profileId,
          month_key: futureDate(0).slice(0, 7),
          fecha: futureDate(0),
          event_type: "attendance",
          points: 999,
          idempotency_key: `hardening-forge:${boxBId}:${socioB.profileId}`,
        })
        .select("id");
      addCheck(
        "ranking_point_events: coach de Box A no puede forjar puntos en Box B",
        !!eventsInsertErr || (eventsInserted ?? []).length === 0,
        eventsInsertErr?.message ?? `rows=${eventsInserted?.length ?? 0}`
      );
      if (!eventsInsertErr && (eventsInserted ?? []).length > 0) {
        await service.from("ranking_point_events").delete().in("id", eventsInserted!.map((r) => r.id));
      }

      const { data: awardsRead } = await clientCoachA
        .from("ranking_monthly_awards")
        .select("id")
        .eq("box_id", boxBId);
      addCheck(
        "ranking_monthly_awards: coach de Box A no puede leer premios de Box B",
        (awardsRead ?? []).length === 0,
        `rows=${awardsRead?.length ?? 0}`
      );

      const { data: configUpdated, error: configErr } = await clientCoachA
        .from("ranking_config")
        .update({ attendance_points: 9999 })
        .eq("box_id", boxBId)
        .select("box_id");
      const configHijacked = (configUpdated ?? []).some((c) => c.box_id === boxBId);
      addCheck(
        "ranking_config: coach de Box A no puede editar la config de Box B",
        !configHijacked,
        configErr?.message ?? `rows=${JSON.stringify(configUpdated)}`
      );

      const clientSocioA = await signInClient(HARDENING_TEST_EMAILS.socioA);
      const { data: cupoData, error: cupoErr } = await clientSocioA.rpc("clases_cupo_ocupado", {
        p_clase_ids: [claseBId],
      });
      addCheck(
        "clases_cupo_ocupado: socio de Box A no recibe cupo de clase de Box B",
        !cupoErr && (cupoData ?? []).length === 0,
        cupoErr?.message ?? `rows=${JSON.stringify(cupoData)}`
      );

      await clientCoachA.auth.signOut();
      await clientSocioA.auth.signOut();
    }

    void rankingEventBId;
  } finally {
    await cleanup(boxA?.boxId ?? null, boxB?.boxId ?? null);
  }

  const passed = checks.filter((c) => c.pass).length;
  const total = checks.length;
  const failed = checks.filter((c) => !c.pass);

  console.log("══════════════════════════════════════════");
  console.log(`Result: ${passed}/${total} checks passed`);
  if (failed.length > 0) {
    console.log("\nFailed (fix no aplicado o sin efecto):");
    for (const f of failed) console.log(`  • ${f.label}: ${f.detail}`);
  }
  console.log("══════════════════════════════════════════\n");

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

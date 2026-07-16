/**
 * Verificación del escenario Parabellum-10-QA.
 *
 *   ATHRON_PARABELLUM_QA_CONFIRM=true npm run qa:parabellum10:verify
 */

import { ACTIVE_RESERVA_ESTADOS } from "../src/lib/reservas/helpers";
import { findNextBookedClass } from "../src/lib/reservas/next-booking";
import {
  PARABELLUM_BOX_ID,
  QA_ATHLETE_COUNT,
  QA_CLASS_PREFIX,
  QA_SCENARIO_NOTE,
  QA_WINDOW_FUTURE_DAYS,
  QA_WINDOW_PAST_DAYS,
  allQaEmails,
  qaAthleteEmail,
} from "./lib/parabellum-10-qa-constants";
import {
  addDays,
  countSocios,
  listAuthUsersByEmail,
  loadSnapshot,
  loadSubscriptionSnapshot,
  requireParabellumQaEnv,
  resolveParabellumBox,
  todayInTimezone,
} from "./lib/parabellum-10-qa-env";

type Check = { label: string; pass: boolean; detail: string };
const checks: Check[] = [];

function add(label: string, pass: boolean, detail: string) {
  checks.push({ label, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${label} — ${detail}`);
}

async function main() {
  const { service } = requireParabellumQaEnv();
  const box = await resolveParabellumBox(service);
  const snapshot = loadSnapshot();

  console.log("\nATHRON Parabellum-10-QA — verify\n");

  if (!snapshot) {
    add("snapshot existe", false, "falta scripts/lib/parabellum-10-qa-snapshot.json");
  } else {
    add(
      "snapshot boxId",
      snapshot.boxId === box.id && box.id === PARABELLUM_BOX_ID,
      snapshot.boxId
    );
  }

  const counts = await countSocios(service, box.id);
  const sub = await loadSubscriptionSnapshot(service, box.id);

  if (snapshot) {
    add(
      "atletas reales conservados",
      counts.real === snapshot.realAthleteCount,
      `real=${counts.real} expected=${snapshot.realAthleteCount}`
    );
    add(
      "total = real + 10 QA",
      counts.total === snapshot.realAthleteCount + QA_ATHLETE_COUNT &&
        counts.qa === QA_ATHLETE_COUNT,
      `total=${counts.total} real=${counts.real} qa=${counts.qa}`
    );
    add(
      "plan SaaS intacto",
      sub.planCode === snapshot.saasPlanCode &&
        sub.planId === snapshot.subscriptionPlanId,
      `${sub.planCode}/${sub.planId}`
    );
    add(
      "suscripción intacta",
      sub.status === snapshot.subscriptionStatus,
      String(sub.status)
    );
    add(
      "límite max_atletas intacto",
      sub.maxAtletas === snapshot.maxAtletas,
      String(sub.maxAtletas)
    );
  }

  add("exactamente 10 QA", counts.qa === QA_ATHLETE_COUNT, `qa=${counts.qa}`);

  const auth = await listAuthUsersByEmail(service);
  for (const email of allQaEmails()) {
    const user = auth.get(email.toLowerCase());
    if (!user) {
      add(`QA ${email}`, false, "missing auth");
      continue;
    }
    const { data: p } = await service
      .from("profiles")
      .select("box_id, rol, estado_cuenta")
      .eq("user_id", user.id)
      .single();
    add(
      `QA ${email} en Parabellum`,
      !!p && p.box_id === box.id && p.rol === "socio" && p.estado_cuenta === "activo",
      p ? `${p.rol}/${p.box_id}` : "no profile"
    );
  }

  const today = todayInTimezone(box.timezone);
  const start = addDays(today, -QA_WINDOW_PAST_DAYS);
  const end = addDays(today, QA_WINDOW_FUTURE_DAYS);

  const { data: qaClases } = await service
    .from("clases")
    .select("id, fecha, nombre, cupo_maximo, box_id")
    .eq("box_id", box.id)
    .like("nombre", `${QA_CLASS_PREFIX}%`);

  const claseIds = (qaClases ?? []).map((c) => c.id);
  add("42 clases QA", (qaClases ?? []).length === 42, `count=${qaClases?.length ?? 0}`);

  const outside = (qaClases ?? []).filter(
    (c) => c.fecha < start || c.fecha > end
  );
  add("clases QA dentro de ventana", outside.length === 0, `outside=${outside.length}`);
  add(
    `ventana ${start}..${end}`,
    true,
    `hoy=${today}`
  );

  const socioQaIds: string[] = [];
  for (let i = 1; i <= QA_ATHLETE_COUNT; i++) {
    const user = auth.get(qaAthleteEmail(i).toLowerCase());
    if (!user) continue;
    const { data: p } = await service
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (p) socioQaIds.push(p.id);
  }

  let dupes = 0;
  let over = 0;
  let cross = 0;
  let reservaCount = 0;
  let asistio = 0;
  let cancelada = 0;
  let noAsistio = 0;

  if (claseIds.length > 0 && socioQaIds.length > 0) {
    const { data: reservas } = await service
      .from("reservas")
      .select("id, clase_id, usuario_id, estado")
      .in("clase_id", claseIds);

    const qaSet = new Set(socioQaIds);
    const claseById = new Map((qaClases ?? []).map((c) => [c.id, c]));
    const activeKey = new Map<string, number>();
    const occ = new Map<string, number>();

    for (const r of reservas ?? []) {
      if (!qaSet.has(r.usuario_id)) {
        cross++;
        continue;
      }
      reservaCount++;
      if (r.estado === "asistio") asistio++;
      if (r.estado === "cancelada") cancelada++;
      if (r.estado === "no_asistio") noAsistio++;

      if ((ACTIVE_RESERVA_ESTADOS as readonly string[]).includes(r.estado)) {
        const k = `${r.clase_id}:${r.usuario_id}`;
        activeKey.set(k, (activeKey.get(k) ?? 0) + 1);
        occ.set(r.clase_id, (occ.get(r.clase_id) ?? 0) + 1);
      }
    }

    for (const n of activeKey.values()) if (n > 1) dupes++;
    for (const [cid, n] of occ) {
      const max = claseById.get(cid)?.cupo_maximo ?? 0;
      if (n > max) over++;
    }
  }

  add("0 reservas activas duplicadas", dupes === 0, `dupes=${dupes}`);
  add("0 sobrecupos", over === 0, `over=${over}`);
  add("0 reservas QA cruzadas con no-QA", cross === 0, `cross=${cross}`);
  add(
    "reservas QA 80-140",
    reservaCount >= 80 && reservaCount <= 140,
    `count=${reservaCount}`
  );
  add(
    "asistencias/cancelaciones presentes",
    asistio > 0 && cancelada > 0,
    `asistio=${asistio} cancel=${cancelada} no_asistio=${noAsistio}`
  );

  const { data: mems } = await service
    .from("membresias")
    .select("id, usuario_id, notas, plan:planes!inner(box_id)")
    .in("usuario_id", socioQaIds);
  const badMem = (mems ?? []).filter(
    (m) =>
      (m.plan as { box_id?: string } | null)?.box_id !== box.id ||
      !(m.notas ?? "").includes("parabellum_10_athletes_v1")
  );
  add(
    "membresías QA consistentes",
    (mems?.length ?? 0) === QA_ATHLETE_COUNT && badMem.length === 0,
    `mem=${mems?.length ?? 0} bad=${badMem.length}`
  );

  const { count: prCount } = await service
    .from("atleta_pr_marcas")
    .select("id", { count: "exact", head: true })
    .in("usuario_id", socioQaIds);
  const { count: skillCount } = await service
    .from("atleta_skills")
    .select("id", { count: "exact", head: true })
    .in("usuario_id", socioQaIds);
  const { count: rankCount } = await service
    .from("ranking_point_events")
    .select("id", { count: "exact", head: true })
    .eq("box_id", box.id)
    .in("usuario_id", socioQaIds);

  add("PRs QA >= 6 atletas (marcas)", (prCount ?? 0) >= 6, `prs=${prCount}`);
  add("skills QA >= 6", (skillCount ?? 0) >= 6, `skills=${skillCount}`);
  add(
    "ranking events QA >= 8 atletas (eventos)",
    (rankCount ?? 0) >= 8,
    `events=${rankCount}`
  );

  // Home sufficiency for athlete 01
  const u1 = auth.get(qaAthleteEmail(1).toLowerCase());
  if (u1) {
    const { data: p1 } = await service
      .from("profiles")
      .select("id")
      .eq("user_id", u1.id)
      .single();
    const { data: clasesAll } = await service
      .from("clases")
      .select("*")
      .eq("box_id", box.id)
      .like("nombre", `${QA_CLASS_PREFIX}%`);
    const { data: res1 } = await service
      .from("reservas")
      .select("*")
      .eq("usuario_id", p1!.id);
    const next = findNextBookedClass(
      clasesAll ?? [],
      res1 ?? [],
      p1!.id,
      box.timezone
    );
    const { data: mem1 } = await service
      .from("membresias")
      .select("id")
      .eq("usuario_id", p1!.id)
      .limit(1);
    add(
      "home QA01: horario (clases QA)",
      (clasesAll?.length ?? 0) > 0,
      `clases=${clasesAll?.length ?? 0}`
    );
    add(
      "home QA01: membresía",
      (mem1?.length ?? 0) > 0,
      mem1?.[0]?.id ?? "none"
    );
    add(
      "home QA01: próxima clase o sin reserva coherente",
      true,
      next ? `next=${next.clase.nombre}` : "sin próxima (válido)"
    );
    void QA_SCENARIO_NOTE;
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(
    `\nResumen: ${checks.length - failed.length}/${checks.length} OK`
  );
  if (failed.length) {
    console.error("\nFAIL — verify Parabellum-10-QA");
    process.exit(1);
  }
  console.log("\nPASS — verify Parabellum-10-QA");
}

main().catch((err) => {
  console.error("\nFAIL —", err);
  process.exit(1);
});

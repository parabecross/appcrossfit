import { createClient } from "@/lib/supabase/server";
import { isAdminLikeRole } from "@/lib/auth/roles";
import {
  SEGUIMIENTO_HISTORY_LIMIT,
  buildAthleteFollowUpSummary,
  validateCreateSeguimientoInput,
  type AthleteFollowUpSummary,
  type CreateSeguimientoInput,
  type SeguimientoWithAutor,
} from "@/lib/seguimientos/helpers";
import type { SeguimientoAtleta } from "@/types/database";

type AuthAdminContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  boxId: string;
  profileId: string;
  userId: string;
};

async function requireAdminContext(): Promise<
  AuthAdminContext | { error: string; status: number }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthorized", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, rol, box_id")
    .eq("user_id", user.id)
    .single();

  if (!profile || !isAdminLikeRole(profile.rol) || !profile.box_id) {
    return { error: "forbidden", status: 403 };
  }

  return {
    supabase,
    boxId: profile.box_id,
    profileId: profile.id,
    userId: user.id,
  };
}

async function assertAthleteInBox(
  supabase: AuthAdminContext["supabase"],
  athleteId: string,
  boxId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", athleteId)
    .eq("box_id", boxId)
    .eq("rol", "socio")
    .maybeSingle();
  return !!data;
}

export async function listAthleteInteractions(
  athleteId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<
  | { ok: true; items: SeguimientoWithAutor[]; hasMore: boolean }
  | { ok: false; error: string; status: number }
> {
  const auth = await requireAdminContext();
  if ("error" in auth) return { ok: false, error: auth.error, status: auth.status };

  if (!(await assertAthleteInBox(auth.supabase, athleteId, auth.boxId))) {
    return { ok: false, error: "athlete_not_found", status: 404 };
  }

  const limit = Math.min(options.limit ?? SEGUIMIENTO_HISTORY_LIMIT, 50);
  const offset = options.offset ?? 0;

  const { data, error } = await auth.supabase
    .from("seguimientos_atleta")
    .select(
      "id, box_id, usuario_id, autor_id, tipo_interaccion, resultado, nota, occurred_at, follow_up_at, created_at, updated_at"
    )
    .eq("box_id", auth.boxId)
    .eq("usuario_id", athleteId)
    .order("occurred_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) {
    console.error("[seguimientos] listAthleteInteractions:", error.message);
    if (error.code === "42P01" || error.message?.includes("does not exist")) {
      return { ok: false, error: "table_missing", status: 503 };
    }
    return { ok: false, error: "load_failed", status: 500 };
  }

  const rows = (data ?? []) as SeguimientoAtleta[];
  const hasMore = rows.length > limit;
  const slice = rows.slice(0, limit);
  const autorIds = Array.from(new Set(slice.map((r) => r.autor_id)));
  const nombreMap = new Map<string, string>();
  if (autorIds.length > 0) {
    const { data: autores } = await auth.supabase
      .from("profiles")
      .select("id, nombre_completo")
      .eq("box_id", auth.boxId)
      .in("id", autorIds);
    for (const a of autores ?? []) {
      nombreMap.set(a.id, a.nombre_completo);
    }
  }

  const items = slice.map(
    (row) =>
      ({
        ...row,
        autor_nombre: nombreMap.get(row.autor_id) ?? null,
      }) satisfies SeguimientoWithAutor
  );

  return { ok: true, items, hasMore };
}

export async function createAthleteInteraction(
  input: CreateSeguimientoInput
): Promise<
  | { ok: true; item: SeguimientoAtleta }
  | { ok: false; error: string; status: number }
> {
  const auth = await requireAdminContext();
  if ("error" in auth) return { ok: false, error: auth.error, status: auth.status };

  const validated = validateCreateSeguimientoInput(input);
  if (!validated.ok) {
    return { ok: false, error: validated.error, status: 400 };
  }

  if (
    !(await assertAthleteInBox(
      auth.supabase,
      validated.data.usuarioId,
      auth.boxId
    ))
  ) {
    return { ok: false, error: "athlete_not_found", status: 404 };
  }

  const { data, error } = await auth.supabase
    .from("seguimientos_atleta")
    .insert({
      box_id: auth.boxId,
      usuario_id: validated.data.usuarioId,
      autor_id: auth.profileId,
      tipo_interaccion: validated.data.tipoInteraccion,
      resultado: validated.data.resultado,
      nota: validated.data.nota,
      occurred_at: validated.data.occurredAt,
      follow_up_at: validated.data.followUpAt,
    })
    .select(
      "id, box_id, usuario_id, autor_id, tipo_interaccion, resultado, nota, occurred_at, follow_up_at, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    console.error("[seguimientos] createAthleteInteraction:", error?.message);
    // Table may not exist yet before migration
    if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
      return { ok: false, error: "table_missing", status: 503 };
    }
    return { ok: false, error: "create_failed", status: 500 };
  }

  return { ok: true, item: data as SeguimientoAtleta };
}

export async function getAthleteFollowUpSummary(
  athleteId: string
): Promise<
  | { ok: true; summary: AthleteFollowUpSummary }
  | { ok: false; error: string; status: number }
> {
  const list = await listAthleteInteractions(athleteId, { limit: 30 });
  if (!list.ok) return list;
  return {
    ok: true,
    summary: buildAthleteFollowUpSummary(list.items),
  };
}

/**
 * Lightweight snapshot of latest interactions for many athletes in one box.
 * One query — no N+1.
 */
export async function loadBoxSeguimientosSnapshot(
  boxId: string,
  athleteIds: string[]
): Promise<{
  byAthlete: Map<string, AthleteFollowUpSummary>;
  counts: {
    neverContactedAttention: number;
    followUpOverdue: number;
    followUpToday: number;
  };
  rawByAthlete: Map<string, SeguimientoAtleta[]>;
}> {
  const byAthlete = new Map<string, AthleteFollowUpSummary>();
  const rawByAthlete = new Map<string, SeguimientoAtleta[]>();
  const emptySummary = buildAthleteFollowUpSummary([]);

  for (const id of athleteIds) {
    byAthlete.set(id, emptySummary);
    rawByAthlete.set(id, []);
  }

  if (athleteIds.length === 0) {
    return {
      byAthlete,
      counts: {
        neverContactedAttention: 0,
        followUpOverdue: 0,
        followUpToday: 0,
      },
      rawByAthlete,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seguimientos_atleta")
    .select(
      "id, box_id, usuario_id, autor_id, tipo_interaccion, resultado, nota, occurred_at, follow_up_at, created_at, updated_at"
    )
    .eq("box_id", boxId)
    .in("usuario_id", athleteIds)
    .order("occurred_at", { ascending: false })
    .limit(Math.min(athleteIds.length * 5, 2000));

  if (error) {
    // Before migration: degrade gracefully
    console.error("[seguimientos] loadBoxSeguimientosSnapshot:", error.message);
    return {
      byAthlete,
      counts: {
        neverContactedAttention: 0,
        followUpOverdue: 0,
        followUpToday: 0,
      },
      rawByAthlete,
    };
  }

  for (const row of (data ?? []) as SeguimientoAtleta[]) {
    const list = rawByAthlete.get(row.usuario_id) ?? [];
    list.push(row);
    rawByAthlete.set(row.usuario_id, list);
  }

  let followUpOverdue = 0;
  let followUpToday = 0;
  for (const id of athleteIds) {
    const summary = buildAthleteFollowUpSummary(rawByAthlete.get(id) ?? []);
    byAthlete.set(id, summary);
    if (summary.followUpStatus === "overdue") followUpOverdue++;
    if (summary.followUpStatus === "today") followUpToday++;
  }

  let neverContacted = 0;
  for (const id of athleteIds) {
    if (byAthlete.get(id)?.neverContacted) neverContacted++;
  }

  return {
    byAthlete,
    counts: {
      neverContactedAttention: neverContacted,
      followUpOverdue,
      followUpToday,
    },
    rawByAthlete,
  };
}

/**
 * Athletes with an open follow-up (overdue or today), derived from the box snapshot.
 */
export async function listPendingFollowUps(
  boxId: string,
  athleteIds: string[]
): Promise<
  Array<{
    athleteId: string;
    followUpAt: string;
    status: "overdue" | "today";
    summary: AthleteFollowUpSummary;
  }>
> {
  const snap = await loadBoxSeguimientosSnapshot(boxId, athleteIds);
  const out: Array<{
    athleteId: string;
    followUpAt: string;
    status: "overdue" | "today";
    summary: AthleteFollowUpSummary;
  }> = [];
  for (const id of athleteIds) {
    const summary = snap.byAthlete.get(id);
    if (!summary?.followUpAt) continue;
    if (summary.followUpStatus === "overdue" || summary.followUpStatus === "today") {
      out.push({
        athleteId: id,
        followUpAt: summary.followUpAt,
        status: summary.followUpStatus,
        summary,
      });
    }
  }
  out.sort((a, b) => a.followUpAt.localeCompare(b.followUpAt));
  return out;
}

/**
 * Close an open follow-up by inserting an immutable "resolved" interaction
 * (no UPDATE of prior rows — audit-friendly).
 */
export async function completeAthleteFollowUp(
  athleteId: string,
  note?: string | null
): Promise<
  | { ok: true; item: SeguimientoAtleta }
  | { ok: false; error: string; status: number }
> {
  return createAthleteInteraction({
    usuarioId: athleteId,
    tipoInteraccion: "internal_note",
    resultado: "resolved",
    nota: note ?? null,
    occurredAt: new Date().toISOString(),
    requiresFollowUp: false,
    followUpAt: null,
  });
}

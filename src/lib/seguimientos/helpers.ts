import type {
  SeguimientoAtleta,
  SeguimientoFollowUpStatus,
  SeguimientoResultado,
  SeguimientoTipoInteraccion,
} from "@/types/database";

export const SEGUIMIENTO_TIPOS: SeguimientoTipoInteraccion[] = [
  "whatsapp",
  "phone_call",
  "in_person",
  "internal_note",
  "email",
  "other",
];

export const SEGUIMIENTO_RESULTADOS: SeguimientoResultado[] = [
  "contacted",
  "no_response",
  "responded",
  "renewal_pending",
  "renewed",
  "not_interested",
  "follow_up_required",
  "resolved",
  "note_only",
];

export const SEGUIMIENTO_NOTA_MAX = 2000;
export const SEGUIMIENTO_HISTORY_LIMIT = 15;

export type CreateSeguimientoInput = {
  usuarioId: string;
  tipoInteraccion: SeguimientoTipoInteraccion;
  resultado: SeguimientoResultado;
  nota?: string | null;
  occurredAt?: string | null;
  requiresFollowUp?: boolean;
  followUpAt?: string | null;
};

export type AthleteFollowUpSummary = {
  lastContactAt: string | null;
  lastTipo: SeguimientoTipoInteraccion | null;
  lastResultado: SeguimientoResultado | null;
  lastAutorNombre: string | null;
  followUpAt: string | null;
  followUpStatus: SeguimientoFollowUpStatus;
  neverContacted: boolean;
  recentlyContacted: boolean;
  resolvedRecently: boolean;
};

export type SeguimientoWithAutor = SeguimientoAtleta & {
  autor_nombre: string | null;
};

function startOfDayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayIso(date: Date): string {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function isSeguimientoTipo(
  value: string
): value is SeguimientoTipoInteraccion {
  return SEGUIMIENTO_TIPOS.includes(value as SeguimientoTipoInteraccion);
}

export function isSeguimientoResultado(
  value: string
): value is SeguimientoResultado {
  return SEGUIMIENTO_RESULTADOS.includes(value as SeguimientoResultado);
}

export function validateCreateSeguimientoInput(input: CreateSeguimientoInput): {
  ok: true;
  data: {
    usuarioId: string;
    tipoInteraccion: SeguimientoTipoInteraccion;
    resultado: SeguimientoResultado;
    nota: string | null;
    occurredAt: string;
    followUpAt: string | null;
  };
} | { ok: false; error: string } {
  if (!input.usuarioId) {
    return { ok: false, error: "missing_athlete" };
  }
  if (!isSeguimientoTipo(input.tipoInteraccion)) {
    return { ok: false, error: "invalid_type" };
  }
  if (!isSeguimientoResultado(input.resultado)) {
    return { ok: false, error: "invalid_outcome" };
  }

  const nota =
    input.nota == null || input.nota.trim() === ""
      ? null
      : input.nota.trim();
  if (nota && nota.length > SEGUIMIENTO_NOTA_MAX) {
    return { ok: false, error: "note_too_long" };
  }

  const occurredAt = input.occurredAt
    ? new Date(input.occurredAt)
    : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return { ok: false, error: "invalid_occurred_at" };
  }

  let followUpAt: string | null = null;
  if (input.requiresFollowUp) {
    if (!input.followUpAt) {
      return { ok: false, error: "follow_up_required" };
    }
    const fu = new Date(input.followUpAt);
    if (Number.isNaN(fu.getTime())) {
      return { ok: false, error: "invalid_follow_up_at" };
    }
    followUpAt = fu.toISOString();
  } else if (input.followUpAt) {
    const fu = new Date(input.followUpAt);
    if (Number.isNaN(fu.getTime())) {
      return { ok: false, error: "invalid_follow_up_at" };
    }
    followUpAt = fu.toISOString();
  }

  if (input.resultado === "follow_up_required" && !followUpAt) {
    return { ok: false, error: "follow_up_required" };
  }

  return {
    ok: true,
    data: {
      usuarioId: input.usuarioId,
      tipoInteraccion: input.tipoInteraccion,
      resultado: input.resultado,
      nota,
      occurredAt: occurredAt.toISOString(),
      followUpAt,
    },
  };
}

/**
 * Derive follow-up status from the latest open follow_up_at that is not
 * superseded by a later resolved/renewed interaction.
 */
export function deriveFollowUpStatus(
  interactions: Pick<
    SeguimientoAtleta,
    "occurred_at" | "follow_up_at" | "resultado"
  >[],
  now = new Date()
): {
  followUpAt: string | null;
  followUpStatus: SeguimientoFollowUpStatus;
  neverContacted: boolean;
  recentlyContacted: boolean;
  resolvedRecently: boolean;
  lastContactAt: string | null;
} {
  if (interactions.length === 0) {
    return {
      followUpAt: null,
      followUpStatus: "never_contacted",
      neverContacted: true,
      recentlyContacted: false,
      resolvedRecently: false,
      lastContactAt: null,
    };
  }

  const sorted = [...interactions].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  );
  const last = sorted[0];
  const lastContactAt = last.occurred_at;
  const recentlyContacted =
    now.getTime() - new Date(lastContactAt).getTime() <= 7 * 86_400_000;
  const resolvedRecently =
    ["resolved", "renewed"].includes(last.resultado) && recentlyContacted;

  // Latest non-null follow_up_at from an interaction that still needs attention
  // (not closed by a later resolved/renewed).
  let openFollowUp: string | null = null;
  for (const row of sorted) {
    if (["resolved", "renewed", "not_interested"].includes(row.resultado)) {
      break;
    }
    if (row.follow_up_at) {
      openFollowUp = row.follow_up_at;
      break;
    }
  }

  if (!openFollowUp) {
    return {
      followUpAt: null,
      followUpStatus: "none",
      neverContacted: false,
      recentlyContacted,
      resolvedRecently,
      lastContactAt,
    };
  }

  const start = startOfDayIso(now);
  const end = endOfDayIso(now);
  let followUpStatus: SeguimientoFollowUpStatus = "scheduled";
  if (openFollowUp < start) followUpStatus = "overdue";
  else if (openFollowUp <= end) followUpStatus = "today";

  return {
    followUpAt: openFollowUp,
    followUpStatus,
    neverContacted: false,
    recentlyContacted,
    resolvedRecently,
    lastContactAt,
  };
}

export function buildAthleteFollowUpSummary(
  interactions: Array<
    Pick<
      SeguimientoAtleta,
      | "occurred_at"
      | "follow_up_at"
      | "resultado"
      | "tipo_interaccion"
    > & { autor_nombre?: string | null }
  >,
  now = new Date()
): AthleteFollowUpSummary {
  const derived = deriveFollowUpStatus(interactions, now);
  const last = [...interactions].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  )[0];

  return {
    lastContactAt: derived.lastContactAt,
    lastTipo: last?.tipo_interaccion ?? null,
    lastResultado: last?.resultado ?? null,
    lastAutorNombre: last?.autor_nombre ?? null,
    followUpAt: derived.followUpAt,
    followUpStatus: derived.neverContacted
      ? "never_contacted"
      : derived.followUpStatus === "none"
        ? "none"
        : derived.followUpStatus,
    neverContacted: derived.neverContacted,
    recentlyContacted: derived.recentlyContacted,
    resolvedRecently: derived.resolvedRecently,
  };
}

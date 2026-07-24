export type CancelReservaOutcome =
  | { started: false }
  | { started: true; ok: true; requestId: number }
  | {
      started: true;
      ok: false;
      message: string;
      requestId: number;
      discarded?: boolean;
    };

/** Guard síncrono a nivel módulo — no depende de React state. */
const inFlightByReservaId = new Set<string>();
/** Monotónico por reserva: respuestas viejas se descartan. */
const latestRequestIdByReserva = new Map<string, number>();
let nextRequestId = 1;

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyListeners() {
  for (const listener of listeners) listener();
}

export function isCancelInFlight(reservaId: string): boolean {
  return inFlightByReservaId.has(reservaId);
}

/** Suscripción para re-renderizar botones cuando el lock módulo cambia. */
export function subscribeCancelInFlight(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Solo tests. */
export function resetCancelFlowForTests() {
  inFlightByReservaId.clear();
  latestRequestIdByReserva.clear();
  nextRequestId = 1;
  listeners.clear();
}

/**
 * PATCH de cancelación con exclusión mutua real por `reservaId`.
 * Dos clics (mismo botón o WeeklyCalendar + AthleteNextClassCard) → 1 fetch.
 */
export async function requestCancelReserva(params: {
  reservaId: string;
  fetchImpl?: typeof fetch;
}): Promise<CancelReservaOutcome> {
  const { reservaId } = params;

  if (inFlightByReservaId.has(reservaId)) {
    return { started: false };
  }

  const requestId = nextRequestId++;
  inFlightByReservaId.add(reservaId);
  latestRequestIdByReserva.set(reservaId, requestId);
  notifyListeners();

  try {
    const fetchFn = params.fetchImpl ?? fetch;
    const res = await fetchFn("/api/reservas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reserva_id: reservaId }),
    });

    let message = "Error";
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // cuerpo no JSON
    }

    if (latestRequestIdByReserva.get(reservaId) !== requestId) {
      return {
        started: true,
        ok: false,
        message,
        requestId,
        discarded: true,
      };
    }

    if (!res.ok) {
      return { started: true, ok: false, message, requestId };
    }

    return { started: true, ok: true, requestId };
  } finally {
    if (latestRequestIdByReserva.get(reservaId) === requestId) {
      inFlightByReservaId.delete(reservaId);
      notifyListeners();
    }
  }
}

/** Aplica cancelación local una sola vez; no revive estados previos. */
export function applyLocalCancel<T extends { id: string; estado: string }>(
  reservas: T[],
  reservaId: string
): T[] {
  return reservas.map((r) =>
    r.id === reservaId ? { ...r, estado: "cancelada" } : r
  );
}

/**
 * Al sincronizar props del servidor, no reviertas un cancel local con un
 * snapshot stale que todavía traiga `confirmada` (causa el parpadeo
 * Reservado ↔ Cancelada y el cupo 2→3→1 vía occupiedForSocioClass).
 */
export function mergeServerReservasPreservingLocalCancels<
  T extends { id: string; estado: string },
>(local: T[], incoming: T[]): T[] {
  const localById = new Map(local.map((r) => [r.id, r]));
  return incoming.map((serverRow) => {
    const localRow = localById.get(serverRow.id);
    if (
      localRow &&
      localRow.estado === "cancelada" &&
      serverRow.estado !== "cancelada"
    ) {
      return { ...serverRow, estado: "cancelada" };
    }
    return serverRow;
  });
}

/** ¿Esta respuesta debe aplicarse? Evita que un resultado viejo pise uno nuevo. */
export function shouldApplyCancelOutcome(
  reservaId: string,
  requestId: number
): boolean {
  return latestRequestIdByReserva.get(reservaId) === requestId;
}

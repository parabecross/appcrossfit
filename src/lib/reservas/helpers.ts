import type { Reserva } from "@/types/database";
import { hasClassEnded } from "@/lib/clases/helpers";

export const RESERVA_LIMITE_MAX_CODE = "RESERVA_LIMITE_MAX";

export function isOptimisticReservaId(id: string): boolean {
  return id.startsWith("temp-");
}

export function isPersistedReservaId(id: string): boolean {
  return !isOptimisticReservaId(id);
}

export const ACTIVE_RESERVA_ESTADOS = [
  "confirmada",
  "asistio",
  "no_asistio",
] as const;

export function isActiveReserva(estado: string): boolean {
  return (ACTIVE_RESERVA_ESTADOS as readonly string[]).includes(estado);
}

export function countReservasForClase(
  reservas: Pick<Reserva, "clase_id" | "estado">[],
  claseId: string
): number {
  return reservas.filter(
    (r) => r.clase_id === claseId && isActiveReserva(r.estado)
  ).length;
}

type ReservaOccupancyRef = Pick<Reserva, "clase_id" | "usuario_id" | "estado">;

function hasSocioBooking(
  reservas: ReservaOccupancyRef[],
  claseId: string,
  profileId: string
): boolean {
  return reservas.some(
    (r) =>
      r.clase_id === claseId &&
      r.usuario_id === profileId &&
      isActiveReserva(r.estado)
  );
}

/** Cupo visible al socio: total del box + ajuste optimista de su reserva. */
export function occupiedForSocioClass(
  claseId: string,
  baseOccupied: number,
  localReservas: ReservaOccupancyRef[],
  serverReservas: ReservaOccupancyRef[],
  profileId: string
): number {
  const hasNow = hasSocioBooking(localReservas, claseId, profileId);
  const hadOnLoad = hasSocioBooking(serverReservas, claseId, profileId);
  if (hasNow && !hadOnLoad) return baseOccupied + 1;
  if (!hasNow && hadOnLoad) return Math.max(0, baseOccupied - 1);
  return baseOccupied;
}

type ClaseScheduleRef = { fecha: string; hora_fin: string };

type ReservaUpcomingRef = Pick<Reserva, "clase_id" | "usuario_id" | "estado">;

function isUpcomingActiveReserva(
  reserva: ReservaUpcomingRef,
  profileId: string,
  clasesById: Map<string, ClaseScheduleRef>,
  timeZone: string
): boolean {
  if (reserva.usuario_id !== profileId) return false;
  if (!isActiveReserva(reserva.estado)) return false;

  const clase = clasesById.get(reserva.clase_id);
  if (!clase) return false;

  return !hasClassEnded(clase.fecha, clase.hora_fin, timeZone);
}

/** Reservas activas cuya clase aún no termina (ocupan cupo de límite 3). */
export function countUpcomingActiveReservasForUser(
  reservas: ReservaUpcomingRef[],
  profileId: string,
  clasesById: Map<string, ClaseScheduleRef>,
  timeZone: string
): number {
  return reservas.filter((r) =>
    isUpcomingActiveReserva(r, profileId, clasesById, timeZone)
  ).length;
}

export function hasReachedFutureReservaLimit(
  reservas: ReservaUpcomingRef[],
  profileId: string,
  clasesById: Map<string, ClaseScheduleRef>,
  timeZone: string,
  max = 3
): boolean {
  return (
    countUpcomingActiveReservasForUser(
      reservas,
      profileId,
      clasesById,
      timeZone
    ) >= max
  );
}

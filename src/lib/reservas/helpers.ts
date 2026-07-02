import type { Reserva } from "@/types/database";

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
      (r.estado === "confirmada" || r.estado === "asistio")
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

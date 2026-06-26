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

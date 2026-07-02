import { hasClassEnded } from "@/lib/clases/helpers";
import type { Clase, Reserva } from "@/types/database";

export type NextBookedClass = {
  clase: Clase;
  reserva: Reserva;
};

export function findNextBookedClass(
  clases: Clase[],
  reservas: Reserva[],
  profileId: string,
  gymTimezone?: string
): NextBookedClass | null {
  const claseById = new Map(clases.map((c) => [c.id, c]));
  const upcoming: NextBookedClass[] = [];

  for (const reserva of reservas) {
    if (reserva.usuario_id !== profileId || reserva.estado !== "confirmada") {
      continue;
    }
    const clase = claseById.get(reserva.clase_id);
    if (!clase || clase.estado !== "programada") continue;
    if (hasClassEnded(clase.fecha, clase.hora_fin, gymTimezone)) continue;
    upcoming.push({ clase, reserva });
  }

  upcoming.sort((a, b) => {
    const keyA = `${a.clase.fecha}T${a.clase.hora_inicio}`;
    const keyB = `${b.clase.fecha}T${b.clase.hora_inicio}`;
    return keyA.localeCompare(keyB);
  });

  return upcoming[0] ?? null;
}

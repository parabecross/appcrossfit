import { createClient } from "@/lib/supabase/server";
import {
  computeAttendanceRate,
  computeAttendanceStats,
  type AttendanceRecord,
  type AttendanceStats,
} from "@/lib/progreso/attendance";

interface ReservaAsistenciaRow {
  estado: string;
  clases: { fecha: string } | { fecha: string }[] | null;
}

export async function getAtletaAttendanceStats(
  usuarioId: string,
  timeZone: string
): Promise<AttendanceStats & { attendanceRate: number | null }> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reservas")
    .select("estado, clases!inner(fecha)")
    .eq("usuario_id", usuarioId)
    .in("estado", ["asistio", "no_asistio"]);

  const rows = (data ?? []) as ReservaAsistenciaRow[];

  let asistio = 0;
  let noAsistio = 0;
  const attended: AttendanceRecord[] = [];

  for (const row of rows) {
    const clase = Array.isArray(row.clases) ? row.clases[0] : row.clases;
    if (!clase?.fecha) continue;

    if (row.estado === "asistio") {
      asistio += 1;
      attended.push({ fecha: clase.fecha });
    } else if (row.estado === "no_asistio") {
      noAsistio += 1;
    }
  }

  const stats = computeAttendanceStats(attended, timeZone);
  const attendanceRate = computeAttendanceRate(asistio, noAsistio);

  return {
    ...stats,
    attendanceRate,
  };
}

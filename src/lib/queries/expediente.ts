import { createClient } from "@/lib/supabase/server";
import { getAtletaAttendanceStats } from "@/lib/queries/progreso-attendance";
import { getAtletaProgreso } from "@/lib/queries/progreso";
import type {
  AtletaObjetivo,
  AtletaPerfilDeportivo,
} from "@/types/database";

export async function getAtletaExpediente(
  usuarioId: string,
  timeZone: string
) {
  const supabase = await createClient();

  const [progreso, attendance, objetivosRes, perfilRes] = await Promise.all([
    getAtletaProgreso(usuarioId),
    getAtletaAttendanceStats(usuarioId, timeZone),
    supabase
      .from("atleta_objetivos")
      .select("*")
      .eq("usuario_id", usuarioId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("atleta_perfil_deportivo")
      .select("*")
      .eq("usuario_id", usuarioId)
      .maybeSingle(),
  ]);

  const objetivos = (objetivosRes.data ?? []) as AtletaObjetivo[];
  const activeGoal =
    objetivos.find((o) => o.estado === "en_proceso") ?? null;

  return {
    ...progreso,
    attendance,
    objetivos,
    activeGoal,
    perfilDeportivo: (perfilRes.data ?? null) as AtletaPerfilDeportivo | null,
  };
}

import { createClient } from "@/lib/supabase/server";
import { resolveQueryBoxId } from "@/lib/queries/box-scope";
import {
  computeFrequencyByUserId,
  getStatsData,
} from "@/lib/queries/stats";

export type AthleteProgressOverviewRow = {
  id: string;
  name: string;
  frequency: number | null;
  latestPr: {
    ejercicio: string;
    valor: number;
    unidad: string;
    fecha: string;
  } | null;
  latestSkill: {
    skill: string;
    at: string;
  } | null;
};

export async function getBoxAthleteProgressOverview(
  boxId?: string
): Promise<AthleteProgressOverviewRow[]> {
  const resolvedBoxId = await resolveQueryBoxId(boxId);
  const supabase = await createClient();

  const { data: socios } = await supabase
    .from("profiles")
    .select("id, nombre_completo")
    .eq("box_id", resolvedBoxId)
    .eq("rol", "socio")
    .order("nombre_completo");

  if (!socios?.length) return [];

  const socioIds = socios.map((s) => s.id);

  const [{ data: prs }, { data: skillHist }, statsRaw] = await Promise.all([
    supabase
      .from("atleta_pr_marcas")
      .select("usuario_id, ejercicio, valor, unidad, fecha, created_at")
      .in("usuario_id", socioIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("atleta_skill_historial")
      .select(
        "usuario_id, created_at, atleta_skills(skill)"
      )
      .in("usuario_id", socioIds)
      .in("estado_nuevo", ["logrado", "dominado"])
      .order("created_at", { ascending: false }),
    getStatsData(resolvedBoxId),
  ]);

  const frequencyByUser = computeFrequencyByUserId(statsRaw.reservas);

  const latestPrByUser = new Map<
    string,
    AthleteProgressOverviewRow["latestPr"]
  >();
  for (const p of prs ?? []) {
    if (latestPrByUser.has(p.usuario_id)) continue;
    latestPrByUser.set(p.usuario_id, {
      ejercicio: p.ejercicio,
      valor: Number(p.valor),
      unidad: p.unidad,
      fecha: p.fecha,
    });
  }

  const latestSkillByUser = new Map<
    string,
    AthleteProgressOverviewRow["latestSkill"]
  >();
  for (const h of skillHist ?? []) {
    if (latestSkillByUser.has(h.usuario_id)) continue;
    const skillRow = h.atleta_skills as { skill?: string } | null;
    if (!skillRow?.skill) continue;
    latestSkillByUser.set(h.usuario_id, {
      skill: skillRow.skill,
      at: h.created_at,
    });
  }

  return socios.map((socio) => {
    const freq = frequencyByUser.get(socio.id);
    return {
      id: socio.id,
      name: socio.nombre_completo,
      frequency: freq?.frequency ?? null,
      latestPr: latestPrByUser.get(socio.id) ?? null,
      latestSkill: latestSkillByUser.get(socio.id) ?? null,
    };
  });
}

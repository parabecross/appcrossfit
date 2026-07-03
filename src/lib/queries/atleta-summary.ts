import { createClient } from "@/lib/supabase/server";
import { SKILL_KEYS, type SkillKey } from "@/lib/progreso/constants";
import type { AtletaObjetivo, AtletaPrMarca, AtletaSkill } from "@/types/database";

export type AtletaSkillsSummary = {
  total: number;
  sin_marcar: SkillKey[];
  en_proceso: AtletaSkill[];
  logrado: AtletaSkill[];
  dominado: AtletaSkill[];
};

export type AtletaMarcasSummary = {
  total: number;
  items: AtletaPrMarca[];
};

const EMPTY_SKILLS: AtletaSkillsSummary = {
  total: 0,
  sin_marcar: [...SKILL_KEYS],
  en_proceso: [],
  logrado: [],
  dominado: [],
};

const EMPTY_MARCAS: AtletaMarcasSummary = {
  total: 0,
  items: [],
};

function sortSkillsByName(rows: AtletaSkill[]): AtletaSkill[] {
  return [...rows].sort((a, b) => a.skill.localeCompare(b.skill));
}

function buildSkillsSummary(rows: AtletaSkill[]): AtletaSkillsSummary {
  const markedKeys = new Set(rows.map((s) => s.skill));

  return {
    total: rows.length,
    sin_marcar: SKILL_KEYS.filter((key) => !markedKeys.has(key)),
    en_proceso: sortSkillsByName(
      rows.filter((s) => s.estado === "en_proceso")
    ),
    logrado: sortSkillsByName(rows.filter((s) => s.estado === "logrado")),
    dominado: sortSkillsByName(rows.filter((s) => s.estado === "dominado")),
  };
}

function buildMarcasSummary(rows: AtletaPrMarca[]): AtletaMarcasSummary {
  return {
    total: rows.length,
    items: [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha)),
  };
}

export async function getAtletaSkillsAndMarcasSummaryMap(
  usuarioIds: string[]
): Promise<{
  skillsMap: Map<string, AtletaSkillsSummary>;
  marcasMap: Map<string, AtletaMarcasSummary>;
}> {
  const skillsMap = new Map<string, AtletaSkillsSummary>();
  const marcasMap = new Map<string, AtletaMarcasSummary>();

  if (usuarioIds.length === 0) {
    return { skillsMap, marcasMap };
  }

  const supabase = await createClient();

  const [{ data: skills }, { data: marcas }] = await Promise.all([
    supabase.from("atleta_skills").select("*").in("usuario_id", usuarioIds),
    supabase.from("atleta_pr_marcas").select("*").in("usuario_id", usuarioIds),
  ]);

  const skillsByUser = new Map<string, AtletaSkill[]>();
  for (const row of (skills ?? []) as AtletaSkill[]) {
    const list = skillsByUser.get(row.usuario_id) ?? [];
    list.push(row);
    skillsByUser.set(row.usuario_id, list);
  }

  for (const [usuarioId, rows] of skillsByUser) {
    skillsMap.set(usuarioId, buildSkillsSummary(rows));
  }

  const marcasByUser = new Map<string, AtletaPrMarca[]>();
  for (const row of (marcas ?? []) as AtletaPrMarca[]) {
    const list = marcasByUser.get(row.usuario_id) ?? [];
    list.push(row);
    marcasByUser.set(row.usuario_id, list);
  }

  for (const [usuarioId, rows] of marcasByUser) {
    marcasMap.set(usuarioId, buildMarcasSummary(rows));
  }

  return { skillsMap, marcasMap };
}

export async function getActiveObjetivosMapForUsuarios(
  usuarioIds: string[]
): Promise<Map<string, AtletaObjetivo[]>> {
  const map = new Map<string, AtletaObjetivo[]>();
  if (usuarioIds.length === 0) return map;

  const supabase = await createClient();
  const { data } = await supabase
    .from("atleta_objetivos")
    .select("*")
    .in("usuario_id", usuarioIds)
    .eq("estado", "en_proceso")
    .order("created_at", { ascending: false });

  for (const row of (data ?? []) as AtletaObjetivo[]) {
    const list = map.get(row.usuario_id) ?? [];
    list.push(row);
    map.set(row.usuario_id, list);
  }
  return map;
}

export { EMPTY_MARCAS, EMPTY_SKILLS };

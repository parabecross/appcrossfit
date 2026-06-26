import { createClient } from "@/lib/supabase/server";
import type {
  AtletaPrMarca,
  AtletaSkill,
  AtletaSkillHistorial,
} from "@/types/database";

export async function getAtletaProgreso(usuarioId: string) {
  const supabase = await createClient();

  const [prsRes, skillsRes, histRes] = await Promise.all([
    supabase
      .from("atleta_pr_marcas")
      .select("*")
      .eq("usuario_id", usuarioId)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("atleta_skills")
      .select("*")
      .eq("usuario_id", usuarioId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("atleta_skill_historial")
      .select("*")
      .eq("usuario_id", usuarioId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return {
    marcas: (prsRes.data ?? []) as AtletaPrMarca[],
    skills: (skillsRes.data ?? []) as AtletaSkill[],
    skillHistorial: (histRes.data ?? []) as AtletaSkillHistorial[],
  };
}

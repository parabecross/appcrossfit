import type { AthleticLevel, AthleteCardData } from "@/lib/legacy/types";
import type { AtletaObjetivo, AtletaPerfilDeportivo, Profile } from "@/types/database";

const DEFAULT_ACCENT = "#ea580c";

export function calculateAge(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const [y, m, d] = fechaNacimiento.split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) {
    age -= 1;
  }
  return age > 0 && age < 120 ? age : null;
}

export function buildAthleteCardData(input: {
  profile: Pick<Profile, "nombre_completo" | "foto_url">;
  perfil: AtletaPerfilDeportivo | null;
  activeGoal: AtletaObjetivo | null;
  boxName: string;
  boxLogoUrl?: string | null;
  defaultTagline: string;
  accentColor?: string;
}): AthleteCardData {
  const perfil = input.perfil;
  const level = perfil?.nivel_deportivo as AthleticLevel | null | undefined;

  return {
    name: input.profile.nombre_completo,
    photoUrl: input.profile.foto_url,
    boxName: input.boxName,
    boxLogoUrl: input.boxLogoUrl ?? null,
    discipline: perfil?.disciplina?.trim() || perfil?.modalidad_favorita?.trim() || null,
    age: calculateAge(perfil?.fecha_nacimiento ?? null),
    heightCm: perfil?.estatura_cm ?? null,
    weightKg: perfil?.peso_corporal_kg ?? null,
    level: level && ["beginner", "intermediate", "advanced", "rx"].includes(level)
      ? level
      : null,
    yearsTraining:
      perfil?.anos_entrenando != null && perfil.anos_entrenando >= 0
        ? perfil.anos_entrenando
        : null,
    goal: input.activeGoal?.nombre?.trim() || null,
    tagline: perfil?.frase_legacy?.trim() || input.defaultTagline,
    accentColor: input.accentColor ?? DEFAULT_ACCENT,
  };
}

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

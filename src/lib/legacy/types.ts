export type AthleticLevel = "beginner" | "intermediate" | "advanced" | "rx";

export type LegacyCardFormat = "story" | "post" | "square";

export const LEGACY_CARD_DIMENSIONS: Record<
  LegacyCardFormat,
  { width: number; height: number }
> = {
  story: { width: 1080, height: 1920 },
  post: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
};

export interface AthleteCardData {
  name: string;
  photoUrl: string | null;
  boxName: string;
  boxLogoUrl: string | null;
  discipline: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  level: AthleticLevel | null;
  yearsTraining: number | null;
  goal: string | null;
  tagline: string;
  accentColor: string;
}

export interface LegacyFormState {
  fecha_nacimiento: string;
  disciplina: string;
  nivel_deportivo: AthleticLevel | "";
  frase_legacy: string;
  peso_corporal_kg: string;
  estatura_cm: string;
  anos_entrenando: string;
}

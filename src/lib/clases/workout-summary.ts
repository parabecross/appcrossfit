/** Returns the first N non-empty lines of a workout text for compact previews. */
export function summarizeWorkout(
  entrenamiento: string | null | undefined,
  maxLines = 2
): string[] {
  if (!entrenamiento?.trim()) return [];

  return entrenamiento
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines);
}

export type ClassTimeBlock = "morning" | "afternoon" | "evening";

/** Socio booking view: before noon vs noon onwards. */
export type SocioDayPeriod = "morning" | "afternoon";

export function getSocioDayPeriod(horaInicio: string): SocioDayPeriod {
  const hour = parseInt(horaInicio.slice(0, 2), 10);
  return hour < 12 ? "morning" : "afternoon";
}

export function getClassTimeBlock(horaInicio: string): ClassTimeBlock {
  const hour = parseInt(horaInicio.slice(0, 2), 10);
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function occupancyTone(
  occupied: number,
  max: number
): "low" | "medium" | "high" {
  if (max <= 0) return "low";
  const pct = (occupied / max) * 100;
  if (pct >= 90) return "high";
  if (pct >= 70) return "medium";
  return "low";
}

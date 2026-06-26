import type { PrUnidad } from "@/types/database";

export interface PrExerciseDef {
  key: string;
  unit: PrUnidad;
  /** true = mayor es mejor; false = menor es mejor (tiempos) */
  higherIsBetter: boolean;
  /** Para tiempos: entrada en mm:ss */
  timeInput?: boolean;
}

export const PR_EXERCISES: PrExerciseDef[] = [
  { key: "back_squat", unit: "kg", higherIsBetter: true },
  { key: "front_squat", unit: "kg", higherIsBetter: true },
  { key: "deadlift", unit: "kg", higherIsBetter: true },
  { key: "bench_press", unit: "kg", higherIsBetter: true },
  { key: "shoulder_press", unit: "kg", higherIsBetter: true },
  { key: "clean", unit: "kg", higherIsBetter: true },
  { key: "snatch", unit: "kg", higherIsBetter: true },
  { key: "clean_jerk", unit: "kg", higherIsBetter: true },
  { key: "pull_ups", unit: "reps", higherIsBetter: true },
  { key: "toes_to_bar", unit: "reps", higherIsBetter: true },
  { key: "double_unders", unit: "reps", higherIsBetter: true },
  { key: "row_2k", unit: "segundos", higherIsBetter: false, timeInput: true },
  { key: "run_5k", unit: "segundos", higherIsBetter: false, timeInput: true },
];

export const SKILL_KEYS = [
  "pull_ups",
  "chest_to_bar",
  "bar_muscle_up",
  "ring_muscle_up",
  "handstand_push_up",
  "handstand_walk",
  "double_unders",
  "rope_climb",
  "pistols",
  "kipping_pull_up",
  "butterfly_pull_up",
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

export const SKILL_PROGRESS: Record<string, number> = {
  en_proceso: 33,
  logrado: 66,
  dominado: 100,
};

export function getPrExercise(key: string): PrExerciseDef | undefined {
  return PR_EXERCISES.find((e) => e.key === key);
}

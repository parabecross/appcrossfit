import type { AtletaPrMarca, PrUnidad } from "@/types/database";
import { getPrExercise } from "./constants";

export function formatPrValue(valor: number, unidad: PrUnidad): string {
  if (unidad === "segundos") return formatSeconds(valor);
  if (unidad === "kg") return `${valor} kg`;
  if (unidad === "reps") return `${valor} reps`;
  if (unidad === "metros") return `${valor} m`;
  return String(valor);
}

export function formatSeconds(totalSeconds: number): string {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** Convierte mm:ss o m:ss a segundos */
export function parseTimeInput(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => parseInt(p, 10));
  if (parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

export function secondsToTimeInput(totalSeconds: number): string {
  return formatSeconds(totalSeconds);
}

export function isPrImprovement(
  ejercicio: string,
  newValor: number,
  previousValor: number | null
): boolean {
  if (previousValor === null) return true;
  const def = getPrExercise(ejercicio);
  if (!def) return newValor > previousValor;
  return def.higherIsBetter
    ? newValor > previousValor
    : newValor < previousValor;
}

export function comparePrDelta(
  ejercicio: string,
  newValor: number,
  previousValor: number,
  unidad: PrUnidad
): string {
  const def = getPrExercise(ejercicio);
  const diff = def?.higherIsBetter
    ? newValor - previousValor
    : previousValor - newValor;

  if (diff <= 0) return "";

  if (unidad === "segundos") {
    return `-${Math.round(previousValor - newValor)}s`;
  }
  if (unidad === "kg") return `+${diff} kg`;
  if (unidad === "reps") return `+${diff} reps`;
  return `+${diff}`;
}

export function getLatestPrPerExercise(
  marcas: AtletaPrMarca[]
): Map<string, AtletaPrMarca> {
  const map = new Map<string, AtletaPrMarca>();
  for (const m of marcas) {
    const existing = map.get(m.ejercicio);
    if (!existing) {
      map.set(m.ejercicio, m);
      continue;
    }
    const def = getPrExercise(m.ejercicio);
    const isBetter = def?.higherIsBetter
      ? m.valor > existing.valor
      : m.valor < existing.valor;
    if (isBetter) map.set(m.ejercicio, m);
  }
  return map;
}

export function getPreviousPr(
  marcas: AtletaPrMarca[],
  ejercicio: string,
  excludeId?: string
): AtletaPrMarca | null {
  const def = getPrExercise(ejercicio);
  const candidates = marcas
    .filter((m) => m.ejercicio === ejercicio && m.id !== excludeId)
    .sort((a, b) => {
      if (def?.higherIsBetter) return b.valor - a.valor;
      return a.valor - b.valor;
    });
  return candidates[0] ?? null;
}

export function countAchievedSkills(
  skills: { estado: string }[]
): number {
  return skills.filter((s) => s.estado === "logrado" || s.estado === "dominado")
    .length;
}

export function suggestNextGoal(
  latestPrs: Map<string, AtletaPrMarca>,
  skills: { skill: string; estado: string }[]
): string | null {
  const noPr = ["back_squat", "deadlift", "pull_ups", "clean"].find(
    (k) => !latestPrs.has(k)
  );
  if (noPr) return noPr;

  const inProgress = skills.find((s) => s.estado === "en_proceso");
  if (inProgress) return inProgress.skill;

  return "deadlift";
}

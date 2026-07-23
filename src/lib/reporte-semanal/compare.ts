import type { MetricComparison } from "./types";

/**
 * Compara métricas numéricas. Si previous === 0:
 * - current === 0 → sin_cambio
 * - current > 0 → nuevo (sin % engañoso)
 * Si no hay dato previo comparable para ocupación null → sin_datos
 */
export function compareMetric(
  current: number,
  previous: number
): MetricComparison {
  const absoluteDelta = current - previous;

  if (previous === 0 && current === 0) {
    return {
      current,
      previous,
      absoluteDelta: 0,
      percentDelta: null,
      label: "sin_cambio",
    };
  }

  if (previous === 0 && current > 0) {
    return {
      current,
      previous,
      absoluteDelta,
      percentDelta: null,
      label: "nuevo",
    };
  }

  if (absoluteDelta === 0) {
    return {
      current,
      previous,
      absoluteDelta: 0,
      percentDelta: 0,
      label: "sin_cambio",
    };
  }

  const percentDelta = Math.round((absoluteDelta / previous) * 100);
  return {
    current,
    previous,
    absoluteDelta,
    percentDelta,
    label: "ok",
  };
}

/** Comparación cuando uno o ambos valores pueden ser null (ocupación). */
export function compareNullableMetric(
  current: number | null,
  previous: number | null
): MetricComparison {
  if (current === null && previous === null) {
    return {
      current: 0,
      previous: 0,
      absoluteDelta: 0,
      percentDelta: null,
      label: "sin_datos",
    };
  }
  if (current === null || previous === null) {
    return {
      current: current ?? 0,
      previous: previous ?? 0,
      absoluteDelta: (current ?? 0) - (previous ?? 0),
      percentDelta: null,
      label: "sin_datos",
    };
  }
  return compareMetric(current, previous);
}

export function formatComparisonLabel(c: MetricComparison): string {
  switch (c.label) {
    case "sin_datos":
      return "Sin datos comparables";
    case "nuevo":
      return "Nuevo registro";
    case "sin_cambio":
      return "Sin cambio";
    case "ok": {
      const sign = c.absoluteDelta > 0 ? "+" : "";
      const pct =
        c.percentDelta !== null ? ` (${sign}${c.percentDelta}%)` : "";
      return `${sign}${c.absoluteDelta}${pct}`;
    }
  }
}

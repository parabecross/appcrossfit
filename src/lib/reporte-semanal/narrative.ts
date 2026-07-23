import { formatComparisonLabel } from "./compare";
import type { WeeklyReportMetrics } from "./types";

/**
 * Resumen determinista (sin IA). Omite oraciones cuyo dato no aporte.
 */
export function buildWeeklyNarrative(m: WeeklyReportMetrics): string {
  const parts: string[] = [];

  const athletesCmp = m.comparison.uniqueAthletesAttended;
  if (m.uniqueAthletesAttended > 0) {
    let sentence = `Esta semana asistieron ${m.uniqueAthletesAttended} atletas`;
    if (athletesCmp.label === "ok" && athletesCmp.percentDelta !== null) {
      const dir = athletesCmp.percentDelta > 0 ? "más" : "menos";
      sentence += `, un ${Math.abs(athletesCmp.percentDelta)}% ${dir} que la semana anterior`;
    } else if (athletesCmp.label === "nuevo") {
      sentence += " (sin datos comparables la semana anterior)";
    }
    sentence += ".";
    parts.push(sentence);
  }

  const top = m.topOccupiedClasses[0];
  if (top && top.occupancyPct !== null) {
    parts.push(
      `El horario con mayor demanda fue ${top.label} (${top.occupancyPct}% de ocupación).`
    );
  }

  if (m.membershipsExpiringSoon > 0) {
    parts.push(
      `Hay ${m.membershipsExpiringSoon} membresías próximas a vencer.`
    );
  }

  if (m.inactiveAthletes.length > 0) {
    parts.push(
      `${m.inactiveAthletes.length} atletas activos llevan 10 o más días sin asistir.`
    );
  }

  if (m.classesHeld > 0) {
    parts.push(`Se impartieron ${m.classesHeld} clases en el periodo.`);
  }

  if (m.newAthletes > 0) {
    parts.push(`Se registraron ${m.newAthletes} atletas nuevos.`);
  }

  if (parts.length === 0) {
    return "Sin datos operativos suficientes para generar un resumen de esta semana.";
  }

  return parts.join(" ");
}

export { formatComparisonLabel };

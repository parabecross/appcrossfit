import { getAtletaAttendanceStats } from "@/lib/queries/progreso-attendance";
import { AthleteConstancyCard } from "@/components/socio/home/athlete-constancy";

/**
 * Constancy-only secondary block for Mis reservas.
 * Avoids progress / ranking / objetivos queries on the booking home.
 */
export async function AthleteHomeConstancy({
  profileId,
  timezone,
}: {
  profileId: string;
  timezone: string;
}) {
  const attendance = await getAtletaAttendanceStats(profileId, timezone);

  return (
    <AthleteConstancyCard
      classesThisWeek={attendance.classesThisWeek}
      classesThisMonth={attendance.classesThisMonth}
      streak={attendance.streak}
    />
  );
}

export function AthleteHomeConstancyFallback() {
  return (
    <div className="h-20 rounded-xl bg-white/[0.04] animate-pulse" aria-hidden />
  );
}

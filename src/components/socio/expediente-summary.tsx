"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressDashboard } from "@/components/socio/progress/progress-dashboard";
import { ProgressBadgesPanel } from "@/components/socio/progress/progress-badges-panel";
import type {
  AtletaObjetivo,
  AtletaPrMarca,
  AtletaSkill,
} from "@/types/database";
import type { AttendanceStats } from "@/lib/progreso/attendance";

export function ExpedienteSummary({
  marcas,
  skills,
  objetivos,
  activeGoal,
  attendance,
}: {
  marcas: AtletaPrMarca[];
  skills: AtletaSkill[];
  objetivos: AtletaObjetivo[];
  activeGoal: AtletaObjetivo | null;
  attendance: AttendanceStats & { attendanceRate: number | null };
}) {
  const t = useTranslations("progress");

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400/90">
            {t("expediente.label")}
          </p>
          <h2 className="text-lg font-black tracking-tight">
            {t("expediente.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("expediente.subtitle")}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5 rounded-xl border-orange-500/30">
          <Link href="/mi-progreso">
            {t("expediente.viewAll")}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      <ProgressDashboard
        marcas={marcas}
        skills={skills}
        objetivos={objetivos}
        activeGoal={activeGoal}
        attendance={attendance}
      />

      <ProgressBadgesPanel
        compact
        input={{
          marcas,
          skills,
          objetivos,
          totalClasses: attendance.totalClasses,
          uniqueTrainingDays: attendance.uniqueTrainingDays,
        }}
      />
    </section>
  );
}

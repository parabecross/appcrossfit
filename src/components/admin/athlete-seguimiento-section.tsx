"use client";

import { useTranslations } from "next-intl";
import { formatDate, formatTime, cn } from "@/lib/utils";
import type { SeguimientoWithAutor } from "@/lib/seguimientos/helpers";
import type { AthleteFollowUpSummary } from "@/lib/seguimientos/helpers";
import { RegistrarSeguimientoDialog } from "@/components/admin/registrar-seguimiento-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function AthleteSeguimientoSection({
  athleteId,
  athleteName,
  items,
  summary,
  locale,
  hasMore,
  tableMissing,
}: {
  athleteId: string;
  athleteName: string;
  items: SeguimientoWithAutor[];
  summary: AthleteFollowUpSummary;
  locale: string;
  hasMore: boolean;
  tableMissing?: boolean;
}) {
  const t = useTranslations("admin.athletesInbox.seguimiento");

  const statusLabel =
    summary.followUpStatus === "overdue"
      ? t("status.overdue")
      : summary.followUpStatus === "today"
        ? t("status.today")
        : summary.followUpStatus === "scheduled"
          ? t("status.scheduled")
          : summary.neverContacted
            ? t("status.neverContacted")
            : t("status.none");

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0">
        <div>
          <CardTitle>{t("sectionTitle")}</CardTitle>
          <CardDescription>{t("privacyNotice")}</CardDescription>
        </div>
        {!tableMissing ? (
          <RegistrarSeguimientoDialog
            athleteId={athleteId}
            athleteName={athleteName}
            defaultTipo="internal_note"
            defaultResultado="note_only"
          />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {tableMissing ? (
          <p className="text-sm text-muted-foreground">{t("tableMissing")}</p>
        ) : (
          <>
            <div className="rounded-xl bg-black/20 px-4 py-3 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                {t("summaryTitle")}
              </p>
              <p className="text-sm">
                {t("lastContact")}:{" "}
                {summary.lastContactAt
                  ? `${formatDate(summary.lastContactAt.slice(0, 10), locale)} · ${t(`types.${summary.lastTipo}` as never)} · ${t(`outcomes.${summary.lastResultado}` as never)}`
                  : t("status.neverContacted")}
              </p>
              {summary.lastAutorNombre ? (
                <p className="text-xs text-muted-foreground">
                  {t("author")}: {summary.lastAutorNombre}
                </p>
              ) : null}
              <p className="text-sm">
                {t("nextFollowUp")}:{" "}
                <span
                  className={cn(
                    summary.followUpStatus === "overdue" && "text-red-400",
                    summary.followUpStatus === "today" && "text-orange-400"
                  )}
                >
                  {summary.followUpAt
                    ? `${formatDate(summary.followUpAt.slice(0, 10), locale)} · ${statusLabel}`
                    : statusLabel}
                </span>
              </p>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("emptyHistory")}</p>
            ) : (
              <ol className="space-y-3 border-l border-white/10 pl-4">
                {items.map((item) => (
                  <li key={item.id} className="relative space-y-1">
                    <span className="absolute -left-[1.28rem] top-1.5 h-2 w-2 rounded-full bg-orange-400/80" />
                    <p className="text-sm font-medium">
                      {t(`types.${item.tipo_interaccion}`)} ·{" "}
                      {t(`outcomes.${item.resultado}`)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.occurred_at.slice(0, 10), locale)}{" "}
                      {formatTime(item.occurred_at.slice(11, 16))}
                      {item.autor_nombre ? ` · ${item.autor_nombre}` : ""}
                    </p>
                    {item.nota ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.nota}
                      </p>
                    ) : null}
                    {item.follow_up_at ? (
                      <p className="text-xs text-orange-300/90">
                        {t("followUpAt")}:{" "}
                        {formatDate(item.follow_up_at.slice(0, 10), locale)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
            {hasMore ? (
              <p className="text-xs text-muted-foreground">{t("showingLatest")}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

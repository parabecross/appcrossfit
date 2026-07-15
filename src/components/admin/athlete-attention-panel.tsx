import { Link } from "@/i18n/routing";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppReminderButton } from "@/components/admin/whatsapp-reminder-button";
import type { WhatsAppMessageType } from "@/lib/whatsapp";
import type { RetentionAttentionLevel } from "@/lib/retention/athlete-risk";

export function AthleteAttentionPanel({
  level,
  score,
  reasons,
  reasonLabels,
  labels,
  phone,
  nombre,
  fechaFin,
  locale,
  boxName,
  whatsappType,
  backHref,
  athleteId,
}: {
  level: RetentionAttentionLevel;
  score: number;
  reasons: string[];
  reasonLabels: Record<string, string>;
  labels: {
    title: string;
    signals: string;
    scoreHint: string;
    levelHigh: string;
    levelMedium: string;
    levelLow: string;
    backToInbox: string;
  };
  phone: string | null;
  nombre: string;
  fechaFin: string | null;
  locale: string;
  boxName: string;
  whatsappType: WhatsAppMessageType;
  backHref: string;
  athleteId: string;
}) {
  const levelLabel =
    level === "high"
      ? labels.levelHigh
      : level === "medium"
        ? labels.levelMedium
        : labels.levelLow;

  const visibleReasons = reasons.filter((r) => r !== "new_athlete");

  return (
    <section
      className={cn(
        "rounded-2xl p-4 sm:p-5 space-y-3 ring-1",
        level === "high" && "bg-red-500/[0.05] ring-red-500/20",
        level === "medium" && "bg-orange-500/[0.05] ring-orange-500/20",
        level === "low" && "bg-white/[0.02] ring-white/10"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <Link
            href={backHref}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {labels.backToInbox}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold">{labels.title}</p>
            <span
              className={cn(
                "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                level === "high" && "bg-red-500/20 text-red-400",
                level === "medium" && "bg-orange-500/20 text-orange-400",
                level === "low" && "bg-white/10 text-muted-foreground"
              )}
            >
              {levelLabel}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {labels.scoreHint}:{" "}
            <span className="tabular-nums font-medium text-foreground/80">
              {score}
            </span>
          </p>
          {visibleReasons.length > 0 ? (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                {labels.signals}
              </p>
              <ul className="space-y-0.5">
                {visibleReasons.map((r) => (
                  <li key={r} className="text-sm text-muted-foreground">
                    {reasonLabels[r] ?? r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <WhatsAppReminderButton
          phone={phone}
          nombre={nombre}
          fechaFin={fechaFin}
          locale={locale}
          type={whatsappType}
          boxName={boxName}
          size="default"
          athleteId={athleteId}
        />
      </div>
    </section>
  );
}

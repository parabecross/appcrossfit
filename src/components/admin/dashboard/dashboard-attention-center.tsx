"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { WhatsAppReminderButton } from "@/components/admin/whatsapp-reminder-button";
import type { AttentionCase } from "@/lib/retention/attention-cases";
import type { AdminDashboardTodayClass } from "@/lib/queries/admin-dashboard";
import type { BirthdayAlert } from "@/lib/queries/birthdays";
import { formatTime, cn } from "@/lib/utils";
import { BirthdayInfoCard } from "@/components/admin/birthday-info-card";
import { USUARIOS_DEEP_LINKS } from "@/lib/admin/usuarios-filters";

function initials(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function PriorityBadge({
  level,
  labels,
}: {
  level: AttentionCase["level"];
  labels: {
    levelHigh: string;
    levelMedium: string;
    levelLow: string;
  };
}) {
  const text =
    level === "high"
      ? labels.levelHigh
      : level === "medium"
        ? labels.levelMedium
        : labels.levelLow;
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
        level === "high" && "bg-red-500/20 text-red-400",
        level === "medium" && "bg-orange-500/20 text-orange-400",
        level === "low" && "bg-white/10 text-muted-foreground"
      )}
    >
      {text}
    </span>
  );
}

function AttentionCaseCard({
  item,
  locale,
  boxName,
  labels,
}: {
  item: AttentionCase;
  locale: string;
  boxName: string;
  labels: {
    levelHigh: string;
    levelMedium: string;
    levelLow: string;
    openProfile: string;
    lastAttendance: string;
    membership: string;
    membershipStatuses: Record<string, string>;
  };
}) {
  const tReasons = useTranslations("adminDashboard.attention.reasons");
  const visibleReasons = item.reasons
    .filter((r) => r !== "new_athlete")
    .slice(0, 2);

  return (
    <article className="rounded-xl bg-black/20 ring-1 ring-white/10 px-3 py-3 sm:px-4 space-y-3">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          {item.fotoUrl ? <AvatarImage src={item.fotoUrl} alt="" /> : null}
          <AvatarFallback>{initials(item.nombre)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/usuarios/${item.profileId}`}
              className="font-semibold text-sm truncate hover:underline min-h-11 inline-flex items-center"
            >
              {item.nombre}
            </Link>
            <PriorityBadge level={item.level} labels={labels} />
          </div>
          <ul className="space-y-0.5">
            {visibleReasons.map((reason) => (
              <li key={reason} className="text-xs text-muted-foreground">
                {tReasons(reason as never)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {item.daysSinceAttendance != null ? (
              <span className="tabular-nums">
                {labels.lastAttendance}: {item.daysSinceAttendance}d
              </span>
            ) : null}
            {item.membershipStatus ? (
              <span>
                {labels.membership}:{" "}
                {labels.membershipStatuses[item.membershipStatus] ??
                  item.membershipStatus}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <WhatsAppReminderButton
          phone={item.telefono}
          nombre={item.nombre}
          fechaFin={item.fechaFin}
          locale={locale}
          type={item.whatsappType}
          boxName={boxName}
          athleteId={item.profileId}
        />
        <Link
          href={`/admin/usuarios/${item.profileId}`}
          className="inline-flex min-h-11 items-center text-xs font-medium text-orange-400 hover:text-orange-300"
        >
          {labels.openProfile}
        </Link>
      </div>
    </article>
  );
}

export function DashboardAttentionCenter({
  cases,
  fullClasses,
  lowOccupancyClasses,
  birthdayAlerts,
  pendingPaymentCount,
  locale,
  boxName,
  followUpSummary,
  labels,
}: {
  cases: AttentionCase[];
  fullClasses: AdminDashboardTodayClass[];
  lowOccupancyClasses: AdminDashboardTodayClass[];
  birthdayAlerts: BirthdayAlert[];
  pendingPaymentCount: number;
  locale: string;
  boxName: string;
  followUpSummary?: {
    neverContactedAttention: number;
    followUpOverdue: number;
    followUpToday: number;
  };
  labels: {
    title: string;
    subtitle: string;
    priorityHigh: string;
    priorityMedium: string;
    priorityInfo: string;
    levelHigh: string;
    levelMedium: string;
    levelLow: string;
    emptyPremium: string;
    seeMore: string;
    openProfile: string;
    lastAttendance: string;
    membership: string;
    membershipStatuses: Record<string, string>;
    fullClasses: string;
    lowOccupancy: string;
    pendingPayment: string;
    cupo: string;
    followUpNeverContacted: string;
    followUpOverdue: string;
    followUpToday: string;
  };
}) {
  const hasOps =
    fullClasses.length > 0 ||
    lowOccupancyClasses.length > 0 ||
    pendingPaymentCount > 0;
  const hasCases = cases.length > 0;
  const hasBirthdays = birthdayAlerts.length > 0;
  const hasFollowUp =
    !!followUpSummary &&
    (followUpSummary.neverContactedAttention > 0 ||
      followUpSummary.followUpOverdue > 0 ||
      followUpSummary.followUpToday > 0);
  const totalSignals = hasOps || hasCases || hasBirthdays || hasFollowUp;

  return (
    <section className="rounded-2xl bg-white/[0.02] ring-1 ring-white/10 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold">{labels.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {labels.subtitle}
          </p>
        </div>
        <Link
          href={USUARIOS_DEEP_LINKS.needsAttention}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 shrink-0"
        >
          {labels.seeMore}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {followUpSummary ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link
            href={USUARIOS_DEEP_LINKS.neverContacted}
            className="min-h-11 inline-flex items-center gap-1.5 hover:underline"
          >
            <span className="text-muted-foreground">
              {labels.followUpNeverContacted}
            </span>
            <span className="tabular-nums font-semibold">
              {followUpSummary.neverContactedAttention}
            </span>
          </Link>
          <Link
            href={USUARIOS_DEEP_LINKS.followUpOverdue}
            className="min-h-11 inline-flex items-center gap-1.5 hover:underline"
          >
            <span className="text-muted-foreground">
              {labels.followUpOverdue}
            </span>
            <span className="tabular-nums font-semibold text-red-400">
              {followUpSummary.followUpOverdue}
            </span>
          </Link>
          <Link
            href={USUARIOS_DEEP_LINKS.followUpToday}
            className="min-h-11 inline-flex items-center gap-1.5 hover:underline"
          >
            <span className="text-muted-foreground">
              {labels.followUpToday}
            </span>
            <span className="tabular-nums font-semibold text-orange-400">
              {followUpSummary.followUpToday}
            </span>
          </Link>
        </div>
      ) : null}

      {!totalSignals ? (
        <div className="flex items-center gap-3 rounded-xl bg-green-500/[0.06] px-4 py-4">
          <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
          <p className="text-sm text-muted-foreground">{labels.emptyPremium}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(fullClasses.length > 0 || pendingPaymentCount > 0) && (
            <div className="rounded-xl px-3 py-3 sm:px-4 bg-red-500/[0.04] ring-1 ring-red-500/15 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                  {labels.priorityHigh}
                </span>
              </div>
              {pendingPaymentCount > 0 ? (
                <Link
                  href={USUARIOS_DEEP_LINKS.paymentPending}
                  className="block text-sm hover:underline min-h-11 py-2"
                >
                  {labels.pendingPayment}:{" "}
                  <span className="tabular-nums font-semibold">
                    {pendingPaymentCount}
                  </span>
                </Link>
              ) : null}
              {fullClasses.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-red-400/90">
                    {labels.fullClasses}
                  </p>
                  {fullClasses.slice(0, 4).map((c) => (
                    <Link
                      key={c.id}
                      href="/admin/clases"
                      className="block text-sm text-muted-foreground hover:text-foreground min-h-11 py-2"
                    >
                      {c.nombre} · {formatTime(c.hora_inicio)} — {labels.cupo}{" "}
                      {c.cupo_ocupado}/{c.cupo_maximo}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {lowOccupancyClasses.length > 0 ? (
            <div className="rounded-xl px-3 py-3 sm:px-4 bg-orange-500/[0.04] ring-1 ring-orange-500/15 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                  {labels.priorityMedium}
                </span>
              </div>
              <p className="text-xs font-semibold text-orange-400/90">
                {labels.lowOccupancy}
              </p>
              {lowOccupancyClasses.slice(0, 4).map((c) => (
                <Link
                  key={c.id}
                  href="/admin/clases"
                  className="block text-sm text-muted-foreground hover:text-foreground min-h-11 py-2"
                >
                  {c.nombre} · {formatTime(c.hora_inicio)} — {labels.cupo}{" "}
                  {c.cupo_ocupado}/{c.cupo_maximo}
                </Link>
              ))}
            </div>
          ) : null}

          {hasCases ? (
            <div className="space-y-2">
              {cases.map((item) => (
                <AttentionCaseCard
                  key={item.profileId}
                  item={item}
                  locale={locale}
                  boxName={boxName}
                  labels={labels}
                />
              ))}
            </div>
          ) : null}

          {hasBirthdays ? (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-muted-foreground">
                {labels.priorityInfo}
              </span>
              <BirthdayInfoCard alerts={birthdayAlerts} />
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function DashboardRetentionCases({
  cases,
  locale,
  boxName,
  labels,
  advancedEnabled,
  loadError,
}: {
  cases: AttentionCase[];
  locale: string;
  boxName: string;
  labels: {
    title: string;
    levelHigh: string;
    levelMedium: string;
    levelLow: string;
    openProfile: string;
    lastAttendance: string;
    membership: string;
    membershipStatuses: Record<string, string>;
    loadError: string;
    empty: string;
  };
  advancedEnabled: boolean;
  loadError?: boolean;
}) {
  if (!advancedEnabled) return null;

  if (loadError) {
    return (
      <section className="rounded-2xl bg-white/[0.02] ring-1 ring-white/10 p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">{labels.loadError}</p>
      </section>
    );
  }

  if (cases.length === 0) return null;

  return (
    <section className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {labels.title}
      </p>
      <div className="space-y-2">
        {cases.map((item) => (
          <AttentionCaseCard
            key={item.profileId}
            item={item}
            locale={locale}
            boxName={boxName}
            labels={labels}
          />
        ))}
      </div>
    </section>
  );
}

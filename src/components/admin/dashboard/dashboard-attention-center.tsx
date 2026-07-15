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
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0",
        level === "high" && "bg-red-500/20 text-red-400",
        level === "medium" && "bg-orange-500/20 text-orange-400",
        level === "low" && "bg-white/10 text-muted-foreground"
      )}
    >
      {text}
    </span>
  );
}

/** Dense one-line row — designed for boxes with dozens/hundreds of athletes. */
function AttentionCaseRow({
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
  };
}) {
  const tReasons = useTranslations("adminDashboard.attention.reasons");
  const primaryReason = item.reasons.find((r) => r !== "new_athlete");

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-black/20 border border-white/10 px-2.5 py-2 min-h-14">
      <Avatar className="h-9 w-9 shrink-0">
        {item.fotoUrl ? <AvatarImage src={item.fotoUrl} alt="" /> : null}
        <AvatarFallback className="text-xs">{initials(item.nombre)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/admin/usuarios/${item.profileId}`}
            className="font-semibold text-sm truncate hover:underline"
          >
            {item.nombre}
          </Link>
          <PriorityBadge level={item.level} labels={labels} />
        </div>
        {primaryReason ? (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {tReasons(primaryReason as never)}
            {item.daysSinceAttendance != null
              ? ` · ${item.daysSinceAttendance}d`
              : ""}
          </p>
        ) : null}
      </div>
      <WhatsAppReminderButton
        phone={item.telefono}
        nombre={item.nombre}
        fechaFin={item.fechaFin}
        locale={locale}
        type={item.whatsappType}
        boxName={boxName}
        compact
      />
      <Link
        href={`/admin/usuarios/${item.profileId}`}
        className="hidden sm:inline-flex min-h-11 items-center text-xs font-medium text-orange-400 hover:text-orange-300 shrink-0 px-1"
      >
        {labels.openProfile}
      </Link>
    </div>
  );
}

function MoreLink({
  href,
  text,
}: {
  href: string;
  text: string | null;
}) {
  if (!text) return null;
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-dashed border-white/15 px-3 text-sm text-muted-foreground hover:border-orange-500/30 hover:text-orange-300 transition-colors"
    >
      <span>{text}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0" />
    </Link>
  );
}

export function DashboardAttentionCenter({
  cases,
  casesTotal,
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
  /** Full unique count before preview cap (large boxes). */
  casesTotal?: number;
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
  const tAttention = useTranslations("adminDashboard.attention");
  const total = casesTotal ?? cases.length;
  const remaining = Math.max(0, total - cases.length);
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
    <section className="rounded-2xl bg-white/[0.02] border border-white/10 p-4 sm:p-5 space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold">{labels.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {labels.subtitle}
            {total > 0 ? (
              <span className="tabular-nums"> · {total}</span>
            ) : null}
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
            <div className="rounded-xl px-3 py-3 sm:px-4 bg-red-500/[0.04] border border-red-500/15 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-500/20 text-red-400">
                {labels.priorityHigh}
              </span>
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
                  {fullClasses.slice(0, 3).map((c) => (
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
            <div className="rounded-xl px-3 py-3 sm:px-4 bg-orange-500/[0.04] border border-orange-500/15 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500/20 text-orange-400">
                {labels.priorityMedium}
              </span>
              <p className="text-xs font-semibold text-orange-400/90">
                {labels.lowOccupancy}
              </p>
              {lowOccupancyClasses.slice(0, 3).map((c) => (
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
            <div className="space-y-1.5">
              {cases.map((item) => (
                <AttentionCaseRow
                  key={item.profileId}
                  item={item}
                  locale={locale}
                  boxName={boxName}
                  labels={labels}
                />
              ))}
              <MoreLink
                href={USUARIOS_DEEP_LINKS.needsAttention}
                text={
                  remaining > 0
                    ? tAttention("moreAthletes", { count: remaining, total })
                    : null
                }
              />
            </div>
          ) : null}

          {hasBirthdays ? (
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-muted-foreground">
                {labels.priorityInfo}
              </span>
              <BirthdayInfoCard alerts={birthdayAlerts.slice(0, 3)} />
              {birthdayAlerts.length > 3 ? (
                <p className="text-xs text-muted-foreground tabular-nums">
                  +{birthdayAlerts.length - 3}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function DashboardRetentionCases({
  cases,
  casesTotal,
  locale,
  boxName,
  labels,
  advancedEnabled,
  loadError,
}: {
  cases: AttentionCase[];
  casesTotal?: number;
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
    seeInbox: string;
  };
  advancedEnabled: boolean;
  loadError?: boolean;
}) {
  const tAttention = useTranslations("adminDashboard.attention");

  if (!advancedEnabled) return null;

  if (loadError) {
    return (
      <section className="rounded-2xl bg-white/[0.02] border border-white/10 p-4 sm:p-5">
        <p className="text-sm text-muted-foreground">{labels.loadError}</p>
      </section>
    );
  }

  if (cases.length === 0) return null;

  const total = casesTotal ?? cases.length;
  const remaining = Math.max(0, total - cases.length);

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {labels.title}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {total}
          </p>
        </div>
        <Link
          href={USUARIOS_DEEP_LINKS.inactive}
          className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300 shrink-0"
        >
          {labels.seeInbox}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-1.5">
        {cases.map((item) => (
          <AttentionCaseRow
            key={item.profileId}
            item={item}
            locale={locale}
            boxName={boxName}
            labels={labels}
          />
        ))}
        <MoreLink
          href={USUARIOS_DEEP_LINKS.inactive}
          text={
            remaining > 0
              ? tAttention("moreAthletes", { count: remaining, total })
              : null
          }
        />
      </div>
    </section>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDisplayDate } from "@/lib/dates/format-display";
import { createDownloadGuard } from "@/lib/reporte-semanal/download-guard";
import {
  isReportRangeSelectable,
  MAX_REPORT_RANGE_DAYS,
  validateReportDateRange,
} from "@/lib/reporte-semanal/period-range";

type Labels = {
  title: string;
  description: string;
  fromLabel: string;
  toLabel: string;
  download: string;
  downloading: string;
  error: string;
  emptyHint: string;
  periodInvalid: string;
  rangeTooLong: string;
  rangeInverted: string;
  rangeFuture: string;
};

export function DashboardWeeklyReportCard({
  defaultFrom,
  defaultTo,
  maxDate,
  timeZone,
  labels,
}: {
  defaultFrom: string;
  defaultTo: string;
  maxDate: string;
  timeZone: string;
  labels: Labels;
}) {
  const guardRef = useRef(createDownloadGuard());
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validation = useMemo(
    () => validateReportDateRange(timeZone, from, to),
    [timeZone, from, to]
  );

  const canDownload = validation.ok && !loading;

  const validationMessage = useMemo(() => {
    if (validation.ok) return null;
    switch (validation.error) {
      case "too_long":
        return labels.rangeTooLong.replace(
          "{max}",
          String(MAX_REPORT_RANGE_DAYS)
        );
      case "inverted":
        return labels.rangeInverted;
      case "future":
        return labels.rangeFuture;
      default:
        return labels.periodInvalid;
    }
  }, [validation, labels]);

  async function handleDownload() {
    if (!guardRef.current.tryStart()) return;
    if (!isReportRangeSelectable(timeZone, from, to)) {
      setError(validationMessage ?? labels.periodInvalid);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/reporte-semanal?${params}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        if (body?.error === "PERIOD_INVALID") {
          if (body.code === "too_long") {
            throw new Error(
              labels.rangeTooLong.replace(
                "{max}",
                String(MAX_REPORT_RANGE_DAYS)
              )
            );
          }
          if (body.code === "inverted") throw new Error(labels.rangeInverted);
          if (body.code === "future") throw new Error(labels.rangeFuture);
          throw new Error(labels.periodInvalid);
        }
        throw new Error(labels.error);
      }

      const contentType = res.headers.get("Content-Type") ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error(labels.error);
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error(labels.emptyHint);
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "athron-reporte-ejecutivo.pdf";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : labels.error);
    } finally {
      setLoading(false);
      guardRef.current.finish();
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-4 sm:px-5 sm:py-5">
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-orange-400/90" />
            <h2 className="text-sm font-black tracking-tight">{labels.title}</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
            {labels.description}
          </p>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 max-w-xl">
            <div className="space-y-1.5">
              <label
                htmlFor="report-from"
                className="text-[11px] font-medium text-muted-foreground"
              >
                {labels.fromLabel}
              </label>
              <Input
                id="report-from"
                type="date"
                value={from}
                max={maxDate}
                onChange={(e) => setFrom(e.target.value)}
                disabled={loading}
                className="bg-black/20 border-white/10 [color-scheme:dark]"
              />
              {from && (
                <p className="text-[11px] text-foreground/80">
                  {formatDisplayDate(from, "es")}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="report-to"
                className="text-[11px] font-medium text-muted-foreground"
              >
                {labels.toLabel}
              </label>
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from || undefined}
                max={maxDate}
                onChange={(e) => setTo(e.target.value)}
                disabled={loading}
                className="bg-black/20 border-white/10 [color-scheme:dark]"
              />
              {to && (
                <p className="text-[11px] text-foreground/80">
                  {formatDisplayDate(to, "es")}
                </p>
              )}
            </div>
          </div>

          <Button
            type="button"
            onClick={handleDownload}
            disabled={!canDownload}
            className="shrink-0 w-full lg:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {labels.downloading}
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                {labels.download}
              </>
            )}
          </Button>
        </div>

        {(validationMessage || error) && (
          <p className="text-xs text-orange-300/95" role="alert">
            {error ?? validationMessage}
          </p>
        )}
      </div>
    </section>
  );
}

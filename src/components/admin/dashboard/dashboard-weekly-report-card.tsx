"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDownloadGuard } from "@/lib/reporte-semanal/download-guard";

export type WeekOptionProp = {
  from: string;
  to: string;
  label: string;
  isCurrent: boolean;
};

type Labels = {
  title: string;
  description: string;
  periodLabel: string;
  selectPeriod: string;
  thisWeekSuffix: string;
  download: string;
  downloading: string;
  error: string;
  emptyHint: string;
  periodInvalid: string;
};

export function DashboardWeeklyReportCard({
  weeks,
  labels,
}: {
  weeks: WeekOptionProp[];
  labels: Labels;
}) {
  const guardRef = useRef(createDownloadGuard());
  const defaultFrom = weeks[0]?.from ?? "";
  const [selectedFrom, setSelectedFrom] = useState(defaultFrom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => weeks.find((w) => w.from === selectedFrom) ?? weeks[0],
    [weeks, selectedFrom]
  );

  async function handleDownload() {
    if (!guardRef.current.tryStart()) return;
    if (!selectedFrom) {
      setError(labels.periodInvalid);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ from: selectedFrom });
      const res = await fetch(`/api/admin/reporte-semanal?${params}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        if (body?.error === "PERIOD_INVALID") {
          throw new Error(labels.periodInvalid);
        }
        throw new Error(body?.error || labels.error);
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
      const filename = match?.[1] ?? "athron-reporte-semanal.pdf";

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
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3 flex-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-orange-400/90" />
              <h2 className="text-sm font-black tracking-tight">
                {labels.title}
              </h2>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              {labels.description}
            </p>
          </div>

          <div className="space-y-1.5 max-w-md">
            <label
              htmlFor="weekly-report-period"
              className="text-[11px] font-medium text-muted-foreground"
            >
              {labels.selectPeriod}
            </label>
            <Select
              value={selectedFrom}
              onValueChange={setSelectedFrom}
              disabled={loading || weeks.length === 0}
            >
              <SelectTrigger
                id="weekly-report-period"
                className="w-full bg-black/20 border-white/10"
              >
                <SelectValue placeholder={labels.selectPeriod} />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w.from} value={w.from}>
                    {w.label}
                    {w.isCurrent ? ` ${labels.thisWeekSuffix}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <p className="text-[11px] text-muted-foreground/90">
                {labels.periodLabel}:{" "}
                <span className="text-foreground/90 font-medium">
                  {selected.label}
                </span>
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          onClick={handleDownload}
          disabled={loading || !selectedFrom}
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

      {error && (
        <p className="mt-3 text-xs text-orange-300/95" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

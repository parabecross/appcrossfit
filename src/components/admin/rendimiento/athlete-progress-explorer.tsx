"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPrValue } from "@/lib/progreso/helpers";
import { cn } from "@/lib/utils";
import type { AthleteProgressOverviewRow } from "@/lib/queries/athlete-progress-overview";
import type { PrUnidad } from "@/types/database";

const PAGE_SIZE = 20;

type FilterId = "all" | "active" | "prs" | "skills" | "consistent";
type SortId = "name" | "frequency" | "recentPr" | "recentSkill";

function matchesFilter(row: AthleteProgressOverviewRow, filter: FilterId) {
  switch (filter) {
    case "active":
      return (row.frequency ?? 0) > 0;
    case "prs":
      return row.latestPr !== null;
    case "skills":
      return row.latestSkill !== null;
    case "consistent":
      return (row.frequency ?? 0) >= 2;
    default:
      return true;
  }
}

function sortRows(rows: AthleteProgressOverviewRow[], sort: SortId) {
  const copy = [...rows];
  switch (sort) {
    case "frequency":
      return copy.sort(
        (a, b) => (b.frequency ?? -1) - (a.frequency ?? -1)
      );
    case "recentPr":
      return copy.sort((a, b) => {
        const da = a.latestPr?.fecha ?? "";
        const db = b.latestPr?.fecha ?? "";
        return db.localeCompare(da);
      });
    case "recentSkill":
      return copy.sort((a, b) => {
        const da = a.latestSkill?.at ?? "";
        const db = b.latestSkill?.at ?? "";
        return db.localeCompare(da);
      });
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }
}

export function AthleteProgressExplorer({
  athletes,
  labels,
}: {
  athletes: AthleteProgressOverviewRow[];
  labels: {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    filterAll: string;
    filterActive: string;
    filterWithPr: string;
    filterWithSkill: string;
    filterConsistent: string;
    sortLabel: string;
    sortName: string;
    sortFrequency: string;
    sortRecentPr: string;
    sortRecentSkill: string;
    columnAthlete: string;
    columnFrequency: string;
    columnLatestPr: string;
    columnLatestSkill: string;
    viewProfile: string;
    noResults: string;
    empty: string;
    perWeek: string;
  };
}) {
  const tp = useTranslations("progress");
  const td = useTranslations("adminDashboard.athleteProgress");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("name");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = athletes.filter((a) => matchesFilter(a, filter));
    if (q) {
      rows = rows.filter((a) => a.name.toLowerCase().includes(q));
    }
    return sortRows(rows, sort);
  }, [athletes, filter, search, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const filters: { id: FilterId; label: string }[] = [
    { id: "all", label: labels.filterAll },
    { id: "active", label: labels.filterActive },
    { id: "prs", label: labels.filterWithPr },
    { id: "skills", label: labels.filterWithSkill },
    { id: "consistent", label: labels.filterConsistent },
  ];

  const activeCount = athletes.filter((a) => (a.frequency ?? 0) > 0).length;
  const prCount = athletes.filter((a) => a.latestPr).length;
  const skillCount = athletes.filter((a) => a.latestSkill).length;

  if (athletes.length === 0) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6">
        <p className="text-sm font-bold">{labels.title}</p>
        <p className="text-sm text-muted-foreground mt-4">{labels.empty}</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold">{labels.title}</p>
          <p className="text-xs text-muted-foreground mt-1">{labels.subtitle}</p>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums shrink-0">
          {td("resultsSummary", {
            total: athletes.length,
            active: activeCount,
            prs: prCount,
            skills: skillCount,
          })}
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={labels.searchPlaceholder}
            className="pl-9 bg-black/30 border-white/10"
          />
        </div>
        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v as SortId);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full lg:w-52 bg-black/30 border-white/10">
            <SelectValue placeholder={labels.sortLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{labels.sortName}</SelectItem>
            <SelectItem value="frequency">{labels.sortFrequency}</SelectItem>
            <SelectItem value="recentPr">{labels.sortRecentPr}</SelectItem>
            <SelectItem value="recentSkill">{labels.sortRecentSkill}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setFilter(id);
              setPage(0);
            }}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
              filter === id
                ? "bg-orange-500/15 text-orange-300 border border-orange-500/30"
                : "bg-black/30 text-muted-foreground hover:text-foreground border border-white/5"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          {labels.noResults}
        </p>
      ) : (
        <>
          <div className="hidden md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>{labels.columnAthlete}</span>
            <span>{labels.columnFrequency}</span>
            <span>{labels.columnLatestPr}</span>
            <span>{labels.columnLatestSkill}</span>
            <span className="sr-only">{labels.viewProfile}</span>
          </div>

          <ul className="space-y-2">
            {pageRows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/usuarios/${row.id}`}
                  className="group flex flex-col gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-3 transition-colors hover:border-orange-500/25 hover:bg-orange-500/[0.03] md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center md:gap-3 md:py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-orange-200 transition-colors">
                      {row.name}
                    </p>
                  </div>

                  <div className="md:text-sm">
                    {row.frequency != null && row.frequency > 0 ? (
                      <span className="text-xs md:text-sm tabular-nums text-muted-foreground">
                        {row.frequency} {labels.perWeek}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="min-w-0 md:hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {labels.columnLatestPr}
                  </div>
                  <div className="min-w-0">
                    {row.latestPr ? (
                      <p className="text-xs text-orange-300 truncate">
                        {tp(`exercises.${row.latestPr.ejercicio}`)} ·{" "}
                        {formatPrValue(
                          row.latestPr.valor,
                          row.latestPr.unidad as PrUnidad
                        )}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <div className="min-w-0 md:hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {labels.columnLatestSkill}
                  </div>
                  <div className="min-w-0">
                    {row.latestSkill ? (
                      <p className="text-xs text-orange-300 truncate">
                        {tp(`skills.${row.latestSkill.skill}`)}
                      </p>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 md:opacity-100">
                    {labels.viewProfile}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground tabular-nums">
                {td("pageOf", {
                  current: safePage + 1,
                  total: totalPages,
                })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-muted-foreground hover:text-foreground disabled:opacity-40"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

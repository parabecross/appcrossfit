"use client";

import { useTranslations } from "next-intl";
import { LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

export type AdminClassesViewMode = "cards" | "list";

export function AdminClassesToolbar({
  search,
  onSearchChange,
  coachFilter,
  onCoachFilterChange,
  viewMode,
  onViewModeChange,
  coaches,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  coachFilter: string;
  onCoachFilterChange: (value: string) => void;
  viewMode: AdminClassesViewMode;
  onViewModeChange: (mode: AdminClassesViewMode) => void;
  coaches: Profile[];
}) {
  const t = useTranslations("classes");
  const coachLabel =
    coachFilter === "all"
      ? t("adminFilterCoaches")
      : (coaches.find((c) => c.id === coachFilter)?.nombre_completo ??
        t("adminFilterCoaches"));

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("adminSearchPlaceholder")}
            className="pl-9 h-9 bg-white/[0.03] border-white/10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={coachFilter} onValueChange={onCoachFilterChange}>
            <SelectTrigger className="w-[120px] h-9 bg-white/[0.03] border-white/10">
              <span className="truncate">{coachLabel}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("adminFilterAll")}</SelectItem>
              {coaches.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nombre_completo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-white/10 bg-black/20 p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange("cards")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "cards"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {t("adminViewCards")}
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "list"
                  ? "bg-white/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
              {t("adminViewList")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

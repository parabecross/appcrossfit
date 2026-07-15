"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMonthKeyLabelTitle } from "@/lib/ranking/month";

export function RankingMonthSelector({
  monthKey,
  currentMonthKey,
  availableMonths,
  locale,
  onChange,
}: {
  monthKey: string;
  currentMonthKey: string;
  availableMonths: string[];
  locale: string;
  onChange: (monthKey: string) => void;
}) {
  const t = useTranslations("rankingAthron");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = formatMonthKeyLabelTitle(monthKey, locale);

  return (
    <div ref={rootRef} className="relative inline-flex justify-center">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2",
          "bg-white/[0.04] border border-white/15 text-sm font-semibold",
          "hover:border-orange-500/40 hover:bg-white/[0.06] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <ul
          role="listbox"
          className="absolute z-30 top-full mt-2 w-[min(18rem,calc(100vw-2rem))] max-h-72 overflow-y-auto rounded-2xl border border-white/15 bg-card shadow-xl shadow-black/40 py-1"
        >
          {availableMonths.map((key) => {
            const isCurrent = key === currentMonthKey;
            const selected = key === monthKey;
            return (
              <li key={key} role="option" aria-selected={selected}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors",
                    selected
                      ? "bg-orange-500/15 text-orange-200"
                      : "text-foreground hover:bg-white/[0.05]"
                  )}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  <span className="font-medium">
                    {formatMonthKeyLabelTitle(key, locale)}
                  </span>
                  {isCurrent ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                      {t("monthCurrentShort")}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SocioClassPeriodSection({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden md:rounded-2xl md:border-white/10">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-white/[0.02] transition-colors md:px-4 md:py-3.5"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">
            {title}
            <span className="font-normal text-muted-foreground"> · {subtitle}</span>
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="border-t border-white/5 px-3 pb-3 pt-3">{children}</div>
      )}
    </section>
  );
}

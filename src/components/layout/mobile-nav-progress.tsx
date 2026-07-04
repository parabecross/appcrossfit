"use client";

import { cn } from "@/lib/utils";

/** Indeterminate top bar shown while a mobile tab navigation is in flight. */
export function MobileNavProgress({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[100] h-0.5 overflow-hidden md:hidden"
      role="progressbar"
      aria-label="Cargando"
    >
      <div className="relative h-full w-full bg-primary/15">
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1/3 bg-primary mobile-nav-progress-bar"
          )}
        />
      </div>
    </div>
  );
}

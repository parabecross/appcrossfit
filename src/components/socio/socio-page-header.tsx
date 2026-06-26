import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function SocioPageHeader({
  title,
  subtitle,
  badge,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black brand-text leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {badge}
      </div>
    </div>
  );
}

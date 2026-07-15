"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function AthleteHomeHeader({
  greeting,
  firstName,
  boxName,
  contextLine,
  hasTrainingToday,
  fotoUrl,
  fullName,
}: {
  greeting: string;
  firstName: string;
  boxName: string;
  contextLine: string;
  hasTrainingToday: boolean;
  fotoUrl: string | null;
  fullName: string;
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <p className="text-xs text-muted-foreground truncate">{boxName}</p>
        <h1 className="text-2xl font-bold tracking-tight leading-tight md:text-3xl truncate">
          {greeting} {firstName}
        </h1>
        <p
          className={cn(
            "text-sm font-medium",
            hasTrainingToday ? "text-foreground/90" : "text-muted-foreground"
          )}
        >
          {contextLine}
        </p>
      </div>
      <Avatar className="h-12 w-12 shrink-0 ring-1 ring-white/10">
        {fotoUrl ? <AvatarImage src={fotoUrl} alt="" /> : null}
        <AvatarFallback className="text-sm font-semibold">
          {initials(fullName)}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}

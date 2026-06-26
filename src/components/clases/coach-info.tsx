"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { User } from "lucide-react";

interface CoachInfoProps {
  nombre: string;
  fotoUrl?: string | null;
  bio?: string | null;
}

export function CoachInfo({ nombre, fotoUrl, bio }: CoachInfoProps) {
  const t = useTranslations("classes");

  return (
    <div className="flex gap-3 items-start rounded-lg border border-white/5 bg-secondary/20 p-3">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-secondary/50">
        {fotoUrl ? (
          <Image
            src={fotoUrl}
            alt={nombre}
            fill
            className="object-cover"
            sizes="48px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">
          {t("yourCoach")}
        </p>
        <p className="font-semibold">{nombre}</p>
        {bio ? (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{bio}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-1 italic">
            {t("coachNoBio")}
          </p>
        )}
      </div>
    </div>
  );
}

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
    <div className="flex gap-3 items-start rounded-2xl border border-white/5 bg-secondary/20 p-3.5 mt-2">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border-2 border-primary/20 bg-secondary/50">
        {fotoUrl ? (
          <Image
            src={fotoUrl}
            alt={nombre}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
          {t("yourCoach")}
        </p>
        <p className="font-bold text-base leading-tight mt-0.5">{nombre}</p>
        {bio ? (
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
            {bio}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-1 italic">
            {t("coachNoBio")}
          </p>
        )}
      </div>
    </div>
  );
}

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTranslations } from "next-intl/server";

function initials(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export async function AthleteProfileSummary({
  nombre,
  fotoUrl,
  boxName,
  attendances,
  prCount,
  skillCount,
  rank,
  membershipLabel,
}: {
  nombre: string;
  fotoUrl: string | null;
  boxName: string;
  attendances: number;
  prCount: number;
  skillCount: number;
  rank: number | null;
  membershipLabel: string;
}) {
  const t = await getTranslations("socioHome.profileSummary");

  const stats = [
    { label: t("attendances"), value: String(attendances) },
    { label: t("prs"), value: String(prCount) },
    { label: t("skills"), value: String(skillCount) },
    {
      label: t("rank"),
      value: rank != null ? `#${rank}` : t("noRank"),
    },
  ];

  return (
    <section className="rounded-2xl bg-white/[0.03] ring-1 ring-white/10 px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14 ring-1 ring-white/10">
          {fotoUrl ? <AvatarImage src={fotoUrl} alt="" /> : null}
          <AvatarFallback className="text-base font-semibold">
            {initials(nombre)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-lg font-bold truncate">{nombre}</p>
          <p className="text-sm text-muted-foreground truncate">{boxName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("membership")}: {membershipLabel}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-base font-bold tabular-nums leading-none">
              {s.value}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

import { forwardRef } from "react";
import type { AthleteCardData, LegacyCardFormat } from "@/lib/legacy/types";
import { getInitials } from "@/lib/legacy/build-athlete-card";
import {
  CardBrandingFooter,
  CardExportShell,
} from "@/components/legacy/cards/card-export-shell";

interface AthleteCardProps {
  data: AthleteCardData;
  format: LegacyCardFormat;
  previewScale?: number;
  labels: {
    legacy: string;
    levelLabel: string;
    level: Record<string, string>;
    years: string;
    yearsUnit: string;
    age: string;
    ageUnit: string;
    height: string;
    heightUnit: string;
    weight: string;
    weightUnit: string;
    goal: string;
    poweredBy: string;
  };
}

const PHOTO_FILTER =
  "brightness(1.28) contrast(1.12) saturate(1.15)";

function StatPill({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-xl border border-white/25 bg-white/[0.14] px-3 py-2.5 shadow-sm backdrop-blur-md">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
        {label}
      </p>
      <p
        className="mt-0.5 text-base font-black tabular-nums leading-none"
        style={{ color: accentColor }}
      >
        {value}
      </p>
    </div>
  );
}

export const AthleteCard = forwardRef<HTMLDivElement, AthleteCardProps>(
  function AthleteCard({ data, format, previewScale, labels }, ref) {
    const isSquare = format === "square";

    const stats: { label: string; value: string }[] = [];

    if (data.level) {
      stats.push({
        label: labels.levelLabel,
        value: labels.level[data.level] ?? data.level,
      });
    }
    if (data.age !== null) {
      stats.push({
        label: labels.age,
        value: `${data.age} ${labels.ageUnit}`,
      });
    }
    if (data.heightCm !== null) {
      stats.push({
        label: labels.height,
        value: `${data.heightCm} ${labels.heightUnit}`,
      });
    }
    if (data.weightKg !== null) {
      stats.push({
        label: labels.weight,
        value: `${Math.round(data.weightKg)} ${labels.weightUnit}`,
      });
    }
    if (data.yearsTraining !== null) {
      stats.push({
        label: labels.years,
        value: `${data.yearsTraining} ${labels.yearsUnit}`,
      });
    }

    const visibleStats = stats.slice(0, isSquare ? 4 : 6);

    return (
      <div ref={ref}>
        <CardExportShell
          format={format}
          accentColor={data.accentColor}
          previewScale={previewScale}
        >
          <div className="relative h-full overflow-hidden">
            {/* Foto a pantalla completa */}
            <div className="absolute inset-0">
              {data.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.photoUrl}
                  alt=""
                  crossOrigin="anonymous"
                  className="h-full w-full object-cover object-[center_22%]"
                  style={{ filter: PHOTO_FILTER }}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{
                    background: `linear-gradient(160deg, ${data.accentColor}66 0%, #2a2a2a 55%, #1f1f1f 100%)`,
                  }}
                >
                  <span className="text-8xl font-black text-white/30">
                    {getInitials(data.name)}
                  </span>
                </div>
              )}

              {/* Degradado suave solo en la zona inferior para legibilidad */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(32,32,34,0.97) 0%, rgba(32,32,34,0.82) 18%, rgba(20,20,22,0.45) 42%, rgba(0,0,0,0.08) 68%, transparent 100%)",
                }}
              />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse 90% 60% at 50% 0%, ${data.accentColor}22, transparent 70%)`,
                }}
              />
            </div>

            <p
              className="absolute left-8 top-8 z-10 text-[11px] font-bold uppercase tracking-[0.2em] drop-shadow-md"
              style={{ color: data.accentColor }}
            >
              {labels.legacy}
            </p>

            {/* Contenido pegado al atleta, en la parte baja de la foto */}
            <div className="relative z-10 flex h-full flex-col justify-end px-8 pb-7 pt-24">
              <div>
                <h2 className="text-[clamp(2rem,5vw,3rem)] font-black uppercase leading-[0.95] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
                  {data.name}
                </h2>
                {data.discipline && (
                  <p className="mt-1.5 text-sm font-semibold uppercase tracking-[0.18em] text-white/90 drop-shadow-md">
                    {data.discipline}
                  </p>
                )}
                <p className="mt-2 max-w-md text-base font-medium italic leading-snug text-white/95 drop-shadow-md">
                  &ldquo;{data.tagline}&rdquo;
                </p>
              </div>

              {visibleStats.length > 0 && (
                <div
                  className={`mt-4 grid gap-2.5 ${
                    isSquare ? "grid-cols-2" : "grid-cols-3"
                  }`}
                >
                  {visibleStats.map((s) => (
                    <StatPill
                      key={s.label}
                      label={s.label}
                      value={s.value}
                      accentColor={data.accentColor}
                    />
                  ))}
                </div>
              )}

              {data.goal && (
                <div className="mt-3 rounded-xl border border-white/20 bg-white/[0.12] px-4 py-3 backdrop-blur-md">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
                    {labels.goal}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {data.goal}
                  </p>
                </div>
              )}

              <div className="mt-4">
                <CardBrandingFooter
                  boxName={data.boxName}
                  boxLogoUrl={data.boxLogoUrl}
                  poweredByLabel={labels.poweredBy}
                  accentColor={data.accentColor}
                />
              </div>
            </div>
          </div>
        </CardExportShell>
      </div>
    );
  }
);

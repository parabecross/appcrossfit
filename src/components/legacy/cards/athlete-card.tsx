import { forwardRef } from "react";
import type { AthleteCardData, LegacyCardFormat } from "@/lib/legacy/types";
import { getInitials } from "@/lib/legacy/build-athlete-card";
import {
  CARD_TYPO,
  CardBrandingFooter,
  CardExportShell,
} from "@/components/legacy/cards/card-export-shell";

interface AthleteCardProps {
  data: AthleteCardData;
  format: LegacyCardFormat;
  previewScale?: number;
  labels: {
    legacy: string;
    byAthron: string;
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
  };
}

/** Foto un poco más oscura para que el texto destaque */
const PHOTO_FILTER = "brightness(0.9) contrast(1.1) saturate(1.05)";

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
    <div
      className="rounded-2xl border border-white/30 bg-black/45 backdrop-blur-md"
      style={{ padding: "18px 20px" }}
    >
      <p
        className="font-bold uppercase text-white/75"
        style={{
          fontSize: CARD_TYPO.statLabel,
          letterSpacing: "0.14em",
          lineHeight: 1.1,
        }}
      >
        {label}
      </p>
      <p
        className="font-black tabular-nums"
        style={{
          fontSize: CARD_TYPO.statValue,
          color: accentColor,
          marginTop: 6,
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

export const AthleteCard = forwardRef<HTMLDivElement, AthleteCardProps>(
  function AthleteCard({ data, format, previewScale, labels }, ref) {
    const isSquare = format === "square";
    const pad = CARD_TYPO.pad;

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
      <CardExportShell
        ref={ref}
        format={format}
        accentColor={data.accentColor}
        previewScale={previewScale}
      >
        <div className="relative h-full overflow-hidden">
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
                  background: `linear-gradient(160deg, ${data.accentColor}55 0%, #2a2a2a 55%, #1f1f1f 100%)`,
                }}
              >
                <span
                  className="font-black text-white/30"
                  style={{ fontSize: 120 }}
                >
                  {getInitials(data.name)}
                </span>
              </div>
            )}

            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(18,18,20,0.98) 0%, rgba(18,18,20,0.88) 22%, rgba(12,12,14,0.55) 48%, rgba(0,0,0,0.35) 72%, rgba(0,0,0,0.15) 100%)",
              }}
            />
          </div>

          {/* LEGACY + by ATHRON arriba */}
          <div
            className="absolute z-10"
            style={{ top: pad, left: pad, right: pad }}
          >
            <p
              className="font-black uppercase"
              style={{
                fontSize: CARD_TYPO.legacy,
                letterSpacing: "0.22em",
                color: data.accentColor,
                lineHeight: 1,
                textShadow: "0 2px 16px rgba(0,0,0,0.6)",
              }}
            >
              {labels.legacy}
            </p>
            <p
              className="font-semibold uppercase text-white/80"
              style={{
                fontSize: CARD_TYPO.byAthron,
                letterSpacing: "0.16em",
                marginTop: 10,
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
              }}
            >
              {labels.byAthron}
            </p>
          </div>

          <div
            className="relative z-10 flex h-full flex-col justify-end"
            style={{
              paddingLeft: pad,
              paddingRight: pad,
              paddingBottom: pad,
              paddingTop: pad * 2,
            }}
          >
            <div>
              <h2
                className="font-black uppercase text-white"
                style={{
                  fontSize: CARD_TYPO.name,
                  lineHeight: 0.92,
                  letterSpacing: "-0.02em",
                  textShadow: "0 4px 24px rgba(0,0,0,0.65)",
                }}
              >
                {data.name}
              </h2>
              {data.discipline && (
                <p
                  className="font-bold uppercase text-white/90"
                  style={{
                    fontSize: CARD_TYPO.discipline,
                    letterSpacing: "0.14em",
                    marginTop: 12,
                    textShadow: "0 2px 16px rgba(0,0,0,0.55)",
                  }}
                >
                  {data.discipline}
                </p>
              )}
              <p
                className="font-medium italic text-white/95"
                style={{
                  fontSize: CARD_TYPO.tagline,
                  lineHeight: 1.25,
                  marginTop: 16,
                  maxWidth: "90%",
                  textShadow: "0 2px 14px rgba(0,0,0,0.55)",
                }}
              >
                &ldquo;{data.tagline}&rdquo;
              </p>
            </div>

            {visibleStats.length > 0 && (
              <div
                className={`grid ${isSquare ? "grid-cols-2" : "grid-cols-3"}`}
                style={{
                  gap: CARD_TYPO.gap,
                  marginTop: CARD_TYPO.gap + 4,
                }}
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
              <div
                className="rounded-2xl border border-white/25 bg-black/40 backdrop-blur-md"
                style={{
                  marginTop: CARD_TYPO.gap,
                  padding: "20px 24px",
                }}
              >
                <p
                  className="font-bold uppercase text-white/70"
                  style={{
                    fontSize: CARD_TYPO.goalLabel,
                    letterSpacing: "0.14em",
                  }}
                >
                  {labels.goal}
                </p>
                <p
                  className="font-semibold text-white"
                  style={{
                    fontSize: CARD_TYPO.goalValue,
                    marginTop: 8,
                    lineHeight: 1.2,
                  }}
                >
                  {data.goal}
                </p>
              </div>
            )}

            <div style={{ marginTop: CARD_TYPO.gap }}>
              <CardBrandingFooter
                boxName={data.boxName}
                boxLogoUrl={data.boxLogoUrl}
                accentColor={data.accentColor}
              />
            </div>
          </div>
        </div>
      </CardExportShell>
    );
  }
);

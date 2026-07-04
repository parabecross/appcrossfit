import { forwardRef } from "react";
import type { AthleteCardData, LegacyCardFormat } from "@/lib/legacy/types";
import { getInitials } from "@/lib/legacy/build-athlete-card";
import { isLocalAvatarUrl } from "@/lib/avatars/placeholder";
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
    athleteCard: string;
    byAthron: string;
    poweredBy: string;
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

const PHOTO_FILTER = "brightness(0.88) contrast(1.05) saturate(0.95)";

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p
        className="uppercase text-white/45"
        style={{
          fontSize: CARD_TYPO.statLabel,
          letterSpacing: "0.18em",
          lineHeight: 1.2,
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p
        className="text-white/95 tabular-nums"
        style={{
          fontSize: CARD_TYPO.statValue,
          fontWeight: 600,
          marginTop: 6,
          lineHeight: 1.1,
          letterSpacing: "0.01em",
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
    const accent = data.accentColor;

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
    const statCols = isSquare ? 2 : 3;

    return (
      <CardExportShell
        ref={ref}
        format={format}
        accentColor={accent}
        previewScale={previewScale}
      >
        <div className="relative h-full overflow-hidden">
          <div className="absolute inset-0">
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                data-legacy-photo
                src={data.photoUrl}
                alt=""
                loading="eager"
                decoding="sync"
                fetchPriority="high"
                className="absolute inset-0 h-full w-full object-cover"
                style={{
                  objectPosition: "center 24%",
                  filter: PHOTO_FILTER,
                }}
                {...(!isLocalAvatarUrl(data.photoUrl) &&
                !data.photoUrl.startsWith("data:")
                  ? { crossOrigin: "anonymous" as const }
                  : {})}
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  background: `linear-gradient(165deg, ${accent}33 0%, #1a1a1c 100%)`,
                }}
              >
                <span
                  className="font-light text-white/20"
                  style={{ fontSize: 96, letterSpacing: "0.1em" }}
                >
                  {getInitials(data.name)}
                </span>
              </div>
            )}

            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(14,14,16,0.96) 0%, rgba(14,14,16,0.75) 28%, rgba(8,8,10,0.35) 58%, rgba(0,0,0,0.12) 100%)",
              }}
            />
          </div>

          {/* Header */}
          <div
            className="absolute z-10 flex items-start justify-between gap-4"
            style={{ top: pad, left: pad, right: pad }}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div
                style={{
                  width: 3,
                  height: 48,
                  backgroundColor: accent,
                  borderRadius: 2,
                  opacity: 0.9,
                  flexShrink: 0,
                }}
              />
              <div className="min-w-0">
                <p
                  className="uppercase text-white/90"
                  style={{
                    fontSize: CARD_TYPO.legacy,
                    letterSpacing: "0.28em",
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {labels.legacy}
                </p>
                <p
                  className="uppercase text-white"
                  style={{
                    fontSize: CARD_TYPO.athleteCard,
                    letterSpacing: "0.14em",
                    fontWeight: 700,
                    marginTop: 8,
                    lineHeight: 1,
                  }}
                >
                  {labels.athleteCard}
                </p>
                <p
                  className="uppercase"
                  style={{
                    fontSize: CARD_TYPO.byAthron,
                    letterSpacing: "0.2em",
                    fontWeight: 600,
                    marginTop: 10,
                    color: accent,
                    opacity: 0.95,
                  }}
                >
                  {labels.poweredBy}
                </p>
              </div>
            </div>
            <div
              className="shrink-0 rounded-full border px-3 py-1.5 uppercase font-bold"
              style={{
                fontSize: CARD_TYPO.legacy - 4,
                letterSpacing: "0.22em",
                borderColor: `${accent}66`,
                backgroundColor: `${accent}18`,
                color: accent,
              }}
            >
              ATHRON
            </div>
          </div>

          {/* Content */}
          <div
            className="relative z-10 flex h-full flex-col justify-end"
            style={{
              paddingLeft: pad,
              paddingRight: pad,
              paddingBottom: pad,
            }}
          >
            <div>
              <h2
                className="uppercase text-white"
                style={{
                  fontSize: CARD_TYPO.name,
                  fontWeight: 600,
                  lineHeight: 1,
                  letterSpacing: "0.06em",
                }}
              >
                {data.name}
              </h2>

              <div
                style={{
                  width: 48,
                  height: 2,
                  backgroundColor: accent,
                  marginTop: 16,
                  opacity: 0.85,
                  borderRadius: 1,
                }}
              />

              {data.discipline && (
                <p
                  className="uppercase"
                  style={{
                    fontSize: CARD_TYPO.discipline,
                    letterSpacing: "0.2em",
                    fontWeight: 500,
                    color: accent,
                    marginTop: 14,
                    opacity: 0.95,
                  }}
                >
                  {data.discipline}
                </p>
              )}

              <p
                className="italic text-white/75"
                style={{
                  fontSize: CARD_TYPO.tagline,
                  fontWeight: 400,
                  lineHeight: 1.35,
                  marginTop: 14,
                  maxWidth: "88%",
                }}
              >
                &ldquo;{data.tagline}&rdquo;
              </p>
            </div>

            {(visibleStats.length > 0 || data.goal) && (
              <div
                className="backdrop-blur-sm"
                style={{
                  marginTop: CARD_TYPO.gap + 8,
                  padding: "28px 32px",
                  borderRadius: 20,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {visibleStats.length > 0 && (
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(${statCols}, minmax(0, 1fr))`,
                      gap: "24px 20px",
                    }}
                  >
                    {visibleStats.map((s) => (
                      <StatCell key={s.label} label={s.label} value={s.value} />
                    ))}
                  </div>
                )}

                {data.goal && (
                  <div
                    style={{
                      marginTop: visibleStats.length > 0 ? 24 : 0,
                      paddingTop: visibleStats.length > 0 ? 24 : 0,
                      borderTop:
                        visibleStats.length > 0
                          ? "1px solid rgba(255,255,255,0.08)"
                          : undefined,
                    }}
                  >
                    <p
                      className="uppercase text-white/45"
                      style={{
                        fontSize: CARD_TYPO.goalLabel,
                        letterSpacing: "0.18em",
                        fontWeight: 500,
                      }}
                    >
                      {labels.goal}
                    </p>
                    <p
                      className="text-white/90"
                      style={{
                        fontSize: CARD_TYPO.goalValue,
                        fontWeight: 500,
                        marginTop: 6,
                        lineHeight: 1.3,
                      }}
                    >
                      {data.goal}
                    </p>
                  </div>
                )}
              </div>
            )}

            <CardBrandingFooter
              boxName={data.boxName}
              boxLogoUrl={data.boxLogoUrl}
              accentColor={accent}
            />
          </div>
        </div>
      </CardExportShell>
    );
  }
);

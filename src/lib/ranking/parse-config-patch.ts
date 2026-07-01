import type { RankingConfig } from "@/types/database";

const MAX_POINTS = 10_000;
const MAX_TAGLINE = 500;
const MAX_TABLE_LEN = 50;

type PatchFieldErrors = Record<string, string>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNonNegativeInt(
  value: unknown,
  field: string,
  max: number,
  errors: PatchFieldErrors
): number | undefined {
  if (value === undefined) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    errors[field] = `Must be an integer between 0 and ${max}`;
    return undefined;
  }
  return n;
}

function parseBonusMap(
  value: unknown,
  field: string,
  errors: PatchFieldErrors
): Record<string, number> | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    errors[field] = "Must be an object";
    return undefined;
  }
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > MAX_POINTS) {
      errors[field] = `Invalid value for key "${key}"`;
      return undefined;
    }
    out[key] = n;
  }
  return out;
}

function parsePositionTable(
  value: unknown,
  errors: PatchFieldErrors
): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TABLE_LEN) {
    errors.position_points_table = `Must be a non-empty array (max ${MAX_TABLE_LEN})`;
    return undefined;
  }
  const out: number[] = [];
  for (const raw of value) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > MAX_POINTS) {
      errors.position_points_table = "All entries must be integers between 0 and 10000";
      return undefined;
    }
    out.push(n);
  }
  return out;
}

function parseEvolutionBonuses(
  value: unknown,
  errors: PatchFieldErrors
): RankingConfig["evolution_bonuses"] | undefined {
  if (value === undefined) return undefined;
  if (!isPlainObject(value)) {
    errors.evolution_bonuses = "Must be an object";
    return undefined;
  }
  const keys = ["small", "medium", "large"] as const;
  const out: RankingConfig["evolution_bonuses"] = {
    small: 0,
    medium: 0,
    large: 0,
  };
  for (const key of keys) {
    if (value[key] === undefined) continue;
    const n =
      typeof value[key] === "number" ? value[key] : Number(value[key]);
    if (!Number.isInteger(n) || n < 0 || n > MAX_POINTS) {
      errors.evolution_bonuses = `Invalid ${key} bonus`;
      return undefined;
    }
    out[key] = n;
  }
  return out;
}

export type RankingConfigPatchResult =
  | {
      ok: true;
      patch: Partial<
        Omit<RankingConfig, "box_id" | "updated_at">
      >;
    }
  | { ok: false; errors: PatchFieldErrors };

/** Allowlisted fields only — never spread raw request body into upsert. */
export function parseRankingConfigPatch(
  body: unknown
): RankingConfigPatchResult {
  if (!isPlainObject(body)) {
    return { ok: false, errors: { _body: "Invalid JSON body" } };
  }

  const errors: PatchFieldErrors = {};
  const patch: Partial<Omit<RankingConfig, "box_id" | "updated_at">> = {};

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      errors.enabled = "Must be a boolean";
    } else {
      patch.enabled = body.enabled;
    }
  }

  const attendance = parseNonNegativeInt(
    body.attendance_points,
    "attendance_points",
    MAX_POINTS,
    errors
  );
  if (attendance !== undefined) patch.attendance_points = attendance;

  const floor = parseNonNegativeInt(
    body.position_points_floor,
    "position_points_floor",
    100,
    errors
  );
  if (floor !== undefined) patch.position_points_floor = floor;

  const drop = parseNonNegativeInt(
    body.position_points_linear_drop,
    "position_points_linear_drop",
    50,
    errors
  );
  if (drop !== undefined) patch.position_points_linear_drop = drop;

  const minAtt = parseNonNegativeInt(
    body.min_attendances_to_rank,
    "min_attendances_to_rank",
    100,
    errors
  );
  if (minAtt !== undefined) patch.min_attendances_to_rank = minAtt;

  const minPts = parseNonNegativeInt(
    body.min_points_to_rank,
    "min_points_to_rank",
    MAX_POINTS,
    errors
  );
  if (minPts !== undefined) patch.min_points_to_rank = minPts;

  const rxBonus = parseNonNegativeInt(
    body.rx_bonus_points,
    "rx_bonus_points",
    100,
    errors
  );
  if (rxBonus !== undefined) patch.rx_bonus_points = rxBonus;

  const streak = parseBonusMap(body.streak_bonuses, "streak_bonuses", errors);
  if (streak !== undefined) patch.streak_bonuses = streak;

  const achievements = parseBonusMap(
    body.achievement_points,
    "achievement_points",
    errors
  );
  if (achievements !== undefined) patch.achievement_points = achievements;

  const table = parsePositionTable(body.position_points_table, errors);
  if (table !== undefined) patch.position_points_table = table;

  const evolution = parseEvolutionBonuses(body.evolution_bonuses, errors);
  if (evolution !== undefined) patch.evolution_bonuses = evolution;

  if (body.tagline !== undefined) {
    if (typeof body.tagline !== "string" || body.tagline.trim().length === 0) {
      errors.tagline = "Must be a non-empty string";
    } else if (body.tagline.length > MAX_TAGLINE) {
      errors.tagline = `Max ${MAX_TAGLINE} characters`;
    } else {
      patch.tagline = body.tagline.trim();
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, errors: { _body: "No valid fields to update" } };
  }

  return { ok: true, patch };
}

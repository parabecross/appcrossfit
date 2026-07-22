import { describe, expect, it } from "vitest";
import {
  buildClassRanking,
  buildWodRankForAthlete,
  canRankScore,
  inferScoreTipoFromWorkout,
  parseScoreNumeric,
  parseTimeToSeconds,
  resolveInitialScoreMode,
  scoreTypeHasRxScaled,
} from "./helpers";

describe("parseTimeToSeconds", () => {
  it("parses mm:ss", () => {
    expect(parseTimeToSeconds("5:30")).toBe(330);
  });

  it("rejects invalid seconds", () => {
    expect(parseTimeToSeconds("5:60")).toBeNull();
  });
});

describe("parseScoreNumeric", () => {
  it("parses reps", () => {
    expect(parseScoreNumeric("reps", "120")).toBe(120);
  });

  it("returns null for empty tiempo", () => {
    expect(parseScoreNumeric("tiempo", "")).toBeNull();
  });

  it("parses tiempo mm:ss for for-time WODs", () => {
    expect(parseScoreNumeric("tiempo", "12:34")).toBe(754);
  });

  it("parses peso", () => {
    expect(parseScoreNumeric("peso", "225 lb")).toBe(225);
  });

  it("parses rondas with plus sign", () => {
    expect(parseScoreNumeric("rondas", "8+12")).toBe(812);
    expect(parseScoreNumeric("rondas", "9+5")).toBe(905);
  });

  it("parses rondas rounds only", () => {
    expect(parseScoreNumeric("rondas", "8")).toBe(800);
  });

  it("parses cals", () => {
    expect(parseScoreNumeric("cals", "285")).toBe(285);
  });
});

describe("inferScoreTipoFromWorkout", () => {
  it("infers for time → tiempo", () => {
    expect(inferScoreTipoFromWorkout("WOD: For Time\n21-15-9 thrusters")).toBe(
      "tiempo"
    );
  });

  it("infers AMRAP → rondas", () => {
    expect(inferScoreTipoFromWorkout("AMRAP 12\n10 pull-ups\n15 air squats")).toBe(
      "rondas"
    );
  });

  it("infers fuerza / 1RM → peso", () => {
    expect(inferScoreTipoFromWorkout("Fuerza: Back Squat 1RM")).toBe("peso");
  });

  it("infers calorías", () => {
    expect(inferScoreTipoFromWorkout("Max calories on bike")).toBe("cals");
  });

  it("infers repeticiones", () => {
    expect(inferScoreTipoFromWorkout("Max reps unbroken pull-ups")).toBe("reps");
  });

  it("returns null when unclear so athlete can choose", () => {
    expect(inferScoreTipoFromWorkout("Warm-up + technique")).toBeNull();
    expect(inferScoreTipoFromWorkout(null)).toBeNull();
  });
});

describe("resolveInitialScoreMode", () => {
  it("prefers existing score over WOD inference", () => {
    expect(
      resolveInitialScoreMode(
        { sin_score: false, score_tipo: "peso" },
        "AMRAP 10"
      )
    ).toBe("peso");
  });

  it("uses sin_score when existing", () => {
    expect(
      resolveInitialScoreMode(
        { sin_score: true, score_tipo: "otro" },
        "For Time"
      )
    ).toBe("sin_score");
  });

  it("preselects inferred WOD type when creating", () => {
    expect(resolveInitialScoreMode(null, "For Time 15 min cap")).toBe("tiempo");
  });

  it("defaults to tiempo when no signal", () => {
    expect(resolveInitialScoreMode(null, null)).toBe("tiempo");
  });
});

describe("buildWodRankForAthlete", () => {
  it("ranks only athletes with the same score type", () => {
    const scores = [
      {
        id: "1",
        usuario_id: "u1",
        score_tipo: "cals",
        valor_numerico: 200,
        sin_score: false,
        nivel_deportivo: "beginner",
        profile: { nombre_completo: "Miguel" },
      },
      {
        id: "2",
        usuario_id: "u2",
        score_tipo: "peso",
        valor_numerico: 225,
        sin_score: false,
        nivel_deportivo: "beginner",
        profile: { nombre_completo: "Sofia" },
      },
      {
        id: "3",
        usuario_id: "u3",
        score_tipo: "cals",
        valor_numerico: 180,
        sin_score: false,
        nivel_deportivo: "beginner",
        profile: { nombre_completo: "Lucia" },
      },
    ] as never[];

    const miguel = buildWodRankForAthlete(scores, "beginner", "u1", "cals");
    expect(miguel?.rank).toBe(1);

    const lucia = buildWodRankForAthlete(scores, "beginner", "u3", "cals");
    expect(lucia?.rank).toBe(2);
  });
});

describe("scoreTypeHasRxScaled", () => {
  it("omits RX step for calories", () => {
    expect(scoreTypeHasRxScaled("cals")).toBe(false);
  });

  it("keeps RX step for weight-based score types", () => {
    expect(scoreTypeHasRxScaled("tiempo")).toBe(true);
    expect(scoreTypeHasRxScaled("peso")).toBe(true);
    expect(scoreTypeHasRxScaled("reps")).toBe(true);
    expect(scoreTypeHasRxScaled("rondas")).toBe(true);
  });
});

describe("canRankScore", () => {
  it("rejects sin_score and otro tipo", () => {
    expect(
      canRankScore({
        score_tipo: "otro",
        valor_numerico: 10,
        sin_score: false,
      })
    ).toBe(false);
    expect(
      canRankScore({
        score_tipo: "reps",
        valor_numerico: 10,
        sin_score: true,
      })
    ).toBe(false);
  });
});

describe("buildClassRanking", () => {
  it("ranks lower time better", () => {
    const rows = buildClassRanking(
      [
        {
          id: "a",
          usuario_id: "u1",
          score_tipo: "tiempo",
          valor_numerico: 400,
          sin_score: false,
          created_at: "2026-01-01",
          profile: { nombre_completo: "A" },
        },
        {
          id: "b",
          usuario_id: "u2",
          score_tipo: "tiempo",
          valor_numerico: 350,
          sin_score: false,
          created_at: "2026-01-01",
          profile: { nombre_completo: "B" },
        },
      ] as never[],
      "u2"
    );
    expect(rows[0].nombre).toBe("B");
    expect(rows[0].isMe).toBe(true);
  });
});

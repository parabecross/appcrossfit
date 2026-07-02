import { describe, expect, it } from "vitest";
import {
  buildClassRanking,
  buildWodRankForAthlete,
  canRankScore,
  parseScoreNumeric,
  parseTimeToSeconds,
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

  it("parses rondas with plus sign", () => {
    expect(parseScoreNumeric("rondas", "8+12")).toBe(812);
    expect(parseScoreNumeric("rondas", "9+5")).toBe(905);
  });

  it("parses rondas rounds only", () => {
    expect(parseScoreNumeric("rondas", "8")).toBe(800);
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
  it("ranks tiempo lower-is-better and handles ties", () => {
    const rows = buildClassRanking(
      [
        {
          id: "1",
          usuario_id: "1",
          valor_numerico: 300,
          score_tipo: "tiempo",
          sin_score: false,
          profile: { nombre_completo: "A" },
        } as never,
        {
          id: "2",
          usuario_id: "2",
          valor_numerico: 280,
          score_tipo: "tiempo",
          sin_score: false,
          profile: { nombre_completo: "B" },
        } as never,
      ],
      "2"
    );
    expect(rows[0].rank).toBe(1);
    expect(rows[0].nombre).toBe("B");
    expect(rows[0].isMe).toBe(true);
  });
});

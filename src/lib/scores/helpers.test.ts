import { describe, expect, it } from "vitest";
import {
  buildClassRanking,
  canRankScore,
  parseScoreNumeric,
  parseTimeToSeconds,
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

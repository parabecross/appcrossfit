import { describe, expect, it } from "vitest";
import { hasPointBreakdown, summarizePointBreakdown } from "./point-breakdown";
import type { RankingPointEvent } from "@/types/database";

function event(
  partial: Partial<RankingPointEvent> & Pick<RankingPointEvent, "event_type" | "points">
): RankingPointEvent {
  return {
    id: "e1",
    box_id: "b1",
    usuario_id: "u1",
    month_key: "2026-06",
    fecha: "2026-06-02",
    clase_id: null,
    reserva_id: null,
    metadata: {},
    idempotency_key: "k1",
    created_at: "2026-06-02T00:00:00Z",
    ...partial,
  };
}

describe("summarizePointBreakdown", () => {
  it("sums totals by event type", () => {
    const { totals } = summarizePointBreakdown([
      event({ event_type: "attendance", points: 15 }),
      event({ event_type: "streak", points: 4 }),
      event({ event_type: "wod_position", points: 30, metadata: { rank: 1 } }),
      event({ event_type: "evolution", points: 10 }),
      event({ event_type: "achievement", points: 20 }),
    ]);

    expect(totals).toEqual({
      attendance: 15,
      streak: 4,
      wod_position: 30,
      evolution: 10,
      achievement: 20,
    });
  });

  it("detects non-empty breakdown", () => {
    const { totals } = summarizePointBreakdown([
      event({ event_type: "attendance", points: 15 }),
    ]);
    expect(hasPointBreakdown(totals)).toBe(true);
  });
});

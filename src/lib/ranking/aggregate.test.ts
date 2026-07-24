import { beforeEach, describe, expect, it, vi } from "vitest";

const reservasEqCalls: Array<[string, unknown]> = [];

function makeBuilder(data: unknown, opts: { trackEq?: boolean } = {}) {
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      if (opts.trackEq) reservasEqCalls.push([col, val]);
      return builder;
    },
    in: () => builder,
    order: () => builder,
    maybeSingle: async () => ({ data, error: null }),
    then: (resolve: (v: { data: unknown; error: null }) => void) =>
      resolve({ data, error: null }),
  };
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "boxes") {
        return makeBuilder({
          id: "box-a",
          name: "Box A",
          slug: "box-a",
          logo_url: null,
          timezone: "America/Mexico_City",
          status: "active",
        });
      }
      if (table === "ranking_config") return makeBuilder(null);
      if (table === "ranking_point_events") return makeBuilder([]);
      if (table === "reservas") return makeBuilder([], { trackEq: true });
      throw new Error(`Unexpected table ${table}`);
    },
  }),
}));

describe("getAthronRankingForBox (regresión hallazgo #4)", () => {
  beforeEach(() => {
    reservasEqCalls.length = 0;
  });

  it("filtra la query de reservas por clase.box_id, no solo en JS tras traer todo", async () => {
    const { getAthronRankingForBox } = await import("./aggregate");
    await getAthronRankingForBox({ boxSlug: "box-a" });

    // Antes del fix, esta query no tenía ningún filtro por box_id a nivel SQL:
    // traía la tabla reservas completa (de todos los boxes) y filtraba en JS.
    expect(reservasEqCalls).toContainEqual(["clase.box_id", "box-a"]);
  });

  it("sigue filtrando por estado='asistio' (no rompe el comportamiento existente)", async () => {
    const { getAthronRankingForBox } = await import("./aggregate");
    await getAthronRankingForBox({ boxSlug: "box-a" });

    expect(reservasEqCalls).toContainEqual(["estado", "asistio"]);
  });
});

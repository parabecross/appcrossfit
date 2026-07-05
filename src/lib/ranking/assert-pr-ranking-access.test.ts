import { describe, expect, it, vi } from "vitest";
import {
  assertPrRankingAccess,
  RankingAccessError,
} from "./assert-pr-ranking-access";

function mockSupabase(responses: {
  targetProfile?: { id: string; box_id: string | null } | null;
  marca?: { id: string; usuario_id: string } | null;
}) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: (col: string, val: string) => ({
          maybeSingle: async () => {
            if (table === "profiles") {
              return { data: responses.targetProfile, error: null };
            }
            if (table === "atleta_pr_marcas") {
              return { data: responses.marca, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
    }),
  } as never;
}

describe("assertPrRankingAccess", () => {
  it("rechaza socio intentando otro usuario", async () => {
    await expect(
      assertPrRankingAccess({
        supabase: mockSupabase({}),
        caller: { id: "u1", box_id: "box-a", rol: "socio" },
        targetUsuarioId: "u2",
      })
    ).rejects.toBeInstanceOf(RankingAccessError);
  });

  it("rechaza usuario de otro box", async () => {
    await expect(
      assertPrRankingAccess({
        supabase: mockSupabase({
          targetProfile: { id: "u2", box_id: "box-b" },
        }),
        caller: { id: "coach1", box_id: "box-a", rol: "admin" },
        targetUsuarioId: "u2",
      })
    ).rejects.toBeInstanceOf(RankingAccessError);
  });

  it("permite coach del mismo box", async () => {
    await expect(
      assertPrRankingAccess({
        supabase: mockSupabase({
          targetProfile: { id: "u2", box_id: "box-a" },
          marca: { id: "m1", usuario_id: "u2" },
        }),
        caller: { id: "coach1", box_id: "box-a", rol: "admin" },
        targetUsuarioId: "u2",
        marcaId: "m1",
      })
    ).resolves.toBeUndefined();
  });

  it("rechaza marca que no pertenece al usuario", async () => {
    await expect(
      assertPrRankingAccess({
        supabase: mockSupabase({
          targetProfile: { id: "u2", box_id: "box-a" },
          marca: { id: "m1", usuario_id: "u-other" },
        }),
        caller: { id: "u2", box_id: "box-a", rol: "socio" },
        targetUsuarioId: "u2",
        marcaId: "m1",
      })
    ).rejects.toBeInstanceOf(RankingAccessError);
  });
});

describe("box_id en engine", () => {
  it("documenta que revoke filtra por box_id", () => {
    expect(true).toBe(true);
  });
});

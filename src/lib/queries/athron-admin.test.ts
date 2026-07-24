import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

function makeTable(rows: Row[]) {
  let filtered = rows;
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      filtered = filtered.filter((r) => r[col] === val);
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      filtered = filtered.filter((r) => vals.includes(r[col]));
      return builder;
    },
    order: () => builder,
    maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => void) =>
      resolve({ data: filtered, error: null }),
  };
  return builder;
}

const mockGetUserById = vi.fn(async (userId: string) => ({
  data: { user: { last_sign_in_at: `2026-01-01T00:00:00Z:${userId}` } },
}));

const mockGetSubscriptionSummariesForBoxes = vi.fn(
  async (boxIds: string[]) => new Map(boxIds.map((id) => [id, undefined]))
);

vi.mock("@/lib/queries/subscriptions", () => ({
  getSubscriptionSummariesForBoxes: (boxIds: string[]) =>
    mockGetSubscriptionSummariesForBoxes(boxIds),
}));

// Dos boxes con datos mezclados: box-a (2 miembros) y box-b (500 miembros),
// para detectar si getBoxWithStats vuelve a escanear toda la plataforma.
const boxes: Row[] = [
  { id: "box-a", name: "Box A" },
  { id: "box-b", name: "Box B" },
];

const profiles: Row[] = [
  { id: "p1", box_id: "box-a", rol: "socio", user_id: "user-a1" },
  { id: "p2", box_id: "box-a", rol: "coach", user_id: "user-a2" },
  ...Array.from({ length: 500 }, (_, i) => ({
    id: `pb${i}`,
    box_id: "box-b",
    rol: "socio",
    user_id: `user-b${i}`,
  })),
];

const clases: Row[] = [
  { id: "c1", box_id: "box-a" },
  ...Array.from({ length: 50 }, (_, i) => ({ id: `cb${i}`, box_id: "box-b" })),
];

const reservas: Row[] = [
  { usuario_id: "p1" },
  { usuario_id: "p1" },
  ...Array.from({ length: 500 }, (_, i) => ({ usuario_id: `pb${i}` })),
];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "boxes") return makeTable(boxes);
      if (table === "profiles") return makeTable(profiles);
      if (table === "clases") return makeTable(clases);
      if (table === "reservas") return makeTable(reservas);
      throw new Error(`Unexpected table ${table}`);
    },
    auth: { admin: { getUserById: mockGetUserById } },
  }),
}));

describe("getBoxWithStats (regresión hallazgo #3)", () => {
  beforeEach(() => {
    mockGetUserById.mockClear();
    mockGetSubscriptionSummariesForBoxes.mockClear();
  });

  it("devuelve stats correctos y aislados de un solo box", async () => {
    const { getBoxWithStats } = await import("./athron-admin");
    const result = await getBoxWithStats("box-a");

    expect(result).not.toBeNull();
    expect(result?.memberCount).toBe(2);
    expect(result?.athleteCount).toBe(1);
    expect(result?.coachCount).toBe(1);
    expect(result?.classCount).toBe(1);
    expect(result?.reservationCount).toBe(2);
  });

  it("no consulta auth.admin.getUserById para usuarios de otro box (regresión de escaneo system-wide)", async () => {
    const { getBoxWithStats } = await import("./athron-admin");
    await getBoxWithStats("box-a");

    // Antes del fix, getBoxWithStats delegaba en getAllBoxesWithStats,
    // que itera getUserById por cada usuario de CADA box del sistema.
    expect(mockGetUserById).toHaveBeenCalledTimes(2);
    for (const call of mockGetUserById.mock.calls) {
      expect(call[0]).toMatch(/^user-a/);
    }
  });

  it("solo pide el resumen de suscripción del box solicitado, no de todos", async () => {
    const { getBoxWithStats } = await import("./athron-admin");
    await getBoxWithStats("box-a");

    expect(mockGetSubscriptionSummariesForBoxes).toHaveBeenCalledWith([
      "box-a",
    ]);
  });

  it("devuelve null si el box no existe", async () => {
    const { getBoxWithStats } = await import("./athron-admin");
    const result = await getBoxWithStats("box-inexistente");
    expect(result).toBeNull();
  });
});

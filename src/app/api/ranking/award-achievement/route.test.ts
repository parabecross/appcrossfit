import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCallerProfileSingle = vi.fn();
const mockTargetProfileMaybeSingle = vi.fn();
const mockAwardAchievement = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table !== "profiles") throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: (col: string) => {
            if (col === "user_id") return { single: mockCallerProfileSingle };
            if (col === "id") return { maybeSingle: mockTargetProfileMaybeSingle };
            throw new Error(`Unexpected eq column ${col}`);
          },
        }),
      };
    },
  }),
}));

vi.mock("@/lib/entitlements/engine", () => ({
  getBoxEntitlements: async () => ({}),
  assertFeatureEnabled: () => {},
}));

vi.mock("@/lib/ranking/engine", () => ({
  awardAchievement: mockAwardAchievement,
}));

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ranking/award-achievement", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/ranking/award-achievement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } } });
  });

  it("rechaza otorgar puntos a un atleta de otro box (regresión hallazgo #1)", async () => {
    mockCallerProfileSingle.mockResolvedValue({
      data: { id: "coach-1", box_id: "box-a", rol: "admin" },
    });
    mockTargetProfileMaybeSingle.mockResolvedValue({
      data: { id: "athlete-2", box_id: "box-b" },
    });

    const { POST } = await import("./route");
    const res = await POST(
      postRequest({ badgeKey: "first_wod", usuarioId: "athlete-2" })
    );

    expect(res.status).toBe(403);
    expect(mockAwardAchievement).not.toHaveBeenCalled();
  });

  it("permite a un admin otorgar puntos a un atleta de su propio box", async () => {
    mockCallerProfileSingle.mockResolvedValue({
      data: { id: "coach-1", box_id: "box-a", rol: "admin" },
    });
    mockTargetProfileMaybeSingle.mockResolvedValue({
      data: { id: "athlete-2", box_id: "box-a" },
    });
    mockAwardAchievement.mockResolvedValue({ awarded: true });

    const { POST } = await import("./route");
    const res = await POST(
      postRequest({ badgeKey: "first_wod", usuarioId: "athlete-2" })
    );

    expect(res.status).toBe(200);
    expect(mockAwardAchievement).toHaveBeenCalledWith({
      usuarioId: "athlete-2",
      boxId: "box-a",
      badgeKey: "first_wod",
    });
  });

  it("rechaza a un socio otorgándose puntos a través de otro usuarioId", async () => {
    mockCallerProfileSingle.mockResolvedValue({
      data: { id: "socio-1", box_id: "box-a", rol: "socio" },
    });

    const { POST } = await import("./route");
    const res = await POST(
      postRequest({ badgeKey: "first_wod", usuarioId: "socio-2" })
    );

    expect(res.status).toBe(403);
    expect(mockAwardAchievement).not.toHaveBeenCalled();
  });
});

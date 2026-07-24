import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCallerProfileSingle = vi.fn();
const mockTargetProfileMaybeSingle = vi.fn();
const mockRevokeAchievement = vi.fn();

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
  revokeAchievement: mockRevokeAchievement,
}));

function postRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/ranking/revoke-achievement", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/ranking/revoke-achievement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } } });
  });

  it("rechaza revocar puntos de un atleta de otro box (regresión hallazgo #1)", async () => {
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
    expect(mockRevokeAchievement).not.toHaveBeenCalled();
  });

  it("permite a un admin revocar puntos de un atleta de su propio box", async () => {
    mockCallerProfileSingle.mockResolvedValue({
      data: { id: "coach-1", box_id: "box-a", rol: "admin" },
    });
    mockTargetProfileMaybeSingle.mockResolvedValue({
      data: { id: "athlete-2", box_id: "box-a" },
    });
    mockRevokeAchievement.mockResolvedValue({ revoked: true, eventsRemoved: 1 });

    const { POST } = await import("./route");
    const res = await POST(
      postRequest({ badgeKey: "first_wod", usuarioId: "athlete-2" })
    );

    expect(res.status).toBe(200);
    expect(mockRevokeAchievement).toHaveBeenCalledWith({
      usuarioId: "athlete-2",
      badgeKey: "first_wod",
    });
  });

  it("rechaza a un socio revocando puntos a través de otro usuarioId", async () => {
    mockCallerProfileSingle.mockResolvedValue({
      data: { id: "socio-1", box_id: "box-a", rol: "socio" },
    });

    const { POST } = await import("./route");
    const res = await POST(
      postRequest({ badgeKey: "first_wod", usuarioId: "socio-2" })
    );

    expect(res.status).toBe(403);
    expect(mockRevokeAchievement).not.toHaveBeenCalled();
  });
});

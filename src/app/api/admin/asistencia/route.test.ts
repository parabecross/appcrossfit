import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockCallerProfileSingle = vi.fn();
const mockReservaMaybeSingle = vi.fn();
const mockUpdateSelect = vi.fn();
const mockAwardAttendance = vi.fn();
const mockRevokeAttendanceRanking = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => {
      if (table !== "profiles" && table !== "reservas") {
        throw new Error(`Unexpected table ${table}`);
      }
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ single: mockCallerProfileSingle }),
          }),
        };
      }
      // table === "reservas"
      return {
        select: () => ({
          eq: () => ({ maybeSingle: mockReservaMaybeSingle }),
        }),
        update: () => ({
          eq: () => ({ select: mockUpdateSelect }),
        }),
      };
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({}),
}));

vi.mock("@/lib/entitlements/engine", () => ({
  getBoxEntitlements: async () => ({}),
  assertFeatureEnabled: () => {},
}));

vi.mock("@/lib/entitlements/permissions", () => ({
  canUseFeature: () => true,
}));

vi.mock("@/lib/ranking/engine", () => ({
  awardAttendance: mockAwardAttendance,
  revokeAttendanceRanking: mockRevokeAttendanceRanking,
}));

function patchRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/admin/asistencia", {
    method: "PATCH",
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("PATCH /api/admin/asistencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "auth-1" } } });
  });

  it("rechaza marcar asistencia de una reserva de otro box (regresión IDOR)", async () => {
    mockCallerProfileSingle.mockResolvedValue({
      data: { id: "coach-1", rol: "admin", box_id: "box-a" },
    });
    mockReservaMaybeSingle.mockResolvedValue({
      data: { id: "r1", clase: { box_id: "box-b" } },
      error: null,
    });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ reserva_id: "r1", estado: "asistio" })
    );

    expect(res.status).toBe(404);
    expect(mockUpdateSelect).not.toHaveBeenCalled();
    expect(mockAwardAttendance).not.toHaveBeenCalled();
    expect(mockRevokeAttendanceRanking).not.toHaveBeenCalled();
  });

  it("permite marcar asistencia de una reserva del propio box", async () => {
    mockCallerProfileSingle.mockResolvedValue({
      data: { id: "coach-1", rol: "admin", box_id: "box-a" },
    });
    mockReservaMaybeSingle.mockResolvedValue({
      data: { id: "r1", clase: { box_id: "box-a" } },
      error: null,
    });
    mockUpdateSelect.mockResolvedValue({ data: [{ id: "r1" }], error: null });
    mockAwardAttendance.mockResolvedValue({ awarded: true, events: [] });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ reserva_id: "r1", estado: "asistio" })
    );

    expect(res.status).toBe(200);
    expect(mockAwardAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ reservaId: "r1" })
    );
  });

  it("devuelve 404 si la reserva no existe", async () => {
    mockCallerProfileSingle.mockResolvedValue({
      data: { id: "coach-1", rol: "admin", box_id: "box-a" },
    });
    mockReservaMaybeSingle.mockResolvedValue({ data: null, error: null });

    const { PATCH } = await import("./route");
    const res = await PATCH(
      patchRequest({ reserva_id: "no-existe", estado: "asistio" })
    );

    expect(res.status).toBe(404);
    expect(mockAwardAttendance).not.toHaveBeenCalled();
  });
});

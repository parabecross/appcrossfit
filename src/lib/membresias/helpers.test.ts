import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canReserve,
  computeFechaFin,
  isMembresiaVencida,
  syncMembresiaEstadoLocal,
} from "./helpers";

afterEach(() => {
  vi.useRealTimers();
});

describe("computeFechaFin", () => {
  it("adds duration days from start date", () => {
    expect(computeFechaFin("2026-01-01", 30)).toBe("2026-01-31");
    expect(computeFechaFin("2026-02-01", 28)).toBe("2026-03-01");
  });
});

describe("syncMembresiaEstadoLocal", () => {
  it("keeps cancelada regardless of date", () => {
    expect(syncMembresiaEstadoLocal("2099-01-01", "cancelada")).toBe("cancelada");
  });

  it("marks vencida when fecha_fin is in the past", () => {
    expect(syncMembresiaEstadoLocal("2000-01-01", "vigente")).toBe("vencida");
  });

  it("marks vigente when fecha_fin is in the future", () => {
    expect(syncMembresiaEstadoLocal("2099-12-31", "vigente")).toBe("vigente");
  });
});

describe("isMembresiaVencida", () => {
  it("returns true for past dates", () => {
    expect(isMembresiaVencida("2000-01-01")).toBe(true);
  });
});

describe("canReserve", () => {
  const activeProfile = { estado_cuenta: "activo" as const };

  it("rejects pendiente_pago", () => {
    expect(
      canReserve(
        { estado_cuenta: "pendiente_pago" },
        { estado: "vigente", fecha_fin: "2099-12-31" }
      )
    ).toEqual({ ok: false, reason: "pending" });
  });

  it("rejects expired membership by fecha_fin", () => {
    expect(
      canReserve(activeProfile, {
        estado: "vigente",
        fecha_fin: "2000-01-01",
      })
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects missing membership", () => {
    expect(canReserve(activeProfile, null)).toEqual({
      ok: false,
      reason: "none",
    });
  });

  it("uses box calendar day for expiry across timezones", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T12:30:00.000Z"));

    try {
      const membership = {
        estado: "vigente" as const,
        fecha_fin: "2026-07-22",
      };

      expect(canReserve(activeProfile, membership)).toEqual({ ok: true });

      expect(
        canReserve(activeProfile, membership, "Pacific/Auckland")
      ).toEqual({ ok: false, reason: "expired" });
    } finally {
      vi.useRealTimers();
    }
  });
});

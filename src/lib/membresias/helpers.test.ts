import { describe, expect, it } from "vitest";
import {
  computeFechaFin,
  isMembresiaVencida,
  syncMembresiaEstadoLocal,
} from "./helpers";

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

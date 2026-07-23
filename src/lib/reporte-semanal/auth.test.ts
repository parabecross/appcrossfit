import { describe, expect, it } from "vitest";
import { canAccessWeeklyReport } from "./auth";
import { buildWeeklyReportFilename } from "./filename";
import { createDownloadGuard } from "./download-guard";
import { generateWeeklyReportPdf } from "./generate-pdf";
import type { WeeklyReportModel } from "./types";

describe("reporte-semanal auth isolation", () => {
  it("rejects unauthenticated users", () => {
    expect(
      canAccessWeeklyReport({
        authenticated: false,
        rol: "admin",
        boxId: "box-a",
        featureEnabled: true,
      }).allowed
    ).toBe(false);
  });

  it("rejects socios and coaches", () => {
    expect(
      canAccessWeeklyReport({
        authenticated: true,
        rol: "socio",
        boxId: "box-a",
        featureEnabled: true,
      }).reason
    ).toBe("forbidden_role");
    expect(
      canAccessWeeklyReport({
        authenticated: true,
        rol: "coach",
        boxId: "box-a",
        featureEnabled: true,
      }).reason
    ).toBe("forbidden_role");
  });

  it("rejects missing feature flag", () => {
    expect(
      canAccessWeeklyReport({
        authenticated: true,
        rol: "admin",
        boxId: "box-a",
        featureEnabled: false,
      }).reason
    ).toBe("feature_disabled");
  });

  it("allows admin-like with feature and box", () => {
    expect(
      canAccessWeeklyReport({
        authenticated: true,
        rol: "box_admin",
        boxId: "box-a",
        featureEnabled: true,
      }).allowed
    ).toBe(true);
  });
});

describe("reporte-semanal filename", () => {
  it("builds the expected download name", () => {
    expect(
      buildWeeklyReportFilename({ from: "2026-07-22", to: "2026-07-31" })
    ).toBe("athron-reporte-ejecutivo-2026-07-22-al-2026-07-31.pdf");
  });
});

describe("download guard", () => {
  it("prevents concurrent downloads", () => {
    const guard = createDownloadGuard();
    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);
    guard.finish();
    expect(guard.tryStart()).toBe(true);
  });
});

describe("generateWeeklyReportPdf", () => {
  it("returns a valid PDF buffer", async () => {
    const model: WeeklyReportModel = {
      boxId: "box-a",
      boxName: "Parabellum",
      timezone: "America/Mexico_City",
      logoUrl: null,
      title: "Reporte ejecutivo",
      week: { from: "2026-07-20", to: "2026-07-26" },
      previousWeek: { from: "2026-07-13", to: "2026-07-19" },
      weekLabel: "20 de julio de 2026 – 26 de julio de 2026",
      previousWeekLabel: "13 de julio de 2026 – 19 de julio de 2026",
      generatedAtLabel: "22 de julio de 2026, 16:00",
      hasOperationalData: true,
      metrics: {
        uniqueAthletesAttended: 2,
        classesHeld: 1,
        totalReservations: 3,
        totalAttendances: 2,
        totalCancellations: 1,
        avgOccupancyPct: 50,
        newAthletes: 0,
        membershipsActive: 5,
        membershipsExpiringSoon: 1,
        membershipsExpired: 0,
        prsRegistered: 0,
        avgAttendeesPerClass: 2,
        capacityOffered: 12,
        capacityOccupied: 6,
        topOccupiedClasses: [],
        lowestOccupiedClasses: [],
        mostCancelledClasses: [],
        topConstantAthletes: [],
        inactiveAthletes: [],
        expiringAthletes: [],
        newAthleteNames: [],
        comparison: {
          uniqueAthletesAttended: {
            current: 2,
            previous: 0,
            absoluteDelta: 2,
            percentDelta: null,
            label: "nuevo",
          },
          totalAttendances: {
            current: 2,
            previous: 1,
            absoluteDelta: 1,
            percentDelta: 100,
            label: "ok",
          },
          totalReservations: {
            current: 3,
            previous: 3,
            absoluteDelta: 0,
            percentDelta: 0,
            label: "sin_cambio",
          },
          totalCancellations: {
            current: 1,
            previous: 0,
            absoluteDelta: 1,
            percentDelta: null,
            label: "nuevo",
          },
          avgOccupancyPct: {
            current: 50,
            previous: 40,
            absoluteDelta: 10,
            percentDelta: 25,
            label: "ok",
          },
          newAthletes: {
            current: 0,
            previous: 0,
            absoluteDelta: 0,
            percentDelta: null,
            label: "sin_cambio",
          },
        },
        narrative: "En este periodo asistieron 2 atletas.",
      },
    };

    const pdf = await generateWeeklyReportPdf(model);
    expect(pdf.byteLength).toBeGreaterThan(100);
    expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
  });
});

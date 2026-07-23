import { describe, expect, it } from "vitest";
import {
  buildExcelClassRows,
  buildExcelComparisonRows,
  buildExcelWorkbookModel,
  occupancyIndicator,
} from "./excel-data";
import type { WeeklyReportRawData } from "./fetch-data";
import type { WeeklyReportMetrics } from "./types";
import {
  assertExcelBufferLooksValid,
  buildExecutiveExcelFilename,
  EXECUTIVE_EXCEL_CONTENT_TYPE,
  generateExecutiveReportExcel,
} from "./generate-excel";
import { SHEET_NAMES } from "./excel-styles";
import { canAccessWeeklyReport } from "./auth";
import ExcelJS from "exceljs";
import { previousPeriodOfEqualDuration as prevPeriod } from "./period-range";

function emptyMetrics(partial: Partial<WeeklyReportMetrics> = {}): WeeklyReportMetrics {
  return {
    uniqueAthletesAttended: 0,
    classesHeld: 0,
    totalReservations: 0,
    totalAttendances: 0,
    totalCancellations: 0,
    avgOccupancyPct: null,
    newAthletes: 0,
    membershipsActive: 0,
    membershipsExpiringSoon: 0,
    membershipsExpired: 0,
    prsRegistered: 0,
    avgAttendeesPerClass: null,
    capacityOffered: 0,
    capacityOccupied: 0,
    topOccupiedClasses: [],
    lowestOccupiedClasses: [],
    mostCancelledClasses: [],
    topConstantAthletes: [],
    inactiveAthletes: [],
    expiringAthletes: [],
    newAthleteNames: [],
    comparison: {
      uniqueAthletesAttended: {
        current: 0,
        previous: 0,
        absoluteDelta: 0,
        percentDelta: null,
        label: "sin_cambio",
      },
      totalAttendances: {
        current: 0,
        previous: 0,
        absoluteDelta: 0,
        percentDelta: null,
        label: "sin_cambio",
      },
      totalReservations: {
        current: 0,
        previous: 0,
        absoluteDelta: 0,
        percentDelta: null,
        label: "sin_cambio",
      },
      totalCancellations: {
        current: 0,
        previous: 0,
        absoluteDelta: 0,
        percentDelta: null,
        label: "sin_cambio",
      },
      avgOccupancyPct: {
        current: 0,
        previous: 0,
        absoluteDelta: 0,
        percentDelta: null,
        label: "sin_datos",
      },
      newAthletes: {
        current: 0,
        previous: 0,
        absoluteDelta: 0,
        percentDelta: null,
        label: "sin_cambio",
      },
    },
    narrative: "Sin datos.",
    ...partial,
  };
}

function sampleRaw(): WeeklyReportRawData {
  return {
    boxId: "box-a",
    boxName: "Parabellum",
    timezone: "America/Mexico_City",
    logoUrl: null,
    today: "2026-07-22",
    week: { from: "2026-07-08", to: "2026-07-15" },
    previousWeek: prevPeriod({ from: "2026-07-08", to: "2026-07-15" }),
    classesThisWeek: [
      {
        id: "c1",
        nombre: "WOD AM",
        fecha: "2026-07-10",
        hora_inicio: "07:00:00",
        hora_fin: "08:00:00",
        cupo_maximo: 12,
        cupo_ocupado: 10,
        estado: "programada",
        coach_nombre: "Coach A",
      },
      {
        id: "c2",
        nombre: "WOD PM",
        fecha: "2026-07-10",
        hora_inicio: "19:00:00",
        hora_fin: "20:00:00",
        cupo_maximo: 0,
        cupo_ocupado: 0,
        estado: "programada",
        coach_nombre: null,
      },
    ],
    classesPrevWeek: [],
    reservasThisWeek: [
      {
        id: "r1",
        usuario_id: "u1",
        clase_id: "c1",
        estado: "asistio",
        claseFecha: "2026-07-10",
      },
      {
        id: "r2",
        usuario_id: "u2",
        clase_id: "c1",
        estado: "cancelada",
        claseFecha: "2026-07-10",
      },
    ],
    reservasPrevWeek: [],
    attendanceHistory: [
      {
        id: "r1",
        usuario_id: "u1",
        clase_id: "c1",
        estado: "asistio",
        claseFecha: "2026-07-10",
      },
    ],
    socios: [
      {
        id: "u1",
        nombre_completo: "Ana",
        estado_cuenta: "activo",
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "u2",
        nombre_completo: "Bob",
        estado_cuenta: "activo",
        created_at: "2026-07-09T12:00:00.000Z",
      },
    ],
    membershipByUser: new Map([
      [
        "u1",
        {
          usuario_id: "u1",
          estado: "vigente",
          fecha_inicio: "2026-01-01",
          fecha_fin: "2026-08-01",
          plan_nombre: "Mensual",
        },
      ],
    ]),
    prs: [{ usuario_id: "u1", fecha: "2026-07-12" }],
    prsPrevWeek: [],
  };
}

describe("excel occupancy indicator", () => {
  it("classifies capacity bands", () => {
    expect(occupancyIndicator(10, 12)).toBe("Alta ocupación");
    expect(occupancyIndicator(5, 12)).toBe("Ocupación media");
    expect(occupancyIndicator(2, 12)).toBe("Baja ocupación");
    expect(occupancyIndicator(0, 0)).toBe("Sin capacidad configurada");
  });
});

describe("excel class rows", () => {
  it("builds numeric occupancy fractions and empty capacity", () => {
    const rows = buildExcelClassRows(sampleRaw());
    expect(rows[0].ocupacionPct).toBeCloseTo(10 / 12, 5);
    expect(rows[0].capacidad).toBe(12);
    expect(rows[1].capacidad).toBeNull();
    expect(rows[1].ocupacionPct).toBeNull();
    expect(rows[0].cancelaciones).toBe(1);
  });
});

describe("excel comparison equal duration", () => {
  it("uses previous period of equal length", () => {
    expect(prevPeriod({ from: "2026-07-08", to: "2026-07-15" })).toEqual({
      from: "2026-06-30",
      to: "2026-07-07",
    });
  });

  it("marks more cancellations as Disminuyó (worse)", () => {
    const raw = sampleRaw();
    raw.reservasPrevWeek = [
      {
        id: "rp1",
        usuario_id: "u1",
        clase_id: "cp1",
        estado: "cancelada",
        claseFecha: "2026-07-01",
      },
    ];
    const metrics = emptyMetrics({ totalCancellations: 5 });
    const rows = buildExcelComparisonRows(raw, metrics);
    const cancel = rows.find((r) => r.metrica === "Cancelaciones");
    expect(cancel?.anterior).toBe(1);
    expect(cancel?.actual).toBe(5);
    expect(cancel?.tendencia).toBe("Disminuyó");
  });

  it("marks fewer cancellations as Mejoró", () => {
    const raw = sampleRaw();
    raw.reservasPrevWeek = [
      {
        id: "rp1",
        usuario_id: "u1",
        clase_id: "cp1",
        estado: "cancelada",
        claseFecha: "2026-07-01",
      },
      {
        id: "rp2",
        usuario_id: "u2",
        clase_id: "cp1",
        estado: "cancelada",
        claseFecha: "2026-07-02",
      },
    ];
    const metrics = emptyMetrics({ totalCancellations: 1 });
    const rows = buildExcelComparisonRows(raw, metrics);
    const cancel = rows.find((r) => r.metrica === "Cancelaciones");
    expect(cancel?.tendencia).toBe("Mejoró");
  });
});

describe("excel auth policy", () => {
  it("rejects coach and unauthenticated", () => {
    expect(
      canAccessWeeklyReport({
        authenticated: false,
        rol: "admin",
        boxId: "b",
        featureEnabled: true,
      }).allowed
    ).toBe(false);
    expect(
      canAccessWeeklyReport({
        authenticated: true,
        rol: "coach",
        boxId: "b",
        featureEnabled: true,
      }).reason
    ).toBe("forbidden_role");
    expect(
      canAccessWeeklyReport({
        authenticated: true,
        rol: "admin",
        boxId: "b",
        featureEnabled: false,
      }).reason
    ).toBe("feature_disabled");
  });
});

describe("excel download contract", () => {
  it("exposes the expected content type and filename pattern", () => {
    expect(EXECUTIVE_EXCEL_CONTENT_TYPE).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(
      buildExecutiveExcelFilename("2026-07-08", "2026-07-15")
    ).toBe("athron-reporte-ejecutivo-2026-07-08-al-2026-07-15.xlsx");
  });
});

describe("generateExecutiveReportExcel", () => {
  it("creates a valid xlsx with expected sheets and filename", async () => {
    const raw = sampleRaw();
    const metrics = emptyMetrics({
      uniqueAthletesAttended: 1,
      classesHeld: 1,
      totalReservations: 1,
      totalAttendances: 1,
      totalCancellations: 1,
      avgOccupancyPct: 83,
      prsRegistered: 1,
      narrative: "En este periodo asistieron 1 atletas.",
    });
    const model = buildExcelWorkbookModel(raw, metrics, {
      weekLabel: "8 – 15 julio 2026",
      previousWeekLabel: "30 jun – 7 jul 2026",
      generatedAtLabel: "22 de julio de 2026",
    });

    const buf = await generateExecutiveReportExcel(model);
    expect(assertExcelBufferLooksValid(buf)).toBe(true);
    expect(buf.toString("utf8")).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(
      buildExecutiveExcelFilename("2026-07-08", "2026-07-15")
    ).toBe("athron-reporte-ejecutivo-2026-07-08-al-2026-07-15.xlsx");

    const wb = new ExcelJS.Workbook();
    // exceljs Buffer typing is strict across Node versions; runtime accepts the bytes
    await wb.xlsx.load(Buffer.from(buf) as never);
    const names = wb.worksheets.map((w) => w.name);
    expect(names).toEqual([
      SHEET_NAMES.resumen,
      SHEET_NAMES.clases,
      SHEET_NAMES.atletas,
      SHEET_NAMES.membresias,
      SHEET_NAMES.comparacion,
      SHEET_NAMES.meta,
    ]);

    const clases = wb.getWorksheet(SHEET_NAMES.clases)!;
    expect(clases.getRow(1).getCell(1).value).toBe("Fecha");
    expect(clases.getRow(1).getCell(12).value).toBe("Ocupación %");
    const occ = clases.getRow(2).getCell(12).value;
    expect(typeof occ).toBe("number");
    expect(occ as number).toBeCloseTo(10 / 12, 5);
    expect(clases.getRow(2).getCell(12).numFmt).toBe("0%");

    const fecha = clases.getRow(2).getCell(1).value;
    expect(fecha).toBeInstanceOf(Date);
    expect((fecha as Date).toISOString().startsWith("2026-07-10")).toBe(true);

    const resumen = wb.getWorksheet(SHEET_NAMES.resumen)!;
    expect(String(resumen.getCell("A1").value)).toContain("ATHRON");
    expect(String(resumen.getCell("A2").value)).toBe("Parabellum");

    const asText = buf.toString("latin1");
    expect(asText).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{20,}\./);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  countAttendances,
  countCancellations,
  countTotalReservations,
  countUniqueAthletesAttended,
  findInactiveForReport,
  isClassHeld,
  occupancyPct,
  rankConstantAthletes,
  computeWeeklyReportMetrics,
} from "./metrics";
import { buildWeeklyNarrative } from "./narrative";
import type {
  ReportClassRow,
  ReportReservaRow,
  ReportSocioRow,
} from "./types";

const week = { from: "2026-07-20", to: "2026-07-26" };
const prev = { from: "2026-07-13", to: "2026-07-19" };

function clase(
  partial: Partial<ReportClassRow> & Pick<ReportClassRow, "id" | "fecha">
): ReportClassRow {
  return {
    nombre: "WOD",
    hora_inicio: "07:00:00",
    hora_fin: "08:00:00",
    cupo_maximo: 12,
    cupo_ocupado: 6,
    estado: "programada",
    ...partial,
  };
}

describe("reporte-semanal metrics", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts unique athletes with asistencia only", () => {
    const reservas: ReportReservaRow[] = [
      {
        id: "1",
        usuario_id: "a",
        clase_id: "c1",
        estado: "asistio",
        claseFecha: "2026-07-21",
      },
      {
        id: "2",
        usuario_id: "a",
        clase_id: "c2",
        estado: "asistio",
        claseFecha: "2026-07-22",
      },
      {
        id: "3",
        usuario_id: "b",
        clase_id: "c1",
        estado: "confirmada",
        claseFecha: "2026-07-21",
      },
      {
        id: "4",
        usuario_id: "c",
        clase_id: "c1",
        estado: "asistio",
        claseFecha: "2026-07-21",
      },
    ];
    expect(countUniqueAthletesAttended(reservas)).toBe(2);
    expect(countAttendances(reservas)).toBe(3);
    expect(countTotalReservations(reservas)).toBe(4);
  });

  it("counts cancellations separately", () => {
    const reservas: ReportReservaRow[] = [
      {
        id: "1",
        usuario_id: "a",
        clase_id: "c1",
        estado: "cancelada",
        claseFecha: "2026-07-21",
      },
      {
        id: "2",
        usuario_id: "b",
        clase_id: "c1",
        estado: "asistio",
        claseFecha: "2026-07-21",
      },
    ];
    expect(countCancellations(reservas)).toBe(1);
    expect(countTotalReservations(reservas)).toBe(1);
  });

  it("excludes cancelled and future classes from held", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T18:00:00.000Z"));

    expect(
      isClassHeld(
        clase({
          id: "x",
          fecha: "2026-07-21",
          estado: "cancelada",
          hora_fin: "08:00:00",
        }),
        week,
        "America/Mexico_City",
        "2026-07-22"
      )
    ).toBe(false);

    expect(
      isClassHeld(
        clase({
          id: "y",
          fecha: "2026-07-25",
          hora_fin: "08:00:00",
        }),
        week,
        "America/Mexico_City",
        "2026-07-22"
      )
    ).toBe(false);

    expect(
      isClassHeld(
        clase({
          id: "z",
          fecha: "2026-07-21",
          hora_fin: "08:00:00",
        }),
        week,
        "America/Mexico_City",
        "2026-07-22"
      )
    ).toBe(true);
  });

  it("occupancy skips zero capacity", () => {
    expect(occupancyPct(5, 0)).toBeNull();
    expect(occupancyPct(6, 12)).toBe(50);
  });

  it("ranks constancy by attendance count", () => {
    const reservas: ReportReservaRow[] = [
      {
        id: "1",
        usuario_id: "u1",
        clase_id: "c",
        estado: "asistio",
        claseFecha: "2026-07-21",
      },
      {
        id: "2",
        usuario_id: "u1",
        clase_id: "c",
        estado: "asistio",
        claseFecha: "2026-07-22",
      },
      {
        id: "3",
        usuario_id: "u2",
        clase_id: "c",
        estado: "asistio",
        claseFecha: "2026-07-21",
      },
    ];
    const names = new Map([
      ["u1", "Ana"],
      ["u2", "Bob"],
    ]);
    const ranked = rankConstantAthletes(reservas, names, 5);
    expect(ranked[0]).toMatchObject({ nombre: "Ana", attendances: 2 });
  });

  it("finds inactive athletes with ≥10 days rule", () => {
    const inactive = findInactiveForReport(
      [{ id: "u1", nombre_completo: "Ana" }],
      new Map([["u1", "2026-07-10"]]),
      "2026-07-22",
      10
    );
    expect(inactive).toHaveLength(1);
    expect(inactive[0].daysSinceAttendance).toBe(12);
  });

  it("builds narrative from real metrics only", () => {
    const metrics = computeWeeklyReportMetrics({
      timeZone: "America/Mexico_City",
      today: "2026-07-22",
      week,
      previousWeek: prev,
      classesThisWeek: [
        clase({
          id: "c1",
          fecha: "2026-07-21",
          cupo_ocupado: 10,
          cupo_maximo: 12,
          hora_inicio: "19:00:00",
          hora_fin: "20:00:00",
        }),
      ],
      classesPrevWeek: [],
      reservasThisWeek: [
        {
          id: "r1",
          usuario_id: "u1",
          clase_id: "c1",
          estado: "asistio",
          claseFecha: "2026-07-21",
        },
      ],
      reservasPrevWeek: [],
      attendanceHistory: [
        {
          id: "r1",
          usuario_id: "u1",
          clase_id: "c1",
          estado: "asistio",
          claseFecha: "2026-07-21",
        },
      ],
      socios: [
        {
          id: "u1",
          nombre_completo: "Ana",
          estado_cuenta: "activo",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ] satisfies ReportSocioRow[],
      membershipByUser: new Map([
        [
          "u1",
          {
            usuario_id: "u1",
            estado: "vigente",
            fecha_fin: "2026-08-01",
          },
        ],
      ]),
      prs: [],
    });

    expect(metrics.uniqueAthletesAttended).toBe(1);
    expect(metrics.classesHeld).toBe(1);
    expect(metrics.narrative).toContain("asistieron 1");
    expect(buildWeeklyNarrative(metrics).length).toBeGreaterThan(10);
  });
});

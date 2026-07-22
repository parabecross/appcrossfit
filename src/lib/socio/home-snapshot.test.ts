import { describe, expect, it } from "vitest";
import {
  buildHomeProgressSnapshot,
  greetingPeriodFromHour,
  hasTrainingToday,
  pickLatestByRecordTipo,
  resolveHomeBookingContext,
} from "./home-snapshot";
import { findNextBookedClass } from "@/lib/reservas/next-booking";
import { addDaysToDateString, todayInTimezone } from "@/lib/dates/date-only";
import type { AtletaPrMarca, Clase, Reserva } from "@/types/database";

const baseMarca = {
  id: "1",
  box_id: "b",
  usuario_id: "u",
  ejercicio: "back_squat",
  valor: 100,
  unidad: "lbs" as const,
  fecha: "2026-07-10",
  notas: null,
  created_at: "2026-07-10T12:00:00Z",
  updated_at: "2026-07-10T12:00:00Z",
  rm_reps: null,
};

const baseClase = (id: string, fecha: string, hora = "18:00"): Clase => {
  const [hh, mm] = hora.slice(0, 5).split(":").map(Number);
  const endH = Math.min(hh + 1, 23);
  const horaFin = `${String(endH).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  return {
    id,
    nombre: `Class ${id}`,
    fecha,
    hora_inicio: hora,
    hora_fin: horaFin,
    estado: "programada",
    cupo_maximo: 12,
    cupo_ocupado: 0,
  } as Clase;
};

const reserva = (claseId: string, userId: string): Reserva =>
  ({
    id: `r-${claseId}`,
    clase_id: claseId,
    usuario_id: userId,
    estado: "confirmada",
  }) as Reserva;

describe("home-snapshot", () => {
  it("picks latest PR vs RM by record_tipo", () => {
    const marcas = [
      { ...baseMarca, id: "rm1", record_tipo: "rm" as const, rm_reps: 5, fecha: "2026-07-12" },
      { ...baseMarca, id: "pr1", record_tipo: "pr" as const, fecha: "2026-07-11" },
      { ...baseMarca, id: "pr0", record_tipo: "pr" as const, fecha: "2026-07-01" },
    ] as AtletaPrMarca[];
    expect(pickLatestByRecordTipo(marcas, "pr")?.id).toBe("pr1");
    expect(pickLatestByRecordTipo(marcas, "rm")?.id).toBe("rm1");
  });

  it("detects training today from next class fecha", () => {
    expect(hasTrainingToday("2026-07-15", "2026-07-15")).toBe(true);
    expect(hasTrainingToday("2026-07-16", "2026-07-15")).toBe(false);
    expect(hasTrainingToday(null, "2026-07-15")).toBe(false);
  });

  it("resolves header booking context from the same next-class fecha", () => {
    expect(resolveHomeBookingContext(null, "2026-07-15")).toBe("none");
    expect(resolveHomeBookingContext("2026-07-15", "2026-07-15")).toBe("today");
    expect(resolveHomeBookingContext("2026-07-16", "2026-07-15")).toBe(
      "upcoming"
    );
  });

  it("greeting periods", () => {
    expect(greetingPeriodFromHour(8)).toBe("morning");
    expect(greetingPeriodFromHour(15)).toBe("afternoon");
    expect(greetingPeriodFromHour(21)).toBe("evening");
  });

  it("builds progress snapshot counts", () => {
    const snap = buildHomeProgressSnapshot(
      [
        { ...baseMarca, record_tipo: "pr" } as AtletaPrMarca,
        {
          ...baseMarca,
          id: "2",
          record_tipo: "rm",
          rm_reps: 3,
        } as AtletaPrMarca,
      ],
      [
        {
          id: "s1",
          usuario_id: "u",
          box_id: "b",
          skill: "muscle_up",
          estado: "logrado",
          updated_at: "2026-07-01",
          created_at: "2026-07-01",
        } as never,
      ],
      {
        marcas: [],
        skills: [],
        objetivos: [],
        totalClasses: 0,
        uniqueTrainingDays: 0,
      }
    );
    expect(snap.prCount).toBe(1);
    expect(snap.lastRm?.id).toBe("2");
    expect(snap.skillCount).toBe(1);
  });
});

/**
 * Home class sections contract: next class + full schedule only.
 * “Clases disponibles” was removed; booking lives in WeeklyCalendar.
 */
describe("athlete home class sections", () => {
  const tz = "America/Mexico_City";
  const today = todayInTimezone(tz);
  const userId = "u1";

  it("with one future booking: shows next class context, not noBooking", () => {
    const tomorrow = addDaysToDateString(today, 1);
    const clases = [baseClase("c1", tomorrow, "06:00")];
    const reservas = [reserva("c1", userId)];
    const next = findNextBookedClass(clases, reservas, userId, tz);
    expect(next?.clase.id).toBe("c1");
    expect(
      resolveHomeBookingContext(next?.clase.fecha ?? null, today)
    ).toBe("upcoming");
    expect(resolveHomeBookingContext(next?.clase.fecha ?? null, today)).not.toBe(
      "none"
    );
  });

  it("without future bookings: no next class and noBooking context", () => {
    const clases = [baseClase("c1", addDaysToDateString(today, 1))];
    const reservas: Reserva[] = [];
    const next = findNextBookedClass(clases, reservas, userId, tz);
    expect(next).toBeNull();
    expect(resolveHomeBookingContext(null, today)).toBe("none");
  });

  it("with several future bookings: next class is the earliest", () => {
    const clases = [
      baseClase("later", addDaysToDateString(today, 3), "18:00"),
      baseClase("soon", addDaysToDateString(today, 1), "06:00"),
      baseClase("mid", addDaysToDateString(today, 2), "09:00"),
    ];
    const reservas = [
      reserva("later", userId),
      reserva("soon", userId),
      reserva("mid", userId),
    ];
    const next = findNextBookedClass(clases, reservas, userId, tz);
    expect(next?.clase.id).toBe("soon");
    const bookedIds = new Set(
      reservas.filter((r) => r.estado === "confirmada").map((r) => r.clase_id)
    );
    expect(bookedIds.has("soon")).toBe(true);
    expect(bookedIds.has("mid")).toBe(true);
    expect(bookedIds.has("later")).toBe(true);
  });

  it("today booking uses hasTraining context, not noBooking", () => {
    const clases = [baseClase("today", today, "23:30")];
    const reservas = [reserva("today", userId)];
    const next = findNextBookedClass(clases, reservas, userId, tz);
    expect(next?.clase.id).toBe("today");
    expect(
      resolveHomeBookingContext(next?.clase.fecha ?? null, today)
    ).toBe("today");
  });
});

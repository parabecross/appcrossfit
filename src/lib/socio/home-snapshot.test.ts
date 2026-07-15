import { describe, expect, it } from "vitest";
import {
  buildHomeProgressSnapshot,
  greetingPeriodFromHour,
  hasTrainingToday,
  pickAvailableClassesForHome,
  pickLatestByRecordTipo,
} from "./home-snapshot";
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

  it("greeting periods", () => {
    expect(greetingPeriodFromHour(8)).toBe("morning");
    expect(greetingPeriodFromHour(15)).toBe("afternoon");
    expect(greetingPeriodFromHour(21)).toBe("evening");
  });

  it("excludes booked, past, full, and non-programada classes", () => {
    const clases = [
      {
        id: "c1",
        nombre: "WOD",
        fecha: "2099-01-02",
        hora_inicio: "18:00",
        hora_fin: "19:00",
        estado: "programada",
        cupo_maximo: 10,
        cupo_ocupado: 3,
        coach_nombre: "Coach",
      },
      {
        id: "c2",
        nombre: "Booked",
        fecha: "2099-01-02",
        hora_inicio: "07:00",
        hora_fin: "08:00",
        estado: "programada",
        cupo_maximo: 10,
        cupo_ocupado: 1,
      },
      {
        id: "c3",
        nombre: "Full",
        fecha: "2099-01-03",
        hora_inicio: "09:00",
        hora_fin: "10:00",
        estado: "programada",
        cupo_maximo: 10,
        cupo_ocupado: 10,
      },
      {
        id: "c4",
        nombre: "Cancelled",
        fecha: "2099-01-03",
        hora_inicio: "11:00",
        hora_fin: "12:00",
        estado: "cancelada",
        cupo_maximo: 10,
        cupo_ocupado: 0,
      },
    ] as Clase[];

    const reservas = [
      {
        id: "r1",
        clase_id: "c2",
        usuario_id: "u1",
        estado: "confirmada",
      },
    ] as Reserva[];

    const available = pickAvailableClassesForHome(
      clases,
      reservas,
      "u1",
      "America/Mexico_City",
      5
    );
    expect(available.map((c) => c.id)).toEqual(["c1"]);
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

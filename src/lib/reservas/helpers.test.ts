import type { ReservaEstado } from "@/types/database";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_RESERVA_ESTADOS,
  countReservasForClase,
  countUpcomingActiveReservasForUser,
  hasReachedFutureReservaLimit,
  isActiveReserva,
  occupiedForSocioClass,
} from "./helpers";

describe("ACTIVE_RESERVA_ESTADOS", () => {
  it("matches the unified cupo rule", () => {
    expect(ACTIVE_RESERVA_ESTADOS).toEqual([
      "confirmada",
      "asistio",
      "no_asistio",
    ]);
  });
});

describe("isActiveReserva", () => {
  it("treats confirmada, asistio, no_asistio as active", () => {
    expect(isActiveReserva("confirmada")).toBe(true);
    expect(isActiveReserva("asistio")).toBe(true);
    expect(isActiveReserva("no_asistio")).toBe(true);
  });

  it("rejects cancelled states", () => {
    expect(isActiveReserva("cancelada")).toBe(false);
  });
});

describe("countReservasForClase", () => {
  it("counts only active reservas for the clase", () => {
    const reservas: { clase_id: string; estado: ReservaEstado }[] = [
      { clase_id: "c1", estado: "confirmada" },
      { clase_id: "c1", estado: "cancelada" },
      { clase_id: "c2", estado: "confirmada" },
      { clase_id: "c1", estado: "asistio" },
    ];
    expect(countReservasForClase(reservas, "c1")).toBe(2);
    expect(countReservasForClase(reservas, "c2")).toBe(1);
  });

  it("includes no_asistio in occupied cupo count", () => {
    const reservas: { clase_id: string; estado: ReservaEstado }[] = [
      { clase_id: "c1", estado: "no_asistio" },
      { clase_id: "c1", estado: "confirmada" },
      { clase_id: "c1", estado: "cancelada" },
    ];
    expect(countReservasForClase(reservas, "c1")).toBe(2);
  });

  it("does not count cancelada toward cupo", () => {
    const reservas: { clase_id: string; estado: ReservaEstado }[] = [
      { clase_id: "c1", estado: "cancelada" },
      { clase_id: "c1", estado: "cancelada" },
    ];
    expect(countReservasForClase(reservas, "c1")).toBe(0);
  });
});

describe("duplicate reserva detection (API uses ACTIVE_RESERVA_ESTADOS)", () => {
  type Ref = { clase_id: string; usuario_id: string; estado: ReservaEstado };

  function hasDuplicateActiveReserva(
    reservas: Ref[],
    claseId: string,
    profileId: string
  ): boolean {
    return reservas.some(
      (r) =>
        r.clase_id === claseId &&
        r.usuario_id === profileId &&
        isActiveReserva(r.estado)
    );
  }

  it("blocks a second booking when no_asistio already exists", () => {
    const reservas: Ref[] = [
      { clase_id: "c1", usuario_id: "u1", estado: "no_asistio" },
    ];
    expect(hasDuplicateActiveReserva(reservas, "c1", "u1")).toBe(true);
  });

  it("allows re-booking after cancelada", () => {
    const reservas: Ref[] = [
      { clase_id: "c1", usuario_id: "u1", estado: "cancelada" },
    ];
    expect(hasDuplicateActiveReserva(reservas, "c1", "u1")).toBe(false);
  });
});

describe("occupiedForSocioClass", () => {
  const profileId = "u1";
  type Ref = { clase_id: string; usuario_id: string; estado: ReservaEstado };

  it("returns base when unchanged", () => {
    const reservas: Ref[] = [
      { clase_id: "c1", usuario_id: profileId, estado: "confirmada" },
    ];
    expect(occupiedForSocioClass("c1", 3, reservas, reservas, profileId)).toBe(3);
  });

  it("adds one on optimistic book", () => {
    const server: Ref[] = [];
    const local: Ref[] = [
      { clase_id: "c1", usuario_id: profileId, estado: "confirmada" },
    ];
    expect(occupiedForSocioClass("c1", 2, local, server, profileId)).toBe(3);
  });

  it("subtracts one on optimistic cancel", () => {
    const server: Ref[] = [
      { clase_id: "c1", usuario_id: profileId, estado: "confirmada" },
    ];
    const local: Ref[] = [];
    expect(occupiedForSocioClass("c1", 3, local, server, profileId)).toBe(2);
  });

  it("treats no_asistio as an existing booking for optimistic cupo", () => {
    const reservas: Ref[] = [
      { clase_id: "c1", usuario_id: profileId, estado: "no_asistio" },
    ];
    expect(occupiedForSocioClass("c1", 4, reservas, reservas, profileId)).toBe(4);
  });

  it("reflects freed cupo when cancelada removes the booking", () => {
    const server: Ref[] = [
      { clase_id: "c1", usuario_id: profileId, estado: "confirmada" },
    ];
    const local: Ref[] = [
      { clase_id: "c1", usuario_id: profileId, estado: "cancelada" },
    ];
    expect(occupiedForSocioClass("c1", 5, local, server, profileId)).toBe(4);
  });
});

describe("countUpcomingActiveReservasForUser", () => {
  const tz = "America/Mexico_City";
  const profileId = "u1";
  const clasesById = new Map([
    ["c-future-1", { fecha: "2099-06-01", hora_fin: "08:00" }],
    ["c-future-2", { fecha: "2099-06-02", hora_fin: "08:00" }],
    ["c-future-3", { fecha: "2099-06-03", hora_fin: "08:00" }],
    ["c-past", { fecha: "2020-01-01", hora_fin: "08:00" }],
  ]);

  it("counts only future active reservas for the user", () => {
    const reservas: {
      clase_id: string;
      usuario_id: string;
      estado: ReservaEstado;
    }[] = [
      { clase_id: "c-future-1", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-past", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-future-2", usuario_id: profileId, estado: "cancelada" },
      { clase_id: "c-future-3", usuario_id: "other", estado: "confirmada" },
    ];
    expect(
      countUpcomingActiveReservasForUser(reservas, profileId, clasesById, tz)
    ).toBe(1);
  });

  it("reaches limit at 3 upcoming reservas", () => {
    const reservas: {
      clase_id: string;
      usuario_id: string;
      estado: ReservaEstado;
    }[] = [
      { clase_id: "c-future-1", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-future-2", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-future-3", usuario_id: profileId, estado: "confirmada" },
    ];
    expect(
      hasReachedFutureReservaLimit(reservas, profileId, clasesById, tz, 3)
    ).toBe(true);
    expect(
      hasReachedFutureReservaLimit(reservas, profileId, clasesById, tz, 4)
    ).toBe(false);
  });

  it("does not count confirmada when clase is absent from clasesById (past horizon)", () => {
    const reservas: {
      clase_id: string;
      usuario_id: string;
      estado: ReservaEstado;
    }[] = [
      { clase_id: "c-missing-past", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-future-1", usuario_id: profileId, estado: "confirmada" },
    ];
    const sparseClases = new Map([
      ["c-future-1", { fecha: "2099-06-01", hora_fin: "08:00" }],
    ]);
    expect(
      countUpcomingActiveReservasForUser(reservas, profileId, sparseClases, tz)
    ).toBe(1);
  });

  it("does not block limit when only missing-from-map reservas would exceed cap", () => {
    const reservas: {
      clase_id: string;
      usuario_id: string;
      estado: ReservaEstado;
    }[] = [
      { clase_id: "c-missing-1", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-missing-2", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-missing-3", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-future-1", usuario_id: profileId, estado: "confirmada" },
    ];
    const sparseClases = new Map([
      ["c-future-1", { fecha: "2099-06-01", hora_fin: "08:00" }],
    ]);
    expect(
      hasReachedFutureReservaLimit(reservas, profileId, sparseClases, tz, 3)
    ).toBe(false);
  });

  it("still counts future reserva when clase is in clasesById (optimistic book path)", () => {
    const reservas: {
      clase_id: string;
      usuario_id: string;
      estado: ReservaEstado;
    }[] = [
      { clase_id: "c-future-1", usuario_id: profileId, estado: "confirmada" },
      { clase_id: "c-future-2", usuario_id: profileId, estado: "confirmada" },
    ];
    expect(
      countUpcomingActiveReservasForUser(reservas, profileId, clasesById, tz)
    ).toBe(2);
  });
});

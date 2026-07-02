import type { ReservaEstado } from "@/types/database";
import { describe, expect, it } from "vitest";
import {
  ACTIVE_RESERVA_ESTADOS,
  countReservasForClase,
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

import type { ReservaEstado } from "@/types/database";
import { describe, expect, it } from "vitest";
import { countReservasForClase, isActiveReserva, occupiedForSocioClass } from "./helpers";

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
});

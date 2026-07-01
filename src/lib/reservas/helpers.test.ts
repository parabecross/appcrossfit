import type { ReservaEstado } from "@/types/database";
import { describe, expect, it } from "vitest";
import { countReservasForClase, isActiveReserva } from "./helpers";

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

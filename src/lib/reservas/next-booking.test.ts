import { describe, expect, it } from "vitest";
import { findNextBookedClass } from "./next-booking";
import type { Clase, Reserva } from "@/types/database";

const baseClase = (id: string, fecha: string, hora = "18:00"): Clase =>
  ({
    id,
    nombre: `Class ${id}`,
    fecha,
    hora_inicio: hora,
    hora_fin: "19:00",
    estado: "programada",
    cupo_maximo: 12,
    cupo_ocupado: 0,
  }) as Clase;

const reserva = (claseId: string, userId: string): Reserva =>
  ({
    id: `r-${claseId}`,
    clase_id: claseId,
    usuario_id: userId,
    estado: "confirmada",
  }) as Reserva;

describe("findNextBookedClass", () => {
  it("returns earliest upcoming confirmed booking", () => {
    const userId = "u1";
    const clases = [
      baseClase("c2", "2099-06-02"),
      baseClase("c1", "2099-06-01", "07:00"),
    ];
    const reservas = [reserva("c2", userId), reserva("c1", userId)];
    const next = findNextBookedClass(clases, reservas, userId);
    expect(next?.clase.id).toBe("c1");
  });

  it("ignores cancelled and past classes", () => {
    const userId = "u1";
    const clases = [baseClase("c1", "2020-01-01")];
    const reservas = [
      { ...reserva("c1", userId), estado: "cancelada" as const },
    ];
    expect(findNextBookedClass(clases, reservas, userId)).toBeNull();
  });

  it("ignores optimistic temp reservations", () => {
    const userId = "u1";
    const clases = [baseClase("c1", "2099-06-01")];
    const reservas = [
      { ...reserva("c1", userId), id: "temp-123" },
    ];
    expect(findNextBookedClass(clases, reservas, userId)).toBeNull();
  });
});

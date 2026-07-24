import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyLocalCancel,
  isCancelInFlight,
  mergeServerReservasPreservingLocalCancels,
  requestCancelReserva,
  resetCancelFlowForTests,
  shouldApplyCancelOutcome,
  subscribeCancelInFlight,
} from "./cancel-flow";
import { occupiedForSocioClass } from "./helpers";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  resetCancelFlowForTests();
});

describe("requestCancelReserva", () => {
  it("doble clic en el mismo botón → 1 PATCH", async () => {
    const gate = deferred<Response>();
    const fetchImpl = vi.fn().mockReturnValue(gate.promise);

    const first = requestCancelReserva({ reservaId: "r1", fetchImpl });
    const second = requestCancelReserva({ reservaId: "r1", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(isCancelInFlight("r1")).toBe(true);

    gate.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual({ started: true, ok: true, requestId: expect.any(Number) });
    expect(b).toEqual({ started: false });
    expect(isCancelInFlight("r1")).toBe(false);
  });

  it("clic casi simultáneo desde dos componentes → 1 PATCH", async () => {
    const gate = deferred<Response>();
    const fetchImpl = vi.fn().mockReturnValue(gate.promise);

    // Simula WeeklyCalendar + AthleteNextClassCard en el mismo tick
    const fromCalendar = requestCancelReserva({
      reservaId: "shared",
      fetchImpl,
    });
    const fromNextCard = requestCancelReserva({
      reservaId: "shared",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);

    gate.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const outcomes = await Promise.all([fromCalendar, fromNextCard]);
    const started = outcomes.filter((o) => o.started);
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({ ok: true });
  });

  it("éxito → ok y libera el lock (un solo refresh lo decide el caller)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const outcome = await requestCancelReserva({
      reservaId: "r-ok",
      fetchImpl,
    });
    expect(outcome).toMatchObject({ started: true, ok: true });
    expect(isCancelInFlight("r-ok")).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "PATCH" });
  });

  it("error → conserva posibilidad de reintentar", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "No se pudo cancelar" }), {
          status: 400,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 })
      );

    const fail = await requestCancelReserva({
      reservaId: "r-err",
      fetchImpl,
    });
    expect(fail).toMatchObject({
      started: true,
      ok: false,
      message: "No se pudo cancelar",
    });
    expect(isCancelInFlight("r-err")).toBe(false);

    const retry = await requestCancelReserva({
      reservaId: "r-err",
      fetchImpl,
    });
    expect(retry).toMatchObject({ started: true, ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("respuesta retrasada → el cupo no sube (solo baja tras applyLocalCancel)", async () => {
    const gate = deferred<Response>();
    const fetchImpl = vi.fn().mockReturnValue(gate.promise);

    const profileId = "u1";
    const claseId = "c1";
    const baseOccupied = 2;
    let local: Array<{
      id: string;
      clase_id: string;
      usuario_id: string;
      estado: "confirmada" | "cancelada";
    }> = [
      {
        id: "r1",
        clase_id: claseId,
        usuario_id: profileId,
        estado: "confirmada",
      },
    ];
    const server = [...local];

    expect(
      occupiedForSocioClass(claseId, baseOccupied, local, server, profileId)
    ).toBe(2);

    const pending = requestCancelReserva({ reservaId: "r1", fetchImpl });

    // Mientras vuela el PATCH, no tocamos el estado local → cupo estable
    expect(
      occupiedForSocioClass(claseId, baseOccupied, local, server, profileId)
    ).toBe(2);

    gate.resolve(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const outcome = await pending;
    expect(outcome.started && outcome.ok).toBe(true);

    local = applyLocalCancel(local, "r1");
    expect(
      occupiedForSocioClass(claseId, baseOccupied, local, server, profileId)
    ).toBe(1);
  });

  it("dos respuestas fuera de orden no restauran una reserva cancelada", () => {
    const local = applyLocalCancel(
      [
        {
          id: "r1",
          clase_id: "c1",
          usuario_id: "u1",
          estado: "confirmada",
        },
      ],
      "r1"
    );

    const staleServer = [
      {
        id: "r1",
        clase_id: "c1",
        usuario_id: "u1",
        estado: "confirmada",
      },
    ];

    const merged = mergeServerReservasPreservingLocalCancels(
      local,
      staleServer
    );
    expect(merged[0].estado).toBe("cancelada");

    // Cuando el servidor ya confirma cancelada, se acepta
    const confirmed = mergeServerReservasPreservingLocalCancels(local, [
      { ...staleServer[0], estado: "cancelada" },
    ]);
    expect(confirmed[0].estado).toBe("cancelada");
  });

  it("notifica suscriptores al entrar/salir del lock", async () => {
    const ticks: boolean[] = [];
    const unsub = subscribeCancelInFlight(() => {
      ticks.push(isCancelInFlight("r-sub"));
    });

    const gate = deferred<Response>();
    const fetchImpl = vi.fn().mockReturnValue(gate.promise);
    const pending = requestCancelReserva({ reservaId: "r-sub", fetchImpl });
    expect(ticks[0]).toBe(true);

    gate.resolve(new Response("{}", { status: 200 }));
    await pending;
    expect(ticks.at(-1)).toBe(false);
    unsub();
  });

  it("shouldApplyCancelOutcome solo acepta el requestId vigente", async () => {
    const gate = deferred<Response>();
    const fetchImpl = vi.fn().mockReturnValue(gate.promise);
    const pending = requestCancelReserva({ reservaId: "r-id", fetchImpl });

    // requestId 1 está in-flight
    expect(shouldApplyCancelOutcome("r-id", 1)).toBe(true);
    expect(shouldApplyCancelOutcome("r-id", 99)).toBe(false);

    gate.resolve(new Response("{}", { status: 200 }));
    const outcome = await pending;
    if (!outcome.started || !outcome.ok) throw new Error("expected ok");
    expect(shouldApplyCancelOutcome("r-id", outcome.requestId)).toBe(true);
  });
});

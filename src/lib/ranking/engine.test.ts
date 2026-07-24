import { describe, expect, it } from "vitest";
import { revokeAttendanceRanking } from "./engine";

type Row = Record<string, unknown>;

function makeTable(rows: Row[], onEq?: (col: string, val: unknown) => void) {
  let filtered = [...rows];
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => {
      onEq?.(col, val);
      if (col.includes(".")) {
        const [rel, nested] = col.split(".");
        filtered = filtered.filter(
          (r) => (r[rel] as Row | undefined)?.[nested] === val
        );
      } else {
        filtered = filtered.filter((r) => r[col] === val);
      }
      return builder;
    },
    in: (col: string, vals: unknown[]) => {
      filtered = filtered.filter((r) => vals.includes(r[col]));
      return builder;
    },
    lt: () => builder,
    order: () => builder,
    limit: (n: number) => {
      filtered = filtered.slice(0, n);
      return builder;
    },
    delete: () => builder,
    insert: async () => ({ data: null, error: null }),
    upsert: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
    single: async () => ({ data: filtered[0] ?? null, error: null }),
    then: (resolve: (v: { data: Row[]; error: null }) => void) =>
      resolve({ data: filtered, error: null }),
  };
  return builder;
}

/**
 * Simula un box con una reserva "r1" (usuario u1, clase c1) marcada "asistio",
 * y un score de esa clase para el mismo usuario. No hace falta simular la
 * lógica completa de ranking (ya cubierta por otros tests) — solo probar que
 * revokeAttendanceRanking intenta re-sincronizar el WOD de esa clase tras el
 * recompute, en vez de dejar los puntos WOD borrados para siempre.
 */
function buildAdminMock(claseScoresQueried: Array<{ clase_id: unknown; usuario_id: unknown }>) {
  const reservaRow = {
    id: "r1",
    usuario_id: "u1",
    clase_id: "c1",
    estado: "asistio",
    clase: { id: "c1", fecha: "2026-07-10", box_id: "box-a" },
  };

  return {
    from: (table: string) => {
      if (table === "reservas") return makeTable([reservaRow]);
      if (table === "ranking_point_events") return makeTable([]);
      if (table === "ranking_config") return makeTable([]);
      if (table === "clase_scores") {
        let claseIdVal: unknown;
        let usuarioIdVal: unknown;
        const table_ = makeTable([], (col, val) => {
          if (col === "clase_id") claseIdVal = val;
          if (col === "usuario_id") usuarioIdVal = val;
        });
        const originalMaybeSingle = table_.maybeSingle;
        table_.maybeSingle = async () => {
          claseScoresQueried.push({ clase_id: claseIdVal, usuario_id: usuarioIdVal });
          return originalMaybeSingle();
        };
        return table_;
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("revokeAttendanceRanking (regresión: pérdida de puntos WOD)", () => {
  it("re-sincroniza el WOD de cada clase recomputada tras revocar, no solo asistencia/racha", async () => {
    const claseScoresQueried: Array<{ clase_id: unknown; usuario_id: unknown }> = [];
    const admin = buildAdminMock(claseScoresQueried);

    await revokeAttendanceRanking({
      reservaId: "r1",
      admin: admin as never,
    });

    // Antes del fix: el loop de recompute solo llamaba awardAttendance,
    // nunca consultaba clase_scores de nuevo → los puntos WOD borrados por
    // este mismo revoke quedaban perdidos para siempre en cuanto se
    // re-marcaba "asistió".
    expect(claseScoresQueried).toContainEqual({
      clase_id: "c1",
      usuario_id: "u1",
    });
  });
});

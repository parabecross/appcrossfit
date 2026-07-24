import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Este entorno no tiene una base de datos Postgres/Supabase real disponible
 * (ni en CI ni en sandbox), así que estas pruebas NO ejecutan las políticas
 * RLS de verdad. Son un guardrail estático sobre el texto del SQL fuente:
 * detectan si alguien vuelve a introducir el patrón vulnerable ya corregido
 * (p.ej. copiando un bloque viejo de vuelta). No reemplazan una verificación
 * real contra una base de datos de prueba (`npm run check-isolation`).
 */
const sql = readFileSync(
  path.resolve(__dirname, "../../../supabase/CONSOLIDADO-rls-multitenant.sql"),
  "utf-8"
);

function policyBlock(policyName: string, sourceSql: string): string {
  const marker = `CREATE POLICY "${policyName}"`;
  const start = sourceSql.indexOf(marker);
  if (start === -1) {
    throw new Error(`Policy "${policyName}" not found in CONSOLIDADO SQL`);
  }
  // Corta en el siguiente "DROP POLICY" o fin de bloque razonable.
  const nextDrop = sourceSql.indexOf("DROP POLICY", start);
  const end = nextDrop === -1 ? sourceSql.length : nextDrop;
  return sourceSql.slice(start, end);
}

describe("CONSOLIDADO-rls-multitenant.sql — regresión de hallazgos de auditoría", () => {
  it("reservas_update_own_or_admin tiene WITH CHECK (antes: solo USING, sin restricción en la fila nueva)", () => {
    const block = policyBlock("reservas_update_own_or_admin", sql);
    expect(block).toMatch(/WITH CHECK/);
    // El auto-servicio del socio debe quedar acotado a cancelar dentro de su propio box.
    expect(block).toMatch(/estado = 'cancelada'/);
    expect(block).toMatch(/c\.box_id = get_my_box_id\(\)/);
  });

  it("clase_scores_insert_own valida que la clase pertenezca al box del socio", () => {
    const block = policyBlock("clase_scores_insert_own", sql);
    expect(block).toMatch(/WITH CHECK/);
    expect(block).toMatch(/c\.box_id = get_my_box_id\(\)/);
  });

  it("clase_scores_update_own valida que la clase pertenezca al box del socio", () => {
    const block = policyBlock("clase_scores_update_own", sql);
    expect(block).toMatch(/WITH CHECK/);
    expect(block).toMatch(/c\.box_id = get_my_box_id\(\)/);
  });

  it("no vuelve a crear ranking_events_insert_service con WITH CHECK (true)", () => {
    // Antes: CONSOLIDADO recreaba esta policy con WITH CHECK (true) sin TO
    // service_role, permitiendo INSERT directo a cualquier authenticated/anon.
    expect(sql).not.toMatch(
      /CREATE POLICY "ranking_events_insert_service"[\s\S]{0,120}WITH CHECK \(true\)/
    );
  });

  it("ranking_events_select ya no tiene ramas sin scoping por box/caller", () => {
    const block = policyBlock("ranking_events_select", sql);
    expect(block).not.toMatch(/is_coach_or_admin\(\)/);
    expect(block).not.toMatch(/b\.status = 'active'/);
    expect(block).toMatch(/me\.box_id = ranking_point_events\.box_id/);
  });

  it("ranking_awards_select exige pertenencia al box, no solo box activo o rol global", () => {
    const block = policyBlock("ranking_awards_select", sql);
    expect(block).not.toMatch(/b\.status = 'active'/);
    expect(block).toMatch(/me\.box_id = ranking_monthly_awards\.box_id/);
  });

  it("ranking_awards_admin exige que el coach/admin pertenezca al box del premio", () => {
    const block = policyBlock("ranking_awards_admin", sql);
    expect(block).toMatch(/me\.box_id = ranking_monthly_awards\.box_id/);
  });

  it("ranking_config_admin exige que el coach/admin pertenezca al box de la config", () => {
    const block = policyBlock("ranking_config_admin", sql);
    expect(block).toMatch(/me\.box_id = ranking_config\.box_id/);
  });
});

describe("profiles — regresión (auto-escalación de privilegios en UPDATE)", () => {
  it("existe un trigger BEFORE UPDATE que resetea rol/box_id/is_super_admin/estado_cuenta en auto-edición", () => {
    const start = sql.indexOf(
      "CREATE OR REPLACE FUNCTION prevent_profile_self_privilege_escalation"
    );
    expect(start).toBeGreaterThan(-1);
    const body = sql.slice(start, start + 900);

    expect(body).toMatch(/auth\.uid\(\) = OLD\.user_id/);
    expect(body).toMatch(/NEW\.rol := OLD\.rol/);
    expect(body).toMatch(/NEW\.box_id := OLD\.box_id/);
    expect(body).toMatch(/NEW\.is_super_admin := OLD\.is_super_admin/);
    expect(body).toMatch(/NEW\.estado_cuenta := OLD\.estado_cuenta/);
  });

  it("el trigger está creado BEFORE UPDATE sobre profiles", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_prevent_profile_self_privilege_escalation\s+BEFORE UPDATE ON profiles/
    );
  });
});

describe("clases_cupo_ocupado — regresión (RPC SECURITY DEFINER sin validar box del caller)", () => {
  const files = [
    "../../../supabase/migration-reserva-cupo-counts-no-asistio.sql",
    "../../../supabase/patch-clase-cupo-socio.sql",
  ];

  for (const file of files) {
    it(`${file} valida que el caller pertenezca al box de la clase`, () => {
      const content = readFileSync(path.resolve(__dirname, file), "utf-8");
      const start = content.indexOf("CREATE OR REPLACE FUNCTION public.clases_cupo_ocupado");
      expect(start).toBeGreaterThan(-1);
      const body = content.slice(start, start + 1000);
      expect(body).toMatch(/auth\.uid\(\) IS NULL/);
      expect(body).toMatch(/me\.user_id = auth\.uid\(\)/);
      expect(body).toMatch(/me\.box_id = c\.box_id/);
    });
  }
});

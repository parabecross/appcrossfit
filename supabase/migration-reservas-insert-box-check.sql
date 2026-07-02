-- ─── Reservas INSERT: validar clase pertenece al box del socio ────────────────
-- Problema: reservas_insert_own solo exigía usuario_id = get_my_profile_id().
-- Un socio podía reservar cualquier clase_id si conocía el UUID.
--
-- Solución: WITH CHECK adicional vía clases.box_id (sin depender de coach_id).
--
-- Aplicar manualmente en el SQL Editor de Supabase. NO ejecutar desde CI ni scripts.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "reservas_insert_own" ON reservas;
CREATE POLICY "reservas_insert_own"
  ON reservas FOR INSERT
  WITH CHECK (
    usuario_id = get_my_profile_id()
    AND EXISTS (
      SELECT 1
      FROM clases c
      WHERE c.id = reservas.clase_id
        AND c.box_id = get_my_box_id()
    )
  );

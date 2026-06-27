-- Aislamiento SELECT en clases por box_id del coach.
-- Vulnerabilidad: clases_select_authenticated usaba USING (true), así que cualquier
-- usuario autenticado de cualquier box podía leer las clases de todos los boxes
-- al consultar la tabla directamente (aunque la app filtre en queries).
-- Criterio coach_id NULL: igual que clases_admin_all — clases huérfanas visibles.
-- Usa get_my_box_id() e is_super_admin() de migration-athron-fase1.sql.

DROP POLICY IF EXISTS "clases_select_authenticated" ON clases;
CREATE POLICY "clases_select_authenticated"
  ON clases FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR clases.coach_id IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = clases.coach_id
        AND p.box_id = get_my_box_id()
    )
  );

-- ─── Verificación manual ──────────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'clases'
ORDER BY policyname;

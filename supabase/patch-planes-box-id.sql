-- Planes por box (multi-tenant): cada gym tiene su propio catálogo de membresías.
-- Corrige filtración cross-box: planes era global y cualquier admin editaba el catálogo de todos.
-- Ejecutar en Supabase SQL Editor. Usa get_my_box_id() e is_super_admin() existentes.

ALTER TABLE planes ADD COLUMN IF NOT EXISTS box_id UUID REFERENCES boxes(id);

UPDATE planes
SET box_id = (SELECT id FROM boxes WHERE slug = 'parabellum-cross' LIMIT 1)
WHERE box_id IS NULL;

ALTER TABLE planes ALTER COLUMN box_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planes_box_id ON planes(box_id);

-- Vulnerabilidad: todos los boxes veían y compartían los mismos planes activos.
DROP POLICY IF EXISTS "planes_select_all_authenticated" ON planes;
CREATE POLICY "planes_select_all_authenticated"
  ON planes FOR SELECT
  TO authenticated
  USING (
    (activo = true AND box_id = get_my_box_id())
    OR (is_admin() AND box_id = get_my_box_id())
    OR is_super_admin()
  );

-- Vulnerabilidad: admin de Box A creaba/editaba/borraba planes usados por Box B.
DROP POLICY IF EXISTS "planes_admin_all" ON planes;
CREATE POLICY "planes_admin_all"
  ON planes FOR ALL
  USING (
    (is_admin() AND box_id = get_my_box_id())
    OR is_super_admin()
  )
  WITH CHECK (
    (is_admin() AND box_id = get_my_box_id())
    OR is_super_admin()
  );

-- ─── Verificación manual ──────────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'planes'
ORDER BY policyname;

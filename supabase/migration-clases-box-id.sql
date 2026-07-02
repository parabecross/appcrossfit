-- ─── Tenant explícito en clases: box_id ───────────────────────────────────────
-- Problema: clases sin coach_id eran editables por cualquier admin (bypass RLS).
-- Solución: columna box_id + políticas que validan get_my_box_id().
--
-- Aplicar manualmente en el SQL Editor de Supabase. NO ejecutar desde CI ni scripts.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Columna tenant
ALTER TABLE clases ADD COLUMN IF NOT EXISTS box_id uuid REFERENCES boxes(id);

CREATE INDEX IF NOT EXISTS idx_clases_box_id ON clases(box_id);

-- 2. Backfill: clases con coach → box del coach
UPDATE clases c
SET box_id = p.box_id
FROM profiles p
WHERE c.coach_id = p.id
  AND c.box_id IS NULL;

-- 3. Clases sin coach_id: NO asumir box — permanecen con box_id NULL
--    Resolver manualmente antes de aplicar NOT NULL (ver comentario al final).

-- 4. Políticas RLS de clases (solo estas tres)
DROP POLICY IF EXISTS "clases_admin_all" ON clases;
CREATE POLICY "clases_admin_all"
  ON clases FOR ALL
  USING (
    (is_admin() AND clases.box_id = get_my_box_id())
    OR is_super_admin()
  )
  WITH CHECK (
    (is_admin() AND clases.box_id = get_my_box_id())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "clases_select_authenticated" ON clases;
CREATE POLICY "clases_select_authenticated"
  ON clases FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR clases.box_id = get_my_box_id()
  );

DROP POLICY IF EXISTS "clases_public_ranking" ON clases;
CREATE POLICY "clases_public_ranking"
  ON clases FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM boxes b
      WHERE b.id = clases.box_id
        AND b.status = 'active'
    )
  );

-- 5. Verificación: clases huérfanas (sin box_id asignado)
SELECT id, nombre, fecha, coach_id
FROM clases
WHERE box_id IS NULL
ORDER BY fecha DESC;

-- Ejecutar solo después de resolver manualmente clases huérfanas:
-- ALTER TABLE clases ALTER COLUMN box_id SET NOT NULL;

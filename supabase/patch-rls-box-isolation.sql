-- Aislamiento multi-tenant por box_id en RLS (profiles, membresias, clases, reservas).
-- Corrige filtraciones cross-box: admins/coaches del Box A podían leer/escribir datos del Box B.
-- Ejecutar en Supabase SQL Editor. Usa get_my_box_id() de migration-athron-fase1.sql.

-- ─── 1. profiles SELECT (staff) ───────────────────────────────────────────────
-- Vulnerabilidad: is_coach_or_admin() sin box permitía listar perfiles de cualquier gym.
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON profiles;
CREATE POLICY "profiles_select_own_or_staff"
  ON profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR (is_coach_or_admin() AND box_id = get_my_box_id())
  );

-- ─── 2. profiles UPDATE (admin) ─────────────────────────────────────────────
-- Vulnerabilidad: is_admin() sin box permitía editar perfiles de otros boxes.
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (is_admin() AND box_id = get_my_box_id())
  );

-- ─── 3. profiles SELECT coaches/admins del propio box ─────────────────────────
-- Vulnerabilidad: socios veían coaches/admins de todos los boxes.
DROP POLICY IF EXISTS "profiles_select_coaches" ON profiles;
CREATE POLICY "profiles_select_coaches"
  ON profiles FOR SELECT
  USING (
    rol IN ('coach', 'admin', 'box_admin')
    AND box_id = get_my_box_id()
  );

-- ─── 4. membresias SELECT (admin) ─────────────────────────────────────────────
-- Vulnerabilidad: admin veía membresías de socios de cualquier box.
DROP POLICY IF EXISTS "membresias_select_own_or_admin" ON membresias;
CREATE POLICY "membresias_select_own_or_admin"
  ON membresias FOR SELECT
  USING (
    usuario_id = get_my_profile_id()
    OR (
      is_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = membresias.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

-- ─── 5. membresias ALL (admin) ────────────────────────────────────────────────
-- Vulnerabilidad: admin gestionaba membresías cross-box (INSERT/UPDATE/DELETE).
DROP POLICY IF EXISTS "membresias_admin_all" ON membresias;
CREATE POLICY "membresias_admin_all"
  ON membresias FOR ALL
  USING (
    is_admin()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = membresias.usuario_id
        AND p.box_id = get_my_box_id()
    )
  )
  WITH CHECK (
    is_admin()
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = membresias.usuario_id
        AND p.box_id = get_my_box_id()
    )
  );

-- ─── 6. clases ALL (admin) ──────────────────────────────────────────────────
-- Vulnerabilidad: admin creaba/editaba/borraba clases de coaches de otros boxes.
-- Nota: coach_id NULL se permite (clase huérfana); revisar si el negocio debe bloquearlo.
DROP POLICY IF EXISTS "clases_admin_all" ON clases;
CREATE POLICY "clases_admin_all"
  ON clases FOR ALL
  USING (
    is_admin()
    AND (
      clases.coach_id IS NULL
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = clases.coach_id
          AND p.box_id = get_my_box_id()
      )
    )
  )
  WITH CHECK (
    is_admin()
    AND (
      clases.coach_id IS NULL
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = clases.coach_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

-- ─── 7. reservas SELECT / UPDATE (admin) ──────────────────────────────────────
-- Vulnerabilidad: admin veía/modificaba reservas de socios de otros boxes.
DROP POLICY IF EXISTS "reservas_select_own_or_admin" ON reservas;
CREATE POLICY "reservas_select_own_or_admin"
  ON reservas FOR SELECT
  USING (
    usuario_id = get_my_profile_id()
    OR (
      is_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = reservas.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

DROP POLICY IF EXISTS "reservas_update_own_or_admin" ON reservas;
CREATE POLICY "reservas_update_own_or_admin"
  ON reservas FOR UPDATE
  USING (
    usuario_id = get_my_profile_id()
    OR (
      is_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = reservas.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

-- ─── Verificación manual ──────────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'membresias', 'clases', 'reservas')
ORDER BY tablename, policyname;

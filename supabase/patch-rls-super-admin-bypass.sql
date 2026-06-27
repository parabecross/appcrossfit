-- Bypass RLS para super admin de plataforma (is_super_admin = true).
-- Corrige regresión de patch-rls-box-isolation.sql: el super admin administra todos
-- los boxes desde /admin-athron pero get_my_box_id() apunta solo a su box fijo.
-- Ejecutar DESPUÉS de patch-rls-box-isolation.sql.
-- Usa is_super_admin() de migration-athron-fase1.sql (no redefinir).

-- ─── 1. profiles SELECT (staff) ───────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON profiles;
CREATE POLICY "profiles_select_own_or_staff"
  ON profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR (is_coach_or_admin() AND box_id = get_my_box_id())
    OR is_super_admin()
  );

-- ─── 2. profiles UPDATE (admin) ─────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (is_admin() AND box_id = get_my_box_id())
    OR is_super_admin()
  );

-- ─── 3. profiles SELECT coaches/admins ────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_coaches" ON profiles;
CREATE POLICY "profiles_select_coaches"
  ON profiles FOR SELECT
  USING (
    (
      rol IN ('coach', 'admin', 'box_admin')
      AND box_id = get_my_box_id()
    )
    OR is_super_admin()
  );

-- ─── 4. membresias SELECT (admin) ─────────────────────────────────────────────
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
    OR is_super_admin()
  );

-- ─── 5. membresias ALL (admin) ────────────────────────────────────────────────
DROP POLICY IF EXISTS "membresias_admin_all" ON membresias;
CREATE POLICY "membresias_admin_all"
  ON membresias FOR ALL
  USING (
    (
      is_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = membresias.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
    OR is_super_admin()
  )
  WITH CHECK (
    (
      is_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = membresias.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
    OR is_super_admin()
  );

-- ─── 6. clases ALL (admin) ──────────────────────────────────────────────────
-- coach_id NULL sigue permitido para admins de box; super admin también.
DROP POLICY IF EXISTS "clases_admin_all" ON clases;
CREATE POLICY "clases_admin_all"
  ON clases FOR ALL
  USING (
    (
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
    OR is_super_admin()
  )
  WITH CHECK (
    (
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
    OR is_super_admin()
  );

-- ─── 7. reservas SELECT / UPDATE (admin) ──────────────────────────────────────
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
    OR is_super_admin()
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
    OR is_super_admin()
  );

-- ─── Verificación manual ──────────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'membresias', 'clases', 'reservas')
ORDER BY tablename, policyname;

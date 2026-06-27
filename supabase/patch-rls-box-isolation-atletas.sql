-- Aislamiento multi-tenant por box_id en tablas de progreso/atleta y scores.
-- Corrige filtraciones cross-box: is_coach_or_admin() sin box permitía leer datos
-- de atletas de cualquier gym (mismo patrón que patch-rls-box-isolation.sql).
-- Incluye OR is_super_admin() desde el inicio para evitar regresión en plataforma.
-- Ejecutar en Supabase SQL Editor. Usa get_my_box_id() e is_super_admin() existentes.

-- ─── 1. atleta_pr_marcas SELECT ───────────────────────────────────────────────
-- Vulnerabilidad: coach/admin veía PRs de atletas de otros boxes.
DROP POLICY IF EXISTS "atleta_pr_select" ON atleta_pr_marcas;
CREATE POLICY "atleta_pr_select"
  ON atleta_pr_marcas FOR SELECT
  USING (
    usuario_id = get_my_profile_id()
    OR is_super_admin()
    OR (
      is_coach_or_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = atleta_pr_marcas.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

-- ─── 2. atleta_skills SELECT ──────────────────────────────────────────────────
-- Vulnerabilidad: coach/admin veía skills de atletas de otros boxes.
DROP POLICY IF EXISTS "atleta_skills_select" ON atleta_skills;
CREATE POLICY "atleta_skills_select"
  ON atleta_skills FOR SELECT
  USING (
    usuario_id = get_my_profile_id()
    OR is_super_admin()
    OR (
      is_coach_or_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = atleta_skills.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

-- ─── 3. atleta_skill_historial SELECT ─────────────────────────────────────────
-- Vulnerabilidad: coach/admin veía historial de skills cross-box.
DROP POLICY IF EXISTS "atleta_skill_hist_select" ON atleta_skill_historial;
CREATE POLICY "atleta_skill_hist_select"
  ON atleta_skill_historial FOR SELECT
  USING (
    usuario_id = get_my_profile_id()
    OR is_super_admin()
    OR (
      is_coach_or_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = atleta_skill_historial.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

-- ─── 4. atleta_objetivos SELECT ───────────────────────────────────────────────
-- Vulnerabilidad: coach/admin veía objetivos de atletas de otros boxes.
DROP POLICY IF EXISTS "atleta_objetivos_select" ON atleta_objetivos;
CREATE POLICY "atleta_objetivos_select"
  ON atleta_objetivos FOR SELECT
  USING (
    usuario_id = get_my_profile_id()
    OR is_super_admin()
    OR (
      is_coach_or_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = atleta_objetivos.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

-- ─── 5. atleta_perfil_deportivo SELECT ─────────────────────────────────────────
-- Vulnerabilidad: coach/admin veía perfil deportivo cross-box (Legacy, ranking).
DROP POLICY IF EXISTS "atleta_perfil_deportivo_select" ON atleta_perfil_deportivo;
CREATE POLICY "atleta_perfil_deportivo_select"
  ON atleta_perfil_deportivo FOR SELECT
  USING (
    usuario_id = get_my_profile_id()
    OR is_super_admin()
    OR (
      is_coach_or_admin()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = atleta_perfil_deportivo.usuario_id
          AND p.box_id = get_my_box_id()
      )
    )
  );

-- ─── 6. clase_scores SELECT (ranking interno del box) ─────────────────────────
-- Vulnerabilidad: is_coach_or_admin() sin box permitía ver scores de cualquier gym.
DROP POLICY IF EXISTS "clase_scores_select_box" ON clase_scores;
CREATE POLICY "clase_scores_select_box"
  ON clase_scores FOR SELECT
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1
      FROM clases c
      JOIN profiles coach ON coach.id = c.coach_id
      WHERE c.id = clase_scores.clase_id
        AND coach.box_id = get_my_box_id()
    )
  );

-- ─── Verificación manual ──────────────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'atleta_pr_marcas',
    'atleta_skills',
    'atleta_skill_historial',
    'atleta_objetivos',
    'atleta_perfil_deportivo',
    'clase_scores'
  )
ORDER BY tablename, policyname;

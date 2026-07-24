-- ═══════════════════════════════════════════════════════════════════════════════
-- CONSOLIDADO RLS multi-tenant — ATHRON
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Script único, idempotente (DROP POLICY IF EXISTS + CREATE POLICY).
-- Ejecutar COMPLETO en Supabase SQL Editor cuando no sepas qué parches RLS
-- ya están aplicados, o tras reset parcial de policies.
--
-- Reemplaza todos los antiguos patch-rls-*, patch-planes-box-id,
-- patch-coach-reservas-rls, patch-ranking-public (ya no existen en el repo).
--
-- Prerrequisitos (ejecutar antes si el proyecto es nuevo):
--   1. supabase/schema.sql
--   2. supabase/migration-athron-fase1.sql
--   3. migration-athron-fase2-enum.sql + fase2-box-admin + patch-handle-new-user-rol-seguro.sql
--      (fase2-enum.sql DEBE ir en corrida aparte antes de CONSOLIDADO si user_role no tiene box_admin)
--   4. patch-atleta-expediente-fase1.sql, patch-atleta-legacy.sql, patch-clase-scores.sql
--   5. patch-ranking-athron-v1.sql (tablas ranking — §7 se omite si no existen)
--   6. patch-clase-cupo-socio.sql, patch-admin-insert-reserva.sql, patch-reservas-realtime.sql
--
-- No modifica: clases_update_coach_assigned, policies INSERT/DELETE propias del schema,
-- avatars, handle_new_user, triggers de negocio.
--
-- Verificación: al final, revisa que todas las filas digan OK (sección 8).
-- Luego: npm run check-isolation  →  debe dar 24/24
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─── Prerrequisitos: abortar con mensaje claro si falta el schema base ───────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clases'
  ) THEN
    RAISE EXCEPTION E'CONSOLIDADO abortado: public.clases no existe.\n\n'
      'Este script es el PASO 13. Ejecuta antes (en orden, README):\n'
      '  1. supabase/schema.sql\n'
      '  2–12. migraciones y patches listados en README\n'
      '  13. este archivo\n\n'
      '¿Solo necesitas el fix box_admin y ya tienes public.profiles?\n'
      '  → Ejecuta únicamente la sección 0.1 (is_admin / is_coach_or_admin).';
  END IF;
END $$;


-- ─── 0. Helper coach → reservas de su clase ───────────────────────────────────
-- Fuente: patch-coach-reservas-rls.sql

CREATE OR REPLACE FUNCTION is_coach_of_clase(p_clase_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clases c
    WHERE c.id = p_clase_id
      AND c.coach_id = get_my_profile_id()
  );
$$;


-- ─── 0.1 Redefinir is_admin() / is_coach_or_admin() para incluir box_admin ───
-- Fuente: schema.sql (redefinición). El rol box_admin es admin del gym en la app
-- (register-form + isAdminLikeRole); sin esto, la UI admin funciona pero RLS rechaza writes.
--
-- PREREQUISITO: user_role debe incluir 'box_admin'. Si schema.sql es antiguo, ejecuta
-- en una corrida APARTE (commit) ANTES de este archivo:
--   supabase/migration-athron-fase2-enum.sql
-- (Postgres no permite usar un valor nuevo de enum en la misma transacción del ALTER TYPE.)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'box_admin'
  ) THEN
    RAISE EXCEPTION E'Sección 0.1 abortada: user_role no tiene el valor box_admin.\n\n'
      'Ejecuta SOLO esto en el SQL Editor (Run), espera éxito, y vuelve a correr CONSOLIDADO:\n'
      '  supabase/migration-athron-fase2-enum.sql\n\n'
      'Contenido: ALTER TYPE user_role ADD VALUE IF NOT EXISTS ''box_admin'';';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND rol IN ('admin', 'box_admin')
  );
$$;

CREATE OR REPLACE FUNCTION is_coach_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND rol IN ('admin', 'coach', 'box_admin')
  );
$$;


-- ─── 1. Planes por box ────────────────────────────────────────────────────────
-- Fuente: patch-planes-box-id.sql

ALTER TABLE planes ADD COLUMN IF NOT EXISTS box_id UUID REFERENCES boxes(id);

UPDATE planes
SET box_id = (SELECT id FROM boxes WHERE slug = 'parabellum-cross' LIMIT 1)
WHERE box_id IS NULL;

ALTER TABLE planes ALTER COLUMN box_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_planes_box_id ON planes(box_id);

DROP POLICY IF EXISTS "planes_select_all_authenticated" ON planes;
CREATE POLICY "planes_select_all_authenticated"
  ON planes FOR SELECT
  TO authenticated
  USING (
    (activo = true AND box_id = get_my_box_id())
    OR (is_admin() AND box_id = get_my_box_id())
    OR is_super_admin()
  );

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


-- ─── 2. Core: profiles, membresias, clases (admin), reservas ─────────────────
-- Fuente: patch-rls-box-isolation.sql + patch-rls-super-admin-bypass.sql (estado final)

DROP POLICY IF EXISTS "profiles_select_own_or_staff" ON profiles;
CREATE POLICY "profiles_select_own_or_staff"
  ON profiles FOR SELECT
  USING (
    user_id = auth.uid()
    OR (is_coach_or_admin() AND box_id = get_my_box_id())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE
  USING (
    user_id = auth.uid()
    OR (is_admin() AND box_id = get_my_box_id())
    OR is_super_admin()
  );

-- CRÍTICO: esta policy nunca tuvo WITH CHECK. Un socio actualizando SU
-- PROPIA fila (user_id = auth.uid() sigue siendo cierto en la fila nueva)
-- podía cambiar libremente rol/box_id/is_super_admin/estado_cuenta vía
-- PostgREST directo (ej. src/components/socio/profile-form.tsx solo envía
-- nombre_completo/telefono/bio/foto_url, pero eso es únicamente validación
-- de cliente — nada en RLS lo impedía). Un WITH CHECK normal no alcanza
-- aquí porque hace falta comparar contra el valor VIEJO de esas columnas,
-- así que se usa un trigger BEFORE UPDATE (única forma de acceder a OLD).
CREATE OR REPLACE FUNCTION prevent_profile_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
    NEW.rol := OLD.rol;
    NEW.box_id := OLD.box_id;
    NEW.is_super_admin := OLD.is_super_admin;
    NEW.estado_cuenta := OLD.estado_cuenta;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_self_privilege_escalation ON profiles;
CREATE TRIGGER trg_prevent_profile_self_privilege_escalation
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_profile_self_privilege_escalation();

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

-- Fuente: migration-clases-box-id.sql
-- Corrige bypass: con coach_id IS NULL, cualquier admin (de cualquier box)
-- podía editar la clase. Ahora se valida clases.box_id directamente.
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

-- Corrige: faltaba WITH CHECK, así que un socio podía re-apuntar su propia
-- reserva a clase_id de otro box, o auto-marcarse estado='asistio' (RLS
-- solo revalida USING contra la fila NUEVA cuando no hay WITH CHECK propio).
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
  )
  WITH CHECK (
    (
      usuario_id = get_my_profile_id()
      AND estado = 'cancelada'
      AND EXISTS (
        SELECT 1 FROM clases c
        WHERE c.id = reservas.clase_id
          AND c.box_id = get_my_box_id()
      )
    )
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


-- ─── 3. clases SELECT (authenticated) ─────────────────────────────────────────
-- Fuente: migration-clases-box-id.sql (reemplaza patch-rls-clases-select-box.sql)
-- Corrige USING (true) del schema original Y el bypass posterior de
-- coach_id IS NULL (cualquier autenticado veía clases sin coach de otro box).

DROP POLICY IF EXISTS "clases_select_authenticated" ON clases;
CREATE POLICY "clases_select_authenticated"
  ON clases FOR SELECT
  TO authenticated
  USING (
    is_super_admin()
    OR clases.box_id = get_my_box_id()
  );


-- ─── 4. Coach → reservas de sus clases ────────────────────────────────────────
-- Fuente: patch-coach-reservas-rls.sql

DROP POLICY IF EXISTS "reservas_select_coach_of_class" ON reservas;
CREATE POLICY "reservas_select_coach_of_class"
  ON reservas FOR SELECT
  USING (is_coach_of_clase(clase_id));

DROP POLICY IF EXISTS "reservas_update_coach_of_class" ON reservas;
CREATE POLICY "reservas_update_coach_of_class"
  ON reservas FOR UPDATE
  USING (is_coach_of_clase(clase_id))
  WITH CHECK (is_coach_of_clase(clase_id));


-- ─── 5. Atleta + clase_scores (box isolation) ─────────────────────────────────
-- Fuente: patch-rls-box-isolation-atletas.sql

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

-- Fuente: patch-clase-scores.sql (nunca redefinido antes aquí).
-- Corrige: clase_scores_insert_own/update_own solo exigían usuario_id propio,
-- sin validar que clase_id perteneciera al box del socio (mismo bug ya
-- corregido para reservas en migration-reservas-insert-box-check.sql).
DROP POLICY IF EXISTS "clase_scores_insert_own" ON clase_scores;
CREATE POLICY "clase_scores_insert_own"
  ON clase_scores FOR INSERT
  WITH CHECK (
    usuario_id = get_my_profile_id()
    AND EXISTS (
      SELECT 1 FROM clases c
      WHERE c.id = clase_scores.clase_id
        AND c.box_id = get_my_box_id()
    )
  );

DROP POLICY IF EXISTS "clase_scores_update_own" ON clase_scores;
CREATE POLICY "clase_scores_update_own"
  ON clase_scores FOR UPDATE
  USING (usuario_id = get_my_profile_id())
  WITH CHECK (
    usuario_id = get_my_profile_id()
    AND EXISTS (
      SELECT 1 FROM clases c
      WHERE c.id = clase_scores.clase_id
        AND c.box_id = get_my_box_id()
    )
  );


-- ─── 6. Ranking público (solo anon — evita OR con policies authenticated) ─────
-- Fuente: patch-ranking-public.sql + fix TO anon
-- Sin TO anon, clases_public_ranking permitía a cualquier authenticated ver
-- clases de boxes activos ajenos (políticas permissive se combinan con OR).

DROP POLICY IF EXISTS "clase_scores_public_ranking" ON clase_scores;
CREATE POLICY "clase_scores_public_ranking"
  ON clase_scores FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM clases c
      JOIN profiles coach ON coach.id = c.coach_id
      JOIN boxes b ON b.id = coach.box_id
      WHERE c.id = clase_scores.clase_id
        AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "atleta_perfil_ranking_read" ON atleta_perfil_deportivo;
CREATE POLICY "atleta_perfil_ranking_read"
  ON atleta_perfil_deportivo FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN boxes b ON b.id = p.box_id
      WHERE p.id = atleta_perfil_deportivo.usuario_id
        AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "profiles_public_ranking" ON profiles;
CREATE POLICY "profiles_public_ranking"
  ON profiles FOR SELECT
  TO anon
  USING (
    rol = 'socio'
    AND EXISTS (
      SELECT 1 FROM boxes b
      WHERE b.id = profiles.box_id AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "clases_public_ranking" ON clases;
CREATE POLICY "clases_public_ranking"
  ON clases FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM profiles coach
      JOIN boxes b ON b.id = coach.box_id
      WHERE coach.id = clases.coach_id
        AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "boxes_public_ranking" ON boxes;
CREATE POLICY "boxes_public_ranking"
  ON boxes FOR SELECT
  TO anon
  USING (status = 'active');


-- ─── 7. Ranking Athron V1 (RLS) ───────────────────────────────────────────────
-- Fuente: patch-ranking-athron-v1.sql (bloque RLS)
-- Se omite si las tablas no existen (proyecto sin Athron ranking).

DO $ranking_rls$
BEGIN
  IF to_regclass('public.ranking_config') IS NULL THEN
    RAISE NOTICE 'Sección 7 omitida: tablas ranking Athron no existen (ejecuta patch-ranking-athron-v1.sql primero).';
    RETURN;
  END IF;

  -- Corrige: FOR ALL con is_coach_or_admin() sin box permitía a un coach/admin
  -- de cualquier box insertar/editar/borrar la configuración de ranking
  -- (puntos, bonos de racha, umbrales) de OTRO box (nunca usada vía RLS por
  -- la app — src/app/api/admin/ranking-config/route.ts siempre usa el
  -- cliente service_role con box_id ya validado en el propio código).
  EXECUTE 'DROP POLICY IF EXISTS "ranking_config_admin" ON ranking_config';
  EXECUTE $p$
    CREATE POLICY "ranking_config_admin"
      ON ranking_config FOR ALL
      USING (
        (
          is_coach_or_admin()
          AND EXISTS (
            SELECT 1 FROM profiles me
            WHERE me.user_id = auth.uid()
              AND me.box_id = ranking_config.box_id
          )
        )
        OR is_super_admin()
      )
      WITH CHECK (
        (
          is_coach_or_admin()
          AND EXISTS (
            SELECT 1 FROM profiles me
            WHERE me.user_id = auth.uid()
              AND me.box_id = ranking_config.box_id
          )
        )
        OR is_super_admin()
      )
  $p$;

  EXECUTE 'DROP POLICY IF EXISTS "ranking_config_public_read" ON ranking_config';
  EXECUTE $p$
    CREATE POLICY "ranking_config_public_read"
      ON ranking_config FOR SELECT
      USING (
        EXISTS (SELECT 1 FROM boxes b WHERE b.id = ranking_config.box_id AND b.status = 'active')
      )
  $p$;

  -- Corrige: is_coach_or_admin() no valida box (cualquier coach/admin de
  -- cualquier box veía TODO ranking_point_events), y la rama "box activo"
  -- no exigía ninguna relación con el caller (fuga total, incluso anon,
  -- ya que la policy no tiene TO authenticated). Se deja solo: dueño del
  -- evento, o miembro autenticado del mismo box.
  EXECUTE 'DROP POLICY IF EXISTS "ranking_events_select" ON ranking_point_events';
  EXECUTE $p$
    CREATE POLICY "ranking_events_select"
      ON ranking_point_events FOR SELECT
      USING (
        usuario_id = get_my_profile_id()
        OR EXISTS (
          SELECT 1 FROM profiles me
          WHERE me.user_id = auth.uid()
            AND me.box_id = ranking_point_events.box_id
        )
        OR is_super_admin()
      )
  $p$;

  -- Fuente: migration-hotfix-security-pilot.sql — ranking_point_events solo
  -- se inserta vía service_role (engine.ts usa el cliente admin, que bypassea
  -- RLS). Sin policy de INSERT, ningún rol authenticated/anon puede insertar
  -- directo por PostgREST. CONSOLIDADO recreaba antes esta policy con
  -- WITH CHECK (true), reabriendo el hueco que ese hotfix ya había cerrado.
  EXECUTE 'DROP POLICY IF EXISTS "ranking_events_insert_service" ON ranking_point_events';

  -- Corrige: ambas ramas eran globales (cualquier box activo, o cualquier
  -- coach/admin sin importar su box) — cualquier usuario veía los premios
  -- mensuales de todos los boxes.
  EXECUTE 'DROP POLICY IF EXISTS "ranking_awards_select" ON ranking_monthly_awards';
  EXECUTE $p$
    CREATE POLICY "ranking_awards_select"
      ON ranking_monthly_awards FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM profiles me
          WHERE me.user_id = auth.uid()
            AND me.box_id = ranking_monthly_awards.box_id
        )
        OR is_super_admin()
      )
  $p$;

  -- Corrige: FOR ALL con is_coach_or_admin() sin box permitía a un coach/admin
  -- de cualquier box insertar/editar/borrar premios mensuales de otro box.
  EXECUTE 'DROP POLICY IF EXISTS "ranking_awards_admin" ON ranking_monthly_awards';
  EXECUTE $p$
    CREATE POLICY "ranking_awards_admin"
      ON ranking_monthly_awards FOR ALL
      USING (
        (
          is_coach_or_admin()
          AND EXISTS (
            SELECT 1 FROM profiles me
            WHERE me.user_id = auth.uid()
              AND me.box_id = ranking_monthly_awards.box_id
          )
        )
        OR is_super_admin()
      )
      WITH CHECK (
        (
          is_coach_or_admin()
          AND EXISTS (
            SELECT 1 FROM profiles me
            WHERE me.user_id = auth.uid()
              AND me.box_id = ranking_monthly_awards.box_id
          )
        )
        OR is_super_admin()
      )
  $p$;
END;
$ranking_rls$;


-- ─── 8. Verificación: checklist de policies esperadas ─────────────────────────
-- Todas las filas deben mostrar status = OK.
-- Si alguna dice MISSING, vuelve a ejecutar este script completo.

WITH expected(tablename, policyname) AS (
  VALUES
    -- §1 planes
    ('planes', 'planes_select_all_authenticated'),
    ('planes', 'planes_admin_all'),
    -- §2 core
    ('profiles', 'profiles_select_own_or_staff'),
    ('profiles', 'profiles_update_own_or_admin'),
    ('profiles', 'profiles_select_coaches'),
    ('membresias', 'membresias_select_own_or_admin'),
    ('membresias', 'membresias_admin_all'),
    ('clases', 'clases_admin_all'),
    ('reservas', 'reservas_select_own_or_admin'),
    ('reservas', 'reservas_update_own_or_admin'),
    -- §3 clases SELECT
    ('clases', 'clases_select_authenticated'),
    -- §4 coach reservas
    ('reservas', 'reservas_select_coach_of_class'),
    ('reservas', 'reservas_update_coach_of_class'),
    -- §5 atleta + scores
    ('atleta_pr_marcas', 'atleta_pr_select'),
    ('atleta_skills', 'atleta_skills_select'),
    ('atleta_skill_historial', 'atleta_skill_hist_select'),
    ('atleta_objetivos', 'atleta_objetivos_select'),
    ('atleta_perfil_deportivo', 'atleta_perfil_deportivo_select'),
    ('clase_scores', 'clase_scores_select_box'),
    -- §6 ranking público
    ('clase_scores', 'clase_scores_public_ranking'),
    ('atleta_perfil_deportivo', 'atleta_perfil_ranking_read'),
    ('profiles', 'profiles_public_ranking'),
    ('clases', 'clases_public_ranking'),
    ('boxes', 'boxes_public_ranking')
),
checklist AS (
  SELECT
    e.tablename,
    e.policyname,
    CASE
      WHEN p.policyname IS NOT NULL THEN 'OK'
      ELSE 'MISSING'
    END AS status
  FROM expected e
  LEFT JOIN pg_policies p
    ON p.schemaname = 'public'
   AND p.tablename = e.tablename
   AND p.policyname = e.policyname
)
SELECT * FROM checklist ORDER BY tablename, policyname;

-- Resumen (debe ser missing_count = 0)
SELECT
  count(*) FILTER (WHERE status = 'OK') AS ok_count,
  count(*) FILTER (WHERE status = 'MISSING') AS missing_count
FROM (
  SELECT
    CASE WHEN p.policyname IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
  FROM (
    VALUES
      ('planes', 'planes_select_all_authenticated'),
      ('planes', 'planes_admin_all'),
      ('profiles', 'profiles_select_own_or_staff'),
      ('profiles', 'profiles_update_own_or_admin'),
      ('profiles', 'profiles_select_coaches'),
      ('membresias', 'membresias_select_own_or_admin'),
      ('membresias', 'membresias_admin_all'),
      ('clases', 'clases_admin_all'),
      ('clases', 'clases_select_authenticated'),
      ('reservas', 'reservas_select_own_or_admin'),
      ('reservas', 'reservas_update_own_or_admin'),
      ('reservas', 'reservas_select_coach_of_class'),
      ('reservas', 'reservas_update_coach_of_class'),
      ('atleta_pr_marcas', 'atleta_pr_select'),
      ('atleta_skills', 'atleta_skills_select'),
      ('atleta_skill_historial', 'atleta_skill_hist_select'),
      ('atleta_objetivos', 'atleta_objetivos_select'),
      ('atleta_perfil_deportivo', 'atleta_perfil_deportivo_select'),
      ('clase_scores', 'clase_scores_select_box'),
      ('clase_scores', 'clase_scores_public_ranking'),
      ('atleta_perfil_deportivo', 'atleta_perfil_ranking_read'),
      ('profiles', 'profiles_public_ranking'),
      ('clases', 'clases_public_ranking'),
      ('boxes', 'boxes_public_ranking')
  ) AS e(tablename, policyname)
  LEFT JOIN pg_policies p
    ON p.schemaname = 'public'
   AND p.tablename = e.tablename
   AND p.policyname = e.policyname
) s;

-- Detalle pg_policies (tablas gestionadas por este script)
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'planes', 'profiles', 'membresias', 'clases', 'reservas',
    'atleta_pr_marcas', 'atleta_skills', 'atleta_skill_historial',
    'atleta_objetivos', 'atleta_perfil_deportivo', 'clase_scores', 'boxes',
    'ranking_config', 'ranking_point_events', 'ranking_monthly_awards'
  )
ORDER BY tablename, policyname;

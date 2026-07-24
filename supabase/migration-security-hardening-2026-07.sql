-- ─────────────────────────────────────────────────────────────────────────────
-- Hardening de seguridad — auditoría 2026-07
--
-- Corrige 7 hallazgos SQL CRÍTICOS/ALTOS encontrados en la auditoría de este
-- ciclo (aislamiento multi-tenant, auto-escalación de privilegios, RPC sin
-- validar caller). Un octavo hallazgo (pérdida de puntos WOD al alternar
-- asistencia) se corrigió en código de aplicación (src/lib/ranking/engine.ts),
-- no requiere SQL.
--
-- IDEMPOTENTE: cada bloque usa DROP ... IF EXISTS / CREATE OR REPLACE, así que
-- correr este archivo más de una vez no tiene efectos adicionales ni rompe
-- nada. NO se asume que CONSOLIDADO-rls-multitenant.sql completo deba
-- re-ejecutarse — este archivo toca ÚNICAMENTE las 9 policies/función/trigger
-- que cambiaron, sin repetir las ~40 policies que ya existen sin cambios.
--
-- No borra ni recrea: grants de tabla, ownership, ni firmas de función
-- (clases_cupo_ocupado mantiene exactamente su firma original — mismos
-- parámetros y tipo de retorno — así que cualquier dependiente sigue
-- funcionando y no hace falta re-otorgar GRANT EXECUTE).
--
-- Aplicar manualmente en el SQL Editor de Supabase, en un solo statement run
-- (todo el archivo). Verificación al final: todas las filas deben decir OK.
-- Rollback explícito al final del archivo (bloque comentado).
-- ─────────────────────────────────────────────────────────────────────────────


-- ═══ 1/7 · reservas_update_own_or_admin — WITH CHECK faltante ════════════════
-- Un socio podía re-apuntar su propia reserva (usuario_id sin cambiar sigue
-- pasando USING) a clase_id de otro box, o auto-marcarse estado='asistio'.
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


-- ═══ 2/7 · clase_scores_insert_own / clase_scores_update_own ─────────────────
-- Solo exigían usuario_id propio, sin validar que clase_id perteneciera al
-- box del socio (mismo patrón ya corregido para reservas).
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


-- ═══ 3/7 · ranking_point_events / ranking_monthly_awards / ranking_config ────
-- Envuelto en el mismo guard defensivo que usa CONSOLIDADO (por si el
-- proyecto destino aún no tiene las tablas de ranking Athron).
DO $ranking_hardening$
BEGIN
  IF to_regclass('public.ranking_config') IS NULL THEN
    RAISE NOTICE 'Sección ranking omitida: tablas ranking Athron no existen.';
    RETURN;
  END IF;

  -- 3a. INSERT directo a ranking_point_events con WITH CHECK (true) permitía
  -- a cualquier authenticated/anon forjar puntos (sin TO service_role). Los
  -- escritos reales de la app siempre van por el cliente admin (bypassea
  -- RLS), así que sin policy de INSERT queda correctamente denegado.
  EXECUTE 'DROP POLICY IF EXISTS "ranking_events_insert_service" ON ranking_point_events';

  -- 3b. is_coach_or_admin() sin validar box, y rama "box activo" sin ningún
  -- vínculo con el caller — cualquier coach/admin de cualquier box, o
  -- cualquier usuario autenticado, leía TODO ranking_point_events.
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

  -- 3c. Mismo patrón en ranking_monthly_awards (lectura): ambas ramas eran
  -- globales.
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

  -- 3d. FOR ALL con is_coach_or_admin() sin box: cualquier coach/admin de
  -- cualquier box podía insertar/editar/borrar premios de OTRO box.
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

  -- 3e. Mismo patrón en ranking_config (puntos, bonos de racha, umbrales):
  -- cualquier coach/admin de cualquier box podía editar la config de OTRO
  -- box. Nunca se usa vía RLS por la app (src/app/api/admin/ranking-config
  -- siempre usa el cliente service_role), así que este fix no cambia
  -- comportamiento de la aplicación, solo cierra el acceso directo a PostgREST.
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
END;
$ranking_hardening$;


-- ═══ 4/7 · clases_cupo_ocupado — RPC sin validar box del caller ══════════════
-- SECURITY DEFINER sin ningún chequeo de sesión/box: cualquier authenticated
-- podía pedir cupo de clase_ids de OTRO box (fuga de headcount). CREATE OR
-- REPLACE preserva la firma exacta (mismos parámetros/retorno), así que
-- dependientes y GRANT EXECUTE existentes no se ven afectados.
-- auth.uid() IS NULL cubre llamadas vía service_role (ej. reporte semanal en
-- src/lib/reporte-semanal/fetch-data.ts), que no tienen JWT de usuario final.
CREATE OR REPLACE FUNCTION public.clases_cupo_ocupado(p_clase_ids uuid[])
RETURNS TABLE (clase_id uuid, ocupado integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.clase_id,
    COUNT(*)::INT AS ocupado
  FROM reservas r
  WHERE r.clase_id = ANY(p_clase_ids)
    AND r.estado IN ('confirmada', 'asistio', 'no_asistio')
    AND (
      auth.uid() IS NULL
      OR EXISTS (
        SELECT 1
        FROM clases c
        JOIN profiles me ON me.box_id = c.box_id
        WHERE c.id = r.clase_id
          AND me.user_id = auth.uid()
      )
    )
  GROUP BY r.clase_id;
$$;


-- ═══ 5/7 · profiles — auto-escalación de privilegios en UPDATE ═══════════════
-- CRÍTICO. profiles_update_own_or_admin nunca tuvo WITH CHECK. Un socio
-- actualizando SU PROPIA fila (user_id = auth.uid() sigue siendo cierto en la
-- fila nueva) podía cambiar libremente rol/box_id/is_super_admin/estado_cuenta
-- vía PostgREST directo. Un WITH CHECK normal no alcanza aquí porque hace
-- falta comparar contra el valor VIEJO de esas columnas — se usa un trigger
-- BEFORE UPDATE (única forma de acceder a OLD en Postgres).
--
-- Este trigger NO afecta actualizaciones legítimas: solo interviene cuando
-- auth.uid() coincide con el user_id de la fila que se está tocando (una
-- auto-edición real). Un admin editando el perfil de OTRO usuario (o el
-- cliente service_role, donde auth.uid() es NULL) nunca cumple esa condición.
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


-- ═══ Verificación ═════════════════════════════════════════════════════════
-- Todas las filas deben decir OK. Si alguna dice MISSING, el fix
-- correspondiente no se aplicó (o esta sección de ranking se omitió porque
-- las tablas de ranking Athron no existen en este proyecto).

WITH expected(tablename, policyname) AS (
  VALUES
    ('reservas', 'reservas_update_own_or_admin'),
    ('clase_scores', 'clase_scores_insert_own'),
    ('clase_scores', 'clase_scores_update_own'),
    ('ranking_point_events', 'ranking_events_select'),
    ('ranking_monthly_awards', 'ranking_awards_select'),
    ('ranking_monthly_awards', 'ranking_awards_admin'),
    ('ranking_config', 'ranking_config_admin')
)
SELECT
  e.tablename,
  e.policyname,
  CASE
    WHEN p.policyname IS NULL THEN 'MISSING (tabla no existe o policy no se creó)'
    WHEN e.policyname IN ('clase_scores_insert_own', 'clase_scores_update_own')
         AND p.with_check NOT LIKE '%box_id = get_my_box_id%' THEN 'STALE (with_check viejo)'
    WHEN e.policyname = 'reservas_update_own_or_admin'
         AND (p.with_check IS NULL OR p.with_check NOT LIKE '%cancelada%') THEN 'STALE (with_check viejo)'
    WHEN e.policyname = 'ranking_events_select' AND p.qual LIKE '%is_coach_or_admin%' THEN 'STALE (rama sin box)'
    WHEN e.policyname = 'ranking_awards_select' AND p.qual LIKE '%status = ''active''%' THEN 'STALE (rama sin box)'
    ELSE 'OK'
  END AS status
FROM expected e
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = e.tablename
 AND p.policyname = e.policyname
ORDER BY e.tablename, e.policyname;

-- No debe existir ninguna policy de INSERT en ranking_point_events (solo
-- service_role inserta, y ese bypassea RLS por completo).
SELECT
  CASE WHEN count(*) = 0 THEN 'OK (sin policy INSERT — solo service_role)'
       ELSE 'MISSING: aún existe policy INSERT en ranking_point_events' END AS status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'ranking_point_events'
  AND cmd = 'INSERT';

-- clases_cupo_ocupado debe referenciar auth.uid() en su body (fix aplicado).
SELECT
  CASE WHEN prosrc LIKE '%auth.uid()%' THEN 'OK'
       ELSE 'MISSING: clases_cupo_ocupado sin validar box del caller' END AS status
FROM pg_proc
WHERE proname = 'clases_cupo_ocupado';

-- Trigger de auto-escalación de profiles debe existir.
SELECT
  CASE WHEN count(*) = 1 THEN 'OK'
       ELSE 'MISSING: trigger de auto-escalación de profiles no existe' END AS status
FROM pg_trigger
WHERE tgname = 'trg_prevent_profile_self_privilege_escalation';


-- ═══ ROLLBACK ═════════════════════════════════════════════════════════════
-- Revierte CADA fix a su estado ANTERIOR (vulnerable). Solo ejecutar si es
-- estrictamente necesario revertir — reabre las 7 vulnerabilidades de esta
-- migración. Todo el bloque está comentado; descomentar la sección que
-- necesites revertir, o el bloque completo, y ejecutar manualmente.
--
-- -- 1. reservas_update_own_or_admin → sin WITH CHECK
-- DROP POLICY IF EXISTS "reservas_update_own_or_admin" ON reservas;
-- CREATE POLICY "reservas_update_own_or_admin"
--   ON reservas FOR UPDATE
--   USING (
--     usuario_id = get_my_profile_id()
--     OR (is_admin() AND EXISTS (
--       SELECT 1 FROM profiles p
--       WHERE p.id = reservas.usuario_id AND p.box_id = get_my_box_id()
--     ))
--     OR is_super_admin()
--   );
--
-- -- 2. clase_scores_insert_own / update_own → sin validar box
-- DROP POLICY IF EXISTS "clase_scores_insert_own" ON clase_scores;
-- CREATE POLICY "clase_scores_insert_own"
--   ON clase_scores FOR INSERT
--   WITH CHECK (usuario_id = get_my_profile_id());
--
-- DROP POLICY IF EXISTS "clase_scores_update_own" ON clase_scores;
-- CREATE POLICY "clase_scores_update_own"
--   ON clase_scores FOR UPDATE
--   USING (usuario_id = get_my_profile_id())
--   WITH CHECK (usuario_id = get_my_profile_id());
--
-- -- 3. ranking_* → ramas sin scoping por box (requiere que existan las tablas)
-- DO $rollback$
-- BEGIN
--   IF to_regclass('public.ranking_config') IS NULL THEN RETURN; END IF;
--
--   EXECUTE $p$
--     CREATE POLICY "ranking_events_insert_service"
--       ON ranking_point_events FOR INSERT
--       WITH CHECK (true)
--   $p$;
--
--   EXECUTE 'DROP POLICY IF EXISTS "ranking_events_select" ON ranking_point_events';
--   EXECUTE $p$
--     CREATE POLICY "ranking_events_select"
--       ON ranking_point_events FOR SELECT
--       USING (
--         usuario_id = get_my_profile_id()
--         OR is_coach_or_admin()
--         OR EXISTS (SELECT 1 FROM profiles me WHERE me.user_id = auth.uid() AND me.box_id = ranking_point_events.box_id)
--         OR EXISTS (SELECT 1 FROM boxes b WHERE b.id = ranking_point_events.box_id AND b.status = 'active')
--       )
--   $p$;
--
--   EXECUTE 'DROP POLICY IF EXISTS "ranking_awards_select" ON ranking_monthly_awards';
--   EXECUTE $p$
--     CREATE POLICY "ranking_awards_select"
--       ON ranking_monthly_awards FOR SELECT
--       USING (
--         EXISTS (SELECT 1 FROM boxes b WHERE b.id = ranking_monthly_awards.box_id AND b.status = 'active')
--         OR is_coach_or_admin()
--       )
--   $p$;
--
--   EXECUTE 'DROP POLICY IF EXISTS "ranking_awards_admin" ON ranking_monthly_awards';
--   EXECUTE $p$
--     CREATE POLICY "ranking_awards_admin"
--       ON ranking_monthly_awards FOR ALL
--       USING (is_coach_or_admin())
--       WITH CHECK (is_coach_or_admin())
--   $p$;
--
--   EXECUTE 'DROP POLICY IF EXISTS "ranking_config_admin" ON ranking_config';
--   EXECUTE $p$
--     CREATE POLICY "ranking_config_admin"
--       ON ranking_config FOR ALL
--       USING (is_coach_or_admin())
--       WITH CHECK (is_coach_or_admin())
--   $p$;
-- END;
-- $rollback$;
--
-- -- 4. clases_cupo_ocupado → sin validar box del caller
-- CREATE OR REPLACE FUNCTION public.clases_cupo_ocupado(p_clase_ids uuid[])
-- RETURNS TABLE (clase_id uuid, ocupado integer)
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
-- AS $$
--   SELECT r.clase_id, COUNT(*)::INT AS ocupado
--   FROM reservas r
--   WHERE r.clase_id = ANY(p_clase_ids)
--     AND r.estado IN ('confirmada', 'asistio', 'no_asistio')
--   GROUP BY r.clase_id;
-- $$;
--
-- -- 5. profiles → quita el trigger de auto-escalación (deja SOLO el bare
-- --    WITH CHECK ausente que ya tenía antes; no hay "policy vieja" que
-- --    restaurar porque nunca tuvo WITH CHECK)
-- DROP TRIGGER IF EXISTS trg_prevent_profile_self_privilege_escalation ON profiles;
-- DROP FUNCTION IF EXISTS prevent_profile_self_privilege_escalation();

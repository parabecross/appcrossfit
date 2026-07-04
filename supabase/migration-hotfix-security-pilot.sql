-- ─── Hotfix seguridad piloto (3 boxes) — SIN tocar vistas ni lógica de app ───
-- Aplicar manualmente en Supabase SQL Editor. Idempotente.
--
-- Fase 2: Las vistas membresia_actual, alertas_membresia, reservas_con_cupo
--         NO son usadas por la app (solo schema/migrations legacy).
--         Revoca SELECT vía PostgREST para anon/authenticated.
--         postgres y service_role conservan acceso (service_role bypass RLS).
--
-- Fase 3: ranking_point_events INSERT solo vía service_role (engine.ts usa admin).
--         Elimina policy ranking_events_insert_service (WITH CHECK true).
--
-- NO modifica: definición de vistas, ranking SELECT, clases/reservas RLS, engine.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Fase 2: cerrar exposición PostgREST de vistas legacy ───────────────────

REVOKE SELECT ON public.membresia_actual FROM anon, authenticated;
REVOKE SELECT ON public.alertas_membresia FROM anon, authenticated;
REVOKE SELECT ON public.reservas_con_cupo FROM anon, authenticated;

-- ─── Fase 3: INSERT ranking — solo service_role (sin policy = deny authenticated) ─

DROP POLICY IF EXISTS "ranking_events_insert_service" ON public.ranking_point_events;

-- ─── Verificación (debe mostrar sin privilegios para anon/authenticated en vistas) ─

SELECT
  table_name,
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'membresia_actual',
    'alertas_membresia',
    'reservas_con_cupo'
  )
  AND grantee IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY table_name, grantee, privilege_type;

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'ranking_point_events'
  AND cmd = 'INSERT'
ORDER BY policyname;

-- Esperado tras el hotfix:
--   • Vistas: sin filas grantee=anon o authenticated con SELECT
--   • ranking_point_events INSERT: 0 policies (service_role inserta vía bypass RLS)

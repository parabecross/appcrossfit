-- Log de auditoría admin (solo lectura vía RLS; escritura por service_role en el backend).
-- Ejecutar en Supabase SQL Editor después del schema y CONSOLIDADO RLS.

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL,
  actor_profile_id UUID,
  box_id UUID,
  accion TEXT NOT NULL,
  target_user_id UUID,
  target_profile_id UUID,
  detalle JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_box_id ON audit_log(box_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_admin_own_box" ON audit_log;
CREATE POLICY "audit_log_select_admin_own_box"
  ON audit_log FOR SELECT
  USING (
    is_super_admin()
    OR (is_admin() AND box_id = get_my_box_id())
  );

-- Verificación: políticas activas en audit_log
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'audit_log'
ORDER BY policyname;

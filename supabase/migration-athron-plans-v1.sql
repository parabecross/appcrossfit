-- ATHRON SaaS plans, subscriptions and feature overrides
-- Run after migration-athron-fase1.sql

-- ─── plans ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL CHECK (code IN ('start', 'pro', 'elite')),
  name text NOT NULL,
  price_mxn integer NOT NULL DEFAULT 0,
  max_atletas integer,
  max_coaches integer,
  max_admins integer,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ─── box_subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS box_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid UNIQUE NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES plans(id),
  status text NOT NULL CHECK (
    status IN ('trialing', 'active', 'grace_period', 'expired', 'suspended', 'canceled')
  ),
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  canceled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_box_subscriptions_plan ON box_subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_box_subscriptions_status ON box_subscriptions(status);

-- ─── box_feature_overrides ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS box_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id uuid NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL,
  reason text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (box_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_box_feature_overrides_box ON box_feature_overrides(box_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plans_updated_at ON plans;
CREATE TRIGGER plans_updated_at
  BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS box_subscriptions_updated_at ON box_subscriptions;
CREATE TRIGGER box_subscriptions_updated_at
  BEFORE UPDATE ON box_subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS box_feature_overrides_updated_at ON box_feature_overrides;
CREATE TRIGGER box_feature_overrides_updated_at
  BEFORE UPDATE ON box_feature_overrides FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── seed plans ──────────────────────────────────────────────────────────────
INSERT INTO plans (code, name, price_mxn, max_atletas, max_coaches, max_admins, features)
VALUES
(
  'start',
  'ATHRON Start',
  899,
  50,
  2,
  1,
  '{
    "dashboard_basico": true,
    "clases": true,
    "reservas": true,
    "membresias": true,
    "asistencia": true,
    "ranking": false,
    "ranking_publico": false,
    "ranking_config": false,
    "progreso_atleta": false,
    "estadisticas_avanzadas": false,
    "dashboard_ejecutivo": false,
    "frecuencia_usuario": false,
    "demanda_horario": false,
    "ocupacion_promedio": false,
    "tendencia_asistencia": false,
    "historial_completo": false,
    "alertas_avanzadas": false,
    "resumen_semanal": false
  }'::jsonb
),
(
  'pro',
  'ATHRON Pro',
  1099,
  75,
  5,
  2,
  '{
    "dashboard_basico": true,
    "clases": true,
    "reservas": true,
    "membresias": true,
    "asistencia": true,
    "ranking": true,
    "ranking_publico": true,
    "ranking_config": true,
    "progreso_atleta": true,
    "estadisticas_avanzadas": true,
    "dashboard_ejecutivo": true,
    "frecuencia_usuario": true,
    "demanda_horario": true,
    "ocupacion_promedio": true,
    "tendencia_asistencia": true,
    "historial_completo": true,
    "alertas_avanzadas": true,
    "resumen_semanal": true
  }'::jsonb
),
(
  'elite',
  'ATHRON Elite',
  1299,
  150,
  null,
  null,
  '{
    "dashboard_basico": true,
    "clases": true,
    "reservas": true,
    "membresias": true,
    "asistencia": true,
    "ranking": true,
    "ranking_publico": true,
    "ranking_config": true,
    "progreso_atleta": true,
    "estadisticas_avanzadas": true,
    "dashboard_ejecutivo": true,
    "frecuencia_usuario": true,
    "demanda_horario": true,
    "ocupacion_promedio": true,
    "tendencia_asistencia": true,
    "historial_completo": true,
    "alertas_avanzadas": true,
    "resumen_semanal": true
  }'::jsonb
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  price_mxn = EXCLUDED.price_mxn,
  max_atletas = EXCLUDED.max_atletas,
  max_coaches = EXCLUDED.max_coaches,
  max_admins = EXCLUDED.max_admins,
  features = EXCLUDED.features,
  updated_at = now();

-- Parabellum Cross demo: elite + acceso promocional (trialing)
INSERT INTO box_subscriptions (box_id, plan_id, status, trial_ends_at, current_period_end)
SELECT
  b.id,
  p.id,
  'trialing',
  now() + interval '30 days',
  now() + interval '30 days'
FROM boxes b
CROSS JOIN plans p
WHERE b.slug = 'parabellum-cross'
  AND p.code = 'elite'
ON CONFLICT (box_id) DO UPDATE SET
  plan_id = EXCLUDED.plan_id,
  status = EXCLUDED.status,
  trial_ends_at = EXCLUDED.trial_ends_at,
  current_period_end = EXCLUDED.current_period_end,
  updated_at = now();

-- Default subscription for other boxes without one → start + active
INSERT INTO box_subscriptions (box_id, plan_id, status)
SELECT b.id, p.id, 'active'
FROM boxes b
CROSS JOIN plans p
WHERE p.code = 'start'
  AND NOT EXISTS (SELECT 1 FROM box_subscriptions bs WHERE bs.box_id = b.id)
ON CONFLICT (box_id) DO NOTHING;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE box_feature_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_select_authenticated ON plans;
CREATE POLICY plans_select_authenticated ON plans
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS plans_super_admin_all ON plans;
CREATE POLICY plans_super_admin_all ON plans
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS box_subscriptions_select_own ON box_subscriptions;
CREATE POLICY box_subscriptions_select_own ON box_subscriptions
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (box_id = get_my_box_id() AND is_admin())
  );

DROP POLICY IF EXISTS box_subscriptions_super_admin_write ON box_subscriptions;
CREATE POLICY box_subscriptions_super_admin_write ON box_subscriptions
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS box_feature_overrides_select_own ON box_feature_overrides;
CREATE POLICY box_feature_overrides_select_own ON box_feature_overrides
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR (box_id = get_my_box_id() AND is_admin())
  );

DROP POLICY IF EXISTS box_feature_overrides_super_admin_write ON box_feature_overrides;
CREATE POLICY box_feature_overrides_super_admin_write ON box_feature_overrides
  FOR ALL TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Athron Ranking System V1.0
-- Ejecutar después de patch-clase-scores.sql y patch-atleta-legacy.sql

CREATE TYPE ranking_event_type AS ENUM (
  'attendance',
  'streak',
  'wod_position',
  'evolution',
  'achievement'
);

CREATE TYPE ranking_award_type AS ENUM (
  'champion',
  'top3',
  'athlete_of_month',
  'most_evolution',
  'longest_streak',
  'most_consistent'
);

CREATE TABLE IF NOT EXISTS ranking_config (
  box_id                      UUID PRIMARY KEY REFERENCES boxes(id) ON DELETE CASCADE,
  enabled                     BOOLEAN NOT NULL DEFAULT true,
  attendance_points           INTEGER NOT NULL DEFAULT 15 CHECK (attendance_points >= 0),
  streak_bonuses              JSONB NOT NULL DEFAULT '{"2":2,"3":4,"4":6,"5":8,"6":10,"7":15}'::jsonb,
  position_points_table       JSONB NOT NULL DEFAULT '[30,28,26,24,22,20,18,16,14,12]'::jsonb,
  position_points_floor       INTEGER NOT NULL DEFAULT 5 CHECK (position_points_floor >= 0),
  position_points_linear_drop INTEGER NOT NULL DEFAULT 2 CHECK (position_points_linear_drop >= 0),
  evolution_bonuses           JSONB NOT NULL DEFAULT '{"small":5,"medium":10,"large":15}'::jsonb,
  achievement_points          JSONB NOT NULL DEFAULT '{}'::jsonb,
  min_attendances_to_rank     INTEGER NOT NULL DEFAULT 1 CHECK (min_attendances_to_rank >= 0),
  min_points_to_rank          INTEGER NOT NULL DEFAULT 0 CHECK (min_points_to_rank >= 0),
  rx_bonus_points             INTEGER NOT NULL DEFAULT 5 CHECK (rx_bonus_points >= 0),
  tagline                     TEXT NOT NULL DEFAULT 'La constancia construye campeones.',
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ranking_point_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id           UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  usuario_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month_key        TEXT NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  fecha            DATE NOT NULL,
  clase_id         UUID REFERENCES clases(id) ON DELETE SET NULL,
  reserva_id       UUID REFERENCES reservas(id) ON DELETE SET NULL,
  event_type       ranking_event_type NOT NULL,
  points           INTEGER NOT NULL,
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ranking_events_box_month
  ON ranking_point_events(box_id, month_key);
CREATE INDEX IF NOT EXISTS idx_ranking_events_usuario_month
  ON ranking_point_events(usuario_id, month_key);
CREATE INDEX IF NOT EXISTS idx_ranking_events_fecha
  ON ranking_point_events(box_id, fecha);

CREATE TABLE IF NOT EXISTS ranking_monthly_awards (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id       UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  month_key    TEXT NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  category     TEXT CHECK (
    category IS NULL
    OR category IN ('beginner', 'intermediate', 'advanced', 'rx')
  ),
  award_type   ranking_award_type NOT NULL,
  usuario_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points       INTEGER NOT NULL DEFAULT 0,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (box_id, month_key, category, award_type, usuario_id)
);

CREATE OR REPLACE FUNCTION ranking_config_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ranking_config_updated ON ranking_config;
CREATE TRIGGER trg_ranking_config_updated
  BEFORE UPDATE ON ranking_config
  FOR EACH ROW EXECUTE FUNCTION ranking_config_set_updated_at();

ALTER TABLE ranking_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_point_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_monthly_awards ENABLE ROW LEVEL SECURITY;

-- Config: admin del box
DROP POLICY IF EXISTS "ranking_config_admin" ON ranking_config;
CREATE POLICY "ranking_config_admin"
  ON ranking_config FOR ALL
  USING (is_coach_or_admin())
  WITH CHECK (is_coach_or_admin());

DROP POLICY IF EXISTS "ranking_config_public_read" ON ranking_config;
CREATE POLICY "ranking_config_public_read"
  ON ranking_config FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM boxes b WHERE b.id = ranking_config.box_id AND b.status = 'active')
  );

-- Events: socio ve propios + box members ven agregados del box
DROP POLICY IF EXISTS "ranking_events_select" ON ranking_point_events;
CREATE POLICY "ranking_events_select"
  ON ranking_point_events FOR SELECT
  USING (
    usuario_id = get_my_profile_id()
    OR is_coach_or_admin()
    OR EXISTS (
      SELECT 1 FROM profiles me
      WHERE me.user_id = auth.uid()
        AND me.box_id = ranking_point_events.box_id
    )
    OR EXISTS (
      SELECT 1 FROM boxes b
      WHERE b.id = ranking_point_events.box_id AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "ranking_events_insert_service" ON ranking_point_events;
CREATE POLICY "ranking_events_insert_service"
  ON ranking_point_events FOR INSERT
  WITH CHECK (true);

-- Awards: lectura pública del box activo
DROP POLICY IF EXISTS "ranking_awards_select" ON ranking_monthly_awards;
CREATE POLICY "ranking_awards_select"
  ON ranking_monthly_awards FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM boxes b WHERE b.id = ranking_monthly_awards.box_id AND b.status = 'active')
    OR is_coach_or_admin()
  );

DROP POLICY IF EXISTS "ranking_awards_admin" ON ranking_monthly_awards;
CREATE POLICY "ranking_awards_admin"
  ON ranking_monthly_awards FOR ALL
  USING (is_coach_or_admin())
  WITH CHECK (is_coach_or_admin());

-- Seed config para boxes activos existentes
INSERT INTO ranking_config (box_id)
SELECT id FROM boxes WHERE status = 'active'
ON CONFLICT (box_id) DO NOTHING;

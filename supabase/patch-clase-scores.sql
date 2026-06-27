-- Scores de clase (WOD) + ranking diario por clase
-- Ejecutar en Supabase SQL Editor

CREATE TYPE clase_score_tipo AS ENUM ('tiempo', 'peso', 'reps', 'rondas', 'cals', 'otro');

CREATE TABLE IF NOT EXISTS clase_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clase_id        UUID NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reserva_id      UUID REFERENCES reservas(id) ON DELETE SET NULL,
  score_display   TEXT NOT NULL,
  score_tipo      clase_score_tipo NOT NULL DEFAULT 'otro',
  valor_numerico  NUMERIC(12,2) CHECK (valor_numerico IS NULL OR valor_numerico >= 0),
  rx              BOOLEAN NOT NULL DEFAULT true,
  sin_score       BOOLEAN NOT NULL DEFAULT false,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clase_id, usuario_id),
  CONSTRAINT clase_scores_score_display_check CHECK (
    sin_score = true OR char_length(trim(score_display)) > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_clase_scores_clase ON clase_scores(clase_id);
CREATE INDEX IF NOT EXISTS idx_clase_scores_usuario ON clase_scores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_clase_scores_clase_valor ON clase_scores(clase_id, score_tipo, valor_numerico);

CREATE OR REPLACE FUNCTION set_clase_scores_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clase_scores_updated ON clase_scores;
CREATE TRIGGER trg_clase_scores_updated
  BEFORE UPDATE ON clase_scores
  FOR EACH ROW
  EXECUTE FUNCTION set_clase_scores_updated_at();

ALTER TABLE clase_scores ENABLE ROW LEVEL SECURITY;

-- Socios del mismo box ven scores (ranking); cada uno edita el suyo
CREATE POLICY "clase_scores_select_box"
  ON clase_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles me
      JOIN clases c ON c.id = clase_scores.clase_id
      JOIN profiles coach ON coach.id = c.coach_id
      WHERE me.user_id = auth.uid()
        AND me.box_id = coach.box_id
    )
    OR is_coach_or_admin()
  );

CREATE POLICY "clase_scores_insert_own"
  ON clase_scores FOR INSERT
  WITH CHECK (usuario_id = get_my_profile_id());

CREATE POLICY "clase_scores_update_own"
  ON clase_scores FOR UPDATE
  USING (usuario_id = get_my_profile_id())
  WITH CHECK (usuario_id = get_my_profile_id());

CREATE POLICY "clase_scores_delete_own"
  ON clase_scores FOR DELETE
  USING (usuario_id = get_my_profile_id());

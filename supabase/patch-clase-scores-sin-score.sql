-- Permite marcar clases sin score (técnica, movilidad, etc.)
-- Ejecutar después de patch-clase-scores.sql

ALTER TABLE clase_scores
  ADD COLUMN IF NOT EXISTS sin_score BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE clase_scores
  DROP CONSTRAINT IF EXISTS clase_scores_score_display_check;

ALTER TABLE clase_scores
  ADD CONSTRAINT clase_scores_score_display_check
  CHECK (
    sin_score = true
    OR char_length(trim(score_display)) > 0
  );

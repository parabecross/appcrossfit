-- Añadir tipo de score "cals" (calorías)
-- Ejecutar en Supabase si ya aplicaste patch-clase-scores.sql sin cals

ALTER TYPE clase_score_tipo ADD VALUE IF NOT EXISTS 'cals' BEFORE 'otro';

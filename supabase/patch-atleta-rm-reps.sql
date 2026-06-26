-- Run in Supabase SQL Editor (después de patch-atleta-record-tipo.sql)

ALTER TABLE atleta_pr_marcas
  ADD COLUMN IF NOT EXISTS rm_reps INTEGER CHECK (rm_reps IS NULL OR rm_reps > 0);

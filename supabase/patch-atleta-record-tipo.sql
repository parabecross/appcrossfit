-- Run in Supabase SQL Editor: tipo PR vs RM en marcas personales

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'record_tipo') THEN
    CREATE TYPE record_tipo AS ENUM ('pr', 'rm');
  END IF;
END $$;

ALTER TABLE atleta_pr_marcas
  ADD COLUMN IF NOT EXISTS record_tipo record_tipo NOT NULL DEFAULT 'pr';

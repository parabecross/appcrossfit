-- ATHRON — Legacy / Athlete Card
-- Ejecutar en Supabase SQL Editor.
-- Campos para identidad deportiva compartible.

ALTER TABLE atleta_perfil_deportivo
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS disciplina TEXT,
  ADD COLUMN IF NOT EXISTS nivel_deportivo TEXT
    CHECK (
      nivel_deportivo IS NULL
      OR nivel_deportivo IN ('beginner', 'intermediate', 'advanced', 'rx')
    ),
  ADD COLUMN IF NOT EXISTS frase_legacy TEXT;

COMMENT ON COLUMN atleta_perfil_deportivo.fecha_nacimiento IS 'Para calcular edad en Athlete Card';
COMMENT ON COLUMN atleta_perfil_deportivo.disciplina IS 'Disciplina principal (CrossFit, Hyrox, etc.)';
COMMENT ON COLUMN atleta_perfil_deportivo.nivel_deportivo IS 'Beginner | Intermediate | Advanced | RX';
COMMENT ON COLUMN atleta_perfil_deportivo.frase_legacy IS 'Frase personal en Athlete Card';

-- Run in Supabase SQL Editor: progreso personal del atleta (PRs + skills)

CREATE TYPE pr_unidad AS ENUM ('lbs', 'reps', 'segundos', 'metros');
CREATE TYPE skill_estado AS ENUM ('en_proceso', 'logrado', 'dominado');

CREATE TABLE IF NOT EXISTS atleta_pr_marcas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ejercicio   TEXT NOT NULL,
  valor       NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  unidad      pr_unidad NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atleta_pr_usuario ON atleta_pr_marcas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_atleta_pr_ejercicio ON atleta_pr_marcas(usuario_id, ejercicio, created_at DESC);

CREATE TABLE IF NOT EXISTS atleta_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill       TEXT NOT NULL,
  estado      skill_estado NOT NULL DEFAULT 'en_proceso',
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, skill)
);

CREATE INDEX IF NOT EXISTS idx_atleta_skills_usuario ON atleta_skills(usuario_id);

CREATE TABLE IF NOT EXISTS atleta_skill_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id        UUID NOT NULL REFERENCES atleta_skills(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  estado_anterior skill_estado,
  estado_nuevo    skill_estado NOT NULL,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atleta_skill_hist ON atleta_skill_historial(usuario_id, created_at DESC);

CREATE OR REPLACE FUNCTION log_atleta_skill_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO atleta_skill_historial (skill_id, usuario_id, estado_anterior, estado_nuevo, notas)
    VALUES (NEW.id, NEW.usuario_id, NULL, NEW.estado, NEW.notas);
    RETURN NEW;
  END IF;

  IF OLD.estado IS DISTINCT FROM NEW.estado OR OLD.notas IS DISTINCT FROM NEW.notas THEN
    NEW.updated_at := now();
    INSERT INTO atleta_skill_historial (skill_id, usuario_id, estado_anterior, estado_nuevo, notas)
    VALUES (NEW.id, NEW.usuario_id, OLD.estado, NEW.estado, NEW.notas);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atleta_skill_historial ON atleta_skills;
CREATE TRIGGER trg_atleta_skill_historial
  AFTER INSERT OR UPDATE ON atleta_skills
  FOR EACH ROW
  EXECUTE FUNCTION log_atleta_skill_change();

ALTER TABLE atleta_pr_marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atleta_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE atleta_skill_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "atleta_pr_select"
  ON atleta_pr_marcas FOR SELECT
  USING (usuario_id = get_my_profile_id() OR is_coach_or_admin());

CREATE POLICY "atleta_pr_insert_own"
  ON atleta_pr_marcas FOR INSERT
  WITH CHECK (usuario_id = get_my_profile_id());

CREATE POLICY "atleta_pr_update_own"
  ON atleta_pr_marcas FOR UPDATE
  USING (usuario_id = get_my_profile_id())
  WITH CHECK (usuario_id = get_my_profile_id());

CREATE POLICY "atleta_pr_delete_own"
  ON atleta_pr_marcas FOR DELETE
  USING (usuario_id = get_my_profile_id());

CREATE POLICY "atleta_skills_select"
  ON atleta_skills FOR SELECT
  USING (usuario_id = get_my_profile_id() OR is_coach_or_admin());

CREATE POLICY "atleta_skills_insert_own"
  ON atleta_skills FOR INSERT
  WITH CHECK (usuario_id = get_my_profile_id());

CREATE POLICY "atleta_skills_update_own"
  ON atleta_skills FOR UPDATE
  USING (usuario_id = get_my_profile_id())
  WITH CHECK (usuario_id = get_my_profile_id());

CREATE POLICY "atleta_skills_delete_own"
  ON atleta_skills FOR DELETE
  USING (usuario_id = get_my_profile_id());

CREATE POLICY "atleta_skill_hist_select"
  ON atleta_skill_historial FOR SELECT
  USING (usuario_id = get_my_profile_id() OR is_coach_or_admin());

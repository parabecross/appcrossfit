-- ATHRON — Expediente Deportivo Fase 1
-- Ejecutar en Supabase SQL Editor (revisar antes de aplicar).
-- No modifica auth, reservas, membresías ni roles.

-- ─── 1. Unidad kg en PRs (principal) ─────────────────────────────────────────

DO $$
BEGIN
  ALTER TYPE pr_unidad ADD VALUE 'kg';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Relabel marcas existentes en lbs → kg (valores sin conversión numérica).
UPDATE atleta_pr_marcas
SET unidad = 'kg'
WHERE unidad::text = 'lbs';

-- ─── 2. Objetivos personales ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS atleta_objetivos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  estado         TEXT NOT NULL DEFAULT 'en_proceso'
                 CHECK (estado IN ('en_proceso', 'completado', 'pausado', 'cancelado')),
  progreso_pct   INT NOT NULL DEFAULT 0 CHECK (progreso_pct BETWEEN 0 AND 100),
  fecha_objetivo DATE,
  notas          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atleta_objetivos_usuario
  ON atleta_objetivos(usuario_id);

CREATE INDEX IF NOT EXISTS idx_atleta_objetivos_activo
  ON atleta_objetivos(usuario_id, estado)
  WHERE estado = 'en_proceso';

CREATE OR REPLACE FUNCTION atleta_objetivos_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atleta_objetivos_updated ON atleta_objetivos;
CREATE TRIGGER trg_atleta_objetivos_updated
  BEFORE UPDATE ON atleta_objetivos
  FOR EACH ROW
  EXECUTE FUNCTION atleta_objetivos_set_updated_at();

-- ─── 3. Perfil deportivo ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS atleta_perfil_deportivo (
  usuario_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  peso_corporal_kg     NUMERIC(5,2) CHECK (peso_corporal_kg IS NULL OR peso_corporal_kg > 0),
  estatura_cm          INT CHECK (estatura_cm IS NULL OR estatura_cm > 0),
  anos_entrenando      INT CHECK (anos_entrenando IS NULL OR anos_entrenando >= 0),
  modalidad_favorita   TEXT,
  notas                TEXT,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION atleta_perfil_deportivo_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atleta_perfil_deportivo_updated ON atleta_perfil_deportivo;
CREATE TRIGGER trg_atleta_perfil_deportivo_updated
  BEFORE UPDATE ON atleta_perfil_deportivo
  FOR EACH ROW
  EXECUTE FUNCTION atleta_perfil_deportivo_set_updated_at();

-- ─── 4. RLS (mismo patrón que atleta_pr_marcas) ─────────────────────────────

ALTER TABLE atleta_objetivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atleta_perfil_deportivo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "atleta_objetivos_select" ON atleta_objetivos;
CREATE POLICY "atleta_objetivos_select"
  ON atleta_objetivos FOR SELECT
  USING (usuario_id = get_my_profile_id() OR is_coach_or_admin());

DROP POLICY IF EXISTS "atleta_objetivos_insert_own" ON atleta_objetivos;
CREATE POLICY "atleta_objetivos_insert_own"
  ON atleta_objetivos FOR INSERT
  WITH CHECK (usuario_id = get_my_profile_id());

DROP POLICY IF EXISTS "atleta_objetivos_update_own" ON atleta_objetivos;
CREATE POLICY "atleta_objetivos_update_own"
  ON atleta_objetivos FOR UPDATE
  USING (usuario_id = get_my_profile_id())
  WITH CHECK (usuario_id = get_my_profile_id());

DROP POLICY IF EXISTS "atleta_objetivos_delete_own" ON atleta_objetivos;
CREATE POLICY "atleta_objetivos_delete_own"
  ON atleta_objetivos FOR DELETE
  USING (usuario_id = get_my_profile_id());

DROP POLICY IF EXISTS "atleta_perfil_deportivo_select" ON atleta_perfil_deportivo;
CREATE POLICY "atleta_perfil_deportivo_select"
  ON atleta_perfil_deportivo FOR SELECT
  USING (usuario_id = get_my_profile_id() OR is_coach_or_admin());

DROP POLICY IF EXISTS "atleta_perfil_deportivo_insert_own" ON atleta_perfil_deportivo;
CREATE POLICY "atleta_perfil_deportivo_insert_own"
  ON atleta_perfil_deportivo FOR INSERT
  WITH CHECK (usuario_id = get_my_profile_id());

DROP POLICY IF EXISTS "atleta_perfil_deportivo_update_own" ON atleta_perfil_deportivo;
CREATE POLICY "atleta_perfil_deportivo_update_own"
  ON atleta_perfil_deportivo FOR UPDATE
  USING (usuario_id = get_my_profile_id())
  WITH CHECK (usuario_id = get_my_profile_id());

DROP POLICY IF EXISTS "atleta_perfil_deportivo_delete_own" ON atleta_perfil_deportivo;
CREATE POLICY "atleta_perfil_deportivo_delete_own"
  ON atleta_perfil_deportivo FOR DELETE
  USING (usuario_id = get_my_profile_id());

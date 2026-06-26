-- Parabellum Cross — Schema completo
-- Ejecutar en Supabase SQL Editor (en orden)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'socio', 'coach');
CREATE TYPE account_status AS ENUM ('pendiente_pago', 'activo', 'inactivo');
CREATE TYPE plan_tipo AS ENUM ('mensual_fijo', 'convenio_externo');
CREATE TYPE membresia_estado AS ENUM ('vigente', 'vencida', 'cancelada');
CREATE TYPE metodo_asignacion AS ENUM ('automatico', 'manual');
CREATE TYPE clase_estado AS ENUM ('programada', 'cancelada');
CREATE TYPE reserva_estado AS ENUM ('confirmada', 'cancelada', 'asistio', 'no_asistio');

-- ─── PROFILES ────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT NOT NULL,
  telefono        TEXT,
  foto_url        TEXT,
  bio             TEXT,
  rol             user_role NOT NULL DEFAULT 'socio',
  estado_cuenta   account_status NOT NULL DEFAULT 'pendiente_pago',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_rol ON profiles(rol);
CREATE INDEX idx_profiles_estado ON profiles(estado_cuenta);

-- ─── PLANES ──────────────────────────────────────────────────────────────────

CREATE TABLE planes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         TEXT NOT NULL,
  tipo           plan_tipo NOT NULL DEFAULT 'mensual_fijo',
  duracion_dias  INT NOT NULL DEFAULT 30 CHECK (duracion_dias > 0),
  precio         NUMERIC(10,2),
  activo         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── MEMBRESIAS ──────────────────────────────────────────────────────────────
-- FUTURO: tabla pagos separada referenciando membresia_id (Stripe / Mercado Pago)

CREATE TABLE membresias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id           UUID NOT NULL REFERENCES planes(id),
  fecha_inicio      DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin         DATE NOT NULL,
  estado            membresia_estado NOT NULL DEFAULT 'vigente',
  metodo_asignacion metodo_asignacion NOT NULL DEFAULT 'automatico',
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_membresias_usuario ON membresias(usuario_id);
CREATE INDEX idx_membresias_estado ON membresias(estado);
CREATE INDEX idx_membresias_fecha_fin ON membresias(fecha_fin);

-- ─── CLASES ──────────────────────────────────────────────────────────────────
-- FUTURO: ALTER TABLE clases ADD COLUMN gym_id UUID REFERENCES gyms(id);

CREATE TABLE clases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  fecha        DATE NOT NULL,
  hora_inicio  TIME NOT NULL,
  hora_fin     TIME NOT NULL,
  cupo_maximo  INT NOT NULL DEFAULT 12 CHECK (cupo_maximo > 0),
  coach_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entrenamiento TEXT,
  estado       clase_estado NOT NULL DEFAULT 'programada',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fin > hora_inicio)
);

CREATE INDEX idx_clases_fecha ON clases(fecha);
CREATE INDEX idx_clases_coach ON clases(coach_id);

-- ─── RESERVAS ────────────────────────────────────────────────────────────────

CREATE TABLE reservas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clase_id       UUID NOT NULL REFERENCES clases(id) ON DELETE CASCADE,
  usuario_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fecha_reserva  TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado         reserva_estado NOT NULL DEFAULT 'confirmada',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservas_clase ON reservas(clase_id);
CREATE INDEX idx_reservas_usuario ON reservas(usuario_id);

-- Una reserva activa por usuario/clase (permite re-reservar tras cancelar)
CREATE UNIQUE INDEX idx_reservas_activa
  ON reservas(clase_id, usuario_id)
  WHERE estado IN ('confirmada', 'asistio');

-- ─── PROGRESO ATLETA ─────────────────────────────────────────────────────────

CREATE TYPE pr_unidad AS ENUM ('lbs', 'reps', 'segundos', 'metros');
CREATE TYPE skill_estado AS ENUM ('en_proceso', 'logrado', 'dominado');

CREATE TABLE atleta_pr_marcas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ejercicio   TEXT NOT NULL,
  valor       NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  unidad      pr_unidad NOT NULL,
  fecha       DATE NOT NULL DEFAULT CURRENT_DATE,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atleta_pr_usuario ON atleta_pr_marcas(usuario_id);
CREATE INDEX idx_atleta_pr_ejercicio ON atleta_pr_marcas(usuario_id, ejercicio, created_at DESC);

CREATE TABLE atleta_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skill       TEXT NOT NULL,
  estado      skill_estado NOT NULL DEFAULT 'en_proceso',
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, skill)
);

CREATE INDEX idx_atleta_skills_usuario ON atleta_skills(usuario_id);

CREATE TABLE atleta_skill_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id        UUID NOT NULL REFERENCES atleta_skills(id) ON DELETE CASCADE,
  usuario_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  estado_anterior skill_estado,
  estado_nuevo    skill_estado NOT NULL,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_atleta_skill_hist ON atleta_skill_historial(usuario_id, created_at DESC);

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

CREATE TRIGGER trg_atleta_skill_historial
  AFTER INSERT OR UPDATE ON atleta_skills
  FOR EACH ROW
  EXECUTE FUNCTION log_atleta_skill_change();

-- ─── FUNCTIONS ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION is_coach_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE user_id = auth.uid() AND rol IN ('admin', 'coach')
  );
$$;

CREATE OR REPLACE FUNCTION get_my_profile_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_coach_of_clase(p_clase_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM clases c
    WHERE c.id = p_clase_id
      AND c.coach_id = get_my_profile_id()
  );
$$;

CREATE OR REPLACE FUNCTION sync_membresia_estado()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.estado = 'cancelada' THEN
    RETURN NEW;
  END IF;
  IF NEW.fecha_fin < CURRENT_DATE THEN
    NEW.estado := 'vencida';
  ELSE
    NEW.estado := 'vigente';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_membresia_estado
  BEFORE INSERT OR UPDATE ON membresias
  FOR EACH ROW
  EXECUTE FUNCTION sync_membresia_estado();

CREATE OR REPLACE FUNCTION validate_coach_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.coach_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = NEW.coach_id AND rol IN ('admin', 'coach')
    ) THEN
      RAISE EXCEPTION 'coach_id must reference a profile with rol admin or coach';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_coach
  BEFORE INSERT OR UPDATE ON clases
  FOR EACH ROW
  EXECUTE FUNCTION validate_coach_profile();

CREATE OR REPLACE FUNCTION check_reserva_cupo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_cupo_max INT;
  v_ocupado INT;
BEGIN
  IF NEW.estado NOT IN ('confirmada', 'asistio') THEN
    RETURN NEW;
  END IF;

  SELECT cupo_maximo INTO v_cupo_max
  FROM clases WHERE id = NEW.clase_id;

  SELECT COUNT(*) INTO v_ocupado
  FROM reservas
  WHERE clase_id = NEW.clase_id
    AND estado IN ('confirmada', 'asistio')
    AND id IS DISTINCT FROM NEW.id;

  IF v_ocupado >= v_cupo_max THEN
    RAISE EXCEPTION 'Clase llena: cupo máximo alcanzado';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_reserva_cupo
  BEFORE INSERT OR UPDATE ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION check_reserva_cupo();

CREATE OR REPLACE FUNCTION check_reserva_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  clase_rec RECORD;
  class_start TIMESTAMP;
  class_end TIMESTAMP;
  cutoff TIMESTAMP;
BEGIN
  SELECT fecha, hora_inicio, hora_fin, estado
  INTO clase_rec
  FROM clases
  WHERE id = NEW.clase_id;

  IF NOT FOUND OR clase_rec.estado != 'programada' THEN
    RAISE EXCEPTION 'Clase no disponible para reservar';
  END IF;

  class_start := clase_rec.fecha::timestamp + clase_rec.hora_inicio;
  class_end := clase_rec.fecha::timestamp + clase_rec.hora_fin;
  cutoff := class_start - INTERVAL '20 minutes';

  IF NOW() >= class_end THEN
    RAISE EXCEPTION 'La clase ya finalizó';
  END IF;

  IF NOW() >= cutoff THEN
    RAISE EXCEPTION 'Reservas cerradas: máximo 20 minutos antes del inicio';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reserva_timing
  BEFORE INSERT ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION check_reserva_timing();

CREATE OR REPLACE FUNCTION refresh_vencidas_membresias()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE membresias
  SET updated_at = now()
  WHERE estado = 'vigente' AND fecha_fin < CURRENT_DATE;
END;
$$;

-- FUTURO: notificaciones automáticas (email / WhatsApp / push)
-- Edge Function cron diario:
--   SELECT * FROM alertas_membresia WHERE tipo IN ('vencida', 'por_vencer');
--   → enviar via Twilio / Resend / Meta WhatsApp API

-- ─── VIEWS ───────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW membresia_actual AS
SELECT DISTINCT ON (m.usuario_id)
  m.id,
  m.usuario_id,
  m.plan_id,
  m.fecha_inicio,
  m.fecha_fin,
  m.estado,
  m.metodo_asignacion,
  m.notas,
  p.nombre AS plan_nombre,
  p.tipo AS plan_tipo,
  p.precio AS plan_precio
FROM membresias m
JOIN planes p ON p.id = m.plan_id
WHERE m.estado IN ('vigente', 'vencida')
ORDER BY m.usuario_id, m.fecha_fin DESC;

CREATE OR REPLACE VIEW alertas_membresia AS
SELECT
  pr.id AS profile_id,
  pr.nombre_completo,
  pr.telefono,
  pr.user_id,
  ma.plan_nombre,
  ma.fecha_fin,
  CASE
    WHEN ma.fecha_fin < CURRENT_DATE THEN 'vencida'
    WHEN ma.fecha_fin <= CURRENT_DATE + INTERVAL '3 days' THEN 'por_vencer'
    ELSE 'ok'
  END AS tipo_alerta
FROM profiles pr
LEFT JOIN membresia_actual ma ON ma.usuario_id = pr.id
WHERE pr.rol = 'socio'
  AND (
    ma.fecha_fin IS NULL
    OR ma.fecha_fin < CURRENT_DATE
    OR ma.fecha_fin <= CURRENT_DATE + INTERVAL '3 days'
  );

CREATE OR REPLACE VIEW reservas_con_cupo AS
SELECT
  c.*,
  COALESCE(pr.nombre_completo, 'Sin coach') AS coach_nombre,
  (
    SELECT COUNT(*)::INT FROM reservas r
    WHERE r.clase_id = c.id AND r.estado IN ('confirmada', 'asistio')
  ) AS cupo_ocupado
FROM clases c
LEFT JOIN profiles pr ON pr.id = c.coach_id;

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE membresias ENABLE ROW LEVEL SECURITY;
ALTER TABLE clases ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atleta_pr_marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atleta_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE atleta_skill_historial ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own_or_staff"
  ON profiles FOR SELECT
  USING (user_id = auth.uid() OR is_coach_or_admin());

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  WITH CHECK (is_admin());

-- Socios pueden ver perfiles de coaches (nombre en clases)
CREATE POLICY "profiles_select_coaches"
  ON profiles FOR SELECT
  USING (rol IN ('coach', 'admin'));

-- planes
CREATE POLICY "planes_select_all_authenticated"
  ON planes FOR SELECT
  TO authenticated
  USING (activo = true OR is_admin());

CREATE POLICY "planes_admin_all"
  ON planes FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- membresias
CREATE POLICY "membresias_select_own_or_admin"
  ON membresias FOR SELECT
  USING (usuario_id = get_my_profile_id() OR is_admin());

CREATE POLICY "membresias_admin_all"
  ON membresias FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- clases
CREATE POLICY "clases_select_authenticated"
  ON clases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "clases_admin_all"
  ON clases FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "clases_update_coach_assigned"
  ON clases FOR UPDATE
  USING (coach_id = get_my_profile_id())
  WITH CHECK (coach_id = get_my_profile_id());

-- reservas
CREATE POLICY "reservas_select_own_or_admin"
  ON reservas FOR SELECT
  USING (usuario_id = get_my_profile_id() OR is_admin());

CREATE POLICY "reservas_insert_own"
  ON reservas FOR INSERT
  WITH CHECK (usuario_id = get_my_profile_id());

CREATE POLICY "reservas_update_own_or_admin"
  ON reservas FOR UPDATE
  USING (usuario_id = get_my_profile_id() OR is_admin());

CREATE POLICY "reservas_select_coach_of_class"
  ON reservas FOR SELECT
  USING (is_coach_of_clase(clase_id));

CREATE POLICY "reservas_update_coach_of_class"
  ON reservas FOR UPDATE
  USING (is_coach_of_clase(clase_id))
  WITH CHECK (is_coach_of_clase(clase_id));

-- atleta progreso
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

-- ─── STORAGE ─────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_upload_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── AUTO PROFILE ON SIGNUP ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (user_id, nombre_completo, telefono, bio, rol, estado_cuenta)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefono',
    NEW.raw_user_meta_data->>'bio',
    COALESCE((NEW.raw_user_meta_data->>'rol')::user_role, 'socio'),
    'pendiente_pago'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

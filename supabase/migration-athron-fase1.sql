-- ─── ATHRON Fase 1: estructura multi-tenant ─────────────────────────────────
-- IMPORTANTE: haz backup de Supabase antes de ejecutar.
-- Ejecutar en SQL Editor. No mezclar con otras migraciones en la misma transacción.

CREATE TYPE box_status AS ENUM ('active', 'inactive', 'trial');
CREATE TYPE box_plan AS ENUM ('free', 'basic', 'pro', 'enterprise');

CREATE TABLE boxes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  logo_url      TEXT,
  address       TEXT,
  phone         TEXT,
  email         TEXT,
  timezone      TEXT NOT NULL DEFAULT 'America/Mexico_City',
  status        box_status NOT NULL DEFAULT 'trial',
  plan          box_plan NOT NULL DEFAULT 'free',
  owner_user_id UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_boxes_status ON boxes(status);
CREATE INDEX idx_boxes_slug ON boxes(slug);

INSERT INTO boxes (name, slug, status, plan, timezone)
VALUES ('Parabellum Cross', 'parabellum-cross', 'active', 'pro', 'America/Mexico_City');

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS box_id UUID REFERENCES boxes(id);

UPDATE profiles
SET box_id = (SELECT id FROM boxes WHERE slug = 'parabellum-cross')
WHERE box_id IS NULL;

ALTER TABLE profiles ALTER COLUMN box_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_box_id ON profiles(box_id);

UPDATE boxes
SET owner_user_id = (
  SELECT user_id FROM profiles WHERE rol = 'admin' ORDER BY created_at LIMIT 1
)
WHERE slug = 'parabellum-cross';

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;
-- Marcar manualmente al usuario maestro ATHRON:
-- UPDATE profiles SET is_super_admin = true WHERE user_id = '<tu-user-id>';

CREATE OR REPLACE FUNCTION get_my_box_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT box_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND is_super_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION is_my_box_active()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM boxes b
    JOIN profiles p ON p.box_id = b.id
    WHERE p.user_id = auth.uid() AND b.status = 'active'
  );
$$;

-- Timezone por box (coach asignado, o box del atleta que reserva)
CREATE OR REPLACE FUNCTION check_reserva_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  clase_rec RECORD;
  class_start TIMESTAMPTZ;
  class_end TIMESTAMPTZ;
  cutoff TIMESTAMPTZ;
  v_gym_tz TEXT;
BEGIN
  SELECT c.fecha, c.hora_inicio, c.hora_fin, c.estado, b.timezone
  INTO clase_rec
  FROM clases c
  JOIN profiles coach ON coach.id = c.coach_id
  JOIN boxes b ON b.id = coach.box_id
  WHERE c.id = NEW.clase_id;

  IF NOT FOUND THEN
    SELECT c.fecha, c.hora_inicio, c.hora_fin, c.estado, b.timezone
    INTO clase_rec
    FROM clases c
    JOIN profiles p ON p.id = NEW.usuario_id
    JOIN boxes b ON b.id = p.box_id
    WHERE c.id = NEW.clase_id;
  END IF;

  IF NOT FOUND OR clase_rec.estado != 'programada' THEN
    RAISE EXCEPTION 'Clase no disponible para reservar';
  END IF;

  v_gym_tz := COALESCE(clase_rec.timezone, 'America/Mexico_City');
  class_start := (clase_rec.fecha + clase_rec.hora_inicio)::timestamp AT TIME ZONE v_gym_tz;
  class_end := (clase_rec.fecha + clase_rec.hora_fin)::timestamp AT TIME ZONE v_gym_tz;
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

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_box_id UUID;
BEGIN
  v_box_id := (NEW.raw_user_meta_data->>'box_id')::UUID;

  IF v_box_id IS NULL THEN
    SELECT id INTO v_box_id FROM boxes WHERE slug = 'parabellum-cross';
  END IF;

  INSERT INTO profiles (
    user_id, nombre_completo, telefono, bio, rol, estado_cuenta, box_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefono',
    NEW.raw_user_meta_data->>'bio',
    COALESCE((NEW.raw_user_meta_data->>'rol')::user_role, 'socio'),
    'pendiente_pago',
    v_box_id
  );
  RETURN NEW;
END;
$$;

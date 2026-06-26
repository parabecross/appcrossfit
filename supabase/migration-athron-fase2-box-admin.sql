-- ─── ATHRON Fase 2 — PASO 2 (después de migration-athron-fase2-enum.sql) ───

-- RLS mínima para dropdown de registro (Fase 5 amplía policies)
ALTER TABLE boxes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "boxes_public_select_active" ON boxes;
CREATE POLICY "boxes_public_select_active"
  ON boxes FOR SELECT
  USING (status IN ('active', 'trial'));

-- Registro gym: crea box trial; atleta/coach: usa box_id del metadata
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_box_id UUID;
  v_rol user_role;
  v_box_name TEXT;
  v_box_slug TEXT;
  v_estado account_status;
BEGIN
  v_rol := COALESCE((NEW.raw_user_meta_data->>'rol')::user_role, 'socio');
  v_box_id := (NEW.raw_user_meta_data->>'box_id')::UUID;

  IF v_rol = 'box_admin' AND v_box_id IS NULL THEN
    v_box_name := NULLIF(trim(NEW.raw_user_meta_data->>'box_name'), '');
    v_box_slug := NULLIF(trim(NEW.raw_user_meta_data->>'box_slug'), '');
    IF v_box_name IS NULL OR v_box_slug IS NULL THEN
      RAISE EXCEPTION 'box_name y box_slug son requeridos para registro de gym';
    END IF;
    INSERT INTO boxes (name, slug, status, plan, timezone, owner_user_id)
    VALUES (
      v_box_name,
      v_box_slug,
      'trial',
      'free',
      COALESCE(NULLIF(NEW.raw_user_meta_data->>'box_timezone', ''), 'America/Mexico_City'),
      NEW.id
    )
    RETURNING id INTO v_box_id;
  ELSIF v_box_id IS NULL THEN
    SELECT id INTO v_box_id FROM boxes WHERE slug = 'parabellum-cross';
  END IF;

  v_estado := CASE
    WHEN v_rol IN ('coach', 'box_admin', 'admin') THEN 'activo'::account_status
    ELSE 'pendiente_pago'::account_status
  END;

  INSERT INTO profiles (
    user_id, nombre_completo, telefono, bio, rol, estado_cuenta, box_id
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'telefono',
    NEW.raw_user_meta_data->>'bio',
    v_rol,
    v_estado,
    v_box_id
  );
  RETURN NEW;
END;
$$;

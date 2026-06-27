-- Bloquea auto-registro como coach/admin vía raw_user_meta_data.
-- Coaches solo se crean por un admin existente en POST /api/admin/coach (service role).
-- box_admin solo al registrar un gym nuevo (box_name + box_slug, sin box_id previo).

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
  v_box_name := NULLIF(trim(NEW.raw_user_meta_data->>'box_name'), '');
  v_box_slug := NULLIF(trim(NEW.raw_user_meta_data->>'box_slug'), '');

  -- Nunca elevar privilegios por metadata (registro público)
  IF v_rol IN ('coach', 'admin') THEN
    v_rol := 'socio';
  END IF;

  -- box_admin: único rol elevado permitido en auto-registro, solo al crear gym nuevo
  IF v_rol = 'box_admin' AND v_box_id IS NULL
     AND v_box_name IS NOT NULL AND v_box_slug IS NOT NULL THEN
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
  ELSIF v_rol = 'box_admin' THEN
    -- Intento de box_admin sin crear gym → socio
    v_rol := 'socio';
  END IF;

  IF v_box_id IS NULL THEN
    v_box_id := (NEW.raw_user_meta_data->>'box_id')::UUID;
  END IF;

  IF v_box_id IS NULL THEN
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

-- Permite insertar reservas históricas desde scripts de seed (bypass timing/cupo).
-- Ejecutar una vez en Supabase SQL Editor antes de npm run reset-parabellum
-- si las reservas pasadas fallan por triggers.

CREATE OR REPLACE FUNCTION admin_insert_reserva(
  p_clase_id UUID,
  p_usuario_id UUID,
  p_estado reserva_estado DEFAULT 'confirmada'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  PERFORM set_config('session_replication_role', 'replica', true);

  INSERT INTO reservas (clase_id, usuario_id, estado)
  VALUES (p_clase_id, p_usuario_id, p_estado)
  RETURNING id INTO v_id;

  PERFORM set_config('session_replication_role', 'origin', true);
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_insert_reserva(UUID, UUID, reserva_estado) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_insert_reserva(UUID, UUID, reserva_estado) TO service_role;

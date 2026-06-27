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
  ALTER TABLE reservas DISABLE TRIGGER USER;

  INSERT INTO reservas (clase_id, usuario_id, estado)
  VALUES (p_clase_id, p_usuario_id, p_estado)
  RETURNING id INTO v_id;

  ALTER TABLE reservas ENABLE TRIGGER USER;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE reservas ENABLE TRIGGER USER;
  RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION admin_insert_clase_score(
  p_clase_id UUID,
  p_usuario_id UUID,
  p_reserva_id UUID,
  p_score_display TEXT,
  p_score_tipo clase_score_tipo,
  p_valor_numerico NUMERIC,
  p_rx BOOLEAN DEFAULT true,
  p_sin_score BOOLEAN DEFAULT false,
  p_notas TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  ALTER TABLE clase_scores DISABLE TRIGGER USER;

  INSERT INTO clase_scores (
    clase_id, usuario_id, reserva_id,
    score_display, score_tipo, valor_numerico, rx, sin_score, notas
  )
  VALUES (
    p_clase_id, p_usuario_id, p_reserva_id,
    p_score_display, p_score_tipo, p_valor_numerico, p_rx, p_sin_score, p_notas
  )
  ON CONFLICT (clase_id, usuario_id) DO UPDATE SET
    reserva_id = EXCLUDED.reserva_id,
    score_display = EXCLUDED.score_display,
    score_tipo = EXCLUDED.score_tipo,
    valor_numerico = EXCLUDED.valor_numerico,
    rx = EXCLUDED.rx,
    sin_score = EXCLUDED.sin_score,
    notas = EXCLUDED.notas,
    updated_at = now()
  RETURNING id INTO v_id;

  ALTER TABLE clase_scores ENABLE TRIGGER USER;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE clase_scores ENABLE TRIGGER USER;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION admin_insert_reserva(UUID, UUID, reserva_estado) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_insert_reserva(UUID, UUID, reserva_estado) TO service_role;

REVOKE ALL ON FUNCTION admin_insert_clase_score(UUID, UUID, UUID, TEXT, clase_score_tipo, NUMERIC, BOOLEAN, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_insert_clase_score(UUID, UUID, UUID, TEXT, clase_score_tipo, NUMERIC, BOOLEAN, BOOLEAN, TEXT) TO service_role;

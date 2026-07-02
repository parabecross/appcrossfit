-- ─── Hotfix: reservas fallan con "Clase no encontrada: <uuid>" ───────────────
-- Causa: check_reserva_cupo() hace SELECT … FOR UPDATE sobre clases. Con RLS,
-- PostgreSQL aplica la policy FOR UPDATE (clases_update_coach_assigned), que solo
-- permite al coach asignado — el socio no obtiene fila → cupo_max NULL → error.
--
-- Solución: SECURITY DEFINER para leer cupo sin depender de policies del socio.
-- La validación de box sigue en reservas_insert_own (WITH CHECK) y en la API.
--
-- Aplicar manualmente en el SQL Editor de Supabase. NO ejecutar desde CI ni scripts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_reserva_cupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cupo_max INT;
  v_ocupado INT;
BEGIN
  IF NEW.estado NOT IN ('confirmada', 'asistio') THEN
    RETURN NEW;
  END IF;

  SELECT cupo_maximo INTO v_cupo_max
  FROM clases
  WHERE id = NEW.clase_id
  FOR UPDATE;

  IF v_cupo_max IS NULL THEN
    RAISE EXCEPTION 'Clase no encontrada: %', NEW.clase_id;
  END IF;

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

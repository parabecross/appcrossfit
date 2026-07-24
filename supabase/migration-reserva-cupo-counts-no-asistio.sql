-- ─── Unificar cupo: confirmada + asistio + no_asistio ocupan cupo ───────────
-- cancelada no ocupa cupo.
--
-- Aplicar manualmente en el SQL Editor de Supabase. NO ejecutar desde CI ni scripts.
-- ─────────────────────────────────────────────────────────────────────────────

-- NOTA:
-- reservas_con_cupo es vista legacy y no se toca en este patch para evitar cambios de estructura/orden de columnas.
-- La app usa clases_cupo_ocupado() para cupos actuales.

-- 1) Trigger check_reserva_cupo()
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
  IF NEW.estado NOT IN ('confirmada', 'asistio', 'no_asistio') THEN
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
    AND estado IN ('confirmada', 'asistio', 'no_asistio')
    AND id IS DISTINCT FROM NEW.id;

  IF v_ocupado >= v_cupo_max THEN
    RAISE EXCEPTION 'Clase llena: cupo máximo alcanzado';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Índice único: una reserva activa por usuario/clase (incluye no_asistio)
DROP INDEX IF EXISTS idx_reservas_activa;
CREATE UNIQUE INDEX idx_reservas_activa
  ON reservas(clase_id, usuario_id)
  WHERE estado IN ('confirmada', 'asistio', 'no_asistio');

-- 3) RPC clases_cupo_ocupado
CREATE OR REPLACE FUNCTION public.clases_cupo_ocupado(p_clase_ids uuid[])
RETURNS TABLE (clase_id uuid, ocupado integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.clase_id,
    COUNT(*)::INT AS ocupado
  FROM reservas r
  WHERE r.clase_id = ANY(p_clase_ids)
    AND r.estado IN ('confirmada', 'asistio', 'no_asistio')
    -- Corrige: SECURITY DEFINER sin validar caller/box permitía a cualquier
    -- authenticated pedir cupo de clase_ids de OTRO box (fuga de headcount).
    -- auth.uid() IS NULL cubre llamadas vía service_role (ej. reporte semanal),
    -- que no tienen JWT de usuario final y ya son de confianza total.
    AND (
      auth.uid() IS NULL
      OR EXISTS (
        SELECT 1
        FROM clases c
        JOIN profiles me ON me.box_id = c.box_id
        WHERE c.id = r.clase_id
          AND me.user_id = auth.uid()
      )
    )
  GROUP BY r.clase_id;
$$;

GRANT EXECUTE ON FUNCTION public.clases_cupo_ocupado(uuid[]) TO authenticated;

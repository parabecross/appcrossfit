-- Cupo real por clase visible para todos los atletas (RLS solo permite ver reservas propias).
-- Ejecutar en Supabase SQL Editor.

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

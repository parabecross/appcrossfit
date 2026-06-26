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
    AND r.estado IN ('confirmada', 'asistio')
  GROUP BY r.clase_id;
$$;

GRANT EXECUTE ON FUNCTION public.clases_cupo_ocupado(uuid[]) TO authenticated;

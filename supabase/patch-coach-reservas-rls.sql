-- Run in Supabase SQL Editor if coach attendance shows 0 enrolled
-- Fixes: coaches could not read/update reservas for their own classes (RLS)

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

CREATE POLICY "reservas_select_coach_of_class"
  ON reservas FOR SELECT
  USING (is_coach_of_clase(clase_id));

CREATE POLICY "reservas_update_coach_of_class"
  ON reservas FOR UPDATE
  USING (is_coach_of_clase(clase_id))
  WITH CHECK (is_coach_of_clase(clase_id));

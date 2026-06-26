-- Run in Supabase SQL Editor (PASO 1 de 3)
-- Arregla el error al guardar skills (historial RLS)

CREATE OR REPLACE FUNCTION log_atleta_skill_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO atleta_skill_historial (skill_id, usuario_id, estado_anterior, estado_nuevo, notas)
    VALUES (NEW.id, NEW.usuario_id, NULL, NEW.estado, NEW.notas);
    RETURN NEW;
  END IF;

  IF OLD.estado IS DISTINCT FROM NEW.estado OR OLD.notas IS DISTINCT FROM NEW.notas THEN
    NEW.updated_at := now();
    INSERT INTO atleta_skill_historial (skill_id, usuario_id, estado_anterior, estado_nuevo, notas)
    VALUES (NEW.id, NEW.usuario_id, OLD.estado, NEW.estado, NEW.notas);
  END IF;

  RETURN NEW;
END;
$$;

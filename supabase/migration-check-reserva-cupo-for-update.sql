-- ─── Fix race condition: check_reserva_cupo() ────────────────────────────────
-- Problema: bajo READ COMMITTED, dos INSERT concurrentes para el último cupo
-- leían el mismo COUNT(*) antes del COMMIT de la otra transacción → sobre-reserva.
--
-- Solución: bloquear la fila de `clases` con FOR UPDATE antes del COUNT.
-- Eso serializa inserciones/updates activos para la misma clase_id sin bloquear
-- clases distintas.
--
-- Aplicar manualmente en el SQL Editor de Supabase. NO ejecutar desde CI ni scripts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_reserva_cupo()
RETURNS TRIGGER
LANGUAGE plpgsql
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

-- El trigger trg_check_reserva_cupo ya existe; solo se reemplaza la función.
-- Si en algún entorno no existiera:
-- CREATE TRIGGER trg_check_reserva_cupo
--   BEFORE INSERT OR UPDATE ON reservas
--   FOR EACH ROW
--   EXECUTE FUNCTION check_reserva_cupo();

-- ─── Verificación manual (requiere Postgres real; no hay test de integración) ─
--
-- Preparación:
--   • Elegir una clase con cupo_maximo = 1 (anotar clase_id).
--   • Dos usuario_id distintos (socio A y socio B) del mismo box.
--
-- Prueba A — bloqueo por FOR UPDATE (dos sesiones psql):
--
--   Sesión 1:
--     BEGIN;
--     INSERT INTO reservas (clase_id, usuario_id, estado)
--     VALUES ('<clase_id>', '<usuario_a>', 'confirmada');
--     -- NO hacer COMMIT todavía
--
--   Sesión 2 (otra conexión, misma clase):
--     INSERT INTO reservas (clase_id, usuario_id, estado)
--     VALUES ('<clase_id>', '<usuario_b>', 'confirmada');
--     -- Debe QUEDAR BLOQUEADA hasta que la sesión 1 termine
--
--   Sesión 1: COMMIT;
--   Sesión 2: debe completar con ERROR "Clase llena: cupo máximo alcanzado"
--
-- Prueba B — clase inexistente:
--
--     INSERT INTO reservas (clase_id, usuario_id, estado)
--     VALUES ('00000000-0000-0000-0000-000000000000', '<usuario_a>', 'confirmada');
--     -- Debe fallar con ERROR "Clase no encontrada: ..."
--
-- Prueba C — clases distintas no se bloquean entre sí:
--   Repetir prueba A con dos clase_id diferentes (cupo 1 cada una);
--   ambos INSERT deben completar sin esperar al COMMIT de la otra sesión.

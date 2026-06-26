-- Run in Supabase SQL Editor: corrige zona horaria del cierre de reservas
-- (Sin esto, Supabase en UTC bloquea clases de la tarde como si ya hubieran pasado)

CREATE OR REPLACE FUNCTION check_reserva_timing()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  clase_rec RECORD;
  class_start TIMESTAMPTZ;
  class_end TIMESTAMPTZ;
  cutoff TIMESTAMPTZ;
  gym_tz TEXT := 'America/Mexico_City';
BEGIN
  SELECT fecha, hora_inicio, hora_fin, estado
  INTO clase_rec
  FROM clases
  WHERE id = NEW.clase_id;

  IF NOT FOUND OR clase_rec.estado != 'programada' THEN
    RAISE EXCEPTION 'Clase no disponible para reservar';
  END IF;

  class_start := (clase_rec.fecha + clase_rec.hora_inicio)::timestamp AT TIME ZONE gym_tz;
  class_end := (clase_rec.fecha + clase_rec.hora_fin)::timestamp AT TIME ZONE gym_tz;
  cutoff := class_start - INTERVAL '20 minutes';

  IF NOW() >= class_end THEN
    RAISE EXCEPTION 'La clase ya finalizó';
  END IF;

  IF NOW() >= cutoff THEN
    RAISE EXCEPTION 'Reservas cerradas: máximo 20 minutos antes del inicio';
  END IF;

  RETURN NEW;
END;
$$;

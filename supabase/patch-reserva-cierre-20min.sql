-- Run in Supabase SQL Editor: cierra reservas 20 min antes del inicio

CREATE OR REPLACE FUNCTION check_reserva_timing()
RETURNS TRIGGER AS $$
DECLARE
  clase_rec RECORD;
  class_start TIMESTAMP;
  class_end TIMESTAMP;
  cutoff TIMESTAMP;
BEGIN
  SELECT fecha, hora_inicio, hora_fin, estado
  INTO clase_rec
  FROM clases
  WHERE id = NEW.clase_id;

  IF NOT FOUND OR clase_rec.estado != 'programada' THEN
    RAISE EXCEPTION 'Clase no disponible para reservar';
  END IF;

  class_start := clase_rec.fecha::timestamp + clase_rec.hora_inicio;
  class_end := clase_rec.fecha::timestamp + clase_rec.hora_fin;
  cutoff := class_start - INTERVAL '20 minutes';

  IF NOW() >= class_end THEN
    RAISE EXCEPTION 'La clase ya finalizó';
  END IF;

  IF NOW() >= cutoff THEN
    RAISE EXCEPTION 'Reservas cerradas: máximo 20 minutos antes del inicio';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reserva_timing ON reservas;
CREATE TRIGGER trg_reserva_timing
  BEFORE INSERT ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION check_reserva_timing();

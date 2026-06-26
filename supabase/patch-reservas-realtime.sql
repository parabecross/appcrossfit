-- Habilita Supabase Realtime en reservas (cupos y asistencia en vivo).
-- Ejecutar una vez en Supabase SQL Editor.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reservas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reservas;
  END IF;
END $$;

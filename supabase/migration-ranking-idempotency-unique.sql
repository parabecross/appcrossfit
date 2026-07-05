-- Garantiza idempotencia a nivel DB para ranking_point_events.
-- Seguro para re-ejecutar: no falla si la restricción ya existe.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ranking_point_events_idempotency_key_key'
  ) THEN
    ALTER TABLE public.ranking_point_events
      ADD CONSTRAINT ranking_point_events_idempotency_key_key
      UNIQUE (idempotency_key);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_point_events_idempotency_key
  ON public.ranking_point_events (idempotency_key);

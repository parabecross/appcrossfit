-- Bonus RX en ranking Athron (+5 pts extra al marcar score en RX)
ALTER TABLE ranking_config
  ADD COLUMN IF NOT EXISTS rx_bonus_points INTEGER NOT NULL DEFAULT 5
  CHECK (rx_bonus_points >= 0);

UPDATE ranking_config SET rx_bonus_points = 5 WHERE rx_bonus_points IS NULL;

-- Tabla de puntos por puesto WOD: 30, 28, 26 … 12 (top 10), luego −2 hasta piso 5
UPDATE ranking_config
SET
  position_points_table = '[30,28,26,24,22,20,18,16,14,12]'::jsonb,
  position_points_linear_drop = 2
WHERE position_points_table IS NULL
   OR position_points_table = '[30,28,26,24,22,20,19,18,17,16]'::jsonb;

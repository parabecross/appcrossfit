-- Bonus RX en ranking Athron (+5 pts extra al marcar score en RX)
ALTER TABLE ranking_config
  ADD COLUMN IF NOT EXISTS rx_bonus_points INTEGER NOT NULL DEFAULT 5
  CHECK (rx_bonus_points >= 0);

UPDATE ranking_config SET rx_bonus_points = 5 WHERE rx_bonus_points IS NULL;

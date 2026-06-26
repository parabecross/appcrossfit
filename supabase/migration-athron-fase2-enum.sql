-- ─── ATHRON Fase 2 — PASO 1 (ejecutar solo esto primero) ───────────────────
-- Postgres no permite usar el valor nuevo en la misma transacción del ALTER TYPE.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'box_admin';

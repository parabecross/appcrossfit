-- Diagnóstico: eventos PR/RM huérfanos en ranking_point_events
-- Compatible con Supabase SQL Editor (NO uses :usuario_id — es sintaxis psql/ORM).
--
-- OPCIÓN A (recomendada): abre diagnostic-orphan-pr-ranking-events-quick.sql
--   → copia TODO el bloque → Run (una sola query, sin errores).
--
-- OPCIÓN B: ejecuta TODO este archivo de arriba a abajo (no selecciones solo el final).
--   1. Edita los dos UUID en la línea 17-18.
--   2. Run completo.

DROP TABLE IF EXISTS _diag_params;
CREATE TEMP TABLE _diag_params AS
SELECT
  '03d9c6c4-bdb2-4a58-bc42-c06a8e873e33'::uuid AS usuario_id,  -- ← profiles.id
  '7ce3d559-871c-43d1-badd-8fbdbd776ad6'::uuid AS box_id;      -- ← boxes.id

-- ─── 1) Marcas PR actuales del atleta ───────────────────────────────────────
SELECT
  '1_marcas_actuales' AS seccion,
  apm.id,
  apm.ejercicio,
  apm.record_tipo,
  apm.rm_reps,
  apm.valor,
  apm.fecha,
  apm.created_at
FROM atleta_pr_marcas apm
JOIN _diag_params p ON apm.usuario_id = p.usuario_id
ORDER BY apm.fecha, apm.created_at;

-- ─── 2) Eventos achievement PR/RM del atleta en el box ──────────────────────
SELECT
  '2_eventos_pr_rm' AS seccion,
  rpe.id,
  rpe.idempotency_key,
  rpe.points,
  rpe.fecha,
  rpe.metadata->>'badge_key' AS badge_key,
  rpe.metadata->>'marca_id' AS marca_id,
  rpe.metadata->>'record_key' AS record_key
FROM ranking_point_events rpe
JOIN _diag_params p ON rpe.usuario_id = p.usuario_id AND rpe.box_id = p.box_id
WHERE rpe.event_type = 'achievement'
  AND (
    rpe.metadata->>'badge_key' IN (
      'primer_pr',
      'primer_movimiento',
      'pr_mejora',
      'racha_mejoras_mes',
      'pr_hunter',
      'best_month',
      'comeback',
      'benchmark'
    )
    OR rpe.idempotency_key LIKE 'achievement:mejora:' || p.usuario_id::text || ':%'
    OR rpe.idempotency_key LIKE 'achievement:marca:%'
    OR rpe.idempotency_key LIKE 'achievement:' || p.usuario_id::text || ':primer_mov:%'
    OR rpe.idempotency_key LIKE 'achievement:' || p.usuario_id::text || ':racha_mejoras_mes:%'
    OR rpe.idempotency_key LIKE 'achievement:' || p.usuario_id::text || ':best_month:%'
    OR rpe.idempotency_key = 'achievement:' || p.usuario_id::text || ':benchmark'
    OR rpe.idempotency_key = 'achievement:' || p.usuario_id::text || ':primer_pr'
    OR rpe.idempotency_key = 'achievement:' || p.usuario_id::text || ':pr_hunter'
  )
ORDER BY rpe.fecha DESC, rpe.created_at DESC;

-- ─── 3) Huérfanos por metadata.marca_id (marca ya no existe) ────────────────
SELECT
  '3_huérfanos_por_marca_id' AS seccion,
  rpe.id,
  rpe.idempotency_key,
  rpe.points,
  rpe.metadata->>'badge_key' AS badge_key,
  rpe.metadata->>'marca_id' AS orphan_marca_id
FROM ranking_point_events rpe
JOIN _diag_params p ON rpe.usuario_id = p.usuario_id AND rpe.box_id = p.box_id
WHERE rpe.event_type = 'achievement'
  AND rpe.metadata->>'marca_id' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM atleta_pr_marcas apm
    WHERE apm.id = (rpe.metadata->>'marca_id')::uuid
  );

-- ─── 4) Resumen ───────────────────────────────────────────────────────────────
SELECT
  '4_resumen' AS seccion,
  (SELECT COUNT(*) FROM atleta_pr_marcas apm JOIN _diag_params p ON apm.usuario_id = p.usuario_id) AS marcas_actuales,
  COUNT(rpe.id) AS eventos_pr_rm,
  COALESCE(SUM(rpe.points), 0) AS puntos_pr_rm
FROM ranking_point_events rpe
JOIN _diag_params p ON rpe.usuario_id = p.usuario_id AND rpe.box_id = p.box_id
WHERE rpe.event_type = 'achievement'
  AND (
    rpe.metadata->>'badge_key' IN (
      'primer_pr', 'primer_movimiento', 'pr_mejora',
      'racha_mejoras_mes', 'pr_hunter', 'best_month', 'comeback', 'benchmark'
    )
    OR rpe.idempotency_key LIKE 'achievement:mejora:' || p.usuario_id::text || ':%'
    OR rpe.idempotency_key LIKE 'achievement:marca:%'
  );

-- ─── Reparación (NO ejecutar en SQL; usar API o script) ─────────────────────
-- POST /api/ranking/repair-pr-achievements
-- Body: { "usuarioId": "<profiles.id>" }
--
-- O CLI:
-- npx tsx scripts/repair-pr-ranking-events.ts <profiles.id>

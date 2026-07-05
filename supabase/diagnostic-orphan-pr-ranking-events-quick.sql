-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNÓSTICO RÁPIDO — copia TODO este bloque en Supabase SQL Editor y Run
-- (NO uses :usuario_id — da syntax error 42601)
-- Edita SOLO las 2 UUID de la línea 8-9:
-- ═══════════════════════════════════════════════════════════════════════════

WITH params AS (
  SELECT
    '03d9c6c4-bdb2-4a58-bc42-c06a8e873e33'::uuid AS usuario_id,
    '7ce3d559-871c-43d1-badd-8fbdbd776ad6'::uuid AS box_id
)
SELECT
  p.usuario_id,
  p.box_id,
  (SELECT COUNT(*) FROM atleta_pr_marcas apm WHERE apm.usuario_id = p.usuario_id) AS marcas_actuales,
  COUNT(rpe.id) AS eventos_pr_rm,
  COALESCE(SUM(rpe.points), 0) AS puntos_pr_rm
FROM params p
LEFT JOIN ranking_point_events rpe
  ON rpe.usuario_id = p.usuario_id
 AND rpe.box_id = p.box_id
 AND rpe.event_type = 'achievement'
 AND (
   rpe.metadata->>'badge_key' IN (
     'primer_pr', 'primer_movimiento', 'pr_mejora',
     'racha_mejoras_mes', 'pr_hunter', 'best_month', 'comeback', 'benchmark'
   )
   OR rpe.idempotency_key LIKE 'achievement:mejora:' || p.usuario_id::text || ':%'
   OR rpe.idempotency_key LIKE 'achievement:marca:%'
   OR rpe.idempotency_key LIKE 'achievement:' || p.usuario_id::text || ':primer_mov:%'
   OR rpe.idempotency_key LIKE 'achievement:' || p.usuario_id::text || ':best_month:%'
   OR rpe.idempotency_key = 'achievement:' || p.usuario_id::text || ':primer_pr'
   OR rpe.idempotency_key = 'achievement:' || p.usuario_id::text || ':pr_hunter'
   OR rpe.idempotency_key = 'achievement:' || p.usuario_id::text || ':benchmark'
 )
GROUP BY p.usuario_id, p.box_id;

-- Resultado esperado para Nevyl (ya reparado): marcas_actuales=0, eventos_pr_rm=0, puntos_pr_rm=0

-- Limpieza de feature flags: solo módulos reales del proyecto.
-- Ejecutar en bases que ya aplicaron migration-athron-plans-v1.sql

-- Eliminar overrides de claves que ya no existen en el catálogo
DELETE FROM box_feature_overrides
WHERE feature_key IN (
  'gestion_atletas',
  'gestion_coaches',
  'pwa',
  'exportaciones',
  'branding_personalizado',
  'integraciones',
  'ia',
  'soporte_prioritario',
  'soporte_premium'
);

-- ATHRON Start: solo módulos base
UPDATE plans
SET features = '{
  "dashboard_basico": true,
  "clases": true,
  "reservas": true,
  "membresias": true,
  "asistencia": true,
  "ranking": false,
  "ranking_publico": false,
  "ranking_config": false,
  "progreso_atleta": false,
  "estadisticas_avanzadas": false,
  "dashboard_ejecutivo": false,
  "frecuencia_usuario": false,
  "demanda_horario": false,
  "ocupacion_promedio": false,
  "tendencia_asistencia": false,
  "historial_completo": false,
  "alertas_avanzadas": false,
  "resumen_semanal": false
}'::jsonb,
updated_at = now()
WHERE code = 'start';

-- ATHRON Pro: todas las funciones reales
UPDATE plans
SET features = '{
  "dashboard_basico": true,
  "clases": true,
  "reservas": true,
  "membresias": true,
  "asistencia": true,
  "ranking": true,
  "ranking_publico": true,
  "ranking_config": true,
  "progreso_atleta": true,
  "estadisticas_avanzadas": true,
  "dashboard_ejecutivo": true,
  "frecuencia_usuario": true,
  "demanda_horario": true,
  "ocupacion_promedio": true,
  "tendencia_asistencia": true,
  "historial_completo": true,
  "alertas_avanzadas": true,
  "resumen_semanal": true
}'::jsonb,
updated_at = now()
WHERE code = 'pro';

-- ATHRON Elite: mismas funciones reales (diferencia = límites de recursos)
UPDATE plans
SET features = '{
  "dashboard_basico": true,
  "clases": true,
  "reservas": true,
  "membresias": true,
  "asistencia": true,
  "ranking": true,
  "ranking_publico": true,
  "ranking_config": true,
  "progreso_atleta": true,
  "estadisticas_avanzadas": true,
  "dashboard_ejecutivo": true,
  "frecuencia_usuario": true,
  "demanda_horario": true,
  "ocupacion_promedio": true,
  "tendencia_asistencia": true,
  "historial_completo": true,
  "alertas_avanzadas": true,
  "resumen_semanal": true
}'::jsonb,
updated_at = now()
WHERE code = 'elite';

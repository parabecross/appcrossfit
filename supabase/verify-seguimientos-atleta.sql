-- Verificación post-migración: seguimientos_atleta
-- Ejecutar en Supabase SQL Editor DESPUÉS de migration-seguimientos-atleta.sql

SELECT to_regclass('public.seguimientos_atleta') AS table_exists;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'seguimientos_atleta'
ORDER BY ordinal_position;

SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.seguimientos_atleta'::regclass
ORDER BY polname;

SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'seguimientos_atleta'
ORDER BY indexname;

SELECT relrowsecurity
FROM pg_class
WHERE oid = 'public.seguimientos_atleta'::regclass;

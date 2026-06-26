-- Run in Supabase SQL Editor (PASO 3 de 3)
-- Ejecutar DESPUÉS del paso 2 (enum lbs ya confirmado)

UPDATE atleta_pr_marcas SET unidad = 'lbs' WHERE unidad::text = 'kg';

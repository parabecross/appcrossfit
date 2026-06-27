-- Lectura pública del ranking (link compartible en WhatsApp)
-- Ejecutar después de patch-clase-scores.sql

DROP POLICY IF EXISTS "clase_scores_public_ranking" ON clase_scores;
CREATE POLICY "clase_scores_public_ranking"
  ON clase_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM clases c
      JOIN profiles coach ON coach.id = c.coach_id
      JOIN boxes b ON b.id = coach.box_id
      WHERE c.id = clase_scores.clase_id
        AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "atleta_perfil_ranking_read" ON atleta_perfil_deportivo;
CREATE POLICY "atleta_perfil_ranking_read"
  ON atleta_perfil_deportivo FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN boxes b ON b.id = p.box_id
      WHERE p.id = atleta_perfil_deportivo.usuario_id
        AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "profiles_public_ranking" ON profiles;
CREATE POLICY "profiles_public_ranking"
  ON profiles FOR SELECT
  USING (
    rol = 'socio'
    AND EXISTS (
      SELECT 1 FROM boxes b
      WHERE b.id = profiles.box_id AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "clases_public_ranking" ON clases;
CREATE POLICY "clases_public_ranking"
  ON clases FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM profiles coach
      JOIN boxes b ON b.id = coach.box_id
      WHERE coach.id = clases.coach_id
        AND b.status = 'active'
    )
  );

DROP POLICY IF EXISTS "boxes_public_ranking" ON boxes;
CREATE POLICY "boxes_public_ranking"
  ON boxes FOR SELECT
  USING (status = 'active');

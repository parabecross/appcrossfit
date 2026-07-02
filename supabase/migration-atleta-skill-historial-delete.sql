-- Permite al atleta borrar entradas de su propio historial de skills (limpieza UI).
CREATE POLICY "atleta_skill_hist_delete_own"
  ON atleta_skill_historial FOR DELETE
  USING (usuario_id = get_my_profile_id());

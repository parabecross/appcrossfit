-- Bitácora ligera de seguimiento administrativo por atleta (multi-tenant).
-- NO ejecutar en producción desde el agente; aplicar manualmente en Supabase SQL Editor
-- después del schema base y helpers RLS (get_my_box_id, is_admin, is_super_admin, set_updated_at).
--
-- Registros inmutables en esta fase: SELECT + INSERT únicamente.
-- Socios y coaches NO tienen acceso.

CREATE TABLE IF NOT EXISTS seguimientos_atleta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id UUID NOT NULL REFERENCES boxes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  tipo_interaccion TEXT NOT NULL,
  resultado TEXT NOT NULL,
  nota TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  follow_up_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seguimientos_atleta_tipo_check CHECK (
    tipo_interaccion IN (
      'whatsapp',
      'phone_call',
      'in_person',
      'internal_note',
      'email',
      'other'
    )
  ),
  CONSTRAINT seguimientos_atleta_resultado_check CHECK (
    resultado IN (
      'contacted',
      'no_response',
      'responded',
      'renewal_pending',
      'renewed',
      'not_interested',
      'follow_up_required',
      'resolved',
      'note_only'
    )
  ),
  CONSTRAINT seguimientos_atleta_nota_len_check CHECK (
    nota IS NULL OR char_length(nota) <= 2000
  )
);

COMMENT ON TABLE seguimientos_atleta IS
  'Bitácora interna de contactos y seguimientos administrativos por atleta. Solo visible para admin/box_admin del mismo box.';
COMMENT ON COLUMN seguimientos_atleta.usuario_id IS 'Atleta (profiles.id).';
COMMENT ON COLUMN seguimientos_atleta.autor_id IS 'Admin que registró la interacción (profiles.id). Inmutable.';
COMMENT ON COLUMN seguimientos_atleta.tipo_interaccion IS 'Canal o tipo de contacto.';
COMMENT ON COLUMN seguimientos_atleta.resultado IS 'Resultado operativo; no confundir con el canal.';
COMMENT ON COLUMN seguimientos_atleta.follow_up_at IS 'Próximo seguimiento opcional (NULL = sin seguimiento pendiente).';

CREATE INDEX IF NOT EXISTS idx_seguimientos_atleta_box_usuario_occurred
  ON seguimientos_atleta (box_id, usuario_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_seguimientos_atleta_box_follow_up
  ON seguimientos_atleta (box_id, follow_up_at)
  WHERE follow_up_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_seguimientos_atleta_autor
  ON seguimientos_atleta (autor_id);

-- updated_at (reutiliza helper si existe; si no, créalo)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS seguimientos_atleta_updated_at ON seguimientos_atleta;
CREATE TRIGGER seguimientos_atleta_updated_at
  BEFORE UPDATE ON seguimientos_atleta
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE seguimientos_atleta ENABLE ROW LEVEL SECURITY;

-- Lectura: admin/box_admin del mismo box (o super admin)
DROP POLICY IF EXISTS "seguimientos_atleta_select_admin" ON seguimientos_atleta;
CREATE POLICY "seguimientos_atleta_select_admin"
  ON seguimientos_atleta FOR SELECT
  USING (
    is_super_admin()
    OR (is_admin() AND box_id = get_my_box_id())
  );

-- Inserción: admin del box; box_id debe coincidir con sesión;
-- atleta debe pertenecer al mismo box; autor_id = perfil actual.
DROP POLICY IF EXISTS "seguimientos_atleta_insert_admin" ON seguimientos_atleta;
CREATE POLICY "seguimientos_atleta_insert_admin"
  ON seguimientos_atleta FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (
      is_admin()
      AND box_id = get_my_box_id()
      AND autor_id = get_my_profile_id()
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = seguimientos_atleta.usuario_id
          AND p.box_id = get_my_box_id()
          AND p.rol = 'socio'
      )
    )
  );

-- Sin UPDATE/DELETE en esta fase (auditoría inmutable).
-- Si se requieren en el futuro: políticas separadas, sin permitir cambiar box_id/usuario_id/autor_id.

GRANT SELECT, INSERT ON seguimientos_atleta TO authenticated;
REVOKE ALL ON seguimientos_atleta FROM anon;
REVOKE UPDATE, DELETE ON seguimientos_atleta FROM authenticated;

-- Verificación
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'seguimientos_atleta'
ORDER BY policyname;

SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'seguimientos_atleta'
ORDER BY indexname;

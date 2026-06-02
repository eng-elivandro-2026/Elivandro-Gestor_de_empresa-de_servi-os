-- ============================================================
-- 032_quadro_avisos.sql
-- Quadro de Avisos (post-its internos) — comunicacao rapida Comercial/Operacional.
-- ATENCAO: migration versionada, aplicar somente com autorizacao.
-- ============================================================

CREATE TABLE IF NOT EXISTS quadro_avisos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id),

  assunto text NOT NULL,
  descricao text,
  responsavel_email text,
  prioridade text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'aberto',
  data_final date,

  cliente_ref text,
  proposta_ref text,
  obra_ref text,

  criado_por uuid DEFAULT auth_usuario_id(),
  criado_por_email text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  resolvido_em timestamptz,
  arquivado_em timestamptz,

  CONSTRAINT quadro_avisos_prioridade_check CHECK (prioridade IN ('normal','alta','urgente')),
  CONSTRAINT quadro_avisos_status_check CHECK (status IN ('aberto','em_andamento','resolvido','arquivado'))
);

CREATE INDEX IF NOT EXISTS idx_quadro_avisos_empresa     ON quadro_avisos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_quadro_avisos_status      ON quadro_avisos (status);
CREATE INDEX IF NOT EXISTS idx_quadro_avisos_atualizado  ON quadro_avisos (atualizado_em DESC);

-- trigger updated_at
CREATE OR REPLACE FUNCTION quadro_avisos_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quadro_avisos_updated_at ON quadro_avisos;
CREATE TRIGGER trg_quadro_avisos_updated_at
BEFORE UPDATE ON quadro_avisos
FOR EACH ROW
EXECUTE FUNCTION quadro_avisos_set_updated_at();

ALTER TABLE quadro_avisos ENABLE ROW LEVEL SECURITY;

-- SELECT: membro da empresa E (dono OU adriano@tecfusion.com.br).
DROP POLICY IF EXISTS "quadro_avisos: ver" ON quadro_avisos;
CREATE POLICY "quadro_avisos: ver"
  ON quadro_avisos FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND ( auth_perfil() = 'dono'
          OR lower(coalesce(auth.jwt() ->> 'email','')) = 'adriano@tecfusion.com.br' )
  );

-- INSERT: dono OU adriano@tecfusion.com.br (defesa-em-profundidade alem do gate de UI).
DROP POLICY IF EXISTS "quadro_avisos: inserir" ON quadro_avisos;
CREATE POLICY "quadro_avisos: inserir"
  ON quadro_avisos FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND ( auth_perfil() = 'dono'
          OR lower(coalesce(auth.jwt() ->> 'email','')) = 'adriano@tecfusion.com.br' )
  );

-- UPDATE: dono OU adriano@tecfusion.com.br.
DROP POLICY IF EXISTS "quadro_avisos: atualizar" ON quadro_avisos;
CREATE POLICY "quadro_avisos: atualizar"
  ON quadro_avisos FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND ( auth_perfil() = 'dono'
          OR lower(coalesce(auth.jwt() ->> 'email','')) = 'adriano@tecfusion.com.br' )
  )
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- DELETE: somente dono.
DROP POLICY IF EXISTS "quadro_avisos: excluir dono" ON quadro_avisos;
CREATE POLICY "quadro_avisos: excluir dono"
  ON quadro_avisos FOR DELETE
  USING (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() = 'dono');

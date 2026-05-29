-- ============================================================
-- 030_gestao_negocio.sql
-- Documento simples de Gestao do Negocio no Operacional.
-- ATENCAO: migration versionada, aplicar somente com autorizacao.
-- ============================================================

CREATE TABLE IF NOT EXISTS gestao_negocio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id),
  proposta_id text NOT NULL,

  diario_texto text,
  entregas_texto text,
  aceite_texto text,

  responsavel_cliente_nome text,
  responsavel_empresa_nome text,
  assinatura_cliente text,
  assinatura_empresa text,

  status_documento text NOT NULL DEFAULT 'rascunho',
  bloqueado boolean NOT NULL DEFAULT false,

  criado_por uuid DEFAULT auth_usuario_id(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid DEFAULT auth_usuario_id(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  assinado_em timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT gestao_negocio_empresa_proposta_unique UNIQUE (empresa_id, proposta_id),
  CONSTRAINT gestao_negocio_status_check CHECK (status_documento IN ('rascunho', 'assinado')),
  CONSTRAINT gestao_negocio_assinado_bloqueado_check CHECK (
    status_documento <> 'assinado'
    OR (bloqueado = true AND assinado_em IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_gestao_negocio_empresa_id ON gestao_negocio (empresa_id);
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_proposta_id ON gestao_negocio (proposta_id);
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_status ON gestao_negocio (status_documento);
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_atualizado_em ON gestao_negocio (atualizado_em DESC);

CREATE OR REPLACE FUNCTION gestao_negocio_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = now();
  NEW.atualizado_por = auth_usuario_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gestao_negocio_updated_at ON gestao_negocio;
CREATE TRIGGER trg_gestao_negocio_updated_at
BEFORE UPDATE ON gestao_negocio
FOR EACH ROW
EXECUTE FUNCTION gestao_negocio_set_updated_at();

ALTER TABLE gestao_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gestao_negocio: ver da empresa" ON gestao_negocio;
CREATE POLICY "gestao_negocio: ver da empresa"
  ON gestao_negocio FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "gestao_negocio: inserir gestor" ON gestao_negocio;
CREATE POLICY "gestao_negocio: inserir gestor"
  ON gestao_negocio FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "gestao_negocio: atualizar rascunho" ON gestao_negocio;
CREATE POLICY "gestao_negocio: atualizar rascunho"
  ON gestao_negocio FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
    AND bloqueado = false
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

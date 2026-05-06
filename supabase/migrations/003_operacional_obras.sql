-- ============================================================
-- 003_operacional_obras.sql
-- Fase 1A do modulo Operacional: tabela principal de obras.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  proposta_app_id text NOT NULL,
  codigo_obra text,
  proposta_numero text,
  proposta_revisao text,
  cliente_nome text,
  cliente_cnpj text,
  cliente_cidade text,
  cliente_local text,
  titulo text,
  tipo_obra text,
  prioridade text,
  valor_vendido numeric(14,2) DEFAULT 0,
  valor_servico_previsto numeric(14,2) DEFAULT 0,
  valor_material_previsto numeric(14,2) DEFAULT 0,
  custo_servico_previsto numeric(14,2) DEFAULT 0,
  custo_material_previsto numeric(14,2) DEFAULT 0,
  custo_terceiros_previsto numeric(14,2) DEFAULT 0,
  custo_outros_previsto numeric(14,2) DEFAULT 0,
  custo_total_previsto numeric(14,2) DEFAULT 0,
  margem_prevista_percentual numeric(5,2) DEFAULT 0,
  margem_prevista_valor numeric(14,2) DEFAULT 0,
  status_operacional text NOT NULL DEFAULT 'aguardando_recebimento',
  responsavel_comercial_id uuid,
  responsavel_operacional_id uuid,
  responsavel_operacional_nome text,
  centro_custo text,
  data_aprovacao date,
  data_inicio_prevista date,
  data_termino_prevista date,
  data_inicio_real date,
  data_termino_real date,
  data_entrega_prevista date,
  data_entrega_real date,
  data_inicio_garantia date,
  data_fim_garantia date,
  status_entrega text,
  termo_entrega_assinado boolean DEFAULT false,
  pode_faturar boolean DEFAULT false,
  percentual_avanco numeric(5,2) DEFAULT 0,
  snapshot_proposta_json jsonb NOT NULL,
  observacoes text,
  created_by uuid DEFAULT auth_usuario_id(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT obras_empresa_proposta_unique UNIQUE (empresa_id, proposta_app_id),
  CONSTRAINT obras_empresa_codigo_unique UNIQUE (empresa_id, codigo_obra)
);

CREATE INDEX IF NOT EXISTS idx_obras_empresa_id ON obras (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obras_proposta_app_id ON obras (proposta_app_id);
CREATE INDEX IF NOT EXISTS idx_obras_status_operacional ON obras (status_operacional);
CREATE INDEX IF NOT EXISTS idx_obras_cliente_nome ON obras (cliente_nome);
CREATE INDEX IF NOT EXISTS idx_obras_created_at ON obras (created_at DESC);

CREATE OR REPLACE FUNCTION obras_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obras_updated_at ON obras;
CREATE TRIGGER trg_obras_updated_at
BEFORE UPDATE ON obras
FOR EACH ROW
EXECUTE FUNCTION obras_set_updated_at();

ALTER TABLE obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obras: ver da empresa" ON obras;
CREATE POLICY "obras: ver da empresa"
  ON obras FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "obras: inserir na empresa" ON obras;
CREATE POLICY "obras: inserir na empresa"
  ON obras FOR INSERT
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "obras: atualizar na empresa" ON obras;
CREATE POLICY "obras: atualizar na empresa"
  ON obras FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "obras: deletar gestor+" ON obras;
CREATE POLICY "obras: deletar gestor+"
  ON obras FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );

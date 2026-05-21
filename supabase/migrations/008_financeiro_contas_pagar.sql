-- ============================================================
-- 008_financeiro_contas_pagar.sql
-- Fase F3B do módulo Financeiro: Contas a Pagar.
--
-- Premissas:
--   • Funções auth_empresa_ids(), auth_usuario_id(), auth_perfil()
--     já existem (criadas em 001_rls_policies.sql).
--   • Função financeiro_set_updated_at() já existe (007).
--   • empresas(id) já existe como tabela referenciada.
--   • Nenhuma migration anterior é alterada.
--   • NÃO aplicar automaticamente — rodar manualmente no
--     SQL Editor do Supabase após revisão e backup.
-- ============================================================


-- ============================================================
-- TABELA: financeiro_contas_pagar
-- Registro de obrigações financeiras da empresa (contas a pagar).
-- Fonte oficial de saídas previstas e realizadas.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_contas_pagar (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Fornecedor / Credor
  fornecedor_nome   text,
  fornecedor_cnpj   text,

  -- Descrição e classificação
  descricao         text,
  categoria         text,          -- ex: 'material', 'servico', 'pessoal', 'imposto', 'aluguel', 'outros'
  centro_custo      text,

  -- Valores financeiros
  valor_previsto    numeric(14,2) NOT NULL DEFAULT 0,
  valor_pago        numeric(14,2) NOT NULL DEFAULT 0,
  valor_pendente    numeric(14,2) NOT NULL DEFAULT 0,  -- mantido pelo app: valor_previsto - valor_pago

  -- Datas
  data_vencimento   date,
  data_pagamento    date,          -- preenchida quando pago

  -- Controle
  -- Valores: previsto | em_aberto | vencido | pago | parcial | cancelado
  status            text NOT NULL DEFAULT 'em_aberto',

  -- Forma de pagamento
  forma_pagamento   text,          -- 'transferencia' | 'boleto' | 'cheque' | 'dinheiro' | 'pix' | 'cartao'

  -- Observações e rastreabilidade
  observacao        text,
  origem            text,          -- 'manual' | 'importado' | etc.
  referencia_id     text,          -- ID externo opcional (ex: nota fiscal do fornecedor)

  -- Auditoria
  created_by        uuid DEFAULT auth_usuario_id(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fcp_empresa_id
  ON financeiro_contas_pagar (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fcp_status
  ON financeiro_contas_pagar (status);

CREATE INDEX IF NOT EXISTS idx_fcp_data_vencimento
  ON financeiro_contas_pagar (data_vencimento);

CREATE INDEX IF NOT EXISTS idx_fcp_centro_custo
  ON financeiro_contas_pagar (centro_custo);

CREATE INDEX IF NOT EXISTS idx_fcp_categoria
  ON financeiro_contas_pagar (categoria);

CREATE INDEX IF NOT EXISTS idx_fcp_fornecedor_nome
  ON financeiro_contas_pagar (fornecedor_nome);

CREATE INDEX IF NOT EXISTS idx_fcp_empresa_vencimento
  ON financeiro_contas_pagar (empresa_id, data_vencimento);

-- ── Trigger updated_at ───────────────────────────────────────
DROP TRIGGER IF EXISTS trg_fcp_updated_at ON financeiro_contas_pagar;
CREATE TRIGGER trg_fcp_updated_at
  BEFORE UPDATE ON financeiro_contas_pagar
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE financeiro_contas_pagar ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os usuários da empresa podem visualizar
DROP POLICY IF EXISTS "fcp: ver da empresa" ON financeiro_contas_pagar;
CREATE POLICY "fcp: ver da empresa"
  ON financeiro_contas_pagar FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

-- INSERT: bloqueado para colaborador/prestador
DROP POLICY IF EXISTS "fcp: inserir na empresa" ON financeiro_contas_pagar;
CREATE POLICY "fcp: inserir na empresa"
  ON financeiro_contas_pagar FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- UPDATE: bloqueado para colaborador/prestador
DROP POLICY IF EXISTS "fcp: atualizar na empresa" ON financeiro_contas_pagar;
CREATE POLICY "fcp: atualizar na empresa"
  ON financeiro_contas_pagar FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- DELETE: somente dono/gestor/admin
DROP POLICY IF EXISTS "fcp: deletar gestor+" ON financeiro_contas_pagar;
CREATE POLICY "fcp: deletar gestor+"
  ON financeiro_contas_pagar FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- FIM: 008_financeiro_contas_pagar.sql
-- Aplicar manualmente no SQL Editor do Supabase.
-- Verificar saída de cada bloco antes de prosseguir.
-- Após aplicar, o portal estará pronto para usar a aba
-- Contas a Pagar e o Caixa Comprometido real no Fluxo de Caixa.
-- ============================================================

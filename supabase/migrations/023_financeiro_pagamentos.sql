-- 023_financeiro_pagamentos.sql
-- F3.5-A - Base de pagamentos de Contas a Pagar.
--
-- Objetivo:
--   Criar uma tabela auxiliar para registrar pagamentos/baixas de
--   financeiro_contas_pagar com historico, meio/fonte financeira,
--   rastreabilidade e vinculo futuro com movimento de caixa.
--
-- Escopo desta migration:
--   - cria somente financeiro_pagamentos;
--   - nao altera financeiro_contas_pagar;
--   - nao altera financeiro_movimentos_caixa;
--   - nao cria movimentos de caixa;
--   - nao altera calculos, status, DRE, Fluxo de Caixa, XML ou Banco de Precos.


-- ============================================================
-- TABELA: financeiro_pagamentos
-- Historico de pagamentos/baixas de Contas a Pagar.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_pagamentos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  conta_pagar_id        uuid NOT NULL REFERENCES financeiro_contas_pagar(id) ON DELETE RESTRICT,
  meio_pagamento_id     uuid REFERENCES financeiro_meios_pagamento(id) ON DELETE SET NULL,
  fonte_financeira_id   uuid REFERENCES financeiro_fontes_financeiras(id) ON DELETE SET NULL,
  movimento_caixa_id    uuid REFERENCES financeiro_movimentos_caixa(id) ON DELETE SET NULL,

  data_pagamento        date NOT NULL,
  valor_pago            numeric(14,2) NOT NULL,

  observacao            text,
  comprovante_url       text,

  status                text NOT NULL DEFAULT 'registrado',
  origem                text NOT NULL DEFAULT 'manual',
  referencia_id         text,

  created_by            uuid DEFAULT auth_usuario_id(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fpag_valor_pago_positivo_check CHECK (valor_pago > 0),
  CONSTRAINT fpag_status_check CHECK (
    status IN ('registrado', 'cancelado', 'estornado')
  ),
  CONSTRAINT fpag_origem_check CHECK (
    origem IN ('manual', 'xml_fornecedor', 'ajuste', 'outro')
  )
);


-- ============================================================
-- INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fpag_empresa_id
  ON financeiro_pagamentos (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fpag_conta_pagar_id
  ON financeiro_pagamentos (conta_pagar_id);

CREATE INDEX IF NOT EXISTS idx_fpag_meio_pagamento_id
  ON financeiro_pagamentos (meio_pagamento_id);

CREATE INDEX IF NOT EXISTS idx_fpag_fonte_financeira_id
  ON financeiro_pagamentos (fonte_financeira_id);

CREATE INDEX IF NOT EXISTS idx_fpag_movimento_caixa_id
  ON financeiro_pagamentos (movimento_caixa_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fpag_movimento_caixa_unique
  ON financeiro_pagamentos (movimento_caixa_id)
  WHERE movimento_caixa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fpag_status
  ON financeiro_pagamentos (status);

CREATE INDEX IF NOT EXISTS idx_fpag_origem
  ON financeiro_pagamentos (origem);

CREATE INDEX IF NOT EXISTS idx_fpag_data_pagamento
  ON financeiro_pagamentos (data_pagamento);

CREATE INDEX IF NOT EXISTS idx_fpag_referencia_id
  ON financeiro_pagamentos (referencia_id);

CREATE INDEX IF NOT EXISTS idx_fpag_created_at
  ON financeiro_pagamentos (created_at);

CREATE INDEX IF NOT EXISTS idx_fpag_empresa_conta
  ON financeiro_pagamentos (empresa_id, conta_pagar_id);

CREATE INDEX IF NOT EXISTS idx_fpag_empresa_status
  ON financeiro_pagamentos (empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_fpag_empresa_data_pagamento
  ON financeiro_pagamentos (empresa_id, data_pagamento);


-- ============================================================
-- TRIGGER updated_at
-- ============================================================

CREATE TRIGGER trg_fpag_updated_at
  BEFORE UPDATE ON financeiro_pagamentos
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE financeiro_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fpag: ver da empresa"
  ON financeiro_pagamentos FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

CREATE POLICY "fpag: inserir na empresa"
  ON financeiro_pagamentos FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

CREATE POLICY "fpag: atualizar na empresa"
  ON financeiro_pagamentos FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- OBSERVACOES DE GOVERNANCA
-- ============================================================
-- 1. Esta migration segue o padrao atual do Financeiro usando
--    auth_empresa_ids(), auth_perfil() e auth_usuario_id().
-- 2. Nao ha policy de DELETE nesta fase. Pagamentos nao devem ser
--    deletados fisicamente; cancelamento/estorno futuro sera via status.
-- 3. movimento_caixa_id e nullable e unico quando preenchido, evitando
--    que um mesmo movimento seja vinculado a mais de um pagamento.
-- 4. A criacao de movimento de caixa e a atualizacao de status da CP
--    ficam para a fase de implementacao do fluxo de baixa.
-- 5. A aplicacao deve validar empresa_id coerente entre pagamento,
--    conta a pagar, meio, fonte e movimento antes de gravar.
--
-- Rollback manual sugerido, se necessario em ambiente de revisao:
--
-- DROP TABLE IF EXISTS financeiro_pagamentos;
--
-- FIM: 023_financeiro_pagamentos.sql

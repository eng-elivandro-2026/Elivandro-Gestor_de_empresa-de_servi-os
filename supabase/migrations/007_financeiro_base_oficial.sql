-- ============================================================
-- 007_financeiro_base_oficial.sql
-- Fase F1 do módulo Financeiro: base oficial de tabelas.
--
-- Premissas:
--   • Funções auth_empresa_ids(), auth_usuario_id(), auth_perfil()
--     já existem (criadas em 001_rls_policies.sql).
--   • empresas(id) já existe como tabela referenciada.
--   • Nenhuma migration anterior é alterada.
--   • NÃO aplicar automaticamente — rodar manualmente no
--     SQL Editor do Supabase após revisão.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO AUXILIAR: trigger genérico de updated_at
-- Reutilizado em todas as tabelas financeiras.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION financeiro_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- TABELA 1: financeiro_contas_receber
-- Fonte oficial de contas a receber.
-- Vincula proposta e/ou obra a um direito de receber.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_contas_receber (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Vínculo com Comercial e Operacional (somente referência, sem FK rígida)
  proposta_app_id       text,
  obra_id               uuid,
  codigo_obra           text,
  centro_custo          text,

  -- Dados do cliente (snapshot no momento do registro)
  cliente_nome          text,
  cliente_cnpj          text,
  titulo                text,

  -- Valores financeiros
  valor_previsto        numeric(14,2) NOT NULL DEFAULT 0,
  valor_faturado        numeric(14,2) NOT NULL DEFAULT 0,
  valor_recebido        numeric(14,2) NOT NULL DEFAULT 0,
  valor_pendente        numeric(14,2) NOT NULL DEFAULT 0,

  -- Datas
  data_previsao         date,
  data_vencimento       date,

  -- Controle
  -- Valores possíveis: previsto | a_faturar | faturado |
  --   parcialmente_recebido | recebido | vencido | cancelado
  status                text NOT NULL DEFAULT 'previsto',
  origem                text,
  observacoes           text,

  -- Snapshot do dado de origem para rastreabilidade
  snapshot_origem_json  jsonb,

  -- Auditoria
  created_by            uuid DEFAULT auth_usuario_id(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fcr_empresa_id
  ON financeiro_contas_receber (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fcr_proposta_app_id
  ON financeiro_contas_receber (proposta_app_id);

CREATE INDEX IF NOT EXISTS idx_fcr_obra_id
  ON financeiro_contas_receber (obra_id);

CREATE INDEX IF NOT EXISTS idx_fcr_status
  ON financeiro_contas_receber (status);

CREATE INDEX IF NOT EXISTS idx_fcr_data_vencimento
  ON financeiro_contas_receber (data_vencimento);

CREATE INDEX IF NOT EXISTS idx_fcr_centro_custo
  ON financeiro_contas_receber (centro_custo);

-- Anti-duplicidade segura com obra_id nullable.
-- Caso 1: proposta sem obra (obra_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fcr_unique_proposta_sem_obra
  ON financeiro_contas_receber (empresa_id, proposta_app_id)
  WHERE obra_id IS NULL AND proposta_app_id IS NOT NULL;

-- Caso 2: proposta vinculada a uma obra específica
CREATE UNIQUE INDEX IF NOT EXISTS idx_fcr_unique_proposta_com_obra
  ON financeiro_contas_receber (empresa_id, proposta_app_id, obra_id)
  WHERE obra_id IS NOT NULL AND proposta_app_id IS NOT NULL;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_fcr_updated_at ON financeiro_contas_receber;
CREATE TRIGGER trg_fcr_updated_at
  BEFORE UPDATE ON financeiro_contas_receber
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

-- RLS
ALTER TABLE financeiro_contas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcr: ver da empresa" ON financeiro_contas_receber;
CREATE POLICY "fcr: ver da empresa"
  ON financeiro_contas_receber FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fcr: inserir na empresa" ON financeiro_contas_receber;
CREATE POLICY "fcr: inserir na empresa"
  ON financeiro_contas_receber FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "fcr: atualizar na empresa" ON financeiro_contas_receber;
CREATE POLICY "fcr: atualizar na empresa"
  ON financeiro_contas_receber FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "fcr: deletar gestor+" ON financeiro_contas_receber;
CREATE POLICY "fcr: deletar gestor+"
  ON financeiro_contas_receber FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- TABELA 2: financeiro_notas_fiscais
-- Fonte oficial de NFs vinculadas a contas a receber.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_notas_fiscais (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Vínculo obrigatório com a conta a receber
  conta_receber_id  uuid NOT NULL REFERENCES financeiro_contas_receber(id) ON DELETE CASCADE,

  -- Referências cruzadas (sem FK rígida para não acoplar)
  proposta_app_id   text,
  obra_id           uuid,

  -- Dados da NF
  numero_nf         text,
  tipo_nf           text,   -- 'servico' | 'material'
  data_emissao      date,
  valor_nf          numeric(14,2) NOT NULL DEFAULT 0,

  -- Controle
  -- Valores: emitida | paga | cancelada | substituida
  status            text NOT NULL DEFAULT 'emitida',
  observacoes       text,

  -- Auditoria
  created_by        uuid DEFAULT auth_usuario_id(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fnf_empresa_id
  ON financeiro_notas_fiscais (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fnf_conta_receber_id
  ON financeiro_notas_fiscais (conta_receber_id);

CREATE INDEX IF NOT EXISTS idx_fnf_proposta_app_id
  ON financeiro_notas_fiscais (proposta_app_id);

CREATE INDEX IF NOT EXISTS idx_fnf_obra_id
  ON financeiro_notas_fiscais (obra_id);

CREATE INDEX IF NOT EXISTS idx_fnf_numero_nf
  ON financeiro_notas_fiscais (numero_nf);

CREATE INDEX IF NOT EXISTS idx_fnf_data_emissao
  ON financeiro_notas_fiscais (data_emissao);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_fnf_updated_at ON financeiro_notas_fiscais;
CREATE TRIGGER trg_fnf_updated_at
  BEFORE UPDATE ON financeiro_notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

-- RLS
ALTER TABLE financeiro_notas_fiscais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fnf: ver da empresa" ON financeiro_notas_fiscais;
CREATE POLICY "fnf: ver da empresa"
  ON financeiro_notas_fiscais FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fnf: inserir na empresa" ON financeiro_notas_fiscais;
CREATE POLICY "fnf: inserir na empresa"
  ON financeiro_notas_fiscais FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "fnf: atualizar na empresa" ON financeiro_notas_fiscais;
CREATE POLICY "fnf: atualizar na empresa"
  ON financeiro_notas_fiscais FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "fnf: deletar gestor+" ON financeiro_notas_fiscais;
CREATE POLICY "fnf: deletar gestor+"
  ON financeiro_notas_fiscais FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- TABELA 3: financeiro_recebimentos
-- Registro oficial de cada recebimento realizado.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_recebimentos (
  id                                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                          uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Vínculos
  conta_receber_id                    uuid NOT NULL REFERENCES financeiro_contas_receber(id) ON DELETE CASCADE,
  nota_fiscal_id                      uuid REFERENCES financeiro_notas_fiscais(id) ON DELETE SET NULL,
  proposta_app_id                     text,
  obra_id                             uuid,

  -- Dados do recebimento
  data_recebimento                    date,
  valor_recebido                      numeric(14,2) NOT NULL DEFAULT 0,
  forma_recebimento                   text,   -- 'transferencia' | 'boleto' | 'cheque' | 'dinheiro' | 'pix'

  -- Risco Sacado
  risco_sacado                        boolean NOT NULL DEFAULT false,
  valor_perdido_risco_sacado          numeric(14,2) NOT NULL DEFAULT 0,
  percentual_perdido_risco_sacado     numeric(8,4)  NOT NULL DEFAULT 0,

  -- Comprovação
  comprovante_url                     text,
  observacoes                         text,

  -- Controle
  -- Valores: confirmado | pendente | estornado
  status                              text NOT NULL DEFAULT 'confirmado',

  -- Auditoria
  created_by                          uuid DEFAULT auth_usuario_id(),
  created_at                          timestamptz NOT NULL DEFAULT now(),
  updated_at                          timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_frec_empresa_id
  ON financeiro_recebimentos (empresa_id);

CREATE INDEX IF NOT EXISTS idx_frec_conta_receber_id
  ON financeiro_recebimentos (conta_receber_id);

CREATE INDEX IF NOT EXISTS idx_frec_nota_fiscal_id
  ON financeiro_recebimentos (nota_fiscal_id);

CREATE INDEX IF NOT EXISTS idx_frec_proposta_app_id
  ON financeiro_recebimentos (proposta_app_id);

CREATE INDEX IF NOT EXISTS idx_frec_obra_id
  ON financeiro_recebimentos (obra_id);

CREATE INDEX IF NOT EXISTS idx_frec_data_recebimento
  ON financeiro_recebimentos (data_recebimento);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_frec_updated_at ON financeiro_recebimentos;
CREATE TRIGGER trg_frec_updated_at
  BEFORE UPDATE ON financeiro_recebimentos
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

-- RLS
ALTER TABLE financeiro_recebimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "frec: ver da empresa" ON financeiro_recebimentos;
CREATE POLICY "frec: ver da empresa"
  ON financeiro_recebimentos FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "frec: inserir na empresa" ON financeiro_recebimentos;
CREATE POLICY "frec: inserir na empresa"
  ON financeiro_recebimentos FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "frec: atualizar na empresa" ON financeiro_recebimentos;
CREATE POLICY "frec: atualizar na empresa"
  ON financeiro_recebimentos FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "frec: deletar gestor+" ON financeiro_recebimentos;
CREATE POLICY "frec: deletar gestor+"
  ON financeiro_recebimentos FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- TABELA 4: financeiro_movimentos_caixa
-- Registro de cada entrada/saída prevista ou realizada.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_movimentos_caixa (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Classificação do movimento
  -- tipo: 'entrada' | 'saida'
  tipo            text NOT NULL,
  -- natureza: 'previsto' | 'realizado'
  natureza        text NOT NULL DEFAULT 'previsto',
  -- origem: 'proposta' | 'obra' | 'rh' | 'despesa' | 'manual'
  origem          text,
  -- referencia_id: ID externo do objeto de origem (proposta_app_id, obra_id etc)
  referencia_id   text,

  -- Datas
  data_prevista   date,
  data_real       date,

  -- Valores
  valor_previsto  numeric(14,2) NOT NULL DEFAULT 0,
  valor_real      numeric(14,2) NOT NULL DEFAULT 0,

  -- Controle
  -- Valores: previsto | realizado | cancelado | vencido
  status          text NOT NULL DEFAULT 'previsto',
  categoria       text,
  centro_custo    text,
  descricao       text,
  conciliado      boolean NOT NULL DEFAULT false,

  -- Auditoria
  created_by      uuid DEFAULT auth_usuario_id(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fmc_empresa_id
  ON financeiro_movimentos_caixa (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fmc_tipo
  ON financeiro_movimentos_caixa (tipo);

CREATE INDEX IF NOT EXISTS idx_fmc_natureza
  ON financeiro_movimentos_caixa (natureza);

CREATE INDEX IF NOT EXISTS idx_fmc_status
  ON financeiro_movimentos_caixa (status);

CREATE INDEX IF NOT EXISTS idx_fmc_data_prevista
  ON financeiro_movimentos_caixa (data_prevista);

CREATE INDEX IF NOT EXISTS idx_fmc_data_real
  ON financeiro_movimentos_caixa (data_real);

CREATE INDEX IF NOT EXISTS idx_fmc_centro_custo
  ON financeiro_movimentos_caixa (centro_custo);

CREATE INDEX IF NOT EXISTS idx_fmc_referencia_id
  ON financeiro_movimentos_caixa (referencia_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_fmc_updated_at ON financeiro_movimentos_caixa;
CREATE TRIGGER trg_fmc_updated_at
  BEFORE UPDATE ON financeiro_movimentos_caixa
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

-- RLS
ALTER TABLE financeiro_movimentos_caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmc: ver da empresa" ON financeiro_movimentos_caixa;
CREATE POLICY "fmc: ver da empresa"
  ON financeiro_movimentos_caixa FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fmc: inserir na empresa" ON financeiro_movimentos_caixa;
CREATE POLICY "fmc: inserir na empresa"
  ON financeiro_movimentos_caixa FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "fmc: atualizar na empresa" ON financeiro_movimentos_caixa;
CREATE POLICY "fmc: atualizar na empresa"
  ON financeiro_movimentos_caixa FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "fmc: deletar gestor+" ON financeiro_movimentos_caixa;
CREATE POLICY "fmc: deletar gestor+"
  ON financeiro_movimentos_caixa FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- TABELA 5: financeiro_saldos_caixa
-- Snapshot diário/periódico do saldo de caixa.
-- Um registro por empresa por data de referência.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_saldos_caixa (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Data de referência do saldo (uma linha por dia por empresa)
  data_referencia       date NOT NULL,

  -- Composição do saldo
  saldo_inicial         numeric(14,2) NOT NULL DEFAULT 0,
  entradas_previstas    numeric(14,2) NOT NULL DEFAULT 0,
  entradas_realizadas   numeric(14,2) NOT NULL DEFAULT 0,
  saidas_previstas      numeric(14,2) NOT NULL DEFAULT 0,
  saidas_realizadas     numeric(14,2) NOT NULL DEFAULT 0,

  -- Saldos calculados
  -- saldo_atual     = saldo_inicial + entradas_realizadas - saidas_realizadas
  -- saldo_projetado = saldo_atual + entradas_previstas - saidas_previstas
  -- caixa_livre     = saldo_atual - caixa_comprometido
  saldo_atual           numeric(14,2) NOT NULL DEFAULT 0,
  saldo_projetado       numeric(14,2) NOT NULL DEFAULT 0,
  caixa_comprometido    numeric(14,2) NOT NULL DEFAULT 0,
  caixa_livre           numeric(14,2) NOT NULL DEFAULT 0,

  -- Auditoria
  created_by            uuid DEFAULT auth_usuario_id(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fsc_empresa_data_unique UNIQUE (empresa_id, data_referencia)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_fsc_empresa_id
  ON financeiro_saldos_caixa (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fsc_data_referencia
  ON financeiro_saldos_caixa (data_referencia DESC);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_fsc_updated_at ON financeiro_saldos_caixa;
CREATE TRIGGER trg_fsc_updated_at
  BEFORE UPDATE ON financeiro_saldos_caixa
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

-- RLS
ALTER TABLE financeiro_saldos_caixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fsc: ver da empresa" ON financeiro_saldos_caixa;
CREATE POLICY "fsc: ver da empresa"
  ON financeiro_saldos_caixa FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fsc: inserir na empresa" ON financeiro_saldos_caixa;
CREATE POLICY "fsc: inserir na empresa"
  ON financeiro_saldos_caixa FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "fsc: atualizar na empresa" ON financeiro_saldos_caixa;
CREATE POLICY "fsc: atualizar na empresa"
  ON financeiro_saldos_caixa FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "fsc: deletar gestor+" ON financeiro_saldos_caixa;
CREATE POLICY "fsc: deletar gestor+"
  ON financeiro_saldos_caixa FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );

-- ============================================================
-- FIM: 007_financeiro_base_oficial.sql
-- Aplicar manualmente no SQL Editor do Supabase.
-- Verificar saída de cada bloco antes de prosseguir.
-- ============================================================

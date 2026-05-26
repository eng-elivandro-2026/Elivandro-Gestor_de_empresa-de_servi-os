-- ============================================================
-- 022_financeiro_adquirentes_maquininhas.sql
-- Fase F3.4-A: rascunho/revisao de cadastros de adquirentes e
-- maquininhas.
--
-- ESCOPO:
--   - financeiro_adquirentes
--   - financeiro_maquininhas
--   - vinculo opcional financeiro_fontes_financeiras.adquirente_id
--
-- FORA DESTA FASE:
--   - Transacoes de cartao
--   - Recebimento por maquininha
--   - Conciliacao bancaria
--   - Alteracoes em contas a pagar/receber, movimentos de caixa,
--     fluxo de caixa, DRE, XML fornecedor ou banco de precos
--
-- IMPORTANTE:
--   Migration em rascunho/revisao. NAO aplicar automaticamente.
--   Revisar no SQL Editor do Supabase antes de executar.
-- ============================================================


-- ============================================================
-- TABELA 1: financeiro_adquirentes
-- Cadastro de adquirentes/credenciadoras usadas para recebimentos
-- futuros por cartao, link de pagamento ou maquininha.
-- Taxas e prazos sao apenas cadastrais nesta fase.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_adquirentes (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  nome                            text NOT NULL,
  provedor                        text NOT NULL,
  codigo_estabelecimento          text,
  conta_bancaria_destino_id       uuid REFERENCES financeiro_contas_bancarias(id) ON DELETE SET NULL,
  prazo_recebimento_padrao        integer,
  taxa_debito_padrao              numeric(8,4),
  taxa_credito_padrao             numeric(8,4),
  taxa_credito_parcelado_padrao   numeric(8,4),
  ativo                           boolean NOT NULL DEFAULT true,
  observacao                      text,

  created_by                      uuid DEFAULT auth_usuario_id(),
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fad_nome_not_blank CHECK (length(trim(nome)) > 0),
  CONSTRAINT fad_provedor_check CHECK (
    provedor IN (
      'stone', 'cielo', 'rede', 'pagseguro', 'mercado_pago',
      'getnet', 'safrapay', 'sumup', 'outro'
    )
  ),
  CONSTRAINT fad_prazo_recebimento_check CHECK (
    prazo_recebimento_padrao IS NULL OR prazo_recebimento_padrao >= 0
  ),
  CONSTRAINT fad_taxa_debito_check CHECK (
    taxa_debito_padrao IS NULL OR taxa_debito_padrao >= 0
  ),
  CONSTRAINT fad_taxa_credito_check CHECK (
    taxa_credito_padrao IS NULL OR taxa_credito_padrao >= 0
  ),
  CONSTRAINT fad_taxa_credito_parcelado_check CHECK (
    taxa_credito_parcelado_padrao IS NULL OR taxa_credito_parcelado_padrao >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_fad_empresa_id
  ON financeiro_adquirentes (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fad_ativo
  ON financeiro_adquirentes (empresa_id, ativo);

CREATE INDEX IF NOT EXISTS idx_fad_nome
  ON financeiro_adquirentes (empresa_id, nome);

CREATE INDEX IF NOT EXISTS idx_fad_provedor
  ON financeiro_adquirentes (empresa_id, provedor);

CREATE INDEX IF NOT EXISTS idx_fad_conta_bancaria_destino_id
  ON financeiro_adquirentes (conta_bancaria_destino_id);

DROP TRIGGER IF EXISTS trg_fad_updated_at ON financeiro_adquirentes;
CREATE TRIGGER trg_fad_updated_at
  BEFORE UPDATE ON financeiro_adquirentes
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_adquirentes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fad: ver da empresa" ON financeiro_adquirentes;
CREATE POLICY "fad: ver da empresa"
  ON financeiro_adquirentes FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fad: inserir na empresa" ON financeiro_adquirentes;
CREATE POLICY "fad: inserir na empresa"
  ON financeiro_adquirentes FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fad: atualizar na empresa" ON financeiro_adquirentes;
CREATE POLICY "fad: atualizar na empresa"
  ON financeiro_adquirentes FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- TABELA 2: financeiro_maquininhas
-- Equipamentos/terminais vinculados a uma adquirente.
-- Nao gera recebimento, taxa, conciliacao ou movimento nesta fase.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_maquininhas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  adquirente_id   uuid NOT NULL REFERENCES financeiro_adquirentes(id) ON DELETE CASCADE,

  apelido         text NOT NULL,
  numero_serie    text,
  modelo          text,
  local_uso       text,
  responsavel     text,
  ativo           boolean NOT NULL DEFAULT true,
  observacao      text,

  created_by      uuid DEFAULT auth_usuario_id(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fmaq_apelido_not_blank CHECK (length(trim(apelido)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_fmaq_empresa_id
  ON financeiro_maquininhas (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fmaq_ativo
  ON financeiro_maquininhas (empresa_id, ativo);

CREATE INDEX IF NOT EXISTS idx_fmaq_adquirente_id
  ON financeiro_maquininhas (adquirente_id);

CREATE INDEX IF NOT EXISTS idx_fmaq_apelido
  ON financeiro_maquininhas (empresa_id, apelido);

CREATE INDEX IF NOT EXISTS idx_fmaq_numero_serie
  ON financeiro_maquininhas (empresa_id, numero_serie);

DROP TRIGGER IF EXISTS trg_fmaq_updated_at ON financeiro_maquininhas;
CREATE TRIGGER trg_fmaq_updated_at
  BEFORE UPDATE ON financeiro_maquininhas
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_maquininhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmaq: ver da empresa" ON financeiro_maquininhas;
CREATE POLICY "fmaq: ver da empresa"
  ON financeiro_maquininhas FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fmaq: inserir na empresa" ON financeiro_maquininhas;
CREATE POLICY "fmaq: inserir na empresa"
  ON financeiro_maquininhas FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fmaq: atualizar na empresa" ON financeiro_maquininhas;
CREATE POLICY "fmaq: atualizar na empresa"
  ON financeiro_maquininhas FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- VINCULO OPCIONAL: financeiro_fontes_financeiras.adquirente_id
-- A constraint atual fff_vinculo_tipo_check da migration 021 ja
-- permite fonte tipo 'adquirente' sem vinculo dedicado. Para evitar
-- risco em fontes existentes, esta migration apenas adiciona o campo
-- opcional e nao altera a constraint nesta fase.
-- ============================================================

ALTER TABLE financeiro_fontes_financeiras
  ADD COLUMN IF NOT EXISTS adquirente_id uuid REFERENCES financeiro_adquirentes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_fff_adquirente_id
  ON financeiro_fontes_financeiras (adquirente_id);


-- ============================================================
-- OBSERVACOES DE GOVERNANCA
-- ============================================================
-- 1. Esta migration segue o padrao atual do Financeiro usando
--    auth_empresa_ids(), auth_perfil() e auth_usuario_id().
-- 2. Existe divida tecnica conhecida: auth_perfil() ainda usa parte
--    de perfil global legado no enforcement do banco. Esta migration
--    preserva o padrao atual para nao alterar RLS fora do escopo.
-- 3. Nao ha policy de DELETE nesta fase. Cadastros devem ser
--    inativados por ativo=false ate haver regra formal de exclusao.
-- 4. Taxas e prazos das adquirentes sao somente cadastrais nesta fase.
--    Nao geram recebimento, taxa automatica, conciliacao ou movimento.
-- 5. A coluna adquirente_id em financeiro_fontes_financeiras e opcional
--    e nao muda a constraint atual de fontes.
--
-- Rollback manual sugerido, se a migration for aplicada em ambiente de
-- revisao e precisar ser revertida:
--
-- ALTER TABLE financeiro_fontes_financeiras
--   DROP COLUMN IF EXISTS adquirente_id;
--
-- DROP TABLE IF EXISTS financeiro_maquininhas;
-- DROP TABLE IF EXISTS financeiro_adquirentes;
--
-- ============================================================
-- FIM: 022_financeiro_adquirentes_maquininhas.sql
-- ============================================================

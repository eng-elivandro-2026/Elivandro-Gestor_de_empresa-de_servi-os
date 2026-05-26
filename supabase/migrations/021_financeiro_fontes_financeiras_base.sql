-- ============================================================
-- 021_financeiro_fontes_financeiras_base.sql
-- Fase F3.1: cadastros base de fontes financeiras.
--
-- ESCOPO:
--   - Bancos
--   - Contas bancarias
--   - Caixas internos
--   - Cartoes empresariais
--   - Meios de pagamento
--   - Fontes financeiras
--
-- FORA DESTA FASE:
--   - Adquirentes/maquininhas como tabelas dedicadas
--   - Transacoes de cartao
--   - Conciliacao bancaria
--   - Alteracoes em contas a pagar/receber, movimentos de caixa,
--     fluxo de caixa, DRE, XML fornecedor ou banco de precos
--
-- IMPORTANTE:
--   Migration em rascunho/revisao. NAO aplicar automaticamente.
--   Revisar no SQL Editor do Supabase antes de executar.
-- ============================================================


-- ============================================================
-- TABELA 1: financeiro_bancos
-- Cadastro de bancos por empresa.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_bancos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  codigo_banco  text,
  nome_banco    text NOT NULL,
  apelido       text,
  site          text,
  ativo         boolean NOT NULL DEFAULT true,
  observacao    text,

  created_by    uuid DEFAULT auth_usuario_id(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fb_nome_banco_not_blank CHECK (length(trim(nome_banco)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_fb_empresa_id
  ON financeiro_bancos (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fb_codigo_banco
  ON financeiro_bancos (empresa_id, codigo_banco);

CREATE INDEX IF NOT EXISTS idx_fb_nome_banco
  ON financeiro_bancos (empresa_id, nome_banco);

DROP TRIGGER IF EXISTS trg_fb_updated_at ON financeiro_bancos;
CREATE TRIGGER trg_fb_updated_at
  BEFORE UPDATE ON financeiro_bancos
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_bancos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fb: ver da empresa" ON financeiro_bancos;
CREATE POLICY "fb: ver da empresa"
  ON financeiro_bancos FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fb: inserir na empresa" ON financeiro_bancos;
CREATE POLICY "fb: inserir na empresa"
  ON financeiro_bancos FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fb: atualizar na empresa" ON financeiro_bancos;
CREATE POLICY "fb: atualizar na empresa"
  ON financeiro_bancos FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- TABELA 2: financeiro_contas_bancarias
-- Cadastro de contas bancarias, contas de pagamento e similares.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_contas_bancarias (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  banco_id            uuid REFERENCES financeiro_bancos(id) ON DELETE SET NULL,

  apelido             text NOT NULL,
  titular_nome        text,
  titular_documento   text,
  agencia             text,
  conta               text,
  digito              text,
  tipo_conta          text NOT NULL DEFAULT 'corrente',
  chave_pix           text,
  saldo_inicial       numeric(14,2) NOT NULL DEFAULT 0,
  data_saldo_inicial  date,
  ativo               boolean NOT NULL DEFAULT true,
  observacao          text,

  created_by          uuid DEFAULT auth_usuario_id(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fcb_apelido_not_blank CHECK (length(trim(apelido)) > 0),
  CONSTRAINT fcb_tipo_conta_check CHECK (
    tipo_conta IN ('corrente', 'poupanca', 'pagamento', 'investimento', 'outro')
  )
);

CREATE INDEX IF NOT EXISTS idx_fcb_empresa_id
  ON financeiro_contas_bancarias (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fcb_banco_id
  ON financeiro_contas_bancarias (banco_id);

CREATE INDEX IF NOT EXISTS idx_fcb_apelido
  ON financeiro_contas_bancarias (empresa_id, apelido);

CREATE INDEX IF NOT EXISTS idx_fcb_titular_documento
  ON financeiro_contas_bancarias (empresa_id, titular_documento);

DROP TRIGGER IF EXISTS trg_fcb_updated_at ON financeiro_contas_bancarias;
CREATE TRIGGER trg_fcb_updated_at
  BEFORE UPDATE ON financeiro_contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_contas_bancarias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcb: ver da empresa" ON financeiro_contas_bancarias;
CREATE POLICY "fcb: ver da empresa"
  ON financeiro_contas_bancarias FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fcb: inserir na empresa" ON financeiro_contas_bancarias;
CREATE POLICY "fcb: inserir na empresa"
  ON financeiro_contas_bancarias FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fcb: atualizar na empresa" ON financeiro_contas_bancarias;
CREATE POLICY "fcb: atualizar na empresa"
  ON financeiro_contas_bancarias FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- TABELA 3: financeiro_caixas_internos
-- Caixa pequeno, caixa fisico e controles internos similares.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_caixas_internos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  nome                text NOT NULL,
  responsavel         text,
  saldo_inicial       numeric(14,2) NOT NULL DEFAULT 0,
  data_saldo_inicial  date,
  ativo               boolean NOT NULL DEFAULT true,
  observacao          text,

  created_by          uuid DEFAULT auth_usuario_id(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fci_nome_not_blank CHECK (length(trim(nome)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_fci_empresa_id
  ON financeiro_caixas_internos (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fci_nome
  ON financeiro_caixas_internos (empresa_id, nome);

DROP TRIGGER IF EXISTS trg_fci_updated_at ON financeiro_caixas_internos;
CREATE TRIGGER trg_fci_updated_at
  BEFORE UPDATE ON financeiro_caixas_internos
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_caixas_internos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fci: ver da empresa" ON financeiro_caixas_internos;
CREATE POLICY "fci: ver da empresa"
  ON financeiro_caixas_internos FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fci: inserir na empresa" ON financeiro_caixas_internos;
CREATE POLICY "fci: inserir na empresa"
  ON financeiro_caixas_internos FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fci: atualizar na empresa" ON financeiro_caixas_internos;
CREATE POLICY "fci: atualizar na empresa"
  ON financeiro_caixas_internos FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- TABELA 4: financeiro_cartoes_empresa
-- Cartoes usados pela empresa para pagar despesas/fornecedores.
-- Nao confundir com maquininha/adquirente de recebimento.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_cartoes_empresa (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  conta_bancaria_id   uuid REFERENCES financeiro_contas_bancarias(id) ON DELETE SET NULL,

  apelido             text NOT NULL,
  bandeira            text,
  tipo_cartao         text NOT NULL DEFAULT 'credito',
  final_cartao        text,
  limite_credito      numeric(14,2),
  dia_fechamento      integer,
  dia_vencimento      integer,
  ativo               boolean NOT NULL DEFAULT true,
  observacao          text,

  created_by          uuid DEFAULT auth_usuario_id(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fce_apelido_not_blank CHECK (length(trim(apelido)) > 0),
  CONSTRAINT fce_bandeira_check CHECK (
    bandeira IS NULL OR bandeira IN ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'outro')
  ),
  CONSTRAINT fce_tipo_cartao_check CHECK (
    tipo_cartao IN ('credito', 'debito', 'multiplo')
  ),
  CONSTRAINT fce_final_cartao_check CHECK (
    final_cartao IS NULL OR final_cartao ~ '^[0-9]{4}$'
  ),
  CONSTRAINT fce_dia_fechamento_check CHECK (
    dia_fechamento IS NULL OR (dia_fechamento BETWEEN 1 AND 31)
  ),
  CONSTRAINT fce_dia_vencimento_check CHECK (
    dia_vencimento IS NULL OR (dia_vencimento BETWEEN 1 AND 31)
  )
);

CREATE INDEX IF NOT EXISTS idx_fce_empresa_id
  ON financeiro_cartoes_empresa (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fce_conta_bancaria_id
  ON financeiro_cartoes_empresa (conta_bancaria_id);

CREATE INDEX IF NOT EXISTS idx_fce_apelido
  ON financeiro_cartoes_empresa (empresa_id, apelido);

DROP TRIGGER IF EXISTS trg_fce_updated_at ON financeiro_cartoes_empresa;
CREATE TRIGGER trg_fce_updated_at
  BEFORE UPDATE ON financeiro_cartoes_empresa
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_cartoes_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fce: ver da empresa" ON financeiro_cartoes_empresa;
CREATE POLICY "fce: ver da empresa"
  ON financeiro_cartoes_empresa FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fce: inserir na empresa" ON financeiro_cartoes_empresa;
CREATE POLICY "fce: inserir na empresa"
  ON financeiro_cartoes_empresa FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fce: atualizar na empresa" ON financeiro_cartoes_empresa;
CREATE POLICY "fce: atualizar na empresa"
  ON financeiro_cartoes_empresa FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- TABELA 5: financeiro_meios_pagamento
-- Classificacao do jeito de pagar/receber: pix, boleto, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_meios_pagamento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  nome          text NOT NULL,
  tipo          text NOT NULL,
  natureza      text NOT NULL DEFAULT 'ambos',
  ativo         boolean NOT NULL DEFAULT true,
  observacao    text,

  created_by    uuid DEFAULT auth_usuario_id(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fmp_nome_not_blank CHECK (length(trim(nome)) > 0),
  CONSTRAINT fmp_tipo_check CHECK (
    tipo IN (
      'pix', 'boleto', 'ted', 'transferencia', 'dinheiro', 'cheque',
      'cartao_credito', 'cartao_debito', 'link_pagamento', 'maquininha',
      'debito_automatico', 'outro'
    )
  ),
  CONSTRAINT fmp_natureza_check CHECK (
    natureza IN ('pagamento', 'recebimento', 'ambos')
  )
);

CREATE INDEX IF NOT EXISTS idx_fmp_empresa_id
  ON financeiro_meios_pagamento (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fmp_tipo
  ON financeiro_meios_pagamento (empresa_id, tipo);

CREATE INDEX IF NOT EXISTS idx_fmp_natureza
  ON financeiro_meios_pagamento (empresa_id, natureza);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fmp_empresa_nome_unique
  ON financeiro_meios_pagamento (empresa_id, lower(nome));

DROP TRIGGER IF EXISTS trg_fmp_updated_at ON financeiro_meios_pagamento;
CREATE TRIGGER trg_fmp_updated_at
  BEFORE UPDATE ON financeiro_meios_pagamento
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_meios_pagamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fmp: ver da empresa" ON financeiro_meios_pagamento;
CREATE POLICY "fmp: ver da empresa"
  ON financeiro_meios_pagamento FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fmp: inserir na empresa" ON financeiro_meios_pagamento;
CREATE POLICY "fmp: inserir na empresa"
  ON financeiro_meios_pagamento FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fmp: atualizar na empresa" ON financeiro_meios_pagamento;
CREATE POLICY "fmp: atualizar na empresa"
  ON financeiro_meios_pagamento FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- TABELA 6: financeiro_fontes_financeiras
-- Onde o dinheiro entra/sai. Camada de unificacao para telas
-- futuras de pagamento, recebimento e conciliacao.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_fontes_financeiras (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  tipo                text NOT NULL,
  nome                text NOT NULL,
  banco_id            uuid REFERENCES financeiro_bancos(id) ON DELETE SET NULL,
  conta_bancaria_id   uuid REFERENCES financeiro_contas_bancarias(id) ON DELETE SET NULL,
  cartao_empresa_id   uuid REFERENCES financeiro_cartoes_empresa(id) ON DELETE SET NULL,
  caixa_interno_id    uuid REFERENCES financeiro_caixas_internos(id) ON DELETE SET NULL,
  ativo               boolean NOT NULL DEFAULT true,
  observacao          text,

  created_by          uuid DEFAULT auth_usuario_id(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fff_nome_not_blank CHECK (length(trim(nome)) > 0),
  CONSTRAINT fff_tipo_check CHECK (
    tipo IN ('conta_bancaria', 'cartao_empresa', 'caixa', 'carteira', 'adquirente', 'outro')
  ),
  CONSTRAINT fff_vinculo_tipo_check CHECK (
    (tipo = 'conta_bancaria' AND conta_bancaria_id IS NOT NULL)
    OR (tipo = 'cartao_empresa' AND cartao_empresa_id IS NOT NULL)
    OR (tipo = 'caixa' AND caixa_interno_id IS NOT NULL)
    OR (tipo IN ('carteira', 'adquirente', 'outro'))
  )
);

CREATE INDEX IF NOT EXISTS idx_fff_empresa_id
  ON financeiro_fontes_financeiras (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fff_tipo
  ON financeiro_fontes_financeiras (empresa_id, tipo);

CREATE INDEX IF NOT EXISTS idx_fff_nome
  ON financeiro_fontes_financeiras (empresa_id, nome);

CREATE INDEX IF NOT EXISTS idx_fff_banco_id
  ON financeiro_fontes_financeiras (banco_id);

CREATE INDEX IF NOT EXISTS idx_fff_conta_bancaria_id
  ON financeiro_fontes_financeiras (conta_bancaria_id);

CREATE INDEX IF NOT EXISTS idx_fff_cartao_empresa_id
  ON financeiro_fontes_financeiras (cartao_empresa_id);

CREATE INDEX IF NOT EXISTS idx_fff_caixa_interno_id
  ON financeiro_fontes_financeiras (caixa_interno_id);

DROP TRIGGER IF EXISTS trg_fff_updated_at ON financeiro_fontes_financeiras;
CREATE TRIGGER trg_fff_updated_at
  BEFORE UPDATE ON financeiro_fontes_financeiras
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_fontes_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fff: ver da empresa" ON financeiro_fontes_financeiras;
CREATE POLICY "fff: ver da empresa"
  ON financeiro_fontes_financeiras FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fff: inserir na empresa" ON financeiro_fontes_financeiras;
CREATE POLICY "fff: inserir na empresa"
  ON financeiro_fontes_financeiras FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fff: atualizar na empresa" ON financeiro_fontes_financeiras;
CREATE POLICY "fff: atualizar na empresa"
  ON financeiro_fontes_financeiras FOR UPDATE
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
--    auth_empresa_ids() e auth_perfil().
-- 2. Existe divida tecnica conhecida: auth_perfil() ainda usa parte
--    de perfil global legado no enforcement do banco. A UI ja trabalha
--    com perfil por empresa, mas essa migration preserva o padrao atual
--    para nao alterar RLS fora do escopo.
-- 3. Nao ha policy de DELETE nesta fase. Cadastros base devem ser
--    inativados por ativo=false ate haver regra formal de exclusao.
-- 4. Nao ha seed automatico de meios de pagamento nesta fase.
--
-- Rollback manual sugerido, se a migration for aplicada em ambiente de
-- revisao e precisar ser revertida:
--
-- DROP TABLE IF EXISTS financeiro_fontes_financeiras;
-- DROP TABLE IF EXISTS financeiro_cartoes_empresa;
-- DROP TABLE IF EXISTS financeiro_caixas_internos;
-- DROP TABLE IF EXISTS financeiro_contas_bancarias;
-- DROP TABLE IF EXISTS financeiro_meios_pagamento;
-- DROP TABLE IF EXISTS financeiro_bancos;
--
-- ============================================================
-- FIM: 021_financeiro_fontes_financeiras_base.sql
-- ============================================================

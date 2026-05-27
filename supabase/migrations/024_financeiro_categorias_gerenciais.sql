-- 024_financeiro_categorias_gerenciais.sql
-- F3.6-A1 - Plano Gerencial Financeiro / Categorias Financeiras.
--
-- Objetivo:
--   Criar a tabela mestre de categorias gerenciais por empresa e preparar
--   vinculos opcionais em CP, CR e movimentos de caixa.
--
-- Escopo desta migration:
--   - cria financeiro_categorias_gerenciais;
--   - adiciona categoria_gerencial_id nullable em:
--       financeiro_contas_pagar,
--       financeiro_contas_receber,
--       financeiro_movimentos_caixa;
--   - cria seed inicial por empresa, idempotente por empresa_id + codigo.
--
-- Fora do escopo:
--   - nao altera calculos;
--   - nao altera status;
--   - nao altera baixa real;
--   - nao cria movimento de caixa;
--   - nao altera Fluxo de Caixa ou DRE funcionalmente;
--   - nao altera XML fornecedor ou Banco de Precos.


-- ============================================================
-- TABELA: financeiro_categorias_gerenciais
-- Plano gerencial financeiro por empresa.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_categorias_gerenciais (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id                      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  codigo                          text NOT NULL,
  nome                            text NOT NULL,
  tipo_movimento                  text NOT NULL,
  grupo                           text NOT NULL,
  subgrupo                        text,
  categoria_pai_id                uuid,
  natureza                        text NOT NULL,

  impacta_fluxo_caixa             boolean NOT NULL DEFAULT true,
  impacta_dre                     boolean NOT NULL DEFAULT true,
  impacta_resultado_operacional   boolean NOT NULL DEFAULT true,

  ativo                           boolean NOT NULL DEFAULT true,
  ordem                           integer NOT NULL DEFAULT 0,
  observacao                      text,

  created_by                      uuid DEFAULT auth_usuario_id(),
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fcg_codigo_not_blank CHECK (length(trim(codigo)) > 0),
  CONSTRAINT fcg_nome_not_blank CHECK (length(trim(nome)) > 0),
  CONSTRAINT fcg_tipo_movimento_check CHECK (
    tipo_movimento IN ('entrada', 'saida', 'transferencia')
  ),
  CONSTRAINT fcg_natureza_check CHECK (
    natureza IN (
      'operacional',
      'financeira',
      'investimento',
      'socios',
      'divida',
      'transferencia',
      'imposto'
    )
  ),
  CONSTRAINT fcg_codigo_empresa_unique UNIQUE (empresa_id, codigo),
  CONSTRAINT fcg_empresa_id_id_unique UNIQUE (empresa_id, id),
  CONSTRAINT fcg_categoria_pai_empresa_fk
    FOREIGN KEY (empresa_id, categoria_pai_id)
    REFERENCES financeiro_categorias_gerenciais (empresa_id, id)
);


-- ============================================================
-- INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_fcg_empresa_id
  ON financeiro_categorias_gerenciais (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fcg_tipo_movimento
  ON financeiro_categorias_gerenciais (empresa_id, tipo_movimento);

CREATE INDEX IF NOT EXISTS idx_fcg_grupo
  ON financeiro_categorias_gerenciais (empresa_id, grupo);

CREATE INDEX IF NOT EXISTS idx_fcg_subgrupo
  ON financeiro_categorias_gerenciais (empresa_id, subgrupo);

CREATE INDEX IF NOT EXISTS idx_fcg_ativo
  ON financeiro_categorias_gerenciais (empresa_id, ativo);

CREATE INDEX IF NOT EXISTS idx_fcg_categoria_pai_id
  ON financeiro_categorias_gerenciais (categoria_pai_id);

CREATE INDEX IF NOT EXISTS idx_fcg_ordem
  ON financeiro_categorias_gerenciais (empresa_id, ordem);


-- ============================================================
-- TRIGGER updated_at
-- ============================================================

DROP TRIGGER IF EXISTS trg_fcg_updated_at ON financeiro_categorias_gerenciais;
CREATE TRIGGER trg_fcg_updated_at
  BEFORE UPDATE ON financeiro_categorias_gerenciais
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();


-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE financeiro_categorias_gerenciais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcg: ver da empresa" ON financeiro_categorias_gerenciais;
CREATE POLICY "fcg: ver da empresa"
  ON financeiro_categorias_gerenciais FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fcg: inserir na empresa" ON financeiro_categorias_gerenciais;
CREATE POLICY "fcg: inserir na empresa"
  ON financeiro_categorias_gerenciais FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "fcg: atualizar na empresa" ON financeiro_categorias_gerenciais;
CREATE POLICY "fcg: atualizar na empresa"
  ON financeiro_categorias_gerenciais FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- VINCULOS OPCIONAIS EM TABELAS FINANCEIRAS EXISTENTES
-- Mantem campos textuais antigos para compatibilidade.
-- FKs compostas garantem que a categoria pertence a mesma empresa.
-- ============================================================

ALTER TABLE financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS categoria_gerencial_id uuid;

ALTER TABLE financeiro_contas_receber
  ADD COLUMN IF NOT EXISTS categoria_gerencial_id uuid;

ALTER TABLE financeiro_movimentos_caixa
  ADD COLUMN IF NOT EXISTS categoria_gerencial_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fcp_categoria_gerencial_empresa_fk'
      AND conrelid = 'financeiro_contas_pagar'::regclass
  ) THEN
    ALTER TABLE financeiro_contas_pagar
      ADD CONSTRAINT fcp_categoria_gerencial_empresa_fk
      FOREIGN KEY (empresa_id, categoria_gerencial_id)
      REFERENCES financeiro_categorias_gerenciais (empresa_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fcr_categoria_gerencial_empresa_fk'
      AND conrelid = 'financeiro_contas_receber'::regclass
  ) THEN
    ALTER TABLE financeiro_contas_receber
      ADD CONSTRAINT fcr_categoria_gerencial_empresa_fk
      FOREIGN KEY (empresa_id, categoria_gerencial_id)
      REFERENCES financeiro_categorias_gerenciais (empresa_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fmc_categoria_gerencial_empresa_fk'
      AND conrelid = 'financeiro_movimentos_caixa'::regclass
  ) THEN
    ALTER TABLE financeiro_movimentos_caixa
      ADD CONSTRAINT fmc_categoria_gerencial_empresa_fk
      FOREIGN KEY (empresa_id, categoria_gerencial_id)
      REFERENCES financeiro_categorias_gerenciais (empresa_id, id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fcp_categoria_gerencial_id
  ON financeiro_contas_pagar (empresa_id, categoria_gerencial_id);

CREATE INDEX IF NOT EXISTS idx_fcr_categoria_gerencial_id
  ON financeiro_contas_receber (empresa_id, categoria_gerencial_id);

CREATE INDEX IF NOT EXISTS idx_fmc_categoria_gerencial_id
  ON financeiro_movimentos_caixa (empresa_id, categoria_gerencial_id);


-- ============================================================
-- SEED INICIAL POR EMPRESA
-- Categorias claras para uso gerencial, sem duplicidade por empresa.
-- ============================================================

WITH categorias_base (
  codigo,
  nome,
  tipo_movimento,
  grupo,
  subgrupo,
  natureza,
  impacta_fluxo_caixa,
  impacta_dre,
  impacta_resultado_operacional,
  ordem
) AS (
  VALUES
    ('REC.OP.001', 'Receita de Serviços Técnicos', 'entrada', 'Receitas Operacionais', 'Serviços', 'operacional', true, true, true, 101),
    ('REC.OP.002', 'Receita de Projetos Elétricos', 'entrada', 'Receitas Operacionais', 'Projetos', 'operacional', true, true, true, 102),
    ('REC.OP.003', 'Receita de Montagem de Painéis', 'entrada', 'Receitas Operacionais', 'Montagem', 'operacional', true, true, true, 103),
    ('REC.OP.004', 'Receita de Automação Industrial', 'entrada', 'Receitas Operacionais', 'Automação', 'operacional', true, true, true, 104),
    ('REC.OP.005', 'Receita de Venda de Materiais', 'entrada', 'Receitas Operacionais', 'Materiais', 'operacional', true, true, true, 105),
    ('REC.OP.006', 'Receita de Locação', 'entrada', 'Receitas Operacionais', 'Locação', 'operacional', true, true, true, 106),
    ('REC.OP.007', 'Receita de Treinamentos', 'entrada', 'Receitas Operacionais', 'Treinamentos', 'operacional', true, true, true, 107),
    ('REC.OP.008', 'Receita de Software / Licenças / Assinaturas', 'entrada', 'Receitas Operacionais', 'Software', 'operacional', true, true, true, 108),

    ('REC.NO.001', 'Reembolso de Despesas', 'entrada', 'Entradas Não Operacionais', 'Reembolsos', 'financeira', true, false, false, 201),
    ('REC.NO.002', 'Estorno', 'entrada', 'Entradas Não Operacionais', 'Estornos', 'financeira', true, false, false, 202),
    ('REC.NO.003', 'Empréstimo Recebido', 'entrada', 'Entradas Não Operacionais', 'Dívidas / Empréstimos', 'divida', true, false, false, 203),
    ('REC.NO.004', 'Rendimentos Financeiros', 'entrada', 'Entradas Não Operacionais', 'Financeiras', 'financeira', true, true, false, 204),
    ('REC.NO.005', 'Juros Recebidos', 'entrada', 'Entradas Não Operacionais', 'Financeiras', 'financeira', true, true, false, 205),

    ('CD.MAT.001', 'Materiais Aplicados em Obra', 'saida', 'Custos Diretos', 'Materiais', 'operacional', true, true, true, 301),
    ('CD.MAT.002', 'Materiais para Revenda', 'saida', 'Custos Diretos', 'Materiais', 'operacional', true, true, true, 302),
    ('CD.MOD.001', 'Mão de Obra Direta — Funcionários em Obra', 'saida', 'Custos Diretos', 'Mão de Obra Direta', 'operacional', true, true, true, 311),
    ('CD.MOD.002', 'Mão de Obra Direta — Projetos Elétricos', 'saida', 'Custos Diretos', 'Mão de Obra Direta', 'operacional', true, true, true, 312),
    ('CD.MOD.003', 'Mão de Obra Direta — Comissionamento / Start-up', 'saida', 'Custos Diretos', 'Mão de Obra Direta', 'operacional', true, true, true, 313),
    ('CD.MOD.004', 'Mão de Obra Direta — Terceiros / Prestadores', 'saida', 'Custos Diretos', 'Mão de Obra Direta', 'operacional', true, true, true, 314),
    ('CD.OBR.001', 'Deslocamento de Obra', 'saida', 'Custos Diretos', 'Obra / Campo', 'operacional', true, true, true, 321),
    ('CD.OBR.002', 'Hospedagem de Obra', 'saida', 'Custos Diretos', 'Obra / Campo', 'operacional', true, true, true, 322),
    ('CD.OBR.003', 'Alimentação de Obra', 'saida', 'Custos Diretos', 'Obra / Campo', 'operacional', true, true, true, 323),
    ('CD.OBR.004', 'Ferramentas de Obra', 'saida', 'Custos Diretos', 'Obra / Campo', 'operacional', true, true, true, 324),
    ('CD.OBR.005', 'EPIs de Obra', 'saida', 'Custos Diretos', 'Obra / Campo', 'operacional', true, true, true, 325),
    ('CD.OBR.006', 'Fretes de Obra / Entrega', 'saida', 'Custos Diretos', 'Obra / Campo', 'operacional', true, true, true, 326),

    ('DO.SAL.001', 'Salários — Equipe Interna', 'saida', 'Despesas Operacionais', 'Salários', 'operacional', true, true, true, 401),
    ('DO.SAL.002', 'Salários — Administrativo', 'saida', 'Despesas Operacionais', 'Salários', 'operacional', true, true, true, 402),
    ('DO.SAL.003', 'Salários — Financeiro', 'saida', 'Despesas Operacionais', 'Salários', 'operacional', true, true, true, 403),
    ('DO.SAL.004', 'Salários — Comercial', 'saida', 'Despesas Operacionais', 'Salários', 'operacional', true, true, true, 404),
    ('DO.SAL.005', 'Salários — Operacional Interno', 'saida', 'Despesas Operacionais', 'Salários', 'operacional', true, true, true, 405),
    ('DO.RH.001', 'Encargos Trabalhistas', 'saida', 'Despesas Operacionais', 'Pessoas', 'operacional', true, true, true, 411),
    ('DO.RH.002', 'Benefícios de Colaboradores', 'saida', 'Despesas Operacionais', 'Pessoas', 'operacional', true, true, true, 412),
    ('DO.ADM.001', 'Administrativo', 'saida', 'Despesas Operacionais', 'Administrativo', 'operacional', true, true, true, 421),
    ('DO.COM.001', 'Comercial / Marketing', 'saida', 'Despesas Operacionais', 'Comercial', 'operacional', true, true, true, 431),
    ('DO.PRO.001', 'Contabilidade', 'saida', 'Despesas Operacionais', 'Profissionais', 'operacional', true, true, true, 441),
    ('DO.PRO.002', 'Jurídico', 'saida', 'Despesas Operacionais', 'Profissionais', 'operacional', true, true, true, 442),
    ('DO.SIS.001', 'Sistemas / Softwares', 'saida', 'Despesas Operacionais', 'Tecnologia', 'operacional', true, true, true, 451),
    ('DO.TEL.001', 'Telefonia / Internet', 'saida', 'Despesas Operacionais', 'Infraestrutura', 'operacional', true, true, true, 461),
    ('DO.IMV.001', 'Imóvel / Aluguel / Energia / Água', 'saida', 'Despesas Operacionais', 'Infraestrutura', 'operacional', true, true, true, 471),
    ('DO.VEI.001', 'Veículos / Combustível / Pedágio / Manutenção', 'saida', 'Despesas Operacionais', 'Veículos', 'operacional', true, true, true, 481),
    ('DO.DIR.001', 'Diretoria / Pró-labore', 'saida', 'Despesas Operacionais', 'Diretoria', 'operacional', true, true, true, 491),

    ('IMP.001', 'DAS Simples Nacional', 'saida', 'Impostos', 'Tributos', 'imposto', true, true, false, 501),
    ('IMP.002', 'ISS', 'saida', 'Impostos', 'Tributos', 'imposto', true, true, false, 502),
    ('IMP.003', 'Retenções', 'saida', 'Impostos', 'Tributos', 'imposto', true, true, false, 503),
    ('IMP.004', 'INSS', 'saida', 'Impostos', 'Tributos', 'imposto', true, true, false, 504),
    ('IMP.005', 'IRRF', 'saida', 'Impostos', 'Tributos', 'imposto', true, true, false, 505),
    ('IMP.006', 'Taxas e Alvarás', 'saida', 'Impostos', 'Taxas', 'imposto', true, true, false, 506),

    ('FIN.001', 'Tarifas Bancárias', 'saida', 'Financeiras', 'Tarifas', 'financeira', true, true, false, 601),
    ('FIN.002', 'Juros Pagos', 'saida', 'Financeiras', 'Juros / Multas', 'financeira', true, true, false, 602),
    ('FIN.003', 'Multas Pagas', 'saida', 'Financeiras', 'Juros / Multas', 'financeira', true, true, false, 603),
    ('FIN.004', 'Descontos Concedidos', 'saida', 'Financeiras', 'Descontos', 'financeira', true, true, false, 604),
    ('FIN.005', 'Descontos Obtidos', 'entrada', 'Financeiras', 'Descontos', 'financeira', true, true, false, 605),

    ('INV.001', 'Máquinas e Equipamentos', 'saida', 'Investimentos / Imobilizado', 'Equipamentos', 'investimento', true, false, false, 701),
    ('INV.002', 'Computadores e Periféricos', 'saida', 'Investimentos / Imobilizado', 'Tecnologia', 'investimento', true, false, false, 702),
    ('INV.003', 'Ferramentas', 'saida', 'Investimentos / Imobilizado', 'Ferramentas', 'investimento', true, false, false, 703),
    ('INV.004', 'Veículos', 'saida', 'Investimentos / Imobilizado', 'Veículos', 'investimento', true, false, false, 704),
    ('INV.005', 'Benfeitorias', 'saida', 'Investimentos / Imobilizado', 'Infraestrutura', 'investimento', true, false, false, 705),
    ('INV.006', 'Software Permanente', 'saida', 'Investimentos / Imobilizado', 'Tecnologia', 'investimento', true, false, false, 706),

    ('SOC.001', 'Distribuição de Lucros', 'saida', 'Sócios / Capital', 'Distribuição', 'socios', true, false, false, 801),
    ('SOC.002', 'Adiantamento a Sócio', 'saida', 'Sócios / Capital', 'Adiantamentos', 'socios', true, false, false, 802),
    ('SOC.003', 'Aporte de Sócio', 'entrada', 'Sócios / Capital', 'Aportes', 'socios', true, false, false, 803),
    ('SOC.004', 'AFAC', 'entrada', 'Sócios / Capital', 'Aportes', 'socios', true, false, false, 804),
    ('SOC.005', 'Integralização de Capital', 'entrada', 'Sócios / Capital', 'Aportes', 'socios', true, false, false, 805),

    ('DIV.001', 'Pagamento de Principal', 'saida', 'Dívidas / Empréstimos', 'Principal', 'divida', true, false, false, 901),
    ('DIV.002', 'Juros de Empréstimos', 'saida', 'Dívidas / Empréstimos', 'Juros', 'divida', true, true, false, 902),
    ('DIV.003', 'Parcelamentos', 'saida', 'Dívidas / Empréstimos', 'Parcelamentos', 'divida', true, false, false, 903),
    ('DIV.004', 'Financiamentos', 'saida', 'Dívidas / Empréstimos', 'Financiamentos', 'divida', true, false, false, 904),

    ('TRF.001', 'Transferência entre Contas', 'transferencia', 'Transferências Internas', 'Transferências', 'transferencia', true, false, false, 1001),
    ('TRF.002', 'Ajustes Internos de Caixa', 'transferencia', 'Transferências Internas', 'Ajustes', 'transferencia', true, false, false, 1002)
)
INSERT INTO financeiro_categorias_gerenciais (
  empresa_id,
  codigo,
  nome,
  tipo_movimento,
  grupo,
  subgrupo,
  natureza,
  impacta_fluxo_caixa,
  impacta_dre,
  impacta_resultado_operacional,
  ordem
)
SELECT
  e.id,
  cb.codigo,
  cb.nome,
  cb.tipo_movimento,
  cb.grupo,
  cb.subgrupo,
  cb.natureza,
  cb.impacta_fluxo_caixa,
  cb.impacta_dre,
  cb.impacta_resultado_operacional,
  cb.ordem
FROM empresas e
CROSS JOIN categorias_base cb
ON CONFLICT (empresa_id, codigo) DO NOTHING;


-- ============================================================
-- OBSERVACOES DE GOVERNANCA
-- ============================================================
-- 1. Categorias sao sempre por empresa_id. Codigo nao e global.
-- 2. Nao existe policy de DELETE. Inativar deve ser feito por ativo=false.
-- 3. Campos textuais antigos foram preservados para compatibilidade.
-- 4. FKs compostas impedem vinculo de CP/CR/movimento com categoria de outra empresa.
-- 5. Esta migration nao altera calculo, baixa, Fluxo, DRE, XML ou Banco de Precos.
-- 6. Nomenclatura aprovada:
--    - "Mão de Obra Direta — Funcionários em Obra" para custo direto em obra/projeto/cliente.
--    - "Salários — Equipe Interna" para equipe interna sem apontamento direto em obra.
--    - Evitar nomenclatura ambigua de salario como custo direto.
--
-- Rollback manual sugerido, se necessario em ambiente de revisao:
--
-- ALTER TABLE financeiro_movimentos_caixa DROP CONSTRAINT IF EXISTS fmc_categoria_gerencial_empresa_fk;
-- ALTER TABLE financeiro_contas_receber DROP CONSTRAINT IF EXISTS fcr_categoria_gerencial_empresa_fk;
-- ALTER TABLE financeiro_contas_pagar DROP CONSTRAINT IF EXISTS fcp_categoria_gerencial_empresa_fk;
-- DROP INDEX IF EXISTS idx_fmc_categoria_gerencial_id;
-- DROP INDEX IF EXISTS idx_fcr_categoria_gerencial_id;
-- DROP INDEX IF EXISTS idx_fcp_categoria_gerencial_id;
-- ALTER TABLE financeiro_movimentos_caixa DROP COLUMN IF EXISTS categoria_gerencial_id;
-- ALTER TABLE financeiro_contas_receber DROP COLUMN IF EXISTS categoria_gerencial_id;
-- ALTER TABLE financeiro_contas_pagar DROP COLUMN IF EXISTS categoria_gerencial_id;
-- DROP TABLE IF EXISTS financeiro_categorias_gerenciais;
--
-- FIM: 024_financeiro_categorias_gerenciais.sql

-- ============================================================
-- 018_financeiro_banco_precos.sql
-- Fase F do módulo Financeiro: Banco de Preços Reais.
--
-- Premissas:
--   • Funções auth_empresa_ids(), auth_usuario_id(), auth_perfil()
--     já existem (criadas em 001_rls_policies.sql).
--   • financeiro_nfs_fornecedor já existe (migration 017).
--     Esta tabela referencia aquela via nf_fornecedor_id.
--   • empresas(id) já existe como tabela referenciada.
--   • Nenhuma migration anterior é alterada.
--   • NÃO aplicar automaticamente — rodar manualmente no
--     SQL Editor do Supabase após revisão e backup.
--   • Aplicar APÓS a migration 017. Se 017 não foi aplicada,
--     esta migration falhará na criação da FK nf_fornecedor_id.
--
-- Propósito:
--   Armazenar o histórico de itens comprados extraídos de XMLs
--   de NF de fornecedor. Cada linha representa um item de uma
--   NF importada. Os dados são append-only (imutáveis após
--   inserção) e servem de base histórica de preços reais para
--   futura integração com a Fase Orçamentos do Comercial.
--
--   Deduplicidade por item: controlada pela deduplicidade da
--   NF âncora (idx_fnf_empresa_chave_acesso em 017). Se a NF
--   já existe, o import é bloqueado antes de inserir itens.
-- ============================================================


-- ============================================================
-- TABELA: financeiro_banco_precos
-- Histórico de itens comprados extraídos de XML de NF-e.
-- Um registro por item de nota. Append-only.
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_banco_precos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Vínculo com a NF âncora (migration 017)
  -- Permite JOIN completo com cabeçalho da NF sem repetir dados.
  nf_fornecedor_id    uuid REFERENCES financeiro_nfs_fornecedor(id),

  -- Campos redundantes da NF para queries sem JOIN
  -- (performance em listagens e filtros de período)
  chave_acesso        text,
  numero_nf           text,
  serie_nf            text,
  data_emissao        date,

  -- Fornecedor (redundante da NF âncora para queries isoladas)
  fornecedor_nome     text,
  fornecedor_cnpj     text,

  -- Item — dados extraídos do XML (tag <det><prod>)
  codigo_fornecedor   text,            -- cProd: código do produto no fornecedor
  descricao           text NOT NULL,   -- xProd: descrição do produto/serviço
  ncm                 text,            -- NCM: nomenclatura comum do Mercosul
  cfop                text,            -- CFOP: código fiscal da operação
  unidade             text,            -- uCom: unidade comercial (ex: UN, KG, M, CX)
  quantidade          numeric(14,4),   -- qCom: quantidade comercial
  valor_unitario      numeric(14,4),   -- vUnCom: valor unitário comercial
  valor_total         numeric(14,2),   -- vProd: valor total bruto do item
  desconto            numeric(14,2),   -- vDesc: valor de desconto, se houver

  -- Impostos extraídos do XML (JSON serializado no cliente).
  -- Formato sugerido: {"icms": 0.00, "ipi": 0.00, "pis": 0.00, "cofins": 0.00}
  -- Campo opcional — preenchido quando disponível no XML.
  impostos_json       text,

  -- Origem do dado — fixo 'xml_fornecedor' nesta fase.
  -- Reserva espaço para futuras origens (ex: 'manual', 'importacao_csv').
  origem              text NOT NULL DEFAULT 'xml_fornecedor',

  -- Auditoria — sem updated_at: registros são imutáveis (append-only).
  -- Para corrigir um item incorreto, inserir novo registro e
  -- marcar a NF âncora como 'cancelado' se necessário.
  created_by          uuid DEFAULT auth_usuario_id(),
  created_at          timestamptz NOT NULL DEFAULT now()
);


-- ── Índices ──────────────────────────────────────────────────

-- Lookup principal por empresa
CREATE INDEX IF NOT EXISTS idx_fbp_empresa_id
  ON financeiro_banco_precos (empresa_id);

-- Lookup por NF âncora (listar todos os itens de uma NF importada)
CREATE INDEX IF NOT EXISTS idx_fbp_nf_fornecedor_id
  ON financeiro_banco_precos (nf_fornecedor_id);

-- Busca por chave de acesso (listar itens sem JOIN com nfs_fornecedor)
CREATE INDEX IF NOT EXISTS idx_fbp_chave_acesso
  ON financeiro_banco_precos (chave_acesso);

-- Busca textual por descrição (futura integração com Comercial/Orçamentos)
-- Índice GIN para operações ILIKE / full-text no campo descrição.
CREATE INDEX IF NOT EXISTS idx_fbp_descricao
  ON financeiro_banco_precos USING gin (to_tsvector('portuguese', descricao));

-- Busca por NCM (consulta histórica por categoria fiscal)
CREATE INDEX IF NOT EXISTS idx_fbp_ncm
  ON financeiro_banco_precos (ncm);

-- Busca por CNPJ do fornecedor (histórico por fornecedor)
CREATE INDEX IF NOT EXISTS idx_fbp_fornecedor_cnpj
  ON financeiro_banco_precos (fornecedor_cnpj);

-- Busca por data de emissão (relatórios e filtros de período)
CREATE INDEX IF NOT EXISTS idx_fbp_data_emissao
  ON financeiro_banco_precos (data_emissao);

-- Busca combinada empresa + data (query mais comum em listagens)
CREATE INDEX IF NOT EXISTS idx_fbp_empresa_data
  ON financeiro_banco_precos (empresa_id, data_emissao);

-- Busca combinada empresa + fornecedor (histórico de compras por fornecedor)
CREATE INDEX IF NOT EXISTS idx_fbp_empresa_fornecedor
  ON financeiro_banco_precos (empresa_id, fornecedor_cnpj);


-- ── RLS ──────────────────────────────────────────────────────
-- Sem trigger updated_at: tabela é append-only.
ALTER TABLE financeiro_banco_precos ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os usuários da empresa podem visualizar
DROP POLICY IF EXISTS "fbp: ver da empresa" ON financeiro_banco_precos;
CREATE POLICY "fbp: ver da empresa"
  ON financeiro_banco_precos FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

-- INSERT: bloqueado para colaborador/prestador
DROP POLICY IF EXISTS "fbp: inserir na empresa" ON financeiro_banco_precos;
CREATE POLICY "fbp: inserir na empresa"
  ON financeiro_banco_precos FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- UPDATE: não permitido (registros imutáveis — histórico de preços é
-- append-only por design. Para corrigir, cancelar a NF âncora e
-- reimportar após correção).
-- Política não criada intencionalmente: ausência de policy = bloqueio.

-- DELETE: somente dono/gestor/admin
DROP POLICY IF EXISTS "fbp: deletar gestor+" ON financeiro_banco_precos;
CREATE POLICY "fbp: deletar gestor+"
  ON financeiro_banco_precos FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- FIM: 018_financeiro_banco_precos.sql
--
-- Ordem de aplicação obrigatória:
--   1. 017_financeiro_nfs_fornecedor.sql
--   2. 018_financeiro_banco_precos.sql  ← este arquivo
--
-- Após aplicar ambas, o sistema estará pronto para:
--   1. Importar XML de NF de fornecedor.
--   2. Gravar cabeçalho da NF em financeiro_nfs_fornecedor.
--   3. Gravar CPs em financeiro_contas_pagar (sem migration nova).
--   4. Gravar itens do XML em financeiro_banco_precos.
--   5. Futuro: consultar histórico de preços no Comercial/Orçamentos.
--
-- Integração futura com Comercial/Fase Orçamentos:
--   SELECT descricao, fornecedor_nome, unidade,
--          MIN(valor_unitario) AS menor_preco,
--          MAX(valor_unitario) AS maior_preco,
--          AVG(valor_unitario) AS media_preco,
--          MAX(data_emissao)   AS ultima_compra
--   FROM financeiro_banco_precos
--   WHERE empresa_id = $empresa_id
--     AND to_tsvector('portuguese', descricao) @@ plainto_tsquery('portuguese', $termo)
--   GROUP BY descricao, fornecedor_nome, unidade
--   ORDER BY ultima_compra DESC;
--
-- NÃO aplicar sem revisão. NÃO aplicar sem backup.
-- Rodar manualmente no SQL Editor do Supabase.
-- Aplicar SEMPRE após 017 — esta migration depende dela.
-- ============================================================

-- ============================================================
-- 017_financeiro_nfs_fornecedor.sql
-- Fase F do módulo Financeiro: Notas Fiscais de Fornecedores.
--
-- Premissas:
--   • Funções auth_empresa_ids(), auth_usuario_id(), auth_perfil()
--     já existem (criadas em 001_rls_policies.sql).
--   • Função financeiro_set_updated_at() já existe (007).
--   • empresas(id) já existe como tabela referenciada.
--   • Nenhuma migration anterior é alterada.
--   • NÃO aplicar automaticamente — rodar manualmente no
--     SQL Editor do Supabase após revisão e backup.
--   • Esta tabela é a âncora/cabeçalho de cada NF importada
--     por XML. As Contas a Pagar (financeiro_contas_pagar) e
--     os itens de preço (financeiro_banco_precos — migration 018)
--     referenciam esta tabela via nf_fornecedor_id.
-- ============================================================


-- ============================================================
-- TABELA: financeiro_nfs_fornecedor
-- Cabeçalho de cada NF de fornecedor importada por XML.
-- Registra os dados principais da nota e serve de âncora
-- para as Contas a Pagar geradas por duplicata e para os
-- itens gravados no Banco de Preços Reais (migration 018).
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_nfs_fornecedor (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Chave de acesso NF-e (44 dígitos) — única por empresa
  -- Usada como controle primário de duplicidade na importação.
  chave_acesso            text NOT NULL,

  -- Dados da NF
  numero_nf               text,
  serie                   text,
  data_emissao            date,
  natureza_operacao       text,

  -- Emitente (fornecedor que emitiu a nota)
  fornecedor_nome         text,
  fornecedor_cnpj         text,

  -- Destinatário (empresa compradora — deve bater com empresa_id)
  destinatario_nome       text,
  destinatario_cnpj       text,

  -- Totais financeiros extraídos do XML
  valor_total             numeric(14,2),

  -- Informações adicionais do XML (campo infAdic/infCpl)
  informacoes_adicionais  text,

  -- Metadados JSON extraídos do XML para auditoria e rastreabilidade.
  -- Armazena estrutura bruta: duplicatas, totais de impostos, chaves
  -- de referência, protocolo de autorização, etc.
  -- Formato: texto JSON serializado no cliente.
  xml_metadados_json      text,

  -- Status da importação
  -- Valores: 'importado' | 'vinculado' | 'cancelado'
  -- 'vinculado' = CPs e itens já foram gerados
  -- 'cancelado' = NF foi cancelada pela receita (uso futuro)
  status                  text NOT NULL DEFAULT 'importado',

  -- Auditoria
  created_by              uuid DEFAULT auth_usuario_id(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);


-- ── Índices ──────────────────────────────────────────────────

-- Lookup principal por empresa
CREATE INDEX IF NOT EXISTS idx_fnf_empresa_id
  ON financeiro_nfs_fornecedor (empresa_id);

-- Controle de duplicidade: chave de acesso é única por empresa.
-- Impede importar a mesma NF duas vezes na mesma empresa.
CREATE UNIQUE INDEX IF NOT EXISTS idx_fnf_empresa_chave_acesso
  ON financeiro_nfs_fornecedor (empresa_id, chave_acesso);

-- Busca por CNPJ do fornecedor (consultas históricas por fornecedor)
CREATE INDEX IF NOT EXISTS idx_fnf_fornecedor_cnpj
  ON financeiro_nfs_fornecedor (fornecedor_cnpj);

-- Busca por data de emissão (relatórios e filtros de período)
CREATE INDEX IF NOT EXISTS idx_fnf_data_emissao
  ON financeiro_nfs_fornecedor (data_emissao);

-- Filtro por status
CREATE INDEX IF NOT EXISTS idx_fnf_status
  ON financeiro_nfs_fornecedor (status);

-- Busca combinada empresa + data (query mais comum em listagens)
CREATE INDEX IF NOT EXISTS idx_fnf_empresa_data
  ON financeiro_nfs_fornecedor (empresa_id, data_emissao);


-- ── Trigger updated_at ───────────────────────────────────────
DROP TRIGGER IF EXISTS trg_fnf_updated_at ON financeiro_nfs_fornecedor;
CREATE TRIGGER trg_fnf_updated_at
  BEFORE UPDATE ON financeiro_nfs_fornecedor
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();


-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE financeiro_nfs_fornecedor ENABLE ROW LEVEL SECURITY;

-- SELECT: todos os usuários da empresa podem visualizar
DROP POLICY IF EXISTS "fnf: ver da empresa" ON financeiro_nfs_fornecedor;
CREATE POLICY "fnf: ver da empresa"
  ON financeiro_nfs_fornecedor FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

-- INSERT: bloqueado para colaborador/prestador
DROP POLICY IF EXISTS "fnf: inserir na empresa" ON financeiro_nfs_fornecedor;
CREATE POLICY "fnf: inserir na empresa"
  ON financeiro_nfs_fornecedor FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- UPDATE: bloqueado para colaborador/prestador
-- Permite atualizar status (ex: 'importado' → 'vinculado')
DROP POLICY IF EXISTS "fnf: atualizar na empresa" ON financeiro_nfs_fornecedor;
CREATE POLICY "fnf: atualizar na empresa"
  ON financeiro_nfs_fornecedor FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- DELETE: somente dono/gestor/admin
DROP POLICY IF EXISTS "fnf: deletar gestor+" ON financeiro_nfs_fornecedor;
CREATE POLICY "fnf: deletar gestor+"
  ON financeiro_nfs_fornecedor FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- FIM: 017_financeiro_nfs_fornecedor.sql
--
-- Após aplicar, o sistema estará pronto para:
--   1. Importar XML de NF de fornecedor com controle de
--      duplicidade por chave de acesso.
--   2. Vincular Contas a Pagar (financeiro_contas_pagar)
--      à NF âncora via referencia_id = chave_acesso.
--   3. Aplicar migration 018 para o Banco de Preços Reais
--      (financeiro_banco_precos), que referencia esta tabela
--      via nf_fornecedor_id.
--
-- NÃO aplicar sem revisão. NÃO aplicar sem backup.
-- Rodar manualmente no SQL Editor do Supabase.
-- ============================================================

-- ============================================================
-- 077_financeiro_fornecedores.sql
-- PR Fase B do roadmap Financeiro — cadastro de fornecedores.
--
-- Hoje o fornecedor é texto livre em financeiro_contas_pagar
-- (fornecedor_nome / fornecedor_cnpj), financeiro_nfs_fornecedor e
-- financeiro_banco_precos. Isso faz o mesmo fornecedor aparecer com
-- grafias diferentes e impede consolidar histórico por fornecedor.
--
-- Esta migration cria a entidade central financeiro_fornecedores e
-- adiciona fornecedor_id (FK opcional) às três tabelas que hoje
-- guardam fornecedor como texto. Os campos de texto NÃO são removidos:
-- continuam como fallback e para não quebrar dado existente. O vínculo
-- por id é preenchido pelo app dali em diante.
--
-- Idempotente (IF NOT EXISTS / DROP POLICY antes de CREATE POLICY).
-- NÃO aplicar automaticamente — rodar manualmente no SQL Editor do
-- Supabase após revisão.
-- ============================================================

-- ── Entidade fornecedor ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS financeiro_fornecedores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  cnpj          text,
  cpf           text,
  email         text,
  telefone      text,
  contato_nome  text,
  observacao    text,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Índice para carregar fornecedores da empresa.
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa
  ON financeiro_fornecedores (empresa_id);

-- Evita CNPJ duplicado dentro da mesma empresa (ignora nulos e vazios).
-- Índice parcial: só vale quando cnpj está preenchido.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fornecedor_empresa_cnpj
  ON financeiro_fornecedores (empresa_id, cnpj)
  WHERE cnpj IS NOT NULL AND cnpj <> '';

-- ── Vínculo opcional nas tabelas que hoje usam texto ─────────
ALTER TABLE financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid
    REFERENCES financeiro_fornecedores(id) ON DELETE SET NULL;

ALTER TABLE financeiro_nfs_fornecedor
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid
    REFERENCES financeiro_fornecedores(id) ON DELETE SET NULL;

ALTER TABLE financeiro_banco_precos
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid
    REFERENCES financeiro_fornecedores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cp_fornecedor_id
  ON financeiro_contas_pagar (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_nff_fornecedor_id
  ON financeiro_nfs_fornecedor (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_bp_fornecedor_id
  ON financeiro_banco_precos (fornecedor_id);

-- ── RLS: mesmo padrão das tabelas financeiras (021) ──────────
-- Ver: qualquer perfil da empresa. Escrever: todos menos
-- colaborador / prestador / leitura. Idempotente.
ALTER TABLE financeiro_fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ffor: ver da empresa" ON financeiro_fornecedores;
CREATE POLICY "ffor: ver da empresa"
  ON financeiro_fornecedores FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "ffor: inserir na empresa" ON financeiro_fornecedores;
CREATE POLICY "ffor: inserir na empresa"
  ON financeiro_fornecedores FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "ffor: atualizar na empresa" ON financeiro_fornecedores;
CREATE POLICY "ffor: atualizar na empresa"
  ON financeiro_fornecedores FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

DROP POLICY IF EXISTS "ffor: deletar na empresa" ON financeiro_fornecedores;
CREATE POLICY "ffor: deletar na empresa"
  ON financeiro_fornecedores FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );

-- ============================================================
-- FIM: 077_financeiro_fornecedores.sql
-- Aplicar manualmente no SQL Editor do Supabase.
-- ============================================================

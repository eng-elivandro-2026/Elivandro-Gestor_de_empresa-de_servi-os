-- ============================================================
-- 065_clientes_codigo_grupo.sql
-- ADITIVA sobre a tabela clientes (064) — que JÁ EXISTE no
-- Supabase. Não recria tabela nem policies.
--
-- 3 colunas novas:
--   codigo      — código sequencial do SOE (CLI-001, CLI-002...).
--                 GERADO NA APLICAÇÃO (padrão do projeto, sem
--                 trigger). Nullable no banco: registros migrados
--                 do cadastro antigo recebem código no backfill da
--                 1ª abertura do módulo; a obrigatoriedade para
--                 registros novos é garantida pela aplicação.
--   grupo       — grupo econômico/matriz (ex: "Grupo JDE").
--                 Nullable — nem todo cliente pertence a um grupo.
--   cnpj_matriz — CNPJ da matriz quando o cliente é filial.
--                 Texto livre alfanumérico (mesmo padrão do cnpj).
--
-- Unicidade do código POR EMPRESA (não global — cada empresa tem
-- seu próprio CLI-001), via índice único parcial.
--
-- Executar no SQL Editor do Supabase.
-- Depende de: 064_clientes.sql.
-- ============================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo      text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS grupo       text;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cnpj_matriz text;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_clientes_empresa_codigo
  ON clientes (empresa_id, codigo)
  WHERE codigo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_grupo ON clientes (empresa_id, grupo);

COMMENT ON COLUMN clientes.codigo      IS 'Código sequencial do SOE (CLI-001...), gerado na aplicação. Único por empresa (índice parcial). Nullable só para o backfill dos migrados — todo registro novo sai da aplicação com código.';
COMMENT ON COLUMN clientes.grupo       IS 'Grupo econômico/matriz (ex: Grupo JDE) — agrupa filiais com CNPJs diferentes sem mesclar cadastros.';
COMMENT ON COLUMN clientes.cnpj_matriz IS 'CNPJ da empresa matriz quando o cliente é filial. Texto livre alfanumérico, mesmo padrão da coluna cnpj.';

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='clientes'
--    AND column_name IN ('codigo','grupo','cnpj_matriz');   -- 3 linhas
-- SELECT indexname FROM pg_indexes WHERE tablename='clientes';
--   -- deve incluir uidx_clientes_empresa_codigo e idx_clientes_grupo

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- DROP INDEX IF EXISTS uidx_clientes_empresa_codigo;
-- DROP INDEX IF EXISTS idx_clientes_grupo;
-- ALTER TABLE clientes DROP COLUMN IF EXISTS codigo;
-- ALTER TABLE clientes DROP COLUMN IF EXISTS grupo;
-- ALTER TABLE clientes DROP COLUMN IF EXISTS cnpj_matriz;
-- ============================================================

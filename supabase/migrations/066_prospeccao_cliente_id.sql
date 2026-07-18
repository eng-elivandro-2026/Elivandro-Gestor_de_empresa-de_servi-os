-- ============================================================
-- 066_prospeccao_cliente_id.sql
-- ADITIVA sobre prospeccao_alvos (063) — ponte Prospecção → Clientes.
--
-- cliente_id: preenchido quando o lead é CONVERTIDO em cliente (ou
-- vinculado a um cliente já existente) pela Ficha do Lead. FK real
-- com ON DELETE SET NULL: excluir um cliente não quebra o lead —
-- ele apenas volta a ficar "sem cliente".
--
-- Executar no SQL Editor do Supabase.
-- Depende de: 063_prospeccao.sql e 064_clientes.sql.
-- ============================================================

ALTER TABLE prospeccao_alvos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_prospeccao_alvos_cliente
  ON prospeccao_alvos (cliente_id) WHERE cliente_id IS NOT NULL;

COMMENT ON COLUMN prospeccao_alvos.cliente_id IS 'Cliente gerado/vinculado a partir deste lead (conversão na Ficha do Lead). NULL = ainda não convertido.';

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='prospeccao_alvos' AND column_name='cliente_id';  -- 1 linha
-- SELECT indexname FROM pg_indexes WHERE tablename='prospeccao_alvos';
--   -- deve incluir idx_prospeccao_alvos_cliente

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- DROP INDEX IF EXISTS idx_prospeccao_alvos_cliente;
-- ALTER TABLE prospeccao_alvos DROP COLUMN IF EXISTS cliente_id;
-- ============================================================

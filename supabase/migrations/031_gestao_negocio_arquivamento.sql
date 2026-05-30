-- ============================================================
-- 031_gestao_negocio_arquivamento.sql
-- Adiciona suporte a arquivamento (soft-delete) na tabela gestao_negocio.
-- Permite multiplos documentos arquivados por empresa_id + proposta_id.
-- Garante no maximo 1 documento ativo (arquivado = false) por empresa_id + proposta_id.
-- ATENCAO: migration versionada, aplicar somente com autorizacao explicita.
-- ============================================================

-- 1. Adicionar campos de arquivamento
ALTER TABLE gestao_negocio
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_motivo text;

-- 2. Remover UNIQUE absoluto que impede multiplos registros por proposta.
--    Nome confirmado na migration 030: gestao_negocio_empresa_proposta_unique
ALTER TABLE gestao_negocio
  DROP CONSTRAINT IF EXISTS gestao_negocio_empresa_proposta_unique;

-- 3. Substituir por indice unico parcial: somente 1 documento ativo por empresa_id + proposta_id.
--    Documentos com arquivado = true ficam fora do indice e nao competem pela unicidade.
CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_negocio_ativo_por_proposta
  ON gestao_negocio (empresa_id, proposta_id)
  WHERE arquivado IS NOT TRUE;

-- 4. Indice auxiliar para consultas e ordenacao de documentos arquivados por proposta.
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_arquivado
  ON gestao_negocio (empresa_id, proposta_id, arquivado_em DESC)
  WHERE arquivado = true;

-- ============================================================
-- ROLLBACK (nao executar automaticamente — somente referencia)
-- ============================================================
-- DROP INDEX IF EXISTS idx_gestao_negocio_ativo_por_proposta;
-- DROP INDEX IF EXISTS idx_gestao_negocio_arquivado;
-- ALTER TABLE gestao_negocio
--   DROP COLUMN IF EXISTS arquivado,
--   DROP COLUMN IF EXISTS arquivado_em,
--   DROP COLUMN IF EXISTS arquivado_motivo;
-- ALTER TABLE gestao_negocio
--   ADD CONSTRAINT gestao_negocio_empresa_proposta_unique UNIQUE (empresa_id, proposta_id);
-- ============================================================

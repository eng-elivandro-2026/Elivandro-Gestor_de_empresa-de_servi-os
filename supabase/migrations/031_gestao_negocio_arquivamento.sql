-- ============================================================
-- 031_gestao_negocio_arquivamento.sql
-- Adiciona suporte a arquivamento (soft-delete) na tabela gestao_negocio.
-- Permite multiplos documentos arquivados por empresa_id + proposta_id.
-- Garante no maximo 1 documento ativo (arquivado = false) por empresa_id + proposta_id.
-- ATENCAO: migration versionada, aplicar somente com autorizacao explicita.
-- Estado real do banco em 2026-05-29 — sincronizado apos validacao via CLI.
-- ============================================================

-- 1. Adicionar campos de arquivamento
ALTER TABLE gestao_negocio
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_por uuid,
  ADD COLUMN IF NOT EXISTS arquivado_motivo text;

-- 2. Remover UNIQUE absoluto que impede multiplos registros por proposta.
--    Nome confirmado na migration 030: gestao_negocio_empresa_proposta_unique
ALTER TABLE gestao_negocio
  DROP CONSTRAINT IF EXISTS gestao_negocio_empresa_proposta_unique;

-- 3. Substituir por indice unico parcial: somente 1 documento ativo por empresa_id + proposta_id.
--    Documentos com arquivado = true ficam fora do indice e nao competem pela unicidade.
CREATE UNIQUE INDEX IF NOT EXISTS gestao_negocio_empresa_proposta_ativa_unique
  ON gestao_negocio (empresa_id, proposta_id)
  WHERE arquivado = false;

-- 4. Indice auxiliar para consultas por status de arquivamento.
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_arquivado
  ON gestao_negocio (arquivado);

-- ============================================================
-- ROLLBACK (nao executar automaticamente — somente referencia)
-- ============================================================
-- DROP INDEX IF EXISTS gestao_negocio_empresa_proposta_ativa_unique;
-- DROP INDEX IF EXISTS idx_gestao_negocio_arquivado;
-- ALTER TABLE gestao_negocio
--   DROP COLUMN IF EXISTS arquivado,
--   DROP COLUMN IF EXISTS arquivado_em,
--   DROP COLUMN IF EXISTS arquivado_por,
--   DROP COLUMN IF EXISTS arquivado_motivo;
-- ALTER TABLE gestao_negocio
--   ADD CONSTRAINT gestao_negocio_empresa_proposta_unique UNIQUE (empresa_id, proposta_id);
-- ============================================================

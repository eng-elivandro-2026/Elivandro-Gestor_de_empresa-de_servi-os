-- ============================================================
-- 053_identidade_versoes.sql
-- Versões da identidade estratégica (Missão/Visão/Valores) por empresa,
-- construídas pelo Assistente de Identidade guiado.
--
-- Camada de VERSIONAMENTO por baixo das tabelas de EXIBIÇÃO
-- (empresa_identidade / empresa_valores), que continuam sendo a
-- projeção da versão ATIVA. Não altera nem lê essas tabelas aqui.
--
-- Aditiva e idempotente (CREATE ... IF NOT EXISTS / DROP POLICY IF EXISTS).
-- RLS por empresa (auth_empresa_ids(), padrão das migrations 038/039).
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 001 (empresas + auth_empresa_ids()).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS empresa_identidade_versoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  versao        integer NOT NULL DEFAULT 1,
  titulo        text,
  status        text    NOT NULL DEFAULT 'inativo',

  -- Respostas guiadas do assistente (JSONB p/ evoluir sem migration).
  visao_guiada  jsonb   NOT NULL DEFAULT '{}'::jsonb,   -- PR-1 (etapa Visão)
  missao_guiada jsonb   NOT NULL DEFAULT '{}'::jsonb,   -- PR-1 (etapa Missão)
  valores_funil jsonb   NOT NULL DEFAULT '{}'::jsonb,   -- PR-2 (20/10/5 + vive/não-vive)

  -- Textos finais (etapa Resumo, PR-3) -> projetados p/ empresa_identidade.
  visao_final   text,
  missao_final  text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id),

  CONSTRAINT identidade_versoes_status_chk CHECK (status IN ('ativo','inativo'))
);

CREATE INDEX IF NOT EXISTS idx_identidade_versoes_empresa
  ON empresa_identidade_versoes (empresa_id);

-- Só UMA versão 'ativo' por empresa (índice único parcial).
CREATE UNIQUE INDEX IF NOT EXISTS uq_identidade_versoes_uma_ativa
  ON empresa_identidade_versoes (empresa_id)
  WHERE status = 'ativo';

-- Numeração de versão estável por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_identidade_versoes_empresa_versao
  ON empresa_identidade_versoes (empresa_id, versao);

-- ── RLS (mesmo idioma da 039: acesso total à própria empresa) ──
ALTER TABLE empresa_identidade_versoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "identidade_versoes_acesso_empresa" ON empresa_identidade_versoes;
CREATE POLICY "identidade_versoes_acesso_empresa"
  ON empresa_identidade_versoes FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (rodar separadamente)
-- ============================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'empresa_identidade_versoes' ORDER BY ordinal_position;
-- SELECT policyname, cmd FROM pg_policies WHERE tablename = 'empresa_identidade_versoes';

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS empresa_identidade_versoes;
-- COMMIT;
-- ============================================================

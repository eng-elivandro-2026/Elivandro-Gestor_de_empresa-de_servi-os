-- ============================================================
-- 052_planejamento_estrategico.sql
-- Módulo "Planejamento Estratégico" (exclusivo do perfil dono).
--
-- O QUE CRIA:
--   • planos_estrategicos — planos de uma empresa (tema, horizonte, status).
--   • plano_ferramentas   — ferramentas de análise (GUT, SWOT, BSC, 5W2H,
--     5 Porquês) em jsonb. plano_id NULL = ferramenta avulsa (Biblioteca);
--     plano_id preenchido = ferramenta dentro de um plano.
--
-- Migration estritamente ADITIVA (CREATE TABLE/INDEX IF NOT EXISTS) + RLS.
-- Não altera dados nem tabelas existentes.
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: auth_empresa_ids() (001_rls_policies.sql).
-- ============================================================

CREATE TABLE IF NOT EXISTS planos_estrategicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  titulo text NOT NULL,
  tema text,
  horizonte text,                    -- '15d' | '1m' | '6m' | '1a' | '2a' | '5a' | '10a'
  status text NOT NULL DEFAULT 'rascunho', -- 'rascunho' | 'ativo' | 'concluido' | 'cancelado'
  criado_por text,                   -- e-mail do usuário que criou
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plano_ferramentas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id uuid REFERENCES planos_estrategicos(id) ON DELETE CASCADE, -- NULL = ferramenta avulsa
  empresa_id uuid NOT NULL,
  tipo text NOT NULL,                -- 'gut' | 'swot' | 'bsc' | '5w2h' | '5porques'
  titulo text,
  dados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planos_estrategicos_empresa ON planos_estrategicos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_plano_ferramentas_empresa ON plano_ferramentas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_plano_ferramentas_plano ON plano_ferramentas(plano_id);

COMMENT ON TABLE planos_estrategicos IS 'Planos de planejamento estratégico por empresa (tema, horizonte, status)';
COMMENT ON TABLE plano_ferramentas IS 'Ferramentas de análise (GUT/SWOT/BSC/5W2H/5 Porquês) — avulsas (plano_id NULL) ou dentro de um plano';

-- ============================================================
-- RLS — isolamento multi-empresa (padrão do projeto: auth_empresa_ids())
-- ============================================================
ALTER TABLE planos_estrategicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_ferramentas   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa pode gerenciar planos" ON planos_estrategicos;
CREATE POLICY "empresa pode gerenciar planos" ON planos_estrategicos
  FOR ALL USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "empresa pode gerenciar ferramentas" ON plano_ferramentas;
CREATE POLICY "empresa pode gerenciar ferramentas" ON plano_ferramentas
  FOR ALL USING (empresa_id IN (SELECT auth_empresa_ids()));

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('planos_estrategicos','plano_ferramentas');
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('planos_estrategicos','plano_ferramentas');

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- DROP TABLE IF EXISTS plano_ferramentas;
-- DROP TABLE IF EXISTS planos_estrategicos;
-- ============================================================

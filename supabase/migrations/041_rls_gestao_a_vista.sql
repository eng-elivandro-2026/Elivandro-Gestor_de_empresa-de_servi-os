-- ============================================================
-- 041_rls_gestao_a_vista.sql
-- Row Level Security para as tabelas de Gestão à Vista
-- (criadas na 040_gestao_a_vista.sql): metas, meta_acoes,
-- meta_pdca, meta_radar.
--
-- ISOLAMENTO MULTI-EMPRESA (modelo N:N via usuario_empresas):
--   Usa a função auxiliar auth_empresa_ids() (definida na 001), mesmo padrão
--   das demais tabelas por empresa (ver 005, 021, 039). Acesso total (FOR ALL)
--   restrito à própria empresa, leitura e escrita.
--
-- Idempotente (DROP POLICY IF EXISTS antes de CREATE). Não altera dados.
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 040_gestao_a_vista.sql, auth_empresa_ids() (001).
-- ============================================================

BEGIN;

-- ── metas ──
ALTER TABLE metas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metas_acesso_empresa" ON metas;
CREATE POLICY "metas_acesso_empresa"
  ON metas FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- ── meta_acoes ──
ALTER TABLE meta_acoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meta_acoes_acesso_empresa" ON meta_acoes;
CREATE POLICY "meta_acoes_acesso_empresa"
  ON meta_acoes FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- ── meta_pdca ──
ALTER TABLE meta_pdca ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meta_pdca_acesso_empresa" ON meta_pdca;
CREATE POLICY "meta_pdca_acesso_empresa"
  ON meta_pdca FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- ── meta_radar ──
ALTER TABLE meta_radar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meta_radar_acesso_empresa" ON meta_radar;
CREATE POLICY "meta_radar_acesso_empresa"
  ON meta_radar FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('metas','meta_acoes','meta_pdca','meta_radar')
-- ORDER BY tablename, policyname;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "metas_acesso_empresa"      ON metas;
-- DROP POLICY IF EXISTS "meta_acoes_acesso_empresa" ON meta_acoes;
-- DROP POLICY IF EXISTS "meta_pdca_acesso_empresa"  ON meta_pdca;
-- DROP POLICY IF EXISTS "meta_radar_acesso_empresa" ON meta_radar;
-- ALTER TABLE metas      DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE meta_acoes DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE meta_pdca  DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE meta_radar DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- ============================================================

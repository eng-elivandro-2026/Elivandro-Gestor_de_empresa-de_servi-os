-- ============================================================
-- 044_rls_reuniao_radar.sql
-- Row Level Security para reuniao_radar e reuniao_radar_indicadores
-- (criadas na 043_reuniao_radar.sql).
--
-- ISOLAMENTO MULTI-EMPRESA (modelo N:N via usuario_empresas):
--   Usa a função auxiliar auth_empresa_ids() (definida na 001), mesmo padrão
--   das demais tabelas por empresa (ver 040/041). Acesso total (FOR ALL)
--   restrito à própria empresa, leitura e escrita.
--
-- Idempotente (DROP POLICY IF EXISTS antes de CREATE). Não altera dados.
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 043_reuniao_radar.sql, auth_empresa_ids() (001).
-- ============================================================

BEGIN;

-- ── reuniao_radar ──
ALTER TABLE reuniao_radar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reuniao_radar_acesso_empresa" ON reuniao_radar;
CREATE POLICY "reuniao_radar_acesso_empresa"
  ON reuniao_radar FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- ── reuniao_radar_indicadores ──
ALTER TABLE reuniao_radar_indicadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reuniao_radar_ind_acesso_empresa" ON reuniao_radar_indicadores;
CREATE POLICY "reuniao_radar_ind_acesso_empresa"
  ON reuniao_radar_indicadores FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('reuniao_radar','reuniao_radar_indicadores')
-- ORDER BY tablename, policyname;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "reuniao_radar_acesso_empresa"     ON reuniao_radar;
-- DROP POLICY IF EXISTS "reuniao_radar_ind_acesso_empresa" ON reuniao_radar_indicadores;
-- ALTER TABLE reuniao_radar              DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE reuniao_radar_indicadores  DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- ============================================================

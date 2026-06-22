-- ============================================================
-- 046_rls_reuniao_radar_assuntos.sql
-- Row Level Security para reuniao_radar_assuntos
-- (criada na 045_reuniao_radar_assuntos.sql).
--
-- ISOLAMENTO MULTI-EMPRESA (modelo N:N via usuario_empresas):
--   Usa a função auxiliar auth_empresa_ids() (definida na 001), mesmo padrão
--   das demais tabelas por empresa (ver 044). Acesso total (FOR ALL)
--   restrito à própria empresa, leitura e escrita.
--
-- Idempotente (DROP POLICY IF EXISTS antes de CREATE). Não altera dados.
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 045_reuniao_radar_assuntos.sql, auth_empresa_ids() (001).
-- ============================================================

BEGIN;

-- ── reuniao_radar_assuntos ──
ALTER TABLE reuniao_radar_assuntos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reuniao_radar_assuntos_acesso_empresa" ON reuniao_radar_assuntos;
CREATE POLICY "reuniao_radar_assuntos_acesso_empresa"
  ON reuniao_radar_assuntos FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename = 'reuniao_radar_assuntos'
-- ORDER BY policyname;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "reuniao_radar_assuntos_acesso_empresa" ON reuniao_radar_assuntos;
-- ALTER TABLE reuniao_radar_assuntos DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- ============================================================

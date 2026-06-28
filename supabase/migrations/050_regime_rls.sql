-- ============================================================
-- 050_regime_rls.sql
-- Row Level Security para regime_colaborador e feriados_empresa (criadas na 049).
--
-- ISOLAMENTO MULTI-EMPRESA (modelo N:N via usuario_empresas):
--   Usa a função auxiliar auth_empresa_ids() (definida na 001_rls_policies.sql),
--   mesmo padrão das demais tabelas por empresa (ver 041/044). Acesso total
--   (FOR ALL) restrito às empresas do usuário autenticado.
--
-- Idempotente (DROP POLICY IF EXISTS antes de CREATE). Não altera dados.
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 049_regime_colaborador.sql, auth_empresa_ids() (001).
-- ============================================================

ALTER TABLE regime_colaborador ENABLE ROW LEVEL SECURITY;
ALTER TABLE feriados_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "empresa pode gerenciar regime" ON regime_colaborador;
CREATE POLICY "empresa pode gerenciar regime" ON regime_colaborador
  FOR ALL USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "empresa pode gerenciar feriados" ON feriados_empresa;
CREATE POLICY "empresa pode gerenciar feriados" ON feriados_empresa
  FOR ALL USING (empresa_id IN (SELECT auth_empresa_ids()));

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT tablename, policyname, cmd FROM pg_policies
-- WHERE tablename IN ('regime_colaborador','feriados_empresa');

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- DROP POLICY IF EXISTS "empresa pode gerenciar regime"   ON regime_colaborador;
-- DROP POLICY IF EXISTS "empresa pode gerenciar feriados" ON feriados_empresa;
-- ALTER TABLE regime_colaborador DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE feriados_empresa   DISABLE ROW LEVEL SECURITY;
-- ============================================================

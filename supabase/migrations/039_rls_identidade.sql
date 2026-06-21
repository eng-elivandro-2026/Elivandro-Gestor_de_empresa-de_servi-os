-- ============================================================
-- 039_rls_identidade.sql
-- Row Level Security para empresa_identidade e empresa_valores
-- (criadas na 038_empresa_identidade.sql).
--
-- ISOLAMENTO MULTI-EMPRESA (modelo N:N via usuario_empresas):
--   Usa a função auxiliar auth_empresa_ids() (definida na 001), que já
--   encapsula o JOIN usuario_empresas + usuarios com (ativo = true e
--   auth_id = auth.uid()). É o mesmo padrão das demais tabelas por
--   empresa (ver 005, 021). Equivale a:
--     empresa_id IN (
--       SELECT ue.empresa_id FROM usuario_empresas ue
--       JOIN usuarios u ON u.id = ue.usuario_id
--       WHERE u.auth_id = auth.uid() AND ue.ativo = true
--     )
--
-- POLÍTICA DE ACESSO:
--   Qualquer usuário ativo da empresa pode LER e GRAVAR (FOR ALL) os
--   dados da PRÓPRIA empresa. A restrição de EDIÇÃO a dono/admin é
--   aplicada na UI via window.podeAcao('dashboard-minha-empresa','editar').
--   (Caso queira defesa-em-profundidade no banco, ver bloco OPCIONAL
--    comentado no fim deste arquivo.)
--
-- Idempotente (DROP POLICY IF EXISTS antes de CREATE).
-- Não altera dados. Aplicar somente com autorização explícita.
--
-- Depende de: 038_empresa_identidade.sql, auth_empresa_ids() (001).
-- ============================================================

BEGIN;

-- ── empresa_identidade ──
ALTER TABLE empresa_identidade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "identidade_acesso_empresa" ON empresa_identidade;
CREATE POLICY "identidade_acesso_empresa"
  ON empresa_identidade FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- ── empresa_valores ──
ALTER TABLE empresa_valores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "valores_acesso_empresa" ON empresa_valores;
CREATE POLICY "valores_acesso_empresa"
  ON empresa_valores FOR ALL
  USING      (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('empresa_identidade','empresa_valores')
-- ORDER BY tablename, policyname;

-- ============================================================
-- OPCIONAL — defesa-em-profundidade (restringir ESCRITA a dono/admin)
-- Só aplicar se quiser barrar edição também no banco, não só na UI.
-- Substitui a policy FOR ALL por: SELECT liberado p/ a empresa +
-- INSERT/UPDATE/DELETE apenas para perfil global dono/admin.
-- OBS: auth_perfil() usa usuarios.perfil (GLOBAL), não perfil_empresa.
-- ============================================================
-- BEGIN;
--   DROP POLICY IF EXISTS "identidade_acesso_empresa" ON empresa_identidade;
--   CREATE POLICY "identidade: ver da empresa" ON empresa_identidade
--     FOR SELECT USING (empresa_id IN (SELECT auth_empresa_ids()));
--   CREATE POLICY "identidade: gravar dono/admin" ON empresa_identidade
--     FOR ALL
--     USING      (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'))
--     WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
--
--   DROP POLICY IF EXISTS "valores_acesso_empresa" ON empresa_valores;
--   CREATE POLICY "valores: ver da empresa" ON empresa_valores
--     FOR SELECT USING (empresa_id IN (SELECT auth_empresa_ids()));
--   CREATE POLICY "valores: gravar dono/admin" ON empresa_valores
--     FOR ALL
--     USING      (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'))
--     WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
-- COMMIT;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "identidade_acesso_empresa" ON empresa_identidade;
-- DROP POLICY IF EXISTS "valores_acesso_empresa"    ON empresa_valores;
-- ALTER TABLE empresa_identidade DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE empresa_valores    DISABLE ROW LEVEL SECURITY;
-- COMMIT;
-- ============================================================

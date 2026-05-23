-- ============================================================
-- 013_delete_policies_hardening.sql
-- Sprint 3 — DELETE Policies Hardening (Auditoria A2)
--
-- CONTEXTO:
--   11 tabelas com RLS habilitada não possuem nenhuma policy
--   DELETE. Sem essa policy, deletes são bloqueados por padrão
--   (Supabase nega se não há policy permissiva), mas a ausência
--   cria inconsistência: o frontend precisa de workarounds para
--   deletar registros legítimos e futuros bugs podem abrir
--   brechas. Esta migration fecha o gap de forma controlada.
--
-- TABELAS COBERTAS:
--   usuarios, empresas, usuario_empresas, configuracoes,
--   colaboradores, boletins, rh_documentos, rh_saude,
--   rh_epis, rh_despesas, apontamentos_historico
--
-- PADRÃO:
--   - Tabelas com empresa_id direto: gestor+ AND empresa_id IN (auth_empresa_ids())
--   - Tabelas sem empresa_id (usuarios, colaboradores): gestor+ via JOIN
--   - empresas: dono apenas (operação destrutiva irreversível)
--   - apontamentos_historico: gestor+ via apontamentos JOIN (tabela de auditoria)
--
-- EXECUÇÃO:
--   Rodar no SQL Editor do Supabase.
--   Não requer deploy de frontend.
--
-- ROLLBACK: ver seção no final do arquivo.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- usuarios
-- Isolamento via usuario_empresas (sem empresa_id direto)
-- Perfil mínimo: dono/admin (dados de autenticação — alto risco)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "usuarios: dono/admin deletam"
  ON usuarios FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'admin')
    AND id IN (
      SELECT ue.usuario_id FROM usuario_empresas ue
      WHERE ue.empresa_id IN (SELECT auth_empresa_ids())
        AND ue.ativo = true
    )
  );

-- ────────────────────────────────────────────────────────────
-- empresas
-- Perfil mínimo: dono apenas (operação irreversível)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "empresas: dono deleta"
  ON empresas FOR DELETE
  USING (
    id IN (SELECT auth_empresa_ids())
    AND auth_perfil() = 'dono'
  );

-- ────────────────────────────────────────────────────────────
-- usuario_empresas
-- Perfil mínimo: dono/admin
-- ────────────────────────────────────────────────────────────
CREATE POLICY "usuario_empresas: dono/admin deletam"
  ON usuario_empresas FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- ────────────────────────────────────────────────────────────
-- configuracoes
-- Escopo: chaves empresa-scopadas da empresa ativa
--         ou chaves globais da whitelist
-- Perfil mínimo: gestor+
-- ────────────────────────────────────────────────────────────
CREATE POLICY "configuracoes: deletar gestor+"
  ON configuracoes FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND (
      (empresa_id IS NOT NULL AND empresa_id IN (SELECT auth_empresa_ids()))
      OR
      (empresa_id IS NULL AND chave IN ('tf_schema_version', 'tf_app_config'))
    )
  );

-- ────────────────────────────────────────────────────────────
-- colaboradores
-- Isolamento via colaborador_empresas (sem empresa_id direto)
-- Perfil mínimo: gestor+
-- ────────────────────────────────────────────────────────────
CREATE POLICY "colaboradores: gestor+ deleta"
  ON colaboradores FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

-- ────────────────────────────────────────────────────────────
-- boletins
-- Perfil mínimo: gestor+
-- ────────────────────────────────────────────────────────────
CREATE POLICY "boletins: gestor+ deleta"
  ON boletins FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- ────────────────────────────────────────────────────────────
-- rh_documentos
-- Isolamento via colaborador_empresas
-- Perfil mínimo: gestor+
-- ────────────────────────────────────────────────────────────
CREATE POLICY "rh_documentos: gestor+ deleta"
  ON rh_documentos FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

-- ────────────────────────────────────────────────────────────
-- rh_saude
-- Isolamento via colaborador_empresas
-- Perfil mínimo: gestor+
-- ────────────────────────────────────────────────────────────
CREATE POLICY "rh_saude: gestor+ deleta"
  ON rh_saude FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

-- ────────────────────────────────────────────────────────────
-- rh_epis
-- Isolamento via colaborador_empresas
-- Perfil mínimo: gestor+
-- ────────────────────────────────────────────────────────────
CREATE POLICY "rh_epis: gestor+ deleta"
  ON rh_epis FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

-- ────────────────────────────────────────────────────────────
-- rh_despesas
-- Perfil mínimo: gestor+
-- ────────────────────────────────────────────────────────────
CREATE POLICY "rh_despesas: gestor+ deleta"
  ON rh_despesas FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- ────────────────────────────────────────────────────────────
-- apontamentos_historico
-- Tabela de auditoria — isolamento via apontamentos JOIN
-- Perfil mínimo: gestor+ (tabela sensível)
-- ────────────────────────────────────────────────────────────
CREATE POLICY "apontamentos_historico: gestor+ deleta"
  ON apontamentos_historico FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND apontamento_id IN (
      SELECT id FROM apontamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );

COMMIT;

-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRATION (executar separadamente)
-- ============================================================

-- 1. Confirmar 11 novas policies DELETE:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE cmd = 'DELETE'
--   AND tablename IN (
--     'usuarios','empresas','usuario_empresas','configuracoes',
--     'colaboradores','boletins','rh_documentos','rh_saude',
--     'rh_epis','rh_despesas','apontamentos_historico'
--   )
-- ORDER BY tablename;
-- Esperado: 11 linhas, uma por tabela.

-- 2. Confirmar que todas as tabelas RLS têm pelo menos uma policy DELETE:
-- SELECT tablename
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND rowsecurity = true
--   AND tablename NOT IN (
--     SELECT DISTINCT tablename FROM pg_policies WHERE cmd = 'DELETE'
--   )
-- ORDER BY tablename;
-- Esperado: 0 linhas (nenhuma tabela sem DELETE).

-- ============================================================
-- ROLLBACK COMPLETO
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "usuarios: dono/admin deletam"         ON usuarios;
-- DROP POLICY IF EXISTS "empresas: dono deleta"                ON empresas;
-- DROP POLICY IF EXISTS "usuario_empresas: dono/admin deletam" ON usuario_empresas;
-- DROP POLICY IF EXISTS "configuracoes: deletar gestor+"       ON configuracoes;
-- DROP POLICY IF EXISTS "colaboradores: gestor+ deleta"        ON colaboradores;
-- DROP POLICY IF EXISTS "boletins: gestor+ deleta"             ON boletins;
-- DROP POLICY IF EXISTS "rh_documentos: gestor+ deleta"        ON rh_documentos;
-- DROP POLICY IF EXISTS "rh_saude: gestor+ deleta"             ON rh_saude;
-- DROP POLICY IF EXISTS "rh_epis: gestor+ deleta"              ON rh_epis;
-- DROP POLICY IF EXISTS "rh_despesas: gestor+ deleta"          ON rh_despesas;
-- DROP POLICY IF EXISTS "apontamentos_historico: gestor+ deleta" ON apontamentos_historico;
-- COMMIT;

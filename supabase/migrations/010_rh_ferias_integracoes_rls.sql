-- ============================================================
-- 010_rh_ferias_integracoes_rls.sql
-- Habilita RLS e policies de isolamento multiempresa para
-- rh_ferias e rh_integracoes.
--
-- CONTEXTO:
--   Auditoria A1-002 identificou que estas duas tabelas foram
--   criadas sem ALTER TABLE … ENABLE ROW LEVEL SECURITY e sem
--   nenhuma policy. Qualquer usuário autenticado conseguia
--   ler, inserir, atualizar e deletar registros de qualquer
--   empresa diretamente via API.
--
-- PADRÃO ADOTADO:
--   Idêntico a rh_despesas (migration 001):
--     empresa_id IN (SELECT auth_empresa_ids())
--   Perfil mínimo para escrita: dono | gestor | admin
--
-- EXECUÇÃO:
--   Rodar no SQL Editor do Supabase.
--   Não requer deploy de frontend — as mudanças são apenas
--   no banco de dados.
--
-- ROLLBACK: ver seção no final do arquivo.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- TABELA: rh_ferias
-- Registros de férias CLT por colaborador / empresa.
-- Coluna empresa_id já existe no schema e é preenchida pelo
-- frontend em salvarFerias().
-- ────────────────────────────────────────────────────────────

ALTER TABLE rh_ferias ENABLE ROW LEVEL SECURITY;

-- Leitura: gestor+ vê registros da própria empresa
CREATE POLICY "rh_ferias: gestor+ ve empresa"
  ON rh_ferias FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Inserção: gestor+ insere apenas para empresa autorizada
CREATE POLICY "rh_ferias: gestor+ insere"
  ON rh_ferias FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Atualização: gestor+ atualiza apenas registros da empresa
CREATE POLICY "rh_ferias: gestor+ atualiza"
  ON rh_ferias FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Exclusão: gestor+ deleta apenas registros da empresa
CREATE POLICY "rh_ferias: gestor+ deleta"
  ON rh_ferias FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );


-- ────────────────────────────────────────────────────────────
-- TABELA: rh_integracoes
-- Registros de integração de colaboradores em clientes.
-- Coluna empresa_id já existe no schema e é preenchida pelo
-- frontend em salvarIntegracao().
-- ────────────────────────────────────────────────────────────

ALTER TABLE rh_integracoes ENABLE ROW LEVEL SECURITY;

-- Leitura: gestor+ vê registros da própria empresa
CREATE POLICY "rh_integracoes: gestor+ ve empresa"
  ON rh_integracoes FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Inserção: gestor+ insere apenas para empresa autorizada
CREATE POLICY "rh_integracoes: gestor+ insere"
  ON rh_integracoes FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Atualização: gestor+ atualiza apenas registros da empresa
CREATE POLICY "rh_integracoes: gestor+ atualiza"
  ON rh_integracoes FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Exclusão: gestor+ deleta apenas registros da empresa
CREATE POLICY "rh_integracoes: gestor+ deleta"
  ON rh_integracoes FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

COMMIT;

-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRATION (executar separadamente)
-- ============================================================

-- 1. Confirmar RLS habilitada nas duas tabelas:
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('rh_ferias','rh_integracoes')
--   AND schemaname = 'public';
-- Resultado esperado: rowsecurity = true para ambas.

-- 2. Confirmar 4 policies em cada tabela:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('rh_ferias','rh_integracoes')
-- ORDER BY tablename, cmd;
-- Resultado esperado: 8 linhas (4 por tabela: DELETE, INSERT, SELECT, UPDATE).

-- 3. Smoke test (como gestor da empresa A):
--   SELECT COUNT(*) FROM rh_ferias;          -- deve retornar só da empresa A
--   SELECT COUNT(*) FROM rh_integracoes;      -- idem

-- ============================================================
-- ROLLBACK COMPLETO
-- ============================================================
-- Executar APENAS se necessário reverter. Não executar como parte da migration.
-- ============================================================

-- BEGIN;
--
-- DROP POLICY IF EXISTS "rh_ferias: gestor+ ve empresa"   ON rh_ferias;
-- DROP POLICY IF EXISTS "rh_ferias: gestor+ insere"       ON rh_ferias;
-- DROP POLICY IF EXISTS "rh_ferias: gestor+ atualiza"     ON rh_ferias;
-- DROP POLICY IF EXISTS "rh_ferias: gestor+ deleta"       ON rh_ferias;
-- ALTER TABLE rh_ferias DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "rh_integracoes: gestor+ ve empresa"   ON rh_integracoes;
-- DROP POLICY IF EXISTS "rh_integracoes: gestor+ insere"       ON rh_integracoes;
-- DROP POLICY IF EXISTS "rh_integracoes: gestor+ atualiza"     ON rh_integracoes;
-- DROP POLICY IF EXISTS "rh_integracoes: gestor+ deleta"       ON rh_integracoes;
-- ALTER TABLE rh_integracoes DISABLE ROW LEVEL SECURITY;
--
-- COMMIT;

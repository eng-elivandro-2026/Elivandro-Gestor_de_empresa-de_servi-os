-- ============================================================
-- 015_user_isolation_final.sql
-- Sprint 7 — Fechamento das ressalvas finais User Isolation (Auditoria A2)
--
-- ESTADO DO BANCO (verificado em 2026-05-24):
--
-- P2-A: propostas SELECT sem check de perfil
--   "propostas_por_empresa: ver" (migration 012) usa empresa_id
--   sem filtrar por perfil → colaborador/prestador lê propostas
--   comerciais via API REST direta.
--
-- P2-B: rh_documentos / rh_saude / rh_epis INSERT/UPDATE
--   sem empresa_id scope → gestor da empresa A pode escrever
--   registros vinculados a colaborador_id da empresa B se souber
--   o UUID (cross-company write).
--
-- AÇÃO:
--   Bloco 1: propostas SELECT — adicionar perfil check.
--     Mantém "propostas: inserir na empresa" (INSERT, migration 011).
--     Mantém "propostas: atualizar na empresa" (UPDATE, migration 014).
--     Mantém "propostas: deletar gestor+" (DELETE, migration 014).
--
--   Bloco 2: rh_documentos INSERT/UPDATE — adicionar scope por
--     colaborador vinculado à empresa do usuário.
--
--   Bloco 3: rh_saude INSERT/UPDATE — idem.
--
--   Bloco 4: rh_epis INSERT/UPDATE — idem.
--
-- IDEMPOTÊNCIA:
--   DROP POLICY IF EXISTS antes de cada CREATE POLICY.
--
-- NÃO ALTERA:
--   - DRE, cálculos financeiros, lógica de negócio.
--   - Financeiro (migrations 007/008/014).
--   - Configuracoes (migration 009).
--   - DELETE policies (migration 013).
--   - SELECT policies de rh_* (corretas — empresa via colaborador_empresas).
--
-- EXECUÇÃO:
--   Rodar no SQL Editor do Supabase.
--   Não requer deploy de frontend.
--
-- ROLLBACK: ver seção no final do arquivo.
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- BLOCO 1: propostas SELECT — adicionar check de perfil
-- ════════════════════════════════════════════════════════════
-- Antes: empresa_id IN (SELECT auth_empresa_ids()) — sem perfil
-- Depois: + auth_perfil() NOT IN ('colaborador', 'prestador')
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "propostas_por_empresa: ver" ON propostas;

CREATE POLICY "propostas_por_empresa: ver"
  ON propostas FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );


-- ════════════════════════════════════════════════════════════
-- BLOCO 2: rh_documentos INSERT/UPDATE — adicionar scope empresa
-- ════════════════════════════════════════════════════════════
-- Antes: apenas auth_perfil() IN ('dono', 'gestor', 'admin')
-- Depois: + colaborador_id pertence a empresa do usuário
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rh_documentos: gestor+ escreve" ON rh_documentos;

CREATE POLICY "rh_documentos: gestor+ escreve"
  ON rh_documentos FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

DROP POLICY IF EXISTS "rh_documentos: gestor+ atualiza" ON rh_documentos;

CREATE POLICY "rh_documentos: gestor+ atualiza"
  ON rh_documentos FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );


-- ════════════════════════════════════════════════════════════
-- BLOCO 3: rh_saude INSERT/UPDATE — adicionar scope empresa
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "rh_saude: gestor+ escreve" ON rh_saude;

CREATE POLICY "rh_saude: gestor+ escreve"
  ON rh_saude FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

DROP POLICY IF EXISTS "rh_saude: gestor+ atualiza" ON rh_saude;

CREATE POLICY "rh_saude: gestor+ atualiza"
  ON rh_saude FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );


-- ════════════════════════════════════════════════════════════
-- BLOCO 4: rh_epis INSERT/UPDATE — adicionar scope empresa
-- ════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "rh_epis: gestor+ escreve" ON rh_epis;

CREATE POLICY "rh_epis: gestor+ escreve"
  ON rh_epis FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

DROP POLICY IF EXISTS "rh_epis: gestor+ atualiza" ON rh_epis;

CREATE POLICY "rh_epis: gestor+ atualiza"
  ON rh_epis FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

COMMIT;


-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRATION (executar separadamente)
-- ============================================================

-- 1. Propostas SELECT com perfil check:
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'propostas' AND cmd = 'SELECT';
-- Esperado: "propostas_por_empresa: ver" com auth_perfil() NOT IN (...)

-- 2. rh_documentos/saude/epis policies atualizadas (esperado: 6 linhas):
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('rh_documentos', 'rh_saude', 'rh_epis')
--   AND cmd IN ('INSERT', 'UPDATE')
-- ORDER BY tablename, cmd;
-- Esperado: 2 linhas por tabela (INSERT + UPDATE), todas com colaborador_id IN scope.

-- 3. Estado limpo final propostas (esperado: 4 linhas):
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'propostas'
-- ORDER BY cmd, policyname;
-- Esperado exato:
--   propostas: deletar gestor+          | DELETE
--   propostas: inserir na empresa       | INSERT
--   propostas_por_empresa: ver          | SELECT
--   propostas: atualizar na empresa     | UPDATE


-- ============================================================
-- ROLLBACK COMPLETO
-- ============================================================
-- BEGIN;
--
-- -- Reverter propostas SELECT (remover check de perfil)
-- DROP POLICY IF EXISTS "propostas_por_empresa: ver" ON propostas;
-- CREATE POLICY "propostas_por_empresa: ver"
--   ON propostas FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
--
-- -- Reverter rh_documentos INSERT/UPDATE (remover scope empresa)
-- DROP POLICY IF EXISTS "rh_documentos: gestor+ escreve"  ON rh_documentos;
-- DROP POLICY IF EXISTS "rh_documentos: gestor+ atualiza" ON rh_documentos;
-- CREATE POLICY "rh_documentos: gestor+ escreve"
--   ON rh_documentos FOR INSERT
--   WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));
-- CREATE POLICY "rh_documentos: gestor+ atualiza"
--   ON rh_documentos FOR UPDATE
--   USING (auth_perfil() IN ('dono', 'gestor', 'admin'));
--
-- -- Reverter rh_saude INSERT/UPDATE
-- DROP POLICY IF EXISTS "rh_saude: gestor+ escreve"  ON rh_saude;
-- DROP POLICY IF EXISTS "rh_saude: gestor+ atualiza" ON rh_saude;
-- CREATE POLICY "rh_saude: gestor+ escreve"
--   ON rh_saude FOR INSERT
--   WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));
-- CREATE POLICY "rh_saude: gestor+ atualiza"
--   ON rh_saude FOR UPDATE
--   USING (auth_perfil() IN ('dono', 'gestor', 'admin'));
--
-- -- Reverter rh_epis INSERT/UPDATE
-- DROP POLICY IF EXISTS "rh_epis: gestor+ escreve"  ON rh_epis;
-- DROP POLICY IF EXISTS "rh_epis: gestor+ atualiza" ON rh_epis;
-- CREATE POLICY "rh_epis: gestor+ escreve"
--   ON rh_epis FOR INSERT
--   WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));
-- CREATE POLICY "rh_epis: gestor+ atualiza"
--   ON rh_epis FOR UPDATE
--   USING (auth_perfil() IN ('dono', 'gestor', 'admin'));
--
-- COMMIT;

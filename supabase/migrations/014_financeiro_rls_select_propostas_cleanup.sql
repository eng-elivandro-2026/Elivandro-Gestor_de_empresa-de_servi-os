-- ============================================================
-- 014_financeiro_rls_select_propostas_cleanup.sql
-- Sprint 5 — Financeiro RLS SELECT + Propostas cleanup completo
--             (Auditoria A2)
--
-- ESTADO REAL DO BANCO (verificado em 2026-05-23):
--   Propostas tem 16 policies ativas:
--   DELETE (5): 4 legadas (user_id, sem perfil) + propostas_por_empresa: deletar
--   UPDATE (5): 4 legadas (user_id, sem perfil) + propostas_por_empresa: atualizar
--   SELECT (5): 4 legadas (user_id) + propostas_por_empresa: ver
--   INSERT (1): propostas: inserir na empresa (correto — migration 011)
--
--   As policies "propostas: atualizar na empresa" e
--   "propostas: deletar gestor+" de 001 NÃO existem no banco.
--
-- CONTEXTO:
--   GAP 1 — Financeiro SELECT sem perfil (6 tabelas):
--     SELECT policies de financeiro_* usam apenas empresa_id sem
--     check de perfil → colaborador/prestador lê dados financeiros
--     diretamente via API REST, bypassando o guard de frontend.
--
--   GAP 2 — Propostas UPDATE/DELETE permissivos (legados + 012):
--     9 policies UPDATE/DELETE sem check de perfil adequado
--     coexistem, permitindo que colaborador/prestador atualize
--     e delete propostas via API direta. Como policies PERMISSIVE
--     são OR'd, qualquer uma permissiva anula as restritivas.
--
-- AÇÃO:
--   Bloco 1–6: Financeiro SELECT — adicionar perfil check.
--   Bloco 7:   Propostas SELECT — dropar 4 legadas (user_id).
--              Mantém "propostas_por_empresa: ver" (correta).
--   Bloco 8:   Propostas UPDATE — dropar todas 5 policies,
--              criar 1 correta com check de perfil.
--   Bloco 9:   Propostas DELETE — dropar todas 5 policies,
--              criar 1 correta restrita a gestor+.
--
-- IDEMPOTÊNCIA:
--   DROP POLICY IF EXISTS antes de cada CREATE POLICY.
--
-- NÃO ALTERA:
--   - Lógica de negócio, DRE ou cálculos financeiros.
--   - "propostas_por_empresa: ver" (SELECT correto — mantido).
--   - "propostas: inserir na empresa" (INSERT correto — mantido).
--   - Configurações, DataGuard, RH ou Relacionamento.
--
-- EXECUÇÃO:
--   Rodar no SQL Editor do Supabase.
--   Não requer deploy de frontend.
--
-- ROLLBACK: ver seção no final do arquivo.
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- PARTE A — FINANCEIRO SELECT: adicionar perfil check
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- BLOCO 1: financeiro_contas_receber
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fcr: ver da empresa" ON financeiro_contas_receber;
CREATE POLICY "fcr: ver da empresa"
  ON financeiro_contas_receber FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 2: financeiro_notas_fiscais
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fnf: ver da empresa" ON financeiro_notas_fiscais;
CREATE POLICY "fnf: ver da empresa"
  ON financeiro_notas_fiscais FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 3: financeiro_recebimentos
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "frec: ver da empresa" ON financeiro_recebimentos;
CREATE POLICY "frec: ver da empresa"
  ON financeiro_recebimentos FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 4: financeiro_movimentos_caixa
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fmc: ver da empresa" ON financeiro_movimentos_caixa;
CREATE POLICY "fmc: ver da empresa"
  ON financeiro_movimentos_caixa FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 5: financeiro_saldos_caixa
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fsc: ver da empresa" ON financeiro_saldos_caixa;
CREATE POLICY "fsc: ver da empresa"
  ON financeiro_saldos_caixa FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 6: financeiro_contas_pagar
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fcp: ver da empresa" ON financeiro_contas_pagar;
CREATE POLICY "fcp: ver da empresa"
  ON financeiro_contas_pagar FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );


-- ════════════════════════════════════════════════════════════
-- PARTE B — PROPOSTAS: cleanup completo baseado no estado real
-- ════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────
-- BLOCO 7: Propostas SELECT — dropar 4 legadas (user_id)
--   "propostas_por_empresa: ver" (012) é mantida — está correta.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Master vê todas propostas"              ON propostas;
DROP POLICY IF EXISTS "Mestre vê tudo"                         ON propostas;
DROP POLICY IF EXISTS "Usuários veem suas próprias propostas"  ON propostas;
DROP POLICY IF EXISTS "Ver próprias propostas"                 ON propostas;

-- ────────────────────────────────────────────────────────────
-- BLOCO 8: Propostas UPDATE — dropar TODAS as 5 policies,
--   criar 1 correta: gestor+ da empresa.
--   (4 legadas user_id + propostas_por_empresa: atualizar de 012)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Atualizar próprias propostas"           ON propostas;
DROP POLICY IF EXISTS "Master edita propostas"                 ON propostas;
DROP POLICY IF EXISTS "Mestre atualiza tudo"                   ON propostas;
DROP POLICY IF EXISTS "Usuários atualizam suas propostas"      ON propostas;
DROP POLICY IF EXISTS "propostas_por_empresa: atualizar"       ON propostas;
DROP POLICY IF EXISTS "propostas: atualizar na empresa"        ON propostas;

CREATE POLICY "propostas: atualizar na empresa"
  ON propostas FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 9: Propostas DELETE — dropar TODAS as 5 policies,
--   criar 1 correta: restrita a dono/gestor/admin.
--   (4 legadas user_id + propostas_por_empresa: deletar de 012)
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Deletar próprias propostas"             ON propostas;
DROP POLICY IF EXISTS "Master deleta propostas"                ON propostas;
DROP POLICY IF EXISTS "Mestre deleta tudo"                     ON propostas;
DROP POLICY IF EXISTS "Usuários deletam suas propostas"        ON propostas;
DROP POLICY IF EXISTS "propostas_por_empresa: deletar"         ON propostas;
DROP POLICY IF EXISTS "propostas: deletar gestor+"             ON propostas;

CREATE POLICY "propostas: deletar gestor+"
  ON propostas FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );

COMMIT;


-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRATION (executar separadamente)
-- ============================================================

-- 1. Financeiro SELECT com perfil (esperado: 6 linhas):
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE cmd = 'SELECT'
--   AND tablename IN (
--     'financeiro_contas_receber','financeiro_notas_fiscais',
--     'financeiro_recebimentos','financeiro_movimentos_caixa',
--     'financeiro_saldos_caixa','financeiro_contas_pagar'
--   )
-- ORDER BY tablename;

-- 2. Propostas — estado limpo final (esperado: 4 linhas):
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'propostas'
-- ORDER BY cmd, policyname;
--
-- Esperado exato:
--   propostas: deletar gestor+          | DELETE
--   propostas: inserir na empresa       | INSERT
--   propostas_por_empresa: ver          | SELECT
--   propostas: atualizar na empresa     | UPDATE

-- 3. Confirmar ausência das legadas:
-- SELECT policyname FROM pg_policies
-- WHERE tablename = 'propostas'
--   AND policyname IN (
--     'Deletar próprias propostas','Master deleta propostas',
--     'Mestre deleta tudo','Usuários deletam suas propostas',
--     'Atualizar próprias propostas','Master edita propostas',
--     'Mestre atualiza tudo','Usuários atualizam suas propostas',
--     'propostas_por_empresa: atualizar','propostas_por_empresa: deletar',
--     'Master vê todas propostas','Mestre vê tudo',
--     'Usuários veem suas próprias propostas','Ver próprias propostas'
--   );
-- Esperado: 0 linhas.


-- ============================================================
-- ROLLBACK COMPLETO
-- ============================================================
-- BEGIN;
--
-- -- Reverter financeiro SELECT (remover check de perfil)
-- DROP POLICY IF EXISTS "fcr: ver da empresa"  ON financeiro_contas_receber;
-- CREATE POLICY "fcr: ver da empresa" ON financeiro_contas_receber FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
-- DROP POLICY IF EXISTS "fnf: ver da empresa"  ON financeiro_notas_fiscais;
-- CREATE POLICY "fnf: ver da empresa" ON financeiro_notas_fiscais FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
-- DROP POLICY IF EXISTS "frec: ver da empresa" ON financeiro_recebimentos;
-- CREATE POLICY "frec: ver da empresa" ON financeiro_recebimentos FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
-- DROP POLICY IF EXISTS "fmc: ver da empresa"  ON financeiro_movimentos_caixa;
-- CREATE POLICY "fmc: ver da empresa" ON financeiro_movimentos_caixa FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
-- DROP POLICY IF EXISTS "fsc: ver da empresa"  ON financeiro_saldos_caixa;
-- CREATE POLICY "fsc: ver da empresa" ON financeiro_saldos_caixa FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
-- DROP POLICY IF EXISTS "fcp: ver da empresa"  ON financeiro_contas_pagar;
-- CREATE POLICY "fcp: ver da empresa" ON financeiro_contas_pagar FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
--
-- -- Recriar propostas UPDATE/DELETE legadas (estado pré-014)
-- DROP POLICY IF EXISTS "propostas: atualizar na empresa" ON propostas;
-- DROP POLICY IF EXISTS "propostas: deletar gestor+"      ON propostas;
-- CREATE POLICY "propostas_por_empresa: atualizar" ON propostas FOR UPDATE
--   USING (empresa_id IN (
--     SELECT ue.empresa_id FROM usuario_empresas ue
--     JOIN usuarios u ON u.id = ue.usuario_id
--     WHERE u.auth_id = auth.uid() AND ue.ativo = true
--   ));
-- CREATE POLICY "propostas_por_empresa: deletar" ON propostas FOR DELETE
--   USING (empresa_id IN (
--     SELECT ue.empresa_id FROM usuario_empresas ue
--     JOIN usuarios u ON u.id = ue.usuario_id
--     WHERE u.auth_id = auth.uid() AND ue.ativo = true
--   ));
-- COMMIT;

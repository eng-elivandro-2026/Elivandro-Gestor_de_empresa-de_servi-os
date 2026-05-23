-- ============================================================
-- 014_financeiro_rls_select_propostas_cleanup.sql
-- Sprint 5 — Financeiro RLS SELECT + Propostas UPDATE/DELETE cleanup
--             (Auditoria A2)
--
-- CONTEXTO:
--   Duas classes de gap identificadas na auditoria A2:
--
--   GAP 1 — Financeiro SELECT sem perfil (6 tabelas):
--     As policies SELECT de todas as tabelas financeiro_* usavam
--     apenas empresa_id IN (SELECT auth_empresa_ids()), sem check
--     de perfil. Um colaborador/prestador autenticado conseguia
--     ler dados financeiros diretamente via API REST do Supabase,
--     bypassando o guard de frontend (H-005) adicionado na Sprint 4.
--
--   GAP 2 — Propostas UPDATE/DELETE com policy permissiva legada:
--     A migration 012 criou "propostas_por_empresa: atualizar" e
--     "propostas_por_empresa: deletar" sem check de perfil ao
--     separar a policy ALL legada em SELECT+UPDATE+DELETE.
--     Como policies PERMISSIVE são OR'd, essas policies mais
--     abertas sobrepunham as corretas de 001:
--       "propostas: atualizar na empresa" (tem NOT IN colaborador)
--       "propostas: deletar gestor+"     (tem IN dono/gestor/admin)
--     Resultado: colaborador/prestador conseguia ATUALIZAR e
--     DELETAR propostas.
--
-- AÇÃO:
--   1. Substituir as 6 policies SELECT de financeiro_* adicionando
--      auth_perfil() NOT IN ('colaborador', 'prestador').
--   2. Dropar "propostas_por_empresa: atualizar" — coberta
--      corretamente por "propostas: atualizar na empresa" (001).
--   3. Dropar "propostas_por_empresa: deletar" — coberta
--      corretamente por "propostas: deletar gestor+" (001).
--
-- IDEMPOTÊNCIA:
--   DROP POLICY IF EXISTS antes de cada CREATE POLICY.
--
-- NÃO ALTERA:
--   - Lógica de negócio ou cálculos financeiros (DRE, fluxo).
--   - Policies de SELECT de propostas (colaboradores podem ler).
--   - Policies de INSERT/UPDATE/DELETE já corretas.
--   - Configurações, DataGuard, RH ou Relacionamento.
--
-- EXECUÇÃO:
--   Rodar no SQL Editor do Supabase.
--   Não requer deploy de frontend.
--
-- ROLLBACK: ver seção no final do arquivo.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- BLOCO 1: financeiro_contas_receber — SELECT com perfil
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fcr: ver da empresa" ON financeiro_contas_receber;
CREATE POLICY "fcr: ver da empresa"
  ON financeiro_contas_receber FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 2: financeiro_notas_fiscais — SELECT com perfil
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fnf: ver da empresa" ON financeiro_notas_fiscais;
CREATE POLICY "fnf: ver da empresa"
  ON financeiro_notas_fiscais FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 3: financeiro_recebimentos — SELECT com perfil
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "frec: ver da empresa" ON financeiro_recebimentos;
CREATE POLICY "frec: ver da empresa"
  ON financeiro_recebimentos FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 4: financeiro_movimentos_caixa — SELECT com perfil
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fmc: ver da empresa" ON financeiro_movimentos_caixa;
CREATE POLICY "fmc: ver da empresa"
  ON financeiro_movimentos_caixa FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 5: financeiro_saldos_caixa — SELECT com perfil
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fsc: ver da empresa" ON financeiro_saldos_caixa;
CREATE POLICY "fsc: ver da empresa"
  ON financeiro_saldos_caixa FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 6: financeiro_contas_pagar — SELECT com perfil
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "fcp: ver da empresa" ON financeiro_contas_pagar;
CREATE POLICY "fcp: ver da empresa"
  ON financeiro_contas_pagar FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- ────────────────────────────────────────────────────────────
-- BLOCO 7: propostas — remover UPDATE legada sem perfil
--   "propostas_por_empresa: atualizar" (migration 012) sobrepunha
--   "propostas: atualizar na empresa" (migration 001) que já tem
--   o check correto. Dropar a permissiva — a correta permanece.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "propostas_por_empresa: atualizar" ON propostas;

-- ────────────────────────────────────────────────────────────
-- BLOCO 8: propostas — remover DELETE legada sem perfil
--   "propostas_por_empresa: deletar" (migration 012) sobrepunha
--   "propostas: deletar gestor+" (migration 001) que já restringe
--   a dono/gestor/admin. Dropar a permissiva — a correta permanece.
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "propostas_por_empresa: deletar" ON propostas;

COMMIT;

-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRATION (executar separadamente)
-- ============================================================

-- 1. Confirmar 6 policies SELECT de financeiro com perfil:
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE cmd = 'SELECT'
--   AND tablename IN (
--     'financeiro_contas_receber','financeiro_notas_fiscais',
--     'financeiro_recebimentos','financeiro_movimentos_caixa',
--     'financeiro_saldos_caixa','financeiro_contas_pagar'
--   )
-- ORDER BY tablename;
-- Esperado: 6 linhas, cada qual contendo NOT IN ('colaborador','prestador').

-- 2. Confirmar que as policies UPDATE/DELETE permissivas sumiram:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'propostas'
-- ORDER BY cmd, policyname;
-- Esperado: NÃO aparecer "propostas_por_empresa: atualizar"
--           NÃO aparecer "propostas_por_empresa: deletar"

-- 3. Confirmar que as policies corretas de propostas permaneceram:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'propostas'
--   AND policyname IN (
--     'propostas: atualizar na empresa',
--     'propostas: deletar gestor+'
--   );
-- Esperado: 2 linhas (UPDATE e DELETE).

-- ============================================================
-- ROLLBACK COMPLETO
-- ============================================================
-- BEGIN;
--
-- -- Reverter SELECT financeiro (remover check de perfil)
-- DROP POLICY IF EXISTS "fcr: ver da empresa"  ON financeiro_contas_receber;
-- CREATE POLICY "fcr: ver da empresa" ON financeiro_contas_receber FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
--
-- DROP POLICY IF EXISTS "fnf: ver da empresa"  ON financeiro_notas_fiscais;
-- CREATE POLICY "fnf: ver da empresa" ON financeiro_notas_fiscais FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
--
-- DROP POLICY IF EXISTS "frec: ver da empresa" ON financeiro_recebimentos;
-- CREATE POLICY "frec: ver da empresa" ON financeiro_recebimentos FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
--
-- DROP POLICY IF EXISTS "fmc: ver da empresa"  ON financeiro_movimentos_caixa;
-- CREATE POLICY "fmc: ver da empresa" ON financeiro_movimentos_caixa FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
--
-- DROP POLICY IF EXISTS "fsc: ver da empresa"  ON financeiro_saldos_caixa;
-- CREATE POLICY "fsc: ver da empresa" ON financeiro_saldos_caixa FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
--
-- DROP POLICY IF EXISTS "fcp: ver da empresa"  ON financeiro_contas_pagar;
-- CREATE POLICY "fcp: ver da empresa" ON financeiro_contas_pagar FOR SELECT
--   USING (empresa_id IN (SELECT auth_empresa_ids()));
--
-- -- Recriar policies propostas removidas
-- CREATE POLICY "propostas_por_empresa: atualizar" ON propostas FOR UPDATE
--   USING (empresa_id IN (
--     SELECT ue.empresa_id FROM usuario_empresas ue
--     JOIN usuarios u ON u.id = ue.usuario_id
--     WHERE u.auth_id = auth.uid() AND ue.ativo = true
--   ));
--
-- CREATE POLICY "propostas_por_empresa: deletar" ON propostas FOR DELETE
--   USING (empresa_id IN (
--     SELECT ue.empresa_id FROM usuario_empresas ue
--     JOIN usuarios u ON u.id = ue.usuario_id
--     WHERE u.auth_id = auth.uid() AND ue.ativo = true
--   ));
--
-- COMMIT;

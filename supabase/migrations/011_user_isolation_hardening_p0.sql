-- ============================================================
-- 011_user_isolation_hardening_p0.sql
-- Sprint 1 — User Isolation Hardening P0 (Auditoria A2)
--
-- H-001: Corrige RPC get_auth_id_by_email()
--   Antes: SECURITY DEFINER sem validação de perfil.
--   Qualquer usuário autenticado obtinha auth.uid de qualquer
--   pessoa do sistema apenas sabendo o e-mail.
--   Depois: retorna NULL para perfis != dono/admin.
--
-- H-004: Corrige propostas INSERT
--   Antes: qualquer membro da empresa podia inserir propostas.
--   Depois: apenas gestor/admin/dono.
--
-- EXECUÇÃO:
--   Rodar no SQL Editor do Supabase.
--   Não requer deploy de frontend.
--
-- ROLLBACK: ver seção no final do arquivo.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- H-001: get_auth_id_by_email() — perfil mínimo dono/admin
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_auth_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT CASE
    WHEN auth_perfil() NOT IN ('dono', 'admin') THEN NULL
    ELSE (SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1)
  END;
$$;

-- Manter permissão apenas para authenticated (sem PUBLIC)
REVOKE ALL ON FUNCTION get_auth_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_auth_id_by_email(text) TO authenticated;

-- ────────────────────────────────────────────────────────────
-- H-004: propostas INSERT — bloquear colaborador/prestador
-- ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "propostas: inserir na empresa" ON propostas;

CREATE POLICY "propostas: inserir na empresa"
  ON propostas FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

COMMIT;

-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRATION (executar separadamente)
-- ============================================================

-- 1. Confirmar que get_auth_id_by_email retorna NULL para não-dono/admin:
--    (testar com usuário de perfil gestor/colaborador)
--    SELECT get_auth_id_by_email('qualquer@email.com');
--    Resultado esperado: NULL (se chamante não for dono/admin)

-- 2. Confirmar nova policy de propostas:
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE tablename = 'propostas' AND cmd = 'INSERT';
-- Resultado esperado: 1 linha com auth_perfil() NOT IN ('colaborador','prestador')

-- ============================================================
-- ROLLBACK COMPLETO
-- ============================================================
-- BEGIN;
--
-- -- Reverter get_auth_id_by_email para versão original (sem check de perfil)
-- CREATE OR REPLACE FUNCTION get_auth_id_by_email(p_email text)
-- RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
--   SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
-- $$;
-- REVOKE ALL ON FUNCTION get_auth_id_by_email(text) FROM PUBLIC;
-- GRANT EXECUTE ON FUNCTION get_auth_id_by_email(text) TO authenticated;
--
-- -- Reverter propostas INSERT para versão original (sem check de perfil)
-- DROP POLICY IF EXISTS "propostas: inserir na empresa" ON propostas;
-- CREATE POLICY "propostas: inserir na empresa"
--   ON propostas FOR INSERT
--   WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));
--
-- COMMIT;

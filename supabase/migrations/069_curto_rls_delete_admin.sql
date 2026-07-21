-- ============================================================
-- 069_curto_rls_delete_admin.sql
-- Curto BT (v2) — expande a policy de DELETE de
-- curto_circuito_calculos: além do AUTOR, permite também
-- usuários com perfil 'dono' ou 'admin' na empresa.
--
-- NÃO altera a migration 068 (já aplicada); apenas SUBSTITUI a
-- policy de DELETE. Idempotente (DROP POLICY IF EXISTS).
--
-- Executar no SQL Editor do Supabase.
-- Depende de: 068_curto_circuito_calculos.sql,
--             001_rls_policies.sql (auth_empresa_ids, auth_usuario_id,
--             auth_perfil).
-- ============================================================

-- Remove a policy de DELETE antiga (só-autor, criada na 068)
DROP POLICY IF EXISTS "curto_circuito_calculos: delete autor" ON curto_circuito_calculos;
-- Remove também a nova, para tornar o script reaplicável
DROP POLICY IF EXISTS "curto_circuito_calculos: delete autor ou admin" ON curto_circuito_calculos;

CREATE POLICY "curto_circuito_calculos: delete autor ou admin" ON curto_circuito_calculos
  FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND (
      criado_por = auth_usuario_id()
      OR auth_perfil() IN ('dono', 'admin')
    )
  );

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT polname, polcmd FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
--   WHERE c.relname='curto_circuito_calculos' AND p.polcmd='d';
-- Esperado: 1 policy DELETE "curto_circuito_calculos: delete autor ou admin".

-- ============================================================
-- ROLLBACK (referência — restaura a policy só-autor da 068)
-- ============================================================
-- DROP POLICY IF EXISTS "curto_circuito_calculos: delete autor ou admin" ON curto_circuito_calculos;
-- CREATE POLICY "curto_circuito_calculos: delete autor" ON curto_circuito_calculos
--   FOR DELETE
--   USING (criado_por = auth_usuario_id() AND empresa_id IN (SELECT auth_empresa_ids()));
-- ============================================================

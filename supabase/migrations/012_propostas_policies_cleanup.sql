-- ============================================================
-- 012_propostas_policies_cleanup.sql
-- Sprint 2 — Propostas Policies Cleanup (Auditoria A2)
--
-- CONTEXTO:
--   A tabela propostas acumulou 18 policies de dois schemas
--   distintos: legado (user_id) e atual (empresa_id).
--   A policy propostas_por_empresa era do tipo ALL, cobrindo
--   INSERT implicitamente sem check de perfil — colaborador
--   conseguia inserir propostas passando apenas empresa_id.
--   Quatro policies INSERT legadas (user_id based) também
--   bypassavam o check de perfil introduzido na migration 011.
--
-- AÇÃO:
--   1. Remove 4 policies INSERT legadas sem check de perfil.
--   2. Converte propostas_por_empresa de ALL para
--      SELECT + UPDATE + DELETE — elimina cobertura implícita
--      de INSERT sem perfil.
--
--   Após esta migration, o único gatekeeper de INSERT é:
--   "propostas: inserir na empresa" (migration 011).
--
-- NOTA: JÁ APLICADO DIRETAMENTE NO SUPABASE em 2026-05-23.
--   Este arquivo existe para manter o repositório sincronizado
--   com o estado real do banco de dados.
--
-- ROLLBACK: ver seção no final do arquivo.
-- ============================================================

BEGIN;

-- ── 1. Remover INSERT legadas sem check de perfil ───────────
DROP POLICY IF EXISTS "Inserir próprias propostas"       ON propostas;
DROP POLICY IF EXISTS "Usuários inserem suas propostas"  ON propostas;
DROP POLICY IF EXISTS "Master insere propostas"          ON propostas;
DROP POLICY IF EXISTS "Mestre insere para qualquer um"   ON propostas;

-- ── 2. Converter propostas_por_empresa ALL → SELECT/UPDATE/DELETE ──
DROP POLICY IF EXISTS "propostas_por_empresa" ON propostas;

CREATE POLICY "propostas_por_empresa: ver"
  ON propostas FOR SELECT
  USING (
    empresa_id IN (
      SELECT ue.empresa_id FROM usuario_empresas ue
      JOIN usuarios u ON u.id = ue.usuario_id
      WHERE u.auth_id = auth.uid() AND ue.ativo = true
    )
  );

CREATE POLICY "propostas_por_empresa: atualizar"
  ON propostas FOR UPDATE
  USING (
    empresa_id IN (
      SELECT ue.empresa_id FROM usuario_empresas ue
      JOIN usuarios u ON u.id = ue.usuario_id
      WHERE u.auth_id = auth.uid() AND ue.ativo = true
    )
  );

CREATE POLICY "propostas_por_empresa: deletar"
  ON propostas FOR DELETE
  USING (
    empresa_id IN (
      SELECT ue.empresa_id FROM usuario_empresas ue
      JOIN usuarios u ON u.id = ue.usuario_id
      WHERE u.auth_id = auth.uid() AND ue.ativo = true
    )
  );

COMMIT;

-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRATION
-- ============================================================

-- 1. Confirmar único INSERT gatekeeper:
-- SELECT policyname, cmd, with_check FROM pg_policies
-- WHERE tablename = 'propostas' AND cmd = 'INSERT' ORDER BY policyname;
-- Esperado: apenas "propostas: inserir na empresa"

-- 2. Confirmar 3 novas propostas_por_empresa:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'propostas' AND policyname LIKE 'propostas_por_empresa%'
-- ORDER BY cmd;
-- Esperado: DELETE, SELECT, UPDATE

-- ============================================================
-- ROLLBACK
-- ============================================================
-- BEGIN;
--
-- DROP POLICY IF EXISTS "propostas_por_empresa: ver"       ON propostas;
-- DROP POLICY IF EXISTS "propostas_por_empresa: atualizar" ON propostas;
-- DROP POLICY IF EXISTS "propostas_por_empresa: deletar"   ON propostas;
--
-- CREATE POLICY "propostas_por_empresa" ON propostas
--   AS PERMISSIVE FOR ALL
--   USING (empresa_id IN (
--     SELECT ue.empresa_id FROM usuario_empresas ue
--     JOIN usuarios u ON u.id = ue.usuario_id
--     WHERE u.auth_id = auth.uid() AND ue.ativo = true
--   ));
--
-- CREATE POLICY "Inserir próprias propostas" ON propostas FOR INSERT
--   WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Usuários inserem suas propostas" ON propostas FOR INSERT
--   WITH CHECK (user_id = auth.uid());
-- CREATE POLICY "Master insere propostas" ON propostas FOR INSERT
--   WITH CHECK ((user_id = auth.uid()) OR is_master());
-- CREATE POLICY "Mestre insere para qualquer um" ON propostas FOR INSERT
--   WITH CHECK ((user_id = auth.uid()) OR (auth.uid() IN (
--     SELECT id FROM auth.users WHERE email = 'elivandro@tecfusion.com.br')));
--
-- COMMIT;

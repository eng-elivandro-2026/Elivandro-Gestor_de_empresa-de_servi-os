-- ============================================================
-- 032_obras_rls_colaborador.sql
-- Adiciona politica RLS de SELECT em obras para colaboradores e prestadores.
-- Sem esta policy, auth_empresa_ids() retorna vazio para colaboradores
-- (que nao existem em usuario_empresas) e a policy existente bloqueia tudo.
-- ATENCAO: migration versionada, aplicar somente com autorizacao explicita.
-- ============================================================

-- Colaborador/prestador ve obras das empresas onde esta ativo em colaborador_empresas
DROP POLICY IF EXISTS "obras: colaborador ve da empresa" ON obras;
CREATE POLICY "obras: colaborador ve da empresa"
  ON obras FOR SELECT
  USING (
    empresa_id IN (
      SELECT ce.empresa_id
      FROM colaborador_empresas ce
      WHERE ce.colaborador_id = auth_colaborador_id()
        AND ce.ativo = true
    )
  );

-- ============================================================
-- ROLLBACK (nao executar automaticamente — somente referencia)
-- ============================================================
-- DROP POLICY IF EXISTS "obras: colaborador ve da empresa" ON obras;
-- ============================================================

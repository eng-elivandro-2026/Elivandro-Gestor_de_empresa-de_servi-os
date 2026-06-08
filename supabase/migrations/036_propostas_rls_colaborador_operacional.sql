-- ============================================================
-- 036_propostas_rls_colaborador_operacional.sql
-- Libera leitura PARCIAL de propostas para colaborador/prestador:
-- SOMENTE propostas em fase OPERACIONAL ATIVA, da(s) empresa(s) onde
-- o colaborador esta ativo em colaborador_empresas.
-- Necessario para o dropdown de Apontamento de Horas (pages/colaborador.html).
--
-- CONVIVENCIA COM mig.015:
--   "propostas_por_empresa: ver" (mig.015) e PERMISSIVE e exige
--   auth_perfil() NOT IN ('colaborador','prestador') — continua bloqueando
--   o colaborador para TODAS as fases. Esta policy NOVA tambem e PERMISSIVE;
--   policies PERMISSIVE de SELECT combinam por OR no Postgres. Logo:
--     visivel  <=>  (gestor+ da empresa)                         [mig.015]
--                   OR (colaborador da empresa AND fase ativa)   [esta]
--   As demais fases (rascunho, enviada, perdida, etc.) continuam
--   invisiveis ao colaborador.
--
-- POR QUE NAO auth_empresa_ids() / auth_perfil():
--   Numa sessao de colaborador/prestador, auth.uid() mapeia para a tabela
--   'colaboradores', NAO para 'usuarios'/'usuario_empresas'. Logo:
--     - auth_empresa_ids() retorna VAZIO (lê de usuario_empresas)
--     - auth_perfil() retorna NULL (lê de usuarios)
--   Usar essas funcoes criaria uma policy no-op para colaborador.
--   Mesmo motivo pelo qual a mig.032 (obras) usou colaborador_empresas
--   + auth_colaborador_id() em vez de auth_empresa_ids().
--
-- NAO ALTERA a policy existente da mig.015.
-- NAO altera dados. Idempotente (DROP IF EXISTS antes do CREATE).
-- ATENCAO: migration versionada, aplicar somente com autorizacao explicita.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "propostas: colaborador ve operacional ativa" ON propostas;

CREATE POLICY "propostas: colaborador ve operacional ativa"
  ON propostas FOR SELECT
  USING (
    empresa_id IN (
      SELECT ce.empresa_id
      FROM colaborador_empresas ce
      WHERE ce.colaborador_id = auth_colaborador_id()
        AND ce.ativo = true
    )
    AND fase IN (
      'aprovado', 'andamento', 'atrasado', 'taf', 'sat',
      'em_pausa_falta_material', 'em_pausa_aguardando_cliente',
      'em_pausa_aguardando_terceiro'
    )
  );

COMMIT;

-- ============================================================
-- VERIFICACAO POS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'propostas' ORDER BY cmd, policyname;
-- Esperado em SELECT (2 linhas):
--   propostas_por_empresa: ver                   | SELECT  (mig.015)
--   propostas: colaborador ve operacional ativa  | SELECT  (esta)

-- ============================================================
-- ROLLBACK (nao executar automaticamente — somente referencia)
-- ============================================================
-- DROP POLICY IF EXISTS "propostas: colaborador ve operacional ativa" ON propostas;
-- ============================================================

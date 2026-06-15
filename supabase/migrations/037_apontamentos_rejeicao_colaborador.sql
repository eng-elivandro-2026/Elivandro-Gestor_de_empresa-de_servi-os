-- ============================================================
-- 037_apontamentos_rejeicao_colaborador.sql
-- Habilita o fluxo de "Corrigir e Reenviar" para o COLABORADOR em
-- apontamentos REJEITADOS, e permite que o colaborador registre o
-- evento 'reenviado' na trilha de auditoria apontamentos_historico.
--
-- CONTEXTO:
--   - A rejeicao em si (gestor) NAO precisa de mudanca de banco: o gestor
--     ja pode UPDATE (mig.001 "apontamentos: gestor+ atualiza") e ja pode
--     INSERT em apontamentos_historico (auth_empresa_ids() funciona p/ gestor).
--   - Esta migration cobre apenas o LADO DO COLABORADOR.
--
-- O QUE MUDA:
--   1) UPDATE de apontamentos pelo colaborador: antes so permitia status
--      'pendente'; passa a permitir 'pendente' OU 'rejeitado' (para corrigir
--      e reenviar um apontamento rejeitado). A propria USING tambem barra que
--      o colaborador grave status diferente de pendente/rejeitado (nao pode
--      se auto-aprovar), pois no UPDATE sem WITH CHECK a USING vale p/ o pos-estado.
--   2) INSERT em apontamentos_historico pelo colaborador: a policy existente
--      "inserir autenticado" usa auth_empresa_ids(), que e VAZIO para colaborador
--      (ele nao esta em usuario_empresas). Adiciona policy que autoriza o
--      colaborador a inserir histórico dos PROPRIOS apontamentos.
--
-- NAO ALTERA dados. Idempotente (DROP IF EXISTS antes do CREATE).
-- ATENCAO: migration versionada — aplicar somente com autorizacao explicita.
--
-- OBS sobre a coluna apontamentos_historico.evento:
--   Se houver um CHECK CONSTRAINT limitando os valores de "evento", o valor
--   'reenviado' precisa ser permitido. 'rejeitado' ja e usado pela aplicacao
--   (config de historico existente). Verifique com a query da secao
--   VERIFICACAO no fim deste arquivo; se existir constraint, ajuste-o.
-- ============================================================

BEGIN;

-- 1) Colaborador pode editar apontamentos PENDENTES ou REJEITADOS (antes: so pendente)
DROP POLICY IF EXISTS "apontamentos: colaborador edita pendente" ON apontamentos;
CREATE POLICY "apontamentos: colaborador edita pendente"
  ON apontamentos FOR UPDATE
  USING (
    colaborador_id = auth_colaborador_id()
    AND status IN ('pendente', 'rejeitado')
  );

-- 2) Colaborador pode inserir historico dos PROPRIOS apontamentos (evento 'reenviado')
DROP POLICY IF EXISTS "apontamentos_historico: colaborador insere proprios" ON apontamentos_historico;
CREATE POLICY "apontamentos_historico: colaborador insere proprios"
  ON apontamentos_historico FOR INSERT
  WITH CHECK (
    apontamento_id IN (
      SELECT id FROM apontamentos WHERE colaborador_id = auth_colaborador_id()
    )
  );

COMMIT;

-- ============================================================
-- VERIFICACAO POS-MIGRATION (executar separadamente)
-- ============================================================
-- a) Policies de UPDATE em apontamentos (esperado incluir status rejeitado):
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE tablename = 'apontamentos' AND cmd = 'UPDATE' ORDER BY policyname;
--
-- b) Policy de INSERT do colaborador no historico:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'apontamentos_historico' AND cmd = 'INSERT' ORDER BY policyname;
--
-- c) Existe CHECK constraint no campo evento? (precisa permitir 'reenviado')
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'apontamentos_historico'::regclass AND contype = 'c';
--   -> Se aparecer um CHECK listando os valores de evento SEM 'reenviado',
--      rode (ajustando o nome do constraint):
--      ALTER TABLE apontamentos_historico DROP CONSTRAINT <nome_do_check>;
--      ALTER TABLE apontamentos_historico ADD CONSTRAINT <nome_do_check>
--        CHECK (evento IN ('criado','editado','cancelado','reaberto','aprovado','rejeitado','reenviado'));

-- ============================================================
-- ROLLBACK (nao executar automaticamente — somente referencia)
-- ============================================================
-- BEGIN;
-- DROP POLICY IF EXISTS "apontamentos_historico: colaborador insere proprios" ON apontamentos_historico;
-- DROP POLICY IF EXISTS "apontamentos: colaborador edita pendente" ON apontamentos;
-- CREATE POLICY "apontamentos: colaborador edita pendente"
--   ON apontamentos FOR UPDATE
--   USING (colaborador_id = auth_colaborador_id() AND status = 'pendente');
-- COMMIT;
-- ============================================================

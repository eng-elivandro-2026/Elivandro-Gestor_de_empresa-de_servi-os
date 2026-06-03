-- ============================================================
-- 036_gestao_negocio_ciclo_exec_schema_fix.sql
-- Corrige o erro ao "Salvar Rascunho" em Operacional > Gestão do Negócio:
--   "Could not find the 'data_exec_aceite' column of 'gestao_negocio'
--    in the schema cache"
--
-- Causa raiz: as colunas de Ciclo de Execução criadas na migration 035
-- (data_exec_inicio / data_exec_termino / data_exec_aceite) não foram
-- aplicadas no banco e/ou o schema cache do PostgREST está desatualizado.
-- O front-end (montarPayloadGestao em operacional-inline.js) envia esses
-- campos para gestao_negocio, então as colunas são necessárias.
--
-- Esta migration é IDEMPOTENTE (ADD COLUMN IF NOT EXISTS) e NÃO-DESTRUTIVA:
-- não apaga nem altera dados, não toca em cálculos financeiros, não usa
-- DELETE/TRUNCATE. Pode ser aplicada com segurança mesmo que a 035 já tenha
-- rodado parcialmente.
-- ============================================================

-- Garante as colunas de Ciclo de Execução (mesmas da migration 035)
ALTER TABLE gestao_negocio
  ADD COLUMN IF NOT EXISTS data_exec_inicio  DATE,
  ADD COLUMN IF NOT EXISTS data_exec_termino DATE,
  ADD COLUMN IF NOT EXISTS data_exec_aceite  DATE;

-- Índices (idempotentes)
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_exec_inicio  ON gestao_negocio(data_exec_inicio);
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_exec_termino ON gestao_negocio(data_exec_termino);
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_exec_aceite  ON gestao_negocio(data_exec_aceite);

-- Documentação
COMMENT ON COLUMN gestao_negocio.data_exec_inicio  IS 'Data de Início de Execução';
COMMENT ON COLUMN gestao_negocio.data_exec_termino IS 'Data de Término do Trabalho';
COMMENT ON COLUMN gestao_negocio.data_exec_aceite  IS 'Data de Aceite / Entrega ao Cliente';

-- Recarrega o schema cache do PostgREST/Supabase para reconhecer as colunas
-- imediatamente (resolve o "in the schema cache" sem reiniciar o serviço).
NOTIFY pgrst, 'reload schema';

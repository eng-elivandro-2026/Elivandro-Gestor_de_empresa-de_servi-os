-- ============================================================
-- 059_revert_obras_inicio_execucao.sql
-- REVERSÃO da migration 057 (decisão de produto): elimina a coluna
-- obras.data_inicio_execucao e o trigger automático.
--
-- Motivo: dado carimbado automaticamente que ninguém confirma
-- manualmente e que nenhuma tela consome (verificado: zero usos no
-- código). Substituído pela etiqueta "sem data início" na Visão
-- Executiva (card Obras em Andamento), que cobra o preenchimento do
-- campo MANUAL já existente gestao_negocio.data_exec_inicio — a
-- tela certa para o gestor registrar a passagem de bastão.
--
-- Idempotente (IF EXISTS): quem nunca aplicou a 057 pode rodar esta
-- sem erro (no-ops). A 057 permanece no repositório como histórico.
-- Executar no SQL Editor do Supabase.
-- ============================================================

DROP TRIGGER IF EXISTS trg_obras_inicio_execucao ON obras;
DROP FUNCTION IF EXISTS obras_stamp_inicio_execucao();
ALTER TABLE obras DROP COLUMN IF EXISTS data_inicio_execucao;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente; ambas devem
-- retornar 0 linhas)
-- ============================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'obras' AND column_name = 'data_inicio_execucao';
--
-- SELECT tgname FROM pg_trigger
-- WHERE tgname = 'trg_obras_inicio_execucao';

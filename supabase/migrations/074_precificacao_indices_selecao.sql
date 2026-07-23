-- ============================================================
-- 074_precificacao_indices_selecao.sql
-- Precificação — permite (des)selecionar cada índice/encargo do
-- Banco de Índices. Itens selecionados entram no total de encargos.
-- ============================================================

-- selecionado: item entra na soma dos totais quando true.
-- Default true — todos os itens começam selecionados.
ALTER TABLE precificacao_indices
  ADD COLUMN IF NOT EXISTS selecionado boolean NOT NULL DEFAULT true;

-- ============================================================
-- Migration 016 — Financeiro: remover unique por proposta em contas_receber
-- ============================================================
-- Objetivo: permitir N contas_receber por proposta_app_id (uma por NF parcial).
--
-- Modelo anterior (1 proposta → 1 conta → N NFs) era imposto por:
--   idx_fcr_unique_proposta_sem_obra  (empresa_id, proposta_app_id) WHERE obra_id IS NULL
--   idx_fcr_unique_proposta_com_obra  (empresa_id, proposta_app_id, obra_id) WHERE obra_id IS NOT NULL
--
-- Modelo correto (1 proposta → N NFs → N contas, uma por NF):
--   Cada NF parcial tem sua própria conta_receber com vencimento,
--   recebimento, baixa e status independentes.
--   proposta_app_id permanece preenchido em AMBOS os registros.
--
-- Esta migration:
--   - NÃO apaga dados
--   - NÃO altera colunas
--   - NÃO altera RLS
--   - NÃO altera nenhuma outra tabela
--   - Apenas remove as duas restrições de unicidade que impediam N contas por proposta
-- ============================================================

DROP INDEX IF EXISTS idx_fcr_unique_proposta_sem_obra;
DROP INDEX IF EXISTS idx_fcr_unique_proposta_com_obra;

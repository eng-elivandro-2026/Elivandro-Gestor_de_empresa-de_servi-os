-- ============================================================
-- 076_financeiro_parcelamento_contas_receber.sql
-- PR1 do roadmap Financeiro — parcelamento de contas a receber.
--
-- Modelo aprovado: 1 parcela = 1 linha em financeiro_contas_receber,
-- agrupadas por grupo_parcelamento_id (uma proposta → N parcelas).
-- Cada parcela pode ter split de valor entre serviço e produto
-- (para NF de serviço e NF de produto por parcela — PR3).
--
-- Idempotente (ADD COLUMN / CREATE INDEX IF NOT EXISTS).
-- NÃO aplicar automaticamente — rodar manualmente no SQL Editor
-- do Supabase após revisão.
-- ============================================================

-- Agrupador do parcelamento (mesma proposta compartilha o mesmo id).
-- NULL = conta a receber avulsa / sem parcelamento.
ALTER TABLE financeiro_contas_receber
  ADD COLUMN IF NOT EXISTS grupo_parcelamento_id uuid;

-- Posição da parcela (1..N) e total de parcelas do grupo.
-- NULL nas contas sem parcelamento.
ALTER TABLE financeiro_contas_receber
  ADD COLUMN IF NOT EXISTS parcela_numero integer;

ALTER TABLE financeiro_contas_receber
  ADD COLUMN IF NOT EXISTS parcela_total integer;

-- Split do valor da parcela entre serviço e produto.
-- Somados devem corresponder ao valor_previsto da parcela (validado no app).
ALTER TABLE financeiro_contas_receber
  ADD COLUMN IF NOT EXISTS valor_servico numeric(14,2) NOT NULL DEFAULT 0;

ALTER TABLE financeiro_contas_receber
  ADD COLUMN IF NOT EXISTS valor_produto numeric(14,2) NOT NULL DEFAULT 0;

-- Índice para carregar/agrupar as parcelas de um mesmo parcelamento.
CREATE INDEX IF NOT EXISTS idx_fcr_grupo_parcelamento_id
  ON financeiro_contas_receber (grupo_parcelamento_id);

-- ============================================================
-- FIM: 076_financeiro_parcelamento_contas_receber.sql
-- Aplicar manualmente no SQL Editor do Supabase.
-- ============================================================

-- ============================================================
-- 073_precificacao_adicionais.sql
-- Precificação — evolui precificacao_funcoes com tipo de
-- remuneração e adicionais (periculosidade, insalubridade, PLR,
-- comissão, ajuda de custo, outro) em JSONB.
-- ============================================================

-- tipo_remuneracao: 'fixo' | 'comissao_pura' | 'fixo_mais_comissao'
ALTER TABLE precificacao_funcoes
  ADD COLUMN IF NOT EXISTS tipo_remuneracao text NOT NULL DEFAULT 'fixo';

-- adicionais: estrutura JSON (periculosidade, insalubridade, plr,
-- comissao, ajuda_custo, outro). Default '{}' — o app preenche.
ALTER TABLE precificacao_funcoes
  ADD COLUMN IF NOT EXISTS adicionais jsonb NOT NULL DEFAULT '{}'::jsonb;

-- CHECK dos valores válidos de tipo_remuneracao (idempotente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'precificacao_funcoes_tipo_remuneracao_chk'
  ) THEN
    ALTER TABLE precificacao_funcoes
      ADD CONSTRAINT precificacao_funcoes_tipo_remuneracao_chk
      CHECK (tipo_remuneracao IN ('fixo','comissao_pura','fixo_mais_comissao'));
  END IF;
END $$;

-- ============================================================
-- 051_regime_aplicar_acrescimos.sql
-- Adiciona a coluna aplicar_acrescimos em regime_colaborador.
--
-- Controla se os percentuais de extras (Extra 50% / 100%) são aplicados
-- no cálculo do apontamento. Relevante para MEI/PJ — quando false e o
-- colaborador é MEI/PJ, o apontamento calcula horas totais × valor/hora
-- (sem split normal/extra). Para CLT os acréscimos sempre se aplicam.
--
-- Default true (mantém o comportamento atual: acréscimos aplicados).
-- Migration estritamente ADITIVA e idempotente (ADD COLUMN IF NOT EXISTS).
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 049_regime_colaborador.sql.
-- ============================================================

ALTER TABLE regime_colaborador
  ADD COLUMN IF NOT EXISTS aplicar_acrescimos bool NOT NULL DEFAULT true;

COMMENT ON COLUMN regime_colaborador.aplicar_acrescimos IS
  'Se true, aplica os percentuais de extras (50%/100%) no cálculo. Para MEI/PJ pode ser false (horas totais × valor/hora). CLT sempre aplica.';

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'regime_colaborador' AND column_name = 'aplicar_acrescimos';

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- ALTER TABLE regime_colaborador DROP COLUMN IF EXISTS aplicar_acrescimos;
-- ============================================================

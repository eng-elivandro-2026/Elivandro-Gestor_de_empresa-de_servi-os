-- ============================================================
-- 042_radar_config_metas.sql
-- Configuração de medição do Radar na tabela metas (criada na 040).
--
-- O QUE MUDA:
--   Adiciona 2 colunas à tabela metas para o Radar saber COMO calcular
--   automaticamente se a meta foi batida:
--     • radar_tipo    — natureza da medição
--     • radar_sentido — direção (menor é melhor / maior é melhor)
--   O valor-alvo continua sendo a coluna valor_meta já existente.
--
-- Migration estritamente ADITIVA: apenas ADD COLUMN IF NOT EXISTS.
-- Idempotente; não altera nem remove nada existente. Não insere dados
-- (o ajuste das metas existentes é um bloco UPDATE separado, manual).
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 040_gestao_a_vista.sql (tabela metas).
-- ============================================================

BEGIN;

ALTER TABLE metas
  ADD COLUMN IF NOT EXISTS radar_tipo    varchar(20) NOT NULL DEFAULT 'dias',
  ADD COLUMN IF NOT EXISTS radar_sentido varchar(10) NOT NULL DEFAULT 'menor';

-- Documentação dos valores aceitos
COMMENT ON COLUMN metas.radar_tipo IS
  'Natureza da medição do Radar: dias (dias entre 2 datas) | contagem (quantidade por período) | valor (valor monetário por período).';
COMMENT ON COLUMN metas.radar_sentido IS
  'Direção da meta: menor (menor é melhor — ex: reduzir dias) | maior (maior é melhor — ex: aumentar volume).';

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'metas' AND column_name IN ('radar_tipo','radar_sentido');

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- ALTER TABLE metas DROP COLUMN IF EXISTS radar_sentido;
-- ALTER TABLE metas DROP COLUMN IF EXISTS radar_tipo;
-- COMMIT;
-- ============================================================

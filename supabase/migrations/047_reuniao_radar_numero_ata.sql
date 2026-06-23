-- ============================================================
-- 047_reuniao_radar_numero_ata.sql
-- Numeração sequencial das atas na tabela reuniao_radar (criada na 043).
--
-- O QUE MUDA:
--   Adiciona a coluna numero_ata à tabela reuniao_radar. O número é
--   sequencial POR EMPRESA e REINICIA a cada ano (baseado no ano de
--   data_reuniao): ATA01, ATA02… e, em janeiro do ano seguinte, volta
--   para ATA01.
--
--   • numero_ata fica NULLABLE de propósito: o app preenche no INSERT
--     de cada ata nova (count por empresa + ano de data_reuniao, +1).
--   • Esta migration também faz o BACKFILL das atas já existentes,
--     numerando-as por ordem de data_reuniao dentro de cada empresa/ano.
--
-- Migration estritamente ADITIVA: ADD COLUMN IF NOT EXISTS + índice +
-- UPDATE de backfill (só linhas com numero_ata NULL). Idempotente:
-- reexecutar não renumera atas já preenchidas. Não cria RLS nova
-- (reuniao_radar já tem RLS — ver 044).
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 043_reuniao_radar.sql (tabela reuniao_radar).
-- ============================================================

BEGIN;

-- ── 1) Coluna numero_ata (nullable; preenchida no INSERT pelo app) ──
ALTER TABLE reuniao_radar
  ADD COLUMN IF NOT EXISTS numero_ata integer;

-- ── 2) Índice para acelerar o count por empresa + ano (cálculo do número) ──
CREATE INDEX IF NOT EXISTS idx_reuniao_radar_emp_data
  ON reuniao_radar (empresa_id, data_reuniao);

-- ── 3) Backfill das atas existentes ──
--   Numera por ordem de data_reuniao dentro de cada empresa E cada ano,
--   reiniciando a cada ano (window function). Só toca linhas ainda NULL.
WITH numeradas AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY empresa_id, EXTRACT(YEAR FROM data_reuniao)
           ORDER BY data_reuniao ASC, created_at ASC
         ) AS seq
  FROM reuniao_radar
  WHERE numero_ata IS NULL
)
UPDATE reuniao_radar r
SET numero_ata = n.seq
FROM numeradas n
WHERE r.id = n.id;

-- ── Documentação inline ──
COMMENT ON COLUMN reuniao_radar.numero_ata IS
  'Número sequencial da ata por empresa, reiniciando a cada ano (base: ano de data_reuniao). Preenchido no INSERT pelo app; exibido como ATA{NN}.';

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'reuniao_radar' AND column_name = 'numero_ata';
--
-- Conferir a numeração por empresa/ano (deve reiniciar em 1 a cada ano):
-- SELECT empresa_id,
--        EXTRACT(YEAR FROM data_reuniao) AS ano,
--        numero_ata, data_reuniao
-- FROM reuniao_radar
-- ORDER BY empresa_id, ano, numero_ata;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_reuniao_radar_emp_data;
-- ALTER TABLE reuniao_radar DROP COLUMN IF EXISTS numero_ata;
-- COMMIT;
-- ============================================================

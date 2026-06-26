-- ============================================================
-- 048_reuniao_radar_indicadores_html.sql
-- Indicadores da semana como texto rico livre na tabela reuniao_radar (criada na 043).
--
-- O QUE MUDA:
--   Adiciona a coluna indicadores_html à tabela reuniao_radar. A seção
--   "Indicadores da semana" da ata passa a ser um editor de texto rico
--   (HTML livre) em vez da tabela estruturada. O app salva o HTML do
--   editor nesta coluna e o recarrega ao reabrir a ata.
--
--   • indicadores_html: text, DEFAULT '' (atas antigas e novas começam vazias).
--   • A tabela reuniao_radar_indicadores (estruturada) NÃO é removida e
--     continua sendo gravada/lida pelo app para compatibilidade — pode
--     ficar vazia em atas que só usam o texto rico. O histórico mostra o
--     HTML quando presente e cai para a tabela antiga quando não houver.
--
-- Migration estritamente ADITIVA: ADD COLUMN IF NOT EXISTS. Idempotente:
-- reexecutar não altera dados. Não cria RLS nova (reuniao_radar já tem
-- RLS — ver 044).
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: 043_reuniao_radar.sql (tabela reuniao_radar).
-- ============================================================

BEGIN;

-- ── 1) Coluna indicadores_html (HTML livre do editor de texto rico) ──
ALTER TABLE reuniao_radar
  ADD COLUMN IF NOT EXISTS indicadores_html text DEFAULT '';

-- ── Documentação inline ──
COMMENT ON COLUMN reuniao_radar.indicadores_html IS
  'HTML livre da seção "Indicadores da semana" (editor de texto rico). Substitui visualmente a tabela reuniao_radar_indicadores, que é mantida por compatibilidade.';

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'reuniao_radar' AND column_name = 'indicadores_html';

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- ALTER TABLE reuniao_radar DROP COLUMN IF EXISTS indicadores_html;
-- COMMIT;
-- ============================================================

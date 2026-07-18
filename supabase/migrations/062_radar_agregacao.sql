-- ============================================================
-- 062_radar_agregacao.sql
-- Modo de agregação do rodapé do Radar para os tipos que podem ser
-- usados de 2 formas:
--   'ultimo'    — métrica única ao longo do tempo (rodapé = último registro)
--   'checklist' — vários itens diferentes na mesma meta (agrega TODOS)
--
-- Usado só por radar_tipo IN ('percentual','sim_nao'). Demais tipos
-- ignoram a coluna. NULL = 'ultimo' (comportamento atual; metas antigas
-- não quebram).
--
-- Guarda o MODO (não o cálculo): o cálculo do 'checklist' é por tipo
--   percentual → média (com 0/100 vira "% de itens válidos")
--   sim_nao    → % de itens no objetivo ("X de Y (Z%)")
--
-- ⚠️ RODAR ANTES do deploy: o código novo envia radar_agregacao ao salvar
-- meta de percentual/sim_nao. Coluna aditiva e nullable → inofensiva p/ a
-- página antiga (que a ignora).
--
-- Depende de: 042_radar_config_metas.sql.
-- ============================================================

ALTER TABLE metas
  ADD COLUMN IF NOT EXISTS radar_agregacao text;

-- CHECK idempotente (nomeado)
ALTER TABLE metas
  DROP CONSTRAINT IF EXISTS metas_radar_agregacao_check;
ALTER TABLE metas
  ADD CONSTRAINT metas_radar_agregacao_check
  CHECK (radar_agregacao IS NULL OR radar_agregacao IN ('ultimo', 'checklist'));

COMMENT ON COLUMN metas.radar_agregacao IS
  'Agregação do Radar p/ percentual/sim_nao: ultimo (métrica única) | checklist (agrega todos). NULL = ultimo.';

-- ── Verificação (executar separadamente) ──────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'metas' AND column_name = 'radar_agregacao';

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- ALTER TABLE metas DROP CONSTRAINT IF EXISTS metas_radar_agregacao_check;
-- ALTER TABLE metas DROP COLUMN IF EXISTS radar_agregacao;
-- ============================================================

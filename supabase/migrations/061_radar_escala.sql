-- ============================================================
-- 061_radar_escala.sql
-- Novos tipos de medição de meta (Gestão à Vista). O único que
-- precisa de config extra persistida é a Nota/Avaliação, cuja
-- ESCALA (0-5 ou 0-10) é escolhida na criação da meta.
--
-- Os demais tipos novos (NPS, Média por período, Ranking) e o
-- Percentual não precisam de coluna: reusam radar_tipo (varchar,
-- sem CHECK) e valor_realizado dos registros.
--
-- ⚠️ RODAR ANTES do deploy da página nova: o código novo envia
-- radar_escala ao salvar uma meta do tipo 'nota'. Coluna aditiva
-- e nullable → inofensiva para a página antiga (que a ignora).
--
-- Depende de: 042_radar_config_metas.sql.
-- ============================================================

ALTER TABLE metas
  ADD COLUMN IF NOT EXISTS radar_escala smallint;

COMMENT ON COLUMN metas.radar_escala IS
  'Escala da Nota/Avaliação (5 ou 10) — usado só quando radar_tipo = nota; NULL = 10.';

-- ── Verificação (executar separadamente) ──────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'metas' AND column_name = 'radar_escala';

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- ALTER TABLE metas DROP COLUMN IF EXISTS radar_escala;
-- ============================================================

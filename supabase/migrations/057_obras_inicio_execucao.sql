-- ============================================================
-- 057_obras_inicio_execucao.sql
-- Fundação do módulo Recursos & Produtividade (Parte A):
-- registrar QUANDO a obra saiu de 'aprovado' pela primeira vez
-- (início real da execução). Hoje nada é gravado — é impossível
-- medir quanto tempo uma obra ficou parada em "Aprovado".
--
-- 1. Coluna obras.data_inicio_execucao (timestamptz, nullable)
-- 2. Trigger BEFORE UPDATE: carimba now() UMA ÚNICA VEZ na
--    primeira saída de 'aprovado' (novo status ≠ 'cancelada'),
--    independente de qual tela/cliente fizer o UPDATE.
-- 3. Backfill APROXIMADO do histórico (documentado abaixo).
--
-- Convive com o trigger existente trg_obras_updated_at (003):
-- ambos BEFORE UPDATE, mutam NEW em campos distintos.
-- Executar no SQL Editor do Supabase, na ordem do arquivo.
-- Depende de: 003_operacional_obras.sql.
-- ============================================================

-- ── 1. Coluna ─────────────────────────────────────────────────
ALTER TABLE obras ADD COLUMN IF NOT EXISTS data_inicio_execucao timestamptz;

COMMENT ON COLUMN obras.data_inicio_execucao IS
  'Primeira saída do status ''aprovado'' (início real da execução). '
  'Gravada automaticamente pelo trigger trg_obras_inicio_execucao, uma única vez. '
  'Valores anteriores a 2026-07 são APROXIMAÇÃO retroativa (backfill via primeiro '
  'diário de obra ou primeiro apontamento) — não o instante exato da mudança de status.';

-- ── 2. Trigger (grava 1×, na primeira saída de 'aprovado') ────
CREATE OR REPLACE FUNCTION obras_stamp_inicio_execucao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.data_inicio_execucao IS NULL
     AND OLD.status_operacional = 'aprovado'
     AND NEW.status_operacional IS DISTINCT FROM 'aprovado'
     AND NEW.status_operacional IS DISTINCT FROM 'cancelada' THEN
    NEW.data_inicio_execucao := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obras_inicio_execucao ON obras;
CREATE TRIGGER trg_obras_inicio_execucao
BEFORE UPDATE ON obras
FOR EACH ROW
EXECUTE FUNCTION obras_stamp_inicio_execucao();

-- Limitação documentada: obra legada que nunca passou por 'aprovado'
-- (criada direto em status operacional) não é carimbada pelo trigger —
-- o backfill abaixo cobre o histórico; daqui pra frente o fluxo padrão
-- (Criar Obra → 'aprovado' → execução) é sempre capturado.

-- ── 3. Backfill APROXIMADO do histórico ───────────────────────
-- Só para obras que JÁ saíram de 'aprovado' (status atual de execução/
-- terminal) e ainda sem valor. NÃO inventa data: sem diário e sem
-- apontamento → fica NULL (o indicador exibirá "—").

-- 3a. Melhor evidência: data do PRIMEIRO diário de obra
UPDATE obras o
SET data_inicio_execucao = d.primeira
FROM (
  SELECT obra_id, MIN(data_diario)::timestamptz AS primeira
  FROM obra_diario
  GROUP BY obra_id
) d
WHERE d.obra_id = o.id
  AND o.data_inicio_execucao IS NULL
  AND o.status_operacional NOT IN ('aprovado', 'cancelada', 'aguardando_recebimento');

-- 3b. Fallback: data do PRIMEIRO apontamento de horas da proposta
--     (apontamentos.proposta_id = obras.proposta_app_id, mesma empresa)
UPDATE obras o
SET data_inicio_execucao = a.primeira
FROM (
  SELECT empresa_id, proposta_id, MIN(data)::timestamptz AS primeira
  FROM apontamentos
  WHERE status <> 'cancelado'
  GROUP BY empresa_id, proposta_id
) a
WHERE a.empresa_id = o.empresa_id
  AND a.proposta_id = o.proposta_app_id
  AND o.data_inicio_execucao IS NULL
  AND o.status_operacional NOT IN ('aprovado', 'cancelada', 'aguardando_recebimento');

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- (a) Cobertura do backfill por situação:
-- SELECT status_operacional,
--        COUNT(*)                                        AS obras,
--        COUNT(data_inicio_execucao)                     AS com_data,
--        COUNT(*) - COUNT(data_inicio_execucao)          AS sem_data
-- FROM obras GROUP BY status_operacional ORDER BY 2 DESC;
--
-- (b) Obras paradas em 'aprovado' HOJE (ainda sem data — usa created_at):
-- SELECT p.numero_proposta, p.valor_total,
--        o.created_at::date AS obra_criada_em,
--        EXTRACT(DAY FROM now() - o.created_at)::int AS dias_parado
-- FROM obras o
-- LEFT JOIN propostas p ON p.app_id = o.proposta_app_id AND p.empresa_id = o.empresa_id
-- WHERE o.status_operacional = 'aprovado'
-- ORDER BY o.created_at ASC;
--
-- (c) Teste do trigger (obra de teste): mude o status de uma obra
--     'aprovado' → 'andamento' na tela e confirme:
-- SELECT proposta_numero, status_operacional, data_inicio_execucao
-- FROM obras WHERE data_inicio_execucao > now() - interval '1 hour';

-- ============================================================
-- ROLLBACK (somente referência — não executar automaticamente)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_obras_inicio_execucao ON obras;
-- DROP FUNCTION IF EXISTS obras_stamp_inicio_execucao();
-- ALTER TABLE obras DROP COLUMN IF EXISTS data_inicio_execucao;
-- ============================================================

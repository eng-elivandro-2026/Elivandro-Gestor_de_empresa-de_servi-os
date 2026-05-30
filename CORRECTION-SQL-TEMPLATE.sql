-- ════════════════════════════════════════════════════════════════
-- CORREÇÃO DE APONTAMENTOS DO ADRIANO
-- Data: 2026-05-30
-- Motivo: Apontamentos salvos com valor_hora_base = 0
-- Valor novo: R$ 150,00/hora
-- ════════════════════════════════════════════════════════════════

-- PASSO 1: ENCONTRAR O COLABORADOR ADRIANO
-- Execute esta query PRIMEIRO para obter o ID exato do Adriano
SELECT
  id,
  nome,
  valor_hora as valor_hora_global
FROM colaboradores
WHERE nome ILIKE '%adriano%'
ORDER BY nome;

-- Após encontrar o ID do Adriano, SUBSTITUA 'ADRIANO_ID' nas queries abaixo

-- ════════════════════════════════════════════════════════════════
-- PASSO 2: SELECT ANTES (CONFERÊNCIA INICIAL)
-- Mostre estes dados ANTES da correção
-- ════════════════════════════════════════════════════════════════

SELECT
  a.id,
  a.colaborador_id,
  a.empresa_id,
  a.data,
  a.horas_normal,
  a.horas_extra_50,
  a.horas_extra_100,
  ROUND((a.horas_normal + a.horas_extra_50 * 1.5 + a.horas_extra_100 * 2)::numeric, 2) as horas_total_calc,
  a.valor_hora_base as valor_hora_base_atual,
  a.valor_total as valor_total_atual,
  a.status,
  a.atualizado_em
FROM apontamentos a
WHERE a.colaborador_id = 'ADRIANO_ID'
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data, a.id;

-- Resultado esperado ANTES:
-- • valor_hora_base_atual = 0
-- • valor_total_atual = 0
-- • horas_total_calc = 9 ou outro valor > 0

-- ════════════════════════════════════════════════════════════════
-- PASSO 3: CÁLCULO ESPERADO
-- ════════════════════════════════════════════════════════════════

-- Calcular o que DEVE SER o valor_total
SELECT
  a.id,
  a.data,
  a.horas_normal,
  a.horas_extra_50,
  a.horas_extra_100,
  ROUND((a.horas_normal + a.horas_extra_50 * 1.5 + a.horas_extra_100 * 2)::numeric, 2) as horas_total,
  150 as novo_valor_hora_base,
  ROUND(((a.horas_normal + a.horas_extra_50 * 1.5 + a.horas_extra_100 * 2) * 150)::numeric, 2) as novo_valor_total,
  a.valor_hora_base as valor_hora_atual,
  a.valor_total as valor_total_atual
FROM apontamentos a
WHERE a.colaborador_id = 'ADRIANO_ID'
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data;

-- ════════════════════════════════════════════════════════════════
-- PASSO 4: UPDATE DE CORREÇÃO (TRANSACIONAL)
-- EXECUTE COM CUIDADO - Use ROLLBACK se algo não estiver correto
-- ════════════════════════════════════════════════════════════════

BEGIN;

UPDATE apontamentos
SET
  valor_hora_base = 150,
  valor_total = ROUND(((horas_normal + horas_extra_50 * 1.5 + horas_extra_100 * 2) * 150)::numeric, 2),
  atualizado_em = now(),
  atualizado_por = auth_usuario_id()
WHERE colaborador_id = 'ADRIANO_ID'
  AND data IN ('2026-05-26', '2026-05-27')
  AND valor_hora_base = 0;

-- VERIFICAR se a query funcionou:
-- Deve mostrar quantas linhas foram atualizadas (esperado: 2)

-- ════════════════════════════════════════════════════════════════
-- PASSO 5: SELECT DEPOIS (VERIFICAÇÃO PÓS-UPDATE)
-- Execute ANTES de COMMIT para confirmar os novos valores
-- ════════════════════════════════════════════════════════════════

SELECT
  a.id,
  a.data,
  a.horas_normal,
  a.horas_extra_50,
  a.horas_extra_100,
  ROUND((a.horas_normal + a.horas_extra_50 * 1.5 + a.horas_extra_100 * 2)::numeric, 2) as horas_total,
  a.valor_hora_base as novo_valor_hora_base,
  a.valor_total as novo_valor_total,
  a.atualizado_em,
  a.status
FROM apontamentos a
WHERE a.colaborador_id = 'ADRIANO_ID'
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data;

-- Resultado esperado DEPOIS:
-- • valor_hora_base = 150 (para ambos)
-- • valor_total = 1350 (se 9h) ou outro valor correto
-- • status = não alterado
-- • data = não alterada

-- ════════════════════════════════════════════════════════════════
-- PASSO 6: COMMIT OU ROLLBACK
-- ════════════════════════════════════════════════════════════════

-- Se os valores estão corretos:
COMMIT;

-- Se algo está errado, execute em outra transação:
-- ROLLBACK;

-- ════════════════════════════════════════════════════════════════
-- PASSO 7: SELECT FINAL (VALIDAÇÃO APÓS COMMIT)
-- Execute DEPOIS do COMMIT para confirmar persistência
-- ════════════════════════════════════════════════════════════════

SELECT
  a.id,
  a.data,
  a.valor_hora_base,
  a.valor_total,
  a.status,
  c.nome as colaborador,
  a.atualizado_em
FROM apontamentos a
JOIN colaboradores c ON a.colaborador_id = c.id
WHERE a.colaborador_id = 'ADRIANO_ID'
  AND a.data IN ('2026-05-26', '2026-05-27')
ORDER BY a.data;

-- ════════════════════════════════════════════════════════════════
-- RESUMO DA OPERAÇÃO
-- ════════════════════════════════════════════════════════════════

-- Apontamentos afetados: 2 (26/05 e 27/05)
-- Campos alterados: valor_hora_base, valor_total
-- Campos NÃO alterados: horas, status, data, entrada, saída, descrição
-- Operação: Transacional (COMMIT/ROLLBACK possível)
-- Impacto: +R$ 2.700,00 no total de dois dias
-- Risco: BAIXO (transação, RLS ativa, auditoria habilitada)

-- ════════════════════════════════════════════════════════════════
-- INSTRUÇÕES DE USO
-- ════════════════════════════════════════════════════════════════

-- 1. Abra o Supabase SQL Editor
-- 2. Execute PASSO 1 para encontrar o ID exato do Adriano
-- 3. Substitua 'ADRIANO_ID' por este ID em TODAS as queries abaixo
-- 4. Execute PASSO 2 (SELECT ANTES) e ANOTE os valores
-- 5. Execute PASSO 3 (CÁLCULO) e CONFIRME que está correto
-- 6. Execute PASSO 4 (BEGIN e UPDATE)
-- 7. Execute PASSO 5 (SELECT DEPOIS) e VALIDE os novos valores
-- 8. Se correto: Execute COMMIT
--    Se errado: Execute ROLLBACK e investigue
-- 9. Execute PASSO 7 (SELECT FINAL) para confirmar persistência

-- ════════════════════════════════════════════════════════════════

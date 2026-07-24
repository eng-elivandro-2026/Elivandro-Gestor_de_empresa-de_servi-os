-- ============================================================
-- 078_financeiro_nf_conta_receber_nullable.sql
-- Remove a gambiarra das "contas a receber fantasma" de PO.
--
-- financeiro_notas_fiscais.conta_receber_id era NOT NULL. Uma NF de
-- Pedido de Compra (tipo_nf='po') não tem conta a receber real, então
-- sbCriarPedidoCompra inventava uma conta a receber cancelada só para
-- preencher o campo. Isso deixou 6 contas fantasma (status='cancelado',
-- R$ 176.888,36) que não representam nada.
--
-- O app já trata conta_receber_id ausente de forma defensiva (botão de
-- edição desabilitado, checagens if (nf.conta_receber_id) antes de usar)
-- e já filtra tipo_nf='po' de listagens e totais. Tornar a coluna
-- nullable é seguro.
--
-- Esta migration:
--   1. torna conta_receber_id nullable
--   2. desvincula as NFs de PO das contas fantasma (seta null)
--   3. apaga as 6 contas a receber fantasma (origem='po')
--
-- O ajuste em sbCriarPedidoCompra (parar de criar a fantasma) vai no
-- mesmo PR, no código.
--
-- Idempotente. NÃO aplicar automaticamente — rodar manualmente no SQL
-- Editor do Supabase após revisão.
-- ============================================================

-- 1) Coluna passa a aceitar NULL.
ALTER TABLE financeiro_notas_fiscais
  ALTER COLUMN conta_receber_id DROP NOT NULL;

-- 2) Desvincula as NFs de PO das contas fantasma, para poder apagá-las
--    sem violar a FK. Só toca NFs cuja conta vinculada é fantasma de PO.
UPDATE financeiro_notas_fiscais nf
   SET conta_receber_id = NULL
  FROM financeiro_contas_receber cr
 WHERE nf.conta_receber_id = cr.id
   AND cr.origem = 'po';

-- 3) Apaga as contas a receber fantasma. origem='po' + status='cancelado'
--    é a assinatura exata dessas linhas; nenhuma outra conta usa origem='po'.
DELETE FROM financeiro_contas_receber
 WHERE origem = 'po';

-- ============================================================
-- FIM: 078_financeiro_nf_conta_receber_nullable.sql
-- Aplicar manualmente no SQL Editor do Supabase.
-- ============================================================

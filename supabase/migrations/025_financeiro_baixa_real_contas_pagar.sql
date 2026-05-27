-- 025_financeiro_baixa_real_contas_pagar.sql
-- F3.8-B - RPC transacional para baixa real de Contas a Pagar.
--
-- Objetivo:
--   Registrar uma baixa real de CP em uma unica transacao:
--   1. cria financeiro_pagamentos;
--   2. cria financeiro_movimentos_caixa realizado;
--   3. atualiza financeiro_contas_pagar;
--   4. vincula pagamento ao movimento criado.
--
-- Escopo:
--   - nao altera tela;
--   - nao altera Contas a Receber;
--   - nao altera DRE;
--   - nao altera XML fornecedor;
--   - nao altera Banco de Precos;
--   - nao adiciona meio/fonte em financeiro_movimentos_caixa.


-- ============================================================
-- ORIGEM DE PAGAMENTO
-- Permite rastrear pagamentos criados pela baixa real de CP.
-- Status permanece "registrado"; a efetivacao e marcada pelo
-- movimento_caixa_id preenchido.
-- ============================================================

ALTER TABLE financeiro_pagamentos
  DROP CONSTRAINT IF EXISTS fpag_origem_check;

ALTER TABLE financeiro_pagamentos
  ADD CONSTRAINT fpag_origem_check CHECK (
    origem IN ('manual', 'xml_fornecedor', 'ajuste', 'outro', 'baixa_cp')
  );


-- ============================================================
-- RPC: financeiro_registrar_baixa_conta_pagar
-- ============================================================

CREATE OR REPLACE FUNCTION financeiro_registrar_baixa_conta_pagar(
  p_empresa_id uuid,
  p_conta_pagar_id uuid,
  p_valor_pago numeric,
  p_data_pagamento date,
  p_meio_pagamento_id uuid,
  p_fonte_financeira_id uuid,
  p_observacao text DEFAULT NULL,
  p_comprovante_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_cp financeiro_contas_pagar%ROWTYPE;
  v_pagamento_id uuid;
  v_movimento_id uuid;
  v_valor_pago numeric(14,2);
  v_valor_pendente_atual numeric(14,2);
  v_novo_valor_pago numeric(14,2);
  v_novo_valor_pendente numeric(14,2);
  v_novo_status text;
  v_data_pagamento_cp date;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa obrigatoria.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM auth_empresa_ids() AS e(empresa_id)
    WHERE e.empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Usuario sem acesso a empresa informada.';
  END IF;

  IF auth_perfil() IN ('colaborador', 'prestador', 'leitura') THEN
    RAISE EXCEPTION 'Perfil sem permissao para baixar conta a pagar.';
  END IF;

  IF p_conta_pagar_id IS NULL THEN
    RAISE EXCEPTION 'Conta a pagar obrigatoria.';
  END IF;

  IF p_data_pagamento IS NULL THEN
    RAISE EXCEPTION 'Data de pagamento obrigatoria.';
  END IF;

  IF p_valor_pago IS NULL OR p_valor_pago <= 0 THEN
    RAISE EXCEPTION 'Valor pago deve ser maior que zero.';
  END IF;

  IF p_meio_pagamento_id IS NULL THEN
    RAISE EXCEPTION 'Meio de pagamento obrigatorio.';
  END IF;

  IF p_fonte_financeira_id IS NULL THEN
    RAISE EXCEPTION 'Fonte financeira obrigatoria.';
  END IF;

  v_valor_pago := round(p_valor_pago::numeric, 2);

  SELECT *
  INTO v_cp
  FROM financeiro_contas_pagar
  WHERE id = p_conta_pagar_id
    AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta a pagar nao encontrada para a empresa informada.';
  END IF;

  IF lower(coalesce(v_cp.status, '')) IN ('cancelado', 'cancelada') THEN
    RAISE EXCEPTION 'Conta a pagar cancelada nao pode ser baixada.';
  END IF;

  IF lower(coalesce(v_cp.status, '')) IN ('pago', 'paga', 'quitado', 'quitada') THEN
    RAISE EXCEPTION 'Conta a pagar ja esta quitada.';
  END IF;

  v_valor_pendente_atual := round(coalesce(v_cp.valor_pendente, 0)::numeric, 2);

  IF v_valor_pendente_atual <= 0 THEN
    RAISE EXCEPTION 'Conta a pagar sem saldo pendente para baixa.';
  END IF;

  IF v_valor_pago > v_valor_pendente_atual THEN
    RAISE EXCEPTION 'Valor pago maior que o saldo pendente atual.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM financeiro_meios_pagamento
    WHERE id = p_meio_pagamento_id
      AND empresa_id = p_empresa_id
      AND ativo IS TRUE
      AND natureza IN ('pagamento', 'ambos')
  ) THEN
    RAISE EXCEPTION 'Meio de pagamento invalido para a empresa informada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM financeiro_fontes_financeiras
    WHERE id = p_fonte_financeira_id
      AND empresa_id = p_empresa_id
      AND ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Fonte financeira invalida para a empresa informada.';
  END IF;

  v_novo_valor_pago := round((coalesce(v_cp.valor_pago, 0) + v_valor_pago)::numeric, 2);
  v_novo_valor_pendente := greatest(
    0,
    round((coalesce(v_cp.valor_previsto, 0) - v_novo_valor_pago)::numeric, 2)
  );
  v_novo_status := CASE
    WHEN v_novo_valor_pendente = 0 THEN 'pago'
    ELSE 'parcial'
  END;
  v_data_pagamento_cp := CASE
    WHEN v_novo_status = 'pago' THEN p_data_pagamento
    ELSE v_cp.data_pagamento
  END;

  INSERT INTO financeiro_pagamentos (
    empresa_id,
    conta_pagar_id,
    meio_pagamento_id,
    fonte_financeira_id,
    data_pagamento,
    valor_pago,
    observacao,
    comprovante_url,
    status,
    origem,
    referencia_id
  )
  VALUES (
    p_empresa_id,
    p_conta_pagar_id,
    p_meio_pagamento_id,
    p_fonte_financeira_id,
    p_data_pagamento,
    v_valor_pago,
    p_observacao,
    p_comprovante_url,
    'registrado',
    'baixa_cp',
    'cp:' || p_conta_pagar_id::text
  )
  RETURNING id INTO v_pagamento_id;

  INSERT INTO financeiro_movimentos_caixa (
    empresa_id,
    tipo,
    natureza,
    origem,
    referencia_id,
    data_prevista,
    data_real,
    valor_previsto,
    valor_real,
    status,
    categoria,
    centro_custo,
    descricao,
    conciliado,
    categoria_gerencial_id
  )
  VALUES (
    p_empresa_id,
    'saida',
    'realizado',
    'pagamento_cp',
    'pagamento:' || v_pagamento_id::text,
    v_cp.data_vencimento,
    p_data_pagamento,
    0,
    v_valor_pago,
    'realizado',
    v_cp.categoria,
    v_cp.centro_custo,
    'Baixa CP - ' || coalesce(v_cp.descricao, v_cp.fornecedor_nome, p_conta_pagar_id::text),
    false,
    v_cp.categoria_gerencial_id
  )
  RETURNING id INTO v_movimento_id;

  UPDATE financeiro_pagamentos
  SET movimento_caixa_id = v_movimento_id
  WHERE id = v_pagamento_id
    AND empresa_id = p_empresa_id
    AND movimento_caixa_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel vincular pagamento ao movimento de caixa.';
  END IF;

  UPDATE financeiro_contas_pagar
  SET valor_pago = v_novo_valor_pago,
      valor_pendente = v_novo_valor_pendente,
      status = v_novo_status,
      data_pagamento = v_data_pagamento_cp
  WHERE id = p_conta_pagar_id
    AND empresa_id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel atualizar a conta a pagar.';
  END IF;

  RETURN jsonb_build_object(
    'empresa_id', p_empresa_id,
    'conta_pagar_id', p_conta_pagar_id,
    'pagamento_id', v_pagamento_id,
    'movimento_caixa_id', v_movimento_id,
    'valor_pago_baixa', v_valor_pago,
    'valor_pago_total', v_novo_valor_pago,
    'valor_pendente', v_novo_valor_pendente,
    'status', v_novo_status,
    'data_pagamento_cp', v_data_pagamento_cp
  );
END;
$$;

REVOKE ALL ON FUNCTION financeiro_registrar_baixa_conta_pagar(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION financeiro_registrar_baixa_conta_pagar(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) TO authenticated;


-- ============================================================
-- Rollback manual sugerido, se necessario em ambiente de revisao:
--
-- REVOKE ALL ON FUNCTION financeiro_registrar_baixa_conta_pagar(
--   uuid, uuid, numeric, date, uuid, uuid, text, text
-- ) FROM authenticated;
-- DROP FUNCTION IF EXISTS financeiro_registrar_baixa_conta_pagar(
--   uuid, uuid, numeric, date, uuid, uuid, text, text
-- );
-- ALTER TABLE financeiro_pagamentos DROP CONSTRAINT IF EXISTS fpag_origem_check;
-- ALTER TABLE financeiro_pagamentos
--   ADD CONSTRAINT fpag_origem_check CHECK (
--     origem IN ('manual', 'xml_fornecedor', 'ajuste', 'outro')
--   );
--
-- Observacao: restaurar a constraint antiga so e possivel se nao houver
-- registros com origem = 'baixa_cp'.
-- ============================================================

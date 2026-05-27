-- 027_financeiro_recebimento_real_contas_receber.sql
-- F3.9-B - RPC transacional para recebimento real de Contas a Receber.
--
-- Objetivo:
--   Registrar um recebimento real de CR em uma unica transacao:
--   1. cria financeiro_recebimentos;
--   2. cria financeiro_movimentos_caixa realizado;
--   3. atualiza financeiro_contas_receber;
--   4. vincula recebimento ao movimento criado.
--
-- Escopo:
--   - nao altera tela;
--   - nao altera Contas a Pagar;
--   - nao altera DRE;
--   - nao altera XML fornecedor;
--   - nao altera Banco de Precos.


-- ============================================================
-- ESTRUTURA DE RASTREABILIDADE DO RECEBIMENTO REAL
-- Campos nullable para manter compatibilidade com registros antigos.
-- ============================================================

ALTER TABLE financeiro_recebimentos
  ADD COLUMN IF NOT EXISTS meio_pagamento_id uuid;

ALTER TABLE financeiro_recebimentos
  ADD COLUMN IF NOT EXISTS fonte_financeira_id uuid;

ALTER TABLE financeiro_recebimentos
  ADD COLUMN IF NOT EXISTS movimento_caixa_id uuid;

ALTER TABLE financeiro_recebimentos
  ADD COLUMN IF NOT EXISTS origem text;

ALTER TABLE financeiro_recebimentos
  ADD COLUMN IF NOT EXISTS referencia_id text;

ALTER TABLE financeiro_contas_receber
  ADD COLUMN IF NOT EXISTS data_recebimento date;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'frec_meio_pagamento_fk'
      AND conrelid = 'financeiro_recebimentos'::regclass
  ) THEN
    ALTER TABLE financeiro_recebimentos
      ADD CONSTRAINT frec_meio_pagamento_fk
      FOREIGN KEY (meio_pagamento_id)
      REFERENCES financeiro_meios_pagamento (id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'frec_fonte_financeira_fk'
      AND conrelid = 'financeiro_recebimentos'::regclass
  ) THEN
    ALTER TABLE financeiro_recebimentos
      ADD CONSTRAINT frec_fonte_financeira_fk
      FOREIGN KEY (fonte_financeira_id)
      REFERENCES financeiro_fontes_financeiras (id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'frec_movimento_caixa_fk'
      AND conrelid = 'financeiro_recebimentos'::regclass
  ) THEN
    ALTER TABLE financeiro_recebimentos
      ADD CONSTRAINT frec_movimento_caixa_fk
      FOREIGN KEY (movimento_caixa_id)
      REFERENCES financeiro_movimentos_caixa (id)
      ON DELETE SET NULL;
  END IF;
END $$;


CREATE INDEX IF NOT EXISTS idx_frec_meio_pagamento_id
  ON financeiro_recebimentos (meio_pagamento_id);

CREATE INDEX IF NOT EXISTS idx_frec_fonte_financeira_id
  ON financeiro_recebimentos (fonte_financeira_id);

CREATE INDEX IF NOT EXISTS idx_frec_movimento_caixa_id
  ON financeiro_recebimentos (movimento_caixa_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_frec_movimento_caixa_unique
  ON financeiro_recebimentos (movimento_caixa_id)
  WHERE movimento_caixa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_frec_origem
  ON financeiro_recebimentos (empresa_id, origem);

CREATE INDEX IF NOT EXISTS idx_frec_referencia_id
  ON financeiro_recebimentos (referencia_id);

CREATE INDEX IF NOT EXISTS idx_fcr_data_recebimento
  ON financeiro_contas_receber (empresa_id, data_recebimento);


-- ============================================================
-- RPC: financeiro_registrar_recebimento_conta_receber
-- ============================================================

CREATE OR REPLACE FUNCTION financeiro_registrar_recebimento_conta_receber(
  p_empresa_id uuid,
  p_conta_receber_id uuid,
  p_valor_recebido numeric,
  p_data_recebimento date,
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
  v_cr financeiro_contas_receber%ROWTYPE;
  v_meio financeiro_meios_pagamento%ROWTYPE;
  v_recebimento_id uuid;
  v_movimento_id uuid;
  v_valor_recebido numeric(14,2);
  v_valor_pendente_atual numeric(14,2);
  v_novo_valor_recebido numeric(14,2);
  v_novo_valor_pendente numeric(14,2);
  v_novo_status text;
  v_data_recebimento_cr date;
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
    RAISE EXCEPTION 'Perfil sem permissao para receber conta a receber.';
  END IF;

  IF p_conta_receber_id IS NULL THEN
    RAISE EXCEPTION 'Conta a receber obrigatoria.';
  END IF;

  IF p_data_recebimento IS NULL THEN
    RAISE EXCEPTION 'Data de recebimento obrigatoria.';
  END IF;

  IF p_valor_recebido IS NULL OR p_valor_recebido <= 0 THEN
    RAISE EXCEPTION 'Valor recebido deve ser maior que zero.';
  END IF;

  IF p_meio_pagamento_id IS NULL THEN
    RAISE EXCEPTION 'Meio de pagamento obrigatorio.';
  END IF;

  IF p_fonte_financeira_id IS NULL THEN
    RAISE EXCEPTION 'Fonte financeira obrigatoria.';
  END IF;

  v_valor_recebido := round(p_valor_recebido::numeric, 2);

  SELECT *
  INTO v_cr
  FROM financeiro_contas_receber
  WHERE id = p_conta_receber_id
    AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conta a receber nao encontrada para a empresa informada.';
  END IF;

  IF lower(coalesce(v_cr.status, '')) IN ('cancelado', 'cancelada') THEN
    RAISE EXCEPTION 'Conta a receber cancelada nao pode ser recebida.';
  END IF;

  IF lower(coalesce(v_cr.status, '')) IN ('recebido', 'recebida', 'quitado', 'quitada', 'pago', 'paga') THEN
    RAISE EXCEPTION 'Conta a receber ja esta quitada.';
  END IF;

  -- Compatibilidade: registros antigos podem ter valor_pendente zerado
  -- mesmo com valor_previsto maior que valor_recebido. Usa o maior saldo
  -- calculavel para evitar bloquear CR legada inconsistente.
  v_valor_pendente_atual := greatest(
    0,
    round(coalesce(v_cr.valor_pendente, 0)::numeric, 2),
    round((coalesce(v_cr.valor_previsto, 0) - coalesce(v_cr.valor_recebido, 0))::numeric, 2)
  );

  IF v_valor_pendente_atual <= 0 THEN
    RAISE EXCEPTION 'Conta a receber sem saldo pendente para recebimento.';
  END IF;

  IF v_valor_recebido > v_valor_pendente_atual THEN
    RAISE EXCEPTION 'Valor recebido maior que o saldo pendente atual.';
  END IF;

  SELECT *
  INTO v_meio
  FROM financeiro_meios_pagamento
  WHERE id = p_meio_pagamento_id
    AND empresa_id = p_empresa_id
    AND ativo IS TRUE
    AND natureza IN ('recebimento', 'ambos');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meio de pagamento invalido para recebimento nesta empresa.';
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

  v_novo_valor_recebido := round((coalesce(v_cr.valor_recebido, 0) + v_valor_recebido)::numeric, 2);
  v_novo_valor_pendente := greatest(
    0,
    round((coalesce(v_cr.valor_previsto, 0) - v_novo_valor_recebido)::numeric, 2)
  );
  v_novo_status := CASE
    WHEN v_novo_valor_pendente = 0 THEN 'recebido'
    ELSE 'parcialmente_recebido'
  END;
  v_data_recebimento_cr := CASE
    WHEN v_novo_status = 'recebido' THEN p_data_recebimento
    ELSE v_cr.data_recebimento
  END;

  INSERT INTO financeiro_recebimentos (
    empresa_id,
    conta_receber_id,
    proposta_app_id,
    obra_id,
    data_recebimento,
    valor_recebido,
    forma_recebimento,
    meio_pagamento_id,
    fonte_financeira_id,
    comprovante_url,
    observacoes,
    status,
    origem,
    referencia_id
  )
  VALUES (
    p_empresa_id,
    p_conta_receber_id,
    v_cr.proposta_app_id,
    v_cr.obra_id,
    p_data_recebimento,
    v_valor_recebido,
    v_meio.tipo,
    p_meio_pagamento_id,
    p_fonte_financeira_id,
    p_comprovante_url,
    p_observacao,
    'confirmado',
    'recebimento_cr',
    'cr:' || p_conta_receber_id::text
  )
  RETURNING id INTO v_recebimento_id;

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
    'entrada',
    'realizado',
    'recebimento_cr',
    'receb:' || v_recebimento_id::text,
    v_cr.data_vencimento,
    p_data_recebimento,
    0,
    v_valor_recebido,
    'realizado',
    null,
    v_cr.centro_custo,
    'Recebimento CR - ' || coalesce(v_cr.cliente_nome, v_cr.titulo, p_conta_receber_id::text),
    false,
    v_cr.categoria_gerencial_id
  )
  RETURNING id INTO v_movimento_id;

  UPDATE financeiro_recebimentos
  SET movimento_caixa_id = v_movimento_id
  WHERE id = v_recebimento_id
    AND empresa_id = p_empresa_id
    AND movimento_caixa_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel vincular recebimento ao movimento de caixa.';
  END IF;

  UPDATE financeiro_contas_receber
  SET valor_recebido = v_novo_valor_recebido,
      valor_pendente = v_novo_valor_pendente,
      status = v_novo_status,
      data_recebimento = v_data_recebimento_cr
  WHERE id = p_conta_receber_id
    AND empresa_id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel atualizar a conta a receber.';
  END IF;

  RETURN jsonb_build_object(
    'empresa_id', p_empresa_id,
    'conta_receber_id', p_conta_receber_id,
    'recebimento_id', v_recebimento_id,
    'movimento_caixa_id', v_movimento_id,
    'valor_recebido_baixa', v_valor_recebido,
    'valor_recebido_total', v_novo_valor_recebido,
    'valor_pendente', v_novo_valor_pendente,
    'status', v_novo_status,
    'data_recebimento_cr', v_data_recebimento_cr
  );
END;
$$;

REVOKE ALL ON FUNCTION financeiro_registrar_recebimento_conta_receber(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION financeiro_registrar_recebimento_conta_receber(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION financeiro_registrar_recebimento_conta_receber(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION financeiro_registrar_recebimento_conta_receber(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) TO service_role;


-- ============================================================
-- Rollback manual sugerido, se necessario em ambiente de revisao:
--
-- REVOKE ALL ON FUNCTION financeiro_registrar_recebimento_conta_receber(
--   uuid, uuid, numeric, date, uuid, uuid, text, text
-- ) FROM authenticated;
-- REVOKE ALL ON FUNCTION financeiro_registrar_recebimento_conta_receber(
--   uuid, uuid, numeric, date, uuid, uuid, text, text
-- ) FROM service_role;
-- DROP FUNCTION IF EXISTS financeiro_registrar_recebimento_conta_receber(
--   uuid, uuid, numeric, date, uuid, uuid, text, text
-- );
-- DROP INDEX IF EXISTS idx_fcr_data_recebimento;
-- DROP INDEX IF EXISTS idx_frec_referencia_id;
-- DROP INDEX IF EXISTS idx_frec_origem;
-- DROP INDEX IF EXISTS idx_frec_movimento_caixa_unique;
-- DROP INDEX IF EXISTS idx_frec_movimento_caixa_id;
-- DROP INDEX IF EXISTS idx_frec_fonte_financeira_id;
-- DROP INDEX IF EXISTS idx_frec_meio_pagamento_id;
-- ALTER TABLE financeiro_recebimentos DROP CONSTRAINT IF EXISTS frec_movimento_caixa_fk;
-- ALTER TABLE financeiro_recebimentos DROP CONSTRAINT IF EXISTS frec_fonte_financeira_fk;
-- ALTER TABLE financeiro_recebimentos DROP CONSTRAINT IF EXISTS frec_meio_pagamento_fk;
-- ALTER TABLE financeiro_contas_receber DROP COLUMN IF EXISTS data_recebimento;
-- ALTER TABLE financeiro_recebimentos DROP COLUMN IF EXISTS referencia_id;
-- ALTER TABLE financeiro_recebimentos DROP COLUMN IF EXISTS origem;
-- ALTER TABLE financeiro_recebimentos DROP COLUMN IF EXISTS movimento_caixa_id;
-- ALTER TABLE financeiro_recebimentos DROP COLUMN IF EXISTS fonte_financeira_id;
-- ALTER TABLE financeiro_recebimentos DROP COLUMN IF EXISTS meio_pagamento_id;
--
-- Nao executar rollback automaticamente em producao.
-- ============================================================

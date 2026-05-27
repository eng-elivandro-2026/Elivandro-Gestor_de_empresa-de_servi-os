-- 028_financeiro_conciliacao_manual_basica.sql
-- F3.12-B - Base segura para conciliacao manual de movimentos de caixa.
--
-- Objetivo:
--   Criar trilha de auditoria para conciliacao manual sem alterar telas,
--   CP, CR, Fluxo, DRE, XML fornecedor ou Banco de Precos.
--
-- Escopo:
--   - cria tabela financeiro_conciliacoes_movimentos;
--   - cria RPC transacional financeiro_conciliar_movimento_caixa;
--   - atualiza somente financeiro_movimentos_caixa.conciliado pela RPC.


-- ============================================================
-- GARANTIAS COMPOSTAS PARA FKs MULTIEMPRESA
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fmc_empresa_id_id_unique'
      AND conrelid = 'financeiro_movimentos_caixa'::regclass
  ) THEN
    ALTER TABLE financeiro_movimentos_caixa
      ADD CONSTRAINT fmc_empresa_id_id_unique UNIQUE (empresa_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fff_empresa_id_id_unique'
      AND conrelid = 'financeiro_fontes_financeiras'::regclass
  ) THEN
    ALTER TABLE financeiro_fontes_financeiras
      ADD CONSTRAINT fff_empresa_id_id_unique UNIQUE (empresa_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fmp_empresa_id_id_unique'
      AND conrelid = 'financeiro_meios_pagamento'::regclass
  ) THEN
    ALTER TABLE financeiro_meios_pagamento
      ADD CONSTRAINT fmp_empresa_id_id_unique UNIQUE (empresa_id, id);
  END IF;
END $$;


-- ============================================================
-- TABELA: financeiro_conciliacoes_movimentos
-- ============================================================

CREATE TABLE IF NOT EXISTS financeiro_conciliacoes_movimentos (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id               uuid NOT NULL REFERENCES empresas(id),
  movimento_caixa_id       uuid NOT NULL,
  fonte_financeira_id      uuid,
  meio_pagamento_id        uuid,
  data_conciliacao         date NOT NULL DEFAULT current_date,
  observacao               text,
  comprovante_url          text,
  identificador_bancario   text,
  status                   text NOT NULL DEFAULT 'conciliado',
  created_by               uuid DEFAULT auth_usuario_id(),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT fcm_status_check CHECK (status IN ('conciliado', 'cancelado')),
  CONSTRAINT fcm_observacao_len_check CHECK (
    observacao IS NULL OR length(observacao) <= 1000
  ),
  CONSTRAINT fcm_comprovante_len_check CHECK (
    comprovante_url IS NULL OR length(comprovante_url) <= 2048
  ),
  CONSTRAINT fcm_identificador_len_check CHECK (
    identificador_bancario IS NULL OR length(identificador_bancario) <= 255
  ),
  CONSTRAINT fcm_movimento_unique UNIQUE (movimento_caixa_id),
  CONSTRAINT fcm_movimento_empresa_fk
    FOREIGN KEY (empresa_id, movimento_caixa_id)
    REFERENCES financeiro_movimentos_caixa (empresa_id, id),
  CONSTRAINT fcm_fonte_empresa_fk
    FOREIGN KEY (empresa_id, fonte_financeira_id)
    REFERENCES financeiro_fontes_financeiras (empresa_id, id),
  CONSTRAINT fcm_meio_empresa_fk
    FOREIGN KEY (empresa_id, meio_pagamento_id)
    REFERENCES financeiro_meios_pagamento (empresa_id, id)
);

CREATE INDEX IF NOT EXISTS idx_fcm_empresa_id
  ON financeiro_conciliacoes_movimentos (empresa_id);

CREATE INDEX IF NOT EXISTS idx_fcm_movimento_caixa_id
  ON financeiro_conciliacoes_movimentos (movimento_caixa_id);

CREATE INDEX IF NOT EXISTS idx_fcm_fonte_financeira_id
  ON financeiro_conciliacoes_movimentos (fonte_financeira_id);

CREATE INDEX IF NOT EXISTS idx_fcm_meio_pagamento_id
  ON financeiro_conciliacoes_movimentos (meio_pagamento_id);

CREATE INDEX IF NOT EXISTS idx_fcm_data_conciliacao
  ON financeiro_conciliacoes_movimentos (empresa_id, data_conciliacao);

CREATE INDEX IF NOT EXISTS idx_fcm_status
  ON financeiro_conciliacoes_movimentos (empresa_id, status);

CREATE INDEX IF NOT EXISTS idx_fcm_created_at
  ON financeiro_conciliacoes_movimentos (created_at);

DROP TRIGGER IF EXISTS trg_fcm_updated_at ON financeiro_conciliacoes_movimentos;
CREATE TRIGGER trg_fcm_updated_at
  BEFORE UPDATE ON financeiro_conciliacoes_movimentos
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE financeiro_conciliacoes_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcm: ver da empresa" ON financeiro_conciliacoes_movimentos;
CREATE POLICY "fcm: ver da empresa"
  ON financeiro_conciliacoes_movimentos FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "fcm: inserir na empresa" ON financeiro_conciliacoes_movimentos;
CREATE POLICY "fcm: inserir na empresa"
  ON financeiro_conciliacoes_movimentos FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador', 'leitura')
  );


-- ============================================================
-- RPC: financeiro_conciliar_movimento_caixa
-- ============================================================

CREATE OR REPLACE FUNCTION financeiro_conciliar_movimento_caixa(
  p_empresa_id uuid,
  p_movimento_caixa_id uuid,
  p_fonte_financeira_id uuid DEFAULT NULL,
  p_meio_pagamento_id uuid DEFAULT NULL,
  p_data_conciliacao date DEFAULT current_date,
  p_observacao text DEFAULT NULL,
  p_comprovante_url text DEFAULT NULL,
  p_identificador_bancario text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_movimento financeiro_movimentos_caixa%ROWTYPE;
  v_conciliacao_id uuid;
  v_data_conciliacao date;
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
    RAISE EXCEPTION 'Perfil sem permissao para conciliar movimento.';
  END IF;

  IF p_movimento_caixa_id IS NULL THEN
    RAISE EXCEPTION 'Movimento de caixa obrigatorio.';
  END IF;

  v_data_conciliacao := coalesce(p_data_conciliacao, current_date);

  IF p_observacao IS NOT NULL AND length(p_observacao) > 1000 THEN
    RAISE EXCEPTION 'Observacao da conciliacao excede 1000 caracteres.';
  END IF;

  IF p_comprovante_url IS NOT NULL AND length(p_comprovante_url) > 2048 THEN
    RAISE EXCEPTION 'Comprovante da conciliacao excede 2048 caracteres.';
  END IF;

  IF p_identificador_bancario IS NOT NULL AND length(p_identificador_bancario) > 255 THEN
    RAISE EXCEPTION 'Identificador bancario excede 255 caracteres.';
  END IF;

  SELECT *
  INTO v_movimento
  FROM financeiro_movimentos_caixa
  WHERE id = p_movimento_caixa_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Movimento de caixa nao encontrado.';
  END IF;

  IF v_movimento.empresa_id <> p_empresa_id THEN
    RAISE EXCEPTION 'Movimento de caixa pertence a outra empresa.';
  END IF;

  IF lower(coalesce(v_movimento.natureza, '')) <> 'realizado'
     OR lower(coalesce(v_movimento.status, '')) <> 'realizado' THEN
    RAISE EXCEPTION 'Somente movimentos realizados podem ser conciliados.';
  END IF;

  IF v_movimento.conciliado IS TRUE THEN
    RAISE EXCEPTION 'Movimento de caixa ja conciliado.';
  END IF;

  IF p_fonte_financeira_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM financeiro_fontes_financeiras
       WHERE id = p_fonte_financeira_id
         AND empresa_id = p_empresa_id
         AND ativo IS TRUE
     ) THEN
    RAISE EXCEPTION 'Fonte financeira invalida para a empresa informada.';
  END IF;

  IF p_meio_pagamento_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM financeiro_meios_pagamento
       WHERE id = p_meio_pagamento_id
         AND empresa_id = p_empresa_id
         AND ativo IS TRUE
     ) THEN
    RAISE EXCEPTION 'Meio de pagamento invalido para a empresa informada.';
  END IF;

  INSERT INTO financeiro_conciliacoes_movimentos (
    empresa_id,
    movimento_caixa_id,
    fonte_financeira_id,
    meio_pagamento_id,
    data_conciliacao,
    observacao,
    comprovante_url,
    identificador_bancario,
    status
  )
  VALUES (
    p_empresa_id,
    p_movimento_caixa_id,
    p_fonte_financeira_id,
    p_meio_pagamento_id,
    v_data_conciliacao,
    p_observacao,
    p_comprovante_url,
    p_identificador_bancario,
    'conciliado'
  )
  RETURNING id INTO v_conciliacao_id;

  UPDATE financeiro_movimentos_caixa
  SET conciliado = true
  WHERE id = p_movimento_caixa_id
    AND empresa_id = p_empresa_id
    AND conciliado IS FALSE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nao foi possivel marcar movimento como conciliado.';
  END IF;

  RETURN jsonb_build_object(
    'empresa_id', p_empresa_id,
    'movimento_caixa_id', p_movimento_caixa_id,
    'conciliacao_id', v_conciliacao_id,
    'fonte_financeira_id', p_fonte_financeira_id,
    'meio_pagamento_id', p_meio_pagamento_id,
    'data_conciliacao', v_data_conciliacao,
    'status', 'conciliado'
  );
END;
$$;

REVOKE ALL ON FUNCTION financeiro_conciliar_movimento_caixa(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION financeiro_conciliar_movimento_caixa(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION financeiro_conciliar_movimento_caixa(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION financeiro_conciliar_movimento_caixa(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  text
) TO service_role;


-- ============================================================
-- Rollback manual sugerido, se necessario em ambiente de revisao:
--
-- REVOKE ALL ON FUNCTION financeiro_conciliar_movimento_caixa(
--   uuid, uuid, uuid, uuid, date, text, text, text
-- ) FROM authenticated;
-- REVOKE ALL ON FUNCTION financeiro_conciliar_movimento_caixa(
--   uuid, uuid, uuid, uuid, date, text, text, text
-- ) FROM service_role;
-- DROP FUNCTION IF EXISTS financeiro_conciliar_movimento_caixa(
--   uuid, uuid, uuid, uuid, date, text, text, text
-- );
-- DROP TABLE IF EXISTS financeiro_conciliacoes_movimentos;
-- ALTER TABLE financeiro_meios_pagamento
--   DROP CONSTRAINT IF EXISTS fmp_empresa_id_id_unique;
-- ALTER TABLE financeiro_fontes_financeiras
--   DROP CONSTRAINT IF EXISTS fff_empresa_id_id_unique;
-- ALTER TABLE financeiro_movimentos_caixa
--   DROP CONSTRAINT IF EXISTS fmc_empresa_id_id_unique;
--
-- Nao executar rollback automaticamente em producao.
-- ============================================================

-- ============================================================
-- 005_operacional_recebimento_mobilizacao.sql
-- Fase 1C do modulo Operacional: recebimento, mobilizacao e recursos.
-- ============================================================

ALTER TABLE obras ADD COLUMN IF NOT EXISTS recebimento_status text DEFAULT 'nao_iniciado';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS data_recebimento_operacional date;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS responsavel_recebimento_nome text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS pedido_compra_recebido boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS numero_pedido_compra text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS escopo_conferido boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS prazo_validado boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS condicao_pagamento_conferida boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS proposta_aprovada_conferida boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS observacoes_recebimento text;

ALTER TABLE obras ADD COLUMN IF NOT EXISTS area_local text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS equipamento_maquina_linha text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS endereco_execucao text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS cidade_execucao text;

ALTER TABLE obras ADD COLUMN IF NOT EXISTS integracao_obrigatoria boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS dds_obrigatorio boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS apr_obrigatoria_obra boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS pt_obrigatoria_obra boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS isolamento_area_obrigatorio boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS bloqueio_etiquetagem_obrigatorio boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS art_obrigatoria boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS aso_obrigatorio boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS nr10_obrigatoria boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS nr35_obrigatoria boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS pgr_pcmso_obrigatorio boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS observacoes_seguranca_obra text;

ALTER TABLE obras ADD COLUMN IF NOT EXISTS horario_inicio_previsto time;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS horario_termino_previsto time;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS intervalo_almoco_previsto_minutos integer DEFAULT 60;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS dias_trabalho_previstos text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS horario_definido_pelo_cliente boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS permite_hora_extra boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS permite_trabalho_fim_semana boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS observacoes_horario text;

ALTER TABLE obras ADD COLUMN IF NOT EXISTS tipo_alimentacao_padrao text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS local_alimentacao_padrao text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS observacoes_alimentacao_padrao text;

ALTER TABLE obras ADD COLUMN IF NOT EXISTS precisa_mobilizacao boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS precisa_hotel boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS hotel_previsto text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS precisa_veiculo boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS veiculo_previsto text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS precisa_combustivel boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS precisa_pedagio boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS precisa_estacionamento boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS precisa_adiantamento boolean DEFAULT false;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS valor_adiantamento_previsto numeric(14,2) DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS responsavel_mobilizacao_nome text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS ponto_encontro_equipe text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS horario_encontro_equipe time;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS observacoes_mobilizacao_obra text;

ALTER TABLE obras ADD COLUMN IF NOT EXISTS plano_contingencia_material text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS responsavel_compra_emergencial text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS responsavel_retirada_emergencial text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS precisa_aprovacao_compra_emergencial boolean DEFAULT true;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS observacoes_contingencia_material text;

CREATE TABLE IF NOT EXISTS obra_recursos_campo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  item text NOT NULL,
  obrigatorio boolean DEFAULT false,
  quantidade_prevista numeric(14,3) DEFAULT 1,
  responsavel text,
  status text DEFAULT 'previsto',
  observacoes text,
  created_by uuid DEFAULT auth_usuario_id(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT obra_recursos_empresa_obra_categoria_item_unique UNIQUE (empresa_id, obra_id, categoria, item)
);

CREATE INDEX IF NOT EXISTS idx_obra_recursos_empresa_id ON obra_recursos_campo (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_recursos_obra_id ON obra_recursos_campo (obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_recursos_categoria ON obra_recursos_campo (categoria);
CREATE INDEX IF NOT EXISTS idx_obra_recursos_status ON obra_recursos_campo (status);

CREATE OR REPLACE FUNCTION obra_recursos_campo_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obra_recursos_campo_updated_at ON obra_recursos_campo;
CREATE TRIGGER trg_obra_recursos_campo_updated_at
BEFORE UPDATE ON obra_recursos_campo
FOR EACH ROW
EXECUTE FUNCTION obra_recursos_campo_set_updated_at();

ALTER TABLE obra_recursos_campo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_recursos_campo: ver da empresa" ON obra_recursos_campo;
CREATE POLICY "obra_recursos_campo: ver da empresa"
  ON obra_recursos_campo FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "obra_recursos_campo: inserir na empresa" ON obra_recursos_campo;
CREATE POLICY "obra_recursos_campo: inserir na empresa"
  ON obra_recursos_campo FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "obra_recursos_campo: atualizar na empresa" ON obra_recursos_campo;
CREATE POLICY "obra_recursos_campo: atualizar na empresa"
  ON obra_recursos_campo FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "obra_recursos_campo: deletar gestor+" ON obra_recursos_campo;
CREATE POLICY "obra_recursos_campo: deletar gestor+"
  ON obra_recursos_campo FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );

CREATE TABLE IF NOT EXISTS obra_mobilizacao_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  colaborador_id uuid,
  nome_colaborador text NOT NULL,
  funcao text,
  forma_deslocamento text,
  carona_com text,
  ponto_encontro text,
  horario_encontro time,
  precisa_adiantamento boolean DEFAULT false,
  valor_adiantamento numeric(14,2) DEFAULT 0,
  veiculo_utilizado text,
  motorista text,
  precisa_reembolso boolean DEFAULT false,
  comprovante_obrigatorio boolean DEFAULT false,
  observacoes text,
  created_by uuid DEFAULT auth_usuario_id(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obra_mobilizacao_empresa_id ON obra_mobilizacao_equipe (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_mobilizacao_obra_id ON obra_mobilizacao_equipe (obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_mobilizacao_nome ON obra_mobilizacao_equipe (nome_colaborador);
CREATE INDEX IF NOT EXISTS idx_obra_mobilizacao_forma ON obra_mobilizacao_equipe (forma_deslocamento);

CREATE OR REPLACE FUNCTION obra_mobilizacao_equipe_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obra_mobilizacao_equipe_updated_at ON obra_mobilizacao_equipe;
CREATE TRIGGER trg_obra_mobilizacao_equipe_updated_at
BEFORE UPDATE ON obra_mobilizacao_equipe
FOR EACH ROW
EXECUTE FUNCTION obra_mobilizacao_equipe_set_updated_at();

ALTER TABLE obra_mobilizacao_equipe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_mobilizacao_equipe: ver da empresa" ON obra_mobilizacao_equipe;
CREATE POLICY "obra_mobilizacao_equipe: ver da empresa"
  ON obra_mobilizacao_equipe FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "obra_mobilizacao_equipe: inserir na empresa" ON obra_mobilizacao_equipe;
CREATE POLICY "obra_mobilizacao_equipe: inserir na empresa"
  ON obra_mobilizacao_equipe FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "obra_mobilizacao_equipe: atualizar na empresa" ON obra_mobilizacao_equipe;
CREATE POLICY "obra_mobilizacao_equipe: atualizar na empresa"
  ON obra_mobilizacao_equipe FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "obra_mobilizacao_equipe: deletar gestor+" ON obra_mobilizacao_equipe;
CREATE POLICY "obra_mobilizacao_equipe: deletar gestor+"
  ON obra_mobilizacao_equipe FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );

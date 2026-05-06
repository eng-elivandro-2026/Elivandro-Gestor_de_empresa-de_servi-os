-- ============================================================
-- 004_operacional_obra_diario.sql
-- Fase 1B do modulo Operacional: Diario de Obra.
-- ============================================================

ALTER TABLE obras ADD COLUMN IF NOT EXISTS area_local text;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS equipamento_maquina_linha text;

CREATE TABLE IF NOT EXISTS obra_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES obras(id) ON DELETE CASCADE,

  data_diario date NOT NULL,
  turno text NOT NULL DEFAULT 'integral',
  status_dia text NOT NULL DEFAULT 'concluido',
  responsavel_dia_nome text,
  area_local text,
  equipamento_maquina_linha text,

  hora_inicio_real time,
  hora_termino_real time,
  intervalo_realizado_minutos integer DEFAULT 0,
  houve_extensao_horario boolean DEFAULT false,
  motivo_extensao_horario text,
  houve_atraso_inicio boolean DEFAULT false,
  motivo_atraso_inicio text,
  houve_saida_antecipada boolean DEFAULT false,
  motivo_saida_antecipada text,

  dds_realizado boolean DEFAULT false,
  apr_obrigatoria boolean DEFAULT false,
  apr_liberada boolean DEFAULT false,
  pt_obrigatoria boolean DEFAULT false,
  pt_liberada boolean DEFAULT false,
  area_isolada boolean DEFAULT false,
  bloqueio_etiquetagem_necessario boolean DEFAULT false,
  bloqueio_etiquetagem_realizado boolean DEFAULT false,
  epi_conferido boolean DEFAULT false,
  servico_liberado boolean DEFAULT true,
  motivo_nao_liberacao text,
  observacoes_seguranca text,

  equipe_prevista_resumo text,
  equipe_presente_resumo text,
  houve_falta boolean DEFAULT false,
  faltas_resumo text,
  houve_atraso_equipe boolean DEFAULT false,
  atraso_equipe_resumo text,
  houve_saida_antecipada_equipe boolean DEFAULT false,
  saida_antecipada_resumo text,
  observacoes_equipe text,

  tipo_alimentacao text,
  local_alimentacao text,
  observacoes_alimentacao text,
  houve_deslocamento boolean DEFAULT false,
  veiculo_utilizado text,
  motorista text,
  cidade_origem text,
  cidade_destino text,
  hotel_utilizado text,
  houve_problema_deslocamento boolean DEFAULT false,
  descricao_problema_deslocamento text,
  houve_custo_extra_transporte boolean DEFAULT false,
  valor_custo_extra_transporte numeric(14,2) DEFAULT 0,
  observacoes_mobilizacao text,

  ferramentas_utilizadas text,
  epis_utilizados text,
  epcs_isolamento_utilizados text,
  faltou_ferramenta boolean DEFAULT false,
  descricao_ferramenta_faltante text,
  houve_ferramenta_danificada boolean DEFAULT false,
  descricao_ferramenta_danificada text,
  houve_compra_emergencial boolean DEFAULT false,
  descricao_compra_emergencial text,

  atividade_principal text,
  descricao_execucao text,
  local_execucao text,
  etapa_obra text,
  horas_equipe_total numeric(8,2) DEFAULT 0,
  avanco_estimado_dia numeric(5,2) DEFAULT 0,

  houve_falta_material boolean DEFAULT false,
  descricao_material_faltante text,
  material_faltante_previsto boolean DEFAULT false,
  responsavel_compra_material text,
  responsavel_retirada_material text,
  status_pendencia_material text,
  impacto_falta_material_prazo boolean DEFAULT false,
  impacto_falta_material_custo boolean DEFAULT false,
  acao_tomada_material text,
  observacoes_material text,

  houve_intercorrencia boolean DEFAULT false,
  tipo_intercorrencia text,
  descricao_intercorrencia text,
  impacto_prazo boolean DEFAULT false,
  impacto_custo boolean DEFAULT false,
  impacto_seguranca boolean DEFAULT false,
  acao_tomada text,

  pendencias text,
  responsavel_pendencia text,
  bloqueia_proxima_atividade boolean DEFAULT false,
  proxima_atividade text,
  objetivo_proximo_dia text,

  resumo_do_dia text,
  dia_concluido_com_sucesso boolean DEFAULT true,
  observacoes_finais text,

  created_by uuid DEFAULT auth_usuario_id(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  CONSTRAINT obra_diario_empresa_obra_data_turno_unique UNIQUE (empresa_id, obra_id, data_diario, turno)
);

CREATE INDEX IF NOT EXISTS idx_obra_diario_empresa_id ON obra_diario (empresa_id);
CREATE INDEX IF NOT EXISTS idx_obra_diario_obra_id ON obra_diario (obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_diario_data_diario ON obra_diario (data_diario DESC);
CREATE INDEX IF NOT EXISTS idx_obra_diario_status_dia ON obra_diario (status_dia);
CREATE INDEX IF NOT EXISTS idx_obra_diario_created_at ON obra_diario (created_at DESC);

CREATE OR REPLACE FUNCTION obra_diario_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obra_diario_updated_at ON obra_diario;
CREATE TRIGGER trg_obra_diario_updated_at
BEFORE UPDATE ON obra_diario
FOR EACH ROW
EXECUTE FUNCTION obra_diario_set_updated_at();

ALTER TABLE obra_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_diario: ver da empresa" ON obra_diario;
CREATE POLICY "obra_diario: ver da empresa"
  ON obra_diario FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "obra_diario: inserir na empresa" ON obra_diario;
CREATE POLICY "obra_diario: inserir na empresa"
  ON obra_diario FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "obra_diario: atualizar na empresa" ON obra_diario;
CREATE POLICY "obra_diario: atualizar na empresa"
  ON obra_diario FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

DROP POLICY IF EXISTS "obra_diario: deletar gestor+" ON obra_diario;
CREATE POLICY "obra_diario: deletar gestor+"
  ON obra_diario FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );

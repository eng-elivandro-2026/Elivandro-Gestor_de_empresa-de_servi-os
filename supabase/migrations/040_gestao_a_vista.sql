-- ============================================================
-- 040_gestao_a_vista.sql
-- Gestão à Vista: metas SMART por empresa, plano de ação 5W2H,
-- ciclo PDCA e radar de acompanhamento.
--
-- O QUE CRIA:
--   1) metas        — metas SMART por empresa (1 linha por meta).
--   2) meta_acoes    — ações 5W2H vinculadas a uma meta (N por meta).
--   3) meta_pdca     — ciclo PDCA por meta (1 linha por meta — UNIQUE).
--   4) meta_radar    — registros de acompanhamento por meta (N por meta).
--
-- Multi-empresa: todas isoladas por empresa_id (FK -> empresas).
-- A RLS é definida na migration seguinte (041_rls_gestao_a_vista.sql).
--
-- OBS sobre referência a propostas:
--   O projeto referencia uma proposta por seu app_id (texto), sem FK uuid
--   (ver obras.proposta_app_id e gestao_negocio.proposta_id). Seguindo essa
--   convenção, meta_radar usa proposta_app_id text (nullable, sem FK) para
--   o vínculo opcional com o portal.
--
-- Migration estritamente ADITIVA: cria apenas tabelas/índices novos.
-- Idempotente (CREATE TABLE/INDEX IF NOT EXISTS). Não altera nada existente.
-- Não insere dados (seed à parte). Aplicar somente com autorização explícita,
-- no SQL Editor do Supabase.
--
-- Depende de: 001_rls_policies.sql (empresas, usuarios, auth_usuario_id()).
-- ============================================================

BEGIN;

-- ── 1) metas — metas SMART por empresa ──
CREATE TABLE IF NOT EXISTS metas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  titulo        varchar(200) NOT NULL,
  area          varchar(100),

  -- SMART
  especifico    text,
  mensuravel    text,
  atingivel     text,
  relevante     text,
  temporal      text,

  -- Valores de referência
  valor_atual   numeric,
  valor_meta    numeric,
  unidade       varchar(50),

  -- Responsável e prazo
  responsavel_id   uuid REFERENCES usuarios(id),
  responsavel_nome varchar(100),
  data_inicio   date,
  data_prazo    date,

  -- Status: 'ativa' | 'concluida' | 'cancelada'
  status        varchar(30) NOT NULL DEFAULT 'ativa',

  -- Controle
  ordem         integer NOT NULL DEFAULT 1,
  created_by    uuid DEFAULT auth_usuario_id(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT metas_titulo_not_blank CHECK (length(trim(titulo)) > 0),
  CONSTRAINT metas_status_check CHECK (status IN ('ativa', 'concluida', 'cancelada'))
);

CREATE INDEX IF NOT EXISTS idx_metas_empresa_id ON metas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_metas_empresa_status ON metas (empresa_id, status);

-- ── 2) meta_acoes — plano de ação 5W2H ──
CREATE TABLE IF NOT EXISTS meta_acoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id       uuid NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  ordem         integer NOT NULL DEFAULT 1,
  titulo        varchar(200),

  -- 5W2H
  o_que         text,
  por_que       text,
  quem          varchar(100),
  quando        varchar(100),
  onde          varchar(100),
  como          text,
  custo         varchar(100),

  -- Status: 'pendente' | 'em_andamento' | 'concluida'
  status        varchar(30) NOT NULL DEFAULT 'pendente',

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meta_acoes_status_check CHECK (status IN ('pendente', 'em_andamento', 'concluida'))
);

CREATE INDEX IF NOT EXISTS idx_meta_acoes_empresa_id ON meta_acoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_meta_acoes_meta_id ON meta_acoes (meta_id);
CREATE INDEX IF NOT EXISTS idx_meta_acoes_meta_ordem ON meta_acoes (meta_id, ordem);

-- ── 3) meta_pdca — ciclo PDCA por meta (1 por meta) ──
CREATE TABLE IF NOT EXISTS meta_pdca (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id       uuid NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- D — Do (executar e registrar)
  do_certo        text,
  do_dificuldades text,
  do_superar      text,

  -- C — Check (verificar)
  check_atingiu     text,
  check_observacoes text,

  -- A — Act (agir)
  act_corrigir   text,
  act_padronizar text,

  -- Controle
  updated_by    uuid REFERENCES usuarios(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT meta_pdca_meta_unica UNIQUE (meta_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_pdca_empresa_id ON meta_pdca (empresa_id);
CREATE INDEX IF NOT EXISTS idx_meta_pdca_meta_id ON meta_pdca (meta_id);

-- ── 4) meta_radar — registros de acompanhamento por meta ──
CREATE TABLE IF NOT EXISTS meta_radar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id       uuid NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Referência opcional à proposta (app_id texto, convenção do projeto; sem FK)
  proposta_app_id varchar(100),

  -- Dados do registro
  referencia      varchar(200),
  data_inicio     date,
  data_fim        date,
  valor_realizado numeric,
  bateu_meta      boolean,

  -- Anotação manual (campo ACT do radar)
  anotacao        text,

  -- Controle
  registrado_por  uuid REFERENCES usuarios(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meta_radar_empresa_id ON meta_radar (empresa_id);
CREATE INDEX IF NOT EXISTS idx_meta_radar_meta_id ON meta_radar (meta_id);
CREATE INDEX IF NOT EXISTS idx_meta_radar_proposta_app_id ON meta_radar (proposta_app_id);

-- ── Comentários para documentação inline ──
COMMENT ON TABLE metas        IS 'Metas SMART por empresa.';
COMMENT ON TABLE meta_acoes   IS 'Ações 5W2H vinculadas a uma meta.';
COMMENT ON TABLE meta_pdca    IS 'Ciclo PDCA por meta (1 linha por meta).';
COMMENT ON TABLE meta_radar   IS 'Registros de acompanhamento (radar) por meta.';
COMMENT ON COLUMN meta_radar.proposta_app_id IS 'app_id da proposta no portal (texto), vínculo opcional sem FK — mesma convenção de obras.proposta_app_id.';

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('metas','meta_acoes','meta_pdca','meta_radar');
--
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('metas','meta_acoes','meta_pdca','meta_radar')
-- ORDER BY table_name, ordinal_position;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS meta_radar;
-- DROP TABLE IF EXISTS meta_pdca;
-- DROP TABLE IF EXISTS meta_acoes;
-- DROP TABLE IF EXISTS metas;
-- COMMIT;
-- ============================================================

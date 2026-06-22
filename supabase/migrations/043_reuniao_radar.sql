-- ============================================================
-- 043_reuniao_radar.sql
-- Reunião de Radar: ata de reunião por empresa + indicadores
-- (snapshot das metas) discutidos em cada reunião.
--
-- O QUE CRIA:
--   1) reuniao_radar             — 1 linha por reunião/ata (por empresa).
--   2) reuniao_radar_indicadores — N linhas por reunião (snapshot por meta).
--
-- Multi-empresa: ambas isoladas por empresa_id (FK -> empresas).
-- A RLS é definida na migration seguinte (044_rls_reuniao_radar.sql).
--
-- OBS: o vínculo com a meta (reuniao_radar_indicadores.meta_id) é solto
--   (uuid sem FK), pois a meta pode ser excluída sem apagar o histórico
--   da ata; meta_titulo guarda o nome no momento da reunião.
--
-- Migration estritamente ADITIVA: cria apenas tabelas/índices novos.
-- Idempotente (CREATE TABLE/INDEX IF NOT EXISTS). Não altera nada existente.
-- Não insere dados. Aplicar somente com autorização explícita, no SQL Editor.
--
-- Depende de: 001_rls_policies.sql (empresas, usuarios, auth_usuario_id()).
-- ============================================================

BEGIN;

-- ── 1) reuniao_radar — ata da reunião ──
CREATE TABLE IF NOT EXISTS reuniao_radar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  data_reuniao  date NOT NULL,
  anfitriao     varchar(100),
  participantes text,

  -- Conteúdo da ata
  novidades     text,
  restricoes    text,
  conclusao     text,

  -- Status: 'aberta' (em andamento) | 'concluida'
  status        varchar(20) NOT NULL DEFAULT 'aberta',

  -- Tempo total registrado pelo cronômetro (opcional)
  duracao_segundos integer,

  -- Controle
  created_by    uuid DEFAULT auth_usuario_id(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reuniao_radar_status_check CHECK (status IN ('aberta', 'concluida'))
);

CREATE INDEX IF NOT EXISTS idx_reuniao_radar_empresa_id
  ON reuniao_radar (empresa_id);
CREATE INDEX IF NOT EXISTS idx_reuniao_radar_empresa_data
  ON reuniao_radar (empresa_id, data_reuniao DESC);

-- ── 2) reuniao_radar_indicadores — snapshot por meta ──
CREATE TABLE IF NOT EXISTS reuniao_radar_indicadores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id    uuid NOT NULL REFERENCES reuniao_radar(id) ON DELETE CASCADE,
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  -- Referência solta à meta (sem FK — meta pode ser excluída)
  meta_id       uuid,
  meta_titulo   varchar(200),

  -- Snapshot do momento da reunião
  valor_atual   varchar(50),
  valor_meta    varchar(50),
  -- status_indicador: 'na_meta' | 'abaixo' | 'acima'
  status_indicador varchar(30),

  -- Desafio e plano apresentados na reunião
  desafio_plano text,

  ordem         integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rr_ind_empresa_id
  ON reuniao_radar_indicadores (empresa_id);
CREATE INDEX IF NOT EXISTS idx_rr_ind_reuniao_id
  ON reuniao_radar_indicadores (reuniao_id);
CREATE INDEX IF NOT EXISTS idx_rr_ind_reuniao_ordem
  ON reuniao_radar_indicadores (reuniao_id, ordem);

-- ── Comentários para documentação inline ──
COMMENT ON TABLE reuniao_radar             IS 'Ata de reunião de radar por empresa.';
COMMENT ON TABLE reuniao_radar_indicadores IS 'Snapshot dos indicadores/metas discutidos em cada reunião.';
COMMENT ON COLUMN reuniao_radar_indicadores.meta_id IS 'uuid da meta (vínculo solto, sem FK); meta_titulo preserva o nome no momento da reunião.';

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('reuniao_radar','reuniao_radar_indicadores');
--
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('reuniao_radar','reuniao_radar_indicadores')
-- ORDER BY table_name, ordinal_position;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS reuniao_radar_indicadores;
-- DROP TABLE IF EXISTS reuniao_radar;
-- COMMIT;
-- ============================================================

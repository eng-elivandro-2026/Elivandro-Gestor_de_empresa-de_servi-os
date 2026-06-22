-- ============================================================
-- 045_reuniao_radar_assuntos.sql
-- Reunião de Radar: assuntos herdados da reunião anterior.
--
-- O QUE CRIA:
--   reuniao_radar_assuntos — N linhas por reunião. Cada linha é um
--   assunto trazido da reunião anterior (conclusão/próximos passos da
--   semana passada) com um status que o usuário marca durante a reunião:
--   'pendente' | 'resolvido' | 'nao_resolvido'.
--
-- Multi-empresa: isolada por empresa_id (FK -> empresas). A RLS é
-- definida na migration seguinte (046_rls_reuniao_radar_assuntos.sql).
--
-- Migration estritamente ADITIVA: cria apenas tabela/índices novos.
-- Idempotente (CREATE TABLE/INDEX IF NOT EXISTS). Não altera nada existente.
-- Não insere dados. Aplicar somente com autorização explícita, no SQL Editor.
--
-- Depende de: 043_reuniao_radar.sql (reuniao_radar), 001_rls_policies.sql (empresas).
-- ============================================================

BEGIN;

-- ── reuniao_radar_assuntos — assuntos da reunião anterior ──
CREATE TABLE IF NOT EXISTS reuniao_radar_assuntos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reuniao_id    uuid NOT NULL REFERENCES reuniao_radar(id) ON DELETE CASCADE,
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  texto         text NOT NULL,

  -- Status marcado durante a reunião:
  -- 'pendente' | 'resolvido' | 'nao_resolvido'
  status        varchar(20) NOT NULL DEFAULT 'pendente',

  ordem         integer NOT NULL DEFAULT 1,

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reuniao_radar_assuntos_status_check
    CHECK (status IN ('pendente', 'resolvido', 'nao_resolvido'))
);

CREATE INDEX IF NOT EXISTS idx_rr_assuntos_empresa_id
  ON reuniao_radar_assuntos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_rr_assuntos_reuniao_id
  ON reuniao_radar_assuntos (reuniao_id);
CREATE INDEX IF NOT EXISTS idx_rr_assuntos_reuniao_ordem
  ON reuniao_radar_assuntos (reuniao_id, ordem);

-- ── Comentários para documentação inline ──
COMMENT ON TABLE  reuniao_radar_assuntos        IS 'Assuntos herdados da reunião anterior, com status marcado durante a reunião.';
COMMENT ON COLUMN reuniao_radar_assuntos.status IS 'pendente | resolvido | nao_resolvido (CHECK).';

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name = 'reuniao_radar_assuntos';
--
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'reuniao_radar_assuntos'
-- ORDER BY ordinal_position;
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'reuniao_radar_assuntos'::regclass;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS reuniao_radar_assuntos;
-- COMMIT;
-- ============================================================

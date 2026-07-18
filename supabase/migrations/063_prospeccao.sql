-- ============================================================
-- 063_prospeccao.sql
-- Módulo Prospecção Comercial (Etapas 1-Atrair e 2-Qualificar do
-- macroprocesso comercial).
--
-- 3 tabelas:
--   prospeccao_alvos  — alvo (empresa prospectada) e seu status no funil
--   prospeccao_log    — rastreabilidade de cada ação (com tempo)
--   prospeccao_etapas — dados/progresso por etapa (JSONB, wizard retomável)
--
-- SEM tabela de métricas: agregados são calculados client-side a partir
-- de alvos+log (decisão aprovada — evita trigger e drift).
--
-- RLS no idioma do projeto (001_rls_policies.sql):
--   auth_empresa_ids() / auth_usuario_id() / auth_perfil()
-- Módulo restrito por perfil na APLICAÇÃO (dono/admin nesta fase);
-- no banco a fronteira é a EMPRESA (multi-empresa correto — o usuário
-- pode pertencer a mais de uma).
--
-- Executar no SQL Editor do Supabase.
-- Depende de: 001_rls_policies.sql.
-- ============================================================

-- ── 1. Alvos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospeccao_alvos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                text NOT NULL,
  cidade              text,
  estado              text DEFAULT 'SP',
  segmento            text,
  perfil              text CHECK (perfil IN ('A', 'B')),            -- A=OEM fabricante, B=operadora
  porte               text,
  origem              text CHECK (origem IN ('captura_massa', 'dono', 'vendedor', 'indicacao')),
  fonte               text,                                          -- ex: "Prefeitura Jundiaí", "LinkedIn"
  obs_inicial         text,
  status              text NOT NULL DEFAULT 'novo'
                        CHECK (status IN ('novo', 'pesquisando', 'prospectando', 'qualificando',
                                          'qualificado', 'desqualificado', 'descartado')),
  urgente             boolean NOT NULL DEFAULT false,
  prazo_cliente       date,
  score_qualificacao  integer NOT NULL DEFAULT 0 CHECK (score_qualificacao BETWEEN 0 AND 100),
  responsavel_id      uuid REFERENCES usuarios(id),
  criado_por          uuid REFERENCES usuarios(id),
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospeccao_alvos_nome_not_blank CHECK (length(trim(nome)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_prospeccao_alvos_empresa ON prospeccao_alvos (empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_prospeccao_alvos_nome    ON prospeccao_alvos (empresa_id, lower(nome));

COMMENT ON TABLE prospeccao_alvos IS 'Alvos de prospecção comercial (Etapas 1-2 do macroprocesso). Status = posição no funil.';

-- ── 2. Log de rastreabilidade ─────────────────────────────────
CREATE TABLE IF NOT EXISTS prospeccao_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alvo_id         uuid NOT NULL REFERENCES prospeccao_alvos(id) ON DELETE CASCADE,
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  usuario_id      uuid REFERENCES usuarios(id),
  etapa           text,                        -- 'captura' | 'pesquisa' | 'prospeccao_p1'..'p6' | 'qualificacao_p1'..'p5'
  acao            text NOT NULL,
  dados_json      jsonb NOT NULL DEFAULT '{}',
  tempo_segundos  integer NOT NULL DEFAULT 0,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospeccao_log_alvo    ON prospeccao_log (alvo_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_prospeccao_log_empresa ON prospeccao_log (empresa_id, criado_em);

COMMENT ON TABLE prospeccao_log IS 'Toda ação do módulo de prospecção (abertura, passo, descarte...) com usuário, tempo e payload.';

-- ── 3. Dados/progresso por etapa (wizard retomável) ───────────
CREATE TABLE IF NOT EXISTS prospeccao_etapas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alvo_id              uuid NOT NULL REFERENCES prospeccao_alvos(id) ON DELETE CASCADE,
  empresa_id           uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  etapa                text NOT NULL CHECK (etapa IN ('pesquisa', 'prospeccao', 'qualificacao')),
  dados_json           jsonb NOT NULL DEFAULT '{}',
  passo_atual          integer NOT NULL DEFAULT 0,
  passos_concluidos    integer[] NOT NULL DEFAULT '{}',
  tempo_total_segundos integer NOT NULL DEFAULT 0,
  concluido            boolean NOT NULL DEFAULT false,
  concluido_em         timestamptz,
  usuario_id           uuid REFERENCES usuarios(id),
  atualizado_em        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT prospeccao_etapas_unica UNIQUE (alvo_id, etapa)   -- 1 registro por alvo+etapa (upsert)
);

CREATE INDEX IF NOT EXISTS idx_prospeccao_etapas_alvo ON prospeccao_etapas (alvo_id);

COMMENT ON TABLE prospeccao_etapas IS 'Progresso e dados (JSONB) de cada etapa por alvo — cronômetro acumulado e autosave do wizard.';

-- ── RLS (idioma do projeto — fronteira = empresa) ─────────────
ALTER TABLE prospeccao_alvos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospeccao_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospeccao_etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prospeccao_alvos: empresa" ON prospeccao_alvos;
CREATE POLICY "prospeccao_alvos: empresa" ON prospeccao_alvos
  FOR ALL
  USING (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "prospeccao_log: empresa" ON prospeccao_log;
CREATE POLICY "prospeccao_log: empresa" ON prospeccao_log
  FOR ALL
  USING (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "prospeccao_etapas: empresa" ON prospeccao_etapas;
CREATE POLICY "prospeccao_etapas: empresa" ON prospeccao_etapas
  FOR ALL
  USING (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--  WHERE table_name LIKE 'prospeccao_%' ORDER BY table_name;   -- 3 linhas
-- SELECT polname, polcmd FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
--  WHERE c.relname LIKE 'prospeccao_%';                        -- 3 policies

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- DROP TABLE IF EXISTS prospeccao_etapas;
-- DROP TABLE IF EXISTS prospeccao_log;
-- DROP TABLE IF EXISTS prospeccao_alvos;
-- ============================================================

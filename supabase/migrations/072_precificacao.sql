-- ============================================================
-- 072_precificacao.sql
-- Módulo 05 — Precificação (SOE). Estrutura de custos por função,
-- times montados a partir das funções, e banco de índices/HH
-- próprios da empresa. Acesso: dono/admin (RLS por empresa_id).
-- ============================================================

-- ── Funções e custos configurados ────────────────────────────
CREATE TABLE IF NOT EXISTS precificacao_funcoes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome           text NOT NULL,
  salario_base   numeric(14,2) NOT NULL DEFAULT 0,
  encargos_pct   numeric(6,3)  NOT NULL DEFAULT 0,   -- % encargos sobre salário
  beneficios_mes numeric(14,2) NOT NULL DEFAULT 0,   -- benefícios/mês
  horas_mes      numeric(8,2)  NOT NULL DEFAULT 220, -- carga horária mensal
  custo_hh       numeric(14,4),                      -- custo/hora (calculado no app; nullable)
  ativo          boolean NOT NULL DEFAULT true,
  criado_em      timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

-- ── Times montados ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS precificacao_times (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  descricao     text,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ── Composição do time (função × quantidade) ─────────────────
CREATE TABLE IF NOT EXISTS precificacao_time_membros (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  time_id     uuid NOT NULL REFERENCES precificacao_times(id)   ON DELETE CASCADE,
  funcao_id   uuid NOT NULL REFERENCES precificacao_funcoes(id) ON DELETE RESTRICT,
  quantidade  integer NOT NULL DEFAULT 1,
  criado_em   timestamptz NOT NULL DEFAULT now()
);

-- ── Banco de índices / HH próprios ───────────────────────────
CREATE TABLE IF NOT EXISTS precificacao_indices (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  chave         text NOT NULL,                 -- ex: 'markup_padrao', 'bdi', 'hh_engenharia'
  rotulo        text,
  valor         numeric(14,4) NOT NULL DEFAULT 0,
  unidade       text,                          -- '%', 'R$/h', etc.
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT precificacao_indices_empresa_chave_unique UNIQUE (empresa_id, chave)
);

-- ── Índices (inclui empresa_id + FKs de alto uso) ────────────
CREATE INDEX IF NOT EXISTS idx_precfuncoes_empresa ON precificacao_funcoes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_prectimes_empresa   ON precificacao_times (empresa_id);
CREATE INDEX IF NOT EXISTS idx_prectimemb_empresa  ON precificacao_time_membros (empresa_id);
CREATE INDEX IF NOT EXISTS idx_prectimemb_time     ON precificacao_time_membros (time_id);
CREATE INDEX IF NOT EXISTS idx_prectimemb_funcao   ON precificacao_time_membros (funcao_id);
CREATE INDEX IF NOT EXISTS idx_precindices_empresa ON precificacao_indices (empresa_id);

-- ── RLS: acesso dono/admin da própria empresa ────────────────
-- Padrão do projeto: empresa_id IN (SELECT auth_empresa_ids())
--                    AND auth_perfil() IN ('dono','admin')
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['precificacao_funcoes','precificacao_times','precificacao_time_membros','precificacao_indices']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s: dono/admin ve" ON %1$I FOR SELECT
        USING (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s: dono/admin insere" ON %1$I FOR INSERT
        WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s: dono/admin atualiza" ON %1$I FOR UPDATE
        USING (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s: dono/admin deleta" ON %1$I FOR DELETE
        USING (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
    $f$, t);
  END LOOP;
END $$;

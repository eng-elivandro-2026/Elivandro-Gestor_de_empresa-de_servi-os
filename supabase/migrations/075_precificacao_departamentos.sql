-- ============================================================
-- 075_precificacao_departamentos.sql
-- Precificação — organização de times por departamento.
-- Cria precificacao_departamentos e vincula precificacao_times
-- a um departamento (+ ordenação). time_membros (TIME_FUNCAO) já
-- existe desde a 072 e não muda.
-- ============================================================

-- ── Departamentos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS precificacao_departamentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome          text NOT NULL,
  descricao     text,
  ordem         integer NOT NULL DEFAULT 0,
  ativo         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- ── Vincula times a departamento + ordenação ─────────────────
ALTER TABLE precificacao_times
  ADD COLUMN IF NOT EXISTS departamento_id uuid
    REFERENCES precificacao_departamentos(id) ON DELETE SET NULL;
ALTER TABLE precificacao_times
  ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

-- ── Índices (empresa_id + FKs de alto uso) ───────────────────
CREATE INDEX IF NOT EXISTS idx_precdeptos_empresa ON precificacao_departamentos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_prectimes_depto    ON precificacao_times (departamento_id);

-- ── RLS: acesso dono/admin da própria empresa ────────────────
-- Mesmo padrão da 072, com DROP POLICY IF EXISTS antes de cada
-- CREATE POLICY para tornar a migration idempotente.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['precificacao_departamentos']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    EXECUTE format('DROP POLICY IF EXISTS "%1$s: dono/admin ve" ON %1$I;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s: dono/admin ve" ON %1$I FOR SELECT
        USING (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
    $f$, t);

    EXECUTE format('DROP POLICY IF EXISTS "%1$s: dono/admin insere" ON %1$I;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s: dono/admin insere" ON %1$I FOR INSERT
        WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
    $f$, t);

    EXECUTE format('DROP POLICY IF EXISTS "%1$s: dono/admin atualiza" ON %1$I;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s: dono/admin atualiza" ON %1$I FOR UPDATE
        USING (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
    $f$, t);

    EXECUTE format('DROP POLICY IF EXISTS "%1$s: dono/admin deleta" ON %1$I;', t);
    EXECUTE format($f$
      CREATE POLICY "%1$s: dono/admin deleta" ON %1$I FOR DELETE
        USING (empresa_id IN (SELECT auth_empresa_ids()) AND auth_perfil() IN ('dono','admin'));
    $f$, t);
  END LOOP;
END $$;

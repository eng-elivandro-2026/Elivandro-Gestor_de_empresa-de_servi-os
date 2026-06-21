-- ============================================================
-- 038_empresa_identidade.sql
-- Identidade estratégica por empresa: Missão, Visão e Valores
-- culturais. Suporte ao módulo "Dashboard Minha Empresa".
--
-- O QUE CRIA:
--   1) empresa_identidade  — uma linha por empresa (Missão + Visão).
--   2) empresa_valores     — N linhas por empresa (valores culturais,
--                            com "como vivemos" / "como não vivemos").
--
-- Multi-empresa: ambas isoladas por empresa_id (FK -> empresas).
-- A RLS é definida na migration seguinte (039_rls_identidade.sql).
--
-- Migration estritamente ADITIVA: cria apenas tabelas/índices novos.
-- Idempotente (CREATE TABLE/INDEX IF NOT EXISTS).
-- Não altera nem remove nada existente. Não insere dados (seed à parte).
-- ATENÇÃO: migration versionada — aplicar somente com autorização explícita,
-- no SQL Editor do Supabase.
--
-- Depende de: 001_rls_policies.sql (tabela empresas + RLS habilitado),
--             auth_usuario_id() (definida na 001).
-- ============================================================

BEGIN;

-- ── Tabela: identidade estratégica por empresa (Missão e Visão) ──
CREATE TABLE IF NOT EXISTS empresa_identidade (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  missao      text,
  visao       text,

  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id),

  CONSTRAINT empresa_identidade_empresa_unica UNIQUE (empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_empresa_identidade_empresa_id
  ON empresa_identidade (empresa_id);

-- ── Tabela: valores culturais por empresa ──
CREATE TABLE IF NOT EXISTS empresa_valores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,

  ordem             integer NOT NULL DEFAULT 1,
  nome              varchar(100) NOT NULL,
  como_vivemos      text,
  como_nao_vivemos  text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT empresa_valores_nome_not_blank CHECK (length(trim(nome)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_empresa_valores_empresa_id
  ON empresa_valores (empresa_id);

CREATE INDEX IF NOT EXISTS idx_empresa_valores_empresa_ordem
  ON empresa_valores (empresa_id, ordem);

-- ── Comentários para documentação inline ──
COMMENT ON TABLE  empresa_identidade            IS 'Missão e Visão por empresa (1 linha por empresa). Editável por dono/admin via UI.';
COMMENT ON COLUMN empresa_identidade.updated_by IS 'auth.users(id) do último usuário que salvou.';
COMMENT ON TABLE  empresa_valores               IS 'Valores culturais por empresa (N linhas). Editável por dono/admin via UI.';
COMMENT ON COLUMN empresa_valores.ordem         IS 'Ordem de exibição do valor na lista (1, 2, 3, ...).';
COMMENT ON COLUMN empresa_valores.como_vivemos     IS 'Comportamentos que demonstram o valor.';
COMMENT ON COLUMN empresa_valores.como_nao_vivemos IS 'Comportamentos que contrariam o valor.';

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- a) Tabelas criadas:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('empresa_identidade','empresa_valores');
--
-- b) Colunas:
-- SELECT table_name, column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name IN ('empresa_identidade','empresa_valores')
-- ORDER BY table_name, ordinal_position;

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- BEGIN;
-- DROP TABLE IF EXISTS empresa_valores;
-- DROP TABLE IF EXISTS empresa_identidade;
-- COMMIT;
-- ============================================================

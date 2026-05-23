-- ============================================================
-- 009_configuracoes_multiempresa_security.sql
-- Corrige segurança multiempresa da tabela configuracoes.
--
-- WHITELIST DE CHAVES GLOBAIS (empresa_id permitido ser NULL):
--   Nenhuma chave do código atual se qualifica.
--   A whitelist existe apenas para uso futuro (feature flags, versão de schema).
--   Candidatas futuras: tf_schema_version, tf_app_config
--
-- CHAVES EMPRESA-SCOPADAS (empresa_id obrigatório):
--   tf_backup, tf_tpls, tf_etpl, tf_config, tf_meta,
--   tf_svc_templates, tf_historico_{eid}, tf_clientes_{eid},
--   tf_contatos_{eid}, rh_alert_emails, tf_planejador_geral, ...
--
-- EXECUÇÃO:
--   Rodar no SQL Editor do Supabase APÓS deploy do frontend.
--   NÃO executar antes do deploy — frontend precisa passar empresa_id
--   para que as novas policies funcionem.
--
-- ROLLBACK:
--   Ver seção no final do arquivo.
-- ============================================================

BEGIN;

-- ── Verificação prévia de segurança ──────────────────────────
-- Verificar duplicatas de chave em chaves globais antes de alterar constraint.
-- Resultado deve ser vazio. Se não for, investigar antes de continuar.
-- SELECT chave, COUNT(*) FROM configuracoes
-- WHERE empresa_id IS NULL
-- GROUP BY chave HAVING COUNT(*) > 1;

-- ── Snapshot de segurança (criado antes de qualquer alteração) ──
-- Recomendado: rodar manualmente antes desta migration:
-- CREATE TABLE configuracoes_backup_pre009 AS SELECT * FROM configuracoes;

-- ────────────────────────────────────────────────────────────
-- FASE 1: Adicionar coluna empresa_id
-- ────────────────────────────────────────────────────────────

ALTER TABLE configuracoes
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id);

CREATE INDEX IF NOT EXISTS idx_configuracoes_empresa_id
  ON configuracoes(empresa_id);

CREATE INDEX IF NOT EXISTS idx_configuracoes_empresa_chave
  ON configuracoes(empresa_id, chave);

-- ────────────────────────────────────────────────────────────
-- FASE 2: Alterar constraint UNIQUE para composta
-- NULLS NOT DISTINCT: dois NULL no empresa_id são tratados como iguais
-- (necessário para que chaves globais whitelist não se dupliquem)
-- ────────────────────────────────────────────────────────────

ALTER TABLE configuracoes
  DROP CONSTRAINT IF EXISTS configuracoes_chave_key;

ALTER TABLE configuracoes
  ADD CONSTRAINT configuracoes_chave_empresa_unique
  UNIQUE NULLS NOT DISTINCT (chave, empresa_id);

-- ────────────────────────────────────────────────────────────
-- FASE 3: Backfill — empresa_id a partir do sufixo UUID na chave
-- Padrão: chave = 'tf_clientes_{uuid}' → empresa_id = '{uuid}'
-- Valida que o UUID extraído existe na tabela empresas.
-- ────────────────────────────────────────────────────────────

UPDATE configuracoes
SET empresa_id = (
  regexp_match(chave, '_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$')
)[1]::UUID
WHERE chave ~ '_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND empresa_id IS NULL
  AND (
    regexp_match(chave, '_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$')
  )[1]::UUID IN (SELECT id FROM empresas);

-- ────────────────────────────────────────────────────────────
-- FASE 4: Auditoria de orphaned keys
-- Registra chaves sensíveis que ficaram sem empresa_id.
-- Estas chaves serão bloqueadas pela nova RLS — comportamento intencional.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS configuracoes_orphaned_audit (
  chave        TEXT,
  updated_at   TIMESTAMPTZ,
  auditado_em  TIMESTAMPTZ DEFAULT NOW(),
  motivo       TEXT DEFAULT 'orphaned_sensitive_sem_empresa_id'
);

INSERT INTO configuracoes_orphaned_audit (chave, updated_at)
SELECT chave, updated_at
FROM configuracoes
WHERE empresa_id IS NULL
  -- Whitelist: chaves globais legítimas (nenhuma atualmente no código)
  -- Adicionar aqui se surgirem chaves verdadeiramente globais e não-sensíveis.
  AND chave NOT IN ('tf_schema_version', 'tf_app_config')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- FASE 5: Remover policy vulnerável e criar policies seguras
-- ────────────────────────────────────────────────────────────

-- Remover policy global vulnerável
DROP POLICY IF EXISTS "configuracoes: leitura autenticada" ON configuracoes;

-- Leitura de chaves empresa-scopadas: apenas membros da empresa
CREATE POLICY "configuracoes: leitura empresa"
  ON configuracoes FOR SELECT
  USING (
    empresa_id IS NOT NULL
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Leitura de chaves globais: SOMENTE whitelist explícita
-- Qualquer chave fora da whitelist sem empresa_id = bloqueada. Intencional.
CREATE POLICY "configuracoes: leitura global whitelist"
  ON configuracoes FOR SELECT
  USING (
    empresa_id IS NULL
    AND chave IN ('tf_schema_version', 'tf_app_config')
    AND auth.uid() IS NOT NULL
  );

-- INSERT: chave na whitelist → empresa_id deve ser NULL
--         qualquer outra chave → empresa_id obrigatório e pertence ao usuário
DROP POLICY IF EXISTS "configuracoes: escrita gestor+" ON configuracoes;

CREATE POLICY "configuracoes: escrita gestor+"
  ON configuracoes FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND (
      (
        chave IN ('tf_schema_version', 'tf_app_config')
        AND empresa_id IS NULL
      )
      OR
      (
        chave NOT IN ('tf_schema_version', 'tf_app_config')
        AND empresa_id IS NOT NULL
        AND empresa_id IN (SELECT auth_empresa_ids())
      )
    )
  );

-- UPDATE: mesma lógica
DROP POLICY IF EXISTS "configuracoes: atualizar gestor+" ON configuracoes;

CREATE POLICY "configuracoes: atualizar gestor+"
  ON configuracoes FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND (
      (
        chave IN ('tf_schema_version', 'tf_app_config')
        AND empresa_id IS NULL
      )
      OR
      (
        chave NOT IN ('tf_schema_version', 'tf_app_config')
        AND empresa_id IS NOT NULL
        AND empresa_id IN (SELECT auth_empresa_ids())
      )
    )
  );

COMMIT;

-- ============================================================
-- VERIFICAÇÕES PÓS-MIGRATION (executar separadamente)
-- ============================================================

-- 1. Confirmar que chaves empresa-scopadas têm empresa_id preenchido:
-- SELECT chave, empresa_id FROM configuracoes
-- WHERE chave ~ '_[0-9a-f]{8}-[0-9a-f]{4}' AND empresa_id IS NULL;
-- Resultado esperado: 0 linhas.

-- 2. Confirmar orphaned keys registradas:
-- SELECT chave, auditado_em FROM configuracoes_orphaned_audit;

-- 3. Confirmar que policy vulnerável foi removida:
-- SELECT policyname FROM pg_policies
-- WHERE tablename = 'configuracoes' AND policyname = 'configuracoes: leitura autenticada';
-- Resultado esperado: 0 linhas.

-- 4. Confirmar novas policies:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE tablename = 'configuracoes' ORDER BY policyname;

-- ============================================================
-- ROLLBACK COMPLETO
-- ============================================================
-- Executar APENAS se necessário reverter. Não executar como parte da migration.
-- ============================================================

-- BEGIN;
--
-- DROP POLICY IF EXISTS "configuracoes: leitura empresa" ON configuracoes;
-- DROP POLICY IF EXISTS "configuracoes: leitura global whitelist" ON configuracoes;
-- DROP POLICY IF EXISTS "configuracoes: escrita gestor+" ON configuracoes;
-- DROP POLICY IF EXISTS "configuracoes: atualizar gestor+" ON configuracoes;
--
-- CREATE POLICY "configuracoes: leitura autenticada"
--   ON configuracoes FOR SELECT
--   USING (auth.uid() IS NOT NULL);
--
-- CREATE POLICY "configuracoes: escrita gestor+"
--   ON configuracoes FOR INSERT
--   WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));
--
-- CREATE POLICY "configuracoes: atualizar gestor+"
--   ON configuracoes FOR UPDATE
--   USING (auth_perfil() IN ('dono', 'gestor', 'admin'));
--
-- ALTER TABLE configuracoes DROP CONSTRAINT IF EXISTS configuracoes_chave_empresa_unique;
-- ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_chave_key UNIQUE (chave);
-- DROP INDEX IF EXISTS idx_configuracoes_empresa_id;
-- DROP INDEX IF EXISTS idx_configuracoes_empresa_chave;
-- ALTER TABLE configuracoes DROP COLUMN IF EXISTS empresa_id;
--
-- COMMIT;

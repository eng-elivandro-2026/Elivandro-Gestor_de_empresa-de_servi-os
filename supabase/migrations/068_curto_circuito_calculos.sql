-- ============================================================
-- 068_curto_circuito_calculos.sql
-- Módulo Curto BT — cálculo de curto-circuito em baixa tensão
-- (IEC 60909-0:2016). Tabela PRÓPRIA (não reutiliza
-- engenharia_calculos) por decisão D3: autoria restrita ao criador.
-- Endurecer a RLS de engenharia_calculos para autoria causaria
-- regressão nos cálculos de cabos existentes; por isso, tabela nova.
--
-- Vínculos:
--   cliente_id      uuid → clientes(id), NOT NULL (decisão D5 — todo
--                   estudo pertence a um cliente). ON DELETE RESTRICT:
--                   protege o estudo (não some junto com o cliente);
--                   excluir um cliente com estudos exige tratamento.
--   criado_por      uuid → usuarios(id), NOT NULL — autor. Só no INSERT.
--                   Base do gate de autoria (D3).
--   proposta_app_id text, SEM FK — mesma convenção de
--                   obras.proposta_app_id / engenharia_calculos.
--   duplicado_de_id uuid → curto_circuito_calculos(id), rastreabilidade
--                   de "usar como base".
--
-- RLS (idioma do projeto — 001_rls_policies.sql):
--   Fronteira de LEITURA = empresa (auth_empresa_ids()).
--   ESCRITA (insert/update/delete) = AUTOR (criado_por = auth_usuario_id()).
--   Restrição por perfil (ver/criar/editar) fica na APLICAÇÃO.
--   Exclusão na UI é da v2 (R-17/D4); a policy de DELETE já nasce
--   restrita ao autor, mas o front v1 não expõe a ação.
--
-- Executar no SQL Editor do Supabase.
-- Depende de: 001_rls_policies.sql (auth_empresa_ids, auth_usuario_id),
--             064_clientes.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS curto_circuito_calculos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  criado_por      uuid NOT NULL REFERENCES usuarios(id),
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  proposta_app_id text,
  duplicado_de_id uuid REFERENCES curto_circuito_calculos(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  status          text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizado')),
  app_version     text NOT NULL,
  entrada         jsonb NOT NULL,
  resultado       jsonb NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT curto_circuito_calculos_titulo_not_blank CHECK (length(trim(titulo)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_curto_circuito_empresa  ON curto_circuito_calculos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_curto_circuito_cliente  ON curto_circuito_calculos (empresa_id, cliente_id);
CREATE INDEX IF NOT EXISTS idx_curto_circuito_autor    ON curto_circuito_calculos (criado_por);
CREATE INDEX IF NOT EXISTS idx_curto_circuito_proposta ON curto_circuito_calculos (proposta_app_id) WHERE proposta_app_id IS NOT NULL;

COMMENT ON TABLE curto_circuito_calculos IS 'Estudos de curto-circuito em baixa tensão (IEC 60909). entrada = snapshot versionado do estudo (schema_version interno); resultado = snapshot do motor. Memorial gerado sob demanda, não armazenado. Escrita restrita ao autor (criado_por).';
COMMENT ON COLUMN curto_circuito_calculos.proposta_app_id IS 'app_id da proposta no portal (texto), vínculo opcional sem FK — mesma convenção de obras.proposta_app_id.';
COMMENT ON COLUMN curto_circuito_calculos.atualizado_em IS 'Recarimbado pela aplicação a cada UPDATE; usado para detecção de conflito (concorrência otimista).';

-- ── RLS: leitura por empresa, escrita por autor ───────────────
ALTER TABLE curto_circuito_calculos ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer membro da empresa vê os estudos do tenant.
DROP POLICY IF EXISTS "curto_circuito_calculos: select empresa" ON curto_circuito_calculos;
CREATE POLICY "curto_circuito_calculos: select empresa" ON curto_circuito_calculos
  FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

-- INSERT: dentro da empresa do usuário E como autor (criado_por = próprio).
DROP POLICY IF EXISTS "curto_circuito_calculos: insert autor" ON curto_circuito_calculos;
CREATE POLICY "curto_circuito_calculos: insert autor" ON curto_circuito_calculos
  FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND criado_por = auth_usuario_id()
  );

-- UPDATE: somente o autor, dentro da empresa.
DROP POLICY IF EXISTS "curto_circuito_calculos: update autor" ON curto_circuito_calculos;
CREATE POLICY "curto_circuito_calculos: update autor" ON curto_circuito_calculos
  FOR UPDATE
  USING (
    criado_por = auth_usuario_id()
    AND empresa_id IN (SELECT auth_empresa_ids())
  )
  WITH CHECK (
    criado_por = auth_usuario_id()
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- DELETE: somente o autor (UI expõe apenas na v2 — R-17/D4).
DROP POLICY IF EXISTS "curto_circuito_calculos: delete autor" ON curto_circuito_calculos;
CREATE POLICY "curto_circuito_calculos: delete autor" ON curto_circuito_calculos
  FOR DELETE
  USING (
    criado_por = auth_usuario_id()
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'curto_circuito_calculos';
-- SELECT polname, polcmd FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='curto_circuito_calculos';
-- SELECT indexname FROM pg_indexes WHERE tablename='curto_circuito_calculos';

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- DROP TABLE IF EXISTS curto_circuito_calculos;
-- ============================================================

-- ============================================================
-- 067_engenharia_calculos.sql
-- Módulo Engenharia — primeiro tipo de cálculo: dimensionamento de
-- cabos elétricos (NBR 5410). tipo_calculo prepara o campo para
-- futuros cálculos de engenharia (queda de tensão, curto-circuito,
-- luminotécnica, SPDA...) sem precisar de tabela nova por tipo.
--
-- Vínculos:
--   cliente_id      uuid → clientes(id), nullable (cálculo pode não
--                   ter cliente vinculado ainda)
--   proposta_app_id text, SEM FK — idioma do projeto (mesma convenção
--                   de obras.proposta_app_id / financeiro_*): o
--                   identificador real de uma proposta é o app_id
--                   gerado no front, não a PK da tabela propostas.
--   duplicado_de_id uuid → engenharia_calculos(id), rastreabilidade
--                   de "usar como base"
--
-- RLS no idioma do projeto (001_rls_policies.sql):
--   auth_empresa_ids() — fronteira = empresa. Restrição por perfil
--   (ver/criar/editar) fica na APLICAÇÃO.
--
-- Executar no SQL Editor do Supabase.
-- Depende de: 001_rls_policies.sql, 064_clientes.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS engenharia_calculos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo_calculo    text NOT NULL DEFAULT 'dimensionamento_cabos',
  criado_por      uuid NOT NULL REFERENCES usuarios(id),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  cliente_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  proposta_app_id text,
  duplicado_de_id uuid REFERENCES engenharia_calculos(id) ON DELETE SET NULL,
  titulo          text NOT NULL,
  status          text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'finalizado')),
  app_version     text NOT NULL,
  entrada         jsonb NOT NULL,
  resultado       jsonb NOT NULL,
  CONSTRAINT engenharia_calculos_titulo_not_blank CHECK (length(trim(titulo)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_engenharia_calculos_empresa   ON engenharia_calculos (empresa_id);
CREATE INDEX IF NOT EXISTS idx_engenharia_calculos_cliente   ON engenharia_calculos (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engenharia_calculos_proposta  ON engenharia_calculos (proposta_app_id) WHERE proposta_app_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engenharia_calculos_tipo      ON engenharia_calculos (empresa_id, tipo_calculo);

COMMENT ON TABLE engenharia_calculos IS 'Cálculos de engenharia (primeiro tipo: dimensionamento de cabos NBR 5410). entrada = snapshot dos campos do formulário; resultado = snapshot do retorno do motor de cálculo. Memorial é gerado sob demanda, não armazenado.';
COMMENT ON COLUMN engenharia_calculos.proposta_app_id IS 'app_id da proposta no portal (texto), vínculo opcional sem FK — mesma convenção de obras.proposta_app_id.';

-- ── RLS (idioma do projeto — fronteira = empresa) ─────────────
ALTER TABLE engenharia_calculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "engenharia_calculos: empresa" ON engenharia_calculos;
CREATE POLICY "engenharia_calculos: empresa" ON engenharia_calculos
  FOR ALL
  USING (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'engenharia_calculos';
-- SELECT polname, polcmd FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='engenharia_calculos';
-- SELECT indexname FROM pg_indexes WHERE tablename='engenharia_calculos';

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- DROP TABLE IF EXISTS engenharia_calculos;
-- ============================================================

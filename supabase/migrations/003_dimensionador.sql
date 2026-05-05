-- ============================================================
-- 003_dimensionador.sql
-- Módulo Dimensionador: catálogo de produtos e tabelas de
-- dimensionamento de infraestrutura de encaminhamento.
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor).
-- ============================================================


-- ============================================================
-- TABELA: produtos_catalogo
-- Catálogo global de produtos (Dispan, outros fabricantes).
-- Leitura por todos os usuários autenticados.
-- Escrita restrita a dono/admin.
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos_catalogo (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_fabricante   text NOT NULL,
  fabricante          text NOT NULL DEFAULT 'Dispan',
  familia             text,
  grupo               text,
  subgrupo            text,
  descricao_completa  text NOT NULL,
  categoria_me        text NOT NULL,     -- ME-01, ME-12, etc.
  unidade             text NOT NULL DEFAULT 'un',
  ncm                 text,
  caracteristicas     jsonb,             -- atributos técnicos livres
  ativo               boolean NOT NULL DEFAULT true,
  criado_em           timestamptz NOT NULL DEFAULT now(),
  atualizado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS produtos_catalogo_codigo_fabricante_idx
  ON produtos_catalogo(codigo_fabricante);

CREATE INDEX IF NOT EXISTS produtos_catalogo_categoria_idx
  ON produtos_catalogo(categoria_me);

CREATE INDEX IF NOT EXISTS produtos_catalogo_familia_grupo_idx
  ON produtos_catalogo(familia, grupo);

ALTER TABLE produtos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_catalogo: leitura autenticada"
  ON produtos_catalogo FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "produtos_catalogo: escrita dono/admin"
  ON produtos_catalogo FOR INSERT
  WITH CHECK (auth_perfil() IN ('dono', 'admin', 'gestor'));

CREATE POLICY "produtos_catalogo: atualizar dono/admin"
  ON produtos_catalogo FOR UPDATE
  USING (auth_perfil() IN ('dono', 'admin', 'gestor'));

CREATE POLICY "produtos_catalogo: deletar dono/admin"
  ON produtos_catalogo FOR DELETE
  USING (auth_perfil() IN ('dono', 'admin'));


-- ============================================================
-- TABELA: dimensionamentos
-- Cabeçalho de cada dimensionamento realizado.
-- Vinculado a uma proposta e a uma empresa.
-- ============================================================
CREATE TABLE IF NOT EXISTS dimensionamentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  proposta_id   uuid REFERENCES propostas(id) ON DELETE SET NULL,
  tipo_servico  text NOT NULL DEFAULT 'eletrocalha',
  descricao     text,
  criado_por    uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  status        text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'calculado', 'inserido_proposta')),
  observacoes   text,
  dados_form    jsonb    -- snapshot completo do formulário para replay
);

CREATE INDEX IF NOT EXISTS dimensionamentos_empresa_idx
  ON dimensionamentos(empresa_id);

CREATE INDEX IF NOT EXISTS dimensionamentos_proposta_idx
  ON dimensionamentos(proposta_id);

ALTER TABLE dimensionamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dimensionamentos: ver da empresa"
  ON dimensionamentos FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

CREATE POLICY "dimensionamentos: inserir na empresa"
  ON dimensionamentos FOR INSERT
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

CREATE POLICY "dimensionamentos: atualizar na empresa"
  ON dimensionamentos FOR UPDATE
  USING (empresa_id IN (SELECT auth_empresa_ids()));

CREATE POLICY "dimensionamentos: deletar gestor+"
  ON dimensionamentos FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- TABELA: dimensionamento_trechos
-- Cada trecho do trajeto (suspensão, parede, coluna, etc.)
-- com seus parâmetros de montagem.
-- ============================================================
CREATE TABLE IF NOT EXISTS dimensionamento_trechos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimensionamento_id   uuid NOT NULL REFERENCES dimensionamentos(id) ON DELETE CASCADE,
  ordem                int NOT NULL DEFAULT 0,
  tipo_fixacao         text NOT NULL
    CHECK (tipo_fixacao IN ('suspensao', 'parede', 'coluna', 'sobre_calha')),
  comprimento_m        numeric(10,3) NOT NULL DEFAULT 0,
  -- Parâmetros de suspensão
  altura_suspensao_mm  numeric(10,1),
  espacamento_m        numeric(10,2),
  fixacao_viga         text CHECK (fixacao_viga IN ('grampo_c', 'chumbador', 'olhal')),
  bitola_vergalhao     text CHECK (bitola_vergalhao IN ('1/4', '5/16', '3/8', '1/2')),
  tipo_suporte         text CHECK (tipo_suporte IN ('horizontal', 'vertical', 'duplo', 'reforcado')),
  -- Parâmetros de parede
  espacamento_parede_m numeric(10,2),
  tipo_suporte_parede  text CHECK (tipo_suporte_parede IN ('simples', 'duplo', 'reforcado')),
  -- Fator de perda individual (herda do cabeçalho se nulo)
  fator_perda_pct      numeric(5,2) DEFAULT 5
);

CREATE INDEX IF NOT EXISTS dimensionamento_trechos_dim_idx
  ON dimensionamento_trechos(dimensionamento_id, ordem);

ALTER TABLE dimensionamento_trechos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dimensionamento_trechos: ver via dimensionamento"
  ON dimensionamento_trechos FOR SELECT
  USING (
    dimensionamento_id IN (
      SELECT id FROM dimensionamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "dimensionamento_trechos: inserir via dimensionamento"
  ON dimensionamento_trechos FOR INSERT
  WITH CHECK (
    dimensionamento_id IN (
      SELECT id FROM dimensionamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "dimensionamento_trechos: atualizar via dimensionamento"
  ON dimensionamento_trechos FOR UPDATE
  USING (
    dimensionamento_id IN (
      SELECT id FROM dimensionamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "dimensionamento_trechos: deletar via dimensionamento"
  ON dimensionamento_trechos FOR DELETE
  USING (
    dimensionamento_id IN (
      SELECT id FROM dimensionamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );


-- ============================================================
-- TABELA: dimensionamento_itens
-- Itens gerados pelo cálculo automático ou inseridos manualmente.
-- ============================================================
CREATE TABLE IF NOT EXISTS dimensionamento_itens (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimensionamento_id   uuid NOT NULL REFERENCES dimensionamentos(id) ON DELETE CASCADE,
  produto_catalogo_id  uuid REFERENCES produtos_catalogo(id) ON DELETE SET NULL,
  categoria_me         text NOT NULL,
  codigo_fabricante    text NOT NULL,
  codigo_interno       text,              -- preenchido pelo usuário após cotação
  descricao_completa   text NOT NULL,
  quantidade           numeric(12,3) NOT NULL DEFAULT 0,
  unidade              text NOT NULL DEFAULT 'un',
  custo_unitario       numeric(14,4),    -- null até receber cotação
  ncm                  text,
  origem               text NOT NULL DEFAULT 'calculado'
    CHECK (origem IN ('calculado', 'manual', 'duplicado')),
  editado_manualmente  boolean NOT NULL DEFAULT false,
  observacoes          text,
  ordem                int NOT NULL DEFAULT 0,
  area_local           text,             -- trecho de referência
  criado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_em        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dimensionamento_itens_dim_idx
  ON dimensionamento_itens(dimensionamento_id, ordem);

ALTER TABLE dimensionamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dimensionamento_itens: ver via dimensionamento"
  ON dimensionamento_itens FOR SELECT
  USING (
    dimensionamento_id IN (
      SELECT id FROM dimensionamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "dimensionamento_itens: inserir via dimensionamento"
  ON dimensionamento_itens FOR INSERT
  WITH CHECK (
    dimensionamento_id IN (
      SELECT id FROM dimensionamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "dimensionamento_itens: atualizar via dimensionamento"
  ON dimensionamento_itens FOR UPDATE
  USING (
    dimensionamento_id IN (
      SELECT id FROM dimensionamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "dimensionamento_itens: deletar via dimensionamento"
  ON dimensionamento_itens FOR DELETE
  USING (
    dimensionamento_id IN (
      SELECT id FROM dimensionamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );


-- ============================================================
-- TABELA: templates_dimensionamento
-- Templates reutilizáveis de dimensionamento.
-- ============================================================
CREATE TABLE IF NOT EXISTS templates_dimensionamento (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome         text NOT NULL,
  tipo_servico text NOT NULL DEFAULT 'eletrocalha',
  criado_por   uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  dados        jsonb NOT NULL,    -- snapshot completo do formulário
  ativo        boolean NOT NULL DEFAULT true,
  criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS templates_dim_empresa_idx
  ON templates_dimensionamento(empresa_id, ativo);

ALTER TABLE templates_dimensionamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "templates_dim: ver da empresa"
  ON templates_dimensionamento FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

CREATE POLICY "templates_dim: inserir na empresa"
  ON templates_dimensionamento FOR INSERT
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

CREATE POLICY "templates_dim: atualizar na empresa"
  ON templates_dimensionamento FOR UPDATE
  USING (empresa_id IN (SELECT auth_empresa_ids()));

CREATE POLICY "templates_dim: deletar gestor+"
  ON templates_dimensionamento FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- TRIGGER: atualiza atualizado_em automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dimensionamentos_atualizado
  BEFORE UPDATE ON dimensionamentos
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER trg_dimensionamento_itens_atualizado
  BEFORE UPDATE ON dimensionamento_itens
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

CREATE TRIGGER trg_produtos_catalogo_atualizado
  BEFORE UPDATE ON produtos_catalogo
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em();

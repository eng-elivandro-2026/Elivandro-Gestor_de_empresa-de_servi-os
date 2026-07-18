-- ============================================================
-- 064_clientes.sql
-- Módulo Clientes — cadastro robusto no Supabase, substitui o
-- cadastro antigo (localStorage + configuracoes.tf_clientes).
--
-- 3 tabelas:
--   clientes            — empresa cliente (dados do Comprovante de CNPJ + segmento/origem)
--   cliente_contatos    — pessoas da empresa cliente (papéis, canais, preferências)
--   cliente_organograma — relações entre contatos (mapa de poder; hierarquia mora AQUI,
--                         não em cliente_contatos — fonte única, sem coluna reporta_para)
--
-- CNPJ: texto livre normalizado (aceita 14 dígitos atuais E o futuro
-- alfanumérico de 2026). Unicidade por empresa via ÍNDICE ÚNICO PARCIAL
-- sobre a expressão normalizada (constraint UNIQUE não aceita WHERE).
--
-- RLS no idioma do projeto (001_rls_policies.sql):
--   auth_empresa_ids() — fronteira = empresa (multi-empresa correto).
-- Restrição por perfil (ver/criar/editar/excluir) fica na APLICAÇÃO.
--
-- Executar no SQL Editor do Supabase.
-- Depende de: 001_rls_policies.sql.
-- ============================================================

-- ── 1. Clientes ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id              uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  apelido                 text NOT NULL,          -- nome fantasia / como a equipe chama (usado em pastas e propostas)
  razao_social            text,
  cnpj                    text,                   -- alfanumérico, sem máscara rígida
  inscricao_estadual      text,
  inscricao_municipal     text,
  tipo_estabelecimento    text CHECK (tipo_estabelecimento IN ('matriz', 'filial', 'unico')),
  data_abertura           date,
  natureza_juridica       text,
  porte                   text CHECK (porte IN ('mei', 'micro', 'pequena', 'media', 'grande', 'demais')),
  situacao_cadastral      text CHECK (situacao_cadastral IN ('ativa', 'suspensa', 'inapta', 'baixada', 'nula')),
  data_situacao_cadastral date,
  cnae_principal          text,
  cnae_secundarios        text[] NOT NULL DEFAULT '{}',
  segmento                text,
  email                   text,
  telefone                text,
  site                    text,
  cep                     text,
  logradouro              text,
  numero                  text,
  complemento             text,
  bairro                  text,
  cidade                  text,
  estado                  text,
  origem                  text CHECK (origem IN ('prospeccao', 'indicacao', 'evento', 'outro', 'manual')),
  dados_importados_cnpj   boolean NOT NULL DEFAULT false,   -- true = preenchido pelo parser do Comprovante de CNPJ
  observacoes             text,
  ativo                   boolean NOT NULL DEFAULT true,
  criado_por              uuid REFERENCES usuarios(id),
  criado_em               timestamptz NOT NULL DEFAULT now(),
  atualizado_em           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clientes_apelido_not_blank CHECK (length(trim(apelido)) > 0)
);

-- Unicidade de CNPJ por empresa: índice único PARCIAL sobre a forma
-- normalizada (só alfanuméricos, caixa alta) — ignora vazio/nulo, e
-- "12.345.678/0001-90" e "12345678000190" contam como o mesmo CNPJ.
CREATE UNIQUE INDEX IF NOT EXISTS uidx_clientes_empresa_cnpj
  ON clientes (empresa_id, upper(regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g')))
  WHERE cnpj IS NOT NULL AND trim(cnpj) <> '';

CREATE INDEX IF NOT EXISTS idx_clientes_empresa_ativo ON clientes (empresa_id, ativo);
CREATE INDEX IF NOT EXISTS idx_clientes_apelido       ON clientes (empresa_id, lower(apelido));

COMMENT ON TABLE clientes IS 'Clientes (empresas atendidas). Substitui o cadastro antigo em localStorage/configuracoes. CNPJ texto livre (preparado p/ alfanumérico 2026), único por empresa via índice parcial normalizado.';

-- ── 2. Contatos do cliente ────────────────────────────────────
CREATE TABLE IF NOT EXISTS cliente_contatos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  empresa_id            uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome                  text NOT NULL,
  cargo                 text,
  departamento          text,
  tipo_vinculo          text CHECK (tipo_vinculo IN ('funcionario', 'socio', 'terceiro', 'consultor')),
  whatsapp              text,
  telefone              text,
  email_profissional    text,
  email_pessoal         text,
  linkedin              text,
  contato_principal     boolean NOT NULL DEFAULT false,
  decisor_compra        boolean NOT NULL DEFAULT false,
  aprovador_verba       boolean NOT NULL DEFAULT false,
  influenciador_tecnico boolean NOT NULL DEFAULT false,
  usuario_servico       boolean NOT NULL DEFAULT false,
  precisa_treinamento   boolean NOT NULL DEFAULT false,
  papel_principal       text CHECK (papel_principal IN ('decisor_final', 'aprovador_verba',
                                    'influenciador_tecnico', 'usuario_servico',
                                    'contato_operacional', 'porteiro')),
  melhor_horario        text,
  canal_preferido       text CHECK (canal_preferido IN ('whatsapp', 'ligacao', 'email', 'presencial')),
  observacoes           text,                     -- personalidade, como abordar, o que evitar
  ativo                 boolean NOT NULL DEFAULT true,
  origem                text CHECK (origem IN ('prospeccao', 'manual')),
  criado_em             timestamptz NOT NULL DEFAULT now(),
  atualizado_em         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cliente_contatos_nome_not_blank CHECK (length(trim(nome)) > 0)
);
-- Nota: SEM coluna reporta_para — hierarquia fica só em cliente_organograma
-- (tipo_relacao 'reporta_para'), evitando duas fontes de verdade.

CREATE INDEX IF NOT EXISTS idx_cliente_contatos_cliente ON cliente_contatos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_contatos_empresa ON cliente_contatos (empresa_id);

COMMENT ON TABLE cliente_contatos IS 'Pessoas da empresa cliente: papéis de compra (flags + papel_principal), canais e preferências de abordagem.';

-- ── 3. Organograma (relações entre contatos) ──────────────────
CREATE TABLE IF NOT EXISTS cliente_organograma (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  cliente_id         uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  contato_origem_id  uuid NOT NULL REFERENCES cliente_contatos(id) ON DELETE CASCADE,
  contato_destino_id uuid NOT NULL REFERENCES cliente_contatos(id) ON DELETE CASCADE,
  tipo_relacao       text NOT NULL CHECK (tipo_relacao IN ('reporta_para', 'influencia', 'aprova', 'decide_junto')),
  observacao         text,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cliente_organograma_sem_laco CHECK (contato_origem_id <> contato_destino_id),
  CONSTRAINT cliente_organograma_relacao_unica UNIQUE (contato_origem_id, contato_destino_id, tipo_relacao)
);

CREATE INDEX IF NOT EXISTS idx_cliente_organograma_cliente ON cliente_organograma (cliente_id);

COMMENT ON TABLE cliente_organograma IS 'Mapa de poder do cliente: arestas entre contatos (reporta_para/influencia/aprova/decide_junto). Sem laços; 1 aresta por par+tipo.';

-- ── RLS (idioma do projeto — fronteira = empresa) ─────────────
ALTER TABLE clientes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_contatos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cliente_organograma ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes: empresa" ON clientes;
CREATE POLICY "clientes: empresa" ON clientes
  FOR ALL
  USING (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "cliente_contatos: empresa" ON cliente_contatos;
CREATE POLICY "cliente_contatos: empresa" ON cliente_contatos
  FOR ALL
  USING (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

DROP POLICY IF EXISTS "cliente_organograma: empresa" ON cliente_organograma;
CREATE POLICY "cliente_organograma: empresa" ON cliente_organograma
  FOR ALL
  USING (empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
--  WHERE table_name IN ('clientes','cliente_contatos','cliente_organograma')
--  ORDER BY table_name;                                        -- 3 linhas
-- SELECT polname, polcmd FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid
--  WHERE c.relname IN ('clientes','cliente_contatos','cliente_organograma'); -- 3 policies
-- SELECT indexname FROM pg_indexes WHERE tablename = 'clientes';
--   -- deve incluir uidx_clientes_empresa_cnpj

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- DROP TABLE IF EXISTS cliente_organograma;
-- DROP TABLE IF EXISTS cliente_contatos;
-- DROP TABLE IF EXISTS clientes;
-- ============================================================

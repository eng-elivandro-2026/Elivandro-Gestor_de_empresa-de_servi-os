-- ============================================================
-- 019_empresas_cadastro_completo.sql
-- Adiciona campos fiscais, de endereço e de contato à tabela
-- empresas. Migration estritamente aditiva: nenhum campo
-- existente é alterado, renomeado ou removido. Todos os novos
-- campos são nullable, exceto config_json (default '{}').
--
-- Depende de: 001_rls_policies.sql (RLS já habilitado)
-- ============================================================

-- ── Dados fiscais ─────────────────────────────────────────────
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS razao_social         TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_estadual   TEXT,
  ADD COLUMN IF NOT EXISTS inscricao_municipal  TEXT;

-- ── Endereço fiscal ───────────────────────────────────────────
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS endereco_logradouro  TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero      TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro      TEXT,
  ADD COLUMN IF NOT EXISTS endereco_municipio   TEXT,
  ADD COLUMN IF NOT EXISTS endereco_uf          CHAR(2),
  ADD COLUMN IF NOT EXISTS endereco_cep         TEXT;

-- ── Contato ───────────────────────────────────────────────────
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS telefone             TEXT,
  ADD COLUMN IF NOT EXISTS email                TEXT,
  ADD COLUMN IF NOT EXISTS email_financeiro     TEXT;

-- ── Logo via Storage (substitui logo_url gradualmente) ────────
-- logo_url existente é mantido. logo_storage_path é o caminho
-- para o arquivo no Supabase Storage (bucket 'logos').
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS logo_storage_path    TEXT;

-- ── Configurações específicas da empresa ──────────────────────
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS config_json          JSONB DEFAULT '{}';

-- Garantir que registros existentes tenham o default preenchido
UPDATE empresas SET config_json = '{}' WHERE config_json IS NULL;

-- ── Comentários para documentação inline ──────────────────────
COMMENT ON COLUMN empresas.razao_social        IS 'Razão social completa (usada em NF-e, documentos fiscais)';
COMMENT ON COLUMN empresas.inscricao_estadual  IS 'IE — Inscrição Estadual (SEFAZ)';
COMMENT ON COLUMN empresas.inscricao_municipal IS 'IM — Inscrição Municipal (NFS-e)';
COMMENT ON COLUMN empresas.endereco_logradouro IS 'Logradouro (rua, avenida, etc.)';
COMMENT ON COLUMN empresas.endereco_numero     IS 'Número do endereço';
COMMENT ON COLUMN empresas.endereco_complemento IS 'Complemento (sala, andar, bloco)';
COMMENT ON COLUMN empresas.endereco_bairro     IS 'Bairro';
COMMENT ON COLUMN empresas.endereco_municipio  IS 'Município (cidade)';
COMMENT ON COLUMN empresas.endereco_uf         IS 'UF — 2 caracteres (ex: SP, RJ)';
COMMENT ON COLUMN empresas.endereco_cep        IS 'CEP — sem formatação ou com máscara';
COMMENT ON COLUMN empresas.telefone            IS 'Telefone principal da empresa';
COMMENT ON COLUMN empresas.email               IS 'E-mail geral de contato';
COMMENT ON COLUMN empresas.email_financeiro    IS 'E-mail específico para alertas e notificações financeiras';
COMMENT ON COLUMN empresas.logo_storage_path   IS 'Caminho no Supabase Storage bucket logos (substitui logo_url)';
COMMENT ON COLUMN empresas.config_json         IS 'Configurações específicas da empresa em formato livre';

-- ── RLS: nenhuma política nova necessária ─────────────────────
-- As políticas existentes já cobrem os novos campos:
--   SELECT: "empresas: ver proprias"  → id IN auth_empresa_ids()
--   UPDATE: "empresas: dono atualiza" → id IN auth_empresa_ids() AND auth_perfil() = 'dono'
-- Os novos campos ficam automaticamente sob essas mesmas políticas.

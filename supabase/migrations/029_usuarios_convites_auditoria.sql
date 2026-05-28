-- 029_usuarios_convites_auditoria.sql
-- USUARIOS-D - Auditoria para criacao/reenvio controlado de acesso.
--
-- Esta migration cria apenas uma tabela nova de trilha/auditoria.
-- Nao altera RLS/policies de usuarios, usuario_empresas ou empresas.

CREATE TABLE IF NOT EXISTS usuarios_convites_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES empresas(id),
  usuario_id uuid REFERENCES usuarios(id),
  auth_id uuid,
  email text NOT NULL,
  nome text NOT NULL,
  perfil_empresa text NOT NULL,
  status text NOT NULL DEFAULT 'preparado',
  solicitado_por_usuario_id uuid REFERENCES usuarios(id),
  solicitado_por_auth_id uuid,
  dry_run boolean NOT NULL DEFAULT false,
  enviar_email boolean NOT NULL DEFAULT false,
  auth_criado boolean NOT NULL DEFAULT false,
  redirect_to text,
  metadata jsonb NOT NULL DEFAULT '{}',
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT usuarios_convites_acesso_email_len_check
    CHECK (length(email) BETWEEN 3 AND 254),
  CONSTRAINT usuarios_convites_acesso_nome_len_check
    CHECK (length(nome) BETWEEN 2 AND 160),
  CONSTRAINT usuarios_convites_acesso_perfil_check
    CHECK (
      perfil_empresa IN (
        'admin',
        'colaborador',
        'comercial',
        'dono',
        'financeiro',
        'gestor',
        'leitura',
        'operacional',
        'prestador',
        'rh'
      )
    ),
  CONSTRAINT usuarios_convites_acesso_status_check
    CHECK (status IN ('preparado', 'concluido', 'erro')),
  CONSTRAINT usuarios_convites_acesso_redirect_len_check
    CHECK (redirect_to IS NULL OR length(redirect_to) <= 2048),
  CONSTRAINT usuarios_convites_acesso_erro_len_check
    CHECK (erro IS NULL OR length(erro) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_convites_acesso_empresa
  ON usuarios_convites_acesso (empresa_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_convites_acesso_usuario
  ON usuarios_convites_acesso (usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_convites_acesso_email
  ON usuarios_convites_acesso (lower(email));

CREATE INDEX IF NOT EXISTS idx_usuarios_convites_acesso_solicitante
  ON usuarios_convites_acesso (solicitado_por_usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuarios_convites_acesso_created_at
  ON usuarios_convites_acesso (created_at);

DROP TRIGGER IF EXISTS trg_usuarios_convites_acesso_updated_at
  ON usuarios_convites_acesso;

CREATE TRIGGER trg_usuarios_convites_acesso_updated_at
  BEFORE UPDATE ON usuarios_convites_acesso
  FOR EACH ROW EXECUTE FUNCTION financeiro_set_updated_at();

ALTER TABLE usuarios_convites_acesso ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_convites_acesso: ver empresa autorizada"
  ON usuarios_convites_acesso;

CREATE POLICY "usuarios_convites_acesso: ver empresa autorizada"
  ON usuarios_convites_acesso FOR SELECT
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'admin')
  );

DROP POLICY IF EXISTS "usuarios_convites_acesso: inserir empresa autorizada"
  ON usuarios_convites_acesso;

CREATE POLICY "usuarios_convites_acesso: inserir empresa autorizada"
  ON usuarios_convites_acesso FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'admin')
  );

DROP POLICY IF EXISTS "usuarios_convites_acesso: atualizar empresa autorizada"
  ON usuarios_convites_acesso;

CREATE POLICY "usuarios_convites_acesso: atualizar empresa autorizada"
  ON usuarios_convites_acesso FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'admin')
  )
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'admin')
  );

COMMENT ON TABLE usuarios_convites_acesso IS
  'Auditoria de criacao/preparacao de acesso de usuarios por empresa.';

COMMENT ON COLUMN usuarios_convites_acesso.dry_run IS
  'Quando true, representa validacao sem criacao de usuario ou envio.';

COMMENT ON COLUMN usuarios_convites_acesso.enviar_email IS
  'Indica se a chamada autorizou envio de email pela rotina backend.';

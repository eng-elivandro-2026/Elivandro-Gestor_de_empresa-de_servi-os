-- ============================================================
-- 070_cadastros_pendentes.sql
-- Onboarding — fila de cadastros de novas empresas beta.
-- O formulário público (cadastro.html) faz auth.signUp e insere
-- aqui um pedido "pendente"; o proprietário aprova depois (cria a
-- empresa e o vínculo do dono manualmente / por processo à parte).
--
-- RLS: INSERT público (o formulário roda sem sessão autenticada),
--      restrito a status='pendente'. Leitura/edição/exclusão só para
--      o master (is_master()).
--
-- Executar no SQL Editor do Supabase.
-- Depende de: (auth schema padrão do Supabase).
-- ============================================================

-- ── Helper is_master(): identifica o superadmin da plataforma ──
-- Idempotente. Baseado no e-mail do JWT (mesmo superadmin usado no
-- frontend). Para anon (sem JWT) retorna false.
CREATE OR REPLACE FUNCTION is_master()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'nascimento.gaube@gmail.com';
$$;
REVOKE ALL ON FUNCTION is_master() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_master() TO anon, authenticated;

-- ── Tabela ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cadastros_pendentes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id       uuid,
  nome          text NOT NULL,
  email         text NOT NULL,
  empresa_nome  text NOT NULL,
  empresa_cnpj  text NOT NULL,
  status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','aprovado','rejeitado')),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  aprovado_em   timestamptz,
  aprovado_por  uuid,
  observacao    text,
  CONSTRAINT cadastros_pendentes_nome_not_blank    CHECK (length(trim(nome)) > 0),
  CONSTRAINT cadastros_pendentes_email_not_blank   CHECK (length(trim(email)) > 0),
  CONSTRAINT cadastros_pendentes_empresa_not_blank CHECK (length(trim(empresa_nome)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_cadastros_pendentes_status ON cadastros_pendentes (status, criado_em DESC);

COMMENT ON TABLE cadastros_pendentes IS 'Fila de pedidos de cadastro de novas empresas (onboarding beta). INSERT público restrito a status=pendente; leitura/aprovação só pelo master (is_master()).';

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE cadastros_pendentes ENABLE ROW LEVEL SECURITY;

-- INSERT público (form sem login): só pode inserir como 'pendente'.
DROP POLICY IF EXISTS "cadastros_pendentes: insert publico" ON cadastros_pendentes;
CREATE POLICY "cadastros_pendentes: insert publico" ON cadastros_pendentes
  FOR INSERT
  WITH CHECK (status = 'pendente');

-- SELECT / UPDATE / DELETE: somente o master.
DROP POLICY IF EXISTS "cadastros_pendentes: select master" ON cadastros_pendentes;
CREATE POLICY "cadastros_pendentes: select master" ON cadastros_pendentes
  FOR SELECT USING (is_master());

DROP POLICY IF EXISTS "cadastros_pendentes: update master" ON cadastros_pendentes;
CREATE POLICY "cadastros_pendentes: update master" ON cadastros_pendentes
  FOR UPDATE USING (is_master()) WITH CHECK (is_master());

DROP POLICY IF EXISTS "cadastros_pendentes: delete master" ON cadastros_pendentes;
CREATE POLICY "cadastros_pendentes: delete master" ON cadastros_pendentes
  FOR DELETE USING (is_master());

-- Privilégios de tabela (a policy de RLS ainda gateia cada linha):
-- anon precisa de INSERT para o formulário público funcionar.
GRANT INSERT ON cadastros_pendentes TO anon;
GRANT INSERT, SELECT, UPDATE, DELETE ON cadastros_pendentes TO authenticated;

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name='cadastros_pendentes';
-- SELECT polname, polcmd FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relname='cadastros_pendentes';
-- SELECT proname FROM pg_proc WHERE proname='is_master';

-- ============================================================
-- ROLLBACK (referência — não executar automaticamente)
-- ============================================================
-- DROP TABLE IF EXISTS cadastros_pendentes;
-- DROP FUNCTION IF EXISTS is_master();
-- ============================================================

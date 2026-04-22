-- ============================================================
-- 002_rpc_helpers.sql
-- Funções RPC auxiliares para o portal TecFusion.
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor).
-- ============================================================

-- Retorna o auth.uid de um usuário pelo e-mail.
-- Necessário para vincular usuários convidados via dashboard do Supabase.
-- Apenas dono/admin podem chamar (verificado no portal via RLS na chamada).
CREATE OR REPLACE FUNCTION get_auth_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM auth.users WHERE email = lower(trim(p_email)) LIMIT 1;
$$;

-- Garante que apenas usuários autenticados podem chamar
REVOKE ALL ON FUNCTION get_auth_id_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_auth_id_by_email(text) TO authenticated;

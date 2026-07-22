-- ============================================================
-- 071_fn_empresa_ultimo_acesso.sql
-- Painel de Superadmin (Entregável 1).
--
-- 1) Função get_empresa_ultimo_acesso(): último acesso (MAX de
--    auth.users.last_sign_in_at) entre os usuários de uma empresa.
--    SECURITY DEFINER porque toca no schema auth (não exposto ao
--    cliente). Restrita ao master (is_master()).
--
-- 2) Vincula o master (superadmin) a TODAS as empresas existentes.
--    O RLS do projeto usa auth_empresa_ids() — o master só enxerga
--    (dashboard global + Modo Espião) empresas onde é membro. Novas
--    empresas recebem o vínculo pela Edge Function provisionar-empresa;
--    aqui fazemos o backfill das já existentes. Idempotente.
--
-- Executar no SQL Editor do Supabase.
-- Depende de: is_master() (migration 070), tabelas usuarios /
--             usuario_empresas / empresas / auth.users.
-- ============================================================

-- ── 1. Função: último acesso da empresa ──────────────────────
CREATE OR REPLACE FUNCTION get_empresa_ultimo_acesso(p_empresa_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT max(au.last_sign_in_at)
  FROM usuario_empresas ue
  JOIN usuarios u    ON u.id  = ue.usuario_id
  JOIN auth.users au ON au.id = u.auth_id
  WHERE ue.empresa_id = p_empresa_id
    AND ue.ativo = true
    AND is_master();   -- só o superadmin obtém o valor; demais recebem NULL
$$;

REVOKE ALL ON FUNCTION get_empresa_ultimo_acesso(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_empresa_ultimo_acesso(uuid) TO authenticated;

-- ── 2. Backfill: master vinculado a todas as empresas ────────
DO $$
DECLARE
  v_master_uid uuid;
BEGIN
  SELECT id INTO v_master_uid
  FROM usuarios
  WHERE lower(email) = 'nascimento.gaube@gmail.com'
  LIMIT 1;

  IF v_master_uid IS NOT NULL THEN
    INSERT INTO usuario_empresas (usuario_id, empresa_id, ativo, perfil_empresa)
    SELECT v_master_uid, e.id, true, 'dono'
    FROM empresas e
    WHERE NOT EXISTS (
      SELECT 1 FROM usuario_empresas ue
      WHERE ue.usuario_id = v_master_uid
        AND ue.empresa_id = e.id
    );
  END IF;
END $$;

-- ============================================================
-- VERIFICAÇÃO (executar separadamente)
-- ============================================================
-- SELECT proname FROM pg_proc WHERE proname = 'get_empresa_ultimo_acesso';
-- SELECT count(*) FROM usuario_empresas ue
--   JOIN usuarios u ON u.id = ue.usuario_id
--   WHERE lower(u.email) = 'nascimento.gaube@gmail.com';  -- deve = nº de empresas
-- ============================================================

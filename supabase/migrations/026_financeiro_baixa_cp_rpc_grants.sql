-- 026_financeiro_baixa_cp_rpc_grants.sql
-- F3.8-B - Hardening de permissao da RPC de baixa real de CP.
--
-- Objetivo:
--   Remover execucao anonima explicita da funcao transacional.
--   A funcao ja bloqueia auth.uid() nulo, mas o grant tambem deve
--   refletir que somente usuarios autenticados podem chama-la.

REVOKE ALL ON FUNCTION financeiro_registrar_baixa_conta_pagar(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION financeiro_registrar_baixa_conta_pagar(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION financeiro_registrar_baixa_conta_pagar(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION financeiro_registrar_baixa_conta_pagar(
  uuid,
  uuid,
  numeric,
  date,
  uuid,
  uuid,
  text,
  text
) TO service_role;


-- Rollback manual sugerido, se necessario em ambiente de revisao:
--
-- GRANT EXECUTE ON FUNCTION financeiro_registrar_baixa_conta_pagar(
--   uuid, uuid, numeric, date, uuid, uuid, text, text
-- ) TO anon;

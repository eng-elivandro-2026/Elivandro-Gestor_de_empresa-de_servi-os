-- ============================================================
-- 034_limpar_assinaturas_rpc.sql
-- Função RPC para limpar assinaturas (contorna problemas de RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION limpar_assinaturas_gestao(
  p_doc_id UUID,
  p_empresa_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_updated_count INT;
BEGIN
  UPDATE gestao_negocio
  SET
    assinatura_cliente = '',
    assinatura_empresa = '',
    responsavel_cliente_nome = '',
    responsavel_empresa_nome = '',
    assinado_cliente_em = NULL,
    assinado_empresa_em = NULL,
    bloqueado = false,
    status_documento = 'rascunho'
  WHERE id = p_doc_id AND empresa_id = p_empresa_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'updated_rows', v_updated_count,
    'message', 'Assinaturas deletadas: ' || v_updated_count || ' linha(s)'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: Permite chamada se usuário é dono ou admin
CREATE POLICY "limpar_assinaturas_policy" ON gestao_negocio
  FOR UPDATE
  USING (
    auth.uid()::text = (
      SELECT user_id FROM usuarios
      WHERE id = auth.uid() AND perfil IN ('dono', 'admin')
    )
  );

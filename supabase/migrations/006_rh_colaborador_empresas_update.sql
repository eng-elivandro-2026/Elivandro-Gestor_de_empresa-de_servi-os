-- Permite que dono/gestor/admin editem e removam vinculos de colaboradores
-- nas empresas em que possuem acesso. Necessario para persistir edicoes
-- especificas por empresa no modulo RH.

DROP POLICY IF EXISTS "colaborador_empresas: gestor+ atualiza" ON colaborador_empresas;
CREATE POLICY "colaborador_empresas: gestor+ atualiza"
  ON colaborador_empresas FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  )
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

DROP POLICY IF EXISTS "colaborador_empresas: gestor+ remove" ON colaborador_empresas;
CREATE POLICY "colaborador_empresas: gestor+ remove"
  ON colaborador_empresas FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

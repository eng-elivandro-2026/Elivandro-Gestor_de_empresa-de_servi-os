-- ============================================================
-- 003_add_perfil_to_convites.sql
-- Adiciona coluna perfil à tabela convites para que o convite
-- já carregue o perfil correto do futuro usuário.
--
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor).
-- ============================================================

-- Adicionar coluna perfil em convites
ALTER TABLE convites ADD COLUMN IF NOT EXISTS perfil text DEFAULT 'gestor';

-- Adicionar RLS: dono pode gerenciar convites
-- (Se as políticas já existem, ignorar os erros CREATE POLICY)

-- Garantir que anon/service pode ler convites por email (para primeiro login)
DROP POLICY IF EXISTS "convites: leitura por email" ON convites;
CREATE POLICY "convites: leitura por email"
  ON convites FOR SELECT
  USING (
    -- Usuário autenticado lê convites para o seu email
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    -- Dono/admin vê todos os convites da sua empresa
    OR (
      auth.uid() IS NOT NULL
      AND empresa_id IN (SELECT auth_empresa_ids())
    )
  );

DROP POLICY IF EXISTS "convites: dono insere" ON convites;
CREATE POLICY "convites: dono insere"
  ON convites FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'admin', 'gestor')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

DROP POLICY IF EXISTS "convites: dono atualiza" ON convites;
CREATE POLICY "convites: dono atualiza"
  ON convites FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'admin', 'gestor')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

DROP POLICY IF EXISTS "convites: dono deleta" ON convites;
CREATE POLICY "convites: dono deleta"
  ON convites FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'admin', 'gestor')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

ALTER TABLE convites ENABLE ROW LEVEL SECURITY;

-- Garantir que colaboradores podem ser inseridos por gestores
-- (para o fluxo de convite com perfil colaborador/prestador)
DROP POLICY IF EXISTS "colaboradores: gestor+ escreve" ON colaboradores;
CREATE POLICY "colaboradores: gestor+ escreve"
  ON colaboradores FOR INSERT
  WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));

-- ── Verificação ──────────────────────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'convites' ORDER BY ordinal_position;

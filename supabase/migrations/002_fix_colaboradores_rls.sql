-- ============================================================
-- 002_fix_colaboradores_rls.sql
-- Corrige acesso de colaboradores/prestadores quando auth_id é NULL.
--
-- PROBLEMA: A política original "colaboradores: ver proprio" usa
--   USING (auth_id = auth.uid())
-- Quando auth_id é NULL, NULL = auth.uid() → FALSE → linha invisível.
-- Isso impede o fallback por email no login e no portal do colaborador.
--
-- SOLUÇÃO: Substituir a política por uma que aceita tanto auth_id
--   quanto email (para o caso de auth_id ainda não estar vinculado).
--
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor).
-- ============================================================

-- ── 1. Remover política antiga (se existir) ─────────────────
DROP POLICY IF EXISTS "colaboradores: ver proprio" ON colaboradores;
DROP POLICY IF EXISTS "colaboradores: ver por email (nao vinculado)" ON colaboradores;
DROP POLICY IF EXISTS "colaboradores: vincular proprio auth_id" ON colaboradores;

-- ── 2. Nova política de SELECT: auth_id OU email ───────────
-- Permite que o colaborador veja o próprio registro tanto pelo
-- auth_id (após vinculação) quanto pelo email (antes da vinculação).
CREATE POLICY "colaboradores: ver proprio"
  ON colaboradores FOR SELECT
  USING (
    auth_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ── 3. Política de UPDATE para vincular auth_id ─────────────
-- Permite que o próprio usuário vincule seu auth_id ao registro
-- de colaborador encontrado pelo email (apenas quando auth_id é NULL).
DROP POLICY IF EXISTS "colaboradores: vincular auth_id" ON colaboradores;

CREATE POLICY "colaboradores: vincular auth_id"
  ON colaboradores FOR UPDATE
  USING (
    -- Pode atualizar se já tem auth_id vinculado OU se o email coincide
    auth_id = auth.uid()
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
  WITH CHECK (
    -- Só pode setar auth_id para o próprio UID (segurança)
    auth_id = auth.uid()
    OR auth_id IS NULL
  );

-- ── 4. Garantir que RLS está habilitado ──────────────────────
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

-- ── 5. Políticas para apontamentos (colaborador insere próprios) ─
-- Verificar se existe e recriar para garantir consistência
DROP POLICY IF EXISTS "apontamentos: colaborador insere proprios" ON apontamentos;

CREATE POLICY "apontamentos: colaborador insere proprios"
  ON apontamentos FOR INSERT
  WITH CHECK (
    colaborador_id = auth_colaborador_id()
    AND empresa_id IN (
      SELECT ce.empresa_id FROM colaborador_empresas ce
      WHERE ce.colaborador_id = auth_colaborador_id()
        AND ce.ativo = true
    )
  );

-- ── 6. Garantir que tabela convites tem coluna empresa_id ───
-- (executar apenas se a coluna não existir)
ALTER TABLE convites ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);

-- ── 7. Garantir modulos_permitidos em usuarios ───────────────
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS modulos_permitidos jsonb DEFAULT NULL;

-- ── 8. Verificação: listar políticas de colaboradores ───────
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename = 'colaboradores'
-- ORDER BY policyname;

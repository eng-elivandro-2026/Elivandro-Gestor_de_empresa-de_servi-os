-- ============================================================
-- 020_usuario_empresas_perfil_por_empresa.sql
-- Adiciona perfil_empresa, modulos_json e permissoes_json à
-- tabela usuario_empresas, permitindo que o mesmo usuário
-- tenha perfis diferentes em empresas diferentes.
--
-- Migration estritamente aditiva:
--   • Nenhuma coluna existente é alterada, renomeada ou removida.
--   • usuarios.perfil permanece inalterado (fallback / RLS).
--   • ativo já existe — não tocado.
--   • Backfill copia usuarios.perfil → perfil_empresa nos vínculos
--     existentes cujo perfil_empresa ainda seja NULL.
--
-- Depende de: 001_rls_policies.sql (RLS já habilitado)
-- ============================================================

-- ── Perfil por empresa ────────────────────────────────────────
ALTER TABLE usuario_empresas
  ADD COLUMN IF NOT EXISTS perfil_empresa TEXT,
  ADD COLUMN IF NOT EXISTS modulos_json    JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS permissoes_json JSONB DEFAULT '{}';

-- Garantir default preenchido para linhas existentes
UPDATE usuario_empresas SET modulos_json    = '{}' WHERE modulos_json    IS NULL;
UPDATE usuario_empresas SET permissoes_json = '{}' WHERE permissoes_json IS NULL;

-- ── Backfill: perfil_empresa ← usuarios.perfil ────────────────
-- Apenas para vínculos ainda sem perfil_empresa definido.
-- Não sobrescreve valores já preenchidos.
UPDATE usuario_empresas ue
SET perfil_empresa = u.perfil
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND ue.perfil_empresa IS NULL;

-- ── Comentários para documentação inline ──────────────────────
COMMENT ON COLUMN usuario_empresas.perfil_empresa IS
  'Perfil do usuário nesta empresa específica. Pode diferir de usuarios.perfil (global). '
  'Valores aceitos: dono, admin, gestor, colaborador, prestador. '
  'Fase futura adicionará: comercial, financeiro, rh, operacional, leitura quando RLS for atualizada. '
  'Fallback em código: se NULL, usar usuarios.perfil.';

COMMENT ON COLUMN usuario_empresas.modulos_json IS
  'Módulos habilitados para este usuário nesta empresa (uso futuro — reservado).';

COMMENT ON COLUMN usuario_empresas.permissoes_json IS
  'Permissões granulares por módulo/ação (uso futuro — reservado).';

-- ── RLS: sem alterações nesta migration ──────────────────────
-- auth_perfil() continua usando usuarios.perfil para enforcement no banco.
-- O frontend passará a usar perfil_empresa para lógica de UI.
-- A unificação completa (RLS por empresa) é planejada para fase futura.
-- Impacto: um usuário com perfil_empresa=gestor mas usuarios.perfil=colaborador
-- terá a UI de gestor, mas o RLS do banco aplicará restrições de colaborador.
-- Recomendação: manter consistência entre perfil_empresa e usuarios.perfil
-- até que a RLS per-empresa seja implementada.

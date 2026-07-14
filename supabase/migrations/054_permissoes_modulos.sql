-- ============================================================
-- 054_permissoes_modulos.sql
-- Permissões individuais por usuário/empresa (Etapa 1 — infra).
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor).
--
-- Adiciona a coluna permissoes_modulos à tabela usuario_empresas.
-- Formato: {"modulo": {"acao": true|false}}
--   • true/false explícito = AUTORITATIVO (concede OU revoga,
--     independente do perfil).
--   • Módulo/ação ausente, ou coluna NULL = fallback para a
--     matriz por perfil (PERMISSOES_PADRAO / config_json).
--
-- Por que uma coluna nova e não permissoes_json (migration 020)?
--   O editor de usuários grava permissoes_json INTEIRA com {obs}
--   (index.html, _salvarEdicaoUsuario), o que apagaria permissões
--   semeadas lá. permissoes_modulos fica isolada desse fluxo.
--
-- DEFAULT NULL de propósito:
--   NULL       = "sem configuração individual" → usa perfil.
--   '{}'::jsonb = "configurado, nada definido" → também cai no
--                 fallback por ação, mas NULL é o estado canônico.
--
-- Migration estritamente aditiva:
--   • Nenhuma coluna existente é alterada, renomeada ou removida.
--   • Nenhuma política RLS alterada — as políticas existentes de
--     usuario_empresas (001) já cobrem a coluna: usuário lê o
--     próprio vínculo; apenas dono/admin escrevem.
--   • Nenhuma lógica de acesso muda: nesta etapa o frontend apenas
--     CARREGA a coluna (multi-empresa.js) e expõe o leitor
--     getPermissoesUsuario() (permissoes.js), sem consumo em
--     menus/botões/módulos.
--
-- Depende de: 001_rls_policies.sql, 020_usuario_empresas_perfil_por_empresa.sql
-- ============================================================

ALTER TABLE usuario_empresas
  ADD COLUMN IF NOT EXISTS permissoes_modulos JSONB DEFAULT NULL;

COMMENT ON COLUMN usuario_empresas.permissoes_modulos IS
  'Permissões individuais por módulo/ação: {"modulo":{"acao":bool}}. '
  'true/false explícito é autoritativo (concede ou revoga); ausente ou '
  'NULL = fallback para a matriz por perfil. Separada de permissoes_json '
  'porque o editor de usuários sobrescreve permissoes_json inteira (obs).';

-- ── Verificação ───────────────────────────────────────────────
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'usuario_empresas'
--   AND column_name = 'permissoes_modulos';

-- ============================================================
-- seed_permissoes_modulos.sql
-- Popula usuario_empresas.permissoes_modulos por usuário.
-- Executar MANUALMENTE no SQL Editor do Supabase, APÓS a
-- migration 054_permissoes_modulos.sql.
--
-- ⚠️ ATENÇÃO — PREENCHER ANTES DE EXECUTAR:
--   Os blocos <<<PERMISSOES_...>>> abaixo são SLOTS: o JSON real
--   de cada usuário não foi fornecido no chat (veio como
--   placeholder). Substitua cada slot pelo JSON no formato:
--     {"modulo": {"acao": true|false}}
--   Módulos/ações válidos (mesmas chaves de PERMISSOES_PADRAO em
--   js/core/permissoes.js):
--     comercial:    ver, criar_proposta, aprovar_proposta, editar_margem
--     operacional:  ver, editar
--     financeiro:   ver, criar_cp_cr, editar_cp_cr, cancelar_cp_cr,
--                   importar_nf, cofre
--     historico:    ver, editar
--     gestao:       ver, editar
--     gestao-a-vista:           ver, editar, editar_pdca
--     reuniao-radar:            ver, editar
--     dashboard-estrategico:    ver
--     dashboard-minha-empresa:  ver, editar
--     planejamento-estrategico: ver, editar
--     rh:           ver, editar
--     cofre:        acesso
--     configuracoes: empresa, usuarios, modulos
--
-- Semântica: true/false explícito é AUTORITATIVO (revoga inclusive
-- o que o perfil concederia). Módulo/ação ausente = fallback perfil.
-- Perfis dono e o superadmin NUNCA são restringidos (bypass no JS).
--
-- Identificação: os usuario_id foram fornecidos como PREFIXOS de
-- UUID (ex.: 8a96ef3a). O match usa LIKE 'prefixo%'. Cada UPDATE
-- deve afetar os vínculos de EXATAMENTE 1 usuário — rode antes a
-- CONFERÊNCIA DE PREFIXOS abaixo e confirme 1 linha por prefixo.
-- ============================================================

-- ── CONFERÊNCIA DE PREFIXOS (rodar primeiro) ──────────────────
-- Cada prefixo deve retornar exatamente 1 usuário.
SELECT 'PREFIXO' AS chk, u.id, u.nome, u.email
FROM usuarios u
WHERE u.id::text LIKE '8a96ef3a%'
   OR u.id::text LIKE 'aa547e5f%';
-- (adicione aqui os demais prefixos da sua lista)


-- ── ESTADO ANTES ──────────────────────────────────────────────
SELECT u.nome, u.email, e.nome AS empresa, ue.perfil_empresa,
       ue.permissoes_modulos IS NOT NULL AS ja_configurado
FROM usuario_empresas ue
JOIN usuarios u ON u.id = ue.usuario_id
JOIN empresas e ON e.id = ue.empresa_id
WHERE ue.ativo = true
ORDER BY u.nome, e.nome;


BEGIN;

-- ── 8a96ef3a — Elivandro ──────────────────────────────────────
UPDATE usuario_empresas ue
SET permissoes_modulos = '<<<PERMISSOES_ELIVANDRO_JSON>>>'::jsonb
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND u.id::text LIKE '8a96ef3a%'
  AND ue.ativo = true;

-- ── aa547e5f — (nome do usuário) ──────────────────────────────
UPDATE usuario_empresas ue
SET permissoes_modulos = '<<<PERMISSOES_AA547E5F_JSON>>>'::jsonb
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND u.id::text LIKE 'aa547e5f%'
  AND ue.ativo = true;

-- ── (duplicar o bloco acima para cada usuário restante) ───────
-- Para permissões DIFERENTES por empresa do mesmo usuário,
-- acrescente ao WHERE:  AND ue.empresa_id = '<empresa_id>'

COMMIT;


-- ── VERIFICAÇÃO PÓS-SEED ──────────────────────────────────────
SELECT u.nome, u.email, e.nome AS empresa, ue.perfil_empresa,
       ue.permissoes_modulos IS NOT NULL AS configurado,
       ue.permissoes_modulos
FROM usuario_empresas ue
JOIN usuarios u ON u.id = ue.usuario_id
JOIN empresas e ON e.id = ue.empresa_id
WHERE ue.ativo = true
ORDER BY u.nome, e.nome;

-- ── ROLLBACK (se necessário) ──────────────────────────────────
-- UPDATE usuario_empresas SET permissoes_modulos = NULL;
-- (NULL restaura 100% o comportamento por perfil — a Etapa 1 não
--  tem nenhum consumidor da coluna, então o rollback é inócuo.)

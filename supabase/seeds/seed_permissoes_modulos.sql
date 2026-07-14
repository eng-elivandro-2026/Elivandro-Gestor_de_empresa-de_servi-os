-- ============================================================
-- seed_permissoes_modulos.sql
-- Popula usuario_empresas.permissoes_modulos por usuário.
-- Executar MANUALMENTE no SQL Editor do Supabase, APÓS a
-- migration 054_permissoes_modulos.sql.
--
-- JSON real fornecido pelo cliente (6 usuários, 19 módulos,
-- ações uniformes: ver, editar, excluir, aprovar).
--
-- ⚠️ NOTA DE VOCABULÁRIO (relevante para a Etapa 2):
--   As chaves de módulo deste JSON (propostas, pipeline, obras,
--   minha_empresa, analise_ia, ...) e as ações (excluir, aprovar)
--   NÃO coincidem 1:1 com as chaves atuais de PERMISSOES_PADRAO /
--   IDs do Router (ex.: dashboard-minha-empresa, historico,
--   criar_proposta). Na Etapa 1 isso é inofensivo — nada consome a
--   coluna. A Etapa 2 (pontos de uso) precisará de uma tabela de
--   correspondência módulo-JSON → módulo-Router, ou da adoção
--   deste vocabulário como o novo canônico.
--
-- Semântica (getPermissoesUsuario, js/core/permissoes.js):
--   true/false explícito é AUTORITATIVO (revoga inclusive o que o
--   perfil concederia). Módulo/ação ausente = fallback perfil.
--   Perfil dono e o superadmin NUNCA são restringidos (bypass).
--
-- Identificação: usuario_id fornecidos como PREFIXOS de UUID.
-- O match usa LIKE 'prefixo%'. Rode a CONFERÊNCIA primeiro e
-- confirme EXATAMENTE 1 usuário por prefixo antes do BEGIN.
-- ============================================================

-- ── CONFERÊNCIA DE PREFIXOS (rodar primeiro — 6 linhas, 1 por prefixo) ──
SELECT u.id, u.nome, u.email,
       CASE
         WHEN u.id::text LIKE '8a96ef3a%' THEN '8a96ef3a (Elivandro)'
         WHEN u.id::text LIKE 'aa547e5f%' THEN 'aa547e5f (Adriano)'
         WHEN u.id::text LIKE '4268cef6%' THEN '4268cef6 (Raphael)'
         WHEN u.id::text LIKE '7ad1228d%' THEN '7ad1228d (Claudineiz)'
         WHEN u.id::text LIKE '2e3fbeb7%' THEN '2e3fbeb7 (Ernesto)'
         WHEN u.id::text LIKE '517dd1a0%' THEN '517dd1a0 (Elivandro Tecfusion)'
       END AS prefixo_esperado
FROM usuarios u
WHERE u.id::text LIKE '8a96ef3a%'
   OR u.id::text LIKE 'aa547e5f%'
   OR u.id::text LIKE '4268cef6%'
   OR u.id::text LIKE '7ad1228d%'
   OR u.id::text LIKE '2e3fbeb7%'
   OR u.id::text LIKE '517dd1a0%'
ORDER BY prefixo_esperado;


-- ── ESTADO ANTES ──────────────────────────────────────────────
SELECT u.nome, u.email, e.nome AS empresa, ue.perfil_empresa,
       ue.permissoes_modulos IS NOT NULL AS ja_configurado
FROM usuario_empresas ue
JOIN usuarios u ON u.id = ue.usuario_id
JOIN empresas e ON e.id = ue.empresa_id
WHERE ue.ativo = true
ORDER BY u.nome, e.nome;


BEGIN;

-- ── 8a96ef3a — Elivandro (acesso total) ───────────────────────
UPDATE usuario_empresas ue
SET permissoes_modulos = '{"comercial":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"propostas":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"pipeline":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"banco_escopos":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"operacional":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"obras":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"financeiro":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"visao_executiva":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"gestao_ceo":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"metas":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"quadro_avisos":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"rh":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"ranking_clientes":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"planejamento":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"minha_empresa":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"mpe":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"relacionamento":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"analise_ia":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"backup":{"ver":true,"editar":true,"excluir":true,"aprovar":true}}'::jsonb
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND u.id::text LIKE '8a96ef3a%'
  AND ue.ativo = true;

-- ── aa547e5f — Adriano (gestor operacional/financeiro; sem visão executiva, gestão CEO, planejamento e backup) ──
UPDATE usuario_empresas ue
SET permissoes_modulos = '{"comercial":{"ver":true,"editar":true,"excluir":false,"aprovar":false},"propostas":{"ver":true,"editar":true,"excluir":false,"aprovar":false},"pipeline":{"ver":true,"editar":true,"excluir":false,"aprovar":false},"banco_escopos":{"ver":true,"editar":true,"excluir":false,"aprovar":false},"operacional":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"obras":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"financeiro":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"visao_executiva":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"gestao_ceo":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"metas":{"ver":true,"editar":true,"excluir":false,"aprovar":true},"quadro_avisos":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"rh":{"ver":true,"editar":true,"excluir":false,"aprovar":true},"ranking_clientes":{"ver":true,"editar":true,"excluir":false,"aprovar":true},"planejamento":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"minha_empresa":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"mpe":{"ver":true,"editar":true,"excluir":false,"aprovar":true},"relacionamento":{"ver":true,"editar":true,"excluir":true,"aprovar":true},"analise_ia":{"ver":true,"editar":true,"excluir":false,"aprovar":false},"backup":{"ver":false,"editar":false,"excluir":false,"aprovar":false}}'::jsonb
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND u.id::text LIKE 'aa547e5f%'
  AND ue.ativo = true;

-- ── 4268cef6 — Raphael (leitura comercial/operacional/gestão; sem financeiro) ──
UPDATE usuario_empresas ue
SET permissoes_modulos = '{"comercial":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"propostas":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"pipeline":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"banco_escopos":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"operacional":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"obras":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"financeiro":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"visao_executiva":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"gestao_ceo":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"metas":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"quadro_avisos":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"rh":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"ranking_clientes":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"planejamento":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"minha_empresa":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"mpe":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"relacionamento":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"analise_ia":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"backup":{"ver":false,"editar":false,"excluir":false,"aprovar":false}}'::jsonb
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND u.id::text LIKE '4268cef6%'
  AND ue.ativo = true;

-- ── 7ad1228d — Claudineiz (somente leitura de operacional/obras) ──
UPDATE usuario_empresas ue
SET permissoes_modulos = '{"comercial":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"propostas":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"pipeline":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"banco_escopos":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"operacional":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"obras":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"financeiro":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"visao_executiva":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"gestao_ceo":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"metas":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"quadro_avisos":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"rh":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"ranking_clientes":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"planejamento":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"minha_empresa":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"mpe":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"relacionamento":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"analise_ia":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"backup":{"ver":false,"editar":false,"excluir":false,"aprovar":false}}'::jsonb
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND u.id::text LIKE '7ad1228d%'
  AND ue.ativo = true;

-- ── 2e3fbeb7 — Ernesto (somente leitura de operacional/obras) ──
UPDATE usuario_empresas ue
SET permissoes_modulos = '{"comercial":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"propostas":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"pipeline":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"banco_escopos":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"operacional":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"obras":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"financeiro":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"visao_executiva":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"gestao_ceo":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"metas":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"quadro_avisos":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"rh":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"ranking_clientes":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"planejamento":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"minha_empresa":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"mpe":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"relacionamento":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"analise_ia":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"backup":{"ver":false,"editar":false,"excluir":false,"aprovar":false}}'::jsonb
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND u.id::text LIKE '2e3fbeb7%'
  AND ue.ativo = true;

-- ── 517dd1a0 — Elivandro Tecfusion (somente leitura de operacional/obras) ──
UPDATE usuario_empresas ue
SET permissoes_modulos = '{"comercial":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"propostas":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"pipeline":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"banco_escopos":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"operacional":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"obras":{"ver":true,"editar":false,"excluir":false,"aprovar":false},"financeiro":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"visao_executiva":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"gestao_ceo":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"metas":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"quadro_avisos":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"rh":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"ranking_clientes":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"planejamento":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"minha_empresa":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"mpe":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"relacionamento":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"analise_ia":{"ver":false,"editar":false,"excluir":false,"aprovar":false},"backup":{"ver":false,"editar":false,"excluir":false,"aprovar":false}}'::jsonb
FROM usuarios u
WHERE u.id = ue.usuario_id
  AND u.id::text LIKE '517dd1a0%'
  AND ue.ativo = true;

COMMIT;


-- ── VERIFICAÇÃO PÓS-SEED ──────────────────────────────────────
-- Esperado: configurado = true para todos os vínculos ativos dos
-- 6 usuários acima; modulos = 19 em cada.
SELECT u.nome, u.email, e.nome AS empresa, ue.perfil_empresa,
       ue.permissoes_modulos IS NOT NULL AS configurado,
       (SELECT count(*) FROM jsonb_object_keys(ue.permissoes_modulos)) AS modulos
FROM usuario_empresas ue
JOIN usuarios u ON u.id = ue.usuario_id
JOIN empresas e ON e.id = ue.empresa_id
WHERE ue.ativo = true
ORDER BY u.nome, e.nome;

-- ── ROLLBACK (se necessário) ──────────────────────────────────
-- UPDATE usuario_empresas SET permissoes_modulos = NULL;
-- (NULL restaura 100% o comportamento por perfil — a Etapa 1 não
--  tem nenhum consumidor da coluna, então o rollback é inócuo.)

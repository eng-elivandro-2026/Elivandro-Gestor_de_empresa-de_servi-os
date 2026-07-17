-- ============================================================
-- 060_valor_gerado_categorias.sql
-- Classificação automática de "Valor Gerado" na Gestão do Tempo.
--
-- O booleano registro_atividades.gerou_receita (S/N por atividade)
-- é substituído por uma classificação derivada da CATEGORIA:
-- campo novo gestao_tempo_categorias.valor_gerado. O mapeamento
-- fica no banco (não num mapa por nome no código) — renomear uma
-- categoria NÃO quebra a classificação, mesma garantia de robustez
-- da FK da migration 056. O campo não aparece na tela (invisível
-- ao usuário), mas é editável no banco.
--
-- Categoria nova criada pelo usuário nasce com valor_gerado NULL
-- → o dashboard classifica como 'Sem Valor' até alguém definir.
--
-- ⚠️ ESTE ARQUIVO TEM 2 PARTES:
--   PARTE A — rodar JÁ (aditiva, segura com a página atual no ar)
--   PARTE B — rodar SOMENTE APÓS o deploy da página nova
--             (páginas antigas em cache ainda inserem gerou_receita;
--              dropar antes do deploy causaria erro 400 nos inserts)
--
-- Depende de: 056_gestao_tempo_categorias.sql.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- PARTE A — coluna + seed (rodar já)
-- ════════════════════════════════════════════════════════════

ALTER TABLE gestao_tempo_categorias
  ADD COLUMN IF NOT EXISTS valor_gerado text;

-- CHECK idempotente (nomeado; recriado se rodar de novo)
ALTER TABLE gestao_tempo_categorias
  DROP CONSTRAINT IF EXISTS gt_categorias_valor_gerado_check;
ALTER TABLE gestao_tempo_categorias
  ADD CONSTRAINT gt_categorias_valor_gerado_check
  CHECK (valor_gerado IS NULL OR valor_gerado IN
    ('Receita', 'Operacional', 'Melhoria', 'Estratégico',
     'Desenvolvimento', 'Pessoal', 'Sem Valor'));

COMMENT ON COLUMN gestao_tempo_categorias.valor_gerado IS
  'Classificação de Valor Gerado herdada por toda atividade da categoria. NULL = Sem Valor no dashboard. Invisível na tela; editável no banco.';

-- Seed: mapeamento inicial das 8 categorias padrão, em TODAS as
-- empresas, por nome (case-insensitive) e só onde ainda é NULL —
-- idempotente e sem sobrescrever ajustes manuais feitos no banco.
UPDATE gestao_tempo_categorias g
SET valor_gerado = m.vg
FROM (VALUES
  ('comercial',      'Receita'),
  ('engenharia',     'Operacional'),
  ('operacional',    'Operacional'),
  ('gestão',         'Melhoria'),
  ('administrativo', 'Melhoria'),
  ('suporte',        'Operacional'),
  ('portal',         'Estratégico'),   -- ativo estratégico da empresa (equivalente ao "SOE")
  ('pessoal',        'Pessoal')
) AS m(nome, vg)
WHERE lower(g.nome) = m.nome
  AND g.valor_gerado IS NULL;

-- ── Verificação da Parte A (executar separadamente) ───────────
-- SELECT e.nome AS empresa, g.nome, g.valor_gerado
-- FROM gestao_tempo_categorias g JOIN empresas e ON e.id = g.empresa_id
-- ORDER BY e.nome, g.nome;
-- (as 8 padrão preenchidas; categorias criadas pelo usuário = NULL)

-- ════════════════════════════════════════════════════════════
-- PARTE B — remover gerou_receita
-- ⚠️ RODAR SOMENTE APÓS confirmar o deploy da página nova no ar.
-- Nada além da Gestão do Tempo lê esta coluna (conferido no repo).
-- ════════════════════════════════════════════════════════════

-- ALTER TABLE registro_atividades DROP COLUMN IF EXISTS gerou_receita;

-- ============================================================
-- ROLLBACK (somente referência — não executar automaticamente)
-- ============================================================
-- ALTER TABLE gestao_tempo_categorias DROP CONSTRAINT IF EXISTS gt_categorias_valor_gerado_check;
-- ALTER TABLE gestao_tempo_categorias DROP COLUMN IF EXISTS valor_gerado;
-- (Parte B: recriar a coluna exigiria repopular de um backup —
--  ALTER TABLE registro_atividades ADD COLUMN gerou_receita boolean NOT NULL DEFAULT false;)
-- ============================================================

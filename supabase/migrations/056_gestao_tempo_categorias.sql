-- ============================================================
-- 056_gestao_tempo_categorias.sql
-- Categorias configuráveis por empresa na Gestão do Tempo, com
-- migração de registro_atividades.categoria (TEXT fixa) para FK.
--
-- Por que FK e não TEXT com propagação por UPDATE:
--   a RLS de registro_atividades (055) só deixa cada usuário
--   atualizar os PRÓPRIOS registros — um rename via UPDATE em massa
--   só propagaria para os registros de quem renomeou. Com FK,
--   renomear = 1 UPDATE em gestao_tempo_categorias e TODOS os
--   registros refletem na hora.
--
-- Executar no SQL Editor do Supabase, na ordem (o arquivo já está
-- na ordem certa). Passo 3 tem uma VERIFICAÇÃO no meio — confira o
-- resultado antes de seguir.
--
-- Depende de: auth_empresa_ids(), auth_perfil() (001_rls_policies.sql),
--             055_registro_atividades.sql.
-- ============================================================

-- ── 1. Tabela de categorias por empresa ───────────────────────
CREATE TABLE IF NOT EXISTS gestao_tempo_categorias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  nome        text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,  -- soft-delete: false some das opções novas, registros antigos intactos
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gt_categorias_empresa_nome
  ON gestao_tempo_categorias (empresa_id, lower(nome));

COMMENT ON TABLE gestao_tempo_categorias IS 'Categorias da Gestão do Tempo, configuráveis por empresa. Soft-delete via ativo=false.';

ALTER TABLE gestao_tempo_categorias ENABLE ROW LEVEL SECURITY;

-- Leitura: todos os usuários da empresa (vocabulário compartilhado)
DROP POLICY IF EXISTS "categorias: ver da empresa" ON gestao_tempo_categorias;
CREATE POLICY "categorias: ver da empresa" ON gestao_tempo_categorias
  FOR SELECT USING (empresa_id IN (SELECT auth_empresa_ids()));

-- Escrita: só dono/admin/gestor (decisão aprovada)
DROP POLICY IF EXISTS "categorias: gestor+ insere" ON gestao_tempo_categorias;
CREATE POLICY "categorias: gestor+ insere" ON gestao_tempo_categorias
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'admin', 'gestor')
  );

DROP POLICY IF EXISTS "categorias: gestor+ atualiza" ON gestao_tempo_categorias;
CREATE POLICY "categorias: gestor+ atualiza" ON gestao_tempo_categorias
  FOR UPDATE USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'admin', 'gestor')
  );
-- Sem policy de DELETE: exclusão é sempre soft (ativo=false).

-- ── 2. Seed: as 8 categorias atuais para cada empresa existente ──
-- Idempotente (não duplica se rodar de novo). Empresa criada no
-- futuro: a tela Categorias oferece "Criar categorias padrão".
INSERT INTO gestao_tempo_categorias (empresa_id, nome)
SELECT e.id, c.nome
FROM empresas e
CROSS JOIN (VALUES
  ('Comercial'), ('Engenharia'), ('Operacional'), ('Gestão'),
  ('Portal'), ('Suporte'), ('Administrativo'), ('Pessoal')
) AS c(nome)
WHERE NOT EXISTS (
  SELECT 1 FROM gestao_tempo_categorias g
  WHERE g.empresa_id = e.id AND lower(g.nome) = lower(c.nome)
);

-- ── 3. Migração de dados: categoria TEXT → categoria_id FK ────
ALTER TABLE registro_atividades
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES gestao_tempo_categorias(id);

UPDATE registro_atividades ra
SET categoria_id = c.id
FROM gestao_tempo_categorias c
WHERE c.empresa_id = ra.empresa_id
  AND lower(c.nome) = lower(ra.categoria)
  AND ra.categoria_id IS NULL;

-- ★ VERIFICAÇÃO (deve retornar 0 — todos os textos são das 8 fixas
--   do CHECK antigo, então o mapeamento é garantido):
-- SELECT COUNT(*) FROM registro_atividades WHERE categoria_id IS NULL;

-- categoria_id fica NULLABLE de propósito: clientes com a página
-- antiga em cache ainda inserem só o texto; o código novo lê
-- map[categoria_id] com fallback para o texto.

CREATE INDEX IF NOT EXISTS idx_registro_atividades_categoria
  ON registro_atividades(categoria_id);

-- ── 4. Destravar a coluna TEXT antiga ─────────────────────────
-- Solta o CHECK (bloquearia categorias novas) e o NOT NULL (o código
-- novo grava nome + id; o nome vira denormalização de conveniência).
-- A coluna fica como fallback de leitura e segurança de rollback;
-- um cleanup futuro pode dropá-la.
ALTER TABLE registro_atividades DROP CONSTRAINT IF EXISTS registro_atividades_categoria_check;
ALTER TABLE registro_atividades ALTER COLUMN categoria DROP NOT NULL;

COMMENT ON COLUMN registro_atividades.categoria IS 'LEGADO: nome da categoria no momento da gravação (denormalizado). Fonte de verdade é categoria_id; leitura usa map[categoria_id] com fallback neste texto.';
COMMENT ON COLUMN registro_atividades.categoria_id IS 'FK para gestao_tempo_categorias — renomear a categoria propaga automaticamente para todos os registros.';

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'gestao_tempo_categorias';
-- SELECT e.nome, COUNT(c.id) AS categorias FROM empresas e
--   LEFT JOIN gestao_tempo_categorias c ON c.empresa_id = e.id GROUP BY e.nome;
-- SELECT COUNT(*) AS sem_fk FROM registro_atividades WHERE categoria_id IS NULL;

-- ============================================================
-- ROLLBACK (somente referência — não executar automaticamente)
-- ============================================================
-- ALTER TABLE registro_atividades DROP COLUMN IF EXISTS categoria_id;
-- DROP TABLE IF EXISTS gestao_tempo_categorias;
-- (o CHECK e o NOT NULL antigos não são recriados automaticamente)
-- ============================================================

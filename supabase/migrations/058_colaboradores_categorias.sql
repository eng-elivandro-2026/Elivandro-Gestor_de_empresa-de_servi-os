-- ============================================================
-- 058_colaboradores_categorias.sql
-- Fundação do módulo Recursos & Produtividade (Parte B):
-- categoria/função do colaborador definida no CADASTRO (uma vez),
-- não a cada apontamento.
--
-- Mesmo padrão de 056_gestao_tempo_categorias:
--   - tabela por empresa, unique em lower(nome)
--   - RLS: leitura para todos da empresa; escrita só dono/admin/gestor
--   - soft-delete via ativo=false (SEM policy de DELETE)
--   - FK (renomear a categoria propaga para todos os colaboradores)
--
-- categoria_id vai em colaborador_empresas (NÃO em colaboradores):
-- colaboradores atuam em várias empresas com atributos por empresa
-- (tipo, valor_hora já funcionam assim), e a FK aponta para uma
-- tabela de categorias POR EMPRESA — um campo global não teria como
-- referenciar categoria de uma empresa específica.
--
-- Executar no SQL Editor do Supabase, na ordem do arquivo.
-- Depende de: auth_empresa_ids(), auth_perfil() (001_rls_policies.sql).
-- ============================================================

-- ── 1. Tabela de categorias por empresa ───────────────────────
CREATE TABLE IF NOT EXISTS colaboradores_categorias (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id  uuid NOT NULL,
  nome        text NOT NULL,
  ativo       boolean NOT NULL DEFAULT true,  -- soft-delete: false some do dropdown; colaboradores já classificados seguem exibindo o nome
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_colab_categorias_empresa_nome
  ON colaboradores_categorias (empresa_id, lower(nome));

COMMENT ON TABLE colaboradores_categorias IS 'Categorias de colaborador (Engenharia, Montagem…), configuráveis por empresa. Soft-delete via ativo=false.';

ALTER TABLE colaboradores_categorias ENABLE ROW LEVEL SECURITY;

-- Leitura: todos os usuários da empresa (vocabulário compartilhado)
DROP POLICY IF EXISTS "colab_categorias: ver da empresa" ON colaboradores_categorias;
CREATE POLICY "colab_categorias: ver da empresa" ON colaboradores_categorias
  FOR SELECT USING (empresa_id IN (SELECT auth_empresa_ids()));

-- Escrita: só dono/admin/gestor
DROP POLICY IF EXISTS "colab_categorias: gestor+ insere" ON colaboradores_categorias;
CREATE POLICY "colab_categorias: gestor+ insere" ON colaboradores_categorias
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'admin', 'gestor')
  );

DROP POLICY IF EXISTS "colab_categorias: gestor+ atualiza" ON colaboradores_categorias;
CREATE POLICY "colab_categorias: gestor+ atualiza" ON colaboradores_categorias
  FOR UPDATE USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'admin', 'gestor')
  );
-- Sem policy de DELETE: exclusão é sempre soft (ativo=false).

-- ── 2. Campo no vínculo colaborador × empresa ─────────────────
ALTER TABLE colaborador_empresas
  ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES colaboradores_categorias(id);

CREATE INDEX IF NOT EXISTS idx_colaborador_empresas_categoria
  ON colaborador_empresas (categoria_id);

COMMENT ON COLUMN colaborador_empresas.categoria_id IS 'FK para colaboradores_categorias — categoria do colaborador NESTA empresa. Nullable (sem categoria = "—").';

-- A escrita já é protegida pela RLS existente de colaborador_empresas
-- (gestor+ atualiza — migration 006). Nenhuma policy nova necessária.

-- ── 3. Seed inicial (idempotente, por empresa existente) ──────
INSERT INTO colaboradores_categorias (empresa_id, nome)
SELECT e.id, c.nome
FROM empresas e
CROSS JOIN (VALUES
  ('Comercial'), ('Engenharia'), ('Montagem'),
  ('Operacional'), ('Administrativo'), ('Viagem')
) AS c(nome)
WHERE NOT EXISTS (
  SELECT 1 FROM colaboradores_categorias g
  WHERE g.empresa_id = e.id AND lower(g.nome) = lower(c.nome)
);

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT e.nome, COUNT(c.id) AS categorias
-- FROM empresas e
-- LEFT JOIN colaboradores_categorias c ON c.empresa_id = e.id
-- GROUP BY e.nome;
--
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'colaborador_empresas' AND column_name = 'categoria_id';

-- ============================================================
-- ROLLBACK (somente referência — não executar automaticamente)
-- ============================================================
-- ALTER TABLE colaborador_empresas DROP COLUMN IF EXISTS categoria_id;
-- DROP TABLE IF EXISTS colaboradores_categorias;
-- ============================================================

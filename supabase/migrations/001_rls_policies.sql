-- ============================================================
-- 001_rls_policies.sql
-- Row Level Security para todas as tabelas principais.
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor).
--
-- Premissas:
--   • auth.uid() = usuarios.auth_id
--   • Empresa é resolvida via usuario_empresas (empresa_ativa no JWT claims
--     não existe ainda, então usamos subqueries nas políticas)
--   • colaboradores usam colaborador_empresas
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO AUXILIAR: empresas do usuário logado
-- Retorna os IDs de empresa onde o usuário está ativo.
-- Usada em todas as políticas para evitar repetição.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_empresa_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT ue.empresa_id
  FROM usuario_empresas ue
  JOIN usuarios u ON u.id = ue.usuario_id
  WHERE u.auth_id = auth.uid()
    AND ue.ativo = true;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO AUXILIAR: ID interno do usuário logado
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_usuario_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO AUXILIAR: ID interno do colaborador logado
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_colaborador_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT id FROM colaboradores WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ────────────────────────────────────────────────────────────
-- FUNÇÃO AUXILIAR: perfil do usuário logado
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_perfil()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT perfil FROM usuarios WHERE auth_id = auth.uid() LIMIT 1;
$$;


-- ============================================================
-- TABELA: usuarios
-- ============================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas o próprio registro
CREATE POLICY "usuarios: ver proprio registro"
  ON usuarios FOR SELECT
  USING (auth_id = auth.uid());

-- Dono e admin veem todos os usuários das suas empresas
CREATE POLICY "usuarios: dono/admin veem todos"
  ON usuarios FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'admin')
    AND id IN (
      SELECT ue.usuario_id FROM usuario_empresas ue
      WHERE ue.empresa_id IN (SELECT auth_empresa_ids())
        AND ue.ativo = true
    )
  );

-- Apenas dono/admin podem criar ou atualizar usuários
CREATE POLICY "usuarios: dono/admin escrevem"
  ON usuarios FOR INSERT
  WITH CHECK (auth_perfil() IN ('dono', 'admin'));

CREATE POLICY "usuarios: dono/admin atualizam"
  ON usuarios FOR UPDATE
  USING (auth_perfil() IN ('dono', 'admin'));


-- ============================================================
-- TABELA: empresas
-- ============================================================
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas as empresas às quais está vinculado
CREATE POLICY "empresas: ver proprias"
  ON empresas FOR SELECT
  USING (id IN (SELECT auth_empresa_ids()));

-- Apenas dono pode modificar dados da empresa
CREATE POLICY "empresas: dono atualiza"
  ON empresas FOR UPDATE
  USING (
    id IN (SELECT auth_empresa_ids())
    AND auth_perfil() = 'dono'
  );


-- ============================================================
-- TABELA: usuario_empresas
-- ============================================================
ALTER TABLE usuario_empresas ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seus próprios vínculos
CREATE POLICY "usuario_empresas: ver proprios"
  ON usuario_empresas FOR SELECT
  USING (
    usuario_id = auth_usuario_id()
    OR (
      auth_perfil() IN ('dono', 'admin')
      AND empresa_id IN (SELECT auth_empresa_ids())
    )
  );

-- Apenas dono/admin gerenciam vínculos
CREATE POLICY "usuario_empresas: dono/admin escrevem"
  ON usuario_empresas FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

CREATE POLICY "usuario_empresas: dono/admin atualizam"
  ON usuario_empresas FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );


-- ============================================================
-- TABELA: propostas
-- ============================================================
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas propostas da própria empresa
CREATE POLICY "propostas: ver da empresa"
  ON propostas FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

-- Inserção: deve ser para empresa autorizada
CREATE POLICY "propostas: inserir na empresa"
  ON propostas FOR INSERT
  WITH CHECK (empresa_id IN (SELECT auth_empresa_ids()));

-- Atualização: empresa autorizada + não-colaborador (colaborador não edita propostas)
CREATE POLICY "propostas: atualizar na empresa"
  ON propostas FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- Exclusão: somente dono/gestor
CREATE POLICY "propostas: deletar gestor+"
  ON propostas FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );


-- ============================================================
-- TABELA: configuracoes
-- ============================================================
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Leitura: todos autenticados (config é global)
CREATE POLICY "configuracoes: leitura autenticada"
  ON configuracoes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Escrita: somente dono/gestor/admin
CREATE POLICY "configuracoes: escrita gestor+"
  ON configuracoes FOR INSERT
  WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));

CREATE POLICY "configuracoes: atualizar gestor+"
  ON configuracoes FOR UPDATE
  USING (auth_perfil() IN ('dono', 'gestor', 'admin'));


-- ============================================================
-- TABELA: colaboradores
-- ============================================================
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;

-- Colaborador vê apenas o próprio perfil
CREATE POLICY "colaboradores: ver proprio"
  ON colaboradores FOR SELECT
  USING (auth_id = auth.uid());

-- Gestor/dono veem colaboradores da sua empresa
CREATE POLICY "colaboradores: gestor+ ve todos da empresa"
  ON colaboradores FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

-- Gestores criam/atualizam colaboradores
CREATE POLICY "colaboradores: gestor+ escreve"
  ON colaboradores FOR INSERT
  WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));

CREATE POLICY "colaboradores: gestor+ atualiza"
  ON colaboradores FOR UPDATE
  USING (auth_perfil() IN ('dono', 'gestor', 'admin'));


-- ============================================================
-- TABELA: colaborador_empresas
-- ============================================================
ALTER TABLE colaborador_empresas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaborador_empresas: ver proprios vinculos"
  ON colaborador_empresas FOR SELECT
  USING (
    colaborador_id = auth_colaborador_id()
    OR (
      auth_perfil() IN ('dono', 'gestor', 'admin')
      AND empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "colaborador_empresas: gestor+ gerencia"
  ON colaborador_empresas FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );


-- ============================================================
-- TABELA: apontamentos (horas trabalhadas)
-- ============================================================
ALTER TABLE apontamentos ENABLE ROW LEVEL SECURITY;

-- Colaborador vê apenas os próprios apontamentos
CREATE POLICY "apontamentos: colaborador ve proprios"
  ON apontamentos FOR SELECT
  USING (colaborador_id = auth_colaborador_id());

-- Gestor/dono veem todos da empresa
CREATE POLICY "apontamentos: gestor+ ve empresa"
  ON apontamentos FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Colaborador insere apenas para si mesmo, na própria empresa
CREATE POLICY "apontamentos: colaborador insere proprios"
  ON apontamentos FOR INSERT
  WITH CHECK (
    colaborador_id = auth_colaborador_id()
    AND empresa_id IN (
      SELECT ce.empresa_id FROM colaborador_empresas ce
      WHERE ce.colaborador_id = auth_colaborador_id()
    )
  );

-- Gestor/dono podem inserir por qualquer colaborador
CREATE POLICY "apontamentos: gestor+ insere"
  ON apontamentos FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Colaborador edita apenas apontamentos pendentes (não aprovados)
CREATE POLICY "apontamentos: colaborador edita pendente"
  ON apontamentos FOR UPDATE
  USING (
    colaborador_id = auth_colaborador_id()
    AND status = 'pendente'
  );

-- Gestor/dono aprovam, rejeitam, editam qualquer apontamento da empresa
CREATE POLICY "apontamentos: gestor+ atualiza"
  ON apontamentos FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Apenas gestor+ pode deletar
CREATE POLICY "apontamentos: gestor+ deleta"
  ON apontamentos FOR DELETE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );


-- ============================================================
-- TABELA: apontamentos_historico (auditoria)
-- ============================================================
ALTER TABLE apontamentos_historico ENABLE ROW LEVEL SECURITY;

-- Colaborador vê histórico dos próprios apontamentos
CREATE POLICY "apontamentos_historico: colaborador ve proprios"
  ON apontamentos_historico FOR SELECT
  USING (
    apontamento_id IN (
      SELECT id FROM apontamentos WHERE colaborador_id = auth_colaborador_id()
    )
  );

-- Gestor/dono veem todo histórico da empresa
CREATE POLICY "apontamentos_historico: gestor+ ve empresa"
  ON apontamentos_historico FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND apontamento_id IN (
      SELECT id FROM apontamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );

-- Apenas usuários autenticados da empresa inserem histórico
CREATE POLICY "apontamentos_historico: inserir autenticado"
  ON apontamentos_historico FOR INSERT
  WITH CHECK (
    apontamento_id IN (
      SELECT id FROM apontamentos
      WHERE empresa_id IN (SELECT auth_empresa_ids())
    )
  );


-- ============================================================
-- TABELA: boletins (notas fiscais / faturas agrupadas)
-- ============================================================
ALTER TABLE boletins ENABLE ROW LEVEL SECURITY;

-- Colaborador vê apenas os próprios boletins
CREATE POLICY "boletins: colaborador ve proprios"
  ON boletins FOR SELECT
  USING (colaborador_id = auth_colaborador_id());

-- Gestor/dono veem todos da empresa
CREATE POLICY "boletins: gestor+ ve empresa"
  ON boletins FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

-- Apenas gestor+ cria e atualiza boletins
CREATE POLICY "boletins: gestor+ insere"
  ON boletins FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

CREATE POLICY "boletins: gestor+ atualiza"
  ON boletins FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );


-- ============================================================
-- TABELAS RH: rh_documentos, rh_saude, rh_epis, rh_despesas
-- ============================================================

-- rh_documentos
ALTER TABLE rh_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_documentos: colaborador ve proprios"
  ON rh_documentos FOR SELECT
  USING (colaborador_id = auth_colaborador_id());

CREATE POLICY "rh_documentos: gestor+ ve empresa"
  ON rh_documentos FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "rh_documentos: gestor+ escreve"
  ON rh_documentos FOR INSERT
  WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));

CREATE POLICY "rh_documentos: gestor+ atualiza"
  ON rh_documentos FOR UPDATE
  USING (auth_perfil() IN ('dono', 'gestor', 'admin'));

-- rh_saude
ALTER TABLE rh_saude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_saude: colaborador ve proprios"
  ON rh_saude FOR SELECT
  USING (colaborador_id = auth_colaborador_id());

CREATE POLICY "rh_saude: gestor+ ve empresa"
  ON rh_saude FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "rh_saude: gestor+ escreve"
  ON rh_saude FOR INSERT
  WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));

CREATE POLICY "rh_saude: gestor+ atualiza"
  ON rh_saude FOR UPDATE
  USING (auth_perfil() IN ('dono', 'gestor', 'admin'));

-- rh_epis
ALTER TABLE rh_epis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_epis: colaborador ve proprios"
  ON rh_epis FOR SELECT
  USING (colaborador_id = auth_colaborador_id());

CREATE POLICY "rh_epis: gestor+ ve empresa"
  ON rh_epis FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND colaborador_id IN (
      SELECT ce.colaborador_id FROM colaborador_empresas ce
      WHERE ce.empresa_id IN (SELECT auth_empresa_ids())
    )
  );

CREATE POLICY "rh_epis: gestor+ escreve"
  ON rh_epis FOR INSERT
  WITH CHECK (auth_perfil() IN ('dono', 'gestor', 'admin'));

CREATE POLICY "rh_epis: gestor+ atualiza"
  ON rh_epis FOR UPDATE
  USING (auth_perfil() IN ('dono', 'gestor', 'admin'));

-- rh_despesas (vinculada a empresa, não a colaborador)
ALTER TABLE rh_despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_despesas: gestor+ ve empresa"
  ON rh_despesas FOR SELECT
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

CREATE POLICY "rh_despesas: gestor+ escreve"
  ON rh_despesas FOR INSERT
  WITH CHECK (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );

CREATE POLICY "rh_despesas: gestor+ atualiza"
  ON rh_despesas FOR UPDATE
  USING (
    auth_perfil() IN ('dono', 'gestor', 'admin')
    AND empresa_id IN (SELECT auth_empresa_ids())
  );


-- ============================================================
-- VERIFICAÇÃO: listar políticas criadas
-- ============================================================
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

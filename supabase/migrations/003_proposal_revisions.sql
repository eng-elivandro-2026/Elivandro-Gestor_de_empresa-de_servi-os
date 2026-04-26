-- ============================================================
-- Migration 003 — Tabela de Revisões de Propostas
-- Cada proposta pode ter múltiplas revisões (A, B, C...).
-- Somente a revisão com status='ativa' é a versão corrente.
-- Revisões arquivadas são imutáveis (snapshots históricos).
-- ============================================================

-- ── Tabela principal ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposal_revisions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id     text        NOT NULL,           -- app_id da proposta (propostas.app_id)
  empresa_id      uuid        NOT NULL,           -- necessário para RLS (igual à proposta)
  revision_letter text        NOT NULL,           -- 'A', 'B', 'C'... gerado automaticamente
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text,                           -- email/nome do usuário logado
  description     text        NOT NULL DEFAULT '', -- motivo da revisão (obrigatório no app)
  value_pv        numeric     DEFAULT 0,          -- valor PV desta revisão no momento do snapshot
  status          text        NOT NULL DEFAULT 'ativa'
                              CHECK (status IN ('ativa', 'arquivada')),
  cloned_from     text,                           -- letra da revisão que foi clonada (nullable)
  snapshot        jsonb,                          -- cópia completa dos dados da proposta
  UNIQUE (proposal_id, revision_letter)           -- letra única por proposta
);

-- Índices de busca mais usados
CREATE INDEX IF NOT EXISTS idx_proposal_revisions_proposal_id
  ON proposal_revisions (proposal_id);

CREATE INDEX IF NOT EXISTS idx_proposal_revisions_empresa_id
  ON proposal_revisions (empresa_id);

CREATE INDEX IF NOT EXISTS idx_proposal_revisions_status
  ON proposal_revisions (proposal_id, status);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE proposal_revisions ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas revisões da própria empresa
CREATE POLICY "proposal_revisions: ver da empresa"
  ON proposal_revisions FOR SELECT
  USING (empresa_id IN (SELECT auth_empresa_ids()));

-- Inserção: empresa autorizada + não-colaborador
CREATE POLICY "proposal_revisions: inserir na empresa"
  ON proposal_revisions FOR INSERT
  WITH CHECK (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- Atualização: apenas status (arquivar) — sem alterar snapshot ou letra
-- Somente gestor+
CREATE POLICY "proposal_revisions: arquivar"
  ON proposal_revisions FOR UPDATE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() NOT IN ('colaborador', 'prestador')
  );

-- Exclusão: apenas dono/gestor/admin
CREATE POLICY "proposal_revisions: deletar gestor+"
  ON proposal_revisions FOR DELETE
  USING (
    empresa_id IN (SELECT auth_empresa_ids())
    AND auth_perfil() IN ('dono', 'gestor', 'admin')
  );

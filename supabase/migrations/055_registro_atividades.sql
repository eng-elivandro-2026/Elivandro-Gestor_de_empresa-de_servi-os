-- ============================================================
-- 055_registro_atividades.sql
-- Módulo "Gestão do Tempo" (substitui o antigo "Gestão CEO").
--
-- Registro diário de atividades, colado como bloco de texto
-- padronizado (gerado por GPT externo, fora do portal) e
-- interpretado por um parser em JavaScript (sem IA no portal).
--
-- Etapa 1 — só o registro em si. Dashboard de indicadores, timer
-- e vínculo automático com propostas/obras ficam para depois.
--
-- Executar no SQL Editor do Supabase (Dashboard > SQL Editor).
-- Migration estritamente aditiva (CREATE TABLE/INDEX IF NOT EXISTS) + RLS.
--
-- Depende de: auth_usuario_id(), auth_empresa_ids() (001_rls_policies.sql).
-- ============================================================

CREATE TABLE IF NOT EXISTS registro_atividades (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        uuid NOT NULL,
  usuario_id        uuid NOT NULL,
  data              date NOT NULL,
  hora_inicio       time NOT NULL,
  hora_fim          time NOT NULL,
  duracao_minutos   integer NOT NULL,   -- calculada no parser JS (hora_fim - hora_inicio), gravada para consulta
  macro             text NOT NULL CHECK (macro IN ('PESSOAL', 'PROFISSIONAL')),
  categoria         text NOT NULL CHECK (categoria IN ('Comercial', 'Engenharia', 'Operacional', 'Gestão', 'Portal', 'Suporte', 'Administrativo', 'Pessoal')),
  subcategoria      text,               -- opcional (campo em branco no bloco colado)
  cliente_projeto   text,               -- opcional
  proposta_obra_id  text,               -- TEXTO LIVRE nesta etapa — sem FK (vínculo automático fica para etapa futura)
  gerou_receita     boolean NOT NULL DEFAULT false,
  descricao         text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Sem FK dura em empresa_id/usuario_id — mesmo padrão de planos_estrategicos
-- (052_planejamento_estrategico.sql): integridade garantida por RLS, não
-- por constraint. Sem CHECK de hora_fim > hora_inicio no banco — fica mais
-- permissivo aqui; a validação de horário acontece na prévia editável do
-- parser (mensagem de erro mais amigável do que um erro de constraint).

CREATE INDEX IF NOT EXISTS idx_registro_atividades_usuario ON registro_atividades(usuario_id, data);
CREATE INDEX IF NOT EXISTS idx_registro_atividades_empresa ON registro_atividades(empresa_id);

COMMENT ON TABLE registro_atividades IS 'Registro diário de atividades (Gestão do Tempo) — colado em bloco de texto padronizado e interpretado por parser JS, sem IA no portal.';
COMMENT ON COLUMN registro_atividades.proposta_obra_id IS 'Texto livre nesta etapa (sem FK) — vínculo automático com propostas/obras fica para etapa futura.';

-- ============================================================
-- RLS — Etapa 1: cada usuário só vê/edita os PRÓPRIOS registros,
-- SEM exceção para o dono (decisão explícita: visão agregada por
-- empresa fica para a etapa do dashboard).
-- ============================================================
ALTER TABLE registro_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario gerencia proprios registros" ON registro_atividades;
CREATE POLICY "usuario gerencia proprios registros" ON registro_atividades
  FOR ALL
  USING (usuario_id = auth_usuario_id() AND empresa_id IN (SELECT auth_empresa_ids()))
  WITH CHECK (usuario_id = auth_usuario_id() AND empresa_id IN (SELECT auth_empresa_ids()));

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'registro_atividades';
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'registro_atividades';

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- DROP TABLE IF EXISTS registro_atividades;
-- ============================================================

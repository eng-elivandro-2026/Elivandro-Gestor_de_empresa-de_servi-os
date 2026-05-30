-- ============================================================
-- 035_ciclo_execucao.sql
-- Adicionar campos de Ciclo de Execução na tabela gestao_negocio
-- ============================================================

-- Adicionar colunas de Ciclo de Execução
ALTER TABLE gestao_negocio
ADD COLUMN IF NOT EXISTS data_exec_inicio DATE,
ADD COLUMN IF NOT EXISTS data_exec_termino DATE,
ADD COLUMN IF NOT EXISTS data_exec_aceite DATE;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_exec_inicio
ON gestao_negocio(data_exec_inicio);

CREATE INDEX IF NOT EXISTS idx_gestao_negocio_exec_termino
ON gestao_negocio(data_exec_termino);

CREATE INDEX IF NOT EXISTS idx_gestao_negocio_exec_aceite
ON gestao_negocio(data_exec_aceite);

-- Comentários para documentação
COMMENT ON COLUMN gestao_negocio.data_exec_inicio IS 'Data de Início de Execução';
COMMENT ON COLUMN gestao_negocio.data_exec_termino IS 'Data de Término do Trabalho';
COMMENT ON COLUMN gestao_negocio.data_exec_aceite IS 'Data de Aceite / Entrega ao Cliente';

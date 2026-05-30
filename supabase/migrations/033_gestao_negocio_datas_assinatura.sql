-- ============================================================
-- 033_gestao_negocio_datas_assinatura.sql
-- Adicionar campos para rastrear data/hora de assinatura do cliente e empresa
-- ============================================================

ALTER TABLE gestao_negocio
ADD COLUMN IF NOT EXISTS assinado_cliente_em timestamptz,
ADD COLUMN IF NOT EXISTS assinado_empresa_em timestamptz;

-- Índices para consultas por data
CREATE INDEX IF NOT EXISTS idx_gestao_negocio_assinado_cliente_em
  ON gestao_negocio (assinado_cliente_em DESC) WHERE assinado_cliente_em IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gestao_negocio_assinado_empresa_em
  ON gestao_negocio (assinado_empresa_em DESC) WHERE assinado_empresa_em IS NOT NULL;

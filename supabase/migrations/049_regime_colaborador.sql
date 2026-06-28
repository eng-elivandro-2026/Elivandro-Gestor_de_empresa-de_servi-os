-- ============================================================
-- 049_regime_colaborador.sql
-- Regime de trabalho por colaborador + tabela de feriados da empresa.
--
-- O QUE CRIA:
--   • regime_colaborador — escala semanal (dia_0..dia_6 = seg..dom), jornada
--     por dia, refeição, percentuais de acréscimo (além da jornada, sábado,
--     domingo, feriado, folga) e adicional noturno. Suporta vigência e
--     ativação. dia_N_tipo ∈ 'work' | 'extra50' | 'extra100' | 'off'.
--   • feriados_empresa — feriados por empresa (nacionais/estaduais/municipais
--     /manuais) usados no cálculo do tipo de dia.
--
-- Migration estritamente ADITIVA (CREATE TABLE/INDEX IF NOT EXISTS). Não
-- altera dados nem tabelas existentes. A RLS vem na 050_regime_rls.sql.
-- Aplicar somente com autorização explícita, no SQL Editor do Supabase.
--
-- Depende de: colaboradores(id) (FK em regime_colaborador.colaborador_id).
-- ============================================================

CREATE TABLE IF NOT EXISTS regime_colaborador (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid REFERENCES colaboradores(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL,
  escala text NOT NULL DEFAULT '5x2adm',
  refeicao_minutos int NOT NULL DEFAULT 60,
  dia_0_tipo text NOT NULL DEFAULT 'work', dia_0_entrada time, dia_0_saida time,
  dia_1_tipo text NOT NULL DEFAULT 'work', dia_1_entrada time, dia_1_saida time,
  dia_2_tipo text NOT NULL DEFAULT 'work', dia_2_entrada time, dia_2_saida time,
  dia_3_tipo text NOT NULL DEFAULT 'work', dia_3_entrada time, dia_3_saida time,
  dia_4_tipo text NOT NULL DEFAULT 'work', dia_4_entrada time, dia_4_saida time,
  dia_5_tipo text NOT NULL DEFAULT 'extra50', dia_5_entrada time, dia_5_saida time,
  dia_6_tipo text NOT NULL DEFAULT 'off', dia_6_entrada time, dia_6_saida time,
  acresc_alem_jornada int NOT NULL DEFAULT 50,
  acresc_sabado int NOT NULL DEFAULT 50,
  acresc_domingo int NOT NULL DEFAULT 100,
  acresc_feriado int NOT NULL DEFAULT 100,
  acresc_folga int NOT NULL DEFAULT 100,
  noturno_ativo bool NOT NULL DEFAULT true,
  noturno_inicio time NOT NULL DEFAULT '22:00',
  noturno_fim time NOT NULL DEFAULT '05:00',
  noturno_pct int NOT NULL DEFAULT 20,
  vigencia_inicio date,
  vigencia_fim date,
  ativo bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feriados_empresa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  data date NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_regime_colaborador_colab ON regime_colaborador(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_regime_colaborador_empresa ON regime_colaborador(empresa_id);
CREATE INDEX IF NOT EXISTS idx_feriados_empresa_data ON feriados_empresa(empresa_id, data);

COMMENT ON TABLE regime_colaborador IS 'Regime de trabalho por colaborador — escala, jornada, acréscimos e adicional noturno';
COMMENT ON TABLE feriados_empresa IS 'Feriados da empresa — nacionais, estaduais, municipais e manuais';

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION (executar separadamente)
-- ============================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_name IN ('regime_colaborador','feriados_empresa');

-- ============================================================
-- ROLLBACK (não executar automaticamente — somente referência)
-- ============================================================
-- DROP TABLE IF EXISTS feriados_empresa;
-- DROP TABLE IF EXISTS regime_colaborador;
-- ============================================================

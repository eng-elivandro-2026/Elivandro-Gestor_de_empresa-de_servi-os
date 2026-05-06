// ============================================================
// supabase-obra-diario.js - Diario de Obra do Operacional
// ============================================================
(function (window) {
  'use strict';

  function client() {
    if (!window.sbClient) throw new Error('Supabase nao esta conectado.');
    return window.sbClient;
  }

  function empresaAtivaId() {
    if (typeof window.getEmpresaAtivaId === 'function') return window.getEmpresaAtivaId();
    if (typeof window.getEmpresaAtiva === 'function') {
      var emp = window.getEmpresaAtiva();
      if (emp && emp.id) return emp.id;
    }
    return window._empresaAtiva && window._empresaAtiva.id ? window._empresaAtiva.id : null;
  }

  function txt(v) {
    return v == null ? '' : String(v).trim();
  }

  function num(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function intNum(v) {
    var n = parseInt(v, 10);
    return isFinite(n) ? n : 0;
  }

  function dateOrNull(v) {
    v = txt(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
  }

  function timeOrNull(v) {
    v = txt(v);
    return /^\d{2}:\d{2}(:\d{2})?$/.test(v) ? v : null;
  }

  var CAMPOS_TEXTO = [
    'turno', 'status_dia', 'responsavel_dia_nome', 'area_local', 'equipamento_maquina_linha',
    'motivo_extensao_horario', 'motivo_atraso_inicio', 'motivo_saida_antecipada',
    'motivo_nao_liberacao', 'observacoes_seguranca',
    'equipe_prevista_resumo', 'equipe_presente_resumo', 'faltas_resumo', 'atraso_equipe_resumo', 'saida_antecipada_resumo', 'observacoes_equipe',
    'tipo_alimentacao', 'local_alimentacao', 'observacoes_alimentacao', 'veiculo_utilizado', 'motorista', 'cidade_origem', 'cidade_destino', 'hotel_utilizado', 'descricao_problema_deslocamento', 'observacoes_mobilizacao',
    'ferramentas_utilizadas', 'epis_utilizados', 'epcs_isolamento_utilizados', 'descricao_ferramenta_faltante', 'descricao_ferramenta_danificada', 'descricao_compra_emergencial',
    'atividade_principal', 'descricao_execucao', 'local_execucao', 'etapa_obra',
    'descricao_material_faltante', 'responsavel_compra_material', 'responsavel_retirada_material', 'status_pendencia_material', 'acao_tomada_material', 'observacoes_material',
    'tipo_intercorrencia', 'descricao_intercorrencia', 'acao_tomada',
    'pendencias', 'responsavel_pendencia', 'proxima_atividade', 'objetivo_proximo_dia',
    'resumo_do_dia', 'observacoes_finais'
  ];

  var CAMPOS_BOOL = [
    'houve_extensao_horario', 'houve_atraso_inicio', 'houve_saida_antecipada',
    'dds_realizado', 'apr_obrigatoria', 'apr_liberada', 'pt_obrigatoria', 'pt_liberada', 'area_isolada',
    'bloqueio_etiquetagem_necessario', 'bloqueio_etiquetagem_realizado', 'epi_conferido', 'servico_liberado',
    'houve_falta', 'houve_atraso_equipe', 'houve_saida_antecipada_equipe',
    'houve_deslocamento', 'houve_problema_deslocamento', 'houve_custo_extra_transporte',
    'faltou_ferramenta', 'houve_ferramenta_danificada', 'houve_compra_emergencial',
    'houve_falta_material', 'material_faltante_previsto', 'impacto_falta_material_prazo', 'impacto_falta_material_custo',
    'houve_intercorrencia', 'impacto_prazo', 'impacto_custo', 'impacto_seguranca',
    'bloqueia_proxima_atividade', 'dia_concluido_com_sucesso'
  ];

  var CAMPOS_NUM = ['valor_custo_extra_transporte', 'horas_equipe_total', 'avanco_estimado_dia'];
  var CAMPOS_INT = ['intervalo_realizado_minutos'];
  var CAMPOS_TIME = ['hora_inicio_real', 'hora_termino_real'];

  function montarPayload(dados, parcial) {
    dados = dados || {};
    var out = {};
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'empresa_id')) out.empresa_id = dados.empresa_id || empresaAtivaId();
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'obra_id')) out.obra_id = dados.obra_id;
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'data_diario')) out.data_diario = dateOrNull(dados.data_diario);

    CAMPOS_TEXTO.forEach(function (k) {
      if (!parcial || Object.prototype.hasOwnProperty.call(dados, k)) out[k] = txt(dados[k]);
    });
    CAMPOS_BOOL.forEach(function (k) {
      if (!parcial || Object.prototype.hasOwnProperty.call(dados, k)) out[k] = !!dados[k];
    });
    CAMPOS_NUM.forEach(function (k) {
      if (!parcial || Object.prototype.hasOwnProperty.call(dados, k)) out[k] = num(dados[k]);
    });
    CAMPOS_INT.forEach(function (k) {
      if (!parcial || Object.prototype.hasOwnProperty.call(dados, k)) out[k] = intNum(dados[k]);
    });
    CAMPOS_TIME.forEach(function (k) {
      if (!parcial || Object.prototype.hasOwnProperty.call(dados, k)) out[k] = timeOrNull(dados[k]);
    });

    if (!out.turno) out.turno = 'integral';
    if (!out.status_dia) out.status_dia = 'concluido';
    if (!Object.prototype.hasOwnProperty.call(out, 'servico_liberado')) out.servico_liberado = true;
    if (!Object.prototype.hasOwnProperty.call(out, 'dia_concluido_com_sucesso')) out.dia_concluido_com_sucesso = true;
    return out;
  }

  function validarCriacao(row) {
    if (!row.empresa_id) throw new Error('Empresa ativa nao encontrada.');
    if (!row.obra_id) throw new Error('Diario sem obra vinculada.');
    if (!row.data_diario) throw new Error('Informe a data do diario.');
    if (!txt(row.atividade_principal)) throw new Error('Informe a atividade principal.');
    if (!txt(row.resumo_do_dia)) throw new Error('Informe o resumo do dia.');
  }

  function erroDuplicidade(error) {
    if (error && error.code === '23505') {
      throw new Error('Ja existe diario para esta obra, data e turno.');
    }
    throw error;
  }

  async function sbListarDiariosObra(empresaId, obraId) {
    empresaId = empresaId || empresaAtivaId();
    if (!empresaId) throw new Error('Empresa ativa nao encontrada.');
    if (!obraId) throw new Error('Obra nao informada.');
    var res = await client()
      .from('obra_diario')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('obra_id', obraId)
      .order('data_diario', { ascending: false })
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function sbBuscarDiarioPorId(diarioId) {
    if (!diarioId) throw new Error('ID do diario nao informado.');
    var res = await client().from('obra_diario').select('*').eq('id', diarioId).maybeSingle();
    if (res.error) throw res.error;
    return res.data || null;
  }

  async function sbCriarDiarioObra(dados) {
    var row = montarPayload(dados, false);
    validarCriacao(row);
    var res = await client().from('obra_diario').insert(row).select('*').single();
    if (res.error) erroDuplicidade(res.error);
    return res.data;
  }

  async function sbAtualizarDiarioObra(diarioId, dados) {
    if (!diarioId) throw new Error('ID do diario nao informado.');
    var row = montarPayload(dados, true);
    if (Object.prototype.hasOwnProperty.call(row, 'atividade_principal') && !txt(row.atividade_principal)) throw new Error('Informe a atividade principal.');
    if (Object.prototype.hasOwnProperty.call(row, 'resumo_do_dia') && !txt(row.resumo_do_dia)) throw new Error('Informe o resumo do dia.');
    var res = await client().from('obra_diario').update(row).eq('id', diarioId).select('*').single();
    if (res.error) erroDuplicidade(res.error);
    return res.data;
  }

  async function sbExcluirDiarioObra(diarioId) {
    if (!diarioId) throw new Error('ID do diario nao informado.');
    var res = await client().from('obra_diario').delete().eq('id', diarioId);
    if (res.error) throw res.error;
    return true;
  }

  window.sbListarDiariosObra = sbListarDiariosObra;
  window.sbBuscarDiarioPorId = sbBuscarDiarioPorId;
  window.sbCriarDiarioObra = sbCriarDiarioObra;
  window.sbAtualizarDiarioObra = sbAtualizarDiarioObra;
  window.sbExcluirDiarioObra = sbExcluirDiarioObra;
})(window);

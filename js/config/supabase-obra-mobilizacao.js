// ============================================================
// supabase-obra-mobilizacao.js - Recebimento, mobilizacao e recursos
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

  var RECEBIMENTO_TEXT = [
    'recebimento_status', 'responsavel_recebimento_nome', 'numero_pedido_compra',
    'area_local', 'equipamento_maquina_linha', 'endereco_execucao', 'cidade_execucao',
    'observacoes_recebimento', 'observacoes_seguranca_obra', 'dias_trabalho_previstos',
    'observacoes_horario', 'tipo_alimentacao_padrao', 'local_alimentacao_padrao',
    'observacoes_alimentacao_padrao', 'hotel_previsto', 'veiculo_previsto',
    'responsavel_mobilizacao_nome', 'ponto_encontro_equipe', 'observacoes_mobilizacao_obra',
    'plano_contingencia_material', 'responsavel_compra_emergencial',
    'responsavel_retirada_emergencial', 'observacoes_contingencia_material'
  ];

  var RECEBIMENTO_BOOL = [
    'pedido_compra_recebido', 'escopo_conferido', 'prazo_validado',
    'condicao_pagamento_conferida', 'proposta_aprovada_conferida',
    'integracao_obrigatoria', 'dds_obrigatorio', 'apr_obrigatoria_obra',
    'pt_obrigatoria_obra', 'isolamento_area_obrigatorio',
    'bloqueio_etiquetagem_obrigatorio', 'art_obrigatoria', 'aso_obrigatorio',
    'nr10_obrigatoria', 'nr35_obrigatoria', 'pgr_pcmso_obrigatorio',
    'horario_definido_pelo_cliente', 'permite_hora_extra',
    'permite_trabalho_fim_semana', 'precisa_mobilizacao', 'precisa_hotel',
    'precisa_veiculo', 'precisa_combustivel', 'precisa_pedagio',
    'precisa_estacionamento', 'precisa_adiantamento',
    'precisa_aprovacao_compra_emergencial'
  ];

  function montarRecebimento(dados) {
    dados = dados || {};
    var out = {};
    RECEBIMENTO_TEXT.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(dados, k)) out[k] = txt(dados[k]);
    });
    RECEBIMENTO_BOOL.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(dados, k)) out[k] = !!dados[k];
    });
    if (Object.prototype.hasOwnProperty.call(dados, 'data_recebimento_operacional')) out.data_recebimento_operacional = dateOrNull(dados.data_recebimento_operacional);
    if (Object.prototype.hasOwnProperty.call(dados, 'horario_inicio_previsto')) out.horario_inicio_previsto = timeOrNull(dados.horario_inicio_previsto);
    if (Object.prototype.hasOwnProperty.call(dados, 'horario_termino_previsto')) out.horario_termino_previsto = timeOrNull(dados.horario_termino_previsto);
    if (Object.prototype.hasOwnProperty.call(dados, 'horario_encontro_equipe')) out.horario_encontro_equipe = timeOrNull(dados.horario_encontro_equipe);
    if (Object.prototype.hasOwnProperty.call(dados, 'intervalo_almoco_previsto_minutos')) out.intervalo_almoco_previsto_minutos = intNum(dados.intervalo_almoco_previsto_minutos);
    if (Object.prototype.hasOwnProperty.call(dados, 'valor_adiantamento_previsto')) out.valor_adiantamento_previsto = num(dados.valor_adiantamento_previsto);
    return out;
  }

  async function sbAtualizarRecebimentoMobilizacaoObra(obraId, dados) {
    if (!obraId) throw new Error('ID da obra nao informado.');
    var res = await client().from('obras').update(montarRecebimento(dados)).eq('id', obraId).select('*').single();
    if (res.error) throw res.error;
    return res.data;
  }

  var RECURSOS_PADRAO = [
    ['ferramentas_apoio', 'Carrinho de ferramentas'], ['ferramentas_apoio', 'Bau de ferramentas'],
    ['ferramentas_apoio', 'Armario'], ['ferramentas_apoio', 'Mesa de apoio'],
    ['ferramentas_apoio', 'Cadeira / banco'], ['ferramentas_apoio', 'Lanternas'],
    ['ferramentas_apoio', 'Extensao eletrica'], ['ferramentas_apoio', 'Escada'],
    ['ferramentas_apoio', 'Corda / cintas'], ['ferramentas_apoio', 'Ventilador'],
    ['ferramentas_apoio', 'Outros'],
    ['medicao_teste', 'Multimetro'], ['medicao_teste', 'Alicate amperimetro'],
    ['medicao_teste', 'Megometro'], ['medicao_teste', 'Detector de tensao'],
    ['medicao_teste', 'Sequencimetro'], ['medicao_teste', 'Notebook / cabo de programacao'],
    ['medicao_teste', 'Fonte de teste'], ['medicao_teste', 'Outros instrumentos'],
    ['epis', 'Capacete'], ['epis', 'Oculos de seguranca'], ['epis', 'Protetor auricular'],
    ['epis', 'Mascara facial'], ['epis', 'Luva comum'], ['epis', 'Luva de vaqueta'],
    ['epis', 'Luva isolante 750 V'], ['epis', 'Luva especial'], ['epis', 'Cinto de seguranca'],
    ['epis', 'Calcado de seguranca'], ['epis', 'Outros EPIs'],
    ['epcs_sinalizacao', 'Cone'], ['epcs_sinalizacao', 'Corrente plastica'],
    ['epcs_sinalizacao', 'Fita zebrada'], ['epcs_sinalizacao', 'Placa de sinalizacao'],
    ['epcs_sinalizacao', 'Cavalete de isolamento'], ['epcs_sinalizacao', 'Bloqueio e etiquetagem'],
    ['epcs_sinalizacao', 'Material para isolamento de area'], ['epcs_sinalizacao', 'Outros EPCs']
  ];

  function montarRecurso(dados, parcial) {
    dados = dados || {};
    var out = {};
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'empresa_id')) out.empresa_id = dados.empresa_id || empresaAtivaId();
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'obra_id')) out.obra_id = dados.obra_id;
    ['categoria', 'item', 'responsavel', 'status', 'observacoes'].forEach(function (k) {
      if (!parcial || Object.prototype.hasOwnProperty.call(dados, k)) out[k] = txt(dados[k]);
    });
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'obrigatorio')) out.obrigatorio = !!dados.obrigatorio;
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'quantidade_prevista')) out.quantidade_prevista = num(dados.quantidade_prevista) || 1;
    if (!out.status) out.status = 'previsto';
    return out;
  }

  async function sbListarRecursosCampoObra(empresaId, obraId) {
    empresaId = empresaId || empresaAtivaId();
    if (!empresaId) throw new Error('Empresa ativa nao encontrada.');
    if (!obraId) throw new Error('Obra nao informada.');
    var res = await client().from('obra_recursos_campo').select('*').eq('empresa_id', empresaId).eq('obra_id', obraId).order('categoria').order('item');
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function sbCriarRecursoCampo(dados) {
    var row = montarRecurso(dados, false);
    if (!row.empresa_id) throw new Error('Empresa ativa nao encontrada.');
    if (!row.obra_id) throw new Error('Recurso sem obra vinculada.');
    if (!row.categoria) throw new Error('Informe a categoria do recurso.');
    if (!row.item) throw new Error('Informe o item do recurso.');
    var res = await client().from('obra_recursos_campo').insert(row).select('*').single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function sbAtualizarRecursoCampo(id, dados) {
    if (!id) throw new Error('ID do recurso nao informado.');
    var res = await client().from('obra_recursos_campo').update(montarRecurso(dados, true)).eq('id', id).select('*').single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function sbExcluirRecursoCampo(id) {
    if (!id) throw new Error('ID do recurso nao informado.');
    var res = await client().from('obra_recursos_campo').delete().eq('id', id);
    if (res.error) throw res.error;
    return true;
  }

  async function sbCriarRecursosPadraoObra(empresaId, obraId) {
    empresaId = empresaId || empresaAtivaId();
    if (!empresaId) throw new Error('Empresa ativa nao encontrada.');
    if (!obraId) throw new Error('Obra nao informada.');
    var rows = RECURSOS_PADRAO.map(function (it) {
      return { empresa_id: empresaId, obra_id: obraId, categoria: it[0], item: it[1], status: 'previsto', quantidade_prevista: 1, obrigatorio: false };
    });
    var res = await client().from('obra_recursos_campo').upsert(rows, { onConflict: 'empresa_id,obra_id,categoria,item', ignoreDuplicates: true }).select('*');
    if (res.error) throw res.error;
    return res.data || [];
  }

  function montarPessoa(dados, parcial) {
    dados = dados || {};
    var out = {};
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'empresa_id')) out.empresa_id = dados.empresa_id || empresaAtivaId();
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'obra_id')) out.obra_id = dados.obra_id;
    ['colaborador_id', 'nome_colaborador', 'funcao', 'forma_deslocamento', 'carona_com', 'ponto_encontro', 'veiculo_utilizado', 'motorista', 'observacoes'].forEach(function (k) {
      if (!parcial || Object.prototype.hasOwnProperty.call(dados, k)) out[k] = txt(dados[k]);
    });
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'horario_encontro')) out.horario_encontro = timeOrNull(dados.horario_encontro);
    ['precisa_adiantamento', 'precisa_reembolso', 'comprovante_obrigatorio'].forEach(function (k) {
      if (!parcial || Object.prototype.hasOwnProperty.call(dados, k)) out[k] = !!dados[k];
    });
    if (!parcial || Object.prototype.hasOwnProperty.call(dados, 'valor_adiantamento')) out.valor_adiantamento = num(dados.valor_adiantamento);
    return out;
  }

  async function sbListarMobilizacaoEquipeObra(empresaId, obraId) {
    empresaId = empresaId || empresaAtivaId();
    if (!empresaId) throw new Error('Empresa ativa nao encontrada.');
    if (!obraId) throw new Error('Obra nao informada.');
    var res = await client().from('obra_mobilizacao_equipe').select('*').eq('empresa_id', empresaId).eq('obra_id', obraId).order('nome_colaborador');
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function sbCriarMobilizacaoEquipe(dados) {
    var row = montarPessoa(dados, false);
    if (!row.empresa_id) throw new Error('Empresa ativa nao encontrada.');
    if (!row.obra_id) throw new Error('Mobilizacao sem obra vinculada.');
    if (!row.nome_colaborador) throw new Error('Informe o nome do colaborador.');
    var res = await client().from('obra_mobilizacao_equipe').insert(row).select('*').single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function sbAtualizarMobilizacaoEquipe(id, dados) {
    if (!id) throw new Error('ID da mobilizacao nao informado.');
    var res = await client().from('obra_mobilizacao_equipe').update(montarPessoa(dados, true)).eq('id', id).select('*').single();
    if (res.error) throw res.error;
    return res.data;
  }

  async function sbExcluirMobilizacaoEquipe(id) {
    if (!id) throw new Error('ID da mobilizacao nao informado.');
    var res = await client().from('obra_mobilizacao_equipe').delete().eq('id', id);
    if (res.error) throw res.error;
    return true;
  }

  window.OP_RECURSOS_PADRAO = RECURSOS_PADRAO;
  window.sbAtualizarRecebimentoMobilizacaoObra = sbAtualizarRecebimentoMobilizacaoObra;
  window.sbListarRecursosCampoObra = sbListarRecursosCampoObra;
  window.sbCriarRecursoCampo = sbCriarRecursoCampo;
  window.sbAtualizarRecursoCampo = sbAtualizarRecursoCampo;
  window.sbExcluirRecursoCampo = sbExcluirRecursoCampo;
  window.sbCriarRecursosPadraoObra = sbCriarRecursosPadraoObra;
  window.sbListarMobilizacaoEquipeObra = sbListarMobilizacaoEquipeObra;
  window.sbCriarMobilizacaoEquipe = sbCriarMobilizacaoEquipe;
  window.sbAtualizarMobilizacaoEquipe = sbAtualizarMobilizacaoEquipe;
  window.sbExcluirMobilizacaoEquipe = sbExcluirMobilizacaoEquipe;
})(window);

// ============================================================
// operacional-inline.js - Fase 1A do modulo Operacional
// ============================================================
(function (window, document) {
  'use strict';

  // Configuração de impressão
  var _opPrintConfig = {
    size: 'a4',
    orientation: 'portrait',
    scale: 100,
    fitWidth: true,
    margin: 'normal'
  };

  // Preview em split screen
  var _opPreviewAtivo = false;
  var _previewDebounce = null;
  var _opSectionBreaks = {};  // rastreia quais seções têm quebra de página

  var state = {
    obras: [],
    carregando: false,
    erro: '',
    status: '',
    cliente: '',
    busca: '',
    obraAtual: null,
    apontamentosNegocio: [],
    apontamentosNegocioLoaded: false,
    apontamentosNegocioCarregando: false,
    apontamentosNegocioErro: '',
    gestaoDocumento: null,
    gestaoDocumentoLoaded: false,
    gestaoDocumentoCarregando: false,
    gestaoDocumentoErro: '',
    diarios: [],
    diariosLoaded: false,
    diarioCarregando: false,
    diarioErro: '',
    diarioFiltroData: '',
    diarioFiltroStatus: '',
    diarioForm: null,
    diarioEditId: '',
    diarioAccordionOpen: '',
    recursos: [],
    recursosLoaded: false,
    recursosErro: '',
    recursosCarregando: false,
    recursoForm: null,
    recursoEditId: '',
    recursoExcluir: null,
    recursosPadraoPicker: false,
    mobilizacaoEquipe: [],
    mobilizacaoLoaded: false,
    mobilizacaoErro: '',
    mobilizacaoCarregando: false,
    mobilizacaoForm: null,
    mobilizacaoEditId: '',
    mobilizacaoExcluir: null,
    gestaoAssinaturas: {
      cliente: { dataUrl: '', assinada: false },
      empresa: { dataUrl: '', assinada: false }
    },
    accordionOpen: {}
  };

  // ── Proteção de race condition: troca rápida de empresa ──
  // Incrementado a cada carregarObras(); respostas de tokens antigos são descartadas.
  var _opLoadToken = 0;

  var STATUS_RETROATIVOS = [
    'andamento',
    'taf',
    'sat',
    'faturado',
    'recebido',
    'finalizado',
    'atrasado',
    'em_pausa_falta_material',
    'em_pausa_aguardando_cliente',
    'em_pausa_aguardando_terceiro'
  ];

  var FASES_GESTAO_NEGOCIO = [
    'aprovado',
    'andamento',
    'taf',
    'sat',
    'finalizado',
    'atrasado',
    'em_pausa_falta_material',
    'em_pausa_aguardando_cliente',
    'em_pausa_aguardando_terceiro'
  ];

  // Fases COMERCIAIS permitidas ao "Voltar para Comercial" (desfazer obra).
  // Nunca inclui status operacionais nem faturado/recebido.
  var FASES_RETORNO_COMERCIAL = [
    'em_elaboracao',
    'enviada',
    'cliente_analisando',
    'follow1',
    'follow2',
    'follow3',
    'follow4',
    'ganho',
    'perdido',
    'cancelada',
    'virou_outra_proposta'
  ];

  var DIARIO_LISTAS = {
    turno: {
      manha: 'Manha',
      tarde: 'Tarde',
      noite: 'Noite',
      integral: 'Integral'
    },
    status_dia: {
      planejado: 'Planejado',
      em_andamento: 'Em andamento',
      concluido: 'Concluido',
      paralisado: 'Paralisado',
      cancelado: 'Cancelado'
    },
    tipo_alimentacao: {
      restaurante_cliente: 'Restaurante do cliente',
      restaurante_externo: 'Restaurante externo',
      marmitex: 'Marmitex',
      alimentacao_propria: 'Alimentacao propria',
      nao_aplicavel: 'Nao aplicavel'
    },
    status_pendencia_material: {
      identificado: 'Identificado',
      aguardando_aprovacao: 'Aguardando aprovacao',
      comprando: 'Comprando',
      aguardando_retirada: 'Aguardando retirada',
      aguardando_entrega: 'Aguardando entrega',
      resolvido: 'Resolvido',
      cancelado: 'Cancelado'
    },
    tipo_intercorrencia: {
      falta_material: 'Falta de material',
      area_nao_liberada: 'Area nao liberada',
      apr_nao_liberada: 'APR nao liberada',
      pt_nao_liberada: 'PT nao liberada',
      cliente_indisponivel: 'Cliente indisponivel',
      equipamento_indisponivel: 'Equipamento indisponivel',
      falta_energia: 'Falta de energia',
      atraso_terceiro: 'Atraso de terceiro',
      falta_colaborador: 'Falta de colaborador',
      saida_antecipada: 'Saida antecipada',
      problema_tecnico: 'Problema tecnico',
      mudanca_escopo: 'Mudanca de escopo',
      outro: 'Outro'
    }
  };

  var DIARIO_BLOCOS = [
    { titulo: 'Bloco 1 - Identificacao', campos: [
      ['data_diario', 'Data do diario', 'date'], ['turno', 'Turno', 'select:turno'], ['status_dia', 'Status do dia', 'select:status_dia'],
      ['responsavel_dia_nome', 'Responsavel do dia', 'text'], ['area_local', 'Area / Local', 'text'], ['equipamento_maquina_linha', 'Equipamento / Maquina / Linha', 'text']
    ]},
    { titulo: 'Bloco 2 - Horario', campos: [
      ['hora_inicio_real', 'Hora inicio real', 'time'], ['hora_termino_real', 'Hora termino real', 'time'], ['intervalo_realizado_minutos', 'Intervalo realizado em minutos', 'number'],
      ['houve_extensao_horario', 'Houve extensao de horario?', 'checkbox'], ['motivo_extensao_horario', 'Motivo da extensao', 'textarea'],
      ['houve_atraso_inicio', 'Houve atraso no inicio?', 'checkbox'], ['motivo_atraso_inicio', 'Motivo do atraso', 'textarea'],
      ['houve_saida_antecipada', 'Houve saida antecipada?', 'checkbox'], ['motivo_saida_antecipada', 'Motivo da saida antecipada', 'textarea']
    ]},
    { titulo: 'Bloco 3 - Seguranca / Liberacao', campos: [
      ['dds_realizado', 'DDS realizado?', 'checkbox'], ['apr_obrigatoria', 'APR obrigatoria?', 'checkbox'], ['apr_liberada', 'APR liberada?', 'checkbox'],
      ['pt_obrigatoria', 'PT obrigatoria?', 'checkbox'], ['pt_liberada', 'PT liberada?', 'checkbox'], ['area_isolada', 'Area isolada?', 'checkbox'],
      ['bloqueio_etiquetagem_necessario', 'Bloqueio e etiquetagem necessario?', 'checkbox'], ['bloqueio_etiquetagem_realizado', 'Bloqueio e etiquetagem realizado?', 'checkbox'],
      ['epi_conferido', 'EPI conferido?', 'checkbox'], ['servico_liberado', 'Servico liberado?', 'checkbox'], ['motivo_nao_liberacao', 'Motivo de nao liberacao', 'textarea'],
      ['observacoes_seguranca', 'Observacoes de seguranca', 'textarea']
    ]},
    { titulo: 'Bloco 4 - Equipe', campos: [
      ['equipe_prevista_resumo', 'Equipe prevista', 'textarea'], ['equipe_presente_resumo', 'Equipe presente', 'textarea'], ['houve_falta', 'Houve falta?', 'checkbox'],
      ['faltas_resumo', 'Faltas resumo', 'textarea'], ['houve_atraso_equipe', 'Houve atraso da equipe?', 'checkbox'], ['atraso_equipe_resumo', 'Atraso resumo', 'textarea'],
      ['houve_saida_antecipada_equipe', 'Houve saida antecipada da equipe?', 'checkbox'], ['saida_antecipada_resumo', 'Saida antecipada resumo', 'textarea'],
      ['observacoes_equipe', 'Observacoes da equipe', 'textarea']
    ]},
    { titulo: 'Bloco 5 - Alimentacao / Mobilizacao', campos: [
      ['tipo_alimentacao', 'Tipo de alimentacao', 'select:tipo_alimentacao'], ['local_alimentacao', 'Local da alimentacao', 'text'], ['observacoes_alimentacao', 'Observacoes de alimentacao', 'textarea'],
      ['houve_deslocamento', 'Houve deslocamento?', 'checkbox'], ['veiculo_utilizado', 'Veiculo utilizado', 'text'], ['motorista', 'Motorista', 'text'],
      ['cidade_origem', 'Cidade origem', 'text'], ['cidade_destino', 'Cidade destino', 'text'], ['hotel_utilizado', 'Hotel utilizado', 'text'],
      ['houve_problema_deslocamento', 'Houve problema de deslocamento?', 'checkbox'], ['descricao_problema_deslocamento', 'Descricao do problema', 'textarea'],
      ['houve_custo_extra_transporte', 'Houve custo extra de transporte?', 'checkbox'], ['valor_custo_extra_transporte', 'Valor custo extra de transporte', 'number'],
      ['observacoes_mobilizacao', 'Observacoes de mobilizacao', 'textarea']
    ]},
    { titulo: 'Bloco 6 - Ferramentas / EPIs / Recursos', campos: [
      ['ferramentas_utilizadas', 'Ferramentas utilizadas', 'textarea'], ['epis_utilizados', 'EPIs utilizados', 'textarea'], ['epcs_isolamento_utilizados', 'EPCs / isolamento utilizados', 'textarea'],
      ['faltou_ferramenta', 'Faltou ferramenta?', 'checkbox'], ['descricao_ferramenta_faltante', 'Descricao da ferramenta faltante', 'textarea'],
      ['houve_ferramenta_danificada', 'Houve ferramenta danificada?', 'checkbox'], ['descricao_ferramenta_danificada', 'Descricao da ferramenta danificada', 'textarea'],
      ['houve_compra_emergencial', 'Houve compra emergencial?', 'checkbox'], ['descricao_compra_emergencial', 'Descricao da compra emergencial', 'textarea']
    ]},
    { titulo: 'Bloco 7 - Execucao', campos: [
      ['atividade_principal', 'Atividade principal *', 'text'], ['descricao_execucao', 'Descricao da execucao', 'textarea'], ['local_execucao', 'Local da execucao', 'text'],
      ['etapa_obra', 'Etapa da obra', 'text'], ['horas_equipe_total', 'Horas equipe total', 'number'], ['avanco_estimado_dia', 'Avanco estimado do dia', 'number']
    ]},
    { titulo: 'Bloco 8 - Material faltante', campos: [
      ['houve_falta_material', 'Houve falta de material?', 'checkbox'], ['descricao_material_faltante', 'Descricao do material faltante', 'textarea'],
      ['material_faltante_previsto', 'Material estava previsto?', 'checkbox'], ['responsavel_compra_material', 'Responsavel pela compra', 'text'],
      ['responsavel_retirada_material', 'Responsavel pela retirada', 'text'], ['status_pendencia_material', 'Status da pendencia de material', 'select:status_pendencia_material'],
      ['impacto_falta_material_prazo', 'Impactou prazo?', 'checkbox'], ['impacto_falta_material_custo', 'Impactou custo?', 'checkbox'],
      ['acao_tomada_material', 'Acao tomada', 'textarea'], ['observacoes_material', 'Observacoes sobre material', 'textarea']
    ]},
    { titulo: 'Bloco 9 - Intercorrencias', campos: [
      ['houve_intercorrencia', 'Houve intercorrencia?', 'checkbox'], ['tipo_intercorrencia', 'Tipo de intercorrencia', 'select:tipo_intercorrencia'],
      ['descricao_intercorrencia', 'Descricao da intercorrencia', 'textarea'], ['impacto_prazo', 'Impactou prazo?', 'checkbox'],
      ['impacto_custo', 'Impactou custo?', 'checkbox'], ['impacto_seguranca', 'Impactou seguranca?', 'checkbox'], ['acao_tomada', 'Acao tomada', 'textarea']
    ]},
    { titulo: 'Bloco 10 - Pendencias e proximos passos', campos: [
      ['pendencias', 'Pendencias', 'textarea'], ['responsavel_pendencia', 'Responsavel pela pendencia', 'text'], ['bloqueia_proxima_atividade', 'Bloqueia proxima atividade?', 'checkbox'],
      ['proxima_atividade', 'Proxima atividade', 'textarea'], ['objetivo_proximo_dia', 'Objetivo do proximo dia', 'textarea']
    ]},
    { titulo: 'Bloco 11 - Fechamento', campos: [
      ['resumo_do_dia', 'Resumo do dia *', 'textarea'], ['dia_concluido_com_sucesso', 'Dia concluido com sucesso?', 'checkbox'], ['observacoes_finais', 'Observacoes finais', 'textarea']
    ]}
  ];

  var OP_LISTAS_1C = {
    recebimento_status: {
      nao_iniciado: 'Nao iniciado',
      em_analise: 'Em analise',
      recebido: 'Recebido',
      pendente_informacao: 'Pendente de informacao',
      liberado_para_planejamento: 'Liberado para planejamento'
    },
    tipo_alimentacao_padrao: DIARIO_LISTAS.tipo_alimentacao,
    categoria_recurso: {
      ferramentas_apoio: 'Ferramentas / apoio',
      servico_paineis: 'Servico em paineis',
      medicao_teste: 'Medicao e teste',
      epis: 'EPIs',
      epcs_sinalizacao: 'EPC / sinalizacao',
      outros: 'Outros'
    },
    status_recurso: {
      previsto: 'Previsto',
      separado: 'Separado',
      levado_obra: 'Levado para obra',
      em_uso: 'Em uso',
      faltando: 'Faltando',
      danificado: 'Danificado',
      devolvido: 'Devolvido',
      nao_aplicavel: 'Nao aplicavel'
    },
    forma_deslocamento: {
      carro_proprio: 'Carro proprio',
      moto_propria: 'Moto propria',
      onibus: 'Onibus',
      uber: 'Uber',
      taxi: 'Taxi',
      carona: 'Carona',
      veiculo_empresa: 'Veiculo da empresa',
      veiculo_alugado: 'Veiculo alugado',
      van_transporte_contratado: 'Van / transporte contratado',
      nao_aplicavel: 'Nao aplicavel'
    },
    tipo_integrante: {
      mao_obra_propria: 'Mao de obra propria',
      mei: 'MEI',
      pj: 'PJ',
      empresa_contratada: 'Empresa contratada',
      tecnico_empresa_contratada: 'Tecnico de empresa contratada'
    }
  };

  var RECURSOS_PADRAO_UI = [
    { categoria: 'ferramentas_apoio', titulo: 'Ferramentas / Apoio', itens: [
      'Carrinho de ferramentas', 'Bau de ferramentas', 'Armario', 'Mesa de apoio', 'Cadeira / banco',
      'Lanternas', 'Extensao eletrica', 'Escada', 'Corda / cintas', 'Ventilador', 'Outros'
    ]},
    { categoria: 'servico_paineis', titulo: 'Servico em Paineis', itens: [
      'Impressora de tags', 'Cabos da impressora', 'Etiqueta de componentes', 'Etiqueta de fios',
      'Luvinha para fios', 'Etiqueta de botoes', 'Suporte de etiqueta de botoes',
      'Acrilico para suporte de botoes', 'Caixa de terminais'
    ]},
    { categoria: 'medicao_teste', titulo: 'Equipamentos de medicao e teste', itens: [
      'Multimetro', 'Alicate amperimetro', 'Megometro', 'Detector de tensao',
      'Fasimetro / Sequencimetro', 'Analisador de energia', 'Rastreador de circuitos',
      'Luximetro', 'Notebook / cabo de programacao', 'Fonte de teste', 'Outros instrumentos'
    ]},
    { categoria: 'epis', titulo: 'EPIs', itens: [
      'Capacete com jugular', 'Safety Cap, se no cliente puder usar', 'Oculos de seguranca',
      'Protetor auricular', 'Mascara facial para servicos com lixadeira', 'Mascara facial NR10',
      'Luva comum para uso geral', 'Luva de vaqueta', 'Luva isolante 750 V', 'Luva especial',
      'Cinto de seguranca com 2 talabartes', 'Botina de seguranca',
      'Avental de couro, mangotes etc.', 'Outros EPIs'
    ]},
    { categoria: 'epcs_sinalizacao', titulo: 'EPC / Sinalizacao / Isolamento', itens: [
      'Cone', 'Corrente plastica', 'Fita zebrada', 'Placa de sinalizacao', 'Cavalete de isolamento',
      'LOTO / LOTOTO - Bloqueio e etiquetagem', 'Material para isolamento de area', 'Outros EPCs'
    ]}
  ];

  function $(id) { return document.getElementById(id); }

  function esc(v) {
    if (typeof window.esc === 'function') return window.esc(v == null ? '' : String(v));
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function money(v) {
    if (typeof window.money === 'function') return window.money(Number(v || 0));
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function msg(texto, tipo) {
    if (tipo === 'err') console.error('[Operacional]', texto);
    else console.log('[Operacional]', texto);
    if (typeof window.toast === 'function') window.toast(texto, tipo || 'ok');
    mostrarMensagemOperacional(texto, tipo);
    if (typeof window.toast !== 'function' && tipo === 'err') alert(texto);
  }

  function mostrarMensagemOperacional(texto, tipo) {
    var box = $('opFloatingMsg');
    if (!box) {
      box = document.createElement('div');
      box.id = 'opFloatingMsg';
      box.style.position = 'fixed';
      box.style.left = '50%';
      box.style.top = '18px';
      box.style.transform = 'translateX(-50%)';
      box.style.zIndex = '3000';
      box.style.maxWidth = 'min(92vw, 560px)';
      box.style.borderRadius = '10px';
      box.style.padding = '.75rem 1rem';
      box.style.fontSize = '.9rem';
      box.style.fontWeight = '800';
      box.style.boxShadow = '0 18px 50px rgba(0,0,0,.35)';
      document.body.appendChild(box);
    }
    box.textContent = texto;
    box.style.background = tipo === 'err' ? '#fee2e2' : '#dcfce7';
    box.style.border = tipo === 'err' ? '1px solid #fca5a5' : '1px solid #86efac';
    box.style.color = tipo === 'err' ? '#991b1b' : '#14532d';
    box.style.display = 'block';
    clearTimeout(window.__opFloatingMsgTimer);
    window.__opFloatingMsgTimer = setTimeout(function () {
      var atual = $('opFloatingMsg');
      if (atual) atual.style.display = 'none';
    }, 3600);
  }

  function labelStatus(st) {
    return (window.OP_STATUS_LABELS && window.OP_STATUS_LABELS[st]) || st || '-';
  }

  function statusOptions(valor) {
    // Detalhe da Obra usa o MESMO vocabulario dos cards: os 9 status operacionais.
    // Se a obra tiver um status legado (vocabulario antigo aguardando_recebimento/em_execucao...),
    // preserva-o como opcao selecionada para NAO sobrescreve-lo ao salvar.
    valor = String(valor || '').trim();
    var nove = FASES_GESTAO_NEGOCIO;
    var html = '';
    if (valor && nove.indexOf(valor) < 0) {
      html += '<option value="' + esc(valor) + '" selected>' + esc(labelStatus(valor)) + ' (legado)</option>';
    }
    html += nove.map(function (st) {
      return '<option value="' + esc(st) + '"' + (st === valor ? ' selected' : '') + '>' + esc(labelFaseNegocio(st)) + '</option>';
    }).join('');
    return html;
  }

  function faseOptions(valor) {
    return FASES_GESTAO_NEGOCIO.map(function (st) {
      return '<option value="' + esc(st) + '"' + (st === valor ? ' selected' : '') + '>' + esc(labelFaseNegocio(st)) + '</option>';
    }).join('');
  }

  function listaOptions(nome, valor, vazio) {
    var obj = DIARIO_LISTAS[nome] || {};
    var html = vazio ? '<option value="">Selecione...</option>' : '';
    Object.keys(obj).forEach(function (k) {
      html += '<option value="' + esc(k) + '"' + (k === valor ? ' selected' : '') + '>' + esc(obj[k]) + '</option>';
    });
    return html;
  }

  function labelLista(nome, valor) {
    return (DIARIO_LISTAS[nome] && DIARIO_LISTAS[nome][valor]) || valor || '-';
  }

  function optionsObj(obj, valor, vazio) {
    var html = vazio ? '<option value="">Selecione...</option>' : '';
    Object.keys(obj || {}).forEach(function (k) {
      html += '<option value="' + esc(k) + '"' + (k === valor ? ' selected' : '') + '>' + esc(obj[k]) + '</option>';
    });
    return html;
  }

  function labelObj(nome, valor) {
    return (OP_LISTAS_1C[nome] && OP_LISTAS_1C[nome][valor]) || valor || '-';
  }

  function parseEquipeMeta(obs) {
    var meta = { tipo: '', empresa: '', qtd: '', obs: obs || '' };
    var s = String(obs || '');
    if (s.indexOf('[Equipe]') !== 0) return meta;
    meta.obs = '';
    s.split(/\r?\n/).forEach(function (linha) {
      var m = linha.match(/^([^:]+):\s*(.*)$/);
      if (!m) return;
      var k = m[1].trim().toLowerCase();
      var v = m[2].trim();
      if (k === 'tipo') meta.tipo = v;
      else if (k === 'empresa') meta.empresa = v;
      else if (k === 'qtd tecnicos') meta.qtd = v;
      else if (k === 'observacoes') meta.obs = v;
    });
    return meta;
  }

  function serializarEquipeObs(dados) {
    var tipo = dados.tipo_integrante || '';
    var empresa = dados.empresa_integrante || '';
    var qtd = dados.qtd_tecnicos || '';
    var obs = dados.observacoes || '';
    return '[Equipe]\nTipo: ' + tipo + '\nEmpresa: ' + empresa + '\nQtd tecnicos: ' + qtd + '\nObservacoes: ' + obs;
  }

  function hojeISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function getCampo(id) {
    return document.getElementById(id);
  }

  function diarioFiltrados() {
    return (state.diarios || []).filter(function (d) {
      if (state.diarioFiltroData && d.data_diario !== state.diarioFiltroData) return false;
      if (state.diarioFiltroStatus && d.status_dia !== state.diarioFiltroStatus) return false;
      return true;
    });
  }

  function renderDiarioCampo(def, dados) {
    var k = def[0], label = def[1], tipo = def[2];
    var id = 'opDia_' + k;
    var val = dados && dados[k] != null ? dados[k] : '';
    var base = 'padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text);font-family:inherit';
    if (tipo === 'checkbox') {
      return '<label style="display:flex;align-items:center;gap:.45rem;font-size:.78rem;color:var(--text2);padding:.45rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3)">'
        + '<input id="' + id + '" type="checkbox"' + (val ? ' checked' : '') + '> ' + esc(label) + '</label>';
    }
    if (tipo === 'textarea') {
      return campo(label, '<textarea id="' + id + '" class="op-auto-textarea" rows="3" style="' + base + ';resize:none;overflow:hidden;min-height:84px;line-height:1.45">' + esc(val || '') + '</textarea>');
    }
    if (tipo.indexOf('select:') === 0) {
      return campo(label, '<select id="' + id + '" style="' + base + '">' + listaOptions(tipo.split(':')[1], val, true) + '</select>');
    }
    return campo(label, '<input id="' + id + '" type="' + tipo + '" value="' + esc(val || '') + '" style="' + base + '">');
  }

  function diarioFormHtml() {
    if (!state.diarioForm) return '';
    var dados = state.diarioForm;
    return '<div id="opDiarioFormPanel" style="border:1px solid rgba(88,166,255,.38);border-radius:10px;background:rgba(88,166,255,.06);padding:1rem;box-shadow:0 10px 30px rgba(0,0,0,.18)">'
      + '<div id="opDiaMsg" style="display:none;margin-bottom:.75rem;border-radius:7px;padding:.55rem .7rem;font-size:.78rem;font-weight:700"></div>'
      + DIARIO_BLOCOS.map(function (bloco, idx) {
        return diarioBlocoHtml(bloco, idx, dados);
      }).join('')
      + '<div style="height:1rem"></div></div>';
  }

  function diarioBlocoHtml(bloco, idx, dados) {
    var key = 'b' + idx;
    var aberto = state.diarioAccordionOpen === key;
    return '<section id="opDiaBloco_' + esc(key) + '" style="border:1px solid rgba(88,166,255,.24);border-radius:9px;background:rgba(88,166,255,.035);margin-top:.65rem;overflow:hidden">'
      + '<button type="button" data-op-dia-block="' + esc(key) + '" style="width:100%;border:0;border-bottom:' + (aberto ? '1px solid var(--border)' : '0') + ';background:rgba(88,166,255,.055);padding:.78rem .85rem;display:flex;justify-content:space-between;gap:.75rem;align-items:center;text-align:left;cursor:pointer;color:inherit">'
      + '<span style="font-size:.82rem;color:var(--accent);font-weight:900;text-transform:uppercase;line-height:1.25">' + esc(bloco.titulo) + '</span>'
      + '<span style="font-size:1.1rem;color:var(--blue);font-weight:900;line-height:1">' + (aberto ? '-' : '+') + '</span></button>'
      + '<div style="display:' + (aberto ? 'block' : 'none') + ';padding:.85rem">'
      + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:.7rem">'
      + bloco.campos.map(function (def) { return renderDiarioCampo(def, dados); }).join('')
      + '</div></div></section>';
  }

  function diarioOverlayHtml() {
    if (!state.diarioForm) return '';
    return '<div id="opDiarioOverlay" class="op-panel-overlay" style="position:fixed;inset:0;z-index:940;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opDiarioDialog" class="op-panel-shell" style="width:min(1060px,96vw);max-height:92vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden;display:flex;flex-direction:column">'
      + '<div class="op-panel-header" style="position:sticky;top:0;z-index:6;background:var(--bg2);border-bottom:1px solid var(--border);padding:.95rem 1rem;display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start">'
      + '<div><div style="font-size:1.2rem;font-weight:900;color:var(--blue);text-transform:uppercase;letter-spacing:.02em">' + (state.diarioEditId ? 'Editar Diario de Obra' : 'Novo Diario de Obra') + '</div>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.18rem">Ambiente do Diario de Obra. Use Voltar para retornar ao detalhe da obra.</div></div>'
      + '<button type="button" class="btn bg" data-op-dia-action="cancelar" style="min-height:42px">Voltar</button></div>'
      + '<div id="opDiarioBody" class="op-panel-body" style="overflow:auto;flex:1;min-height:0;padding:1rem 1rem calc(9rem + env(safe-area-inset-bottom))">'
      + diarioFormHtml()
      + '</div>'
      + '<div id="opDiarioFooter" class="op-panel-footer" style="flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:.75rem 1rem calc(1.35rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.6rem;box-shadow:0 -10px 28px rgba(0,0,0,.22)">'
      + '<button type="button" class="btn bg" data-op-dia-action="cancelar" style="min-height:44px">Cancelar</button>'
      + '<button type="button" class="btn ba" data-op-dia-action="salvar" style="min-height:44px">Salvar Diario</button>'
      + '</div></div></div>';
  }

  function diarioSectionHtml() {
    if (!accordionAberto('diario')) {
      return '<div id="opDiarioSection">' + sectionBox('Diario de Obra', 'Registro oficial consolidado do dia da obra.', '', 'diario') + '</div>';
    }
    var statusSel = '<option value="">Todos</option>' + listaOptions('status_dia', state.diarioFiltroStatus, false);
    var lista = diarioFiltrados();
    var listaHtml = '';
    if (state.diarioCarregando) {
      listaHtml = '<div style="color:var(--text3);font-size:.8rem;padding:.6rem 0">Carregando diarios...</div>';
    } else if (state.diarioErro) {
      listaHtml = '<div style="color:#ef4444;font-size:.8rem;padding:.6rem 0">' + esc(state.diarioErro) + '</div>';
    } else if (accordionAberto('diario') && !state.diariosLoaded) {
      listaHtml = '<div style="color:var(--text3);font-size:.8rem;padding:.6rem 0">Carregando diarios...</div>';
    } else if (!lista.length) {
      listaHtml = '<div style="color:var(--text3);font-size:.8rem;padding:.6rem 0">Nenhum diario encontrado para esta obra.</div>';
    } else {
      listaHtml = lista.map(function (d) {
        return '<div style="border:1px solid var(--border);border-radius:10px;background:var(--bg3);padding:.85rem .9rem;margin-bottom:.65rem;box-shadow:0 6px 18px rgba(0,0,0,.12)">'
          + '<div style="display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;flex-wrap:wrap">'
          + '<div style="min-width:220px;flex:1"><div style="font-size:.95rem;font-weight:900;color:var(--text);line-height:1.25">' + esc(dataInput(d.data_diario)) + ' - ' + esc(labelLista('turno', d.turno)) + '</div>'
          + '<div style="font-size:.8rem;color:var(--text3);margin-top:.18rem;line-height:1.35">' + esc(labelLista('status_dia', d.status_dia)) + (d.responsavel_dia_nome ? ' | ' + esc(d.responsavel_dia_nome) : '') + '</div></div>'
          + '<div style="display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end">'
          + '<button type="button" class="btn bg bsm" data-op-dia-action="editar" data-id="' + esc(d.id) + '" style="min-height:38px">Abrir/Editar</button>'
          + '<button type="button" class="btn bd bsm" data-op-dia-action="excluir" data-id="' + esc(d.id) + '" style="min-height:38px">Excluir</button></div></div>'
          + '<div style="font-size:.88rem;color:var(--text2);line-height:1.55;margin-top:.7rem;white-space:normal;overflow-wrap:anywhere">'
          + '<div style="margin-bottom:.35rem"><strong style="color:var(--text)">Atividade:</strong> ' + esc(d.atividade_principal || '-') + '</div>'
          + '<div style="margin-bottom:.55rem"><strong style="color:var(--text)">Resumo:</strong> ' + esc(d.resumo_do_dia || '-') + '</div>'
          + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;font-size:.76rem">'
          + '<span class="bdg b-muted">Intercorrencia: ' + (d.houve_intercorrencia ? 'Sim' : 'Nao') + '</span>'
          + '<span class="bdg b-muted">Falta material: ' + (d.houve_falta_material ? 'Sim' : 'Nao') + '</span>'
          + '<span class="bdg ' + (d.servico_liberado ? 'b-ok' : 'b-danger') + '">Servico liberado: ' + (d.servico_liberado ? 'Sim' : 'Nao') + '</span>'
          + '</div></div></div>';
      }).join('');
    }
    return '<div id="opDiarioSection">' + sectionBox('Diario de Obra', 'Registro oficial consolidado do dia da obra.',
      '<div style="display:flex;justify-content:flex-end;margin-bottom:.9rem"><button type="button" class="btn ba" data-op-dia-action="novo" style="min-height:42px;padding:.55rem .9rem">Novo Diario</button></div>'
      + '<div class="op-filter-grid" style="display:grid;grid-template-columns:180px 220px auto;gap:.6rem;align-items:end;margin-bottom:.75rem">'
      + campo('Filtrar por data', '<input id="opDiaFiltroData" type="date" value="' + esc(state.diarioFiltroData || '') + '" onchange="opFiltrarDiarios()" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">')
      + campo('Filtrar por status', '<select id="opDiaFiltroStatus" onchange="opFiltrarDiarios()" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">' + statusSel + '</select>')
      + '<button type="button" class="btn bg" data-op-dia-action="limpar-filtro">Limpar</button></div>'
      + '<div id="opDiarioLista">' + listaHtml + '</div>', 'diario') + '</div>';
  }

  function recebimentoSectionHtml(o) {
    return sectionBox('Recebimento Operacional', 'Conferencia inicial antes do planejamento da execucao.',
      '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem">'
      + campo('Status do recebimento', selectCampo('opRecStatus', OP_LISTAS_1C.recebimento_status, o.recebimento_status || 'nao_iniciado'))
      + campo('Data recebimento', input('opRecData', dataInput(o.data_recebimento_operacional), 'date'))
      + campo('Responsavel recebimento', input('opRecResp', o.responsavel_recebimento_nome))
      + campo('Numero pedido compra', input('opRecPedidoNum', o.numero_pedido_compra))
      + campo('Area / Local', input('opRecArea', o.area_local))
      + campo('Equipamento / Maquina / Linha', input('opRecEquip', o.equipamento_maquina_linha))
      + campo('Endereco de execucao', input('opRecEndereco', o.endereco_execucao))
      + campo('Cidade de execucao', input('opRecCidade', o.cidade_execucao))
      + checkCampo('opRecPedido', 'Pedido de compra recebido?', o.pedido_compra_recebido)
      + checkCampo('opRecEscopo', 'Escopo conferido?', o.escopo_conferido)
      + checkCampo('opRecPrazo', 'Prazo validado?', o.prazo_validado)
      + checkCampo('opRecCondPag', 'Condicao de pagamento conferida?', o.condicao_pagamento_conferida)
      + checkCampo('opRecPropConf', 'Proposta aprovada conferida?', o.proposta_aprovada_conferida)
      + '</div>'
      + '<div style="margin-top:.75rem">' + campo('Observacoes de recebimento', textarea('opRecObs', o.observacoes_recebimento, 90)) + '</div>', 'recebimento');
  }

  function segurancaSectionHtml(o) {
    return sectionBox('Checklist de Planejamento Inicial', 'Requisitos de liberacao antes de mobilizar a equipe.',
      '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.65rem">'
      + checkCampo('opSegInt', 'Integracao obrigatoria?', o.integracao_obrigatoria)
      + checkCampo('opSegDds', 'DDS obrigatorio?', o.dds_obrigatorio)
      + checkCampo('opSegApr', 'APR obrigatoria?', o.apr_obrigatoria_obra)
      + checkCampo('opSegPt', 'PT obrigatoria?', o.pt_obrigatoria_obra)
      + checkCampo('opSegIso', 'Isolamento de area obrigatorio?', o.isolamento_area_obrigatorio)
      + checkCampo('opSegBloq', 'Bloqueio e etiquetagem obrigatorio?', o.bloqueio_etiquetagem_obrigatorio)
      + checkCampo('opSegArt', 'ART obrigatoria?', o.art_obrigatoria)
      + checkCampo('opSegAso', 'ASO obrigatorio?', o.aso_obrigatorio)
      + checkCampo('opSegNr10', 'NR10 obrigatoria?', o.nr10_obrigatoria)
      + checkCampo('opSegNr35', 'NR35 obrigatoria?', o.nr35_obrigatoria)
      + checkCampo('opSegPgr', 'PGR/PCMSO obrigatorio?', o.pgr_pcmso_obrigatorio)
      + '</div>'
      + '<div style="margin-top:.75rem">' + campo('Observacoes de seguranca', textarea('opSegObs', o.observacoes_seguranca_obra, 90)) + '</div>', 'checklist');
  }

  function jornadaSectionHtml(o) {
    return sectionBox('Jornada / Horario Previsto', 'Horario base planejado para a execucao em campo.',
      '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem">'
      + campo('Horario inicio previsto', input('opJorIni', o.horario_inicio_previsto, 'time'))
      + campo('Horario termino previsto', input('opJorFim', o.horario_termino_previsto, 'time'))
      + campo('Intervalo almoco minutos', input('opJorIntervalo', o.intervalo_almoco_previsto_minutos == null ? 60 : o.intervalo_almoco_previsto_minutos, 'number'))
      + campo('Dias de trabalho previstos', input('opJorDias', o.dias_trabalho_previstos))
      + checkCampo('opJorCliente', 'Horario definido pelo cliente?', o.horario_definido_pelo_cliente)
      + checkCampo('opJorExtra', 'Permite hora extra?', o.permite_hora_extra)
      + checkCampo('opJorFimSemana', 'Permite trabalho em fim de semana?', o.permite_trabalho_fim_semana)
      + '</div>'
      + '<div style="margin-top:.75rem">' + campo('Observacoes de horario', textarea('opJorObs', o.observacoes_horario, 90)) + '</div>', 'jornada');
  }

  function alimentacaoMobilizacaoSectionHtml(o) {
    return sectionBox('Mobilizacao e Logistica', 'Alimentacao, deslocamento e preparacao da equipe para a obra.',
      '<div style="font-size:.82rem;color:var(--text);font-weight:900;text-transform:uppercase;margin-bottom:.6rem">Alimentacao</div>'
      + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem;margin-bottom:1rem">'
      + campo('Tipo alimentacao padrao', selectCampo('opAliTipo', OP_LISTAS_1C.tipo_alimentacao_padrao, o.tipo_alimentacao_padrao))
      + campo('Local alimentacao padrao', input('opAliLocal', o.local_alimentacao_padrao))
      + '</div>'
      + campo('Observacoes de alimentacao', textarea('opAliObs', o.observacoes_alimentacao_padrao, 84))
      + '<div style="font-size:.82rem;color:var(--text);font-weight:900;text-transform:uppercase;margin:.9rem 0 .6rem">Mobilizacao</div>'
      + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem">'
      + checkCampo('opMobPrecisa', 'Precisa mobilizacao?', o.precisa_mobilizacao)
      + checkCampo('opMobHotel', 'Precisa hotel?', o.precisa_hotel)
      + campo('Hotel previsto', input('opMobHotelPrev', o.hotel_previsto))
      + checkCampo('opMobVeiculo', 'Precisa veiculo?', o.precisa_veiculo)
      + campo('Veiculo previsto', input('opMobVeiculoPrev', o.veiculo_previsto))
      + checkCampo('opMobComb', 'Precisa combustivel?', o.precisa_combustivel)
      + checkCampo('opMobPedagio', 'Precisa pedagio?', o.precisa_pedagio)
      + checkCampo('opMobEstac', 'Precisa estacionamento?', o.precisa_estacionamento)
      + checkCampo('opMobAdiant', 'Precisa adiantamento?', o.precisa_adiantamento)
      + campo('Valor adiantamento previsto', input('opMobValorAdiant', o.valor_adiantamento_previsto || 0, 'number'))
      + campo('Responsavel mobilizacao', input('opMobResp', o.responsavel_mobilizacao_nome))
      + campo('Ponto encontro equipe', input('opMobPonto', o.ponto_encontro_equipe))
      + campo('Horario encontro equipe', input('opMobHorario', o.horario_encontro_equipe, 'time'))
      + '</div>'
      + '<div style="margin-top:.75rem">' + campo('Observacoes de mobilizacao', textarea('opMobObs', o.observacoes_mobilizacao_obra, 90)) + '</div>', 'mobilizacao_logistica');
  }

  function contingenciaSectionHtml(o) {
    return sectionBox('Contingencia de Materiais', 'Plano para falta de material e compras emergenciais.',
      '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem">'
      + campo('Responsavel compra emergencial', input('opContCompra', o.responsavel_compra_emergencial))
      + campo('Responsavel retirada/busca', input('opContRetirada', o.responsavel_retirada_emergencial))
      + checkCampo('opContAprovacao', 'Precisa aprovacao para compra emergencial?', o.precisa_aprovacao_compra_emergencial !== false)
      + '</div>'
      + '<div style="margin-top:.75rem">' + campo('Plano de contingencia material', textarea('opContPlano', o.plano_contingencia_material, 90)) + '</div>'
      + '<div style="margin-top:.75rem">' + campo('Observacoes de contingencia', textarea('opContObs', o.observacoes_contingencia_material, 90)) + '</div>', 'contingencia');
  }

  function snapshotItens(o) {
    var snap = o && o.snapshot_proposta_json ? o.snapshot_proposta_json : {};
    return Array.isArray(snap.bi) ? snap.bi : [];
  }

  function itemDescricao(it) {
    return it.des || it.desc || it.d || it.descricao || it.nome || it.item || it.tit || '-';
  }

  function itemTipo(it) {
    return String(it.tipo || it.t || it.cat || it.categoria || '').toLowerCase();
  }

  function primeiroValor(it, campos) {
    for (var i = 0; i < campos.length; i++) {
      var v = it[campos[i]];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  }

  function itemQtd(it) {
    return primeiroValor(it, ['qtd', 'qt', 'quantidade', 'q', 'fator', 'horas', 'qtdHrs', 'qtd_hrs', 'qtde', 'quant']);
  }

  function itemUn(it) {
    return primeiroValor(it, ['un', 'unidade', 'und', 'unit', 'unid', 'uni']);
  }

  function itemCustoUnit(it) {
    return primeiroValor(it, ['cu', 'custo_unitario', 'custoUnit', 'custo', 'valor_custo_unitario', 'custo_unit', 'cUnit', 'c_unit', 'vc', 'valor_custo', 'cst']);
  }

  function itemCustoTotal(it) {
    var total = primeiroValor(it, ['ct', 'custo_total', 'custoTotal', 'valor_custo_total', 'custoTotalItem', 'total_custo', 'totalCusto', 'vct']);
    if (total !== '') return total;
    var unit = numeroFlex(itemCustoUnit(it));
    var qtd = numeroFlex(itemQtd(it) || 0);
    return isFinite(unit) && isFinite(qtd) && unit && qtd ? unit * qtd : '';
  }

  function numeroFlex(v) {
    var s = String(v == null ? '' : v).replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return isFinite(n) ? n : 0;
  }

  function moedaTexto(v) {
    if (v === '') return '-';
    var s = String(v).replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = Number(s);
    return isFinite(n) ? money(n) : String(v);
  }

  function itemObs(it) {
    return primeiroValor(it, ['descricao_complementar', 'desc_complementar', 'complemento', 'obs', 'observacoes', 'detalhes', 'det', 'nota']);
  }

  function itemNumero(it, idx) {
    var n = it.num || it.n || it.numero || it.item_num || it.itemNumero || it.seq || it.ordem || (idx + 1);
    return String(n).padStart(3, '0');
  }

  function itemAreaEquip(it, obra) {
    var direto = primeiroValor(it, ['area', 'area_local', 'local', 'equipamento', 'equip', 'equipamento_maquina_linha', 'maq', 'maquina', 'linha']);
    if (direto) return direto;
    if (!obra) return '';
    return [obra.area_local, obra.equipamento_maquina_linha].filter(Boolean).join(' / ');
  }

  function itemInstalacaoPainel(it, obra) {
    return primeiroValor(it, ['instalacao', 'inst', 'painel', 'quadro', 'qd', 'local_instalacao', 'instalacao_painel']) || (obra && (obra.cliente_local || obra.titulo)) || '';
  }

  function itemCategoriaDesc(it) {
    return primeiroValor(it, ['categoria_descricao', 'desc_categoria', 'categoriaDesc', 'descricao_categoria', 'obs_categoria', 'descricao_geral_categoria', 'categoria_geral']);
  }

  function itemCategoriaCodigo(it) {
    return primeiroValor(it, ['cod_categoria', 'codigo_categoria', 'categoria_codigo', 'cat_codigo', 'categoria', 'cat', 'tipo', 't']);
  }

  function itemTipoLabel(it) {
    var tipo = itemTipo(it);
    if (tipo.indexOf('mat') >= 0) return 'Material';
    if (tipo.indexOf('serv') >= 0 || tipo.indexOf('mao') >= 0 || tipo.indexOf('instal') >= 0) return 'Servico';
    return 'Nao informado';
  }

  function itemFator(it) {
    return primeiroValor(it, ['fator', 'fat', 'multiplicador', 'mult', 'horas', 'qtdHrs', 'qtd_hrs']);
  }

  function itemTerceiro(it) {
    return primeiroValor(it, ['terceiro', 'terc', 'fornecedor', 'empresa_terceira', 'terceiro_nome']);
  }

  function itemInclusao(it) {
    if (it.incluido === true || it.inc === true) return 'Incluido';
    if (it.incluido === false || it.inc === false) return 'Excluido';
    return primeiroValor(it, ['inclusao', 'inclusao_exclusao', 'status_inclusao', 'considerado']);
  }

  function chaveComercialItem(k) {
    var s = String(k || '').toLowerCase();
    return s.indexOf('pv') >= 0 || s.indexOf('markup') >= 0 || s.indexOf('lucro') >= 0
      || s.indexOf('margem') >= 0 || s.indexOf('comiss') >= 0 || s.indexOf('aliq') >= 0
      || s.indexOf('preco') >= 0 || s.indexOf('preço') >= 0 || s.indexOf('venda') >= 0
      || s.indexOf('negoci') >= 0 || s === 'mb' || s === 'nf' || s === 'rs'
      || s === 'll' || s.indexOf('ll_') >= 0 || s.indexOf('ll%') >= 0 || s.indexOf('fmf') >= 0;
  }

  function chaveJaExibidaItem(k) {
    var exibidas = {
      id: 1, num: 1, n: 1, numero: 1, item_num: 1, itemnumero: 1, seq: 1, ordem: 1,
      des: 1, desc: 1, d: 1, descricao: 1, nome: 1, item: 1, tit: 1,
      tipo: 1, t: 1, cat: 1, categoria: 1, cod_categoria: 1, codigo_categoria: 1, categoria_codigo: 1, cat_codigo: 1,
      qtd: 1, qt: 1, quantidade: 1, q: 1, fator: 1, horas: 1, qtdhrs: 1, qtd_hrs: 1, qtde: 1, quant: 1,
      un: 1, unidade: 1, und: 1, unit: 1, unid: 1, uni: 1,
      cu: 1, custo_unitario: 1, custounit: 1, custo: 1, valor_custo_unitario: 1, custo_unit: 1, cunit: 1, c_unit: 1, vc: 1, valor_custo: 1, cst: 1,
      ct: 1, custo_total: 1, custototal: 1, valor_custo_total: 1, custototalitem: 1, total_custo: 1, totalcusto: 1, vct: 1, total: 1,
      obs: 1, observacoes: 1, detalhes: 1, det: 1, nota: 1, descricao_complementar: 1, desc_complementar: 1, complemento: 1,
      area: 1, area_local: 1, local: 1, equipamento: 1, equip: 1, equipamento_maquina_linha: 1, maq: 1, maquina: 1, linha: 1,
      instalacao: 1, inst: 1, painel: 1, quadro: 1, qd: 1, local_instalacao: 1, instalacao_painel: 1,
      categoria_descricao: 1, desc_categoria: 1, categoriadesc: 1, descricao_categoria: 1, obs_categoria: 1, descricao_geral_categoria: 1, categoria_geral: 1,
      terceiro: 1, terc: 1, fornecedor: 1, empresa_terceira: 1, terceiro_nome: 1,
      incluido: 1, inc: 1, inclusao: 1, inclusao_exclusao: 1, status_inclusao: 1, considerado: 1
    };
    return !!exibidas[String(k || '').toLowerCase()];
  }

  function detalhesTecnicosItem(it) {
    return Object.keys(it || {}).filter(function (k) {
      var v = it[k];
      return !chaveComercialItem(k) && !chaveJaExibidaItem(k)
        && v !== undefined && v !== null && v !== '' && (typeof v !== 'object');
    }).map(function (k) {
      return '<span style="display:inline-block;border:1px solid var(--border);border-radius:999px;padding:.18rem .45rem;margin:.12rem .18rem .12rem 0;background:var(--bg2)"><strong>' + esc(k) + ':</strong> ' + esc(String(it[k])) + '</span>';
    }).join('');
  }

  function filtrarItensSnapshot(o, tipoAlvo) {
    return snapshotItens(o).filter(function (it) {
      var tipo = itemTipo(it);
      if (tipoAlvo === 'servico') return tipo.indexOf('serv') >= 0 || tipo.indexOf('mao') >= 0 || tipo.indexOf('instal') >= 0;
      return tipo.indexOf('mat') >= 0 || tipo.indexOf('material') >= 0;
    });
  }

  function itensSnapshotHtml(titulo, subtitulo, itens, vazio, extra, obra, key) {
    var html = '';
    if (!itens.length) {
      html = '<div style="color:var(--text3);font-size:.82rem">' + esc(vazio) + '</div>';
    } else {
      html = itens.map(function (it, idx) {
        var desc = itemDescricao(it);
        return '<div style="border:1px solid var(--border);border-radius:9px;background:var(--bg3);padding:.75rem;margin-bottom:.55rem">'
          + '<div style="font-size:.76rem;color:var(--text3);font-weight:900;text-transform:uppercase;margin-bottom:.35rem">Item ' + esc(itemNumero(it, idx)) + '</div>'
          + '<div style="font-size:.92rem;font-weight:800;color:var(--text);line-height:1.45;white-space:normal;overflow-wrap:anywhere">' + esc(desc || 'Sem descricao') + '</div>'
          + '</div>';
      }).join('');
    }
    return sectionBox(titulo, subtitulo, html + (extra || ''), key || (titulo.toLowerCase().indexOf('serv') >= 0 ? 'servicos' : 'materiais'));
  }

  function servicosPropostaHtml(o) {
    if (!accordionAberto('servicos')) {
      return sectionBox('O QUE ESTÁ CONSIDERADO EM PROPOSTA', 'Leitura dos itens de servico identificados no snapshot da proposta.', '', 'servicos');
    }
    return itensSnapshotHtml(
      'O QUE ESTÁ CONSIDERADO EM PROPOSTA',
      'Leitura dos itens de servico identificados no snapshot da proposta.',
      filtrarItensSnapshot(o, 'servico'),
      'Nenhum servico identificado no snapshot da proposta.',
      '',
      o,
      'servicos'
    );
  }

  function materiaisNecessariosHtml(o) {
    if (!accordionAberto('materiais')) {
      return sectionBox('Materiais necessarios', 'Leitura dos itens de material identificados no snapshot da proposta.', '', 'materiais');
    }
    return itensSnapshotHtml(
      'Materiais necessarios',
      'Leitura dos itens de material identificados no snapshot da proposta.',
      filtrarItensSnapshot(o, 'material'),
      'Nenhum material identificado no snapshot da proposta.',
      '<div style="display:flex;justify-content:flex-end;margin-top:.75rem"><button type="button" class="btn bg" disabled title="A tabela obra_materiais sera uma proxima fase">Adicionar material fora da proposta - em breve</button></div>',
      o,
      'materiais'
    );
  }

  function recursoFormHtml() {
    if (!state.recursoForm) return '';
    var r = state.recursoForm;
    return '<div id="opRecursoFormPanel" style="border:1px solid rgba(88,166,255,.35);border-radius:9px;background:rgba(88,166,255,.055);padding:.85rem">'
      + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.65rem">'
      + campo('Categoria', selectCampo('opRecCat', OP_LISTAS_1C.categoria_recurso, r.categoria))
      + campo('Item', input('opRecItem', r.item))
      + checkCampo('opRecObrig', 'Obrigatorio?', r.obrigatorio)
      + campo('Quantidade prevista', input('opRecQtd', r.quantidade_prevista || 1, 'number'))
      + campo('Responsavel', input('opRecRespCampo', r.responsavel))
      + campo('Status', selectCampo('opRecStatusCampo', OP_LISTAS_1C.status_recurso, r.status || 'previsto'))
      + '</div>'
      + '<div style="margin-top:.65rem">' + campo('Observacoes', textarea('opRecObsCampo', r.observacoes, 76)) + '</div>'
      + '<div style="height:1rem"></div></div>';
  }

  function recursoOverlayHtml() {
    if (!state.recursoForm) return '';
    return '<div id="opRecursoOverlay" class="op-panel-overlay" style="position:fixed;inset:0;z-index:945;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opRecursoDialog" class="op-panel-shell" style="width:min(820px,96vw);max-height:92vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden;display:flex;flex-direction:column">'
      + '<div class="op-panel-header" style="position:sticky;top:0;z-index:6;background:var(--bg2);border-bottom:1px solid var(--border);padding:.95rem 1rem;display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start">'
      + '<div><div style="font-size:1.2rem;font-weight:900;color:var(--blue);text-transform:uppercase;letter-spacing:.02em">' + (state.recursoEditId ? 'Editar Recurso de Campo' : 'Novo Recurso de Campo') + '</div>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.18rem">Ambiente de Recursos de Campo. Use Voltar para retornar a obra.</div></div>'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-recurso" style="min-height:42px">Voltar</button></div>'
      + '<div id="opRecursoBody" class="op-panel-body" style="overflow:auto;flex:1;min-height:0;padding:1rem 1rem calc(9rem + env(safe-area-inset-bottom))">'
      + recursoFormHtml()
      + '</div>'
      + '<div id="opRecursoFooter" class="op-panel-footer" style="flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:.75rem 1rem calc(1.35rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.6rem;box-shadow:0 -10px 28px rgba(0,0,0,.22)">'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-recurso" style="min-height:44px">Cancelar</button>'
      + '<button type="button" class="btn ba" data-op-1c-action="salvar-recurso" style="min-height:44px">Salvar Recurso</button>'
      + '</div></div></div>';
  }

  function confirmarExcluirRecursoHtml() {
    if (!state.recursoExcluir) return '';
    return '<div id="opRecursoConfirmOverlay" style="position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opRecursoConfirmDialog" style="width:min(440px,94vw);background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden">'
      + '<div style="padding:1rem;border-bottom:1px solid var(--border)"><div style="font-size:1rem;font-weight:900;color:#ef4444;text-transform:uppercase">Excluir Recurso de Campo</div>'
      + '<div style="font-size:.86rem;color:var(--text2);line-height:1.45;margin-top:.55rem">Deseja realmente excluir este recurso de campo?</div>'
      + '<div style="font-size:.9rem;color:var(--text);font-weight:800;margin-top:.65rem">' + esc(state.recursoExcluir.item || '-') + '</div></div>'
      + '<div style="padding:.85rem 1rem calc(.85rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.55rem;background:var(--bg2)">'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-excluir-recurso" style="min-height:42px">Cancelar</button>'
      + '<button type="button" class="btn bd" data-op-1c-action="confirmar-excluir-recurso" style="min-height:42px">Excluir</button>'
      + '</div></div></div>';
  }

  function recursosPadraoOverlayHtml() {
    if (!state.recursosPadraoPicker) return '';
    var existentes = {};
    (state.recursos || []).forEach(function (r) {
      existentes[(r.categoria || '') + '||' + (r.item || '')] = true;
    });
    var grupos = RECURSOS_PADRAO_UI.map(function (g, gi) {
      return '<div style="border-top:1px solid var(--border);padding-top:.75rem;margin-top:.75rem">'
        + '<div style="font-size:.86rem;color:var(--accent);font-weight:900;text-transform:uppercase;margin-bottom:.55rem">' + esc(g.titulo) + '</div>'
        + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:.45rem">'
        + g.itens.map(function (item, ii) {
          var key = g.categoria + '||' + item;
          var disabled = existentes[key];
          return '<label style="display:flex;gap:.45rem;align-items:flex-start;border:1px solid var(--border);border-radius:7px;background:var(--bg3);padding:.5rem .6rem;font-size:.8rem;color:' + (disabled ? 'var(--text3)' : 'var(--text2)') + '">'
            + '<input type="checkbox" class="op-rec-padrao-check" data-cat="' + esc(g.categoria) + '" data-item="' + esc(item) + '"' + (disabled ? ' disabled' : '') + '>'
            + '<span>' + esc(item) + (disabled ? ' <small style="color:var(--text3)">(ja existe)</small>' : '') + '</span></label>';
        }).join('')
        + '</div></div>';
    }).join('');
    return '<div id="opRecursosPadraoOverlay" class="op-panel-overlay" style="position:fixed;inset:0;z-index:946;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opRecursosPadraoDialog" class="op-panel-shell" style="width:min(980px,96vw);max-height:92vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden;display:flex;flex-direction:column">'
      + '<div class="op-panel-header" style="position:sticky;top:0;z-index:6;background:var(--bg2);border-bottom:1px solid var(--border);padding:.95rem 1rem;display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start">'
      + '<div><div style="font-size:1.2rem;font-weight:900;color:var(--blue);text-transform:uppercase;letter-spacing:.02em">Escolher Recursos Padrao</div>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.18rem">Marque somente os recursos que deseja adicionar nesta obra.</div></div>'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-recursos-padrao" style="min-height:42px">Voltar</button></div>'
      + '<div id="opRecursosPadraoBody" class="op-panel-body" style="overflow:auto;flex:1;min-height:0;padding:1rem 1rem calc(9rem + env(safe-area-inset-bottom))">' + grupos + '</div>'
      + '<div id="opRecursosPadraoFooter" class="op-panel-footer" style="flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:.75rem 1rem calc(1.35rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.6rem;box-shadow:0 -10px 28px rgba(0,0,0,.22)">'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-recursos-padrao" style="min-height:44px">Cancelar</button>'
      + '<button type="button" class="btn ba" data-op-1c-action="adicionar-recursos-padrao" style="min-height:44px">Adicionar selecionados</button>'
      + '</div></div></div>';
  }

  function recursosCampoHtml() {
    if (!accordionAberto('recursos')) {
      return '<div id="opRecursosCampoAnchor">' + sectionBox('Recursos de Campo', 'Ferramentas, EPIs, EPCs e recursos previstos para a obra.', '', 'recursos') + '</div>';
    }
    var lista = state.recursos || [];
    var cards = state.recursosCarregando ? '<div style="color:var(--text3);font-size:.8rem">Carregando recursos...</div>' : '';
    if (!cards && state.recursosErro) cards = '<div style="color:#ef4444;font-size:.8rem">' + esc(state.recursosErro) + '</div>';
    if (!cards && accordionAberto('recursos') && !state.recursosLoaded) cards = '<div style="color:var(--text3);font-size:.8rem">Carregando recursos...</div>';
    if (!cards && !lista.length) cards = '<div style="color:var(--text3);font-size:.8rem">Nenhum recurso cadastrado para esta obra.</div>';
    if (!cards) {
      cards = lista.map(function (r) {
        return '<div style="border:1px solid var(--border);border-radius:9px;background:var(--bg3);padding:.75rem;margin-bottom:.55rem">'
          + '<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap">'
          + '<div><div style="font-size:.9rem;font-weight:900;color:var(--text)">' + esc(r.item) + '</div>'
          + '<div style="font-size:.76rem;color:var(--text3);margin-top:.14rem">' + esc(labelObj('categoria_recurso', r.categoria)) + ' | ' + esc(labelObj('status_recurso', r.status)) + '</div></div>'
          + '<div style="display:flex;gap:.4rem;flex-wrap:wrap"><button type="button" class="btn bg bsm" data-op-1c-action="editar-recurso" data-id="' + esc(r.id) + '">Editar</button>'
          + '<button type="button" class="btn bd bsm" data-op-1c-action="excluir-recurso" data-id="' + esc(r.id) + '">Excluir</button></div></div>'
          + '<div style="font-size:.8rem;color:var(--text2);line-height:1.45;margin-top:.5rem">Qtd: ' + esc(r.quantidade_prevista || 0) + ' | Obrigatorio: ' + (r.obrigatorio ? 'Sim' : 'Nao') + (r.responsavel ? ' | Resp.: ' + esc(r.responsavel) : '') + '</div>'
          + (r.observacoes ? '<div style="font-size:.78rem;color:var(--text3);margin-top:.35rem;white-space:pre-wrap">' + esc(r.observacoes) + '</div>' : '')
          + '</div>';
      }).join('');
    }
    return '<div id="opRecursosCampoAnchor">' + sectionBox('Recursos de Campo', 'Ferramentas, EPIs, EPCs e recursos previstos para a obra.',
      '<div style="display:flex;justify-content:flex-end;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap">'
      + '<button type="button" class="btn bg" data-op-1c-action="escolher-recursos-padrao">Escolher recursos padrao</button>'
      + '<button type="button" class="btn ba" data-op-1c-action="novo-recurso">Novo recurso</button></div>'
      + '<div>' + cards + '</div>', 'recursos') + '</div>';
  }

  function mobilizacaoFormHtml() {
    if (!state.mobilizacaoForm) return '';
    var m = state.mobilizacaoForm;
    return '<div id="opMobilizacaoFormPanel" style="border:1px solid rgba(88,166,255,.35);border-radius:9px;background:rgba(88,166,255,.055);padding:.85rem">'
      + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.65rem">'
      + campo('Nome colaborador', input('opMobEqNome', m.nome_colaborador))
      + campo('Funcao', input('opMobEqFuncao', m.funcao))
      + campo('Tipo', selectCampo('opMobEqTipo', OP_LISTAS_1C.tipo_integrante, m.tipo_integrante))
      + campo('Nome da empresa', input('opMobEqEmpresa', m.empresa_integrante))
      + campo('Qtd. tecnicos', input('opMobEqQtd', m.qtd_tecnicos, 'number'))
      + campo('Forma deslocamento', selectCampo('opMobEqForma', OP_LISTAS_1C.forma_deslocamento, m.forma_deslocamento))
      + campo('Carona com', input('opMobEqCarona', m.carona_com))
      + campo('Ponto encontro', input('opMobEqPonto', m.ponto_encontro))
      + campo('Horario encontro', input('opMobEqHorario', m.horario_encontro, 'time'))
      + checkCampo('opMobEqAdiant', 'Precisa adiantamento?', m.precisa_adiantamento)
      + campo('Valor adiantamento', input('opMobEqValor', m.valor_adiantamento || 0, 'number'))
      + campo('Veiculo utilizado', input('opMobEqVeiculo', m.veiculo_utilizado))
      + campo('Motorista', input('opMobEqMotorista', m.motorista))
      + checkCampo('opMobEqReembolso', 'Precisa reembolso?', m.precisa_reembolso)
      + checkCampo('opMobEqComp', 'Comprovante obrigatorio?', m.comprovante_obrigatorio)
      + '</div>'
      + '<div style="margin-top:.65rem">' + campo('Observacoes', textarea('opMobEqObs', m.observacoes, 76)) + '</div>'
      + '<div style="height:1rem"></div></div>';
  }

  function mobilizacaoOverlayHtml() {
    if (!state.mobilizacaoForm) return '';
    return '<div id="opMobilizacaoOverlay" class="op-panel-overlay" style="position:fixed;inset:0;z-index:944;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opMobilizacaoDialog" class="op-panel-shell" style="width:min(900px,96vw);max-height:92vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden;display:flex;flex-direction:column">'
      + '<div class="op-panel-header" style="position:sticky;top:0;z-index:6;background:var(--bg2);border-bottom:1px solid var(--border);padding:.95rem 1rem;display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start">'
      + '<div><div style="font-size:1.2rem;font-weight:900;color:var(--blue);text-transform:uppercase;letter-spacing:.02em">' + (state.mobilizacaoEditId ? 'Editar Colaborador' : 'Adicionar Colaborador') + '</div>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.18rem">Integrantes e deslocamento da obra, sem alterar o RH.</div></div>'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-mobilizacao" style="min-height:42px">Voltar</button></div>'
      + '<div id="opMobilizacaoBody" class="op-panel-body" style="overflow:auto;flex:1;min-height:0;padding:1rem 1rem calc(9rem + env(safe-area-inset-bottom))">'
      + mobilizacaoFormHtml()
      + '</div>'
      + '<div id="opMobilizacaoFooter" class="op-panel-footer" style="flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:.75rem 1rem calc(1.35rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.6rem;box-shadow:0 -10px 28px rgba(0,0,0,.22)">'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-mobilizacao" style="min-height:44px">Cancelar</button>'
      + '<button type="button" class="btn ba" data-op-1c-action="salvar-mobilizacao" style="min-height:44px">Salvar Colaborador</button>'
      + '</div></div></div>';
  }

  function confirmarExcluirMobilizacaoHtml() {
    if (!state.mobilizacaoExcluir) return '';
    return '<div id="opMobilizacaoConfirmOverlay" style="position:fixed;inset:0;z-index:950;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div style="width:min(440px,94vw);background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden">'
      + '<div style="padding:1rem;border-bottom:1px solid var(--border)"><div style="font-size:1rem;font-weight:900;color:#ef4444;text-transform:uppercase">Excluir Colaborador</div>'
      + '<div style="font-size:.86rem;color:var(--text2);line-height:1.45;margin-top:.55rem">Deseja realmente excluir este colaborador da mobilizacao?</div>'
      + '<div style="font-size:.9rem;color:var(--text);font-weight:800;margin-top:.65rem">' + esc(state.mobilizacaoExcluir.nome || '-') + '</div></div>'
      + '<div style="padding:.85rem 1rem calc(.85rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.55rem;background:var(--bg2)">'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-excluir-mobilizacao" style="min-height:42px">Cancelar</button>'
      + '<button type="button" class="btn bd" data-op-1c-action="confirmar-excluir-mobilizacao" style="min-height:42px">Excluir</button>'
      + '</div></div></div>';
  }

  function mobilizacaoEquipeHtml() {
    if (!accordionAberto('mobilizacao_equipe')) {
      return '<div id="opMobilizacaoEquipeAnchor">' + sectionBox('Como cada colaborador vai ate a obra', 'Cadastro manual, sem alterar o RH.', '', 'mobilizacao_equipe') + '</div>';
    }
    var lista = state.mobilizacaoEquipe || [];
    var cards = state.mobilizacaoCarregando ? '<div style="color:var(--text3);font-size:.8rem">Carregando mobilizacao da equipe...</div>' : '';
    if (!cards && state.mobilizacaoErro) cards = '<div style="color:#ef4444;font-size:.8rem">' + esc(state.mobilizacaoErro) + '</div>';
    if (!cards && accordionAberto('mobilizacao_equipe') && !state.mobilizacaoLoaded) cards = '<div style="color:var(--text3);font-size:.8rem">Carregando mobilizacao da equipe...</div>';
    if (!cards && !lista.length) cards = '<div style="color:var(--text3);font-size:.8rem">Nenhum colaborador cadastrado na mobilizacao desta obra.</div>';
    if (!cards) {
      cards = lista.map(function (m) {
        var meta = parseEquipeMeta(m.observacoes);
        return '<div style="border:1px solid var(--border);border-radius:9px;background:var(--bg3);padding:.75rem;margin-bottom:.55rem">'
          + '<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap">'
          + '<div><div style="font-size:.9rem;font-weight:900;color:var(--text)">' + esc(m.nome_colaborador) + '</div>'
          + '<div style="font-size:.76rem;color:var(--text3);margin-top:.14rem">' + esc(m.funcao || '-') + ' | ' + esc(labelObj('forma_deslocamento', m.forma_deslocamento)) + '</div></div>'
          + '<div style="display:flex;gap:.4rem;flex-wrap:wrap"><button type="button" class="btn bg bsm" data-op-1c-action="editar-mobilizacao" data-id="' + esc(m.id) + '">Editar</button>'
          + '<button type="button" class="btn bd bsm" data-op-1c-action="excluir-mobilizacao" data-id="' + esc(m.id) + '">Excluir</button></div></div>'
          + '<div style="font-size:.8rem;color:var(--text2);line-height:1.45;margin-top:.5rem">Encontro: ' + esc(m.ponto_encontro || '-') + ' ' + esc(m.horario_encontro || '') + (m.precisa_adiantamento ? ' | Adiant.: ' + money(m.valor_adiantamento) : '') + (m.precisa_reembolso ? ' | Reembolso' : '') + '</div>'
          + (meta.obs ? '<div style="font-size:.78rem;color:var(--text3);margin-top:.35rem;white-space:pre-wrap">' + esc(meta.obs) + '</div>' : '')
          + '</div>';
      }).join('');
    }
    return '<div id="opMobilizacaoEquipeAnchor">' + sectionBox('Como cada colaborador vai ate a obra', 'Cadastro manual, sem alterar o RH.',
      '<div style="display:flex;justify-content:flex-end;margin-bottom:.75rem"><button type="button" class="btn ba" data-op-1c-action="nova-mobilizacao">Adicionar colaborador</button></div>'
      + cards, 'mobilizacao_equipe') + '</div>';
  }

  function integrantesEquipeHtml() {
    if (!accordionAberto('integrantes')) {
      return sectionBox('Integrantes da Equipe', 'Quem esta previsto para participar da obra. Cadastro manual, sem integrar com RH.', '', 'integrantes');
    }
    var lista = state.mobilizacaoEquipe || [];
    var cards = state.mobilizacaoCarregando ? '<div style="color:var(--text3);font-size:.8rem">Carregando integrantes...</div>' : '';
    if (!cards && state.mobilizacaoErro) cards = '<div style="color:#ef4444;font-size:.8rem">' + esc(state.mobilizacaoErro) + '</div>';
    if (!cards && accordionAberto('integrantes') && !state.mobilizacaoLoaded) cards = '<div style="color:var(--text3);font-size:.8rem">Carregando integrantes...</div>';
    if (!cards && !lista.length) cards = '<div style="color:var(--text3);font-size:.8rem">Nenhum integrante previsto para esta obra.</div>';
    if (!cards) {
      cards = lista.map(function (m) {
        var meta = parseEquipeMeta(m.observacoes);
        return '<div style="border:1px solid var(--border);border-radius:9px;background:var(--bg3);padding:.75rem;margin-bottom:.55rem">'
          + '<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap">'
          + '<div><div style="font-size:.9rem;font-weight:900;color:var(--text)">' + esc(m.nome_colaborador) + '</div>'
          + '<div style="font-size:.78rem;color:var(--text2);margin-top:.2rem">' + esc(m.funcao || '-') + ' | ' + esc(labelObj('tipo_integrante', meta.tipo) || '-') + '</div></div>'
          + '<button type="button" class="btn bg bsm" data-op-1c-action="editar-mobilizacao" data-id="' + esc(m.id) + '">Editar</button></div>'
          + '<div style="font-size:.78rem;color:var(--text3);line-height:1.45;margin-top:.45rem">Empresa: ' + esc(meta.empresa || '-') + ' | Qtd. tecnicos: ' + esc(meta.qtd || '-') + '</div>'
          + (meta.obs ? '<div style="font-size:.78rem;color:var(--text3);margin-top:.35rem;white-space:pre-wrap">' + esc(meta.obs) + '</div>' : '')
          + '</div>';
      }).join('');
    }
    return sectionBox('Integrantes da Equipe', 'Quem esta previsto para participar da obra. Cadastro manual, sem integrar com RH.',
      '<div style="display:flex;justify-content:flex-end;margin-bottom:.75rem"><button type="button" class="btn ba" data-op-1c-action="nova-mobilizacao">Adicionar integrante</button></div>' + cards, 'integrantes');
  }

  function operacionalPlanejamentoHtml(o) {
    return recebimentoSectionHtml(o)
      + segurancaSectionHtml(o)
      + integrantesEquipeHtml()
      + jornadaSectionHtml(o)
      + servicosPropostaHtml(o)
      + alimentacaoMobilizacaoSectionHtml(o)
      + mobilizacaoEquipeHtml()
      + recursosCampoHtml()
      + materiaisNecessariosHtml(o)
      + contingenciaSectionHtml(o);
  }

  function getEmpresaId() {
    if (typeof window.getEmpresaAtivaId === 'function') return window.getEmpresaAtivaId();
    if (typeof window.getEmpresaAtiva === 'function') {
      var emp = window.getEmpresaAtiva();
      if (emp && emp.id) return emp.id;
    }
    return window._empresaAtiva && window._empresaAtiva.id ? window._empresaAtiva.id : '';
  }

  function textoLimpo(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }

  function valorSnapshot(s, chaves) {
    s = s || {};
    for (var i = 0; i < chaves.length; i++) {
      var v = s[chaves[i]];
      if (v != null && String(v).trim()) return textoLimpo(v);
    }
    return '';
  }

  function faseOperacionalNegocio(fase) {
    return FASES_GESTAO_NEGOCIO.indexOf(String(fase || '').trim().toLowerCase()) >= 0;
  }

  function labelFaseNegocio(fase) {
    try {
      if (typeof FASE !== 'undefined' && FASE[fase]) {
        return textoLimpo(((FASE[fase].i || '') + ' ' + (FASE[fase].n || fase)).trim());
      }
    } catch (e) {}
    return labelStatus(fase);
  }

  function dataCabecalhoNegocio(o) {
    var s = o && o.snapshot_proposta_json ? o.snapshot_proposta_json : {};
    return dataInput(valorSnapshot(s, ['dtFech', 'dat', 'data', 'data_proposta']) || o.data_aprovacao || o.created_at || o.updated_at);
  }

  function normalizarNegocioOperacional(p, obra) {
    p = p || {};
    var s = p.dados_json || {};
    var appId = textoLimpo(p.app_id || p.id);
    var numero = textoLimpo(p.numero_proposta || s.num || appId);
    var titulo = textoLimpo(p.titulo || s.tit || s.titulo || numero);
    var clienteNome = textoLimpo(p.cliente || s.cli || s.loc || '');
    return {
      __gestaoNegocio: true,
      id: appId || textoLimpo(p.id),
      empresa_id: p.empresa_id || '',
      proposta_app_id: appId,
      codigo_obra: numero,
      proposta_numero: numero,
      proposta_revisao: textoLimpo(s.revAtual || s.rev || ''),
      cliente_nome: clienteNome,
      cliente_cnpj: textoLimpo(s.cnpj || s.locCnpj || ''),
      cliente_cidade: textoLimpo(s.cid || s.csvc || ''),
      cliente_local: textoLimpo(s.loc || ''),
      titulo: titulo,
      // Negocio 'ganho' que ja virou obra: status vive em obras.status_operacional.
      // Demais (fases operacionais legadas): status vem de propostas.fase.
      status_operacional: (String(p.fase || '').trim().toLowerCase() === 'ganho' && obra)
        ? textoLimpo(obra.status_operacional || 'aprovado')
        : textoLimpo(p.fase || s.fas || ''),
      obra_id: obra ? (obra.id || '') : '',
      status_source: (String(p.fase || '').trim().toLowerCase() === 'ganho' && obra) ? 'obra' : 'fase',
      valor_vendido: Number(p.valor_total || s.val || 0) || 0,
      data_aprovacao: valorSnapshot(s, ['dtFech', 'dat', 'data', 'data_proposta']),
      // Inicio real da obra (tabela obras) — fonte primaria do "ano de execucao".
      data_inicio_real: obra ? (obra.data_inicio_real || '') : '',
      snapshot_proposta_json: s,
      observacoes: ''
    };
  }

  async function listarNegociosOperacionais(empresaId) {
    if (!window.sbClient) throw new Error('Supabase nao esta conectado.');
    empresaId = empresaId || getEmpresaId();
    if (!empresaId) throw new Error('Empresa ativa nao encontrada.');
    // Inclui tambem as propostas comerciais em 'ganho' (so aparecem no Operacional
    // depois de "Criar Obra"); seu status operacional fica na tabela obras.
    var fasesQuery = FASES_GESTAO_NEGOCIO.concat(['ganho']);
    var res = await window.sbClient
      .from('propostas')
      .select('id, app_id, numero_proposta, titulo, cliente, valor_total, fase, dados_json, created_at, updated_at, empresa_id')
      .eq('empresa_id', empresaId)
      .in('fase', fasesQuery)
      .order('updated_at', { ascending: false });
    if (res.error) throw res.error;
    // Mapa de obras por proposta (para resolver o status dos negocios 'ganho').
    var obrasPorProp = {};
    try {
      if (typeof window.sbListarObras === 'function') {
        var obras = await window.sbListarObras(empresaId);
        (obras || []).forEach(function (ob) {
          if (ob && ob.proposta_app_id) obrasPorProp[String(ob.proposta_app_id)] = ob;
        });
      }
    } catch (e) { /* sem obras: segue (negocios 'ganho' sem obra nao aparecem) */ }
    var out = [];
    (res.data || []).forEach(function (p) {
      if (!p || p.empresa_id !== empresaId) return;
      var fase = String(p.fase || '').trim().toLowerCase();
      var obra = obrasPorProp[String(p.app_id || p.id)] || null;
      // Obra arquivada/desfeita (status 'cancelada') nao conta como obra ativa.
      if (obra && String(obra.status_operacional || '').trim().toLowerCase() === 'cancelada') obra = null;
      if (fase === 'ganho') {
        if (!obra) return; // 'ganho' so entra no Operacional apos Criar Obra
        out.push(normalizarNegocioOperacional(p, obra));
      } else if (faseOperacionalNegocio(fase)) {
        out.push(normalizarNegocioOperacional(p, null));
      }
    });
    return out;
  }

  function resetarContextoNegocio() {
    state.diarioForm = null;
    state.diarioEditId = '';
    state.diarios = [];
    state.diariosLoaded = false;
    state.diarioErro = '';
    state.recursos = [];
    state.recursosLoaded = false;
    state.recursosErro = '';
    state.recursoForm = null;
    state.recursoEditId = '';
    state.recursoExcluir = null;
    state.recursosPadraoPicker = false;
    state.mobilizacaoEquipe = [];
    state.mobilizacaoLoaded = false;
    state.mobilizacaoErro = '';
    state.mobilizacaoForm = null;
    state.mobilizacaoEditId = '';
    state.mobilizacaoExcluir = null;
    state.apontamentosNegocio = [];
    state.apontamentosNegocioLoaded = false;
    state.apontamentosNegocioCarregando = false;
    state.apontamentosNegocioErro = '';
    state.gestaoDocumento = null;
    state.gestaoDocumentoLoaded = false;
    state.gestaoDocumentoCarregando = false;
    state.gestaoDocumentoErro = '';
    state.gestaoAssinaturas = {
      cliente: { dataUrl: '', assinada: false },
      empresa: { dataUrl: '', assinada: false }
    };
    state.accordionOpen = {};
  }

  function propsLista() {
    try {
      if (Array.isArray(window.props)) return window.props;
      if (typeof props !== 'undefined' && Array.isArray(props)) return props;
    } catch (e) {}
    return [];
  }

  function propPorId(id) {
    return propsLista().find(function (p) { return p && String(p.id) === String(id); }) || null;
  }

  function isRetroativo(p) {
    return p && STATUS_RETROATIVOS.indexOf(p.fas) >= 0;
  }

  function isAprovado(p) {
    return p && p.fas === 'aprovado';
  }

  // Status comercial que "ganhou" o negocio e libera a criacao da obra.
  function isGanho(p) {
    return p && p.fas === 'ganho';
  }

  function canTerObra(p) {
    return isGanho(p) || isAprovado(p) || isRetroativo(p);
  }

  function dataInput(v) {
    if (!v) return '';
    return String(v).slice(0, 10);
  }

  function boolChecked(v) {
    return v ? ' checked' : '';
  }

  function shell() {
    return ''
      + operacionalMainStylesHtml()
      + '<div id="opShell" style="max-width:1180px;width:100%;box-sizing:border-box;margin:0 auto;padding:1rem;overflow-x:hidden">'
      + '<div class="op-main-head" style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem;min-width:0">'
      + '<div><h2 style="margin:0;color:var(--text);font-size:1.35rem">Operacional</h2>'
      + '<div style="color:var(--text3);font-size:.82rem;margin-top:.15rem">Negocios em fase operacional com gestao simples por documento.</div></div>'
      + '<button class="btn bg op-main-refresh" onclick="opCarregarObras()">Atualizar</button>'
      + '</div>'
      + '<div class="card op-filter-card" style="margin-bottom:1rem;max-width:100%;box-sizing:border-box;overflow:hidden">'
      + '<div class="op-main-filters" style="display:grid;grid-template-columns:1.2fr .9fr .9fr .8fr auto;gap:.65rem;align-items:end;min-width:0">'
      + '<label class="op-filter-field" style="display:flex;flex-direction:column;gap:.22rem;font-size:.7rem;color:var(--text3);font-weight:700;text-transform:uppercase;min-width:0">Busca'
      + '<input id="opBusca" placeholder="Codigo, proposta, titulo ou cliente" value="' + esc(state.busca) + '" oninput="opFiltros()" style="padding:.5rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)"></label>'
      + '<label class="op-filter-field" style="display:flex;flex-direction:column;gap:.22rem;font-size:.7rem;color:var(--text3);font-weight:700;text-transform:uppercase;min-width:0">Fase'
      + '<select id="opStatus" onchange="opFiltros()" style="padding:.5rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)"><option value="">Todas</option>' + faseOptions(state.status) + '</select></label>'
      + '<label class="op-filter-field" style="display:flex;flex-direction:column;gap:.22rem;font-size:.7rem;color:var(--text3);font-weight:700;text-transform:uppercase;min-width:0">Cliente'
      + '<input id="opCliente" placeholder="Filtrar cliente" value="' + esc(state.cliente) + '" oninput="opFiltros()" style="padding:.5rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)"></label>'
      + '<label class="op-filter-field" style="display:flex;flex-direction:column;gap:.22rem;font-size:.7rem;color:var(--text3);font-weight:700;text-transform:uppercase;min-width:0" title="Ano de execucao da obra (compartilhado com o Comercial)">Ano (execucao)'
      + '<select id="opAno" onchange="opSetAno(this.value)" style="padding:.5rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)"></select></label>'
      + '<button class="btn bg op-filter-clear" onclick="opLimparFiltros()">Limpar</button>'
      + '</div>'
      + '</div>'
      + '<div id="opLista"></div>'
      + '<div id="opDetalhe"></div>'
      + '</div>';
  }

  function loadingObraHtml() {
    return ajusteResponsivoHtml()
      + '<div id="opObraPanel" class="op-panel-overlay" style="position:fixed;inset:0;z-index:880;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opObraDialog" class="op-panel-shell" style="width:min(520px,92vw);background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 20px 70px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column">'
      + '<div class="op-panel-body" style="padding:1.2rem;display:flex;flex-direction:column;gap:.45rem;align-items:flex-start">'
      + '<div style="font-size:1.05rem;color:var(--accent);font-weight:900;text-transform:uppercase">Carregando obra...</div>'
      + '<div style="font-size:.86rem;color:var(--text3);line-height:1.45">Abrindo o detalhe operacional. As seções internas serão carregadas conforme você expandir.</div>'
      + '</div></div></div>';
  }

  function operacionalMainStylesHtml() {
    return '<style id="opMainResponsiveStyles">'
      + '#operacional-root,#opShell{max-width:100%;overflow-x:hidden;box-sizing:border-box;}'
      + '#opShell input,#opShell select,#opShell button{max-width:100%;box-sizing:border-box;}'
      + '#opShell .btn,#opDetalhe .btn{border-radius:7px!important;min-height:40px;padding:.52rem .82rem!important;font-weight:800!important;line-height:1.15!important;border-width:1px!important;box-shadow:none!important;white-space:normal;}'
      + '#opShell .btn.bsm,#opDetalhe .btn.bsm{min-height:36px!important;padding:.4rem .62rem!important;font-size:.78rem!important;}'
      + '#opShell .btn.ba,#opDetalhe .btn.ba{background:#e87500!important;border-color:#e87500!important;color:#111827!important;}'
      + '#opShell .btn.bg,#opDetalhe .btn.bg{background:rgba(148,163,184,.14)!important;border-color:var(--border)!important;color:var(--text)!important;}'
      + '#opObraPanel .btn.bg{background:#d5dce6!important;border-color:var(--border)!important;color:#000!important;font-weight:700!important}'
      + '#opShell .btn.bd,#opDetalhe .btn.bd{background:rgba(239,68,68,.12)!important;border-color:rgba(239,68,68,.42)!important;color:#ef4444!important;}'
      + '#opShell .btn.b-ok,#opDetalhe .btn.b-ok{background:#16a34a!important;border-color:#16a34a!important;color:#fff!important;}'
      + '#opShell .btn.b-info,#opDetalhe .btn.b-info{background:rgba(88,166,255,.16)!important;border-color:rgba(88,166,255,.42)!important;color:var(--blue)!important;}'
      + '.op-obra-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.8rem;max-width:100%;overflow:hidden;}'
      + '.op-obra-card{min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden;}'
      + '.op-obra-card *{overflow-wrap:anywhere;}'
      + '@media(max-width:720px){'
      + '#opShell{padding:.75rem!important;width:100%!important;}'
      + '.op-main-head{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:.75rem!important;}'
      + '.op-main-refresh,.op-filter-clear{width:100%!important;min-height:46px!important;}'
      + '.op-filter-card{padding:.85rem!important;}'
      + '.op-main-filters{grid-template-columns:1fr!important;width:100%!important;gap:.7rem!important;}'
      + '.op-filter-field input,.op-filter-field select{width:100%!important;min-width:0!important;}'
      + '.op-obra-grid{grid-template-columns:minmax(0,1fr)!important;gap:.75rem!important;}'
      + '.op-obra-card{width:100%!important;margin:0!important;}'
      + '.op-obra-card .btn{width:auto!important;align-self:flex-end!important;min-height:42px!important;padding:.52rem .9rem!important;}'
      + '}'
      + '</style>';
  }

  // Ano de EXECUCAO do negocio (regra do dono), cascata de fallback:
  //   data_inicio_real (obra) -> execDatasOp(p).ini -> data_aprovacao (dtFech/dat).
  // Resolvido em tempo de filtro (execDatasOp re-le o mapa atual). Retorna null
  // se nao houver NENHUMA data — nesse caso o item nunca some (aparece em qualquer ano).
  function _refDataExecucao(o) {
    if (!o) return '';
    var ex = (typeof execDatasOp === 'function')
      ? execDatasOp({ id: o.proposta_app_id, app_id: o.proposta_app_id })
      : { ini: '' };
    return o.data_inicio_real || (ex && ex.ini) || o.data_aprovacao || '';
  }
  function _anoExecucaoNegocio(o) {
    var ref = _refDataExecucao(o);
    if (!ref) return null;
    var d = new Date(String(ref).length === 10 ? ref + 'T12:00:00' : ref);
    return isNaN(d.getTime()) ? null : d.getFullYear();
  }

  function obrasFiltradas() {
    var busca = (state.busca || '').toLowerCase();
    var cliente = (state.cliente || '').toLowerCase();
    // Filtro de ano GLOBAL (compartilhado com o Comercial via _anoComercialSel).
    var anoSel = (typeof window !== 'undefined') ? window._anoComercialSel : 'all';
    var anoNum = (anoSel && anoSel !== 'all') ? (parseInt(anoSel, 10) || null) : null;
    return (state.obras || []).filter(function (o) {
      if (state.status && o.status_operacional !== state.status) return false;
      if (cliente && String(o.cliente_nome || '').toLowerCase().indexOf(cliente) < 0) return false;
      if (busca) {
        var hay = [o.codigo_obra, o.proposta_numero, o.titulo, o.cliente_nome].join(' ').toLowerCase();
        if (hay.indexOf(busca) < 0) return false;
      }
      // Ano de execucao: filtra so quando um ano especifico esta selecionado.
      // Itens sem nenhuma data (ano null) nunca somem (aparecem em qualquer ano).
      if (anoNum) {
        var ay = _anoExecucaoNegocio(o);
        if (ay != null && ay !== anoNum) return false;
      }
      return true;
    });
  }

  // Popula o seletor de ano do Operacional a partir das obras carregadas + ano atual.
  // Le o ano selecionado de _anoComercialSel (compartilhado com o Comercial).
  function _populaOpAnos() {
    var sel = $('opAno');
    if (!sel) return;
    var anos = {};
    (state.obras || []).forEach(function (o) {
      var a = _anoExecucaoNegocio(o);
      if (a) anos[a] = 1;
    });
    anos[new Date().getFullYear()] = 1;
    var lista = Object.keys(anos).map(Number).sort(function (a, b) { return b - a; });
    var atual = String((typeof window !== 'undefined' && window._anoComercialSel) || new Date().getFullYear());
    var html = lista.map(function (a) {
      return '<option value="' + a + '"' + (atual === String(a) ? ' selected' : '') + '>' + a + '</option>';
    }).join('');
    html += '<option value="all"' + (atual === 'all' ? ' selected' : '') + '>Todos os anos</option>';
    sel.innerHTML = html;
  }

  // Troca o ano: escreve no estado GLOBAL (_anoComercialSel, via setAnoComercial,
  // mantendo o Comercial em sincronia) e re-filtra a lista do Operacional.
  function opSetAno(v) {
    if (typeof window.setAnoComercial === 'function') {
      window.setAnoComercial(v);
    } else {
      window._anoComercialSel = (v === 'all') ? 'all' : (parseInt(v, 10) || new Date().getFullYear());
    }
    renderLista();
  }

  function renderLista() {
    var el = $('opLista');
    if (!el) return;
    _populaOpAnos(); // mantem o seletor de ano sincronizado com _anoComercialSel
    if (state.carregando) {
      el.innerHTML = '<div class="card" style="color:var(--text3)">Carregando negocios operacionais da empresa selecionada...</div>';
      return;
    }
    if (state.erro) {
      el.innerHTML = '<div class="card" style="border-color:rgba(239,68,68,.35);color:#ef4444">' + esc(state.erro) + '</div>';
      return;
    }
    var list = obrasFiltradas();
    if (!list.length) {
      el.innerHTML = '<div class="card" style="color:var(--text3)">Nenhum negocio em fase operacional encontrado para a empresa ativa.</div>';
      return;
    }
    el.innerHTML = '<div class="op-obra-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.8rem">'
      + list.map(function (o) {
        return '<div class="card op-obra-card" style="margin:0;display:flex;flex-direction:column;gap:.55rem;min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden">'
          + '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:flex-start;min-width:0;flex-wrap:wrap">'
          + '<div style="min-width:0;flex:1"><div style="font-size:.78rem;color:var(--text3);font-weight:700">' + esc(o.codigo_obra || 'Obra sem codigo') + '</div>'
          + '<div style="font-size:1rem;color:var(--text);font-weight:800;margin-top:.1rem">' + esc(o.titulo || o.proposta_numero || '-') + '</div></div>'
          + '<select class="op-card-status" title="Alterar status operacional" onclick="event.stopPropagation()" onchange="opMudarStatusNegocio(\'' + esc(o.id) + '\',this.value);event.stopPropagation()" style="max-width:170px;font-size:.72rem;font-weight:800;border:1px solid var(--border);border-radius:999px;background:var(--bg3);color:var(--text);padding:.24rem .55rem;cursor:pointer;flex-shrink:0">' + faseOptions(o.status_operacional) + '</select></div>'
          + '<div style="font-size:.82rem;color:var(--text2);line-height:1.45">'
          + '<strong>' + esc(o.cliente_nome || '-') + '</strong><br>'
          + 'Proposta: ' + esc(o.proposta_numero || '-') + (o.proposta_revisao ? ' Rev. ' + esc(o.proposta_revisao) : '') + '<br>'
          + 'Valor vendido: <strong style="color:var(--green)">' + money(o.valor_vendido) + '</strong><br>'
          + 'Documento de gestao com diario, horas, aceite e assinaturas.'
          + '</div>'
          + '<div style="display:flex;justify-content:flex-end;gap:.4rem;margin-top:auto;min-width:0;flex-wrap:wrap">'
          + (o.proposta_app_id ? '<button class="btn bs" onclick="fmAbrirProposta(\'' + esc(o.proposta_app_id) + '\');event.stopPropagation()">📄 Ir para Proposta</button>' : '')
          + '<button class="btn ba" onclick="opAbrirObra(\'' + esc(o.id) + '\')">Abrir Gestao</button>'
          + ((ehDono())
              ? '<button class="btn bg" title="Somente DONO: devolve a proposta ao Comercial" onclick="opDesfazerObra(\'' + esc(o.id) + '\');event.stopPropagation()" style="border:1px solid #ef4444!important;color:#ef4444!important;background:transparent!important">↩ Voltar para Comercial</button>'
              : '')
          + '</div>'
          + '</div>';
      }).join('')
      + '</div>';
  }

  // Edicao inline do status operacional direto no card.
  // Persiste apenas a coluna `fase` da proposta (mesma coluna ja usada pelo
  // sistema) — sem migration, sem RLS e sem alterar outras informacoes.
  async function mudarStatusNegocio(id, novoStatus) {
    novoStatus = String(novoStatus || '').trim();
    if (FASES_GESTAO_NEGOCIO.indexOf(novoStatus) < 0) return;
    var o = (state.obras || []).find(function (x) { return x.id === id; });
    if (!o) return;
    var anterior = o.status_operacional;
    if (anterior === novoStatus) return;
    if (!window.sbClient) { msg('Supabase nao esta conectado.', 'err'); return; }
    var empresaId = o.empresa_id || getEmpresaId();
    var appId = o.proposta_app_id || o.id;
    // Atualizacao otimista: reflete imediatamente no card e nos filtros.
    o.status_operacional = novoStatus;
    renderLista();
    try {
      if (o.status_source === 'obra' && o.obra_id) {
        // Negocio 'ganho' ja virou obra: status vive em obras.status_operacional.
        // A proposta permanece 'ganho' no Comercial (nao alteramos propostas.fase).
        if (typeof window.sbAtualizarObra !== 'function') throw new Error('Atualizacao de obra indisponivel.');
        await window.sbAtualizarObra(o.obra_id, { status_operacional: novoStatus });
      } else {
        // Reespelha o status na COLUNA fase E no dados_json.fas no MESMO update,
        // evitando desync entre coluna e JSON (Comercial le dados_json).
        var pc = Array.isArray(window.props)
          ? window.props.find(function (x) { return x && (x.id === appId || x.app_id === appId); })
          : null;
        var payload = { fase: novoStatus, updated_at: new Date().toISOString() };
        if (pc) {
          pc.fas = novoStatus;                          // cache em memoria
          payload.dados_json = Object.assign({}, pc);   // espelha fas no JSON
        }
        var res = await window.sbClient
          .from('propostas')
          .update(payload)
          .eq('app_id', appId)
          .eq('empresa_id', empresaId)
          .select('app_id, fase')
          .single();
        if (res.error) throw res.error;
        // Fallback: proposta nao estava no cache — atualiza dados_json buscando do banco.
        if (!pc) {
          var cur = await window.sbClient
            .from('propostas')
            .select('dados_json')
            .eq('app_id', appId)
            .eq('empresa_id', empresaId)
            .single();
          if (!cur.error && cur.data && cur.data.dados_json) {
            var dj = cur.data.dados_json; dj.fas = novoStatus;
            await window.sbClient
              .from('propostas')
              .update({ dados_json: dj })
              .eq('app_id', appId)
              .eq('empresa_id', empresaId);
          }
        }
        // Persiste o estado otimista no localStorage (sobrevive ate o proximo load).
        try { localStorage.setItem('tf_props', JSON.stringify(window.props)); } catch (e) {}
      }
      msg('Status operacional atualizado para "' + textoLimpo(labelFaseNegocio(novoStatus)) + '".');
    } catch (e) {
      o.status_operacional = anterior; // reverte em caso de falha
      renderLista();
      msg((e && e.message) || 'Nao foi possivel atualizar o status.', 'err');
    }
  }

  // ── Desfazer criacao de obra (somente DONO) ──────────────────────────────
  function ehDono() {
    var perfil = typeof window.getPerfilUsuario === 'function' ? window.getPerfilUsuario() : '';
    return String(perfil || '').toLowerCase() === 'dono';
  }

  function fecharDesfazerObra() {
    var ov = document.getElementById('opDesfazerOverlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
  }

  function abrirDesfazerObra(id) {
    if (!ehDono()) { msg('Apenas o perfil DONO pode voltar a proposta para o Comercial.', 'err'); return; }
    var o = (state.obras || []).find(function (x) { return x.id === id; });
    if (!o) { msg('Negocio nao encontrado.', 'err'); return; }
    fecharDesfazerObra();
    var temObra = (o.status_source === 'obra' && o.obra_id);
    var aviso = temObra
      ? 'Devolve a proposta <strong style="color:var(--text)">' + esc(o.proposta_numero || o.titulo || '-') + '</strong> ao Comercial e arquiva a obra (status "Cancelada"). A obra NAO e apagada.'
      : 'Devolve a proposta <strong style="color:var(--text)">' + esc(o.proposta_numero || o.titulo || '-') + '</strong> ao Comercial. Este card nao possui obra vinculada, entao apenas a fase da proposta sera alterada.';
    var opts = FASES_RETORNO_COMERCIAL.map(function (k) {
      return '<option value="' + esc(k) + '"' + (k === 'ganho' ? ' selected' : '') + '>' + esc(labelFaseNegocio(k)) + '</option>';
    }).join('');
    var ov = document.createElement('div');
    ov.id = 'opDesfazerOverlay';
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:960;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:1rem');
    ov.innerHTML = '<div style="width:min(460px,94vw);background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden">'
      + '<div style="padding:1rem;border-bottom:1px solid var(--border)">'
      + '<div style="font-size:1rem;font-weight:900;color:#ef4444;text-transform:uppercase">Voltar para Comercial</div>'
      + '<div style="font-size:.86rem;color:var(--text2);line-height:1.45;margin-top:.55rem">' + aviso + '</div>'
      + '<label style="display:block;font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;margin-top:.85rem;margin-bottom:.3rem">Fase comercial de retorno</label>'
      + '<select id="opDesfazerFaseSelect" style="width:100%;padding:.5rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">' + opts + '</select>'
      + '</div>'
      + '<div style="padding:.85rem 1rem calc(.85rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.55rem;background:var(--bg2)">'
      + '<button type="button" class="btn bg" onclick="opFecharDesfazerObra()" style="min-height:42px">Cancelar</button>'
      + '<button type="button" class="btn bd" onclick="opConfirmarDesfazerObra(\'' + esc(id) + '\')" style="min-height:42px">Confirmar</button>'
      + '</div></div>';
    document.body.appendChild(ov);
  }

  async function confirmarDesfazerObra(id) {
    if (!ehDono()) { msg('Apenas o perfil DONO pode voltar a proposta para o Comercial.', 'err'); return; }
    var o = (state.obras || []).find(function (x) { return x.id === id; });
    if (!o) { msg('Negocio nao encontrado.', 'err'); return; }
    var temObra = (o.status_source === 'obra' && o.obra_id);
    var sel = document.getElementById('opDesfazerFaseSelect');
    var fase = sel ? String(sel.value || '').trim() : '';
    if (FASES_RETORNO_COMERCIAL.indexOf(fase) < 0) { msg('Selecione uma fase comercial valida.', 'err'); return; }
    if (!window.sbClient) { msg('Supabase nao esta conectado.', 'err'); return; }
    var empresaId = o.empresa_id || getEmpresaId();
    var appId = o.proposta_app_id || o.id;
    try {
      // 1) Proposta volta ao Comercial na fase escolhida — reespelha fas na COLUNA
      //    e no dados_json no MESMO update (evita desync coluna<->JSON).
      var pc = Array.isArray(window.props)
        ? window.props.find(function (x) { return x && (x.id === appId || x.app_id === appId); })
        : null;
      var payload = { fase: fase, updated_at: new Date().toISOString() };
      if (pc) {
        pc.fas = fase;                                // cache em memoria
        payload.dados_json = Object.assign({}, pc);   // espelha fas no JSON
      }
      var res = await window.sbClient
        .from('propostas')
        .update(payload)
        .eq('app_id', appId)
        .eq('empresa_id', empresaId)
        .select('app_id, fase')
        .single();
      if (res.error) throw res.error;
      // Fallback: proposta nao estava no cache — atualiza dados_json buscando do banco.
      if (!pc) {
        var cur = await window.sbClient
          .from('propostas')
          .select('dados_json')
          .eq('app_id', appId)
          .eq('empresa_id', empresaId)
          .single();
        if (!cur.error && cur.data && cur.data.dados_json) {
          var dj = cur.data.dados_json; dj.fas = fase;
          await window.sbClient
            .from('propostas')
            .update({ dados_json: dj })
            .eq('app_id', appId)
            .eq('empresa_id', empresaId);
        }
      }
      // 2) Card COM obra: arquiva a obra (status 'cancelada') — NAO apaga fisicamente.
      //    Card legado SEM obra: nada a fazer na tabela obras.
      if (temObra && typeof window.sbAtualizarObra === 'function') {
        await window.sbAtualizarObra(o.obra_id, { status_operacional: 'cancelada' });
      }
      // 3) Persiste o estado otimista no localStorage.
      try { localStorage.setItem('tf_props', JSON.stringify(window.props)); } catch (e) {}
      fecharDesfazerObra();
      msg('Proposta devolvida ao Comercial como "' + textoLimpo(labelFaseNegocio(fase)) + '".' + (temObra ? ' Obra arquivada.' : ''));
      await carregarObras();
    } catch (e) {
      msg((e && e.message) || 'Nao foi possivel desfazer a obra.', 'err');
    }
  }

  function snapshotResumo(o) {
    var s = o && o.snapshot_proposta_json ? o.snapshot_proposta_json : {};
    return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;font-size:.78rem;color:var(--text2)">'
      + '<div><strong>Escopos</strong><br>' + (Array.isArray(s.esc) ? s.esc.length : 0) + '</div>'
      + '<div><strong>Itens BI</strong><br>' + (Array.isArray(s.bi) ? s.bi.length : 0) + '</div>'
      + '<div><strong>Stages</strong><br>' + (Array.isArray(s.stages) ? s.stages.length : 0) + '</div>'
      + '<div><strong>Status origem</strong><br>' + esc(s.fas || '-') + '</div>'
      + '</div>';
  }

  function campo(label, html) {
    return '<label style="display:flex;flex-direction:column;gap:.22rem;font-size:.68rem;color:var(--text3);font-weight:700;text-transform:uppercase">' + label + html + '</label>';
  }

  function input(id, val, type) {
    return '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">';
  }

  function inputReadonly(id, val) {
    return '<input id="' + id + '" type="text" value="' + esc(val || '') + '" readonly style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:rgba(148,163,184,.12);color:var(--text3);cursor:not-allowed">';
  }

  function textarea(id, val, minHeight) {
    return '<textarea id="' + id + '" class="op-auto-textarea" rows="3" style="padding:.55rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text);resize:none;overflow:hidden;min-height:' + (minHeight || 84) + 'px;line-height:1.45">' + esc(val || '') + '</textarea>';
  }

  function selectCampo(id, lista, val) {
    return '<select id="' + id + '" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">' + optionsObj(lista, val, true) + '</select>';
  }

  function checkCampo(id, label, val) {
    return '<label style="display:flex;align-items:center;gap:.45rem;font-size:.78rem;color:var(--text2);padding:.45rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3)">'
      + '<input id="' + id + '" type="checkbox"' + boolChecked(val) + '> ' + esc(label) + '</label>';
  }

  function accordionAberto(key) {
    if (Object.prototype.hasOwnProperty.call(state.accordionOpen, key)) return !!state.accordionOpen[key];
    return false;
  }

  function abrirAccordion(key) {
    state.accordionOpen = {};
    if (key) state.accordionOpen[key] = true;
  }

  function toggleAccordion(key) {
    if (!key) return;
    var estavaAberto = accordionAberto(key);
    var body = $('opObraBody');
    var sec = $('opSec_' + key);
    var offset = body && sec ? (sec.offsetTop - body.scrollTop) : null;
    state.accordionOpen = {};
    if (!estavaAberto) state.accordionOpen[key] = true;
    renderDetalhe();
    if (!estavaAberto) carregarSecaoOperacional(key);
    if (offset != null) {
      setTimeout(function () {
        var novoBody = $('opObraBody');
        var novaSec = $('opSec_' + key);
        if (novoBody && novaSec) novoBody.scrollTop = Math.max(0, novaSec.offsetTop - offset);
      }, 0);
    }
  }

  function carregarSecaoOperacional(key) {
    if (key === 'diario' && !state.diariosLoaded && !state.diarioCarregando) {
      carregarDiariosObra();
    } else if (key === 'recursos' && !state.recursosLoaded && !state.recursosCarregando) {
      carregarRecursosObra();
    } else if ((key === 'mobilizacao_equipe' || key === 'integrantes') && !state.mobilizacaoLoaded && !state.mobilizacaoCarregando) {
      carregarMobilizacaoObra();
    }
  }

  function sectionBox(titulo, subtitulo, html, key) {
    key = key || titulo.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    var aberto = accordionAberto(key);
    return '<section id="opSec_' + esc(key) + '" style="border:1px solid rgba(88,166,255,.24);border-radius:10px;background:rgba(88,166,255,.035);margin-bottom:1rem;overflow:hidden">'
      + '<button type="button" data-op-accordion="' + esc(key) + '" style="width:100%;border:0;border-bottom:' + (aberto ? '1px solid var(--border)' : '0') + ';background:rgba(88,166,255,.045);padding:.9rem 1rem;display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;text-align:left;cursor:pointer;color:inherit">'
      + '<span><span style="display:block;font-size:1rem;color:var(--accent);font-weight:900;text-transform:uppercase;letter-spacing:.02em">' + esc(titulo) + '</span>'
      + (subtitulo ? '<span style="display:block;font-size:.8rem;color:var(--text3);margin-top:.16rem;font-weight:500">' + esc(subtitulo) + '</span>' : '')
      + '</span><span style="font-size:1.15rem;color:var(--blue);font-weight:900;line-height:1">' + (aberto ? '-' : '+') + '</span></button>'
      + '<div style="display:' + (aberto ? 'block' : 'none') + ';padding:1rem">' + html + '</div></section>';
  }

  function ajusteResponsivoHtml() {
    return '<style id="opResponsiveStyles">'
      + '.op-panel-overlay{box-sizing:border-box;}'
      + '.op-panel-shell{display:flex!important;flex-direction:column!important;min-height:0;}'
      + '.op-panel-header{flex:0 0 auto!important;background:var(--bg2);}'
      + '.op-panel-body{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain;}'
      + '.op-panel-footer{flex:0 0 auto!important;background:var(--bg2)!important;border-top:1px solid var(--border)!important;box-shadow:0 -12px 30px rgba(0,0,0,.2);z-index:8;}'
      + '.op-panel-footer .btn{min-height:46px;}'
      + '@media(max-width:720px){'
      + '.op-panel-overlay{inset:0!important;padding:0!important;align-items:stretch!important;justify-content:stretch!important;}'
      + '.op-panel-shell{width:100%!important;height:100vh!important;height:100dvh!important;max-height:100vh!important;max-height:100dvh!important;border-radius:0!important;border:none!important;}'
      + '.op-panel-header{position:relative!important;top:auto!important;padding:.85rem!important;}'
      + '.op-panel-body{padding:.85rem .85rem calc(13rem + env(safe-area-inset-bottom))!important;}'
      + '.op-panel-footer{position:relative!important;padding:.85rem .85rem calc(2.35rem + env(safe-area-inset-bottom))!important;justify-content:stretch!important;gap:.55rem!important;}'
      + '.op-panel-footer .btn{flex:1!important;min-height:52px!important;font-size:.9rem!important;padding:.7rem .55rem!important;}'
      + '#opRecursoConfirmOverlay{inset:0!important;padding:.85rem!important;}'
      + '#opMobilizacaoConfirmOverlay{inset:0!important;padding:.85rem!important;}'
      + '.op-form-grid,.op-filter-grid{grid-template-columns:1fr!important;}'
      + '#opObraDialog .btn{min-height:42px!important;font-size:.86rem!important;}'
      + '#opDiarioFormPanel{padding:.85rem!important;margin-left:-.15rem!important;margin-right:-.15rem!important;}'
      + '#opDiarioLista .bdg{font-size:.72rem!important;}'
      + '}'
      + '</style>';
  }

  function ajustarTextareas(root) {
    (root || document).querySelectorAll('textarea.op-auto-textarea').forEach(function (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.max(84, ta.scrollHeight + 2) + 'px';
    });
  }

  function focarPainelObra() {
    setTimeout(function () {
      var panel = $('opObraBody') || $('opObraDialog');
      if (panel) panel.scrollTop = 0;
      ajustarTextareas($('opObraDialog') || document);
    }, 40);
  }

  function focarDiarioForm() {
    abrirAccordion('diario');
    setTimeout(function () {
      var form = $('opDiarioFormPanel');
      var body = $('opDiarioBody') || $('opObraBody');
      if (body) body.scrollTop = 0;
      ajustarTextareas(form || document);
    }, 60);
  }

  function toggleDiarioBloco(key) {
    if (!state.diarioForm) return;
    try {
      state.diarioForm = Object.assign({}, state.diarioForm, coletarDiarioForm());
    } catch (e) {}
    var estavaAberto = state.diarioAccordionOpen === key;
    var body = $('opDiarioBody');
    var sec = $('opDiaBloco_' + key);
    var offset = body && sec ? (sec.offsetTop - body.scrollTop) : null;
    state.diarioAccordionOpen = estavaAberto ? '' : key;
    renderDetalhe();
    if (offset != null) {
      setTimeout(function () {
        var novoBody = $('opDiarioBody');
        var novoSec = $('opDiaBloco_' + key);
        if (novoBody && novoSec) novoBody.scrollTop = Math.max(0, novoSec.offsetTop - offset);
        ajustarTextareas(novoSec || document);
      }, 0);
    }
  }

  function focarRecursosCampo() {
    abrirAccordion('recursos');
    setTimeout(function () {
      var anchor = $('opRecursosCampoAnchor');
      var body = $('opObraBody');
      if (anchor && body) {
        body.scrollTop = Math.max(0, anchor.offsetTop - 12);
      }
      ajustarTextareas(anchor || document);
    }, 70);
  }

  function focarRecursoForm() {
    abrirAccordion('recursos');
    setTimeout(function () {
      var body = $('opRecursoBody') || $('opObraBody');
      if (body) body.scrollTop = 0;
      ajustarTextareas($('opRecursoFormPanel') || document);
    }, 60);
  }

  function focarMobilizacaoEquipe() {
    abrirAccordion('mobilizacao_equipe');
    setTimeout(function () {
      var anchor = $('opMobilizacaoEquipeAnchor');
      var body = $('opObraBody');
      if (anchor && body) body.scrollTop = Math.max(0, anchor.offsetTop - 12);
      ajustarTextareas(anchor || document);
    }, 70);
  }

  function focarMobilizacaoForm() {
    abrirAccordion('mobilizacao_equipe');
    setTimeout(function () {
      var body = $('opMobilizacaoBody') || $('opObraBody');
      if (body) body.scrollTop = 0;
      ajustarTextareas($('opMobilizacaoFormPanel') || document);
    }, 60);
  }

  function cabecalhoCampo(label, valor) {
    return '<div style="border:1px solid rgba(15,23,42,.12);border-radius:7px;background:#f8fafc;padding:.55rem .65rem;min-width:0">'
      + '<div style="font-size:.62rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.18rem">' + esc(label) + '</div>'
      + '<div style="font-size:.82rem;color:#0f172a;font-weight:700;line-height:1.35;overflow-wrap:anywhere">' + esc(valor || '-') + '</div></div>';
  }

  function cabecalhoCampoTabela(label, valor) {
    return '<tr style="border-bottom:1px solid #e2e8f0">'
      + '<td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:35%;border-right:1px solid #e2e8f0">' + esc(label) + '</td>'
      + '<td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;line-height:1.35;overflow-wrap:anywhere">' + esc(valor || '-') + '</td>'
      + '</tr>';
  }

  function totaisApontamentosNegocio() {
    var out = { pendente: 0, aprovado: 0, geral: 0 };
    (state.apontamentosNegocio || []).forEach(function (a) {
      var h = Number(a.horas_total || 0) || 0;
      if (a.status === 'pendente') out.pendente += h;
      if (a.status === 'aprovado') out.aprovado += h;
      if (a.status !== 'cancelado') out.geral += h;
    });
    return out;
  }

  function renderApontamentosNegocioHtml() {
    if (state.apontamentosNegocioCarregando) {
      return '<div style="border:1px solid #dbeafe;background:#eff6ff;border-radius:8px;padding:.75rem;color:#1d4ed8;font-size:.85rem;font-weight:700">Carregando apontamentos de horas...</div>';
    }
    if (state.apontamentosNegocioErro) {
      return '<div style="border:1px solid #fecaca;background:#fef2f2;border-radius:8px;padding:.75rem;color:#991b1b;font-size:.85rem;font-weight:700">' + esc(state.apontamentosNegocioErro) + '</div>';
    }
    var lista = state.apontamentosNegocio || [];
    var totais = totaisApontamentosNegocio();
    if (!lista.length) {
      return '<div style="border:1px dashed #cbd5e1;background:#f8fafc;border-radius:8px;padding:.85rem;color:#64748b;font-size:.85rem">Nenhum apontamento encontrado para este negocio.</div>'
        + renderTotaisApontamentosHtml(totais);
    }
    return '<div class="op-apont-lista" style="display:flex;flex-direction:column;gap:.6rem">'
      + lista.map(function (a) {
        var nome = a.colaboradores && a.colaboradores.nome ? a.colaboradores.nome : (a.criado_por_nome || '-');
        function par(rotulo, valor) {
          return '<span style="display:inline-flex;gap:.3rem;align-items:baseline;min-width:0">'
            + '<strong style="font-size:.64rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap">' + rotulo + ':</strong>'
            + '<span style="font-size:.84rem;color:#0f172a;word-break:break-word">' + valor + '</span></span>';
        }
        return '<div class="op-apont-card" style="border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:.7rem .85rem">'
          + '<div style="display:flex;flex-wrap:wrap;gap:.35rem 1.4rem;margin-bottom:.5rem">'
          + par('Data', esc(dataInput(a.data) || '-'))
          + par('Nome', '<strong style="font-weight:700">' + esc(nome) + '</strong>')
          + par('Tipo', esc(a.tipo_colaborador || a.tipo_dia || '-'))
          + par('Horas', '<strong style="font-weight:800">' + Number(a.horas_total || 0).toFixed(1) + 'h</strong>')
          + par('Status', esc(a.status || '-'))
          + '</div>'
          + '<div style="border-top:1px solid #edf2f7;padding-top:.45rem">'
          + '<div style="font-size:.64rem;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.15rem">Descrição</div>'
          + '<div style="font-size:.86rem;color:#0f172a;line-height:1.5;white-space:pre-wrap;word-break:break-word">' + esc(a.descricao || '-') + '</div>'
          + '</div>'
          + '</div>';
      }).join('')
      + '</div>'
      + renderTotaisApontamentosHtml(totais);
  }

  function renderTotaisApontamentosHtml(t) {
    return '<div class="op-report-hours-totals" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.55rem;margin-top:.75rem">'
      + cabecalhoCampo('Total geral', Number(t.geral || 0).toFixed(1) + 'h')
      + '</div>';
  }

  function renderEscopoGestaoHtml(snapshot) {
    snapshot = snapshot || {};
    var escopos = snapshot.esc || [];
    var msgVazio = '<div style="color:#6b7280;font-size:.88rem;font-style:italic">Informacoes de escopo e exclusoes nao localizadas na proposta.</div>';
    if (!Array.isArray(escopos) || escopos.length === 0) {
      return msgVazio;
    }
    // Na Gestao, exibir SOMENTE secoes de Escopo e Exclusoes (Informacoes da Proposta).
    function soEscopoOuExclusao(titulo) {
      var t = String(titulo || '').toLowerCase();
      return t.indexOf('escopo') >= 0 || t.indexOf('exclus') >= 0;
    }
    var html = '<div style="display:flex;flex-direction:column;gap:1rem">';
    var qtd = 0;
    escopos.forEach(function(sec, idx) {
      if (!sec) return;
      var titulo = sec.titulo || 'Seção ' + (idx + 1);
      // Mostra apenas Escopo e Exclusoes; demais secoes da proposta sao omitidas aqui.
      if (!soEscopoOuExclusao(titulo)) return;
      qtd++;
      var desc = sec.desc || '';
      var subs = sec.subs || [];
      var sectionId = 'escopo-titulo-' + idx;
      html += '<div style="border:1px solid #e2e8f0;border-radius:6px;padding:.75rem" data-section-break="' + sectionId + '">'
        + '<div style="font-weight:700;color:#0f172a;margin-bottom:.5rem;display:flex;align-items:center;gap:.4rem"><span class="op-section-break-btn no-print" onclick="opToggleSectionBreak(\'' + sectionId + '\')" title="Forçar quebra de página" style="margin-right:.3rem">⌗</span>' + esc(titulo) + '</div>'
        + '<div style="color:#475569;font-size:.87rem;line-height:1.5;margin-bottom:.5rem;white-space:pre-wrap">' + esc(desc) + '</div>';
      if (subs.length > 0) {
        html += '<ul style="margin:.5rem 0 0;padding-left:1.5rem;color:#475569;font-size:.87rem">';
        subs.forEach(function(sub) {
          if (!sub) return;
          var nome = sub.nome || sub.titulo || '';
          var subDesc = sub.desc || '';
          html += '<li style="margin-bottom:.3rem"><strong>' + esc(nome) + '</strong>';
          if (subDesc) html += ': ' + esc(subDesc);
          html += '</li>';
        });
        html += '</ul>';
      }
      html += '</div>';
    });
    html += '</div>';
    if (qtd === 0) return msgVazio;
    return html;
  }

  function gestaoDocumentoBloqueado() {
    var doc = state.gestaoDocumento || {};
    return !!doc.bloqueado || doc.status_documento === 'assinado';
  }

  function assinaturaBoxHtml(titulo, nomeId, assinaturaKey) {
    var canvasId = 'opAssCanvas_' + assinaturaKey;
    var doc = state.gestaoDocumento || {};
    var bloqueado = gestaoDocumentoBloqueado();
    var nomeSalvo = assinaturaKey === 'cliente' ? doc.responsavel_cliente_nome : doc.responsavel_empresa_nome;
    var dataSalva = assinaturaKey === 'cliente' ? doc.assinado_cliente_em : doc.assinado_empresa_em;
    var dataFormatada = dataSalva ? new Date(dataSalva).toLocaleString('pt-BR') : '';
    return '<div class="op-signature-card" style="border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:.85rem;min-width:0">'
      + '<div style="font-size:.78rem;color:#0f172a;font-weight:900;text-transform:uppercase;margin-bottom:.55rem">' + esc(titulo) + '</div>'
      + '<label style="display:flex;flex-direction:column;gap:.25rem;font-size:.68rem;color:#64748b;font-weight:800;text-transform:uppercase">Nome'
      + '<input id="' + nomeId + '" type="text" placeholder="Nome do responsavel" value="' + esc(nomeSalvo || '') + '"' + (bloqueado ? ' disabled' : '') + ' style="border:1px solid #cbd5e1;border-radius:6px;padding:.55rem .65rem;color:#0f172a;background:#fff"></label>'
      + (dataFormatada ? '<div style="font-size:.65rem;color:#64748b;font-weight:700;text-transform:uppercase;margin-top:.35rem">Assinado em: ' + esc(dataFormatada) + '</div>' : '')
      + '<div class="op-signature-pad" style="margin-top:.75rem;border:1px dashed #94a3b8;border-radius:8px;background:#fff;height:110px;position:relative;overflow:hidden;color:#64748b;font-size:.82rem;font-weight:800">'
      + '<canvas id="' + canvasId + '" class="op-signature-canvas" data-assinatura-key="' + esc(assinaturaKey) + '" data-bloqueado="' + (bloqueado ? '1' : '0') + '" aria-label="Assinatura ' + esc(titulo) + '" style="width:100%;height:100%;display:block;touch-action:none;cursor:' + (bloqueado ? 'default' : 'crosshair') + ';background:#fff"></canvas>'
      + '<div class="op-signature-hint no-print" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;color:#94a3b8;font-size:.8rem;font-weight:800">Assine aqui</div>'
      + '</div>'
      + '<div class="no-print" style="display:' + (bloqueado ? 'none' : 'flex') + ';justify-content:flex-end;margin-top:.55rem">'
      + '<button type="button" class="btn bg" onclick="opGestaoLimparAssinatura(\'' + esc(assinaturaKey) + '\')" style="min-height:34px;padding:.38rem .7rem;font-size:.78rem">Limpar assinatura</button>'
      + '</div>'
      + '</div>';
  }

  function acoesGestaoHtml(bloqueado, extraClasse) {
    var cls = 'op-doc-actions no-print' + (extraClasse ? ' ' + extraClasse : '');
    var html = '<div class="' + cls + '">';
    var perfil = typeof window.getPerfilUsuario === 'function' ? window.getPerfilUsuario() : '';
    var ehAdminDono = ['dono', 'admin'].includes(perfil);
    if (bloqueado) {
      html += '<span class="op-doc-action-status">Relatorio assinado e bloqueado</span>';
    } else {
      html += '<button type="button" class="btn bg op-primary-action" onclick="opGestaoSalvarRascunho()">Salvar Rascunho</button>'
        + '<button type="button" class="btn bs op-primary-action" onclick="opGestaoFinalizar()">Finalizar e Assinar Relatorio</button>';
    }
    html += '<button type="button" class="btn bg" onclick="opGestaoPdf()">Exportar PDF</button>'
      + '<button type="button" class="btn bg" onclick="opGestaoTexto()">Exportar Texto</button>'
      + '<button type="button" class="btn ba" onclick="opGestaoImprimir()">Imprimir</button>'
      + '</div>';
    return html;
  }

  function renderGestaoNegocio(el, o) {
    var s = o.snapshot_proposta_json || {};
    var titulo = textoLimpo(o.titulo || s.tit || 'Negocio operacional');
    var numero = textoLimpo(o.proposta_numero || s.num || o.proposta_app_id || '-');
    var cidade = textoLimpo(s.csvc || s.cid || o.cliente_cidade || '');
    var dataProp = dataCabecalhoNegocio(o);
    var areaLocal = valorSnapshot(s, ['area_local', 'area', 'local_area']) || '';
    var equipLocal = valorSnapshot(s, ['equip', 'equipamento', 'equipamento_maquina_linha']) || '';
    var contato = valorSnapshot(s, ['ac', 'contato', 'nome_contato_1']);
    var doc = state.gestaoDocumento || {};
    var bloqueado = gestaoDocumentoBloqueado();
    var statusDoc = bloqueado ? 'Relatorio assinado e bloqueado para edicao.' : 'Rascunho editavel. Salve antes de finalizar.';
    var diarioTexto = doc.diario_texto || '';
    var documentoErro = state.gestaoDocumentoErro ? '<div class="no-print" style="border:1px solid #fecaca;background:#fef2f2;color:#991b1b;border-radius:8px;padding:.7rem .85rem;font-size:.84rem;font-weight:800;margin:0 0 1rem">' + esc(state.gestaoDocumentoErro) + '</div>' : '';
    var documentoCarregando = state.gestaoDocumentoCarregando ? '<div class="no-print" style="border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:.7rem .85rem;font-size:.84rem;font-weight:800;margin:0 0 1rem">Carregando documento salvo...</div>' : '';
    el.innerHTML = ajusteResponsivoHtml()
      + '<style id="opGestaoStyles">'
      + ':root{--bg:#0d1117;--bg2:#161b22;--bg3:#21262d;--border:#30363d;--border2:#484f58;--text:#e6edf3;--text2:#8b949e;--text3:#6e7681;--accent:#f0a500;--green:#3fb950;--blue:#58a6ff;--red:#f85149;--r:8px;--r2:6px}'
      + 'body.light{--bg:#f5f7fb;--bg2:#ffffff;--bg3:#eef2f7;--border:#d5dce6;--border2:#bfc9d7;--text:#111827;--text2:#4b5563;--text3:#6b7280;--accent:#d97706;--green:#15803d;--blue:#2563eb;--red:#dc2626}'
      + '.btn{display:inline-flex;align-items:center;gap:.3rem;padding:.42rem .85rem;border:none;border-radius:var(--r2);font-weight:600;font-size:.78rem;cursor:pointer;transition:all .15s;white-space:nowrap;font-family:inherit}'
      + '.btn:active{transform:translateY(1px)}'
      + '.bs{background:var(--green);color:#000}.bs:hover{background:#56d364}'
      + '.ba{background:var(--accent);color:#000}.ba:hover{background:#f8c840}'
      + '.bg{background:#555!important;color:#000!important;border:1px solid var(--border)!important;font-weight:700!important}.bg:hover{border-color:var(--border2)!important;background:#666!important;color:#000!important}'
      + '.op-doc-shell{background:#f1f5f9!important;color:#0f172a!important;}'
      + '.op-doc-card{background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 10px 28px rgba(15,23,42,.12);}'
      + '.op-doc-section-title{font-size:.82rem;color:#0f172a;font-weight:900;text-transform:uppercase;letter-spacing:.05em;margin:0 0 .65rem;}'
      + '.op-doc-actions{display:flex;gap:.55rem;justify-content:flex-end;flex-wrap:wrap;margin-top:1rem}'
      + '.op-doc-actions .btn{border-radius:7px!important;min-height:42px;}'
      + '.op-doc-actions-top{position:sticky;top:74px;z-index:4;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.65rem;margin:0 0 1rem;box-shadow:0 8px 22px rgba(15,23,42,.08)}'
      + '.op-doc-actions-bottom{border-top:1px solid #e2e8f0;padding-top:1rem;margin-top:1.75rem}'
      + '.op-primary-action{font-weight:900!important;}'
      + '.op-doc-action-status{margin-right:auto;align-self:center;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:999px;padding:.48rem .75rem;font-size:.82rem;font-weight:900}'
      + '.op-report-notice{border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;border-radius:8px;padding:.7rem .85rem;font-size:.84rem;font-weight:800;margin:0 0 1rem;}'
      + '.op-signature-canvas{touch-action:none;user-select:none;-webkit-user-select:none;}'
      + '#opGestaoPrintRoot{display:none;}'
      + '@media(max-width:720px){'
      + '.op-doc-paper{width:100%!important;max-width:100%!important;margin:0 0 1rem!important;padding:.9rem!important}'
      + '.op-doc-actions{display:grid!important;grid-template-columns:1fr!important;justify-content:stretch!important}'
      + '.op-doc-actions .btn{width:100%;min-height:48px!important;font-size:.95rem!important}'
      + '.op-doc-actions-top{display:none!important}'
      + '.op-doc-actions-bottom{margin-top:1.25rem}'
      + '.op-doc-action-status{margin-right:0;text-align:center}'
      + '.op-doc-title{font-size:1.2rem!important}'
      + '.op-ciclo-grid{grid-template-columns:1fr!important}'
      + '.op-doc-paper table{table-layout:fixed;width:100%!important}'
      + '.op-doc-paper table td,.op-doc-paper table th{white-space:normal!important;word-break:break-word;padding:.4rem .5rem!important;font-size:.72rem!important;width:auto!important}'
      + '.op-report-hours-section table{table-layout:auto}'
      + '}'
      + '@page{size:A4;margin:15mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font-size:9pt;color:#64748b;font-family:inherit;}}'
      + '@media print{html,body{background:#fff!important;margin:0!important;padding:0!important;overflow:visible!important;}'
      + 'body.op-gestao-printing > *:not(#opGestaoPrintRoot){display:none!important;}'
      + '#opGestaoPrintRoot{display:block!important;background:#fff!important;color:#0f172a!important;width:100%!important;min-height:auto!important;overflow:visible!important;}'
      + '#opGestaoPrintRoot .op-print-paper{display:block!important;max-width:none!important;width:100%!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important;border-radius:0!important;background:#fff!important;}'
      + '#opGestaoPrintRoot .no-print,#opGestaoPrintRoot .op-doc-actions,#opGestaoPrintRoot .op-report-control,#opGestaoPrintRoot .op-report-notice{display:none!important;visibility:hidden!important;}'
      + '#opGestaoPrintRoot[data-report-mode="cliente"] .op-report-hours-section{display:none!important;visibility:hidden!important;}'
      + '#opObraPanel .no-print,#opObraPanel .op-doc-actions,#opObraPanel .op-report-control,#opObraPanel .op-report-notice{display:none!important;visibility:hidden!important;}'
      + '#opObraPanel[data-report-mode="cliente"] .op-report-hours-section{display:none!important;visibility:hidden!important;}'
      + '.op-report-hours-section table{width:100%!important;min-width:0!important;font-size:10pt!important;}'
      + '.op-report-hours-section th,.op-report-hours-section td{padding:.4rem .5rem!important;}'
      + 'h3.op-doc-section-title{margin:1rem 0 .5rem!important;font-size:.9rem!important;}'
      + '#opGestaoDiario{min-height:auto!important;height:auto!important;border:1px solid #94a3b8!important;border-radius:0!important;resize:none!important;overflow:visible!important;background:#fff!important;font-size:11pt!important;line-height:1.6!important;padding:.5rem!important;}'
      + '.op-doc-print-section{margin:1rem 0!important;}'
      + '.op-report-hours-section{margin:1rem 0!important;}'
      + '.op-signatures-section{margin-top:15mm!important;}'
      + '.op-signature-card{border-color:#94a3b8!important;padding:.75rem!important;}'
      + '.op-signature-pad{height:27mm!important;background:#fff!important;border-color:#64748b!important;}'
      + '.op-signature-canvas{width:100%!important;height:100%!important;background:#fff!important;}'
      + '}'
      + '#opSplitWrapper{display:flex;flex:1;min-height:0;overflow:hidden;width:100%;}'
      + '#opObraBody{transition:flex .2s;flex:1;width:100%;}'
      + '#opGestaoPreviewPane{display:none!important;flex-direction:column;width:50%;min-width:0;overflow-y:auto;background:#e2e8f0;border-left:2px solid #cbd5e1;}'
      + '#opGestaoPreviewContent{background:#fff;width:210mm;min-height:297mm;padding:15mm;margin:0 auto 20px;box-shadow:0 6px 24px rgba(15,23,42,.18);position:relative;box-sizing:border-box;font-size:11pt;line-height:1.6;color:#0f172a;}'
      + '#opGestaoPreviewContent input[type="text"],#opGestaoPreviewContent input[type="date"],#opGestaoPreviewContent textarea{border:none;background:none;padding:0;font-family:inherit;font-size:inherit;}'
      + '#opGestaoPreviewContent .no-print{display:none!important;}'
      + '#opGestaoPreviewContent h1,#opGestaoPreviewContent h2,#opGestaoPreviewContent h3{margin-top:.5rem;margin-bottom:.35rem;}'
      + '#opGestaoPreviewContent p{margin:0 0 .5rem 0;}'
      + '#opGestaoPreviewContent ul,#opGestaoPreviewContent ol{margin:.25rem 0;padding-left:1.2rem;}'
      + '#opGestaoPreviewContent li{margin:.1rem 0;}'
      + '.op-preview-page-break{position:absolute;left:-15mm;right:-15mm;border-top:2px dashed #94a3b8;pointer-events:auto;z-index:10;cursor:grab;user-select:none;padding:4px 0;margin:-4px 0;transition:border-color .2s;}'
      + '.op-preview-page-break:hover{border-top-color:#64748b;}'
      + '.op-preview-page-break.dragging{border-top-color:#2563eb;cursor:grabbing;}'
      + '.op-preview-page-label{position:absolute;right:0;top:-18px;font-size:.6rem;color:#94a3b8;font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:#fff;padding:2px 6px;border-radius:3px 3px 0 0;pointer-events:none;}'
      + '.op-section-break-btn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-right:.5rem;border:1px solid #e2e8f0;border-radius:4px;background:#f8fafc;color:#94a3b8;cursor:pointer;font-size:.9rem;transition:all .2s;user-select:none;vertical-align:middle}'
      + '.op-section-break-btn:hover{background:#e2e8f0;border-color:#cbd5e1;color:#64748b}'
      + '.op-section-break-btn.active{background:#dbeafe;border-color:#bfdbfe;color:#1d4ed8}'
      + '[data-section-break].op-has-page-break{page-break-before:always!important;border-top:3px solid #3b82f6!important;padding-top:.75rem!important;margin-top:.5rem!important;}'
      + '[data-section-break].op-has-page-break .op-doc-section-title{display:flex;align-items:center;gap:.5rem;}'
      + '@media print{[data-section-break].op-has-page-break{border-top:none!important;padding-top:0!important;margin-top:0!important;}}'
      + '</style>'
      + '<div id="opObraPanel" class="op-panel-overlay op-doc-shell" data-report-mode="cliente" style="position:fixed;inset:0;z-index:880;display:flex;align-items:stretch;justify-content:center;padding:0;overflow:auto">'
      + '<div id="opObraDialog" class="op-panel-shell" style="width:100%;min-height:100vh;display:flex;flex-direction:column;background:#f1f5f9">'
      + '<div class="op-panel-header no-print" style="position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #e2e8f0;padding:.85rem 1rem;display:flex;justify-content:space-between;align-items:center;gap:1rem">'
      + '<div><div style="font-size:.72rem;color:#64748b;font-weight:900;text-transform:uppercase;letter-spacing:.08em">Operacional</div>'
      + '<div style="font-size:1.05rem;color:#0f172a;font-weight:900;line-height:1.25">Gestao do Negocio</div></div>'
      + '<div style="display:flex;gap:.5rem">'
      + '<button type="button" id="opBtnPreview" class="btn bg" onclick="opTogglePreviewGestao()" style="min-height:40px;background:#dbeafe!important;color:#1d4ed8!important;border-color:#bfdbfe!important;display:none">⊞ Preview</button>'
      + '<button type="button" class="btn bg" onclick="opFecharDetalhe()" style="min-height:40px;background:#f8fafc!important;color:#0f172a!important;border-color:#cbd5e1!important">Fechar</button>'
      + '</div></div>'
      + '<div id="opSplitWrapper">'
      + '<div id="opObraBody" class="op-panel-body" style="flex:1;overflow-y:auto;padding:1rem">'
      + '<article class="op-doc-paper" style="width:210mm;margin:0 auto 1rem;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 18px 50px rgba(15,23,42,.14);padding:15mm;box-sizing:border-box">'
      + '<div class="op-report-notice no-print">Relatorio para cliente: horas ocultas por padrao.</div>'
      + documentoCarregando
      + documentoErro
      + '<div class="op-doc-lock-notice no-print" style="border:1px solid ' + (bloqueado ? '#fde68a' : '#bfdbfe') + ';background:' + (bloqueado ? '#fffbeb' : '#eff6ff') + ';color:' + (bloqueado ? '#92400e' : '#1d4ed8') + ';border-radius:8px;padding:.7rem .85rem;font-size:.84rem;font-weight:900;margin:0 0 1rem">' + esc(statusDoc) + '</div>'
      + (window._empresaAtiva && window._empresaAtiva.logo_url ? '<section class="op-doc-print-section" style="text-align:center;margin-bottom:1rem"><img src="' + esc(window._empresaAtiva.logo_url) + '" style="max-height:70px;max-width:100%;width:auto;object-fit:contain" alt="Logo da Empresa"></section>' : '')
      + '<section class="op-doc-print-section" style="border-bottom:2px solid #0f172a;padding-bottom:1rem;margin-bottom:1rem">'
      + '<table style="width:100%;border-collapse:collapse;font-size:.85rem">'
      + '<tr style="border-bottom:1px solid #e2e8f0"><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Nome do Cliente</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['cli']) || o.cliente_nome || '-') + '</td><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">CNPJ Cliente</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['cnpj']) || o.cliente_cnpj || '-') + '</td></tr>'
      + '<tr style="border-bottom:1px solid #e2e8f0"><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Cidade do Cliente</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['cid']) || o.cliente_cidade || '-') + '</td><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Nome Contato 1</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(contato || '-') + '</td></tr>'
      + '<tr style="border-bottom:1px solid #e2e8f0"><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Depto. Contato 1</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['dep']) || '-') + '</td><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">E-mail Contato 1</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['mail']) || '-') + '</td></tr>'
      + '<tr style="border-bottom:1px solid #e2e8f0"><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Tel/Cel Contato 1</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['tel']) || '-') + '</td><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Cliente do Servico</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['loc']) || o.cliente_local || o.cliente_nome || '-') + '</td></tr>'
      + '<tr style="border-bottom:1px solid #e2e8f0"><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">CNPJ do Local</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['locCnpj']) || o.cliente_cnpj || '-') + '</td><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Cidade do Servico</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(valorSnapshot(s, ['csvc']) || o.cliente_cidade || '-') + '</td></tr>'
      + '<tr style="border-bottom:1px solid #e2e8f0"><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Area/Local</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(areaLocal || '-') + '</td><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Status operacional</td><td style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem;width:30%">' + esc(labelFaseNegocio(o.status_operacional) || '-') + '</td></tr>'
      + '<tr style="border-bottom:1px solid #e2e8f0"><td style="font-size:.72rem;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.04em;padding:.55rem .75rem;background:#f8fafc;white-space:nowrap;width:20%;border-right:1px solid #e2e8f0">Equipamento / Maquina / Linha</td><td colspan="3" style="font-size:.82rem;color:#0f172a;font-weight:600;padding:.55rem .75rem">' + esc(equipLocal || '-') + '</td></tr>'
      + '</table></section>'
      + '<section class="op-doc-print-section" style="text-align:center;margin:1.2rem 0 1rem">'
      + '<h1 class="op-doc-title" style="margin:.3rem 0 .18rem;font-size:1.25rem;line-height:1.12;color:#0f172a;text-transform:uppercase">' + esc(titulo) + '</h1>'
      + '<div style="font-size:.92rem;color:#475569;font-weight:800">N&ordm; ' + esc(numero) + (cidade ? ' | ' + esc(cidade) : '') + (dataProp ? ', ' + esc(dataProp) : '') + '</div>'
      + '</section>'
      + '<section class="op-doc-print-section" style="text-align:center;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:1rem 0;margin:1rem 0">'
      + '<h2 style="margin:0;color:#0f172a;font-size:1.15rem;letter-spacing:.06em;text-transform:uppercase">Gestao de Negocios</h2>'
      + '<div style="font-size:.75rem;color:#475569;font-weight:900;margin-top:.25rem;text-transform:uppercase">Diario de Bordo / Entregas / Aceite</div></section>'
      + '<section class="op-doc-print-section" data-section-break="diario-bordo" style="margin:1rem 0"><h3 class="op-doc-section-title"><span class="op-section-break-btn no-print" onclick="opToggleSectionBreak(\'diario-bordo\')" title="Forçar quebra de página">⌗</span>Diario de Bordo / Entregas / Aceite</h3>'
      + '<textarea id="opGestaoDiario" placeholder="Escreva aqui o diario de bordo, entregas, pendencias e aceite."' + (bloqueado ? ' disabled' : '') + ' style="width:100%;box-sizing:border-box;min-height:430px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a;padding:.85rem;font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.45;resize:vertical">' + esc(diarioTexto) + '</textarea>'
      + '</section>'
      + '<section class="op-doc-print-section" data-section-break="ciclo-execucao" style="margin:1.1rem 0"><h3 class="op-doc-section-title"><span class="op-section-break-btn no-print" onclick="opToggleSectionBreak(\'ciclo-execucao\')" title="Forçar quebra de página">⌗</span>🟢 Ciclo de Execução</h3>'
      + '<div class="op-ciclo-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:.85rem">'
      + '<div class="f"><label>Data de Início de Execução</label><input type="date" id="opGestaoExecInicio"' + (bloqueado ? ' disabled' : '') + ' style="width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font-size:.88rem"></div>'
      + '<div class="f"><label>Data de Término do Trabalho</label><input type="date" id="opGestaoExecTermino"' + (bloqueado ? ' disabled' : '') + ' style="width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font-size:.88rem"></div>'
      + '<div class="f"><label>Data de Aceite / Entrega ao Cliente</label><input type="date" id="opGestaoExecAceite" disabled style="width:100%;padding:.5rem;border:1px solid #cbd5e1;border-radius:6px;background:#f8fafc;color:#6b7280;font-size:.88rem;cursor:not-allowed" title="Preenchida automaticamente ao assinar"></div>'
      + '</div></section>'
      + '<section class="op-report-hours-section op-doc-print-section" data-section-break="apontamentos-horas" style="margin:1.1rem 0"><h3 class="op-doc-section-title"><span class="op-section-break-btn no-print" onclick="opToggleSectionBreak(\'apontamentos-horas\')" title="Forçar quebra de página">⌗</span>Apontamentos de Horas</h3>'
      + renderApontamentosNegocioHtml()
      + '</section>'
      + '<section class="op-report-control no-print" style="margin:1.1rem 0;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:.85rem">'
      + '<h3 class="op-doc-section-title">Configurações de Impressão</h3>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1rem;color:#0f172a;font-size:.88rem">'
      + '<div style="display:flex;flex-direction:column;gap:.4rem">'
      + '<label style="font-weight:700">Tamanho da Página</label>'
      + '<select id="opPrintSize" style="padding:.4rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff" onchange="opGestaoAtualizarPrintConfig()">'
      + '<option value="a4">A4</option>'
      + '<option value="letter">Carta</option>'
      + '</select></div>'
      + '<div style="display:flex;flex-direction:column;gap:.4rem">'
      + '<label style="font-weight:700">Orientação</label>'
      + '<div style="display:flex;gap:.5rem">'
      + '<label style="display:flex;align-items:center;gap:.3rem"><input type="radio" name="opPrintOrientation" value="portrait" checked onchange="opGestaoAtualizarPrintConfig()"> Retrato</label>'
      + '<label style="display:flex;align-items:center;gap:.3rem"><input type="radio" name="opPrintOrientation" value="landscape" onchange="opGestaoAtualizarPrintConfig()"> Paisagem</label>'
      + '</div></div>'
      + '<div style="display:flex;flex-direction:column;gap:.4rem">'
      + '<label style="font-weight:700">Escala</label>'
      + '<select id="opPrintScale" style="padding:.4rem;border:1px solid #cbd5e1;border-radius:6px;background:#fff" onchange="opGestaoAtualizarPrintConfig()">'
      + '<option value="100">100%</option>'
      + '<option value="95">95%</option>'
      + '<option value="90">90%</option>'
      + '<option value="85">85%</option>'
      + '<option value="80">80%</option>'
      + '</select></div>'
      + '<div style="display:flex;flex-direction:column;gap:.4rem">'
      + '<label style="font-weight:700">Margens</label>'
      + '<div style="display:flex;gap:.5rem">'
      + '<label style="display:flex;align-items:center;gap:.3rem"><input type="radio" name="opPrintMargin" value="normal" checked onchange="opGestaoAtualizarPrintConfig()"> Normal</label>'
      + '<label style="display:flex;align-items:center;gap:.3rem"><input type="radio" name="opPrintMargin" value="narrow" onchange="opGestaoAtualizarPrintConfig()"> Estreita</label>'
      + '</div></div>'
      + '</div>'
      + '<div style="border-top:1px solid #e2e8f0;padding-top:.75rem;margin-top:.75rem">'
      + '<label style="display:flex;align-items:center;gap:.4rem;color:#0f172a;font-size:.88rem">'
      + '<input type="checkbox" id="opPrintFitWidth" checked onchange="opGestaoAtualizarPrintConfig()">'
      + '<span>Ajustar largura à folha (altura automática)</span>'
      + '</label>'
      + '<p style="color:#94a3b8;font-size:.75rem;margin-top:.6rem;margin-bottom:0">💡 Dica: Arraste as linhas no preview para ajustar quebras de página!</p>'
      + '</div>'
      + '</section>'
      + '<section class="op-report-control no-print" style="margin:1.1rem 0;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;padding:.85rem">'
      + '<h3 class="op-doc-section-title">Controle do Relatorio</h3>'
      + '<div style="display:flex;gap:.75rem;flex-wrap:wrap;color:#0f172a;font-size:.88rem">'
      + '<label style="display:flex;align-items:center;gap:.4rem"><input type="radio" name="opRelHoras" value="cliente" checked onchange="opGestaoAtualizarModoRelatorio()"> Cliente - ocultar apontamentos de horas</label>'
      + '<label style="display:flex;align-items:center;gap:.4rem"><input type="radio" name="opRelHoras" value="interno" onchange="opGestaoAtualizarModoRelatorio()"> Interno - incluir apontamentos de horas</label>'
      + '</div></section>'
      + '<section class="op-doc-print-section op-escopo-section" data-section-break="escopo" style="margin:1.1rem 0"><h3 class="op-doc-section-title"><span class="op-section-break-btn no-print" onclick="opToggleSectionBreak(\'escopo\')" title="Forçar quebra de página">⌗</span>Informações de Escopo e Exclusões (Informações da Proposta)</h3>'
      + renderEscopoGestaoHtml(s)
      + '</section>'
      + '<section class="op-signatures-section op-doc-print-section" data-section-break="assinaturas" style="margin:1.1rem 0"><h3 class="op-doc-section-title"><span class="op-section-break-btn no-print" onclick="opToggleSectionBreak(\'assinaturas\')" title="Forçar quebra de página">⌗</span>Assinaturas</h3>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.75rem">'
      + assinaturaBoxHtml('Responsavel Cliente', 'opAssClienteNome', 'cliente')
      + assinaturaBoxHtml('Responsavel Empresa', 'opAssEmpresaNome', 'empresa')
      + '</div></section>'
      + acoesGestaoHtml(bloqueado, 'op-doc-actions-bottom')
      + '</article>'
      + '</div>'  // fecha opObraBody
      + '<div id="opGestaoPreviewPane">'
      + '<div style="position:sticky;top:0;z-index:5;background:#e2e8f0;padding:.75rem 1rem;border-bottom:1px solid #cbd5e1">'
      + '<span style="font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:#475569;font-weight:700">⊞ Preview de Impressão — A4</span>'
      + '</div>'
      + '<div style="padding:1rem">'
      + '<div id="opGestaoPreviewContent"></div>'
      + '</div>'
      + '</div>'  // fecha opGestaoPreviewPane
      + '</div>'  // fecha opSplitWrapper
      + '</div>'  // fecha opObraDialog
      + '</div>';  // fecha opObraPanel
    setTimeout(function () {
      ajustarTextareas(el);
      inicializarAssinaturasGestao(el);
      // Preencher campos de Ciclo de Execução
      var doc = state.gestaoDocumento || {};
      if (Q('opGestaoExecInicio')) Q('opGestaoExecInicio').value = doc.data_exec_inicio || '';
      if (Q('opGestaoExecTermino')) Q('opGestaoExecTermino').value = doc.data_exec_termino || '';
      if (Q('opGestaoExecAceite')) Q('opGestaoExecAceite').value = doc.data_exec_aceite || '';
    }, 30);
  }

  function assinaturaGestaoEstado(key) {
    if (!state.gestaoAssinaturas) state.gestaoAssinaturas = {};
    if (!state.gestaoAssinaturas[key]) state.gestaoAssinaturas[key] = { dataUrl: '', assinada: false };
    return state.gestaoAssinaturas[key];
  }

  function atualizarHintAssinatura(canvas, assinada) {
    var pad = canvas && canvas.parentElement;
    var hint = pad ? pad.querySelector('.op-signature-hint') : null;
    if (hint) hint.style.display = assinada ? 'none' : 'flex';
  }

  function prepararCanvasAssinatura(canvas, limpar) {
    if (!canvas) return null;
    var rect = canvas.getBoundingClientRect();
    var ratio = Math.max(window.devicePixelRatio || 1, 1);
    var width = Math.max(Math.round(rect.width * ratio), 1);
    var height = Math.max(Math.round(rect.height * ratio), 1);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    var ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#0f172a';
    if (limpar !== false) ctx.clearRect(0, 0, rect.width, rect.height);
    return ctx;
  }

  function restaurarAssinaturaCanvas(canvas, dataUrl) {
    var ctx = prepararCanvasAssinatura(canvas, true);
    if (!ctx || !dataUrl) return;
    var img = new Image();
    img.onload = function () {
      var rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
  }

  function pontoAssinatura(canvas, ev) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(rect.width, ev.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, ev.clientY - rect.top))
    };
  }

  function salvarAssinaturaCanvas(key, canvas) {
    var estado = assinaturaGestaoEstado(key);
    estado.dataUrl = canvas.toDataURL('image/png');
    estado.assinada = true;
    atualizarHintAssinatura(canvas, true);
    // Quando cliente assina, preencher data de aceite com data atual
    if (key === 'cliente') {
      var hoje = new Date().toISOString().split('T')[0]; // formato YYYY-MM-DD
      var campoAceite = Q('opGestaoExecAceite');
      if (campoAceite && !campoAceite.value) {
        campoAceite.value = hoje;
      }
    }
  }

  function inicializarAssinaturasGestao(root) {
    root = root || document;
    Array.prototype.forEach.call(root.querySelectorAll('.op-signature-canvas'), function (canvas) {
      var key = canvas.getAttribute('data-assinatura-key') || '';
      var estado = assinaturaGestaoEstado(key);
      restaurarAssinaturaCanvas(canvas, estado.dataUrl);
      atualizarHintAssinatura(canvas, !!estado.assinada);
      var drawing = false;
      var last = null;
      var ctx = canvas.getContext('2d');

      function down(ev) {
        if (gestaoDocumentoBloqueado() || canvas.getAttribute('data-bloqueado') === '1') return;
        if (ev.cancelable) ev.preventDefault();
        ctx = prepararCanvasAssinatura(canvas, false) || ctx;
        drawing = true;
        last = pontoAssinatura(canvas, ev);
        atualizarHintAssinatura(canvas, true);
        if (canvas.setPointerCapture && ev.pointerId != null) {
          try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
        }
      }

      function move(ev) {
        if (!drawing) return;
        if (ev.cancelable) ev.preventDefault();
        var p = pontoAssinatura(canvas, ev);
        ctx.beginPath();
        ctx.moveTo(last.x, last.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        last = p;
      }

      function up(ev) {
        if (!drawing) return;
        if (ev && ev.cancelable) ev.preventDefault();
        drawing = false;
        salvarAssinaturaCanvas(key, canvas);
      }

      canvas.addEventListener('pointerdown', down, { passive: false });
      canvas.addEventListener('pointermove', move, { passive: false });
      canvas.addEventListener('pointerup', up, { passive: false });
      canvas.addEventListener('pointercancel', up, { passive: false });
      canvas.addEventListener('pointerleave', up, { passive: false });
    });
  }

  function limparAssinaturaGestao(key) {
    if (gestaoDocumentoBloqueado()) {
      msg('Relatorio assinado e bloqueado para edicao.', 'err');
      return;
    }
    var estado = assinaturaGestaoEstado(key);
    estado.dataUrl = '';
    estado.assinada = false;
    var canvas = document.querySelector('.op-signature-canvas[data-assinatura-key="' + key + '"]');
    var ctx = prepararCanvasAssinatura(canvas, true);
    if (ctx && canvas) {
      var rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      atualizarHintAssinatura(canvas, false);
    }
  }

  function renderDetalhe() {
    var el = $('opDetalhe');
    if (!el) return;
    var o = state.obraAtual;
    if (!o) {
      el.innerHTML = '';
      return;
    }
    if (o.__gestaoNegocio) {
      renderGestaoNegocio(el, o);
      return;
    }
    var centroCustoAuto = o.centro_custo || o.codigo_obra || '';
    el.innerHTML = ajusteResponsivoHtml()
      + '<div id="opObraPanel" class="op-panel-overlay" style="position:fixed;inset:0;z-index:880;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opObraDialog" class="op-panel-shell" style="width:min(1120px,96vw);max-height:92vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 20px 70px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column">'
      + '<div class="op-panel-header" style="position:sticky;top:0;z-index:5;background:var(--bg2);border-bottom:1px solid var(--border);padding:.95rem 1rem;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">'
      + '<div><div style="font-size:1.25rem;color:var(--accent);font-weight:900;text-transform:uppercase;letter-spacing:.02em">Detalhe da Obra</div>'
      + '<h3 style="margin:.25rem 0 0;font-size:1.05rem;color:var(--text);line-height:1.28">' + esc(o.codigo_obra || '-') + ' - ' + esc(o.titulo || '-') + '</h3>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.22rem">Proposta ' + esc(o.proposta_numero || '-') + (o.proposta_revisao ? ' / Rev. ' + esc(o.proposta_revisao) : '') + '</div></div>'
      + '<button type="button" class="btn bg" onclick="opFecharDetalhe()" style="min-height:40px">Fechar</button></div>'
      + '<div id="opObraBody" class="op-panel-body" style="overflow:auto;padding:1rem">'
      + sectionBox('Dados da Obra', '', ''
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.75rem;margin-bottom:1rem;font-size:.86rem;color:var(--text2)">'
      + '<div><strong>Cliente</strong><br>' + esc(o.cliente_nome || '-') + '</div>'
      + '<div><strong>CNPJ</strong><br>' + esc(o.cliente_cnpj || '-') + '</div>'
      + '<div><strong>Cidade/local</strong><br>' + esc([o.cliente_cidade, o.cliente_local].filter(Boolean).join(' / ') || '-') + '</div>'
      + '<div><strong>Valor vendido</strong><br>' + money(o.valor_vendido) + '</div>'
      + '<div><strong>Data aprovacao</strong><br>' + esc(dataInput(o.data_aprovacao) || '-') + '</div>'
      + '</div>'
      + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem;margin-bottom:1rem">'
      + campo('Status operacional', '<select id="opEdStatus" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">' + statusOptions(o.status_operacional) + '</select>')
      + campo('Responsavel operacional', input('opEdResp', o.responsavel_operacional_nome))
      + campo('Centro de custo', inputReadonly('opEdCentro', centroCustoAuto) + '<span style="margin-top:.25rem;color:var(--text3);font-size:.72rem;text-transform:none;font-weight:500">Centro de custo gerado automaticamente a partir do codigo da obra.</span>')
      + campo('Area / Local', input('opEdAreaLocal', o.area_local))
      + campo('Equipamento / Maquina / Linha', input('opEdEquipLinha', o.equipamento_maquina_linha))
      + campo('Inicio previsto', input('opEdIniPrev', dataInput(o.data_inicio_prevista), 'date'))
      + campo('Termino previsto', input('opEdFimPrev', dataInput(o.data_termino_prevista), 'date'))
      + campo('Inicio real', input('opEdIniReal', dataInput(o.data_inicio_real), 'date'))
      + campo('Termino real', input('opEdFimReal', dataInput(o.data_termino_real), 'date'))
      + campo('Entrega prevista', input('opEdEntPrev', dataInput(o.data_entrega_prevista), 'date'))
      + campo('Entrega real', input('opEdEntReal', dataInput(o.data_entrega_real), 'date'))
      + campo('Inicio garantia', input('opEdGarIni', dataInput(o.data_inicio_garantia), 'date'))
      + campo('Fim garantia', input('opEdGarFim', dataInput(o.data_fim_garantia), 'date'))
      + campo('Avanco %', input('opEdAvanco', o.percentual_avanco || 0, 'number'))
      + '</div>'
      + '<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;font-size:.82rem;color:var(--text2)">'
      + '<label><input id="opEdPodeFat" type="checkbox"' + boolChecked(o.pode_faturar) + '> Pode faturar</label>'
      + '<label><input id="opEdTermo" type="checkbox"' + boolChecked(o.termo_entrega_assinado) + '> Termo de entrega assinado</label>'
      + '</div>'
      + campo('Observacoes', '<textarea id="opEdObs" class="op-auto-textarea" rows="4" style="padding:.55rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text);resize:none;overflow:hidden;min-height:96px;line-height:1.45">' + esc(o.observacoes || '') + '</textarea>')
      + '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">'
      + '<div style="font-size:.72rem;color:var(--text3);font-weight:800;text-transform:uppercase;margin-bottom:.5rem">Resumo do snapshot da proposta</div>'
      + snapshotResumo(o)
      + '</div>', 'dados')
      // F2F — placeholder para o Espelho Financeiro Oficial (preenchido por
      // financeiro-espelho-operacional.js após renderização do DOM)
      + '<div id="op-fin-espelho-sec" style="margin-bottom:1rem"></div>'
      + operacionalPlanejamentoHtml(o)
      + diarioSectionHtml()
      + '</div>'
      + '<div id="opObraFooter" class="op-panel-footer" style="position:sticky;bottom:0;background:var(--bg2);border-top:1px solid var(--border);padding:.75rem 1rem;display:flex;justify-content:flex-end;gap:.6rem">'
      + '<button type="button" class="btn bg" onclick="opFecharDetalhe()" style="min-height:42px">Fechar</button>'
      + '<button type="button" class="btn ba" onclick="opSalvarObra()" style="min-height:42px">Salvar Obra</button>'
      + '</div></div></div>'
      + diarioOverlayHtml()
      + mobilizacaoOverlayHtml()
      + confirmarExcluirMobilizacaoHtml()
      + recursoOverlayHtml()
      + confirmarExcluirRecursoHtml()
      + recursosPadraoOverlayHtml();
    setTimeout(function () { ajustarTextareas(el); }, 30);

    // F2F — Disparar carregamento do Espelho Financeiro Oficial (somente leitura).
    // setTimeout(0) garante que el.innerHTML já foi aplicado ao DOM antes de
    // tentar localizar #op-fin-espelho-sec e iniciar a consulta async.
    if (o && typeof window.opFinEspelhoCarregar === 'function') {
      setTimeout(function () { window.opFinEspelhoCarregar(o); }, 0);
    }
  }

  // ── Datas oficiais de execucao (fonte: Operacional/gestao_negocio) ───────────
  // Carrega em lote as datas de execucao por proposta para alimentar os KPIs
  // comerciais. Mapa exposto em window._opExecDatasMap[proposta_id] = {ini,ter,ace}.
  async function carregarDatasExecucao(empresaId) {
    empresaId = empresaId || getEmpresaId();
    if (!window.sbClient || !empresaId) return;
    try {
      var res = await window.sbClient
        .from('gestao_negocio')
        .select('proposta_id, data_exec_inicio, data_exec_termino, data_exec_aceite')
        .eq('empresa_id', empresaId)
        .eq('arquivado', false);
      if (res.error) throw res.error;
      var m = {};
      (res.data || []).forEach(function (r) {
        if (!r || !r.proposta_id) return;
        m[String(r.proposta_id)] = {
          ini: r.data_exec_inicio || '',
          ter: r.data_exec_termino || '',
          ace: r.data_exec_aceite || ''
        };
      });
      window._opExecDatasMap = m;
      // Atualiza os KPIs comerciais que dependem dessas datas, se disponiveis.
      if (typeof window.rDash === 'function') { try { window.rDash(); } catch (e) {} }
      if (typeof window.rCiclos === 'function') { try { window.rCiclos(); } catch (e) {} }
      return m;
    } catch (e) {
      // Silencioso: sem o mapa, os KPIs caem para vazio ("—"), sem quebrar.
      return null;
    }
  }

  async function carregarObras() {
    // Captura empresa e token ANTES do await para detectar trocas durante a consulta
    var empresaId = getEmpresaId();
    var token = ++_opLoadToken;

    state.carregando = true;
    state.erro = '';
    renderLista();

    try {
      var obras = await listarNegociosOperacionais(empresaId);

      // Race condition: descarta se empresa ou token mudou enquanto aguardávamos
      if (token !== _opLoadToken) return;
      if (getEmpresaId() !== empresaId) return;

      state.obras = obras;
    } catch (e) {
      if (token !== _opLoadToken) return;
      state.erro = e.message || String(e);
    } finally {
      // Só atualiza UI se ainda somos o carregamento mais recente
      if (token === _opLoadToken) {
        state.carregando = false;
        renderLista();
      }
    }
  }

  function rOperacional() {
    var root = $('operacional-root');
    if (!root) return;
    root.innerHTML = shell();
    carregarObras();
  }

  function filtros() {
    state.busca = ($('opBusca') || {}).value || '';
    state.status = ($('opStatus') || {}).value || '';
    state.cliente = ($('opCliente') || {}).value || '';
    renderLista();
  }

  function limparFiltros() {
    state.busca = '';
    state.status = '';
    state.cliente = '';
    rOperacional();
  }

  async function abrirObra(id) {
    try {
      var cached = (state.obras || []).find(function (o) { return o.id === id; });
      if (cached) {
        state.obraAtual = cached;
        resetarContextoNegocio();
        renderDetalhe();
        focarPainelObra();
        if (cached.__gestaoNegocio) {
          await Promise.all([
            carregarDocumentoGestao(cached),
            carregarApontamentosNegocio(cached)
          ]);
          return;
        }
      }
      var detalhe = $('opDetalhe');
      if (detalhe && !cached) detalhe.innerHTML = loadingObraHtml();
      var obra = await window.sbBuscarObraPorId(id);
      if (!obra) throw new Error('Obra nao encontrada.');
      state.obraAtual = obra;
      state.diarioForm = null;
      state.diarioEditId = '';
      state.diarios = [];
      state.diariosLoaded = false;
      state.diarioErro = '';
      state.recursos = [];
      state.recursosLoaded = false;
      state.recursosErro = '';
      state.recursoForm = null;
      state.recursoEditId = '';
      state.recursoExcluir = null;
      state.recursosPadraoPicker = false;
      state.mobilizacaoEquipe = [];
      state.mobilizacaoLoaded = false;
      state.mobilizacaoErro = '';
      state.mobilizacaoForm = null;
      state.mobilizacaoEditId = '';
      state.mobilizacaoExcluir = null;
      state.accordionOpen = {};
      renderDetalhe();
      focarPainelObra();
    } catch (e) {
      var erroDetalhe = $('opDetalhe');
      if (erroDetalhe) erroDetalhe.innerHTML = '';
      msg('Erro ao abrir obra: ' + (e.message || e), 'err');
    }
  }

  function fecharDetalhe() {
    state.obraAtual = null;
    renderDetalhe();
  }

  function coletarRecebimentoMobilizacao() {
    return {
      recebimento_status: ($('opRecStatus') || {}).value || 'nao_iniciado',
      data_recebimento_operacional: ($('opRecData') || {}).value || null,
      responsavel_recebimento_nome: ($('opRecResp') || {}).value || '',
      pedido_compra_recebido: !!(($('opRecPedido') || {}).checked),
      numero_pedido_compra: ($('opRecPedidoNum') || {}).value || '',
      escopo_conferido: !!(($('opRecEscopo') || {}).checked),
      prazo_validado: !!(($('opRecPrazo') || {}).checked),
      condicao_pagamento_conferida: !!(($('opRecCondPag') || {}).checked),
      proposta_aprovada_conferida: !!(($('opRecPropConf') || {}).checked),
      area_local: ($('opRecArea') || {}).value || ($('opEdAreaLocal') || {}).value || '',
      equipamento_maquina_linha: ($('opRecEquip') || {}).value || ($('opEdEquipLinha') || {}).value || '',
      endereco_execucao: ($('opRecEndereco') || {}).value || '',
      cidade_execucao: ($('opRecCidade') || {}).value || '',
      observacoes_recebimento: ($('opRecObs') || {}).value || '',
      integracao_obrigatoria: !!(($('opSegInt') || {}).checked),
      dds_obrigatorio: !!(($('opSegDds') || {}).checked),
      apr_obrigatoria_obra: !!(($('opSegApr') || {}).checked),
      pt_obrigatoria_obra: !!(($('opSegPt') || {}).checked),
      isolamento_area_obrigatorio: !!(($('opSegIso') || {}).checked),
      bloqueio_etiquetagem_obrigatorio: !!(($('opSegBloq') || {}).checked),
      art_obrigatoria: !!(($('opSegArt') || {}).checked),
      aso_obrigatorio: !!(($('opSegAso') || {}).checked),
      nr10_obrigatoria: !!(($('opSegNr10') || {}).checked),
      nr35_obrigatoria: !!(($('opSegNr35') || {}).checked),
      pgr_pcmso_obrigatorio: !!(($('opSegPgr') || {}).checked),
      observacoes_seguranca_obra: ($('opSegObs') || {}).value || '',
      horario_inicio_previsto: ($('opJorIni') || {}).value || null,
      horario_termino_previsto: ($('opJorFim') || {}).value || null,
      intervalo_almoco_previsto_minutos: ($('opJorIntervalo') || {}).value || 60,
      dias_trabalho_previstos: ($('opJorDias') || {}).value || '',
      horario_definido_pelo_cliente: !!(($('opJorCliente') || {}).checked),
      permite_hora_extra: !!(($('opJorExtra') || {}).checked),
      permite_trabalho_fim_semana: !!(($('opJorFimSemana') || {}).checked),
      observacoes_horario: ($('opJorObs') || {}).value || '',
      tipo_alimentacao_padrao: ($('opAliTipo') || {}).value || '',
      local_alimentacao_padrao: ($('opAliLocal') || {}).value || '',
      observacoes_alimentacao_padrao: ($('opAliObs') || {}).value || '',
      precisa_mobilizacao: !!(($('opMobPrecisa') || {}).checked),
      precisa_hotel: !!(($('opMobHotel') || {}).checked),
      hotel_previsto: ($('opMobHotelPrev') || {}).value || '',
      precisa_veiculo: !!(($('opMobVeiculo') || {}).checked),
      veiculo_previsto: ($('opMobVeiculoPrev') || {}).value || '',
      precisa_combustivel: !!(($('opMobComb') || {}).checked),
      precisa_pedagio: !!(($('opMobPedagio') || {}).checked),
      precisa_estacionamento: !!(($('opMobEstac') || {}).checked),
      precisa_adiantamento: !!(($('opMobAdiant') || {}).checked),
      valor_adiantamento_previsto: ($('opMobValorAdiant') || {}).value || 0,
      responsavel_mobilizacao_nome: ($('opMobResp') || {}).value || '',
      ponto_encontro_equipe: ($('opMobPonto') || {}).value || '',
      horario_encontro_equipe: ($('opMobHorario') || {}).value || null,
      observacoes_mobilizacao_obra: ($('opMobObs') || {}).value || '',
      plano_contingencia_material: ($('opContPlano') || {}).value || '',
      responsavel_compra_emergencial: ($('opContCompra') || {}).value || '',
      responsavel_retirada_emergencial: ($('opContRetirada') || {}).value || '',
      precisa_aprovacao_compra_emergencial: !!(($('opContAprovacao') || {}).checked),
      observacoes_contingencia_material: ($('opContObs') || {}).value || ''
    };
  }

  async function salvarObra() {
    if (!state.obraAtual) return;
    var dados = {
      status_operacional: ($('opEdStatus') || {}).value || (state.obraAtual && state.obraAtual.status_operacional) || 'aprovado',
      responsavel_operacional_nome: ($('opEdResp') || {}).value || '',
      centro_custo: state.obraAtual.centro_custo || state.obraAtual.codigo_obra || '',
      area_local: ($('opEdAreaLocal') || {}).value || '',
      equipamento_maquina_linha: ($('opEdEquipLinha') || {}).value || '',
      data_inicio_prevista: ($('opEdIniPrev') || {}).value || null,
      data_termino_prevista: ($('opEdFimPrev') || {}).value || null,
      data_inicio_real: ($('opEdIniReal') || {}).value || null,
      data_termino_real: ($('opEdFimReal') || {}).value || null,
      data_entrega_prevista: ($('opEdEntPrev') || {}).value || null,
      data_entrega_real: ($('opEdEntReal') || {}).value || null,
      data_inicio_garantia: ($('opEdGarIni') || {}).value || null,
      data_fim_garantia: ($('opEdGarFim') || {}).value || null,
      percentual_avanco: ($('opEdAvanco') || {}).value || 0,
      pode_faturar: !!(($('opEdPodeFat') || {}).checked),
      termo_entrega_assinado: !!(($('opEdTermo') || {}).checked),
      observacoes: ($('opEdObs') || {}).value || ''
    };
    try {
      state.obraAtual = await window.sbAtualizarObra(state.obraAtual.id, dados);
      if (typeof window.sbAtualizarRecebimentoMobilizacaoObra === 'function') {
        state.obraAtual = await window.sbAtualizarRecebimentoMobilizacaoObra(state.obraAtual.id, coletarRecebimentoMobilizacao());
      }
      msg('Obra salva com sucesso.');
      await carregarObras();
      renderDetalhe();
    } catch (e) {
      console.error('[Operacional] Erro tecnico ao salvar obra:', e);
      msg('Não foi possível salvar a obra. Verifique os dados e tente novamente.', 'err');
    }
  }

  async function carregarApontamentosNegocio(negocio) {
    negocio = negocio || state.obraAtual;
    if (!negocio || !negocio.__gestaoNegocio || !negocio.proposta_app_id) return;
    var empresaId = getEmpresaId();
    state.apontamentosNegocioCarregando = true;
    state.apontamentosNegocioErro = '';
    renderDetalhe();
    try {
      var res = await window.sbClient
        .from('apontamentos')
        .select('id, data, tipo_dia, horas_total, descricao, status, boletim_id, boletim_numero, criado_por_nome, colaboradores(nome)')
        .eq('empresa_id', empresaId)
        .eq('proposta_id', negocio.proposta_app_id)
        .neq('status', 'cancelado')
        .order('data', { ascending: false });
      if (res.error) throw res.error;
      if (!state.obraAtual || state.obraAtual.proposta_app_id !== negocio.proposta_app_id || getEmpresaId() !== empresaId) return;
      state.apontamentosNegocio = res.data || [];
      state.apontamentosNegocioLoaded = true;
    } catch (e) {
      state.apontamentosNegocioErro = e.message || String(e);
    } finally {
      state.apontamentosNegocioCarregando = false;
      renderDetalhe();
    }
  }

  function aplicarDocumentoGestao(doc) {
    doc = doc || null;
    state.gestaoDocumento = doc;
    state.gestaoAssinaturas = {
      cliente: { dataUrl: doc && doc.assinatura_cliente ? doc.assinatura_cliente : '', assinada: !!(doc && doc.assinatura_cliente) },
      empresa: { dataUrl: doc && doc.assinatura_empresa ? doc.assinatura_empresa : '', assinada: !!(doc && doc.assinatura_empresa) }
    };
  }

  async function carregarDocumentoGestao(negocio) {
    negocio = negocio || state.obraAtual;
    if (!negocio || !negocio.__gestaoNegocio || !negocio.proposta_app_id) return;
    if (!window.sbClient) {
      state.gestaoDocumentoErro = 'Supabase nao esta conectado.';
      return;
    }
    var empresaId = getEmpresaId();
    state.gestaoDocumentoCarregando = true;
    state.gestaoDocumentoErro = '';
    renderDetalhe();
    try {
      var res = await window.sbClient
        .from('gestao_negocio')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('proposta_id', negocio.proposta_app_id)
        .eq('arquivado', false)
        .maybeSingle();
      if (res.error) throw res.error;
      if (!state.obraAtual || state.obraAtual.proposta_app_id !== negocio.proposta_app_id || getEmpresaId() !== empresaId) return;
      aplicarDocumentoGestao(res.data || null);
      state.gestaoDocumentoLoaded = true;
    } catch (e) {
      state.gestaoDocumentoErro = e.code === '42P01'
        ? 'Tabela gestao_negocio ainda nao aplicada. As migrations 030 e 031 precisam ser autorizadas antes de salvar.'
        : (e.message || String(e));
    } finally {
      state.gestaoDocumentoCarregando = false;
      renderDetalhe();
    }
  }

  function montarPayloadGestao(assinar) {
    var negocio = state.obraAtual || {};
    var empresaId = getEmpresaId();
    var cliente = assinaturaGestaoEstado('cliente');
    var empresa = assinaturaGestaoEstado('empresa');
    return {
      empresa_id: empresaId,
      proposta_id: negocio.proposta_app_id,
      diario_texto: (($('opGestaoDiario') || {}).value || '').trim(),
      data_exec_inicio: (($('opGestaoExecInicio') || {}).value || '').trim() || null,
      data_exec_termino: (($('opGestaoExecTermino') || {}).value || '').trim() || null,
      data_exec_aceite: (($('opGestaoExecAceite') || {}).value || '').trim() || null,
      entregas_texto: '',
      aceite_texto: '',
      responsavel_cliente_nome: (($('opAssClienteNome') || {}).value || '').trim(),
      responsavel_empresa_nome: (($('opAssEmpresaNome') || {}).value || '').trim(),
      assinatura_cliente: cliente.dataUrl || '',
      assinatura_empresa: empresa.dataUrl || '',
      assinado_cliente_em: cliente.dataUrl ? new Date().toISOString() : null,
      assinado_empresa_em: empresa.dataUrl ? new Date().toISOString() : null,
      status_documento: assinar ? 'assinado' : 'rascunho',
      bloqueado: !!assinar,
      assinado_em: assinar ? new Date().toISOString() : null,
      metadata: {
        origem: 'operacional_gestao_negocio',
        modo_relatorio: modoRelatorioGestao()
      }
    };
  }

  function validarGestaoParaFinalizar(row) {
    if (!row.responsavel_cliente_nome) throw new Error('Informe o responsavel do cliente.');
    if (!row.responsavel_empresa_nome) throw new Error('Informe o responsavel da empresa.');
    if (!row.assinatura_cliente) throw new Error('Colete a assinatura do responsavel do cliente.');
    if (!row.assinatura_empresa) throw new Error('Colete a assinatura do responsavel da empresa.');
    if (!row.diario_texto && !window.confirm('O texto do Diario/Entregas/Aceite esta vazio. Deseja finalizar mesmo assim?')) {
      throw new Error('Finalizacao cancelada.');
    }
  }

  async function salvarDocumentoGestao(assinar) {
    var atual = state.gestaoDocumento || {};
    if (gestaoDocumentoBloqueado()) throw new Error('Relatorio ja assinado e bloqueado para edicao.');
    var row = montarPayloadGestao(assinar);
    if (!row.empresa_id || !row.proposta_id) throw new Error('Empresa ou proposta nao encontrada.');
    if (assinar) validarGestaoParaFinalizar(row);
    var res;
    if (atual.id) {
      // Atualiza o documento ativo existente pelo ID — garante que so toca o registro ativo
      res = await window.sbClient
        .from('gestao_negocio')
        .update(row)
        .eq('id', atual.id)
        .eq('empresa_id', row.empresa_id)
        .eq('arquivado', false)
        .select('*')
        .single();
    } else {
      // Insere novo documento ativo — arquivado = false por DEFAULT na coluna
      res = await window.sbClient
        .from('gestao_negocio')
        .insert(row)
        .select('*')
        .single();
    }
    if (res.error) throw res.error;
    aplicarDocumentoGestao(res.data || Object.assign({}, atual, row));
    state.gestaoDocumentoLoaded = true;
    renderDetalhe();
    // Refresca as datas oficiais de execucao para os KPIs comerciais.
    carregarDatasExecucao();
    return state.gestaoDocumento;
  }

  async function salvarRascunhoGestao() {
    try {
      await salvarDocumentoGestao(false);
      msg('Rascunho da Gestao do Negocio salvo.');
    } catch (e) {
      msg(e.message || 'Nao foi possivel salvar o rascunho.', 'err');
    }
  }

  async function finalizarGestao() {
    try {
      await salvarDocumentoGestao(true);
      msg('Relatorio assinado e bloqueado para edicao.');
    } catch (e) {
      if ((e.message || '') !== 'Finalizacao cancelada.') msg(e.message || 'Nao foi possivel finalizar o relatorio.', 'err');
    }
  }

  function relatorioIncluiHoras() {
    var checked = document.querySelector('input[name="opRelHoras"]:checked');
    return checked && checked.value === 'interno';
  }

  function textoGestaoNegocio() {
    var o = state.obraAtual || {};
    var s = o.snapshot_proposta_json || {};
    var linhas = [];
    linhas.push('GESTAO DO NEGOCIO');
    linhas.push((o.proposta_numero || '-') + ' - ' + (o.titulo || '-'));
    linhas.push('Cliente: ' + (valorSnapshot(s, ['cli']) || o.cliente_nome || '-'));
    linhas.push('Cidade: ' + (valorSnapshot(s, ['csvc', 'cid']) || o.cliente_cidade || '-'));
    linhas.push('Contato: ' + (valorSnapshot(s, ['ac']) || '-'));
    linhas.push('');
    linhas.push('DIARIO DE BORDO / ENTREGAS / ACEITE');
    linhas.push(($('opGestaoDiario') || {}).value || '');
    if (relatorioIncluiHoras()) {
      linhas.push('');
      linhas.push('APONTAMENTOS DE HORAS');
      (state.apontamentosNegocio || []).forEach(function (a) {
        var nome = a.colaboradores && a.colaboradores.nome ? a.colaboradores.nome : (a.criado_por_nome || '-');
        linhas.push([dataInput(a.data) || '-', nome, (a.tipo_colaborador || a.tipo_dia || '-'), Number(a.horas_total || 0).toFixed(1) + 'h', (a.status || '-'), (a.descricao || '-')].join(' | '));
      });
      var t = totaisApontamentosNegocio();
      linhas.push('Total geral: ' + Number(t.geral || 0).toFixed(1) + 'h');
    } else {
      linhas.push('');
      linhas.push('Apontamentos de horas ocultos para relatorio de cliente.');
    }
    linhas.push('');
    linhas.push('Responsavel Cliente: ' + (($('opAssClienteNome') || {}).value || ''));
    linhas.push('Responsavel Empresa: ' + (($('opAssEmpresaNome') || {}).value || ''));
    if (assinaturaGestaoEstado('cliente').assinada) linhas.push('Assinatura cliente: coletada na tela');
    if (assinaturaGestaoEstado('empresa').assinada) linhas.push('Assinatura empresa: coletada na tela');
    return linhas.join('\n');
  }

  function gestaoExportarTexto() {
    try {
      var texto = textoGestaoNegocio();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(function () {
          msg('Texto do relatorio copiado para a area de transferencia.');
        }).catch(function () {
          abrirTextoGestao(texto);
        });
      } else {
        abrirTextoGestao(texto);
      }
    } catch (e) {
      msg('Nao foi possivel gerar o texto do relatorio.', 'err');
    }
  }

  function abrirTextoGestao(texto) {
    var w = window.open('', '_blank');
    if (!w) return msg('O navegador bloqueou a janela de texto.', 'err');
    w.document.write('<pre style="white-space:pre-wrap;font-family:Calibri,Arial,sans-serif;font-size:12pt;line-height:1.45">' + esc(texto) + '</pre>');
    w.document.close();
  }

  function aplicarCssPrint() {
    var cfg = _opPrintConfig;
    var marginVal = cfg.margin === 'narrow' ? '8mm' : '15mm';
    var sizeVal = cfg.size === 'letter' ? 'letter' : 'A4';
    var orientVal = cfg.orientation === 'landscape' ? 'landscape' : 'portrait';
    var css = '@page { size: ' + sizeVal + ' ' + orientVal + '; margin: ' + marginVal + '; }';
    if (cfg.fitWidth) {
      css += '\n#opGestaoPrintRoot .op-print-paper { width: 100% !important; max-width: none !important; }';
    }
    var el = document.createElement('style');
    el.id = 'opPrintDynamicStyle';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function removerCssPrint() {
    var el = document.getElementById('opPrintDynamicStyle');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function togglePreviewGestao() {
    var pane = document.getElementById('opGestaoPreviewPane');
    var body = document.getElementById('opObraBody');
    var btn = document.getElementById('opBtnPreview');
    if (!pane || !body) return;
    _opPreviewAtivo = !_opPreviewAtivo;
    pane.style.display = _opPreviewAtivo ? 'flex' : 'none';
    body.style.flex = _opPreviewAtivo ? '0 0 50%' : '1';
    body.style.maxWidth = _opPreviewAtivo ? '50%' : '';
    if (btn) {
      btn.textContent = _opPreviewAtivo ? '⊠ Fechar Preview' : '⊞ Preview';
      btn.style.background = _opPreviewAtivo ? '#bbf7d0!important' : '#dbeafe!important';
    }
    if (_opPreviewAtivo) {
      atualizarPreviewGestao(0);
    }
  }

  function renderPreviewHtml() {
    // Usa a MESMA lógica de prepararDocumentoImpressaoGestao
    var origem = document.querySelector('#opObraPanel .op-doc-paper');
    if (!origem) return '<p style="color:#94a3b8;text-align:center;margin-top:2rem">Conteúdo não disponível.</p>';

    var modo = modoRelatorioGestao();
    var clone = origem.cloneNode(true);

    // Remove elementos que não devem aparecer na impressão
    Array.prototype.forEach.call(clone.querySelectorAll('.no-print,.op-doc-actions,.op-report-control,.op-report-notice'), function(el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });

    if (modo === 'cliente') {
      Array.prototype.forEach.call(clone.querySelectorAll('.op-report-hours-section'), function(el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }

    // Converte textareas em divs (igual prepararDocumentoImpressaoGestao)
    Array.prototype.forEach.call(clone.querySelectorAll('textarea'), function(ta) {
      var original = document.getElementById(ta.id);
      var div = document.createElement('div');
      div.className = ta.className;
      div.style.cssText = ta.getAttribute('style') || '';
      div.style.whiteSpace = 'pre-wrap';
      div.style.minHeight = '92mm';  // Mesmo tamanho da impressão
      div.textContent = original ? original.value : ta.value;
      ta.parentNode.replaceChild(div, ta);
    });

    // Sincroniza inputs de text
    Array.prototype.forEach.call(clone.querySelectorAll('input[type="text"]'), function(input) {
      var original = document.getElementById(input.id);
      input.setAttribute('value', original ? original.value : input.value);
    });

    // Sincroniza inputs de date
    Array.prototype.forEach.call(clone.querySelectorAll('input[type="date"]'), function(input) {
      var original = document.getElementById(input.id);
      if (original) input.setAttribute('value', original.value);
    });

    // Converte canvas de assinatura em imagens (igual prepararDocumentoImpressaoGestao)
    Array.prototype.forEach.call(clone.querySelectorAll('canvas.op-signature-canvas'), function(canvasClone) {
      var original = document.getElementById(canvasClone.id);
      var img = document.createElement('img');
      img.alt = canvasClone.getAttribute('aria-label') || 'Assinatura';
      img.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;background:#fff';
      try {
        img.src = original ? original.toDataURL('image/png') : canvasClone.toDataURL('image/png');
      } catch(e) {
        img.src = '';
      }
      canvasClone.parentNode.replaceChild(img, canvasClone);
    });

    return clone.innerHTML;
  }

  function atualizarPreviewGestao(delay) {
    clearTimeout(_previewDebounce);
    _previewDebounce = setTimeout(function() {
      var content = document.getElementById('opGestaoPreviewContent');
      if (!content || !_opPreviewAtivo) return;
      content.innerHTML = renderPreviewHtml();

      // Reaplicar classes de quebra de página
      Object.keys(_opSectionBreaks).forEach(function(sectionId) {
        if (_opSectionBreaks[sectionId]) {
          var section = content.querySelector('[data-section-break="' + sectionId + '"]');
          if (section) {
            section.classList.add('op-has-page-break');
          }
        }
      });

      inserirLinhasQuebraPreview(content);
    }, delay !== undefined ? delay : 600);
  }

  function inserirLinhasQuebraPreview(root) {
    if (!root) return;

    // Remove linhas antigas
    var existingBreaks = root.querySelectorAll('.op-preview-page-divider');
    existingBreaks.forEach(function(el) { if (el.parentNode) el.parentNode.removeChild(el); });

    root.style.position = 'relative';

    // Calcula altura da página em pixels (A4 = 210mm x 297mm, menos margem de 15mm = 267mm altura útil)
    var mmToPx = 96 / 25.4;
    var pageHeightMm = 267;  // 297mm - 15mm margem superior - 15mm margem inferior
    var pageHeightPx = Math.round(pageHeightMm * mmToPx);

    // Páginas começam em 0, 267mm, 534mm, etc
    var pageNum = 1;
    for (var page = 1; page < 15; page++) {
      var breakY = page * pageHeightPx;

      var divider = document.createElement('div');
      divider.className = 'op-preview-page-divider';
      divider.style.cssText = 'position:absolute;left:0;right:0;border-top:2px dashed #cbd5e1;pointer-events:none;top:' + Math.round(breakY) + 'px;z-index:5';

      var label = document.createElement('span');
      label.style.cssText = 'position:absolute;right:0;top:-18px;font-size:.6rem;color:#cbd5e1;font-weight:700;text-transform:uppercase;letter-spacing:.05em;background:#fff;padding:2px 6px;border-radius:3px 3px 0 0;white-space:nowrap;pointer-events:none';
      label.textContent = 'Página ' + (page + 1);
      divider.appendChild(label);

      root.appendChild(divider);
    }

    // Também adiciona indicadores VISUAIS nas seções com quebra forçada
    var forcedBreakSections = root.querySelectorAll('[data-section-break].op-has-page-break');
    forcedBreakSections.forEach(function(section) {
      var indicator = document.createElement('div');
      indicator.style.cssText = 'position:absolute;left:-25px;top:0;width:20px;height:20px;background:#3b82f6;border-radius:50%;z-index:10;display:flex;align-items:center;justify-content:center;font-size:.75rem;color:#fff;font-weight:bold;';
      indicator.textContent = '✓';
      indicator.title = 'Quebra forçada nesta seção';
      section.style.position = 'relative';
      section.parentNode.insertBefore(indicator, section);
    });
  }

  function toggleSectionBreak(sectionId) {
    _opSectionBreaks[sectionId] = !_opSectionBreaks[sectionId];
    var section = document.querySelector('[data-section-break="' + sectionId + '"]');
    if (section) {
      if (_opSectionBreaks[sectionId]) {
        section.classList.add('op-has-page-break');
      } else {
        section.classList.remove('op-has-page-break');
      }
      // Também atualiza o visual do botão
      var btn = section.querySelector('.op-section-break-btn');
      if (btn) {
        if (_opSectionBreaks[sectionId]) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    }
    atualizarPreviewGestao(200);
  }

  function removerDocumentoImpressaoGestao() {
    var antigo = document.getElementById('opGestaoPrintRoot');
    if (antigo && antigo.parentNode) antigo.parentNode.removeChild(antigo);
    document.body.classList.remove('op-gestao-printing');
    removerCssPrint();
  }

  function prepararDocumentoImpressaoGestao() {
    removerDocumentoImpressaoGestao();
    gestaoAtualizarModoRelatorio();
    var origem = document.querySelector('#opObraPanel .op-doc-paper');
    if (!origem) throw new Error('Documento da Gestao do Negocio nao encontrado para impressao.');

    var modo = modoRelatorioGestao();
    var root = document.createElement('div');
    root.id = 'opGestaoPrintRoot';
    root.setAttribute('data-report-mode', modo);

    var clone = origem.cloneNode(true);
    clone.classList.add('op-print-paper');
    Array.prototype.forEach.call(clone.querySelectorAll('.no-print,.op-doc-actions,.op-report-control,.op-report-notice'), function (el) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    if (modo === 'cliente') {
      Array.prototype.forEach.call(clone.querySelectorAll('.op-report-hours-section'), function (el) {
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    }
    Array.prototype.forEach.call(clone.querySelectorAll('textarea'), function (ta) {
      var original = document.getElementById(ta.id);
      var div = document.createElement('div');
      div.className = ta.className;
      div.style.cssText = ta.getAttribute('style') || '';
      div.style.whiteSpace = 'pre-wrap';
      div.style.minHeight = '92mm';
      div.textContent = original ? original.value : ta.value;
      ta.parentNode.replaceChild(div, ta);
    });
    Array.prototype.forEach.call(clone.querySelectorAll('input[type="text"]'), function (input) {
      var original = document.getElementById(input.id);
      input.setAttribute('value', original ? original.value : input.value);
    });
    Array.prototype.forEach.call(clone.querySelectorAll('canvas.op-signature-canvas'), function (canvasClone) {
      var original = document.getElementById(canvasClone.id);
      var img = document.createElement('img');
      img.alt = canvasClone.getAttribute('aria-label') || 'Assinatura';
      img.style.cssText = 'width:100%;height:100%;display:block;object-fit:contain;background:#fff';
      try {
        img.src = original ? original.toDataURL('image/png') : canvasClone.toDataURL('image/png');
      } catch (e) {
        img.src = '';
      }
      canvasClone.parentNode.replaceChild(img, canvasClone);
    });
    root.appendChild(clone);
    document.body.appendChild(root);
    document.body.classList.add('op-gestao-printing');
    var escala = (_opPrintConfig.scale || 100) / 100;
    if (escala !== 1) {
      clone.style.zoom = String(escala);
    }
    return root;
  }

  function gestaoImprimir() {
    try {
      prepararDocumentoImpressaoGestao();
      aplicarCssPrint();
      setTimeout(function () { window.print(); }, 80);
      setTimeout(removerDocumentoImpressaoGestao, 2000);
    } catch (e) {
      msg(e.message || 'Nao foi possivel preparar a impressao.', 'err');
    }
  }

  function gestaoPdf() {
    gestaoImprimir();
  }

  function modoRelatorioGestao() {
    return relatorioIncluiHoras() ? 'interno' : 'cliente';
  }

  function gestaoAtualizarModoRelatorio() {
    var panel = $('opObraPanel');
    if (panel) panel.setAttribute('data-report-mode', modoRelatorioGestao());
  }

  async function carregarDiariosObra() {
    if (!state.obraAtual || typeof window.sbListarDiariosObra !== 'function') return;
    state.diarioCarregando = true;
    state.diarioErro = '';
    renderDetalhe();
    try {
      state.diarios = await window.sbListarDiariosObra(getEmpresaId(), state.obraAtual.id);
      state.diariosLoaded = true;
    } catch (e) {
      state.diarioErro = e.message || String(e);
    } finally {
      state.diarioCarregando = false;
      renderDetalhe();
    }
  }

  async function carregarRecursosMobilizacaoObra() {
    await Promise.all([carregarRecursosObra(), carregarMobilizacaoObra()]);
  }

  async function carregarRecursosObra() {
    if (!state.obraAtual) return;
    var empresaId = getEmpresaId();
    state.recursosCarregando = true;
    state.recursosErro = '';
    renderDetalhe();
    try {
      if (typeof window.sbListarRecursosCampoObra === 'function') {
        state.recursos = await window.sbListarRecursosCampoObra(empresaId, state.obraAtual.id);
      }
      state.recursosLoaded = true;
    } catch (e) {
      state.recursosErro = e.message || String(e);
    } finally {
      state.recursosCarregando = false;
      renderDetalhe();
    }
  }

  async function carregarMobilizacaoObra() {
    if (!state.obraAtual) return;
    var empresaId = getEmpresaId();
    state.mobilizacaoCarregando = true;
    state.mobilizacaoErro = '';
    renderDetalhe();
    try {
      if (typeof window.sbListarMobilizacaoEquipeObra === 'function') {
        state.mobilizacaoEquipe = await window.sbListarMobilizacaoEquipeObra(empresaId, state.obraAtual.id);
      }
      state.mobilizacaoLoaded = true;
    } catch (e2) {
      state.mobilizacaoErro = e2.message || String(e2);
    } finally {
      state.mobilizacaoCarregando = false;
      renderDetalhe();
    }
  }

  function novoDiario() {
    if (!state.obraAtual) return;
    state.diarioEditId = '';
    state.diarioAccordionOpen = '';
    state.diarioForm = {
      empresa_id: getEmpresaId(),
      obra_id: state.obraAtual.id,
      data_diario: hojeISO(),
      turno: 'integral',
      status_dia: 'concluido',
      area_local: state.obraAtual.area_local || '',
      equipamento_maquina_linha: state.obraAtual.equipamento_maquina_linha || '',
      servico_liberado: true,
      dia_concluido_com_sucesso: true,
      intervalo_realizado_minutos: 0,
      valor_custo_extra_transporte: 0,
      horas_equipe_total: 0,
      avanco_estimado_dia: 0
    };
    renderDetalhe();
    focarDiarioForm();
  }

  async function editarDiario(id) {
    try {
      var d = await window.sbBuscarDiarioPorId(id);
      if (!d) throw new Error('Diario nao encontrado.');
      state.diarioEditId = d.id;
      state.diarioAccordionOpen = '';
      state.diarioForm = Object.assign({}, d);
      renderDetalhe();
      focarDiarioForm();
    } catch (e) {
      msg('Erro ao abrir diario: ' + (e.message || e), 'err');
    }
  }

  function cancelarDiario() {
    state.diarioForm = null;
    state.diarioEditId = '';
    state.diarioAccordionOpen = '';
    abrirAccordion('diario');
    renderDetalhe();
  }

  function coletarDiarioForm() {
    var out = {
      empresa_id: getEmpresaId(),
      obra_id: state.obraAtual ? state.obraAtual.id : ''
    };
    DIARIO_BLOCOS.forEach(function (bloco) {
      bloco.campos.forEach(function (def) {
        var k = def[0], tipo = def[2], el = getCampo('opDia_' + k);
        if (!el) return;
        out[k] = tipo === 'checkbox' ? !!el.checked : el.value;
      });
    });
    return out;
  }

  function limparErroDiario() {
    var box = getCampo('opDiaMsg');
    if (box) {
      box.style.display = 'none';
      box.textContent = '';
    }
    document.querySelectorAll('[id^="opDia_"]').forEach(function (el) {
      el.style.borderColor = 'var(--border)';
      el.style.boxShadow = '';
    });
  }

  function mostrarErroDiario(texto, campoId) {
    console.error('[Operacional]', texto);
    if (campoId) {
      var atual = getCampo(campoId);
      var blocoKey = blocoDiarioPorCampo(campoId.replace(/^opDia_/, ''));
      if (blocoKey && state.diarioAccordionOpen !== blocoKey && (!atual || atual.offsetParent === null)) {
        try { state.diarioForm = Object.assign({}, state.diarioForm || {}, coletarDiarioForm()); } catch (e) {}
        state.diarioAccordionOpen = blocoKey;
        renderDetalhe();
        setTimeout(function () { mostrarErroDiario(texto, campoId); }, 40);
        return;
      }
    }
    var box = getCampo('opDiaMsg');
    if (box) {
      box.textContent = texto;
      box.style.display = 'block';
      box.style.background = 'rgba(239,68,68,.12)';
      box.style.border = '1px solid rgba(239,68,68,.35)';
      box.style.color = '#ef4444';
    }
    if (typeof window.toast === 'function') window.toast(texto, 'err');
    else alert(texto);
    if (campoId) {
      var el = getCampo(campoId);
      if (el) {
        el.style.borderColor = '#ef4444';
        el.style.boxShadow = '0 0 0 2px rgba(239,68,68,.18)';
        try { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      }
    }
  }

  function mostrarStatusDiario(texto) {
    var box = getCampo('opDiaMsg');
    if (box) {
      box.textContent = texto;
      box.style.display = 'block';
      box.style.background = 'rgba(88,166,255,.12)';
      box.style.border = '1px solid rgba(88,166,255,.3)';
      box.style.color = 'var(--blue)';
    }
    msg(texto, 'ok');
  }

  function validarDiarioAntesSalvar(dados) {
    if (!String(dados.data_diario || '').trim()) {
      mostrarErroDiario('Informe a Data do diário antes de salvar.', 'opDia_data_diario');
      return false;
    }
    if (!String(dados.atividade_principal || '').trim()) {
      mostrarErroDiario('Preencha a Atividade principal antes de salvar o Diário de Obra.', 'opDia_atividade_principal');
      return false;
    }
    if (!String(dados.resumo_do_dia || '').trim()) {
      mostrarErroDiario('Preencha o Resumo do dia antes de salvar o Diário de Obra.', 'opDia_resumo_do_dia');
      return false;
    }
    return true;
  }

  function msgErroSalvarDiario(e) {
    var raw = (e && (e.message || e.details || e.hint || e.code)) ? String(e.message || e.details || e.hint || e.code) : String(e || '');
    var low = raw.toLowerCase();
    if ((e && e.code === '23505') || low.indexOf('ja existe diario') >= 0 || low.indexOf('duplicate') >= 0 || low.indexOf('unique') >= 0) {
      return 'Já existe um Diário de Obra para esta obra, data e turno.';
    }
    if ((e && e.code === '42501') || low.indexOf('permission') >= 0 || low.indexOf('permiss') >= 0 || low.indexOf('row-level security') >= 0 || low.indexOf('rls') >= 0) {
      return 'Seu perfil não tem permissão para criar ou editar Diário de Obra.';
    }
    return 'Não foi possível salvar o Diário de Obra. Verifique os dados e tente novamente.';
  }

  async function salvarDiario(evt) {
    if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
    if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
    if (!state.obraAtual) {
      msg('Abra uma obra antes de salvar o diario.', 'err');
      return;
    }
    if (state.diarioEditId && typeof window.sbAtualizarDiarioObra !== 'function') {
      msg('Arquivo supabase-obra-diario.js nao carregou: funcao de atualizar indisponivel.', 'err');
      return;
    }
    if (!state.diarioEditId && typeof window.sbCriarDiarioObra !== 'function') {
      msg('Arquivo supabase-obra-diario.js nao carregou: funcao de criar indisponivel.', 'err');
      return;
    }
    try {
      limparErroDiario();
      var dados = coletarDiarioForm();
      if (!validarDiarioAntesSalvar(dados)) return;
      mostrarStatusDiario('Salvando diário...');
      if (state.diarioEditId) await window.sbAtualizarDiarioObra(state.diarioEditId, dados);
      else await window.sbCriarDiarioObra(dados);
      msg('Diário de Obra salvo com sucesso.');
      state.diarioForm = null;
      state.diarioEditId = '';
      abrirAccordion('diario');
      await carregarDiariosObra();
    } catch (e) {
      console.error('[Operacional] Erro tecnico ao salvar diario:', e);
      mostrarErroDiario(msgErroSalvarDiario(e));
    }
  }

  function blocoDiarioPorCampo(campo) {
    for (var i = 0; i < DIARIO_BLOCOS.length; i++) {
      for (var j = 0; j < DIARIO_BLOCOS[i].campos.length; j++) {
        if (DIARIO_BLOCOS[i].campos[j][0] === campo) return 'b' + i;
      }
    }
    return '';
  }

  function novoRecurso() {
    if (!state.obraAtual) return;
    state.recursoEditId = '';
    state.recursoForm = { categoria: 'ferramentas_apoio', item: '', obrigatorio: false, quantidade_prevista: 1, status: 'previsto' };
    renderDetalhe();
    focarRecursoForm();
  }

  function editarRecurso(id) {
    var r = (state.recursos || []).find(function (it) { return it.id === id; });
    if (!r) return msg('Recurso nao encontrado.', 'err');
    state.recursoEditId = id;
    state.recursoForm = Object.assign({}, r);
    renderDetalhe();
    focarRecursoForm();
  }

  function coletarRecursoForm() {
    return {
      empresa_id: getEmpresaId(),
      obra_id: state.obraAtual ? state.obraAtual.id : '',
      categoria: ($('opRecCat') || {}).value || '',
      item: ($('opRecItem') || {}).value || '',
      obrigatorio: !!(($('opRecObrig') || {}).checked),
      quantidade_prevista: ($('opRecQtd') || {}).value || 1,
      responsavel: ($('opRecRespCampo') || {}).value || '',
      status: ($('opRecStatusCampo') || {}).value || 'previsto',
      observacoes: ($('opRecObsCampo') || {}).value || ''
    };
  }

  async function salvarRecurso() {
    if (!state.obraAtual) return;
    try {
      var dados = coletarRecursoForm();
      if (!String(dados.item || '').trim()) return msg('Informe o item do recurso.', 'err');
      if (state.recursoEditId) await window.sbAtualizarRecursoCampo(state.recursoEditId, dados);
      else await window.sbCriarRecursoCampo(dados);
      state.recursoForm = null;
      state.recursoEditId = '';
      msg('Recurso de campo salvo.');
      await carregarRecursosMobilizacaoObra();
      focarRecursosCampo();
    } catch (e) {
      msg('Erro ao salvar recurso: ' + (e.message || e), 'err');
    }
  }

  function abrirConfirmarExcluirRecurso(id) {
    var r = (state.recursos || []).find(function (it) { return it.id === id; });
    if (!r) return msg('Recurso nao encontrado.', 'err');
    state.recursoExcluir = { id: r.id, item: r.item || '' };
    renderDetalhe();
    focarRecursosCampo();
  }

  async function confirmarExcluirRecurso() {
    if (!state.recursoExcluir || !state.recursoExcluir.id) return;
    var id = state.recursoExcluir.id;
    try {
      await window.sbExcluirRecursoCampo(id);
      msg('Recurso excluido.');
      state.recursoExcluir = null;
      if (state.recursoEditId === id) {
        state.recursoForm = null;
        state.recursoEditId = '';
      }
      await carregarRecursosMobilizacaoObra();
      focarRecursosCampo();
    } catch (e) {
      msg('Erro ao excluir recurso: ' + (e.message || e), 'err');
    }
  }

  function cancelarExcluirRecurso() {
    state.recursoExcluir = null;
    renderDetalhe();
    focarRecursosCampo();
  }

  async function gerarRecursosPadrao() {
    if (!state.obraAtual) return;
    try {
      state.recursosCarregando = true;
      renderDetalhe();
      focarRecursosCampo();
      await window.sbCriarRecursosPadraoObra(getEmpresaId(), state.obraAtual.id);
      msg('Recursos padrao gerados sem duplicar itens existentes.');
      await carregarRecursosMobilizacaoObra();
      focarRecursosCampo();
    } catch (e) {
      state.recursosCarregando = false;
      renderDetalhe();
      focarRecursosCampo();
      msg('Erro ao gerar recursos padrao: ' + (e.message || e), 'err');
    }
  }

  function abrirEscolherRecursosPadrao() {
    state.recursosPadraoPicker = true;
    renderDetalhe();
    setTimeout(function () {
      var body = $('opRecursosPadraoBody');
      if (body) body.scrollTop = 0;
    }, 50);
  }

  function cancelarEscolherRecursosPadrao() {
    state.recursosPadraoPicker = false;
    renderDetalhe();
    focarRecursosCampo();
  }

  async function adicionarRecursosPadraoSelecionados() {
    if (!state.obraAtual) return;
    var checks = Array.prototype.slice.call(document.querySelectorAll('.op-rec-padrao-check:checked:not(:disabled)'));
    if (!checks.length) return msg('Selecione pelo menos um recurso padrao.', 'err');
    var existentes = {};
    (state.recursos || []).forEach(function (r) { existentes[(r.categoria || '') + '||' + (r.item || '')] = true; });
    var criados = 0;
    try {
      for (var i = 0; i < checks.length; i++) {
        var cat = checks[i].getAttribute('data-cat') || '';
        var item = checks[i].getAttribute('data-item') || '';
        if (!cat || !item || existentes[cat + '||' + item]) continue;
        try {
          await window.sbCriarRecursoCampo({
            empresa_id: getEmpresaId(),
            obra_id: state.obraAtual.id,
            categoria: cat,
            item: item,
            obrigatorio: false,
            quantidade_prevista: 1,
            status: 'previsto'
          });
          existentes[cat + '||' + item] = true;
          criados++;
        } catch (dup) {
          if (!(dup && dup.code === '23505')) throw dup;
          existentes[cat + '||' + item] = true;
        }
      }
      state.recursosPadraoPicker = false;
      msg(criados ? (criados + ' recurso(s) adicionados.') : 'Nenhum recurso novo para adicionar.');
      await carregarRecursosMobilizacaoObra();
      focarRecursosCampo();
    } catch (e) {
      msg('Erro ao adicionar recursos padrao: ' + (e.message || e), 'err');
    }
  }

  function novaMobilizacao() {
    if (!state.obraAtual) return;
    state.mobilizacaoEditId = '';
    state.mobilizacaoForm = {
      nome_colaborador: '',
      tipo_integrante: 'mao_obra_propria',
      empresa_integrante: '',
      qtd_tecnicos: '',
      forma_deslocamento: 'nao_aplicavel',
      ponto_encontro: state.obraAtual.ponto_encontro_equipe || '',
      horario_encontro: state.obraAtual.horario_encontro_equipe || '',
      precisa_adiantamento: false,
      valor_adiantamento: 0
    };
    renderDetalhe();
    focarMobilizacaoForm();
  }

  function editarMobilizacao(id) {
    var m = (state.mobilizacaoEquipe || []).find(function (it) { return it.id === id; });
    if (!m) return msg('Mobilizacao nao encontrada.', 'err');
    var meta = parseEquipeMeta(m.observacoes);
    state.mobilizacaoEditId = id;
    state.mobilizacaoForm = Object.assign({}, m, {
      tipo_integrante: meta.tipo || 'mao_obra_propria',
      empresa_integrante: meta.empresa || '',
      qtd_tecnicos: meta.qtd || '',
      observacoes: meta.obs || ''
    });
    renderDetalhe();
    focarMobilizacaoForm();
  }

  function coletarMobilizacaoForm() {
    return {
      empresa_id: getEmpresaId(),
      obra_id: state.obraAtual ? state.obraAtual.id : '',
      nome_colaborador: ($('opMobEqNome') || {}).value || '',
      funcao: ($('opMobEqFuncao') || {}).value || '',
      tipo_integrante: ($('opMobEqTipo') || {}).value || '',
      empresa_integrante: ($('opMobEqEmpresa') || {}).value || '',
      qtd_tecnicos: ($('opMobEqQtd') || {}).value || '',
      forma_deslocamento: ($('opMobEqForma') || {}).value || '',
      carona_com: ($('opMobEqCarona') || {}).value || '',
      ponto_encontro: ($('opMobEqPonto') || {}).value || '',
      horario_encontro: ($('opMobEqHorario') || {}).value || null,
      precisa_adiantamento: !!(($('opMobEqAdiant') || {}).checked),
      valor_adiantamento: ($('opMobEqValor') || {}).value || 0,
      veiculo_utilizado: ($('opMobEqVeiculo') || {}).value || '',
      motorista: ($('opMobEqMotorista') || {}).value || '',
      precisa_reembolso: !!(($('opMobEqReembolso') || {}).checked),
      comprovante_obrigatorio: !!(($('opMobEqComp') || {}).checked),
      observacoes: ($('opMobEqObs') || {}).value || ''
    };
  }

  async function salvarMobilizacao() {
    if (!state.obraAtual) return;
    try {
      var dados = coletarMobilizacaoForm();
      if (!String(dados.nome_colaborador || '').trim()) return msg('Informe o nome do colaborador.', 'err');
      dados.observacoes = serializarEquipeObs(dados);
      var editando = !!state.mobilizacaoEditId;
      if (editando) await window.sbAtualizarMobilizacaoEquipe(state.mobilizacaoEditId, dados);
      else await window.sbCriarMobilizacaoEquipe(dados);
      state.mobilizacaoForm = null;
      state.mobilizacaoEditId = '';
      state.mobilizacaoLoaded = false;
      msg(editando ? 'Colaborador atualizado com sucesso.' : 'Colaborador adicionado com sucesso.');
      await carregarMobilizacaoObra();
      focarMobilizacaoEquipe();
    } catch (e) {
      console.error('[Operacional] Erro tecnico ao salvar colaborador:', e);
      msg('Não foi possível salvar o colaborador. Verifique os dados e tente novamente.', 'err');
    }
  }

  function abrirConfirmarExcluirMobilizacao(id) {
    var m = (state.mobilizacaoEquipe || []).find(function (it) { return it.id === id; });
    if (!m) return msg('Mobilizacao nao encontrada.', 'err');
    state.mobilizacaoExcluir = { id: m.id, nome: m.nome_colaborador || '' };
    renderDetalhe();
    focarMobilizacaoEquipe();
  }

  async function confirmarExcluirMobilizacao() {
    if (!state.mobilizacaoExcluir || !state.mobilizacaoExcluir.id) return;
    var id = state.mobilizacaoExcluir.id;
    try {
      await window.sbExcluirMobilizacaoEquipe(id);
      msg('Colaborador excluido com sucesso.');
      state.mobilizacaoExcluir = null;
      if (state.mobilizacaoEditId === id) {
        state.mobilizacaoForm = null;
        state.mobilizacaoEditId = '';
      }
      state.mobilizacaoLoaded = false;
      await carregarMobilizacaoObra();
      focarMobilizacaoEquipe();
    } catch (e) {
      msg('Erro ao excluir mobilizacao: ' + (e.message || e), 'err');
    }
  }

  function cancelarExcluirMobilizacao() {
    state.mobilizacaoExcluir = null;
    renderDetalhe();
    focarMobilizacaoEquipe();
  }

  function cancelarRecurso() {
    state.recursoForm = null;
    state.recursoEditId = '';
    renderDetalhe();
    focarRecursosCampo();
  }

  function cancelarMobilizacao() {
    state.mobilizacaoForm = null;
    state.mobilizacaoEditId = '';
    renderDetalhe();
    focarMobilizacaoEquipe();
  }

  function onFase1cClick(e) {
    var acc = e.target && e.target.closest ? e.target.closest('[data-op-accordion]') : null;
    if (acc) {
      e.preventDefault();
      e.stopPropagation();
      toggleAccordion(acc.getAttribute('data-op-accordion'));
      return;
    }
    var btn = e.target && e.target.closest ? e.target.closest('[data-op-1c-action]') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var action = btn.getAttribute('data-op-1c-action');
    var id = btn.getAttribute('data-id') || '';
    if (action === 'gerar-recursos') gerarRecursosPadrao();
    else if (action === 'escolher-recursos-padrao') abrirEscolherRecursosPadrao();
    else if (action === 'cancelar-recursos-padrao') cancelarEscolherRecursosPadrao();
    else if (action === 'adicionar-recursos-padrao') adicionarRecursosPadraoSelecionados();
    else if (action === 'novo-recurso') novoRecurso();
    else if (action === 'editar-recurso') editarRecurso(id);
    else if (action === 'salvar-recurso') salvarRecurso();
    else if (action === 'cancelar-recurso') cancelarRecurso();
    else if (action === 'excluir-recurso') abrirConfirmarExcluirRecurso(id);
    else if (action === 'confirmar-excluir-recurso') confirmarExcluirRecurso();
    else if (action === 'cancelar-excluir-recurso') cancelarExcluirRecurso();
    else if (action === 'nova-mobilizacao') novaMobilizacao();
    else if (action === 'editar-mobilizacao') editarMobilizacao(id);
    else if (action === 'salvar-mobilizacao') salvarMobilizacao();
    else if (action === 'cancelar-mobilizacao') cancelarMobilizacao();
    else if (action === 'excluir-mobilizacao') abrirConfirmarExcluirMobilizacao(id);
    else if (action === 'confirmar-excluir-mobilizacao') confirmarExcluirMobilizacao();
    else if (action === 'cancelar-excluir-mobilizacao') cancelarExcluirMobilizacao();
  }

  function onDiarioClick(e) {
    var bloco = e.target && e.target.closest ? e.target.closest('[data-op-dia-block]') : null;
    if (bloco) {
      e.preventDefault();
      e.stopPropagation();
      toggleDiarioBloco(bloco.getAttribute('data-op-dia-block'));
      return;
    }
    var btn = e.target && e.target.closest ? e.target.closest('[data-op-dia-action]') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var action = btn.getAttribute('data-op-dia-action');
    var id = btn.getAttribute('data-id') || '';
    if (action === 'novo') novoDiario();
    else if (action === 'editar') editarDiario(id);
    else if (action === 'excluir') excluirDiario(id);
    else if (action === 'cancelar') cancelarDiario();
    else if (action === 'salvar') salvarDiario(e);
    else if (action === 'limpar-filtro') limparFiltroDiario();
  }

  function onOperacionalInput(e) {
    if (e.target && e.target.classList && e.target.classList.contains('op-auto-textarea')) {
      ajustarTextareas(e.target.parentNode || document);
    }
  }

  async function excluirDiario(id) {
    if (!window.confirm('Excluir este diario de obra?')) return;
    try {
      await window.sbExcluirDiarioObra(id);
      msg('Diario excluido.');
      if (state.diarioEditId === id) cancelarDiario();
      abrirAccordion('diario');
      await carregarDiariosObra();
    } catch (e) {
      msg('Erro ao excluir diario: ' + (e.message || e), 'err');
    }
  }

  function filtrarDiarios() {
    abrirAccordion('diario');
    state.diarioFiltroData = ($('opDiaFiltroData') || {}).value || '';
    state.diarioFiltroStatus = ($('opDiaFiltroStatus') || {}).value || '';
    renderDetalhe();
  }

  function limparFiltroDiario() {
    abrirAccordion('diario');
    state.diarioFiltroData = '';
    state.diarioFiltroStatus = '';
    renderDetalhe();
  }

  function opButtonHtml(pid, label, action, kind, disabled) {
    var bg = kind === 'open' ? '#2563eb' : kind === 'retro' ? 'var(--bg3)' : 'var(--accent)';
    var color = kind === 'open' ? '#fff' : kind === 'retro' ? 'var(--text2)' : '#000';
    return '<button type="button" ' + (disabled ? 'disabled ' : '') + 'style="padding:.28rem .5rem;border:1px solid var(--border);border-radius:6px;background:' + bg + ';color:' + color + ';font-size:.7rem;font-weight:800;cursor:' + (disabled ? 'default' : 'pointer') + '" onclick="event.stopPropagation();' + action + '(\'' + esc(pid) + '\')">' + esc(label) + '</button>';
  }

  async function renderBotaoProposta(container, p) {
    if (!container || !p || !canTerObra(p)) {
      if (container) container.innerHTML = '';
      return;
    }
    container.innerHTML = opButtonHtml(p.id, 'Verificando obra...', 'void', 'retro', true);
    try {
      var obra = await window.sbBuscarObraPorProposta(getEmpresaId(), p.id);
      if (obra) {
        container.innerHTML = '<button type="button" style="padding:.28rem .5rem;border:1px solid #2563eb;border-radius:6px;background:#2563eb;color:#fff;font-size:.7rem;font-weight:800;cursor:pointer" onclick="event.stopPropagation();opAbrirObraComercial(\'' + esc(obra.id) + '\')">Abrir Obra</button>';
      } else if (isGanho(p) || isAprovado(p)) {
        container.innerHTML = '<button type="button" style="padding:.28rem .5rem;border:1px solid var(--accent);border-radius:6px;background:var(--accent);color:#000;font-size:.7rem;font-weight:800;cursor:pointer" onclick="event.stopPropagation();opCriarObraDePropostaId(\'' + esc(p.id) + '\',false)">Criar Obra</button>';
      } else {
        container.innerHTML = '<button type="button" style="padding:.28rem .5rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text2);font-size:.7rem;font-weight:800;cursor:pointer" onclick="event.stopPropagation();opCriarObraDePropostaId(\'' + esc(p.id) + '\',true)">Criar Obra Retroativa</button>';
      }
    } catch (e) {
      container.innerHTML = '<span style="font-size:.68rem;color:#ef4444">Erro ao verificar obra</span>';
    }
  }

  function hidratarAcoesPropostas(lista) {
    if (typeof window.sbBuscarObraPorProposta !== 'function') return;
    var porId = {};
    (lista || []).forEach(function (p) { if (p && p.id) porId[p.id] = p; });
    document.querySelectorAll('[data-op-prop-id]').forEach(function (el) {
      var p = porId[el.getAttribute('data-op-prop-id')] || propPorId(el.getAttribute('data-op-prop-id'));
      renderBotaoProposta(el, p);
    });
  }

  function acoesPropostaHtml(p) {
    if (!canTerObra(p)) return '';
    return '<div data-op-prop-id="' + esc(p.id) + '" style="margin-top:.45rem;display:flex;gap:.35rem;align-items:center;position:relative;z-index:2" onclick="event.stopPropagation()">'
      + '<button type="button" disabled style="padding:.28rem .5rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text3);font-size:.7rem;font-weight:800">Verificando obra...</button>'
      + '</div>';
  }

  async function criarObraDePropostaId(pid, retro) {
    var p = propPorId(pid);
    if (!p) return msg('Proposta nao encontrada.', 'err');
    if (retro && !window.confirm('Criar obra retroativa para esta proposta?')) return;
    if (!retro && !(p.fas === 'ganho' || p.fas === 'aprovado')) return msg('A obra so pode ser criada para proposta com status comercial Ganho.', 'err');
    try {
      var res = await window.sbCriarObraDeProposta(p);
      // Negocio fechado em 'ganho' inicia no Operacional como 'aprovado'
      // (status guardado na obra; a proposta permanece 'ganho' no Comercial).
      if (res && res.criada && res.obra && p.fas === 'ganho' && typeof window.sbAtualizarObra === 'function') {
        try { await window.sbAtualizarObra(res.obra.id, { status_operacional: 'aprovado' }); } catch (e) {}
      }
      msg(res.criada ? 'Obra criada com sucesso.' : 'Esta proposta ja tinha uma obra.');
      hidratarAcoesPropostas([p]);
      if (window.Router && window.Router.getAtivo && window.Router.getAtivo() === 'operacional') {
        await carregarObras();
      }
    } catch (e) {
      msg('Erro ao criar obra: ' + (e.message || e), 'err');
    }
  }

  function abrirObraComercial(id) {
    if (window.Router) window.Router.ir('operacional');
    setTimeout(function () { abrirObra(id); }, 120);
  }

  function renderActionBar(p) {
    var actions = document.querySelector('#actionBar .ab-actions');
    if (!actions) return;
    var holder = $('opActionBarHolder');
    if (!canTerObra(p)) {
      if (holder) holder.remove();
      return;
    }
    if (!holder) {
      holder = document.createElement('span');
      holder.id = 'opActionBarHolder';
      holder.style.display = 'inline-flex';
      holder.style.marginRight = '.35rem';
      actions.insertBefore(holder, actions.firstChild);
    }
    holder.setAttribute('data-op-prop-id', p.id);
    renderBotaoProposta(holder, p);

    // Navegação entre obras (◀ Anterior | ▶ Próximo)
    var navHolder = $('opNavHolder');
    if (!navHolder) {
      navHolder = document.createElement('span');
      navHolder.id = 'opNavHolder';
      navHolder.style.cssText = 'display:inline-flex;gap:.25rem;margin-right:.35rem';
      actions.insertBefore(navHolder, actions.firstChild);
    }
    navHolder.innerHTML =
      '<button class="btn bg bsm" onclick="opNavObra(-1)" title="Obra anterior">◀</button>'
      + '<button class="btn bg bsm" onclick="opNavObra(+1)" title="Próxima obra">▶</button>';
  }

  function limparActionBar() {
    var holder = $('opActionBarHolder');
    if (holder) holder.remove();
  }

  function setFiltroStatus(st) {
    state.status = st || '';
    if (window.Router) window.Router.ir('operacional');
    setTimeout(function () {
      var sel = $('opStatus');
      if (sel) sel.value = state.status;
      renderLista();
    }, 80);
  }

  function gestaoAtualizarPrintConfig() {
    var size = $('opPrintSize');
    var scale = $('opPrintScale');
    var fitW = $('opPrintFitWidth');
    _opPrintConfig.size = size ? size.value : 'a4';
    _opPrintConfig.scale = scale ? Number(scale.value) : 100;
    _opPrintConfig.fitWidth = fitW ? fitW.checked : true;
    var ori = document.querySelector('input[name="opPrintOrientation"]:checked');
    _opPrintConfig.orientation = ori ? ori.value : 'portrait';
    var mar = document.querySelector('input[name="opPrintMargin"]:checked');
    _opPrintConfig.margin = mar ? mar.value : 'normal';
    atualizarPreviewGestao(0);
  }

  window.rOperacional = rOperacional;
  window.opCarregarObras = carregarObras;
  window.opFiltros = filtros;
  window.opSetAno = opSetAno;
  window._opExecDatasMap = window._opExecDatasMap || {};
  window.opCarregarDatasExecucao = carregarDatasExecucao;
  window.opMudarStatusNegocio = mudarStatusNegocio;
  window.opDesfazerObra = abrirDesfazerObra;
  window.opConfirmarDesfazerObra = confirmarDesfazerObra;
  window.opFecharDesfazerObra = fecharDesfazerObra;
  window.opLimparFiltros = limparFiltros;
  window.opAbrirObra = abrirObra;
  window.opFecharDetalhe = fecharDetalhe;
  window.opSalvarObra = salvarObra;
  window.opNovoDiario = novoDiario;
  window.opEditarDiario = editarDiario;
  window.opCancelarDiario = cancelarDiario;
  window.opSalvarDiario = salvarDiario;
  window.opExcluirDiario = excluirDiario;
  window.opFiltrarDiarios = filtrarDiarios;
  window.opLimparFiltroDiario = limparFiltroDiario;
  window.opSetFiltroStatus = setFiltroStatus;
  window.opHidratarAcoesPropostas = hidratarAcoesPropostas;
  window.opAcoesPropostaHtml = acoesPropostaHtml;
  window.opCriarObraDePropostaId = criarObraDePropostaId;
  window.opAbrirObraComercial = abrirObraComercial;
  window.opRenderActionBar = renderActionBar;
  window.opLimparActionBar = limparActionBar;
  window.opCarregarRecursosMobilizacaoObra = carregarRecursosMobilizacaoObra;
  window.opGestaoPdf = gestaoPdf;
  window.opGestaoTexto = gestaoExportarTexto;
  window.opGestaoImprimir = gestaoImprimir;
  window.opGestaoAtualizarModoRelatorio = gestaoAtualizarModoRelatorio;
  window.opGestaoAtualizarPrintConfig = gestaoAtualizarPrintConfig;
  window.opTogglePreviewGestao = togglePreviewGestao;
  window.opToggleSectionBreak = toggleSectionBreak;
  // Função simples: limpar assinaturas do banco direto via RPC
  window.opGestaoLimparAssinaturasCompleto = async function() {
    var doc = state.gestaoDocumento || {};
    if (!doc.id) { msg('Nenhum documento.', 'err'); return; }
    if (!doc.empresa_id) { msg('Empresa não identificada.', 'err'); return; }
    if (!confirm('DELETAR ASSINATURAS do banco?\n\nNão pode ser desfeito!')) return;

    try {
      console.log('🗑️ Deletando assinaturas:', { doc_id: doc.id, empresa_id: doc.empresa_id });

      var res = await window.sbClient.rpc('limpar_assinaturas_gestao', {
        p_doc_id: doc.id,
        p_empresa_id: doc.empresa_id
      });

      console.log('📋 Resposta RPC:', res);
      if (res.error) {
        console.error('❌ Erro na RPC:', res.error);
        throw res.error;
      }

      console.log('✅ RPC executada com sucesso:', res.data);
      msg('✅ ' + (res.data && res.data.message ? res.data.message : 'Assinaturas deletadas'));

      // Atualizar estado em memória
      state.gestaoDocumento.assinatura_cliente = '';
      state.gestaoDocumento.assinatura_empresa = '';
      state.gestaoDocumento.responsavel_cliente_nome = '';
      state.gestaoDocumento.responsavel_empresa_nome = '';
      state.gestaoDocumento.assinado_cliente_em = null;
      state.gestaoDocumento.assinado_empresa_em = null;

      // Recarregar após 1s
      setTimeout(function() {
        console.log('🔄 Recarregando página...');
        location.reload();
      }, 1000);
    } catch (e) {
      console.error('💥 ERRO:', e);
      msg('❌ Erro: ' + (e.message || JSON.stringify(e)), 'err');
    }
  };

  window.opGestaoLimparAssinatura = limparAssinaturaGestao;
  window.opGestaoSalvarRascunho = salvarRascunhoGestao;
  window.opGestaoFinalizar = finalizarGestao;

  // Navegação entre obras (◀ Anterior | ▶ Próximo)
  window.opNavObra = function(dir) {
    if (!state.obraAtual) return;
    var lista = obrasFiltradas();
    var idx = lista.findIndex(function(o) { return o.id === state.obraAtual.id; });
    if (idx < 0) return;
    var next = lista[idx + dir];
    if (next) abrirObra(next.id);
  };

  window.addEventListener('afterprint', removerDocumentoImpressaoGestao);
  document.addEventListener('click', onFase1cClick, true);
  document.addEventListener('click', onDiarioClick, true);
  document.addEventListener('input', onOperacionalInput, true);

  // ── Listener: atualizar preview em tempo real ───────────────────────────
  document.addEventListener('input', function(e) {
    if (_opPreviewAtivo && e.target && e.target.closest && e.target.closest('#opObraPanel')) {
      atualizarPreviewGestao();
    }
  }, true);

  // ── Listener: troca de empresa ───────────────────────────
  // Disparado por multi-empresa.js via CustomEvent('empresa:changed')
  // Limpa imediatamente o estado operacional e recarrega se o módulo estiver ativo
  window.addEventListener('empresa:changed', function () {
    // Limpar estado: obras, detalhe aberto, filtros e subestados
    state.obras = [];
    state.obraAtual = null;
    state.erro = '';
    state.status = '';
    state.cliente = '';
    state.busca = '';
    state.diarios = [];
    state.diariosLoaded = false;
    state.diarioForm = null;
    state.diarioEditId = '';
    state.diarioCarregando = false;
    state.diarioErro = '';
    state.recursos = [];
    state.recursosLoaded = false;
    state.recursosCarregando = false;
    state.recursosErro = '';
    state.recursoForm = null;
    state.recursoEditId = '';
    state.recursoExcluir = null;
    state.recursosPadraoPicker = false;
    state.mobilizacaoEquipe = [];
    state.mobilizacaoLoaded = false;
    state.mobilizacaoCarregando = false;
    state.mobilizacaoErro = '';
    state.mobilizacaoForm = null;
    state.mobilizacaoEditId = '';
    state.mobilizacaoExcluir = null;
    state.accordionOpen = {};

    // Atualiza as datas oficiais de execucao (KPIs comerciais) ao trocar de empresa.
    window._opExecDatasMap = {};
    carregarDatasExecucao();

    // Se o módulo Operacional está ativo, re-renderizar imediatamente
    if (window.Router && window.Router.getAtivo() === 'operacional') {
      rOperacional();
    }
  });

  // Carga inicial das datas de execucao (apos sbClient/empresa estarem prontos).
  setTimeout(function () { try { carregarDatasExecucao(); } catch (e) {} }, 1500);

})(window, document);

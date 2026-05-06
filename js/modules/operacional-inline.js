// ============================================================
// operacional-inline.js - Fase 1A do modulo Operacional
// ============================================================
(function (window, document) {
  'use strict';

  var state = {
    obras: [],
    carregando: false,
    erro: '',
    status: '',
    cliente: '',
    busca: '',
    obraAtual: null,
    diarios: [],
    diarioCarregando: false,
    diarioErro: '',
    diarioFiltroData: '',
    diarioFiltroStatus: '',
    diarioForm: null,
    diarioEditId: '',
    recursos: [],
    recursosErro: '',
    recursosCarregando: false,
    recursoForm: null,
    recursoEditId: '',
    recursoExcluir: null,
    mobilizacaoEquipe: [],
    mobilizacaoErro: '',
    mobilizacaoCarregando: false,
    mobilizacaoForm: null,
    mobilizacaoEditId: ''
  };

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
    }
  };

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
    else alert(texto);
  }

  function labelStatus(st) {
    return (window.OP_STATUS_LABELS && window.OP_STATUS_LABELS[st]) || st || '-';
  }

  function statusOptions(valor) {
    var lista = window.OP_STATUS_OPERACIONAL || [];
    return lista.map(function (st) {
      return '<option value="' + esc(st) + '"' + (st === valor ? ' selected' : '') + '>' + esc(labelStatus(st)) + '</option>';
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
      + DIARIO_BLOCOS.map(function (bloco) {
        return '<div style="border-top:1px solid var(--border);padding-top:.75rem;margin-top:.75rem">'
          + '<div style="font-size:.78rem;color:var(--accent);font-weight:900;text-transform:uppercase;margin-bottom:.65rem">' + esc(bloco.titulo) + '</div>'
          + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:.7rem">'
          + bloco.campos.map(function (def) { return renderDiarioCampo(def, dados); }).join('')
          + '</div></div>';
      }).join('')
      + '<div style="height:1rem"></div></div>';
  }

  function diarioOverlayHtml() {
    if (!state.diarioForm) return '';
    return '<div id="opDiarioOverlay" style="position:fixed;inset:0;z-index:940;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opDiarioDialog" style="width:min(1060px,96vw);max-height:92vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden;display:flex;flex-direction:column">'
      + '<div style="position:sticky;top:0;z-index:6;background:var(--bg2);border-bottom:1px solid var(--border);padding:.95rem 1rem;display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start">'
      + '<div><div style="font-size:1.2rem;font-weight:900;color:var(--blue);text-transform:uppercase;letter-spacing:.02em">' + (state.diarioEditId ? 'Editar Diario de Obra' : 'Novo Diario de Obra') + '</div>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.18rem">Ambiente do Diario de Obra. Use Voltar para retornar ao detalhe da obra.</div></div>'
      + '<button type="button" class="btn bg" data-op-dia-action="cancelar" style="min-height:42px">Voltar</button></div>'
      + '<div id="opDiarioBody" style="overflow:auto;flex:1;min-height:0;padding:1rem 1rem 6.5rem">'
      + diarioFormHtml()
      + '</div>'
      + '<div id="opDiarioFooter" style="flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:.75rem 1rem calc(.75rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.6rem;box-shadow:0 -10px 28px rgba(0,0,0,.22)">'
      + '<button type="button" class="btn bg" data-op-dia-action="cancelar" style="min-height:44px">Cancelar / Voltar</button>'
      + '<button type="button" class="btn ba" data-op-dia-action="salvar" style="min-height:44px">Salvar Diario</button>'
      + '</div></div></div>';
  }

  function diarioSectionHtml() {
    var statusSel = '<option value="">Todos</option>' + listaOptions('status_dia', state.diarioFiltroStatus, false);
    var lista = diarioFiltrados();
    var listaHtml = '';
    if (state.diarioCarregando) {
      listaHtml = '<div style="color:var(--text3);font-size:.8rem;padding:.6rem 0">Carregando diarios...</div>';
    } else if (state.diarioErro) {
      listaHtml = '<div style="color:#ef4444;font-size:.8rem;padding:.6rem 0">' + esc(state.diarioErro) + '</div>';
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
    return '<section id="opDiarioSection" style="margin-top:1.1rem;padding:1rem;border:1px solid rgba(88,166,255,.28);border-radius:10px;background:rgba(88,166,255,.035)">'
      + '<div style="display:flex;justify-content:space-between;gap:.8rem;align-items:flex-start;margin-bottom:.9rem;flex-wrap:wrap">'
      + '<div><div style="font-size:1.15rem;color:var(--accent);font-weight:900;text-transform:uppercase;letter-spacing:.02em">Diario de Obra</div>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.18rem">Registro oficial consolidado do dia da obra.</div></div>'
      + '<button type="button" class="btn ba" data-op-dia-action="novo" style="min-height:42px;padding:.55rem .9rem">Novo Diario</button></div>'
      + '<div class="op-filter-grid" style="display:grid;grid-template-columns:180px 220px auto;gap:.6rem;align-items:end;margin-bottom:.75rem">'
      + campo('Filtrar por data', '<input id="opDiaFiltroData" type="date" value="' + esc(state.diarioFiltroData || '') + '" onchange="opFiltrarDiarios()" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">')
      + campo('Filtrar por status', '<select id="opDiaFiltroStatus" onchange="opFiltrarDiarios()" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">' + statusSel + '</select>')
      + '<button type="button" class="btn bg" data-op-dia-action="limpar-filtro">Limpar</button></div>'
      + '<div id="opDiarioLista">' + listaHtml + '</div>'
      + '</section>';
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
      + '<div style="margin-top:.75rem">' + campo('Observacoes de recebimento', textarea('opRecObs', o.observacoes_recebimento, 90)) + '</div>');
  }

  function segurancaSectionHtml(o) {
    return sectionBox('Seguranca / Liberacao da Obra', 'Requisitos de liberacao antes de mobilizar a equipe.',
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
      + '<div style="margin-top:.75rem">' + campo('Observacoes de seguranca', textarea('opSegObs', o.observacoes_seguranca_obra, 90)) + '</div>');
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
      + '<div style="margin-top:.75rem">' + campo('Observacoes de horario', textarea('opJorObs', o.observacoes_horario, 90)) + '</div>');
  }

  function alimentacaoMobilizacaoSectionHtml(o) {
    return sectionBox('Mobilizacao / Logistica', 'Alimentacao, deslocamento e preparacao da equipe para a obra.',
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
      + '<div style="margin-top:.75rem">' + campo('Observacoes de mobilizacao', textarea('opMobObs', o.observacoes_mobilizacao_obra, 90)) + '</div>'
      + mobilizacaoEquipeHtml());
  }

  function contingenciaSectionHtml(o) {
    return sectionBox('Contingencia de Material', 'Plano para falta de material e compras emergenciais.',
      '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem">'
      + campo('Responsavel compra emergencial', input('opContCompra', o.responsavel_compra_emergencial))
      + campo('Responsavel retirada/busca', input('opContRetirada', o.responsavel_retirada_emergencial))
      + checkCampo('opContAprovacao', 'Precisa aprovacao para compra emergencial?', o.precisa_aprovacao_compra_emergencial !== false)
      + '</div>'
      + '<div style="margin-top:.75rem">' + campo('Plano de contingencia material', textarea('opContPlano', o.plano_contingencia_material, 90)) + '</div>'
      + '<div style="margin-top:.75rem">' + campo('Observacoes de contingencia', textarea('opContObs', o.observacoes_contingencia_material, 90)) + '</div>');
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
    return '<div id="opRecursoOverlay" style="position:fixed;inset:0;z-index:945;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opRecursoDialog" style="width:min(820px,96vw);max-height:92vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.65);overflow:hidden;display:flex;flex-direction:column">'
      + '<div style="position:sticky;top:0;z-index:6;background:var(--bg2);border-bottom:1px solid var(--border);padding:.95rem 1rem;display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start">'
      + '<div><div style="font-size:1.2rem;font-weight:900;color:var(--blue);text-transform:uppercase;letter-spacing:.02em">' + (state.recursoEditId ? 'Editar Recurso de Campo' : 'Novo Recurso de Campo') + '</div>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.18rem">Ambiente de Recursos de Campo. Use Voltar para retornar a obra.</div></div>'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-recurso" style="min-height:42px">Voltar</button></div>'
      + '<div id="opRecursoBody" style="overflow:auto;flex:1;min-height:0;padding:1rem 1rem 6.5rem">'
      + recursoFormHtml()
      + '</div>'
      + '<div id="opRecursoFooter" style="flex-shrink:0;background:var(--bg2);border-top:1px solid var(--border);padding:.75rem 1rem calc(.75rem + env(safe-area-inset-bottom));display:flex;justify-content:flex-end;gap:.6rem;box-shadow:0 -10px 28px rgba(0,0,0,.22)">'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-recurso" style="min-height:44px">Cancelar / Voltar</button>'
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

  function recursosCampoHtml() {
    var lista = state.recursos || [];
    var cards = state.recursosCarregando ? '<div style="color:var(--text3);font-size:.8rem">Carregando recursos...</div>' : '';
    if (!cards && state.recursosErro) cards = '<div style="color:#ef4444;font-size:.8rem">' + esc(state.recursosErro) + '</div>';
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
      + '<button type="button" class="btn bg" data-op-1c-action="gerar-recursos">Gerar recursos padrao</button>'
      + '<button type="button" class="btn ba" data-op-1c-action="novo-recurso">Novo recurso</button></div>'
      + '<div>' + cards + '</div>') + '</div>';
  }

  function mobilizacaoFormHtml() {
    if (!state.mobilizacaoForm) return '';
    var m = state.mobilizacaoForm;
    return '<div style="border:1px solid rgba(88,166,255,.35);border-radius:9px;background:rgba(88,166,255,.055);padding:.85rem;margin:.75rem 0">'
      + '<div style="font-size:.82rem;color:var(--blue);font-weight:900;text-transform:uppercase;margin-bottom:.6rem">' + (state.mobilizacaoEditId ? 'Editar colaborador na mobilizacao' : 'Adicionar colaborador a mobilizacao') + '</div>'
      + '<div class="op-form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.65rem">'
      + campo('Nome colaborador', input('opMobEqNome', m.nome_colaborador))
      + campo('Funcao', input('opMobEqFuncao', m.funcao))
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
      + '<div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.7rem;flex-wrap:wrap">'
      + '<button type="button" class="btn bg" data-op-1c-action="cancelar-mobilizacao">Cancelar</button>'
      + '<button type="button" class="btn ba" data-op-1c-action="salvar-mobilizacao">Salvar colaborador</button>'
      + '</div></div>';
  }

  function mobilizacaoEquipeHtml() {
    var lista = state.mobilizacaoEquipe || [];
    var cards = state.mobilizacaoCarregando ? '<div style="color:var(--text3);font-size:.8rem">Carregando mobilizacao da equipe...</div>' : '';
    if (!cards && state.mobilizacaoErro) cards = '<div style="color:#ef4444;font-size:.8rem">' + esc(state.mobilizacaoErro) + '</div>';
    if (!cards && !lista.length) cards = '<div style="color:var(--text3);font-size:.8rem">Nenhum colaborador cadastrado na mobilizacao desta obra.</div>';
    if (!cards) {
      cards = lista.map(function (m) {
        return '<div style="border:1px solid var(--border);border-radius:9px;background:var(--bg3);padding:.75rem;margin-bottom:.55rem">'
          + '<div style="display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap">'
          + '<div><div style="font-size:.9rem;font-weight:900;color:var(--text)">' + esc(m.nome_colaborador) + '</div>'
          + '<div style="font-size:.76rem;color:var(--text3);margin-top:.14rem">' + esc(m.funcao || '-') + ' | ' + esc(labelObj('forma_deslocamento', m.forma_deslocamento)) + '</div></div>'
          + '<div style="display:flex;gap:.4rem;flex-wrap:wrap"><button type="button" class="btn bg bsm" data-op-1c-action="editar-mobilizacao" data-id="' + esc(m.id) + '">Editar</button>'
          + '<button type="button" class="btn bd bsm" data-op-1c-action="excluir-mobilizacao" data-id="' + esc(m.id) + '">Excluir</button></div></div>'
          + '<div style="font-size:.8rem;color:var(--text2);line-height:1.45;margin-top:.5rem">Encontro: ' + esc(m.ponto_encontro || '-') + ' ' + esc(m.horario_encontro || '') + (m.precisa_adiantamento ? ' | Adiant.: ' + money(m.valor_adiantamento) : '') + (m.precisa_reembolso ? ' | Reembolso' : '') + '</div>'
          + (m.observacoes ? '<div style="font-size:.78rem;color:var(--text3);margin-top:.35rem;white-space:pre-wrap">' + esc(m.observacoes) + '</div>' : '')
          + '</div>';
      }).join('');
    }
    return '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">'
      + '<div style="display:flex;justify-content:space-between;gap:.7rem;align-items:center;flex-wrap:wrap;margin-bottom:.7rem">'
      + '<div><div style="font-size:.88rem;color:var(--text);font-weight:900;text-transform:uppercase">Como cada colaborador vai ate a obra</div>'
      + '<div style="font-size:.76rem;color:var(--text3)">Cadastro manual, sem alterar o RH.</div></div>'
      + '<button type="button" class="btn ba" data-op-1c-action="nova-mobilizacao">Adicionar colaborador</button></div>'
      + mobilizacaoFormHtml()
      + cards
      + '</div>';
  }

  function operacionalPlanejamentoHtml(o) {
    return recebimentoSectionHtml(o)
      + segurancaSectionHtml(o)
      + jornadaSectionHtml(o)
      + alimentacaoMobilizacaoSectionHtml(o)
      + contingenciaSectionHtml(o)
      + recursosCampoHtml();
  }

  function getEmpresaId() {
    if (typeof window.getEmpresaAtivaId === 'function') return window.getEmpresaAtivaId();
    if (typeof window.getEmpresaAtiva === 'function') {
      var emp = window.getEmpresaAtiva();
      if (emp && emp.id) return emp.id;
    }
    return window._empresaAtiva && window._empresaAtiva.id ? window._empresaAtiva.id : '';
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

  function canTerObra(p) {
    return isAprovado(p) || isRetroativo(p);
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
      + '<div style="max-width:1180px;margin:0 auto;padding:1rem">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem">'
      + '<div><h2 style="margin:0;color:var(--text);font-size:1.35rem">Operacional</h2>'
      + '<div style="color:var(--text3);font-size:.82rem;margin-top:.15rem">Obras criadas a partir de propostas aprovadas.</div></div>'
      + '<button class="btn bg" onclick="opCarregarObras()">Atualizar</button>'
      + '</div>'
      + '<div class="card" style="margin-bottom:1rem">'
      + '<div style="display:grid;grid-template-columns:1.2fr .9fr .9fr auto;gap:.65rem;align-items:end">'
      + '<label style="display:flex;flex-direction:column;gap:.22rem;font-size:.7rem;color:var(--text3);font-weight:700;text-transform:uppercase">Busca'
      + '<input id="opBusca" placeholder="Codigo, proposta ou titulo" value="' + esc(state.busca) + '" oninput="opFiltros()" style="padding:.5rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)"></label>'
      + '<label style="display:flex;flex-direction:column;gap:.22rem;font-size:.7rem;color:var(--text3);font-weight:700;text-transform:uppercase">Status'
      + '<select id="opStatus" onchange="opFiltros()" style="padding:.5rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)"><option value="">Todos</option>' + statusOptions(state.status) + '</select></label>'
      + '<label style="display:flex;flex-direction:column;gap:.22rem;font-size:.7rem;color:var(--text3);font-weight:700;text-transform:uppercase">Cliente'
      + '<input id="opCliente" placeholder="Filtrar cliente" value="' + esc(state.cliente) + '" oninput="opFiltros()" style="padding:.5rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)"></label>'
      + '<button class="btn bg" onclick="opLimparFiltros()">Limpar</button>'
      + '</div>'
      + '</div>'
      + '<div id="opLista"></div>'
      + '<div id="opDetalhe"></div>'
      + '</div>';
  }

  function obrasFiltradas() {
    var busca = (state.busca || '').toLowerCase();
    var cliente = (state.cliente || '').toLowerCase();
    return (state.obras || []).filter(function (o) {
      if (state.status && o.status_operacional !== state.status) return false;
      if (cliente && String(o.cliente_nome || '').toLowerCase().indexOf(cliente) < 0) return false;
      if (busca) {
        var hay = [o.codigo_obra, o.proposta_numero, o.titulo, o.cliente_nome].join(' ').toLowerCase();
        if (hay.indexOf(busca) < 0) return false;
      }
      return true;
    });
  }

  function renderLista() {
    var el = $('opLista');
    if (!el) return;
    if (state.carregando) {
      el.innerHTML = '<div class="card" style="color:var(--text3)">Carregando obras...</div>';
      return;
    }
    if (state.erro) {
      el.innerHTML = '<div class="card" style="border-color:rgba(239,68,68,.35);color:#ef4444">' + esc(state.erro) + '</div>';
      return;
    }
    var list = obrasFiltradas();
    if (!list.length) {
      el.innerHTML = '<div class="card" style="color:var(--text3)">Nenhuma obra encontrada.</div>';
      return;
    }
    el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:.8rem">'
      + list.map(function (o) {
        return '<div class="card" style="margin:0;display:flex;flex-direction:column;gap:.55rem">'
          + '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:flex-start">'
          + '<div><div style="font-size:.78rem;color:var(--text3);font-weight:700">' + esc(o.codigo_obra || 'Obra sem codigo') + '</div>'
          + '<div style="font-size:1rem;color:var(--text);font-weight:800;margin-top:.1rem">' + esc(o.titulo || o.proposta_numero || '-') + '</div></div>'
          + '<span class="bdg b-info">' + esc(labelStatus(o.status_operacional)) + '</span></div>'
          + '<div style="font-size:.82rem;color:var(--text2);line-height:1.45">'
          + '<strong>' + esc(o.cliente_nome || '-') + '</strong><br>'
          + 'Proposta: ' + esc(o.proposta_numero || '-') + (o.proposta_revisao ? ' Rev. ' + esc(o.proposta_revisao) : '') + '<br>'
          + 'Valor vendido: <strong style="color:var(--green)">' + money(o.valor_vendido) + '</strong><br>'
          + 'Avanco: ' + esc(o.percentual_avanco || 0) + '%'
          + '</div>'
          + '<div style="display:flex;justify-content:flex-end;margin-top:auto">'
          + '<button class="btn ba" onclick="opAbrirObra(\'' + esc(o.id) + '\')">Abrir Obra</button>'
          + '</div>'
          + '</div>';
      }).join('')
      + '</div>';
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

  function sectionBox(titulo, subtitulo, html) {
    return '<section style="border:1px solid rgba(88,166,255,.24);border-radius:10px;background:rgba(88,166,255,.035);padding:1rem;margin-bottom:1rem">'
      + '<div style="display:flex;justify-content:space-between;gap:.75rem;align-items:flex-start;flex-wrap:wrap;margin-bottom:.85rem">'
      + '<div><div style="font-size:1rem;color:var(--accent);font-weight:900;text-transform:uppercase;letter-spacing:.02em">' + esc(titulo) + '</div>'
      + (subtitulo ? '<div style="font-size:.8rem;color:var(--text3);margin-top:.16rem">' + esc(subtitulo) + '</div>' : '')
      + '</div></div>' + html + '</section>';
  }

  function ajusteResponsivoHtml() {
    return '<style id="opResponsiveStyles">'
      + '@media(max-width:720px){'
      + '#opObraPanel{inset:0!important;padding:0!important;align-items:stretch!important;}'
      + '#opObraDialog{width:100%!important;height:100vh!important;max-height:100vh!important;border-radius:0!important;border:none!important;}'
      + '#opObraBody{padding:.85rem!important;}'
      + '#opDiarioOverlay{inset:0!important;padding:0!important;align-items:stretch!important;}'
      + '#opDiarioDialog{width:100%!important;height:100vh!important;max-height:100vh!important;border-radius:0!important;border:none!important;}'
      + '#opDiarioBody{padding:.85rem .85rem calc(7.5rem + env(safe-area-inset-bottom))!important;}'
      + '#opDiarioFooter{position:relative!important;padding:.75rem .85rem calc(.95rem + env(safe-area-inset-bottom))!important;justify-content:stretch!important;}'
      + '#opDiarioFooter .btn{flex:1!important;min-height:48px!important;font-size:.9rem!important;}'
      + '#opRecursoOverlay{inset:0!important;padding:0!important;align-items:stretch!important;}'
      + '#opRecursoDialog{width:100%!important;height:100vh!important;max-height:100vh!important;border-radius:0!important;border:none!important;}'
      + '#opRecursoBody{padding:.85rem .85rem calc(7.5rem + env(safe-area-inset-bottom))!important;}'
      + '#opRecursoFooter{position:relative!important;padding:.75rem .85rem calc(.95rem + env(safe-area-inset-bottom))!important;justify-content:stretch!important;}'
      + '#opRecursoFooter .btn{flex:1!important;min-height:48px!important;font-size:.9rem!important;}'
      + '#opRecursoConfirmOverlay{inset:0!important;padding:.85rem!important;}'
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
    setTimeout(function () {
      var form = $('opDiarioFormPanel');
      var body = $('opDiarioBody') || $('opObraBody');
      if (body) body.scrollTop = 0;
      ajustarTextareas(form || document);
    }, 60);
  }

  function focarRecursosCampo() {
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
    setTimeout(function () {
      var body = $('opRecursoBody') || $('opObraBody');
      if (body) body.scrollTop = 0;
      ajustarTextareas($('opRecursoFormPanel') || document);
    }, 60);
  }

  function renderDetalhe() {
    var el = $('opDetalhe');
    if (!el) return;
    var o = state.obraAtual;
    if (!o) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = ajusteResponsivoHtml()
      + '<div id="opObraPanel" style="position:fixed;inset:0;z-index:880;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:1rem">'
      + '<div id="opObraDialog" style="width:min(1120px,96vw);max-height:92vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 20px 70px rgba(0,0,0,.55);overflow:hidden;display:flex;flex-direction:column">'
      + '<div style="position:sticky;top:0;z-index:5;background:var(--bg2);border-bottom:1px solid var(--border);padding:.95rem 1rem;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem">'
      + '<div><div style="font-size:1.25rem;color:var(--accent);font-weight:900;text-transform:uppercase;letter-spacing:.02em">Detalhe da Obra</div>'
      + '<h3 style="margin:.25rem 0 0;font-size:1.05rem;color:var(--text);line-height:1.28">' + esc(o.codigo_obra || '-') + ' - ' + esc(o.titulo || '-') + '</h3>'
      + '<div style="font-size:.82rem;color:var(--text3);margin-top:.22rem">Proposta ' + esc(o.proposta_numero || '-') + (o.proposta_revisao ? ' / Rev. ' + esc(o.proposta_revisao) : '') + '</div></div>'
      + '<button type="button" class="btn bg" onclick="opFecharDetalhe()" style="min-height:40px">Fechar</button></div>'
      + '<div id="opObraBody" style="overflow:auto;padding:1rem">'
      + '<section style="border:1px solid var(--border);border-radius:10px;background:var(--bg2);padding:1rem;margin-bottom:1rem">'
      + '<div style="font-size:.9rem;color:var(--text);font-weight:900;text-transform:uppercase;margin-bottom:.8rem">Dados da obra</div>'
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
      + campo('Centro de custo', input('opEdCentro', o.centro_custo))
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
      + '</div></section>'
      + operacionalPlanejamentoHtml(o)
      + diarioSectionHtml()
      + '</div>'
      + '<div style="position:sticky;bottom:0;background:var(--bg2);border-top:1px solid var(--border);padding:.75rem 1rem;display:flex;justify-content:flex-end;gap:.6rem">'
      + '<button type="button" class="btn bg" onclick="opFecharDetalhe()" style="min-height:42px">Voltar</button>'
      + '<button type="button" class="btn ba" onclick="opSalvarObra()" style="min-height:42px">Salvar Obra</button>'
      + '</div></div></div>'
      + diarioOverlayHtml()
      + recursoOverlayHtml()
      + confirmarExcluirRecursoHtml();
    setTimeout(function () { ajustarTextareas(el); }, 30);
  }

  async function carregarObras() {
    state.carregando = true;
    state.erro = '';
    renderLista();
    try {
      state.obras = await window.sbListarObras(getEmpresaId());
    } catch (e) {
      state.erro = e.message || String(e);
    } finally {
      state.carregando = false;
      renderLista();
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
      var obra = await window.sbBuscarObraPorId(id);
      if (!obra) throw new Error('Obra nao encontrada.');
      state.obraAtual = obra;
      state.diarioForm = null;
      state.diarioEditId = '';
      state.diarios = [];
      state.diarioErro = '';
      state.recursos = [];
      state.recursosErro = '';
      state.recursoForm = null;
      state.recursoEditId = '';
      state.mobilizacaoEquipe = [];
      state.mobilizacaoErro = '';
      state.mobilizacaoForm = null;
      state.mobilizacaoEditId = '';
      renderDetalhe();
      focarPainelObra();
      await Promise.all([carregarDiariosObra(), carregarRecursosMobilizacaoObra()]);
    } catch (e) {
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
      status_operacional: ($('opEdStatus') || {}).value || 'aguardando_recebimento',
      responsavel_operacional_nome: ($('opEdResp') || {}).value || '',
      centro_custo: ($('opEdCentro') || {}).value || '',
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
      msg('Obra atualizada com sucesso.');
      await carregarObras();
      renderDetalhe();
    } catch (e) {
      msg('Erro ao salvar obra: ' + (e.message || e), 'err');
    }
  }

  async function carregarDiariosObra() {
    if (!state.obraAtual || typeof window.sbListarDiariosObra !== 'function') return;
    state.diarioCarregando = true;
    state.diarioErro = '';
    renderDetalhe();
    try {
      state.diarios = await window.sbListarDiariosObra(getEmpresaId(), state.obraAtual.id);
    } catch (e) {
      state.diarioErro = e.message || String(e);
    } finally {
      state.diarioCarregando = false;
      renderDetalhe();
    }
  }

  async function carregarRecursosMobilizacaoObra() {
    if (!state.obraAtual) return;
    var empresaId = getEmpresaId();
    state.recursosCarregando = true;
    state.mobilizacaoCarregando = true;
    state.recursosErro = '';
    state.mobilizacaoErro = '';
    renderDetalhe();
    try {
      if (typeof window.sbListarRecursosCampoObra === 'function') {
        state.recursos = await window.sbListarRecursosCampoObra(empresaId, state.obraAtual.id);
      }
    } catch (e) {
      state.recursosErro = e.message || String(e);
    } finally {
      state.recursosCarregando = false;
    }
    try {
      if (typeof window.sbListarMobilizacaoEquipeObra === 'function') {
        state.mobilizacaoEquipe = await window.sbListarMobilizacaoEquipeObra(empresaId, state.obraAtual.id);
      }
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
      await carregarDiariosObra();
    } catch (e) {
      console.error('[Operacional] Erro tecnico ao salvar diario:', e);
      mostrarErroDiario(msgErroSalvarDiario(e));
    }
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

  function novaMobilizacao() {
    if (!state.obraAtual) return;
    state.mobilizacaoEditId = '';
    state.mobilizacaoForm = {
      nome_colaborador: '',
      forma_deslocamento: 'nao_aplicavel',
      ponto_encontro: state.obraAtual.ponto_encontro_equipe || '',
      horario_encontro: state.obraAtual.horario_encontro_equipe || '',
      precisa_adiantamento: false,
      valor_adiantamento: 0
    };
    renderDetalhe();
  }

  function editarMobilizacao(id) {
    var m = (state.mobilizacaoEquipe || []).find(function (it) { return it.id === id; });
    if (!m) return msg('Mobilizacao nao encontrada.', 'err');
    state.mobilizacaoEditId = id;
    state.mobilizacaoForm = Object.assign({}, m);
    renderDetalhe();
  }

  function coletarMobilizacaoForm() {
    return {
      empresa_id: getEmpresaId(),
      obra_id: state.obraAtual ? state.obraAtual.id : '',
      nome_colaborador: ($('opMobEqNome') || {}).value || '',
      funcao: ($('opMobEqFuncao') || {}).value || '',
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
      if (state.mobilizacaoEditId) await window.sbAtualizarMobilizacaoEquipe(state.mobilizacaoEditId, dados);
      else await window.sbCriarMobilizacaoEquipe(dados);
      state.mobilizacaoForm = null;
      state.mobilizacaoEditId = '';
      msg('Mobilizacao da equipe salva.');
      await carregarRecursosMobilizacaoObra();
    } catch (e) {
      msg('Erro ao salvar mobilizacao: ' + (e.message || e), 'err');
    }
  }

  async function excluirMobilizacao(id) {
    if (!window.confirm('Excluir este colaborador da mobilizacao?')) return;
    try {
      await window.sbExcluirMobilizacaoEquipe(id);
      msg('Mobilizacao excluida.');
      if (state.mobilizacaoEditId === id) {
        state.mobilizacaoForm = null;
        state.mobilizacaoEditId = '';
      }
      await carregarRecursosMobilizacaoObra();
    } catch (e) {
      msg('Erro ao excluir mobilizacao: ' + (e.message || e), 'err');
    }
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
  }

  function onFase1cClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('[data-op-1c-action]') : null;
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var action = btn.getAttribute('data-op-1c-action');
    var id = btn.getAttribute('data-id') || '';
    if (action === 'gerar-recursos') gerarRecursosPadrao();
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
    else if (action === 'excluir-mobilizacao') excluirMobilizacao(id);
  }

  function onDiarioClick(e) {
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
      await carregarDiariosObra();
    } catch (e) {
      msg('Erro ao excluir diario: ' + (e.message || e), 'err');
    }
  }

  function filtrarDiarios() {
    state.diarioFiltroData = ($('opDiaFiltroData') || {}).value || '';
    state.diarioFiltroStatus = ($('opDiaFiltroStatus') || {}).value || '';
    renderDetalhe();
  }

  function limparFiltroDiario() {
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
      } else if (isAprovado(p)) {
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
    if (!retro && p.fas !== 'aprovado') return msg('A obra automatica so pode ser criada para proposta aprovada.', 'err');
    try {
      var res = await window.sbCriarObraDeProposta(p);
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

  window.rOperacional = rOperacional;
  window.opCarregarObras = carregarObras;
  window.opFiltros = filtros;
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

  document.addEventListener('click', onFase1cClick, true);
  document.addEventListener('click', onDiarioClick, true);
  document.addEventListener('input', onOperacionalInput, true);
})(window, document);

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
    diarioEditId: ''
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
      return campo(label, '<textarea id="' + id + '" rows="3" style="' + base + ';resize:vertical">' + esc(val || '') + '</textarea>');
    }
    if (tipo.indexOf('select:') === 0) {
      return campo(label, '<select id="' + id + '" style="' + base + '">' + listaOptions(tipo.split(':')[1], val, true) + '</select>');
    }
    return campo(label, '<input id="' + id + '" type="' + tipo + '" value="' + esc(val || '') + '" style="' + base + '">');
  }

  function diarioFormHtml() {
    if (!state.diarioForm) return '';
    var dados = state.diarioForm;
    return '<div style="margin-top:1rem;border:1px solid rgba(88,166,255,.25);border-radius:8px;background:rgba(88,166,255,.04);padding:.8rem">'
      + '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:center;margin-bottom:.8rem">'
      + '<div style="font-size:.85rem;font-weight:800;color:var(--blue)">' + (state.diarioEditId ? 'Editar Diario de Obra' : 'Novo Diario de Obra') + '</div>'
      + '<button type="button" class="btn bg bsm" data-op-dia-action="cancelar">Cancelar</button></div>'
      + '<div id="opDiaMsg" style="display:none;margin-bottom:.75rem;border-radius:7px;padding:.55rem .7rem;font-size:.78rem;font-weight:700"></div>'
      + DIARIO_BLOCOS.map(function (bloco) {
        return '<div style="border-top:1px solid var(--border);padding-top:.75rem;margin-top:.75rem">'
          + '<div style="font-size:.72rem;color:var(--accent);font-weight:800;text-transform:uppercase;margin-bottom:.55rem">' + esc(bloco.titulo) + '</div>'
          + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.6rem">'
          + bloco.campos.map(function (def) { return renderDiarioCampo(def, dados); }).join('')
          + '</div></div>';
      }).join('')
      + '<div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem">'
      + '<button type="button" class="btn bg" data-op-dia-action="cancelar">Cancelar</button>'
      + '<button type="button" class="btn ba" data-op-dia-action="salvar">Salvar Diario</button>'
      + '</div></div>';
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
        return '<div style="border:1px solid var(--border);border-radius:7px;background:var(--bg3);padding:.65rem .75rem;margin-bottom:.45rem">'
          + '<div style="display:flex;justify-content:space-between;gap:.6rem;align-items:flex-start">'
          + '<div><div style="font-size:.78rem;font-weight:800;color:var(--text)">' + esc(dataInput(d.data_diario)) + ' - ' + esc(labelLista('turno', d.turno)) + '</div>'
          + '<div style="font-size:.72rem;color:var(--text3);margin-top:.12rem">' + esc(labelLista('status_dia', d.status_dia)) + (d.responsavel_dia_nome ? ' | ' + esc(d.responsavel_dia_nome) : '') + '</div></div>'
          + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end">'
          + '<button type="button" class="btn bg bsm" data-op-dia-action="editar" data-id="' + esc(d.id) + '">Abrir/Editar</button>'
          + '<button type="button" class="btn bd bsm" data-op-dia-action="excluir" data-id="' + esc(d.id) + '">Excluir</button></div></div>'
          + '<div style="font-size:.8rem;color:var(--text2);line-height:1.45;margin-top:.45rem">'
          + '<strong>Atividade:</strong> ' + esc(d.atividade_principal || '-') + '<br>'
          + '<strong>Resumo:</strong> ' + esc(d.resumo_do_dia || '-') + '<br>'
          + '<span>Intercorrencia: ' + (d.houve_intercorrencia ? 'Sim' : 'Nao') + '</span> | '
          + '<span>Falta material: ' + (d.houve_falta_material ? 'Sim' : 'Nao') + '</span> | '
          + '<span>Servico liberado: ' + (d.servico_liberado ? 'Sim' : 'Nao') + '</span>'
          + '</div></div>';
      }).join('');
    }
    return '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">'
      + '<div style="display:flex;justify-content:space-between;gap:.7rem;align-items:flex-start;margin-bottom:.7rem">'
      + '<div><div style="font-size:.78rem;color:var(--accent);font-weight:800;text-transform:uppercase">Diario de Obra</div>'
      + '<div style="font-size:.76rem;color:var(--text3);margin-top:.12rem">Registro oficial consolidado do dia da obra.</div></div>'
      + '<button type="button" class="btn ba" data-op-dia-action="novo">Novo Diario</button></div>'
      + '<div style="display:grid;grid-template-columns:180px 220px auto;gap:.55rem;align-items:end;margin-bottom:.65rem">'
      + campo('Filtrar por data', '<input id="opDiaFiltroData" type="date" value="' + esc(state.diarioFiltroData || '') + '" onchange="opFiltrarDiarios()" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">')
      + campo('Filtrar por status', '<select id="opDiaFiltroStatus" onchange="opFiltrarDiarios()" style="padding:.48rem .65rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">' + statusSel + '</select>')
      + '<button type="button" class="btn bg" data-op-dia-action="limpar-filtro">Limpar</button></div>'
      + '<div id="opDiarioLista">' + listaHtml + '</div>'
      + diarioFormHtml()
      + '</div>';
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

  function renderDetalhe() {
    var el = $('opDetalhe');
    if (!el) return;
    var o = state.obraAtual;
    if (!o) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = '<div class="card" style="margin-top:1rem;border-color:rgba(240,165,0,.28)">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:.85rem">'
      + '<div><div style="font-size:.75rem;color:var(--accent);font-weight:800;text-transform:uppercase">Detalhe da obra</div>'
      + '<h3 style="margin:.15rem 0 0;font-size:1.15rem;color:var(--text)">' + esc(o.codigo_obra || '-') + ' - ' + esc(o.titulo || '-') + '</h3>'
      + '<div style="font-size:.8rem;color:var(--text3);margin-top:.2rem">Proposta ' + esc(o.proposta_numero || '-') + (o.proposta_revisao ? ' / Rev. ' + esc(o.proposta_revisao) : '') + '</div></div>'
      + '<button class="btn bg" onclick="opFecharDetalhe()">Fechar</button></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:.65rem;margin-bottom:1rem;font-size:.82rem;color:var(--text2)">'
      + '<div><strong>Cliente</strong><br>' + esc(o.cliente_nome || '-') + '</div>'
      + '<div><strong>CNPJ</strong><br>' + esc(o.cliente_cnpj || '-') + '</div>'
      + '<div><strong>Cidade/local</strong><br>' + esc([o.cliente_cidade, o.cliente_local].filter(Boolean).join(' / ') || '-') + '</div>'
      + '<div><strong>Valor vendido</strong><br>' + money(o.valor_vendido) + '</div>'
      + '<div><strong>Data aprovacao</strong><br>' + esc(dataInput(o.data_aprovacao) || '-') + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.65rem;margin-bottom:1rem">'
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
      + campo('Observacoes', '<textarea id="opEdObs" rows="4" style="padding:.55rem .7rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text);resize:vertical">' + esc(o.observacoes || '') + '</textarea>')
      + '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">'
      + '<div style="font-size:.72rem;color:var(--text3);font-weight:800;text-transform:uppercase;margin-bottom:.5rem">Resumo do snapshot da proposta</div>'
      + snapshotResumo(o)
      + '</div>'
      + diarioSectionHtml()
      + '<div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:1rem">'
      + '<button class="btn bg" onclick="opFecharDetalhe()">Cancelar</button>'
      + '<button class="btn ba" onclick="opSalvarObra()">Salvar Obra</button>'
      + '</div>'
      + '</div>';
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
      renderDetalhe();
      await carregarDiariosObra();
      var el = $('opDetalhe');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      msg('Erro ao abrir obra: ' + (e.message || e), 'err');
    }
  }

  function fecharDetalhe() {
    state.obraAtual = null;
    renderDetalhe();
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
  }

  async function editarDiario(id) {
    try {
      var d = await window.sbBuscarDiarioPorId(id);
      if (!d) throw new Error('Diario nao encontrado.');
      state.diarioEditId = d.id;
      state.diarioForm = Object.assign({}, d);
      renderDetalhe();
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

  document.addEventListener('click', onDiarioClick, true);
})(window, document);

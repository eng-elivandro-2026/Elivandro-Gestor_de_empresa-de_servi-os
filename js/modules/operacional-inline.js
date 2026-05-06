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
    obraAtual: null
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
    if (typeof window.toast === 'function') window.toast(texto, tipo || 'ok');
    else console.log('[Operacional]', texto);
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
      renderDetalhe();
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
  window.opSetFiltroStatus = setFiltroStatus;
  window.opHidratarAcoesPropostas = hidratarAcoesPropostas;
  window.opAcoesPropostaHtml = acoesPropostaHtml;
  window.opCriarObraDePropostaId = criarObraDePropostaId;
  window.opAbrirObraComercial = abrirObraComercial;
  window.opRenderActionBar = renderActionBar;
  window.opLimparActionBar = limparActionBar;
})(window, document);

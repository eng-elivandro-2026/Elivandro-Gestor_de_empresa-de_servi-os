// Módulo Histórico de Relacionamento — TecFusion
(function () {
  var KEY = 'tf_historico';

  function hLS(v) {
    if (v === undefined) { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { return []; } }
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch(e) {}
  }

  function genId() { return 'hst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

  function saveList(list) {
    hLS(list);
    if (typeof sbSalvarHistorico === 'function') sbSalvarHistorico(list);
  }

  // ── Init chamado pelo Router
  window.rHistorico = function () {
    _atualizarContador();
    _popularPropostas(null);
    renderLista();
  };

  // ── Render da lista
  function renderLista() {
    var el = document.getElementById('historicoLista');
    if (!el) return;

    var list = hLS();
    var fc = (document.getElementById('hFiltroCliente') || {}).value || '';
    var fs = (document.getElementById('hFiltroStatus') || {}).value || '';

    if (fc) list = list.filter(function (h) { return (h.cliente || '').toLowerCase().indexOf(fc.toLowerCase()) >= 0; });
    if (fs) list = list.filter(function (h) { return h.status === fs; });

    list.sort(function (a, b) { return new Date(b.data) - new Date(a.data); });

    var corSt = { em_andamento: 'var(--accent)', resolvido: 'var(--green)', cancelado: 'var(--text3)' };
    var lblSt = { em_andamento: 'Em andamento', resolvido: 'Resolvido', cancelado: 'Cancelado' };
    var icCn  = { 'WhatsApp': '💬', 'Reunião': '🤝', 'E-mail': '📧', 'Telefone': '📞', 'Outro': '📝' };

    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:2.5rem;color:var(--text3);font-size:.82rem">Nenhum registro ainda. Clique em <strong>+ Novo Registro</strong> para começar.</div>';
      return;
    }

    el.innerHTML = list.map(function (h) {
      var cor = corSt[h.status] || 'var(--text3)';
      var ic  = icCn[h.canal] || '📝';
      var dt  = h.data ? new Date(h.data) : null;
      var dtF = dt ? dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
      return '<div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid ' + cor + ';border-radius:8px;padding:.7rem 1rem;margin-bottom:.5rem">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.3rem">'
        + '<div style="font-size:.7rem;color:var(--text3)">' + dtF + ' &nbsp;' + ic + ' ' + esc(h.canal || '') + '</div>'
        + '<div style="display:flex;gap:.3rem;align-items:center;flex-shrink:0">'
        + '<span style="font-size:.61rem;font-weight:700;color:' + cor + ';border:1px solid ' + cor + ';border-radius:20px;padding:.08rem .3rem">' + (lblSt[h.status] || h.status) + '</span>'
        + '<button class="nb" onclick="hEditar(\'' + h.id + '\')" title="Editar" style="font-size:.7rem;color:var(--text3)">✏️</button>'
        + '<button class="nb" onclick="hDeletar(\'' + h.id + '\')" title="Deletar" style="font-size:.7rem;color:var(--text3)">🗑️</button>'
        + '</div></div>'
        + '<div style="font-size:.78rem;font-weight:700;color:var(--text)">' + esc(h.cliente || '')
        + (h.contato ? ' <span style="font-weight:400;color:var(--text2);font-size:.73rem">| ' + esc(h.contato) + '</span>' : '') + '</div>'
        + (h.resumo       ? '<div style="font-size:.72rem;color:var(--text2);margin-top:.18rem">📝 ' + esc(h.resumo) + '</div>' : '')
        + (h.decisao      ? '<div style="font-size:.71rem;color:var(--green);margin-top:.12rem">✅ ' + esc(h.decisao) + '</div>' : '')
        + (h.pendencia    ? '<div style="font-size:.71rem;color:var(--accent);margin-top:.1rem">⏳ ' + esc(h.pendencia) + '</div>' : '')
        + (h.proxima_acao ? '<div style="font-size:.71rem;color:var(--blue);margin-top:.1rem;font-weight:600">⚡ ' + esc(h.proxima_acao) + '</div>' : '')
        + (h.responsavel  ? '<div style="font-size:.66rem;color:var(--text3);margin-top:.1rem">👤 ' + esc(h.responsavel) + '</div>' : '')
        + '</div>';
    }).join('');
  }

  window.hFiltrar = function () { renderLista(); };

  window.hNovoRegistro = function () {
    _preencherForm(null);
    var fw = document.getElementById('hFormWrap');
    if (fw) { fw.style.display = ''; fw.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  window.hEditar = function (id) {
    var h = hLS().find(function (x) { return x.id === id; });
    if (!h) return;
    _preencherForm(h);
    var fw = document.getElementById('hFormWrap');
    if (fw) { fw.style.display = ''; fw.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  };

  window.hDeletar = function (id) {
    if (!confirm('Deletar este registro?')) return;
    saveList(hLS().filter(function (x) { return x.id !== id; }));
    _atualizarContador();
    renderLista();
  };

  window.hCancelarForm = function () {
    var fw = document.getElementById('hFormWrap');
    if (fw) fw.style.display = 'none';
    var f = document.getElementById('hForm');
    if (f) f.reset();
    var ei = document.getElementById('hEditId');
    if (ei) ei.value = '';
  };

  window.hSalvarForm = function () {
    var g = function (id) { return (document.getElementById(id) || {}); };
    var editId = g('hEditId').value || '';
    var reg = {
      id:           editId || genId(),
      data:         g('hData').value || new Date().toISOString().slice(0, 16),
      cliente:      (g('hCliente').value || '').trim(),
      contato:      (g('hContato').value || '').trim(),
      canal:        g('hCanal').value || 'WhatsApp',
      resumo:       (g('hResumo').value || '').trim(),
      decisao:      (g('hDecisao').value || '').trim(),
      pendencia:    (g('hPendencia').value || '').trim(),
      proxima_acao: (g('hProximaAcao').value || '').trim(),
      responsavel:  (g('hResponsavel').value || '').trim(),
      status:       g('hStatus').value || 'em_andamento',
      proposta_id:  g('hPropostaId').value || null
    };
    if (!reg.cliente) { alert('Informe o cliente.'); return; }
    if (!reg.resumo)  { alert('Informe o resumo da conversa.'); return; }
    var list = hLS();
    if (editId) {
      list = list.map(function (x) { return x.id === editId ? reg : x; });
    } else {
      list.unshift(reg);
    }
    saveList(list);
    hCancelarForm();
    _atualizarContador();
    renderLista();
  };

  function _preencherForm(h) {
    var s = function (id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; };
    s('hEditId',      h ? h.id : '');
    s('hData',        h ? (h.data || '').slice(0, 16) : new Date().toISOString().slice(0, 16));
    s('hCliente',     h ? h.cliente : '');
    s('hContato',     h ? h.contato : '');
    s('hCanal',       h ? (h.canal || 'WhatsApp') : 'WhatsApp');
    s('hResumo',      h ? h.resumo : '');
    s('hDecisao',     h ? h.decisao : '');
    s('hPendencia',   h ? h.pendencia : '');
    s('hProximaAcao', h ? h.proxima_acao : '');
    s('hResponsavel', h ? h.responsavel : '');
    s('hStatus',      h ? (h.status || 'em_andamento') : 'em_andamento');
    _popularPropostas(h ? h.proposta_id : null);
  }

  function _popularPropostas(selecionado) {
    var sel = document.getElementById('hPropostaId');
    if (!sel || !window.props) return;
    var opts = '<option value="">— nenhuma —</option>';
    var pList = (window.props || []).slice().sort(function (a, b) {
      return (a.loc || a.cli || '').localeCompare(b.loc || b.cli || '');
    });
    pList.forEach(function (p) {
      var lbl = (p.loc || p.cli || 'N/I') + (p.tit ? ' — ' + p.tit : '') + (p.num ? ' #' + p.num : '');
      opts += '<option value="' + esc(p.id) + '"' + (selecionado === p.id ? ' selected' : '') + '>' + esc(lbl) + '</option>';
    });
    sel.innerHTML = opts;
  }

  function _atualizarContador() {
    var el = document.getElementById('hContador');
    if (el) el.textContent = hLS().length;
  }

  window.getHistoricoData = function () { return hLS(); };

  console.log('%c[Histórico] carregado', 'color:#58a6ff;font-weight:700');
})();

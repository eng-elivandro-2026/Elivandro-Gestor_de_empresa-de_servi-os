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

  function hoje() {
    var d = new Date(); d.setHours(0,0,0,0); return d;
  }

  function isAtrasado(h) {
    if (h.status === 'resolvido' || h.status === 'cancelado') return false;
    if (!h.prazo_acao) return false;
    return new Date(h.prazo_acao) < hoje();
  }

  function isVenceHoje(h) {
    if (h.status === 'resolvido' || h.status === 'cancelado') return false;
    if (!h.prazo_acao) return false;
    var d = new Date(h.prazo_acao); d.setHours(0,0,0,0);
    var hj = hoje();
    return d.getTime() === hj.getTime();
  }

  // Ordenação: atrasados > alta prioridade > prazo próximo > data
  function sortList(list) {
    var pOrd = { alta: 0, media: 1, baixa: 2 };
    return list.slice().sort(function(a, b) {
      var aAt = isAtrasado(a) ? 0 : 1;
      var bAt = isAtrasado(b) ? 0 : 1;
      if (aAt !== bAt) return aAt - bAt;
      var aP = pOrd[a.prioridade || 'media'];
      var bP = pOrd[b.prioridade || 'media'];
      if (aP !== bP) return aP - bP;
      // prazo: quem vence antes primeiro (sem prazo vai pro fim)
      if (a.prazo_acao && b.prazo_acao) return new Date(a.prazo_acao) - new Date(b.prazo_acao);
      if (a.prazo_acao) return -1;
      if (b.prazo_acao) return 1;
      return new Date(b.data) - new Date(a.data);
    });
  }

  // ── Painel CEO ───────────────────────────────────────────
  function renderPainelCeo() {
    var el = document.getElementById('hPainelCeo');
    if (!el) return;
    var list = hLS();
    var atrasados   = list.filter(isAtrasado).length;
    var alta        = list.filter(function(h){ return h.prioridade === 'alta' && h.status === 'em_andamento'; }).length;
    var emAndamento = list.filter(function(h){ return h.status === 'em_andamento'; }).length;
    var resolvidos  = list.filter(function(h){
      if (h.status !== 'resolvido') return false;
      var d = new Date(h.data);
      var agr = new Date();
      return d.getMonth() === agr.getMonth() && d.getFullYear() === agr.getFullYear();
    }).length;

    function card(label, val, cor, bg, click) {
      return '<div onclick="'+click+'" style="cursor:pointer;background:'+bg+';border:1px solid '+cor+'55;border-radius:8px;padding:.6rem .8rem;display:flex;flex-direction:column;gap:.15rem;transition:opacity .15s" onmouseover="this.style.opacity=.82" onmouseout="this.style.opacity=1">'
        + '<div style="font-size:1.3rem;font-weight:800;color:'+cor+'">'+val+'</div>'
        + '<div style="font-size:.63rem;color:'+cor+';opacity:.85;font-weight:600;text-transform:uppercase;letter-spacing:.05em">'+label+'</div>'
        + '</div>';
    }

    el.innerHTML =
      card('Atrasados',    atrasados,   '#ef4444', 'rgba(239,68,68,.08)',   "hFiltroRapido('atrasados')")
    + card('Alta prior.',  alta,        '#f59e0b', 'rgba(245,158,11,.08)',  "hFiltroRapido('alta')")
    + card('Em andamento', emAndamento, '#3b82f6', 'rgba(59,130,246,.08)', "hFiltroRapido('em_andamento')")
    + card('Resolvidos/mês', resolvidos, '#22c55e', 'rgba(34,197,94,.08)', "hFiltroRapido('resolvido')");
  }

  // ── Estado de filtro rápido ──────────────────────────────
  var _filtroRapido = '';

  window.hFiltroRapido = function(tipo) {
    _filtroRapido = tipo;
    var fs = document.getElementById('hFiltroStatus');
    var fp = document.getElementById('hFiltroPrioridade');
    var fc = document.getElementById('hFiltroCliente');
    if (fs) fs.value = '';
    if (fp) fp.value = '';
    if (fc) fc.value = '';
    if (tipo === 'em_andamento' && fs) fs.value = 'em_andamento';
    if (tipo === 'resolvido'    && fs) fs.value = 'resolvido';
    if (tipo === 'alta'         && fp) fp.value = 'alta';
    renderLista();
  };

  // ── Init chamado pelo Router ─────────────────────────────
  window.rHistorico = function () {
    _filtroRapido = '';
    _atualizarContador();
    _popularPropostas(null);
    var fs = document.getElementById('hFiltroStatus');
    if (fs) fs.value = '';
    var fc = document.getElementById('hFiltroCliente');
    if (fc) fc.value = '';
    var fp = document.getElementById('hFiltroPrioridade');
    if (fp) fp.value = '';
    renderPainelCeo();
    renderLista();
    // Carregar da nuvem e re-renderizar com dados atualizados
    if (typeof sbCarregarHistorico === 'function') {
      sbCarregarHistorico().then(function(lista) {
        if (lista && lista.length) {
          renderPainelCeo();
          renderLista();
          _atualizarContador();
        }
      });
    }
  };

  // ── Render da lista ──────────────────────────────────────
  function renderLista() {
    var el = document.getElementById('historicoLista');
    if (!el) return;

    var list = hLS();
    var fc  = (document.getElementById('hFiltroCliente')    || {}).value || '';
    var fs  = (document.getElementById('hFiltroStatus')     || {}).value || '';
    var fp  = (document.getElementById('hFiltroPrioridade') || {}).value || '';

    // filtro rápido "atrasados" sobrescreve os selects
    if (_filtroRapido === 'atrasados') {
      list = list.filter(isAtrasado);
    } else if (_filtroRapido === 'alta') {
      list = list.filter(function(h){ return h.prioridade === 'alta' && h.status !== 'resolvido'; });
    } else {
      if (fs) list = list.filter(function(h){ return h.status === fs; });
      if (fp) list = list.filter(function(h){ return (h.prioridade || 'media') === fp; });
    }

    if (fc) list = list.filter(function(h){
      var txt = ((h.cliente || '') + ' ' + (h.responsavel || '')).toLowerCase();
      return txt.indexOf(fc.toLowerCase()) >= 0;
    });

    list = sortList(list);

    var corSt  = { em_andamento: 'var(--accent)', resolvido: 'var(--green)', cancelado: 'var(--text3)' };
    var lblSt  = { em_andamento: 'Em andamento',  resolvido: 'Resolvido',    cancelado: 'Cancelado'    };
    var icCn   = { 'WhatsApp':'💬','Reunião':'🤝','E-mail':'📧','Telefone':'📞','Outro':'📝' };
    var corPri = { alta:'#ef4444', media:'#f59e0b', baixa:'#22c55e' };
    var lblPri = { alta:'🔴 Alta',  media:'🟡 Média', baixa:'🟢 Baixa' };

    var adm = document.getElementById('hContador');
    if (adm) adm.textContent = list.length;

    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:2.5rem;color:var(--text3);font-size:.82rem">'
        + (_filtroRapido === 'atrasados' ? '✅ Nenhum registro atrasado. Tudo em dia!' :
           'Nenhum registro encontrado. Clique em <strong>+ Novo Registro</strong> para começar.')
        + '</div>';
      return;
    }

    el.innerHTML = list.map(function(h) {
      var atrasado  = isAtrasado(h);
      var venceHoje = isVenceHoje(h);
      var cor       = corSt[h.status] || 'var(--text3)';
      var ic        = icCn[h.canal] || '📝';
      var pri       = h.prioridade || 'media';
      var corP      = corPri[pri];
      var dt        = h.data ? new Date(h.data) : null;
      var dtF       = dt ? dt.toLocaleDateString('pt-BR') + ' ' + dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';

      // prazo formatado
      var prazoHtml = '';
      if (h.prazo_acao) {
        var pDt  = new Date(h.prazo_acao + 'T00:00:00');
        var pStr = pDt.toLocaleDateString('pt-BR');
        if (atrasado)   prazoHtml = '<span style="font-size:.65rem;font-weight:700;background:#ef444420;color:#ef4444;border-radius:4px;padding:.06rem .28rem;margin-left:.3rem">⚠️ Atrasado ' + pStr + '</span>';
        else if (venceHoje) prazoHtml = '<span style="font-size:.65rem;font-weight:700;background:#f59e0b20;color:#f59e0b;border-radius:4px;padding:.06rem .28rem;margin-left:.3rem">⏰ Vence hoje</span>';
        else prazoHtml = '<span style="font-size:.65rem;color:var(--text3);margin-left:.3rem">📅 ' + pStr + '</span>';
      }

      var bordaEsq = atrasado ? '#ef4444' : (venceHoje ? '#f59e0b' : cor);

      return '<div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid '+ bordaEsq +';border-radius:8px;padding:.7rem 1rem;margin-bottom:.5rem">'
        + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.3rem">'
        + '<div style="font-size:.7rem;color:var(--text3);display:flex;align-items:center;flex-wrap:wrap;gap:.2rem">'
        + dtF + ' &nbsp;' + ic + ' ' + esc(h.canal || '')
        + prazoHtml
        + '</div>'
        + '<div style="display:flex;gap:.25rem;align-items:center;flex-shrink:0">'
        + '<span style="font-size:.59rem;font-weight:700;color:'+corP+';border:1px solid '+corP+'55;border-radius:20px;padding:.05rem .28rem">'+(lblPri[pri]||pri)+'</span>'
        + '<span style="font-size:.61rem;font-weight:700;color:'+cor+';border:1px solid '+cor+'55;border-radius:20px;padding:.05rem .28rem">'+(lblSt[h.status]||h.status)+'</span>'
        + (h.status !== 'resolvido'
            ? '<button class="nb" onclick="hQuickResolve(\''+h.id+'\')" title="Marcar como resolvido" style="font-size:.7rem;color:var(--green);border:1px solid var(--green)55;border-radius:4px;padding:.05rem .3rem">✅</button>'
            : '')
        + '<button class="nb" onclick="hEditar(\''+h.id+'\')" title="Editar" style="font-size:.7rem;color:var(--text3)">✏️</button>'
        + '<button class="nb" onclick="hDeletar(\''+h.id+'\')" title="Deletar" style="font-size:.7rem;color:var(--text3)">🗑️</button>'
        + '</div></div>'
        + '<div style="font-size:.78rem;font-weight:700;color:var(--text)">' + esc(h.cliente || '')
        + (h.contato ? ' <span style="font-weight:400;color:var(--text2);font-size:.73rem">| '+esc(h.contato)+'</span>' : '') + '</div>'
        + (h.resumo       ? '<div style="font-size:.72rem;color:var(--text2);margin-top:.18rem">📝 '+esc(h.resumo)+'</div>' : '')
        + (h.decisao      ? '<div style="font-size:.71rem;color:var(--green);margin-top:.12rem">✅ '+esc(h.decisao)+'</div>' : '')
        + (h.pendencia    ? '<div style="font-size:.71rem;color:var(--accent);margin-top:.1rem">⏳ '+esc(h.pendencia)+'</div>' : '')
        + (h.proxima_acao ? '<div style="font-size:.71rem;color:var(--blue);margin-top:.1rem;font-weight:600">⚡ '+esc(h.proxima_acao)+'</div>' : '')
        + (h.responsavel  ? '<div style="font-size:.66rem;color:var(--text3);margin-top:.1rem">👤 '+esc(h.responsavel)+'</div>' : '')
        + '</div>';
    }).join('');
  }

  window.hFiltrar = function () {
    _filtroRapido = '';
    renderLista();
  };

  // ── Marcar resolvido direto da lista ─────────────────────
  window.hQuickResolve = function(id) {
    var list = hLS();
    list = list.map(function(x) {
      if (x.id !== id) return x;
      return Object.assign({}, x, { status: 'resolvido' });
    });
    saveList(list);
    renderPainelCeo();
    _atualizarContador();
    renderLista();
    if (typeof toast === 'function') toast('✅ Registro marcado como resolvido!', 'ok');
  };

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
    renderPainelCeo();
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
      cliente:      (g('hCliente').value    || '').trim(),
      contato:      (g('hContato').value    || '').trim(),
      canal:        g('hCanal').value       || 'WhatsApp',
      prioridade:   g('hPrioridade').value  || 'media',
      resumo:       (g('hResumo').value     || '').trim(),
      decisao:      (g('hDecisao').value    || '').trim(),
      pendencia:    (g('hPendencia').value  || '').trim(),
      proxima_acao: (g('hProximaAcao').value|| '').trim(),
      prazo_acao:   g('hPrazoAcao').value   || '',
      responsavel:  (g('hResponsavel').value|| '').trim(),
      status:       g('hStatus').value      || 'em_andamento',
      proposta_id:  g('hPropostaId').value  || null
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
    renderPainelCeo();
    _atualizarContador();
    renderLista();
  };

  function _preencherForm(h) {
    var s = function (id, v) { var el = document.getElementById(id); if (el) el.value = v || ''; };
    var ftit = document.getElementById('hFormTitulo');
    if (ftit) ftit.textContent = h ? '✏️ Editar Registro' : '📝 Novo Registro';
    s('hEditId',      h ? h.id : '');
    s('hData',        h ? (h.data || '').slice(0, 16) : new Date().toISOString().slice(0, 16));
    s('hCliente',     h ? h.cliente    : '');
    s('hContato',     h ? h.contato    : '');
    s('hCanal',       h ? (h.canal || 'WhatsApp') : 'WhatsApp');
    s('hPrioridade',  h ? (h.prioridade || 'media') : 'media');
    s('hResumo',      h ? h.resumo       : '');
    s('hDecisao',     h ? h.decisao      : '');
    s('hPendencia',   h ? h.pendencia    : '');
    s('hProximaAcao', h ? h.proxima_acao : '');
    s('hPrazoAcao',   h ? (h.prazo_acao  || '') : '');
    s('hResponsavel', h ? h.responsavel  : '');
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

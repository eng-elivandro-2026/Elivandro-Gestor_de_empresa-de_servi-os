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
    _popularDatalists();
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
    _popularDatalists();
  }

  function _popularPropostas(selecionado) {
    var sel = document.getElementById('hPropostaId');
    if (!sel || !window.props) return;
    var opts = '<option value="">— nenhuma —</option>';
    var pList = (window.props || []).slice().sort(function (a, b) {
      return (a.num || '').localeCompare(b.num || '');
    });
    pList.forEach(function (p) {
      var num  = p.num  || '';
      var tit  = p.tit  || '';
      var abrev = _abrevCliente(p.loc || p.cli || '');
      var lbl = (num ? '#' + num + ' — ' : '') + tit + (abrev ? ' — ' + abrev : '');
      opts += '<option value="' + esc(p.id) + '"' + (selecionado === p.id ? ' selected' : '') + '>' + esc(lbl) + '</option>';
    });
    sel.innerHTML = opts;
  }

  function _abrevCliente(nome) {
    if (!nome) return '';
    // Se já é curto (≤20 chars), usa direto
    if (nome.length <= 20) return nome;
    // Sigla: iniciais de palavras com 3+ letras, exceto conectivos
    var stop = { de:1, da:1, do:1, das:1, dos:1, e:1, em:1, br:1, ltda:1, s:1, a:1 };
    var sigla = nome.split(/\s+/).filter(function(w){ return w.length >= 3 && !stop[w.toLowerCase()]; })
      .map(function(w){ return w[0].toUpperCase(); }).join('');
    return sigla.length >= 2 ? sigla : nome.slice(0, 18) + '…';
  }

  function _popularDatalists() {
    // Clientes: entrada única por loc+csvc, com CNPJ se disponível
    var dlCli = document.getElementById('hClienteList');
    if (dlCli && window.props) {
      var vistos = {};
      var opts = [];
      (window.props || []).forEach(function(p) {
        var nome  = (p.loc || '').trim() || (p.cli || '').trim();
        if (!nome) return;
        var csvc  = (p.csvc || '').trim();
        var cnpj  = (p.locCnpj || p.cnpj || '').trim();
        // Monta label: "JDE Jundiaí · Jundiaí - SP · 12.345.678/0001-99"
        var label = nome;
        if (csvc)  label += ' · ' + csvc;
        if (cnpj)  label += ' · ' + cnpj;
        if (!vistos[label]) { vistos[label] = 1; opts.push(label); }
      });
      opts.sort();
      dlCli.innerHTML = opts.map(function(c){
        return '<option value="' + esc(c) + '">';
      }).join('');
    }
    // Contatos: nomes únicos já registrados no histórico
    var dlCon = document.getElementById('hContatoList');
    if (dlCon) {
      var contatos = {};
      hLS().forEach(function(h){ if (h.contato) contatos[h.contato.trim()] = 1; });
      dlCon.innerHTML = Object.keys(contatos).sort().map(function(c){
        return '<option value="' + esc(c) + '">';
      }).join('');
    }
  }

  function _atualizarContador() {
    var el = document.getElementById('hContador');
    if (el) el.textContent = hLS().length;
  }

  window.getHistoricoData = function () { return hLS(); };

  // ── Relatório / Impressão ────────────────────────────────────
  window.hAbrirRelatorio = function() {
    var m = document.getElementById('m-rel-relatorio');
    if (!m) return;
    // Pré-preencher período com mês atual
    var hoje = new Date();
    var y = hoje.getFullYear(), mo = String(hoje.getMonth()+1).padStart(2,'0');
    var de = document.getElementById('rRelDe');
    var ate = document.getElementById('rRelAte');
    if (de && !de.value) de.value = y+'-'+mo+'-01';
    if (ate && !ate.value) ate.value = y+'-'+mo+'-'+String(new Date(y,hoje.getMonth()+1,0).getDate()).padStart(2,'0');
    // Popular select de propostas
    var selProp = document.getElementById('rRelProposta');
    if (selProp && window.props) {
      var optsP = '<option value="">Todas</option>';
      (window.props||[]).slice().sort(function(a,b){ return (a.num||'').localeCompare(b.num||''); }).forEach(function(p){
        optsP += '<option value="'+esc(p.id)+'">#'+(p.num||'')+(p.tit?' — '+p.tit.slice(0,50):'')+' ('+esc(p.loc||p.cli||'')+')</option>';
      });
      selProp.innerHTML = optsP;
    }
    m.style.display = 'flex';
  };

  window.hGerarRelatorio = function() {
    var agrup      = (document.getElementById('rRelAgrup')   ||{}).value || 'cliente';
    var filtSt     = (document.getElementById('rRelStatus')  ||{}).value || '';
    var filtDe     = (document.getElementById('rRelDe')      ||{}).value || '';
    var filtAte    = (document.getElementById('rRelAte')     ||{}).value || '';
    var filtCli    = ((document.getElementById('rRelCliente') ||{}).value||'').toLowerCase().trim();
    var filtCon    = ((document.getElementById('rRelContato') ||{}).value||'').toLowerCase().trim();
    var filtPropId = (document.getElementById('rRelProposta') ||{}).value || '';
    var filtResp   = ((document.getElementById('rRelResp')    ||{}).value||'').toLowerCase().trim();

    var propIdx = {};
    (window.props||[]).forEach(function(p){ propIdx[p.id] = p; });

    var list = hLS();
    if (filtSt)     list = list.filter(function(h){ return h.status === filtSt; });
    if (filtCli)    list = list.filter(function(h){ return (h.cliente||'').toLowerCase().indexOf(filtCli)>=0; });
    if (filtCon)    list = list.filter(function(h){ return (h.contato||'').toLowerCase().indexOf(filtCon)>=0; });
    if (filtPropId) list = list.filter(function(h){ return h.proposta_id === filtPropId; });
    if (filtResp)   list = list.filter(function(h){ return (h.responsavel||'').toLowerCase().indexOf(filtResp)>=0; });
    if (filtDe)     list = list.filter(function(h){ return h.data && h.data.slice(0,10) >= filtDe; });
    if (filtAte)    list = list.filter(function(h){ return h.data && h.data.slice(0,10) <= filtAte; });
    list.sort(function(a,b){ return new Date(a.data)-new Date(b.data); });

    function chave(h) {
      if (agrup==='cliente')     return h.cliente || '(sem cliente)';
      if (agrup==='contato')     return h.contato || '(sem contato)';
      if (agrup==='canal')       return h.canal   || '(sem canal)';
      if (agrup==='responsavel') return h.responsavel || '(sem responsável)';
      if (agrup==='negocio') {
        var p = propIdx[h.proposta_id];
        return p ? '#'+(p.num||'')+(p.tit?' — '+p.tit:'') : '(sem proposta vinculada)';
      }
      return 'Todos os registros';
    }

    var grupos = {}, ordem = [];
    list.forEach(function(h){
      var k = chave(h);
      if (!grupos[k]) { grupos[k]=[]; ordem.push(k); }
      grupos[k].push(h);
    });

    function fmtDt(s){
      if(!s) return '';
      var d=new Date(s);
      return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
    }
    function fmtD(s){ if(!s) return ''; return new Date(s+'T00:00:00').toLocaleDateString('pt-BR'); }

    var icCn = {WhatsApp:'💬',Reunião:'🤝','E-mail':'📧',Telefone:'📞',Outro:'📝'};
    var lblSt = {em_andamento:'Em andamento',resolvido:'Resolvido',cancelado:'Cancelado'};
    var corSt = {em_andamento:'#f59e0b',resolvido:'#16a34a',cancelado:'#9ca3af'};
    var lblPri= {alta:'🔴 Alta',media:'🟡 Média',baixa:'🟢 Baixa'};

    function cardHtml(h){
      var prop = propIdx[h.proposta_id];
      var propLabel = prop ? '#'+(prop.num||'')+(prop.tit?' — '+prop.tit:'') : '';
      var st = h.status||'em_andamento';
      var cor = corSt[st]||'#9ca3af';
      var atrasado = h.prazo_acao && h.status==='em_andamento' && new Date(h.prazo_acao+'T00:00:00')<new Date();
      return '<div class="card" style="border-left-color:'+cor+(atrasado?';background:#fff8f8':'')+';">'
        // Linha de topo: data + canal + status
        +'<div class="card-top">'
        +'<span class="tag-canal">'+(icCn[h.canal]||'📝')+' '+esc(h.canal||'')+'</span>'
        +'<span class="tag-dt">'+fmtDt(h.data)+'</span>'
        +'<span class="tag-st" style="color:'+cor+';border-color:'+cor+'55">'+esc(lblSt[st]||st)+'</span>'
        +'<span class="tag-pri">'+esc(lblPri[h.prioridade||'media']||h.prioridade)+'</span>'
        +'</div>'
        // Pessoas + proposta
        +'<div class="card-who">'
        +(h.cliente?'<span class="lbl-cli">🏢 '+esc(h.cliente)+'</span>':'')
        +(h.contato?' <span class="lbl-con">👤 '+esc(h.contato)+'</span>':'')
        +(h.responsavel?' <span class="lbl-resp">· Resp: '+esc(h.responsavel)+'</span>':'')
        +(propLabel?'<span class="lbl-prop">🔗 '+esc(propLabel)+'</span>':'')
        +'</div>'
        // Corpo
        +(h.resumo?'<div class="card-row"><span class="row-ic">💬</span><span class="row-body">'+esc(h.resumo)+'</span></div>':'')
        +(h.decisao?'<div class="card-row"><span class="row-ic">✅</span><span class="row-body row-dec">'+esc(h.decisao)+'</span></div>':'')
        +(h.pendencia?'<div class="card-row"><span class="row-ic">⏳</span><span class="row-body">'+esc(h.pendencia)+'</span></div>':'')
        +(h.proxima_acao?'<div class="card-row"><span class="row-ic">⚡</span><span class="row-body row-acao">'
          +esc(h.proxima_acao)
          +(h.prazo_acao?' <span class="tag-prazo'+(atrasado?' atrasado':'')+'">📅 '+fmtD(h.prazo_acao)+(atrasado?' ⚠️ Atrasado':'')+'</span>':'')
          +'</span></div>':'')
        +'</div>';
    }

    var gruposHtml = ordem.map(function(k){
      var regs = grupos[k];
      var total = regs.length;
      var resolvidos = regs.filter(function(h){ return h.status==='resolvido'; }).length;
      var linha = '<div class="grupo-hdr"><div class="grupo-titulo">'+esc(k)+'</div>'
        +'<div style="display:flex;gap:6px">'
        +'<span class="gbadge">'+total+' registro'+(total!==1?'s':'')+'</span>'
        +(resolvidos?'<span class="gbadge verde">'+resolvidos+' resolvido'+(resolvidos!==1?'s':'')+'</span>':'')
        +'</div></div>'
        +'<div class="timeline">'
        +regs.map(function(h,i){
          return '<div class="tl-item">'
            +'<div class="tl-dot"></div>'
            +(i<regs.length-1?'<div class="tl-line"></div>':'')
            +'<div class="tl-body">'+cardHtml(h)+'</div>'
            +'</div>';
        }).join('')
        +'</div>';
      return '<div class="grupo">'+linha+'</div>';
    }).join('');

    if (!ordem.length) gruposHtml = '<p style="color:#999;text-align:center;padding:2.5rem">Nenhum registro para os filtros selecionados.</p>';

    var empresa = (window.getEmpresaAtiva && window.getEmpresaAtiva()) ? window.getEmpresaAtiva().nome : 'Tecfusion';
    var agrupLabel = {cliente:'Cliente',contato:'Contato',negocio:'Negócio',canal:'Canal',responsavel:'Responsável',none:'Cronológico'};
    var periodoLabel = filtDe&&filtAte ? fmtD(filtDe)+' a '+fmtD(filtAte) : filtDe ? 'A partir de '+fmtD(filtDe) : filtAte ? 'Até '+fmtD(filtAte) : 'Todo o período';
    var propSel = filtPropId && propIdx[filtPropId] ? ' · Proposta: #'+(propIdx[filtPropId].num||'') : '';

    var css = '*{box-sizing:border-box;margin:0;padding:0}'
      +'body{font-family:Arial,sans-serif;font-size:12px;color:#111;background:#f8fafc;padding:20px}'
      +'.cabecalho{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1d4ed8;padding-bottom:10px;margin-bottom:20px}'
      +'.cab-titulo{font-size:20px;font-weight:800;color:#1d4ed8}'
      +'.cab-sub{font-size:11px;color:#555;margin-top:3px}'
      +'.cab-meta{text-align:right;font-size:10px;color:#777;line-height:1.6}'
      +'.grupo{margin-bottom:28px}'
      +'.grupo-hdr{display:flex;align-items:center;justify-content:space-between;background:#1d4ed8;color:#fff;padding:7px 12px;border-radius:6px;margin-bottom:12px}'
      +'.grupo-titulo{font-weight:700;font-size:13px}'
      +'.gbadge{background:rgba(255,255,255,.2);border-radius:20px;padding:2px 10px;font-size:10px;font-weight:600}'
      +'.gbadge.verde{background:rgba(34,197,94,.35)}'
      +'.timeline{padding-left:22px}'
      +'.tl-item{display:flex;gap:0;position:relative;margin-bottom:0}'
      +'.tl-dot{width:12px;height:12px;border-radius:50%;background:#1d4ed8;flex-shrink:0;margin-top:14px;margin-left:-22px;z-index:1;position:relative}'
      +'.tl-line{position:absolute;left:-17px;top:26px;bottom:-14px;width:2px;background:#dde3f0;z-index:0}'
      +'.tl-body{flex:1;margin-bottom:14px}'
      +'.card{background:#fff;border:1px solid #e5e7eb;border-left:4px solid #1d4ed8;border-radius:6px;padding:10px 12px}'
      +'.card-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px}'
      +'.tag-canal{font-size:11px;font-weight:700;color:#1d4ed8}'
      +'.tag-dt{font-size:10px;color:#6b7280}'
      +'.tag-st{font-size:9px;font-weight:700;border:1px solid;border-radius:20px;padding:1px 7px}'
      +'.tag-pri{font-size:9px;color:#6b7280}'
      +'.card-who{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:7px;padding-bottom:7px;border-bottom:1px dashed #e5e7eb}'
      +'.lbl-cli{font-weight:700;font-size:11px;color:#111}'
      +'.lbl-con{font-size:11px;color:#374151}'
      +'.lbl-resp{font-size:10px;color:#6b7280}'
      +'.lbl-prop{font-size:10px;color:#1d4ed8;background:#eff6ff;border-radius:3px;padding:1px 6px;margin-left:auto}'
      +'.card-row{display:flex;gap:6px;margin-bottom:4px;align-items:flex-start}'
      +'.row-ic{font-size:11px;flex-shrink:0;margin-top:1px}'
      +'.row-body{font-size:11px;color:#374151;line-height:1.5}'
      +'.row-dec{font-weight:600;color:#16a34a}'
      +'.row-acao{color:#1d4ed8}'
      +'.tag-prazo{font-size:10px;background:#f0f4ff;border-radius:3px;padding:1px 5px;margin-left:4px}'
      +'.tag-prazo.atrasado{background:#fef2f2;color:#dc2626;font-weight:700}'
      +'.rodape{margin-top:24px;border-top:1px solid #e5e7eb;padding-top:8px;font-size:9px;color:#9ca3af;text-align:center}'
      +'@media print{body{background:#fff;padding:12px}.grupo{page-break-inside:avoid}}';

    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
      +'<title>Relatório de Relacionamento — '+empresa+'</title>'
      +'<style>'+css+'</style></head><body>'
      +'<div class="cabecalho">'
      +'<div><div class="cab-titulo">💬 Relacionamento com Clientes</div>'
      +'<div class="cab-sub">'+esc(empresa)+' · Agrupado por: '+agrupLabel[agrup]+propSel+(filtCli?' · Cliente: '+filtCli:'')+(filtCon?' · Contato: '+filtCon:'')+(filtResp?' · Resp: '+filtResp:'')+'</div>'
      +'<div class="cab-sub">Período: '+periodoLabel+'</div></div>'
      +'<div class="cab-meta">Gerado em:<br>'+new Date().toLocaleString('pt-BR')+'<br><strong>'+list.length+' registro'+(list.length!==1?'s':'')+'</strong></div>'
      +'</div>'
      +gruposHtml
      +'<div class="rodape">Relatório gerado automaticamente · Portal '+esc(empresa)+'</div>'
      +'</body></html>';

    var win = window.open('','_blank','width=900,height=750');
    if (!win) { alert('Permita pop-ups para gerar o relatório.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function(){ win.print(); }, 700);
    document.getElementById('m-rel-relatorio').style.display = 'none';
  };

  console.log('%c[Histórico] carregado', 'color:#58a6ff;font-weight:700');
})();

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
  function _wireAcInputs() {
    var elCli = document.getElementById('hCliente');
    var elCts = document.getElementById('hContato');
    if (typeof acSetup === 'function') {
      acSetup(elCli, 'cliente');
      acSetup(elCts, 'contato');
    }
  }

  window.rHistorico = function () {
    _filtroRapido = '';
    if (typeof hShowSec === 'function') hShowSec('registros');
    _atualizarContador();
    _popularPropostas(null);
    _popularDatalists();
    _wireAcInputs();
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

      // Proposta vinculada
      var propCard = '';
      if (h.proposta_id && window.props) {
        var pp = (window.props||[]).find(function(x){ return x.id === h.proposta_id; });
        if (pp) {
          var ppAbrev = _abrevCliente(pp.loc || pp.cli || '');
          propCard = '<div style="font-size:.68rem;color:var(--blue);margin-bottom:.25rem">'
            + '🔗 #'+(pp.num||'')+' — '+esc(pp.tit||'')+(ppAbrev?' — '+ppAbrev:'')
            + '</div>';
        }
      }

      return '<div style="background:var(--bg2);border:1px solid var(--border);border-left:3px solid '+ bordaEsq +';border-radius:8px;padding:.7rem 1rem;margin-bottom:.5rem">'
        // Linha 1: data | canal | prazo | prioridade | status | ações
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
        // Linha 2: proposta vinculada
        + propCard
        // Linha 3: resumo (negrito, maior)
        + (h.resumo    ? '<div style="font-size:.8rem;font-weight:700;color:var(--text);margin-bottom:.22rem">📝 '+esc(h.resumo)+'</div>' : '')
        // Linha 4: decisão (normal)
        + (h.decisao   ? '<div style="font-size:.74rem;color:var(--green);margin-bottom:.15rem">✅ '+esc(h.decisao)+'</div>' : '')
        // Linha 5: pendência
        + (h.pendencia ? '<div style="font-size:.72rem;color:var(--accent);margin-bottom:.12rem">⏳ '+esc(h.pendencia)+'</div>' : '')
        // Linha 6: contato
        + (h.contato   ? '<div style="font-size:.7rem;color:var(--text2);margin-bottom:.08rem">👤 '+esc(h.contato)+'</div>' : '')
        // Linha 7: cliente
        + (h.cliente   ? '<div style="font-size:.7rem;color:var(--text3)">🏢 '+esc(h.cliente)+'</div>' : '')
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
    _wireAcInputs();
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
      var atrasado = h.prazo_acao && h.status==='em_andamento' && new Date(h.prazo_acao+'T00:00:00')<new Date();
      var stLabel = {em_andamento:'Em andamento',resolvido:'Resolvido',cancelado:'Cancelado'}[st]||st;
      var priLabel= {alta:'Alta',media:'Média',baixa:'Baixa'}[h.prioridade||'media'];
      var canalIco= {WhatsApp:'WhatsApp',Reunião:'Reunião','E-mail':'E-mail',Telefone:'Telefone',Outro:'Outro'}[h.canal]||h.canal||'';

      return '<div class="entrada'+(atrasado?' atrasada':'')+(st==='resolvido'?' resolvida':'')+'">'
        // Cabeçalho da entrada
        +'<div class="entrada-meta">'
        +'<span class="meta-data">'+fmtDt(h.data)+'</span>'
        +'<span class="meta-sep">|</span>'
        +'<span class="meta-canal">'+esc(canalIco)+'</span>'
        +(h.cliente?'<span class="meta-sep">|</span><span class="meta-cli">'+esc(h.cliente)+'</span>':'')
        +(h.contato?'<span class="meta-sep">·</span><span class="meta-con">'+esc(h.contato)+'</span>':'')
        +(propLabel?'<span class="meta-sep">|</span><span class="meta-prop">'+esc(propLabel)+'</span>':'')
        +'<span class="meta-badges">'
        +'<span class="badge-st '+(st==='resolvido'?'st-ok':atrasado?'st-err':'st-pend')+'">'+stLabel+'</span>'
        +(atrasado?'<span class="badge-at">ATRASADO</span>':'')
        +'</span>'
        +'</div>'
        // Corpo
        +(h.resumo?'<div class="campo"><span class="campo-lbl">Resumo:</span> <span class="campo-val">'+esc(h.resumo)+'</span></div>':'')
        +(h.decisao?'<div class="campo"><span class="campo-lbl dec-lbl">Decisão:</span> <span class="campo-val dec-val">'+esc(h.decisao)+'</span></div>':'')
        +(h.pendencia?'<div class="campo"><span class="campo-lbl">Pendência:</span> <span class="campo-val">'+esc(h.pendencia)+'</span></div>':'')
        +(h.proxima_acao?'<div class="campo"><span class="campo-lbl acao-lbl">Próxima ação:</span> <span class="campo-val acao-val">'+esc(h.proxima_acao)
          +(h.prazo_acao?' — prazo: '+fmtD(h.prazo_acao)+(atrasado?' (VENCIDO)':''):'')
          +(h.responsavel?' | Resp: '+esc(h.responsavel):'')
          +'</span></div>':'')
        +'</div>';
    }

    var gruposHtml = ordem.map(function(k, gi){
      var regs = grupos[k];
      var total = regs.length;
      var resolvidos = regs.filter(function(h){ return h.status==='resolvido'; }).length;
      var atrasados  = regs.filter(function(h){ return isAtrasado(h); }).length;

      var resumoGrupo = 'Total de interações: <strong>'+total+'</strong>'
        +(resolvidos?' &nbsp;·&nbsp; Resolvidas: <strong>'+resolvidos+'</strong>':'')
        +(atrasados?' &nbsp;·&nbsp; <span class="alerta-at">Atrasadas: '+atrasados+'</span>':'');

      return '<div class="grupo">'
        +'<div class="grupo-titulo"><span class="grupo-num">'+(gi+1)+'.</span> '+esc(k)+'</div>'
        +'<div class="grupo-resumo">'+resumoGrupo+'</div>'
        +'<div class="tl">'
        +regs.map(function(h, i){
          return '<div class="tl-item">'
            +'<div class="tl-marcador"><div class="tl-dot"></div>'+(i<regs.length-1?'<div class="tl-fio"></div>':'')+'</div>'
            +'<div class="tl-corpo">'+cardHtml(h)+'</div>'
            +'</div>';
        }).join('')
        +'</div>'
        +'</div>';
    }).join('');

    if (!ordem.length) gruposHtml = '<p class="vazio">Nenhum registro encontrado para os filtros selecionados.</p>';

    var empresa  = (window.getEmpresaAtiva && window.getEmpresaAtiva()) ? window.getEmpresaAtiva().nome : 'Tecfusion';
    var agrupLabel = {cliente:'Cliente',contato:'Contato',negocio:'Negócio',canal:'Canal',responsavel:'Responsável',none:'Cronológico'};
    var periodoLabel = filtDe&&filtAte ? fmtD(filtDe)+' a '+fmtD(filtAte) : filtDe ? 'A partir de '+fmtD(filtDe) : filtAte ? 'Até '+fmtD(filtAte) : 'Todo o período';
    var propSel  = filtPropId && propIdx[filtPropId] ? propIdx[filtPropId].num||'' : '';
    var assunto  = 'Relatório de Relacionamento com Clientes'
      +' — Agrupado por '+agrupLabel[agrup]
      +(propSel?' — Proposta #'+propSel:'')
      +(filtCli?' — Cliente: '+filtCli:'')
      +(filtCon?' — Contato: '+filtCon:'');
    var hoje2    = new Date();
    var cidadeData = 'Jundiaí, '+hoje2.getDate()+' de '
      +['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][hoje2.getMonth()]
      +' de '+hoje2.getFullYear();

    var css = '@page{size:A4;margin:22mm 18mm}'
      +'*{box-sizing:border-box;margin:0;padding:0}'
      +'body{font-family:"Times New Roman",Times,serif;font-size:12pt;color:#000;background:#fff;padding:0}'
      +'.pagina{max-width:760px;margin:0 auto;padding:32px 40px}'
      // Topo memorando
      +'.topo{border-bottom:2px solid #000;padding-bottom:10px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-end}'
      +'.topo-emp{font-size:15pt;font-weight:700;letter-spacing:.02em}'
      +'.topo-sub{font-size:9pt;color:#444;margin-top:2px}'
      +'.topo-data{font-size:10pt;text-align:right;color:#333}'
      +'.memo-titulo{text-align:center;font-size:14pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:18px;border-bottom:1px solid #000;padding-bottom:6px}'
      // Campos para/de/assunto
      +'.memo-campos{border:1px solid #aaa;border-radius:0;margin-bottom:20px}'
      +'.mc-linha{display:flex;border-bottom:1px solid #ccc;padding:5px 10px;font-size:11pt}'
      +'.mc-linha:last-child{border-bottom:none}'
      +'.mc-rot{font-weight:700;min-width:80px;flex-shrink:0}'
      +'.mc-val{flex:1}'
      // Grupos
      +'.grupo{margin-bottom:22px;page-break-inside:avoid}'
      +'.grupo-titulo{font-size:12pt;font-weight:700;border-bottom:1.5px solid #000;padding-bottom:3px;margin-bottom:4px}'
      +'.grupo-num{display:inline-block;min-width:20px}'
      +'.grupo-resumo{font-size:9pt;color:#555;margin-bottom:10px;font-style:italic}'
      +'.alerta-at{color:#c00;font-weight:700}'
      // Timeline
      +'.tl{padding-left:20px}'
      +'.tl-item{display:flex;gap:0;position:relative;margin-bottom:0}'
      +'.tl-marcador{display:flex;flex-direction:column;align-items:center;width:20px;flex-shrink:0;margin-left:-20px}'
      +'.tl-dot{width:8px;height:8px;border-radius:50%;background:#000;flex-shrink:0;margin-top:16px;border:1.5px solid #000}'
      +'.tl-fio{width:1px;flex:1;background:#aaa;min-height:12px}'
      +'.tl-corpo{flex:1;margin-bottom:12px}'
      // Entrada
      +'.entrada{border:1px solid #ccc;border-left:3px solid #000;padding:8px 10px;font-size:10.5pt;background:#fff}'
      +'.entrada.atrasada{border-left-color:#c00;background:#fffafa}'
      +'.entrada.resolvida{border-left-color:#1a7a3a;opacity:.9}'
      +'.entrada-meta{display:flex;align-items:baseline;flex-wrap:wrap;gap:3px;margin-bottom:6px;padding-bottom:5px;border-bottom:1px dashed #ccc;font-size:9.5pt}'
      +'.meta-data{font-weight:700}'
      +'.meta-sep{color:#aaa;margin:0 2px}'
      +'.meta-canal{font-style:italic}'
      +'.meta-cli{font-weight:700}'
      +'.meta-con{color:#333}'
      +'.meta-prop{color:#1a3a7a;font-size:9pt}'
      +'.meta-badges{margin-left:auto;display:flex;gap:4px;flex-shrink:0}'
      +'.badge-st{font-size:8pt;font-weight:700;border:1px solid;padding:0 5px;border-radius:2px}'
      +'.st-ok{color:#1a7a3a;border-color:#1a7a3a}'
      +'.st-pend{color:#7a5a00;border-color:#c8a000}'
      +'.st-err{color:#c00;border-color:#c00}'
      +'.badge-at{font-size:8pt;font-weight:700;color:#c00;border:1px solid #c00;padding:0 5px;border-radius:2px}'
      // Campos do corpo
      +'.campo{margin-bottom:3px;line-height:1.5}'
      +'.campo-lbl{font-weight:700;font-size:10pt}'
      +'.campo-val{font-size:10.5pt}'
      +'.dec-lbl{color:#1a7a3a}'
      +'.dec-val{color:#1a7a3a;font-weight:600}'
      +'.acao-lbl{color:#1a3a7a}'
      +'.acao-val{color:#1a3a7a}'
      // Rodapé
      +'.assinatura{margin-top:36px;border-top:1px solid #000;padding-top:10px;display:flex;justify-content:space-between}'
      +'.ass-bloco{text-align:center;font-size:10pt}'
      +'.ass-linha{border-top:1px solid #000;width:200px;margin:24px auto 4px}'
      +'.rodape{margin-top:24px;border-top:1px solid #ccc;padding-top:6px;font-size:8pt;color:#888;text-align:center}'
      +'.vazio{text-align:center;padding:2rem;color:#888;font-style:italic}'
      +'@media print{body{padding:0}.pagina{padding:0 10px}}'
      +'@media screen{body{background:#e5e7eb}.pagina{box-shadow:0 2px 16px rgba(0,0,0,.15)}}';

    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
      +'<title>Memorando — Relacionamento — '+esc(empresa)+'</title>'
      +'<style>'+css+'</style></head><body><div class="pagina">'
      // Topo
      +'<div class="topo">'
      +'<div><div class="topo-emp">'+esc(empresa)+'</div><div class="topo-sub">Relatório Interno de Relacionamento com Clientes</div></div>'
      +'<div class="topo-data">'+cidadeData+'</div>'
      +'</div>'
      // Título Memorando
      +'<div class="memo-titulo">Memorando</div>'
      // Campos
      +'<div class="memo-campos">'
      +'<div class="mc-linha"><span class="mc-rot">Para:</span><span class="mc-val">Equipe Comercial / Gestão</span></div>'
      +'<div class="mc-linha"><span class="mc-rot">De:</span><span class="mc-val">Sistema de Relacionamento — '+esc(empresa)+'</span></div>'
      +'<div class="mc-linha"><span class="mc-rot">Assunto:</span><span class="mc-val">'+esc(assunto)+'</span></div>'
      +'<div class="mc-linha"><span class="mc-rot">Período:</span><span class="mc-val">'+periodoLabel+' &nbsp;·&nbsp; <strong>'+list.length+' registro'+(list.length!==1?'s':'')+'</strong></span></div>'
      +(filtCon?'<div class="mc-linha"><span class="mc-rot">Contato:</span><span class="mc-val">'+esc(filtCon)+'</span></div>':'')
      +(filtCli?'<div class="mc-linha"><span class="mc-rot">Cliente:</span><span class="mc-val">'+esc(filtCli)+'</span></div>':'')
      +'</div>'
      // Corpo
      +gruposHtml
      // Assinatura
      +'<div class="assinatura">'
      +'<div class="ass-bloco"><div class="ass-linha"></div>Gestor Responsável</div>'
      +'<div class="ass-bloco"><div class="ass-linha"></div>Aprovado por</div>'
      +'</div>'
      +'<div class="rodape">Documento gerado automaticamente em '+new Date().toLocaleString('pt-BR')+' · '+esc(empresa)+'</div>'
      +'</div></body></html>';

    var win = window.open('','_blank','width=860,height=800');
    if (!win) { alert('Permita pop-ups para gerar o relatório.'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function(){ win.print(); }, 700);
    document.getElementById('m-rel-relatorio').style.display = 'none';
  };

  console.log('%c[Histórico] carregado', 'color:#58a6ff;font-weight:700');
})();

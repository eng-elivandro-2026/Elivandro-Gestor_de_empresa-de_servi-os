// Módulo Histórico de Relacionamento — TecFusion
(function () {
  var KEY = 'tf_historico';

  function hLS(v) {
    if (v === undefined) { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch(e) { return []; } }
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch(e) {}
  }

  function genId() { return 'hst_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

  // Retorna datetime local no formato YYYY-MM-DDTHH:MM (sem conversão UTC)
  function _localDatetimeISO() {
    var d = new Date();
    var pad = function(n){ return String(n).padStart(2,'0'); };
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
  }

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
    var fr = document.getElementById('hFiltroResponsavel');
    if (fs) fs.value = '';
    if (fp) fp.value = '';
    if (fc) fc.value = '';
    if (fr) fr.value = '';
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
      acSetup(elCli, 'cliente', function(c) {
        // Auto-sugere o primeiro contato cadastrado para este cliente
        if (!elCts || elCts.value) return;
        var cts = typeof ctsGetAll === 'function' ? ctsGetAll() : [];
        var match = cts.find(function(ct) {
          return ct.empresa && ct.empresa.toLowerCase().indexOf((c.nome || '').toLowerCase()) >= 0;
        });
        if (match) elCts.value = match.nome;
      });
      acSetup(elCts, 'contato', function(c) {
        // Auto-preenche hCliente se estiver vazio e o contato tiver empresa
        if (!elCli || elCli.value || !c.empresa) return;
        elCli.value = c.empresa;
      });
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
  function _popularFiltroResponsavel() {
    var sel = document.getElementById('hFiltroResponsavel');
    if (!sel) return;
    var atual = sel.value;
    var resp = {};
    hLS().forEach(function(h){ if (h.responsavel) resp[h.responsavel.trim()] = 1; });
    var opts = Object.keys(resp).sort(function(a,b){ return a.localeCompare(b,'pt-BR'); });
    sel.innerHTML = '<option value="">Todos os responsáveis</option>'
      + opts.map(function(r){ return '<option value="'+r+'"'+(r===atual?' selected':'')+'>'+r+'</option>'; }).join('');
  }

  function renderLista() {
    var el = document.getElementById('historicoLista');
    if (!el) return;

    _popularFiltroResponsavel();

    var list = hLS();
    var fc  = (document.getElementById('hFiltroCliente')     || {}).value || '';
    var fs  = (document.getElementById('hFiltroStatus')      || {}).value || '';
    var fp  = (document.getElementById('hFiltroPrioridade')  || {}).value || '';
    var fr  = (document.getElementById('hFiltroResponsavel') || {}).value || '';

    // filtro rápido "atrasados" sobrescreve os selects
    if (_filtroRapido === 'atrasados') {
      list = list.filter(isAtrasado);
    } else if (_filtroRapido === 'alta') {
      list = list.filter(function(h){ return h.prioridade === 'alta' && h.status !== 'resolvido'; });
    } else {
      if (fs) list = list.filter(function(h){ return h.status === fs; });
      if (fp) list = list.filter(function(h){ return (h.prioridade || 'media') === fp; });
    }
    if (fr) list = list.filter(function(h){ return (h.responsavel || '').trim() === fr; });

    if (fc) list = list.filter(function(h){
      var propTxt = '';
      if (h.proposta_id && window.props) {
        var pp = (window.props||[]).find(function(x){ return x.id === h.proposta_id; });
        if (pp) propTxt = [(pp.num||''), (pp.tit||''), (pp.cli||''), (pp.loc||'')].join(' ');
      }
      var txt = [h.cliente, h.contato, h.responsavel, h.resumo,
                 h.decisao, h.pendencia, h.proxima_acao, propTxt]
                .map(function(v){ return v || ''; }).join(' ').toLowerCase();
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
      data:         g('hData').value || _localDatetimeISO(),
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
    s('hData',        h ? (h.data || '').slice(0, 16) : _localDatetimeISO());
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
      var canalIco = h.canal||'';
      var entCls = 'entrada'+(atrasado?' atrasada':'')+(st==='resolvido'?' resolvida':'')+(st==='cancelado'?' cancelada':'');
      var badgeCls = 'bs '+(st==='resolvido'?'bs-ok':atrasado?'bs-err':'bs-pend');

      return '<div class="'+entCls+'">'
        +'<div class="em">'
        +'<span class="em-dt">'+fmtDt(h.data)+'</span>'
        +(canalIco?'<span class="em-sp">|</span><span class="em-cn">'+esc(canalIco)+'</span>':'')
        +(h.cliente?'<span class="em-sp">|</span><span class="em-cl">'+esc(h.cliente)+'</span>':'')
        +(h.contato?'<span class="em-sp">·</span><span class="em-co">'+esc(h.contato)+'</span>':'')
        +(propLabel?'<span class="em-sp">|</span><span class="em-pr">'+esc(propLabel)+'</span>':'')
        +'<span class="em-badges">'
        +'<span class="'+badgeCls+'">'+stLabel+'</span>'
        +(atrasado?'<span class="bs-at">ATRASADO</span>':'')
        +'</span>'
        +'</div>'
        +(h.resumo?'<div class="campo"><span class="cl">Resumo:</span> <span class="cv">'+esc(h.resumo)+'</span></div>':'')
        +(h.decisao?'<div class="campo"><span class="cl cl-dec">Decisão:</span> <span class="cv cv-dec">'+esc(h.decisao)+'</span></div>':'')
        +(h.pendencia?'<div class="campo"><span class="cl">Pendência:</span> <span class="cv">'+esc(h.pendencia)+'</span></div>':'')
        +(h.proxima_acao?'<div class="campo"><span class="cl cl-ac">Próxima ação:</span> <span class="cv cv-ac">'+esc(h.proxima_acao)
          +(h.prazo_acao?' — prazo: '+fmtD(h.prazo_acao)+(atrasado?' <strong>(VENCIDO)</strong>':''):'')
          +(h.responsavel?' | Resp: '+esc(h.responsavel):'')
          +'</span></div>':'')
        +'</div>';
    }

    var gruposHtml = ordem.map(function(k, gi){
      var regs = grupos[k];
      var total = regs.length;
      var resolvidos = regs.filter(function(h){ return h.status==='resolvido'; }).length;
      var atrasados  = regs.filter(function(h){ return isAtrasado(h); }).length;

      var tagsHtml = '<span class="gh-tag">'+total+' registro'+(total!==1?'s':'')+'</span>';
      if(resolvidos) tagsHtml += '<span class="gh-tag t-ok">✔ '+resolvidos+' resolvido'+(resolvidos!==1?'s':'')+'</span>';
      if(atrasados)  tagsHtml += '<span class="gh-tag t-err">⚠ '+atrasados+' atrasado'+(atrasados!==1?'s':'')+'</span>';

      return '<div class="grupo">'
        +'<div class="gh"><div class="gh-nome">'+(gi+1)+'. '+esc(k)+'</div><div class="gh-tags">'+tagsHtml+'</div></div>'
        +'<div class="gb"><div class="tl">'
        +regs.map(function(h, i){
          var dotCls = 'tl-dot'+(isAtrasado(h)?' d-err':h.status==='resolvido'?' d-ok':h.status==='cancelado'?' d-grey':'');
          return '<div class="tl-item">'
            +'<div class="tl-m"><div class="'+dotCls+'"></div>'+(i<regs.length-1?'<div class="tl-fio"></div>':'')+'</div>'
            +'<div class="tl-c">'+cardHtml(h)+'</div>'
            +'</div>';
        }).join('')
        +'</div></div>'
        +'</div>';
    }).join('');

    if (!ordem.length) gruposHtml = '<p class="vazio">Nenhum registro encontrado para os filtros selecionados.</p>';

    var empresa  = (window.getEmpresaAtiva && window.getEmpresaAtiva()) ? window.getEmpresaAtiva().nome : 'Tecfusion';
    var agrupLabel = {cliente:'Cliente',contato:'Contato',negocio:'Negócio',canal:'Canal',responsavel:'Responsável',none:'Cronológico'};
    var periodoLabel = filtDe&&filtAte ? fmtD(filtDe)+' a '+fmtD(filtAte) : filtDe ? 'A partir de '+fmtD(filtDe) : filtAte ? 'Até '+fmtD(filtAte) : 'Todo o período';
    var propSel  = filtPropId && propIdx[filtPropId] ? propIdx[filtPropId].num||'' : '';
    var hoje2    = new Date();
    var cidadeData = hoje2.getDate()+' de '
      +['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][hoje2.getMonth()]
      +' de '+hoje2.getFullYear();

    // Estatísticas globais
    var totalRegs   = list.length;
    var nResolvidos = list.filter(function(h){ return h.status==='resolvido'; }).length;
    var nAndamento  = list.filter(function(h){ return h.status==='em_andamento'&&!isAtrasado(h); }).length;
    var nAtrasados  = list.filter(isAtrasado).length;
    var nCancelados = list.filter(function(h){ return h.status==='cancelado'; }).length;

    var css = '@page{size:A4;margin:20mm 18mm}'
      +'*{box-sizing:border-box;margin:0;padding:0}'
      +'body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1a1a1a;background:#fff}'
      +'.pagina{max-width:794px;margin:0 auto;padding:28px 36px}'
      // Cabeçalho
      +'.cabecalho{display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:3px solid #1e3a5f;margin-bottom:16px}'
      +'.cab-nome{font-size:17pt;font-weight:700;color:#1e3a5f;letter-spacing:.02em}'
      +'.cab-sub{font-size:8.5pt;color:#666;margin-top:3px}'
      +'.cab-icone{font-size:26pt;line-height:1}'
      // Título
      +'.rel-bloco{text-align:center;margin-bottom:16px}'
      +'.rel-titulo{font-size:14pt;font-weight:700;color:#1e3a5f;text-transform:uppercase;letter-spacing:.06em;line-height:1.3}'
      +'.rel-sub{font-size:9.5pt;color:#555;margin-top:5px}'
      +'.linha-dec{height:2px;background:linear-gradient(to right,transparent,#1e3a5f,transparent);margin:10px auto 0;width:55%}'
      // Metadados
      +'.meta-box{background:#f0f4f8;border:1px solid #c8d6e5;border-radius:3px;padding:9px 14px;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:4px 20px;font-size:9pt}'
      +'.mi{display:flex;gap:4px;align-items:baseline}'
      +'.mi-r{font-weight:700;color:#1e3a5f}'
      +'.mi-v{color:#333}'
      // Estatísticas
      +'.stats{display:flex;margin-bottom:20px;border:1px solid #c8d6e5;border-radius:3px;overflow:hidden}'
      +'.stat{flex:1;text-align:center;padding:8px 4px;border-right:1px solid #c8d6e5}'
      +'.stat:last-child{border-right:none}'
      +'.sn{font-size:17pt;font-weight:700;color:#1e3a5f;line-height:1}'
      +'.sl{font-size:7.5pt;color:#666;margin-top:2px;text-transform:uppercase;letter-spacing:.03em}'
      +'.stat.s-ok .sn{color:#1a7a3a}.stat.s-pend .sn{color:#7a5a00}.stat.s-err .sn{color:#c00}.stat.s-grey .sn{color:#888}'
      // Grupos
      +'.grupo{margin-bottom:20px;page-break-inside:avoid}'
      +'.gh{background:#1e3a5f;color:#fff;padding:7px 12px;border-radius:3px 3px 0 0;display:flex;justify-content:space-between;align-items:center;gap:8px}'
      +'.gh-nome{font-size:11pt;font-weight:700}'
      +'.gh-tags{display:flex;gap:5px;flex-shrink:0;flex-wrap:wrap}'
      +'.gh-tag{font-size:7.5pt;background:rgba(255,255,255,.2);border-radius:8px;padding:1px 8px}'
      +'.gh-tag.t-ok{background:rgba(100,220,130,.25)}.gh-tag.t-err{background:rgba(255,100,100,.3)}'
      +'.gb{border:1px solid #c8d6e5;border-top:none;border-radius:0 0 3px 3px}'
      // Timeline
      +'.tl{padding:8px 12px}'
      +'.tl-item{display:flex;position:relative;margin-bottom:0}'
      +'.tl-m{display:flex;flex-direction:column;align-items:center;width:22px;flex-shrink:0}'
      +'.tl-dot{width:10px;height:10px;border-radius:50%;background:#1e3a5f;flex-shrink:0;margin-top:13px;border:2px solid #1e3a5f}'
      +'.tl-dot.d-ok{background:#1a7a3a;border-color:#1a7a3a}.tl-dot.d-err{background:#c00;border-color:#c00}.tl-dot.d-grey{background:#999;border-color:#999}'
      +'.tl-fio{width:1.5px;flex:1;background:#d0d8e4;min-height:10px}'
      +'.tl-c{flex:1;margin-bottom:12px}'
      // Entrada
      +'.entrada{border:1px solid #dde3ea;border-left:4px solid #1e3a5f;padding:8px 12px;font-size:10pt;background:#fff;border-radius:0 3px 3px 0}'
      +'.entrada.atrasada{border-left-color:#c00;background:#fff8f8}'
      +'.entrada.resolvida{border-left-color:#1a7a3a;background:#f6fff8}'
      +'.entrada.cancelada{border-left-color:#999;opacity:.85}'
      +'.em{display:flex;align-items:baseline;flex-wrap:wrap;gap:3px;margin-bottom:5px;padding-bottom:5px;border-bottom:1px dashed #e0e6ee;font-size:9pt}'
      +'.em-dt{font-weight:700;color:#1e3a5f}.em-sp{color:#ccc;margin:0 2px}.em-cn{font-style:italic;color:#555}'
      +'.em-cl{font-weight:700}.em-co{color:#444}.em-pr{color:#1e3a5f;font-size:8.5pt}'
      +'.em-badges{margin-left:auto;display:flex;gap:4px;flex-shrink:0}'
      +'.bs{font-size:7.5pt;font-weight:700;border:1px solid;padding:1px 7px;border-radius:10px}'
      +'.bs-ok{color:#1a7a3a;border-color:#1a7a3a;background:#f0fff4}'
      +'.bs-pend{color:#7a5a00;border-color:#c8a000;background:#fffbf0}'
      +'.bs-err{color:#c00;border-color:#c00;background:#fff8f8}'
      +'.bs-at{font-size:7.5pt;font-weight:700;color:#c00;border:1px solid #c00;padding:1px 7px;border-radius:10px;background:#fff0f0}'
      +'.campo{margin-bottom:3px;line-height:1.55}'
      +'.cl{font-weight:700;font-size:9.5pt;color:#444}'
      +'.cv{font-size:10pt}'
      +'.cl-dec{color:#1a7a3a}.cv-dec{color:#1a7a3a;font-weight:600}'
      +'.cl-ac{color:#1e3a5f}.cv-ac{color:#1e3a5f}'
      // Assinatura / Rodapé
      +'.assinatura{margin-top:38px;display:flex;justify-content:space-between;page-break-inside:avoid}'
      +'.ass-b{text-align:center;font-size:9.5pt;color:#444}'
      +'.ass-l{border-top:1px solid #555;width:180px;margin:28px auto 5px}'
      +'.rodape{margin-top:16px;padding-top:8px;border-top:2px solid #1e3a5f;font-size:7.5pt;color:#888;display:flex;justify-content:space-between}'
      +'.vazio{text-align:center;padding:2.5rem;color:#888;font-style:italic}'
      +'@media print{body{background:#fff}.pagina{padding:0;box-shadow:none}}'
      +'@media screen{body{background:#c9d0d9}.pagina{box-shadow:0 4px 28px rgba(0,0,0,.25);min-height:1060px}}';

    var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
      +'<title>Relatório de Relacionamento — '+esc(empresa)+'</title>'
      +'<style>'+css+'</style></head><body><div class="pagina">'
      // Cabeçalho
      +'<div class="cabecalho">'
      +'<div><div class="cab-nome">'+esc(empresa)+'</div><div class="cab-sub">Gestão de Clientes e Negócios</div></div>'
      +'<div class="cab-icone">🤝</div>'
      +'</div>'
      // Título
      +'<div class="rel-bloco">'
      +'<div class="rel-titulo">Relatório de Relacionamento com Clientes e Negócios</div>'
      +'<div class="rel-sub">Agrupado por '+agrupLabel[agrup]+' &nbsp;·&nbsp; '+periodoLabel+'</div>'
      +'<div class="linha-dec"></div>'
      +'</div>'
      // Metadados
      +'<div class="meta-box">'
      +'<div class="mi"><span class="mi-r">Período:</span><span class="mi-v">'+periodoLabel+'</span></div>'
      +'<div class="mi"><span class="mi-r">Agrupamento:</span><span class="mi-v">'+agrupLabel[agrup]+'</span></div>'
      +(filtCli?'<div class="mi"><span class="mi-r">Cliente:</span><span class="mi-v">'+esc(filtCli)+'</span></div>':'')
      +(filtCon?'<div class="mi"><span class="mi-r">Contato:</span><span class="mi-v">'+esc(filtCon)+'</span></div>':'')
      +(propSel?'<div class="mi"><span class="mi-r">Proposta:</span><span class="mi-v">#'+esc(propSel)+'</span></div>':'')
      +(filtResp?'<div class="mi"><span class="mi-r">Responsável:</span><span class="mi-v">'+esc(filtResp)+'</span></div>':'')
      +'<div class="mi"><span class="mi-r">Emitido em:</span><span class="mi-v">'+cidadeData+'</span></div>'
      +'</div>'
      // Estatísticas
      +'<div class="stats">'
      +'<div class="stat"><div class="sn">'+totalRegs+'</div><div class="sl">Total</div></div>'
      +'<div class="stat s-ok"><div class="sn">'+nResolvidos+'</div><div class="sl">Resolvidos</div></div>'
      +'<div class="stat s-pend"><div class="sn">'+nAndamento+'</div><div class="sl">Em andamento</div></div>'
      +'<div class="stat s-err"><div class="sn">'+nAtrasados+'</div><div class="sl">Atrasados</div></div>'
      +'<div class="stat s-grey"><div class="sn">'+nCancelados+'</div><div class="sl">Cancelados</div></div>'
      +'</div>'
      // Conteúdo
      +gruposHtml
      // Assinatura
      +'<div class="assinatura">'
      +'<div class="ass-b"><div class="ass-l"></div>Responsável Comercial</div>'
      +'<div class="ass-b"><div class="ass-l"></div>Aprovado por</div>'
      +'</div>'
      +'<div class="rodape">'
      +'<span>'+esc(empresa)+' · Sistema de Gestão</span>'
      +'<span>Documento gerado em '+new Date().toLocaleString('pt-BR')+'</span>'
      +'</div>'
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

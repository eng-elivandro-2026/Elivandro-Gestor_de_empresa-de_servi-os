// ============================================================
// cadastro.js — Cadastro reutilizável de Contatos e Clientes
// Stores: tf_contatos / tf_clientes (localStorage + Supabase)
// API global: acSetup · abrirModalNovoContato · abrirModalNovoCliente
//             ctsGetAll · cliGetAll · ctsSeedFromData
// ============================================================

(function () {
  var KEY_CTS = 'tf_contatos';
  var KEY_CLI = 'tf_clientes';

  // ── Helpers localStorage ──────────────────────────────────
  function ctsLoad() {
    try { return JSON.parse(localStorage.getItem(KEY_CTS) || '[]'); } catch(e) { return []; }
  }
  function cliLoad() {
    try { return JSON.parse(localStorage.getItem(KEY_CLI) || '[]'); } catch(e) { return []; }
  }
  function ctsSave(list) {
    try { localStorage.setItem(KEY_CTS, JSON.stringify(list)); } catch(e) {}
    _sbSave(KEY_CTS, list);
  }
  function cliSave(list) {
    try { localStorage.setItem(KEY_CLI, JSON.stringify(list)); } catch(e) {}
    _sbSave(KEY_CLI, list);
  }

  // ── Supabase sync ─────────────────────────────────────────
  function _sbSave(chave, valor) {
    if (!window.sbClient) return;
    window.sbClient.from('configuracoes').upsert(
      { chave: chave, valor: valor, updated_at: new Date().toISOString() },
      { onConflict: 'chave' }
    ).then(function(r) { if (r.error) console.warn('[cadastro] save error', r.error); });
  }

  function _sbLoad(chave, setter) {
    if (!window.sbClient) return;
    window.sbClient.from('configuracoes').select('valor').eq('chave', chave).maybeSingle()
      .then(function(r) {
        if (r.data && Array.isArray(r.data.valor) && r.data.valor.length) {
          try { localStorage.setItem(chave, JSON.stringify(r.data.valor)); } catch(e) {}
          if (setter) setter(r.data.valor);
        }
      });
  }

  // ── ID gerador ────────────────────────────────────────────
  function _id() { return 'cad_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

  // ── Seed a partir dos dados existentes ────────────────────
  function seedFromData() {
    var cts  = ctsLoad();
    var clis = cliLoad();
    var ctsChanged = false;
    var cliChanged = false;

    function addCts(nome, empresa) {
      if (!nome || !nome.trim()) return;
      nome = nome.trim();
      if (cts.some(function(c) { return c.nome.toLowerCase() === nome.toLowerCase(); })) return;
      cts.push({ id: _id(), nome: nome, empresa: empresa || '', email: '', telefone: '', criado: new Date().toISOString() });
      ctsChanged = true;
    }
    function addCli(nome, cnpj) {
      if (!nome || !nome.trim()) return;
      nome = nome.trim();
      if (clis.some(function(c) { return c.nome.toLowerCase() === nome.toLowerCase(); })) return;
      clis.push({ id: _id(), nome: nome, cnpj: cnpj || '', criado: new Date().toISOString() });
      cliChanged = true;
    }

    // De propostas
    (window.props || []).forEach(function(p) {
      var cli = (p.loc || p.cli || '').trim();
      if (cli) addCli(cli, p.locCnpj || p.cnpj || '');
      if (p.ac)  addCts(p.ac,  cli);
      if (p.ac2) addCts(p.ac2, cli);
    });

    // Do histórico
    var hist = [];
    try { hist = JSON.parse(localStorage.getItem('tf_historico') || '[]'); } catch(e) {}
    hist.forEach(function(h) {
      if (h.contato) addCts(h.contato, h.cliente || '');
      if (h.cliente) addCli(h.cliente, '');
    });

    if (ctsChanged) ctsSave(cts);
    if (cliChanged) cliSave(clis);
  }

  // ── CSS do dropdown ───────────────────────────────────────
  var style = document.createElement('style');
  style.textContent =
    '.ac-wrap{position:relative}'
    + '.ac-dd{position:absolute;top:calc(100% + 2px);left:0;right:0;z-index:9999;background:var(--bg2);border:1px solid var(--border);border-radius:6px;max-height:230px;overflow-y:auto;box-shadow:0 6px 18px rgba(0,0,0,.22);display:none}'
    + '.ac-it{display:flex;align-items:center;gap:.5rem;padding:.42rem .65rem;cursor:pointer;font-size:.78rem;border-bottom:1px solid var(--border)}'
    + '.ac-it:last-child{border-bottom:none}'
    + '.ac-it:hover,.ac-it:focus{background:var(--bg3)}'
    + '.ac-it-sub{font-size:.68rem;color:var(--text3);margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px}'
    + '.ac-it-new{color:var(--blue);font-weight:600}'
    + '.ac-it-new:hover{background:rgba(14,165,233,.08)}';
  document.head.appendChild(style);

  // ── Autocomplete reutilizável ─────────────────────────────
  // tipo: 'contato' | 'cliente'
  // onSelect(item): callback opcional quando item é escolhido
  window.acSetup = function (inputEl, tipo, onSelect) {
    if (!inputEl || inputEl._acDone) return;
    inputEl._acDone = true;

    // Remove datalist vinculado se existir
    inputEl.removeAttribute('list');

    // Garante wrapper relativo
    var wrap = inputEl.parentElement;
    if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

    var dd = document.createElement('div');
    dd.className = 'ac-dd';
    wrap.appendChild(dd);

    function getList() { return tipo === 'contato' ? ctsLoad() : cliLoad(); }

    function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

    function render(q) {
      var list  = getList();
      var lower = (q || '').toLowerCase().trim();
      var hits  = lower
        ? list.filter(function(x) { return x.nome.toLowerCase().indexOf(lower) >= 0; }).slice(0, 10)
        : list.slice(0, 10);

      var label = tipo === 'contato' ? 'Contato' : 'Cliente';

      dd.innerHTML = hits.map(function(x) {
        var sub = (tipo === 'contato' ? x.empresa : x.cnpj) || '';
        return '<div class="ac-it" data-id="' + x.id + '" data-nome="' + esc(x.nome) + '">'
          + esc(x.nome)
          + (sub ? '<span class="ac-it-sub">' + esc(sub) + '</span>' : '')
          + '</div>';
      }).join('')
        + '<div class="ac-it ac-it-new" data-criar="1">➕ '
        + (lower ? 'Cadastrar: <strong>' + esc(q) + '</strong>' : 'Novo ' + label)
        + '</div>';

      dd.style.display = 'block';

      dd.querySelectorAll('.ac-it').forEach(function(item) {
        item.addEventListener('mousedown', function(e) {
          e.preventDefault();
          if (item.dataset.criar) {
            dd.style.display = 'none';
            var atual = inputEl.value;
            if (tipo === 'contato') {
              window.abrirModalNovoContato(atual, function(c) {
                inputEl.value = c.nome;
                if (typeof onSelect === 'function') onSelect(c);
              });
            } else {
              window.abrirModalNovoCliente(atual, function(c) {
                inputEl.value = c.nome;
                if (typeof onSelect === 'function') onSelect(c);
              });
            }
          } else {
            inputEl.value = item.dataset.nome;
            dd.style.display = 'none';
            if (typeof onSelect === 'function') {
              var found = getList().find(function(x) { return x.id === item.dataset.id; });
              onSelect(found || { nome: item.dataset.nome });
            }
          }
        });
      });
    }

    inputEl.addEventListener('input',  function() { render(this.value); });
    inputEl.addEventListener('focus',  function() { render(this.value); });
    inputEl.addEventListener('blur',   function() { setTimeout(function() { dd.style.display = 'none'; }, 220); });
    inputEl.addEventListener('keydown', function(e) { if (e.key === 'Escape') dd.style.display = 'none'; });
  };

  // ── Modal Novo Contato ────────────────────────────────────
  window.abrirModalNovoContato = function(nome, callback) {
    window._cadCtsCb = callback;
    var g = function(id) { return document.getElementById(id); };
    if (!g('m-novo-contato')) return;
    g('ncNome').value     = nome || '';
    g('ncEmpresa').value  = '';
    g('ncEmail').value    = '';
    g('ncTelefone').value = '';
    if (typeof abrirModal === 'function') abrirModal('m-novo-contato');
  };

  window.salvarNovoContato = function() {
    var g   = function(id) { return (document.getElementById(id) || {}).value || ''; };
    var nome = g('ncNome').trim();
    if (!nome) { alert('Informe o nome do contato.'); return; }
    var novo = { id: _id(), nome: nome, empresa: g('ncEmpresa').trim(), email: g('ncEmail').trim(), telefone: g('ncTelefone').trim(), criado: new Date().toISOString() };
    var list = ctsLoad();
    list.unshift(novo);
    ctsSave(list);
    if (typeof fecharModal === 'function') fecharModal('m-novo-contato');
    if (typeof window._cadCtsCb === 'function') { window._cadCtsCb(novo); window._cadCtsCb = null; }
    if (typeof toast === 'function') toast('✅ Contato cadastrado: ' + nome, 'ok');
  };

  // ── Modal Novo Cliente ────────────────────────────────────
  window.abrirModalNovoCliente = function(nome, callback) {
    window._cadCliCb = callback;
    var g = function(id) { return document.getElementById(id); };
    if (!g('m-novo-cliente')) return;
    g('ncliNome').value   = nome || '';
    g('ncliCnpj').value   = '';
    g('ncliCidade').value = '';
    if (typeof abrirModal === 'function') abrirModal('m-novo-cliente');
  };

  window.salvarNovoCliente = function() {
    var g   = function(id) { return (document.getElementById(id) || {}).value || ''; };
    var nome = g('ncliNome').trim();
    if (!nome) { alert('Informe o nome do cliente.'); return; }
    var novo = { id: _id(), nome: nome, cnpj: g('ncliCnpj').trim(), cidade: g('ncliCidade').trim(), criado: new Date().toISOString() };
    var list = cliLoad();
    list.unshift(novo);
    cliSave(list);
    if (typeof fecharModal === 'function') fecharModal('m-novo-cliente');
    if (typeof window._cadCliCb === 'function') { window._cadCliCb(novo); window._cadCliCb = null; }
    if (typeof toast === 'function') toast('✅ Cliente cadastrado: ' + nome, 'ok');
  };

  // ── API pública ───────────────────────────────────────────
  window.ctsGetAll      = ctsLoad;
  window.cliGetAll      = cliLoad;
  window.ctsSeedFromData = seedFromData;

  // ── Wiring do formulário de Propostas ─────────────────────
  // Conecta acSetup nos campos pCli, pLoc, pAC, pAC2
  function wirePropForm() {
    var g = function(id) { return document.getElementById(id); };

    // Card Cliente
    if (g('pCli')) acSetup(g('pCli'), 'cliente', function(c) {
      if (c.cnpj   && g('pCnpj')   && !g('pCnpj').value)   g('pCnpj').value   = c.cnpj;
      if (c.cidade && g('pCid')    && !g('pCid').value)     g('pCid').value    = c.cidade;
    });

    // Card Local de Serviço
    if (g('pLoc')) acSetup(g('pLoc'), 'cliente', function(c) {
      if (c.cnpj && g('pLocCnpj') && !g('pLocCnpj').value) g('pLocCnpj').value = c.cnpj;
    });

    // Contato 1
    if (g('pAC')) acSetup(g('pAC'), 'contato', function(c) {
      if (c.email    && g('pMail') && !g('pMail').value) g('pMail').value = c.email;
      if (c.telefone && g('pTel')  && !g('pTel').value)  g('pTel').value  = c.telefone;
    });

    // Contato 2
    if (g('pAC2')) acSetup(g('pAC2'), 'contato', function(c) {
      if (c.email    && g('pMail2') && !g('pMail2').value) g('pMail2').value = c.email;
      if (c.telefone && g('pTel2')  && !g('pTel2').value)  g('pTel2').value  = c.telefone;
    });
  }

  // Exposta para ser chamada após reset do formulário se necessário
  window.wirePropFormAc = wirePropForm;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    seedFromData();
    // Sincronizar da nuvem (carrega registros extras de outros usuários)
    _sbLoad(KEY_CTS, function(v) {
      var local = ctsLoad();
      var merged = local.slice();
      v.forEach(function(x) {
        if (!merged.some(function(m) { return m.id === x.id; })) merged.push(x);
      });
      try { localStorage.setItem(KEY_CTS, JSON.stringify(merged)); } catch(e) {}
    });
    _sbLoad(KEY_CLI, function(v) {
      var local = cliLoad();
      var merged = local.slice();
      v.forEach(function(x) {
        if (!merged.some(function(m) { return m.id === x.id; })) merged.push(x);
      });
      try { localStorage.setItem(KEY_CLI, JSON.stringify(merged)); } catch(e) {}
    });
    // Wire formulário de propostas (campos sempre no DOM)
    setTimeout(wirePropForm, 600);
    console.log('%c[Cadastro] carregado — contatos: ' + ctsLoad().length + ' · clientes: ' + cliLoad().length, 'color:#22c55e;font-weight:700');
  }

  // Aguarda window.props estar disponível antes de fazer seed
  var _tries = 0;
  function waitAndInit() {
    if (window.props || _tries++ > 30) { init(); return; }
    setTimeout(waitAndInit, 200);
  }
  waitAndInit();

  // Re-seed quando propostas forem recarregadas
  window.addEventListener('propostas:loaded', function() { seedFromData(); });

})();

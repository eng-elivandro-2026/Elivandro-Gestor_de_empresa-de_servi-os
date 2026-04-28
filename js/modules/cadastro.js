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

    // De propostas — lê localStorage.tf_props diretamente (sempre atualizado pelo Supabase)
    var allProps = [];
    try { allProps = JSON.parse(localStorage.getItem('tf_props') || '[]'); } catch(e) {}
    if (!allProps.length) allProps = window.props || [];

    allProps.forEach(function(p) {
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

  // ── Fechar modais (limpa estado de edição) ────────────────
  window._fecharModalCliente = function() {
    window._cadEditCliId = null;
    var t = document.getElementById('tituloModalCliente');
    if (t) t.textContent = '🏢 Novo Cliente';
    if (typeof fecharModal === 'function') fecharModal('m-novo-cliente');
  };
  window._fecharModalContato = function() {
    window._cadEditCtsId = null;
    var t = document.getElementById('tituloModalContato');
    if (t) t.textContent = '👤 Novo Contato';
    if (typeof fecharModal === 'function') fecharModal('m-novo-contato');
  };

  // ── Modal Novo Contato ────────────────────────────────────
  window.abrirModalNovoContato = function(nome, callback) {
    window._cadCtsCb = callback;
    window._cadEditCtsId = null;
    var g = function(id) { return document.getElementById(id); };
    if (!g('m-novo-contato')) return;
    var t = document.getElementById('tituloModalContato');
    if (t) t.textContent = '👤 Novo Contato';
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
    window._cadEditCliId = null;
    var g = function(id) { return document.getElementById(id); };
    if (!g('m-novo-cliente')) return;
    var t = document.getElementById('tituloModalCliente');
    if (t) t.textContent = '🏢 Novo Cliente';
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

  // ── Alternar seções no módulo Relacionamento ─────────────
  window.hShowSec = function(sec) {
    var secs = ['hSecRegistros', 'hSecClientes', 'hSecContatos'];
    secs.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = (id === 'hSec' + sec.charAt(0).toUpperCase() + sec.slice(1)) ? '' : 'none';
    });
    if (sec === 'clientes') renderTabelaClientes();
    if (sec === 'contatos') renderTabelaContatos();
  };

  // ── Editar cliente (reaproveita modal, modo edição) ───────
  window.editarCliente = function(id) {
    var list = cliLoad();
    var item = list.find(function(x) { return x.id === id; });
    if (!item) return;
    window._cadEditCliId = id;
    window._cadCliCb = null;
    var g = function(i) { return document.getElementById(i); };
    var t = document.getElementById('tituloModalCliente');
    if (t) t.textContent = '✏️ Editar Cliente';
    g('ncliNome').value   = item.nome   || '';
    g('ncliCnpj').value   = item.cnpj   || '';
    g('ncliCidade').value = item.cidade || '';
    if (typeof abrirModal === 'function') abrirModal('m-novo-cliente');
  };

  window.excluirCliente = function(id) {
    if (!confirm('Excluir este cliente?')) return;
    var list = cliLoad().filter(function(x) { return x.id !== id; });
    cliSave(list);
    renderTabelaClientes();
    if (typeof toast === 'function') toast('Cliente excluído', 'ok');
  };

  // Sobrescreve salvarNovoCliente para suportar edição
  var _origSalvarCli = window.salvarNovoCliente;
  window.salvarNovoCliente = function() {
    var g   = function(i) { return (document.getElementById(i) || {}).value || ''; };
    var nome = g('ncliNome').trim();
    if (!nome) { alert('Informe o nome do cliente.'); return; }

    if (window._cadEditCliId) {
      var list = cliLoad().map(function(x) {
        return x.id === window._cadEditCliId
          ? Object.assign({}, x, { nome: nome, cnpj: g('ncliCnpj').trim(), cidade: g('ncliCidade').trim() })
          : x;
      });
      cliSave(list);
      window._fecharModalCliente();
      renderTabelaClientes();
      if (typeof toast === 'function') toast('✅ Cliente atualizado: ' + nome, 'ok');
    } else {
      _origSalvarCli();
      renderTabelaClientes();
    }
  };

  // ── Editar contato (reaproveita modal, modo edição) ───────
  window.editarContato = function(id) {
    var list = ctsLoad();
    var item = list.find(function(x) { return x.id === id; });
    if (!item) return;
    window._cadEditCtsId = id;
    window._cadCtsCb = null;
    var g = function(i) { return document.getElementById(i); };
    var t = document.getElementById('tituloModalContato');
    if (t) t.textContent = '✏️ Editar Contato';
    g('ncNome').value     = item.nome     || '';
    g('ncEmpresa').value  = item.empresa  || '';
    g('ncEmail').value    = item.email    || '';
    g('ncTelefone').value = item.telefone || '';
    if (typeof abrirModal === 'function') abrirModal('m-novo-contato');
  };

  window.excluirContato = function(id) {
    if (!confirm('Excluir este contato?')) return;
    var list = ctsLoad().filter(function(x) { return x.id !== id; });
    ctsSave(list);
    renderTabelaContatos();
    if (typeof toast === 'function') toast('Contato excluído', 'ok');
  };

  // Sobrescreve salvarNovoContato para suportar edição
  var _origSalvarCts = window.salvarNovoContato;
  window.salvarNovoContato = function() {
    var g = function(i) { return (document.getElementById(i) || {}).value || ''; };
    var nome = g('ncNome').trim();
    if (!nome) { alert('Informe o nome do contato.'); return; }

    if (window._cadEditCtsId) {
      var list = ctsLoad().map(function(x) {
        return x.id === window._cadEditCtsId
          ? Object.assign({}, x, { nome: nome, empresa: g('ncEmpresa').trim(), email: g('ncEmail').trim(), telefone: g('ncTelefone').trim() })
          : x;
      });
      ctsSave(list);
      window._fecharModalContato();
      renderTabelaContatos();
      if (typeof toast === 'function') toast('✅ Contato atualizado: ' + nome, 'ok');
    } else {
      _origSalvarCts();
      renderTabelaContatos();
    }
  };

  // ── Render tabela de Clientes ─────────────────────────────
  function renderTabelaClientes() {
    var el = document.getElementById('tabelaClientes');
    if (!el) return;
    var list = cliLoad().sort(function(a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.82rem">Nenhum cliente cadastrado ainda.</div>';
      return;
    }
    function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:.78rem">'
      + '<thead><tr style="border-bottom:2px solid var(--border);color:var(--text3);font-size:.7rem;text-transform:uppercase;letter-spacing:.04em">'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Nome / Razão Social</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">CNPJ</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Cidade</th>'
      + '<th style="padding:.4rem .6rem;width:80px"></th>'
      + '</tr></thead><tbody>'
      + list.map(function(x) {
          return '<tr style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:.45rem .6rem;font-weight:600;color:var(--text)">' + esc(x.nome) + '</td>'
            + '<td style="padding:.45rem .6rem;color:var(--text2)">' + esc(x.cnpj) + '</td>'
            + '<td style="padding:.45rem .6rem;color:var(--text2)">' + esc(x.cidade) + '</td>'
            + '<td style="padding:.45rem .6rem;display:flex;gap:.4rem">'
            + '<button class="nb" onclick="editarCliente(\'' + x.id + '\')" style="font-size:.72rem;color:var(--blue)">✏️</button>'
            + '<button class="nb" onclick="excluirCliente(\'' + x.id + '\')" style="font-size:.72rem;color:var(--text3)">🗑️</button>'
            + '</td></tr>';
        }).join('')
      + '</tbody></table>';
  }

  // ── Render tabela de Contatos ─────────────────────────────
  function renderTabelaContatos() {
    var el = document.getElementById('tabelaContatos');
    if (!el) return;
    var list = ctsLoad().sort(function(a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.82rem">Nenhum contato cadastrado ainda.</div>';
      return;
    }
    function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:.78rem">'
      + '<thead><tr style="border-bottom:2px solid var(--border);color:var(--text3);font-size:.7rem;text-transform:uppercase;letter-spacing:.04em">'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Nome</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Empresa</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">E-mail</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Telefone</th>'
      + '<th style="padding:.4rem .6rem;width:80px"></th>'
      + '</tr></thead><tbody>'
      + list.map(function(x) {
          return '<tr style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:.45rem .6rem;font-weight:600;color:var(--text)">' + esc(x.nome) + '</td>'
            + '<td style="padding:.45rem .6rem;color:var(--text2)">' + esc(x.empresa) + '</td>'
            + '<td style="padding:.45rem .6rem;color:var(--text2)">' + esc(x.email) + '</td>'
            + '<td style="padding:.45rem .6rem;color:var(--text2)">' + esc(x.telefone) + '</td>'
            + '<td style="padding:.45rem .6rem;display:flex;gap:.4rem">'
            + '<button class="nb" onclick="editarContato(\'' + x.id + '\')" style="font-size:.72rem;color:var(--blue)">✏️</button>'
            + '<button class="nb" onclick="excluirContato(\'' + x.id + '\')" style="font-size:.72rem;color:var(--text3)">🗑️</button>'
            + '</td></tr>';
        }).join('')
      + '</tbody></table>';
  }

  window.renderTabelaClientes = renderTabelaClientes;
  window.renderTabelaContatos = renderTabelaContatos;

  // ── API pública ───────────────────────────────────────────
  window.ctsGetAll      = ctsLoad;
  window.cliGetAll      = cliLoad;
  window.ctsSeedFromData = seedFromData;

  // ── Wiring do formulário de Propostas ─────────────────────
  // pCli, pAC e pLoc são gerenciados pelo app-core.js (bindAutoInput/initClientAutoComplete)
  function wirePropForm() {
    var g = function(id) { return document.getElementById(id); };

    // Contato 2 (não coberto pelo app-core.js)
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

    // Re-seed após 2s e 5s para capturar dados carregados do Supabase
    setTimeout(seedFromData, 2000);
    setTimeout(seedFromData, 5000);

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

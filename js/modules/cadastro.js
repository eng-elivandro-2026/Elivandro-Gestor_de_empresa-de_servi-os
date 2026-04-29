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

  // ── Normalização para comparação ──────────────────────────
  function _normCnpj(s) { return String(s || '').replace(/\D/g, ''); }
  function _normTel(s)  { return String(s || '').replace(/\D/g, ''); }

  // ── Seed a partir dos dados existentes ────────────────────
  // Tombstones: nomes explicitamente deletados pelo usuário — seedFromData não recria
  var KEY_CLI_DEL = 'tf_cli_del';
  var KEY_CTS_DEL = 'tf_cts_del';
  function _cliDelLoad() { try { return JSON.parse(localStorage.getItem(KEY_CLI_DEL) || '[]'); } catch(e) { return []; } }
  function _ctsDelLoad() { try { return JSON.parse(localStorage.getItem(KEY_CTS_DEL) || '[]'); } catch(e) { return []; } }
  function _cliDelAdd(nome) {
    var del = _cliDelLoad(); var n = nome.toLowerCase();
    if (del.indexOf(n) < 0) { del.push(n); localStorage.setItem(KEY_CLI_DEL, JSON.stringify(del)); }
  }
  function _ctsDelAdd(nome) {
    var del = _ctsDelLoad(); var n = nome.toLowerCase();
    if (del.indexOf(n) < 0) { del.push(n); localStorage.setItem(KEY_CTS_DEL, JSON.stringify(del)); }
  }

  function seedFromData() {
    var cts  = ctsLoad();
    var clis = cliLoad();
    var ctsChanged = false;
    var cliChanged = false;
    var cliDel = _cliDelLoad();
    var ctsDel = _ctsDelLoad();

    function addCts(nome, empresa) {
      if (!nome || !nome.trim()) return;
      nome = nome.trim();
      if (ctsDel.indexOf(nome.toLowerCase()) >= 0) return;
      if (cts.some(function(c) { return c.nome.toLowerCase() === nome.toLowerCase(); })) return;
      cts.push({ id: _id(), nome: nome, empresa: empresa || '', email: '', telefone: '', criado: new Date().toISOString() });
      ctsChanged = true;
    }
    function addCli(nome, cnpj) {
      if (!nome || !nome.trim()) return;
      nome = nome.trim();
      if (cliDel.indexOf(nome.toLowerCase()) >= 0) return;
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
        if (tipo === 'cliente') {
          var parts = [x.cnpj, x.cidade].filter(Boolean);
          var info = parts.join(' · ');
          return '<div class="ac-it" style="flex-direction:column;align-items:flex-start;gap:.15rem" data-id="' + x.id + '" data-nome="' + esc(x.nome) + '">'
            + '<span style="font-weight:600;line-height:1.3">' + esc(x.nome) + '</span>'
            + (info ? '<span style="font-size:.67rem;color:var(--text3)">' + esc(info) + '</span>' : '')
            + '</div>';
        }
        var sub = x.empresa || '';
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

  // ── Helpers de modal (manipulação direta de style) ───────
  function _abrirMod(id) {
    var m = document.getElementById(id);
    if (m) { m.style.display = 'flex'; m.style.zIndex = '9500'; }
  }
  function _fecharMod(id) {
    var m = document.getElementById(id); if (m) m.style.display = 'none';
  }

  window._fecharModalCliente = function() {
    window._cadEditCliId = null;
    var t = document.getElementById('tituloModalCliente');
    if (t) t.textContent = '🏢 Novo Cliente';
    _fecharMod('m-novo-cliente');
  };
  window._fecharModalContato = function() {
    window._cadEditCtsId = null;
    var t = document.getElementById('tituloModalContato');
    if (t) t.textContent = '👤 Novo Contato';
    _fecharMod('m-novo-contato');
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
    if (g('ncDept'))    g('ncDept').value    = '';
    g('ncEmpresa').value  = '';
    g('ncEmail').value    = '';
    g('ncTelefone').value = '';
    // Autocomplete de empresa (clientes cadastrados) — wired uma vez
    var empEl = g('ncEmpresa');
    if (empEl && !empEl._acDone) acSetup(empEl, 'cliente');
    _abrirMod('m-novo-contato');
  };

  window.salvarNovoContato = function() {
    var g   = function(id) { return (document.getElementById(id) || {}).value || ''; };
    var nome = g('ncNome').trim();
    if (!nome) { alert('Informe o nome do contato.'); return; }
    var novo = { id: _id(), nome: nome, departamento: g('ncDept').trim(), empresa: g('ncEmpresa').trim(), email: g('ncEmail').trim(), telefone: g('ncTelefone').trim(), criado: new Date().toISOString() };
    var list = ctsLoad();
    list.unshift(novo);
    ctsSave(list);
    _fecharMod('m-novo-contato');
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
    _abrirMod('m-novo-cliente');
  };

  window.salvarNovoCliente = function() {
    var g   = function(id) { return (document.getElementById(id) || {}).value || ''; };
    var nome = g('ncliNome').trim();
    if (!nome) { alert('Informe o nome do cliente.'); return; }
    var novo = { id: _id(), nome: nome, cnpj: g('ncliCnpj').trim(), cidade: g('ncliCidade').trim(), criado: new Date().toISOString() };
    var list = cliLoad();
    list.unshift(novo);
    cliSave(list);
    _fecharMod('m-novo-cliente');
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
    console.log('[editarCliente] chamado id=', id);
    var item = (window._cliEditData && window._cliEditData[id]) || null;
    if (!item) {
      var list = cliLoad();
      item = list.find(function(x) { return x.id === id; });
      if (!item) {
        console.error('[editarCliente] item NÃO ENCONTRADO. id=', id,
          '| ids salvos=', cliLoad().map(function(x){return x.id;}));
        return;
      }
    }
    console.log('[editarCliente] item=', item.nome);
    window._cadEditCliId = id;
    window._cadCliCb = null;
    try {
      var t = document.getElementById('tituloModalCliente');
      if (t) t.textContent = '✏️ Editar Cliente';
      var f1 = document.getElementById('ncliNome');
      var f2 = document.getElementById('ncliCnpj');
      var f3 = document.getElementById('ncliCidade');
      console.log('[editarCliente] campos: ncliNome=', !!f1, 'ncliCnpj=', !!f2, 'ncliCidade=', !!f3);
      if (f1) f1.value = item.nome   || '';
      if (f2) f2.value = item.cnpj   || '';
      if (f3) f3.value = item.cidade || '';
      var mEl = document.getElementById('m-novo-cliente');
      console.log('[editarCliente] modal el=', mEl, '| display atual=', mEl ? mEl.style.display : 'null');
      _abrirMod('m-novo-cliente');
      if (mEl) mEl.classList.add('on');
      console.log('[editarCliente] modal aberto. display=', mEl ? mEl.style.display : 'null');
    } catch(e) {
      console.error('[editarCliente] erro:', e.message, e.stack);
    }
  };

  window.excluirCliente = function(id) {
    if (!confirm('Excluir este cliente?')) return;
    var all = cliLoad();
    var item = all.find(function(x) { return x.id === id; });
    if (item) _cliDelAdd(item.nome);
    cliSave(all.filter(function(x) { return x.id !== id; }));
    renderTabelaClientes();
    if (typeof toast === 'function') toast('Cliente excluído', 'ok');
  };

  // Sobrescreve salvarNovoCliente para suportar edição + dedup CNPJ
  var _origSalvarCli = window.salvarNovoCliente;
  window.salvarNovoCliente = function() {
    var g    = function(i) { return (document.getElementById(i) || {}).value || ''; };
    var nome = g('ncliNome').trim();
    if (!nome) { alert('Informe o nome do cliente.'); return; }
    var cnpj = _normCnpj(g('ncliCnpj'));
    if (cnpj) {
      var dup = cliLoad().find(function(x) {
        return _normCnpj(x.cnpj) === cnpj && x.id !== window._cadEditCliId;
      });
      if (dup) { alert('Já existe um cliente com este CNPJ:\n' + dup.nome); return; }
    }

    if (window._cadEditCliId) {
      var all = cliLoad();
      var old = all.find(function(x) { return x.id === window._cadEditCliId; });
      var oldNome = old ? old.nome : '';
      var list = all.map(function(x) {
        return x.id === window._cadEditCliId
          ? Object.assign({}, x, { nome: nome, cnpj: g('ncliCnpj').trim(), cidade: g('ncliCidade').trim() })
          : x;
      });
      cliSave(list);
      if (oldNome && oldNome !== nome) _atualizarNomeClienteNasPropostas(oldNome, nome);
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
    console.log('[editarContato] chamado id=', id);
    var item = (window._ctsEditData && window._ctsEditData[id]) || null;
    if (!item) {
      var list = ctsLoad();
      item = list.find(function(x) { return x.id === id; });
      if (!item) {
        console.error('[editarContato] item NÃO ENCONTRADO. id=', id,
          '| ids salvos=', ctsLoad().map(function(x){return x.id;}));
        return;
      }
    }
    console.log('[editarContato] item=', item.nome);
    window._cadEditCtsId = id;
    window._cadCtsCb = null;
    try {
      var t = document.getElementById('tituloModalContato');
      if (t) t.textContent = '✏️ Editar Contato';
      var f1 = document.getElementById('ncNome');
      var f2 = document.getElementById('ncEmpresa');
      var f3 = document.getElementById('ncEmail');
      var f4 = document.getElementById('ncTelefone');
      var f5 = document.getElementById('ncDept');
      console.log('[editarContato] campos: ncNome=', !!f1, 'ncEmpresa=', !!f2);
      if (f1) f1.value = item.nome         || '';
      if (f5) f5.value = item.departamento || '';
      if (f2) f2.value = item.empresa      || '';
      if (f3) f3.value = item.email        || '';
      if (f4) f4.value = item.telefone     || '';
      // Autocomplete de empresa — wired uma vez
      if (f2 && !f2._acDone) acSetup(f2, 'cliente');
      var mEl = document.getElementById('m-novo-contato');
      console.log('[editarContato] modal el=', mEl, '| display atual=', mEl ? mEl.style.display : 'null');
      _abrirMod('m-novo-contato');
      if (mEl) mEl.classList.add('on');
      console.log('[editarContato] modal aberto. display=', mEl ? mEl.style.display : 'null');
    } catch(e) {
      console.error('[editarContato] erro:', e.message, e.stack);
    }
  };

  window.excluirContato = function(id) {
    if (!confirm('Excluir este contato?')) return;
    var all = ctsLoad();
    var item = all.find(function(x) { return x.id === id; });
    if (item) _ctsDelAdd(item.nome);
    ctsSave(all.filter(function(x) { return x.id !== id; }));
    renderTabelaContatos();
    if (typeof toast === 'function') toast('Contato excluído', 'ok');
  };

  // Sobrescreve salvarNovoContato para suportar edição + dedup email/fone
  var _origSalvarCts = window.salvarNovoContato;
  window.salvarNovoContato = function() {
    var g = function(i) { return (document.getElementById(i) || {}).value || ''; };
    var nome = g('ncNome').trim();
    if (!nome) { alert('Informe o nome do contato.'); return; }
    var email = g('ncEmail').trim().toLowerCase();
    var tel   = _normTel(g('ncTelefone'));
    if (email || tel) {
      var dup = ctsLoad().find(function(x) {
        if (x.id === window._cadEditCtsId) return false;
        if (email && x.email && x.email.trim().toLowerCase() === email) return true;
        if (tel   && _normTel(x.telefone) === tel) return true;
        return false;
      });
      if (dup) { alert('Já existe um contato com este e-mail ou telefone:\n' + dup.nome); return; }
    }

    if (window._cadEditCtsId) {
      var all = ctsLoad();
      var old = all.find(function(x) { return x.id === window._cadEditCtsId; });
      var oldNome = old ? old.nome : '';
      var list = all.map(function(x) {
        return x.id === window._cadEditCtsId
          ? Object.assign({}, x, { nome: nome, departamento: g('ncDept').trim(), empresa: g('ncEmpresa').trim(), email: g('ncEmail').trim(), telefone: g('ncTelefone').trim() })
          : x;
      });
      ctsSave(list);
      if (oldNome && oldNome !== nome) _atualizarNomeContatoNasPropostas(oldNome, nome);
      window._fecharModalContato();
      renderTabelaContatos();
      if (typeof toast === 'function') toast('✅ Contato atualizado: ' + nome, 'ok');
    } else {
      _origSalvarCts();
      renderTabelaContatos();
    }
  };

  // ── Propagação de renomeação ──────────────────────────────
  function _atualizarNomeClienteNasPropostas(oldNome, newNome) {
    if (!oldNome || !newNome || oldNome === newNome) return;
    var oldL = oldNome.toLowerCase();
    var props = [];
    try { props = JSON.parse(localStorage.getItem('tf_props') || '[]'); } catch(e) {}
    var changed = false;
    props = props.map(function(p) {
      var c = Object.assign({}, p);
      if ((c.loc || '').toLowerCase() === oldL) { c.loc = newNome; changed = true; }
      if ((c.cli || '').toLowerCase() === oldL) { c.cli = newNome; changed = true; }
      return c;
    });
    if (changed) {
      try { localStorage.setItem('tf_props', JSON.stringify(props)); } catch(e) {}
      if (window.props) window.props = props;
    }
  }

  function _atualizarNomeContatoNasPropostas(oldNome, newNome) {
    if (!oldNome || !newNome || oldNome === newNome) return;
    var oldL = oldNome.toLowerCase();
    var props = [];
    try { props = JSON.parse(localStorage.getItem('tf_props') || '[]'); } catch(e) {}
    var pChanged = false;
    props = props.map(function(p) {
      var c = Object.assign({}, p);
      if ((c.ac  || '').toLowerCase() === oldL) { c.ac  = newNome; pChanged = true; }
      if ((c.ac2 || '').toLowerCase() === oldL) { c.ac2 = newNome; pChanged = true; }
      return c;
    });
    if (pChanged) {
      try { localStorage.setItem('tf_props', JSON.stringify(props)); } catch(e) {}
      if (window.props) window.props = props;
    }
    var hist = [];
    try { hist = JSON.parse(localStorage.getItem('tf_historico') || '[]'); } catch(e) {}
    var hChanged = false;
    hist = hist.map(function(h) {
      var c = Object.assign({}, h);
      if ((c.contato || '').toLowerCase() === oldL) { c.contato = newNome; hChanged = true; }
      return c;
    });
    if (hChanged) {
      try { localStorage.setItem('tf_historico', JSON.stringify(hist)); } catch(e) {}
    }
  }

  // ── Render tabela de Clientes ─────────────────────────────
  function renderTabelaClientes() {
    var el = document.getElementById('tabelaClientes');
    if (!el) return;
    var list = cliLoad().sort(function(a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
    window._cliEditData = {};
    list.forEach(function(x) { window._cliEditData[x.id] = x; });
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
    window._ctsEditData = {};
    list.forEach(function(x) { window._ctsEditData[x.id] = x; });
    if (!list.length) {
      el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.82rem">Nenhum contato cadastrado ainda.</div>';
      return;
    }
    function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:.78rem">'
      + '<thead><tr style="border-bottom:2px solid var(--border);color:var(--text3);font-size:.7rem;text-transform:uppercase;letter-spacing:.04em">'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Contato</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Empresa</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Depto / Função</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">E-mail</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Telefone</th>'
      + '<th style="padding:.4rem .6rem;width:80px"></th>'
      + '</tr></thead><tbody>'
      + list.map(function(x) {
          return '<tr style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:.45rem .6rem;font-weight:600;color:var(--text)">' + esc(x.nome) + '</td>'
            + '<td style="padding:.45rem .6rem;color:var(--text2)">' + esc(x.empresa) + '</td>'
            + '<td style="padding:.45rem .6rem;color:var(--text3);font-size:.75rem">' + esc(x.departamento) + '</td>'
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
  function wirePropForm() {
    var g = function(id) { return document.getElementById(id); };

    // Cliente principal
    if (g('pCli') && !g('pCli')._acDone) acSetup(g('pCli'), 'cliente', function(c) {
      if (c.cnpj && g('pLocCnpj') && !g('pLocCnpj').value) g('pLocCnpj').value = c.cnpj;
    });

    // Contato 1
    if (g('pAC') && !g('pAC')._acDone) acSetup(g('pAC'), 'contato', function(c) {
      if (c.email    && g('pMail') && !g('pMail').value) g('pMail').value = c.email;
      if (c.telefone && g('pTel')  && !g('pTel').value)  g('pTel').value  = c.telefone;
    });

    // Contato 2
    if (g('pAC2') && !g('pAC2')._acDone) acSetup(g('pAC2'), 'contato', function(c) {
      if (c.email    && g('pMail2') && !g('pMail2').value) g('pMail2').value = c.email;
      if (c.telefone && g('pTel2')  && !g('pTel2').value)  g('pTel2').value  = c.telefone;
    });

    // Cliente do serviço (campo separado pLoc)
    if (g('pLoc') && !g('pLoc')._acDone) acSetup(g('pLoc'), 'cliente', function(c) {
      if (c.cnpj && g('pLocCnpj') && !g('pLocCnpj').value) g('pLocCnpj').value = c.cnpj;
    });
  }

  // Exposta para ser chamada após reset do formulário se necessário
  window.wirePropFormAc = wirePropForm;

  // ── Init ──────────────────────────────────────────────────
  function init() {
    seedFromData();
    // Sincronizar da nuvem — adiciona itens novos mas respeita tombstones
    _sbLoad(KEY_CTS, function(v) {
      var local = ctsLoad();
      var del   = _ctsDelLoad();
      var merged = local.slice();
      v.forEach(function(x) {
        if (del.indexOf((x.nome || '').toLowerCase()) >= 0) return;
        if (!merged.some(function(m) { return m.id === x.id; })) merged.push(x);
      });
      try { localStorage.setItem(KEY_CTS, JSON.stringify(merged)); } catch(e) {}
    });
    _sbLoad(KEY_CLI, function(v) {
      var local = cliLoad();
      var del   = _cliDelLoad();
      var merged = local.slice();
      v.forEach(function(x) {
        if (del.indexOf((x.nome || '').toLowerCase()) >= 0) return;
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

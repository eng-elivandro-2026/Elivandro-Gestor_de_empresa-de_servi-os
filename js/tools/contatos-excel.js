// ============================================================
// contatos-excel.js — Edição em Massa + Exportar + Importar Contatos
// Branch: portal/relacionamento-recuperar-clientes-cnpj-cidades
// SEGURANÇA: 100% isolado por empresa_id. Zero gravação automática.
// ============================================================
(function () {
  'use strict';

  // ── Resolução de empresa ativa ──────────────────────────────
  function _eid() {
    if (typeof window.getEmpresaAtivaId === 'function') {
      var id = window.getEmpresaAtivaId(); if (id) return id;
    }
    if (typeof window.getEmpresaAtiva === 'function') {
      var obj = window.getEmpresaAtiva(); if (obj && obj.id) return obj.id;
    }
    if (window._empresaAtiva && window._empresaAtiva.id) return window._empresaAtiva.id;
    try {
      var s = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
      if (s && s.id) return s.id;
    } catch (e) {}
    return null;
  }

  function _keyFor(base) {
    var eid = _eid(); if (!eid) return null;
    return base + '_' + eid;
  }

  // Nome da empresa ativa (para nomes de arquivo e confirmações)
  function _nomeEmpresa() {
    var obj = null;
    if (typeof window.getEmpresaAtiva === 'function') obj = window.getEmpresaAtiva();
    if (!obj && window._empresaAtiva) obj = window._empresaAtiva;
    if (!obj) {
      try { obj = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null'); } catch (e) {}
    }
    if (obj && obj.nome) return obj.nome;
    return _eid() || 'empresa';
  }

  // ── Acesso a contatos e clientes (usa API global do cadastro.js) ──
  function _ctsLoad() {
    if (typeof window.ctsGetAll === 'function') return window.ctsGetAll() || [];
    var key = _keyFor('tf_contatos');
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }

  function _cliLoad() {
    if (typeof window.cliGetAll === 'function') return window.cliGetAll() || [];
    var key = _keyFor('tf_clientes');
    if (!key) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; }
  }

  // Salva contatos com validação empresa_id
  function _ctsSave(list) {
    var key = _keyFor('tf_contatos');
    if (!key) { console.warn('[contatos-excel] empresa_id não disponível — save bloqueado'); return; }
    if (!list || list.length === 0) {
      if (_ctsLoad().length > 0) {
        console.warn('[contatos-excel] save de lista vazia bloqueado — use opção explícita');
        return;
      }
    }
    try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
    if (window.sbClient) {
      window.sbClient.from('configuracoes').upsert(
        { chave: key, valor: list, updated_at: new Date().toISOString() },
        { onConflict: 'chave' }
      ).then(function (r) { if (r.error) console.warn('[contatos-excel] Supabase save error', r.error); });
    }
  }

  // ── Backup obrigatório ──────────────────────────────────────
  function _criarBackup(sufixo) {
    var eid = _eid(); if (!eid) return null;
    var ts = Date.now();
    var bkKey = 'tf_contatos_backup_' + ts + '_' + eid + (sufixo ? '_' + sufixo : '');
    var list = _ctsLoad();
    try { localStorage.setItem(bkKey, JSON.stringify(list)); } catch (e) {}
    if (window.sbClient) {
      window.sbClient.from('configuracoes').upsert(
        { chave: bkKey, valor: list, updated_at: new Date().toISOString() },
        { onConflict: 'chave' }
      ).then(function (r) { if (r.error) console.warn('[contatos-excel] backup Supabase error', r.error); });
    }
    console.log('[contatos-excel] backup criado:', bkKey, '|', list.length, 'contatos');
    return bkKey;
  }

  // ── Estado de seleção ───────────────────────────────────────
  var _sel = {};  // { id: true } — IDs selecionados
  var _previewImport = null;  // dados parseados/classificados da planilha

  function _selIds() { return Object.keys(_sel).filter(function (id) { return _sel[id]; }); }

  function _recontarSel() {
    var n = _selIds().length;
    var el = document.getElementById('ctxContador');
    if (el) {
      el.textContent = n > 0 ? n + ' contato(s) selecionado(s)' : '';
      el.style.display = n > 0 ? '' : 'none';
    }
    var btnBulk = document.getElementById('ctxBtnBulk');
    if (btnBulk) { btnBulk.disabled = n === 0; btnBulk.style.opacity = n === 0 ? '.45' : '1'; }
  }

  // ── Escape HTML ─────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── ID gerador para novos contatos ───────────────────────────
  function _genId() { return 'cad_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

  // ── Normalização ─────────────────────────────────────────────
  function _normTel(s) { return String(s || '').replace(/\D/g, ''); }
  function _normNome(s) { return String(s || '').trim().toLowerCase(); }

  // ── Construir mapa de clientes por nome ──────────────────────
  function _cliMap() {
    var map = {};
    _cliLoad().forEach(function (c) {
      map[_normNome(c.nome)] = c;
      if (c.id) map['id:' + c.id] = c;
    });
    return map;
  }

  // ══════════════════════════════════════════════════════════════
  // OVERRIDE renderTabelaContatos — adiciona checkboxes e toolbar
  // ══════════════════════════════════════════════════════════════
  var _origRenderTabela = null;

  function _renderTabelaContatosComBulk() {
    var el = document.getElementById('tabelaContatos');
    if (!el) return;
    var list = _ctsLoad().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

    // Manter referência global para edição individual (mesma API de antes)
    window._ctsEditData = {};
    list.forEach(function (x) { window._ctsEditData[x.id] = x; });

    // Toolbar de ações
    var toolbarHtml =
      '<div id="ctxToolbarBox" style="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.65rem">'
      + '<label style="display:flex;align-items:center;gap:.35rem;font-size:.78rem;cursor:pointer;color:var(--text2)">'
      + '<input type="checkbox" id="ctxSelAll" onchange="ctxToggleSelAll(this.checked)" style="cursor:pointer"> Selecionar todos'
      + '</label>'
      + '<span id="ctxContador" style="font-size:.75rem;color:var(--blue);font-weight:700;display:none"></span>'
      + '<span style="flex:1"></span>'
      + '<button id="ctxBtnBulk" class="nb" onclick="ctxAbrirBulkEdit()" disabled style="opacity:.45;background:rgba(14,165,233,.1);color:var(--blue);border:1px solid rgba(14,165,233,.3);border-radius:6px;padding:.35rem .8rem;font-size:.75rem;font-weight:700">✏️ Editar selecionados</button>'
      + '<button class="nb" onclick="ctxExportarContatos()" style="background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.3);border-radius:6px;padding:.35rem .8rem;font-size:.75rem;font-weight:600">📥 Exportar</button>'
      + '<button class="nb" onclick="ctxAbrirImport()" style="background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:.35rem .8rem;font-size:.75rem;font-weight:600">📤 Importar</button>'
      + '<input type="file" id="ctxArquivoInput" accept=".xlsx,.csv,.xls" style="display:none" onchange="ctxLerArquivo(this)">'
      + '</div>';

    if (!list.length) {
      el.innerHTML = toolbarHtml
        + '<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.82rem">Nenhum contato cadastrado ainda.</div>'
        + '<div id="ctxPreviewImport" style="margin-top:1rem"></div>';
      _recontarSel();
      return;
    }

    var tbHtml = '<table style="width:100%;border-collapse:collapse;font-size:.78rem">'
      + '<thead><tr style="border-bottom:2px solid var(--border);color:var(--text3);font-size:.7rem;text-transform:uppercase;letter-spacing:.04em">'
      + '<th style="padding:.4rem .5rem;width:28px"></th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Contato</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Empresa</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Depto / Função</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">E-mail</th>'
      + '<th style="padding:.4rem .6rem;text-align:left;font-weight:600">Telefone</th>'
      + '<th style="padding:.4rem .6rem;width:80px"></th>'
      + '</tr></thead><tbody>'
      + list.map(function (x) {
          var checked = _sel[x.id] ? 'checked' : '';
          return '<tr style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:.4rem .5rem"><input type="checkbox" ' + checked + ' onchange="ctxToggleSel(\'' + x.id + '\',this.checked)" style="cursor:pointer"></td>'
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

    el.innerHTML = toolbarHtml + tbHtml + '<div id="ctxPreviewImport" style="margin-top:1.2rem"></div>';
    _recontarSel();

    // Restaurar o preview de importação caso já exista
    if (_previewImport) _renderizarPreviewImport(_previewImport);
  }

  // Expor globalmente e hookar logo que cadastro.js terminar de definir
  window.ctxToggleSel = function (id, checked) {
    _sel[id] = !!checked;
    _recontarSel();
    // Sincronizar "selecionar todos"
    var allBox = document.getElementById('ctxSelAll');
    if (allBox) {
      var ids = _selIds();
      var total = _ctsLoad().length;
      allBox.indeterminate = ids.length > 0 && ids.length < total;
      allBox.checked = total > 0 && ids.length === total;
    }
  };

  window.ctxToggleSelAll = function (checked) {
    _ctsLoad().forEach(function (c) { _sel[c.id] = !!checked; });
    // Re-render checkboxes
    document.querySelectorAll('#tabelaContatos input[type=checkbox][onchange^="ctxToggleSel("]').forEach(function (cb) {
      var id = cb.getAttribute('onchange').match(/ctxToggleSel\('([^']+)'/);
      if (id && id[1]) cb.checked = !!checked;
    });
    _recontarSel();
  };

  // ══════════════════════════════════════════════════════════════
  // EDIÇÃO EM MASSA
  // ══════════════════════════════════════════════════════════════
  window.ctxAbrirBulkEdit = function () {
    var ids = _selIds();
    if (!ids.length) { alert('Selecione pelo menos um contato.'); return; }
    var m = document.getElementById('m-bulk-contatos');
    if (!m) return;
    document.getElementById('bkContador').textContent = ids.length + ' contato(s) selecionado(s)';
    document.getElementById('bkEmpresa').value = '';
    document.getElementById('bkDept').value = '';
    document.getElementById('bkObs').value = '';
    document.getElementById('bkSobrescrever').checked = false;
    m.style.display = 'flex';
  };

  window.ctxFecharBulkEdit = function () {
    var m = document.getElementById('m-bulk-contatos');
    if (m) m.style.display = 'none';
  };

  window.ctxPreviewBulkEdit = function () {
    var ids = _selIds();
    var empresa  = (document.getElementById('bkEmpresa').value || '').trim();
    var dept     = (document.getElementById('bkDept').value || '').trim();
    var obs      = (document.getElementById('bkObs').value || '').trim();
    var sobr     = document.getElementById('bkSobrescrever').checked;

    if (!empresa && !dept && !obs) { alert('Preencha ao menos um campo para editar.'); return; }

    var lista = _ctsLoad().filter(function (c) { return ids.indexOf(c.id) >= 0; });
    var linhas = lista.map(function (c) {
      var emp2  = empresa && (sobr || !c.empresa)     ? empresa : c.empresa;
      var dep2  = dept    && (sobr || !c.departamento) ? dept    : c.departamento;
      var obs2  = obs     && (sobr || !c.observacao)   ? obs     : c.observacao;
      var mudou = emp2 !== (c.empresa||'') || dep2 !== (c.departamento||'') || obs2 !== (c.observacao||'');
      return { c: c, emp2: emp2, dep2: dep2, obs2: obs2, mudou: mudou };
    });

    var prev = document.getElementById('bkPrevia');
    if (!prev) return;

    var semMudanca = linhas.filter(function(l){ return !l.mudou; }).length;
    prev.innerHTML = '<div style="font-size:.75rem;color:var(--text3);margin-bottom:.5rem">'
      + linhas.length + ' contato(s) afetados'
      + (semMudanca ? ' · <span style="color:#f59e0b">' + semMudanca + ' sem alteração (campos já preenchidos e sobrescrever desmarcado)</span>' : '')
      + '</div>'
      + '<table style="width:100%;font-size:.73rem;border-collapse:collapse">'
      + '<thead><tr style="color:var(--text3);font-size:.67rem;text-transform:uppercase">'
      + '<th style="padding:.3rem;text-align:left">Contato</th>'
      + '<th style="padding:.3rem;text-align:left">Empresa → Nova</th>'
      + '<th style="padding:.3rem;text-align:left">Depto → Novo</th>'
      + '<th style="padding:.3rem;text-align:left">Obs → Nova</th>'
      + '<th style="padding:.3rem;text-align:left">Status</th>'
      + '</tr></thead><tbody>'
      + linhas.map(function (l) {
          var bg = l.mudou ? '' : 'background:rgba(245,158,11,.05)';
          return '<tr style="border-bottom:1px solid var(--border);' + bg + '">'
            + '<td style="padding:.3rem;font-weight:600">' + esc(l.c.nome) + '</td>'
            + '<td style="padding:.3rem">' + (l.emp2 !== (l.c.empresa||'') ? '<span style="color:var(--text3)">' + esc(l.c.empresa) + '</span> → <strong>' + esc(l.emp2) + '</strong>' : esc(l.emp2)) + '</td>'
            + '<td style="padding:.3rem">' + (l.dep2 !== (l.c.departamento||'') ? '<span style="color:var(--text3)">' + esc(l.c.departamento) + '</span> → <strong>' + esc(l.dep2) + '</strong>' : esc(l.dep2)) + '</td>'
            + '<td style="padding:.3rem">' + (l.obs2 !== (l.c.observacao||'') ? '<span style="color:var(--text3)">' + esc(l.c.observacao) + '</span> → <strong>' + esc(l.obs2) + '</strong>' : esc(l.obs2)) + '</td>'
            + '<td style="padding:.3rem">' + (l.mudou ? '<span style="color:#22c55e">✔ altera</span>' : '<span style="color:#f59e0b">— mantém</span>') + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>';
  };

  window.ctxAplicarBulkEdit = function () {
    var ids = _selIds();
    if (!ids.length) { alert('Nenhum contato selecionado.'); return; }
    var empresa  = (document.getElementById('bkEmpresa').value || '').trim();
    var dept     = (document.getElementById('bkDept').value || '').trim();
    var obs      = (document.getElementById('bkObs').value || '').trim();
    var sobr     = document.getElementById('bkSobrescrever').checked;

    if (!empresa && !dept && !obs) { alert('Preencha ao menos um campo para editar.'); return; }

    var conf = prompt('Para confirmar a edição em massa, digite exatamente:\nATUALIZAR CONTATOS SELECIONADOS');
    if (conf !== 'ATUALIZAR CONTATOS SELECIONADOS') { alert('Confirmação incorreta. Nada foi alterado.'); return; }

    var bkKey = _criarBackup('bulk');
    console.log('[contatos-excel] backup gerado:', bkKey);

    var list = _ctsLoad();
    var eid = _eid();
    var alterados = 0;
    list = list.map(function (x) {
      if (ids.indexOf(x.id) < 0) return x;
      var novo = Object.assign({}, x);
      if (empresa && (sobr || !x.empresa))      { novo.empresa      = empresa; }
      if (dept    && (sobr || !x.departamento)) { novo.departamento = dept; }
      if (obs     && (sobr || !x.observacao))   { novo.observacao   = obs; }
      if (JSON.stringify(novo) !== JSON.stringify(x)) alterados++;
      return novo;
    });

    _ctsSave(list);
    _sel = {};
    ctxFecharBulkEdit();
    _renderTabelaContatosComBulk();
    if (typeof toast === 'function') toast('✅ ' + alterados + ' contato(s) atualizados · backup: ' + bkKey, 'ok');
  };

  // ══════════════════════════════════════════════════════════════
  // EXPORTAR CONTATOS
  // ══════════════════════════════════════════════════════════════
  window.ctxExportarContatos = function () {
    var eid = _eid();
    if (!eid) { alert('Empresa ativa não identificada.'); return; }
    var nomEmp = _nomeEmpresa();
    var list = _ctsLoad();
    var cliMapObj = _cliMap();

    var rows = list.map(function (c) {
      var cli = cliMapObj[_normNome(c.empresa)] || {};
      return {
        nome_contato:      c.nome        || '',
        empresa_cliente:   c.empresa     || '',
        cnpj_cliente:      cli.cnpj      || '',
        cidade_cliente:    cli.cidade    || '',
        departamento_funcao: c.departamento || '',
        email:             c.email       || '',
        telefone:          c.telefone    || '',
        observacao:        c.observacao  || '',
        empresa_id:        eid,
        cliente_id:        cli.id        || '',
        contato_id:        c.id          || ''
      };
    });

    var hoje = new Date().toISOString().slice(0, 10);
    var nomeArq = 'contatos_' + nomEmp.toLowerCase().replace(/\s+/g, '_') + '_' + hoje;

    if (typeof XLSX !== 'undefined') {
      _exportarXLSX(rows, nomeArq + '.xlsx');
    } else {
      _exportarCSV(rows, nomeArq + '.csv');
    }
  };

  function _exportarXLSX(rows, nomeArq) {
    var cols = ['nome_contato','empresa_cliente','cnpj_cliente','cidade_cliente','departamento_funcao','email','telefone','observacao','empresa_id','cliente_id','contato_id'];
    var data = [cols].concat(rows.map(function (r) { return cols.map(function (k) { return r[k]; }); }));
    var ws = XLSX.utils.aoa_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
    XLSX.writeFile(wb, nomeArq);
    if (typeof toast === 'function') toast('📥 Excel exportado: ' + nomeArq, 'ok');
  }

  function _exportarCSV(rows, nomeArq) {
    var cols = ['nome_contato','empresa_cliente','cnpj_cliente','cidade_cliente','departamento_funcao','email','telefone','observacao','empresa_id','cliente_id','contato_id'];
    var linhas = [cols.map(function (c) { return '"' + c + '"'; }).join(';')];
    rows.forEach(function (r) {
      linhas.push(cols.map(function (k) { return '"' + String(r[k]||'').replace(/"/g, '""') + '"'; }).join(';'));
    });
    var csv = '﻿' + linhas.join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nomeArq;
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    if (typeof toast === 'function') toast('📥 CSV exportado: ' + nomeArq, 'ok');
  }

  // ══════════════════════════════════════════════════════════════
  // IMPORTAR CONTATOS
  // ══════════════════════════════════════════════════════════════
  window.ctxAbrirImport = function () {
    var fi = document.getElementById('ctxArquivoInput');
    if (fi) { fi.value = ''; fi.click(); }
  };

  window.ctxLerArquivo = function (input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    var ext = file.name.split('.').pop().toLowerCase();
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var rawRows;
        if ((ext === 'xlsx' || ext === 'xls') && typeof XLSX !== 'undefined') {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        } else {
          // CSV fallback
          var text = typeof e.target.result === 'string' ? e.target.result : new TextDecoder('utf-8').decode(e.target.result);
          rawRows = _parseCSV(text);
        }
        _previewImport = _classificarLinhas(rawRows);
        _renderizarPreviewImport(_previewImport);
        // Scroll para o preview
        var pv = document.getElementById('ctxPreviewImport');
        if (pv) pv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        console.error('[contatos-excel] erro ao ler arquivo:', err);
        alert('Erro ao ler o arquivo: ' + err.message);
      }
    };
    if ((ext === 'xlsx' || ext === 'xls') && typeof XLSX !== 'undefined') {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file, 'UTF-8');
    }
    input.value = '';
  };

  // Parse CSV simples (separador ; ou ,)
  function _parseCSV(text) {
    // Remove BOM
    text = text.replace(/^﻿/, '');
    var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (!lines.length) return [];
    var sep = lines[0].indexOf(';') >= 0 ? ';' : ',';
    function splitLine(line) {
      var cols = []; var cur = ''; var inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"' && !inQ) { inQ = true; continue; }
        if (ch === '"' && inQ && line[i+1] === '"') { cur += '"'; i++; continue; }
        if (ch === '"' && inQ) { inQ = false; continue; }
        if (ch === sep && !inQ) { cols.push(cur); cur = ''; continue; }
        cur += ch;
      }
      cols.push(cur);
      return cols;
    }
    var headers = splitLine(lines[0]).map(function (h) { return h.trim(); });
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var vals = splitLine(lines[i]);
      var obj = {};
      headers.forEach(function (h, idx) { obj[h] = (vals[idx] || '').trim(); });
      rows.push(obj);
    }
    return rows;
  }

  // Classificar cada linha da planilha
  function _classificarLinhas(rawRows) {
    var eid = _eid();
    var ctsAtual = _ctsLoad();
    var cliMapObj = _cliMap();
    var resultado = [];

    rawRows.forEach(function (row, idx) {
      var nomeContato = String(row.nome_contato || row['Nome Contato'] || row['nome'] || '').trim();
      var empresaCli  = String(row.empresa_cliente || row['Empresa'] || row['empresa'] || '').trim();
      var cnpjCli     = String(row.cnpj_cliente || row['CNPJ'] || '').trim();
      var dept        = String(row.departamento_funcao || row['Departamento'] || row['departamento'] || '').trim();
      var email       = String(row.email || row['Email'] || '').trim().toLowerCase();
      var telefone    = String(row.telefone || row['Telefone'] || '').trim();
      var obs         = String(row.observacao || row['Observacao'] || row['Observação'] || '').trim();
      var rowEid      = String(row.empresa_id || '').trim();
      var clienteId   = String(row.cliente_id || '').trim();
      var contatoId   = String(row.contato_id || '').trim();

      var item = {
        idx: idx,
        nomeContato: nomeContato,
        empresaCli:  empresaCli,
        dept:        dept,
        email:       email,
        telefone:    telefone,
        obs:         obs,
        rowEid:      rowEid,
        clienteId:   clienteId,
        contatoId:   contatoId,
        status:      '',
        mensagem:    '',
        contatoExistente: null,
        clienteEncontrado: null,
        selecionado: true   // por padrão marcado, exceto erros
      };

      // Bloqueio: empresa_id diferente da ativa
      if (rowEid && eid && rowEid !== eid) {
        item.status = 'bloqueado';
        item.mensagem = 'empresa_id "' + rowEid + '" diferente da empresa ativa "' + eid + '" — bloqueado';
        item.selecionado = false;
        resultado.push(item); return;
      }

      // Validação: sem nome
      if (!nomeContato) {
        item.status = 'erro';
        item.mensagem = 'Sem nome do contato — obrigatório';
        item.selecionado = false;
        resultado.push(item); return;
      }

      // Validação: sem empresa vinculada
      if (!empresaCli && !clienteId) {
        item.status = 'erro';
        item.mensagem = 'Sem empresa vinculada (empresa_cliente ou cliente_id) — obrigatório';
        item.selecionado = false;
        resultado.push(item); return;
      }

      // Lookup de cliente
      var cli = cliMapObj[_normNome(empresaCli)] || (clienteId ? cliMapObj['id:' + clienteId] : null);
      if (!cli && cnpjCli) {
        // Tentar por CNPJ
        var cnpjN = cnpjCli.replace(/\D/g,'');
        cli = _cliLoad().find(function(c){ return c.cnpj && c.cnpj.replace(/\D/g,'') === cnpjN; }) || null;
      }

      if (!cli) {
        item.status = 'cliente_nao_encontrado';
        item.mensagem = 'Cliente "' + (empresaCli || clienteId) + '" não encontrado. Crie o cliente primeiro.';
        item.selecionado = false;
        resultado.push(item); return;
      }
      item.clienteEncontrado = cli;

      // Normalizar empresa para o nome real do cliente
      item.empresaCli = cli.nome;

      // Lookup de contato existente: por contatoId → email → telefone → nome+empresa
      var existente = null;
      if (contatoId) {
        existente = ctsAtual.find(function(c){ return c.id === contatoId; }) || null;
      }
      if (!existente && email) {
        existente = ctsAtual.find(function(c){ return c.email && c.email.trim().toLowerCase() === email; }) || null;
      }
      if (!existente && telefone) {
        var telN = _normTel(telefone);
        existente = ctsAtual.find(function(c){ return _normTel(c.telefone) === telN; }) || null;
      }
      if (!existente) {
        // Por nome + empresa
        var nomeN = _normNome(nomeContato);
        var empN  = _normNome(cli.nome);
        var poss  = ctsAtual.filter(function(c){ return _normNome(c.nome) === nomeN && _normNome(c.empresa||'') === empN; });
        if (poss.length === 1) existente = poss[0];
        if (poss.length > 1) {
          item.status = 'duplicado';
          item.mensagem = poss.length + ' contatos com mesmo nome+empresa — selecione manualmente';
          item.contatoExistente = poss[0];
          item.selecionado = false;
          resultado.push(item); return;
        }
      }

      // Similaridade de nome para detectar possíveis duplicados mesmo sem match exato
      if (!existente) {
        var nomeSim = _normNome(nomeContato);
        var simPoss = ctsAtual.filter(function(c){
          var cn = _normNome(c.nome);
          return cn !== nomeSim && (cn.indexOf(nomeSim) >= 0 || nomeSim.indexOf(cn) >= 0) && _normNome(c.empresa||'') === _normNome(cli.nome);
        });
        if (simPoss.length > 0) {
          item.status = 'possivel_duplicado';
          item.mensagem = 'Nome similar a "' + simPoss[0].nome + '" no mesmo cliente — verifique';
          item.contatoExistente = simPoss[0];
          item.selecionado = false;
          resultado.push(item); return;
        }
      }

      if (existente) {
        item.status = 'atualizar';
        item.mensagem = 'Atualiza contato existente: ' + existente.nome;
        item.contatoExistente = existente;
      } else {
        item.status = 'criar';
        item.mensagem = 'Novo contato será criado';
      }

      resultado.push(item);
    });

    return resultado;
  }

  // Renderizar cards do preview de importação
  function _renderizarPreviewImport(linhas) {
    var pv = document.getElementById('ctxPreviewImport');
    if (!pv) return;
    if (!linhas || !linhas.length) { pv.innerHTML = ''; return; }

    var counts = { criar: 0, atualizar: 0, possivel_duplicado: 0, duplicado: 0, erro: 0, bloqueado: 0, cliente_nao_encontrado: 0 };
    linhas.forEach(function(l) { if (counts[l.status] !== undefined) counts[l.status]++; });

    var nomEmp = _nomeEmpresa();
    var confirmStr = 'IMPORTAR CONTATOS ' + nomEmp.toUpperCase();

    var html = '<div style="border-top:2px solid var(--border);padding-top:1rem">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:.75rem">'
      + '<div style="font-size:.92rem;font-weight:800;color:var(--blue)">📤 Prévia de Importação</div>'
      + '<button class="nb" onclick="_ctxLimparPreview()" style="font-size:.72rem;color:var(--text3)">✕ Limpar</button>'
      + '</div>'
      + '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem;font-size:.73rem">'
      + _badgePreview('criar', counts.criar, '#22c55e')
      + _badgePreview('atualizar', counts.atualizar, '#60a5fa')
      + _badgePreview('duplicado', counts.duplicado + counts.possivel_duplicado, '#f59e0b')
      + _badgePreview('erro/bloqueado', counts.erro + counts.bloqueado + counts.cliente_nao_encontrado, '#ef4444')
      + '</div>';

    // Cards de linhas
    html += '<div id="ctxImportCards" style="display:flex;flex-direction:column;gap:.5rem">';
    linhas.forEach(function (item, i) {
      html += _cardImport(item, i);
    });
    html += '</div>';

    // Botão aplicar
    html += '<div style="margin-top:.85rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">'
      + '<button class="nb" onclick="ctxAplicarImport()" style="background:var(--blue);color:#fff;border-radius:6px;padding:.42rem 1.1rem;font-size:.8rem;font-weight:700">✅ Aplicar Selecionados</button>'
      + '<span style="font-size:.72rem;color:var(--text3)">Confirmação exigida: <code>' + esc(confirmStr) + '</code></span>'
      + '</div>';

    html += '</div>';
    pv.innerHTML = html;
  }

  function _badgePreview(label, n, color) {
    if (!n) return '';
    return '<span style="background:' + color + '22;color:' + color + ';border:1px solid ' + color + '44;border-radius:4px;padding:.15rem .5rem;font-weight:700">' + n + ' ' + label + '</span>';
  }

  var _statusLabels = {
    criar:               { label: 'CRIAR',          color: '#22c55e' },
    atualizar:           { label: 'ATUALIZAR',       color: '#60a5fa' },
    possivel_duplicado:  { label: 'DUPLICADO?',      color: '#f59e0b' },
    duplicado:           { label: 'DUPLICADO',       color: '#f59e0b' },
    erro:                { label: 'ERRO',            color: '#ef4444' },
    bloqueado:           { label: 'BLOQUEADO',       color: '#ef4444' },
    cliente_nao_encontrado: { label: 'CLI NÃO ENCONTRADO', color: '#ef4444' }
  };

  function _cardImport(item, i) {
    var st = _statusLabels[item.status] || { label: item.status.toUpperCase(), color: '#94a3b8' };
    var podeSel = item.status === 'criar' || item.status === 'atualizar';
    var checked = item.selecionado && podeSel ? 'checked' : '';
    var disabledCb = podeSel ? '' : 'disabled';

    var c = item.contatoExistente || {};
    var bgCard = podeSel ? 'var(--bg2)' : 'var(--bg)';

    var html = '<div style="border:1px solid var(--border);border-radius:8px;padding:.65rem .85rem;background:' + bgCard + '">'
      + '<div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.45rem;flex-wrap:wrap">'
      + '<input type="checkbox" id="ctxImpSel_' + i + '" ' + checked + ' ' + disabledCb + ' onchange="_ctxImpToggle(' + i + ',this.checked)" style="cursor:' + (podeSel ? 'pointer' : 'default') + '">'
      + '<span style="background:' + st.color + '22;color:' + st.color + ';border:1px solid ' + st.color + '44;border-radius:4px;padding:.1rem .45rem;font-size:.68rem;font-weight:700">' + st.label + '</span>'
      + '<span style="font-size:.75rem;color:var(--text3)">' + esc(item.mensagem) + '</span>'
      + '</div>';

    // Campos editáveis
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.45rem;font-size:.76rem">'
      + _inputImp('Nome *', 'ctxImpNome_' + i, item.nomeContato, !podeSel)
      + _inputImp('Empresa vinculada *', 'ctxImpEmp_' + i, item.empresaCli, true)
      + _inputImp('Depto / Função', 'ctxImpDept_' + i, item.dept, !podeSel)
      + _inputImp('E-mail', 'ctxImpEmail_' + i, item.email, !podeSel)
      + _inputImp('Telefone', 'ctxImpTel_' + i, item.telefone, !podeSel)
      + _inputImp('Observação', 'ctxImpObs_' + i, item.obs, !podeSel)
      + '</div>';

    // Campos técnicos (somente leitura)
    html += '<div style="margin-top:.35rem;font-size:.67rem;color:var(--text3);display:flex;gap:.75rem;flex-wrap:wrap">'
      + '<span>empresa_id: <code>' + esc(_eid()) + '</code></span>'
      + (item.clienteEncontrado ? '<span>cliente_id: <code>' + esc(item.clienteEncontrado.id) + '</code></span>' : '')
      + (item.contatoExistente && item.contatoExistente.id ? '<span>contato_id: <code>' + esc(item.contatoExistente.id) + '</code></span>' : '')
      + '</div>';

    // Comparação com existente
    if (item.contatoExistente && item.status === 'atualizar') {
      html += '<div style="margin-top:.35rem;font-size:.68rem;background:rgba(14,165,233,.06);border:1px solid rgba(14,165,233,.18);border-radius:5px;padding:.35rem .55rem">'
        + '<span style="color:var(--text3);font-weight:600">Atual: </span>'
        + 'Nome: <strong>' + esc(c.nome) + '</strong> · Empresa: ' + esc(c.empresa) + ' · Depto: ' + esc(c.departamento)
        + '</div>';
    }

    html += '</div>';
    return html;
  }

  function _inputImp(label, id, val, disabled) {
    return '<div>'
      + '<label style="font-size:.62rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.04em">' + esc(label) + '</label>'
      + '<input id="' + esc(id) + '" type="text" value="' + esc(val) + '" '
      + (disabled ? 'readonly style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text3);border-radius:4px;padding:.3rem .5rem;margin-top:.15rem;font-size:.75rem"'
                  : 'style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:.3rem .5rem;margin-top:.15rem;font-size:.75rem"')
      + '>'
      + '</div>';
  }

  window._ctxImpToggle = function (i, checked) {
    if (_previewImport && _previewImport[i]) _previewImport[i].selecionado = !!checked;
  };

  window._ctxLimparPreview = function () {
    _previewImport = null;
    var pv = document.getElementById('ctxPreviewImport');
    if (pv) pv.innerHTML = '';
  };

  // ── Aplicar importação ──────────────────────────────────────
  window.ctxAplicarImport = function () {
    if (!_previewImport || !_previewImport.length) { alert('Nenhuma prévia de importação disponível.'); return; }

    var eid = _eid();
    var nomEmp = _nomeEmpresa();
    var confirmStr = 'IMPORTAR CONTATOS ' + nomEmp.toUpperCase();
    var conf = prompt('Para confirmar a importação, digite exatamente:\n' + confirmStr);
    if (conf !== confirmStr) { alert('Confirmação incorreta. Nada foi importado.'); return; }

    // Ler estado atual dos checkboxes do DOM antes de aplicar
    _previewImport.forEach(function (item, i) {
      var cb = document.getElementById('ctxImpSel_' + i);
      if (cb) item.selecionado = cb.checked;
    });

    var selecionados = _previewImport.filter(function (item) {
      return item.selecionado && (item.status === 'criar' || item.status === 'atualizar');
    });

    if (!selecionados.length) { alert('Nenhuma linha selecionada para aplicar.'); return; }

    var bkKey = _criarBackup('import');
    console.log('[contatos-excel] backup antes de importar:', bkKey);

    var list = _ctsLoad();
    var criados = 0; var atualizados = 0;

    selecionados.forEach(function (item, si) {
      // Ler campos editados do DOM
      var nomeVal  = (document.getElementById('ctxImpNome_'  + item.idx) || {}).value || item.nomeContato;
      var deptVal  = (document.getElementById('ctxImpDept_'  + item.idx) || {}).value || item.dept;
      var emailVal = (document.getElementById('ctxImpEmail_' + item.idx) || {}).value || item.email;
      var telVal   = (document.getElementById('ctxImpTel_'   + item.idx) || {}).value || item.telefone;
      var obsVal   = (document.getElementById('ctxImpObs_'   + item.idx) || {}).value || item.obs;
      var empVal   = item.empresaCli;  // empresa vinculada — campo readonly, usa valor classificado

      if (item.status === 'criar') {
        var novo = {
          id:           _genId(),
          nome:         nomeVal.trim(),
          empresa:      empVal,
          departamento: deptVal.trim(),
          email:        emailVal.trim(),
          telefone:     telVal.trim(),
          observacao:   obsVal.trim(),
          criado:       new Date().toISOString()
        };
        list.unshift(novo);
        criados++;
      } else if (item.status === 'atualizar' && item.contatoExistente) {
        list = list.map(function (x) {
          if (x.id !== item.contatoExistente.id) return x;
          return Object.assign({}, x, {
            nome:         nomeVal.trim()  || x.nome,
            departamento: deptVal.trim()  || x.departamento,
            email:        emailVal.trim() || x.email,
            telefone:     telVal.trim()   || x.telefone,
            observacao:   obsVal.trim()   || x.observacao,
            empresa:      empVal          || x.empresa
          });
        });
        atualizados++;
      }
    });

    _ctsSave(list);
    _previewImport = null;
    _renderTabelaContatosComBulk();
    if (typeof toast === 'function') toast('✅ Import: ' + criados + ' criados · ' + atualizados + ' atualizados · backup: ' + bkKey, 'ok');
  };

  // ══════════════════════════════════════════════════════════════
  // RESET AO TROCAR EMPRESA
  // ══════════════════════════════════════════════════════════════
  window.addEventListener('empresa:changed', function () {
    _sel = {};
    _previewImport = null;
    // renderTabelaContatos será chamado pelo hShowSec ou pelo módulo que trocar empresa
    // Limpar preview imediatamente caso esteja visível
    var pv = document.getElementById('ctxPreviewImport');
    if (pv) pv.innerHTML = '';
  });

  // ══════════════════════════════════════════════════════════════
  // INICIALIZAÇÃO — Override do renderTabelaContatos
  // ══════════════════════════════════════════════════════════════
  function _hookRender() {
    // Só substituir se já foi definido pelo cadastro.js
    if (typeof window.renderTabelaContatos === 'function'
        && window.renderTabelaContatos !== _renderTabelaContatosComBulk) {
      window.renderTabelaContatos = _renderTabelaContatosComBulk;
      console.log('[contatos-excel] renderTabelaContatos sobreescrito com versão bulk+excel');
    }
  }

  // Tentar imediatamente e também após DOMContentLoaded (garantia)
  _hookRender();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _hookRender);
  } else {
    // Atrasar 50ms para garantir que cadastro.js já registrou a função
    setTimeout(_hookRender, 50);
  }

})();

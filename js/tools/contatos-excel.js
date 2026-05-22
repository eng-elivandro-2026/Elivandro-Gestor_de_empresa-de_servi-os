// ============================================================
// contatos-excel.js — Edição em Massa + Exportar + Importar Contatos
// v2 — Fix: override robusto via window.renderTabelaContatos +
//      hook hShowSec + MutationObserver como fallback.
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

  function _nomeEmpresa() {
    var obj = null;
    if (typeof window.getEmpresaAtiva === 'function') obj = window.getEmpresaAtiva();
    if (!obj && window._empresaAtiva) obj = window._empresaAtiva;
    if (!obj) { try { obj = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null'); } catch (e) {} }
    if (obj && obj.nome) return obj.nome;
    return _eid() || 'empresa';
  }

  // ── Acesso a contatos e clientes ────────────────────────────
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

  function _ctsSave(list) {
    var key = _keyFor('tf_contatos');
    if (!key) { console.warn('[contatos-excel] empresa_id não disponível — save bloqueado'); return; }
    if (!list || list.length === 0) {
      if (_ctsLoad().length > 0) {
        console.warn('[contatos-excel] save de lista vazia bloqueado');
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
    var bkKey = 'tf_contatos_backup_' + Date.now() + '_' + eid + (sufixo ? '_' + sufixo : '');
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
  var _sel = {};
  var _previewImport = null;

  function _selIds() { return Object.keys(_sel).filter(function (id) { return _sel[id]; }); }

  function _recontarSel() {
    var n = _selIds().length;
    var el = document.getElementById('ctxContador');
    if (el) { el.textContent = n > 0 ? n + ' contato(s) selecionado(s)' : ''; el.style.display = n > 0 ? '' : 'none'; }
    var btn = document.getElementById('ctxBtnBulk');
    if (btn) { btn.disabled = n === 0; btn.style.opacity = n === 0 ? '.45' : '1'; }
  }

  // ── Helpers ─────────────────────────────────────────────────
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function _genId() { return 'cad_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }
  function _normTel(s) { return String(s || '').replace(/\D/g, ''); }
  function _normNome(s) { return String(s || '').trim().toLowerCase(); }

  function _cliMap() {
    var map = {};
    _cliLoad().forEach(function (c) {
      map[_normNome(c.nome)] = c;
      if (c.id) map['id:' + c.id] = c;
    });
    return map;
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL — substitui window.renderTabelaContatos
  // ══════════════════════════════════════════════════════════════
  function _renderComBulk() {
    var el = document.getElementById('tabelaContatos');
    if (!el) return;

    var list = _ctsLoad().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });

    window._ctsEditData = {};
    list.forEach(function (x) { window._ctsEditData[x.id] = x; });

    // Toolbar
    var toolbarHtml =
      '<div id="ctxToolbarBox" style="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem;margin-bottom:.65rem">'
      + '<label style="display:flex;align-items:center;gap:.35rem;font-size:.78rem;cursor:pointer;color:var(--text2)">'
      + '<input type="checkbox" id="ctxSelAll" onchange="ctxToggleSelAll(this.checked)" style="cursor:pointer"> Selecionar todos'
      + '</label>'
      + '<span id="ctxContador" style="font-size:.75rem;color:var(--blue);font-weight:700;display:none"></span>'
      + '<span style="flex:1"></span>'
      + '<button id="ctxBtnBulk" class="nb" onclick="ctxAbrirBulkEdit()" disabled'
      + ' style="opacity:.45;background:rgba(14,165,233,.1);color:var(--blue);border:1px solid rgba(14,165,233,.3);border-radius:6px;padding:.35rem .8rem;font-size:.75rem;font-weight:700">✏️ Editar selecionados</button>'
      + '<button class="nb" onclick="ctxExportarContatos()"'
      + ' style="background:rgba(34,197,94,.1);color:#22c55e;border:1px solid rgba(34,197,94,.3);border-radius:6px;padding:.35rem .8rem;font-size:.75rem;font-weight:600">📥 Exportar</button>'
      + '<button class="nb" onclick="ctxAbrirImport()"'
      + ' style="background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:.35rem .8rem;font-size:.75rem;font-weight:600">📤 Importar</button>'
      + '<input type="file" id="ctxArquivoInput" accept=".xlsx,.csv,.xls" style="display:none" onchange="ctxLerArquivo(this)">'
      + '</div>';

    if (!list.length) {
      el.innerHTML = toolbarHtml
        + '<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.82rem">Nenhum contato cadastrado ainda.</div>'
        + '<div id="ctxPreviewImport" style="margin-top:1rem"></div>';
      _recontarSel();
      if (_previewImport) _renderizarPreviewImport(_previewImport);
      return;
    }

    var tbHtml = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.78rem">'
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
          var chk = _sel[x.id] ? 'checked' : '';
          return '<tr style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:.4rem .5rem"><input type="checkbox" ' + chk
            + ' onchange="ctxToggleSel(\'' + x.id + '\',this.checked)" style="cursor:pointer"></td>'
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
      + '</tbody></table></div>';

    el.innerHTML = toolbarHtml + tbHtml + '<div id="ctxPreviewImport" style="margin-top:1.2rem"></div>';
    _recontarSel();
    if (_previewImport) _renderizarPreviewImport(_previewImport);
  }

  // ══════════════════════════════════════════════════════════════
  // INSTALAÇÃO DO OVERRIDE — 3 camadas de defesa
  // ══════════════════════════════════════════════════════════════

  // Camada 1: override direto de window.renderTabelaContatos
  function _instalarOverride() {
    if (window.renderTabelaContatos !== _renderComBulk) {
      window.renderTabelaContatos = _renderComBulk;
      console.log('[contatos-excel] window.renderTabelaContatos instalado');
    }
  }

  // Camada 2: hook em window.hShowSec para interceptar abertura da seção
  function _hookHShowSec() {
    if (window.hShowSec && !window.hShowSec._ctxHooked) {
      var _orig = window.hShowSec;
      window.hShowSec = function (sec) {
        _orig(sec);
        if (sec === 'contatos') {
          // garantia: se a chamada interna no IIFE renderizou a versão sem bulk,
          // chamamos a nossa versão logo depois
          if (!document.getElementById('ctxToolbarBox')) {
            _renderComBulk();
          }
        }
      };
      window.hShowSec._ctxHooked = true;
      console.log('[contatos-excel] hShowSec hooked');
    }
  }

  // Camada 3: MutationObserver — detecta quando tabelaContatos é recriada sem toolbar
  function _instalarObserver() {
    var alvo = document.getElementById('tabelaContatos');
    if (!alvo || alvo._ctxObserving) return;
    alvo._ctxObserving = true;
    var obs = new MutationObserver(function () {
      // Se tabelaContatos foi modificado e a toolbar sumiu, reinjetar
      if (!document.getElementById('ctxToolbarBox')) {
        // Verificar se a seção Contatos está visível antes de agir
        var sec = document.getElementById('hSecContatos');
        if (sec && sec.style.display !== 'none') {
          _renderComBulk();
        }
      }
    });
    obs.observe(alvo, { childList: true, subtree: false });
    console.log('[contatos-excel] MutationObserver instalado em #tabelaContatos');
  }

  function _instalar() {
    _instalarOverride();
    _hookHShowSec();
    _instalarObserver();
    // Se a seção Contatos já estiver aberta, renderizar agora
    var sec = document.getElementById('hSecContatos');
    if (sec && sec.style.display !== 'none') _renderComBulk();
  }

  // ── Executa após DOMContentLoaded ──────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _instalar);
  } else {
    _instalar();
  }

  // ── Reset ao trocar empresa ─────────────────────────────────
  window.addEventListener('empresa:changed', function () {
    _sel = {};
    _previewImport = null;
    var pv = document.getElementById('ctxPreviewImport');
    if (pv) pv.innerHTML = '';
    console.log('[contatos-excel] empresa:changed — seleção e prévia limpas');
  });

  // ══════════════════════════════════════════════════════════════
  // API PÚBLICA — seleção
  // ══════════════════════════════════════════════════════════════
  window.ctxToggleSel = function (id, checked) {
    _sel[id] = !!checked;
    _recontarSel();
    var allBox = document.getElementById('ctxSelAll');
    if (allBox) {
      var n = _selIds().length; var total = _ctsLoad().length;
      allBox.indeterminate = n > 0 && n < total;
      allBox.checked = total > 0 && n === total;
    }
  };

  window.ctxToggleSelAll = function (checked) {
    _ctsLoad().forEach(function (c) { _sel[c.id] = !!checked; });
    document.querySelectorAll('#tabelaContatos input[onchange^="ctxToggleSel("]').forEach(function (cb) {
      var m = (cb.getAttribute('onchange') || '').match(/ctxToggleSel\('([^']+)'/);
      if (m) cb.checked = !!checked;
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
    ['bkEmpresa','bkDept','bkObs'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('bkSobrescrever').checked = false;
    var pv = document.getElementById('bkPrevia'); if (pv) pv.innerHTML = '';
    m.style.display = 'flex';
  };

  window.ctxFecharBulkEdit = function () {
    var m = document.getElementById('m-bulk-contatos'); if (m) m.style.display = 'none';
  };

  window.ctxPreviewBulkEdit = function () {
    var ids = _selIds();
    var empresa = (document.getElementById('bkEmpresa').value || '').trim();
    var dept    = (document.getElementById('bkDept').value    || '').trim();
    var obs     = (document.getElementById('bkObs').value     || '').trim();
    var sobr    = document.getElementById('bkSobrescrever').checked;
    if (!empresa && !dept && !obs) { alert('Preencha ao menos um campo para editar.'); return; }

    var lista = _ctsLoad().filter(function(c){ return ids.indexOf(c.id) >= 0; });
    var linhas = lista.map(function(c) {
      var e2 = empresa && (sobr || !c.empresa)      ? empresa : (c.empresa      || '');
      var d2 = dept    && (sobr || !c.departamento) ? dept    : (c.departamento || '');
      var o2 = obs     && (sobr || !c.observacao)   ? obs     : (c.observacao   || '');
      var mudou = e2 !== (c.empresa||'') || d2 !== (c.departamento||'') || o2 !== (c.observacao||'');
      return { c:c, e2:e2, d2:d2, o2:o2, mudou:mudou };
    });

    var prev = document.getElementById('bkPrevia'); if (!prev) return;
    var semMudanca = linhas.filter(function(l){ return !l.mudou; }).length;
    prev.innerHTML = '<div style="font-size:.74rem;color:var(--text3);margin-bottom:.4rem">'
      + linhas.length + ' contato(s) afetados'
      + (semMudanca ? ' · <span style="color:#f59e0b">' + semMudanca + ' sem alteração</span>' : '')
      + '</div>'
      + '<table style="width:100%;font-size:.72rem;border-collapse:collapse">'
      + '<thead><tr style="color:var(--text3);font-size:.66rem;text-transform:uppercase">'
      + '<th style="padding:.25rem;text-align:left">Contato</th><th style="padding:.25rem;text-align:left">Empresa</th>'
      + '<th style="padding:.25rem;text-align:left">Depto</th><th style="padding:.25rem;text-align:left">Obs</th>'
      + '<th style="padding:.25rem">Status</th></tr></thead><tbody>'
      + linhas.map(function(l) {
          return '<tr style="border-bottom:1px solid var(--border)">'
            + '<td style="padding:.25rem;font-weight:600">' + esc(l.c.nome) + '</td>'
            + '<td style="padding:.25rem">' + (l.e2 !== (l.c.empresa||'') ? '<del style="color:var(--text3)">' + esc(l.c.empresa) + '</del> → <strong>' + esc(l.e2) + '</strong>' : esc(l.e2)) + '</td>'
            + '<td style="padding:.25rem">' + (l.d2 !== (l.c.departamento||'') ? '<del style="color:var(--text3)">' + esc(l.c.departamento) + '</del> → <strong>' + esc(l.d2) + '</strong>' : esc(l.d2)) + '</td>'
            + '<td style="padding:.25rem">' + (l.o2 !== (l.c.observacao||'') ? '<del style="color:var(--text3)">' + esc(l.c.observacao) + '</del> → <strong>' + esc(l.o2) + '</strong>' : esc(l.o2)) + '</td>'
            + '<td style="padding:.25rem;text-align:center">' + (l.mudou ? '<span style="color:#22c55e">✔</span>' : '<span style="color:#f59e0b">—</span>') + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>';
  };

  window.ctxAplicarBulkEdit = function () {
    var ids = _selIds();
    if (!ids.length) { alert('Nenhum contato selecionado.'); return; }
    var empresa = (document.getElementById('bkEmpresa').value || '').trim();
    var dept    = (document.getElementById('bkDept').value    || '').trim();
    var obs     = (document.getElementById('bkObs').value     || '').trim();
    var sobr    = document.getElementById('bkSobrescrever').checked;
    if (!empresa && !dept && !obs) { alert('Preencha ao menos um campo para editar.'); return; }

    var conf = prompt('Para confirmar a edição em massa, digite exatamente:\nATUALIZAR CONTATOS SELECIONADOS');
    if (conf !== 'ATUALIZAR CONTATOS SELECIONADOS') { alert('Confirmação incorreta. Nada foi alterado.'); return; }

    var bkKey = _criarBackup('bulk');
    var list = _ctsLoad();
    var alterados = 0;
    list = list.map(function(x) {
      if (ids.indexOf(x.id) < 0) return x;
      var novo = Object.assign({}, x);
      if (empresa && (sobr || !x.empresa))      novo.empresa      = empresa;
      if (dept    && (sobr || !x.departamento)) novo.departamento = dept;
      if (obs     && (sobr || !x.observacao))   novo.observacao   = obs;
      if (JSON.stringify(novo) !== JSON.stringify(x)) alterados++;
      return novo;
    });

    _ctsSave(list);
    _sel = {};
    ctxFecharBulkEdit();
    _renderComBulk();
    if (typeof toast === 'function') toast('✅ ' + alterados + ' contato(s) atualizados · backup: ' + bkKey, 'ok');
  };

  // ══════════════════════════════════════════════════════════════
  // EXPORTAR
  // ══════════════════════════════════════════════════════════════
  window.ctxExportarContatos = function () {
    var eid = _eid();
    if (!eid) { alert('Empresa ativa não identificada.'); return; }
    var nomEmp = _nomeEmpresa();
    var cliMapObj = _cliMap();
    var rows = _ctsLoad().map(function(c) {
      var cli = cliMapObj[_normNome(c.empresa)] || {};
      return {
        nome_contato: c.nome || '', empresa_cliente: c.empresa || '',
        cnpj_cliente: cli.cnpj || '', cidade_cliente: cli.cidade || '',
        departamento_funcao: c.departamento || '',
        email: c.email || '', telefone: c.telefone || '', observacao: c.observacao || '',
        empresa_id: eid, cliente_id: cli.id || '', contato_id: c.id || ''
      };
    });
    var hoje = new Date().toISOString().slice(0, 10);
    var base = 'contatos_' + nomEmp.toLowerCase().replace(/\s+/g, '_') + '_' + hoje;
    if (typeof XLSX !== 'undefined') { _exportXLSX(rows, base + '.xlsx'); }
    else { _exportCSV(rows, base + '.csv'); }
  };

  function _exportXLSX(rows, nome) {
    var cols = ['nome_contato','empresa_cliente','cnpj_cliente','cidade_cliente','departamento_funcao','email','telefone','observacao','empresa_id','cliente_id','contato_id'];
    var data = [cols].concat(rows.map(function(r){ return cols.map(function(k){ return r[k]; }); }));
    var ws = XLSX.utils.aoa_to_sheet(data);
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
    XLSX.writeFile(wb, nome);
    if (typeof toast === 'function') toast('📥 Excel exportado: ' + nome, 'ok');
  }

  function _exportCSV(rows, nome) {
    var cols = ['nome_contato','empresa_cliente','cnpj_cliente','cidade_cliente','departamento_funcao','email','telefone','observacao','empresa_id','cliente_id','contato_id'];
    var linhas = [cols.map(function(c){ return '"'+c+'"'; }).join(';')];
    rows.forEach(function(r){
      linhas.push(cols.map(function(k){ return '"'+String(r[k]||'').replace(/"/g,'""')+'"'; }).join(';'));
    });
    var blob = new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = nome;
    document.body.appendChild(a); a.click();
    setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    if (typeof toast === 'function') toast('📥 CSV exportado: ' + nome, 'ok');
  }

  // ══════════════════════════════════════════════════════════════
  // IMPORTAR
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
          rawRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        } else {
          var text = typeof e.target.result === 'string' ? e.target.result
            : new TextDecoder('utf-8').decode(e.target.result);
          rawRows = _parseCSV(text);
        }
        _previewImport = _classificarLinhas(rawRows);
        // Garantir que a seção de contatos está renderizada com bulk UI
        var el = document.getElementById('tabelaContatos');
        if (!document.getElementById('ctxToolbarBox')) _renderComBulk();
        _renderizarPreviewImport(_previewImport);
        var pv = document.getElementById('ctxPreviewImport');
        if (pv) pv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (err) {
        console.error('[contatos-excel] erro ao ler arquivo:', err);
        alert('Erro ao ler o arquivo: ' + err.message);
      }
    };
    if ((ext === 'xlsx' || ext === 'xls') && typeof XLSX !== 'undefined') reader.readAsArrayBuffer(file);
    else reader.readAsText(file, 'UTF-8');
    input.value = '';
  };

  function _parseCSV(text) {
    text = text.replace(/^﻿/, '');
    var lines = text.split(/\r?\n/).filter(function(l){ return l.trim(); });
    if (!lines.length) return [];
    var sep = lines[0].indexOf(';') >= 0 ? ';' : ',';
    function splitLine(line) {
      var cols=[], cur='', inQ=false;
      for (var i=0; i<line.length; i++) {
        var ch=line[i];
        if (ch==='"' && !inQ) { inQ=true; continue; }
        if (ch==='"' && inQ && line[i+1]==='"') { cur+='"'; i++; continue; }
        if (ch==='"' && inQ) { inQ=false; continue; }
        if (ch===sep && !inQ) { cols.push(cur); cur=''; continue; }
        cur+=ch;
      }
      cols.push(cur); return cols;
    }
    var headers = splitLine(lines[0]).map(function(h){ return h.trim(); });
    return lines.slice(1).map(function(line) {
      var vals = splitLine(line);
      var obj = {};
      headers.forEach(function(h,i){ obj[h]=(vals[i]||'').trim(); });
      return obj;
    });
  }

  function _classificarLinhas(rawRows) {
    var eid = _eid();
    var ctsAtual = _ctsLoad();
    var cliMapObj = _cliMap();

    return rawRows.map(function(row, idx) {
      var nomeContato = String(row.nome_contato || row['Nome Contato'] || row['nome'] || '').trim();
      var empresaCli  = String(row.empresa_cliente || row['Empresa'] || row['empresa'] || '').trim();
      var cnpjCli     = String(row.cnpj_cliente    || row['CNPJ']    || '').trim();
      var dept        = String(row.departamento_funcao || row['Departamento'] || row['departamento'] || '').trim();
      var email       = String(row.email     || row['Email']    || '').trim().toLowerCase();
      var telefone    = String(row.telefone  || row['Telefone'] || '').trim();
      var obs         = String(row.observacao || row['Observacao'] || row['Observação'] || '').trim();
      var rowEid      = String(row.empresa_id  || '').trim();
      var clienteId   = String(row.cliente_id  || '').trim();
      var contatoId   = String(row.contato_id  || '').trim();

      var item = { idx:idx, nomeContato:nomeContato, empresaCli:empresaCli, dept:dept, email:email,
        telefone:telefone, obs:obs, rowEid:rowEid, clienteId:clienteId, contatoId:contatoId,
        status:'', mensagem:'', contatoExistente:null, clienteEncontrado:null, selecionado:true };

      if (rowEid && eid && rowEid !== eid) {
        item.status='bloqueado'; item.mensagem='empresa_id "'+rowEid+'" ≠ ativa "'+eid+'" — bloqueado'; item.selecionado=false; return item;
      }
      if (!nomeContato) {
        item.status='erro'; item.mensagem='Sem nome do contato — obrigatório'; item.selecionado=false; return item;
      }
      if (!empresaCli && !clienteId) {
        item.status='erro'; item.mensagem='Sem empresa vinculada — obrigatório'; item.selecionado=false; return item;
      }

      var cli = cliMapObj[_normNome(empresaCli)] || (clienteId ? cliMapObj['id:'+clienteId] : null);
      if (!cli && cnpjCli) {
        var cn = cnpjCli.replace(/\D/g,'');
        cli = _cliLoad().find(function(c){ return c.cnpj && c.cnpj.replace(/\D/g,'')===cn; }) || null;
      }
      if (!cli) {
        item.status='cliente_nao_encontrado'; item.mensagem='Cliente "'+( empresaCli||clienteId)+'" não encontrado';
        item.selecionado=false; return item;
      }
      item.clienteEncontrado = cli;
      item.empresaCli = cli.nome;

      var existente = null;
      if (contatoId) existente = ctsAtual.find(function(c){ return c.id===contatoId; }) || null;
      if (!existente && email) existente = ctsAtual.find(function(c){ return c.email && c.email.trim().toLowerCase()===email; }) || null;
      if (!existente && telefone) {
        var telN=_normTel(telefone);
        existente = ctsAtual.find(function(c){ return _normTel(c.telefone)===telN && telN; }) || null;
      }
      if (!existente) {
        var nN=_normNome(nomeContato), eN=_normNome(cli.nome);
        var poss=ctsAtual.filter(function(c){ return _normNome(c.nome)===nN && _normNome(c.empresa||'')===eN; });
        if (poss.length===1) existente=poss[0];
        if (poss.length>1) {
          item.status='duplicado'; item.mensagem=poss.length+' contatos com mesmo nome+empresa';
          item.contatoExistente=poss[0]; item.selecionado=false; return item;
        }
      }
      if (!existente) {
        var nS=_normNome(nomeContato);
        var sim=ctsAtual.filter(function(c){
          var cn=_normNome(c.nome);
          return cn!==nS && (cn.indexOf(nS)>=0||nS.indexOf(cn)>=0) && _normNome(c.empresa||'')===_normNome(cli.nome);
        });
        if (sim.length>0) {
          item.status='possivel_duplicado'; item.mensagem='Nome similar a "'+sim[0].nome+'"';
          item.contatoExistente=sim[0]; item.selecionado=false; return item;
        }
      }

      item.contatoExistente = existente;
      item.status = existente ? 'atualizar' : 'criar';
      item.mensagem = existente ? 'Atualiza: '+existente.nome : 'Novo contato';
      return item;
    });
  }

  var _stLbl = {
    criar:{l:'CRIAR',c:'#22c55e'}, atualizar:{l:'ATUALIZAR',c:'#60a5fa'},
    possivel_duplicado:{l:'DUPLICADO?',c:'#f59e0b'}, duplicado:{l:'DUPLICADO',c:'#f59e0b'},
    erro:{l:'ERRO',c:'#ef4444'}, bloqueado:{l:'BLOQUEADO',c:'#ef4444'},
    cliente_nao_encontrado:{l:'CLI NÃO ENCONTRADO',c:'#ef4444'}
  };

  function _renderizarPreviewImport(linhas) {
    var pv = document.getElementById('ctxPreviewImport');
    if (!pv) return;
    if (!linhas || !linhas.length) { pv.innerHTML=''; return; }

    var cnt={criar:0,atualizar:0,possivel_duplicado:0,duplicado:0,erro:0,bloqueado:0,cliente_nao_encontrado:0};
    linhas.forEach(function(l){ if(cnt[l.status]!==undefined) cnt[l.status]++; });

    var conf = 'IMPORTAR CONTATOS ' + _nomeEmpresa().toUpperCase();

    function badge(label, n, color) {
      if (!n) return '';
      return '<span style="background:'+color+'22;color:'+color+';border:1px solid '+color+'44;border-radius:4px;padding:.12rem .45rem;font-size:.7rem;font-weight:700">'+n+' '+label+'</span>';
    }

    var html = '<div style="border-top:2px solid var(--border);padding-top:1rem">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem">'
      + '<div style="font-size:.9rem;font-weight:800;color:var(--blue)">📤 Prévia de Importação</div>'
      + '<button class="nb" onclick="_ctxLimparPreview()" style="font-size:.72rem;color:var(--text3)">✕ Limpar</button>'
      + '</div>'
      + '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.65rem">'
      + badge('criar', cnt.criar, '#22c55e')
      + badge('atualizar', cnt.atualizar, '#60a5fa')
      + badge('duplicado?', cnt.duplicado+cnt.possivel_duplicado, '#f59e0b')
      + badge('erro/bloqueado', cnt.erro+cnt.bloqueado+cnt.cliente_nao_encontrado, '#ef4444')
      + '</div>'
      + '<div id="ctxImportCards" style="display:flex;flex-direction:column;gap:.45rem">';

    linhas.forEach(function(item,i){ html += _cardImport(item,i); });

    html += '</div>'
      + '<div style="margin-top:.75rem;display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">'
      + '<button class="nb" onclick="ctxAplicarImport()" style="background:var(--blue);color:#fff;border-radius:6px;padding:.4rem 1rem;font-size:.8rem;font-weight:700">✅ Aplicar Selecionados</button>'
      + '<span style="font-size:.71rem;color:var(--text3)">Confirmar com: <code>'+esc(conf)+'</code></span>'
      + '</div></div>';

    pv.innerHTML = html;
  }

  function _cardImport(item, i) {
    var st = _stLbl[item.status] || {l:item.status.toUpperCase(),c:'#94a3b8'};
    var podeSel = item.status==='criar' || item.status==='atualizar';
    var chk = item.selecionado && podeSel ? 'checked' : '';
    var dis = podeSel ? '' : 'disabled';
    var c = item.contatoExistente || {};

    return '<div style="border:1px solid var(--border);border-radius:7px;padding:.55rem .75rem;background:'+(podeSel?'var(--bg2)':'var(--bg)') + '">'
      + '<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;flex-wrap:wrap">'
      + '<input type="checkbox" id="ctxImpSel_'+i+'" '+chk+' '+dis+' onchange="_ctxImpToggle('+i+',this.checked)">'
      + '<span style="background:'+st.c+'22;color:'+st.c+';border:1px solid '+st.c+'44;border-radius:3px;padding:.08rem .4rem;font-size:.67rem;font-weight:700">'+st.l+'</span>'
      + '<span style="font-size:.73rem;color:var(--text3)">'+esc(item.mensagem)+'</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:.4rem">'
      + _inpImp('Nome *',          'ctxImpNome_'+i,  item.nomeContato, !podeSel)
      + _inpImp('Empresa *',       'ctxImpEmp_'+i,   item.empresaCli,  true)
      + _inpImp('Depto / Função',  'ctxImpDept_'+i,  item.dept,        !podeSel)
      + _inpImp('E-mail',          'ctxImpEmail_'+i, item.email,       !podeSel)
      + _inpImp('Telefone',        'ctxImpTel_'+i,   item.telefone,    !podeSel)
      + _inpImp('Observação',      'ctxImpObs_'+i,   item.obs,         !podeSel)
      + '</div>'
      + '<div style="margin-top:.3rem;font-size:.66rem;color:var(--text3);display:flex;gap:.6rem;flex-wrap:wrap">'
      + '<span>empresa_id: <code>'+esc(_eid())+'</code></span>'
      + (item.clienteEncontrado ? '<span>cliente_id: <code>'+esc(item.clienteEncontrado.id)+'</code></span>' : '')
      + (c.id ? '<span>contato_id: <code>'+esc(c.id)+'</code></span>' : '')
      + '</div>'
      + (item.status==='atualizar' && c.id ? '<div style="margin-top:.3rem;font-size:.67rem;background:rgba(14,165,233,.06);border:1px solid rgba(14,165,233,.18);border-radius:4px;padding:.3rem .5rem">'
        + 'Atual — Nome: <strong>'+esc(c.nome)+'</strong> · Empresa: '+esc(c.empresa)+' · Depto: '+esc(c.departamento)+'</div>' : '')
      + '</div>';
  }

  function _inpImp(label, id, val, readonly) {
    return '<div>'
      + '<label style="font-size:.61rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.04em">'+esc(label)+'</label>'
      + '<input id="'+esc(id)+'" type="text" value="'+esc(val)+'" '
      + (readonly ? 'readonly style="width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text3);border-radius:4px;padding:.28rem .45rem;margin-top:.12rem;font-size:.74rem"'
                  :        'style="width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:.28rem .45rem;margin-top:.12rem;font-size:.74rem"')
      + '></div>';
  }

  window._ctxImpToggle = function(i, checked) {
    if (_previewImport && _previewImport[i]) _previewImport[i].selecionado = !!checked;
  };

  window._ctxLimparPreview = function() {
    _previewImport = null;
    var pv = document.getElementById('ctxPreviewImport'); if (pv) pv.innerHTML = '';
  };

  window.ctxAplicarImport = function() {
    if (!_previewImport || !_previewImport.length) { alert('Nenhuma prévia disponível.'); return; }
    var conf = 'IMPORTAR CONTATOS ' + _nomeEmpresa().toUpperCase();
    var resp = prompt('Para confirmar, digite exatamente:\n' + conf);
    if (resp !== conf) { alert('Confirmação incorreta. Nada foi importado.'); return; }

    // Sincronizar estado dos checkboxes do DOM
    _previewImport.forEach(function(item,i){
      var cb = document.getElementById('ctxImpSel_'+i);
      if (cb) item.selecionado = cb.checked;
    });

    var selecionados = _previewImport.filter(function(item){
      return item.selecionado && (item.status==='criar' || item.status==='atualizar');
    });
    if (!selecionados.length) { alert('Nenhuma linha selecionada para aplicar.'); return; }

    var bkKey = _criarBackup('import');
    var list = _ctsLoad();
    var criados=0, atualizados=0;

    selecionados.forEach(function(item) {
      var g = function(sfx){ return ((document.getElementById('ctxImp'+sfx+'_'+item.idx)||{}).value||'').trim(); };
      var nomeV  = g('Nome')  || item.nomeContato;
      var deptV  = g('Dept')  || item.dept;
      var emailV = g('Email') || item.email;
      var telV   = g('Tel')   || item.telefone;
      var obsV   = g('Obs')   || item.obs;
      var empV   = item.empresaCli;  // readonly — valor classificado

      if (item.status === 'criar') {
        list.unshift({ id:_genId(), nome:nomeV, empresa:empV, departamento:deptV,
          email:emailV, telefone:telV, observacao:obsV, criado:new Date().toISOString() });
        criados++;
      } else if (item.status === 'atualizar' && item.contatoExistente) {
        list = list.map(function(x){
          return x.id !== item.contatoExistente.id ? x
            : Object.assign({}, x, { nome:nomeV||x.nome, departamento:deptV||x.departamento,
                email:emailV||x.email, telefone:telV||x.telefone, observacao:obsV||x.observacao, empresa:empV||x.empresa });
        });
        atualizados++;
      }
    });

    _ctsSave(list);
    _previewImport = null;
    _renderComBulk();
    if (typeof toast === 'function') toast('✅ Import: '+criados+' criados · '+atualizados+' atualizados · backup: '+bkKey, 'ok');
  };

})();

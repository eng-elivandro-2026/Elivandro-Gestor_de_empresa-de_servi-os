// ============================================================
// relacionamento-duplicados.js
// Detecção e resolução de duplicados em Empresas e Contatos
// Fase 1 — somente leitura + merge manual com confirmação
//
// Regras absolutas:
//   - Nunca compara dados de empresas diferentes
//   - Nunca usa chaves globais (sem empresa_id)
//   - Nunca aplica merge automático
//   - Sempre exige confirmação explícita
//   - Cria snapshot antes de qualquer alteração
//   - Processa um par por vez (1 item removido → DataGuard não bloqueia)
//   - Não quebra Recovery, DataGuard, cadastro.js
// ============================================================

(function () {
  'use strict';

  // ── Utilitários ───────────────────────────────────────────

  function _norm(s) {
    return String(s || '').toLowerCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ');
  }
  function _normCnpj(s) { return String(s || '').replace(/\D/g, ''); }
  function _normTel(s)  { return String(s || '').replace(/\D/g, ''); }
  function _normEmail(s){ return String(s || '').toLowerCase().trim(); }
  function _esc(s)      { return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  // Distância de Levenshtein normalizada (0 = diferentes, 1 = idênticos)
  function _similarity(a, b) {
    a = _norm(a); b = _norm(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    var la = a.length, lb = b.length;
    var longer = la >= lb ? a : b, shorter = la >= lb ? b : a;
    var ll = longer.length;
    if (ll === 0) return 1;
    var costs = [];
    for (var i = 0; i <= ll; i++) {
      var last = i;
      for (var j = 0; j <= shorter.length; j++) {
        if (i === 0) { costs[j] = j; }
        else if (j > 0) {
          var nv = costs[j - 1];
          if (longer[i - 1] !== shorter[j - 1]) nv = Math.min(Math.min(nv, last), costs[j]) + 1;
          costs[j - 1] = last;
          last = nv;
        }
      }
      if (i > 0) costs[shorter.length] = last;
    }
    return (ll - costs[shorter.length]) / ll;
  }

  // ── Empresa ativa ─────────────────────────────────────────

  function _getEmpresaId() {
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

  // ── Toast ─────────────────────────────────────────────────

  function _toast(msg, tipo) {
    if (typeof window.toast === 'function') { window.toast(msg, tipo); return; }
    console.log('[Dedup] ' + msg);
  }

  // ── Snapshot de segurança ────────────────────────────────
  // Cria cópia local antes de qualquer merge. Mantém últimos 3 por chave.

  window.criarSnapshotDuplicados = function (tipo) {
    var eid = _getEmpresaId();
    if (!eid) return null;
    var lista = (tipo === 'cliente' ? window.cliGetAll() : window.ctsGetAll()) || [];
    var prefix = 'tf_dedup_snap_' + tipo + '_' + eid + '_';
    var snapKey = prefix + Date.now();
    try {
      localStorage.setItem(snapKey, JSON.stringify({ ts: new Date().toISOString(), lista: lista }));
      // Manter apenas os 3 mais recentes
      var keys = Object.keys(localStorage)
        .filter(function (k) { return k.indexOf(prefix) === 0; }).sort();
      while (keys.length > 3) { localStorage.removeItem(keys.shift()); }
    } catch (e) { console.warn('[Dedup] Erro ao criar snapshot:', e); }
    console.log('[Dedup] Snapshot criado:', snapKey, '(' + lista.length + ' registros)');
    return snapKey;
  };

  // ── Log de auditoria ─────────────────────────────────────

  window.registrarLogMergeDuplicado = function (tipo, antes, depois) {
    var LOG_KEY = 'tf_dedup_log';
    try {
      var log = [];
      try { log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) {}
      log.unshift({
        ts:      new Date().toISOString(),
        tipo:    tipo,
        eid:     _getEmpresaId(),
        a:       { id: antes.a.id, nome: antes.a.nome },
        b:       { id: antes.b.id, nome: antes.b.nome },
        depois:  { id: depois.id, nome: depois.nome },
        criterio: antes.criterio || ''
      });
      if (log.length > 50) log = log.slice(0, 50);
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch (e) { console.warn('[Dedup] Erro ao registrar log:', e); }
  };

  // ── Detecção de duplicados — Clientes ────────────────────

  window.detectarDuplicadosClientes = function () {
    var eid = _getEmpresaId();
    if (!eid) { _toast('Sem empresa ativa.', 'erro'); return []; }

    var lista = (window.cliGetAll() || []).filter(function (x) { return x && x.nome; });
    var pares = [], vistos = {};

    for (var i = 0; i < lista.length; i++) {
      for (var j = i + 1; j < lista.length; j++) {
        var a = lista[i], b = lista[j];
        var pairKey = [a.id, b.id].sort().join('|');
        if (vistos[pairKey]) continue;
        vistos[pairKey] = true;

        var cnpjA = _normCnpj(a.cnpj), cnpjB = _normCnpj(b.cnpj);
        var nA = _norm(a.nome), nB = _norm(b.nome);
        var cidA = _norm(a.cidade), cidB = _norm(b.cidade);
        var telA = _normTel(a.telefone), telB = _normTel(b.telefone);
        var criterio = null, score = 0;

        if (cnpjA.length >= 11 && cnpjA === cnpjB) {
          criterio = 'CNPJ igual'; score = 100;
        } else if (nA && nA === nB) {
          criterio = 'Nome normalizado igual'; score = 85;
        } else if (nA && cidA && nA === nB && cidA === cidB) {
          criterio = 'Nome + cidade iguais'; score = 80;
        } else if (telA.length >= 8 && telA === telB) {
          criterio = 'Telefone igual'; score = 60;
        } else if (nA && nB) {
          var sim = _similarity(a.nome, b.nome);
          if (sim >= 0.80) {
            if (cidA && cidA === cidB) {
              criterio = 'Nome parecido + cidade igual (' + Math.round(sim * 100) + '%)';
              score = Math.round(sim * 82);
            } else {
              criterio = 'Nome muito parecido (' + Math.round(sim * 100) + '%)';
              score = Math.round(sim * 70);
            }
          }
        }
        if (criterio) pares.push({ a: a, b: b, criterio: criterio, score: score });
      }
    }
    pares.sort(function (x, y) { return y.score - x.score; });
    return pares;
  };

  // ── Detecção de duplicados — Contatos ────────────────────

  window.detectarDuplicadosContatos = function () {
    var eid = _getEmpresaId();
    if (!eid) { _toast('Sem empresa ativa.', 'erro'); return []; }

    var lista = (window.ctsGetAll() || []).filter(function (x) { return x && x.nome; });
    var pares = [], vistos = {};

    for (var i = 0; i < lista.length; i++) {
      for (var j = i + 1; j < lista.length; j++) {
        var a = lista[i], b = lista[j];
        var pairKey = [a.id, b.id].sort().join('|');
        if (vistos[pairKey]) continue;
        vistos[pairKey] = true;

        var emA = _normEmail(a.email), emB = _normEmail(b.email);
        var telA = _normTel(a.telefone), telB = _normTel(b.telefone);
        var nA = _norm(a.nome), nB = _norm(b.nome);
        var empA = _norm(a.empresa), empB = _norm(b.empresa);
        var criterio = null, score = 0;

        if (emA && emA === emB) {
          criterio = 'E-mail igual'; score = 100;
        } else if (telA.length >= 8 && telA === telB) {
          criterio = 'Telefone igual'; score = 95;
        } else if (nA && nA === nB && empA && empA === empB) {
          criterio = 'Nome + empresa iguais'; score = 88;
        } else if (nA && nB) {
          var sim = _similarity(a.nome, b.nome);
          if (sim >= 0.82 && empA && empA === empB) {
            criterio = 'Nome parecido + empresa igual (' + Math.round(sim * 100) + '%)';
            score = Math.round(sim * 82);
          } else if (nA === nB) {
            criterio = 'Nome normalizado igual'; score = 70;
          }
        }
        if (criterio) pares.push({ a: a, b: b, criterio: criterio, score: score });
      }
    }
    pares.sort(function (x, y) { return y.score - x.score; });
    return pares;
  };

  // ── Aplicar merge ─────────────────────────────────────────
  // idPrincipal: registro que fica | idSecundario: registro removido
  // dadosFinais: campos a aplicar no registro principal

  window.aplicarMergeDuplicado = function (tipo, idPrincipal, idSecundario, dadosFinais) {
    var eid = _getEmpresaId();
    if (!eid) { _toast('Sem empresa ativa.', 'erro'); return false; }

    var getLista = tipo === 'cliente' ? window.cliGetAll : window.ctsGetAll;
    var saveLista = tipo === 'cliente' ? window.cliSaveDirect : window.ctsSaveDirect;
    if (typeof saveLista !== 'function') {
      _toast('Função de save não disponível. Verifique cadastro.js.', 'erro'); return false;
    }

    var lista = getLista() || [];
    var regA = null, regB = null;
    lista.forEach(function (x) {
      if (x.id === idPrincipal) regA = x;
      if (x.id === idSecundario) regB = x;
    });
    if (!regA || !regB) { _toast('Registros não encontrados.', 'erro'); return false; }

    var antes = {
      a: regA, b: regB,
      criterio: _state.pares[_state.indice] ? _state.pares[_state.indice].criterio : ''
    };

    // 1. Snapshot antes de alterar
    window.criarSnapshotDuplicados(tipo);

    // 2. Montar lista final: atualizar A, remover B
    var listaFinal = lista
      .map(function (x) {
        if (x.id === idPrincipal) return Object.assign({}, x, dadosFinais);
        return x;
      })
      .filter(function (x) { return x.id !== idSecundario; });

    // 3. Atualizar referências no histórico se nome de B diferir do resultado
    var nomeB = regB.nome;
    var nomeResultado = dadosFinais.nome || regA.nome;
    if (nomeB && nomeB !== nomeResultado) {
      var campo = tipo === 'cliente' ? 'cliente' : 'contato';
      _atualizarRefsHistorico(nomeB, nomeResultado, eid, campo);
    }

    // 4. Salvar via cadastro.js (inclui DataGuard + Supabase sync)
    saveLista(listaFinal);

    // 5. Log
    var depois = Object.assign({}, regA, dadosFinais);
    window.registrarLogMergeDuplicado(tipo, antes, depois);

    console.log('[Dedup] Merge aplicado:', tipo, '| Principal:', idPrincipal, '| Removido:', idSecundario);
    return true;
  };

  // ── Atualizar referências no histórico ────────────────────

  function _atualizarRefsHistorico(nomeAntigo, nomeNovo, eid, campo) {
    if (!nomeAntigo || nomeAntigo === nomeNovo) return;
    var key = 'tf_historico_' + eid;
    try {
      var hist = [];
      try { hist = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
      var alterado = false;
      hist = hist.map(function (h) {
        if (h[campo] === nomeAntigo) {
          alterado = true;
          var nova = Object.assign({}, h);
          nova[campo] = nomeNovo;
          return nova;
        }
        return h;
      });
      if (!alterado) return;
      localStorage.setItem(key, JSON.stringify(hist));
      if (window.sbClient) {
        window.sbClient.from('configuracoes').upsert(
          { chave: key, valor: hist, updated_at: new Date().toISOString(), empresa_id: eid },
          { onConflict: 'chave,empresa_id' }
        ).then(function (r) {
          if (r.error) console.warn('[Dedup] Erro Supabase ao atualizar histórico:', r.error);
          else console.log('[Dedup] Histórico atualizado no Supabase:', campo, nomeAntigo, '→', nomeNovo);
        });
      }
    } catch (e) { console.warn('[Dedup] Erro ao atualizar refs histórico:', e); }
  }

  // ── Estado do modal ───────────────────────────────────────

  var _state = { tipo: null, pares: [], indice: 0 };

  // ── Criar modal no DOM (lazy, apenas 1 vez) ───────────────

  function _ensureModal() {
    if (document.getElementById('m-dedup')) return;
    var div = document.createElement('div');
    div.id = 'm-dedup';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.style.cssText = [
      'display:none;position:fixed;inset:0;z-index:99999',
      'align-items:center;justify-content:center',
      'background:rgba(0,0,0,.75)'
    ].join(';');
    div.innerHTML =
      '<div id="m-dedup-box" style="'
        + 'background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);'
        + 'border-radius:12px;width:min(96vw,800px);max-height:90vh;'
        + 'overflow-y:auto;font-family:system-ui,sans-serif">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;'
        + 'padding:1rem 1.25rem;border-bottom:1px solid var(--border,#30363d);position:sticky;top:0;'
        + 'background:var(--bg2,#161b22);z-index:1">'
      + '<div id="m-dedup-titulo" style="font-size:.95rem;font-weight:800;color:var(--text,#e6edf3)">🔍 Verificar Duplicados</div>'
      + '<button onclick="window._dedupFechar()" title="Fechar" style="background:none;border:none;cursor:pointer;'
        + 'font-size:1.1rem;color:var(--text2,#8b949e);padding:.25rem .5rem;line-height:1">✕</button>'
      + '</div>'
      + '<div id="m-dedup-corpo" style="padding:1.25rem"></div>'
      + '</div>';
    document.body.appendChild(div);
  }

  window._dedupFechar = function () {
    var m = document.getElementById('m-dedup');
    if (m) m.style.display = 'none';
    _state = { tipo: null, pares: [], indice: 0 };
  };

  // ── Abrir modal ───────────────────────────────────────────

  window.abrirModalDuplicados = function (tipo) {
    var eid = _getEmpresaId();
    if (!eid) { alert('Selecione uma empresa antes de verificar duplicados.'); return; }

    _ensureModal();
    var corpo = document.getElementById('m-dedup-corpo');
    if (corpo) corpo.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text2,#8b949e);font-size:.82rem">🔍 Analisando registros...</div>';
    document.getElementById('m-dedup').style.display = 'flex';

    // Detectar de forma assíncrona para não bloquear UI
    setTimeout(function () {
      var pares = tipo === 'cliente'
        ? window.detectarDuplicadosClientes()
        : window.detectarDuplicadosContatos();
      _state = { tipo: tipo, pares: pares, indice: 0 };
      _renderEstado();
    }, 30);
  };

  // ── Renderizar estado atual ───────────────────────────────

  function _renderEstado() {
    var titulo = document.getElementById('m-dedup-titulo');
    var corpo  = document.getElementById('m-dedup-corpo');
    if (!titulo || !corpo) return;

    var tipo  = _state.tipo;
    var pares = _state.pares;
    var idx   = _state.indice;
    var label = tipo === 'cliente' ? 'Empresas' : 'Contatos';

    titulo.innerHTML = '🔍 Duplicados em ' + label;

    if (!pares.length) {
      corpo.innerHTML = _tplVazio(label) + _tplBtnFechar();
      return;
    }
    if (idx >= pares.length) {
      corpo.innerHTML = _tplConcluido(pares.length) + _tplBtnFechar();
      return;
    }

    window.renderComparacaoDuplicados(pares[idx], tipo, idx, pares.length);
  }

  function _tplVazio(label) {
    return '<div style="text-align:center;padding:2.5rem 1rem">'
      + '<div style="font-size:2.2rem;margin-bottom:.5rem">✅</div>'
      + '<div style="font-size:.92rem;font-weight:700;color:var(--green,#3fb950)">Nenhum duplicado encontrado</div>'
      + '<div style="font-size:.76rem;color:var(--text3,#6e7681);margin-top:.35rem">Todos os ' + label.toLowerCase() + ' parecem únicos nesta empresa.</div>'
      + '</div>';
  }
  function _tplConcluido(total) {
    return '<div style="text-align:center;padding:2.5rem 1rem">'
      + '<div style="font-size:2.2rem;margin-bottom:.5rem">🎉</div>'
      + '<div style="font-size:.92rem;font-weight:700;color:var(--green,#3fb950)">Revisão concluída</div>'
      + '<div style="font-size:.76rem;color:var(--text3,#6e7681);margin-top:.35rem">' + total + ' par(es) revisado(s).</div>'
      + '</div>';
  }
  function _tplBtnFechar() {
    return '<div style="padding:.75rem 1.25rem;border-top:1px solid var(--border,#30363d);text-align:right">'
      + '<button onclick="window._dedupFechar()" style="background:var(--accent,#f0a500);color:#000;border:none;'
      + 'border-radius:6px;padding:.45rem 1.25rem;font-size:.8rem;font-weight:700;cursor:pointer">Fechar</button>'
      + '</div>';
  }

  // ── Renderizar comparação lado a lado ─────────────────────

  window.renderComparacaoDuplicados = function (par, tipo, indice, total) {
    var corpo = document.getElementById('m-dedup-corpo');
    if (!corpo) return;

    var a = par.a, b = par.b;
    var campos = tipo === 'cliente'
      ? [['Nome', 'nome'], ['CNPJ', 'cnpj'], ['Cidade', 'cidade']]
      : [['Nome', 'nome'], ['Empresa', 'empresa'], ['E-mail', 'email'], ['Telefone', 'telefone'], ['Departamento', 'departamento']];

    var DIFF_STYLE = 'background:rgba(240,165,0,.15);border-radius:3px;padding:0 .25rem';

    var linhas = campos.map(function (c) {
      var f = c[1];
      var va = String(a[f] || ''), vb = String(b[f] || '');
      var isDiff = va.toLowerCase().trim() !== vb.toLowerCase().trim();
      var sty = isDiff ? DIFF_STYLE : '';
      var empty = '<em style="opacity:.35;font-size:.73rem">vazio</em>';
      return '<tr>'
        + '<td style="padding:.35rem .5rem;font-size:.73rem;color:var(--text3,#6e7681);font-weight:600;white-space:nowrap;border-bottom:1px solid var(--border,#30363d)">' + c[0] + '</td>'
        + '<td style="padding:.35rem .6rem;font-size:.79rem;color:var(--text,#e6edf3);border-bottom:1px solid var(--border,#30363d)"><span style="' + sty + '">' + (va ? _esc(va) : empty) + '</span></td>'
        + '<td style="padding:.35rem .6rem;font-size:.79rem;color:var(--text,#e6edf3);border-bottom:1px solid var(--border,#30363d)"><span style="' + sty + '">' + (vb ? _esc(vb) : empty) + '</span></td>'
        + '</tr>';
    }).join('');

    var criA = (a.criado || '').substring(0, 10) || '—';
    var criB = (b.criado || '').substring(0, 10) || '—';

    corpo.innerHTML = ''
      // Cabeçalho do par
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.4rem">'
      + '<div style="font-size:.73rem;color:var(--text3,#6e7681)">Par <strong style="color:var(--text,#e6edf3)">' + (indice + 1) + '</strong> de <strong style="color:var(--text,#e6edf3)">' + total + '</strong></div>'
      + '<div style="font-size:.73rem;background:rgba(240,165,0,.12);color:var(--accent,#f0a500);border-radius:4px;padding:.15rem .55rem;font-weight:600">⚡ ' + _esc(par.criterio) + '</div>'
      + '</div>'
      // Tabela comparativa
      + '<div style="overflow-x:auto;border:1px solid var(--border,#30363d);border-radius:8px;margin-bottom:1rem">'
      + '<table style="width:100%;border-collapse:collapse">'
      + '<thead><tr>'
      + '<th style="padding:.4rem .5rem;font-size:.72rem;color:var(--text3,#6e7681);text-align:left;background:var(--bg3,#21262d);border-bottom:1px solid var(--border,#30363d);width:20%">Campo</th>'
      + '<th style="padding:.4rem .6rem;font-size:.72rem;color:var(--blue,#58a6ff);text-align:left;background:var(--bg3,#21262d);border-bottom:1px solid var(--border,#30363d)">🔵 Registro A</th>'
      + '<th style="padding:.4rem .6rem;font-size:.72rem;color:var(--purple,#bc8cff);text-align:left;background:var(--bg3,#21262d);border-bottom:1px solid var(--border,#30363d)">🟣 Registro B</th>'
      + '</tr></thead>'
      + '<tbody>' + linhas + '</tbody>'
      + '<tfoot><tr>'
      + '<td style="padding:.3rem .5rem;font-size:.7rem;color:var(--text3,#6e7681)">Criado</td>'
      + '<td style="padding:.3rem .6rem;font-size:.7rem;color:var(--text3,#6e7681)">' + criA + '</td>'
      + '<td style="padding:.3rem .6rem;font-size:.7rem;color:var(--text3,#6e7681)">' + criB + '</td>'
      + '</tr></tfoot>'
      + '</table>'
      + '</div>'
      // Formulário de edição (oculto inicialmente)
      + '<div id="dedup-edit-wrap" style="display:none;border:1px solid var(--border,#30363d);'
      + 'border-radius:8px;padding:.9rem;margin-bottom:.85rem;background:var(--bg3,#21262d)">'
      + '<div style="font-size:.73rem;font-weight:700;color:var(--accent,#f0a500);margin-bottom:.65rem">✏️ Editar dados finais (campos do Registro A preenchidos com dados faltantes de B)</div>'
      + _renderEditForm(tipo, a, b)
      + '</div>'
      // Barra de ações
      + '<div style="display:flex;flex-wrap:wrap;gap:.45rem;justify-content:flex-end;'
      + 'border-top:1px solid var(--border,#30363d);padding-top:.85rem">'
      + '<button onclick="window._dedupPular()" title="Ignorar este par e ir para o próximo" style="'
      + 'background:transparent;color:var(--text2,#8b949e);border:1px solid var(--border,#30363d);'
      + 'border-radius:6px;padding:.4rem .85rem;font-size:.77rem;cursor:pointer">Pular →</button>'
      + '<button onclick="window._dedupManter(\'b\')" style="'
      + 'background:rgba(188,140,255,.1);color:var(--purple,#bc8cff);border:1px solid rgba(188,140,255,.3);'
      + 'border-radius:6px;padding:.4rem .85rem;font-size:.77rem;font-weight:700;cursor:pointer">🟣 Manter B</button>'
      + '<button onclick="window._dedupManter(\'a\')" style="'
      + 'background:rgba(88,166,255,.1);color:var(--blue,#58a6ff);border:1px solid rgba(88,166,255,.3);'
      + 'border-radius:6px;padding:.4rem .85rem;font-size:.77rem;font-weight:700;cursor:pointer">🔵 Manter A</button>'
      + '<button id="btn-dedup-editar" onclick="window._dedupToggleEdit()" style="'
      + 'background:rgba(240,165,0,.1);color:var(--accent,#f0a500);border:1px solid rgba(240,165,0,.3);'
      + 'border-radius:6px;padding:.4rem .85rem;font-size:.77rem;font-weight:700;cursor:pointer">✏️ Editar e Mesclar</button>'
      + '<button id="btn-dedup-confirmar" onclick="window._dedupConfirmar()" style="'
      + 'display:none;background:var(--green,#3fb950);color:#000;border:none;'
      + 'border-radius:6px;padding:.4rem 1.1rem;font-size:.77rem;font-weight:700;cursor:pointer">✅ Confirmar e Salvar</button>'
      + '</div>';
  };

  // ── Formulário de edição pré-preenchido ───────────────────

  function _renderEditForm(tipo, a, b) {
    // Campos mesclados: A tem prioridade, B preenche campos vazios
    var m = {
      nome:         a.nome         || b.nome         || '',
      cnpj:         a.cnpj         || b.cnpj         || '',
      cidade:       a.cidade       || b.cidade       || '',
      empresa:      a.empresa      || b.empresa      || '',
      email:        a.email        || b.email        || '',
      telefone:     a.telefone     || b.telefone     || '',
      departamento: a.departamento || b.departamento || ''
    };
    var inp = 'width:100%;background:var(--bg2,#161b22);border:1px solid var(--border,#30363d);'
      + 'border-radius:5px;padding:.35rem .6rem;font-size:.8rem;color:var(--text,#e6edf3);'
      + 'margin-bottom:.5rem;box-sizing:border-box';
    var lbl = 'font-size:.7rem;color:var(--text2,#8b949e);display:block;margin-bottom:.15rem';

    var html = '<input id="dedup-e-id-a" type="hidden" value="' + _esc(a.id) + '">'
             + '<input id="dedup-e-id-b" type="hidden" value="' + _esc(b.id) + '">'
             + '<label style="' + lbl + '">Nome *</label>'
             + '<input id="dedup-e-nome" style="' + inp + '" value="' + _esc(m.nome) + '" placeholder="Nome">';

    if (tipo === 'cliente') {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">'
            + '<div><label style="' + lbl + '">CNPJ</label>'
            + '<input id="dedup-e-cnpj" style="' + inp + '" value="' + _esc(m.cnpj) + '" placeholder="CNPJ"></div>'
            + '<div><label style="' + lbl + '">Cidade</label>'
            + '<input id="dedup-e-cidade" style="' + inp + '" value="' + _esc(m.cidade) + '" placeholder="Cidade"></div>'
            + '</div>';
    } else {
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">'
            + '<div><label style="' + lbl + '">E-mail</label>'
            + '<input id="dedup-e-email" style="' + inp + '" value="' + _esc(m.email) + '" placeholder="E-mail"></div>'
            + '<div><label style="' + lbl + '">Telefone</label>'
            + '<input id="dedup-e-telefone" style="' + inp + '" value="' + _esc(m.telefone) + '" placeholder="Telefone"></div>'
            + '</div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">'
            + '<div><label style="' + lbl + '">Empresa</label>'
            + '<input id="dedup-e-empresa" style="' + inp + '" value="' + _esc(m.empresa) + '" placeholder="Empresa vinculada"></div>'
            + '<div><label style="' + lbl + '">Departamento</label>'
            + '<input id="dedup-e-depto" style="' + inp + '" value="' + _esc(m.departamento) + '" placeholder="Departamento"></div>'
            + '</div>';
    }
    return html;
  }

  function _coletarDadosForm(tipo) {
    function v(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
    var d = { nome: v('dedup-e-nome') };
    if (tipo === 'cliente') {
      d.cnpj   = v('dedup-e-cnpj');
      d.cidade = v('dedup-e-cidade');
    } else {
      d.email        = v('dedup-e-email');
      d.telefone     = v('dedup-e-telefone');
      d.empresa      = v('dedup-e-empresa');
      d.departamento = v('dedup-e-depto');
    }
    return d;
  }

  // ── Ações do modal ────────────────────────────────────────

  window._dedupToggleEdit = function () {
    var wrap    = document.getElementById('dedup-edit-wrap');
    var btnConf = document.getElementById('btn-dedup-confirmar');
    var btnEdit = document.getElementById('btn-dedup-editar');
    if (!wrap) return;
    var aberto = wrap.style.display !== 'none';
    wrap.style.display   = aberto ? 'none' : 'block';
    if (btnConf) btnConf.style.display = aberto ? 'none' : 'inline-block';
    if (btnEdit) btnEdit.textContent   = aberto ? '✏️ Editar e Mesclar' : '✕ Cancelar edição';
    if (!aberto) {
      var el = document.getElementById('dedup-e-nome');
      if (el) { el.focus(); }
    }
  };

  window._dedupPular = function () {
    _state.indice++;
    _renderEstado();
  };

  window._dedupManter = function (qual) {
    var par  = _state.pares[_state.indice];
    if (!par) return;
    var tipo = _state.tipo;
    var idPrincipal  = qual === 'a' ? par.a.id : par.b.id;
    var idSecundario = qual === 'a' ? par.b.id : par.a.id;
    var regPrincipal = qual === 'a' ? par.a : par.b;
    var letra = qual === 'a' ? 'A (🔵)' : 'B (🟣)';

    if (!confirm(
      'Manter Registro ' + letra + ': "' + (regPrincipal.nome || '') + '"\n'
      + 'e remover o outro permanentemente?\n\n'
      + 'Um snapshot de segurança será criado antes de salvar.'
    )) return;

    var ok = window.aplicarMergeDuplicado(tipo, idPrincipal, idSecundario, regPrincipal);
    if (ok) {
      _toast('✅ Registro ' + letra + ' mantido. Duplicado removido.', 'ok');
      _rerenderLista(tipo);
      _state.indice++;
      _renderEstado();
    } else {
      _toast('❌ Erro ao salvar. Verifique o console.', 'erro');
    }
  };

  window._dedupConfirmar = function () {
    var par  = _state.pares[_state.indice];
    if (!par) return;
    var tipo = _state.tipo;

    var dados = _coletarDadosForm(tipo);
    if (!dados.nome) { alert('O campo Nome é obrigatório.'); document.getElementById('dedup-e-nome') && document.getElementById('dedup-e-nome').focus(); return; }

    var idA = (document.getElementById('dedup-e-id-a') || {}).value;
    var idB = (document.getElementById('dedup-e-id-b') || {}).value;
    if (!idA || !idB) { alert('IDs não encontrados. Feche e tente novamente.'); return; }

    if (!confirm(
      'Confirmar mesclagem?\n\n'
      + '🔵 A: "' + (par.a.nome || '') + '"\n'
      + '🟣 B: "' + (par.b.nome || '') + '"\n'
      + '→ Resultado: "' + dados.nome + '"\n\n'
      + 'O Registro B será removido. Um snapshot será criado antes.'
    )) return;

    var ok = window.aplicarMergeDuplicado(tipo, idA, idB, dados);
    if (ok) {
      _toast('✅ Registros mesclados com sucesso.', 'ok');
      _rerenderLista(tipo);
      _state.indice++;
      _renderEstado();
    } else {
      _toast('❌ Erro ao salvar. Verifique o console.', 'erro');
    }
  };

  function _rerenderLista(tipo) {
    if (tipo === 'cliente' && typeof window.renderTabelaClientes === 'function') {
      try { window.renderTabelaClientes(); } catch (e) {}
    }
    if (tipo === 'contato' && typeof window.renderTabelaContatos === 'function') {
      try { window.renderTabelaContatos(); } catch (e) {}
    }
  }

  console.log('%c[relacionamento-duplicados] carregado', 'color:#f0a500;font-weight:700');

})();

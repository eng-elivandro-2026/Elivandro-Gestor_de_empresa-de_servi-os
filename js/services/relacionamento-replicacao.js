// ============================================================
// relacionamento-replicacao.js — Replicação de Empresas e
// Contatos entre empresas do portfólio
//
// EXCLUSIVO: nascimento.gaube@gmail.com
//
// Regras:
//  - Botão visível somente para o usuário autorizado
//  - Validação de auth no clique (não só na renderização)
//  - Nunca replicar automaticamente — exige confirmação
//  - Não sobrescreve item existente sem confirmação explícita
//  - Dedup: CNPJ/Nome (empresa) ou E-mail/Tel (contato)
//  - Snapshot antes de cada replicação no destino
//  - Log circular (100 entradas) em tf_rep_log
//  - Respeita DataGuard (dgAntesDeSalvar)
//  - Nunca usa chave global (sempre chave por empresa_id)
//  - Wraps renderTabelaClientes/Contatos — não modifica cadastro.js
// ============================================================

(function () {
  'use strict';

  var EMAIL_AUTORIZADO = 'nascimento.gaube@gmail.com';

  // ── Cache de autorização ────────────────────────────────────
  // _podeReplicar: false por padrão (fail-closed)
  // Re-verificado no clique — não confia só no cache
  window._podeReplicar = false;

  function _checkAuth(cb) {
    if (!window.sbClient) { window._podeReplicar = false; cb(false); return; }
    window.sbClient.auth.getUser().then(function (r) {
      var ok = !!(r && r.data && r.data.user && r.data.user.email === EMAIL_AUTORIZADO);
      window._podeReplicar = ok;
      cb(ok);
    }).catch(function () { window._podeReplicar = false; cb(false); });
  }

  window.podeReplicarRelacionamento = function (cb) { _checkAuth(cb || function () {}); };

  // ── Helpers ─────────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _normCnpj(s) { return String(s || '').replace(/\D/g, ''); }
  function _normTel(s)   { return String(s || '').replace(/\D/g, ''); }
  function _gerarId()    { return 'rep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5); }

  // ── Read/Write para qualquer empresa (não só a ativa) ───────
  // Chave: tf_clientes_<eid> ou tf_contatos_<eid> (mesmo padrão do cadastro.js)
  function _loadParaEmpresa(tipo, eid) {
    var chave = (tipo === 'cliente' ? 'tf_clientes_' : 'tf_contatos_') + eid;
    try { return JSON.parse(localStorage.getItem(chave) || '[]'); } catch (e) { return []; }
  }

  function _saveParaEmpresa(tipo, eid, list) {
    var chave = (tipo === 'cliente' ? 'tf_clientes_' : 'tf_contatos_') + eid;
    // DataGuard: garante proteção mesmo para keys fora da empresa ativa
    if (typeof window.dgAntesDeSalvar === 'function') {
      var dg = window.dgAntesDeSalvar(chave, list, 'replicacao:' + tipo);
      if (!dg.ok) {
        console.warn('[Replicacao] DataGuard bloqueou save para chave:', chave);
        return false;
      }
    }
    try { localStorage.setItem(chave, JSON.stringify(list)); } catch (e) { return false; }
    // Supabase sync
    if (window.sbClient) {
      window.sbClient.from('configuracoes').upsert(
        { chave: chave, valor: list, updated_at: new Date().toISOString(), empresa_id: eid },
        { onConflict: 'chave,empresa_id' }
      ).then(function (r) { if (r.error) console.warn('[Replicacao] Supabase error:', r.error); });
    }
    return true;
  }

  // ── API pública: listar destinos ────────────────────────────
  window.listarEmpresasDestino = function () {
    var atualId = typeof window.getEmpresaAtivaId === 'function' ? window.getEmpresaAtivaId() : null;
    return (window._empresasUsuario || []).filter(function (e) { return e.id !== atualId; });
  };

  // ── API pública: verificar duplicado no destino ─────────────
  // Nota: verifica apenas localStorage local. Se o destino nunca foi
  // visitado nesta sessão, o dedup é best-effort (dados Supabase não carregados).
  window.verificarDuplicadoNoDestino = function (tipo, item, destEid) {
    var destList = _loadParaEmpresa(tipo, destEid);
    if (tipo === 'cliente') {
      var cnpj  = _normCnpj(item.cnpj || '');
      var nNorm = (item.nome || '').toLowerCase().trim();
      for (var i = 0; i < destList.length; i++) {
        var d = destList[i];
        if (cnpj.length >= 11 && _normCnpj(d.cnpj || '') === cnpj)
          return { temDuplicado: true, criterio: 'CNPJ igual', duplicado: d };
        if (nNorm && (d.nome || '').toLowerCase().trim() === nNorm)
          return { temDuplicado: true, criterio: 'Nome igual', duplicado: d };
      }
    } else {
      var email = (item.email || '').toLowerCase().trim();
      var tel   = _normTel(item.telefone || '');
      for (var j = 0; j < destList.length; j++) {
        var ct = destList[j];
        if (email && (ct.email || '').toLowerCase().trim() === email)
          return { temDuplicado: true, criterio: 'E-mail igual', duplicado: ct };
        if (tel.length >= 8 && _normTel(ct.telefone || '') === tel)
          return { temDuplicado: true, criterio: 'Telefone igual', duplicado: ct };
      }
    }
    return { temDuplicado: false };
  };

  // ── API pública: snapshot antes de replicar ─────────────────
  window.criarSnapshotReplicacao = function (tipo, eid) {
    var lista   = _loadParaEmpresa(tipo, eid);
    var prefix  = 'tf_rep_snap_' + tipo + '_' + eid + '_';
    var snapKey = prefix + Date.now();
    try {
      localStorage.setItem(snapKey, JSON.stringify({ ts: new Date().toISOString(), lista: lista }));
      // Manter últimos 3 snapshots por chave
      var keys = Object.keys(localStorage)
        .filter(function (k) { return k.indexOf(prefix) === 0; }).sort();
      while (keys.length > 3) localStorage.removeItem(keys.shift());
    } catch (e) { console.warn('[Replicacao] snapshot error:', e); }
    return snapKey;
  };

  // ── API pública: log de replicação ──────────────────────────
  window.registrarLogReplicacao = function (tipo, origem, destinos) {
    var LOG_KEY = 'tf_rep_log';
    try {
      var log = [];
      try { log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch (e) {}
      log.unshift({
        ts:       new Date().toISOString(),
        tipo:     tipo,
        usuario:  EMAIL_AUTORIZADO,
        origem:   { id: origem.id, nome: origem.nome },
        destinos: destinos.map(function (d) {
          return { empresaId: d.empresaId || d.id, nome: d.nome, ok: d.ok, motivo: d.motivo || '' };
        })
      });
      if (log.length > 100) log = log.slice(0, 100);
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch (e) {}
  };

  // ── API pública: replicar empresa ───────────────────────────
  window.replicarEmpresaParaDestinos = function (idOrigem, destinos) {
    var all  = typeof window.cliGetAll === 'function' ? window.cliGetAll() : [];
    var item = all.find(function (x) { return x.id === idOrigem; });
    if (!item) { console.error('[Replicacao] empresa origem não encontrada:', idOrigem); return []; }

    var resultados = [];
    destinos.forEach(function (dest) {
      var dedup = window.verificarDuplicadoNoDestino('cliente', item, dest.id);
      if (dedup.temDuplicado && !dest.forcar) {
        resultados.push({ id: dest.id, nome: dest.nome, ok: false, motivo: 'Duplicado: ' + dedup.criterio });
        return;
      }
      window.criarSnapshotReplicacao('cliente', dest.id);
      var destList = _loadParaEmpresa('cliente', dest.id);
      var novo = Object.assign({}, item, {
        id:                      _gerarId(),
        _replicado_de_empresa_id: item.id,
        _replicado_em:           new Date().toISOString(),
        _replicado_por:          EMAIL_AUTORIZADO
      });
      destList.push(novo);
      var ok = _saveParaEmpresa('cliente', dest.id, destList);
      resultados.push({ id: dest.id, nome: dest.nome, ok: ok, motivo: ok ? '' : 'Erro ao salvar (DataGuard ou storage)' });
    });

    window.registrarLogReplicacao('cliente', item, resultados);
    return resultados;
  };

  // ── API pública: replicar contato ───────────────────────────
  window.replicarContatoParaDestinos = function (idOrigem, destinos) {
    var all  = typeof window.ctsGetAll === 'function' ? window.ctsGetAll() : [];
    var item = all.find(function (x) { return x.id === idOrigem; });
    if (!item) { console.error('[Replicacao] contato origem não encontrado:', idOrigem); return []; }

    var resultados = [];
    destinos.forEach(function (dest) {
      var dedup = window.verificarDuplicadoNoDestino('contato', item, dest.id);
      if (dedup.temDuplicado && !dest.forcar) {
        resultados.push({ id: dest.id, nome: dest.nome, ok: false, motivo: 'Duplicado: ' + dedup.criterio });
        return;
      }
      window.criarSnapshotReplicacao('contato', dest.id);
      var destList = _loadParaEmpresa('contato', dest.id);
      var novo = Object.assign({}, item, {
        id:                       _gerarId(),
        empresa:                  dest.empresaDestinoNome || item.empresa,
        empresa_cliente_id:       dest.empresaDestinoId   || null,
        _replicado_de_contato_id: item.id,
        _replicado_em:            new Date().toISOString(),
        _replicado_por:           EMAIL_AUTORIZADO
      });
      destList.push(novo);
      var ok = _saveParaEmpresa('contato', dest.id, destList);
      resultados.push({ id: dest.id, nome: dest.nome, ok: ok, motivo: ok ? '' : 'Erro ao salvar (DataGuard ou storage)' });
    });

    window.registrarLogReplicacao('contato', item, resultados);
    return resultados;
  };

  // ── Estado interno do modal ─────────────────────────────────
  var _rst = { tipo: null, itemId: null, item: null };

  // ── Criar modal lazily ───────────────────────────────────────
  function _ensureModal() {
    if (document.getElementById('m-replika')) return;

    var html = '<div id="m-replika" style="display:none;position:fixed;inset:0;'
      + 'z-index:99992;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,.88);padding:1rem">'

      + '<div style="background:#1e2535;border:1px solid #7c3aed;border-radius:10px;'
      + 'width:min(600px,98vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column">'

      // Header
      + '<div style="display:flex;align-items:center;justify-content:space-between;'
      + 'padding:.85rem 1rem;border-bottom:1px solid #334155;'
      + 'position:sticky;top:0;background:#1e2535;z-index:2;border-radius:10px 10px 0 0">'
      + '<div id="m-replika-titulo" style="font-size:.88rem;font-weight:700;color:#a78bfa">🔁 Replicar</div>'
      + '<button onclick="_fecharModalReplika()" style="background:none;border:none;'
      + 'color:#94a3b8;cursor:pointer;font-size:1rem;padding:.2rem .4rem">✕</button>'
      + '</div>'

      // Corpo
      + '<div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem">'

      // Origem
      + '<div style="font-size:.72rem;font-weight:700;color:#a78bfa;'
      + 'text-transform:uppercase;letter-spacing:.06em;padding-bottom:.3rem;border-bottom:1px solid #334155">'
      + '📋 Item Origem</div>'
      + '<div id="m-replika-origem" style="background:#0f172a;border:1px solid #334155;'
      + 'border-radius:6px;padding:.75rem"></div>'

      // Destinos
      + '<div style="font-size:.72rem;font-weight:700;color:#a78bfa;'
      + 'text-transform:uppercase;letter-spacing:.06em;padding-bottom:.3rem;border-bottom:1px solid #334155">'
      + '🏢 Empresas Destino</div>'
      + '<div style="font-size:.73rem;color:#94a3b8;margin-top:-.35rem">'
      + 'Selecione onde replicar. Duplicados são detectados automaticamente.</div>'
      + '<div id="m-replika-destinos" style="display:flex;flex-direction:column;gap:.6rem"></div>'

      // Resultado (oculto até execução)
      + '<div id="m-replika-resultado" style="display:none"></div>'

      + '</div>' // fim corpo

      // Footer
      + '<div style="display:flex;gap:.5rem;justify-content:flex-end;'
      + 'padding:.75rem 1rem;border-top:1px solid #334155;'
      + 'position:sticky;bottom:0;background:#1e2535;border-radius:0 0 10px 10px">'
      + '<button onclick="_fecharModalReplika()" style="padding:.38rem 1rem;'
      + 'background:#1e2535;border:1px solid #334155;color:#94a3b8;border-radius:6px;'
      + 'cursor:pointer;font-size:.82rem">Cancelar</button>'
      + '<button id="m-replika-btn-confirmar" onclick="confirmarReplicacao()" '
      + 'style="padding:.38rem 1rem;background:#7c3aed;border:none;color:#fff;border-radius:6px;'
      + 'cursor:pointer;font-size:.82rem;font-weight:700">🔁 Confirmar Replicação</button>'
      + '</div>'

      + '</div></div>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstElementChild);
  }

  // ── Renderizar conteúdo do modal ────────────────────────────
  function _renderModal() {
    var tipo    = _rst.tipo;
    var item    = _rst.item;
    var destinos = window.listarEmpresasDestino();

    // Título
    var titEl = document.getElementById('m-replika-titulo');
    if (titEl) titEl.textContent = '🔁 Replicar ' + (tipo === 'cliente' ? 'Empresa' : 'Contato');

    // Card de origem
    var origEl = document.getElementById('m-replika-origem');
    if (origEl) {
      if (tipo === 'cliente') {
        origEl.innerHTML = '<div style="font-size:.82rem;font-weight:700;color:#e2e8f0">'
          + esc(item.apelido || item.nome) + '</div>'
          + (item.apelido
            ? '<div style="font-size:.72rem;color:#94a3b8;margin-top:.1rem">' + esc(item.nome) + '</div>'
            : '')
          + '<div style="font-size:.7rem;color:#94a3b8;margin-top:.2rem">'
          + [item.cnpj, item.cidade, item.estado].filter(Boolean).map(esc).join(' · ')
          + '</div>';
      } else {
        origEl.innerHTML = '<div style="font-size:.82rem;font-weight:700;color:#e2e8f0">'
          + esc(item.nome) + '</div>'
          + '<div style="font-size:.7rem;color:#94a3b8;margin-top:.2rem">'
          + [item.empresa, item.email, item.telefone].filter(Boolean).map(esc).join(' · ')
          + '</div>';
      }
    }

    // Lista de destinos
    var destEl = document.getElementById('m-replika-destinos');
    if (destEl) {
      if (!destinos.length) {
        destEl.innerHTML = '<div style="font-size:.78rem;color:#94a3b8;text-align:center;padding:.75rem">'
          + 'Nenhuma outra empresa disponível no seu portfólio.</div>';
      } else {
        var INP = 'width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;'
          + 'border-radius:4px;padding:.3rem .5rem;font-size:.78rem;margin-top:.2rem;box-sizing:border-box';
        var LBL = 'font-size:.6rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em';

        destEl.innerHTML = destinos.map(function (emp) {
          var dedup = window.verificarDuplicadoNoDestino(tipo, item, emp.id);
          var label = emp.nome_curto || emp.nome;

          // Aviso de duplicado
          var dedupHtml = '';
          if (dedup.temDuplicado) {
            dedupHtml = '<div style="background:#450a0a;border:1px solid #7f1d1d;border-radius:4px;'
              + 'padding:.35rem .6rem;font-size:.72rem;color:#fca5a5;margin-top:.35rem">'
              + '⚠️ ' + esc(dedup.criterio) + ': <strong>' + esc(dedup.duplicado.nome) + '</strong>'
              + '<label style="display:flex;align-items:center;gap:.4rem;margin-top:.3rem;cursor:pointer">'
              + '<input type="checkbox" data-forcar="' + esc(emp.id) + '" style="cursor:pointer">'
              + ' Forçar replicação mesmo assim'
              + '</label></div>';
          }

          // Selecionar empresa vinculada no destino (só para contatos)
          var empresaDestinoHtml = '';
          if (tipo === 'contato') {
            var destClientes = _loadParaEmpresa('cliente', emp.id);
            var opts = '<option value="">— manter texto livre (sem vínculo) —</option>'
              + destClientes.map(function (e) {
                  var eLabel = e.apelido ? e.apelido + ' — ' + e.nome : e.nome;
                  return '<option value="' + esc(e.id) + '" data-nome="'
                    + esc(e.apelido || e.nome) + '">' + esc(eLabel) + '</option>';
                }).join('');
            empresaDestinoHtml = '<div style="margin-top:.4rem">'
              + '<label style="' + LBL + '">Empresa vinculada no destino (opcional)</label>'
              + '<select data-emp-destino-empresa="' + esc(emp.id) + '" style="' + INP + '">'
              + opts + '</select></div>';
          }

          return '<div style="background:#0f172a;border:1px solid #334155;'
            + 'border-radius:6px;padding:.6rem .75rem">'
            + '<label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">'
            + '<input type="checkbox" data-dest-id="' + esc(emp.id) + '" '
            + 'data-dest-nome="' + esc(label) + '"'
            + (dedup.temDuplicado ? ' disabled' : '')
            + ' style="cursor:pointer;flex-shrink:0">'
            + '<span style="font-weight:600;font-size:.82rem;color:#e2e8f0">' + esc(label) + '</span>'
            + (emp.nome_curto && emp.nome !== emp.nome_curto
              ? '<span style="font-size:.7rem;color:#94a3b8"> — ' + esc(emp.nome) + '</span>'
              : '')
            + '</label>'
            + dedupHtml
            + empresaDestinoHtml
            + '</div>';
        }).join('');

        // Wiring: checkbox "Forçar" habilita e marca o checkbox principal
        destEl.querySelectorAll('input[data-forcar]').forEach(function (fc) {
          fc.addEventListener('change', function () {
            var destId = fc.getAttribute('data-forcar');
            var mainCb = destEl.querySelector('input[data-dest-id="' + destId + '"]');
            if (mainCb) {
              mainCb.disabled = !fc.checked;
              if (fc.checked) mainCb.checked = true;
              else mainCb.checked = false;
            }
          });
        });
      }
    }

    // Resetar resultado e botão
    var res = document.getElementById('m-replika-resultado');
    if (res) { res.style.display = 'none'; res.innerHTML = ''; }
    var btn = document.getElementById('m-replika-btn-confirmar');
    if (btn) btn.style.display = '';
  }

  // ── Injetar botões 🔁 nas tabelas já renderizadas ───────────
  function _injetarBotoesReplica(tipo) {
    if (!window._podeReplicar) return;
    var prefix = tipo === 'cliente' ? 'editarCliente' : 'editarContato';
    document.querySelectorAll('button.nb').forEach(function (btn) {
      var oc = btn.getAttribute('onclick') || '';
      if (oc.indexOf(prefix + '(') < 0) return;
      var m = oc.match(/'([^']+)'/);
      if (!m) return;
      var id = m[1];
      var td = btn.parentElement;
      if (!td || td.querySelector('[data-rep-id]')) return; // já injetado
      var rb = document.createElement('button');
      rb.className = 'nb';
      rb.setAttribute('data-rep-id', id);
      rb.style.cssText = 'font-size:.72rem;color:#a78bfa';
      rb.title = 'Replicar para outra empresa';
      rb.textContent = '🔁';
      rb.setAttribute('onclick', 'abrirModalReplicarRelacionamento(\''
        + tipo + '\',\'' + id + '\')');
      td.appendChild(rb);
    });
  }

  // ── Abrir modal ─────────────────────────────────────────────
  window.abrirModalReplicarRelacionamento = function (tipo, id) {
    // Sempre re-verifica auth no clique
    _checkAuth(function (ok) {
      if (!ok) { alert('⛔ Acesso não autorizado para esta função.'); return; }

      var all = tipo === 'cliente'
        ? (typeof window.cliGetAll === 'function' ? window.cliGetAll() : [])
        : (typeof window.ctsGetAll === 'function' ? window.ctsGetAll() : []);
      var item = all.find(function (x) { return x.id === id; });
      if (!item) { alert('Item não encontrado.'); return; }

      _rst.tipo   = tipo;
      _rst.itemId = id;
      _rst.item   = item;

      _ensureModal();
      _renderModal();

      var m = document.getElementById('m-replika');
      if (m) { m.style.display = 'flex'; m.scrollTop = 0; }
    });
  };

  // ── Fechar modal ─────────────────────────────────────────────
  window._fecharModalReplika = function () {
    var m = document.getElementById('m-replika');
    if (m) m.style.display = 'none';
    _rst.tipo = null; _rst.itemId = null; _rst.item = null;
  };

  // ── Confirmar replicação ─────────────────────────────────────
  window.confirmarReplicacao = function () {
    // Re-verifica auth no momento da execução
    _checkAuth(function (ok) {
      if (!ok) { alert('⛔ Acesso não autorizado.'); return; }

      var destEl = document.getElementById('m-replika-destinos');
      if (!destEl) return;

      var checks = destEl.querySelectorAll('input[data-dest-id]:checked');
      if (!checks.length) { alert('Selecione pelo menos uma empresa destino.'); return; }

      var destinos = [];
      for (var i = 0; i < checks.length; i++) {
        var cb    = checks[i];
        var destId   = cb.getAttribute('data-dest-id');
        var destNome = cb.getAttribute('data-dest-nome');
        var forcar   = !!(destEl.querySelector('input[data-forcar="' + destId + '"]:checked'));
        var dest = { id: destId, nome: destNome, forcar: forcar };

        if (_rst.tipo === 'contato') {
          var sel = destEl.querySelector('select[data-emp-destino-empresa="' + destId + '"]');
          if (sel && sel.value) {
            var opt = sel.options[sel.selectedIndex];
            dest.empresaDestinoId   = sel.value;
            dest.empresaDestinoNome = opt.getAttribute('data-nome') || opt.text;
          }
        }
        destinos.push(dest);
      }

      var resultados = _rst.tipo === 'cliente'
        ? window.replicarEmpresaParaDestinos(_rst.itemId, destinos)
        : window.replicarContatoParaDestinos(_rst.itemId, destinos);

      _exibirResultado(resultados);
    });
  };

  function _exibirResultado(resultados) {
    var res = document.getElementById('m-replika-resultado');
    var btn = document.getElementById('m-replika-btn-confirmar');
    if (!res) return;

    var okCount = resultados.filter(function (r) { return r.ok; }).length;

    res.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:.75rem">'
      + '<div style="font-size:.78rem;font-weight:700;color:#e2e8f0;margin-bottom:.5rem">Resultado da Replicação</div>'
      + resultados.map(function (r) {
          return '<div style="display:flex;align-items:baseline;gap:.5rem;font-size:.76rem;'
            + 'padding:.2rem 0;color:' + (r.ok ? '#86efac' : '#fca5a5') + '">'
            + (r.ok ? '✅' : '❌') + ' <strong>' + esc(r.nome) + '</strong>'
            + (r.motivo ? '<span style="color:#94a3b8"> — ' + esc(r.motivo) + '</span>' : '')
            + '</div>';
        }).join('')
      + (okCount > 0
        ? '<div style="font-size:.72rem;color:#94a3b8;margin-top:.5rem">'
          + okCount + ' replicaç' + (okCount === 1 ? 'ão' : 'ões')
          + ' concluída' + (okCount === 1 ? '' : 's') + ' e salva' + (okCount === 1 ? '' : 's')
          + ' no destino.</div>'
        : '')
      + '</div>';

    res.style.display = '';
    if (btn) btn.style.display = 'none';
  }

  // ── Wrappers: injetar 🔁 após cada render ───────────────────
  // Aguarda renderTabelaClientes/Contatos estarem disponíveis
  function _wrapRenderFunctions() {
    var origCli = window.renderTabelaClientes;
    var origCts = window.renderTabelaContatos;

    if (typeof origCli === 'function') {
      window.renderTabelaClientes = function () {
        origCli();
        if (window._podeReplicar) _injetarBotoesReplica('cliente');
      };
    }
    if (typeof origCts === 'function') {
      window.renderTabelaContatos = function () {
        origCts();
        if (window._podeReplicar) _injetarBotoesReplica('contato');
      };
    }
  }

  // ── Inicialização ────────────────────────────────────────────
  // Verifica auth e, se autorizado:
  //   - wrapa as funções de render
  //   - injeta botões nas tabelas já renderizadas (se visíveis)
  _checkAuth(function (ok) {
    if (!ok) return;
    _wrapRenderFunctions();
    // Tentativa de injeção tardia (tabelas já podem estar renderizadas)
    setTimeout(function () {
      _injetarBotoesReplica('cliente');
      _injetarBotoesReplica('contato');
    }, 1500);
  });

})();

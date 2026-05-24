// ============================================================
// relacionamento-cofre.js — Cofre de Cadastros
//
// EXCLUSIVO: nascimento.gaube@gmail.com
//
// Regras:
//  - Não apaga nenhum dado
//  - Não limpa localStorage
//  - Não roda recovery automático
//  - Snapshot local antes de qualquer escrita no Supabase
//  - Merge aditivo: nunca reduz lista sem confirmação
//  - Audit log circular (100 entradas) por empresa
//  - Preserva registros com id válido mesmo sem nome
//  - Botões visíveis somente para o e-mail autorizado
//  - Respeita multiempresa (usa empresa_id da empresa ativa)
// ============================================================

(function (window) {
  'use strict';

  var EMAIL_AUTORIZADO = 'nascimento.gaube@gmail.com';
  var _autorizado      = false; // fail-closed

  // ── Auth ──────────────────────────────────────────────────
  function _checkAuth(cb) {
    if (!window.sbClient) { cb(false); return; }
    window.sbClient.auth.getUser().then(function (r) {
      var ok = !!(r && r.data && r.data.user && r.data.user.email === EMAIL_AUTORIZADO);
      _autorizado = ok;
      cb(ok);
    }).catch(function () { _autorizado = false; cb(false); });
  }

  // ── Empresa ativa ─────────────────────────────────────────
  function _getEid() {
    if (typeof window.getEmpresaAtivaId === 'function') {
      var id = window.getEmpresaAtivaId();
      if (id) return id;
    }
    if (typeof window.getEmpresaAtiva === 'function') {
      var obj = window.getEmpresaAtiva();
      if (obj && obj.id) return obj.id;
    }
    try {
      var s = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
      if (s && s.id) return s.id;
    } catch (e) {}
    return null;
  }

  function _getEnome() {
    if (typeof window.getEmpresaAtiva === 'function') {
      var obj = window.getEmpresaAtiva();
      if (obj) return obj.nome_curto || obj.nome || obj.razaoSocial || '(empresa)';
    }
    try {
      var s = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
      if (s) return s.nome_curto || s.nome || s.razaoSocial || '(empresa)';
    } catch (e) {}
    return '(empresa desconhecida)';
  }

  // ── Helpers localStorage ──────────────────────────────────
  function _lsRead(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function _lsWrite(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Chaves multiempresa ───────────────────────────────────
  function _keyCli(eid) { return 'tf_clientes_' + eid; }
  function _keyCts(eid) { return 'tf_contatos_'  + eid; }
  function _keyAudit(eid) { return 'tf_relacionamento_audit_' + eid; }

  // ── Audit log circular (100 entradas) ─────────────────────
  var AUDIT_MAX = 100;

  function _registrarAudit(eid, entry) {
    try {
      var key = _keyAudit(eid);
      var log = [];
      try { log = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
      if (!Array.isArray(log)) log = [];
      log.unshift(Object.assign({ ts: new Date().toISOString(), user: EMAIL_AUTORIZADO }, entry));
      if (log.length > AUDIT_MAX) log = log.slice(0, AUDIT_MAX);
      localStorage.setItem(key, JSON.stringify(log));
    } catch (e) {}
  }

  // ── Snapshot manual ───────────────────────────────────────
  // Preserva o estado exato da lista no momento do backup.
  // Nunca apaga o snapshot existente — sempre cria uma nova chave com timestamp.
  function _criarSnapshot(tipo, eid, lista) {
    var ts  = Date.now();
    var key = 'tf_' + tipo + '_backup_manual_' + eid + '_' + ts;
    try {
      localStorage.setItem(key, JSON.stringify(lista));
      return key;
    } catch (e) {
      return null;
    }
  }

  // ── Supabase: ler lista ───────────────────────────────────
  // Retorna Promise<Array|null>. null = indisponível.
  function _sbLer(tipo, eid) {
    var chave = 'tf_' + tipo + '_' + eid;
    if (!window.sbClient) return Promise.resolve(null);
    return window.sbClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .eq('empresa_id', eid)
      .maybeSingle()
      .then(function (r) {
        if (r.error || !r.data) return null;
        return Array.isArray(r.data.valor) ? r.data.valor : null;
      })
      .catch(function () { return null; });
  }

  // ── Supabase: gravar com merge aditivo ────────────────────
  // Lê remoto, une com local (preserva ambos), grava resultado.
  // Nunca reduz a lista — itens só entram, nunca saem.
  function _sbGravarMerge(tipo, eid, listaLocal) {
    var chave = 'tf_' + tipo + '_' + eid;
    if (!window.sbClient) return Promise.resolve({ ok: false, erro: 'sbClient não disponível' });

    return _sbLer(tipo, eid).then(function (sbLista) {
      // Merge: começa com local, adiciona do remoto o que não está no local
      var merged  = listaLocal.slice();
      var idsLocal = {};
      listaLocal.forEach(function (x) { if (x.id) idsLocal[x.id] = true; });
      if (sbLista && sbLista.length) {
        sbLista.forEach(function (x) {
          if (x.id && !idsLocal[x.id]) merged.push(x);
        });
      }
      var payload = {
        chave:      chave,
        valor:      merged,
        updated_at: new Date().toISOString(),
        empresa_id: eid
      };
      return window.sbClient
        .from('configuracoes')
        .upsert(payload, { onConflict: 'chave,empresa_id' })
        .then(function (r) {
          if (r.error) return { ok: false, erro: r.error.message || String(r.error) };
          return { ok: true, merged: merged };
        });
    }).catch(function (e) {
      return { ok: false, erro: e.message || String(e) };
    });
  }

  // ── Comparar listas local × remota ───────────────────────
  function _comparar(local, remota) {
    var idsLocal  = local.filter(function (x) { return x.id; }).map(function (x) { return x.id; });
    var idsRemota = remota
      ? remota.filter(function (x) { return x.id; }).map(function (x) { return x.id; })
      : null;
    var soLocal  = idsRemota ? idsLocal.filter(function (id) { return idsRemota.indexOf(id) < 0; }) : [];
    var soRemota = idsRemota ? idsRemota.filter(function (id) { return idsLocal.indexOf(id) < 0; }) : [];
    return {
      qtLocal:  local.length,
      qtRemota: remota ? remota.length : null,
      soLocal:  soLocal,
      soRemota: soRemota,
      diverge:  soLocal.length > 0 || soRemota.length > 0
    };
  }

  // ── Painel flutuante ──────────────────────────────────────
  var PANEL_ID = 'cofre-panel';

  function _renderPanel(innerHtml) {
    var existing = document.getElementById(PANEL_ID);
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = PANEL_ID;
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;'
      + 'background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;'
      + 'justify-content:center;padding:1rem';

    // Fechar ao clicar no overlay (mas não no conteúdo)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    overlay.innerHTML = '<div style="background:var(--bg2,#1e2433);border:1px solid var(--border,#2e3650);'
      + 'border-radius:12px;max-width:700px;width:100%;max-height:88vh;overflow-y:auto;'
      + 'padding:1.4rem 1.5rem;box-shadow:0 8px 40px rgba(0,0,0,.4)">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">'
      + '<div style="font-size:1rem;font-weight:800;color:var(--blue,#0ea5e9)">🛡️ Cofre de Cadastros</div>'
      + '<button class="nb" onclick="document.getElementById(\'' + PANEL_ID + '\').remove()" '
      + 'style="font-size:1.4rem;color:var(--text3,#6b7280);line-height:1;padding:.1rem .45rem;'
      + 'border-radius:4px">×</button>'
      + '</div>'
      + innerHtml
      + '</div>';

    document.body.appendChild(overlay);
  }

  // ── salvarBackupSeguro ────────────────────────────────────
  window.salvarBackupSeguro = function () {
    _checkAuth(function (ok) {
      if (!ok) {
        _renderPanel('<div style="color:#ef4444;font-size:.83rem;padding:.5rem 0">❌ Acesso não autorizado.</div>');
        return;
      }
      var eid   = _getEid();
      var enome = _getEnome();
      if (!eid) {
        _renderPanel('<div style="color:#ef4444;font-size:.83rem;padding:.5rem 0">❌ Empresa ativa não encontrada.</div>');
        return;
      }

      var keyCli   = _keyCli(eid);
      var keyCts   = _keyCts(eid);
      var cliLocal = _lsRead(keyCli);
      var ctsLocal = _lsRead(keyCts);

      _renderPanel('<div style="text-align:center;padding:1.8rem 0;color:var(--text3,#6b7280);font-size:.82rem">'
        + '⏳ Criando snapshots e verificando Supabase…</div>');

      // 1. Snapshots locais imediatos (antes de qualquer operação remota)
      var snapCli = _criarSnapshot('clientes', eid, cliLocal);
      var snapCts = _criarSnapshot('contatos', eid, ctsLocal);

      // 2. Ler Supabase para comparação
      Promise.all([_sbLer('clientes', eid), _sbLer('contatos', eid)]).then(function (res) {
        var sbCli  = res[0];
        var sbCts  = res[1];
        var cmpCli = _comparar(cliLocal, sbCli);
        var cmpCts = _comparar(ctsLocal, sbCts);

        // 3. Registrar no audit
        _registrarAudit(eid, {
          acao:         'backup_manual',
          empresa:      enome,
          qt_cli_local: cliLocal.length,
          qt_cts_local: ctsLocal.length,
          qt_cli_sb:    sbCli ? sbCli.length : null,
          qt_cts_sb:    sbCts ? sbCts.length : null,
          snap_cli:     snapCli,
          snap_cts:     snapCts,
          divergencia:  cmpCli.diverge || cmpCts.diverge
        });

        _renderPanel(_renderRelatorioBackup({
          eid: eid, enome: enome,
          cliLocal: cliLocal, ctsLocal: ctsLocal,
          sbCli: sbCli, sbCts: sbCts,
          cmpCli: cmpCli, cmpCts: cmpCts,
          snapCli: snapCli, snapCts: snapCts
        }));
      });
    });
  };

  function _renderRelatorioBackup(d) {
    var diverg = d.cmpCli.diverge || d.cmpCts.diverge;
    var sbOk   = d.sbCli !== null || d.sbCts !== null;
    var html   = '';

    // Empresa
    html += '<div style="background:var(--bg3,#151929);border:1px solid var(--border,#2e3650);'
          + 'border-radius:6px;padding:.45rem .75rem;margin-bottom:.65rem;font-size:.75rem;'
          + 'color:var(--text2,#94a3b8)">'
          + '🏢 <strong>' + _esc(d.enome) + '</strong>'
          + ' <span style="font-size:.67rem;opacity:.7">· ' + _esc(d.eid) + '</span></div>';

    // Snapshots
    html += '<div style="background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.28);'
          + 'border-radius:6px;padding:.5rem .75rem;margin-bottom:.6rem">'
          + '<div style="font-weight:700;color:#22c55e;font-size:.8rem;margin-bottom:.28rem">✅ Snapshots locais criados</div>'
          + '<div style="font-size:.7rem;color:var(--text2,#94a3b8)">'
          + (d.snapCli
              ? '🏢 <code style="font-size:.63rem">' + _esc(d.snapCli) + '</code><br>'
              : '⚠️ Empresas: falha ao criar snapshot<br>')
          + (d.snapCts
              ? '👤 <code style="font-size:.63rem">' + _esc(d.snapCts) + '</code>'
              : '⚠️ Contatos: falha ao criar snapshot')
          + '</div></div>';

    // Contagens
    html += '<div style="background:var(--bg3,#151929);border:1px solid var(--border,#2e3650);'
          + 'border-radius:6px;padding:.5rem .75rem;margin-bottom:.6rem">'
          + '<div style="font-size:.77rem;font-weight:700;color:var(--text,#e2e8f0);margin-bottom:.3rem">📊 Contagem de registros</div>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.3rem .6rem;font-size:.74rem;color:var(--text2,#94a3b8)">'
          + '<div>🏢 Empresas — local: <strong>' + d.cliLocal.length + '</strong></div>'
          + '<div>🏢 Empresas — Supabase: <strong>' + (d.sbCli !== null ? d.sbCli.length : '—') + '</strong></div>'
          + '<div>👤 Contatos — local: <strong>' + d.ctsLocal.length + '</strong></div>'
          + '<div>👤 Contatos — Supabase: <strong>' + (d.sbCts !== null ? d.sbCts.length : '—') + '</strong></div>'
          + '</div></div>';

    // Divergência
    if (diverg) {
      var dHtml = '';
      if (d.cmpCli.diverge) dHtml += '🏢 Empresas: ' + d.cmpCli.soLocal.length + ' só local · ' + d.cmpCli.soRemota.length + ' só remoto<br>';
      if (d.cmpCts.diverge) dHtml += '👤 Contatos: ' + d.cmpCts.soLocal.length + ' só local · ' + d.cmpCts.soRemota.length + ' só remoto<br>';
      html += '<div style="background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.28);'
            + 'border-radius:6px;padding:.5rem .75rem;margin-bottom:.6rem">'
            + '<div style="font-weight:700;color:#f59e0b;font-size:.78rem;margin-bottom:.28rem">⚠️ Divergência detectada</div>'
            + '<div style="font-size:.72rem;color:var(--text2,#94a3b8)">' + dHtml
            + 'Dados não mesclados automaticamente. Use o botão abaixo para sincronizar com segurança.</div>'
            + '<div style="margin-top:.45rem">'
            + '<button class="nb" onclick="window._cofreSincronizar()" '
            + 'style="background:#f59e0b;color:#000;border-radius:5px;padding:.32rem .75rem;font-size:.74rem;font-weight:700">'
            + '🔄 Sincronizar (merge seguro)</button></div></div>';
    } else if (sbOk) {
      html += '<div style="background:rgba(34,197,94,.05);border:1px solid rgba(34,197,94,.2);'
            + 'border-radius:6px;padding:.45rem .75rem;margin-bottom:.6rem;font-size:.74rem;color:#22c55e">'
            + '✅ Local e Supabase sincronizados.</div>';
    }

    // Supabase indisponível
    if (!sbOk) {
      html += '<div style="background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.22);'
            + 'border-radius:6px;padding:.45rem .75rem;margin-bottom:.6rem;font-size:.74rem;color:#ef4444">'
            + '⚠️ Supabase indisponível — snapshot local criado. Sincronize quando a conexão voltar.</div>';
    }

    // Botões de ação
    html += '<div style="margin-top:.55rem;display:flex;align-items:center;flex-wrap:wrap;gap:.45rem">'
          + '<button class="nb" onclick="window.diagnosticoRelacionamento()" '
          + 'style="background:var(--bg3,#151929);color:var(--text,#e2e8f0);border:1px solid var(--border,#2e3650);'
          + 'border-radius:5px;padding:.35rem .8rem;font-size:.75rem;font-weight:600">📋 Ver Diagnóstico</button>';

    if (!diverg && sbOk) {
      html += '<button class="nb" onclick="window._cofreSincronizar()" '
            + 'style="background:var(--bg3,#151929);color:var(--text,#e2e8f0);border:1px solid var(--border,#2e3650);'
            + 'border-radius:5px;padding:.35rem .8rem;font-size:.75rem;font-weight:600">🔄 Forçar sync Supabase</button>';
    }
    html += '</div>';

    // Nota de segurança
    html += '<div style="font-size:.68rem;color:var(--text3,#6b7280);margin-top:.7rem;padding-top:.5rem;'
          + 'border-top:1px solid var(--border,#2e3650)">'
          + '🛡️ Nenhum dado foi apagado. Snapshots preservam o estado exato no momento do backup.</div>';

    return html;
  }

  // ── _cofreSincronizar ─────────────────────────────────────
  // Merge aditivo: local → Supabase, preservando ambos os lados.
  // DataGuard protege antes de qualquer escrita.
  window._cofreSincronizar = function () {
    if (!_autorizado) { alert('Acesso não autorizado.'); return; }
    var eid   = _getEid();
    var enome = _getEnome();
    if (!eid) { alert('Empresa ativa não encontrada.'); return; }

    var keyCli   = _keyCli(eid);
    var keyCts   = _keyCts(eid);
    var cliLocal = _lsRead(keyCli);
    var ctsLocal = _lsRead(keyCts);

    // DataGuard antes de qualquer escrita
    if (typeof window.dgAntesDeSalvar === 'function') {
      window.dgAntesDeSalvar(keyCli, cliLocal, 'sync_supabase');
      window.dgAntesDeSalvar(keyCts, ctsLocal, 'sync_supabase');
    }

    _renderPanel('<div style="text-align:center;padding:1.8rem 0;color:var(--text3,#6b7280);font-size:.82rem">'
      + '⏳ Sincronizando com Supabase…</div>');

    Promise.all([
      _sbGravarMerge('clientes', eid, cliLocal),
      _sbGravarMerge('contatos', eid, ctsLocal)
    ]).then(function (res) {
      var resCli = res[0];
      var resCts = res[1];

      // Se merge trouxe itens extras do remoto → atualizar localStorage
      if (resCli.ok && resCli.merged && resCli.merged.length > cliLocal.length) {
        _lsWrite(keyCli, resCli.merged);
        try { if (typeof window.renderTabelaClientes === 'function') window.renderTabelaClientes(); } catch (e) {}
      }
      if (resCts.ok && resCts.merged && resCts.merged.length > ctsLocal.length) {
        _lsWrite(keyCts, resCts.merged);
        try { if (typeof window.renderTabelaContatos === 'function') window.renderTabelaContatos(); } catch (e) {}
      }

      _registrarAudit(eid, {
        acao:     'sync_supabase',
        empresa:  enome,
        ok_cli:   resCli.ok,
        ok_cts:   resCts.ok,
        erro_cli: resCli.erro || null,
        erro_cts: resCts.erro || null
      });

      // Reabrir painel de backup (agora refletindo estado pós-sync)
      window.salvarBackupSeguro();
    }).catch(function (e) {
      alert('Erro na sincronização: ' + (e.message || String(e)));
    });
  };

  // ── diagnosticoRelacionamento ─────────────────────────────
  window.diagnosticoRelacionamento = function () {
    _checkAuth(function (ok) {
      if (!ok) {
        _renderPanel('<div style="color:#ef4444;font-size:.83rem;padding:.5rem 0">❌ Acesso não autorizado.</div>');
        return;
      }
      var eid   = _getEid();
      var enome = _getEnome();

      _renderPanel('<div style="text-align:center;padding:1.8rem 0;color:var(--text3,#6b7280);font-size:.82rem">'
        + '🔍 Executando diagnóstico completo…</div>');

      if (!eid) {
        _renderPanel('<div style="color:#ef4444;font-size:.83rem;padding:.5rem 0">❌ Empresa ativa não encontrada.</div>');
        return;
      }

      var keyCli   = _keyCli(eid);
      var keyCts   = _keyCts(eid);
      var cliLocal = _lsRead(keyCli);
      var ctsLocal = _lsRead(keyCts);

      // Coletar snapshots disponíveis (manual + DataGuard)
      var snaps = [];
      try {
        for (var k in localStorage) {
          if (k.indexOf('tf_clientes_backup_manual_' + eid) === 0 ||
              k.indexOf('tf_contatos_backup_manual_' + eid) === 0 ||
              k.indexOf('tf_dg_bk_' + keyCli) === 0 ||
              k.indexOf('tf_dg_bk_' + keyCts) === 0) {
            snaps.push(k);
          }
        }
      } catch (e) {}

      // DataGuard log
      var dgLog = [];
      try { dgLog = JSON.parse(localStorage.getItem('tf_dg_log') || '[]'); } catch (e) {}
      if (!Array.isArray(dgLog)) dgLog = [];

      // Audit log cofre
      var auditLog = [];
      try { auditLog = JSON.parse(localStorage.getItem(_keyAudit(eid)) || '[]'); } catch (e) {}
      if (!Array.isArray(auditLog)) auditLog = [];

      // Análise de integridade
      var cliSemNome  = cliLocal.filter(function (x) { return !x.nome; });
      var cliSemId    = cliLocal.filter(function (x) { return !x.id; });
      var ctsSemNome  = ctsLocal.filter(function (x) { return !x.nome; });
      var ctsSemId    = ctsLocal.filter(function (x) { return !x.id; });

      var cliIds    = cliLocal.filter(function (x) { return x.id; }).map(function (x) { return x.id; });
      var cliIdDups = cliIds.filter(function (id, i) { return cliIds.indexOf(id) !== i; });
      var ctsIds    = ctsLocal.filter(function (x) { return x.id; }).map(function (x) { return x.id; });
      var ctsIdDups = ctsIds.filter(function (id, i) { return ctsIds.indexOf(id) !== i; });

      Promise.all([_sbLer('clientes', eid), _sbLer('contatos', eid)]).then(function (res) {
        var sbCli  = res[0];
        var sbCts  = res[1];
        var cmpCli = _comparar(cliLocal, sbCli);
        var cmpCts = _comparar(ctsLocal, sbCts);

        _registrarAudit(eid, {
          acao:         'diagnostico',
          empresa:      enome,
          qt_cli_local: cliLocal.length,
          qt_cts_local: ctsLocal.length,
          qt_cli_sb:    sbCli ? sbCli.length : null,
          qt_cts_sb:    sbCts ? sbCts.length : null
        });

        _renderPanel(_renderDiagnostico({
          eid: eid, enome: enome,
          keyCli: keyCli, keyCts: keyCts,
          cliLocal: cliLocal, ctsLocal: ctsLocal,
          sbCli: sbCli, sbCts: sbCts,
          cmpCli: cmpCli, cmpCts: cmpCts,
          snaps: snaps, dgLog: dgLog, auditLog: auditLog,
          cliSemNome: cliSemNome, cliSemId: cliSemId,
          ctsSemNome: ctsSemNome, ctsSemId: ctsSemId,
          cliIdDups: cliIdDups, ctsIdDups: ctsIdDups
        }));
      });
    });
  };

  function _renderDiagnostico(d) {
    function _sect(titulo, cor, html) {
      return '<div style="background:var(--bg3,#151929);border:1px solid var(--border,#2e3650);'
        + 'border-radius:6px;padding:.48rem .75rem;margin-bottom:.55rem">'
        + '<div style="font-size:.76rem;font-weight:700;color:' + cor + ';margin-bottom:.28rem">' + titulo + '</div>'
        + '<div style="font-size:.72rem;color:var(--text2,#94a3b8);line-height:1.5">' + html + '</div>'
        + '</div>';
    }

    var html = '';

    // Empresa e usuário
    html += _sect('🏢 Empresa e usuário', 'var(--blue,#0ea5e9)',
      'Empresa: <strong>' + _esc(d.enome) + '</strong>'
      + ' · ID: <code style="font-size:.63rem">' + _esc(d.eid) + '</code><br>'
      + 'Usuário: <strong>' + _esc(EMAIL_AUTORIZADO) + '</strong><br>'
      + 'Chave clientes: <code style="font-size:.63rem">' + _esc(d.keyCli) + '</code><br>'
      + 'Chave contatos: <code style="font-size:.63rem">' + _esc(d.keyCts) + '</code>');

    // Contagens
    var sbDisp = d.sbCli !== null || d.sbCts !== null;
    html += _sect('📊 Contagens de registros', '#22c55e',
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.28rem .6rem">'
      + '<div>🏢 Empresas local: <strong>' + d.cliLocal.length + '</strong></div>'
      + '<div>🏢 Empresas Supabase: <strong>' + (d.sbCli !== null ? d.sbCli.length : '—') + '</strong></div>'
      + '<div>👤 Contatos local: <strong>' + d.ctsLocal.length + '</strong></div>'
      + '<div>👤 Contatos Supabase: <strong>' + (d.sbCts !== null ? d.sbCts.length : '—') + '</strong></div>'
      + '</div>'
      + (!sbDisp ? '<br>⚠️ Supabase indisponível' : ''));

    // Divergência
    if (d.cmpCli.diverge || d.cmpCts.diverge) {
      var dHtml = '';
      if (d.cmpCli.diverge) dHtml += '🏢 Empresas: ' + d.cmpCli.soLocal.length + ' só local · ' + d.cmpCli.soRemota.length + ' só remoto<br>';
      if (d.cmpCts.diverge) dHtml += '👤 Contatos: ' + d.cmpCts.soLocal.length + ' só local · ' + d.cmpCts.soRemota.length + ' só remoto<br>';
      html += _sect('⚠️ Divergência local × Supabase', '#f59e0b', dHtml.slice(0, -4));
    }

    // Integridade
    var probHtml = '';
    if (d.cliSemNome.length)  probHtml += '🏢 Empresas sem nome: <strong>' + d.cliSemNome.length + '</strong> (preservadas — id válido)<br>';
    if (d.cliSemId.length)    probHtml += '🏢 Empresas sem id: <strong>' + d.cliSemId.length + '</strong><br>';
    if (d.ctsSemNome.length)  probHtml += '👤 Contatos sem nome: <strong>' + d.ctsSemNome.length + '</strong> (preservados — id válido)<br>';
    if (d.ctsSemId.length)    probHtml += '👤 Contatos sem id: <strong>' + d.ctsSemId.length + '</strong><br>';
    if (d.cliIdDups.length)   probHtml += '⚠️ IDs duplicados empresas: <strong>' + d.cliIdDups.length + '</strong><br>';
    if (d.ctsIdDups.length)   probHtml += '⚠️ IDs duplicados contatos: <strong>' + d.ctsIdDups.length + '</strong><br>';
    var temProb = d.cliSemId.length || d.ctsSemId.length || d.cliIdDups.length || d.ctsIdDups.length;
    if (!probHtml) probHtml = '✅ Nenhum problema detectado';
    html += _sect('🔍 Integridade dos dados', temProb ? '#ef4444' : '#22c55e', probHtml);

    // Snapshots
    var snapsHtml = '';
    if (d.snaps.length) {
      var sorted = d.snaps.slice().sort().reverse();
      snapsHtml = sorted.slice(0, 8).map(function (k) {
        return '<code style="font-size:.62rem;display:block">' + _esc(k) + '</code>';
      }).join('');
      if (sorted.length > 8) snapsHtml += '<span style="color:var(--text3,#6b7280)">…e mais ' + (sorted.length - 8) + '</span>';
    } else {
      snapsHtml = '(nenhum snapshot encontrado)';
    }
    html += _sect('💾 Snapshots disponíveis (' + d.snaps.length + ')', 'var(--blue,#0ea5e9)', snapsHtml);

    // Audit log cofre
    var auditHtml = '';
    if (d.auditLog.length) {
      auditHtml = d.auditLog.slice(0, 5).map(function (e) {
        return '<div style="padding:.22rem 0;border-bottom:1px solid var(--border,#2e3650)">'
          + '<span style="color:#0ea5e9;font-size:.65rem">' + _esc((e.ts || '').slice(0, 19).replace('T', ' ')) + '</span> '
          + '<strong>' + _esc(e.acao || '?') + '</strong>'
          + (e.qt_cli_local != null ? ' · cli:' + e.qt_cli_local : '')
          + (e.qt_cts_local != null ? ' · cts:' + e.qt_cts_local : '')
          + '</div>';
      }).join('');
    } else {
      auditHtml = '(sem entradas)';
    }
    html += _sect('📋 Audit log cofre (últimas 5)', 'var(--text,#e2e8f0)', auditHtml);

    // DataGuard log (filtrado para esta empresa)
    var dgFiltrado = d.dgLog.filter(function (e) {
      return e && (
        String(e.chave || '').indexOf(d.eid) >= 0 ||
        String(e.key   || '').indexOf(d.eid) >= 0
      );
    }).slice(0, 3);
    var dgHtml = dgFiltrado.length
      ? dgFiltrado.map(function (e) {
          return '<div style="font-size:.7rem">'
            + _esc((e.ts || e.timestamp || '').slice(0, 19).replace('T', ' ')) + ' '
            + _esc(e.acao || e.motivo || '?') + ' · '
            + _esc(e.chave || e.key || '?')
            + '</div>';
        }).join('')
      : '(sem entradas DataGuard para esta empresa)';
    html += _sect('🛡️ DataGuard log (últimas 3)', '#f59e0b', dgHtml);

    // Botões
    html += '<div style="margin-top:.65rem;display:flex;align-items:center;flex-wrap:wrap;gap:.4rem">'
          + '<button class="nb" onclick="window.salvarBackupSeguro()" '
          + 'style="background:var(--blue,#0ea5e9);color:#fff;border-radius:5px;padding:.35rem .85rem;font-size:.75rem;font-weight:700">'
          + '🛡️ Salvar Backup Seguro</button>'
          + '<button class="nb" onclick="window._cofreSincronizar()" '
          + 'style="background:var(--bg3,#151929);color:var(--text,#e2e8f0);border:1px solid var(--border,#2e3650);'
          + 'border-radius:5px;padding:.35rem .85rem;font-size:.75rem;font-weight:600">'
          + '🔄 Sincronizar com Supabase</button>'
          + '</div>';

    return html;
  }

  // ── Injetar botões na UI ──────────────────────────────────
  // Chamado após auth confirmada. Usa IDs para evitar duplicação.
  function _injetarBotoes() {
    if (document.getElementById('cofre-btn-cli-bk')) return;

    function _criarBtn(id, label, onClick, titulo) {
      var btn = document.createElement('button');
      btn.id        = id;
      btn.className = 'nb';
      btn.title     = titulo || '';
      btn.textContent = label;
      btn.style.cssText = 'background:rgba(14,165,233,.13);color:#0ea5e9;'
        + 'border:1px solid rgba(14,165,233,.32);border-radius:6px;'
        + 'padding:.38rem .9rem;font-size:.75rem;font-weight:700;white-space:nowrap;cursor:pointer';
      btn.addEventListener('click', onClick);
      return btn;
    }

    // Encontrar o div de botões dentro de uma seção (#hSecClientes / #hSecContatos).
    // Procura o div que contenha <button> como filho direto (não aninhado).
    function _btnDiv(secId) {
      var sec = document.getElementById(secId);
      if (!sec) return null;
      var divs = sec.querySelectorAll('div');
      for (var i = 0; i < divs.length; i++) {
        var children = divs[i].children;
        for (var j = 0; j < children.length; j++) {
          if (children[j].tagName === 'BUTTON') return divs[i];
        }
      }
      return null;
    }

    var divCli = _btnDiv('hSecClientes');
    if (divCli) {
      divCli.appendChild(_criarBtn('cofre-btn-cli-bk', '🛡️ Backup',
        function () { window.salvarBackupSeguro(); }, 'Salvar backup seguro e verificar Supabase'));
      divCli.appendChild(_criarBtn('cofre-btn-cli-dg', '📋 Diagnóstico',
        function () { window.diagnosticoRelacionamento(); }, 'Diagnóstico completo de cadastros'));
    }

    var divCts = _btnDiv('hSecContatos');
    if (divCts) {
      divCts.appendChild(_criarBtn('cofre-btn-cts-bk', '🛡️ Backup',
        function () { window.salvarBackupSeguro(); }, 'Salvar backup seguro e verificar Supabase'));
      divCts.appendChild(_criarBtn('cofre-btn-cts-dg', '📋 Diagnóstico',
        function () { window.diagnosticoRelacionamento(); }, 'Diagnóstico completo de cadastros'));
    }

    console.info('[Cofre] Botões injetados para', EMAIL_AUTORIZADO);
  }

  // ── Inicialização ─────────────────────────────────────────
  function _init() {
    _checkAuth(function (ok) {
      if (!ok) {
        console.info('[Cofre] Não autorizado — botões não injetados.');
        return;
      }

      // Injetar com delay para garantir que o DOM do módulo esteja pronto
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(_injetarBotoes, 700);
      } else {
        document.addEventListener('DOMContentLoaded', function () {
          setTimeout(_injetarBotoes, 700);
        });
      }

      // Re-injetar quando seção for exibida (hShowSec pode remover display:none)
      // Usa MutationObserver nas seções para detectar quando ficam visíveis
      function _observarSec(id) {
        var sec = document.getElementById(id);
        if (!sec) return;
        var obs = new MutationObserver(function () {
          // Só age se a seção ficou visível e os botões ainda não estão lá
          if (sec.style.display !== 'none' && !document.getElementById('cofre-btn-cli-bk')) {
            setTimeout(_injetarBotoes, 150);
          }
        });
        obs.observe(sec, { attributes: true, attributeFilter: ['style'] });
      }
      _observarSec('hSecClientes');
      _observarSec('hSecContatos');
    });
  }

  _init();

  console.info('[RelacionamentoCofre] Carregado. '
    + 'salvarBackupSeguro() | diagnosticoRelacionamento() | _cofreSincronizar()');

}(window));

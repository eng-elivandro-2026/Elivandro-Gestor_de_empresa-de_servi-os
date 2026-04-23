// ============================================================
// supabase-sync.js — Sincronização localStorage ↔ Supabase
// Sincroniza: propostas + metas/configurações
// ============================================================

(function () {
  function waitForClient(cb, tries) {
    tries = tries || 0;
    if (window.sbClient) return cb();
    if (tries > 50) return console.warn('[supabase-sync] sbClient não encontrado.');
    setTimeout(function () { waitForClient(cb, tries + 1); }, 100);
  }

  function LS(k, v) {
    if (v === undefined) {
      try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
    } else {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    }
  }

  // ── Converter proposta para linha do Supabase ─────────────
  function propToRow(p) {
    var empId = (typeof getEmpresaAtivaId === 'function')
      ? getEmpresaAtivaId()
      : (window._empresaAtiva ? window._empresaAtiva.id : null);

    if (!empId) {
      console.error('[supabase-sync] propToRow chamado sem empresa ativa. Operação bloqueada.');
      return null;
    }

    return {
      app_id:          String(p.id || ''),
      numero_proposta: String(p.num || ''),
      titulo:          String(p.tit || ''),
      cliente:         String(p.cli || p.loc || ''),
      valor_total:     parseFloat(p.val) || 0,
      fase:            String(p.fas || 'em_elaboracao'),
      dados_json:      p,
      empresa_id:      empId,
      updated_at:      new Date().toISOString()
    };
  }

  // ════════════════════════════════════════════════════════
  // PROPOSTAS
  // ════════════════════════════════════════════════════════

  window.sbMigrarLocal = async function () {
    var empId = (typeof getEmpresaAtivaId === 'function')
      ? getEmpresaAtivaId()
      : (window._empresaAtiva ? window._empresaAtiva.id : null);
    if (!empId) {
      console.error('[supabase-sync] sbMigrarLocal bloqueado: nenhuma empresa ativa.');
      return { total: 0, erros: 0 };
    }

    var props = LS('tf_props') || [];
    if (!props.length) { console.log('[supabase-sync] Nenhuma proposta no localStorage.'); return; }
    var LOTE = 10, total = 0, erros = 0;
    for (var i = 0; i < props.length; i += LOTE) {
      var rows = props.slice(i, i + LOTE).map(propToRow).filter(Boolean);
      if (!rows.length) continue;
      var res = await window.sbClient
        .from('propostas')
        .upsert(rows, { onConflict: 'app_id', ignoreDuplicates: false });
      if (res.error) { erros += rows.length; console.error('Erro lote:', res.error.message); }
      else total += rows.length;
    }
    console.log('%c' + total + ' proposta(s) salva(s) na nuvem', 'color:green;font-weight:700');
    if (erros) console.warn(erros + ' proposta(s) com erro.');
    return { total, erros };
  };

  window.sbSalvarProposta = async function (p) {
    if (!window.sbClient || !p) return;
    var row = propToRow(p);
    if (!row) return; // empresa_id ausente — bloqueado em propToRow
    var res = await window.sbClient
      .from('propostas')
      .upsert(row, { onConflict: 'app_id', ignoreDuplicates: false });
    if (res.error) console.error('[supabase-sync] Erro ao salvar proposta:', res.error.message);
    return res;
  };

  window.sbCarregarNuvem = async function (empresaId) {
    if (!window.sbClient) return;
    var empId = empresaId
      || (typeof getEmpresaAtivaId === 'function' ? getEmpresaAtivaId() : null)
      || (window._empresaAtiva ? window._empresaAtiva.id : null);

    if (!empId) {
      console.error('[supabase-sync] sbCarregarNuvem bloqueado: nenhuma empresa ativa. Forneça empresaId ou aguarde setEmpresaAtiva().');
      return [];
    }

    var res = await window.sbClient
      .from('propostas')
      .select('dados_json, app_id')
      .eq('empresa_id', empId)
      .order('updated_at', { ascending: false });
    if (res.error) { console.error('[supabase-sync] Erro ao carregar propostas:', res.error.message); return; }
    var props = (res.data || []).map(function (r) {
      var p = r.dados_json || {};
      if (!p.id && r.app_id) p.id = r.app_id;
      return p;
    });
    if (props.length) {
      LS('tf_props', props);
      // Migrar para stages v1 (idempotente — skipa propostas já migradas)
      if(typeof migrarTodasPropostas==='function'){
        var _mc=migrarTodasPropostas(props);
        if(_mc>0) LS('tf_props',props);
      }

      // ── Backfill dtFech para propostas fechadas sem data de fechamento ──
      // Garante que receita é contada no ano do FECHAMENTO, não da criação.
      // Propostas atualizadas são enviadas de volta ao Supabase em background,
      // cobrindo todos os usuários e todas as empresas.
      var _FAS_FECH = ['aprovado','andamento','faturado','recebido','taf','sat','finalizado','atrasado'];
      var _hj = new Date().toISOString().slice(0,10);
      var _dirty = [];
      props.forEach(function(p) {
        if (_FAS_FECH.indexOf(p.fas) < 0) return;
        if (p.dtFech) return;
        if (!p.dat2 && p.dat) {
          var _ps = String(p.dat).split('/');
          if (_ps.length === 3 && _ps[2].length === 4)
            p.dat2 = _ps[2] + '-' + _ps[1] + '-' + _ps[0];
        }
        p.dtFech = p.dat2 || _hj;
        _dirty.push(p);
      });
      if (_dirty.length) {
        LS('tf_props', props);
        // Push de volta ao Supabase em background (não bloqueia o carregamento)
        setTimeout(function() {
          _sbBackfillDtFech(_dirty, empId);
        }, 800);
        console.log('[supabase-sync] dtFech backfill local: ' + _dirty.length + ' proposta(s)');
      }

      console.log('%c' + props.length + ' proposta(s) carregada(s) da nuvem' + (empId ? ' [empresa filtrada]' : ''), 'color:#58a6ff;font-weight:700');
      window.dispatchEvent(new CustomEvent('propostas:loaded', { detail: { props: props } }));
    }
    return props;
  };

  // Envia propostas com dtFech recém-preenchido de volta ao Supabase
  async function _sbBackfillDtFech(dirty, empId) {
    try {
      var LOTE = 10;
      for (var i = 0; i < dirty.length; i += LOTE) {
        var rows = dirty.slice(i, i + LOTE).map(propToRow).filter(Boolean);
        if (!rows.length) continue;
        var r = await window.sbClient.from('propostas')
          .upsert(rows, { onConflict: 'app_id', ignoreDuplicates: false });
        if (r.error) console.warn('[supabase-sync] dtFech backfill lote erro:', r.error.message);
      }
      console.log('%c[supabase-sync] dtFech sincronizado na nuvem — ' + dirty.length + ' proposta(s)', 'color:#22c55e;font-weight:700');
    } catch(e) {
      console.warn('[supabase-sync] dtFech backfill falhou:', e.message);
    }
  }

  // ════════════════════════════════════════════════════════
  // METAS / CONFIGURAÇÕES
  // ════════════════════════════════════════════════════════

  window.sbSalvarMeta = async function (meta) {
    if (!window.sbClient || !meta) return;
    var res = await window.sbClient
      .from('configuracoes')
      .upsert({ chave: 'tf_meta', valor: meta, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
    if (res.error) console.error('[supabase-sync] Erro ao salvar meta:', res.error.message);
    else console.log('%cmeta salva na nuvem', 'color:green');
    return res;
  };

  window.sbCarregarMeta = async function () {
    if (!window.sbClient) return null;
    var res = await window.sbClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'tf_meta')
      .maybeSingle();
    if (res.error) { console.warn('[supabase-sync] Sem metas na nuvem ainda.'); return null; }
    if (res.data && res.data.valor) {
      LS('tf_meta', res.data.valor);
      console.log('%cmeta carregada da nuvem', 'color:#58a6ff');
      return res.data.valor;
    }
    return null;
  };

  // ════════════════════════════════════════════════════════
  // TEMPLATES DE SERVIÇO (tf_svc_templates)
  // ════════════════════════════════════════════════════════

  window.sbSalvarSvcTemplates = async function (tpls) {
    if (!window.sbClient || !tpls) return;
    var res = await window.sbClient
      .from('configuracoes')
      .upsert({ chave: 'tf_svc_templates', valor: tpls, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
    if (res.error) console.error('[supabase-sync] Erro ao salvar templates de serviço:', res.error.message);
    else console.log('%ctemplates de serviço salvos na nuvem (' + tpls.length + ')', 'color:green;font-weight:700');
    return res;
  };

  window.sbCarregarSvcTemplates = async function () {
    if (!window.sbClient) return [];
    var res = await window.sbClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'tf_svc_templates')
      .maybeSingle();
    if (res.error) { console.warn('[supabase-sync] Erro ao carregar templates de serviço:', res.error.message); return []; }
    if (res.data && res.data.valor && res.data.valor.length) {
      try { localStorage.setItem('tf_svc_templates', JSON.stringify(res.data.valor)); } catch(e) {}
      console.log('%ctemplates de serviço carregados da nuvem (' + res.data.valor.length + ')', 'color:#58a6ff;font-weight:700');
      return res.data.valor;
    }
    return [];
  };

  // ════════════════════════════════════════════════════════
  // HISTÓRICO DE RELACIONAMENTO
  // ════════════════════════════════════════════════════════

  window.sbSalvarHistorico = async function (lista) {
    if (!window.sbClient || !lista) return;
    var res = await window.sbClient
      .from('configuracoes')
      .upsert({ chave: 'tf_historico', valor: lista, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
    if (res.error) console.error('[supabase-sync] Erro ao salvar histórico:', res.error.message);
    else console.log('%chistórico salvo na nuvem (' + lista.length + ' registros)', 'color:green');
    return res;
  };

  window.sbCarregarHistorico = async function () {
    if (!window.sbClient) return [];
    var res = await window.sbClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'tf_historico')
      .maybeSingle();
    if (res.error) { console.warn('[supabase-sync] Sem histórico na nuvem ainda.'); return []; }
    if (res.data && res.data.valor) {
      try { localStorage.setItem('tf_historico', JSON.stringify(res.data.valor)); } catch(e) {}
      console.log('%chistórico carregado da nuvem (' + res.data.valor.length + ' registros)', 'color:#58a6ff');
      return res.data.valor;
    }
    return [];
  };

  // ════════════════════════════════════════════════════════
  // E-MAILS DE ALERTA RH (rh_alert_emails)
  // ════════════════════════════════════════════════════════

  window.sbSalvarEmailsAlerta = async function (emails) {
    if (!window.sbClient) return;
    var res = await window.sbClient
      .from('configuracoes')
      .upsert({ chave: 'rh_alert_emails', valor: emails, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
    if (res.error) console.error('[supabase-sync] Erro ao salvar e-mails de alerta:', res.error.message);
    else console.log('%ce-mails de alerta salvos na nuvem (' + emails.length + ')', 'color:green;font-weight:700');
    return res;
  };

  window.sbCarregarEmailsAlerta = async function () {
    if (!window.sbClient) return null;
    var res = await window.sbClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'rh_alert_emails')
      .maybeSingle();
    if (res.error) { console.warn('[supabase-sync] Sem e-mails de alerta na nuvem.'); return null; }
    if (res.data && res.data.valor && res.data.valor.length) {
      try { localStorage.setItem('rh_alert_emails', JSON.stringify(res.data.valor)); } catch(e) {}
      console.log('%ce-mails de alerta carregados da nuvem (' + res.data.valor.length + ')', 'color:#58a6ff;font-weight:700');
      return res.data.valor;
    }
    return null;
  };

  // ════════════════════════════════════════════════════════
  // GESTÃO CEO — DADOS GERAIS COMPARTILHADOS
  // ════════════════════════════════════════════════════════

  window.sbSaveGestaoGeral = function (dados) {
    clearTimeout(window._geralSaveTimer);
    window._geralSaveTimer = setTimeout(async function () {
      if (!window.sbClient || !dados) return;
      await window.sbClient.from('configuracoes').upsert({
        chave: 'tf_planejador_geral',
        valor: dados,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' });
    }, 1500);
  };

  window.sbLoadGestaoGeral = async function () {
    if (!window.sbClient) return null;
    var res = await window.sbClient
      .from('configuracoes')
      .select('valor')
      .eq('chave', 'tf_planejador_geral')
      .maybeSingle();
    if (res.data && res.data.valor) return res.data.valor;
    return null;
  };

  // ════════════════════════════════════════════════════════
  // INICIALIZAÇÃO
  // ════════════════════════════════════════════════════════
  waitForClient(function () {
    console.log('%csupabase-sync.js carregado', 'color:green;font-weight:700');
  });


// ════════════════════════════════════════════════════════
  // BACKUP COMPLETO (propostas + templates + escopos + config)
  // ════════════════════════════════════════════════════════

  window.sbSalvarBackup = async function (backup) {
    if (!window.sbClient || !backup) return;
    // Salvar backup completo
    var res = await window.sbClient
      .from('configuracoes')
      .upsert({
        chave: 'tf_backup',
        valor: backup,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' });
    if (res.error) console.error('[supabase-sync] Erro ao salvar backup:', res.error.message);
    else console.log('%cbackup salvo na nuvem', 'color:green');

    // Salvar também templates e escopos separadamente para carregar mais fácil
    if (backup.templates && backup.templates.length) {
      await window.sbClient.from('configuracoes').upsert({
        chave: 'tf_tpls',
        valor: backup.templates,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' });
    }
    var escoposParaSalvar = backup.escopos;
    if (!escoposParaSalvar || !escoposParaSalvar.length) {
      try { escoposParaSalvar = JSON.parse(localStorage.getItem('tf_bancoEscopos') || '[]'); } catch(e) {}
    }
    if (escoposParaSalvar && escoposParaSalvar.length) {
      await window.sbClient.from('configuracoes').upsert({
        chave: 'tf_etpl',
        valor: escoposParaSalvar,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' });
    }
    if (backup.config) {
      await window.sbClient.from('configuracoes').upsert({
        chave: 'tf_config',
        valor: backup.config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' });
    }
    // Templates de Serviço
    var svcTpls = backup.svcTemplates;
    if (!svcTpls || !svcTpls.length) {
      try { svcTpls = JSON.parse(localStorage.getItem('tf_svc_templates') || '[]'); } catch(e) {}
    }
    if (svcTpls && svcTpls.length) {
      await window.sbClient.from('configuracoes').upsert({
        chave: 'tf_svc_templates',
        valor: svcTpls,
        updated_at: new Date().toISOString()
      }, { onConflict: 'chave' });
    }
    return res;
  };

  window.sbCarregarBackup = async function () {
    if (!window.sbClient) return null;
    // Carregar templates
    var rTpl = await window.sbClient.from('configuracoes').select('valor').eq('chave','tf_tpls').maybeSingle();
    if (rTpl.data && rTpl.data.valor) {
      try { localStorage.setItem('tf_tpls', JSON.stringify(rTpl.data.valor)); } catch(e) {}
      console.log('%ctemplates carregados da nuvem', 'color:#58a6ff');
    }
    // Carregar escopos
    var rEsc = await window.sbClient.from('configuracoes').select('valor').eq('chave','tf_etpl').maybeSingle();
    if (rEsc.data && rEsc.data.valor) {
      try {
        // Normaliza campo: registros antigos usam 'titulo' como grupo, novos usam 'grupo'
        var escoposNorm = (rEsc.data.valor || []).map(function(e) {
          if (!e.grupo && e.titulo) e.grupo = e.titulo;
          return e;
        });
        localStorage.setItem('tf_etpl', JSON.stringify(escoposNorm));
        localStorage.setItem('tf_bancoEscopos', JSON.stringify(escoposNorm));
      } catch(e) {}
      console.log('%cescopos carregados da nuvem', 'color:#58a6ff');
    }
    // Carregar config
    var rCfg = await window.sbClient.from('configuracoes').select('valor').eq('chave','tf_config').maybeSingle();
    if (rCfg.data && rCfg.data.valor) {
      try { localStorage.setItem('tf_prc', JSON.stringify(rCfg.data.valor)); } catch(e) {}
      console.log('%cconfig carregada da nuvem', 'color:#58a6ff');
    }
    // Carregar templates de serviço
    var rSvc = await window.sbClient.from('configuracoes').select('valor').eq('chave','tf_svc_templates').maybeSingle();
    if (rSvc.data && rSvc.data.valor && rSvc.data.valor.length) {
      try { localStorage.setItem('tf_svc_templates', JSON.stringify(rSvc.data.valor)); } catch(e) {}
      console.log('%ctemplates de serviço carregados da nuvem (' + rSvc.data.valor.length + ')', 'color:#58a6ff');
    }
    return true;
  };

})();

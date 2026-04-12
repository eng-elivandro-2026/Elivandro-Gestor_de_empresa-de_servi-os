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
    return {
      app_id:          String(p.id || ''),
      numero_proposta: String(p.num || ''),
      titulo:          String(p.tit || ''),
      cliente:         String(p.cli || p.loc || ''),
      valor_total:     parseFloat(p.val) || 0,
      fase:            String(p.fas || 'em_elaboracao'),
      dados_json:      p,
      updated_at:      new Date().toISOString()
    };
  }

  // ════════════════════════════════════════════════════════
  // PROPOSTAS
  // ════════════════════════════════════════════════════════

  window.sbMigrarLocal = async function () {
    var props = LS('tf_props') || [];
    if (!props.length) { console.log('[supabase-sync] Nenhuma proposta no localStorage.'); return; }
    var LOTE = 10, total = 0, erros = 0;
    for (var i = 0; i < props.length; i += LOTE) {
      var rows = props.slice(i, i + LOTE).map(propToRow);
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
    var res = await window.sbClient
      .from('propostas')
      .upsert(propToRow(p), { onConflict: 'app_id', ignoreDuplicates: false });
    if (res.error) console.error('[supabase-sync] Erro ao salvar proposta:', res.error.message);
    return res;
  };

  window.sbCarregarNuvem = async function () {
    if (!window.sbClient) return;
    var res = await window.sbClient
      .from('propostas')
      .select('dados_json, app_id')
      .order('updated_at', { ascending: false });
    if (res.error) { console.error('[supabase-sync] Erro ao carregar propostas:', res.error.message); return; }
    var props = (res.data || []).map(function (r) {
      var p = r.dados_json || {};
      if (!p.id && r.app_id) p.id = r.app_id;
      return p;
    });
    if (props.length) {
      LS('tf_props', props);
      console.log('%c' + props.length + ' proposta(s) carregada(s) da nuvem', 'color:#58a6ff;font-weight:700');
    }
    return props;
  };

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
      .single();
    if (res.error) { console.warn('[supabase-sync] Sem metas na nuvem ainda.'); return null; }
    if (res.data && res.data.valor) {
      LS('tf_meta', res.data.valor);
      console.log('%cmeta carregada da nuvem', 'color:#58a6ff');
      return res.data.valor;
    }
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
    return res;
  };

  window.sbCarregarBackup = async function () {
    if (!window.sbClient) return null;
    // Carregar templates
    var rTpl = await window.sbClient.from('configuracoes').select('valor').eq('chave','tf_tpls').single();
    if (rTpl.data && rTpl.data.valor) {
      try { localStorage.setItem('tf_tpls', JSON.stringify(rTpl.data.valor)); } catch(e) {}
      console.log('%ctemplates carregados da nuvem', 'color:#58a6ff');
    }
    // Carregar escopos
    var rEsc = await window.sbClient.from('configuracoes').select('valor').eq('chave','tf_etpl').single();
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
    var rCfg = await window.sbClient.from('configuracoes').select('valor').eq('chave','tf_config').single();
    if (rCfg.data && rCfg.data.valor) {
      try { localStorage.setItem('tf_prc', JSON.stringify(rCfg.data.valor)); } catch(e) {}
      console.log('%cconfig carregada da nuvem', 'color:#58a6ff');
    }
    return true;
  };

})();

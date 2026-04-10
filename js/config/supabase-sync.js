// ============================================================
// supabase-sync.js — Sincronização localStorage ↔ Supabase
// Corrigido: usa app_id para ID interno (não é UUID válido)
// O Supabase gera seu próprio UUID automaticamente
// ============================================================

(function () {
  // Aguarda o sbClient estar disponível
  function waitForClient(cb, tries) {
    tries = tries || 0;
    if (window.sbClient) return cb();
    if (tries > 50) return console.warn('[supabase-sync] sbClient não encontrado.');
    setTimeout(function () { waitForClient(cb, tries + 1); }, 100);
  }

  // ── Helpers ──────────────────────────────────────────────
  function LS(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
  }

  function propToRow(p) {
    return {
      app_id:         String(p.id || ''),
      numero_proposta: String(p.num || ''),
      titulo:          String(p.tit || ''),
      cliente:         String(p.cli || p.loc || ''),
      valor_total:     parseFloat(p.val) || 0,
      fase:            String(p.fas || 'em_elaboracao'),
      dados_json:      p,
      updated_at:      new Date().toISOString()
    };
  }

  // ── Migração: salva todas as propostas do localStorage ───
  window.sbMigrarLocal = async function () {
    var props = LS('tf_props') || [];
    if (!props.length) {
      console.log('[supabase-sync] Nenhuma proposta no localStorage.');
      return;
    }

    var LOTE = 10;
    var total = 0;
    var erros = 0;

    for (var i = 0; i < props.length; i += LOTE) {
      var lote = props.slice(i, i + LOTE);
      var rows = lote.map(propToRow);

      // upsert usando app_id como coluna de conflito
      var res = await window.sbClient
        .from('propostas')
        .upsert(rows, { onConflict: 'app_id', ignoreDuplicates: false });

      if (res.error) {
        erros += lote.length;
        console.error('Erro lote:', res.error.message);
      } else {
        total += lote.length;
      }
    }

    console.log('%c' + total + ' proposta(s) salva(s) na nuvem', 'color:green;font-weight:700');
    if (erros) console.warn(erros + ' proposta(s) com erro.');
    return { total, erros };
  };

  // ── Auto-save: salva uma proposta individual ─────────────
  window.sbSalvarProposta = async function (p) {
    if (!window.sbClient || !p) return;
    var row = propToRow(p);
    var res = await window.sbClient
      .from('propostas')
      .upsert(row, { onConflict: 'app_id', ignoreDuplicates: false });
    if (res.error) console.error('[supabase-sync] Erro ao salvar:', res.error.message);
    return res;
  };

  // ── Carregar propostas da nuvem para o localStorage ──────
  window.sbCarregarNuvem = async function () {
    if (!window.sbClient) return;
    var res = await window.sbClient
      .from('propostas')
      .select('dados_json, app_id')
      .order('updated_at', { ascending: false });

    if (res.error) {
      console.error('[supabase-sync] Erro ao carregar:', res.error.message);
      return;
    }

    var props = (res.data || []).map(function (r) {
      var p = r.dados_json || {};
      if (!p.id && r.app_id) p.id = r.app_id;
      return p;
    });

    if (props.length) {
      localStorage.setItem('tf_props', JSON.stringify(props));
      console.log('%c' + props.length + ' proposta(s) carregada(s) da nuvem', 'color:#58a6ff;font-weight:700');
    }
    return props;
  };

  waitForClient(function () {
    console.log('%csupabase-sync.js carregado', 'color:green;font-weight:700');
  });

})();

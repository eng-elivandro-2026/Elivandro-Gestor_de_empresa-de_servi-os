// ============================================================
// js/config/supabase-sync.js
// Sincronização automática localStorage ↔ Supabase
// V473_OFICIAL — adicionar após supabase.js no index.html
// ============================================================

(function() {

  // ── Helpers ────────────────────────────────────────────────
  function getUserId() {
    return window.sbClient.auth.getUser().then(function(r) {
      return r.data && r.data.user ? r.data.user.id : null;
    });
  }

  function propostaParaRow(p, userId) {
    return {
      id:               p.id,
      user_id:          userId,
      numero_proposta:  p.num  || '',
      titulo:           p.tit  || '',
      cliente:          p.cli  || '',
      valor_total:      parseFloat(p.val) || 0,
      fase:             p.fas  || 'em_elaboracao',
      dados_json:       p,
      updated_at:       new Date().toISOString()
    };
  }

  // ── SALVAR uma proposta no Supabase ────────────────────────
  window.sbSalvarProposta = async function(p) {
    try {
      var userId = await getUserId();
      if (!userId) return;
      var row = propostaParaRow(p, userId);
      var res = await window.sbClient
        .from('propostas')
        .upsert(row, { onConflict: 'id' });
      if (res.error) console.error('Erro ao salvar proposta:', res.error.message);
    } catch(e) {
      console.error('sbSalvarProposta:', e);
    }
  };

  // ── SALVAR TODAS as propostas (upsert em lote) ─────────────
  window.sbSalvarTodas = async function(props) {
    try {
      var userId = await getUserId();
      if (!userId || !props || !props.length) return;
      var rows = props.map(function(p) { return propostaParaRow(p, userId); });
      // Salva em lotes de 50
      for (var i = 0; i < rows.length; i += 50) {
        var lote = rows.slice(i, i + 50);
        var res = await window.sbClient
          .from('propostas')
          .upsert(lote, { onConflict: 'id' });
        if (res.error) console.error('Erro lote:', res.error.message);
      }
      console.log('✅ ' + rows.length + ' proposta(s) salva(s) na nuvem');
    } catch(e) {
      console.error('sbSalvarTodas:', e);
    }
  };

  // ── CARREGAR propostas do Supabase ─────────────────────────
  window.sbCarregarPropostas = async function() {
    try {
      var userId = await getUserId();
      if (!userId) return null;
      var res = await window.sbClient
        .from('propostas')
        .select('dados_json')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (res.error) { console.error('Erro ao carregar:', res.error.message); return null; }
      return res.data.map(function(r) { return r.dados_json; });
    } catch(e) {
      console.error('sbCarregarPropostas:', e);
      return null;
    }
  };

  // ── DELETAR uma proposta do Supabase ───────────────────────
  window.sbDeletarProposta = async function(id) {
    try {
      var res = await window.sbClient
        .from('propostas')
        .delete()
        .eq('id', id);
      if (res.error) console.error('Erro ao deletar:', res.error.message);
    } catch(e) {
      console.error('sbDeletarProposta:', e);
    }
  };

  // ── MIGRAR localStorage → Supabase ─────────────────────────
  window.sbMigrarLocal = async function() {
    var local = localStorage.getItem('tf_props');
    if (!local) { alert('Nenhuma proposta no localStorage para migrar.'); return; }
    var props;
    try { props = JSON.parse(local); } catch(e) { alert('Erro ao ler localStorage.'); return; }
    if (!props || !props.length) { alert('localStorage vazio.'); return; }

    if (!confirm('Migrar ' + props.length + ' proposta(s) para a nuvem?\nElas serão salvas no Supabase mantendo os dados locais também.')) return;

    var btn = document.getElementById('btnMigrar');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Migrando...'; }

    await window.sbSalvarTodas(props);

    if (btn) { btn.disabled = false; btn.textContent = '✅ Migrado!'; }
    alert('✅ ' + props.length + ' proposta(s) migrada(s) para a nuvem!');
  };

  // ── INICIALIZAR: carregar da nuvem ao abrir o app ──────────
  window.sbInicializar = async function() {
    try {
      var nuvem = await window.sbCarregarPropostas();
      if (nuvem && nuvem.length > 0) {
        // Mesclar com localStorage (prioridade: nuvem)
        var local = [];
        try { local = JSON.parse(localStorage.getItem('tf_props') || '[]'); } catch(e) {}

        // Criar mapa por id para deduplicar
        var mapa = {};
        local.forEach(function(p) { if(p && p.id) mapa[p.id] = p; });
        nuvem.forEach(function(p)  { if(p && p.id) mapa[p.id] = p; }); // nuvem sobrescreve

        var merged = Object.values(mapa);
        localStorage.setItem('tf_props', JSON.stringify(merged));
        console.log('☁️ ' + nuvem.length + ' proposta(s) carregada(s) da nuvem, ' + merged.length + ' total após merge');
        return merged;
      }
    } catch(e) {
      console.error('sbInicializar:', e);
    }
    return null;
  };

  console.log('✅ supabase-sync.js carregado');

})();

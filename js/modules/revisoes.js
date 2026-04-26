// ═══════════════════════════════════════════════════════════════
// revisoes.js — Controle de Revisões de Propostas
// Prefixo _prv garante zero conflito com funções existentes.
// Carregado após app-core.js — pode usar todas as funções globais.
// ═══════════════════════════════════════════════════════════════

// ── Cache local de histórico (evita chamadas repetidas) ─────────
var _prvCache = {};

// ── Empresa ativa ────────────────────────────────────────────────
function _prvEmpId() {
  return typeof getEmpresaAtivaId === 'function' ? getEmpresaAtivaId()
       : (window._empresaAtiva ? window._empresaAtiva.id : null);
}

// ── Iniciais do usuário logado (para campo "Por" da lista) ───────
function _prvUserInitials() {
  var u = window._usuarioAtivo;
  if (!u) return '?';
  var nome = (u.nome || u.name || u.email || '').trim();
  var parts = nome.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
  return nome.substring(0, 3).toUpperCase() || '?';
}

// ── Sync com p.revs (Lista de Revisões no Step 1 do formulário) ──
function _prvSyncRevsList(p, letter, description) {
  if (!p.revs) p.revs = [];
  var entry = {
    id:   typeof uid === 'function' ? uid() : (Date.now().toString(36)),
    rev:  letter,
    dat:  new Date().toLocaleDateString('pt-BR'),
    por:  _prvUserInitials(),
    desc: description
  };
  p.revs.push(entry);
  // Se a proposta está aberta no editor, sincroniza o array in-memory
  if (typeof editId !== 'undefined' && editId === p.id) {
    if (typeof revs !== 'undefined') revs.push(entry);
    if (typeof rRevs === 'function') rRevs();
  }
}

// ── Snapshot dos dados relevantes da proposta ────────────────────
function _prvSnapshot(p) {
  return JSON.parse(JSON.stringify({
    bi:      p.bi      || [],
    prc:     p.prc     || null,
    aliq:    p.aliq    || null,
    tit:     p.tit     || '',
    cli:     p.cli     || '',
    loc:     p.loc     || '',
    val:     p.val     || 0,
    fas:     p.fas     || 'em_elaboracao',
    obs:     p.obs     || '',
    revs:    p.revs    || [],
    escSecs: p.escSecs || [],
    ts:      p.ts      || [],
    tl:      p.tl      || {},
    dat:     p.dat     || '',
    dat2:    p.dat2    || '',
    dtFech:  p.dtFech  || '',
    num:     p.num     || '',
    revAtual:p.revAtual|| ''
  }));
}

// ── Próxima letra automática ─────────────────────────────────────
function _prvNextLetter(existingRevs) {
  if (!existingRevs || !existingRevs.length) return 'A';
  var maxCode = existingRevs.reduce(function(max, r) {
    var code = (r.revision_letter || 'A').toUpperCase().charCodeAt(0);
    return Math.max(max, isNaN(code) ? 64 : code);
  }, 64);
  return String.fromCharCode(maxCode + 1);
}

// ── Buscar histórico do Supabase (com cache) ─────────────────────
function _prvGetHistory(proposalId, cb) {
  var cache = _prvCache[proposalId];
  if (cache && cache.loaded) { cb(null, cache.revs); return; }
  if (!window.sbClient) { cb('sbClient indisponível', []); return; }
  window.sbClient
    .from('proposal_revisions')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })
    .then(function(result) {
      var revs = result.data || [];
      _prvCache[proposalId] = { loaded: true, revs: revs };
      cb(result.error, revs);
    });
}

// ── Lazy migration: cria revisão-base para propostas antigas ─────
// Chamado automaticamente quando não há registros em proposal_revisions.
function _prvEnsureBase(p, existingRevs, cb) {
  if (existingRevs && existingRevs.length > 0) { cb(null, existingRevs); return; }
  var empId = _prvEmpId();
  if (!empId || !window.sbClient) { cb('sem empresa ou sbClient', existingRevs); return; }
  var letter = ((p.revAtual || '') + '').trim().toUpperCase() || 'A';
  var row = {
    proposal_id:     p.id,
    empresa_id:      empId,
    revision_letter: letter,
    created_by:      (window._usuarioAtivo && window._usuarioAtivo.email) || '',
    description:     'Revisão base (registro inicial automático)',
    value_pv:        parseFloat(p.val) || 0,
    status:          'arquivada',
    cloned_from:     null,
    snapshot:        _prvSnapshot(p)
  };
  window.sbClient.from('proposal_revisions').insert(row).then(function(result) {
    var newRevs = result.error ? existingRevs : [row];
    _prvCache[p.id] = { loaded: true, revs: newRevs };
    cb(result.error, newRevs);
  });
}

// ── Aplicar snapshot a proposta (usado ao clonar revisão antiga) ─
function _prvApplySnapshot(p, snap) {
  if (!snap) return;
  var fields = ['bi','prc','aliq','tit','obs','escSecs','ts','tl','val'];
  fields.forEach(function(f) {
    if (snap[f] !== undefined && snap[f] !== null)
      p[f] = JSON.parse(JSON.stringify(snap[f]));
  });
  if (snap.loc)    p.loc    = snap.loc;
  if (snap.dat)    p.dat    = snap.dat;
  if (snap.dat2)   p.dat2   = snap.dat2;
  if (snap.dtFech) p.dtFech = snap.dtFech;
}

// ═══════════════════════════════════════════════════════════════
// CRIAR NOVA REVISÃO — função principal
// ═══════════════════════════════════════════════════════════════
function _prvCreateRevision(proposalId, cloneFromLetter, description) {
  if (!(description || '').trim()) {
    toast('Informe a descrição das alterações.', 'err'); return;
  }
  var p = props.find(function(x) { return x.id === proposalId; });
  if (!p) { toast('Proposta não encontrada.', 'err'); return; }
  var empId = _prvEmpId();
  if (!empId) { toast('Empresa ativa não identificada.', 'err'); return; }

  _prvGetHistory(proposalId, function(err, revs) {
    _prvEnsureBase(p, revs, function(errBase, freshRevs) {
      // Re-busca histórico se a base foi criada agora
      var doCreate = function(allRevs) {
        var activeRev = allRevs.find(function(r) { return r.status === 'ativa'; });

        // Arquivar revisão ativa atual
        var archiveStep = activeRev
          ? window.sbClient.from('proposal_revisions').update({ status: 'arquivada' }).eq('id', activeRev.id)
          : Promise.resolve({ error: null });

        archiveStep.then(function(archRes) {
          if (archRes && archRes.error) {
            toast('Erro ao arquivar revisão anterior: ' + archRes.error.message, 'err'); return;
          }

          // Snapshot: da revisão escolhida ou do estado atual
          var cloneRev = cloneFromLetter
            ? allRevs.find(function(r) { return r.revision_letter === cloneFromLetter; })
            : null;
          var snapData = (cloneRev && cloneRev.snapshot) ? cloneRev.snapshot : _prvSnapshot(p);

          // Se clonar de revisão diferente da ativa: aplicar snapshot
          var activeLetterNow = activeRev ? activeRev.revision_letter : (p.revAtual || null);
          if (cloneRev && cloneFromLetter !== activeLetterNow) {
            _prvApplySnapshot(p, snapData);
          }

          var newLetter = _prvNextLetter(allRevs);

          var newRow = {
            proposal_id:     proposalId,
            empresa_id:      empId,
            revision_letter: newLetter,
            created_by:      (window._usuarioAtivo && window._usuarioAtivo.email) || '',
            description:     description.trim(),
            value_pv:        parseFloat(p.val) || 0,
            status:          'ativa',
            cloned_from:     cloneFromLetter || null,
            snapshot:        _prvSnapshot(p)
          };

          window.sbClient.from('proposal_revisions').insert(newRow).then(function(res) {
            if (res.error) {
              toast('Erro ao criar revisão: ' + res.error.message, 'err'); return;
            }
            // Invalida cache para buscar novamente
            _prvCache[proposalId] = null;

            // Atualiza campo de letra na proposta
            p.revAtual = newLetter;
            if (editId === proposalId && Q('pRevAtual')) {
              Q('pRevAtual').value = newLetter;
              if (typeof updNumRev === 'function') updNumRev();
            }

            // Sincroniza com LISTA DE REVISÕES do formulário (p.revs)
            _prvSyncRevsList(p, newLetter, description.trim());

            saveAll();
            toast('✔ Rev. ' + newLetter + ' criada!', 'ok');
            _prvCloseModal();
            _prvRefreshCardRevisions(proposalId);
          });
        });
      };

      if (errBase) {
        // Base falhou: usa o que temos
        doCreate(freshRevs);
      } else if (!revs || !revs.length) {
        // Base foi criada: busca novamente
        _prvGetHistory(proposalId, function(e2, latest) { doCreate(latest); });
      } else {
        doCreate(freshRevs);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// MODAL "NOVA REVISÃO"
// ═══════════════════════════════════════════════════════════════
var _prvModalPropId = null;

function _prvOpenModal(proposalId) {
  _prvModalPropId = proposalId;
  var m = Q('prvNewRevModal'); if (!m) return;
  var descEl = Q('prvRevDesc');
  if (descEl) descEl.value = '';
  var nextEl  = Q('prvRevNextLetter');
  var selEl   = Q('prvRevCloneFrom');
  var btnConf = Q('prvRevConfirmBtn');
  if (nextEl)  nextEl.textContent = '…';
  if (selEl)   selEl.innerHTML    = '<option>Carregando…</option>';
  if (btnConf) btnConf.disabled   = true;
  m.style.display = 'flex';

  _prvGetHistory(proposalId, function(err, revs) {
    var p = props.find(function(x) { return x.id === proposalId; });
    var nextLetter = _prvNextLetter(revs);
    if (nextEl) nextEl.textContent = nextLetter;
    if (btnConf) btnConf.disabled = false;

    if (selEl) {
      var opts = '';
      var activeRev = revs.find(function(r) { return r.status === 'ativa'; });
      if (activeRev) {
        opts += '<option value="' + activeRev.revision_letter + '" selected>'
          + 'Rev. ' + activeRev.revision_letter + ' — ' + (activeRev.description||'').substring(0,40) + ' (atual)</option>';
      } else {
        var curLetter = (p && p.revAtual) ? p.revAtual.toUpperCase() : '?';
        opts += '<option value="__current__" selected>Rev. ' + curLetter + ' — estado atual</option>';
      }
      revs.filter(function(r) { return r.status === 'arquivada'; })
          .slice().reverse()
          .forEach(function(r) {
            var d = new Date(r.created_at).toLocaleDateString('pt-BR', {day:'2-digit',month:'2-digit'});
            opts += '<option value="' + r.revision_letter + '">'
              + 'Rev. ' + r.revision_letter + ' — ' + d + ' · ' + (typeof money==='function'?money(r.value_pv):r.value_pv)
              + (r.description ? ' · ' + r.description.substring(0,30) : '') + '</option>';
          });
      selEl.innerHTML = opts;
    }
    if (descEl) setTimeout(function() { descEl.focus(); }, 80);
  });
}

function _prvCloseModal() {
  var m = Q('prvNewRevModal');
  if (m) m.style.display = 'none';
  _prvModalPropId = null;
}

function _prvConfirmModal() {
  var desc      = ((Q('prvRevDesc') && Q('prvRevDesc').value) || '').trim();
  var cloneFrom = (Q('prvRevCloneFrom') && Q('prvRevCloneFrom').value) || null;
  if (cloneFrom === '__current__') cloneFrom = null;
  if (!desc) {
    toast('Informe a descrição das alterações.', 'err');
    if (Q('prvRevDesc')) Q('prvRevDesc').focus();
    return;
  }
  _prvCreateRevision(_prvModalPropId, cloneFrom, desc);
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO DE REVISÕES NO CARD DE PROPOSTAS
// ═══════════════════════════════════════════════════════════════

function _prvPopulateCardRevisions() {
  var els = document.querySelectorAll('.prv-rev-placeholder');
  els.forEach(function(el) {
    var pid = el.getAttribute('data-pid');
    if (!pid) return;
    _prvGetHistory(pid, function(err, revs) {
      _prvRenderCardRevSection(pid, el, revs || []);
    });
  });
}

function _prvRefreshCardRevisions(proposalId) {
  _prvCache[proposalId] = null;
  var el = document.querySelector('.prv-rev-placeholder[data-pid="' + proposalId + '"]');
  if (!el) return;
  _prvGetHistory(proposalId, function(err, revs) {
    _prvRenderCardRevSection(proposalId, el, revs || []);
  });
}

function _prvRenderCardRevSection(proposalId, el, revs) {
  if (!el) return;
  var isOpen = el.getAttribute('data-open') === '1';
  var count  = revs ? revs.length : 0;
  var activeRev = revs ? revs.find(function(r) { return r.status === 'ativa'; }) : null;
  var revLetter = activeRev ? activeRev.revision_letter : '';
  var m = typeof money === 'function' ? money : function(v){ return 'R$'+v; };

  var html = '<div style="border-top:1px solid var(--border)">';

  if (count > 0) {
    // Linha toggle
    html += '<div style="padding:.4rem .9rem;display:flex;align-items:center;justify-content:space-between;'
      + 'cursor:pointer;font-size:.73rem;color:var(--text2);user-select:none" '
      + 'onclick="event.stopPropagation();_prvToggleCardRevs(\'' + proposalId + '\')">'
      + '<span>' + count + ' revisão' + (count !== 1 ? 'ões' : '')
      + (revLetter ? ' &nbsp;<span style="background:#1a3a2a;color:#3fb950;border-radius:3px;'
        + 'padding:.05rem .32rem;font-weight:700;font-size:.67rem">Rev. ' + revLetter + '</span>' : '')
      + '</span><span style="font-size:.65rem">' + (isOpen ? '▲' : '▾') + '</span></div>';

    if (isOpen) {
      html += '<div style="padding:0 .55rem .55rem">';
      revs.slice().reverse().forEach(function(r) {
        var isActive = r.status === 'ativa';
        var d = r.created_at ? new Date(r.created_at).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}) : '—';
        html += '<div style="display:flex;align-items:center;gap:.45rem;padding:.28rem .35rem;border-radius:5px;margin-bottom:.18rem;'
          + (isActive ? 'background:rgba(63,185,80,.08);border:1px solid rgba(63,185,80,.22)' : 'background:var(--bg3)')
          + '">'
          + '<span style="background:' + (isActive ? '#3fb950' : '#555') + ';color:#fff;border-radius:4px;'
          + 'padding:.08rem .38rem;font-weight:700;font-size:.7rem;min-width:18px;text-align:center">'
          + esc(r.revision_letter) + '</span>'
          + '<span style="font-size:.7rem;color:var(--text2);flex:1">'
          + d + ' · ' + m(r.value_pv || 0)
          + (r.description ? ' <span style="color:var(--text3)">— ' + esc((r.description).substring(0,32)) + (r.description.length>32?'…':'') + '</span>' : '')
          + '</span>'
          + '<span style="font-size:.63rem;font-weight:600;color:' + (isActive ? '#3fb950' : 'var(--text3)') + '">'
          + (isActive ? 'Ativa' : 'Arquivada') + '</span>'
          + '</div>';
      });
      html += '<div style="padding:.3rem 0 0;text-align:right">'
        + '<button class="btn bd bsm" onclick="event.stopPropagation();_prvOpenModal(\'' + proposalId + '\')" '
        + 'style="font-size:.71rem">+ Nova Revisão</button></div>';
      html += '</div>';
    }
  } else {
    // Sem revisões: apenas botão
    html += '<div style="padding:.4rem .9rem;display:flex;justify-content:flex-end">'
      + '<button class="btn bd bsm" onclick="event.stopPropagation();_prvOpenModal(\'' + proposalId + '\')" '
      + 'style="font-size:.71rem">+ Nova Revisão</button></div>';
  }

  html += '</div>';
  el.innerHTML = html;
}

function _prvToggleCardRevs(proposalId) {
  var el = document.querySelector('.prv-rev-placeholder[data-pid="' + proposalId + '"]');
  if (!el) return;
  var isOpen = el.getAttribute('data-open') === '1';
  el.setAttribute('data-open', isOpen ? '0' : '1');
  var cached = _prvCache[proposalId];
  if (cached && cached.loaded) {
    _prvRenderCardRevSection(proposalId, el, cached.revs);
  } else {
    _prvGetHistory(proposalId, function(err, revs) {
      _prvRenderCardRevSection(proposalId, el, revs || []);
    });
  }
}

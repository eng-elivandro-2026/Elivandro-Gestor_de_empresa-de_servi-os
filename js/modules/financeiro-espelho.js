// ============================================================
// financeiro-espelho.js — F2E — Espelho Financeiro no Comercial
//
// SOMENTE LEITURA — nunca grava, nunca cria lançamentos.
// Exibe resumo financeiro oficial (contas, NFs, recebimentos)
// no detalhe da proposta comercial.
//
// Vínculo: p.id (Comercial) === proposta_app_id (Financeiro)
// Empresa: respeitada via getEmpresaAtivaId() em toda consulta.
// Race condition: _espelhoToken descarta respostas de empresa anterior.
// ============================================================
(function (window) {
  'use strict';

  var _espelhoToken  = 0;
  var _espelhoAtivo  = null; // proposta_app_id atualmente exibida

  // ── Helpers ───────────────────────────────────────────────
  function _sf()    { return window.sbFinanceiro || null; }
  function _empId() {
    return typeof window.getEmpresaAtivaId === 'function'
      ? window.getEmpresaAtivaId()
      : null;
  }

  function _money(v) {
    var n = parseFloat(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function _dataBR(iso) {
    if (!iso) return '—';
    try {
      var p = iso.split('T')[0].split('-');
      return p[2] + '/' + p[1] + '/' + p[0];
    } catch(e) { return iso; }
  }

  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  var _STATUS_LABEL = {
    previsto:              'Previsto',
    a_faturar:             'A Faturar',
    faturado:              'Faturado',
    parcialmente_recebido: 'Parcial',
    recebido:              'Recebido',
    cancelado:             'Cancelado'
  };

  // ── Referência ao card HTML ───────────────────────────────
  function _card() { return document.getElementById('fin-espelho-card'); }
  function _corpo() { return document.getElementById('fin-espelho-corpo'); }

  // ── Estados visuais ───────────────────────────────────────
  function _mostrarCarregando() {
    var c = _card(); if (!c) return;
    c.style.display = '';
    var cp = _corpo(); if (!cp) return;
    cp.innerHTML =
      '<div style="display:flex;align-items:center;gap:.5rem;padding:.4rem 0;font-size:.78rem;color:var(--text2)">'
      + '<div style="width:16px;height:16px;border:2px solid var(--border);border-top-color:#58a6ff;border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0"></div>'
      + 'Carregando resumo financeiro...</div>';
  }

  function _mostrarVazio() {
    var c = _card(); if (!c) return;
    c.style.display = '';
    var cp = _corpo(); if (!cp) return;
    cp.innerHTML =
      '<div style="font-size:.78rem;color:var(--text3);padding:.25rem 0">'
      + '📭 Sem dados financeiros oficiais vinculados a esta proposta.</div>';
  }

  function _mostrarErro() {
    var c = _card(); if (!c) return;
    c.style.display = '';
    var cp = _corpo(); if (!cp) return;
    cp.innerHTML =
      '<div style="font-size:.75rem;color:var(--text3);font-style:italic;padding:.25rem 0">'
      + '⚠ Não foi possível carregar o resumo financeiro. Verifique o console.</div>';
  }

  function _limpar() {
    var c = _card(); if (!c) return;
    c.style.display = 'none';
    var cp = _corpo(); if (cp) cp.innerHTML = '';
    _espelhoAtivo = null;
  }

  // ── Helpers de renderização ───────────────────────────────
  function _kpiCard(label, valor, color) {
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:.45rem .6rem;min-width:0">'
      + '<div style="font-size:.6rem;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.15rem;white-space:nowrap">' + label + '</div>'
      + '<div style="font-size:.76rem;font-weight:700;word-break:break-word' + (color ? ';color:' + color : '') + '">' + valor + '</div>'
      + '</div>';
  }

  function _badgeSt(st) {
    var label = _STATUS_LABEL[st] || st || '—';
    var color = st === 'recebido' ? 'rgba(63,185,80,.12);color:var(--green)'
              : st === 'cancelado' ? 'rgba(110,118,129,.12);color:var(--text3)'
              : st === 'parcialmente_recebido' ? 'rgba(240,90,26,.12);color:var(--orange)'
              : 'rgba(240,165,0,.1);color:var(--accent)';
    return '<span style="font-size:.65rem;font-weight:700;padding:.1rem .4rem;border-radius:20px;border:1px solid rgba(0,0,0,.08);background:' + color + '">' + label + '</span>';
  }

  function _renderNFs(notas) {
    if (!notas || !notas.length) {
      return '<div style="font-size:.72rem;color:var(--text3);font-style:italic;margin-top:.3rem">Nenhuma nota fiscal emitida.</div>';
    }
    return '<div style="overflow-x:auto;border-radius:5px;border:1px solid var(--border)">'
      + '<table style="width:100%;border-collapse:collapse;font-size:.72rem">'
      + '<thead><tr>'
      + '<th style="text-align:left;padding:.28rem .45rem;background:var(--bg3);border-bottom:1px solid var(--border);font-size:.6rem;color:var(--text3);font-weight:600;white-space:nowrap">Nº NF</th>'
      + '<th style="text-align:left;padding:.28rem .45rem;background:var(--bg3);border-bottom:1px solid var(--border);font-size:.6rem;color:var(--text3);font-weight:600;white-space:nowrap">Emissão</th>'
      + '<th style="text-align:right;padding:.28rem .45rem;background:var(--bg3);border-bottom:1px solid var(--border);font-size:.6rem;color:var(--text3);font-weight:600;white-space:nowrap">Valor</th>'
      + '<th style="text-align:left;padding:.28rem .45rem;background:var(--bg3);border-bottom:1px solid var(--border);font-size:.6rem;color:var(--text3);font-weight:600;white-space:nowrap">Status</th>'
      + '</tr></thead><tbody>'
      + notas.map(function(nf) {
          return '<tr>'
            + '<td style="padding:.28rem .45rem;border-bottom:1px solid var(--border);font-family:monospace;font-weight:600">' + _esc(nf.numero_nf || '—') + '</td>'
            + '<td style="padding:.28rem .45rem;border-bottom:1px solid var(--border);color:var(--text2)">' + _dataBR(nf.data_emissao) + '</td>'
            + '<td style="padding:.28rem .45rem;border-bottom:1px solid var(--border);text-align:right;font-variant-numeric:tabular-nums">' + _money(nf.valor_nf) + '</td>'
            + '<td style="padding:.28rem .45rem;border-bottom:1px solid var(--border);font-size:.68rem;color:var(--text2)">' + _esc(nf.status || '—') + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table></div>';
  }

  function _renderRecebimentos(recs) {
    if (!recs || !recs.length) {
      return '<div style="font-size:.72rem;color:var(--text3);font-style:italic;margin-top:.3rem">Nenhum recebimento registrado.</div>';
    }
    var totalRec = recs.reduce(function(s, r) {
      return r.status !== 'estornado' ? s + (parseFloat(r.valor_recebido) || 0) : s;
    }, 0);
    return '<div style="overflow-x:auto;border-radius:5px;border:1px solid var(--border)">'
      + '<table style="width:100%;border-collapse:collapse;font-size:.72rem">'
      + '<thead><tr>'
      + '<th style="text-align:left;padding:.28rem .45rem;background:var(--bg3);border-bottom:1px solid var(--border);font-size:.6rem;color:var(--text3);font-weight:600;white-space:nowrap">Data</th>'
      + '<th style="text-align:right;padding:.28rem .45rem;background:var(--bg3);border-bottom:1px solid var(--border);font-size:.6rem;color:var(--text3);font-weight:600;white-space:nowrap">Valor Recebido</th>'
      + '<th style="text-align:left;padding:.28rem .45rem;background:var(--bg3);border-bottom:1px solid var(--border);font-size:.6rem;color:var(--text3);font-weight:600;white-space:nowrap">Status</th>'
      + '</tr></thead><tbody>'
      + recs.map(function(r) {
          var rsTag = r.risco_sacado
            ? '<span style="color:var(--red);font-size:.65rem;margin-left:.3rem">⚠ RS</span>'
            : '';
          return '<tr>'
            + '<td style="padding:.28rem .45rem;border-bottom:1px solid var(--border);color:var(--text2)">' + _dataBR(r.data_recebimento) + '</td>'
            + '<td style="padding:.28rem .45rem;border-bottom:1px solid var(--border);text-align:right;font-variant-numeric:tabular-nums;color:var(--green)">' + _money(r.valor_recebido) + '</td>'
            + '<td style="padding:.28rem .45rem;border-bottom:1px solid var(--border);font-size:.68rem;color:var(--text2)">' + _esc(r.status || '—') + rsTag + '</td>'
            + '</tr>';
        }).join('')
      + '</tbody></table>'
      + '<div style="text-align:right;font-size:.72rem;color:var(--green);margin-top:.3rem;font-weight:700">Total confirmado: ' + _money(totalRec) + '</div>'
      + '</div>';
  }

  // ── Renderizar espelho completo ───────────────────────────
  function _renderEspelho(resumo) {
    var cp = _corpo(); if (!cp) return;

    var conta       = resumo.conta;
    var notas       = resumo.notas       || [];
    var recebimentos= resumo.recebimentos|| [];

    var previsto = parseFloat(conta.valor_previsto) || 0;
    var faturado = parseFloat(conta.valor_faturado) || 0;
    var recebido = parseFloat(conta.valor_recebido) || 0;
    var pendente = parseFloat(conta.valor_pendente) || 0;
    var pct      = previsto > 0 ? Math.min(100, Math.round(recebido / previsto * 100)) : 0;
    var barColor = pct >= 100 ? 'var(--green)' : pct > 50 ? 'var(--accent)' : '#58a6ff';

    var totalRS = recebimentos.reduce(function(s, r) {
      return r.risco_sacado && r.status !== 'estornado'
        ? s + (parseFloat(r.valor_perdido_risco_sacado) || 0)
        : s;
    }, 0);

    cp.innerHTML =
      // Linha de status + somente leitura
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.3rem">'
        + _badgeSt(conta.status)
        + '<span style="font-size:.64rem;color:var(--text3);font-style:italic">🔒 Somente leitura — dados do módulo Financeiro</span>'
      + '</div>'

      // 4 KPI cards
      + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin-bottom:.75rem">'
        + _kpiCard('Previsto',  _money(previsto), '')
        + _kpiCard('Faturado',  _money(faturado), '')
        + _kpiCard('Recebido',  _money(recebido), 'var(--green)')
        + _kpiCard('Pendente',  _money(pendente), pendente > 0 ? 'var(--accent)' : 'var(--text2)')
      + '</div>'

      // Barra de progresso
      + '<div style="margin-bottom:.6rem">'
        + '<div style="display:flex;justify-content:space-between;font-size:.65rem;color:var(--text3);margin-bottom:.2rem">'
          + '<span>Progresso de recebimento</span><span>' + pct + '%</span>'
        + '</div>'
        + '<div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden">'
          + '<div style="height:100%;border-radius:3px;background:' + barColor + ';width:' + pct + '%;transition:width .4s ease"></div>'
        + '</div>'
      + '</div>'

      // Alerta risco sacado
      + (totalRS > 0
          ? '<div style="margin-bottom:.6rem;padding:.38rem .6rem;background:rgba(248,81,73,.07);border:1px solid rgba(248,81,73,.2);border-radius:5px;font-size:.73rem;color:var(--red)">⚠ Risco Sacado — Valor perdido: <strong>' + _money(totalRS) + '</strong></div>'
          : ''
      )

      // Contadores
      + '<div style="display:flex;gap:1.2rem;font-size:.72rem;color:var(--text2);margin-bottom:.9rem">'
        + '<span>📄 ' + notas.length + ' nota' + (notas.length !== 1 ? 's fiscais' : ' fiscal') + '</span>'
        + '<span>💳 ' + recebimentos.length + ' recebimento' + (recebimentos.length !== 1 ? 's' : '') + '</span>'
      + '</div>'

      // Seção NFs
      + '<div style="margin-bottom:.85rem">'
        + '<div style="font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.35rem">Notas Fiscais</div>'
        + _renderNFs(notas)
      + '</div>'

      // Seção Recebimentos
      + '<div style="margin-bottom:.6rem">'
        + '<div style="font-size:.65rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.35rem">Recebimentos</div>'
        + _renderRecebimentos(recebimentos)
      + '</div>'

      // Rodapé: aviso readonly
      + '<div style="margin-top:.6rem;padding-top:.45rem;border-top:1px solid var(--border);font-size:.64rem;color:var(--text3)">'
        + '⚠ Para editar ou registrar dados financeiros, acesse o módulo <strong>Financeiro</strong>.'
      + '</div>';
  }

  // ── API pública ───────────────────────────────────────────

  /**
   * Carrega e exibe o espelho financeiro de uma proposta.
   * Chamado por fmAbrirProposta() no Comercial.
   * @param {string} propostaAppId — p.id no Comercial = proposta_app_id no Financeiro
   */
  window.finEspelhoCarregar = async function (propostaAppId) {
    var token = ++_espelhoToken;
    _espelhoAtivo = propostaAppId;

    var sf    = _sf();
    var empId = _empId();

    // Limpar estado anterior
    _limpar();
    _espelhoAtivo = propostaAppId; // restaurar após _limpar()

    if (!sf || !empId || !propostaAppId) {
      // Sem sbFinanceiro ou sem empresa ativa — estado vazio silencioso
      _mostrarVazio();
      return;
    }

    _mostrarCarregando();

    try {
      var resumo = await sf.buscarResumoFinanceiroProposta(empId, propostaAppId);

      // Race condition: empresa trocou durante o await
      if (token !== _espelhoToken) return;

      if (!resumo || !resumo.conta) {
        _mostrarVazio();
        return;
      }

      _renderEspelho(resumo);

    } catch(e) {
      if (token !== _espelhoToken) return;
      console.warn('[FinEspelho F2E] erro ao carregar:', e);
      _mostrarErro();
    }
  };

  /**
   * Limpa o espelho imediatamente (chamado ao trocar empresa).
   */
  window.finEspelhoLimpar = function () {
    _espelhoToken++;
    _espelhoAtivo = null;
    _limpar();
  };

  // ── Listener: troca de empresa ────────────────────────────
  window.addEventListener('empresa:changed', function () {
    window.finEspelhoLimpar();
  });

  console.log('%c[financeiro-espelho F2E] carregado', 'color:#58a6ff;font-weight:700');

}(window));

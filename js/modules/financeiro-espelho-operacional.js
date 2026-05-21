// ============================================================
// financeiro-espelho-operacional.js — F2F — Espelho Financeiro no Operacional
//
// SOMENTE LEITURA — nunca grava, nunca cria lançamentos.
// Exibe resumo financeiro oficial (contas, NFs, recebimentos)
// no detalhe da obra do módulo Operacional.
//
// Vínculo primário  : obra.proposta_app_id === financeiro_contas_receber.proposta_app_id
// Vínculo secundário: obra.id              === financeiro_contas_receber.obra_id
// Empresa           : respeitada via getEmpresaAtivaId() em toda consulta.
// Race condition    : _opEspelhoToken descarta respostas de empresa/obra anterior.
// ============================================================
(function (window) {
  'use strict';

  var _opEspelhoToken = 0;
  var _obraAtiva      = null; // obra atualmente exibida

  // ── Helpers ───────────────────────────────────────────────
  function _sf() { return window.sbFinanceiro || null; }

  function _empId() {
    return typeof window.getEmpresaAtivaId === 'function'
      ? window.getEmpresaAtivaId()
      : null;
  }

  function _money(v) {
    var n = parseFloat(v) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Referência ao container no DOM ───────────────────────
  // Injetado por renderDetalhe() em operacional-inline.js
  function _el() { return document.getElementById('op-fin-espelho-sec'); }

  // ── Estrutura visual externa (cabeçalho do bloco) ────────
  function _wrapSecao(innerHtml) {
    return '<section style="border:1px solid rgba(88,166,255,.28);border-radius:10px;'
      + 'background:rgba(88,166,255,.03);margin-bottom:1rem;overflow:hidden">'
      + '<div style="background:rgba(88,166,255,.06);padding:.85rem 1rem;'
      + 'display:flex;justify-content:space-between;align-items:center;gap:.5rem;'
      + 'border-bottom:1px solid rgba(88,166,255,.18)">'
      + '<div>'
      + '<span style="font-size:.95rem;color:var(--accent);font-weight:900;'
      + 'text-transform:uppercase;letter-spacing:.02em">💰 Resumo Financeiro Oficial</span>'
      + '<span style="font-size:.65rem;color:var(--text3);font-style:italic;'
      + 'margin-left:.6rem">dados do módulo Financeiro • somente leitura</span>'
      + '</div></div>'
      + '<div style="padding:1rem">' + innerHtml + '</div>'
      + '</section>';
  }

  // ── Estados visuais ───────────────────────────────────────
  function _mostrarCarregando() {
    var el = _el(); if (!el) return;
    el.innerHTML = _wrapSecao(
      '<div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;color:var(--text2);padding:.2rem 0">'
      + '<div style="width:16px;height:16px;border:2px solid var(--border);border-top-color:#58a6ff;'
      + 'border-radius:50%;animation:spin .6s linear infinite;flex-shrink:0"></div>'
      + 'Carregando resumo financeiro...</div>'
    );
  }

  function _mostrarVazio() {
    var el = _el(); if (!el) return;
    el.innerHTML = _wrapSecao(
      '<div style="font-size:.78rem;color:var(--text3);padding:.2rem 0">'
      + '📭 Sem dados financeiros oficiais vinculados a esta obra.</div>'
    );
  }

  function _mostrarErro() {
    var el = _el(); if (!el) return;
    el.innerHTML = _wrapSecao(
      '<div style="font-size:.75rem;color:var(--text3);font-style:italic;padding:.2rem 0">'
      + '⚠ Não foi possível carregar o resumo financeiro. Verifique o console.</div>'
    );
  }

  function _limpar() {
    var el = _el();
    if (el) el.innerHTML = '';
    _obraAtiva = null;
  }

  // ── KPI Card ──────────────────────────────────────────────
  function _kpi(label, valor, cor) {
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;'
      + 'padding:.5rem .65rem;min-width:0">'
      + '<div style="font-size:.6rem;color:var(--text3);text-transform:uppercase;'
      + 'letter-spacing:.04em;margin-bottom:.12rem;white-space:nowrap">' + label + '</div>'
      + '<div style="font-size:.82rem;font-weight:700;word-break:break-word'
      + (cor ? ';color:' + cor : '') + '">' + valor + '</div>'
      + '</div>';
  }

  // ── Barra de progresso ────────────────────────────────────
  function _progressBar(pct) {
    var cor = pct >= 100 ? '#3fb950' : pct >= 50 ? '#d4a017' : '#f97316';
    return '<div style="margin-top:.75rem">'
      + '<div style="display:flex;justify-content:space-between;font-size:.7rem;'
      + 'color:var(--text3);margin-bottom:.28rem">'
      + '<span>Progresso de recebimento</span><span style="color:' + cor + ';font-weight:700">'
      + pct.toFixed(1) + '%</span></div>'
      + '<div style="height:7px;background:var(--bg);border-radius:4px;overflow:hidden">'
      + '<div style="width:' + Math.min(100, pct).toFixed(1) + '%;height:100%;background:'
      + cor + ';border-radius:4px;transition:width .3s ease"></div></div></div>';
  }

  // ── Render principal ──────────────────────────────────────
  function _renderEspelho(resumo) {
    var el = _el(); if (!el) return;

    var conta         = resumo.conta;
    var notas         = resumo.notas         || [];
    var recebimentos  = resumo.recebimentos  || [];
    var previsto      = parseFloat(conta.valor_previsto)  || 0;
    var faturado      = resumo.totalNF       || 0;
    var recebido      = resumo.totalRecebido || 0;
    var pendente      = Math.max(0, previsto - recebido);
    var pct           = previsto > 0 ? Math.min(100, recebido / previsto * 100) : 0;
    var perdidoRS     = resumo.totalPerdidoRS || 0;
    var temRS         = resumo.temRiscoSacado && perdidoRS > 0;

    // ── KPIs principais ──
    var kpiHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));'
      + 'gap:.55rem;margin-bottom:.65rem">'
      + _kpi('Previsto',  _money(previsto),  'var(--text)')
      + _kpi('Faturado',  _money(faturado),  faturado  >= previsto * .9 ? '#3fb950' : 'var(--accent)')
      + _kpi('Recebido',  _money(recebido),  recebido  >= faturado  * .9 ? '#3fb950' : '#f97316')
      + _kpi('Pendente',  _money(pendente),  pendente  > 0 ? '#f97316' : '#3fb950')
      + '</div>';

    // ── Contador de NFs e Recebimentos ──
    var contadoresHtml = '<div style="display:flex;gap:1rem;flex-wrap:wrap;'
      + 'font-size:.75rem;color:var(--text2);margin-top:.55rem">'
      + '<span>📄 <strong>' + notas.length + '</strong> Nota(s) Fiscal(is)</span>'
      + '<span>💵 <strong>' + recebimentos.length + '</strong> Recebimento(s)</span>'
      + '</div>';

    // ── Alerta Risco Sacado ──
    var rsHtml = temRS
      ? '<div style="margin-top:.65rem;background:rgba(248,81,73,.1);border:1px solid rgba(248,81,73,.3);'
        + 'border-radius:6px;padding:.5rem .75rem;font-size:.75rem;color:#f85149">'
        + '⚠ <strong>Risco Sacado:</strong> ' + _money(perdidoRS) + ' perdido em desconto antecipado.</div>'
      : '';

    // ── Status da conta ──
    var statusMap = {
      previsto: 'Previsto', a_faturar: 'A Faturar', faturado: 'Faturado',
      parcialmente_recebido: 'Parcial', recebido: 'Recebido', cancelado: 'Cancelado'
    };
    var statusLabel = statusMap[conta.status] || conta.status || '—';
    var statusCor = conta.status === 'recebido' ? '#3fb950'
                  : conta.status === 'cancelado' ? 'var(--text3)'
                  : conta.status === 'parcialmente_recebido' ? '#f97316'
                  : 'var(--accent)';
    var statusHtml = '<div style="margin-top:.55rem;font-size:.74rem;color:var(--text3)">'
      + 'Status: <span style="font-weight:700;color:' + statusCor + '">' + _esc(statusLabel) + '</span></div>';

    var inner = kpiHtml
      + _progressBar(pct)
      + contadoresHtml
      + statusHtml
      + rsHtml;

    el.innerHTML = _wrapSecao(inner);
  }

  // ── API pública ───────────────────────────────────────────

  /**
   * Carrega e exibe o espelho financeiro de uma obra.
   * Chamado por renderDetalhe() em operacional-inline.js.
   *
   * Tentativa 1: por proposta_app_id (vínculo mais comum — criado pelo backfill).
   * Tentativa 2: por obra_id (caso a conta tenha sido criada diretamente para a obra).
   *
   * @param {Object} obra  — objeto obra com id, proposta_app_id, empresa_id
   */
  window.opFinEspelhoCarregar = async function (obra) {
    var token = ++_opEspelhoToken;
    _obraAtiva = obra;

    var sf    = _sf();
    var empId = _empId();

    if (!sf || !empId || !obra) { _mostrarVazio(); return; }

    _mostrarCarregando();

    try {
      var resumo = null;

      // Tentativa 1: por proposta_app_id
      if (obra.proposta_app_id) {
        resumo = await sf.buscarResumoFinanceiroProposta(empId, obra.proposta_app_id);
      }

      // Race condition: empresa ou obra trocou durante o await
      if (token !== _opEspelhoToken) return;

      // Tentativa 2: por obra_id (fallback)
      if (!resumo && obra.id) {
        resumo = await sf.buscarResumoFinanceiroObra(empId, obra.id);
      }

      if (token !== _opEspelhoToken) return;

      if (!resumo || !resumo.conta) {
        _mostrarVazio();
        return;
      }

      _renderEspelho(resumo);

    } catch (e) {
      if (token !== _opEspelhoToken) return;
      console.warn('[FinEspelhoOp F2F] erro ao carregar:', e);
      _mostrarErro();
    }
  };

  /**
   * Limpa o espelho imediatamente.
   * Chamado ao trocar empresa ou fechar detalhe da obra.
   */
  window.opFinEspelhoLimpar = function () {
    _opEspelhoToken++;
    _obraAtiva = null;
    _limpar();
  };

  // ── Listener: troca de empresa ────────────────────────────
  // operacional-inline.js já zera state.obraAtual e re-renderiza,
  // o que destrói o DOM do detalhe. Este listener descarta qualquer
  // resposta async pendente que pudesse pintar dados da empresa anterior.
  window.addEventListener('empresa:changed', function () {
    window.opFinEspelhoLimpar();
  });

  console.log('%c[financeiro-espelho-operacional F2F] carregado', 'color:#58a6ff;font-weight:700');

}(window));

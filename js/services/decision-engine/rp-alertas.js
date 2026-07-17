// ============================================================
// rp-alertas.js — Alertas do módulo Recursos & Produtividade
// para o Motor de Decisão / Visão Executiva.
//
// Regras tradicionais (zero IA), sobre dados ASSÍNCRONOS (obras,
// apontamentos, vínculos, rp_config) que os motores síncronos não
// têm em memória. Padrão do set de NFs oficiais (PR #142): loader
// com cache por EMPRESA+DIA pré-computa os alertas em
// window._rpAlertas; os dois motores apenas anexam o resultado:
//   - runDecisionEngine interno do rDash (Visão Executiva)
//   - generateAlerts do serviço V2 (painel Motor de Decisão)
// Ao carregar, re-renderiza via rDash() — o cache impede loop.
//
// Regras:
//   1. Obra parada em 'aprovado' há mais de N dias ÚTEIS
//      (proxy: obras.created_at; N = rp_config.dias_parado_aprovado,
//      default 5).
//   2. Ocupação da SEMANA CORRENTE fora dos limites de rp_config
//      (limite_sobrecarga → 1 card crítico por colaborador;
//      limite_ociosidade → 1 card AGREGADO de atenção). Capacidade
//      PROPORCIONAL aos dias úteis já decorridos da semana — sem
//      isso, toda segunda-feira o time amanhece "ocioso".
// ============================================================
(function () {
  'use strict';

  var _cacheKey = null, _busy = false;
  window._rpAlertas = null;   // null = ainda não carregado; [] = carregado sem alertas

  var CFG_DEFAULT = { jornada_semanal: 44, limite_sobrecarga: 100, limite_ociosidade: 50, dias_parado_aprovado: 5 };

  function _eid() {
    try {
      return (typeof getEmpresaAtivaId === 'function' ? getEmpresaAtivaId() : null)
        || (window._empresaAtiva && window._empresaAtiva.id) || null;
    } catch (e) { return null; }
  }
  function _isoDe(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function _deIso(iso) { var p = String(iso).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  // Dias úteis (seg–sex) no intervalo ISO inclusivo.
  function _diasUteisEntre(iniIso, fimIso) {
    var d = _deIso(iniIso), fim = _deIso(fimIso), n = 0;
    while (d <= fim) { var dw = d.getDay(); if (dw >= 1 && dw <= 5) n++; d.setDate(d.getDate() + 1); }
    return n;
  }
  // Dias úteis DECORRIDOS desde a data (exclusive) até hoje (inclusive).
  // Obra criada hoje = 0 dias parada.
  function _uteisDesde(iso, hojeIso) {
    var d = _deIso(String(iso).slice(0, 10)); d.setDate(d.getDate() + 1);
    var ini = _isoDe(d);
    if (ini > hojeIso) return 0;
    return _diasUteisEntre(ini, hojeIso);
  }
  function _semanaAtual(hojeIso) {
    var d = _deIso(hojeIso);
    var dow = (d.getDay() + 6) % 7;
    var ini = new Date(d); ini.setDate(d.getDate() - dow);
    var fim = new Date(ini); fim.setDate(ini.getDate() + 6);
    return { inicio: _isoDe(ini), fim: _isoDe(fim) };
  }

  async function _computar(eid) {
    var sb = window.sbClient;
    var hoje = _isoDe(new Date());

    // Config do módulo (rp_config) com defaults
    var cfg = Object.assign({}, CFG_DEFAULT);
    try {
      var rc = await sb.from('configuracoes').select('valor')
        .eq('empresa_id', eid).eq('chave', 'rp_config').maybeSingle();
      if (rc && rc.data && rc.data.valor) {
        Object.keys(CFG_DEFAULT).forEach(function (k) {
          var v = Number(rc.data.valor[k]);
          if (isFinite(v) && v > 0) cfg[k] = v;
        });
      }
    } catch (e) {}

    var alertas = [];

    // ── Regra 1: obras paradas em 'aprovado' ──────────────────
    try {
      var rOb = await sb.from('obras')
        .select('proposta_app_id, proposta_numero, created_at')
        .eq('empresa_id', eid).eq('status_operacional', 'aprovado');
      var paradas = ((rOb && rOb.data) || []).map(function (o) {
        return { num: (o && (o.proposta_numero || o.proposta_app_id)) || '—', dias: _uteisDesde(o.created_at, hoje) };
      }).filter(function (x) { return x.dias > cfg.dias_parado_aprovado; })
        .sort(function (a, b) { return b.dias - a.dias; });
      if (paradas.length) {
        var lista = paradas.map(function (x) { return '<strong>' + x.num + '</strong> (' + x.dias + 'd úteis)'; }).join(', ');
        var listaTxt = paradas.map(function (x) { return x.num + ' (' + x.dias + 'd úteis)'; }).join(', ');
        alertas.push({
          nivel: 'critico', icone: '🏗️',
          titulo: '🏗️ ' + paradas.length + ' obra' + (paradas.length > 1 ? 's' : '') + ' parada' + (paradas.length > 1 ? 's' : '') + ' em Aprovado',
          msg: 'Aprovada' + (paradas.length > 1 ? 's' : '') + ' há mais de ' + cfg.dias_parado_aprovado + ' dias úteis sem início de execução: ' + lista + '.',
          texto: paradas.length + ' obra(s) aprovada(s) há mais de ' + cfg.dias_parado_aprovado + ' dias úteis sem início de execução: ' + listaTxt,
          acao: 'Fazer a passagem de bastão na Gestão do Negócio'
        });
      }
    } catch (e) {}

    // ── Regra 2: ocupação da semana corrente fora dos limites ─
    try {
      var sem = _semanaAtual(hoje);
      var rAp = await sb.from('apontamentos')
        .select('colaborador_id, horas_total')
        .eq('empresa_id', eid).eq('status', 'aprovado')
        .gte('data', sem.inicio).lte('data', sem.fim);
      var rVin = await sb.from('colaborador_empresas')
        .select('colaborador_id, nome')
        .eq('empresa_id', eid).eq('ativo', true);
      var vinculos = (rVin && rVin.data) || [];
      var nomesBase = {};
      var semNome = vinculos.filter(function (v) { return v && !v.nome; }).map(function (v) { return v.colaborador_id; });
      if (semNome.length) {
        var rCol = await sb.from('colaboradores').select('id, nome').in('id', semNome);
        ((rCol && rCol.data) || []).forEach(function (c) { if (c) nomesBase[c.id] = c.nome; });
      }
      var horas = {};
      ((rAp && rAp.data) || []).forEach(function (a) {
        if (a && a.colaborador_id) horas[a.colaborador_id] = (horas[a.colaborador_id] || 0) + (Number(a.horas_total) || 0);
      });
      // Capacidade proporcional aos dias úteis JÁ DECORRIDOS da semana (seg→hoje).
      var uteisDecorridos = _diasUteisEntre(sem.inicio, hoje);
      var cap = uteisDecorridos * (cfg.jornada_semanal / 5);
      if (cap > 0 && vinculos.length) {
        var ociosos = [];
        vinculos.forEach(function (v) {
          if (!v || !v.colaborador_id) return;
          var nome = v.nome || nomesBase[v.colaborador_id] || '—';
          var pct = Math.round((horas[v.colaborador_id] || 0) / cap * 100);
          if (pct > cfg.limite_sobrecarga) {
            alertas.push({
              nivel: 'critico', icone: '👷',
              titulo: '👷 Sobrecarga: ' + nome + ' — ' + pct + '%',
              msg: '<strong>' + nome + '</strong> está com ' + pct + '% de ocupação esta semana (limite: ' + cfg.limite_sobrecarga + '%).',
              texto: nome + ' está com ' + pct + '% de ocupação esta semana (limite ' + cfg.limite_sobrecarga + '%)',
              acao: 'Redistribuir alocação'
            });
          } else if (pct < cfg.limite_ociosidade) {
            ociosos.push({ nome: nome, pct: pct });
          }
        });
        if (ociosos.length) {
          ociosos.sort(function (a, b) { return a.pct - b.pct; });
          var lst = ociosos.map(function (o) { return o.nome + ' (' + o.pct + '%)'; }).join(', ');
          alertas.push({
            nivel: 'atencao', icone: '👷',
            titulo: '👷 ' + ociosos.length + ' colaborador' + (ociosos.length > 1 ? 'es' : '') + ' abaixo de ' + cfg.limite_ociosidade + '% esta semana',
            msg: 'Ocupação abaixo do limite de ociosidade: ' + lst + '. Capacidade considerada: dias úteis já decorridos da semana.',
            texto: ociosos.length + ' colaborador(es) abaixo de ' + cfg.limite_ociosidade + '% de ocupação esta semana: ' + lst,
            acao: 'Revisar alocação da semana'
          });
        }
      }
    } catch (e) {}

    return alertas;
  }

  // Garante os alertas do dia (1 computação por empresa+dia; guard anti-loop).
  window._rpAlertasGarantir = function () {
    var eid = _eid();
    if (!window.sbClient || !eid || _busy) return;
    var key = eid + '|' + _isoDe(new Date());
    if (_cacheKey === key && window._rpAlertas !== null) return;
    _busy = true;
    _computar(eid).then(function (alertas) {
      window._rpAlertas = alertas; _cacheKey = key; _busy = false;
      try { if (typeof rDash === 'function') rDash(); } catch (e) {}
    }).catch(function () {
      window._rpAlertas = []; _cacheKey = key; _busy = false;
    });
  };

}());

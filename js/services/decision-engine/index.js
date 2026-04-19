// Motor de Decisão TecFusion — V1
// Baseado em regras de negócio sobre dados reais do sistema

(function () {

  // ── helpers internos ──────────────────────────────────────────
  function _dias(dataISO) {
    if (!dataISO) return null;
    var d;
    if (String(dataISO).indexOf('/') >= 0) {
      var pts = dataISO.split('/');
      d = pts.length === 3 ? new Date(pts[2] + '-' + pts[1] + '-' + pts[0] + 'T12:00:00') : null;
    } else {
      d = new Date(dataISO.length === 10 ? dataISO + 'T12:00:00' : dataISO);
    }
    if (!d || isNaN(d)) return null;
    return Math.floor((Date.now() - d.getTime()) / 86400000);
  }

  function _dataProp(p) { return p.dat2 || p.dat || null; }
  function _val(p)      { return (typeof n2 === 'function') ? n2(p.val) : (isFinite(+p.val) ? +p.val : 0); }
  function _soma(arr)   { return arr.reduce(function (s, p) { return s + _val(p); }, 0); }
  function _fmt(v)      { return (typeof money === 'function') ? money(v) : 'R$ ' + v; }

  // ── getData ───────────────────────────────────────────────────
  function getData() {
    var ps      = window.props || [];
    var FAZ_OK  = window.FAS_FECHADO  || [];
    var FAZ_PIPE= window.FAS_PIPELINE || [];
    var FAZ_NEG = window.FAS_NEGOC    || [];

    var pipeline  = ps.filter(function (p) { return FAZ_PIPE.indexOf(p.fas) >= 0; });
    var negoc     = ps.filter(function (p) { return FAZ_NEG.indexOf(p.fas) >= 0; });
    var elabor    = ps.filter(function (p) { return p.fas === 'em_elaboracao'; });
    var atrasadas = ps.filter(function (p) { return p.fas === 'atrasado'; });
    var emPausa   = ps.filter(function (p) { return p.fas.indexOf('em_pausa') === 0; });

    var _pAno    = typeof getPropsAno === 'function' ? getPropsAno() : [];
    var _fAno    = typeof getFechAno  === 'function' ? getFechAno()  : [];
    var recAno   = typeof getRecAno   === 'function' ? getRecAno()   : 0;
    var meta     = typeof getMeta     === 'function' ? getMeta()     : {};

    var taxaConv = _pAno.length > 0 ? (_fAno.length / _pAno.length) * 100 : 0;
    var valPipe  = _soma(pipeline);

    var hoje = new Date();
    var mes = hoje.getMonth(), ano = hoje.getFullYear();
    var fechMes = ps.filter(function (p) {
      if (FAZ_OK.indexOf(p.fas) < 0) return false;
      var d = p.dtFech ? new Date(p.dtFech + 'T12:00:00') : (p.dat2 ? new Date(p.dat2 + 'T12:00:00') : null);
      return d && d.getMonth() === mes && d.getFullYear() === ano;
    });

    return {
      propostas: ps,
      pipeline:  { lista: pipeline,  valor: valPipe,       count: pipeline.length },
      negociacao:{ lista: negoc,      count: negoc.length },
      elaboracao:{ lista: elabor,     count: elabor.length },
      atrasadas: { lista: atrasadas,  count: atrasadas.length },
      emPausa:   { lista: emPausa,    count: emPausa.length },
      kpis: {
        taxaConv:    taxaConv,
        recAno:      recAno,
        ticketMedio: pipeline.length > 0 ? valPipe / pipeline.length : 0,
        totalAno:    _pAno.length,
        fechAno:     _fAno.length,
        fechMes:     fechMes.length,
        valFechMes:  _soma(fechMes)
      },
      metas: meta || {}
    };
  }

  // ── generateAlerts ────────────────────────────────────────────
  function generateAlerts(data) {
    var al = [];

    // 1. Em elaboração paradas > 15 dias
    var elab15 = data.elaboracao.lista.filter(function (p) {
      var d = _dias(_dataProp(p)); return d !== null && d > 15;
    });
    if (elab15.length) al.push({
      tipo: 'alerta', icone: '📝', impacto: 'alto',
      mensagem: elab15.length + ' proposta' + (elab15.length > 1 ? 's' : '') + ' em elaboração há mais de 15 dias sem envio',
      valor: _soma(elab15), propostas: elab15
    });

    // 2. Enviadas > 7 dias sem follow-up
    var env7 = data.negociacao.lista.filter(function (p) {
      if (p.fas !== 'enviada') return false;
      var d = _dias(_dataProp(p)); return d !== null && d > 7;
    });
    if (env7.length) al.push({
      tipo: 'alerta', icone: '📤', impacto: 'alto',
      mensagem: env7.length + ' proposta' + (env7.length > 1 ? 's' : '') + ' enviada' + (env7.length > 1 ? 's' : '') + ' há mais de 7 dias sem follow-up',
      valor: _soma(env7), propostas: env7
    });

    // 3. Follow-ups > 14 dias sem atualização
    var followFases = ['follow1', 'follow2', 'follow3', 'follow4', 'cliente_analisando'];
    var follow14 = data.negociacao.lista.filter(function (p) {
      if (followFases.indexOf(p.fas) < 0) return false;
      var d = _dias(_dataProp(p)); return d !== null && d > 14;
    });
    if (follow14.length) al.push({
      tipo: 'alerta', icone: '🔄', impacto: 'medio',
      mensagem: follow14.length + ' proposta' + (follow14.length > 1 ? 's' : '') + ' em follow-up sem atualização há mais de 14 dias',
      valor: _soma(follow14), propostas: follow14
    });

    // 4. Atrasadas (crítico)
    if (data.atrasadas.count) al.push({
      tipo: 'critico', icone: '⚠️', impacto: 'alto',
      mensagem: data.atrasadas.count + ' proposta' + (data.atrasadas.count > 1 ? 's' : '') + ' marcada' + (data.atrasadas.count > 1 ? 's' : '') + ' como atrasada',
      valor: _soma(data.atrasadas.lista), propostas: data.atrasadas.lista
    });

    // 5. Em pausa > 30 dias
    var pausa30 = data.emPausa.lista.filter(function (p) {
      var d = _dias(_dataProp(p)); return d !== null && d > 30;
    });
    if (pausa30.length) al.push({
      tipo: 'alerta', icone: '⏸️', impacto: 'medio',
      mensagem: pausa30.length + ' proposta' + (pausa30.length > 1 ? 's' : '') + ' em pausa há mais de 30 dias',
      valor: _soma(pausa30), propostas: pausa30
    });

    // 6. Pipeline baixo
    var metaRec = (typeof n2 === 'function' ? n2((data.metas || {}).rec) : 0) || 0;
    var limiar = metaRec > 0 ? metaRec * 0.3 : 150000;
    if (data.pipeline.count < 3 || data.pipeline.valor < limiar) al.push({
      tipo: 'alerta', icone: '📉', impacto: 'alto',
      mensagem: 'Pipeline baixo: ' + data.pipeline.count + ' proposta' + (data.pipeline.count !== 1 ? 's' : '') + ' ativa' + (data.pipeline.count !== 1 ? 's' : '') + ' (' + _fmt(data.pipeline.valor) + ')',
      valor: 0, propostas: []
    });

    // 7. Conversão baixa (mínimo 5 propostas no ano para avaliar)
    if (data.kpis.totalAno >= 5 && data.kpis.taxaConv < 25) al.push({
      tipo: 'atencao', icone: '📊', impacto: 'medio',
      mensagem: 'Taxa de conversão baixa: ' + data.kpis.taxaConv.toFixed(1) + '% (' + data.kpis.fechAno + ' de ' + data.kpis.totalAno + ' propostas fechadas no ano)',
      valor: 0, propostas: []
    });

    // 8. Nenhuma proposta em negociação ativa
    if (data.negociacao.count === 0) al.push({
      tipo: 'atencao', icone: '🧐', impacto: 'baixo',
      mensagem: 'Nenhuma proposta em negociação no momento',
      valor: 0, propostas: []
    });

    // Ordenar: critico > alto > medio > baixo
    var ord = { critico: 0, alto: 1, medio: 2, baixo: 3 };
    al.sort(function (a, b) {
      return (ord[a.tipo === 'critico' ? 'critico' : a.impacto] || 3) -
             (ord[b.tipo === 'critico' ? 'critico' : b.impacto] || 3);
    });
    return al;
  }

  // ── generateDecisions ─────────────────────────────────────────
  function generateDecisions(data, alertas) {
    var dec = [];
    var has = function (str) { return alertas.some(function (a) { return a.mensagem.toLowerCase().indexOf(str.toLowerCase()) >= 0; }); };

    var temAtrasada  = alertas.some(function (a) { return a.tipo === 'critico'; });
    var temFollow    = has('follow-up') || has('sem follow');
    var temElab      = has('elaboração');
    var temPipelineBx= has('pipeline baixo');
    var temPausa     = has('pausa');
    var temConvBx    = has('conversão baixa');

    if (temAtrasada) dec.push({
      titulo: '🚨 Resolver propostas atrasadas',
      descricao: 'Contato imediato com ' + data.atrasadas.count + ' cliente' + (data.atrasadas.count > 1 ? 's' : '') + ' para regularizar execução em andamento',
      impacto_financeiro: _soma(data.atrasadas.lista), prioridade: 1
    });

    if (temFollow) {
      var vFollow = alertas.filter(function (a) { return a.mensagem.toLowerCase().indexOf('follow') >= 0 || a.mensagem.toLowerCase().indexOf('enviada') >= 0; }).reduce(function (s, a) { return s + (a.valor || 0); }, 0);
      dec.push({
        titulo: '📞 Executar follow-ups pendentes',
        descricao: 'Ligar ou enviar mensagem para clientes com propostas aguardando retorno',
        impacto_financeiro: vFollow, prioridade: temAtrasada ? 2 : 1
      });
    }

    if (temElab) {
      var elabP = data.elaboracao.lista.filter(function (p) { var d = _dias(_dataProp(p)); return d !== null && d > 15; });
      dec.push({
        titulo: '✉️ Enviar propostas em elaboração',
        descricao: elabP.length + ' proposta' + (elabP.length > 1 ? 's' : '') + ' pronta' + (elabP.length > 1 ? 's' : '') + ' esperando envio ao cliente',
        impacto_financeiro: _soma(elabP), prioridade: 2
      });
    }

    if (temPausa) {
      var p30 = data.emPausa.lista.filter(function (p) { var d = _dias(_dataProp(p)); return d !== null && d > 30; });
      dec.push({
        titulo: '▶️ Retomar propostas em pausa',
        descricao: 'Verificar situação com ' + p30.length + ' cliente' + (p30.length > 1 ? 's' : '') + ' e definir próximo passo',
        impacto_financeiro: _soma(p30), prioridade: 3
      });
    }

    if (temPipelineBx) dec.push({
      titulo: '🔍 Prospectar novos clientes',
      descricao: 'Pipeline com ' + data.pipeline.count + ' proposta' + (data.pipeline.count !== 1 ? 's' : '') + ' — gerar novas oportunidades esta semana',
      impacto_financeiro: 0, prioridade: 3
    });

    if (temConvBx) dec.push({
      titulo: '🎯 Revisar estratégia de fechamento',
      descricao: 'Taxa de ' + data.kpis.taxaConv.toFixed(1) + '% abaixo do esperado — analisar objeções e ajustar abordagem',
      impacto_financeiro: 0, prioridade: 4
    });

    if (!dec.length) dec.push({
      titulo: '✅ Manter ritmo atual',
      descricao: 'Nenhuma ação urgente — foco em avançar as propostas em negociação',
      impacto_financeiro: data.pipeline.valor, prioridade: 5
    });

    dec.sort(function (a, b) { return a.prioridade - b.prioridade; });
    return dec;
  }

  // ── generateExecutiveSummary ──────────────────────────────────
  function generateExecutiveSummary(data, alertas, decisoes) {
    var meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    var mesAtual = meses[new Date().getMonth()];
    var partes = [];

    // Situação atual
    var sit = '📊 ' + data.pipeline.count + ' proposta' + (data.pipeline.count !== 1 ? 's' : '') + ' ativa' + (data.pipeline.count !== 1 ? 's' : '') + ' valendo ' + _fmt(data.pipeline.valor) + '.';
    sit += data.kpis.fechMes > 0
      ? ' ' + data.kpis.fechMes + ' fechamento' + (data.kpis.fechMes > 1 ? 's' : '') + ' em ' + mesAtual + ' (' + _fmt(data.kpis.valFechMes) + ').'
      : ' Sem fechamentos em ' + mesAtual + ' ainda.';
    sit += ' Conversão do ano: ' + data.kpis.taxaConv.toFixed(1) + '%.';
    partes.push(sit);

    // Principais problemas
    var criticos = alertas.filter(function (a) { return a.impacto === 'alto' || a.tipo === 'critico'; });
    if (criticos.length) partes.push('🔴 Atenção: ' + criticos.slice(0, 2).map(function (a) { return a.mensagem; }).join('. ') + '.');

    // O que fazer agora
    if (decisoes.length) {
      var top = decisoes.slice(0, 3).map(function (d) { return d.titulo.replace(/^[^\s]+\s/, ''); });
      partes.push('✅ Prioridade: ' + top.join(' → ') + '.');
    }

    return partes.join(' ');
  }

  // ── runDecisionEngine ─────────────────────────────────────────
  window.runDecisionEngine = function () {
    var data     = getData();
    var alerts   = generateAlerts(data);
    var decisions= generateDecisions(data, alerts);
    var executive_summary = generateExecutiveSummary(data, alerts, decisions);
    var result   = { alerts: alerts, decisions: decisions, executive_summary: executive_summary, _data: data };
    window._deResult = result;
    if (typeof renderDecisionEngine === 'function') renderDecisionEngine(result);
    return result;
  };

}());

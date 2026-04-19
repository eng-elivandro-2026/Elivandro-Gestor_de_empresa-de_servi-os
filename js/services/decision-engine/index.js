// Motor de Decisão TecFusion — V2
// Score de prioridade + Oportunidades + Foco da Semana + Impacto financeiro

(function () {

  // ── helpers ───────────────────────────────────────────────────
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
  function _fmt(v)      { return (typeof money === 'function') ? money(v) : 'R$' + v; }

  function _scoreLabel(score) {
    if (score >= 12) return 'Alta';
    if (score >= 8)  return 'Média';
    return 'Baixa';
  }

  // Ajusta nota de impacto financeiro pelo valor absoluto (1-5)
  function _notaValor(val) {
    if (val >= 500000) return 5;
    if (val >= 200000) return 4;
    if (val >= 80000)  return 3;
    if (val >= 20000)  return 2;
    return 1;
  }

  // ── getData ───────────────────────────────────────────────────
  function getData() {
    var ps       = window.props || [];
    var FAZ_OK   = window.FAS_FECHADO  || [];
    var FAZ_PIPE = window.FAS_PIPELINE || [];
    var FAZ_NEG  = window.FAS_NEGOC    || [];

    var pipeline  = ps.filter(function (p) { return FAZ_PIPE.indexOf(p.fas) >= 0; });
    var negoc     = ps.filter(function (p) { return FAZ_NEG.indexOf(p.fas) >= 0; });
    var elabor    = ps.filter(function (p) { return p.fas === 'em_elaboracao'; });
    var atrasadas = ps.filter(function (p) { return p.fas === 'atrasado'; });
    var emPausa   = ps.filter(function (p) { return p.fas.indexOf('em_pausa') === 0; });

    var _pAno  = typeof getPropsAno === 'function' ? getPropsAno() : [];
    var _fAno  = typeof getFechAno  === 'function' ? getFechAno()  : [];
    var recAno = typeof getRecAno   === 'function' ? getRecAno()   : 0;
    var meta   = typeof getMeta     === 'function' ? getMeta()     : {};

    var taxaConv = _pAno.length > 0 ? (_fAno.length / _pAno.length) * 100 : 0;
    var valPipe  = _soma(pipeline);

    var hoje = new Date();
    var mes = hoje.getMonth(), ano = hoje.getFullYear();
    var fechMes = ps.filter(function (p) {
      if (FAZ_OK.indexOf(p.fas) < 0) return false;
      var d = p.dtFech ? new Date(p.dtFech + 'T12:00:00') : (p.dat2 ? new Date(p.dat2 + 'T12:00:00') : null);
      return d && d.getMonth() === mes && d.getFullYear() === ano;
    });

    // mês anterior para comparação de tendência
    var mesAnt = mes === 0 ? 11 : mes - 1;
    var anoAnt = mes === 0 ? ano - 1 : ano;
    var fechMesAnt = ps.filter(function (p) {
      if (FAZ_OK.indexOf(p.fas) < 0) return false;
      var d = p.dtFech ? new Date(p.dtFech + 'T12:00:00') : (p.dat2 ? new Date(p.dat2 + 'T12:00:00') : null);
      return d && d.getMonth() === mesAnt && d.getFullYear() === anoAnt;
    });

    return {
      propostas: ps,
      pipeline:   { lista: pipeline,  valor: valPipe,      count: pipeline.length },
      negociacao: { lista: negoc,      count: negoc.length },
      elaboracao: { lista: elabor,     count: elabor.length },
      atrasadas:  { lista: atrasadas,  count: atrasadas.length },
      emPausa:    { lista: emPausa,    count: emPausa.length },
      kpis: {
        taxaConv:    taxaConv,
        recAno:      recAno,
        ticketMedio: pipeline.length > 0 ? valPipe / pipeline.length : 0,
        totalAno:    _pAno.length,
        fechAno:     _fAno.length,
        fechMes:     fechMes.length,
        valFechMes:  _soma(fechMes),
        fechMesAnt:  fechMesAnt.length,
        valFechMesAnt: _soma(fechMesAnt)
      },
      metas: meta || {}
    };
  }

  // ── generateAlerts ────────────────────────────────────────────
  function generateAlerts(data) {
    var al = [];

    var elab15 = data.elaboracao.lista.filter(function (p) {
      var d = _dias(_dataProp(p)); return d !== null && d > 15;
    });
    if (elab15.length) al.push({
      tipo: 'alerta', icone: '📝', impacto: 'alto',
      mensagem: elab15.length + ' proposta' + (elab15.length > 1 ? 's' : '') + ' em elaboração há mais de 15 dias sem envio',
      valor: _soma(elab15), propostas: elab15
    });

    var env7 = data.negociacao.lista.filter(function (p) {
      if (p.fas !== 'enviada') return false;
      var d = _dias(_dataProp(p)); return d !== null && d > 7;
    });
    if (env7.length) al.push({
      tipo: 'alerta', icone: '📤', impacto: 'alto',
      mensagem: env7.length + ' proposta' + (env7.length > 1 ? 's' : '') + ' enviada' + (env7.length > 1 ? 's' : '') + ' há mais de 7 dias sem follow-up',
      valor: _soma(env7), propostas: env7
    });

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

    if (data.atrasadas.count) al.push({
      tipo: 'critico', icone: '⚠️', impacto: 'alto',
      mensagem: data.atrasadas.count + ' proposta' + (data.atrasadas.count > 1 ? 's' : '') + ' em execução com atraso',
      valor: _soma(data.atrasadas.lista), propostas: data.atrasadas.lista
    });

    var pausa30 = data.emPausa.lista.filter(function (p) {
      var d = _dias(_dataProp(p)); return d !== null && d > 30;
    });
    if (pausa30.length) al.push({
      tipo: 'alerta', icone: '⏸️', impacto: 'medio',
      mensagem: pausa30.length + ' proposta' + (pausa30.length > 1 ? 's' : '') + ' em pausa há mais de 30 dias',
      valor: _soma(pausa30), propostas: pausa30
    });

    var metaRec = (typeof n2 === 'function' ? n2((data.metas || {}).rec) : 0) || 0;
    var limiar  = metaRec > 0 ? metaRec * 0.3 : 150000;
    if (data.pipeline.count < 3 || data.pipeline.valor < limiar) al.push({
      tipo: 'alerta', icone: '📉', impacto: 'alto',
      mensagem: 'Pipeline baixo: ' + data.pipeline.count + ' proposta' + (data.pipeline.count !== 1 ? 's' : '') + ' ativa' + (data.pipeline.count !== 1 ? 's' : '') + ' (' + _fmt(data.pipeline.valor) + ')',
      valor: 0, propostas: []
    });

    if (data.kpis.totalAno >= 5 && data.kpis.taxaConv < 25) al.push({
      tipo: 'atencao', icone: '📊', impacto: 'medio',
      mensagem: 'Taxa de conversão baixa: ' + data.kpis.taxaConv.toFixed(1) + '% (' + data.kpis.fechAno + ' de ' + data.kpis.totalAno + ' propostas no ano)',
      valor: 0, propostas: []
    });

    if (data.negociacao.count === 0) al.push({
      tipo: 'atencao', icone: '🧐', impacto: 'baixo',
      mensagem: 'Nenhuma proposta em negociação ativa no momento',
      valor: 0, propostas: []
    });

    var ord = { critico: 0, alto: 1, medio: 2, baixo: 3 };
    al.sort(function (a, b) {
      return (ord[a.tipo === 'critico' ? 'critico' : a.impacto] || 3) -
             (ord[b.tipo === 'critico' ? 'critico' : b.impacto] || 3);
    });
    return al;
  }

  // ── generateDecisions V2 — com score ─────────────────────────
  function generateDecisions(data, alertas) {
    var dec = [];
    var has = function (str) { return alertas.some(function (a) { return a.mensagem.toLowerCase().indexOf(str) >= 0; }); };

    var temAtrasada   = alertas.some(function (a) { return a.tipo === 'critico'; });
    var temFollow     = has('follow-up') || has('sem follow');
    var temElab       = has('elaboração');
    var temPipelineBx = has('pipeline baixo');
    var temPausa      = has('pausa');
    var temConvBx     = has('conversão baixa');

    if (temAtrasada) {
      var vAtr = _soma(data.atrasadas.lista);
      dec.push({
        titulo: '🚨 Resolver propostas atrasadas',
        descricao: 'Contato imediato com ' + data.atrasadas.count + ' cliente' + (data.atrasadas.count > 1 ? 's' : '') + ' para regularizar execução',
        impacto_financeiro_estimado: vAtr,
        impacto_nota: 5,
        urgencia_nota: 5,
        risco_nota: 5,
        score_total: 15,
        prioridade_label: 'Alta',
        motivo: data.atrasadas.count + ' proposta' + (data.atrasadas.count > 1 ? 's' : '') + ' atrasada' + (data.atrasadas.count > 1 ? 's' : '') + ' somando ' + _fmt(vAtr) + ' em risco de cancelamento'
      });
    }

    if (temFollow) {
      var followAlertas = alertas.filter(function (a) { return a.mensagem.toLowerCase().indexOf('follow') >= 0 || a.mensagem.toLowerCase().indexOf('enviada') >= 0; });
      var vFollow = followAlertas.reduce(function (s, a) { return s + (a.valor || 0); }, 0);
      var nFollow = followAlertas.reduce(function (s, a) { return s + (a.propostas ? a.propostas.length : 0); }, 0);
      var notaImp = Math.min(5, Math.max(2, _notaValor(vFollow)));
      dec.push({
        titulo: '📞 Executar follow-ups pendentes',
        descricao: 'Ligar ou enviar mensagem para clientes com ' + (nFollow || 'múltiplas') + ' proposta' + (nFollow !== 1 ? 's' : '') + ' aguardando retorno',
        impacto_financeiro_estimado: vFollow,
        impacto_nota: notaImp,
        urgencia_nota: 5,
        risco_nota: 4,
        score_total: notaImp + 5 + 4,
        prioridade_label: _scoreLabel(notaImp + 9),
        motivo: (nFollow || 'Propostas') + ' proposta' + (nFollow !== 1 ? 's' : '') + ' sem contato há mais de 7 dias, somando ' + _fmt(vFollow) + ' — cada dia reduz a chance de fechamento'
      });
    }

    if (temElab) {
      var elabP = data.elaboracao.lista.filter(function (p) { var d = _dias(_dataProp(p)); return d !== null && d > 15; });
      var vElab = _soma(elabP);
      var notaE = Math.min(5, Math.max(2, _notaValor(vElab)));
      dec.push({
        titulo: '✉️ Enviar propostas em elaboração',
        descricao: elabP.length + ' proposta' + (elabP.length > 1 ? 's' : '') + ' pronta' + (elabP.length > 1 ? 's' : '') + ' parada' + (elabP.length > 1 ? 's' : '') + ' sem envio ao cliente',
        impacto_financeiro_estimado: vElab,
        impacto_nota: notaE,
        urgencia_nota: 4,
        risco_nota: 3,
        score_total: notaE + 4 + 3,
        prioridade_label: _scoreLabel(notaE + 7),
        motivo: elabP.length + ' proposta' + (elabP.length > 1 ? 's' : '') + ' em elaboração há mais de 15 dias (' + _fmt(vElab) + ') — cliente pode buscar concorrente'
      });
    }

    if (temPausa) {
      var p30 = data.emPausa.lista.filter(function (p) { var d = _dias(_dataProp(p)); return d !== null && d > 30; });
      var vP30 = _soma(p30);
      var notaP = Math.min(4, Math.max(2, _notaValor(vP30)));
      dec.push({
        titulo: '▶️ Retomar propostas em pausa',
        descricao: 'Verificar situação com ' + p30.length + ' cliente' + (p30.length > 1 ? 's' : '') + ' e definir próximo passo concreto',
        impacto_financeiro_estimado: vP30,
        impacto_nota: notaP,
        urgencia_nota: 3,
        risco_nota: 3,
        score_total: notaP + 3 + 3,
        prioridade_label: _scoreLabel(notaP + 6),
        motivo: p30.length + ' proposta' + (p30.length > 1 ? 's' : '') + ' travada' + (p30.length > 1 ? 's' : '') + ' há mais de 30 dias (' + _fmt(vP30) + ') sem resolução'
      });
    }

    if (temPipelineBx) {
      dec.push({
        titulo: '🔍 Prospectar novos clientes',
        descricao: 'Pipeline com apenas ' + data.pipeline.count + ' proposta' + (data.pipeline.count !== 1 ? 's' : '') + ' — gerar pelo menos 3 novas oportunidades esta semana',
        impacto_financeiro_estimado: 0,
        impacto_nota: 4,
        urgencia_nota: 3,
        risco_nota: 4,
        score_total: 11,
        prioridade_label: 'Média',
        motivo: 'Pipeline abaixo do mínimo saudável — sem novas entradas o negócio desacelera nas próximas semanas'
      });
    }

    if (temConvBx) {
      dec.push({
        titulo: '🎯 Revisar estratégia de fechamento',
        descricao: 'Analisar objeções mais comuns e ajustar abordagem nos follow-ups',
        impacto_financeiro_estimado: 0,
        impacto_nota: 3,
        urgencia_nota: 2,
        risco_nota: 3,
        score_total: 8,
        prioridade_label: 'Média',
        motivo: 'Conversão de ' + data.kpis.taxaConv.toFixed(1) + '% abaixo de 25% — cada proposta que se perde representa receita que não entra'
      });
    }

    if (!dec.length) {
      dec.push({
        titulo: '✅ Manter ritmo atual',
        descricao: 'Nenhuma ação urgente — foco em avançar as propostas em negociação',
        impacto_financeiro_estimado: data.pipeline.valor,
        impacto_nota: 3,
        urgencia_nota: 2,
        risco_nota: 1,
        score_total: 6,
        prioridade_label: 'Baixa',
        motivo: 'Sistema sem alertas críticos — manter cadência de acompanhamento'
      });
    }

    dec.sort(function (a, b) { return b.score_total - a.score_total; });
    return dec;
  }

  // ── generateOpportunities ─────────────────────────────────────
  function generateOpportunities(data) {
    var ops = [];

    // 1. Maior proposta em negociação (mais quente)
    var negocOrdenadas = data.negociacao.lista.slice().sort(function (a, b) { return _val(b) - _val(a); });
    if (negocOrdenadas.length) {
      var top = negocOrdenadas[0];
      ops.push({
        icone: '🔥',
        titulo: 'Proposta mais quente em negociação',
        descricao: (top.cli || top.loc || 'Cliente') + (top.tit ? ' — ' + top.tit : ''),
        valor: _val(top),
        detalhe: 'Fase: ' + ((window.FASE && window.FASE[top.fas]) ? window.FASE[top.fas].n : top.fas)
      });
    }

    // 2. Fase com mais valor travado (excluindo aprovado/andamento)
    var fasesParadas = ['follow1', 'follow2', 'follow3', 'follow4', 'cliente_analisando', 'enviada'];
    var porFase = {};
    data.negociacao.lista.forEach(function (p) {
      if (fasesParadas.indexOf(p.fas) < 0) return;
      if (!porFase[p.fas]) porFase[p.fas] = { val: 0, cnt: 0 };
      porFase[p.fas].val += _val(p);
      porFase[p.fas].cnt++;
    });
    var faseMaiorVal = Object.keys(porFase).sort(function (a, b) { return porFase[b].val - porFase[a].val; })[0];
    if (faseMaiorVal && porFase[faseMaiorVal].val > 0) {
      var nomeFase = (window.FASE && window.FASE[faseMaiorVal]) ? window.FASE[faseMaiorVal].n : faseMaiorVal;
      ops.push({
        icone: '💰',
        titulo: 'Maior concentração de valor parado',
        descricao: porFase[faseMaiorVal].cnt + ' proposta' + (porFase[faseMaiorVal].cnt > 1 ? 's' : '') + ' na fase "' + nomeFase + '"',
        valor: porFase[faseMaiorVal].val,
        detalhe: 'Desbloquear essas propostas tem alto impacto imediato'
      });
    }

    // 3. Clientes com múltiplas propostas em pipeline (engajamento)
    var porCli = {};
    data.pipeline.lista.forEach(function (p) {
      var cli = ((p.loc || '').trim() || (p.cli || '').trim() || 'N/I');
      if (!porCli[cli]) porCli[cli] = { val: 0, cnt: 0 };
      porCli[cli].val += _val(p);
      porCli[cli].cnt++;
    });
    var cliMultiplos = Object.keys(porCli).filter(function (k) { return porCli[k].cnt > 1; }).sort(function (a, b) { return porCli[b].val - porCli[a].val; });
    if (cliMultiplos.length) {
      var c = cliMultiplos[0];
      ops.push({
        icone: '🤝',
        titulo: 'Cliente com maior relacionamento ativo',
        descricao: c + ' — ' + porCli[c].cnt + ' projetos em execução',
        valor: porCli[c].val,
        detalhe: 'Cliente engajado, potencial para expansão de escopo'
      });
    }

    // 4. Tendência do mês
    var fechAtual = data.kpis.fechMes;
    var fechAnt   = data.kpis.fechMesAnt;
    if (fechAnt > 0) {
      var tendencia = ((fechAtual - fechAnt) / fechAnt) * 100;
      if (tendencia > 0) {
        ops.push({
          icone: '📈',
          titulo: 'Tendência de alta em fechamentos',
          descricao: fechAtual + ' fechamento' + (fechAtual !== 1 ? 's' : '') + ' este mês vs ' + fechAnt + ' no mês anterior',
          valor: data.kpis.valFechMes,
          detalhe: '+' + tendencia.toFixed(0) + '% vs mês anterior — manter o ritmo'
        });
      }
    }

    // 5. Receita vs meta anual
    var metaRec = (typeof n2 === 'function' ? n2((data.metas || {}).rec) : 0) || 0;
    if (metaRec > 0 && data.kpis.recAno > 0) {
      var pct = (data.kpis.recAno / metaRec) * 100;
      if (pct >= 60) {
        ops.push({
          icone: '🎯',
          titulo: 'Meta anual dentro do alcance',
          descricao: pct.toFixed(0) + '% da meta de receita atingida',
          valor: metaRec - data.kpis.recAno,
          detalhe: 'Faltam ' + _fmt(metaRec - data.kpis.recAno) + ' para bater a meta do ano'
        });
      }
    }

    return ops;
  }

  // ── generateWeeklyFocus ───────────────────────────────────────
  function generateWeeklyFocus(decisions) {
    return decisions.slice(0, 3).map(function (d, i) {
      return {
        posicao: i + 1,
        titulo: d.titulo,
        motivo: d.motivo,
        impacto: d.impacto_financeiro_estimado,
        prioridade_label: d.prioridade_label
      };
    });
  }

  // ── generateExecutiveSummary V2 ───────────────────────────────
  function generateExecutiveSummary(data, alertas, decisoes, oportunidades) {
    var meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    var mesAtual = meses[new Date().getMonth()];

    // Texto simples (compatibilidade)
    var partes = [];
    var sit = data.pipeline.count + ' proposta' + (data.pipeline.count !== 1 ? 's' : '') + ' ativa' + (data.pipeline.count !== 1 ? 's' : '') + ' valendo ' + _fmt(data.pipeline.valor) + '.';
    partes.push(sit);
    var criticos = alertas.filter(function (a) { return a.tipo === 'critico' || a.impacto === 'alto'; });
    if (criticos.length) partes.push('Risco: ' + criticos[0].mensagem + '.');
    if (decisoes.length) partes.push('Ação: ' + decisoes[0].titulo.replace(/^[^\s]+\s/, '') + '.');

    // Itens estruturados para exibição em tópicos
    var itens = [];
    itens.push({ icone: '📊', label: 'Pipeline ativo', valor: _fmt(data.pipeline.valor) + ' em ' + data.pipeline.count + ' proposta' + (data.pipeline.count !== 1 ? 's' : '') });
    itens.push({ icone: '⏳', label: 'Em negociação', valor: data.negociacao.count + ' proposta' + (data.negociacao.count !== 1 ? 's' : '') + ' (' + _fmt(_soma(data.negociacao.lista)) + ')' });

    if (data.kpis.fechMes > 0) {
      itens.push({ icone: '✅', label: 'Fechamentos em ' + mesAtual, valor: data.kpis.fechMes + ' negócio' + (data.kpis.fechMes !== 1 ? 's' : '') + ' — ' + _fmt(data.kpis.valFechMes) });
    } else {
      itens.push({ icone: '⚪', label: 'Fechamentos em ' + mesAtual, valor: 'Nenhum ainda' });
    }

    itens.push({ icone: '📈', label: 'Conversão do ano', valor: data.kpis.taxaConv.toFixed(1) + '% (' + data.kpis.fechAno + ' de ' + data.kpis.totalAno + ' propostas)' });
    itens.push({ icone: '💰', label: 'Receita no ano', valor: _fmt(data.kpis.recAno) });

    if (data.atrasadas.count > 0) {
      itens.push({ icone: '🔴', label: 'Risco crítico', valor: data.atrasadas.count + ' proposta' + (data.atrasadas.count !== 1 ? 's' : '') + ' atrasada' + (data.atrasadas.count !== 1 ? 's' : '') + ' — ' + _fmt(_soma(data.atrasadas.lista)) });
    } else if (criticos.length) {
      itens.push({ icone: '🟡', label: 'Atenção', valor: criticos[0].mensagem });
    }

    if (oportunidades.length) {
      itens.push({ icone: '💡', label: 'Oportunidade', valor: oportunidades[0].descricao });
    }

    if (decisoes.length) {
      itens.push({ icone: '⚡', label: 'Ação imediata', valor: decisoes[0].titulo.replace(/^[^\s]+\s/, '') });
    }

    return { texto: partes.join(' '), itens: itens };
  }

  // ── runDecisionEngine ─────────────────────────────────────────
  window.runDecisionEngine = function () {
    var data          = getData();
    var alerts        = generateAlerts(data);
    var decisions     = generateDecisions(data, alerts);
    var opportunities = generateOpportunities(data);
    var weekly_focus  = generateWeeklyFocus(decisions);
    var executive_summary = generateExecutiveSummary(data, alerts, decisions, opportunities);

    var result = {
      alerts:            alerts,
      decisions:         decisions,
      opportunities:     opportunities,
      weekly_focus:      weekly_focus,
      executive_summary: executive_summary.texto,
      executive_items:   executive_summary.itens,
      _data:             data
    };
    window._deResult = result;
    if (typeof renderDecisionEngine === 'function') renderDecisionEngine(result);
    return result;
  };

}());

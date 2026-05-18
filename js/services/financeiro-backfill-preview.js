// ============================================================
// financeiro-backfill-preview.js
// Prévia de migração de dados históricos para o módulo Financeiro.
//
// MODO SOMENTE LEITURA — não insere, não altera, não deleta nada.
// Lê propostas antigas do Supabase, simula a migração e gera
// um relatório de o que seria criado nas tabelas financeiras.
//
// Como usar:
//   1. Abra o console do navegador no portal logado.
//   2. Execute:
//        var preview = await window.FinanceiroBackfillPreview.executar();
//        console.table(preview.relatorio);
//        console.log(preview.resumo);
//   3. Revise o relatório antes de qualquer ação.
//   4. Para confirmar a migração real, uma etapa futura separada
//      será implementada explicitamente.
// ============================================================

(function (window) {
  'use strict';

  // ── helpers ───────────────────────────────────────────────

  function _num(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function _client() {
    if (!window.sbClient) throw new Error('[Backfill] sbClient não conectado.');
    return window.sbClient;
  }

  function _empresaId() {
    var id, fonte;

    if (typeof window.getEmpresaAtivaId === 'function') {
      id = window.getEmpresaAtivaId();
      if (id) { fonte = 'window.getEmpresaAtivaId()'; }
    }

    if (!id && typeof window.getEmpresaAtiva === 'function') {
      var obj = window.getEmpresaAtiva();
      if (obj && obj.id) { id = obj.id; fonte = 'window.getEmpresaAtiva().id'; }
    }

    if (!id && window._empresaAtiva && window._empresaAtiva.id) {
      id = window._empresaAtiva.id;
      fonte = 'window._empresaAtiva.id';
    }

    if (!id) {
      try {
        var salvo = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
        if (salvo && salvo.id) { id = salvo.id; fonte = 'localStorage tf_empresa_ativa'; }
      } catch (e) { /* JSON inválido — ignora */ }
    }

    if (!id) {
      throw new Error(
        '[Backfill] Empresa ativa não encontrada. ' +
        'Verifique se você está logado e com uma empresa selecionada no portal. ' +
        'Fontes tentadas: getEmpresaAtivaId(), getEmpresaAtiva(), window._empresaAtiva, localStorage tf_empresa_ativa.'
      );
    }

    console.debug('[Backfill Financeiro] empresa_id encontrado via', fonte, '→', id);
    return id;
  }

  // ── Status que indicam proposta aprovada/fechada ──────────
  var STATUS_APROVADOS = [
    'aprovado', 'em_execucao', 'faturado', 'recebido',
    'encerrado', 'garantia', 'concluido'
  ];

  // ── Status de faturamento presente na proposta ────────────
  var STATUS_FATURADO = ['faturado', 'recebido', 'encerrado', 'garantia'];


  // ============================================================
  // LEITURA DAS PROPOSTAS
  // ============================================================

  async function _carregarPropostas(empresaId) {
    var r = await _client()
      .from('propostas')
      .select('app_id, numero_proposta, fase, valor_total, dados_json, created_at, updated_at')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: true });

    if (r.error) throw r.error;
    return r.data || [];
  }


  // ============================================================
  // PARSERS DE DADOS DA PROPOSTA
  // ============================================================

  function _parseTl(dadosJson) {
    try {
      var d = typeof dadosJson === 'string' ? JSON.parse(dadosJson) : dadosJson;
      return (d && d.tl) ? d.tl : {};
    } catch (e) {
      return {};
    }
  }

  function _parseDados(dadosJson) {
    try {
      return typeof dadosJson === 'string' ? JSON.parse(dadosJson) : (dadosJson || {});
    } catch (e) {
      return {};
    }
  }

  function _nfs(tl) {
    return Array.isArray(tl.nfs) ? tl.nfs : [];
  }

  function _adiantamentos(tl) {
    return Array.isArray(tl.adiantamentos) ? tl.adiantamentos : [];
  }


  // ============================================================
  // SIMULAÇÃO: o que seria criado para cada proposta
  // ============================================================

  function _simularProposta(proposta) {
    var dados   = _parseDados(proposta.dados_json);
    var tl      = _parseTl(proposta.dados_json);
    var fas     = proposta.fase || dados.fas || '';
    var appId   = proposta.app_id || dados.id || '';

    var nfs           = _nfs(tl);
    var adiantamentos = _adiantamentos(tl);
    var valRecebFinal = _num(tl.valRecebFinal);
    var dtRecebFinal  = tl.dtRecebFinal || null;
    var prazoPgto     = tl.prazoPgto || null;
    var adiantPct     = _num(tl.adiantPct);
    var valContrato   = _num(dados.vS || 0) + _num(dados.vM || 0);

    var totalNF       = nfs.reduce(function (s, nf) { return s + _num(nf.valor); }, 0);
    var totalAdiant   = adiantamentos.reduce(function (s, a) { return s + _num(a.valor); }, 0);
    var totalRecebido = totalAdiant + valRecebFinal;
    var emAberto      = Math.max(0, totalNF - totalRecebido);
    var pctPerdidoRS  = totalNF > 0 ? (emAberto / totalNF * 100) : 0;

    var isAprovado = STATUS_APROVADOS.indexOf(fas) !== -1;
    var isFaturado = STATUS_FATURADO.indexOf(fas) !== -1;

    // ── Inconsistências detectadas ────────────────────────────
    var inconsistencias = [];
    if (isAprovado && valContrato <= 0) {
      inconsistencias.push('proposta aprovada sem valor de contrato');
    }
    if (nfs.length > 0 && valContrato <= 0) {
      inconsistencias.push('NFs registradas mas valor do contrato é zero');
    }
    if (totalRecebido > totalNF && totalNF > 0) {
      inconsistencias.push('total recebido maior que total de NFs emitidas');
    }
    nfs.forEach(function (nf, i) {
      if (!nf.valor || _num(nf.valor) <= 0) {
        inconsistencias.push('NF #' + (i + 1) + ' sem valor');
      }
      if (!nf.data) {
        inconsistencias.push('NF #' + (i + 1) + ' sem data de emissão');
      }
    });
    adiantamentos.forEach(function (a, i) {
      if (!a.valor || _num(a.valor) <= 0) {
        inconsistencias.push('Adiantamento #' + (i + 1) + ' sem valor');
      }
    });

    // ── O que seria criado ────────────────────────────────────

    // 1 conta a receber (se aprovada ou tem NF)
    var criarConta = isAprovado || nfs.length > 0;

    // N notas fiscais (uma por NF)
    var contarNFs = nfs.length;

    // Recebimentos: um por adiantamento + um pelo recebimento final (se houver)
    var contarRecebimentos = 0;
    if (criarConta) {
      adiantamentos.forEach(function (a) {
        if (_num(a.valor) > 0) contarRecebimentos++;
      });
      if (valRecebFinal > 0) contarRecebimentos++;
    }

    // Movimentos de caixa: entrada prevista (contrato) + entradas realizadas
    var contarMovimentos = 0;
    if (criarConta) {
      if (valContrato > 0) contarMovimentos++;       // entrada prevista
      if (totalRecebido > 0) contarMovimentos++;     // entrada realizada agregada
    }

    // Status que seria atribuído à conta a receber
    var statusConta = 'previsto';
    if (isFaturado && emAberto <= 0 && totalNF > 0) {
      statusConta = 'recebido';
    } else if (isFaturado && emAberto > 0 && totalRecebido > 0) {
      statusConta = 'parcialmente_recebido';
    } else if (isFaturado && nfs.length > 0) {
      statusConta = 'faturado';
    } else if (isAprovado) {
      statusConta = 'a_faturar';
    }

    return {
      proposta_app_id:       appId,
      fas:                   fas,
      val_contrato:          valContrato,
      total_nf:              totalNF,
      total_adiant:          totalAdiant,
      val_receb_final:       valRecebFinal,
      total_recebido:        totalRecebido,
      em_aberto:             emAberto,
      pct_perdido_rs:        pctPerdidoRS,
      prazo_pgto:            prazoPgto,
      adiant_pct:            adiantPct,
      qtd_nfs:               nfs.length,
      qtd_adiantamentos:     adiantamentos.length,
      dt_receb_final:        dtRecebFinal,

      // Simulação
      criaria_conta:         criarConta,
      status_conta_previsto: statusConta,
      contarNFs:             contarNFs,
      contarRecebimentos:    contarRecebimentos,
      contarMovimentos:      contarMovimentos,
      inconsistencias:       inconsistencias,
      tem_inconsistencia:    inconsistencias.length > 0
    };
  }


  // ============================================================
  // GERADOR DO RELATÓRIO
  // ============================================================

  function _gerarRelatorio(propostas, simulacoes) {
    var totalContas      = 0;
    var totalNFs         = 0;
    var totalRecebimentos = 0;
    var totalMovimentos  = 0;
    var comInconsistencia = 0;
    var semValor         = 0;
    var totalValorPrevisto = 0;
    var totalValorFaturado = 0;
    var totalValorRecebido = 0;
    var totalEmAberto    = 0;
    var totalPerdidoRS   = 0;

    var linhas = simulacoes.map(function (s) {
      if (s.criaria_conta)    totalContas++;
      totalNFs           += s.contarNFs;
      totalRecebimentos  += s.contarRecebimentos;
      totalMovimentos    += s.contarMovimentos;
      if (s.tem_inconsistencia) comInconsistencia++;
      if (s.val_contrato <= 0) semValor++;

      totalValorPrevisto += s.val_contrato;
      totalValorFaturado += s.total_nf;
      totalValorRecebido += s.total_recebido;
      totalEmAberto      += s.em_aberto;
      totalPerdidoRS     += (s.em_aberto > 0 && s.total_nf > 0 ? s.em_aberto : 0);

      return {
        proposta:           s.proposta_app_id,
        status_atual:       s.fas,
        val_contrato:       s.val_contrato.toFixed(2),
        total_nf:           s.total_nf.toFixed(2),
        total_recebido:     s.total_recebido.toFixed(2),
        em_aberto:          s.em_aberto.toFixed(2),
        pct_perdido_rs:     s.pct_perdido_rs.toFixed(2) + '%',
        qtd_nfs:            s.qtd_nfs,
        qtd_adiant:         s.qtd_adiantamentos,
        criaria_conta:      s.criaria_conta ? 'SIM' : 'nao',
        status_conta:       s.status_conta_previsto,
        nfs_criar:          s.contarNFs,
        receb_criar:        s.contarRecebimentos,
        movimentos_criar:   s.contarMovimentos,
        inconsistencias:    s.inconsistencias.join('; ') || '-'
      };
    });

    var resumo = {
      total_propostas_analisadas:     propostas.length,
      contas_receber_a_criar:         totalContas,
      notas_fiscais_a_criar:          totalNFs,
      recebimentos_a_criar:           totalRecebimentos,
      movimentos_caixa_a_criar:       totalMovimentos,
      propostas_com_inconsistencia:   comInconsistencia,
      propostas_sem_valor_contrato:   semValor,

      valor_total_previsto:           'R$ ' + totalValorPrevisto.toFixed(2),
      valor_total_faturado:           'R$ ' + totalValorFaturado.toFixed(2),
      valor_total_recebido:           'R$ ' + totalValorRecebido.toFixed(2),
      valor_total_em_aberto:          'R$ ' + totalEmAberto.toFixed(2),
      valor_total_perdido_rs:         'R$ ' + totalPerdidoRS.toFixed(2),

      aviso: 'MODO PRÉVIA — nenhum dado foi alterado ou inserido.'
    };

    return { linhas: linhas, resumo: resumo };
  }


  // ============================================================
  // FUNÇÃO PRINCIPAL
  // ============================================================

  /**
   * Executa a prévia do backfill.
   * Retorna { relatorio: [...], resumo: {...} }
   *
   * Exemplo:
   *   var preview = await window.FinanceiroBackfillPreview.executar();
   *   console.table(preview.relatorio);
   *   console.log(preview.resumo);
   */
  async function executar(opcoes) {
    var opts = opcoes || {};
    var empresaId = opts.empresaId || _empresaId();

    console.info('[Backfill Financeiro] Iniciando prévia para empresa:', empresaId);
    console.info('[Backfill Financeiro] MODO SOMENTE LEITURA — nada será alterado.');

    var propostas = await _carregarPropostas(empresaId);
    console.info('[Backfill Financeiro] Propostas carregadas:', propostas.length);

    var simulacoes = propostas.map(function (p) {
      try {
        return _simularProposta(p);
      } catch (e) {
        console.warn('[Backfill Financeiro] Erro ao simular proposta:', p.app_id, e);
        return {
          proposta_app_id: p.app_id || dados && dados.id || '',
          fas: p.fase || '',
          criaria_conta: false,
          contarNFs: 0,
          contarRecebimentos: 0,
          contarMovimentos: 0,
          inconsistencias: ['erro interno: ' + e.message],
          tem_inconsistencia: true,
          val_contrato: 0,
          total_nf: 0,
          total_recebido: 0,
          em_aberto: 0,
          pct_perdido_rs: 0,
          status_conta_previsto: '-'
        };
      }
    });

    var resultado = _gerarRelatorio(propostas, simulacoes);

    console.info('[Backfill Financeiro] Prévia concluída.');
    console.info('[Backfill Financeiro] Resumo:', resultado.resumo);
    console.info('[Backfill Financeiro] Use console.table(preview.relatorio) para ver linha a linha.');

    return {
      relatorio: resultado.linhas,
      resumo: resultado.resumo,
      simulacoes_raw: simulacoes
    };
  }


  // ============================================================
  // EXPOSIÇÃO PÚBLICA
  // ============================================================

  window.FinanceiroBackfillPreview = {
    executar: executar,
    // Expõe helpers para inspeção manual no console
    _simularProposta: _simularProposta,
    _parseTl: _parseTl
  };

  console.info('[FinanceiroBackfillPreview] Carregado. Execute: window.FinanceiroBackfillPreview.executar()');

}(window));

// ============================================================
// supabase-financeiro.js
// Camada de acesso ao Supabase para o módulo Financeiro.
// Fonte oficial de contas a receber, NFs, recebimentos,
// movimentos de caixa e saldos de caixa.
//
// Padrão: IIFE, window.sbClient, sem dependência de outros módulos.
// Não altera dados do Comercial, Operacional ou RH.
// ============================================================
(function (window) {
  'use strict';

  // ── helpers internos ──────────────────────────────────────

  function client() {
    if (!window.sbClient) throw new Error('[Financeiro] sbClient não conectado.');
    return window.sbClient;
  }

  function _num(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function _hoje() {
    return new Date().toISOString().slice(0, 10);
  }

  function _empresaFiltro(dados) {
    return dados && dados.empresa_id ? String(dados.empresa_id) : '';
  }

  function _payloadSemEmpresa(dados) {
    var payload = Object.assign({}, dados || {});
    delete payload.id;
    delete payload.empresa_id;
    return payload;
  }

  function _aplicarEmpresaFiltro(query, empresaId) {
    return empresaId ? query.eq('empresa_id', empresaId) : query;
  }


  // ============================================================
  // CONTAS A RECEBER
  // ============================================================

  /**
   * Lista todas as contas a receber da empresa.
   * Retorna ordenado por data_vencimento asc, nulls last.
   */
  async function sbListarContasReceber(empresaId) {
    var r = await client()
      .from('financeiro_contas_receber')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data_vencimento', { ascending: true, nullsFirst: false });

    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Busca resumo financeiro de uma proposta específica.
   * Retorna a conta a receber principal + NFs + recebimentos associados.
   */
  async function sbBuscarResumoFinanceiroProposta(empresaId, propostaAppId) {
    var rConta = await client()
      .from('financeiro_contas_receber')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('proposta_app_id', propostaAppId)
      .maybeSingle();

    if (rConta.error) throw rConta.error;
    if (!rConta.data) return null;

    var conta = rConta.data;
    var notas = await sbListarNotasFiscaisConta(empresaId, conta.id);
    var recebimentos = await sbListarRecebimentosConta(empresaId, conta.id);

    return calcularResumoFinanceiroConta(conta, notas, recebimentos);
  }

  /**
   * Busca resumo financeiro de uma obra específica.
   */
  async function sbBuscarResumoFinanceiroObra(empresaId, obraId) {
    var rConta = await client()
      .from('financeiro_contas_receber')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('obra_id', obraId)
      .maybeSingle();

    if (rConta.error) throw rConta.error;
    if (!rConta.data) return null;

    var conta = rConta.data;
    var notas = await sbListarNotasFiscaisConta(empresaId, conta.id);
    var recebimentos = await sbListarRecebimentosConta(empresaId, conta.id);

    return calcularResumoFinanceiroConta(conta, notas, recebimentos);
  }

  /**
   * Cria uma nova conta a receber.
   * dados: { empresa_id, proposta_app_id?, obra_id?, titulo, valor_previsto, ... }
   */
  async function sbCriarContaReceber(dados) {
    if (!dados.empresa_id) throw new Error('[Financeiro] empresa_id obrigatório.');
    if (!dados.titulo) throw new Error('[Financeiro] titulo obrigatório.');

    var payload = Object.assign({
      status: 'previsto',
      valor_previsto: 0,
      valor_faturado: 0,
      valor_recebido: 0,
      valor_pendente: 0
    }, dados);

    var r = await client()
      .from('financeiro_contas_receber')
      .insert(payload)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }

  /**
   * Atualiza campos de uma conta a receber existente.
   * id: uuid da conta
   * dados: campos a atualizar
   */
  async function sbAtualizarContaReceber(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro] id obrigatório para atualizar.');

    var q = client()
      .from('financeiro_contas_receber')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();

    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarCategoriaGerencialContaReceber(id, empresaId, categoriaGerencialId) {
    if (!id) throw new Error('[Financeiro F3.6-C] id obrigatorio para atualizar categoria da conta a receber.');
    if (!empresaId) throw new Error('[Financeiro F3.6-C] empresa_id obrigatorio para atualizar categoria da conta a receber.');

    var r = await client()
      .from('financeiro_contas_receber')
      .update({
        categoria_gerencial_id: categoriaGerencialId || null
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }


  // ============================================================
  // NOTAS FISCAIS
  // ============================================================

  /**
   * Lista todas as NFs de uma conta a receber.
   */
  async function sbListarNotasFiscaisConta(empresaId, contaReceberId) {
    var r = await client()
      .from('financeiro_notas_fiscais')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('conta_receber_id', contaReceberId)
      .order('data_emissao', { ascending: true });

    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Lista TODAS as NFs da empresa (F2C — tela de Notas Fiscais).
   * Inclui dados da conta a receber vinculada via FK (join embutido).
   * Se o join falhar (FK não configurada), faz fallback sem join.
   */
  async function sbListarNotasFiscaisEmpresa(empresaId) {
    // Tenta com join na conta a receber
    var r = await client()
      .from('financeiro_notas_fiscais')
      .select([
        'id', 'empresa_id', 'conta_receber_id', 'proposta_app_id',
        'numero_nf', 'tipo_nf', 'data_emissao', 'valor_nf',
        'status', 'observacoes', 'created_at',
        'conta_receber:conta_receber_id(id, empresa_id, titulo, cliente_nome, proposta_app_id, obra_id, centro_custo, valor_previsto, valor_recebido, valor_pendente, data_vencimento, status)'
      ].join(','))
      .eq('empresa_id', empresaId)
      .order('data_emissao', { ascending: false, nullsFirst: false });

    if (r.error) {
      // Fallback sem join — retorna NFs simples
      console.warn('[sbFinanceiro] join conta_receber falhou, fallback simples:', r.error.message);
      var r2 = await client()
        .from('financeiro_notas_fiscais')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('data_emissao', { ascending: false, nullsFirst: false });
      if (r2.error) throw r2.error;
      return r2.data || [];
    }
    return r.data || [];
  }

  /**
   * Cria uma nova NF vinculada a uma conta a receber.
   */
  async function sbCriarNotaFiscal(dados) {
    if (!dados.empresa_id) throw new Error('[Financeiro] empresa_id obrigatório.');
    if (!dados.conta_receber_id) throw new Error('[Financeiro] conta_receber_id obrigatório.');

    var payload = Object.assign({
      status: 'emitida',
      valor_nf: 0
    }, dados);

    var r = await client()
      .from('financeiro_notas_fiscais')
      .insert(payload)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }

  /**
   * Atualiza campos de uma nota fiscal existente.
   * id: uuid da NF
   * dados: campos a atualizar (nunca altera empresa_id nem conta_receber_id)
   */
  async function sbAtualizarNotaFiscal(id, dados) {
    var empresaId = _empresaFiltro(dados);
    if (!id) throw new Error('[Financeiro] id obrigatório para atualizar NF.');

    // Garantia: nunca permite alterar empresa_id ou conta_receber_id por esta função
    var payload = _payloadSemEmpresa(dados);
    delete payload.conta_receber_id;
    delete payload.id;

    var q = client()
      .from('financeiro_notas_fiscais')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();

    if (r.error) throw r.error;
    return r.data;
  }


  // ============================================================
  // RECEBIMENTOS
  // ============================================================

  /**
   * Lista todos os recebimentos de uma conta a receber.
   */
  async function sbListarRecebimentosConta(empresaId, contaReceberId) {
    var r = await client()
      .from('financeiro_recebimentos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('conta_receber_id', contaReceberId)
      .order('data_recebimento', { ascending: true });

    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Registra um novo recebimento.
   */
  async function sbCriarRecebimento(dados) {
    if (!dados.empresa_id) throw new Error('[Financeiro] empresa_id obrigatório.');
    if (!dados.conta_receber_id) throw new Error('[Financeiro] conta_receber_id obrigatório.');

    var payload = Object.assign({
      status: 'confirmado',
      risco_sacado: false,
      valor_perdido_risco_sacado: 0,
      percentual_perdido_risco_sacado: 0,
      valor_recebido: 0
    }, dados);

    var r = await client()
      .from('financeiro_recebimentos')
      .insert(payload)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }

  async function sbRegistrarRecebimentoContaReceber(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.9-D] empresa_id obrigatorio.');
    if (!dados.conta_receber_id) throw new Error('[Financeiro F3.9-D] conta_receber_id obrigatorio.');
    if (!dados.data_recebimento) throw new Error('[Financeiro F3.9-D] data_recebimento obrigatoria.');
    if (_num(dados.valor_recebido) <= 0) throw new Error('[Financeiro F3.9-D] valor_recebido deve ser maior que zero.');
    if (!dados.meio_pagamento_id) throw new Error('[Financeiro F3.9-D] meio_pagamento_id obrigatorio.');
    if (!dados.fonte_financeira_id) throw new Error('[Financeiro F3.9-D] fonte_financeira_id obrigatorio.');

    var r = await client().rpc('financeiro_registrar_recebimento_conta_receber', {
      p_empresa_id: dados.empresa_id,
      p_conta_receber_id: dados.conta_receber_id,
      p_valor_recebido: _num(dados.valor_recebido),
      p_data_recebimento: dados.data_recebimento,
      p_meio_pagamento_id: dados.meio_pagamento_id,
      p_fonte_financeira_id: dados.fonte_financeira_id,
      p_observacao: dados.observacao || null,
      p_comprovante_url: dados.comprovante_url || null
    });

    if (r.error) throw r.error;
    return r.data;
  }


  // ============================================================
  // CÁLCULOS LOCAIS (sem chamada ao banco)
  // ============================================================

  /**
   * Calcula o resumo financeiro completo de uma conta a receber,
   * suas NFs e seus recebimentos.
   *
   * Retorna objeto com:
   *   conta, notas, recebimentos,
   *   totalNF, totalRecebido, totalAdiant, saldoPendente,
   *   emAberto, pctRecebido, pctPerdidoRS,
   *   temRiscoSacado, totalPerdidoRS
   */
  function calcularResumoFinanceiroConta(conta, notas, recebimentos) {
    var totalNF = (notas || []).reduce(function (s, nf) {
      return nf.status !== 'cancelada' ? s + _num(nf.valor_nf) : s;
    }, 0);

    var totalRecebido = (recebimentos || []).reduce(function (s, r) {
      return r.status !== 'estornado' ? s + _num(r.valor_recebido) : s;
    }, 0);

    var totalPerdidoRS = (recebimentos || []).reduce(function (s, r) {
      return r.risco_sacado && r.status !== 'estornado'
        ? s + _num(r.valor_perdido_risco_sacado)
        : s;
    }, 0);

    var emAberto = Math.max(0, totalNF - totalRecebido);
    var pctRecebido = totalNF > 0 ? (totalRecebido / totalNF * 100) : 0;
    var pctPerdidoRS = totalNF > 0 ? (totalPerdidoRS / totalNF * 100) : 0;
    var saldoPendente = Math.max(0, _num(conta.valor_previsto) - totalRecebido);

    return {
      conta: conta,
      notas: notas || [],
      recebimentos: recebimentos || [],
      totalNF: totalNF,
      totalRecebido: totalRecebido,
      totalPerdidoRS: totalPerdidoRS,
      emAberto: emAberto,
      saldoPendente: saldoPendente,
      pctRecebido: pctRecebido,
      pctPerdidoRS: pctPerdidoRS,
      temRiscoSacado: totalPerdidoRS > 0
    };
  }

  /**
   * Calcula os cards financeiros básicos a partir de uma lista
   * de resumos de contas a receber.
   *
   * Entrada: array de objetos retornados por calcularResumoFinanceiroConta()
   * Retorna os valores para:
   *   Saldo de Caixa Atual / Cash Position
   *   Entradas Previstas / Forecasted Inflows
   *   Entradas Realizadas / Actual Inflows
   *   Saldo Projetado / Projected Cash Balance
   *   Caixa Comprometido / Committed Cash (NF emitida não recebida)
   *   Caixa Livre / Free Cash
   *   Previsto x Realizado (%)
   */
  function calcularCardsFinanceirosBasicos(resumos) {
    var totalPrevisto = 0;
    var totalFaturado = 0;
    var totalRecebido = 0;
    var totalEmAberto = 0;
    var totalPerdidoRS = 0;

    (resumos || []).forEach(function (r) {
      totalPrevisto  += _num(r.conta.valor_previsto);
      totalFaturado  += r.totalNF;
      totalRecebido  += r.totalRecebido;
      totalEmAberto  += r.emAberto;
      totalPerdidoRS += r.totalPerdidoRS;
    });

    var saldoProjetado   = totalRecebido + totalEmAberto;
    var caixaComprometido = totalEmAberto;
    var caixaLivre        = totalRecebido;
    var pctPrevisto       = totalPrevisto > 0
      ? (totalRecebido / totalPrevisto * 100)
      : 0;

    return {
      // Cash Position
      entradas_realizadas: totalRecebido,

      // Forecasted Inflows
      entradas_previstas: totalPrevisto,

      // Faturado (NF emitida)
      total_faturado: totalFaturado,

      // Em aberto (NF emitida mas não recebida)
      caixa_comprometido: caixaComprometido,

      // Disponível
      caixa_livre: caixaLivre,

      // Projeção se tudo em aberto entrar
      saldo_projetado: saldoProjetado,

      // Risco Sacado
      total_perdido_risco_sacado: totalPerdidoRS,

      // Previsto × Realizado
      pct_realizado_vs_previsto: pctPrevisto
    };
  }


  /**
   * Lista TODOS os recebimentos da empresa (F2D — tela de Recebimentos).
   * Inclui dados da conta a receber vinculada e da NF vinculada à mesma conta.
   * Se o join falhar, faz fallback sem join.
   */
  async function sbListarRecebimentosEmpresa(empresaId) {
    // Tenta com join em conta_receber
    var r = await client()
      .from('financeiro_recebimentos')
      .select([
        'id', 'empresa_id', 'conta_receber_id', 'data_recebimento',
        'valor_recebido', 'status', 'risco_sacado',
        'valor_perdido_risco_sacado', 'percentual_perdido_risco_sacado',
        'observacoes', 'created_at',
        'conta_receber:conta_receber_id(' +
          'id, empresa_id, titulo, cliente_nome, proposta_app_id, obra_id, centro_custo,' +
          'valor_previsto, valor_recebido, valor_pendente, data_vencimento, status' +
        ')'
      ].join(','))
      .eq('empresa_id', empresaId)
      .order('data_recebimento', { ascending: false, nullsFirst: false });

    if (r.error) {
      console.warn('[sbFinanceiro] join conta_receber em recebimentos falhou, fallback:', r.error.message);
      var r2 = await client()
        .from('financeiro_recebimentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('data_recebimento', { ascending: false, nullsFirst: false });
      if (r2.error) throw r2.error;
      return r2.data || [];
    }
    return r.data || [];
  }

  /**
   * Lista NFs vinculadas a uma conta a receber específica (usado no detalhe de recebimento).
   * Reutiliza sbListarNotasFiscaisConta com alias.
   */
  async function sbListarNFsDaConta(empresaId, contaReceberId) {
    return sbListarNotasFiscaisConta(empresaId, contaReceberId);
  }


  // ============================================================
  // MOVIMENTOS DE CAIXA
  // ============================================================

  /**
   * Lista movimentos de caixa da empresa em um período.
   * dataInicio e dataFim no formato 'YYYY-MM-DD' (opcional).
   */
  async function sbListarMovimentosCaixa(empresaId, dataInicio, dataFim) {
    var query = client()
      .from('financeiro_movimentos_caixa')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data_prevista', { ascending: true });

    if (dataInicio) query = query.gte('data_prevista', dataInicio);
    if (dataFim)    query = query.lte('data_prevista', dataFim);

    var r = await query;
    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Lista movimentos realizados para a DRE Gerencial por Plano.
   * Usa data_real e nao cria/atualiza nenhum dado financeiro.
   */
  async function sbListarMovimentosDREGerencial(empresaId, dataInicio, dataFim) {
    if (!empresaId) throw new Error('[Financeiro F3.11-B] empresa_id obrigatorio.');
    var query = client()
      .from('financeiro_movimentos_caixa')
      .select('id, empresa_id, tipo, natureza, origem, referencia_id, data_prevista, data_real, valor_previsto, valor_real, status, categoria, centro_custo, descricao, categoria_gerencial_id')
      .eq('empresa_id', empresaId)
      .eq('natureza', 'realizado')
      .eq('status', 'realizado')
      .order('data_real', { ascending: true });

    if (dataInicio) query = query.gte('data_real', dataInicio);
    if (dataFim)    query = query.lte('data_real', dataFim);

    var r = await query;
    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Registra um movimento de caixa manualmente.
   */
  async function sbCriarMovimentoCaixa(dados) {
    if (!dados.empresa_id) throw new Error('[Financeiro] empresa_id obrigatório.');
    if (!dados.tipo) throw new Error('[Financeiro] tipo (entrada|saida) obrigatório.');

    var payload = Object.assign({
      natureza: 'previsto',
      status: 'previsto',
      conciliado: false,
      valor_previsto: 0,
      valor_real: 0
    }, dados);

    var r = await client()
      .from('financeiro_movimentos_caixa')
      .insert(payload)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }


  // ============================================================
  // SALDOS DE CAIXA
  // ============================================================

  /**
   * Busca o saldo de caixa mais recente da empresa.
   */
  async function sbBuscarSaldoCaixaAtual(empresaId) {
    var r = await client()
      .from('financeiro_saldos_caixa')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data_referencia', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (r.error) throw r.error;
    return r.data || null;
  }

  /**
   * Upsert do saldo de caixa de uma data de referência.
   * Usa UNIQUE(empresa_id, data_referencia) para evitar duplicidade.
   */
  async function sbUpsertSaldoCaixa(empresaId, dataReferencia, dados) {
    var payload = Object.assign({
      empresa_id: empresaId,
      data_referencia: dataReferencia
    }, dados);

    var r = await client()
      .from('financeiro_saldos_caixa')
      .upsert(payload, { onConflict: 'empresa_id,data_referencia' })
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }


  // ============================================================
  // CONTAS A PAGAR
  // ============================================================

  /**
   * Lista todas as contas a pagar da empresa.
   * Retorna ordenado por data_vencimento asc, nulls last.
   */
  async function sbListarContasPagar(empresaId) {
    var r = await client()
      .from('financeiro_contas_pagar')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data_vencimento', { ascending: true, nullsFirst: false });

    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Cria uma nova conta a pagar.
   * dados: { empresa_id, descricao, valor_previsto, data_vencimento, ... }
   */
  async function sbCriarContaPagar(dados) {
    if (!dados.empresa_id) throw new Error('[Financeiro] empresa_id obrigatório.');
    if (!dados.descricao)  throw new Error('[Financeiro] descricao obrigatória.');

    var pendente = _num(dados.valor_previsto) - _num(dados.valor_pago || 0);
    var payload = Object.assign({
      status: 'em_aberto',
      valor_previsto: 0,
      valor_pago: 0,
      valor_pendente: Math.max(0, pendente),
      origem: 'manual'
    }, dados, {
      // recalcular valor_pendente com base no payload final
      valor_pendente: Math.max(0, _num(dados.valor_previsto || 0) - _num(dados.valor_pago || 0))
    });

    var r = await client()
      .from('financeiro_contas_pagar')
      .insert(payload)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }

  /**
   * Atualiza campos de uma conta a pagar existente.
   */
  async function sbAtualizarContaPagar(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro] id obrigatório para atualizar.');

    // Recalcular valor_pendente se valor_previsto ou valor_pago mudou
    if (payload.valor_previsto !== undefined || payload.valor_pago !== undefined) {
      // Os valores atuais precisam vir no payload para recalcular
      payload.valor_pendente = Math.max(0, _num(payload.valor_previsto || 0) - _num(payload.valor_pago || 0));
    }

    var q = client()
      .from('financeiro_contas_pagar')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();

    if (r.error) throw r.error;
    return r.data;
  }


  // ============================================================
  // F4A — DRE GERENCIAL: QUERIES COM FILTRO DE PERÍODO
  // Funções novas — não alteram nenhuma função existente.
  // ============================================================

  // ============================================================
  // PAGAMENTOS AUXILIARES DE CONTAS A PAGAR (F3.5-B)
  // ============================================================

  async function sbAtualizarCategoriaGerencialContaPagar(id, empresaId, categoriaGerencialId) {
    if (!id) throw new Error('[Financeiro F3.6-C] id obrigatorio para atualizar categoria da conta a pagar.');
    if (!empresaId) throw new Error('[Financeiro F3.6-C] empresa_id obrigatorio para atualizar categoria da conta a pagar.');

    var r = await client()
      .from('financeiro_contas_pagar')
      .update({
        categoria_gerencial_id: categoriaGerencialId || null
      })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarPagamentosContaPagar(empresaId, contaPagarId) {
    if (!empresaId) throw new Error('[Financeiro F3.5-B] empresa_id obrigatorio.');
    if (!contaPagarId) throw new Error('[Financeiro F3.5-B] conta_pagar_id obrigatorio.');

    var r = await client()
      .from('financeiro_pagamentos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('conta_pagar_id', contaPagarId)
      .order('data_pagamento', { ascending: false })
      .order('created_at', { ascending: false });

    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbCriarPagamentoContaPagar(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.5-B] empresa_id obrigatorio.');
    if (!dados.conta_pagar_id) throw new Error('[Financeiro F3.5-B] conta_pagar_id obrigatorio.');
    if (!dados.data_pagamento) throw new Error('[Financeiro F3.5-B] data_pagamento obrigatoria.');
    if (_num(dados.valor_pago) <= 0) throw new Error('[Financeiro F3.5-B] valor_pago deve ser maior que zero.');

    var payload = Object.assign({
      status: 'registrado',
      origem: 'manual'
    }, dados);

    var r = await client()
      .from('financeiro_pagamentos')
      .insert(payload)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }

  async function sbRegistrarBaixaContaPagar(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.8-D] empresa_id obrigatorio.');
    if (!dados.conta_pagar_id) throw new Error('[Financeiro F3.8-D] conta_pagar_id obrigatorio.');
    if (!dados.data_pagamento) throw new Error('[Financeiro F3.8-D] data_pagamento obrigatoria.');
    if (_num(dados.valor_pago) <= 0) throw new Error('[Financeiro F3.8-D] valor_pago deve ser maior que zero.');
    if (!dados.meio_pagamento_id) throw new Error('[Financeiro F3.8-D] meio_pagamento_id obrigatorio.');
    if (!dados.fonte_financeira_id) throw new Error('[Financeiro F3.8-D] fonte_financeira_id obrigatorio.');

    var r = await client().rpc('financeiro_registrar_baixa_conta_pagar', {
      p_empresa_id: dados.empresa_id,
      p_conta_pagar_id: dados.conta_pagar_id,
      p_valor_pago: _num(dados.valor_pago),
      p_data_pagamento: dados.data_pagamento,
      p_meio_pagamento_id: dados.meio_pagamento_id,
      p_fonte_financeira_id: dados.fonte_financeira_id,
      p_observacao: dados.observacao || null,
      p_comprovante_url: dados.comprovante_url || null
    });

    if (r.error) throw r.error;
    return r.data;
  }

  async function sbConciliarMovimentoCaixa(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.12-C] empresa_id obrigatorio.');
    if (!dados.movimento_caixa_id) throw new Error('[Financeiro F3.12-C] movimento_caixa_id obrigatorio.');
    if (!dados.data_conciliacao) throw new Error('[Financeiro F3.12-C] data_conciliacao obrigatoria.');

    var r = await client().rpc('financeiro_conciliar_movimento_caixa', {
      p_empresa_id: dados.empresa_id,
      p_movimento_caixa_id: dados.movimento_caixa_id,
      p_fonte_financeira_id: dados.fonte_financeira_id || null,
      p_meio_pagamento_id: dados.meio_pagamento_id || null,
      p_data_conciliacao: dados.data_conciliacao,
      p_observacao: dados.observacao || null,
      p_comprovante_url: dados.comprovante_url || null,
      p_identificador_bancario: dados.identificador_bancario || null
    });

    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarConciliacaoMovimento(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.12-G] empresa_id obrigatorio.');
    if (!dados.movimento_caixa_id) throw new Error('[Financeiro F3.12-G] movimento_caixa_id obrigatorio.');

    var r = await client()
      .from('financeiro_conciliacoes_movimentos')
      .select('id, empresa_id, movimento_caixa_id, fonte_financeira_id, meio_pagamento_id, data_conciliacao, observacao, comprovante_url, identificador_bancario, status, created_by, created_at, updated_at')
      .eq('empresa_id', dados.empresa_id)
      .eq('movimento_caixa_id', dados.movimento_caixa_id)
      .maybeSingle();

    if (r.error) throw r.error;
    if (!r.data) return null;

    var conc = r.data;
    var consultas = [];
    consultas.push(conc.fonte_financeira_id
      ? client()
        .from('financeiro_fontes_financeiras')
        .select('id, empresa_id, nome, tipo, ativo')
        .eq('empresa_id', dados.empresa_id)
        .eq('id', conc.fonte_financeira_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }));
    consultas.push(conc.meio_pagamento_id
      ? client()
        .from('financeiro_meios_pagamento')
        .select('id, empresa_id, nome, tipo, natureza, ativo')
        .eq('empresa_id', dados.empresa_id)
        .eq('id', conc.meio_pagamento_id)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }));

    var extras = await Promise.all(consultas);
    if (extras[0] && extras[0].error) throw extras[0].error;
    if (extras[1] && extras[1].error) throw extras[1].error;
    conc.fonte_financeira = extras[0] ? extras[0].data : null;
    conc.meio_pagamento = extras[1] ? extras[1].data : null;
    return conc;
  }

  async function sbListarConciliacoesFinanceiras(empresaId, filtros) {
    if (!empresaId) throw new Error('[Financeiro F3.13-I] empresa_id obrigatorio.');
    filtros = filtros || {};
    var dataInicio = filtros.dataInicio || filtros.data_inicio || null;
    var dataFim = filtros.dataFim || filtros.data_fim || null;

    var query = client()
      .from('financeiro_conciliacoes_movimentos')
      .select('id, empresa_id, movimento_caixa_id, fonte_financeira_id, meio_pagamento_id, data_conciliacao, observacao, comprovante_url, identificador_bancario, status, created_by, created_at, updated_at')
      .eq('empresa_id', empresaId)
      .order('data_conciliacao', { ascending: true })
      .order('created_at', { ascending: true });

    if (dataInicio) query = query.gte('data_conciliacao', dataInicio);
    if (dataFim)    query = query.lte('data_conciliacao', dataFim);

    var r = await query;
    if (r.error) throw r.error;
    var conciliacoes = r.data || [];
    if (!conciliacoes.length) return [];

    function idsUnicos(campo) {
      var mapa = {};
      conciliacoes.forEach(function(c) {
        if (c && c[campo]) mapa[String(c[campo])] = true;
      });
      return Object.keys(mapa);
    }

    function mapaPorId(lista) {
      var mapa = {};
      (lista || []).forEach(function(item) {
        if (item && item.id) mapa[String(item.id)] = item;
      });
      return mapa;
    }

    var movimentoIds = idsUnicos('movimento_caixa_id');
    var fonteIds = idsUnicos('fonte_financeira_id');
    var meioIds = idsUnicos('meio_pagamento_id');

    var consultas = [];
    consultas.push(movimentoIds.length
      ? client()
        .from('financeiro_movimentos_caixa')
        .select('*')
        .eq('empresa_id', empresaId)
        .in('id', movimentoIds)
      : Promise.resolve({ data: [], error: null }));
    consultas.push(fonteIds.length
      ? client()
        .from('financeiro_fontes_financeiras')
        .select('id, empresa_id, nome, tipo, ativo')
        .eq('empresa_id', empresaId)
        .in('id', fonteIds)
      : Promise.resolve({ data: [], error: null }));
    consultas.push(meioIds.length
      ? client()
        .from('financeiro_meios_pagamento')
        .select('id, empresa_id, nome, tipo, natureza, ativo')
        .eq('empresa_id', empresaId)
        .in('id', meioIds)
      : Promise.resolve({ data: [], error: null }));

    var res = await Promise.all(consultas);
    if (res[0] && res[0].error) throw res[0].error;
    if (res[1] && res[1].error) throw res[1].error;
    if (res[2] && res[2].error) throw res[2].error;

    var movimentos = mapaPorId(res[0] ? res[0].data : []);
    var fontes = mapaPorId(res[1] ? res[1].data : []);
    var meios = mapaPorId(res[2] ? res[2].data : []);

    return conciliacoes.map(function(c) {
      var item = Object.assign({}, c);
      item.movimento_caixa = movimentos[String(c.movimento_caixa_id)] || null;
      item.fonte_financeira = c.fonte_financeira_id ? (fontes[String(c.fonte_financeira_id)] || null) : null;
      item.meio_pagamento = c.meio_pagamento_id ? (meios[String(c.meio_pagamento_id)] || null) : null;
      return item;
    });
  }


  /**
   * Lista contas a receber da empresa filtradas por data_vencimento.
   * Retorna apenas os campos necessários para o cálculo da DRE.
   */
  async function sbListarContasReceberPeriodo(empresaId, dataInicio, dataFim) {
    if (!empresaId) throw new Error('[Financeiro F4A] empresa_id obrigatório.');
    var query = client()
      .from('financeiro_contas_receber')
      .select('valor_previsto, valor_faturado, valor_recebido, valor_pendente, status, data_vencimento')
      .eq('empresa_id', empresaId);
    if (dataInicio) query = query.gte('data_vencimento', dataInicio);
    if (dataFim)    query = query.lte('data_vencimento', dataFim);
    var r = await query;
    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Lista recebimentos da empresa filtrados por data_recebimento.
   * Retorna apenas os campos necessários para o cálculo da DRE.
   */
  async function sbListarRecebimentosPeriodo(empresaId, dataInicio, dataFim) {
    if (!empresaId) throw new Error('[Financeiro F4A] empresa_id obrigatório.');
    var query = client()
      .from('financeiro_recebimentos')
      .select('valor_recebido, status, data_recebimento')
      .eq('empresa_id', empresaId);
    if (dataInicio) query = query.gte('data_recebimento', dataInicio);
    if (dataFim)    query = query.lte('data_recebimento', dataFim);
    var r = await query;
    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Lista TODAS as contas a pagar da empresa (sem filtro de data no banco).
   * O filtro de período é aplicado em JS por calcularDREGerencial():
   *   — contas pagas  → usa data_pagamento (ou data_vencimento como fallback)
   *   — contas abertas → usa data_vencimento
   * Isso evita query com OR em colunas diferentes.
   */
  async function sbListarContasPagarPeriodo(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F4A] empresa_id obrigatório.');
    var r = await client()
      .from('financeiro_contas_pagar')
      .select('valor_previsto, valor_pago, valor_pendente, status, data_vencimento, data_pagamento, categoria')
      .eq('empresa_id', empresaId);
    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Calcula o DRE Gerencial a partir das listas carregadas.
   * Aplica filtro de período em JS conforme regra de cada tabela.
   *
   * Fórmulas:
   *   Receita Bruta      = SUM(contas.valor_previsto)          onde data_vencimento no período
   *   Recebido           = SUM(recebimentos.valor_recebido)    onde data_recebimento no período e status ≠ estornado
   *   A Receber          = SUM(contas.valor_pendente)          onde data_vencimento no período e status ≠ recebido/cancelado
   *   Contas Pagas       = SUM(cp.valor_pago)                  onde status pago/parcial e data_pagamento (ou data_vencimento) no período
   *   Contas a Pagar     = SUM(cp.valor_pendente)              onde status ≠ pago/cancelado e data_vencimento no período
   *   Caixa Livre        = Recebido − Contas a Pagar
   *   Resultado Gerencial= Recebido − Contas Pagas
   *   Margem Gerencial   = Resultado / Receita Bruta × 100  (null se Receita = 0)
   */
  function calcularDREGerencial(contas, recebimentos, contasPagar, dataInicio, dataFim) {
    // Helper: valor numérico seguro
    function n(v) { return parseFloat(v) || 0; }

    // Helper: data ISO (YYYY-MM-DD) está dentro do período?
    // Se não há período definido, inclui tudo.
    function noPeriodo(data) {
      if (!data) return false; // sem data = exclui do período filtrado
      var d = String(data).slice(0, 10);
      if (dataInicio && d < dataInicio) return false;
      if (dataFim    && d > dataFim)    return false;
      return true;
    }

    // Receita Bruta: contas a receber com data_vencimento no período (excl. cancelado)
    var receitaBruta = 0;
    (contas || []).forEach(function(c) {
      if ((c.status || '').toLowerCase() === 'cancelado') return;
      if (noPeriodo(c.data_vencimento)) receitaBruta += n(c.valor_previsto);
    });

    // A Receber: contas pendentes (excl. recebido/cancelado) com data_vencimento no período
    var aReceber = 0;
    (contas || []).forEach(function(c) {
      var st = (c.status || '').toLowerCase();
      if (st === 'recebido' || st === 'cancelado') return;
      if (noPeriodo(c.data_vencimento)) aReceber += n(c.valor_pendente);
    });

    // Recebido: recebimentos confirmados com data_recebimento no período
    var recebido = 0;
    (recebimentos || []).forEach(function(r) {
      if ((r.status || '') === 'estornado') return;
      if (noPeriodo(r.data_recebimento)) recebido += n(r.valor_recebido);
    });

    // Contas Pagas: valor_pago de contas pagas/parciais no período
    // Usa data_pagamento quando disponível; fallback para data_vencimento
    var contasPagas = 0;
    (contasPagar || []).forEach(function(cp) {
      var st = (cp.status || '').toLowerCase();
      if (st === 'cancelado') return;
      if (st !== 'pago' && st !== 'parcial') return;
      var dataRef = cp.data_pagamento || cp.data_vencimento;
      if (noPeriodo(dataRef)) contasPagas += n(cp.valor_pago);
    });

    // Contas a Pagar: valor_pendente de contas abertas com data_vencimento no período
    var contasAPagarTotal = 0;
    (contasPagar || []).forEach(function(cp) {
      var st = (cp.status || '').toLowerCase();
      if (st === 'pago' || st === 'cancelado') return;
      if (noPeriodo(cp.data_vencimento)) contasAPagarTotal += n(cp.valor_pendente);
    });

    // Derivados
    var caixaLivre         = recebido - contasAPagarTotal;
    var resultadoGerencial = recebido - contasPagas;
    var margemGerencial    = receitaBruta > 0
      ? (resultadoGerencial / receitaBruta * 100)
      : null;

    return {
      receitaBruta:       receitaBruta,
      recebido:           recebido,
      aReceber:           aReceber,
      contasPagas:        contasPagas,
      contasAPagar:       contasAPagarTotal,
      caixaLivre:         caixaLivre,
      resultadoGerencial: resultadoGerencial,
      margemGerencial:    margemGerencial
    };
  }


  // ============================================================
  // FASE F — NF Fornecedor + Banco de Preços Reais
  // Funções isoladas — não alteram as anteriores.
  // ============================================================

  /**
   * Cria cabeçalho de NF de fornecedor importada por XML.
   * Âncora para CPs e itens do banco de preços.
   */
  async function sbCriarNFFornecedor(dados) {
    if (!dados.empresa_id)   throw new Error('[Financeiro F] empresa_id obrigatório.');
    if (!dados.chave_acesso) throw new Error('[Financeiro F] chave_acesso obrigatória.');

    var r = await client()
      .from('financeiro_nfs_fornecedor')
      .insert(dados)
      .select()
      .single();

    if (r.error) throw r.error;
    return r.data;
  }

  /**
   * Lista todas as NFs de fornecedor importadas da empresa,
   * ordenadas por data de emissão decrescente.
   */
  async function sbListarNFsFornecedorEmpresa(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F] empresa_id obrigatório.');

    var r = await client()
      .from('financeiro_nfs_fornecedor')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data_emissao', { ascending: false, nullsFirst: false })
      .order('created_at',   { ascending: false });

    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Verifica duplicidade por chave de acesso dentro da empresa.
   * Retorna o registro existente ou null se não houver.
   */
  async function sbVerificarNFFornecedorDuplicada(empresaId, chaveAcesso) {
    if (!empresaId || !chaveAcesso) return null;

    var r = await client()
      .from('financeiro_nfs_fornecedor')
      .select('id, numero_nf, data_emissao, fornecedor_nome')
      .eq('empresa_id',   empresaId)
      .eq('chave_acesso', chaveAcesso)
      .maybeSingle();

    if (r.error) throw r.error;
    return r.data;  // null se não encontrado
  }

  /**
   * Insere múltiplos itens no Banco de Preços Reais em lote.
   * Tabela é append-only — sem UPDATE.
   */
  async function sbCriarItensBancoPrecosEmLote(lista) {
    if (!lista || !lista.length) return [];

    var r = await client()
      .from('financeiro_banco_precos')
      .insert(lista)
      .select();

    if (r.error) throw r.error;
    return r.data || [];
  }

  /**
   * Lista itens do Banco de Preços Reais da empresa.
   * Aceita filtros opcionais: { descricao, ncm, fornecedor_cnpj, limit }
   */
  async function sbListarBancoPrecosEmpresa(empresaId, filtros) {
    if (!empresaId) throw new Error('[Financeiro F] empresa_id obrigatório.');
    filtros = filtros || {};

    var q = client()
      .from('financeiro_banco_precos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('data_emissao', { ascending: false, nullsFirst: false });

    if (filtros.fornecedor_cnpj) q = q.eq('fornecedor_cnpj', filtros.fornecedor_cnpj);
    if (filtros.ncm)             q = q.eq('ncm', filtros.ncm);
    if (filtros.descricao)       q = q.ilike('descricao', '%' + filtros.descricao + '%');
    if (filtros.limit)           q = q.limit(filtros.limit);

    var r = await q;
    if (r.error) throw r.error;
    return r.data || [];
  }


  // ── Funções auxiliares para reprocessamento de importação parcial ──

  /**
   * Atualiza campos de uma NF de fornecedor (ex: status após cada etapa).
   */
  async function sbAtualizarNFFornecedor(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F] id obrigatório para atualizar NF fornecedor.');
    var q = client()
      .from('financeiro_nfs_fornecedor')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  /**
   * Lista CPs existentes vinculadas a uma NF de fornecedor pela chave de acesso.
   * Retorna array de { id, referencia_id } para verificar quais parcelas já existem.
   * Usa origem='xml_fornecedor' + referencia_id LIKE chave% para cobrir todos os formatos.
   */
  async function sbBuscarRefIdsCPNFFornecedor(empresaId, chaveAcesso) {
    if (!empresaId || !chaveAcesso) return [];
    var r = await client()
      .from('financeiro_contas_pagar')
      .select('id, referencia_id')
      .eq('empresa_id', empresaId)
      .eq('origem', 'xml_fornecedor')
      .like('referencia_id', chaveAcesso + '%');
    if (r.error) return [];
    return r.data || [];
  }

  /**
   * Conta itens gravados no Banco de Preços Reais para uma NF de fornecedor.
   * Retorna 0 se nenhum item foi gravado (indica importação parcial).
   */
  async function sbContarItensBancoPrecos(empresaId, nfFornecedorId) {
    if (!empresaId || !nfFornecedorId) return 0;
    var r = await client()
      .from('financeiro_banco_precos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('nf_fornecedor_id', nfFornecedorId);
    if (r.error) return 0;
    return r.count || 0;
  }


  // ============================================================
  // F3.2 - BANCOS E CONTAS BANCARIAS
  // ============================================================

  async function sbListarBancos(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.2] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_bancos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome_banco', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarBanco(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.2] empresa_id obrigatorio.');
    if (!dados.nome_banco) throw new Error('[Financeiro F3.2] nome_banco obrigatorio.');
    var payload = Object.assign({ ativo: true }, dados);
    var r = await client()
      .from('financeiro_bancos')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarBanco(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.2] id obrigatorio para atualizar banco.');
    var q = client()
      .from('financeiro_bancos')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarContasBancarias(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.2] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_contas_bancarias')
      .select('*, banco:financeiro_bancos(id, nome_banco, codigo_banco, apelido)')
      .eq('empresa_id', empresaId)
      .order('apelido', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarContaBancaria(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.2] empresa_id obrigatorio.');
    if (!dados.apelido) throw new Error('[Financeiro F3.2] apelido obrigatorio.');
    if (!dados.banco_id) throw new Error('[Financeiro F3.2] banco_id obrigatorio.');
    if (!dados.tipo_conta) throw new Error('[Financeiro F3.2] tipo_conta obrigatorio.');
    var payload = Object.assign({ ativo: true, saldo_inicial: 0 }, dados);
    var r = await client()
      .from('financeiro_contas_bancarias')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarContaBancaria(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.2] id obrigatorio para atualizar conta bancaria.');
    var q = client()
      .from('financeiro_contas_bancarias')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarCaixasInternos(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.3] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_caixas_internos')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarCaixaInterno(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.3] empresa_id obrigatorio.');
    if (!dados.nome) throw new Error('[Financeiro F3.3] nome obrigatorio.');
    var payload = Object.assign({ ativo: true, saldo_inicial: 0 }, dados);
    var r = await client()
      .from('financeiro_caixas_internos')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarCaixaInterno(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.3] id obrigatorio para atualizar caixa interno.');
    var q = client()
      .from('financeiro_caixas_internos')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarCartoesEmpresa(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.3] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_cartoes_empresa')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('apelido', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarCartaoEmpresa(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.3] empresa_id obrigatorio.');
    if (!dados.apelido) throw new Error('[Financeiro F3.3] apelido obrigatorio.');
    if (!dados.tipo_cartao) throw new Error('[Financeiro F3.3] tipo_cartao obrigatorio.');
    var payload = Object.assign({ ativo: true }, dados);
    var r = await client()
      .from('financeiro_cartoes_empresa')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarCartaoEmpresa(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.3] id obrigatorio para atualizar cartao empresarial.');
    var q = client()
      .from('financeiro_cartoes_empresa')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarMeiosPagamento(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.3] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_meios_pagamento')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarMeioPagamento(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.3] empresa_id obrigatorio.');
    if (!dados.nome) throw new Error('[Financeiro F3.3] nome obrigatorio.');
    if (!dados.tipo) throw new Error('[Financeiro F3.3] tipo obrigatorio.');
    if (!dados.natureza) throw new Error('[Financeiro F3.3] natureza obrigatoria.');
    var payload = Object.assign({ ativo: true }, dados);
    var r = await client()
      .from('financeiro_meios_pagamento')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarMeioPagamento(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.3] id obrigatorio para atualizar meio de pagamento.');
    var q = client()
      .from('financeiro_meios_pagamento')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarFontesFinanceiras(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.3] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_fontes_financeiras')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarFonteFinanceira(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.3] empresa_id obrigatorio.');
    if (!dados.nome) throw new Error('[Financeiro F3.3] nome obrigatorio.');
    if (!dados.tipo) throw new Error('[Financeiro F3.3] tipo obrigatorio.');
    var payload = Object.assign({ ativo: true }, dados);
    var r = await client()
      .from('financeiro_fontes_financeiras')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarFonteFinanceira(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.3] id obrigatorio para atualizar fonte financeira.');
    var q = client()
      .from('financeiro_fontes_financeiras')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarAdquirentes(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.4-B] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_adquirentes')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('nome', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarAdquirente(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.4-B] empresa_id obrigatorio.');
    if (!dados.nome) throw new Error('[Financeiro F3.4-B] nome obrigatorio.');
    if (!dados.provedor) throw new Error('[Financeiro F3.4-B] provedor obrigatorio.');
    var payload = Object.assign({ ativo: true }, dados);
    var r = await client()
      .from('financeiro_adquirentes')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarAdquirente(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.4-B] id obrigatorio para atualizar adquirente.');
    var q = client()
      .from('financeiro_adquirentes')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarMaquininhas(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.4-B] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_maquininhas')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('apelido', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarMaquininha(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.4-B] empresa_id obrigatorio.');
    if (!dados.adquirente_id) throw new Error('[Financeiro F3.4-B] adquirente_id obrigatorio.');
    if (!dados.apelido) throw new Error('[Financeiro F3.4-B] apelido obrigatorio.');
    var payload = Object.assign({ ativo: true }, dados);
    var r = await client()
      .from('financeiro_maquininhas')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarMaquininha(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.4-B] id obrigatorio para atualizar maquininha.');
    var q = client()
      .from('financeiro_maquininhas')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbListarCategoriasGerenciais(empresaId) {
    if (!empresaId) throw new Error('[Financeiro F3.6-B] empresa_id obrigatorio.');
    var r = await client()
      .from('financeiro_categorias_gerenciais')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('tipo_movimento', { ascending: true })
      .order('grupo', { ascending: true })
      .order('subgrupo', { ascending: true, nullsFirst: false })
      .order('ordem', { ascending: true })
      .order('codigo', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }

  async function sbSalvarCategoriaGerencial(dados) {
    if (!dados || !dados.empresa_id) throw new Error('[Financeiro F3.6-B] empresa_id obrigatorio.');
    if (!dados.codigo) throw new Error('[Financeiro F3.6-B] codigo obrigatorio.');
    if (!dados.nome) throw new Error('[Financeiro F3.6-B] nome obrigatorio.');
    if (!dados.tipo_movimento) throw new Error('[Financeiro F3.6-B] tipo_movimento obrigatorio.');
    if (!dados.grupo) throw new Error('[Financeiro F3.6-B] grupo obrigatorio.');
    if (!dados.natureza) throw new Error('[Financeiro F3.6-B] natureza obrigatoria.');
    var payload = Object.assign({
      ativo: true,
      impacta_fluxo_caixa: true,
      impacta_dre: true,
      impacta_resultado_operacional: true,
      ordem: 0
    }, dados);
    var r = await client()
      .from('financeiro_categorias_gerenciais')
      .insert(payload)
      .select()
      .single();
    if (r.error) throw r.error;
    return r.data;
  }

  async function sbAtualizarCategoriaGerencial(id, dados) {
    var empresaId = _empresaFiltro(dados);
    var payload = _payloadSemEmpresa(dados);
    if (!id) throw new Error('[Financeiro F3.6-B] id obrigatorio para atualizar categoria gerencial.');
    if (!empresaId) throw new Error('[Financeiro F3.6-B] empresa_id obrigatorio para atualizar categoria gerencial.');
    var q = client()
      .from('financeiro_categorias_gerenciais')
      .update(payload)
      .eq('id', id);
    q = _aplicarEmpresaFiltro(q, empresaId);
    var r = await q.select().single();
    if (r.error) throw r.error;
    return r.data;
  }


  // ============================================================
  // EXPOSIÇÃO PÚBLICA
  // ============================================================

  window.sbFinanceiro = {
    // Contas a receber
    listarContasReceber:             sbListarContasReceber,
    buscarResumoFinanceiroProposta:  sbBuscarResumoFinanceiroProposta,
    buscarResumoFinanceiroObra:      sbBuscarResumoFinanceiroObra,
    criarContaReceber:               sbCriarContaReceber,
    atualizarContaReceber:           sbAtualizarContaReceber,
    atualizarCategoriaGerencialContaReceber: sbAtualizarCategoriaGerencialContaReceber,

    // Notas fiscais
    listarNotasFiscaisEmpresa:       sbListarNotasFiscaisEmpresa,
    listarNotasFiscaisConta:         sbListarNotasFiscaisConta,
    criarNotaFiscal:                 sbCriarNotaFiscal,
    atualizarNotaFiscal:             sbAtualizarNotaFiscal,

    // Recebimentos
    listarRecebimentosEmpresa:       sbListarRecebimentosEmpresa,
    listarRecebimentosConta:         sbListarRecebimentosConta,
    listarNFsDaConta:                sbListarNFsDaConta,
    criarRecebimento:                sbCriarRecebimento,
    registrarRecebimentoContaReceber: sbRegistrarRecebimentoContaReceber,

    // Movimentos de caixa
    listarMovimentosCaixa:           sbListarMovimentosCaixa,
    listarMovimentosDREGerencial:    sbListarMovimentosDREGerencial,
    criarMovimentoCaixa:             sbCriarMovimentoCaixa,
    conciliarMovimentoCaixa:         sbConciliarMovimentoCaixa,
    listarConciliacaoMovimento:      sbListarConciliacaoMovimento,
    listarConciliacoesFinanceiras:   sbListarConciliacoesFinanceiras,

    // Saldos de caixa
    buscarSaldoCaixaAtual:           sbBuscarSaldoCaixaAtual,
    upsertSaldoCaixa:                sbUpsertSaldoCaixa,

    // Contas a pagar
    listarContasPagar:               sbListarContasPagar,
    criarContaPagar:                 sbCriarContaPagar,
    atualizarContaPagar:             sbAtualizarContaPagar,
    atualizarCategoriaGerencialContaPagar: sbAtualizarCategoriaGerencialContaPagar,
    listarPagamentosContaPagar:      sbListarPagamentosContaPagar,
    criarPagamentoContaPagar:        sbCriarPagamentoContaPagar,
    registrarBaixaContaPagar:        sbRegistrarBaixaContaPagar,

    // Cálculos locais
    calcularResumoFinanceiroConta:   calcularResumoFinanceiroConta,
    calcularCardsFinanceirosBasicos: calcularCardsFinanceirosBasicos,

    // F4A — DRE Gerencial (novas funções — não alteram as anteriores)
    listarContasReceberPeriodo:      sbListarContasReceberPeriodo,
    listarRecebimentosPeriodo:       sbListarRecebimentosPeriodo,
    listarContasPagarPeriodo:        sbListarContasPagarPeriodo,
    calcularDREGerencial:            calcularDREGerencial,

    // Fase F — NF Fornecedor + Banco de Preços Reais
    criarNFFornecedor:               sbCriarNFFornecedor,
    listarNFsFornecedorEmpresa:      sbListarNFsFornecedorEmpresa,
    verificarNFFornecedorDuplicada:  sbVerificarNFFornecedorDuplicada,
    criarItensBancoPrecosEmLote:     sbCriarItensBancoPrecosEmLote,
    listarBancoPrecosEmpresa:        sbListarBancoPrecosEmpresa,
    // Reprocessamento de importação parcial
    atualizarNFFornecedor:           sbAtualizarNFFornecedor,
    buscarRefIdsCPNFFornecedor:      sbBuscarRefIdsCPNFFornecedor,
    contarItensBancoPrecos:          sbContarItensBancoPrecos,

    // F3.2 - Bancos e contas bancarias
    listarBancos:                    sbListarBancos,
    salvarBanco:                     sbSalvarBanco,
    atualizarBanco:                  sbAtualizarBanco,
    listarContasBancarias:           sbListarContasBancarias,
    salvarContaBancaria:             sbSalvarContaBancaria,
    atualizarContaBancaria:          sbAtualizarContaBancaria,

    // F3.3 - Caixas, cartoes, meios e fontes financeiras
    listarCaixasInternos:            sbListarCaixasInternos,
    salvarCaixaInterno:              sbSalvarCaixaInterno,
    atualizarCaixaInterno:           sbAtualizarCaixaInterno,
    listarCartoesEmpresa:            sbListarCartoesEmpresa,
    salvarCartaoEmpresa:             sbSalvarCartaoEmpresa,
    atualizarCartaoEmpresa:          sbAtualizarCartaoEmpresa,
    listarMeiosPagamento:            sbListarMeiosPagamento,
    salvarMeioPagamento:             sbSalvarMeioPagamento,
    atualizarMeioPagamento:          sbAtualizarMeioPagamento,
    listarFontesFinanceiras:         sbListarFontesFinanceiras,
    salvarFonteFinanceira:           sbSalvarFonteFinanceira,
    atualizarFonteFinanceira:        sbAtualizarFonteFinanceira,

    // F3.4-B - Adquirentes e maquininhas
    listarAdquirentes:               sbListarAdquirentes,
    salvarAdquirente:                sbSalvarAdquirente,
    atualizarAdquirente:             sbAtualizarAdquirente,
    listarMaquininhas:               sbListarMaquininhas,
    salvarMaquininha:                sbSalvarMaquininha,
    atualizarMaquininha:             sbAtualizarMaquininha,

    // F3.6-B - Plano Gerencial / categorias financeiras
    listarCategoriasGerenciais:      sbListarCategoriasGerenciais,
    salvarCategoriaGerencial:        sbSalvarCategoriaGerencial,
    atualizarCategoriaGerencial:     sbAtualizarCategoriaGerencial
  };

}(window));

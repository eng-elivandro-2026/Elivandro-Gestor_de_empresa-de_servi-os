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
    if (!id) throw new Error('[Financeiro] id obrigatório para atualizar.');

    var r = await client()
      .from('financeiro_contas_receber')
      .update(dados)
      .eq('id', id)
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
        'conta_receber:conta_receber_id(id, titulo, cliente_nome, proposta_app_id, obra_id, centro_custo, valor_previsto, valor_recebido, valor_pendente, data_vencimento, status)'
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
          'id, titulo, cliente_nome, proposta_app_id, obra_id, centro_custo,' +
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
    if (!id) throw new Error('[Financeiro] id obrigatório para atualizar.');

    // Recalcular valor_pendente se valor_previsto ou valor_pago mudou
    if (dados.valor_previsto !== undefined || dados.valor_pago !== undefined) {
      // Os valores atuais precisam vir no payload para recalcular
      dados.valor_pendente = Math.max(0, _num(dados.valor_previsto || 0) - _num(dados.valor_pago || 0));
    }

    var r = await client()
      .from('financeiro_contas_pagar')
      .update(dados)
      .eq('id', id)
      .select()
      .single();

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

    // Notas fiscais
    listarNotasFiscaisEmpresa:       sbListarNotasFiscaisEmpresa,
    listarNotasFiscaisConta:         sbListarNotasFiscaisConta,
    criarNotaFiscal:                 sbCriarNotaFiscal,

    // Recebimentos
    listarRecebimentosEmpresa:       sbListarRecebimentosEmpresa,
    listarRecebimentosConta:         sbListarRecebimentosConta,
    listarNFsDaConta:                sbListarNFsDaConta,
    criarRecebimento:                sbCriarRecebimento,

    // Movimentos de caixa
    listarMovimentosCaixa:           sbListarMovimentosCaixa,
    criarMovimentoCaixa:             sbCriarMovimentoCaixa,

    // Saldos de caixa
    buscarSaldoCaixaAtual:           sbBuscarSaldoCaixaAtual,
    upsertSaldoCaixa:                sbUpsertSaldoCaixa,

    // Contas a pagar
    listarContasPagar:               sbListarContasPagar,
    criarContaPagar:                 sbCriarContaPagar,
    atualizarContaPagar:             sbAtualizarContaPagar,

    // Cálculos locais
    calcularResumoFinanceiroConta:   calcularResumoFinanceiroConta,
    calcularCardsFinanceirosBasicos: calcularCardsFinanceirosBasicos
  };

}(window));

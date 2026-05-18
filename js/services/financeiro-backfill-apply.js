// ============================================================
// financeiro-backfill-apply.js
// Backfill oficial controlado para o módulo Financeiro.
//
// ATENÇÃO: Este script INSERE dados nas tabelas financeiras.
// Execute somente após validar a prévia com
// window.FinanceiroBackfillPreview.executar().
//
// Regras críticas:
//   - Somente para a empresa ativa.
//   - Idempotente: executar duas vezes não duplica dados.
//   - Nenhuma proposta é alterada ou removida.
//   - Nenhum dado antigo é apagado.
//
// Como usar (console do portal logado):
//   var relatorio = await window.FinanceiroBackfillApply.aplicar();
//   console.table(relatorio);
// ============================================================

(function (window) {
  'use strict';

  // ── helpers ───────────────────────────────────────────────

  function _num(v) {
    var n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function _client() {
    if (!window.sbClient) throw new Error('[BackfillApply] sbClient não conectado.');
    return window.sbClient;
  }

  function _empresaId() {
    var id, fonte;

    if (typeof window.getEmpresaAtivaId === 'function') {
      id = window.getEmpresaAtivaId();
      if (id) fonte = 'window.getEmpresaAtivaId()';
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
      } catch (e) { /* JSON inválido */ }
    }
    if (!id) {
      throw new Error(
        '[BackfillApply] Empresa ativa não encontrada. ' +
        'Verifique se está logado e com empresa selecionada no portal.'
      );
    }
    console.info('[BackfillApply] empresa_id via', fonte, '→', id);
    return id;
  }

  function _parseDados(dadosJson) {
    try {
      return typeof dadosJson === 'string' ? JSON.parse(dadosJson) : (dadosJson || {});
    } catch (e) { return {}; }
  }

  function _parseTl(dadosJson) {
    try {
      var d = typeof dadosJson === 'string' ? JSON.parse(dadosJson) : dadosJson;
      return (d && d.tl) ? d.tl : {};
    } catch (e) { return {}; }
  }

  // ── Status que indicam proposta aprovada/fechada ──────────
  var STATUS_APROVADOS = [
    'aprovado', 'em_execucao', 'faturado', 'recebido',
    'encerrado', 'garantia', 'concluido'
  ];

  var STATUS_FATURADO = ['faturado', 'recebido', 'encerrado', 'garantia'];

  function _calcStatusConta(fas, totalNF, totalRecebido, emAberto) {
    var isFaturado = STATUS_FATURADO.indexOf(fas) !== -1;
    var isAprovado = STATUS_APROVADOS.indexOf(fas) !== -1;
    if (isFaturado && emAberto <= 0 && totalNF > 0) return 'recebido';
    if (isFaturado && emAberto > 0 && totalRecebido > 0) return 'parcialmente_recebido';
    if (isFaturado && totalNF > 0) return 'faturado';
    if (isAprovado) return 'a_faturar';
    return 'previsto';
  }


  // ============================================================
  // CARREGAR PROPOSTAS (filtrado por empresa_id)
  // ============================================================

  async function _carregarPropostas(empresaId) {
    var r = await _client()
      .from('propostas')
      .select('app_id, numero_proposta, titulo, cliente, valor_total, fase, dados_json, empresa_id')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: true });
    if (r.error) throw r.error;
    return r.data || [];
  }


  // ============================================================
  // PROCESSAR CONTA A RECEBER
  // Idempotência: verifica (empresa_id, proposta_app_id, obra_id IS NULL)
  // ============================================================

  async function _processarConta(empresaId, proposta, dados, tl) {
    var sb = _client();
    var appId = proposta.app_id || dados.id || '';
    var fas = proposta.fase || dados.fas || '';
    var nfs = Array.isArray(tl.nfs) ? tl.nfs : [];
    var adiantamentos = Array.isArray(tl.adiantamentos) ? tl.adiantamentos : [];

    // Verificar se já existe
    var existR = await sb
      .from('financeiro_contas_receber')
      .select('id, valor_previsto, valor_recebido, valor_pendente, data_vencimento')
      .eq('empresa_id', empresaId)
      .eq('proposta_app_id', appId)
      .is('obra_id', null)
      .maybeSingle();

    if (existR.error) throw existR.error;
    if (existR.data) {
      return { contaId: existR.data.id, conta: existR.data, criada: false };
    }

    // Calcular valores financeiros da proposta
    var totalNF      = nfs.reduce(function (s, nf) { return s + _num(nf.valor); }, 0);
    var totalAdiant  = adiantamentos.reduce(function (s, a) { return s + _num(a.valor); }, 0);
    var valRecebFinal = _num(tl.valRecebFinal);
    var totalRecebido = totalAdiant + valRecebFinal;
    var emAberto     = Math.max(0, totalNF - totalRecebido);
    var valContrato  = _num(dados.vS || 0) + _num(dados.vM || 0) || _num(proposta.valor_total);
    var valorPendente = Math.max(0, valContrato - totalRecebido);
    var status = _calcStatusConta(fas, totalNF, totalRecebido, emAberto);

    var payload = {
      empresa_id:           empresaId,
      proposta_app_id:      appId,
      obra_id:              null,
      cliente_nome:         dados.cli || proposta.cliente || '',
      cliente_cnpj:         dados.cnpj || '',
      titulo:               dados.tit || proposta.titulo || proposta.numero_proposta || appId,
      valor_previsto:       valContrato,
      valor_faturado:       totalNF,
      valor_recebido:       totalRecebido,
      valor_pendente:       valorPendente,
      data_vencimento:      tl.dtRecebFinal || null,
      status:               status,
      origem:               'backfill_proposta',
      snapshot_origem_json: {
        app_id:           appId,
        numero_proposta:  proposta.numero_proposta,
        fase:             fas,
        valor_total:      proposta.valor_total,
        backfill_at:      new Date().toISOString()
      }
    };

    var r = await sb
      .from('financeiro_contas_receber')
      .insert(payload)
      .select()
      .single();

    if (r.error) throw r.error;
    return { contaId: r.data.id, conta: r.data, criada: true };
  }


  // ============================================================
  // PROCESSAR NOTAS FISCAIS
  // Idempotência: verifica por (empresa_id, conta_receber_id,
  //   valor_nf, data_emissao, numero_nf) ou pela ref de backfill.
  // ============================================================

  async function _processarNFs(empresaId, contaId, appId, nfs) {
    var sb = _client();
    var criadas = 0, ignoradas = 0;
    if (!nfs || !nfs.length) return { criadas: 0, ignoradas: 0 };

    // Carregar NFs existentes para esta conta
    var existR = await sb
      .from('financeiro_notas_fiscais')
      .select('numero_nf, valor_nf, data_emissao, observacoes')
      .eq('empresa_id', empresaId)
      .eq('conta_receber_id', contaId);

    if (existR.error) throw existR.error;
    var existing = existR.data || [];

    for (var i = 0; i < nfs.length; i++) {
      var nf = nfs[i];
      var valorNF = _num(nf.valor);
      if (valorNF <= 0) { ignoradas++; continue; }

      var dataEmissao = nf.data || null;
      var numeroNF = String(nf.num || nf.numero || '').trim() || null;
      var ref = 'backfill_ref:nf:' + i + ':' + appId;

      // Verificar duplicidade: por ref ou por (valor + data + numero)
      var isDup = existing.some(function (e) {
        if (e.observacoes === ref) return true;
        var vMatch = Math.abs(_num(e.valor_nf) - valorNF) < 0.01;
        var dMatch = !dataEmissao || !e.data_emissao || e.data_emissao === dataEmissao;
        var nMatch = !numeroNF || !e.numero_nf || e.numero_nf === numeroNF;
        return vMatch && dMatch && nMatch;
      });

      if (isDup) { ignoradas++; continue; }

      var payload = {
        empresa_id:       empresaId,
        conta_receber_id: contaId,
        proposta_app_id:  appId,
        numero_nf:        numeroNF,
        tipo_nf:          nf.tipo || 'servico',
        data_emissao:     dataEmissao,
        valor_nf:         valorNF,
        status:           'emitida',
        observacoes:      ref
      };

      var r = await sb
        .from('financeiro_notas_fiscais')
        .insert(payload)
        .select('id')
        .single();

      if (r.error) {
        if (r.error.code === '23505') { ignoradas++; }
        else throw r.error;
      } else {
        criadas++;
        existing.push({ numero_nf: numeroNF, valor_nf: valorNF, data_emissao: dataEmissao, observacoes: ref });
      }
    }

    return { criadas: criadas, ignoradas: ignoradas };
  }


  // ============================================================
  // PROCESSAR RECEBIMENTOS
  // Idempotência: ref única armazenada em observacoes.
  // ============================================================

  async function _processarRecebimentos(empresaId, contaId, appId, tl) {
    var sb = _client();
    var adiantamentos = Array.isArray(tl.adiantamentos) ? tl.adiantamentos : [];
    var valRecebFinal = _num(tl.valRecebFinal);
    var dtRecebFinal = tl.dtRecebFinal || null;
    var criados = [];
    var ignoradas = 0;

    // Carregar recebimentos existentes para esta conta
    var existR = await sb
      .from('financeiro_recebimentos')
      .select('id, valor_recebido, observacoes')
      .eq('empresa_id', empresaId)
      .eq('conta_receber_id', contaId);

    if (existR.error) throw existR.error;
    var existing = existR.data || [];

    function _isDup(ref) {
      return existing.some(function (e) { return e.observacoes === ref; });
    }

    // Adiantamentos
    for (var i = 0; i < adiantamentos.length; i++) {
      var valor = _num(adiantamentos[i].valor);
      if (valor <= 0) continue;

      var ref = 'backfill_ref:adiant:' + i + ':' + appId;
      if (_isDup(ref)) { ignoradas++; continue; }

      var payload = {
        empresa_id:        empresaId,
        conta_receber_id:  contaId,
        proposta_app_id:   appId,
        valor_recebido:    valor,
        data_recebimento:  adiantamentos[i].data || null,
        forma_recebimento: 'adiantamento',
        status:            'confirmado',
        observacoes:       ref
      };

      var r = await sb
        .from('financeiro_recebimentos')
        .insert(payload)
        .select('id, valor_recebido, data_recebimento')
        .single();

      if (r.error) {
        if (r.error.code === '23505') ignoradas++;
        else throw r.error;
      } else {
        criados.push(r.data);
        existing.push({ id: r.data.id, observacoes: ref });
      }
    }

    // Recebimento final
    if (valRecebFinal > 0) {
      var refFinal = 'backfill_ref:final:' + appId;
      if (_isDup(refFinal)) {
        ignoradas++;
      } else {
        var payloadFinal = {
          empresa_id:        empresaId,
          conta_receber_id:  contaId,
          proposta_app_id:   appId,
          valor_recebido:    valRecebFinal,
          data_recebimento:  dtRecebFinal,
          forma_recebimento: 'transferencia',
          status:            'confirmado',
          observacoes:       refFinal
        };
        var rFinal = await sb
          .from('financeiro_recebimentos')
          .insert(payloadFinal)
          .select('id, valor_recebido, data_recebimento')
          .single();

        if (rFinal.error) {
          if (rFinal.error.code === '23505') ignoradas++;
          else throw rFinal.error;
        } else {
          criados.push(rFinal.data);
        }
      }
    }

    return { criados: criados, ignoradas: ignoradas };
  }


  // ============================================================
  // PROCESSAR MOVIMENTOS DE CAIXA
  // Carrega TODOS os recebimentos da conta (não só os desta rodada)
  // para garantir idempotência mesmo após falha parcial anterior.
  // ============================================================

  async function _processarMovimentos(empresaId, contaId, appId, conta) {
    var sb = _client();
    var criados = 0, ignorados = 0;

    // Carregar TODOS os recebimentos desta conta
    var recebR = await sb
      .from('financeiro_recebimentos')
      .select('id, valor_recebido, data_recebimento')
      .eq('empresa_id', empresaId)
      .eq('conta_receber_id', contaId);

    if (recebR.error) throw recebR.error;
    var todosRecebimentos = recebR.data || [];

    var valorPendente = conta ? _num(conta.valor_pendente) : 0;

    // Sair cedo se não há nada a fazer
    if (todosRecebimentos.length === 0 && valorPendente <= 0) {
      return { criados: 0, ignorados: 0 };
    }

    // Montar lista de referencia_ids esperados
    var refIds = todosRecebimentos.map(function (r) { return 'receb:' + r.id; });
    if (valorPendente > 0) refIds.push('previsto:' + contaId);

    // Carregar movimentos já existentes por referencia_id
    var existMovR = await sb
      .from('financeiro_movimentos_caixa')
      .select('id, referencia_id')
      .eq('empresa_id', empresaId)
      .in('referencia_id', refIds);

    if (existMovR.error) throw existMovR.error;
    var existingRefs = (existMovR.data || []).map(function (e) { return e.referencia_id; });

    // Movimento realizado: um por recebimento
    for (var i = 0; i < todosRecebimentos.length; i++) {
      var receb = todosRecebimentos[i];
      var refId = 'receb:' + receb.id;
      if (existingRefs.indexOf(refId) !== -1) { ignorados++; continue; }

      var payload = {
        empresa_id:    empresaId,
        tipo:          'entrada',
        natureza:      'realizado',
        origem:        'backfill_recebimento',
        referencia_id: refId,
        data_real:     receb.data_recebimento,
        valor_real:    receb.valor_recebido,
        status:        'realizado',
        conciliado:    false,
        descricao:     'Backfill recebimento — ' + appId
      };

      var r = await sb
        .from('financeiro_movimentos_caixa')
        .insert(payload)
        .select('id')
        .single();

      if (r.error) {
        if (r.error.code === '23505') ignorados++;
        else throw r.error;
      } else {
        criados++;
        existingRefs.push(refId);
      }
    }

    // Movimento previsto: saldo pendente da conta
    if (valorPendente > 0) {
      var refPrevisto = 'previsto:' + contaId;
      if (existingRefs.indexOf(refPrevisto) !== -1) {
        ignorados++;
      } else {
        var payloadPrev = {
          empresa_id:     empresaId,
          tipo:           'entrada',
          natureza:       'previsto',
          origem:         'backfill_conta_receber',
          referencia_id:  refPrevisto,
          data_prevista:  conta.data_vencimento || null,
          valor_previsto: valorPendente,
          status:         'previsto',
          conciliado:     false,
          descricao:      'Backfill saldo pendente — ' + appId
        };
        var rPrev = await sb
          .from('financeiro_movimentos_caixa')
          .insert(payloadPrev)
          .select('id')
          .single();

        if (rPrev.error) {
          if (rPrev.error.code === '23505') ignorados++;
          else throw rPrev.error;
        } else {
          criados++;
        }
      }
    }

    return { criados: criados, ignorados: ignorados };
  }


  // ============================================================
  // FUNÇÃO PRINCIPAL
  // ============================================================

  /**
   * Aplica o backfill financeiro para a empresa ativa.
   * Idempotente: pode ser executado múltiplas vezes.
   *
   * Retorna relatório com: contas_criadas, nfs_criadas,
   *   recebimentos_criados, movimentos_criados,
   *   *_ignorados, erros[].
   */
  async function aplicar(opcoes) {
    var opts = opcoes || {};
    var empresaId = opts.empresaId || _empresaId();

    console.info('[BackfillApply] ═══ BACKFILL OFICIAL INICIADO ═══');
    console.info('[BackfillApply] Empresa:', empresaId);
    console.info('[BackfillApply] ATENÇÃO: dados serão inseridos nas tabelas financeiras.');

    var propostas = await _carregarPropostas(empresaId);
    console.info('[BackfillApply] Propostas carregadas:', propostas.length);

    var rel = {
      empresa_id:             empresaId,
      total_propostas:        propostas.length,
      propostas_processadas:  0,
      propostas_ignoradas:    0,
      contas_criadas:         0,
      contas_ignoradas:       0,
      nfs_criadas:            0,
      nfs_ignoradas:          0,
      recebimentos_criados:   0,
      recebimentos_ignorados: 0,
      movimentos_criados:     0,
      movimentos_ignorados:   0,
      erros:                  [],
      aviso: 'Backfill aplicado somente para a empresa ativa.'
    };

    for (var i = 0; i < propostas.length; i++) {
      var proposta   = propostas[i];
      var dados      = _parseDados(proposta.dados_json);
      var tl         = _parseTl(proposta.dados_json);
      var fas        = proposta.fase || dados.fas || '';
      var appId      = proposta.app_id || dados.id || '';
      var isAprovado = STATUS_APROVADOS.indexOf(fas) !== -1;
      var nfs        = Array.isArray(tl.nfs) ? tl.nfs : [];

      // Ignorar propostas sem dados financeiros relevantes
      if (!isAprovado && nfs.length === 0) {
        rel.propostas_ignoradas++;
        continue;
      }

      rel.propostas_processadas++;

      try {
        // 1. Conta a receber
        var contaResult = await _processarConta(empresaId, proposta, dados, tl);
        if (contaResult.criada) rel.contas_criadas++;
        else rel.contas_ignoradas++;

        var contaId = contaResult.contaId;
        var conta   = contaResult.conta;

        // 2. Notas fiscais
        if (nfs.length > 0) {
          var nfResult = await _processarNFs(empresaId, contaId, appId, nfs);
          rel.nfs_criadas   += nfResult.criadas;
          rel.nfs_ignoradas += nfResult.ignoradas;
        }

        // 3. Recebimentos
        var recResult = await _processarRecebimentos(empresaId, contaId, appId, tl);
        rel.recebimentos_criados   += recResult.criados.length;
        rel.recebimentos_ignorados += recResult.ignoradas;

        // 4. Movimentos de caixa
        // Carrega TODOS os recebimentos da conta para garantir idempotência
        var movResult = await _processarMovimentos(empresaId, contaId, appId, conta);
        rel.movimentos_criados   += movResult.criados;
        rel.movimentos_ignorados += movResult.ignorados;

      } catch (e) {
        console.error('[BackfillApply] Erro em proposta', appId, e);
        rel.erros.push({ proposta: appId, erro: e.message });
      }
    }

    console.info('[BackfillApply] ═══ BACKFILL CONCLUÍDO ═══');
    console.info('[BackfillApply] Relatório:', rel);

    return rel;
  }


  // ============================================================
  // EXPOSIÇÃO PÚBLICA
  // ============================================================

  window.FinanceiroBackfillApply = {
    aplicar: aplicar
  };

  console.info('[FinanceiroBackfillApply] Carregado. Execute: window.FinanceiroBackfillApply.aplicar()');

}(window));

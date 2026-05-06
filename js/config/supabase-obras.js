// ============================================================
// supabase-obras.js - camada isolada do modulo Operacional
// ============================================================
(function (window) {
  'use strict';

  var STATUS_OPERACIONAL = [
    'aguardando_recebimento',
    'recebimento_em_analise',
    'planejamento_em_andamento',
    'aguardando_compras',
    'compras_em_andamento',
    'aguardando_material',
    'aguardando_cliente',
    'aguardando_terceiro',
    'pronto_para_mobilizacao',
    'em_mobilizacao',
    'em_execucao',
    'em_pausa',
    'em_testes',
    'em_comissionamento',
    'em_taf',
    'em_sat',
    'aguardando_documentacao_final',
    'entregue_ao_cliente',
    'em_garantia',
    'encerrada',
    'cancelada'
  ];

  var STATUS_LABELS = {
    aguardando_recebimento: 'Aguardando recebimento',
    recebimento_em_analise: 'Recebimento em analise',
    planejamento_em_andamento: 'Planejamento em andamento',
    aguardando_compras: 'Aguardando compras',
    compras_em_andamento: 'Compras em andamento',
    aguardando_material: 'Aguardando material',
    aguardando_cliente: 'Aguardando cliente',
    aguardando_terceiro: 'Aguardando terceiro',
    pronto_para_mobilizacao: 'Pronto para mobilizacao',
    em_mobilizacao: 'Em mobilizacao',
    em_execucao: 'Em execucao',
    em_pausa: 'Em pausa',
    em_testes: 'Em testes',
    em_comissionamento: 'Em comissionamento',
    em_taf: 'Em TAF',
    em_sat: 'Em SAT',
    aguardando_documentacao_final: 'Aguardando documentacao final',
    entregue_ao_cliente: 'Entregue ao cliente',
    em_garantia: 'Em garantia',
    encerrada: 'Encerrada',
    cancelada: 'Cancelada'
  };

  function client() {
    if (!window.sbClient) throw new Error('Supabase nao esta conectado.');
    return window.sbClient;
  }

  function empresaAtivaId() {
    if (typeof window.getEmpresaAtivaId === 'function') return window.getEmpresaAtivaId();
    if (typeof window.getEmpresaAtiva === 'function') {
      var emp = window.getEmpresaAtiva();
      if (emp && emp.id) return emp.id;
    }
    if (window._empresaAtiva && window._empresaAtiva.id) return window._empresaAtiva.id;
    return null;
  }

  function num(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).trim();
    if (!s) return 0;
    s = s.replace(/[R$\s]/g, '');
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function fix2(v) {
    return Math.round((num(v) + Number.EPSILON) * 100) / 100;
  }

  function clampPct(v) {
    v = fix2(v);
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
  }

  function cleanText(v) {
    return v == null ? '' : String(v).trim();
  }

  function onlyDate(v) {
    if (!v) return null;
    var s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (br) return br[3] + '-' + br[2] + '-' + br[1];
    var d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  function jsonClone(v) {
    try { return JSON.parse(JSON.stringify(v == null ? null : v)); }
    catch (e) { return null; }
  }

  function gerarCodigoObra(proposta) {
    proposta = proposta || {};
    var base = cleanText(proposta.num || proposta.proposta_numero || proposta.id);
    base = base.replace(/\s+/g, '');
    return base ? 'OB-' + base : 'OB-' + Date.now();
  }

  function calcularCamposPrevistosObra(proposta) {
    proposta = proposta || {};
    var valorServico = fix2(proposta.vS);
    var valorMaterial = fix2(proposta.vM);
    var desconto = fix2(proposta.vD) || fix2(proposta.vDS) + fix2(proposta.vDM);
    var valorVendido = fix2(proposta.val || proposta.valor || (valorServico + valorMaterial - desconto));
    var custoServico = 0;
    var custoMaterial = 0;
    var custoTerceiros = 0;
    var custoOutros = 0;
    var itens = Array.isArray(proposta.bi) ? proposta.bi : [];

    itens.forEach(function (it) {
      if (!it || it.inc === false) return;
      var qtd = num(it.qtd || it.qt || it.q);
      if (!qtd) qtd = 1;
      var fator = num(it.fat || it.fator || it.mult);
      if (!fator) fator = 1;
      var custo = fix2((num(it.cu || it.custo || it.custoUnit || it.custo_unit) || 0) * qtd * fator);
      var tipo = cleanText(it.t || it.tipo).toLowerCase();
      if (it.terc === true || tipo.indexOf('terc') >= 0) custoTerceiros += custo;
      else if (tipo.indexOf('mat') >= 0) custoMaterial += custo;
      else if (tipo.indexOf('serv') >= 0 || tipo.indexOf('mao') >= 0) custoServico += custo;
      else custoOutros += custo;
    });

    var custoTotal = fix2(custoServico + custoMaterial + custoTerceiros + custoOutros);
    var margemValor = fix2(valorVendido - custoTotal);
    var margemPct = valorVendido > 0 ? fix2((margemValor / valorVendido) * 100) : 0;

    return {
      valor_vendido: valorVendido,
      valor_servico_previsto: valorServico,
      valor_material_previsto: valorMaterial,
      custo_servico_previsto: fix2(custoServico),
      custo_material_previsto: fix2(custoMaterial),
      custo_terceiros_previsto: fix2(custoTerceiros),
      custo_outros_previsto: fix2(custoOutros),
      custo_total_previsto: custoTotal,
      margem_prevista_percentual: margemPct,
      margem_prevista_valor: margemValor
    };
  }

  function montarSnapshotProposta(proposta) {
    proposta = proposta || {};
    return {
      id: proposta.id || null,
      num: proposta.num || null,
      revAtual: proposta.revAtual || null,
      cli: proposta.cli || null,
      cnpj: proposta.cnpj || null,
      cid: proposta.cid || null,
      loc: proposta.loc || null,
      locCnpj: proposta.locCnpj || null,
      csvc: proposta.csvc || null,
      ac: proposta.ac || null,
      dep: proposta.dep || null,
      mail: proposta.mail || null,
      tel: proposta.tel || null,
      ac2: proposta.ac2 || null,
      dep2: proposta.dep2 || null,
      mail2: proposta.mail2 || null,
      tel2: proposta.tel2 || null,
      tit: proposta.tit || null,
      val: proposta.val == null ? null : num(proposta.val),
      vS: proposta.vS == null ? null : num(proposta.vS),
      vM: proposta.vM == null ? null : num(proposta.vM),
      vD: proposta.vD == null ? null : num(proposta.vD),
      vDS: proposta.vDS == null ? null : num(proposta.vDS),
      vDM: proposta.vDM == null ? null : num(proposta.vDM),
      fas: proposta.fas || null,
      dtFech: proposta.dtFech || null,
      esc: jsonClone(proposta.esc),
      bi: jsonClone(proposta.bi),
      gantt: jsonClone(proposta.gantt),
      tl: jsonClone(proposta.tl),
      stages: jsonClone(proposta.stages),
      aliq: jsonClone(proposta.aliq),
      prc: jsonClone(proposta.prc),
      metadados: {
        origem: 'operacional_fase_1a',
        criado_em: new Date().toISOString(),
        empresa_id: empresaAtivaId()
      }
    };
  }

  async function sbListarObras(empresaId) {
    empresaId = empresaId || empresaAtivaId();
    if (!empresaId) throw new Error('Empresa ativa nao encontrada.');
    var res = await client()
      .from('obras')
      .select('*')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false });
    if (res.error) throw res.error;
    return res.data || [];
  }

  async function sbBuscarObraPorProposta(empresaId, propostaAppId) {
    empresaId = empresaId || empresaAtivaId();
    if (!empresaId || !propostaAppId) return null;
    var res = await client()
      .from('obras')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('proposta_app_id', propostaAppId)
      .maybeSingle();
    if (res.error) throw res.error;
    return res.data || null;
  }

  async function sbBuscarObraPorId(obraId) {
    if (!obraId) throw new Error('ID da obra nao informado.');
    var res = await client()
      .from('obras')
      .select('*')
      .eq('id', obraId)
      .maybeSingle();
    if (res.error) throw res.error;
    return res.data || null;
  }

  async function sbCriarObraDeProposta(proposta) {
    proposta = proposta || {};
    if (!proposta.id) throw new Error('Proposta sem ID interno.');
    var empresaId = empresaAtivaId();
    if (!empresaId) throw new Error('Empresa ativa nao encontrada.');

    var existente = await sbBuscarObraPorProposta(empresaId, proposta.id);
    if (existente) return { obra: existente, criada: false };

    var campos = calcularCamposPrevistosObra(proposta);
    var row = Object.assign({
      empresa_id: empresaId,
      proposta_app_id: String(proposta.id),
      codigo_obra: gerarCodigoObra(proposta),
      proposta_numero: cleanText(proposta.num),
      proposta_revisao: cleanText(proposta.revAtual),
      cliente_nome: cleanText(proposta.cli || proposta.loc),
      cliente_cnpj: cleanText(proposta.cnpj || proposta.locCnpj),
      cliente_cidade: cleanText(proposta.cid || proposta.csvc),
      cliente_local: cleanText(proposta.loc),
      titulo: cleanText(proposta.tit),
      status_operacional: 'aguardando_recebimento',
      data_aprovacao: onlyDate(proposta.dtFech || proposta.dat),
      percentual_avanco: 0,
      termo_entrega_assinado: false,
      pode_faturar: false,
      snapshot_proposta_json: montarSnapshotProposta(proposta)
    }, campos);

    var res = await client().from('obras').insert(row).select('*').single();
    if (res.error) {
      if (res.error.code === '23505') {
        var dup = await sbBuscarObraPorProposta(empresaId, proposta.id);
        if (dup) return { obra: dup, criada: false };
      }
      throw res.error;
    }
    return { obra: res.data, criada: true };
  }

  async function sbAtualizarObra(obraId, dados) {
    if (!obraId) throw new Error('ID da obra nao informado.');
    dados = dados || {};
    var permitidos = [
      'status_operacional',
      'responsavel_operacional_id',
      'responsavel_operacional_nome',
      'centro_custo',
      'data_inicio_prevista',
      'data_termino_prevista',
      'data_inicio_real',
      'data_termino_real',
      'data_entrega_prevista',
      'data_entrega_real',
      'data_inicio_garantia',
      'data_fim_garantia',
      'status_entrega',
      'area_local',
      'equipamento_maquina_linha',
      'percentual_avanco',
      'observacoes',
      'pode_faturar',
      'termo_entrega_assinado'
    ];
    var upd = {};
    permitidos.forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(dados, k)) upd[k] = dados[k];
    });
    if (Object.prototype.hasOwnProperty.call(upd, 'percentual_avanco')) {
      upd.percentual_avanco = clampPct(upd.percentual_avanco);
    }
    ['data_inicio_prevista', 'data_termino_prevista', 'data_inicio_real', 'data_termino_real', 'data_entrega_prevista', 'data_entrega_real', 'data_inicio_garantia', 'data_fim_garantia'].forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(upd, k)) upd[k] = onlyDate(upd[k]);
    });

    var res = await client().from('obras').update(upd).eq('id', obraId).select('*').single();
    if (res.error) throw res.error;
    return res.data;
  }

  window.OP_STATUS_OPERACIONAL = STATUS_OPERACIONAL;
  window.OP_STATUS_LABELS = STATUS_LABELS;
  window.sbListarObras = sbListarObras;
  window.sbBuscarObraPorProposta = sbBuscarObraPorProposta;
  window.sbBuscarObraPorId = sbBuscarObraPorId;
  window.sbCriarObraDeProposta = sbCriarObraDeProposta;
  window.sbAtualizarObra = sbAtualizarObra;
  window.montarSnapshotProposta = montarSnapshotProposta;
  window.calcularCamposPrevistosObra = calcularCamposPrevistosObra;
  window.gerarCodigoObra = gerarCodigoObra;
})(window);

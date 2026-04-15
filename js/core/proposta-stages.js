// ============================================================
// proposta-stages.js — Schema e migração de etapas da proposta
// Versão: 1
//
// Princípios:
//   - Não-destrutivo: não remove nem sobrescreve campos existentes
//   - Aditivo: apenas acrescenta o objeto stages{}
//   - Idempotente: skipa se stages._v já for >= STAGES_VERSION
//   - Engineering-driven: escopo é estruturado por disciplina/
//     equipamento/atividade, não apenas por texto livre
// ============================================================

(function (window) {
  'use strict';

  var STAGES_VERSION = 1;
  window.STAGES_VERSION = STAGES_VERSION;

  // ──────────────────────────────────────────────────────────
  // Gerador de ID simples (não depende de uid() do app-core)
  // ──────────────────────────────────────────────────────────
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ──────────────────────────────────────────────────────────
  // Mapa categoria → disciplina de engenharia
  // Prefixo de 2 letras é suficiente
  // ──────────────────────────────────────────────────────────
  function _catToDisciplina(cat) {
    if (!cat) return '';
    var p = String(cat).substring(0, 2).toUpperCase();
    if (p === 'AC') return 'Automação';
    if (p === 'EL') return 'Elétrica';
    if (p === 'ME') return 'Mecânica';
    if (p === 'TI') return 'TI';
    if (p === 'GE') return 'Gestão';
    if (p === 'IN') return 'Instrumentação';
    if (p === 'CI') return 'Civil';
    return '';
  }

  // ──────────────────────────────────────────────────────────
  // Construtor canônico de um item de escopo (engineering)
  //
  // Campos obrigatórios para o futuro motor de geração:
  //   fase        — etapa do projeto (ex: "Projeto Básico", "Comissionamento")
  //   disciplina  — área técnica    (ex: "Elétrica", "Automação")
  //   equipamento — ativo físico    (ex: "CLP Allen-Bradley", "Painel 1")
  //   atividade   — ação a executar (ex: "Programação", "Montagem")
  //   descricao   — detalhamento livre
  //   gera_item   — flag: quando true este escopo pode gerar um item de proposta
  //   item_ref    — ID do item de budget já vinculado (quando gera_item=true)
  // ──────────────────────────────────────────────────────────
  function criarItemEscopo(campos) {
    campos = campos || {};
    return {
      id:          campos.id          || _uid(),
      fase:        campos.fase        || '',
      disciplina:  campos.disciplina  || '',
      equipamento: campos.equipamento || '',
      atividade:   campos.atividade   || '',
      descricao:   campos.descricao   || '',
      gera_item:   campos.gera_item   === true,
      item_ref:    campos.item_ref    || null,
      ordem:       typeof campos.ordem === 'number' ? campos.ordem : 0
    };
  }
  window.criarItemEscopo = criarItemEscopo;

  // ──────────────────────────────────────────────────────────
  // Container canônico completo (vazio)
  // Cada etapa numerada corresponde ao master flow:
  //   0  → base da proposta       (campos top-level, sem sub-objeto)
  //   1  → contato e agenda
  //   2  → visita técnica
  //   3  → organização da visita
  //   4  → consolidação técnica
  //   5  → engenharia e dimensionamento
  //   6  → recursos e custos
  //   7  → cotações
  //   8  → estrutura da proposta
  //   9  → escopo estruturado      (engineering-driven)
  //   10 → itens da proposta       (migrado de bi[])
  //   11 → análise financeira
  //   12 → documentos
  //   13 → follow-up comercial     (array estruturado)
  //   14 → negociação
  //   15 → aprovação / PO
  //   16 → compras
  //   17 → planejamento operacional
  //   18 → execução
  //   19 → entrega e aceite
  //   20 → faturamento             (migrado de tl.nfs[])
  //   21 → financeiro
  //   22 → resultado final
  // ──────────────────────────────────────────────────────────
  function criarStagesVazios() {
    return {
      _v: STAGES_VERSION,

      // ── 1 ── Contato e agenda ─────────────────────────────
      contato: {
        data_contato:  '',   // ISO YYYY-MM-DD
        contato_nome:  '',
        contato_cargo: '',
        telefone:      '',
        email:         '',
        notas:         '',
        reunioes:      []
        // reuniao: { id, data, tipo, pauta, participantes[], resultado }
      },

      // ── 2 ── Visita técnica ───────────────────────────────
      visita: {
        data_visita:   '',
        local:         '',
        responsavel:   '',
        objetivo:      '',
        observacoes:   '',
        checklist_pre: []
        // checklist_pre item: { id, descricao, concluido }
      },

      // ── 3 ── Organização da visita ────────────────────────
      org_visita: {
        equipe:          [],   // { id, nome, funcao }
        equipamentos:    [],   // { id, descricao, quantidade }
        checklist:       [],   // { id, item, concluido }
        notas_logistica: ''
      },

      // ── 4 ── Consolidação técnica ─────────────────────────
      consolidacao: {
        disciplinas:              [],   // strings: ["Elétrica", "Automação"]
        requisitos:               [],   // { id, descricao, origem }
        premissas:                [],   // strings
        restricoes:               [],   // strings
        notas_tecnicas:           '',
        equipamentos_principais:  '',
        tensao_alimentacao:       '',
        tensao_comando:           '',
        tensoes_especiais:        []    // strings: ids de checkboxes marcados
      },

      // ── 5 ── Engenharia e dimensionamento ─────────────────
      engenharia: {
        especificacoes: [],   // { id, parametro, valor, unidade, norma }
        memoriais:      [],   // { id, titulo, conteudo }
        documentos_ref: [],   // { id, titulo, url_ou_path }
        notas:          ''
      },

      // ── 6 ── Recursos e custos ────────────────────────────
      recursos: {
        materiais:  [],   // { id, descricao, quantidade, unidade, custo_unit }
        mao_obra:   [],   // { id, funcao, quantidade, dias, valor_dia }
        terceiros:  [],   // { id, fornecedor, servico, valor }
        outros:     [],   // { id, descricao, valor }
        resumo: {
          material_total:  0,
          mao_obra_total:  0,
          terceiros_total: 0,
          outros_total:    0,
          custo_total:     0
        }
      },

      // ── 7 ── Cotações ─────────────────────────────────────
      cotacoes: {
        cotacao_ids:  [],   // refs para tabela cotacoes
        fornecedores: [],   // { id, nome, valor, status, data_validade }
        resumo_custo: 0
      },

      // ── 8 ── Estrutura da proposta ────────────────────────
      // Blocos de apresentação (PDF/texto) — migrado de esc[]
      estrutura: {
        template_id: '',
        blocos:      []
        // bloco: { id, titulo, desc, subs: [{ id, nome, desc }] }
      },

      // ── 9 ── Escopo estruturado (ENGINEERING-DRIVEN) ──────
      // Diferente de estrutura{}: aqui cada item representa
      // uma unidade de trabalho técnico, com metadados de
      // engenharia que permitem gerar itens de proposta
      // automaticamente no futuro.
      escopo: {
        itens: []
        // item: criarItemEscopo() — ver construtor acima
      },

      // ── 10 ── Itens da proposta ───────────────────────────
      // Budget items — migrado de bi[] (normalizeBudgetItem)
      itens: {
        lista: []
        // item: normalizeBudgetItem() do app-core
      },

      // ── 11 ── Análise financeira ──────────────────────────
      analise_fin: {
        custo_total:    0,
        preco_venda:    0,
        margem_bruta:   0,
        margem_pct:     0,
        impostos:       {},   // espelho de aliq do app-core
        resultado_proj: 0,
        notas:          ''
      },

      // ── 12 ── Documentos ──────────────────────────────────
      documentos: {
        arquivos: []
        // arquivo: { id, nome, tipo, url, data_upload, descricao }
      },

      // ── 13 ── Follow-up comercial ─────────────────────────
      // Substituiu as fases enum follow1-follow4
      followup: {
        historico: []
        // entrada: { id, data, tipo, contato, outcome,
        //            proxima_acao, proxima_data }
      },

      // ── 14 ── Negociação ──────────────────────────────────
      negociacao: {
        rodadas:               [],
        // rodada: { id, data, contraproposta_valor,
        //           desconto_oferecido, resposta, status }
        ultima_contraproposta: 0,
        desconto_aceito:       0
      },

      // ── 15 ── Aprovação / PO ──────────────────────────────
      aprovacao: {
        data_aprovacao: '',
        po_numero:      '',
        po_valor:       0,
        signatario:     '',
        condicoes:      '',
        valor_final:    0
      },

      // ── 16 ── Compras ─────────────────────────────────────
      compras: {
        pedidos: []
        // pedido: { id, fornecedor, descricao, valor,
        //           status, data_emissao, data_entrega }
      },

      // ── 17 ── Planejamento operacional ────────────────────
      planejamento: {
        gantt:          {},   // espelho de gantt do app-core
        data_inicio:    '',
        data_termino:   '',
        equipe_alocada: []
        // membro: { id, colaborador_id, nome, funcao, periodo }
      },

      // ── 18 ── Execução ────────────────────────────────────
      execucao: {
        apontamento_ids: [],   // refs para tabela apontamentos (futuro FK)
        progresso_pct:   0,
        registros:       []
        // registro: { id, data, descricao, responsavel, status }
      },

      // ── 19 ── Entrega e aceite ────────────────────────────
      entrega: {
        checklist:          [],   // { id, item, concluido }
        data_entrega:       '',
        data_aceite:        '',
        responsavel_aceite: '',
        documentos:         [],   // { id, tipo, url }
        observacoes:        ''
      },

      // ── 20 ── Faturamento ─────────────────────────────────
      // Migrado de tl.nfs[] e tl.adiantamentos[]
      faturamento: {
        notas_fiscais:  [],   // { numero, data, valor, status }
        adiantamentos:  [],   // { valor, data }
        canal:          '',
        prazo_pgto:     '',
        adiant_pct:     0
      },

      // ── 21 ── Financeiro ──────────────────────────────────
      financeiro: {
        pagamentos:      [],   // { id, data, valor, forma, status }
        saldo:           0,
        val_receb_final: 0,
        dt_receb_final:  ''
      },

      // ── 22 ── Resultado final ─────────────────────────────
      resultado: {
        lucro_liquido:     0,
        margem_real:       0,
        ciclo_total_dias:  0,
        dt_envio:          '',
        licoes:            [],   // strings
        avaliacao_cliente: '',
        notas_fechamento:  ''
      }
    };
  }
  window.criarStagesVazios = criarStagesVazios;

  // ──────────────────────────────────────────────────────────
  // Semeia stages.escopo.itens a partir de bi[] do app-core
  //
  // Apenas itens com contexto de engenharia explícito são
  // incluídos (equip, faseTrab ou tipoTrab preenchidos).
  // Cada item semeado recebe gera_item=true e item_ref=bi.id.
  // ──────────────────────────────────────────────────────────
  function _semeiarEscopoDeItens(biItens) {
    var resultado = [];
    (biItens || []).forEach(function (it, idx) {
      var temContexto =
        (it.equip    && String(it.equip).trim())    ||
        (it.faseTrab && String(it.faseTrab).trim()) ||
        (it.tipoTrab && String(it.tipoTrab).trim()) ||
        (it.inst     && String(it.inst).trim());
      if (!temContexto) return;
      resultado.push(criarItemEscopo({
        id:          _uid(),
        fase:        it.faseTrab  || '',
        disciplina:  _catToDisciplina(it.cat),
        equipamento: it.equip     || it.inst || '',
        atividade:   it.tipoTrab  || '',
        descricao:   it.desc      || '',
        gera_item:   true,
        item_ref:    it.id        || null,
        ordem:       idx
      }));
    });
    return resultado;
  }

  // ──────────────────────────────────────────────────────────
  // migratePropostaToStages(p)
  //
  // Migra um único objeto proposta para o formato stages v1.
  // Modifica p in-place e retorna p (para encadeamento).
  //
  // Regras:
  //   - Se p.stages._v >= STAGES_VERSION → skip (idempotente)
  //   - Campos top-level (id, num, cli, etc.) NUNCA são tocados
  //   - Dados existentes em stages sub-objetos NUNCA são
  //     sobrescritos — apenas preenchidos quando vazios
  // ──────────────────────────────────────────────────────────
  function migratePropostaToStages(p) {
    if (!p || typeof p !== 'object') return p;
    if (p.stages && p.stages._v >= STAGES_VERSION) return p;

    // Parte do container existente (upgrade parcial) ou começa do zero
    var s = (p.stages && typeof p.stages === 'object')
      ? p.stages
      : criarStagesVazios();

    s._v = STAGES_VERSION;

    var tl = (p.tl && typeof p.tl === 'object') ? p.tl : {};

    // ── 1 ── contato ──────────────────────────────────────
    if (!s.contato) s.contato = criarStagesVazios().contato;
    if (!s.contato.data_contato  && p.dat2) s.contato.data_contato  = p.dat2;
    if (!s.contato.contato_nome  && p.ac)   s.contato.contato_nome  = p.ac;
    if (!s.contato.contato_cargo && p.dep)  s.contato.contato_cargo = p.dep;
    if (!s.contato.telefone      && p.tel)  s.contato.telefone      = p.tel;
    if (!s.contato.email         && p.mail) s.contato.email         = p.mail;
    // Contato secundário como segunda entrada de reunioes (se diferente)
    if (!Array.isArray(s.contato.reunioes)) s.contato.reunioes = [];
    if ((p.ac2 || p.dep2 || p.mail2 || p.tel2) && !s.contato.reunioes.length) {
      s.contato.reunioes = [{
        id:             _uid(),
        data:           '',
        tipo:           'contato_secundario',
        pauta:          '',
        participantes:  [{ nome: p.ac2 || '', cargo: p.dep2 || '', email: p.mail2 || '', tel: p.tel2 || '' }],
        resultado:      ''
      }];
    }

    // ── 2 ── visita ───────────────────────────────────────
    if (!s.visita) s.visita = criarStagesVazios().visita;
    if (!s.visita.data_visita && tl.dtVisita) s.visita.data_visita = tl.dtVisita;
    if (!s.visita.local       && p.loc)       s.visita.local       = p.loc;
    if (!s.visita.responsavel && p.res)       s.visita.responsavel = p.res;

    // ── 4 ── consolidação técnica ─────────────────────────
    if (!s.consolidacao) s.consolidacao = criarStagesVazios().consolidacao;
    if (!s.consolidacao.notas_tecnicas          && p.area)    s.consolidacao.notas_tecnicas          = p.area;
    if (!s.consolidacao.equipamentos_principais && p.equip)   s.consolidacao.equipamentos_principais = p.equip;
    if (!s.consolidacao.tensao_alimentacao      && p.tensVal) s.consolidacao.tensao_alimentacao      = p.tensVal;
    if (!s.consolidacao.tensao_comando          && p.tensCmd) s.consolidacao.tensao_comando          = p.tensCmd;
    if (!s.consolidacao.tensoes_especiais.length && Array.isArray(p.tens) && p.tens.length) {
      s.consolidacao.tensoes_especiais = p.tens.slice();
    }

    // ── 8 ── estrutura (blocos da proposta — apresentação) ─
    if (!s.estrutura) s.estrutura = criarStagesVazios().estrutura;
    if (!s.estrutura.blocos.length && Array.isArray(p.esc) && p.esc.length) {
      s.estrutura.blocos = JSON.parse(JSON.stringify(p.esc));
    }

    // ── 9 ── escopo estruturado (engineering-driven) ──────
    if (!s.escopo) s.escopo = criarStagesVazios().escopo;
    if (!s.escopo.itens.length) {
      var semeados = _semeiarEscopoDeItens(p.bi);
      if (semeados.length) s.escopo.itens = semeados;
    }

    // ── 10 ── itens da proposta ───────────────────────────
    if (!s.itens) s.itens = criarStagesVazios().itens;
    if (!s.itens.lista.length && Array.isArray(p.bi) && p.bi.length) {
      s.itens.lista = JSON.parse(JSON.stringify(p.bi));
    }

    // ── 11 ── análise financeira ──────────────────────────
    if (!s.analise_fin) s.analise_fin = criarStagesVazios().analise_fin;
    if (!s.analise_fin.preco_venda && p.val)   s.analise_fin.preco_venda = p.val;
    if (p.aliq && !Object.keys(s.analise_fin.impostos).length) {
      s.analise_fin.impostos = JSON.parse(JSON.stringify(p.aliq));
    }

    // ── 13 ── follow-up comercial ─────────────────────────
    // Converte fases enum (follow1-4) em entrada do histórico
    if (!s.followup) s.followup = criarStagesVazios().followup;
    if (!s.followup.historico.length) {
      var _followMap = { follow1: 1, follow2: 2, follow3: 3, follow4: 4 };
      if (_followMap[p.fas] !== undefined) {
        s.followup.historico = [{
          id:           _uid(),
          data:         p.dat2 || '',
          tipo:         'follow-up',
          contato:      p.ac   || '',
          outcome:      'Em andamento (migrado de ' + p.fas + ')',
          proxima_acao: '',
          proxima_data: ''
        }];
      }
    }

    // ── 14 ── negociação ──────────────────────────────────
    if (!s.negociacao) s.negociacao = criarStagesVazios().negociacao;
    if (!s.negociacao.desconto_aceito && p.aliq && p.aliq.neg) {
      s.negociacao.desconto_aceito = p.aliq.neg;
    }

    // ── 15 ── aprovação ───────────────────────────────────
    if (!s.aprovacao) s.aprovacao = criarStagesVazios().aprovacao;
    if (!s.aprovacao.valor_final && p.val) s.aprovacao.valor_final = p.val;

    // ── 17 ── planejamento operacional ────────────────────
    if (!s.planejamento) s.planejamento = criarStagesVazios().planejamento;
    if (!Object.keys(s.planejamento.gantt).length && p.gantt && Object.keys(p.gantt).length) {
      s.planejamento.gantt = JSON.parse(JSON.stringify(p.gantt));
    }
    if (!s.planejamento.data_inicio  && tl.dtInicioExec) s.planejamento.data_inicio  = tl.dtInicioExec;
    if (!s.planejamento.data_termino && tl.dtTermino)    s.planejamento.data_termino = tl.dtTermino;

    // ── 19 ── entrega e aceite ────────────────────────────
    if (!s.entrega) s.entrega = criarStagesVazios().entrega;
    if (!s.entrega.data_aceite && tl.dtAceite) s.entrega.data_aceite = tl.dtAceite;

    // ── 20 ── faturamento ─────────────────────────────────
    if (!s.faturamento) s.faturamento = criarStagesVazios().faturamento;
    if (!s.faturamento.notas_fiscais.length && Array.isArray(tl.nfs) && tl.nfs.length) {
      s.faturamento.notas_fiscais = JSON.parse(JSON.stringify(tl.nfs));
    }
    if (!s.faturamento.adiantamentos.length && Array.isArray(tl.adiantamentos) && tl.adiantamentos.length) {
      s.faturamento.adiantamentos = JSON.parse(JSON.stringify(tl.adiantamentos));
    }
    if (!s.faturamento.canal      && tl.canal)      s.faturamento.canal      = tl.canal;
    if (!s.faturamento.prazo_pgto && tl.prazoPgto)  s.faturamento.prazo_pgto = tl.prazoPgto;
    if (!s.faturamento.adiant_pct && tl.adiantPct)  s.faturamento.adiant_pct = tl.adiantPct;

    // ── 21 ── financeiro ──────────────────────────────────
    if (!s.financeiro) s.financeiro = criarStagesVazios().financeiro;
    if (!s.financeiro.val_receb_final && tl.valRecebFinal) s.financeiro.val_receb_final = tl.valRecebFinal;
    if (!s.financeiro.dt_receb_final  && tl.dtRecebFinal)  s.financeiro.dt_receb_final  = tl.dtRecebFinal;

    // ── 22 ── resultado final ─────────────────────────────
    if (!s.resultado) s.resultado = criarStagesVazios().resultado;
    if (!s.resultado.dt_envio && tl.dtEnvio) s.resultado.dt_envio = tl.dtEnvio;

    p.stages = s;
    return p;
  }
  window.migratePropostaToStages = migratePropostaToStages;

  // ──────────────────────────────────────────────────────────
  // migrarTodasPropostas(arr)
  //
  // Roda migratePropostaToStages() em cada proposta do array.
  // Modifica in-place. Retorna contagem de propostas migradas
  // nesta chamada (útil para decidir se deve re-salvar o LS).
  // ──────────────────────────────────────────────────────────
  function migrarTodasPropostas(arr) {
    if (!Array.isArray(arr)) return 0;
    var count = 0;
    arr.forEach(function (p) {
      var jaOk = p && p.stages && p.stages._v >= STAGES_VERSION;
      migratePropostaToStages(p);
      if (!jaOk) count++;
    });
    return count;
  }
  window.migrarTodasPropostas = migrarTodasPropostas;

  console.log('%cproposta-stages.js v' + STAGES_VERSION + ' carregado', 'color:#58a6ff;font-weight:700');

}(window));

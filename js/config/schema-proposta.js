// ============================================================
// schema-proposta.js — Contrato do objeto proposta (dados_json)
//
// Este arquivo documenta os campos obrigatórios e opcionais de
// uma proposta e fornece funções de validação e migração segura.
// Versão atual do schema: 2
// ============================================================

(function () {

  // ── Schema esperado ──────────────────────────────────────
  // Cada campo: { type, required, default, since }
  var SCHEMA_V2 = {
    id:       { type: 'string',  required: true  },
    num:      { type: 'string',  required: true  },  // número da proposta
    tit:      { type: 'string',  required: true  },  // título
    cli:      { type: 'string',  required: false },  // cliente
    loc:      { type: 'string',  required: false },  // localidade (legado → cli)
    val:      { type: 'number',  required: false, default: 0 },    // valor total
    fas:      { type: 'string',  required: false, default: 'em_elaboracao' }, // fase
    itens:    { type: 'array',   required: false, default: [] },   // itens de orçamento
    secs:     { type: 'array',   required: false, default: [] },   // seções do documento
    rev:      { type: 'number',  required: false, default: 0 },    // revisão
    revs:     { type: 'array',   required: false, default: [] },   // histórico de revisões
    cat:      { type: 'string',  required: false, default: '' },   // categoria principal
    obs:      { type: 'string',  required: false, default: '' },   // observações
    data_cri: { type: 'string',  required: false },  // data de criação (ISO)
    data_atu: { type: 'string',  required: false },  // data de atualização (ISO)
    data_apr: { type: 'string',  required: false },  // data de aprovação (ISO)
    stages:   { type: 'object',  required: false, default: {}, since: 2 }, // stages v1
    _sv:      { type: 'number',  required: false, default: 2 }     // schema version
  };

  // ── Versão atual do schema ───────────────────────────────
  var SCHEMA_VERSION = 2;

  // ── Validar proposta contra o schema ────────────────────
  window.validarProposta = function (p) {
    if (!p || typeof p !== 'object') return { ok: false, erros: ['proposta inválida ou nula'] };
    var erros = [];
    Object.keys(SCHEMA_V2).forEach(function (campo) {
      var def = SCHEMA_V2[campo];
      if (def.required && (p[campo] === undefined || p[campo] === null || p[campo] === '')) {
        erros.push('Campo obrigatório ausente: ' + campo);
      }
    });
    return { ok: erros.length === 0, erros: erros };
  };

  // ── Migrar proposta para schema atual (idempotente) ──────
  // Não remove campos desconhecidos (forward-compatible).
  // Apenas preenche defaults de campos faltantes.
  window.migrarProposta = function (p) {
    if (!p || typeof p !== 'object') return p;
    var sv = p._sv || 1;
    if (sv >= SCHEMA_VERSION) return p;  // já está atualizado

    // Aplicar defaults de campos ausentes
    Object.keys(SCHEMA_V2).forEach(function (campo) {
      var def = SCHEMA_V2[campo];
      if (p[campo] === undefined && def.default !== undefined) {
        p[campo] = typeof def.default === 'object'
          ? JSON.parse(JSON.stringify(def.default))  // deep copy para arrays/objetos
          : def.default;
      }
    });

    // Normalizar legado: loc → cli
    if (!p.cli && p.loc) p.cli = p.loc;

    // Marcar versão
    p._sv = SCHEMA_VERSION;
    return p;
  };

  // ── Migrar todas as propostas do localStorage ────────────
  // Retorna o número de propostas migradas.
  window.migrarTodasPropostas = function (lista) {
    if (!Array.isArray(lista)) return 0;
    var count = 0;
    lista.forEach(function (p, i) {
      var sv = p._sv || 1;
      if (sv < SCHEMA_VERSION) {
        lista[i] = window.migrarProposta(p);
        count++;
      }
    });
    return count;
  };

  // ── Criar proposta vazia com defaults ────────────────────
  window.novaProposta = function (overrides) {
    var base = {
      id:       '',
      num:      '',
      tit:      '',
      cli:      '',
      val:      0,
      fas:      'em_elaboracao',
      itens:    [],
      secs:     [],
      rev:      0,
      revs:     [],
      cat:      '',
      obs:      '',
      data_cri: new Date().toISOString(),
      data_atu: new Date().toISOString(),
      stages:   {},
      _sv:      SCHEMA_VERSION
    };
    return Object.assign(base, overrides || {});
  };

  console.log('%c[schema-proposta] v' + SCHEMA_VERSION + ' carregado', 'color:#58a6ff');

})();

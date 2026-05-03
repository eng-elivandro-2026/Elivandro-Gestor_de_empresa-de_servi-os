'use strict';
/* ============================================================
   dimensionador.js — Módulo Dimensionador de Eletrocalha
   Portal Fortex | Tecfusion / Fortex Tecnologia Industrial
   ============================================================ */
(function (win) {

  // ── utilitário local para não depender da ordem de carga ──
  function _uid() {
    return typeof uid === 'function'
      ? uid()
      : 'dim-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function _toast(msg, t) { if (typeof toast === 'function') toast(msg, t || 'ok'); }
  function _q(id) { return document.getElementById(id); }

  // ─────────────────────────────────────────────────────────────
  // ESTADO GLOBAL DO DIMENSIONADOR
  // ─────────────────────────────────────────────────────────────
  var _ds = {
    etapa: 1,          // etapa atual (1–6)
    desc: '',          // descrição / referência do serviço
    trechos: [],       // array de objetos trecho
    ec: {              // especificação da eletrocalha
      perfil:     'DP701',
      largura:    200,
      altura:     75,
      material:   'AC',
      acabamento: 'GF',
      chapa:      '16',
      tampa:      'sem',
      divisor:    'sem'
    },
    conexoes: {        // conexões do trajeto
      curvas_h:  [],   // [{qtd, angulo}]
      curvas_vi: [],   // [{qtd, angulo}]
      curvas_ve: [],   // [{qtd, angulo}]
      tes:       0,
      reducoes:  []    // [{qtd, de, para}]
    },
    fin: {             // finalizações
      terminal:     false,
      fator_perda:  5
    },
    itens: [],         // itens gerados/editados
    log:   [],         // log de ações manuais
    _dimId: null,      // id do dimensionamento salvo no Supabase
    _propostaId: null  // proposta ativa ao abrir
  };

  // ── trecho padrão ──
  function _novoTrecho() {
    return {
      id:                  _uid(),
      tipo:                'suspensao',
      comprimento:         10,
      // suspensão
      altura_mm:           1500,
      espacamento:         1.5,
      fixacao_viga:        'grampo_c',
      bitola_vergalhao:    '3/8',
      tipo_suporte:        'horizontal',
      // parede
      espacamento_parede:  1.5,
      tipo_suporte_parede: 'simples'
    };
  }

  // ─────────────────────────────────────────────────────────────
  // ABRIR / FECHAR
  // ─────────────────────────────────────────────────────────────
  function abrirDimensionador() {
    _ds._propostaId = (typeof editId !== 'undefined') ? editId : null;
    if (!_ds.trechos.length) _ds.trechos.push(_novoTrecho());
    _renderOverlay();
    var o = _q('dimOverlay');
    if (o) { o.style.display = 'flex'; }
    _renderEtapa();
  }

  function fecharDimensionador() {
    var o = _q('dimOverlay');
    if (o) o.style.display = 'none';
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER PRINCIPAL
  // ─────────────────────────────────────────────────────────────
  function _renderEtapa() {
    _atualizarStepBar();
    var c = _q('dimContent');
    if (!c) return;
    var html = '';
    switch (_ds.etapa) {
      case 1: html = _htmlBloco1(); break;
      case 2: html = _htmlBloco2(); break;
      case 3: html = _htmlBloco3(); break;
      case 4: html = _htmlBloco4(); break;
      case 5: html = _htmlBloco5(); break;
      case 6: html = _htmlLista(); break;
      default: html = '';
    }
    c.innerHTML = html;
    _atualizarBotoesNav();
    _bindEtapaEvents();
  }

  function _atualizarStepBar() {
    var steps = [
      { n: 1, label: 'Identificação' },
      { n: 2, label: 'Trechos' },
      { n: 3, label: 'Eletrocalha' },
      { n: 4, label: 'Conexões' },
      { n: 5, label: 'Finalizações' },
      { n: 6, label: 'Lista' }
    ];
    var bar = _q('dimStepBar');
    if (!bar) return;
    bar.innerHTML = steps.map(function (s) {
      var ativo = s.n === _ds.etapa;
      var done  = s.n < _ds.etapa;
      var cor   = ativo ? '#f05a1a' : done ? '#22c55e' : '#475569';
      var bg    = ativo ? 'rgba(240,90,26,.12)' : 'transparent';
      return '<button onclick="dimGoTo(' + s.n + ')" style="' +
        'display:flex;align-items:center;gap:.35rem;padding:.35rem .75rem;' +
        'border:1px solid ' + (ativo ? '#f05a1a' : done ? '#22c55e' : '#334155') + ';' +
        'border-radius:20px;background:' + bg + ';cursor:pointer;white-space:nowrap;' +
        'font-size:.72rem;font-weight:' + (ativo ? '700' : '500') + ';color:' + cor + '">' +
        '<span style="width:17px;height:17px;border-radius:50%;background:' + cor + ';' +
        'color:#fff;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:700">' +
        (done ? '✓' : s.n) + '</span>' + s.label + '</button>';
    }).join('<span style="color:#334155;align-self:center;margin:0 .1rem">›</span>');
  }

  function _atualizarBotoesNav() {
    var btnBack = _q('dimBtnBack');
    var btnNext = _q('dimBtnNext');
    var btnCalc = _q('dimBtnCalc');
    if (!btnBack) return;
    btnBack.style.display = _ds.etapa === 1 ? 'none' : '';
    if (_ds.etapa === 5) {
      btnNext.style.display = 'none';
      btnCalc.style.display = '';
    } else if (_ds.etapa === 6) {
      btnNext.style.display = 'none';
      btnCalc.style.display = '';
      btnCalc.textContent = '⚡ Recalcular';
    } else {
      btnNext.style.display = '';
      btnCalc.style.display = 'none';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // BLOCO 1 — IDENTIFICAÇÃO
  // ─────────────────────────────────────────────────────────────
  function _htmlBloco1() {
    return '<div style="max-width:600px;margin:0 auto">' +
      '<div class="card" style="padding:1.25rem">' +
      '<div class="ct" style="margin-bottom:1rem">📋 Identificação do Serviço</div>' +
      '<p class="hint" style="margin-bottom:1.25rem">Informe o nome/referência deste dimensionamento. O tipo de serviço é fixo: <strong>Instalação de Eletrocalha</strong>.</p>' +
      _campo('Referência / Descrição', '<input id="dimDesc" type="text" class="inp" placeholder="Ex: Trajeto Área 2 — Linha 3" value="' + _esc(_ds.desc) + '" style="width:100%">', true) +
      '</div></div>';
  }

  // ─────────────────────────────────────────────────────────────
  // BLOCO 2 — TRECHOS
  // ─────────────────────────────────────────────────────────────
  function _htmlBloco2() {
    var rows = _ds.trechos.map(function (t, i) {
      return _htmlTrechoCard(t, i);
    }).join('');
    return '<div style="max-width:760px;margin:0 auto">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem">' +
      '<div class="ct">📍 Trechos do Trajeto</div>' +
      '<button onclick="dimAddTrecho()" class="btn bs bsm">+ Adicionar Trecho</button>' +
      '</div>' +
      '<p class="hint" style="margin-bottom:1rem">Divida o trajeto em trechos conforme o tipo de fixação. Cada trecho pode ter parâmetros diferentes.</p>' +
      rows + '</div>';
  }

  function _htmlTrechoCard(t, i) {
    var tipos = [
      { v: 'suspensao', l: '🔗 Suspensão em viga' },
      { v: 'parede',    l: '🧱 Fixação em parede' },
      { v: 'coluna',    l: '🏛️ Sobre suporte/coluna' },
      { v: 'sobre_calha', l: '📦 Sobre calha existente' }
    ];
    var tipoSel = _radioGroup('dimTrechoTipo_' + i, tipos, t.tipo, 'dimTrechoChange(' + i + ')');

    var paramsSusp = t.tipo === 'suspensao' ? _htmlParamsSusp(t, i) : '';
    var paramsParede = t.tipo === 'parede' ? _htmlParamsParede(t, i) : '';

    return '<div class="card" style="margin-bottom:.85rem;padding:1rem" id="trechoCard_' + i + '">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem">' +
      '<strong style="color:var(--accent)">Trecho ' + (i + 1) + '</strong>' +
      (_ds.trechos.length > 1
        ? '<button onclick="dimRemoveTrecho(' + i + ')" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:.8rem">🗑 Remover</button>'
        : '') +
      '</div>' +
      _campo('Tipo de montagem', tipoSel) +
      _campo('Comprimento do trecho (m)',
        '<input id="dimTrechoComp_' + i + '" type="number" min="0.5" step="0.5" class="inp" value="' + t.comprimento + '" style="width:120px">') +
      paramsSusp + paramsParede +
      '</div>';
  }

  function _htmlParamsSusp(t, i) {
    var alts = [
      { v: '500',  l: '500 mm' }, { v: '1000', l: '1.000 mm' },
      { v: '1500', l: '1.500 mm' }, { v: '2000', l: '2.000 mm' },
      { v: '2500', l: '2.500 mm' }, { v: '3000', l: '3.000 mm' }
    ];
    var esps = [
      { v: '0.5', l: '0,5 m' }, { v: '1.0', l: '1,0 m' },
      { v: '1.5', l: '1,5 m' }, { v: '2.0', l: '2,0 m' }
    ];
    var fixs = [
      { v: 'grampo_c',   l: '🗜️ Grampo C (DP538)' },
      { v: 'chumbador',  l: '⚓ Chumbador (DP625)' },
      { v: 'olhal',      l: '🔩 Parafuso Olhal (DP609)' }
    ];
    var bits = [
      { v: '1/4',  l: '¼" — até 450 kg' },
      { v: '5/16', l: '5⁄16" — até 600 kg' },
      { v: '3/8',  l: '⅜" — até 920 kg' },
      { v: '1/2',  l: '½" — até 1.250 kg' }
    ];
    var sups = [
      { v: 'horizontal', l: 'Horizontal DP742' },
      { v: 'vertical',   l: 'Vertical DP743' },
      { v: 'duplo',      l: 'Duplo DP744' },
      { v: 'reforcado',  l: 'Reforçado DP745' }
    ];
    return '<div style="border-top:1px solid var(--border);margin-top:.75rem;padding-top:.75rem">' +
      '<div style="font-size:.72rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.6rem">⚙️ Parâmetros de Suspensão</div>' +
      _campo('Altura de suspensão',
        _radioGroup('dimAlt_' + i, alts, String(t.altura_mm), null, true)) +
      _campo('Espaçamento entre pontos',
        _radioGroup('dimEsp_' + i, esps, String(t.espacamento), null, true)) +
      _campo('Fixação na viga',
        _radioGroup('dimFix_' + i, fixs, t.fixacao_viga, null, true)) +
      _campo('Bitola do vergalhão',
        _radioGroup('dimBit_' + i, bits, t.bitola_vergalhao, null, true)) +
      _campo('Tipo de suporte',
        _radioGroup('dimSup_' + i, sups, t.tipo_suporte, null, true)) +
      '</div>';
  }

  function _htmlParamsParede(t, i) {
    var esps = [
      { v: '0.5', l: '0,5 m' }, { v: '1.0', l: '1,0 m' },
      { v: '1.5', l: '1,5 m' }, { v: '2.0', l: '2,0 m' }
    ];
    var sups = [
      { v: 'simples',   l: 'Mão Francesa Simples DP746' },
      { v: 'duplo',     l: 'Mão Francesa Dupla DP747' },
      { v: 'reforcado', l: 'Mão Francesa Reforçada DP748' }
    ];
    return '<div style="border-top:1px solid var(--border);margin-top:.75rem;padding-top:.75rem">' +
      '<div style="font-size:.72rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.6rem">⚙️ Parâmetros de Parede</div>' +
      _campo('Espaçamento entre pontos',
        _radioGroup('dimEspP_' + i, esps, String(t.espacamento_parede), null, true)) +
      _campo('Tipo de suporte',
        _radioGroup('dimSupP_' + i, sups, t.tipo_suporte_parede, null, true)) +
      '</div>';
  }

  // ─────────────────────────────────────────────────────────────
  // BLOCO 3 — ELETROCALHA
  // ─────────────────────────────────────────────────────────────
  function _htmlBloco3() {
    var ec = _ds.ec;
    var perfis = [
      { v: 'DP700',  l: 'DP700 — Perfurada Leve' },
      { v: 'DP701',  l: 'DP701 — Perfurada Standard' },
      { v: 'DP701E', l: 'DP701E — Perfurada Esforço' },
      { v: 'DP702',  l: 'DP702 — Lisa Leve' },
      { v: 'DP703',  l: 'DP703 — Lisa Standard' },
      { v: 'DP703E', l: 'DP703E — Lisa Esforço' },
      { v: 'DP704',  l: 'DP704 — Reforçada' },
      { v: 'DP705',  l: 'DP705 — Extra Reforçada' }
    ];
    var larguras = [50, 75, 100, 150, 200, 300, 400, 500, 600, 800, 1000].map(function (l) {
      return { v: String(l), l: l + ' mm' };
    });
    var alturas = [50, 75, 100].map(function (a) {
      return { v: String(a), l: a + ' mm' };
    });
    var mats = [
      { v: 'AC', l: '🔩 Aço Carbono (AC)' },
      { v: 'AI', l: '✨ Aço Inox (AI)' },
      { v: 'AL', l: '🪶 Alumínio (AL)' }
    ];
    var acabs = [
      { v: 'GF', l: 'Galvanizado a Fogo (GF)' },
      { v: 'GE', l: 'Galvanizado Eletrolítico (GE)' },
      { v: 'PZ', l: 'Pré-Zincado (PZ)' },
      { v: 'PT', l: 'Pintado (PT)' },
      { v: 'NT', l: 'Natural (NT)' }
    ];
    var chapas = [
      { v: '12', l: '#12 (2,70 mm)' },
      { v: '14', l: '#14 (1,90 mm)' },
      { v: '16', l: '#16 (1,50 mm)' },
      { v: '18', l: '#18 (1,20 mm)' },
      { v: '20', l: '#20 (0,90 mm)' }
    ];
    var tampas = [
      { v: 'sem',          l: '🚫 Sem tampa' },
      { v: 'encaixe',      l: 'Encaixe DP706' },
      { v: 'pressao',      l: 'Pressão DP707' },
      { v: 'duas_aguas',   l: '2 Águas DP706-2A' },
      { v: 'fecho_rapido', l: 'Fecho Rápido DP706-FR' },
      { v: 'aparafusada',  l: 'Aparafusada DP706-AP' }
    ];
    var divisores = [
      { v: 'sem',       l: '🚫 Sem divisor' },
      { v: 'perfurado', l: 'Perfurado DP708' },
      { v: 'liso',      l: 'Liso DP709' }
    ];

    // Alerta validação: tampa fecho rápido + sem virola
    var alertaFR = (ec.tampa === 'fecho_rapido')
      ? '<div style="background:rgba(248,81,73,.08);border:1px solid #f85149;border-radius:6px;padding:.5rem .75rem;font-size:.77rem;color:#f85149;margin-top:.5rem">⚠️ Tampa Fecho Rápido exige virola nos acessórios.</div>'
      : '';

    return '<div style="max-width:680px;margin:0 auto">' +
      '<div class="card" style="padding:1.25rem">' +
      '<div class="ct" style="margin-bottom:1rem">⚡ Especificação da Eletrocalha</div>' +
      _campo('Tipo de perfil', _radioGroup('dimPerfil', perfis, ec.perfil, null, true)) +
      _campo('Largura', _radioGroup('dimLarg', larguras, String(ec.largura), null, true)) +
      _campo('Altura da aba', _radioGroup('dimAlt3', alturas, String(ec.altura), null, true)) +
      _campo('Material', _radioGroup('dimMat', mats, ec.material, null, true)) +
      _campo('Acabamento', _radioGroup('dimAcab', acabs, ec.acabamento, null, true)) +
      _campo('Espessura da chapa', _radioGroup('dimChapa', chapas, ec.chapa, null, true)) +
      _campo('Tampa', _radioGroup('dimTampa', tampas, ec.tampa, null, true)) +
      alertaFR +
      _campo('Divisor / Septo', _radioGroup('dimDiv', divisores, ec.divisor, null, true)) +
      _previewSku() +
      '</div></div>';
  }

  function _previewSku() {
    var ec = _ds.ec;
    var sku = ec.perfil + '-' + ec.material + '-' + ec.acabamento + '-' + ec.largura + '/' + ec.altura + '-' + ec.chapa;
    return '<div style="margin-top:1rem;padding:.6rem .9rem;background:rgba(240,90,26,.07);border:1px solid rgba(240,90,26,.3);border-radius:6px;font-size:.8rem">' +
      '<span style="color:var(--text3)">Código gerado: </span>' +
      '<strong style="color:var(--accent)">' + sku + '</strong>' +
      '</div>';
  }

  // ─────────────────────────────────────────────────────────────
  // BLOCO 4 — CONEXÕES
  // ─────────────────────────────────────────────────────────────
  function _htmlBloco4() {
    var con = _ds.conexoes;
    var angulos = ['30', '45', '60', '90'];

    function rowConexao(label, key, subkey) {
      var items = con[key] || [];
      var rows = items.map(function (c, i) {
        return '<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem">' +
          '<input type="number" min="0" value="' + (c.qtd || 0) + '" style="width:64px" class="inp" ' +
          'onchange="dimConexaoQtd(\'' + key + '\',' + i + ',this.value)">' +
          '<span style="color:var(--text3);font-size:.8rem">un</span>' +
          _selectAngle(key + '_ang_' + i, c.angulo, 'dimConexaoAng(\'' + key + '\',' + i + ',this.value)') +
          '<button onclick="dimRemoveConexao(\'' + key + '\',' + i + ')" style="background:none;border:none;color:#f85149;cursor:pointer">✕</button>' +
          '</div>';
      }).join('');
      return _campo(label,
        '<div>' + rows +
        '<button onclick="dimAddConexao(\'' + key + '\')" class="btn bg bsm" style="margin-top:.3rem">+ Adicionar</button>' +
        '</div>');
    }

    function rowSimples(label, key) {
      return _campo(label,
        '<input id="dim_' + key + '" type="number" min="0" value="' + (con[key] || 0) + '" class="inp" style="width:80px">');
    }

    function rowReducoes() {
      var rows = (con.reducoes || []).map(function (r, i) {
        return '<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem">' +
          '<input type="number" min="1" value="' + (r.qtd || 1) + '" style="width:56px" class="inp" ' +
          'onchange="dimReducaoField(' + i + ',\'qtd\',this.value)"> un' +
          '<span style="color:var(--text3);font-size:.78rem;margin:0 .3rem">de</span>' +
          '<input type="number" min="50" value="' + (r.de || 200) + '" style="width:70px" class="inp" ' +
          'onchange="dimReducaoField(' + i + ',\'de\',this.value)"> mm' +
          '<span style="color:var(--text3);font-size:.78rem;margin:0 .3rem">→</span>' +
          '<input type="number" min="50" value="' + (r.para || 100) + '" style="width:70px" class="inp" ' +
          'onchange="dimReducaoField(' + i + ',\'para\',this.value)"> mm' +
          '<button onclick="dimRemoveReducao(' + i + ')" style="background:none;border:none;color:#f85149;cursor:pointer">✕</button>' +
          '</div>';
      }).join('');
      return _campo('Reduções de largura',
        '<div>' + rows +
        '<button onclick="dimAddReducao()" class="btn bg bsm" style="margin-top:.3rem">+ Adicionar</button>' +
        '</div>');
    }

    return '<div style="max-width:640px;margin:0 auto">' +
      '<div class="card" style="padding:1.25rem">' +
      '<div class="ct" style="margin-bottom:.5rem">🔄 Conexões do Trajeto</div>' +
      '<p class="hint" style="margin-bottom:1rem">Informe as conexões necessárias no trajeto. Deixe 0 onde não houver.</p>' +
      rowConexao('Curvas horizontais', 'curvas_h') +
      rowConexao('Curvas verticais internas', 'curvas_vi') +
      rowConexao('Curvas verticais externas', 'curvas_ve') +
      rowSimples('Tês / Derivações (un)', 'tes') +
      rowReducoes() +
      '</div></div>';
  }

  function _selectAngle(id, val, onchange) {
    var opts = ['30', '45', '60', '90'].map(function (a) {
      return '<option value="' + a + '"' + (String(val) === a ? ' selected' : '') + '>' + a + '°</option>';
    }).join('');
    return '<select id="' + id + '" class="inp" style="width:80px" onchange="' + onchange + '">' + opts + '</select>';
  }

  // ─────────────────────────────────────────────────────────────
  // BLOCO 5 — FINALIZAÇÕES
  // ─────────────────────────────────────────────────────────────
  function _htmlBloco5() {
    var fin = _ds.fin;
    var comprTotal = _ds.trechos.reduce(function (s, t) { return s + (parseFloat(t.comprimento) || 0); }, 0);
    return '<div style="max-width:560px;margin:0 auto">' +
      '<div class="card" style="padding:1.25rem">' +
      '<div class="ct" style="margin-bottom:1rem">✅ Finalizações e Fator de Perda</div>' +
      _campo('Terminal nas extremidades',
        '<label style="display:flex;align-items:center;gap:.6rem;cursor:pointer">' +
        '<input type="checkbox" id="dimTerminal"' + (fin.terminal ? ' checked' : '') + ' style="width:16px;height:16px"> ' +
        '<span>Incluir Tampa Terminal DP737 nas pontas</span></label>') +
      _campo('Fator de perda / sobra (%)',
        '<input id="dimFatorPerda" type="number" min="0" max="30" step="1" class="inp" value="' + fin.fator_perda + '" style="width:100px">') +
      '<div style="margin-top:1.25rem;padding:.85rem 1rem;background:rgba(88,166,255,.06);border:1px solid rgba(88,166,255,.2);border-radius:6px;font-size:.83rem;color:var(--text2)">' +
      '<div style="font-weight:600;margin-bottom:.4rem">📏 Resumo do dimensionamento</div>' +
      '<div>Comprimento total: <strong>' + comprTotal.toFixed(1) + ' m</strong></div>' +
      '<div>Trechos configurados: <strong>' + _ds.trechos.length + '</strong></div>' +
      '<div>Tipo de perfil: <strong>' + _ds.ec.perfil + '</strong></div>' +
      '<div>Dimensão: <strong>' + _ds.ec.largura + ' × ' + _ds.ec.altura + ' mm</strong></div>' +
      '<div>Material / Acabamento: <strong>' + _ds.ec.material + ' / ' + _ds.ec.acabamento + '</strong></div>' +
      (fin.terminal ? '<div>Terminais: <strong>Sim (DP737)</strong></div>' : '') +
      '</div>' +
      '</div></div>';
  }

  // ─────────────────────────────────────────────────────────────
  // BLOCO 6 — LISTA DE MATERIAIS GERADA
  // ─────────────────────────────────────────────────────────────
  function _htmlLista() {
    if (!_ds.itens.length) {
      return '<div style="text-align:center;padding:3rem;color:var(--text3)">Clique em <strong>⚡ Calcular Lista</strong> para gerar os materiais.</div>';
    }
    var rows = _ds.itens.map(function (it, i) {
      var cuVal = it.custo_unitario != null ? it.custo_unitario : '';
      return '<tr id="dimItemRow_' + i + '">' +
        '<td style="color:var(--text3)">' + (i + 1) + '</td>' +
        '<td><span style="background:rgba(240,90,26,.12);color:#f05a1a;border-radius:4px;padding:.1rem .45rem;font-size:.72rem;font-weight:600">' + it.categoria_me + '</span></td>' +
        '<td style="font-family:monospace;font-size:.78rem;color:#58a6ff">' + _esc(it.codigo_fabricante) + '</td>' +
        '<td style="font-size:.8rem;max-width:260px">' + _esc(it.descricao_completa) + '</td>' +
        '<td style="text-align:right;font-weight:600">' + _fmt(it.quantidade) + '</td>' +
        '<td>' + _esc(it.unidade) + '</td>' +
        '<td><input type="number" min="0" step="0.01" placeholder="—" value="' + cuVal + '" ' +
        'onchange="dimSetCU(' + i + ',this.value)" ' +
        'style="width:90px;background:var(--bg1);border:1px solid var(--border);color:var(--text1);border-radius:4px;padding:.2rem .4rem;font-size:.78rem"></td>' +
        '<td>' +
        '<button onclick="dimEditarItem(' + i + ')" title="Editar" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:.85rem">✏️</button>' +
        '<button onclick="dimDuplicarItem(' + i + ')" title="Duplicar" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:.85rem">📄</button>' +
        '<button onclick="dimExcluirItem(' + i + ')" title="Excluir" style="background:none;border:none;cursor:pointer;color:#f85149;font-size:.85rem">🗑</button>' +
        '</td>' +
        '</tr>';
    }).join('');

    return '<div>' +
      // Barra de ações
      '<div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem">' +
      '<strong style="color:var(--accent)">' + _ds.itens.length + ' itens gerados</strong>' +
      '<div style="margin-left:auto;display:flex;gap:.5rem;flex-wrap:wrap">' +
      '<button onclick="dimExportExcel()" class="btn bg bsm">📊 Excel</button>' +
      '<button onclick="dimExportWord()" class="btn bg bsm">📝 Word</button>' +
      '<button onclick="dimExportPdf()" class="btn bg bsm">📄 PDF</button>' +
      '<button onclick="dimAbrirInserir()" class="btn bp bsm" style="font-weight:700">✅ Inserir no Orçamento</button>' +
      '</div></div>' +
      // Tabela
      '<div style="overflow-x:auto">' +
      '<table style="width:100%;border-collapse:collapse;font-size:.8rem">' +
      '<thead><tr style="color:var(--text3);font-size:.7rem;text-transform:uppercase;letter-spacing:.04em">' +
      '<th style="padding:.4rem .6rem;text-align:left;border-bottom:1px solid var(--border)">#</th>' +
      '<th style="padding:.4rem .6rem;text-align:left;border-bottom:1px solid var(--border)">Cat.</th>' +
      '<th style="padding:.4rem .6rem;text-align:left;border-bottom:1px solid var(--border)">Código</th>' +
      '<th style="padding:.4rem .6rem;text-align:left;border-bottom:1px solid var(--border)">Descrição</th>' +
      '<th style="padding:.4rem .6rem;text-align:right;border-bottom:1px solid var(--border)">Qtd</th>' +
      '<th style="padding:.4rem .6rem;text-align:left;border-bottom:1px solid var(--border)">Un</th>' +
      '<th style="padding:.4rem .6rem;text-align:left;border-bottom:1px solid var(--border)">Custo Unit. R$</th>' +
      '<th style="padding:.4rem .6rem;border-bottom:1px solid var(--border)">Ações</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '</table></div>' +
      // Legenda
      '<p class="hint" style="margin-top:.75rem">💡 Preencha o <strong>Custo Unit. R$</strong> após receber a cotação. Os valores serão aplicados ao inserir no orçamento.</p>' +
      '</div>';
  }

  // ─────────────────────────────────────────────────────────────
  // NAVEGAÇÃO
  // ─────────────────────────────────────────────────────────────
  function dimNext() {
    if (!_coletarEtapaAtual()) return;
    if (_ds.etapa < 5) { _ds.etapa++; _renderEtapa(); }
  }

  function dimBack() {
    if (_ds.etapa > 1) { _ds.etapa--; _renderEtapa(); }
  }

  function dimGoTo(n) {
    if (n > _ds.etapa && !_coletarEtapaAtual()) return;
    _ds.etapa = n;
    _renderEtapa();
  }

  // ── coletar dados dos inputs da etapa atual ──
  function _coletarEtapaAtual() {
    switch (_ds.etapa) {
      case 1: return _coletarBloco1();
      case 2: return _coletarBloco2();
      case 3: return _coletarBloco3();
      case 4: return _coletarBloco4();
      case 5: return _coletarBloco5();
      default: return true;
    }
  }

  function _coletarBloco1() {
    var v = (_q('dimDesc') || {}).value || '';
    if (!v.trim()) { _toast('Informe a descrição do serviço.', 'err'); return false; }
    _ds.desc = v.trim();
    return true;
  }

  function _coletarBloco2() {
    var ok = true;
    _ds.trechos.forEach(function (t, i) {
      t.tipo       = _radioVal('dimTrechoTipo_' + i) || t.tipo;
      t.comprimento = parseFloat((_q('dimTrechoComp_' + i) || {}).value) || t.comprimento;
      if (!t.comprimento || t.comprimento <= 0) { _toast('Informe o comprimento do Trecho ' + (i + 1) + '.', 'err'); ok = false; }
      if (t.tipo === 'suspensao') {
        t.altura_mm       = parseInt(_radioVal('dimAlt_' + i)) || t.altura_mm;
        t.espacamento     = parseFloat(_radioVal('dimEsp_' + i)) || t.espacamento;
        t.fixacao_viga    = _radioVal('dimFix_' + i) || t.fixacao_viga;
        t.bitola_vergalhao= _radioVal('dimBit_' + i) || t.bitola_vergalhao;
        t.tipo_suporte    = _radioVal('dimSup_' + i) || t.tipo_suporte;
      }
      if (t.tipo === 'parede') {
        t.espacamento_parede   = parseFloat(_radioVal('dimEspP_' + i)) || t.espacamento_parede;
        t.tipo_suporte_parede  = _radioVal('dimSupP_' + i) || t.tipo_suporte_parede;
      }
    });
    return ok;
  }

  function _coletarBloco3() {
    _ds.ec.perfil     = _radioVal('dimPerfil')   || _ds.ec.perfil;
    _ds.ec.largura    = parseInt(_radioVal('dimLarg'))  || _ds.ec.largura;
    _ds.ec.altura     = parseInt(_radioVal('dimAlt3'))  || _ds.ec.altura;
    _ds.ec.material   = _radioVal('dimMat')      || _ds.ec.material;
    _ds.ec.acabamento = _radioVal('dimAcab')     || _ds.ec.acabamento;
    _ds.ec.chapa      = _radioVal('dimChapa')    || _ds.ec.chapa;
    _ds.ec.tampa      = _radioVal('dimTampa')    || _ds.ec.tampa;
    _ds.ec.divisor    = _radioVal('dimDiv')      || _ds.ec.divisor;
    // validação: fecho rápido sem tampa não pode existir
    if (_ds.ec.tampa === 'fecho_rapido') {
      _toast('Atenção: Tampa Fecho Rápido exige virola. Verifique os acessórios.', 'warn');
    }
    return true;
  }

  function _coletarBloco4() {
    var tes = parseInt((_q('dim_tes') || {}).value);
    if (!isNaN(tes)) _ds.conexoes.tes = tes;
    return true;
  }

  function _coletarBloco5() {
    var chk = _q('dimTerminal');
    var fp  = _q('dimFatorPerda');
    if (chk) _ds.fin.terminal    = chk.checked;
    if (fp)  _ds.fin.fator_perda = Math.max(0, Math.min(30, parseFloat(fp.value) || 5));
    return true;
  }

  // ─────────────────────────────────────────────────────────────
  // TRECHO — eventos dinâmicos
  // ─────────────────────────────────────────────────────────────
  function dimAddTrecho() {
    _coletarBloco2();
    _ds.trechos.push(_novoTrecho());
    _renderEtapa();
  }

  function dimRemoveTrecho(i) {
    if (_ds.trechos.length <= 1) { _toast('Mantenha ao menos um trecho.', 'err'); return; }
    _ds.trechos.splice(i, 1);
    _renderEtapa();
  }

  function dimTrechoChange(i) {
    _coletarBloco2();
    _renderEtapa();
  }

  // ─────────────────────────────────────────────────────────────
  // CONEXÕES — eventos dinâmicos
  // ─────────────────────────────────────────────────────────────
  function dimAddConexao(key) {
    if (!_ds.conexoes[key]) _ds.conexoes[key] = [];
    _ds.conexoes[key].push({ qtd: 1, angulo: '90' });
    _renderEtapa();
  }

  function dimRemoveConexao(key, i) {
    _ds.conexoes[key].splice(i, 1);
    _renderEtapa();
  }

  function dimConexaoQtd(key, i, v) {
    _ds.conexoes[key][i].qtd = parseInt(v) || 0;
  }

  function dimConexaoAng(key, i, v) {
    _ds.conexoes[key][i].angulo = v;
  }

  function dimAddReducao() {
    _ds.conexoes.reducoes.push({ qtd: 1, de: _ds.ec.largura, para: Math.max(50, _ds.ec.largura - 100) });
    _renderEtapa();
  }

  function dimRemoveReducao(i) {
    _ds.conexoes.reducoes.splice(i, 1);
    _renderEtapa();
  }

  function dimReducaoField(i, field, v) {
    _ds.conexoes.reducoes[i][field] = parseInt(v) || 0;
  }

  // ─────────────────────────────────────────────────────────────
  // MOTOR DE CÁLCULO
  // ─────────────────────────────────────────────────────────────
  function dimCalcular() {
    if (!_coletarEtapaAtual()) return;
    var todos = [];
    var comprTotal = 0;

    _ds.trechos.forEach(function (t) {
      var c = parseFloat(t.comprimento) || 0;
      comprTotal += c;
      var itens = [];
      if (t.tipo === 'suspensao')   itens = _calcSuspensao(t);
      if (t.tipo === 'parede')      itens = _calcParede(t);
      // coluna e sobre_calha não geram suportes extras
      todos = todos.concat(itens);
    });

    // Eletrocalha (comprimento total com perda)
    todos = todos.concat(_calcEletrocalha(comprTotal));
    // Conexões
    todos = todos.concat(_calcConexoes());
    // Terminais
    if (_ds.fin.terminal) {
      todos.push(_item('ME-01', 'DP737', 'Tampa Terminal para Eletrocalha ' + _ds.ec.largura + 'mm ' + _ds.ec.material, 2, 'un', '7308.90.10'));
    }

    // Consolidar (somar por código fabricante)
    _ds.itens = _consolidar(todos);
    _ds.etapa = 6;
    _renderEtapa();
    _toast('Lista gerada com ' + _ds.itens.length + ' itens!', 'ok');
    // Auto-salvar na nuvem
    dimSalvar();
  }

  // ── Suspensão ──
  function _calcSuspensao(t) {
    var itens = [];
    var pontos = Math.ceil(t.comprimento / t.espacamento);
    var verg_por_ponto = (t.altura_mm / 1000) * 2;
    var total_verg = pontos * verg_por_ponto;
    var barras_verg = Math.ceil(total_verg / 3);

    // Bitola → código Dispan DP608 (vergalhão rosca total 3000mm)
    var bitMap = {
      '1/4':  'DP608-1/4pol-3000',
      '5/16': 'DP608-5/16pol-3000',
      '3/8':  'DP608-3/8pol-3000',
      '1/2':  'DP608-1/2pol-3000'
    };
    var bitDesc = { '1/4': '¼"', '5/16': '5⁄16"', '3/8': '⅜"', '1/2': '½"' };
    var bitCod  = bitMap[t.bitola_vergalhao] || 'DP608-3/8pol-3000';
    var bitDsc  = bitDesc[t.bitola_vergalhao] || '⅜"';

    // Vergalhão
    itens.push(_item('ME-12', bitCod, 'Vergalhão Rosca Total ' + bitDsc + ' 3 m — Dispan', barras_verg, 'barra', '7317.00.90'));

    // Fixação na viga
    if (t.fixacao_viga === 'grampo_c') {
      itens.push(_item('ME-01', 'DP538', 'Grampo C para Viga — Dispan', pontos, 'un', '7308.90.10'));
      itens.push(_item('ME-01', 'DP540', 'Balancim para Grampo C — Dispan', pontos, 'un', '7308.90.10'));
    } else if (t.fixacao_viga === 'chumbador') {
      itens.push(_item('ME-12', 'DP625', 'Chumbador CB — Dispan', pontos, 'un', '7318.15.00'));
    } else {
      itens.push(_item('ME-12', 'DP609', 'Parafuso Olhal ⅜" — Dispan', pontos, 'un', '7318.15.00'));
    }

    // Suporte
    var supMap  = { horizontal: 'DP742', vertical: 'DP743', duplo: 'DP744', reforcado: 'DP745' };
    var supDesc = {
      horizontal: 'Suporte Horizontal DP742',
      vertical:   'Suporte Vertical DP743',
      duplo:      'Suporte Duplo DP744',
      reforcado:  'Suporte Reforçado DP745'
    };
    itens.push(_item('ME-01', supMap[t.tipo_suporte] || 'DP742',
      (supDesc[t.tipo_suporte] || 'Suporte DP742') + ' — Dispan', pontos, 'un', '7308.90.10'));

    // Fixadores por ponto
    itens.push(_item('ME-12', 'DP614', 'Parafuso Sext. ⅜"×2" — Dispan', pontos * 2, 'un', '7318.15.00'));
    itens.push(_item('ME-12', 'DP618', 'Porca Sextavada ⅜" — Dispan', pontos * 4, 'un', '7318.16.00'));
    itens.push(_item('ME-12', 'DP619', 'Arruela Lisa ⅜" — Dispan', pontos * 4, 'un', '7318.22.00'));

    return itens;
  }

  // ── Parede ──
  function _calcParede(t) {
    var itens = [];
    var pontos = Math.ceil(t.comprimento / t.espacamento_parede);
    var supMap  = { simples: 'DP746', duplo: 'DP747', reforcado: 'DP748' };
    var supDesc = {
      simples:   'Mão Francesa Simples DP746',
      duplo:     'Mão Francesa Dupla DP747',
      reforcado: 'Mão Francesa Reforçada DP748'
    };
    itens.push(_item('ME-01', supMap[t.tipo_suporte_parede] || 'DP746',
      (supDesc[t.tipo_suporte_parede] || 'Mão Francesa DP746') + ' — Dispan', pontos, 'un', '7308.90.10'));
    // Parafusos de fixação na parede (2 por suporte)
    itens.push(_item('ME-12', 'DP614', 'Parafuso Sext. ⅜"×2" — Dispan', pontos * 2, 'un', '7318.15.00'));
    itens.push(_item('ME-12', 'DP618', 'Porca Sextavada ⅜" — Dispan', pontos * 2, 'un', '7318.16.00'));
    itens.push(_item('ME-12', 'DP619', 'Arruela Lisa ⅜" — Dispan', pontos * 2, 'un', '7318.22.00'));
    return itens;
  }

  // ── Eletrocalha ──
  function _calcEletrocalha(comprTotal) {
    var itens = [];
    var ec  = _ds.ec;
    var fp  = _ds.fin.fator_perda;
    var barras = Math.ceil(comprTotal * (1 + fp / 100) / 3);
    var sku = ec.perfil + '-' + ec.material + '-' + ec.acabamento + '-' + ec.largura + '/' + ec.altura + '-' + ec.chapa;
    var desc = 'Eletrocalha ' + ec.perfil + ' ' + ec.largura + '×' + ec.altura + 'mm ' + ec.material + ' ' + ec.acabamento + ' ch.' + ec.chapa + ' 3m — Dispan';

    itens.push(_item('ME-01', sku, desc, barras, 'barra', '7308.20.00'));

    // Tampa
    var tampaCods = { encaixe: 'DP706', pressao: 'DP707', duas_aguas: 'DP706-2A', fecho_rapido: 'DP706-FR', aparafusada: 'DP706-AP' };
    var tampaDescs = { encaixe: 'Tampa Encaixe', pressao: 'Tampa Pressão', duas_aguas: 'Tampa 2 Águas', fecho_rapido: 'Tampa Fecho Rápido', aparafusada: 'Tampa Aparafusada' };
    if (ec.tampa !== 'sem') {
      var tCod  = (tampaCods[ec.tampa] || 'DP706') + '-' + ec.material + '-' + ec.acabamento + '-' + ec.largura + '-' + ec.chapa;
      var tDesc = (tampaDescs[ec.tampa] || 'Tampa') + ' ' + ec.largura + 'mm ' + ec.material + ' ' + ec.acabamento + ' 3m — Dispan';
      itens.push(_item('ME-01', tCod, tDesc, barras, 'barra', '7308.20.00'));
    }

    // Divisor
    if (ec.divisor !== 'sem') {
      var dCod  = (ec.divisor === 'perfurado' ? 'DP708' : 'DP709') + '-' + ec.material + '-' + ec.largura;
      var dDesc = (ec.divisor === 'perfurado' ? 'Divisor Perfurado DP708' : 'Divisor Liso DP709') + ' ' + ec.largura + 'mm ' + ec.material + ' 3m — Dispan';
      itens.push(_item('ME-01', dCod, dDesc, barras, 'barra', '7308.20.00'));
    }

    return itens;
  }

  // ── Conexões ──
  function _calcConexoes() {
    var itens = [];
    var ec = _ds.ec;
    var con = _ds.conexoes;

    // Mapa ângulo → código Dispan (catálogo 2023, série segmentado)
    var angToH  = { 90: 'DP710', 45: 'DP711' };  // curva horizontal
    var angToVI = { 90: 'DP714', 45: 'DP715' };  // curva vert. interna
    var angToVE = { 90: 'DP712', 45: 'DP713' };  // curva vert. externa
    var fornDim = 'Indicar ao fornecedor: Cota A (' + ec.largura + 'mm) + B (' + ec.altura + 'mm) | ' + ec.material + ' ' + ec.acabamento;

    // Curvas horizontais
    (con.curvas_h || []).forEach(function (c) {
      if (!c.qtd) return;
      var cod  = angToH[c.angulo] || 'DP710';
      var desc = 'Curva Horizontal ' + c.angulo + '° para Eletrocalha — Dispan ' + cod + ' | ' + fornDim;
      itens.push(_item('ME-01', cod, desc, c.qtd, 'un', '7308.90.90'));
    });

    // Curvas verticais internas
    (con.curvas_vi || []).forEach(function (c) {
      if (!c.qtd) return;
      var cod  = angToVI[c.angulo] || 'DP714';
      var desc = 'Curva Vertical Interna ' + c.angulo + '° para Eletrocalha — Dispan ' + cod + ' | ' + fornDim;
      itens.push(_item('ME-01', cod, desc, c.qtd, 'un', '7308.90.90'));
    });

    // Curvas verticais externas
    (con.curvas_ve || []).forEach(function (c) {
      if (!c.qtd) return;
      var cod  = angToVE[c.angulo] || 'DP712';
      var desc = 'Curva Vertical Externa ' + c.angulo + '° para Eletrocalha — Dispan ' + cod + ' | ' + fornDim;
      itens.push(_item('ME-01', cod, desc, c.qtd, 'un', '7308.90.90'));
    });

    // Tês
    if (con.tes > 0) {
      var tDesc = 'Tê Horizontal 90° para Eletrocalha — Dispan DP716 | ' + fornDim;
      itens.push(_item('ME-01', 'DP716', tDesc, con.tes, 'un', '7308.90.90'));
    }

    // Reduções
    (con.reducoes || []).forEach(function (r) {
      if (!r.qtd) return;
      var desc = 'Redução Concêntrica p/ Eletrocalha — Dispan DP730 | Indicar: ' + r.de + '→' + r.para + 'mm | ' + ec.material + ' ' + ec.acabamento;
      itens.push(_item('ME-01', 'DP730', desc, r.qtd, 'un', '7308.90.90'));
    });

    return itens;
  }

  // ── Consolidar itens (somar por código fabricante) ──
  function _consolidar(lista) {
    var mapa = {};
    var ordem = [];
    lista.forEach(function (it) {
      if (mapa[it.codigo_fabricante]) {
        mapa[it.codigo_fabricante].quantidade += it.quantidade;
      } else {
        mapa[it.codigo_fabricante] = Object.assign({}, it);
        ordem.push(it.codigo_fabricante);
      }
    });
    return ordem.map(function (k) { return mapa[k]; });
  }

  // ── Criar objeto item ──
  function _item(cat, cod, desc, qty, un, ncm) {
    return {
      id:                 _uid(),
      categoria_me:       cat,
      codigo_fabricante:  cod,
      descricao_completa: desc,
      quantidade:         qty,
      unidade:            un || 'un',
      custo_unitario:     null,
      ncm:                ncm || '',
      origem:             'calculado',
      editado_manualmente: false,
      observacoes:        ''
    };
  }

  // ─────────────────────────────────────────────────────────────
  // GERENCIAR ITENS DA LISTA
  // ─────────────────────────────────────────────────────────────
  function dimSetCU(i, v) {
    _ds.itens[i].custo_unitario = parseFloat(String(v).replace(',', '.')) || null;
    _ds.itens[i].editado_manualmente = true;
    _ds.log.push({ ts: Date.now(), acao: 'custo_editado', item: i, valor: v });
  }

  function dimEditarItem(i) {
    var it = _ds.itens[i];
    var novoDesc = prompt('Editar descrição:', it.descricao_completa);
    if (novoDesc === null) return;
    var novaQtd  = parseFloat(prompt('Editar quantidade:', it.quantidade));
    if (isNaN(novaQtd) || novaQtd <= 0) { _toast('Quantidade inválida.', 'err'); return; }
    _ds.itens[i].descricao_completa  = novoDesc || it.descricao_completa;
    _ds.itens[i].quantidade          = novaQtd;
    _ds.itens[i].editado_manualmente = true;
    _ds.log.push({ ts: Date.now(), acao: 'item_editado', item: i });
    _renderEtapa();
    _toast('Item atualizado.', 'ok');
  }

  function dimDuplicarItem(i) {
    var clone = Object.assign({}, _ds.itens[i]);
    clone.id     = _uid();
    clone.origem = 'duplicado';
    clone.editado_manualmente = false;
    _ds.itens.splice(i + 1, 0, clone);
    _ds.log.push({ ts: Date.now(), acao: 'item_duplicado', item: i });
    _renderEtapa();
    _toast('Item duplicado.', 'ok');
  }

  function dimExcluirItem(i) {
    _ds.log.push({ ts: Date.now(), acao: 'item_excluido', codigo: _ds.itens[i].codigo_fabricante });
    _ds.itens.splice(i, 1);
    _renderEtapa();
    _toast('Item removido.', 'ok');
  }

  // ─────────────────────────────────────────────────────────────
  // EXPORTAR
  // ─────────────────────────────────────────────────────────────
  function dimExportExcel() {
    if (!_ds.itens.length) { _toast('Sem itens para exportar.', 'err'); return; }
    var cab = ['"#"', '"Categoria"', '"Código Fabricante"', '"Descrição Completa"', '"Quantidade"', '"Unidade"', '"Custo Unit. R$"', '"NCM"', '"Observações"'];
    var linhas = [cab.join(';')];
    _ds.itens.forEach(function (it, i) {
      linhas.push([
        i + 1,
        '"' + it.categoria_me + '"',
        '"' + it.codigo_fabricante + '"',
        '"' + it.descricao_completa.replace(/"/g, '""') + '"',
        String(it.quantidade).replace('.', ','),
        '"' + it.unidade + '"',
        it.custo_unitario != null ? String(it.custo_unitario).replace('.', ',') : '',
        '"' + (it.ncm || '') + '"',
        '"' + (it.observacoes || '') + '"'
      ].join(';'));
    });
    var csv   = '﻿' + linhas.join('\r\n');
    var blob  = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url   = URL.createObjectURL(blob);
    var a     = document.createElement('a');
    a.href    = url;
    a.download = 'Fortex_Dimensionamento_' + _ds.desc.replace(/\s/g, '_') + '_' + _isoDate() + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    _toast('Exportado para Excel (CSV)!', 'ok');
  }

  function dimExportWord() {
    if (!_ds.itens.length) { _toast('Sem itens para exportar.', 'err'); return; }
    if (typeof docx === 'undefined') { _toast('Biblioteca Word não carregada.', 'err'); return; }

    var rows = [
      new docx.TableRow({
        tableHeader: true,
        children: ['#', 'Categoria', 'Código', 'Descrição', 'Qtd', 'Un', 'Custo Unit.', 'NCM'].map(function (h) {
          return new docx.TableCell({
            children: [new docx.Paragraph({ children: [new docx.TextRun({ text: h, bold: true })] })],
            shading: { fill: '1E2535' }
          });
        })
      })
    ];

    _ds.itens.forEach(function (it, i) {
      rows.push(new docx.TableRow({
        children: [
          String(i + 1), it.categoria_me, it.codigo_fabricante,
          it.descricao_completa, _fmt(it.quantidade), it.unidade,
          it.custo_unitario != null ? 'R$ ' + _fmt(it.custo_unitario, 2) : '—',
          it.ncm || ''
        ].map(function (v) {
          return new docx.TableCell({ children: [new docx.Paragraph(String(v))] });
        })
      }));
    });

    var doc = new docx.Document({
      sections: [{
        children: [
          new docx.Paragraph({ children: [new docx.TextRun({ text: 'Lista de Materiais — ' + _ds.desc, bold: true, size: 28 })], spacing: { after: 200 } }),
          new docx.Paragraph({ children: [new docx.TextRun('Gerado em: ' + new Date().toLocaleDateString('pt-BR'))], spacing: { after: 400 } }),
          new docx.Table({ rows: rows })
        ]
      }]
    });

    docx.Packer.toBlob(doc).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a   = document.createElement('a');
      a.href  = url;
      a.download = 'Fortex_Dimensionamento_' + _ds.desc.replace(/\s/g, '_') + '_' + _isoDate() + '.docx';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      _toast('Exportado para Word!', 'ok');
    });
  }

  function dimExportPdf() {
    if (!_ds.itens.length) { _toast('Sem itens para exportar.', 'err'); return; }
    var rows = _ds.itens.map(function (it, i) {
      return '<tr>' +
        '<td>' + (i + 1) + '</td>' +
        '<td>' + it.categoria_me + '</td>' +
        '<td style="font-family:monospace">' + it.codigo_fabricante + '</td>' +
        '<td>' + it.descricao_completa + '</td>' +
        '<td style="text-align:right">' + _fmt(it.quantidade) + '</td>' +
        '<td>' + it.unidade + '</td>' +
        '<td style="text-align:right">' + (it.custo_unitario != null ? 'R$ ' + _fmt(it.custo_unitario, 2) : '—') + '</td>' +
        '<td>' + (it.ncm || '') + '</td>' +
        '</tr>';
    }).join('');

    var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Dimensionamento ' + _esc(_ds.desc) + '</title>' +
      '<style>body{font-family:Arial,sans-serif;font-size:10px;margin:20px}' +
      'h2{font-size:14px;margin-bottom:4px}p{margin:0 0 10px;color:#666}' +
      'table{width:100%;border-collapse:collapse}' +
      'th{background:#1e2535;color:#fff;padding:5px 7px;text-align:left;font-size:9px}' +
      'td{padding:4px 7px;border-bottom:1px solid #e2e8f0;font-size:9px}' +
      'tr:nth-child(even){background:#f8fafc}' +
      '@media print{@page{margin:15mm}}</style></head><body>' +
      '<h2>Lista de Materiais — ' + _esc(_ds.desc) + '</h2>' +
      '<p>Gerado em ' + new Date().toLocaleDateString('pt-BR') + ' | Total: ' + _ds.itens.length + ' itens</p>' +
      '<table><thead><tr><th>#</th><th>Cat.</th><th>Código</th><th>Descrição</th><th>Qtd</th><th>Un</th><th>Custo Unit.</th><th>NCM</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table></body></html>';

    var w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { _toast('Permita pop-ups para gerar o PDF.', 'err'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 400);
  }

  // ─────────────────────────────────────────────────────────────
  // INSERIR NO ORÇAMENTO
  // ─────────────────────────────────────────────────────────────
  function dimAbrirInserir() {
    if (!_ds.itens.length) { _toast('Sem itens para inserir.', 'err'); return; }
    var lista = _ds.itens.map(function (it, i) {
      return '<tr>' +
        '<td style="font-size:.75rem;color:#94a3b8;padding:.3rem .5rem">' + (i + 1) + '</td>' +
        '<td style="font-size:.75rem;padding:.3rem .5rem"><span style="background:rgba(240,90,26,.12);color:#f05a1a;border-radius:4px;padding:.1rem .4rem;font-size:.7rem">' + it.categoria_me + '</span></td>' +
        '<td style="font-size:.75rem;font-family:monospace;color:#58a6ff;padding:.3rem .5rem">' + it.codigo_fabricante + '</td>' +
        '<td style="font-size:.75rem;padding:.3rem .5rem">' + it.descricao_completa + '</td>' +
        '<td style="font-size:.75rem;text-align:right;font-weight:600;padding:.3rem .5rem">' + _fmt(it.quantidade) + ' ' + it.unidade + '</td>' +
        '<td style="font-size:.75rem;padding:.3rem .5rem;color:' + (it.custo_unitario ? '#22c55e' : '#94a3b8') + '">' +
        (it.custo_unitario ? 'R$ ' + _fmt(it.custo_unitario, 2) : '—') + '</td>' +
        '</tr>';
    }).join('');

    var el = _q('dimInserirLista');
    var cnt = _q('dimInserirCount');
    if (el) el.innerHTML = '<table style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:1px solid #334155">' +
      '<th style="font-size:.7rem;color:#94a3b8;text-align:left;padding:.3rem .5rem">#</th>' +
      '<th style="font-size:.7rem;color:#94a3b8;text-align:left;padding:.3rem .5rem">Cat.</th>' +
      '<th style="font-size:.7rem;color:#94a3b8;text-align:left;padding:.3rem .5rem">Código</th>' +
      '<th style="font-size:.7rem;color:#94a3b8;text-align:left;padding:.3rem .5rem">Descrição</th>' +
      '<th style="font-size:.7rem;color:#94a3b8;text-align:right;padding:.3rem .5rem">Qtd</th>' +
      '<th style="font-size:.7rem;color:#94a3b8;text-align:left;padding:.3rem .5rem">Custo Unit.</th>' +
      '</tr></thead><tbody>' + lista + '</tbody></table>';
    if (cnt) cnt.textContent = _ds.itens.length;

    var m = _q('dimModalInserir');
    if (m) m.style.display = 'flex';
  }

  function dimConfirmarInserir() {
    if (typeof budg === 'undefined') { _toast('Abra uma proposta antes de inserir.', 'err'); return; }
    if (!_ds._propostaId) { _toast('Nenhuma proposta ativa. Abra uma proposta primeiro.', 'err'); return; }

    var cfg = (typeof getPrcAtual === 'function') ? getPrcAtual() : {};

    _ds.itens.forEach(function (it) {
      var cu  = it.custo_unitario || 0;
      var fmf = (typeof calcFMF === 'function') ? calcFMF(cfg, 'material', it.categoria_me) : 1;
      var pvu = cu * fmf;
      var pvt = pvu * it.quantidade;
      var baseItem = {
        id:         _uid(),
        t:          'material',
        cat:        it.categoria_me,
        desc:       it.descricao_completa,
        cu:         cu,
        cuFormula:  cu ? String(cu) : '',
        cuLog:      [],
        mult:       it.quantidade,
        fmf:        fmf,
        pvu:        pvu,
        pvt:        pvt,
        un1:        it.unidade,
        un2:        '',
        tec:        1, dias: it.quantidade, hpd: 1,
        inc:        true, terc: false, det: true,
        link:       '',
        equip:      it.area_local || _ds.desc,
        inst:       '',
        tipoTrab:   '',
        faseTrab:   'Execução'
      };
      if (typeof normalizeBudgetItem === 'function') {
        budg.push(normalizeBudgetItem(baseItem));
      } else {
        budg.push(baseItem);
      }
    });

    if (typeof updBT === 'function') updBT();
    if (typeof rBudg === 'function') rBudg();
    if (typeof cTot  === 'function') cTot();
    if (typeof updKpi === 'function') updKpi();
    try { if (typeof upsertCurrentDraft === 'function' && typeof editId !== 'undefined' && editId) upsertCurrentDraft(true); } catch (e) {}

    var m = _q('dimModalInserir');
    if (m) m.style.display = 'none';
    fecharDimensionador();
    _toast(_ds.itens.length + ' itens inseridos no orçamento!', 'ok');
  }

  // ─────────────────────────────────────────────────────────────
  // SALVAR / SUPABASE
  // ─────────────────────────────────────────────────────────────
  async function dimSalvar() {
    try {
      var sb = (typeof sbClient !== 'undefined') ? sbClient : null;
      if (!sb) return;
      var empresaId = (typeof _empresaAtiva !== 'undefined' && _empresaAtiva) ? _empresaAtiva.id : null;
      if (!empresaId) return;

      var dadosForm = {
        desc: _ds.desc, ec: _ds.ec, conexoes: _ds.conexoes,
        fin: _ds.fin, trechos: _ds.trechos
      };

      var payload = {
        empresa_id:   empresaId,
        proposta_id:  _ds._propostaId || null,
        tipo_servico: 'eletrocalha',
        descricao:    _ds.desc,
        status:       _ds.itens.length ? 'calculado' : 'rascunho',
        dados_form:   dadosForm
      };

      var res;
      if (_ds._dimId) {
        res = await sb.from('dimensionamentos').update(payload).eq('id', _ds._dimId);
      } else {
        res = await sb.from('dimensionamentos').insert(payload).select('id').single();
        if (res.data && res.data.id) _ds._dimId = res.data.id;
      }
      if (res.error) throw res.error;
    } catch (e) {
      console.warn('[dimensionador] Salvar nuvem:', e.message || e);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS DE TEMPLATE
  // ─────────────────────────────────────────────────────────────
  function dimSalvarTemplate() {
    var nome = prompt('Nome do template:');
    if (!nome || !nome.trim()) return;
    _coletarEtapaAtual();
    var dados = { desc: _ds.desc, ec: _ds.ec, conexoes: _ds.conexoes, fin: _ds.fin, trechos: _ds.trechos };
    try {
      var sb  = (typeof sbClient !== 'undefined') ? sbClient : null;
      var eId = (typeof _empresaAtiva !== 'undefined' && _empresaAtiva) ? _empresaAtiva.id : null;
      if (sb && eId) {
        sb.from('templates_dimensionamento').insert({ empresa_id: eId, nome: nome.trim(), tipo_servico: 'eletrocalha', dados: dados });
      }
      _toast('Template "' + nome.trim() + '" salvo!', 'ok');
    } catch (e) { _toast('Erro ao salvar template.', 'err'); }
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER DO OVERLAY (injetado uma vez no DOM)
  // ─────────────────────────────────────────────────────────────
  function _renderOverlay() {
    if (_q('dimOverlay')) return; // já existe

    var html =
      // ── Overlay principal ──────────────────────────────────
      '<div id="dimOverlay" style="display:none;position:fixed;inset:0;background:var(--bg1);z-index:5000;flex-direction:column;overflow:hidden">' +

      // Header
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;border-bottom:1px solid var(--border);background:var(--bg2);flex-shrink:0">' +
      '<div style="display:flex;align-items:center;gap:.75rem">' +
      '<span style="font-size:1rem;font-weight:800;color:var(--accent)">📐 Dimensionador de Eletrocalha</span>' +
      '</div>' +
      '<div style="display:flex;gap:.5rem;align-items:center">' +
      '<button onclick="dimSalvarTemplate()" class="btn bg bsm" title="Salvar como template">⭐ Template</button>' +
      '<button onclick="fecharDimensionador()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:1.1rem;padding:.3rem .5rem" title="Fechar">✕</button>' +
      '</div></div>' +

      // Step bar
      '<div id="dimStepBar" style="display:flex;gap:.4rem;padding:.55rem 1.25rem;background:var(--bg2);border-bottom:1px solid var(--border);overflow-x:auto;flex-shrink:0"></div>' +

      // Content
      '<div id="dimContent" style="flex:1;overflow-y:auto;padding:1.25rem"></div>' +

      // Footer nav
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:.65rem 1.25rem;border-top:1px solid var(--border);background:var(--bg2);flex-shrink:0">' +
      '<button id="dimBtnBack" onclick="dimBack()" class="btn bg">← Anterior</button>' +
      '<div style="display:flex;gap:.5rem">' +
      '<button id="dimBtnNext" onclick="dimNext()" class="btn bs">Próximo →</button>' +
      '<button id="dimBtnCalc" onclick="dimCalcular()" class="btn bp" style="display:none">⚡ Calcular Lista</button>' +
      '</div></div></div>' +

      // ── Modal de confirmação de inserção ───────────────────
      '<div id="dimModalInserir" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:6000;align-items:center;justify-content:center;padding:1rem">' +
      '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;width:min(780px,97vw);max-height:88vh;overflow:hidden;display:flex;flex-direction:column">' +
      '<div style="padding:.85rem 1rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">' +
      '<span style="font-weight:700;color:var(--accent)">✅ Confirmar Inserção no Orçamento</span>' +
      '<button onclick="_q(\'dimModalInserir\').style.display=\'none\'" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:1rem">✕</button>' +
      '</div>' +
      '<div style="padding:.6rem .8rem;background:rgba(88,166,255,.06);border-bottom:1px solid var(--border);font-size:.77rem;color:var(--text2)">' +
      '⚠️ Itens sem <strong>Custo Unit. R$</strong> serão inseridos com valor zero. Preencha os custos após receber a cotação.' +
      '</div>' +
      '<div id="dimInserirLista" style="flex:1;overflow-y:auto;padding:.75rem 1rem"></div>' +
      '<div style="padding:.75rem 1rem;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:.5rem">' +
      '<button onclick="_q(\'dimModalInserir\').style.display=\'none\'" class="btn bg">Cancelar</button>' +
      '<button onclick="dimConfirmarInserir()" class="btn bp" style="font-weight:700">✅ Confirmar e Inserir (<span id="dimInserirCount">0</span> itens)</button>' +
      '</div></div></div>';

    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
    document.body.appendChild(div.lastElementChild);
  }

  // ─────────────────────────────────────────────────────────────
  // BIND DE EVENTOS DAS ETAPAS (radio buttons gerados dinamicamente)
  // ─────────────────────────────────────────────────────────────
  function _bindEtapaEvents() {
    // radio buttons: ao mudar, atualiza preview do SKU na etapa 3
    if (_ds.etapa === 3) {
      var radios = (_q('dimContent') || {}).querySelectorAll && _q('dimContent').querySelectorAll('input[type=radio]');
      if (radios) radios.forEach(function (r) {
        r.addEventListener('change', function () {
          _coletarBloco3();
          var prev = _q('dimContent').querySelector('.sku-preview');
          if (prev) prev.innerHTML = _previewSku();
        });
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS DE HTML
  // ─────────────────────────────────────────────────────────────
  function _campo(label, inputHtml, required) {
    return '<div style="margin-bottom:.85rem">' +
      '<label style="display:block;font-size:.68rem;font-weight:600;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">' +
      label + (required ? ' <span style="color:#f85149">*</span>' : '') +
      '</label>' + inputHtml + '</div>';
  }

  function _radioGroup(name, opts, selected, onchange, wrap) {
    var items = opts.map(function (o) {
      var chk = (String(o.v) === String(selected)) ? ' checked' : '';
      var onChange = onchange ? ' onchange="' + onchange + '"' : '';
      return '<label style="display:inline-flex;align-items:center;gap:.35rem;cursor:pointer;' +
        'padding:.25rem .6rem;border:1px solid ' + (chk ? 'var(--accent)' : 'var(--border)') + ';' +
        'border-radius:20px;font-size:.78rem;background:' + (chk ? 'rgba(240,90,26,.1)' : 'transparent') + ';' +
        'color:' + (chk ? 'var(--accent)' : 'var(--text2)') + ';white-space:nowrap;margin:.15rem">' +
        '<input type="radio" name="' + name + '" value="' + _esc(String(o.v)) + '"' + chk + onChange +
        ' style="display:none">' + _esc(String(o.l)) + '</label>';
    }).join('');
    return '<div style="display:flex;flex-wrap:wrap;gap:.1rem">' + items + '</div>';
  }

  function _radioVal(name) {
    var el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : null;
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _fmt(n, dec) {
    var d = dec != null ? dec : (Math.round(n) === n ? 0 : 2);
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function _isoDate() { return new Date().toISOString().slice(0, 10); }

  // ─────────────────────────────────────────────────────────────
  // API PÚBLICA
  // ─────────────────────────────────────────────────────────────
  win.abrirDimensionador   = abrirDimensionador;
  win.fecharDimensionador  = fecharDimensionador;
  win.dimNext              = dimNext;
  win.dimBack              = dimBack;
  win.dimGoTo              = dimGoTo;
  win.dimCalcular          = dimCalcular;
  win.dimAddTrecho         = dimAddTrecho;
  win.dimRemoveTrecho      = dimRemoveTrecho;
  win.dimTrechoChange      = dimTrechoChange;
  win.dimAddConexao        = dimAddConexao;
  win.dimRemoveConexao     = dimRemoveConexao;
  win.dimConexaoQtd        = dimConexaoQtd;
  win.dimConexaoAng        = dimConexaoAng;
  win.dimAddReducao        = dimAddReducao;
  win.dimRemoveReducao     = dimRemoveReducao;
  win.dimReducaoField      = dimReducaoField;
  win.dimSetCU             = dimSetCU;
  win.dimEditarItem        = dimEditarItem;
  win.dimDuplicarItem      = dimDuplicarItem;
  win.dimExcluirItem       = dimExcluirItem;
  win.dimExportExcel       = dimExportExcel;
  win.dimExportWord        = dimExportWord;
  win.dimExportPdf         = dimExportPdf;
  win.dimAbrirInserir      = dimAbrirInserir;
  win.dimConfirmarInserir  = dimConfirmarInserir;
  win.dimSalvarTemplate    = dimSalvarTemplate;
  win.dimSalvar            = dimSalvar;

})(window);

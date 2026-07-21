// ============================================================
// curto-bt-engine.js — Motor de cálculo de curto-circuito em
// baixa tensão (Curto BT). Método IEC 60909-0:2016 (fonte de
// tensão equivalente). Verificações de condutor: NBR 5410:2004.
//
// PURO: sem DOM, sem Supabase, sem rede, sem localStorage.
// Determinístico (não usa Date/Math.random). Entrada e saída
// são objetos serializáveis com envelope versionado.
//
// Exporta:
//   CurtoBTEngine.calcular(input)      → objeto de resultado
//   CurtoBTEngine.verificarTermica(...) → sub-verificação I²t
//   CurtoBTEngine.verificarPE(Sfase)    → seção mínima do PE
//   CurtoBTEngine.transformadorTipicos(kVA)
//   CurtoBTEngine.CONST                 → constantes
// ============================================================

(function () {
  'use strict';

  var SQRT3 = Math.sqrt(3);
  var SQRT2 = Math.sqrt(2);

  var CONST = {
    SCHEMA_VERSION: 1,
    ENGINE_VERSION: 'curto-bt-v1',
    // Resistividade a 20°C (Ω·mm²/m) e coeficiente de temperatura α (1/°C)
    RHO20:  { Cu: 0.017241, Al: 0.028264 },
    ALPHA:  { Cu: 0.00393,  Al: 0.00403 },
    X_DEFAULT_OHM_KM: 0.08,           // reatância default de cabo (Ω/km)
    // Coeficientes k de limitação térmica (NBR 5410) por material/isolação
    K_THERMAL: { 'Cu/PVC': 115, 'Cu/XLPE': 143, 'Al/PVC': 76, 'Al/XLPE': 94 },
    C_MAX_DEFAULT: 1.05,
    C_MIN_DEFAULT: 0.95,
    MOTOR_MULT_DEFAULT: 5,
    MOTOR_XR_DEFAULT: 10,
    TENSAO_MAX_V: 1000
  };

  // ── Valores típicos de transformador (IEC 60076-5) ──────────
  // Retorna null quando exige dado de placa (> 6300 kVA).
  function transformadorTipicos(kVA) {
    if (!(kVA > 0)) return null;
    if (kVA <= 630)  return { ukPct: 4, pcu_kW: 6.0 };
    if (kVA <= 1250) return { ukPct: 5, pcu_kW: 10.0 };
    if (kVA <= 2500) return { ukPct: 6, pcu_kW: 16.0 };
    if (kVA <= 6300) return { ukPct: 7, pcu_kW: 28.0 };
    return null;
  }

  // ── Utilitários ─────────────────────────────────────────────
  function r(x, d) {
    var f = Math.pow(10, (d == null ? 3 : d));
    return Math.round(x * f) / f;
  }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function fail(msg) { throw new Error('[curto-bt-engine] ' + msg); }
  function normMat(m) {
    var s = String(m || '').trim().toLowerCase();
    if (s === 'cu' || s === 'cobre') return 'Cu';
    if (s === 'al' || s === 'aluminio' || s === 'alumínio') return 'Al';
    return null;
  }
  function normIso(i) {
    var s = String(i || '').trim().toUpperCase();
    if (s === 'PVC') return 'PVC';
    if (s === 'XLPE' || s === 'EPR' || s === 'EPR/XLPE') return 'XLPE';
    return null;
  }

  // Resistência de um trecho de cabo (Ω), corrigida por temperatura.
  //   rθ = r20 · [1 + α·(θ − 20)]   → R = ρθ · L / (S · paralelos)
  function resistenciaCabo(mat, secao_mm2, L_m, paralelos, tempC) {
    var rho20 = CONST.RHO20[mat];
    var alpha = CONST.ALPHA[mat];
    var rhoT = rho20 * (1 + alpha * ((tempC == null ? 20 : tempC) - 20));
    return rhoT * L_m / (secao_mm2 * (paralelos || 1));
  }
  function reatanciaCabo(x_ohm_km, L_m, paralelos) {
    var x = isNum(x_ohm_km) ? x_ohm_km : CONST.X_DEFAULT_OHM_KM;
    return x * (L_m / 1000) / (paralelos || 1);
  }

  // κ (fator de pico IEC 60909), limitado a [1,02 ; 2,0]
  function kappa(R, X) {
    if (!(X > 0)) return 1.02;
    var k = 1.02 + 0.98 * Math.exp(-3 * R / X);
    if (k < 1.02) k = 1.02;
    if (k > 2.0)  k = 2.0;
    return k;
  }

  // ── Impedância da fonte (rede ou gerador), referida ao lado BT ──
  function impedanciaFonte(network, U, cMax) {
    var res = { R: 0, X: 0, elemento: 'fonte', detalhe: '' };
    if (!network || !network.tipo) fail('network.tipo obrigatório ("rede" ou "gerador").');
    var tipo = String(network.tipo).toLowerCase();

    if (tipo === 'rede') {
      var modo = String(network.modo || 'infinita').toLowerCase();
      if (modo === 'infinita') {
        res.elemento = 'rede (potência infinita)';
        return res; // Z_Q = 0
      }
      var Z;
      if (modo === 'icc' || modo === 'ik') {
        if (!(network.Icc_kA > 0)) fail('network.Icc_kA obrigatório no modo "Icc".');
        Z = cMax * U / (SQRT3 * network.Icc_kA * 1000);
        res.elemento = 'rede (Icc = ' + network.Icc_kA + ' kA)';
      } else if (modo === 'scc' || modo === 'mva') {
        if (!(network.Scc_MVA > 0)) fail('network.Scc_MVA obrigatório no modo "Scc".');
        Z = cMax * U * U / (network.Scc_MVA * 1e6);
        res.elemento = 'rede (Scc = ' + network.Scc_MVA + ' MVA)';
      } else {
        fail('network.modo inválido: use "infinita", "Icc" ou "Scc".');
      }
      var q = isNum(network.xr) && network.xr > 0 ? network.xr : 10;
      res.R = Z / Math.sqrt(1 + q * q);
      res.X = res.R * q;
      return res;
    }

    if (tipo === 'gerador') {
      if (!(network.kVA > 0)) fail('gerador: network.kVA obrigatório.');
      if (!(network.xdPct > 0)) fail('gerador: network.xdPct (X"d %) obrigatório.');
      var Xg = (network.xdPct / 100) * (U * U) / (network.kVA * 1000);
      var qg = isNum(network.xr) && network.xr > 0 ? network.xr : CONST.MOTOR_XR_DEFAULT;
      res.X = Xg;
      res.R = Xg / qg;
      res.elemento = 'gerador (X"d = ' + network.xdPct + '%, ' + network.kVA + ' kVA)';
      return res;
    }

    fail('network.tipo inválido: use "rede" ou "gerador".');
  }

  // ── Impedância do transformador, referida ao lado BT ────────
  function impedanciaTrafo(tr, U, memoria) {
    if (!tr) return null;
    var kVA = tr.kVA;
    if (!(kVA > 0)) fail('transformer.kVA obrigatório.');

    var ukPct = tr.ukPct, pcu_kW = tr.pcu_kW, tipico = false;
    if (!isNum(ukPct) || !isNum(pcu_kW)) {
      var tip = transformadorTipicos(kVA);
      if (!tip) fail('transformador > 6300 kVA exige uk% e Pcu de placa.');
      if (!isNum(ukPct)) ukPct = tip.ukPct;
      if (!isNum(pcu_kW)) pcu_kW = tip.pcu_kW;
      tipico = true;
    }

    var S = kVA * 1000;                       // VA
    var Z = (ukPct / 100) * (U * U) / S;       // Ω
    var R = (pcu_kW * 1000) * (U * U) / (S * S);
    var X2 = Z * Z - R * R;
    var X = X2 > 0 ? Math.sqrt(X2) : 0;

    if (memoria) {
      memoria.push({
        formula: 'Z_T = (uk/100)·U²/S ; R_T = Pcu·U²/S² ; X_T = √(Z_T²−R_T²)',
        valores_substituidos: '(' + ukPct + '/100)·' + U + '²/' + S + ' ; ' +
          (pcu_kW * 1000) + '·' + U + '²/' + S + '²',
        resultado: 'R=' + r(R * 1000) + ' X=' + r(X * 1000) + ' Z=' + r(Z * 1000),
        unidade: 'mΩ'
      });
    }
    return { R: R, X: X, Z: Z, ukPct: ukPct, pcu_kW: pcu_kW, tipico: tipico,
             elemento: 'transformador (' + kVA + ' kVA, uk=' + ukPct + '%)' };
  }

  // ── Verificação térmica do cabo (NBR 5410): I²t ≤ k²S² ──────
  function verificarTermica(p) {
    p = p || {};
    var mat = normMat(p.material), iso = normIso(p.isolacao);
    if (!mat || !iso) fail('verificarTermica: material (Cu/Al) e isolacao (PVC/XLPE) obrigatórios.');
    if (!(p.secao_mm2 > 0)) fail('verificarTermica: secao_mm2 deve ser > 0.');
    if (!(p.Ik_kA >= 0))    fail('verificarTermica: Ik_kA obrigatório.');
    if (!(p.t_s > 0))       fail('verificarTermica: t_s (tempo de atuação) deve ser > 0.');

    var k = CONST.K_THERMAL[mat + '/' + iso];
    var I = p.Ik_kA * 1000;
    var I2t = I * I * p.t_s;
    var k2S2 = k * k * p.secao_mm2 * p.secao_mm2;
    var Smin = Math.sqrt(I2t) / k;
    return {
      k: k,
      I2t: r(I2t, 0),
      k2S2: r(k2S2, 0),
      aprovado: I2t <= k2S2,
      secao_minima_mm2: r(Smin, 2),
      secao_mm2: p.secao_mm2
    };
  }

  // ── Verificação do condutor de proteção PE (NBR 5410) ───────
  function verificarPE(Sfase) {
    if (!(Sfase > 0)) fail('verificarPE: Sfase deve ser > 0.');
    var Spe;
    if (Sfase <= 16) Spe = Sfase;
    else if (Sfase <= 35) Spe = 16;
    else Spe = Sfase / 2;
    return { secao_fase_mm2: Sfase, secao_pe_mm2: r(Spe, 2) };
  }

  // ── Corrente de um motor de indução como fonte de contribuição ──
  function correnteMotor(m, U) {
    var In;
    var modo = String(m.modo || (isNum(m.In_A) ? 'In' : 'kW')).toLowerCase();
    if (modo === 'in' && isNum(m.In_A)) {
      In = m.In_A;
    } else {
      if (!(m.potencia_kW > 0)) fail('motor: informe In_A ou potencia_kW.');
      var eta = isNum(m.eta) ? m.eta : 0.9;
      var cosfi = isNum(m.cosfi) ? m.cosfi : 0.85;
      In = (m.potencia_kW * 1000) / (SQRT3 * U * eta * cosfi);
    }
    var mult = isNum(m.multiplo_m) && m.multiplo_m > 0 ? m.multiplo_m : CONST.MOTOR_MULT_DEFAULT;
    var xr = isNum(m.xr) && m.xr > 0 ? m.xr : CONST.MOTOR_XR_DEFAULT;
    var Im = mult * In;                       // contribuição inicial (A)
    var ang = Math.atan(xr);                  // ângulo da impedância do motor
    var kap = kappa(1, xr);                   // κ com R/X = 1/xr
    return {
      id: m.id || null,
      In_A: In,
      Im_A: Im,
      mult: mult,
      xr: xr,
      ang: ang,
      ip_A: kap * SQRT2 * Im,
      kappa: kap
    };
  }

  // ── Validação de envelope e entradas ────────────────────────
  function validar(input) {
    if (!input || typeof input !== 'object') fail('input ausente.');
    if (input.schema_version !== CONST.SCHEMA_VERSION)
      fail('schema_version não suportado: ' + input.schema_version + ' (esperado ' + CONST.SCHEMA_VERSION + ').');
    if (input.engine_version !== CONST.ENGINE_VERSION)
      fail('engine_version não suportado: ' + input.engine_version + ' (esperado ' + CONST.ENGINE_VERSION + ').');
    if (!input.study) fail('study ausente.');
    var U = input.study.tensao_V;
    if (!isNum(U) || U <= 0) fail('study.tensao_V deve ser > 0.');
    if (U > CONST.TENSAO_MAX_V) fail('study.tensao_V acima do limite BT (' + CONST.TENSAO_MAX_V + ' V).');
    if (input.feeders != null && !Array.isArray(input.feeders)) fail('feeders deve ser lista.');
    (input.feeders || []).forEach(function (f, i) {
      if (!(f.secao_mm2 > 0)) fail('feeders[' + i + '].secao_mm2 deve ser > 0.');
      if (!(f.comprimento_m > 0)) fail('feeders[' + i + '].comprimento_m deve ser > 0.');
      if (!normMat(f.material)) fail('feeders[' + i + '].material inválido (Cu/Al).');
    });
    return U;
  }

  // Combina uma lista de fasores de corrente {mag, ang} → magnitude do somatório
  function somaVetorial(fasores) {
    var re = 0, im = 0;
    fasores.forEach(function (p) {
      re += p.mag * Math.cos(p.ang);
      im += p.mag * Math.sin(p.ang);
    });
    return Math.sqrt(re * re + im * im);
  }

  // ── Núcleo do cálculo para um dado "caso" (max/min) ─────────
  // usaTemp20=true → R dos cabos a 20°C (caso máx); false → à temp. de operação (caso mín)
  function calcularCaso(ctx, c, usaTemp20) {
    var U = ctx.U, tipoFalta = ctx.tipoFalta;
    var R = ctx.fonte.R + (ctx.trafo ? ctx.trafo.R : 0);
    var X = ctx.fonte.X + (ctx.trafo ? ctx.trafo.X : 0);
    var imped = [];

    if (ctx.fonte.R || ctx.fonte.X)
      imped.push({ elemento: ctx.fonte.elemento, R_mOhm: r(ctx.fonte.R * 1000), X_mOhm: r(ctx.fonte.X * 1000),
                   Z_mOhm: r(Math.sqrt(ctx.fonte.R * ctx.fonte.R + ctx.fonte.X * ctx.fonte.X) * 1000) });
    if (ctx.trafo)
      imped.push({ elemento: ctx.trafo.elemento, R_mOhm: r(ctx.trafo.R * 1000), X_mOhm: r(ctx.trafo.X * 1000),
                   Z_mOhm: r(ctx.trafo.Z * 1000) });

    // Trechos de cabo incluídos até o ponto de falta
    for (var i = 0; i < ctx.nTrechos; i++) {
      var f = ctx.feeders[i];
      var mat = normMat(f.material);
      var tempC = usaTemp20 ? 20 : (isNum(f.temp_op_C) ? f.temp_op_C : (normIso(f.isolacao) === 'XLPE' ? 90 : 70));
      var Rc = resistenciaCabo(mat, f.secao_mm2, f.comprimento_m, f.paralelos, tempC);
      var Xc = reatanciaCabo(f.x_ohm_km, f.comprimento_m, f.paralelos);
      // Falta fase-retorno (laço TN): inclui condutor de retorno (PE)
      if (tipoFalta === 'fase_retorno') {
        var Spe = verificarPE(f.secao_mm2).secao_pe_mm2;
        var Rpe = resistenciaCabo(mat, Spe, f.comprimento_m, f.paralelos, tempC);
        Rc += Rpe;
        Xc += Xc; // retorno com reatância similar (aproximação de laço)
      }
      R += Rc; X += Xc;
      imped.push({ elemento: 'cabo #' + (i + 1) + ' (' + f.secao_mm2 + 'mm² ' + mat + ' ' + f.comprimento_m + 'm)',
                   R_mOhm: r(Rc * 1000), X_mOhm: r(Xc * 1000), Z_mOhm: r(Math.sqrt(Rc * Rc + Xc * Xc) * 1000) });
    }

    var Z = Math.sqrt(R * R + X * X);
    // Corrente da rede (fonte+trafo+cabos) conforme tipo de falta
    var Ik;
    if (tipoFalta === 'bifasica')      Ik = (c * U / (SQRT3 * Z)) * (SQRT3 / 2);
    else if (tipoFalta === 'fase_retorno') Ik = (c * (U / SQRT3)) / Z; // U0 = U/√3, laço completo
    else                               Ik = c * U / (SQRT3 * Z);       // trifásica

    // impedância acumulada
    var Racc = 0, Xacc = 0;
    imped.forEach(function (e) {
      Racc += e.R_mOhm; Xacc += e.X_mOhm;
      e.R_acum = r(Racc); e.X_acum = r(Xacc); e.Z_acum = r(Math.sqrt(Racc * Racc + Xacc * Xacc));
    });

    return { R: R, X: X, Z: Z, Ik_A: Ik, impedancias: imped };
  }

  // ── Função principal ────────────────────────────────────────
  function calcular(input) {
    var U = validar(input);
    var cMax = isNum(input.cMax) ? input.cMax : CONST.C_MAX_DEFAULT;
    var cMin = isNum(input.cMin) ? input.cMin : CONST.C_MIN_DEFAULT;
    var tipoFalta = String((input.study && input.study.tipo_falta) || 'trifasica').toLowerCase();

    // Tipos sem cálculo neste motor
    if (tipoFalta === 'tt' || tipoFalta === 'it') {
      return {
        schema_version: CONST.SCHEMA_VERSION,
        engine_version: CONST.ENGINE_VERSION,
        aviso: 'Falta em esquema ' + tipoFalta.toUpperCase() +
               ' não é calculada nesta versão (fora do escopo). Use TN/laço fase-retorno.',
        calculado: false
      };
    }
    if (['trifasica', 'bifasica', 'fase_retorno'].indexOf(tipoFalta) < 0)
      fail('study.tipo_falta inválido: use "trifasica", "bifasica", "fase_retorno", "TT" ou "IT".');

    var memoria = [];
    var fonte = impedanciaFonte(input.network, U, cMax);
    var trafo = impedanciaTrafo(input.transformer, U, memoria);
    var feeders = input.feeders || [];
    var nTrechos = (input.fault_point && isNum(input.fault_point.apos_trecho_index))
      ? Math.max(0, Math.min(feeders.length, input.fault_point.apos_trecho_index))
      : feeders.length;

    var ctx = { U: U, tipoFalta: tipoFalta, fonte: fonte, trafo: trafo, feeders: feeders, nTrechos: nTrechos };

    var casoMax = calcularCaso(ctx, cMax, true);   // R a 20°C
    var casoMin = calcularCaso(ctx, cMin, false);  // R à temp. de operação

    // Contribuição de motores (apenas falta trifásica — demais fora do escopo v1)
    var motoresOut = [];
    var fasores = [{ mag: casoMax.Ik_A, ang: Math.atan2(casoMax.X, casoMax.R) }];
    var ipTotal = kappa(casoMax.R, casoMax.X) * SQRT2 * casoMax.Ik_A;
    var kappaRede = kappa(casoMax.R, casoMax.X);

    if (tipoFalta === 'trifasica' && Array.isArray(input.motors)) {
      input.motors.forEach(function (m) {
        var mo = correnteMotor(m, U);
        motoresOut.push({ id: mo.id, In_A: r(mo.In_A, 1), Im_kA: r(mo.Im_A / 1000, 4),
                          ip_motor_kA: r(mo.ip_A / 1000, 4) });
        fasores.push({ mag: mo.Im_A, ang: mo.ang });
        ipTotal += mo.ip_A;
      });
    }

    var IkTotalMax = somaVetorial(fasores);

    memoria.push({
      formula: 'Ik" = c·U / (√3·|Z|)',
      valores_substituidos: cMax + '·' + U + ' / (√3·' + r(casoMax.Z * 1000) + ' mΩ)',
      resultado: r(casoMax.Ik_A / 1000), unidade: 'kA'
    });
    memoria.push({
      formula: 'κ = 1,02 + 0,98·e^(−3R/X) ; ip = κ·√2·Ik"',
      valores_substituidos: 'R/X = ' + r(casoMax.R / casoMax.X, 4),
      resultado: 'κ=' + r(kappaRede, 3) + ' ; ip=' + r(casoMax.Ik_A / 1000 * kappaRede * SQRT2), unidade: 'kA'
    });

    // Verificações (quando os dados existirem)
    var verif = { disjuntor: null, termica: null, PE: null };
    var Ik_max_kA = IkTotalMax / 1000;
    var ip_total_kA = ipTotal / 1000;
    var Ik_min_kA = casoMin.Ik_A / 1000;

    if (input.protection && (isNum(input.protection.Icu_kA) || isNum(input.protection.I3_kA))) {
      var p = input.protection;
      verif.disjuntor = {
        referencia: p.referencia || null,
        Icu_kA: isNum(p.Icu_kA) ? p.Icu_kA : null,
        Icm_kA: isNum(p.Icm_kA) ? p.Icm_kA : null,
        I3_kA: isNum(p.I3_kA) ? p.I3_kA : null,
        Ik_max_kA: r(Ik_max_kA), ip_total_kA: r(ip_total_kA), Ik_min_kA: r(Ik_min_kA),
        capacidade_ok: isNum(p.Icu_kA) ? (p.Icu_kA >= Ik_max_kA) : null,
        pico_ok: isNum(p.Icm_kA) ? (p.Icm_kA >= ip_total_kA) : null,
        atuacao_ok: isNum(p.I3_kA) ? (p.I3_kA <= Ik_min_kA) : null
      };
    }
    // Verificação térmica/PE usa o cabo no ponto de falta (último trecho incluído)
    if (nTrechos > 0) {
      var fp = feeders[nTrechos - 1];
      var t_s = (input.protection && isNum(input.protection.t_s)) ? input.protection.t_s : null;
      if (t_s != null) {
        verif.termica = verificarTermica({
          Ik_kA: Ik_max_kA, secao_mm2: fp.secao_mm2, material: fp.material, isolacao: fp.isolacao, t_s: t_s
        });
      }
      verif.PE = verificarPE(fp.secao_mm2);
    }

    return {
      schema_version: CONST.SCHEMA_VERSION,
      engine_version: CONST.ENGINE_VERSION,
      calculado: true,
      tipo_falta: tipoFalta,
      tensao_V: U,
      tipicos_usados: (trafo && trafo.tipico) ? ['transformador'] : [],
      impedancias: casoMax.impedancias,
      caso_max: {
        Ik_kA: r(casoMax.Ik_A / 1000),
        ip_kA: r(casoMax.Ik_A / 1000 * kappaRede * SQRT2),
        kappa: r(kappaRede, 4),
        R_total_mOhm: r(casoMax.R * 1000),
        X_total_mOhm: r(casoMax.X * 1000),
        Z_total_mOhm: r(casoMax.Z * 1000)
      },
      caso_min: { Ik_kA: r(casoMin.Ik_A / 1000) },
      motores: motoresOut,
      Ik_total_max_kA: r(Ik_max_kA),
      ip_total_kA: r(ip_total_kA),
      verificacoes: verif,
      memoria_calculo: memoria
    };
  }

  var CurtoBTEngine = {
    CONST: CONST,
    calcular: calcular,
    verificarTermica: verificarTermica,
    verificarPE: verificarPE,
    transformadorTipicos: transformadorTipicos
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = CurtoBTEngine;
  if (typeof window !== 'undefined') window.CurtoBTEngine = CurtoBTEngine;
})();

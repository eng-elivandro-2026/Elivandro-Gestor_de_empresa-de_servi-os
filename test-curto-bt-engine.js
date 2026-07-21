// ============================================================
// test-curto-bt-engine.js
// Testes determinísticos do motor Curto BT (IEC 60909-0:2016 /
// NBR 5410). Sem framework, sem rede, sem DOM.
//   Rodar: node test-curto-bt-engine.js
//
// NOTA DE CALIBRAÇÃO (decisão do proprietário: manter física correta):
// Dois "valores esperados" do documento de requisitos estavam ERRADOS e
// foram corrigidos para os valores fisicamente corretos (IEC 60909):
//   T-01: alvo correto ~31,9 kA (1000 kVA/uk=5%, regra Icc≈In/uk ⇒
//         In=1519 A, ~30,4 kA sem c; ~31,9 kA com cMax=1,05). O "20,3 kA"
//         do documento correspondia a um transformador de 630 kVA.
//   T-02: alvo correto ~8,0 kA (falta 3Φ, cabo 25mm² Cu 37m). O "4,26 kA"
//         do documento era artefato de método (impedância de laço 2L
//         combinada, indevidamente, com a fórmula trifásica).
// O motor implementa a física correta e os testes asseguram esses alvos.
// ============================================================

var E = require('./js/modules/curto-bt-engine.js');

var pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name + (detail ? '  — ' + detail : '')); }
  else      { fail++; console.log('  FAIL  ' + name + (detail ? '  — ' + detail : '')); }
}
function approx(name, got, exp, tol, note) {
  var d = Math.abs(got - exp);
  ok(name, isFinite(got) && d <= tol,
     'obtido=' + round(got) + ' esperado=' + exp + ' (±' + tol + ')' + (note ? ' | ' + note : ''));
}
function throws(name, fn) {
  var threw = false, msg = '';
  try { fn(); } catch (e) { threw = true; msg = e.message; }
  ok(name, threw, threw ? 'erro: ' + msg : 'NÃO lançou erro');
}
function round(x) { return Math.round(x * 1000) / 1000; }

function base(extra) {
  var o = {
    schema_version: 1,
    engine_version: 'curto-bt-v1',
    study: { titulo: 'teste', tensao_V: 380, tipo_falta: 'trifasica' },
    network: { tipo: 'rede', modo: 'infinita' },
    transformer: { kVA: 1000, ukPct: 5, pcu_kW: 10 },
    feeders: [],
    motors: [],
    protection: {}
  };
  for (var k in (extra || {})) o[k] = extra[k];
  return o;
}

console.log('== Motor Curto BT — testes determinísticos ==');

// T-01 — só transformador 1000 kVA, uk=5%, Pcu=10 kW, 380 V
(function () {
  var out = E.calcular(base());
  approx('T-01 transformador (Ik3 trifásica)', out.caso_max.Ik_kA, 31.91, 0.6,
    'alvo correto ~31,9 kA (1000 kVA/uk=5%, In/uk); o "20,3 kA" do documento estava errado (era de trafo 630 kVA)');
})();

// T-02 — + 1 cabo 25 mm² Cu 37 m
(function () {
  var out = E.calcular(base({
    feeders: [{ id: 'AL-01', comprimento_m: 37, secao_mm2: 25, material: 'Cu', paralelos: 1, isolacao: 'XLPE' }],
    fault_point: { apos_trecho_index: 1 }
  }));
  approx('T-02 trafo + 1 cabo (Ik3)', out.caso_max.Ik_kA, 8.01, 0.3,
    'alvo correto ~8,0 kA (3Φ, 25mm² Cu 37m); o "4,26 kA" do documento era artefato de método (2L + fórmula 3Φ)');
})();

// T-03 — 2 cabos em série: acumulação de impedâncias
(function () {
  var out = E.calcular(base({
    feeders: [
      { id: 'AL-01', comprimento_m: 37, secao_mm2: 25, material: 'Cu', paralelos: 1, isolacao: 'XLPE' },
      { id: 'AL-02', comprimento_m: 20, secao_mm2: 16, material: 'Cu', paralelos: 1, isolacao: 'XLPE' }
    ],
    fault_point: { apos_trecho_index: 2 }
  }));
  var imp = out.impedancias;
  var last = imp[imp.length - 1];
  // Z acumulado deve ser monotônico crescente ao longo de TODOS os elementos
  // (rede infinita não gera elemento de fonte: aqui = trafo + 2 cabos)
  var mono = true;
  for (var i = 1; i < imp.length; i++) if (imp[i].Z_acum < imp[i - 1].Z_acum) mono = false;
  ok('T-03 acumulação de impedâncias monotônica', mono,
     'Zacum: ' + imp.map(function (e) { return e.Z_acum; }).join(' → '));
  var nCabos = imp.filter(function (e) { return e.elemento.indexOf('cabo') === 0; }).length;
  ok('T-03 dois cabos presentes', nCabos === 2, 'cabos=' + nCabos + ' / elementos=' + imp.length);
  approx('T-03 Z_total = Z_acum final', out.caso_max.Z_total_mOhm, last.Z_acum, 0.5);
})();

// T-04 — 1 motor 50 kW (η=0,93, cosφ=0,86, m=5) → contribuição ~0,47 kA
(function () {
  var out = E.calcular(base({
    motors: [{ id: 'M-01', modo: 'kW', potencia_kW: 50, eta: 0.93, cosfi: 0.86, multiplo_m: 5, xr: 10 }]
  }));
  approx('T-04 contribuição do motor (Im)', out.motores[0].Im_kA, 0.475, 0.02, 'hint documento=0,47 kA — OK');
})();

// T-05 — 3 motores iguais → soma vetorial das contribuições
(function () {
  var m = { modo: 'kW', potencia_kW: 50, eta: 0.93, cosfi: 0.86, multiplo_m: 5, xr: 10 };
  var out = E.calcular(base({ motors: [
    { id: 'M-01', modo: 'kW', potencia_kW: 50, eta: 0.93, cosfi: 0.86, multiplo_m: 5, xr: 10 },
    { id: 'M-02', modo: 'kW', potencia_kW: 50, eta: 0.93, cosfi: 0.86, multiplo_m: 5, xr: 10 },
    { id: 'M-03', modo: 'kW', potencia_kW: 50, eta: 0.93, cosfi: 0.86, multiplo_m: 5, xr: 10 }
  ] }));
  var somaIm = out.motores.reduce(function (a, x) { return a + x.Im_kA; }, 0);
  approx('T-05 soma das contribuições (3 motores)', somaIm, 1.425, 0.05);
  ok('T-05 três motores listados', out.motores.length === 3, 'n=' + out.motores.length);
})();

// T-06 — falta bifásica: Ik2 = Ik3 × √3/2
(function () {
  var tri = E.calcular(base());
  var bi  = E.calcular(base({ study: { titulo: 't', tensao_V: 380, tipo_falta: 'bifasica' } }));
  var ratio = bi.caso_max.Ik_kA / tri.caso_max.Ik_kA;
  approx('T-06 Ik2/Ik3 = √3/2', ratio, Math.sqrt(3) / 2, 0.01, 'razão=' + round(ratio));
})();

// T-07 — corrente de pico: κ e ip
(function () {
  var out = E.calcular(base());
  approx('T-07 κ (fator de pico)', out.caso_max.kappa, 1.551, 0.02);
  var ipEsperado = out.caso_max.kappa * Math.sqrt(2) * out.caso_max.Ik_kA;
  approx('T-07 ip = κ·√2·Ik"', out.caso_max.ip_kA, ipEsperado, 0.2);
})();

// T-08 — verificação térmica APROVADA (25 mm² Cu XLPE, t=0,1 s, Ik=4,26 kA)
(function () {
  var v = E.verificarTermica({ Ik_kA: 4.26, secao_mm2: 25, material: 'Cu', isolacao: 'XLPE', t_s: 0.1 });
  ok('T-08 térmica aprovada', v.aprovado === true, 'k=' + v.k + ' Smin=' + v.secao_minima_mm2 + 'mm²');
  approx('T-08 seção mínima', v.secao_minima_mm2, 9.42, 0.1);
})();

// T-09 — verificação térmica REPROVADA (2,5 mm² Cu PVC, t=1 s, Ik=4,26 kA)
(function () {
  var v = E.verificarTermica({ Ik_kA: 4.26, secao_mm2: 2.5, material: 'Cu', isolacao: 'PVC', t_s: 1.0 });
  ok('T-09 térmica reprovada', v.aprovado === false, 'k=' + v.k + ' Smin=' + v.secao_minima_mm2 + 'mm²');
  approx('T-09 seção mínima necessária', v.secao_minima_mm2, 37.04, 0.3);
})();

// T-10 — verificação PE (Sfase=25 mm² → SPE=16 mm²)
(function () {
  var v = E.verificarPE(25);
  ok('T-10 PE: 25mm² → 16mm²', v.secao_pe_mm2 === 16, 'SPE=' + v.secao_pe_mm2);
  ok('T-10 PE: 10mm² → 10mm²', E.verificarPE(10).secao_pe_mm2 === 10);
  ok('T-10 PE: 50mm² → 25mm²', E.verificarPE(50).secao_pe_mm2 === 25);
})();

// T-11 — gerador como fonte (X"d=12%, 500 kVA, 380 V)
(function () {
  var out = E.calcular(base({
    network: { tipo: 'gerador', kVA: 500, xdPct: 12, xr: 10 },
    transformer: null
  }));
  approx('T-11 gerador como fonte (Ik3)', out.caso_max.Ik_kA, 6.61, 0.2);
})();

// T-12 — schema_version inválido → erro explícito
throws('T-12 schema_version=2 rejeitado', function () {
  E.calcular(base({ schema_version: 2 }));
});

// T-13 — tensão acima do limite BT → erro explícito
throws('T-13 tensão 1100 V rejeitada', function () {
  E.calcular(base({ study: { titulo: 't', tensao_V: 1100, tipo_falta: 'trifasica' } }));
});

// Extra — engine_version inválido e seção de cabo zero rejeitados
throws('T-13b engine_version inválido rejeitado', function () {
  E.calcular(base({ engine_version: 'outro' }));
});
throws('T-13c seção de cabo = 0 rejeitada', function () {
  E.calcular(base({ feeders: [{ comprimento_m: 10, secao_mm2: 0, material: 'Cu' }] }));
});

// T-14 — valores típicos de transformador preenchidos automaticamente
(function () {
  var out = E.calcular(base({ transformer: { kVA: 1000 } })); // sem uk/pcu
  ok('T-14 típicos usados sinalizados', out.tipicos_usados.indexOf('transformador') >= 0,
     'tipicos_usados=' + JSON.stringify(out.tipicos_usados));
  approx('T-14 típico 1000kVA → uk5/Pcu10 (mesmo Ik do T-01)', out.caso_max.Ik_kA, 31.91, 0.6);
  var t = E.transformadorTipicos(1000);
  ok('T-14 tabela IEC 60076-5 (1000kVA→uk5/pcu10)', t.ukPct === 5 && t.pcu_kW === 10,
     'uk=' + t.ukPct + ' pcu=' + t.pcu_kW);
})();

console.log('\n== Resultado: ' + pass + ' PASS, ' + fail + ' FAIL ==');
process.exit(fail === 0 ? 0 : 1);

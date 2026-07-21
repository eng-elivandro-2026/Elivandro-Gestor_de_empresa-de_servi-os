// ============================================================
// test-curto-bt-aceite.js
// Suíte de ACEITE (Etapa 7) — cobre a parte MATEMÁTICA da matriz de
// testes (§11) que roda sem Supabase/DOM. Determinístico.
//   Rodar: node test-curto-bt-aceite.js
//
// O que NÃO está aqui (depende de homologação com Supabase — ver
// docs/CURTO-BT-ACEITE.md): isolamento por tenant, autoria (D3),
// deep-link cruzado, impressão visual do memorial, troca de empresa.
// ============================================================

var E = require('./js/modules/curto-bt-engine.js');
var pass=0, fail=0;
function ok(n,c,d){ if(c){pass++;console.log('  PASS  '+n+(d?'  — '+d:''));}else{fail++;console.log('  FAIL  '+n+(d?'  — '+d:''));} }
function approx(n,g,e,t,note){ ok(n, isFinite(g)&&Math.abs(g-e)<=t, 'obtido='+round(g)+' esperado='+e+' (±'+t+')'+(note?' | '+note:'')); }
function throws(n,fn){ var th=false,m=''; try{fn();}catch(e){th=true;m=e.message;} ok(n,th,th?'erro: '+m:'NÃO lançou'); }
function round(x){ return Math.round(x*1000)/1000; }
function base(x){ var o={schema_version:1,engine_version:'curto-bt-v1',study:{titulo:'ac',tensao_V:380,tipo_falta:'trifasica'},network:{tipo:'rede',modo:'infinita'},transformer:{kVA:1000,ukPct:5,pcu_kW:10},feeders:[],motors:[]}; for(var k in (x||{}))o[k]=x[k]; return o; }
function ik(x){ return E.calcular(x).caso_max.Ik_kA; }

console.log('== Curto BT — suíte de ACEITE (matemática, sem Supabase) ==');

// A. Fonte / rede finita vs infinita ------------------------------------
(function(){
  var inf = ik(base());                                   // rede infinita
  var icc = ik(base({network:{tipo:'rede',modo:'Icc',Icc_kA:25,xr:10}}));  // rede finita 25 kA
  var scc = ik(base({network:{tipo:'rede',modo:'Scc',Scc_MVA:50,xr:10}})); // rede finita 50 MVA
  approx('A1 rede infinita (só trafo)', inf, 31.91, 0.6);
  approx('A2 rede finita Icc=25kA', icc, 14.03, 0.8);
  approx('A3 rede finita Scc=50MVA', scc, 22.5, 1.0);
  ok('A4 fonte finita reduz Ik (Icc<Scc<infinita)', icc<scc && scc<inf, icc.toFixed(1)+' < '+scc.toFixed(1)+' < '+inf.toFixed(1));
})();

// B. Gerador como fonte -------------------------------------------------
(function(){
  var g = ik(base({network:{tipo:'gerador',kVA:500,xdPct:12,xr:10}, transformer:null}));
  approx('B1 gerador X"d=12% 500kVA', g, 6.61, 0.2);
  throws('B2 gerador sem X"d rejeitado', function(){ E.calcular(base({network:{tipo:'gerador',kVA:500}, transformer:null})); });
})();

// C. Transformador — típicos IEC 60076-5 --------------------------------
(function(){
  var t630=E.transformadorTipicos(630), t1000=E.transformadorTipicos(1000), t2500=E.transformadorTipicos(2500);
  ok('C1 típico ≤630kVA (uk4/pcu6)', t630.ukPct===4 && t630.pcu_kW===6, JSON.stringify(t630));
  ok('C2 típico 1000kVA (uk5/pcu10)', t1000.ukPct===5 && t1000.pcu_kW===10, JSON.stringify(t1000));
  ok('C3 típico 2500kVA (uk6/pcu16)', t2500.ukPct===6 && t2500.pcu_kW===16, JSON.stringify(t2500));
  ok('C4 >6300kVA exige placa (null)', E.transformadorTipicos(8000)===null);
  var out=E.calcular(base({transformer:{kVA:1000}}));
  ok('C5 autofill sinaliza típicos_usados', out.tipicos_usados.indexOf('transformador')>=0);
  throws('C6 >6300 sem placa rejeitado', function(){ E.calcular(base({transformer:{kVA:8000}})); });
})();

// D. Múltiplos cabos em série (acumulação) ------------------------------
(function(){
  var f=[{id:'A1',comprimento_m:37,secao_mm2:25,material:'Cu',paralelos:1,isolacao:'XLPE'},
         {id:'A2',comprimento_m:20,secao_mm2:16,material:'Cu',paralelos:1,isolacao:'XLPE'}];
  var out=E.calcular(base({feeders:f,fault_point:{apos_trecho_index:2}}));
  var imp=out.impedancias, last=imp[imp.length-1];
  var mono=true; for(var i=1;i<imp.length;i++) if(imp[i].Z_acum<imp[i-1].Z_acum) mono=false;
  ok('D1 impedância acumulada monotônica', mono, imp.map(function(e){return e.Z_acum;}).join(' → '));
  approx('D2 Z_total = último Z_acum', out.caso_max.Z_total_mOhm, last.Z_acum, 0.5);
  // mais cabo em série ⇒ menor Ik
  var out1=E.calcular(base({feeders:f,fault_point:{apos_trecho_index:1}}));
  ok('D3 mais cabo reduz Ik', out.caso_max.Ik_kA < out1.caso_max.Ik_kA, out.caso_max.Ik_kA.toFixed(2)+' < '+out1.caso_max.Ik_kA.toFixed(2));
})();

// E. Múltiplos motores (soma vetorial) ----------------------------------
(function(){
  function mot(id){ return {id:id,modo:'kW',potencia_kW:50,eta:0.93,cosfi:0.86,multiplo_m:5,xr:10}; }
  var out1=E.calcular(base({motors:[mot('M1')]}));
  var out3=E.calcular(base({motors:[mot('M1'),mot('M2'),mot('M3')]}));
  approx('E1 contribuição de 1 motor', out1.motores[0].Im_kA, 0.475, 0.02);
  approx('E2 soma de 3 motores', out3.motores.reduce(function(a,x){return a+x.Im_kA;},0), 1.425, 0.05);
  ok('E3 motores aumentam Ik total', out3.Ik_total_max_kA > E.calcular(base()).Ik_total_max_kA);
})();

// F. Tipos de falta -----------------------------------------------------
(function(){
  var tri=ik(base());
  var bi =ik(base({study:{tensao_V:380,tipo_falta:'bifasica'}}));
  var fr =ik(base({feeders:[{id:'A',comprimento_m:30,secao_mm2:16,material:'Cu',paralelos:1,isolacao:'PVC'}],fault_point:{apos_trecho_index:1},study:{tensao_V:380,tipo_falta:'fase_retorno'}}));
  var tri_c=ik(base({feeders:[{id:'A',comprimento_m:30,secao_mm2:16,material:'Cu',paralelos:1,isolacao:'PVC'}],fault_point:{apos_trecho_index:1}}));
  approx('F1 Ik2/Ik3 = √3/2', bi/tri, Math.sqrt(3)/2, 0.01);
  ok('F2 fase-retorno < trifásica (laço)', fr < tri_c, fr.toFixed(2)+' < '+tri_c.toFixed(2));
  var tt=E.calcular(base({study:{tensao_V:380,tipo_falta:'TT'}}));
  ok('F3 TT retorna aviso (não calcula)', tt.calculado===false && !!tt.aviso, tt.aviso||'');
  var it=E.calcular(base({study:{tensao_V:380,tipo_falta:'IT'}}));
  ok('F4 IT retorna aviso (não calcula)', it.calculado===false);
})();

// G. Corrente de pico (κ) ------------------------------------------------
(function(){
  var out=E.calcular(base());
  approx('G1 κ transformador', out.caso_max.kappa, 1.551, 0.02);
  ok('G2 κ dentro de [1,02 ; 2,0]', out.caso_max.kappa>=1.02 && out.caso_max.kappa<=2.0);
  approx('G3 ip = κ·√2·Ik"', out.caso_max.ip_kA, out.caso_max.kappa*Math.SQRT2*out.caso_max.Ik_kA, 0.2);
})();

// H. Verificação térmica I²t e PE ---------------------------------------
(function(){
  var okT=E.verificarTermica({Ik_kA:4.26,secao_mm2:25,material:'Cu',isolacao:'XLPE',t_s:0.1});
  var bad=E.verificarTermica({Ik_kA:4.26,secao_mm2:2.5,material:'Cu',isolacao:'PVC',t_s:1.0});
  ok('H1 térmica aprovada (25mm² XLPE)', okT.aprovado===true, 'Smin='+okT.secao_minima_mm2);
  ok('H2 térmica reprovada (2,5mm² PVC)', bad.aprovado===false, 'Smin='+bad.secao_minima_mm2);
  ok('H3 k Cu/XLPE=143', okT.k===143);
  ok('H4 PE 10→10', E.verificarPE(10).secao_pe_mm2===10);
  ok('H5 PE 25→16', E.verificarPE(25).secao_pe_mm2===16);
  ok('H6 PE 50→25', E.verificarPE(50).secao_pe_mm2===25);
})();

// I. Fatores c parametrizáveis (máx/mín) --------------------------------
(function(){
  var c105=ik(base({cMax:1.05}));
  var c110=ik(base({cMax:1.10}));
  approx('I1 cMax escala Ik linearmente', c110/c105, 1.10/1.05, 0.005);
  var out=E.calcular(base({feeders:[{id:'A',comprimento_m:40,secao_mm2:16,material:'Cu',paralelos:1,isolacao:'PVC',temp_op_C:70}],fault_point:{apos_trecho_index:1}}));
  ok('I2 caso mínimo < caso máximo (R quente + cMin)', out.caso_min.Ik_kA < out.caso_max.Ik_kA, out.caso_min.Ik_kA.toFixed(2)+' < '+out.caso_max.Ik_kA.toFixed(2));
})();

// J. Entradas inválidas (envelope + limites) ----------------------------
(function(){
  throws('J1 schema_version=2', function(){ E.calcular(base({schema_version:2})); });
  throws('J2 engine_version errado', function(){ E.calcular(base({engine_version:'x'})); });
  throws('J3 tensão >1000V', function(){ E.calcular(base({study:{tensao_V:1100,tipo_falta:'trifasica'}})); });
  throws('J4 tensão <=0', function(){ E.calcular(base({study:{tensao_V:0,tipo_falta:'trifasica'}})); });
  throws('J5 seção de cabo 0', function(){ E.calcular(base({feeders:[{comprimento_m:10,secao_mm2:0,material:'Cu'}]})); });
  throws('J6 comprimento de cabo 0', function(){ E.calcular(base({feeders:[{comprimento_m:0,secao_mm2:16,material:'Cu'}]})); });
  throws('J7 material inválido', function(){ E.calcular(base({feeders:[{comprimento_m:10,secao_mm2:16,material:'Fe'}]})); });
  throws('J8 tipo de falta inválido', function(){ E.calcular(base({study:{tensao_V:380,tipo_falta:'zzz'}})); });
})();

console.log('\n== ACEITE: '+pass+' PASS, '+fail+' FAIL ==');
process.exit(fail===0?0:1);

// ============================================================
// teste-parcelamento-cr.js
// Testes do PR2 do roadmap Financeiro — parcelamento de contas
// a receber (schema da migration 076).
//
// Rodar:  node teste-parcelamento-cr.js
//
// Não precisa de navegador. Carrega js/config/supabase-financeiro.js
// com um window falso e exercita as funções puras. A parte de banco é
// OPCIONAL: só roda se .env.supabase existir e o pacote pg estiver
// instalado, e trabalha inteiramente dentro de BEGIN/ROLLBACK —
// nenhuma linha é gravada em produção.
//
// Saída: código 0 se tudo passou, 1 se houve falha.
// ============================================================

const fs   = require('fs');
const path = require('path');

const RAIZ = __dirname;
const ARQ_LIB = path.join(RAIZ, 'js', 'config', 'supabase-financeiro.js');
const ARQ_ENV = path.join(RAIZ, '.env.supabase');

let falhas = 0;
let total  = 0;

function titulo(t) {
  console.log('\n' + t);
  console.log('─'.repeat(Math.min(t.length, 70)));
}

function ok(nome, condicao, detalhe) {
  total++;
  if (!condicao) falhas++;
  console.log(`  ${condicao ? '✅' : '❌'} ${nome}${detalhe ? '  → ' + detalhe : ''}`);
}

function lanca(nome, fn) {
  total++;
  let lancou = false;
  try { fn(); } catch (e) { lancou = true; }
  if (!lancou) falhas++;
  console.log(`  ${lancou ? '✅' : '❌'} ${nome}`);
}

const cent  = v => Math.round(parseFloat(v) * 100);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Carrega a biblioteca com um window falso ─────────────────
function carregarBiblioteca() {
  const src = fs.readFileSync(ARQ_LIB, 'utf8');
  new Function(src);                       // valida a sintaxe
  const win = { crypto: require('crypto').webcrypto };
  new Function('window', src)(win);
  if (!win.sbFinanceiro) throw new Error('window.sbFinanceiro não foi exposto');
  return win.sbFinanceiro;
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  🧾 PARCELAMENTO DE CONTAS A RECEBER — PR2                 ║');
console.log('╚════════════════════════════════════════════════════════════╝');

let F;
try {
  F = carregarBiblioteca();
  console.log('\n✅ supabase-financeiro.js carregado — sintaxe OK');
} catch (e) {
  console.error('\n❌ Falha ao carregar a biblioteca:', e.message);
  process.exit(1);
}

// ============================================================
titulo('1) DISTRIBUIÇÃO DE VALOR — sobra de centavos na última parcela');
// ============================================================
ok('1000 em 3',  igual(F.distribuirValor(1000, 3), [333.33, 333.33, 333.34]));
ok('100 em 3',   igual(F.distribuirValor(100, 3),  [33.33, 33.33, 33.34]));
ok('1000 em 4',  igual(F.distribuirValor(1000, 4), [250, 250, 250, 250]));
ok('0,03 em 2',  igual(F.distribuirValor(0.03, 2), [0.01, 0.02]));
ok('1000 em 1',  igual(F.distribuirValor(1000, 1), [1000]));
ok('soma fecha em 1000/7',
   cent(F.distribuirValor(1000, 7).reduce((a, b) => a + b, 0).toFixed(2)) === 100000);
lanca('recusa n = 0',           () => F.distribuirValor(1000, 0));
lanca('recusa total negativo',  () => F.distribuirValor(-10, 2));

// ============================================================
titulo('2) SPLIT SERVIÇO / PRODUTO dentro da parcela');
// ============================================================
ok('333,33 meio a meio → sobra no produto',
   igual(F.dividirServicoProduto(333.33, 0.5), { valor_servico: 166.66, valor_produto: 166.67 }));
ok('100% serviço', igual(F.dividirServicoProduto(500, 1), { valor_servico: 500, valor_produto: 0 }));
ok('100% produto', igual(F.dividirServicoProduto(500, 0), { valor_servico: 0, valor_produto: 500 }));

titulo('3) AJUSTE MANUAL — o campo não editado absorve a diferença');
ok('edita serviço',        igual(F.ajustarSplitParcela(333.33, 'servico', 100), { valor_servico: 100, valor_produto: 233.33 }));
ok('edita produto',        igual(F.ajustarSplitParcela(333.33, 'produto', 100), { valor_servico: 233.33, valor_produto: 100 }));
ok('trava acima do valor', igual(F.ajustarSplitParcela(100, 'servico', 999),    { valor_servico: 100, valor_produto: 0 }));
ok('trava negativo',       igual(F.ajustarSplitParcela(100, 'servico', -50),    { valor_servico: 0, valor_produto: 100 }));

// ============================================================
titulo('4) DATAS — fim de mês preservado');
// ============================================================
ok('31/01 + 1 mês → 28/02',            F.somarMeses('2026-01-31', 1) === '2026-02-28');
ok('31/01 + 1 mês em bissexto → 29/02', F.somarMeses('2024-01-31', 1) === '2024-02-29');
ok('31/12 + 1 mês vira o ano',          F.somarMeses('2026-12-31', 1) === '2027-01-31');
ok('15/03 + 6 meses',                   F.somarMeses('2026-03-15', 6) === '2026-09-15');
lanca('recusa data fora do padrão ISO', () => F.somarMeses('15/03/2026', 1));

// ============================================================
titulo('5) PROPORÇÃO DE SERVIÇO VINDA DA PROPOSTA');
// ============================================================
ok('vS=700 vM=300 → 70%',        F.proporcaoServicoProposta({ vS: 700, vM: 300 }) === 0.7);
ok('sem breakdown → 100%',        F.proporcaoServicoProposta({ val: 1000 }) === 1);
ok('desconto só no serviço',
   Math.abs(F.proporcaoServicoProposta({ vS: 700, vM: 300, vDS: 100, vDM: 0 }) - (600 / 900)) < 1e-12);

// ============================================================
titulo('6) PRESETS');
// ============================================================
const aVista = F.presetAVista(1000, '2026-08-10', 1);
ok('à vista gera 1 parcela com o total', aVista.length === 1 && aVista[0].valor_previsto === 1000);

const iguais = F.presetParcelasIguais(1000, 3, '2026-08-10', 0.5, 1);
ok('3 iguais: valores',      igual(iguais.map(p => p.valor_previsto), [333.33, 333.33, 333.34]));
ok('3 iguais: vencimentos',  igual(iguais.map(p => p.data_vencimento), ['2026-08-10', '2026-09-10', '2026-10-10']));

const entrada = F.presetEntradaMaisN(1000, 400, 3, '2026-08-10', 1, 1);
ok('entrada + 3 → 4 parcelas', entrada.length === 4);
ok('entrada + 3: valores',     igual(entrada.map(p => p.valor_previsto), [400, 200, 200, 200]));
lanca('recusa entrada >= total', () => F.presetEntradaMaisN(1000, 1000, 3, '2026-08-10', 1, 1));
lanca('recusa entrada zero',     () => F.presetEntradaMaisN(1000, 0, 3, '2026-08-10', 1, 1));

// ============================================================
titulo('7) VALIDAÇÃO — igualdade exata, sem tolerância de centavo');
// ============================================================
ok('preset válido passa',           F.validarPlanoParcelas(iguais, 1000).ok === true);
ok('1 centavo a mais reprova',      F.validarPlanoParcelas(iguais, 1000.01).ok === false);
ok('reporta a diferença exata',     F.validarPlanoParcelas(iguais, 1000.01).diferenca === -0.01);
ok('lista vazia reprova',           F.validarPlanoParcelas([], 1000).ok === false);
ok('parcela sem data reprova',
   F.validarPlanoParcelas([{ parcela_numero: 1, data_vencimento: '', valor_previsto: 1000,
                             valor_servico: 1000, valor_produto: 0 }], 1000).ok === false);
const quebrado = JSON.parse(JSON.stringify(iguais));
quebrado[0].valor_servico = 999;
ok('linha que não fecha reprova',    F.validarPlanoParcelas(quebrado, 1000).ok === false);

// ============================================================
titulo('8) INVARIANTES — varredura de cenários');
// Garante nas duas direções:
//   soma(valor)   = total da proposta
//   soma(serviço) = total x percentual        (evita o centavo na NF de serviço)
//   serviço + produto = valor, em cada linha
// ============================================================
function invariantes(rotulo, plano, total, pct) {
  const somaV = plano.reduce((s, p) => s + cent(p.valor_previsto), 0);
  const somaS = plano.reduce((s, p) => s + cent(p.valor_servico), 0);
  const somaP = plano.reduce((s, p) => s + cent(p.valor_produto), 0);
  const servicoEsperado = Math.round(cent(total) * pct);
  const problemas = [];
  if (somaV !== cent(total))                         problemas.push('somaValor');
  if (somaS !== servicoEsperado)                     problemas.push('somaServico');
  if (somaP !== cent(total) - servicoEsperado)       problemas.push('somaProduto');
  if (!plano.every(p => cent(p.valor_servico) + cent(p.valor_produto) === cent(p.valor_previsto)))
                                                     problemas.push('linhaNaoFecha');
  if (!plano.every(p => cent(p.valor_servico) <= cent(p.valor_previsto)))
                                                     problemas.push('servicoAcimaDoValor');
  if (!plano.every(p => p.valor_servico >= 0 && p.valor_produto >= 0))
                                                     problemas.push('negativo');
  if (problemas.length) { falhas++; console.log(`  ❌ ${rotulo} → ${problemas.join(', ')}`); return false; }
  return true;
}

const TOTAIS = [1000, 999.99, 7777.77, 0.03, 123.45, 18607.18, 1000000];
const QTDS   = [1, 2, 3, 4, 7, 12, 13, 24];
const PCTS   = [0, 0.3, 0.5, 0.6118, 0.7, 1, 1 / 3, 0.6666666666];

let casos = 0;
TOTAIS.forEach(t => QTDS.forEach(n => PCTS.forEach(pct => {
  casos++; total++;
  invariantes(`iguais total=${t} n=${n} pct=${pct}`, F.presetParcelasIguais(t, n, '2026-01-31', pct, 1), t, pct);
})));
console.log(`  ✅ ${casos} cenários de parcelas iguais`);

let casosEnt = 0;
[1000, 7777.77, 123.45, 18607.18].forEach(t => {
  [0.01, 100, t / 2, t - 0.01].forEach(entrada => {
    if (cent(entrada) <= 0 || cent(entrada) >= cent(t)) return;
    [1, 3, 12].forEach(n => [0, 0.35, 0.7, 1].forEach(pct => {
      casosEnt++; total++;
      invariantes(`entrada total=${t} ent=${entrada} n=${n} pct=${pct}`,
        F.presetEntradaMaisN(t, entrada, n, '2026-03-31', pct, 1), t, pct);
    }));
  });
});
console.log(`  ✅ ${casosEnt} cenários de entrada + N`);

ok('serviço nunca excede o valor da linha (parcelas muito desiguais)',
   igual(F.distribuirServicoNasParcelas([0.01, 999.99], 1000), [0.01, 999.99]));

// ============================================================
titulo('9) AGREGAÇÃO DO RESUMO — proposta com várias parcelas');
// Antes do PR2 os resumos usavam .maybeSingle(), que lança erro quando
// a query devolve mais de uma linha. Com o parcelamento isso quebraria
// o espelho financeiro e o espelho operacional.
// ============================================================
const parcelas3 = [
  { id: 'a', status: 'recebido', valor_previsto: 333.33, valor_faturado: 333.33, valor_recebido: 333.33, valor_pendente: 0,      data_vencimento: '2026-08-01', parcela_total: 3 },
  { id: 'b', status: 'faturado', valor_previsto: 333.33, valor_faturado: 333.33, valor_recebido: 0,      valor_pendente: 333.33, data_vencimento: '2026-09-01', parcela_total: 3 },
  { id: 'c', status: 'previsto', valor_previsto: 333.34, valor_faturado: 0,      valor_recebido: 0,      valor_pendente: 333.34, data_vencimento: '2026-10-01', parcela_total: 3 }
];
const ag = F.agregarContasEmConta(parcelas3);
ok('soma valor_previsto',            cent(ag.valor_previsto) === 100000, ag.valor_previsto);
ok('soma valor_recebido',            cent(ag.valor_recebido) === 33333);
ok('status → parcialmente_recebido', ag.status === 'parcialmente_recebido', ag.status);
ok('vencimento = menor EM ABERTO',   ag.data_vencimento === '2026-09-01', String(ag.data_vencimento));
ok('id do agregado é null',          ag.id === null);
['valor_previsto', 'valor_faturado', 'valor_recebido', 'valor_pendente', 'status'].forEach(campo => {
  ok(`campo "${campo}" presente (contrato dos espelhos)`, ag[campo] !== undefined);
});

ok('parcela cancelada fica fora da soma',
   F.agregarContasEmConta([
     { status: 'previsto',  valor_previsto: 500, data_vencimento: '2026-08-01' },
     { status: 'cancelado', valor_previsto: 500, data_vencimento: '2026-09-01' }
   ]).valor_previsto === 500);
ok('todas recebidas → recebido',
   F.agregarContasEmConta([
     { status: 'recebido', valor_previsto: 100, data_vencimento: '2026-08-01' },
     { status: 'recebido', valor_previsto: 100, data_vencimento: '2026-09-01' }
   ]).status === 'recebido');
ok('todas canceladas → cancelado',
   F.agregarContasEmConta([{ status: 'cancelado', valor_previsto: 100 },
                           { status: 'cancelado', valor_previsto: 100 }]).status === 'cancelado');
// Drivers de banco devolvem DATE como objeto Date; a comparação precisa
// normalizar, senão String(Date) faria "Fri" < "Wed" escolher a data errada.
ok('aceita data_vencimento como objeto Date',
   F.agregarContasEmConta([
     { status: 'previsto', valor_previsto: 100, data_vencimento: new Date(2026, 9, 30) },
     { status: 'previsto', valor_previsto: 100, data_vencimento: new Date(2026, 8, 30) }
   ]).data_vencimento === '2026-09-30');

// ============================================================
// 10) BANCO — opcional, sempre dentro de BEGIN/ROLLBACK
// ============================================================
(async () => {
  titulo('10) BANCO (opcional) — escrita real dentro de BEGIN/ROLLBACK');

  let Client;
  try { ({ Client } = require('pg')); }
  catch (e) { console.log('  ⏭️  pacote pg não instalado — etapa pulada'); return finalizar(); }
  if (!fs.existsSync(ARQ_ENV)) { console.log('  ⏭️  .env.supabase ausente — etapa pulada'); return finalizar(); }

  const env = {};
  fs.readFileSync(ARQ_ENV, 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if (m) env[m[1]] = m[2].trim();
  });
  if (!env.SUPABASE_PROJECT_REF || !env.SUPABASE_DB_PASSWORD) {
    console.log('  ⏭️  credenciais incompletas — etapa pulada'); return finalizar();
  }

  const client = new Client({
    host: 'db.' + env.SUPABASE_PROJECT_REF + '.supabase.co',
    port: 5432, database: 'postgres', user: 'postgres',
    password: env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000
  });

  try {
    await client.connect();
  } catch (e) {
    console.log('  ⏭️  sem conexão com o banco (' + e.message + ') — etapa pulada');
    return finalizar();
  }

  const antes = (await client.query('SELECT COUNT(*)::int n FROM financeiro_contas_receber')).rows[0].n;
  const empresaId = (await client.query('SELECT empresa_id FROM financeiro_contas_receber LIMIT 1')).rows[0].empresa_id;
  const propostaFake = 'TESTE-ROLLBACK-' + process.pid;
  const grupo = require('crypto').randomUUID();
  const valorTotal = 18607.18;
  const pct = 0.6118;
  const plano = F.presetParcelasIguais(valorTotal, 3, '2026-09-30', pct, 1);

  await client.query('BEGIN');
  try {
    for (const p of plano) {
      await client.query(`
        INSERT INTO financeiro_contas_receber
          (empresa_id, proposta_app_id, grupo_parcelamento_id, parcela_numero, parcela_total,
           titulo, cliente_nome, data_vencimento, valor_previsto, valor_servico, valor_produto,
           valor_faturado, valor_recebido, valor_pendente, status, origem)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,0,$12,'previsto','parcela_proposta')`,
        [empresaId, propostaFake, grupo, p.parcela_numero, plano.length,
         'TESTE — Parcela ' + p.parcela_numero + '/' + plano.length, 'Cliente de teste',
         p.data_vencimento, p.valor_previsto, p.valor_servico, p.valor_produto, p.valor_previsto]);
    }
    ok('schema aceita o payload das parcelas', true);

    const lidas = (await client.query(`
      SELECT * FROM financeiro_contas_receber
       WHERE empresa_id=$1 AND proposta_app_id=$2 AND grupo_parcelamento_id IS NOT NULL
       ORDER BY parcela_numero`, [empresaId, propostaFake])).rows;
    ok('query de listarParcelasProposta devolve 3', lidas.length === 3);
    ok('soma gravada = total',    lidas.reduce((s, r) => s + cent(r.valor_previsto), 0) === cent(valorTotal));
    ok('coluna serviço gravada fecha',
       lidas.reduce((s, r) => s + cent(r.valor_servico), 0) === Math.round(cent(valorTotal) * pct));

    const agBanco = F.agregarContasEmConta(lidas);
    ok('agregado sobre linhas reais = total', cent(agBanco.valor_previsto) === cent(valorTotal));
    ok('agregado preserva o grupo',           agBanco.grupo_parcelamento_id === grupo);

    const dre = (await client.query(`
      SELECT COALESCE(SUM(valor_previsto),0)::numeric soma FROM financeiro_contas_receber
       WHERE empresa_id=$1 AND proposta_app_id=$2 AND status <> 'cancelado'`, [empresaId, propostaFake])).rows[0];
    ok('DRE conta o total uma única vez (sem duplicidade)', cent(dre.soma) === cent(valorTotal));

    await client.query(`
      INSERT INTO financeiro_notas_fiscais
        (empresa_id, conta_receber_id, numero_nf, tipo_nf, data_emissao, valor_nf, status)
      VALUES ($1,$2,'TESTE-RB','servico','2026-09-30',$3,'emitida')`,
      [empresaId, lidas[0].id, lidas[0].valor_previsto]);
    const comNF = (await client.query(`
      SELECT COUNT(*)::int n FROM financeiro_notas_fiscais
       WHERE conta_receber_id = ANY($1::uuid[]) AND status <> 'cancelada'`, [lidas.map(r => r.id)])).rows[0].n;
    ok('parcela faturada é detectada (bloqueia regerar)', comNF === 1);
  } finally {
    await client.query('ROLLBACK');
  }

  const depois = (await client.query('SELECT COUNT(*)::int n FROM financeiro_contas_receber')).rows[0].n;
  const residuo = (await client.query(
    'SELECT COUNT(*)::int n FROM financeiro_contas_receber WHERE grupo_parcelamento_id=$1', [grupo])).rows[0].n;
  ok('ROLLBACK não deixou resíduo',        residuo === 0);
  ok(`tabela inalterada (${antes} linhas)`, depois === antes, String(depois));

  await client.end();
  finalizar();
})().catch(e => { console.error('\n❌ ERRO NA ETAPA DE BANCO:', e.message); process.exit(1); });

function finalizar() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  if (falhas === 0) {
    console.log(`║  ✅ ${String(total).padEnd(5)} verificações — TODAS PASSARAM` + ' '.repeat(21) + '║');
  } else {
    console.log(`║  ❌ ${falhas} de ${total} verificações FALHARAM` + ' '.repeat(28) + '║');
  }
  console.log('╚════════════════════════════════════════════════════════════╝');
  process.exit(falhas === 0 ? 0 : 1);
}

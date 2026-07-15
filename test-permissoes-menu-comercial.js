// ============================================================
// test-permissoes-menu-comercial.js
// Teste de regressão: menu do Comercial deve respeitar as
// permissões individuais (usuario_empresas.permissoes_modulos)
// no ESTADO FINAL do DOM, não só logo após Router.ir().
//
// Contexto do bug: renderMenuComercialOrganizado() (index.html) e
// _renderSbProps (js/core/app-core.js) escrevem em #sidebar-nav-mod
// SEM checagem de permissão, via setTimeout(0) disparado pelos
// listeners 'router:change'/'DOMContentLoaded' — rodando DEPOIS de
// Router._renderNavMod já ter pintado o menu corretamente filtrado,
// sobrescrevendo-o. Um item com permissão individual revogada
// (ex.: pipeline.ver=false) sumia por um instante e REAPARECIA.
//
// Por isso este teste passa pelo fluxo REAL — Router.ir() + o
// event loop completo — em vez de chamar Router._renderNavMod()
// isoladamente (é exatamente esse atalho que deixou o bug passar
// despabercebido nos testes das Etapas 2 e 3).
//
// Requer: playwright-core (`npm install --no-save playwright-core`
// se ainda não estiver em node_modules) + um Chromium acessível.
// Rodar: node test-permissoes-menu-comercial.js
// ============================================================
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = __dirname;
const CHROME = process.env.CHROME
  || execSync("find /opt/pw-browsers/chromium* -name chrome -type f 2>/dev/null | head -1").toString().trim();

const seed = fs.readFileSync(path.join(REPO, 'supabase/seeds/seed_permissoes_modulos.sql'), 'utf8');
function pmDe(prefixo) {
  const re = new RegExp("SET permissoes_modulos = '(\\{[^']+\\})'::jsonb\\s*\\nFROM usuarios u\\s*\\nWHERE u\\.id = ue\\.usuario_id\\s*\\n  AND u\\.id::text LIKE '" + prefixo + "%'");
  return JSON.parse(seed.match(re)[1]);
}

const ADRIANO_REAL = pmDe('aa547e5f');
const ADRIANO_PIPELINE_FALSE = JSON.parse(JSON.stringify(ADRIANO_REAL));
ADRIANO_PIPELINE_FALSE.pipeline.ver = false; // repro exata do bug reportado

const USERS = [
  { nome: 'Elivandro (dono)',          perfil: 'dono',        pm: pmDe('8a96ef3a') },
  { nome: 'Adriano (seed original)',   perfil: 'gestor',      pm: ADRIANO_REAL },
  { nome: 'Adriano (pipeline=false)',  perfil: 'gestor',      pm: ADRIANO_PIPELINE_FALSE },
  { nome: 'Raphael',                   perfil: 'colaborador', pm: pmDe('4268cef6') },
  { nome: 'Claudineiz',                perfil: 'colaborador', pm: pmDe('7ad1228d') },
  { nome: 'Ernesto',                   perfil: 'colaborador', pm: pmDe('2e3fbeb7') },
  { nome: 'Elivandro Tecfusion',       perfil: 'colaborador', pm: pmDe('517dd1a0') }
];

const SUBSECOES_COMERCIAL = ['propostas', 'pipeline', 'banco_escopos', 'metas', 'analise_ia', 'ranking_clientes'];
const LABEL_DE = { propostas:'Propostas', pipeline:'Pipeline', banco_escopos:'Banco de Escopos', metas:'Metas', analise_ia:'Análise IA', ranking_clientes:'Ranking' };
// Itens do renderMenuComercialOrganizado SEM subKey — devem continuar
// visíveis sempre (guarda contra a correção ter gateado item errado).
const ITENS_SEM_GATE = ['Motor de Decisão', 'Por Fase', 'Análise por Categoria', 'KPIs de Ciclos'];

let fails = 0;
function T(nome, cond) { if (cond) console.log('  ✅ ' + nome); else { console.log('  ❌ ' + nome); fails++; } }

async function testarUsuario(browser, u) {
  const page = await browser.newPage();
  await page.goto('file://' + path.join(REPO, 'index.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const r = await page.evaluate(async ({ u, subs, itensSemGate }) => {
    window._userEmail = 'x@teste.com';
    window._perfilUsuario = u.perfil;
    window._perfilGlobal = u.perfil;
    window._empresaAtiva = { id: 'e1', nome: 'Empresa', nome_curto: 'ET', permissoes_modulos: u.pm };
    window._empresasUsuario = [window._empresaAtiva];

    const podeComercial = window.podeAcessarModulo('comercial');
    const podeGestao = window.podeAcessarModulo('gestao');

    // ── Fluxo REAL: Router.ir() -> dispatchEvent('router:change') ->
    // listener de index.html -> setTimeout(renderMenuComercialOrganizado,0).
    // NÃO chama _renderNavMod diretamente.
    document.getElementById('sidebar-nav-mod').innerHTML = '__SENTINELA__';
    window.Router.ir('comercial');
    const ativouComercial = window.Router.getAtivo() === 'comercial';
    await new Promise(res => setTimeout(res, 80)); // espera o setTimeout(0) da fila
    const navFinal = document.getElementById('sidebar-nav-mod').innerHTML;

    const subsFinal = {};
    subs.forEach(s => { subsFinal[s] = navFinal.indexOf(({propostas:'Propostas',pipeline:'Pipeline',banco_escopos:'Banco de Escopos',metas:'Metas',analise_ia:'Análise IA',ranking_clientes:'Ranking'})[s]) >= 0; });
    const semGatePresentes = {};
    itensSemGate.forEach(label => { semGatePresentes[label] = navFinal.indexOf(label) >= 0; });

    // ── Controle: Gestão CEO / Visão Executiva (não deve ser afetado) ──
    document.getElementById('sidebar-nav-mod').innerHTML = '__SENTINELA__';
    window.Router.ir('gestao');
    const ativouGestao = window.Router.getAtivo() === 'gestao';
    await new Promise(res => setTimeout(res, 80));
    const navGestaoFinal = document.getElementById('sidebar-nav-mod').innerHTML;
    const visaoExecFinal = navGestaoFinal.indexOf('Visão Executiva') >= 0;

    return {
      podeComercial, podeGestao, ativouComercial, ativouGestao,
      subsFinal, semGatePresentes, visaoExecFinal,
      navFinalEraSentinela: navFinal === '__SENTINELA__'
    };
  }, { u: { perfil: u.perfil, pm: u.pm }, subs: SUBSECOES_COMERCIAL, itensSemGate: ITENS_SEM_GATE });

  await page.close();
  return { usuario: u.nome, pm: u.pm, ...r };
}

async function testarRenderSbPropsGate(browser) {
  // _renderSbProps não tem chamador ativo hoje, mas testamos o gate
  // diretamente para não reabrir a mesma brecha se algo passar a chamá-la.
  const page = await browser.newPage();
  await page.goto('file://' + path.join(REPO, 'index.html'), { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const r = await page.evaluate(async (ADRIANO_PIPELINE_FALSE) => {
    var pmNegado = JSON.parse(JSON.stringify(ADRIANO_PIPELINE_FALSE));
    pmNegado.propostas.ver = false;
    window._perfilUsuario = 'gestor';
    window._empresaAtiva = { id: 'e1', permissoes_modulos: pmNegado };
    window.props = [{ id: '1', num: 'P-001', fas: 'ganho' }];

    document.getElementById('sidebar-nav-mod').innerHTML = '';
    window._renderSbProps();
    const htmlNegado = document.getElementById('sidebar-nav-mod').innerHTML;

    var pmPermitido = JSON.parse(JSON.stringify(ADRIANO_PIPELINE_FALSE));
    pmPermitido.propostas.ver = true;
    window._empresaAtiva = { id: 'e1', permissoes_modulos: pmPermitido };
    document.getElementById('sidebar-nav-mod').innerHTML = '';
    window._renderSbProps();
    const htmlPermitido = document.getElementById('sidebar-nav-mod').innerHTML;

    return {
      negadoMostraLista: htmlNegado.indexOf('P-001') >= 0,
      negadoMostraAviso: htmlNegado.indexOf('Sem acesso') >= 0,
      permitidoMostraLista: htmlPermitido.indexOf('P-001') >= 0
    };
  }, ADRIANO_PIPELINE_FALSE);

  await page.close();
  return r;
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  console.log('\n═══ Menu do Comercial — fluxo completo (Router.ir + router:change + setTimeout) ═══\n');
  for (const u of USERS) {
    const row = await testarUsuario(browser, u);
    console.log(`### ${row.usuario}`);
    if (!row.podeComercial) {
      T('sem acesso ao módulo Comercial: ir() bloqueado, DOM intocado', row.ativouComercial === false && row.navFinalEraSentinela === true);
    } else {
      T('ir(\'comercial\') ativa o módulo', row.ativouComercial === true);
      SUBSECOES_COMERCIAL.forEach(function (s) {
        const esperado = row.pm[s].ver === true;
        T(s + ': esperado=' + esperado + ', DOM final=' + row.subsFinal[s], row.subsFinal[s] === esperado);
      });
      ITENS_SEM_GATE.forEach(function (label) {
        T('"' + label + '" (sem subKey) continua visível — não regrediu', row.semGatePresentes[label] === true);
      });
    }
    if (row.podeGestao) {
      const esperadoVE = row.pm.visao_executiva && row.pm.visao_executiva.ver === true;
      T('[controle] Gestão CEO/Visão Executiva não afetado pelo fix do Comercial', row.visaoExecFinal === esperadoVE);
    }
    console.log('');
  }

  console.log('═══ _renderSbProps — gate defensivo (código sem chamador ativo hoje) ═══\n');
  const sb = await testarRenderSbPropsGate(browser);
  T('propostas.ver=false: NÃO lista propostas', sb.negadoMostraLista === false);
  T('propostas.ver=false: mostra aviso de acesso negado', sb.negadoMostraAviso === true);
  T('propostas.ver=true: lista propostas normalmente', sb.permitidoMostraLista === true);

  await browser.close();

  console.log('\n' + (fails === 0 ? '✅ TODOS OS TESTES DE REGRESSÃO PASSARAM' : '❌ ' + fails + ' FALHA(S)'));
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });

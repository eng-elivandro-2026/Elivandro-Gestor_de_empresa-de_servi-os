// REGRESSÃO DO INCIDENTE 480A.26 — cenário EXATO: digitar em bloco de texto
// existente → FECHAR A ABA em <1,5s → o texto tem que chegar ao Supabase
// (interceptação de REDE real, não só localStorage).
// O unload cancela fetch normal; o envio keepalive (_cloudFlushUnload) sobrevive.
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = __dirname;
const CHROME = execSync("find /opt/pw-browsers/chromium* -name chrome -type f 2>/dev/null | head -1").toString().trim();

let fails = 0;
function T(n, c) { console.log((c ? '  ✅ ' : '  ❌ ') + n); if (!c) fails++; }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };

(async () => {
  // Servidor HTTP real servindo o repo (mesma origem para o fetch keepalive — sem CORS)
  const server = http.createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    const fp = path.join(REPO, urlPath === '/' ? 'index.html' : urlPath);
    if (fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise(rs => server.listen(0, '127.0.0.1', rs));
  const PORT = server.address().port;
  const ORIGIN = 'http://127.0.0.1:' + PORT;

  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const context = await browser.newContext();

  // Interceptação NO LADO DO NODE: sobrevive à navegação/fechamento da página.
  const upsertsRede = [];
  await context.route('**/rest/v1/propostas*', async (route) => {
    const req = route.request();
    upsertsRede.push({
      method: req.method(),
      body: req.postData() || '',
      apikey: req.headers()['apikey'] || '',
      auth: req.headers()['authorization'] || ''
    });
    await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });

  const page = await context.newPage();
  page.on('dialog', d => d.accept().catch(() => {}));

  const PROP = {
    id: 'p480', num: '480A.26', cli: 'Cliente Real', tit: 'Bomba de Vácuo',
    fas: 'em_elaboracao', val: 50000, dat: '01/07/2026', dat2: '2026-07-01',
    tsSaved: Date.now() - 3600000,
    dim_html: '', dim_blocos: [{ kind: 'text', title: 'DIMENSIONAMENTO CABOS - BOMBA DE VÁCUO 02 - 15KW', html: '<p>TEXTO ORIGINAL</p>' }],
    esc: [], bi: [], revs: [], tl: { nfs: [], adiantamentos: [] }
  };
  await page.addInitScript((prop) => {
    localStorage.setItem('tf_props', JSON.stringify([prop]));
    localStorage.setItem('tf_empresa_ativa', JSON.stringify({ id: 'emp-1', nome: 'Fortex' }));
    // Stub ANTES do supabase.js: getSession alimenta o cache do token do keepalive
    window.sbClient = {
      from: () => {
        const q = {};
        q.select = () => q; q.eq = () => q; q.order = () => q; q.in = () => q;
        q.insert = () => q; q.update = () => q; q.upsert = () => q;
        q.maybeSingle = async () => ({ data: null, error: null });
        q.then = (res, rej) => Promise.resolve({ data: [], error: null }).then(res, rej);
        q.catch = () => q;
        return q;
      },
      auth: {
        getUser: async () => ({ data: { user: { id: 'u1' } } }),
        getSession: async () => ({ data: { session: { access_token: 'tok-cacheado-boot' } } })
      }
    };
  }, PROP);

  await page.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  // ── Prepara o cenário e digita (fluxo real: editor → Etapa 2 → bloco existente) ──
  const antes = await page.evaluate(async (origin) => {
    const sleep = (ms) => new Promise(rs => setTimeout(rs, ms));
    window._empresaAtiva = { id: 'emp-1', nome: 'Fortex' };
    window.getEmpresaAtivaId = () => 'emp-1';
    window.SB_URL = origin;                 // keepalive aponta para o servidor do teste
    editP('p480');
    await sleep(400);
    step(2); dimExpandAll();
    await sleep(100);
    const ed = document.getElementById('dimBlocks').querySelector('.dim-text-ed');
    ed.innerHTML += '<p>TEXTO FECHAMENTO ABA</p>';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);                       // MUITO antes do debounce de 1500ms
    return {
      tokCacheado: window._cloudTok || null,
      timerLocalPendente: !!window.autoDraftTimer
    };
  }, ORIGIN);

  // ── FECHA A ABA (navegação para fora = unload real; fetch normal é abortado) ──
  await page.goto('about:blank');
  await page.waitForTimeout(600);           // tempo para o keepalive chegar ao servidor

  console.log('Requisições de upsert interceptadas na rede:', upsertsRede.length);

  T('token do keepalive foi cacheado no boot (getSession)', antes.tokCacheado === 'tok-cacheado-boot');
  T('cenário real: debounce local ainda pendente ao fechar (<1,5s)', antes.timerLocalPendente === true);
  T('pelo menos 1 upsert chegou à REDE após fechar a aba', upsertsRede.length >= 1);
  const comTexto = upsertsRede.find(u => u.body.indexOf('TEXTO FECHAMENTO ABA') >= 0);
  T('o upsert contém o TEXTO digitado (chegou ao "Supabase", não só ao LS)', !!comTexto);
  T('upsert com apikey + Authorization Bearer do token cacheado',
    !!comTexto && comTexto.apikey.length > 0 && comTexto.auth === 'Bearer tok-cacheado-boot');
  T('payload é a linha completa da proposta (app_id 480A.26)',
    !!comTexto && comTexto.body.indexOf('"app_id":"p480"') >= 0 && comTexto.body.indexOf('480A.26') >= 0);

  // ── BÔNUS: flush no caminho "+ Nova proposta" (buraco pré-existente) ──
  const page2 = await context.newPage();
  page2.on('dialog', d => d.accept().catch(() => {}));
  await page2.addInitScript((prop) => {
    localStorage.setItem('tf_props', JSON.stringify([prop]));
    localStorage.setItem('tf_empresa_ativa', JSON.stringify({ id: 'emp-1', nome: 'Fortex' }));
    window.sbClient = {
      from: () => { const q = {}; q.select=()=>q; q.eq=()=>q; q.order=()=>q; q.in=()=>q; q.insert=()=>q; q.update=()=>q; q.upsert=()=>q; q.maybeSingle=async()=>({data:null,error:null}); q.then=(res,rej)=>Promise.resolve({data:[],error:null}).then(res,rej); q.catch=()=>q; return q; },
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }), getSession: async () => ({ data: { session: { access_token: 't' } } }) }
    };
  }, PROP);
  await page2.goto(ORIGIN + '/index.html', { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(700);
  const rNova = await page2.evaluate(async () => {
    const sleep = (ms) => new Promise(rs => setTimeout(rs, ms));
    window._empresaAtiva = { id: 'emp-1', nome: 'Fortex' };
    window.getEmpresaAtivaId = () => 'emp-1';
    editP('p480'); await sleep(400);
    step(2); dimExpandAll(); await sleep(100);
    const ed = document.getElementById('dimBlocks').querySelector('.dim-text-ed');
    ed.innerHTML += '<p>TEXTO ANTES DA NOVA</p>';
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(300);                       // debounce ainda pendente
    novaPropostaCompleta();                 // reset do form — flush tem que salvar antes
    await sleep(300);
    const p = props.find(x => x.id === 'p480');
    const ls = (JSON.parse(localStorage.getItem('tf_props') || '[]')).find(x => x.id === 'p480');
    const html = ((p && p.dim_blocos && p.dim_blocos[0]) || {}).html || '';
    const htmlLs = ((ls && ls.dim_blocos && ls.dim_blocos[0]) || {}).html || '';
    return { props: html.indexOf('TEXTO ANTES DA NOVA') >= 0, ls: htmlLs.indexOf('TEXTO ANTES DA NOVA') >= 0 };
  });
  T('"+ Nova proposta" com edição pendente → texto salvo em props', rNova.props === true);
  T('"+ Nova proposta" com edição pendente → texto salvo no localStorage', rNova.ls === true);

  await browser.close();
  server.close();

  console.log('\n' + (fails === 0 ? '✅ REGRESSÃO DO INCIDENTE COBERTA — texto sobrevive ao fechamento da aba' : '❌ ' + fails + ' FALHA(S)'));
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error('ERRO FATAL:', e); process.exit(1); });

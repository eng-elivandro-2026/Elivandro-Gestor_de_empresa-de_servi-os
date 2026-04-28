// app-core.js — Sistema de Propostas V473_OFICIAL
// Extraído do monolítico PROPOSTA_V473_OFICIAL.html
// ============================================================


// ══ BLOCO 1 ══
var LETTERHEAD_B64 = "";
var Q=function(i){return document.getElementById(i)};
var _toastT=null;
function toast(msg,type){
  var t=Q('toast');t.textContent=msg;t.className='show '+(type||'ok');
  clearTimeout(_toastT);_toastT=setTimeout(function(){t.className='';},2200);
}
var esc=function(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')};
var n2=function(v){return isFinite(+v)?+v:0};
var uid=function(){return Math.random().toString(36).slice(2,10)+Date.now().toString(36)};
var money=function(v){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0)};
var fmtBRL=money;

// ── Navegação do Dashboard — rola e expande o painel (com accordeon) ──
var _DASH_PANELS = [
  { card: 'motorDecisaoCard',  body: 'motorDecisaoBody',   tog: 'togMotorDecisao' },
  { card: 'ceoDashCard',       body: 'ceoDashBody',        tog: 'togCeoDash' },
  { card: 'propostasCard',     body: 'propostasBody',      tog: 'togPropostas' },
  { card: 'porFaseCard',       body: 'porFaseBody',        tog: 'togPorFase' },
  { card: 'metaPanel',         body: 'metaBody',           tog: 'togMeta' },
  { card: 'visaoGeralCard',    body: 'visaoGeralBody',     tog: 'togVisaoGeral' },
  { card: 'analisePanel',      body: 'analiseBody',        tog: 'togAnalise' },
  { card: 'rankingCard',       body: 'rankingBody',        tog: 'togRanking' },
  { card: 'catAnaliseCard',    body: 'catAnaliseBody',     tog: 'togCatAnalise' },
  { card: 'ciclosCard',        body: 'ciclosDashBody',     tog: 'togCiclosDash' },
  { card: 'execTimelineCard',  body: 'execTlBody',         tog: 'togExecTimeline' },
  { card: 'fechMesCard',       body: 'fechMesBody',        tog: 'togFechMes' },
];

window.irParaPainel = function(cardId, togFn) {
  if (typeof go === 'function') go('dashboard', null);
  setTimeout(function() {
    var card = document.getElementById(cardId);
    if (!card) return;
    // Recolher todos os outros painéis (accordeon)
    _DASH_PANELS.forEach(function(p) {
      if (p.card === cardId) return;
      var b = document.getElementById(p.body);
      if (!b) return;
      var hidden = b.style.display === 'none' || b.style.display === '';
      if (!hidden) {
        var fn = window[p.tog];
        if (typeof fn === 'function') fn();
      }
    });
    // Expandir o painel alvo se estiver recolhido
    var togFunc = window[togFn];
    if (typeof togFunc === 'function') {
      var body = card.querySelector('[style*="display: none"], [style*="display:none"]');
      if (body) togFunc();
    }
    setTimeout(function() {
      var areaInline = document.getElementById('area-inline');
      if (areaInline) {
        var cardTop = card.getBoundingClientRect().top + areaInline.scrollTop - areaInline.getBoundingClientRect().top - 10;
        areaInline.scrollTo({ top: cardTop, behavior: 'smooth' });
      } else {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  }, 60);
};

// ── Painel de Propostas no Sidebar ────────────────────────────
window._sbPropFlt = 'all';
window._sbPropQ   = '';

window.abrirPainelPropostas = function() {
  window._sbPropFlt = 'all';
  window._sbPropQ   = '';
  window._renderSbProps();
};

window._renderSbProps = function() {
  var nav = document.getElementById('sidebar-nav-mod');
  if (!nav) return;

  var fasesFiltro = [
    { k: 'all',               n: 'Todas' },
    { k: 'em_elaboracao',     n: 'Elaboração' },
    { k: 'enviada',           n: 'Enviada' },
    { k: 'cliente_analisando',n: 'Analisando' },
    { k: 'aprovado',          n: 'Aprovado' },
    { k: 'andamento',         n: 'Andamento' },
    { k: 'faturado',          n: 'Faturado' },
    { k: 'finalizado',        n: 'Finalizado' },
    { k: 'perdido',           n: 'Perdido' },
  ];

  var q   = (window._sbPropQ  || '').toLowerCase();
  var flt = window._sbPropFlt || 'all';

  var lista = (window.props || []).filter(function(p) {
    var matchQ = !q
      || (p.num||'').toLowerCase().indexOf(q) >= 0
      || (p.cli||'').toLowerCase().indexOf(q) >= 0
      || (p.tit||'').toLowerCase().indexOf(q) >= 0;
    var matchF = flt === 'all' || p.fas === flt;
    return matchQ && matchF;
  });

  lista = lista.slice().sort(function(a, b) {
    return (b.num||'').localeCompare(a.num||'', 'pt-BR', { numeric: true });
  });

  var html = '';

  // Campo de busca
  html += '<div style="padding:.5rem .4rem .25rem">'
    + '<input id="sbPropBusca" type="text" placeholder="Buscar..." '
    + 'style="width:100%;padding:.35rem .6rem;background:var(--bg3);border:1px solid var(--border);'
    + 'border-radius:5px;color:var(--text);font-size:.72rem;font-family:inherit;outline:none">'
    + '</div>';

  // Filtros de fase
  html += '<div id="sbFasesBtns" style="padding:.2rem .4rem;display:flex;flex-wrap:wrap;gap:3px;margin-bottom:.15rem">';
  fasesFiltro.forEach(function(f) {
    var ativo = f.k === flt;
    html += '<button data-fase="' + f.k + '" '
      + 'style="padding:.18rem .42rem;font-size:.61rem;font-family:inherit;cursor:pointer;border-radius:4px;'
      + 'border:1px solid var(--border);'
      + (ativo
          ? 'background:var(--accent);color:#000;font-weight:700;'
          : 'background:var(--bg3);color:var(--text2);')
      + '">' + f.n + '</button>';
  });
  html += '</div>';

  // Contador
  html += '<div style="font-size:.61rem;color:var(--text3);padding:.1rem .5rem .2rem">'
    + lista.length + ' proposta' + (lista.length !== 1 ? 's' : '') + '</div>';

  // Lista
  if (!lista.length) {
    html += '<div style="font-size:.72rem;color:var(--text3);padding:.5rem;font-style:italic">Nenhuma encontrada</div>';
  } else {
    lista.forEach(function(p) {
      var fase = (window.FASE && window.FASE[p.fas]) || {};
      var icon = fase.i || '📄';
      var cor = p.fas === 'aprovado' || p.fas === 'andamento' || p.fas === 'faturado' ? 'var(--green)'
              : (p.fas||'').indexOf('perdido') >= 0 ? 'var(--red)'
              : p.fas === 'em_elaboracao' ? 'var(--accent)'
              : 'var(--text2)';
      html += '<button data-pid="' + p.id + '" '
        + 'style="width:100%;text-align:left;padding:.35rem .5rem;border:none;background:transparent;'
        + 'cursor:pointer;border-radius:5px;font-family:inherit;display:block">'
        + '<div style="display:flex;align-items:center;gap:.35rem">'
        + '<span style="font-size:.75rem;flex-shrink:0">' + icon + '</span>'
        + '<div style="min-width:0;flex:1">'
        + '<div style="font-size:.71rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + (p.num||'S/N') + '</div>'
        + '<div style="font-size:.63rem;color:' + cor + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + (p.cli||p.loc||'Cliente') + '</div>'
        + '</div></div></button>';
    });
  }

  nav.innerHTML = html;

  // Bind: busca
  var inp = document.getElementById('sbPropBusca');
  if (inp) {
    inp.value = window._sbPropQ || '';
    inp.addEventListener('input', function() {
      window._sbPropQ = this.value;
      window._renderSbProps();
    });
    setTimeout(function() { inp.focus(); }, 80);
  }

  // Bind: filtros de fase
  var fasesDiv = document.getElementById('sbFasesBtns');
  if (fasesDiv) {
    fasesDiv.querySelectorAll('[data-fase]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        window._sbPropFlt = this.getAttribute('data-fase');
        window._renderSbProps();
      });
    });
  }

  // Bind: abrir proposta
  nav.querySelectorAll('[data-pid]').forEach(function(btn) {
    btn.addEventListener('mouseover', function() { this.style.background = 'var(--bg3)'; });
    btn.addEventListener('mouseout',  function() { this.style.background = 'transparent'; });
    btn.addEventListener('click', function() {
      var id = this.getAttribute('data-pid');
      if (typeof editP === 'function') editP(id);
    });
  });
};


var fmtNumBr=function(v){ return new Intl.NumberFormat('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:4}).format(n2(v)); };
var LS=function(k,v){if(v===undefined){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}}else{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

function applyTheme(t){
  document.body.classList.toggle('light',t==='light');
  // Propagar tema para o iframe do gestão
  try {
    var frame = document.getElementById('gestao-frame');
    if (frame && frame.contentWindow) {
      frame.contentWindow.postMessage({ type: 'SET_TEMA', tema: t }, '*');
    }
  } catch(e) {}
}
function getTheme(){return LS('tf_theme')||'dark'}
function toggleTheme(){var cur=getTheme(),nxt=cur==='light'?'dark':'light';LS('tf_theme',nxt);applyTheme(nxt)}
var ANO=new Date().getFullYear().toString().slice(-2);
var cnt=290;
var props=[];
var fltSt='all';
var editId=null;
var selTpl=[];tplTitles={};
var escSecs=[];
var budg=[];
var eTplId=null;
var eDB={titulos:[],subtitulos:[]};
var tplEdits={};var tplTitles={};
var revs=[];

// ── REVISÕES: campos gravados no snapshot e campos restaurados ao clonar ──────
var _SNAP_STORE=['val','vS','vM','vD','vDS','vDM','bi','esc','aliq','prc','fas','tit','res','gantt','tensVal','tensCmd','tens'];
var _SNAP_APPLY=['val','vS','vM','vD','vDS','vDM','bi','esc','aliq','prc','tensVal','tensCmd','tens'];
function _snapProp(p){
  var s={};
  _SNAP_STORE.forEach(function(k){ s[k]=p[k]!==undefined?JSON.parse(JSON.stringify(p[k])):null; });
  return s;
}
function _applySnapToProp(p,snap){
  if(!snap)return;
  _SNAP_APPLY.forEach(function(k){ if(snap[k]!==null&&snap[k]!==undefined) p[k]=JSON.parse(JSON.stringify(snap[k])); });
}

var FASE={
  em_elaboracao:{n:'Em Elaboração',c:'b-elab',i:'📝'},
  enviada:{n:'Enviada',c:'b-env',i:'📤'},
  cliente_analisando:{n:'Cliente Analisando',c:'b-neg',i:'🧐'},
  follow1:{n:'Follow 1',c:'b-neg',i:'🔄'},
  follow2:{n:'Follow 2',c:'b-neg',i:'🔄'},
  follow3:{n:'Follow 3',c:'b-neg',i:'🔄'},
  follow4:{n:'Follow 4',c:'b-neg',i:'🔄'},
  aprovado:{n:'Aprovado',c:'b-apr',i:'✅'},
  andamento:{n:'Em Andamento',c:'b-and',i:'🔧'},
  faturado:{n:'Faturado',c:'b-apr',i:'🧾'},
  recebido:{n:'Recebido',c:'b-fin',i:'💰'},
  em_pausa_falta_material:{n:'Em Pausa Falta Material',c:'b-pau',i:'⏸️'},
  em_pausa_aguardando_cliente:{n:'Em Pausa Ag. Cliente',c:'b-pau',i:'⏸️'},
  em_pausa_aguardando_terceiro:{n:'Em Pausa Ag. Terceiro',c:'b-pau',i:'⏸️'},
  taf:{n:'TAF',c:'b-and',i:'🧪'},
  sat:{n:'SAT',c:'b-and',i:'🛠️'},
  finalizado:{n:'Finalizado',c:'b-fin',i:'🏁'},
  atrasado:{n:'Atrasado',c:'b-atr',i:'⚠️'},
  virou_budget:{n:'Virou Budget',c:'b-atr',i:'📌'},
  perdido_valor_alto:{n:'Perdido Valor Alto',c:'b-per',i:'❌'},
  perdido_concorrente:{n:'Perdido Concorrente',c:'b-per',i:'❌'},
  perdido_cliente_decidiu_nao_fazer:{n:'Perdido Não Fazer',c:'b-per',i:'❌'},
  perdido_fazer_no_futuro:{n:'Perdido Futuro',c:'b-per',i:'⏳'},
  perdido:{n:'Perdido',c:'b-per',i:'❌'},
  cancelada:{n:'Cancelada',c:'b-per',i:'🚫'},
  virou_outra_proposta:{n:'Virou Outra Proposta',c:'b-per',i:'🔄'}
};
var PHASE_ORDER=[
  'em_elaboracao','enviada','cliente_analisando',
  'follow1','follow2','follow3','follow4',
  'aprovado','andamento','faturado','recebido',
  'em_pausa_falta_material','em_pausa_aguardando_cliente','em_pausa_aguardando_terceiro',
  'taf','sat','finalizado','atrasado',
  'virou_budget','perdido_valor_alto','perdido_concorrente',
  'perdido_cliente_decidiu_nao_fazer','perdido_fazer_no_futuro','perdido',
  'cancelada','virou_outra_proposta'
];
// Fases consideradas "fechadas" (proposta convertida em negócio)
// em_pausa_* = negócio ganho, execução temporariamente parada → conta no faturamento
// atrasado = aprovada mas com atraso na execução → ainda é um fechamento
var FAS_FECHADO=['aprovado','andamento','faturado','recebido','taf','sat','finalizado','atrasado',
  'em_pausa_falta_material','em_pausa_aguardando_cliente','em_pausa_aguardando_terceiro'];

var SEQ=[  {k:'ESCOPO_FORNECIMENTO',t:'ESCOPO DE FORNECIMENTO'},
  {k:'OBJETIVO',t:'OBJETIVO DO SERVIÇO'},
  {k:'OBRIG_CONTRATADA',t:'OBRIGAÇÕES DA CONTRATADA'},
  {k:'OBRIG_CONTRATANTE',t:'OBRIGAÇÕES DA CONTRATANTE'},
  {k:'EXCLUSOES',t:'EXCLUSÕES'},
  {k:'PRAZO',t:'PRAZO / CRONOGRAMA'},
  {k:'VALOR',t:'VALOR'},
  {k:'IMPOSTOS',t:'IMPOSTOS'},
  {k:'PAGAMENTO',t:'CONDIÇÕES DE PAGAMENTO'},
  {k:'VALIDADE',t:'VALIDADE DA PROPOSTA'},
  {k:'GARANTIA',t:'GARANTIA'},
  {k:'FORNECIMENTO',t:'CONDIÇÕES DE FORNECIMENTO'}
];

var DEFT=[
  {id:'obj',g:'OBJETIVO',titulo:'Objetivo do Serviço',desc:'',conteudo:'Este projeto tem como objetivo a execução dos serviços descritos nesta proposta, assegurando restabelecimento funcional com segurança e qualidade.\n\nTodos os trabalhos serão realizados por equipe técnica especializada, seguindo as normas vigentes.'},
  {id:'ot',g:'OBRIG_CONTRATADA',titulo:'Obrigações da TECFUSION',desc:'',conteudo:'• Fornecimento dos materiais e serviços especificados no escopo técnico\n• Fornecer toda a documentação legal e técnica da empresa (ART, certificações)\n• Hospedagem, alimentação, passagem e transporte local quando aplicável\n• Disponibilizar caixa de ferramentas e equipamentos de medição\n• Atender todas as normas de segurança do trabalho vigentes (NR-10, NR-12)\n• Treinamento básico de operação quando aplicável'},
  {id:'oc',g:'OBRIG_CONTRATANTE',titulo:'Obrigações do Cliente',desc:'',conteudo:'• Comunicar o início dos serviços com antecedência mínima de 15 dias úteis\n• Liberar o acesso da equipe nas datas programadas\n• Garantir a liberação da área de trabalho antes da chegada da equipe\n• Fornecer documentação técnica necessária\n• Disponibilizar infraestrutura básica (energia elétrica, acesso)\n• Indicar responsável técnico para acompanhamento'},
  {id:'gar',g:'GARANTIA',titulo:'Garantia',desc:'',conteudo:'A TECFUSION garante o serviço executado pelo prazo de 12 (doze) meses a partir da data de emissão do Termo de Aceite.\n\nCobre: defeitos de execução, falhas de componentes fornecidos e problemas decorrentes de instalação.\n\nNão cobre: danos por uso inadequado, modificações por terceiros, desgaste natural e falhas elétricas externas.'},
  {id:'seg',g:'ESCOPO_FORNECIMENTO',titulo:'Normas de Segurança',desc:'',conteudo:'Todos os serviços serão executados em conformidade com:\n• NR-10 – Segurança em Instalações e Serviços em Eletricidade\n• NR-12 – Segurança no Trabalho em Máquinas e Equipamentos\n• NBR 5410 – Instalações Elétricas de Baixa Tensão\n• NBR IEC 60204-1 – Segurança de máquinas'}
];

var DEFP={
  aliq:{nfS:0.15,nfM:0.15,rS:0.051,comS:0.05,comM:0.05,neg:0.05},
  s:{
    'AC-01':{n:'CLP e I/O',                              m:0.50, rMin:0.35, rMax:0.55, desc:'Planejamento e especificação de CPU e módulos; Instalação física do CLP; Parametrização e programação; Testes de entradas e saídas; Documentação técnica'},
    'AC-02':{n:'IHM',                                    m:0.50, rMin:0.30, rMax:0.50, desc:'Definição de arquitetura de supervisão; Desenvolvimento de telas operacionais; Comunicação com CLP; Testes de operação; Treinamento do operador'},
    'AC-03':{n:'Redes Industriais',                      m:0.50, rMin:0.40, rMax:0.60, desc:'Projeto da topologia de rede; Instalação de cabos, switches e dispositivos; Configuração de comunicação; Testes de integridade e desempenho; Certificação quando aplicável'},
    'AC-04':{n:'Relés e Módulos de Segurança',           m:0.55, rMin:0.45, rMax:0.65, desc:'Integração de dispositivos de segurança; Configuração de relés e controladores; Testes de falhas e intertravamentos; Validação funcional'},
    'AC-05':{n:'Retrofit de Automação',                  m:0.60, rMin:0.45, rMax:0.70, desc:'Atualização de sistemas antigos; Migração de lógica e hardware; Adequação a novas arquiteturas; Testes completos e partida assistida'},
    'AP-01':{n:'Inversores de Frequência',               m:0.40, rMin:0.30, rMax:0.50, desc:'Instalação elétrica; Parametrização do inversor; Ajuste conforme motor e processo; Testes e start-up'},
    'AP-02':{n:'Servoconversores CA',                    m:0.57, rMin:0.40, rMax:0.65, desc:'Instalação do drive e motor; Parametrização de eixos; Testes de movimento; Integração com CLP'},
    'AP-03':{n:'Servoconversores CC',                    m:0.57, rMin:0.45, rMax:0.70, desc:'Instalação e configuração; Ajustes de controle; Testes operacionais'},
    'AP-04':{n:'Conversores CC',                         m:0.57, rMin:0.40, rMax:0.65, desc:'Integração em sistemas especiais; Parametrização e testes'},
    'AP-05':{n:'UPS / No-Break',                         m:0.45, rMin:0.25, rMax:0.45, desc:'Instalação e configuração; Integração com cargas críticas; Testes de autonomia e comutação'},
    'ED-01':{n:'As-Built Elétrico',                      m:0.53, rMin:0.40, rMax:0.65, desc:'Atualização fiel do projeto executado'},
    'ED-02':{n:'Digitalização de Diagramas',             m:0.55, rMin:0.30, rMax:0.55, desc:'Conversão de projetos físicos para digital'},
    'ED-03':{n:'Atualização de Diagramas Existentes',    m:0.60, rMin:0.35, rMax:0.60, desc:'Revisão e correção de projetos'},
    'ED-04':{n:'Cross-Check Elétrico em Campo',          m:0.60, rMin:0.45, rMax:0.70, desc:'Conferência entre projeto e instalação'},
    'ED-05':{n:'Projeto Elétrico Novo',                  m:0.58, rMin:0.45, rMax:0.70, desc:'Desenvolvimento completo de engenharia elétrica'},
    'ED-06':{n:'Estrutura de Vendas',                      m:0.25, rMin:0.25, rMax:0.45, desc:'Visita Técnica; Elaboração de proposta; Reunião Comercial; Levantamento técnico; Cronograma'},
    'FD-01':{n:'Faturamento Direto / Adm. Compras',      m:0.08, rMin:0.05, rMax:0.10, desc:'Intermediação de compras; Gestão administrativa do processo de aquisição; Coordenação entre fornecedor e cliente; Taxa administrativa sobre valor faturado direto'},
    'HT-01':{n:'Hora Técnica',                           m:0.50, rMin:0.45, rMax:0.70, desc:'Atendimento técnico especializado sob demanda'},
    'HT-02':{n:'Mão de Obra Fixa',                       m:0.45, rMin:0.25, rMax:0.45, desc:'Alocação dedicada de profissionais'},
    'IE-01':{n:'Infraestrutura Elétrica Industrial',     m:0.35, rMin:0.20, rMax:0.35, desc:'Montagem de eletrocalhas, leitos e eletrodutos; Suportes e fixações; Organização conforme layout industrial'},
    'IE-02':{n:'Lançamento e Organização de Cabos',      m:0.35, rMin:0.20, rMax:0.35, desc:'Lançamento de cabos de potência e controle; Amarração, identificação e organização; Separação potência x comando'},
    'IE-03':{n:'Instalações Elétricas de Máquinas',      m:0.57, rMin:0.25, rMax:0.45, desc:'Alimentação elétrica de máquinas; Interligações entre painéis e campo; Testes elétricos'},
    'IE-04':{n:'Adequações Elétricas Industriais',       m:0.45, rMin:0.25, rMax:0.45, desc:'Correções de instalações existentes; Adequações normativas; Ajustes para novos equipamentos'},
    'MB-01':{n:'Mobilização e Logística de Execução',    m:0.08, rMin:0.08, rMax:0.12, desc:'Passagens, taxas de embarque, despacho, transporte, hospedagem, alimentação, veículo e gestão logística da viagem'},
    'MB-02':{n:'Locações Operacionais de Apoio',         m:0.08, rMin:0.08, rMax:0.12, desc:'Locação de veículos, andaimes, plataformas, ferramentas especiais, equipamentos de içamento, geradores, compressores'},
    'PE-01':{n:'Projeto + Fabricação + Montagem',        m:0.50, rMin:0.35, rMax:0.50, desc:'Levantamento técnico; Engenharia elétrica completa; Fabricação, montagem e fiação interna; Testes em bancada; Instalação em campo; Comissionamento'},
    'PE-02':{n:'Montagem (cliente fornece projeto)',     m:0.40, rMin:0.25, rMax:0.40, desc:'Análise do projeto fornecido; Montagem mecânica; Fiação interna; Identificação e acabamento; Testes elétricos e energização'},
    'PE-03':{n:'Retrofit de Painel',                     m:0.60, rMin:0.40, rMax:0.60, desc:'Diagnóstico do painel; Substituição de componentes obsoletos; Reorganização de layout; Adequações NR-10/NR-12; Testes e liberação'},
    'PE-04':{n:'Ampliação / Adequação de Painel',        m:0.55, rMin:0.35, rMax:0.55, desc:'Inclusão de novos circuitos; Adequação de capacidade; Expansão de automação ou segurança; Atualização de diagramas; Testes funcionais'},
    'PE-05':{n:'QCCM – Comando e Controle',              m:0.45, rMin:0.30, rMax:0.45, desc:'Painéis dedicados ao comando de máquinas; Integração de acionamentos, CLP, segurança e sensores; Intertravamentos; Testes operacionais'},
    'PE-06':{n:'QAUT – Automação Industrial',            m:0.55, rMin:0.35, rMax:0.55, desc:'Painéis de automação de processos; Integração CLP, IHM, redes industriais; Comunicação com sistemas existentes; Testes e validação'},
    'PE-07':{n:'QGD / QFL / QL / QTOM',                 m:0.35, rMin:0.20, rMax:0.35, desc:'Quadros de distribuição de força e iluminação; Proteção e seccionamento; Organização e balanceamento de cargas; Identificação conforme normas'},
    'SM-01':{n:'Apreciação de Risco NR-12',              m:0.50, rMin:0.50, rMax:0.75, desc:'Levantamento técnico da máquina; Identificação de perigos; Relatório de risco'},
    'SM-02':{n:'Adequação NR-12 – Proteções Físicas',    m:0.45, rMin:0.25, rMax:0.45, desc:'Adequação de proteções mecânicas; Integração com sistemas elétricos'},
    'SM-03':{n:'Adequação NR-12 – Sistemas Elétricos',   m:0.70, rMin:0.45, rMax:0.70, desc:'Implementação de circuitos de segurança; Relés, sensores e intertravamentos'},
    'SM-04':{n:'Integração de Dispositivos de Segurança',m:0.60, rMin:0.45, rMax:0.70, desc:'Cortinas, scanners, chaves; Testes funcionais'},
    'SM-05':{n:'Preparação para Laudo NR-12',            m:0.65, rMin:0.40, rMax:0.65, desc:'Ajustes finais; Apoio técnico para auditorias'},
    'TC-01':{n:'Testes Elétricos Industriais',           m:0.55, rMin:0.35, rMax:0.55, desc:'Continuidade, isolação e aterramento'},
    'TC-02':{n:'Start-up Elétrico de Máquinas',          m:0.60, rMin:0.45, rMax:0.70, desc:'Partida assistida; Ajustes iniciais'},
    'TC-03':{n:'Comissionamento Elétrico',               m:0.60, rMin:0.45, rMax:0.75, desc:'Validação completa do sistema; Entrega operacional'},
    'TC-04':{n:'Certificação / Testes de Redes',         m:0.60, rMin:0.50, rMax:0.80, desc:'Testes e certificação de redes industriais'},
    'TC-05':{n:'Testes de Aterramento e Continuidade',   m:0.50, rMin:0.30, rMax:0.50, desc:'Medições conforme norma'},
    'MOT-01':{n:'Mão de Obra de Mecânica',               m:0.20, rMin:0.15, rMax:0.25, desc:'Execução de serviços mecânicos em campo; Desmontagem e montagem de equipamentos industriais; Alinhamento, nivelamento e fixação de máquinas; Ajustes mecânicos e apoio em movimentação de equipamentos'},
    'MOT-02':{n:'Mão de Obra de Elétrica',               m:0.25, rMin:0.20, rMax:0.30, desc:'Execução de serviços elétricos industriais em campo; Desmontagem e montagem elétrica de máquinas; Identificação, etiquetagem e reconexão de cabos; Interligações elétricas entre equipamentos; Testes elétricos e suporte ao comissionamento'},
    'MOT-03':{n:'Mão de Obra Geral / Apoio',             m:0.15, rMin:0.10, rMax:0.20, desc:'Apoio operacional em atividades de campo; Auxílio em desmontagem, montagem e movimentação; Organização de materiais e área de trabalho; Suporte geral às equipes técnicas'},
    'VS-01':{n:'Verbas de Serviços e Miscelâneas',       m:0.30, rMin:0.20, rMax:0.40, desc:'Provisão para serviços não detalhados previamente; Cobertura de imprevistos operacionais; Custos adicionais de apoio técnico e ajustes de campo; Itens de suporte não especificados no escopo principal'},
    'MT-01':{n:'Movimentação e Transporte Especializado', m:0.12, rMin:0.08, rMax:0.15, desc:'Serviços de içamento e movimentação de cargas industriais; Utilização de munck, guindaste, empilhadeira; Remoção técnica de equipamentos; Carregamento e descarregamento com critérios de segurança'},
    'LG-02':{n:'Logística e Transporte Industrial',      m:0.10, rMin:0.08, rMax:0.12, desc:'Transporte rodoviário de máquinas e equipamentos; Planejamento logístico de coleta e entrega; Coordenação de rotas, prazos e condições; Seguro de carga; Gestão de fornecedores logísticos e fretes'}
  },
  m:{
    'ME-01':{n:'Infraestrutura Elétrica',          mk:0.20, rMin:0.15, rMax:0.20, desc:'Canaletas, trilho DIN, leitos, calhas, eletrodutos, suportes, ventiladores, fixações estruturais'},
    'ME-02':{n:'Cabos e Condutores Elétricos',     mk:0.25, rMin:0.18, rMax:0.25, desc:'Cabos de potência, comando, aterramento, flexíveis, cordoalhas, cabos de controle padrão'},
    'ME-03':{n:'Conectividade Elétrica',           mk:0.35, rMin:0.25, rMax:0.35, desc:'Bornes, blocos de passagem, conectores, porta-fusíveis, terminais, jumpers'},
    'ME-04':{n:'Proteção e Distribuição Elétrica', mk:0.28, rMin:0.20, rMax:0.28, desc:'Disjuntores DIN, caixa moldada, disjuntores motor, DPS, DR, barramentos, chaves seccionadoras'},
    'ME-05':{n:'Comando e Manobra',                mk:0.35, rMin:0.25, rMax:0.35, desc:'Contatores, relés auxiliares, temporizadores, botoeiras, sinalizadores, chaves seletoras'},
    'ME-06':{n:'Automação e Controle',             mk:0.45, rMin:0.30, rMax:0.45, desc:'CLPs, módulos I/O, IHMs, switches industriais, gateways, redes industriais, relés de interface'},
    'ME-07':{n:'Acionamentos e Potência',          mk:0.25, rMin:0.18, rMax:0.25, desc:'Inversores de frequência, soft-starters, servo-drives, drives CC, filtros RFI'},
    'ME-08':{n:'Segurança de Máquinas / NR-12',   mk:0.55, rMin:0.35, rMax:0.55, desc:'Relés de segurança, controladores, cortinas de luz, scanners, chaves, intertravamentos, botões de emergência'},
    'ME-09':{n:'Energia, Qualidade e Backup',      mk:0.40, rMin:0.25, rMax:0.40, desc:'Fontes 24Vcc, UPS, transformadores de comando, filtros de harmônicos, bancos de capacitores'},
    'ME-10':{n:'Cabos Especiais e Sob Medida',     mk:0.50, rMin:0.35, rMax:0.50, desc:'Cabos servo, encoder, blindados especiais, chicotes montados, cabos customizados'},
    'ME-11':{n:'Identificação e Sinalização',      mk:0.60, rMin:0.40, rMax:0.60, desc:'Tags, etiquetas, anilhas, sleeves, placas NR-10/NR-12, placas de advertência'},
    'ME-12':{n:'Consumíveis e Apoio Técnico',      mk:0.45, rMin:0.30, rMax:0.45, desc:'Fitas isolantes, sprays técnicos, discos de corte, brocas, abraçadeiras, miscelâneas'},
    'PN-01':{n:'Pneumática Commodity',             mk:0.12, rMin:0.08, rMax:0.12, desc:'Mangueiras comuns, conexões rápidas, engates, niples, cotovelos, tubos PU/PA'},
    'PN-02':{n:'Controle Pneumático',              mk:0.18, rMin:0.12, rMax:0.18, desc:'Válvulas direcionais, solenóides, reguladoras de fluxo, retenção, escape rápido'},
    'PN-03':{n:'Atuadores Pneumáticos',            mk:0.22, rMin:0.15, rMax:0.22, desc:'Cilindros ISO, compactos, atuadores rotativos, pinças pneumáticas'},
    'PN-04':{n:'Preparação e Qualidade do Ar',     mk:0.25, rMin:0.15, rMax:0.25, desc:'Filtros, reguladores, lubrificadores, conjuntos FRL, secadores, drenos automáticos'},
    'PN-05':{n:'Pneumática de Segurança',          mk:0.35, rMin:0.25, rMax:0.35, desc:'Válvulas de segurança, dupla redundância, com monitoramento, blocos de segurança'},
    'PN-06':{n:'Ilhas de Válvulas / Integrada',    mk:0.30, rMin:0.18, rMax:0.30, desc:'Ilhas de válvulas com comunicação, blocos pneumáticos inteligentes, conjuntos montados'},
    'PN-07':{n:'Pneumática Especial / Sob Medida', mk:0.35, rMin:0.20, rMax:0.35, desc:'Skids pneumáticos, blocos customizados, sistemas pneumáticos dedicados'},
    'PN-08':{n:'Suportes e Acessórios Pneumáticos',mk:0.20, rMin:0.12, rMax:0.20, desc:'Suportes de cilindro, sensores magnéticos, abraçadeiras específicas, guias e hastes'},
    'PN-09':{n:'Manutenção Pneumática',            mk:0.18, rMin:0.10, rMax:0.18, desc:'Kits de vedação, O-rings, lubrificantes específicos, filtros de reposição'},
    'VM-01':{n:'Verbas de Materiais e Miscelâneas', mk:0.28, rMin:0.20, rMax:0.35, desc:'Provisão para materiais não especificados previamente; Itens de consumo e pequenos materiais de montagem; Materiais auxiliares para ajustes e adequações em campo; Cobertura de variações e necessidades não previstas'}
  }
};

function getTpls(){
  var t=LS('tf_tpls');
  if(!t){saveTpls(JSON.parse(JSON.stringify(DEFT)));t=LS('tf_tpls');}
  return t||[];
}
function saveTpls(t){LS('tf_tpls',t)}
function getPrc(){
  var base=LS('tf_prc')||JSON.parse(JSON.stringify(DEFP));
  var custom=getDefpCustom();
  if(custom){
    if(!base.s) base.s={};
    if(!base.m) base.m={};
    if(custom.s) Object.keys(custom.s).forEach(function(k){ if(!base.s[k]) base.s[k]=custom.s[k]; });
    if(custom.m) Object.keys(custom.m).forEach(function(k){ if(!base.m[k]) base.m[k]=custom.m[k]; });
  }
  return base;
}
function loadAliqUI(){
  var cfg=getPrc();
  if(Q('aNFS'))  Q('aNFS').value = ((cfg.aliq.nfS ||0)*100).toFixed(2).replace(/\.00$/,'');
  if(Q('aNFM'))  Q('aNFM').value = ((cfg.aliq.nfM ||0)*100).toFixed(2).replace(/\.00$/,'');
  if(Q('aRS'))   Q('aRS').value  = ((cfg.aliq.rS  ||0)*100).toFixed(2).replace(/\.00$/,'');
  if(Q('aComS')) Q('aComS').value= ((cfg.aliq.comS||0)*100).toFixed(2).replace(/\.00$/,'');
  if(Q('aComM')) Q('aComM').value= ((cfg.aliq.comM||0)*100).toFixed(2).replace(/\.00$/,'');
  if(Q('aNeg'))  Q('aNeg').value = ((cfg.aliq.neg ||0)*100).toFixed(2).replace(/\.00$/,'');
}


function isPrazo(sec){if(sec&&sec.hasGantt)return true;var t=String(sec&&sec.titulo||'').trim().toUpperCase();return t==='PRAZO / CRONOGRAMA'||t==='PRAZO'||t==='CRONOGRAMA'||t==='PRAZO/CRONOGRAMA';}
function isValorSec(sec){
  return !!(sec && (sec.type==='valor' || String(sec.titulo||'').trim().toUpperCase()==='VALOR'));
}

function abrirAjuda(){ var m=Q('helpModal'); if(m) m.style.display='flex'; }
function fecharAjuda(){ var m=Q('helpModal'); if(m) m.style.display='none'; }
function abrirFormulas(){ var m=Q('formulasModal'); if(m) m.style.display='flex'; }
function fecharFormulas(){ var m=Q('formulasModal'); if(m) m.style.display='none'; }
var _fluxoAtual='fl-inicio';
var _FLUXO_SECOES={
  's-criacao':{titulo:'Criação',aberto:true},
  's-edicao':{titulo:'Edição',aberto:true},
  's-encer':{titulo:'Encerramento',aberto:true},
  's-rec':{titulo:'Recursos',aberto:true},
  's-backup':{titulo:'Backup & Dados',aberto:true}
};
var _FLUXO_TREE=[
  {id:'fl-inicio',icon:'🏠',titulo:'Início',secao:null},
  {id:'s-criacao',tipo:'secao'},
  {id:'fl-criar',icon:'✚',titulo:'Criar Nova Proposta',secao:'s-criacao'},
  {id:'s-edicao',tipo:'secao'},
  {id:'fl-editar',icon:'✏️',titulo:'Editar Proposta Existente',secao:'s-edicao'},
  {id:'fl-rev',icon:'📋',titulo:'Nova Revisão (Rev A→B→C)',secao:'s-edicao'},
  {id:'s-encer',tipo:'secao'},
  {id:'fl-virou',icon:'🔄',titulo:'Virou Outra Proposta',secao:'s-encer'},
  {id:'fl-cancelada',icon:'🚫',titulo:'Cancelada',secao:'s-encer'},
  {id:'s-rec',tipo:'secao'},
  {id:'fl-log',icon:'📓',titulo:'Uso do LOG',secao:'s-rec'},
  {id:'s-backup',tipo:'secao'},
  {id:'fl-backup',icon:'💾',titulo:'Backup & Restauração',secao:'s-backup'}
];
function abrirFluxo(){
  var m=Q('fluxoModal'); if(!m) return;
  m.style.display='flex';
  _fluxoRenderTree('');
  _fluxoNavTo(_fluxoAtual||'fl-inicio');
}
function fecharFluxo(){ var m=Q('fluxoModal'); if(m) m.style.display='none'; }

function abrirBackupModal(){
  var m=Q('backupModal'); if(!m) return;
  m.style.display='flex';
  // Contagens
  var nProps=(window.props||[]).length;
  var nTpls=(LS('tf_tpls')||[]).length;
  if(Q('bkNumPropostas')) Q('bkNumPropostas').textContent=nProps;
  if(Q('bkNumTemplates')) Q('bkNumTemplates').textContent=nTpls;
  // Status nuvem
  var nuvemOk=!!(window.sbClient && window._empresaAtiva);
  if(Q('bkNuvemIcon')) Q('bkNuvemIcon').textContent=nuvemOk?'✓':'✕';
  if(Q('bkNuvemIcon')) Q('bkNuvemIcon').style.color=nuvemOk?'#22c55e':'#f87171';
  if(Q('bkNuvemTxt')) Q('bkNuvemTxt').textContent=nuvemOk?'Nuvem: conectada e ativa':'Nuvem: não conectada (modo local)';
  // Último backup
  var ult=localStorage.getItem('tf_ultimo_backup');
  var el=Q('backupUltimoInfo');
  if(el) el.textContent=ult?('Último backup: '+new Date(ult).toLocaleString('pt-BR')):'Nenhum backup exportado neste dispositivo ainda';
}
function fecharBackupModal(){ var m=Q('backupModal'); if(m) m.style.display='none'; }
function _bkRegistrarExport(){ localStorage.setItem('tf_ultimo_backup', new Date().toISOString()); abrirBackupModal(); }
function _fluxoToggleSecao(sid){
  if(_FLUXO_SECOES[sid]) _FLUXO_SECOES[sid].aberto=!_FLUXO_SECOES[sid].aberto;
  var q=Q('fluxoBusca'); _fluxoRenderTree(q?q.value:'');
}
function _fluxoNavTo(id){
  _fluxoAtual=id;
  var all=[].slice.call(document.querySelectorAll('#fluxoConteudo [data-page]'));
  all.forEach(function(el){el.style.display='none';});
  var pg=document.querySelector('#fluxoConteudo [data-page="'+id+'"]');
  if(pg) pg.style.display='block';
  var item=_FLUXO_TREE.find(function(x){return x.id===id;});
  var h=Q('fluxoTitHeader');
  if(h&&item) h.textContent=(item.icon||'')+' '+item.titulo;
  var q=Q('fluxoBusca'); _fluxoRenderTree(q?q.value:'');
}
function _fluxoBuscar(q){
  var qn=(q||'').toLowerCase();
  _fluxoRenderTree(qn);
  if(!qn){ _fluxoNavTo(_fluxoAtual); return; }
  var firstMatch=null;
  _FLUXO_TREE.forEach(function(item){
    if(item.tipo==='secao') return;
    var titleOk=(item.titulo||'').toLowerCase().indexOf(qn)>=0;
    var el=document.querySelector('#fluxoConteudo [data-page="'+item.id+'"]');
    var contentOk=el&&el.textContent.toLowerCase().indexOf(qn)>=0;
    if((titleOk||contentOk)&&!firstMatch) firstMatch=item.id;
  });
  if(firstMatch&&firstMatch!==_fluxoAtual){
    var curEl=document.querySelector('#fluxoConteudo [data-page="'+_fluxoAtual+'"]');
    var curVisible=curEl&&curEl.style.display!=='none';
    var curMatch=curEl&&curEl.textContent.toLowerCase().indexOf(qn)>=0;
    if(!curMatch&&firstMatch) _fluxoNavTo(firstMatch);
  }
}
function _fluxoRenderTree(filtro){
  var arv=Q('fluxoArvore'); if(!arv) return;
  var q=(filtro||'').toLowerCase();
  var html='';
  var curSecao=null;
  _FLUXO_TREE.forEach(function(item){
    if(item.tipo==='secao'){
      curSecao=item.id;
      var sec=_FLUXO_SECOES[item.id]; if(!sec) return;
      if(q){
        var hasMatch=_FLUXO_TREE.some(function(x){
          if(x.secao!==item.id||x.tipo==='secao') return false;
          if((x.titulo||'').toLowerCase().indexOf(q)>=0) return true;
          var el=document.querySelector('#fluxoConteudo [data-page="'+x.id+'"]');
          return el&&el.textContent.toLowerCase().indexOf(q)>=0;
        });
        if(!hasMatch) return;
      }
      var rot=sec.aberto?'90deg':'0deg';
      html+='<div onclick="_fluxoToggleSecao(\''+item.id+'\')" style="display:flex;align-items:center;gap:5px;padding:.38rem .5rem;cursor:pointer;font-size:.67rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text3);margin-top:.25rem;border-radius:5px;user-select:none" onmouseover="this.style.background=\'var(--bg2)\'" onmouseout="this.style.background=\'transparent\'">'
        +'<span style="font-size:.6rem;display:inline-block;transform:rotate('+rot+');transition:.15s">▶</span>'+esc(sec.titulo)+'</div>';
      return;
    }
    if(q){
      var titleOk=(item.titulo||'').toLowerCase().indexOf(q)>=0;
      var el2=document.querySelector('#fluxoConteudo [data-page="'+item.id+'"]');
      if(!titleOk&&!(el2&&el2.textContent.toLowerCase().indexOf(q)>=0)) return;
    }
    var sec2=curSecao?_FLUXO_SECOES[curSecao]:null;
    if(sec2&&!sec2.aberto&&!q) return;
    var isAtivo=item.id===_fluxoAtual;
    var ind=item.secao?'.8rem':'.5rem';
    html+='<div onclick="_fluxoNavTo(\''+item.id+'\')" style="display:flex;align-items:center;gap:6px;padding:.3rem '+ind+';cursor:pointer;border-radius:5px;font-size:.78rem;font-weight:'+(isAtivo?'700':'400')+';color:'+(isAtivo?'var(--accent)':'var(--text2)')+';background:'+(isAtivo?'rgba(88,166,255,.1)':'transparent')+'" onmouseover="if(\''+item.id+'\'!==_fluxoAtual)this.style.background=\'var(--bg2)\'" onmouseout="if(\''+item.id+'\'!==_fluxoAtual)this.style.background=\'transparent\'">'
      +(item.icon?'<span>'+item.icon+'</span>':'')+'<span style="flex:1">'+esc(item.titulo)+'</span>'
      +(isAtivo?'<span style="width:3px;height:14px;background:var(--accent);border-radius:2px;flex-shrink:0"></span>':'')
      +'</div>';
  });
  arv.innerHTML=html;
}

var __syncValorTimer=null;
function refreshValorSecEscopo(){
  try{
    if(typeof cStep==='undefined' || cStep!==3) return;
    var root=Q('escList');
    if(!root) return;
    var cards=root.querySelectorAll('.es');
    cards.forEach(function(card, idx){
      var sec=escSecs[idx];
      if(!isValorSec(sec)) return;
      var old=card.querySelector('.pp-valor-editor');
      var fresh=valorSecEditorHTML();
      if(old) old.outerHTML=fresh;
      else card.insertAdjacentHTML('beforeend', fresh);
    });
  }catch(e){}
}
function syncValorDependentes(imediato){
  try{
    if(__syncValorTimer) clearTimeout(__syncValorTimer);
    var run=function(){
      try{
        if(typeof cStep!=='undefined' && cStep===3){
          refreshValorSecEscopo();
        }
      }catch(e){}
      try{
        var pv=Q('pvWrap');
        if(typeof genPrev==='function' && typeof cStep!=='undefined' && cStep===5 && pv){
          genPrev();
        }
      }catch(e){}
    };
    if(imediato){ run(); return; }
    __syncValorTimer=setTimeout(run, 180);
  }catch(e){}
}


function atualizarValorSecaoEscopo(){
  try{
    refreshValorSecEscopo();
    toast('Valores da seção VALOR atualizados com descontos atuais.','ok');
  }catch(e){
    console.error(e);
    toast('Não foi possível atualizar a seção VALOR.','err');
  }
}

function loadAll(){
  applyTheme(getTheme());
  // Restaurar alíquotas salvas no arquivo (se existir)
  if(window.__DEFP_ALIQ__){
    DEFP.aliq=window.__DEFP_ALIQ__;
    if(!LS('tf_prc')) LS('tf_prc', DEFP);
    else { var cfg=LS('tf_prc'); cfg.aliq=window.__DEFP_ALIQ__; LS('tf_prc',cfg); }
  }
  // Mesclar novas categorias do DEFP no tf_prc salvo
  // Respeita exclusões do usuário via tf_cats_excluidas
  (function(){
    var _cfg=LS('tf_prc');
    if(!_cfg){ LS('tf_prc', JSON.parse(JSON.stringify(DEFP))); return; }
    var _excl=LS('tf_cats_excluidas')||{s:{},m:{}};
    var _changed=false;
    if(!_cfg.s) _cfg.s={};
    if(!_cfg.m) _cfg.m={};
    Object.keys(DEFP.s).forEach(function(k){
      if(!_cfg.s[k]&&!_excl.s[k]){ _cfg.s[k]=JSON.parse(JSON.stringify(DEFP.s[k])); _changed=true; }
    });
    Object.keys(DEFP.m).forEach(function(k){
      if(!_cfg.m[k]&&!_excl.m[k]){ _cfg.m[k]=JSON.parse(JSON.stringify(DEFP.m[k])); _changed=true; }
    });
    if(_changed) LS('tf_prc',_cfg);
  })();
  // Migrate default texts into escTpl bank if empty
  if(!LS('tf_etpl')||!LS('tf_etpl').length){
    var seed=DEFT.map(function(t){return {id:t.id,titulo:t.titulo,desc:t.conteudo||'',conteudo:t.conteudo||'',subs:[]};});
    saveEscTpls(seed);
  }

  props=LS('tf_props')||[
    {id:'i1',num:'210.26',cli:'JDE',loc:'JDE Salvador',csvc:'Salvador - BA',cnpj:'',cid:'',ac:'',dep:'',mail:'',tel:'',tit:'Retrofitting Raumak 8',val:258000,dat:'13/01/2026',dat2:'',fas:'aprovado',res:'',ts:[],esc:[],bi:[]},
    {id:'i2',num:'200.26',cli:'JDE',loc:'JDE Jundiaí',csvc:'Jundiaí - SP',cnpj:'',cid:'',ac:'',dep:'',mail:'',tel:'',tit:'Projeto Elétrico Raumak 8',val:20000,dat:'06/01/2026',dat2:'',fas:'finalizado',res:'',ts:[],esc:[],bi:[]},
    {id:'i3',num:'190.25',cli:'JDE',loc:'JDE JDI',csvc:'Jundiaí - SP',cnpj:'',cid:'',ac:'',dep:'',mail:'',tel:'',tit:'Reforma Eletrônica Fabrima',val:442626.82,dat:'13/10/2025',dat2:'',fas:'andamento',res:'',ts:[],esc:[],bi:[]}
  ];
  // Normalizar esc[] de todos formatos anteriores ao carregar
  props=props.map(function(p){
    if(!Array.isArray(p.esc))p.esc=[];
    p.esc=p.esc.map(function(s){
      if(!s)return null;
      return {
        id:s.id||uid(), num:s.num||'',
        titulo:s.titulo||s.t||s.nome||'',
        desc:s.desc||s.c||s.conteudo||'',
        subs:Array.isArray(s.subs)?s.subs.map(function(sb){
          return {id:sb.id||uid(),num:sb.num||'',nome:sb.nome||sb.titulo||sb.t||'',desc:sb.desc||sb.c||sb.conteudo||''};
        }):[]
      };
    }).filter(Boolean);
    return p;
  });
  // ── V466: migrar propostas fechadas sem dtFech e/ou dat2 ──
  (function(){
    var hoje=new Date().toISOString().slice(0,10);
    var dirty=false;
    props.forEach(function(p){
      if(FAS_FECHADO.indexOf(p.fas)<0) return;
      // Garante dat2 a partir de dat DD/MM/YYYY
      if(!p.dat2 && p.dat){
        var ps=String(p.dat).split('/');
        if(ps.length===3 && ps[2].length===4){
          p.dat2=ps[2]+'-'+ps[1]+'-'+ps[0];
          dirty=true;
        }
      }
      // Se ainda não tem dtFech, usa dat2 como dtFech (melhor aproximação disponível)
      if(!p.dtFech){
        p.dtFech=p.dat2||hoje;
        dirty=true;
      }
    });
    if(dirty){ try{LS('tf_props',props);}catch(e){} }
  })();
  // ── Migrar para stages v1 se necessário ──────────────────
  if(typeof migrarTodasPropostas==='function'){
    var _stgMig=migrarTodasPropostas(props);
    if(_stgMig>0){ try{LS('tf_props',props);}catch(e){} }
  }
  // Forçar base em 290 se o salvo for maior que 290 ou não existir
  var cntSalvo=parseInt(LS('tf_cnt'),10);
  if(isFinite(cntSalvo)&&cntSalvo>0&&cntSalvo<=290){
    cnt=cntSalvo;
  } else {
    cnt=290;
  }
  if(props.some(function(p){return String((p&&p.num)||'').trim()===nN();})) cnt+=10;
  saveCnt();
  eDB=LS('tf_edb')||{titulos:[],subtitulos:[]};
}
function saveAll(){
  LS('tf_props',props);
  try{if(Q('registro')&&Q('registro').classList.contains('on'))rRegistro();}catch(e){}
  // Sync com Supabase — salva a proposta em edição ou todas se não houver editId
  if(typeof sbSalvarProposta === 'function' && props.length){
    var _pToSync = editId ? props.find(function(x){return x.id===editId;}) : null;
    if(_pToSync){
      sbSalvarProposta(_pToSync);
    } else {
      // Sem proposta ativa — sincroniza em lote via migração
      if(typeof sbMigrarLocal === 'function') sbMigrarLocal();
    }
  }
}
function saveEDB(){LS('tf_edb',eDB)}

// REVISÕES
function addRev(){
  revs.push({id:uid(),rev:String.fromCharCode(65+revs.length),dat:new Date().toLocaleDateString('pt-BR'),por:'EJN',desc:''});
  rRevs();
  setTimeout(function(){var rows=Q('revBody').querySelectorAll('tr');if(rows.length){rows[rows.length-1].querySelector('input[data-f="desc"]').focus();}},80);
}
function delRev(id){revs=revs.filter(function(r){return r.id!==id});rRevs();}
function updRev(el){
  var id=el.getAttribute('data-id'),f=el.getAttribute('data-f');
  var r=revs.find(function(x){return x.id===id});if(r)r[f]=el.value;
}
function rRevs(){
  var tb=Q('revBody');if(!tb)return;
  if(!revs.length){
    tb.innerHTML='<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:.7rem">Nenhuma revisão.</td></tr>';
    return;
  }
  var ativaLetter='';
  for(var i=revs.length-1;i>=0;i--){
    if(!revs[i].status||revs[i].status==='ativa'){ativaLetter=revs[i].rev;break;}
  }
  if(!ativaLetter&&revs.length) ativaLetter=revs[revs.length-1].rev;
  tb.innerHTML=revs.map(function(r){
    var isAtiva=r.rev===ativaLetter;
    var isUltimaAtiva=isAtiva&&revs.length>1;
    var hasSnap=!!r.snapshot;
    var stCell=isAtiva
      ?'<div style="display:flex;flex-direction:column;align-items:center;gap:.2rem">'
        +'<span style="font-size:.68rem;font-weight:600;background:rgba(88,166,255,.15);border:1px solid rgba(88,166,255,.35);color:#58a6ff;padding:.15rem .45rem;border-radius:4px;white-space:nowrap">Ativa</span>'
        +(isUltimaAtiva?'<button onclick="_desfazerUltimaRev(\''+editId+'\')" title="Desfazer esta revisão e reativar a anterior" style="font-size:.62rem;padding:.1rem .35rem;background:rgba(248,81,73,.12);border:1px solid rgba(248,81,73,.3);border-radius:4px;color:#f85149;cursor:pointer;white-space:nowrap">↩ Desfazer</button>':'')
      +'</div>'
      :'<div style="display:flex;flex-direction:column;align-items:center;gap:.2rem">'
        +'<span style="font-size:.68rem;background:var(--bg);border:1px solid var(--border);color:var(--text3);padding:.15rem .45rem;border-radius:4px;white-space:nowrap">Arquivada</span>'
        +(hasSnap?'<button onclick="_abrirVisualizacaoRev(\''+editId+'\',\''+r.id+'\')" style="font-size:.66rem;padding:.1rem .35rem;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--text2);cursor:pointer;white-space:nowrap">👁 Ver</button>':'')
      +'</div>';
    return '<tr>'
      +'<td><input value="'+esc(r.rev)+'" data-id="'+r.id+'" data-f="rev" oninput="updRev(this)" style="width:44px;padding:.25rem .3rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--accent);font-weight:700;font-family:inherit;font-size:.8rem;text-align:center"></td>'
      +'<td><input value="'+esc(r.dat)+'" data-id="'+r.id+'" data-f="dat" oninput="updRev(this)" style="width:95px;padding:.25rem .3rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:.8rem"></td>'
      +'<td><input value="'+esc(r.por)+'" data-id="'+r.id+'" data-f="por" oninput="updRev(this)" style="width:54px;padding:.25rem .3rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:.8rem;text-align:center"></td>'
      +'<td><input value="'+esc(r.desc)+'" data-id="'+r.id+'" data-f="desc" placeholder="Descrição da revisão…" oninput="updRev(this)" style="width:100%;padding:.25rem .3rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:.8rem"></td>'
      +'<td style="text-align:center;vertical-align:middle">'+stCell+'</td>'
      +'</tr>';
  }).join('');
}

function _abrirVisualizacaoRev(propId, revId){ _abrirVisualizacaoRevCompleta(propId, revId); }
function _novaRevDeVisualizacao(propId, baseRevId){
  var viz=document.getElementById('_modalVizRev');if(viz)viz.remove();
  _abrirModalNovaRev(propId, baseRevId);
}

// ── MODO LEITURA COMPLETO ─────────────────────────────────────────────────────
var _vizModeState=null;

function _limparVizMode(){
  if(!_vizModeState) return;
  var propId=_vizModeState.propId;
  var p=props.find(function(x){return x.id===propId;});
  if(p){
    _applySnapToProp(p,_vizModeState.backupSnap);
    p.revAtual=_vizModeState.backupRevAtual;
    p.num=_vizModeState.backupNum;
  }
  document.removeEventListener('mousedown',_vizModeClickHandler,true);
  var b=document.getElementById('_vizModeBanner');if(b)b.remove();
  var pr=document.getElementById('_vizModePrompt');if(pr)pr.remove();
  var sv=document.querySelector('.ab-save');
  if(sv){sv.style.opacity='';sv.style.pointerEvents='';}
  _vizModeState=null;
}

function _abrirVisualizacaoRevCompleta(propId, revId){
  // Cancelar timer de auto-save pendente e fazer flush antes de mudar o estado.
  // NÃO avança tsSaved — preserva o timestamp do último save real para que a
  // comparação de merge no reload sempre prefira o dado salvo pelo usuário.
  clearTimeout(autoDraftTimer);
  autoDraftTimer=null;
  if(editId===propId){
    var _fi=props.findIndex(function(x){return x.id===propId;});
    var _pFlush=_fi>=0?props[_fi]:null;
    if(_pFlush){
      _pFlush.esc=JSON.parse(JSON.stringify(escSecs));
      _pFlush.bi=JSON.parse(JSON.stringify(budg));
      _pFlush.revs=JSON.parse(JSON.stringify(revs));
    }
  }

  var p=props.find(function(x){return x.id===propId;});
  if(!p) return;
  var rev=(p.revs||[]).find(function(r){return r.id===revId;});
  if(!rev||!rev.snapshot){toast('Esta revisão não possui snapshot salvo.','err');return;}

  // Guarda estado ativo
  _vizModeState={
    propId:propId,
    revId:revId,
    backupSnap:_snapProp(p),
    backupRevAtual:p.revAtual||'',
    backupNum:p.num||''
  };

  // Aplica snapshot e abre editor
  _applySnapToProp(p,rev.snapshot);
  p.revAtual=rev.rev;
  editP(propId);
  go('nova',null);

  setTimeout(function(){
    step(1);
    try{rBudg();updBT();updKpi();}catch(e){}
  },160);

  setTimeout(function(){_setupVizModeUI(rev);},320);
}

function _setupVizModeUI(rev){
  var ex=document.getElementById('_vizModeBanner');if(ex)ex.remove();
  var novaEl=document.getElementById('nova');if(!novaEl) return;
  var banner=document.createElement('div');
  banner.id='_vizModeBanner';
  banner.style.cssText='background:rgba(240,165,0,.1);border-bottom:2px solid rgba(240,165,0,.4);padding:.55rem 1.2rem;display:flex;align-items:center;gap:.65rem;flex-wrap:wrap;position:sticky;top:0;z-index:200';
  banner.innerHTML=
    '<span style="font-size:.95rem">👁</span>'
    +'<div style="flex:1;min-width:0">'
      +'<span style="font-size:.78rem;font-weight:700;color:var(--accent)">Modo Leitura — Rev. '+esc(rev.rev)+(rev.desc?' · '+esc(rev.desc.substring(0,40)):'')+' </span>'
      +'<span style="font-size:.72rem;color:var(--text3)">(Arquivada em '+esc(rev.dat||'')+')</span>'
    +'</div>'
    +'<button onclick="_fecharVisualizacaoRevCompleta()" style="padding:.3rem .7rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text2);cursor:pointer;font-size:.78rem;flex-shrink:0">✕ Fechar</button>'
    +'<button onclick="_novaRevDeVisualizacaoCompleta()" style="padding:.3rem .85rem;background:var(--blue);border:none;border-radius:5px;color:#fff;cursor:pointer;font-size:.78rem;font-weight:600;flex-shrink:0">+ Nova Revisão a partir desta</button>';
  novaEl.insertBefore(banner,novaEl.firstChild);
  // Oculta botão Salvar
  var sv=document.querySelector('.ab-save');
  if(sv){sv.style.opacity='.2';sv.style.pointerEvents='none';}
  // Ativa interceptor
  document.addEventListener('mousedown',_vizModeClickHandler,true);
  toast('👁 Rev. '+rev.rev+' em modo leitura. Clique em qualquer campo para criar nova revisão.','ok');
}

function _vizModeClickHandler(e){
  if(!_vizModeState) return;
  // Permite: banner, navegação dos steps, actionBar (exceto .ab-save)
  var tgt=e.target;
  if(tgt.closest){
    if(tgt.closest('#_vizModeBanner')) return;
    if(tgt.closest('.wz'))            return; // tabs dentro do form
    var inAB=tgt.closest('#actionBar');
    if(inAB&&!tgt.closest('.ab-save')) return;
    if(tgt.closest('#_vizModePrompt')) return;
  }
  // Intercepta inputs, selects, textareas, buttons e labels do formulário
  var tag=tgt.tagName.toLowerCase();
  if(['input','select','textarea','button','label'].indexOf(tag)<0) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  _showVizModePrompt();
}

function _showVizModePrompt(){
  if(document.getElementById('_vizModePrompt')) return;
  var el=document.createElement('div');
  el.id='_vizModePrompt';
  el.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center';
  el.innerHTML='<div onclick="event.stopPropagation()" style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:1.5rem 1.75rem;max-width:400px;width:92%;text-align:center">'
    +'<div style="font-size:1.5rem;margin-bottom:.5rem">📋</div>'
    +'<div style="font-size:.92rem;font-weight:700;color:var(--text);margin-bottom:.5rem">Revisão Arquivada</div>'
    +'<div style="font-size:.82rem;color:var(--text2);line-height:1.55;margin-bottom:1.25rem">Esta versão está em <strong>modo leitura</strong>.<br>Deseja criar uma nova revisão a partir dela?</div>'
    +'<div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap">'
      +'<button onclick="document.getElementById(\'_vizModePrompt\').remove()" style="padding:.4rem .9rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text2);cursor:pointer;font-size:.82rem">Não, continuar visualizando</button>'
      +'<button onclick="_novaRevDeVisualizacaoCompleta()" style="padding:.4rem 1rem;background:var(--blue);border:none;border-radius:5px;color:#fff;cursor:pointer;font-size:.82rem;font-weight:600">Sim, criar nova revisão</button>'
    +'</div>'
    +'</div>';
  el.addEventListener('click',function(e){if(e.target===el)el.remove();});
  document.body.appendChild(el);
}

function _fecharVisualizacaoRevCompleta(){
  var propId=_vizModeState&&_vizModeState.propId;
  _limparVizMode(); // restaura p.esc e outras props para o estado ativo correto
  if(propId){
    editP(propId);  // carrega p (restaurado) em escSecs + campos do form
    go('nova',null);
    // Persiste dados corretos em localStorage + Supabase com timestamp novo,
    // garantindo que o merge no reload sempre prefira esta versão restaurada.
    try{ upsertCurrentDraft(true); }catch(e){}
    setTimeout(function(){try{step(1);rBudg();updBT();updKpi();}catch(e){}},160);
    toast('Visualização encerrada — edição normal restaurada.','ok');
  }
}

function _novaRevDeVisualizacaoCompleta(){
  var state=_vizModeState;
  if(!state) return;
  var pr=document.getElementById('_vizModePrompt');if(pr)pr.remove();
  var propId=state.propId, revId=state.revId;
  _fecharVisualizacaoRevCompleta();
  setTimeout(function(){_abrirModalNovaRev(propId,revId);},420);
}

function _novaRevDeVisualizacao(propId, baseRevId){
  var viz=document.getElementById('_modalVizRev');if(viz)viz.remove();
  _abrirModalNovaRev(propId, baseRevId);
}


// ACTION BAR
function showActionBar(p){
  var bar=Q('actionBar');
  if(!bar){console.error('actionBar element not found');return;}
  var info=Q('abInfo');
  if(info) info.textContent='✏️ Editando: '+esc(p.num)+' — '+esc(p.cli)+(p.tit?' | '+esc(p.tit):'');
  bar.classList.add('visible');
}
function hideActionBar(){
  Q('actionBar').classList.remove('visible');
}
function saveCnt(){ LS('tf_cnt', cnt); }
function inferNextBase(){
  var anoAtual=String(ANO||'').replace(/\D/g,'').slice(-2);
  var maxBase=0;
  (props||[]).forEach(function(p){
    var num=String((p&&p.num)||'').trim();
    var m=num.match(/^(\d+)(?:\.(\d{2}))?$/);
    if(!m) return;
    var base=parseInt(m[1],10)||0;
    var anoNum=m[2]||'';
    if(anoNum && anoNum!==anoAtual) return;
    if(base>maxBase) maxBase=base;
  });
  var baseAtual=parseInt(cnt,10)||0;
  if(baseAtual>maxBase) maxBase=baseAtual;
  if(maxBase<10) maxBase=290;
  return maxBase+10;
}
function setNextProposalNumber(forceAdvance){
  if(forceAdvance || !cnt){
    cnt=inferNextBase();
  }
  Q('cBase').value=cnt;
  Q('pnD').textContent=nN();
  Q('pNum').value=nN();
  saveCnt();
}
function resetWizardState(){
  budg=[];
  escSecs=[];
  selTpl=[];
  tplEdits={};
  revs=[];
  eTplId=null;
  _tempGantt=null;
  try{ rBudg(); }catch(e){}
  try{ rEsc(); }catch(e){}
  try{ rRevs(); }catch(e){}
}
function resetProposalForm(){
  var hoje=new Date();
  var dataIso=new Date(hoje.getTime()-hoje.getTimezoneOffset()*60000).toISOString().slice(0,10);
  ['pCli','pCnpj','pCid','pAC','pDep','pMail','pTel','pAC2','pDep2','pMail2','pTel2','pLoc','pLocCnpj','pCsv','pTit','pArea','pEquip','pTensVal','pTensCmd'].forEach(function(id){var el=Q(id); if(el) el.value='';});
  ['pT1F','pT2F','pT3F','pTN','pTPE'].forEach(function(id){var el=Q(id); if(el) el.checked=false;});
  if(Q('pRes')) Q('pRes').value='';
  if(Q('pDat')) Q('pDat').value=dataIso;
  if(Q('pDatFech')) Q('pDatFech').value='';
  if(typeof tlCarregarDados==="function") tlCarregarDados({});
  if(Q('pRevAtual')) Q('pRevAtual').value='';
  if(Q('aNegZero')) Q('aNegZero').checked=false;
  if(Q('pFas')) Q('pFas').value='em_elaboracao';
  if(Q('vS')) Q('vS').value=0;
  if(Q('vM')) Q('vM').value=0;
  if(Q('vD')) Q('vD').value=0;
  if(Q('vDSval')) Q('vDSval').value='';
  if(Q('vDMval')) Q('vDMval').value='';
  if(Q('vDSpct')) Q('vDSpct').value='';
  if(Q('vDMpct')) Q('vDMpct').value='';
  try{ loadAliqUI(); }catch(e){}
  resetWizardState();
  cTot();
  updKpi();
  if(Q('escTplModal'))Q('escTplModal').style.display='none';
  setNextProposalNumber(true);
}
function newProposal(btn){
  editId=null;
  hideActionBar();
  resetProposalForm();
  go('nova',btn||null);
  step(1);
}
function cancelEdit(){
  if(confirm('Cancelar edição? Alterações não salvas serão perdidas.')){
    editId=null;
    hideActionBar();
    resetProposalForm();
    go('dashboard',null);
    rDash();
  }
}
function fecharProposta(){
  if(_vizModeState){ _limparVizMode(); }
  if(proposalFormHasMeaningfulData()){
    var num=(Q('pNum').value||'').trim(),cli=(Q('pCli').value||'').trim();
    if(!num||!cli){ alert('Preencha Nº e Cliente antes de fechar.'); return; }
    saveP(); // mesma validação e salvamento completo do botão Salvar
  }
  editId=null;
  hideActionBar();
  resetProposalForm();
  go('dashboard',null);
  rDash();
}

// ══════════════════════════════════════════════
// ANÁLISE INTELIGENTE
// ══════════════════════════════════════════════
function togAnalise(){
  var b=Q('analiseBody'),ch=Q('analiseChevron');
  var open=b.style.display!=='none';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲';
  if(!open) rAnaliseInt();
}

function atualizarAnalise(){
  var b=Q('analiseBody');
  if(b.style.display==='none'){
    b.style.display='block';
    Q('analiseChevron').textContent='▲';
  }
  rAnaliseInt();
}

function itemAnalise(txt,cor){
  return '<div style="background:var(--bg3);border-left:3px solid '+(cor||'var(--border2)')+';border-radius:0 var(--r2) var(--r2) 0;padding:.45rem .7rem;font-size:.79rem;color:var(--text2);line-height:1.5">'+txt+'</div>';
}

// ═══ FONTE DE VERDADE: propostas do ano (exclui em_elaboracao) ═══
// Usada por: Metas, Análise Inteligente, Visão Executiva, Ranking (ano)
// Filtra pelo ano de CRIAÇÃO (dat2 / dat) — base para Taxa de Conversão e total enviado
function getPropsAno(){
  var hoje=new Date();
  var ano=hoje.getFullYear();
  return props.filter(function(p){
    if(p.fas==='em_elaboracao') return false;
    // Prioridade: dat2 (ISO), depois dat (DD/MM/YYYY)
    var dRef=p.dat2||'';
    if(dRef){
      var dt=new Date(dRef+'T12:00:00');
      if(!isNaN(dt.getTime())) return dt.getFullYear()===ano;
    }
    if(p.dat){
      var ps=String(p.dat).split('/');
      if(ps.length===3){
        var dt2=new Date(ps[2]+'-'+ps[1]+'-'+ps[0]+'T12:00:00');
        if(!isNaN(dt2.getTime())) return dt2.getFullYear()===ano;
      }
    }
    return false;
  });
}
// ── V467: getFechAno filtra pelo ANO DE FECHAMENTO (dtFech), não de criação ──
// Uma proposta criada em 2025 mas fechada em 2026 conta para os números de 2026.
// Fallback: se não tiver dtFech, usa ano de criação (comportamento legado).
function getFechAno(){
  var ano=new Date().getFullYear();
  return props.filter(function(p){
    if(p.fas==='em_elaboracao') return false;
    if(FAS_FECHADO.indexOf(p.fas)<0) return false;
    // Prioridade: usar dtFech para saber em qual ano o negócio foi fechado
    if(p.dtFech){
      var d=new Date(p.dtFech+'T12:00:00');
      if(!isNaN(d.getTime())) return d.getFullYear()===ano;
    }
    // Fallback legado: usa ano de criação
    var dRef=p.dat2||'';
    if(dRef){
      var d2=new Date(dRef+'T12:00:00');
      if(!isNaN(d2.getTime())) return d2.getFullYear()===ano;
    }
    if(p.dat){
      var ps=String(p.dat).split('/');
      if(ps.length===3){
        var d3=new Date(ps[2]+'-'+ps[1]+'-'+ps[0]+'T12:00:00');
        if(!isNaN(d3.getTime())) return d3.getFullYear()===ano;
      }
    }
    return false;
  });
}
function getRecAno(){ return getFechAno().reduce(function(s,p){return s+n2(p.val);},0); }
// ═══════════════════════════════════════════════════════════════

function rAnaliseInt(){
  if(!props||!props.length){
    Q('analiseAlertas').innerHTML=itemAnalise('ℹ️ Nenhuma proposta cadastrada ainda.','var(--text3)');
    Q('analisePassos').innerHTML=itemAnalise('➡️ Crie sua primeira proposta para começar a análise.','var(--text3)');
    Q('analiseInsight').innerHTML='💡 Cadastre propostas para ativar a análise inteligente. Assim que houver dados, este painel mostrará alertas, próximos passos e insights automáticos sobre seu pipeline.';
    return;
  }

  var hoje=new Date();
  var ano=hoje.getFullYear();
  var mesAtual=hoje.getMonth()+1;
  var fracAno=mesAtual/12;

  // Fonte única: getPropsAno() — propostas do ano excluindo em_elaboracao
  var propsAnoAtual=getPropsAno();
  var tot=propsAnoAtual.length;
  var fechados=getFechAno();
  var cv=tot>0?(fechados.length/tot)*100:0;
  var tkAtual=fechados.length>0?(fechados.reduce(function(s,p){return s+n2(p.val);},0)/fechados.length):0;

  // Pipeline por fase (em_elaboracao mantido separado só para alertas de "antigas")
  var propsAtivas=props.filter(function(p){return p.fas!=='em_elaboracao';});
  var emElab=props.filter(function(p){return p.fas==='em_elaboracao';});
  var enviadas=propsAnoAtual.filter(function(p){return p.fas==='enviada'||p.fas==='cliente_analisando';});
  var follow12=propsAnoAtual.filter(function(p){return p.fas==='follow1'||p.fas==='follow2';});
  var follow34=propsAnoAtual.filter(function(p){return p.fas==='follow3'||p.fas==='follow4';});
  var atrasadas=propsAnoAtual.filter(function(p){return p.fas==='atrasado';});
  var emPausa=propsAnoAtual.filter(function(p){return p.fas.indexOf('em_pausa')>=0;});

  function somaVal(arr){return arr.reduce(function(s,p){return s+n2(p.val);},0);}

  // Dias desde criação
  function diasDesde(p){
    var dRef=p.dat2||'';
    if(!dRef&&p.dat){var s=String(p.dat).split('/');if(s.length===3)dRef=s[2]+'-'+s[1]+'-'+s[0];}
    if(!dRef)return null;
    var d=new Date(dRef+'T12:00:00');
    return isNaN(d.getTime())?null:Math.floor((hoje-d)/(1000*60*60*24));
  }

  var elabAntigas=emElab.filter(function(p){var d=diasDesde(p);return d!==null&&d>15;});
  var envParadas=enviadas.filter(function(p){var d=diasDesde(p);return d!==null&&d>7;});

  // Dados do ano — fonte única
  var propsAno=propsAnoAtual;
  var fechAno=fechados;
  var recAno=somaVal(fechAno);
  var projRec=fracAno>0?(recAno/fracAno):0;
  var projFech=fracAno>0?Math.round(fechAno.length/fracAno):0;

  // Metas
  var m=getMeta()||{};
  var metaFech=n2(m.fech||0);
  var metaRec=n2(m.rec||0);
  var antTicket=n2(m.antTicket&&m.antTicket>0?m.antTicket:0);

  // ══ ALERTAS ══
  var alertas=[];

  if(atrasadas.length>0)
    alertas.push({t:'⚠️ '+atrasadas.length+' execução'+(atrasadas.length>1?'ões':'')+' Atrasada'+(atrasadas.length>1?'s':'')+' — '+money(somaVal(atrasadas))+' em risco',c:'var(--red)',p:3});

  if(emPausa.length>0)
    alertas.push({t:'⏸️ '+emPausa.length+' proposta'+(emPausa.length>1?'s':'')+' em Pausa — '+money(somaVal(emPausa)),c:'#f97316',p:2});

  if(follow34.length>0)
    alertas.push({t:'🔄 '+follow34.length+' proposta'+(follow34.length>1?'s':'')+' em Follow-up 3/4 — decisão crítica — '+money(somaVal(follow34)),c:'#f97316',p:2});

  if(elabAntigas.length>0)
    alertas.push({t:'📝 '+elabAntigas.length+' proposta'+(elabAntigas.length>1?'s':'')+' em elaboração há mais de 15 dias sem enviar — '+money(somaVal(elabAntigas)),c:'var(--accent)',p:1});

  if(envParadas.length>0)
    alertas.push({t:'📤 '+envParadas.length+' proposta'+(envParadas.length>1?'s':'')+' enviada'+(envParadas.length>1?'s':'')+' sem follow-up há mais de 7 dias — '+money(somaVal(envParadas)),c:'var(--accent)',p:1});

  if(cv<20&&tot>=5)
    alertas.push({t:'📉 Conversão em '+cv.toFixed(1)+'% — abaixo de 20%. Revisar qualificação de leads.',c:'var(--red)',p:2});

  if(antTicket>0&&tkAtual>0&&tkAtual<antTicket*0.8)
    alertas.push({t:'💸 Ticket médio atual '+money(tkAtual)+' está 20%+ abaixo do ano anterior ('+money(antTicket)+'). Revisar precificação.',c:'#f97316',p:1});

  alertas.sort(function(a,b){return b.p-a.p;});
  if(!alertas.length) alertas.push({t:'✅ Nenhum alerta crítico no momento.',c:'var(--green)',p:0});

  // ══ PRÓXIMOS PASSOS ══
  var passos=[];
  var n=1;

  if(envParadas.length>0)
    passos.push(n+++'º Fazer follow-up nas '+envParadas.length+' proposta'+(envParadas.length>1?'s':'')+' enviada'+(envParadas.length>1?'s':'')+' paradas — '+money(somaVal(envParadas))+' em jogo');

  if(follow34.length>0)
    passos.push(n+++'º Definir destino das '+follow34.length+' em Follow-up 3/4 — fechar ou desqualificar — '+money(somaVal(follow34)));

  if(atrasadas.length>0)
    passos.push(n+++'º Normalizar as '+atrasadas.length+' execução'+(atrasadas.length>1?'ões':'')+' Atrasada'+(atrasadas.length>1?'s':'')+' — '+money(somaVal(atrasadas)));

  if(elabAntigas.length>0)
    passos.push(n+++'º Enviar as '+elabAntigas.length+' proposta'+(elabAntigas.length>1?'s':'')+' paradas em elaboração há mais de 15 dias');

  if(follow12.length>0)
    passos.push(n+++'º Avançar as '+follow12.length+' em Follow-up 1/2 — '+money(somaVal(follow12))+' no pipeline');

  if(metaFech>0&&projFech<metaFech){
    var faltam=metaFech-fechAno.length;
    var mesesRest=Math.max(1,12-mesAtual);
    passos.push(n+++'º Acelerar fechamentos: faltam '+faltam+' para a meta — precisa de ~'+(faltam/mesesRest).toFixed(1)+'/mês nos próximos '+mesesRest+' meses');
  }

  if(!passos.length) passos.push('✅ Pipeline saudável. Manter ritmo atual de prospecção e follow-up.');

  // ══ INSIGHT ══
  var insight='';
  var pctAno=(fracAno*100).toFixed(0);

  if(metaFech>0){
    var pctFech=metaFech>0?((fechAno.length/metaFech)*100).toFixed(0):0;
    if(projFech>=metaFech)
      insight+='🟢 Mês '+mesAtual+'/12 — '+fechAno.length+' fechamento'+(fechAno.length!==1?'s':'')+' realizados ('+pctFech+'% da meta). Projeção de <strong>'+projFech+'</strong> no ano — acima da meta de '+metaFech+'. ';
    else
      insight+='📊 Mês '+mesAtual+'/12 ('+pctAno+'% do ano) — '+fechAno.length+' fechamento'+(fechAno.length!==1?'s':'')+' ('+pctFech+'% da meta de '+metaFech+'). Projeção atual: <strong>'+projFech+'</strong> — faltam '+(metaFech-fechAno.length)+' para bater a meta. ';
  } else {
    insight+='📊 Mês '+mesAtual+'/12. '+fechAno.length+' fechamento'+(fechAno.length!==1?'s':'')+' no ano. Configure metas em ⚙️ para ver comparativos. ';
  }

  if(metaRec>0){
    var gapRec=metaRec-projRec;
    insight+=gapRec>0
      ?'Previsão de faturamento: <strong>'+money(projRec)+'</strong> — gap de '+money(gapRec)+' para a meta de '+money(metaRec)+'. '
      :'Faturamento previsto <strong>'+money(projRec)+'</strong> — <span style="color:var(--green)">acima da meta de '+money(metaRec)+'!</span> ';
  }

  if(tot>=5)
    insight+='Conversão atual: <strong>'+cv.toFixed(1)+'%</strong>'+(cv>=30?' — excelente nível.':cv>=20?' — dentro do esperado.':' — abaixo do ideal, foco em qualificação de leads.');

  // Render
  Q('analiseAlertas').innerHTML=alertas.map(function(a){return itemAnalise(a.t,a.c);}).join('');
  Q('analisePassos').innerHTML=passos.map(function(p){return itemAnalise(p,'var(--blue)');}).join('');
  Q('analiseInsight').innerHTML='💡 '+insight;
}

// NAV
function go(id,btn){
  document.querySelectorAll('.sec').forEach(function(s){s.classList.remove('on')});
  document.querySelectorAll('.nav-item').forEach(function(b){b.classList.remove('on')});
  if(id!=='nova') hideActionBar();
  else if(!editId) hideActionBar();
  Q(id).classList.add('on');
  if(btn){btn.classList.add('on')}
  else{var map={dashboard:0,nova:1,templates:2,escopos:3,analise:4,registro:5,changelog:6};var bs=document.querySelectorAll('.nav-item');if(map[id]!==undefined&&bs[map[id]])bs[map[id]].classList.add('on')}
}

// WIZARD
var cStep=1;
function step(n){
  cStep=n;
  document.querySelectorAll('.sp').forEach(function(p){p.classList.remove('on')});
  document.querySelectorAll('.ws').forEach(function(s){s.classList.remove('on','dn')});
  Q('s'+n).classList.add('on');
  for(var i=1;i<=5;i++){var el=Q('ws'+i);if(!el)continue;if(i<n)el.classList.add('dn');else if(i===n)el.classList.add('on')}
  if(n===2){rTplSel();rEsc();if(Q('escTplModal'))Q('escTplModal').style.display='none';}
  if(n===3){refBudg();rEsc();setTimeout(function(){refreshValorSecEscopo();},30);}
  if(n===4)cTot();
  if(n===5){
    cTot();
    setTimeout(function(){
      try{genPrev(); var pv=Q('pvWrap'); if(pv) pv.scrollTop=0;}catch(e){console.error('Erro ao gerar preview no passo 5:',e)}
    },10);
  }
}

// AUTO NUM
function nN(){
  var rev=(Q('pRevAtual')&&Q('pRevAtual').value||'').trim().toUpperCase();
  return cnt+(rev?rev:'')+'.'+ANO;
}
function updN(){cnt=parseInt(Q('cBase').value)||290;Q('pnD').textContent=nN();Q('pNum').value=nN();saveCnt()}
function useN(){Q('pNum').value=nN();Q('pnD').textContent=nN();saveCnt();toast('Número '+nN()+' atribuído!','ok')}
function advN(){cnt+=10;Q('cBase').value=cnt;Q('pnD').textContent=nN();Q('pNum').value=nN();saveCnt()}
function updNumRev(){Q('pnD').textContent=nN();Q('pNum').value=nN();}


// REGISTRO DE PROPOSTAS
var _regSort = 'num';
var _regDir = 'asc';

function regSort(col){
  if(_regSort===col){ _regDir=(_regDir==='asc'?'desc':'asc'); }
  else { _regSort=col; _regDir='asc'; }
  ['num','cli','dat','val'].forEach(function(c){
    var el=Q('regSort'+c.charAt(0).toUpperCase()+c.slice(1));
    if(el) el.textContent='';
  });
  var el=Q('regSort'+col.charAt(0).toUpperCase()+col.slice(1));
  if(el) el.textContent=(_regDir==='asc'?' ▲':' ▼');
  rRegistro();
}

function rRegistro(){
  var q=(Q('regBusca').value||'').toLowerCase().trim();
  var fAno=(Q('regAno').value||'').trim();
  var fFas=(Q('regFas').value||'').trim();

  var list=props.slice();

  // Filtros
  if(q) list=list.filter(function(p){
    return (p.num||'').toLowerCase().indexOf(q)>=0
        || (p.cli||'').toLowerCase().indexOf(q)>=0
        || (p.tit||'').toLowerCase().indexOf(q)>=0
        || (p.loc||'').toLowerCase().indexOf(q)>=0;
  });
  if(fAno) list=list.filter(function(p){
    var n=String(p.num||'');
    return n.indexOf('.'+fAno)>=0;
  });
  if(fFas) list=list.filter(function(p){ return p.fas===fFas; });

  // Ordenação
  list.sort(function(a,b){
    var va,vb;
    if(_regSort==='num'){
      // Extrai a parte numérica base para ordenar corretamente (100, 110, 120...)
      va=parseInt((String(a.num||'').match(/^(\d+)/)||[0,0])[1],10)||0;
      vb=parseInt((String(b.num||'').match(/^(\d+)/)||[0,0])[1],10)||0;
    } else if(_regSort==='val'){
      va=parseFloat(a.val)||0; vb=parseFloat(b.val)||0;
    } else if(_regSort==='dat'){
      va=a.dat2||a.dat||''; vb=b.dat2||b.dat||'';
    } else {
      va=String(a[_regSort]||'').toLowerCase();
      vb=String(b[_regSort]||'').toLowerCase();
    }
    if(va<vb) return _regDir==='asc'?-1:1;
    if(va>vb) return _regDir==='asc'?1:-1;
    return 0;
  });

  // Atualizar contador
  var cEl=Q('regContador');
  if(cEl) cEl.textContent=list.length+' proposta'+(list.length!==1?'s':'')+(list.length!==props.length?' (filtrado de '+props.length+')':'');

  // Detectar gaps na sequência numérica (somente quando sem filtros)
  var alertEl=Q('regSeqAlert');
  if(alertEl){
    if(!q && !fFas){
      var gaps=[];
      var allNums=props
        .map(function(p){ return parseInt((String(p.num||'').match(/^(\d+)/)||[0,0])[1],10)||0; })
        .filter(function(n){ return n>0; })
        .sort(function(a,b){return a-b;});
      for(var i=1;i<allNums.length;i++){
        var diff=allNums[i]-allNums[i-1];
        if(diff>10) gaps.push(allNums[i-1]+' → '+allNums[i]);
      }
      if(gaps.length){
        alertEl.style.display='block';
        alertEl.innerHTML='⚠️ <strong>Gaps detectados na sequência:</strong> '+gaps.join(' &nbsp;|&nbsp; ')+' &nbsp;—&nbsp; Verifique se há propostas não cadastradas.';
      } else {
        alertEl.style.display='none';
      }
    } else {
      alertEl.style.display='none';
    }
  }

  // Renderizar tabela
  var tbody=Q('regBody');
  if(!tbody) return;

  if(!list.length){
    tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text3)">Nenhuma proposta encontrada.</td></tr>';
    Q('regFoot').innerHTML='';
    return;
  }

  var totalVal=0;
  tbody.innerHTML=list.map(function(p,i){
    var v=parseFloat(p.val)||0;
    totalVal+=v;
    var isOdd=(i%2!==0);
    var fasObj=FASE[p.fas]||{n:p.fas||'--',c:'b-elab',i:''};
    var bdgHtml='<span class="bdg '+fasObj.c+'">'+esc(fasObj.i?(fasObj.i+' '+fasObj.n):fasObj.n)+'</span>';
    var valHtml=v ? '<span style="color:var(--green);font-weight:600">' + money(v) + '</span>'
                  : '<span style="color:var(--text3)">--</span>';
    var tr=document.createElement('tr');
    tr.style.borderBottom='1px solid var(--border)';
    if(isOdd) tr.style.background='rgba(255,255,255,.025)';
    tr.onmouseover=function(){this.style.background='rgba(88,166,255,.06)';};
    tr.onmouseout=function(){this.style.background=isOdd?'rgba(255,255,255,.025)':'';};
    tr.innerHTML=
      '<td style="padding:.45rem .7rem;font-family:monospace;font-weight:700;color:var(--accent);white-space:nowrap">'
        +'<span style="background:rgba(240,165,0,.1);border:1px solid rgba(240,165,0,.2);padding:.1rem .38rem;border-radius:4px">'+esc(p.num||'--')+'</span>'
      +'</td>'
      +'<td style="padding:.45rem .7rem;color:var(--text2);white-space:nowrap">'+esc(p.dat||p.dat2||'--')+'</td>'
      +'<td style="padding:.45rem .7rem;font-weight:700;color:var(--text);min-width:260px;max-width:420px">'+esc(p.tit||'--')+'</td>'
      +'<td style="padding:.45rem .7rem;color:var(--text2);font-size:.75rem;min-width:140px;max-width:200px">'+esc(p.cli||'--')+'</td>'
      +'<td style="padding:.45rem .7rem">'+bdgHtml+'</td>'
      +'<td style="padding:.45rem .7rem;text-align:right;white-space:nowrap">'+valHtml+'</td>'
      +'<td style="padding:.45rem .7rem;text-align:center"><button class="btn bg bxs" data-pid="'+p.id+'" title="Abrir proposta">&#9998;</button></td>';
    return tr.outerHTML;
  }).join('');
  // Attach edit handlers after render
  tbody.querySelectorAll('button[data-pid]').forEach(function(btn){
    btn.addEventListener('click',function(){ editP(this.getAttribute('data-pid')); });
  });

  // Rodapé totais
  var comValor=list.filter(function(p){return parseFloat(p.val)>0;}).length;
  Q('regFoot').innerHTML='<tr style="background:var(--bg3)">'
    +'<td colspan="5" style="padding:.45rem .7rem;font-size:.72rem;color:var(--text3)">'+list.length+' proposta'+(list.length!==1?'s':'')+' &nbsp;•&nbsp; '+comValor+' com valor informado</td>'
    +'<td style="padding:.45rem .7rem;text-align:right;font-weight:700;color:var(--green)">'+money(totalVal)+'</td>'
    +'<td></td>'
    +'</tr>';
}

// DASHBOARD

function rDash(rankTarget, sortBy){
  if(rankTarget==='cli' && sortBy){ window._rCliSort=sortBy; }
  if(rankTarget==='ctt' && sortBy){ window._rCttSort=sortBy; }
  // FIX V354: excluir em_elaboracao de todas as contagens do dashboard
  // Visão Geral: histórico total para Propostas/Carteira/Aprovado/Ticket
  var propsAtivas=props.filter(function(p){return p.fas!=='em_elaboracao';});
  var tot=propsAtivas.length;
  var cart=propsAtivas.reduce(function(s,p){return s+n2(p.val)},0);
  var apr=propsAtivas.filter(function(p){return FAS_FECHADO.indexOf(p.fas)>=0});
  var vapr=apr.reduce(function(s,p){return s+n2(p.val)},0);
  var tk=apr.length>0?(vapr/apr.length):0;
  // CONVERSÃO = do ano atual (mesma base que Metas e Análise)
  var _pAno=getPropsAno(); var _fAno=getFechAno();
  var cv=_pAno.length>0?((_fAno.length/_pAno.length)*100).toFixed(1):'0.0';
  Q('kT').textContent=tot;
  Q('kC').textContent=money(cart);
  Q('kA').textContent=money(vapr);
  Q('kCv').textContent=cv+'%';
  Q('kTk').textContent=money(tk);

  // KPI: Ciclo de Vendas
  // Considera apenas propostas aprovadas/finalizadas que têm dat2 (criação) E dtFech (fechamento)
  var ciclos=[];
  apr.forEach(function(p){
    if(p.dtFech && p.dat2){
      var dCri=new Date(p.dat2+'T12:00:00');
      var dFech=new Date(p.dtFech+'T12:00:00');
      var diff=Math.round((dFech-dCri)/(1000*60*60*24));
      if(diff>=0) ciclos.push(diff);
    }
  });
  if(Q('kCiclo')){
    if(ciclos.length>0){
      var mediaCiclo=Math.round(ciclos.reduce(function(s,d){return s+d},0)/ciclos.length);
      Q('kCiclo').textContent=mediaCiclo+' dias';
      Q('kCiclo').title='Média de '+ciclos.length+' proposta'+(ciclos.length!==1?'s':'')+' com data de fechamento';
    } else {
      Q('kCiclo').textContent='—';
      Q('kCiclo').title='Nenhuma proposta aprovada/finalizada com data de fechamento informada';
    }
  }

  // KPI: Previsibilidade de Receita
  // Carteira em aberto = propostas NÃO aprovadas/finalizadas/canceladas × Taxa de Conversão histórica
  // FIX V354: cartAberta exclui em_elaboracao — só conta propostas já enviadas
  var fasAberto=['enviada','cliente_analisando','follow1','follow2','follow3','follow4','virou_budget'];
  var cartAberta=propsAtivas.filter(function(p){return fasAberto.indexOf(p.fas)>=0}).reduce(function(s,p){return s+n2(p.val)},0);
  var taxaConv=_pAno.length>0?(_fAno.length/_pAno.length):0; // conversão do ano
  var recPrev=cartAberta*taxaConv;
  if(Q('kRecPrev')) Q('kRecPrev').textContent=money(recPrev);
  var _mTk=getMeta()||{};
  var _antTk=n2(_mTk.antTicket&&_mTk.antTicket>0?_mTk.antTicket:75000);
  if(Q('kTkAnt'))Q('kTkAnt').textContent=money(_antTk);

  rMeta();
  _populaFechMesAnos();
  if(Q('fechMesBody')&&Q('fechMesBody').style.display==='block') rFechMes();
  if(Q('ciclosDashBody')&&Q('ciclosDashBody').style.display==='block') rCiclosDash();
  _populaExecTlAnos();
  if(Q('execTlBody')&&Q('execTlBody').style.display==='block') rExecTimeline();
  // Atualizar análise por categoria se painel estiver aberto
  if(Q('catAnaliseBody')&&Q('catAnaliseBody').style.display==='block') rCatAnalise();
  // Atualizar análise inteligente se painel estiver aberto
  if(Q('analiseBody')&&Q('analiseBody').style.display!=='none') rAnaliseInt();
  var cFas={};
  props.forEach(function(p){cFas[p.fas]=(cFas[p.fas]||0)+1});
  Q('phG').innerHTML=Object.keys(FASE).map(function(f){
    var v=props.filter(function(p){return p.fas===f}).reduce(function(s,p){return s+n2(p.val)},0);
    return '<div class="ph" onclick="flt(\''+f+'\',null)"><div class="ph-n">'+(cFas[f]||0)+'</div><div class="ph-v">'+money(v)+'</div><div class="ph-l">'+FASE[f].n+'</div></div>'
  }).join('');

  // Ranking de clientes
  var _rCliSort=window._rCliSort||'conv';
  var _rCttSort=window._rCttSort||'conv';

  // --- RANKING POR CLIENTE ---
  // Usa cliente do serviço (p.loc) como identidade principal; fallback: p.cli
  // Chave = CNPJ do local do serviço (mais confiável) → CNPJ do cliente → nome do local
  // Isso garante que propostas do mesmo CNPJ sejam somadas mesmo com nomes digitados diferente
  var porCli={};
  // FIX V355: excluir em_elaboracao do ranking
  props.filter(function(p){return p.fas!=='em_elaboracao';}).forEach(function(p){
    var locCnpj=(p.locCnpj||'').trim().replace(/[^0-9]/g,'');
    var cliCnpj=(p.cnpj||'').trim().replace(/[^0-9]/g,'');
    var cli=((p.loc||'').trim()||(p.cli||'').trim()||'Cliente não informado');
    var cid=((p.csvc||'').trim()||(p.cid||'').trim()||'-');
    // Chave primária: CNPJ do local (sem formatação) se disponível; senão CNPJ pagador; senão nome+cidade
    var key=locCnpj||(cliCnpj?'cnpj:'+cliCnpj:cli+'||'+cid);
    if(!porCli[key]){
      porCli[key]={
        cliente:cli,
        cnpj:(p.locCnpj||p.cnpj||'-').trim()||'-',
        cidade:cid,
        contato:(p.ac||'-').trim()||'-',
        propostas:0,fechados:0,valor:0
      };
    }
    // Atualiza nome/cidade com dados mais completos (loc preferido sobre cli)
    if((p.loc||'').trim()) porCli[key].cliente=(p.loc||'').trim();
    if((p.csvc||'').trim()) porCli[key].cidade=(p.csvc||'').trim();
    if((p.locCnpj||'').trim()) porCli[key].cnpj=(p.locCnpj||'').trim();
    porCli[key].propostas++;
    if(FAS_FECHADO.indexOf(p.fas)>=0){
      porCli[key].fechados++;
      porCli[key].valor+=n2(p.val);
    }
  });
  var ranking=Object.keys(porCli).map(function(k){
    var c=porCli[k];
    c.conv=c.propostas>0?((c.fechados/c.propostas)*100):0;
    return c;
  }).sort(function(a,b){
    if(_rCliSort==='val') return b.valor-a.valor;
    if(_rCliSort==='prop') return b.propostas-a.propostas;
    if(b.conv!==a.conv) return b.conv-a.conv;
    return b.valor-a.valor;
  });

  var wCli=Q('convClienteWrap');
  if(wCli){
    if(!ranking.length){ wCli.innerHTML='<p class="hint">Sem dados.</p>'; }
    else{
      wCli.innerHTML='<table class="conv-table"><thead><tr>'
        +'<th>Cliente</th><th>Cidade</th><th>Prop.</th><th>Fech.</th><th>Conv.</th><th>Aprovado</th>'
        +'</tr></thead><tbody>'
        +ranking.slice(0,10).map(function(c){
          var conv=c.conv.toFixed(1);
          var cls=c.conv>=50?'conv-good':(c.conv>=25?'conv-mid':'conv-bad');
          return '<tr>'
            +'<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis" title="'+esc(c.cliente)+'">'+esc(c.cliente)+'</td>'
            +'<td>'+esc(c.cidade)+'</td>'
            +'<td style="text-align:center">'+c.propostas+'</td>'
            +'<td style="text-align:center">'+c.fechados+'</td>'
            +'<td class="'+cls+'" style="text-align:center">'+conv+'%</td>'
            +'<td style="text-align:right">'+money(c.valor)+'</td>'
            +'</tr>';
        }).join('')+'</tbody></table>';
    }
  }
  // highlight sort button CLI
  ['Conv','Val','Prop'].forEach(function(s){
    var b=Q('rCliSort'+s);
    if(b){ b.style.background=(_rCliSort===s.toLowerCase())?'var(--accent)':'var(--bg3)';
           b.style.color=(_rCliSort===s.toLowerCase())?'#000':'var(--text2)';
           b.style.fontWeight=(_rCliSort===s.toLowerCase())?'700':'400'; }
  });

  // --- RANKING POR CONTATO ---
  // Usa cliente do serviço (p.loc) como identidade; fallback: p.cli
  var porCtt={};
  // FIX V355: excluir em_elaboracao do ranking
  props.filter(function(p){return p.fas!=='em_elaboracao';}).forEach(function(p){
    var ctt=(p.ac||'Sem contato').trim()||'Sem contato';
    var cli=((p.loc||'').trim()||(p.cli||'').trim()||'');
    if(!porCtt[ctt]){
      porCtt[ctt]={contato:ctt,clientes:{},propostas:0,fechados:0,valor:0};
    }
    if(cli) porCtt[ctt].clientes[cli]=true;
    porCtt[ctt].propostas++;
    if(FAS_FECHADO.indexOf(p.fas)>=0){
      porCtt[ctt].fechados++;
      porCtt[ctt].valor+=n2(p.val);
    }
  });
  var rankingCtt=Object.keys(porCtt).map(function(k){
    var c=porCtt[k];
    c.conv=c.propostas>0?((c.fechados/c.propostas)*100):0;
    c.numCli=Object.keys(c.clientes).length;
    return c;
  }).sort(function(a,b){
    if(_rCttSort==='val') return b.valor-a.valor;
    if(_rCttSort==='prop') return b.propostas-a.propostas;
    if(b.conv!==a.conv) return b.conv-a.conv;
    return b.valor-a.valor;
  });

  var wCtt=Q('convContatoWrap');
  if(wCtt){
    if(!rankingCtt.length){ wCtt.innerHTML='<p class="hint">Sem dados.</p>'; }
    else{
      wCtt.innerHTML='<table class="conv-table"><thead><tr>'
        +'<th>Contato</th><th style="text-align:center">Cli.</th><th style="text-align:center">Prop.</th><th style="text-align:center">Fech.</th><th style="text-align:center">Conv.</th><th style="text-align:right">Aprovado</th>'
        +'</tr></thead><tbody>'
        +rankingCtt.slice(0,10).map(function(c){
          var conv=c.conv.toFixed(1);
          var cls=c.conv>=50?'conv-good':(c.conv>=25?'conv-mid':'conv-bad');
          var cliList=Object.keys(c.clientes).join(', ');
          return '<tr>'
            +'<td style="font-weight:600" title="'+esc(cliList)+'">'+esc(c.contato)+'</td>'
            +'<td style="text-align:center;color:var(--text3)" title="'+esc(cliList)+'">'+c.numCli+'</td>'
            +'<td style="text-align:center">'+c.propostas+'</td>'
            +'<td style="text-align:center">'+c.fechados+'</td>'
            +'<td class="'+cls+'" style="text-align:center">'+conv+'%</td>'
            +'<td style="text-align:right">'+money(c.valor)+'</td>'
            +'</tr>';
        }).join('')+'</tbody></table>';
    }
  }
  // highlight sort button CTT
  ['Conv','Val','Prop'].forEach(function(s){
    var b=Q('rCttSort'+s);
    if(b){ b.style.background=(_rCttSort===s.toLowerCase())?'var(--accent)':'var(--bg3)';
           b.style.color=(_rCttSort===s.toLowerCase())?'#000':'var(--text2)';
           b.style.fontWeight=(_rCttSort===s.toLowerCase())?'700':'400'; }
  });

  // Visão executiva do ano — fonte única
  var hoje=new Date();
  var fracAno=(hoje.getMonth()+1)/12;
  var propsAno=getPropsAno();
  var totalAno=propsAno.length;
  var _fechAnoArr=getFechAno();
  var fechAno=_fechAnoArr.length;
  var recAno=getRecAno();
  var projFech=fracAno>0?Math.round(fechAno/fracAno):0;
  var projRec=fracAno>0?(recAno/fracAno):0;

  var _mForTicket=getMeta()||{};
  var antTicket=n2(_mForTicket.antTicket&&_mForTicket.antTicket>0?_mForTicket.antTicket:75000);
  var exec=Q('execDash');
  if(exec){
    exec.innerHTML=''
      +'<div class="metric-box"><div class="metric-label">Conversão correta do ano</div><div class="metric-val" style="color:var(--purple)">'+(totalAno?((fechAno/totalAno)*100).toFixed(1):'0.0')+'%</div><div class="metric-sub">'+fechAno+' fechamentos de '+totalAno+' propostas</div></div>'
      +'<div class="metric-box"><div class="metric-label">Ticket médio aprovado</div>'+'<div class="metric-val" style="color:var(--accent)">'+money(fechAno?recAno/fechAno:0)+'</div>'+(antTicket>0&&fechAno>0?'<div class="metric-sub" style="color:'+(recAno/fechAno>=antTicket?'#3fb950':'#f85149')+'">'+(recAno/fechAno>=antTicket?'\u25b2':'\u25bc')+' '+(((recAno/fechAno-antTicket)/antTicket)*100).toFixed(1)+'% vs ano ant.</div>':'<div class="metric-sub">Base nos fechamentos do ano</div>')+'</div>'+'<div class="metric-box"><div class="metric-label">Ticket médio ano anterior</div>'+'<div class="metric-val" style="color:var(--text3)">'+money(antTicket)+'</div>'+'<div class="metric-sub">'+(antTicket>0?'Referência configurada':'Configure em ⛔ Metas')+'</div></div>'
      +'<div class="metric-box"><div class="metric-label">Previsão de fechamento do ano</div><div class="metric-val" style="color:var(--green)">'+projFech+'</div><div class="metric-sub">Ritmo atual anualizado</div></div>';
  }

  if(typeof carregarCeoDash==='function') carregarCeoDash();
  function runDecisionEngine(){
  var elAlertas=Q('deAlertas'),elDecisoes=Q('deDecisoes'),elResumo=Q('deResumoExec'),elFoco=Q('deFocoSemana'),elOpor=Q('deOportunidades');
  if(!elAlertas) return;
  var hoje=new Date();
  function dD(d){ if(!d)return null; var dt=new Date(d+'T12:00:00'); return isNaN(dt)?null:Math.floor((hoje-dt)/86400000); }
  var FAS_DECISAO=['enviada','cliente_analisando','follow1','follow2','follow3','follow4'];
  var FAS_EXEC=['aprovado','andamento','faturado','taf','sat','atrasado','em_pausa_falta_material','em_pausa_aguardando_cliente','em_pausa_aguardando_terceiro'];
  function deCard(nivel,titulo,msg,acao){
    var cor=nivel==='critico'?'#f85149':nivel==='atencao'?'#d4a017':'#3fb950';
    var bg=nivel==='critico'?'rgba(248,81,73,.07)':nivel==='atencao'?'rgba(212,160,23,.07)':'rgba(63,185,80,.07)';
    return '<div style="background:'+bg+';border:1px solid '+cor+'44;border-left:3px solid '+cor+';border-radius:8px;padding:.55rem .8rem;margin-bottom:.5rem">'
      +'<div style="font-size:.82rem;font-weight:600;color:var(--text);margin-bottom:.2rem">'+titulo+'</div>'
      +'<div style="font-size:.78rem;color:var(--text2);line-height:1.5">'+msg+'</div>'
      +(acao?'<div style="font-size:.72rem;color:'+cor+';margin-top:.3rem;font-weight:600">→ '+acao+'</div>':'')
      +'</div>';
  }
  var alertasList=[],criticos=0,atencao=0;
  props.forEach(function(p){
    var tl=p.tl||{},fas=p.fas||'',val=n2(p.val)||0;
    var nome='<strong>#'+p.num+' — '+(p.cli||'')+(p.tit?' | '+p.tit.substring(0,35):'')+'</strong>';
    // Em elaboração parada
    if(fas==='em_elaboracao'){ var d=dD(p.dat2); if(d!==null&&d>15){ alertasList.push({nivel:'atencao',html:deCard('atencao','📝 Parada em elaboração — '+d+' dias',nome+' em elaboração há '+d+' dias sem enviar.','Enviar ou descartar')}); atencao++; } }
    // Em decisão travada
    if(FAS_DECISAO.indexOf(fas)>=0){ var dtRef=tl.dtEnvio||p.dat2||''; var d=dD(dtRef); if(d!==null){ if(d>60){ alertasList.push({nivel:'critico',html:deCard('critico','🔴 Decisão travada — '+d+' dias',nome+' — '+money(val)+' aguardando decisão há '+d+' dias.','Follow-up executivo urgente ou mover para Budget')}); criticos++; } else if(d>30){ alertasList.push({nivel:'atencao',html:deCard('atencao','⚠️ Decisão demorada — '+d+' dias',nome+' — '+money(val)+' aguardando há '+d+' dias.','Fazer follow-up esta semana')}); atencao++; } } }
    // Obra sem NF
    if(FAS_EXEC.indexOf(fas)>=0){ var dtI=tl.dtInicioExec||''; var nfs=tl.nfs||[]; var d=dD(dtI); if(d!==null&&d>30&&nfs.length===0){ alertasList.push({nivel:'critico',html:deCard('critico','⚠️ Obra sem NF — '+d+' dias',nome+' — obra iniciada há '+d+' dias sem NF emitida. Risco de caixa elevado.','Emitir NF imediatamente')}); criticos++; } }
    // Execução atrasada
    if(fas==='atrasado'){ alertasList.push({nivel:'critico',html:deCard('critico','🔴 Execução Atrasada',nome+' — '+money(val)+' marcada como ATRASADA.','Reagendar com cliente ou acionar equipe')}); criticos++; }
  });
  // Inteligência: PMR alto por cliente
  var pmrCli={};
  props.forEach(function(p){ var tl=p.tl||{},nfs=tl.nfs||[],dtRF=tl.dtRecebFinal||''; var ultNF=nfs.length>0?nfs.reduce(function(mx,nf){return nf.data>mx?nf.data:mx;},''):null; if(ultNF&&dtRF){ var d=typeof _difD==='function'?_difD(ultNF,dtRF):null; if(d!==null){ var k=(p.cnpj||p.cli||'').trim().toLowerCase(); if(!pmrCli[k]) pmrCli[k]={cli:p.cli,vals:[]}; pmrCli[k].vals.push(d); } } });
  var decHtml='';
  Object.keys(pmrCli).forEach(function(k){ var c=pmrCli[k],m=Math.round(c.vals.reduce(function(s,v){return s+v;},0)/c.vals.length); if(m>60&&c.vals.length>=2) decHtml+=deCard('atencao','⚠️ Cliente com PMR alto: '+c.cli,'PMR médio histórico de <strong>'+m+' dias</strong> (base: '+c.vals.length+' pagamentos). Custo financeiro embutido recomendado.','Incluir custo financeiro no próximo orçamento'); });
  // Inteligência: ciclo comercial
  var fastFas=props.filter(function(p){ return p.dtFech&&p.dat2&&FAS_FECHADO.indexOf(p.fas)>=0; });
  if(fastFas.length>=3){ var cicArr=fastFas.map(function(p){ return typeof _difD==='function'?(_difD(p.dat2,p.dtFech)||0):0; }); var cicMed=Math.round(cicArr.reduce(function(s,v){return s+v;},0)/cicArr.length); if(cicMed&&cicMed<=45) decHtml+=deCard('ok','✅ Ciclo comercial competitivo','Serviços fecham em média em <strong>'+cicMed+' dias</strong>. Pipeline saudável.','Manter ritmo de prospecção e follow-up'); }
  if(!decHtml) decHtml='<div style="color:var(--text3);font-size:.8rem;padding:.5rem 0">Preencha a Linha do Tempo nas propostas para ativar os padrões de inteligência.</div>';
  // Resumo
  var resumoHtml='<div style="display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:.8rem">'
    +'<div style="background:rgba(248,81,73,.1);border:1px solid rgba(248,81,73,.3);border-radius:8px;padding:.4rem .75rem;font-size:.82rem"><strong style="color:#f85149">'+criticos+'</strong> <span style="color:var(--text2)">crítico'+(criticos!==1?'s':'')+' 🔴</span></div>'
    +'<div style="background:rgba(212,160,23,.1);border:1px solid rgba(212,160,23,.3);border-radius:8px;padding:.4rem .75rem;font-size:.82rem"><strong style="color:#d4a017">'+atencao+'</strong> <span style="color:var(--text2)">atenção ⚠️</span></div>'
    +(alertasList.length===0?'<div style="background:rgba(63,185,80,.1);border:1px solid rgba(63,185,80,.3);border-radius:8px;padding:.4rem .75rem;font-size:.82rem"><strong style="color:#3fb950">✅</strong> <span style="color:var(--text2)">Tudo ok</span></div>':'')
    +'</div>';
  // Foco da semana
  var focoHtml='<div style="font-size:.7rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">🎯 Foco desta semana</div>';
  if(alertasList.length===0) focoHtml+='<div style="color:#3fb950;font-size:.83rem;padding:.3rem 0">✅ Nenhum alerta ativo. Pipeline saudável — mantenha o ritmo!</div>';
  else focoHtml+=alertasList.slice(0,3).map(function(a){return a.html;}).join('');
  // Demais alertas
  var todosHtml='';
  if(alertasList.length>3){
    todosHtml='<div style="font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;margin-top:.6rem">Demais alertas</div>';
    todosHtml+=alertasList.slice(3).map(function(a){return a.html;}).join('');
  }
  var decTit='<div style="font-size:.7rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem;margin-top:.8rem">🧠 Padrões & Inteligência</div>';
  if(elResumo) elResumo.innerHTML=resumoHtml;
  if(elFoco) elFoco.innerHTML=focoHtml;
  if(elAlertas) elAlertas.innerHTML=todosHtml;
  if(elDecisoes) elDecisoes.innerHTML=decTit+decHtml;
  if(elOpor) elOpor.innerHTML='';
}

  if(typeof runDecisionEngine==='function'){
    runDecisionEngine();
    // Zera o timestamp do cache para que o módulo de Gestão busque dados frescos
    if(window._deResult) window._deResult._ts=0;
  }
  // Atualiza a seção ativa do módulo de Planejamento (Hoje/Semana/Mês/Trimestre)
  if(typeof gestaoRefreshActive==='function') gestaoRefreshActive();
  rProps();
}
function flt(f,el){
  fltSt=f;
  document.querySelectorAll('.ftg').forEach(function(t){t.classList.remove('on')});
  if(el){el.classList.add('on')}
  else{
    var tag=document.querySelector('.ftg[data-phase="'+f+'"]');
    if(tag) tag.classList.add('on');
  }
  rProps();
}
function _propAlerts(p){
  var hoje=new Date();
  function dD(d){ if(!d)return null; var dt=new Date(d+'T12:00:00'); return isNaN(dt)?null:Math.floor((hoje-dt)/86400000); }
  function badge(cor,txt){ return '<span style="display:inline-flex;align-items:center;background:'+cor+'22;border:1px solid '+cor+'66;border-radius:5px;padding:.1rem .42rem;font-size:.67rem;color:'+cor+';font-weight:700;margin:.15rem .15rem 0 0;white-space:nowrap">'+txt+'</span>'; }
  function sem(d,bom,ok,label){ if(d===null||d<0)return ''; return badge(d<=bom?'#3fb950':d<=ok?'#d4a017':'#f85149',d+'d '+label); }

  var fas=p.fas||'',tl=p.tl||{},tags='';
  var dtC=p.dat2||'',dtV=tl.dtVisita||'',dtE=tl.dtEnvio||'',dtF=p.dtFech||'';
  var dtI=tl.dtInicioExec||'',dtT=tl.dtTermino||'',dtA=tl.dtAceite||'';
  var nfs=tl.nfs||[];

  var FAS_DEC=['enviada','cliente_analisando','follow1','follow2','follow3','follow4'];
  var FAS_EXEC=['andamento','faturado','taf','sat','atrasado','em_pausa_falta_material','em_pausa_aguardando_cliente','em_pausa_aguardando_terceiro'];
  var FAS_DONE=['recebido','finalizado'];

  // Prospecção ou Elaboração
  if(fas==='em_elaboracao'){
    if(!dtV) tags+=sem(dD(dtC),7,15,'prospecção');
    else     tags+=sem(dD(dtV),6,12,'elaboração');
  }
  // Decisão do Cliente
  if(FAS_DEC.indexOf(fas)>=0) tags+=sem(dD(dtE||dtC),30,60,'decisão');
  // Gap Pré-Obra
  if(fas==='aprovado') tags+=sem(dD(dtF),15,30,'pré-obra');
  // Duração da Execução (cinza) + alertas
  if(FAS_EXEC.indexOf(fas)>=0){
    var dExec=dD(dtI);
    if(dExec!==null) tags+=badge('var(--text3)',dExec+'d execução');
    var dtRef=dtA||dtT;
    if(dtRef) tags+=sem(dD(dtRef),3,7,'→ NF');
    else if(dExec!==null&&dExec>30&&nfs.length===0) tags+=badge('#f85149','🔴 sem NF '+dExec+'d');
    if(fas==='atrasado') tags+=badge('#f85149','🔴 ATRASADA');
  }
  // Ciclo Comercial (propostas finalizadas)
  if(FAS_DONE.indexOf(fas)>=0&&dtC&&dtF){
    var dCic=typeof _difD==='function'?_difD(dtC,dtF):null;
    if(dCic!==null) tags+=sem(dCic,45,90,'ciclo com.');
  }

  return tags?'<div style="margin-top:.38rem;display:flex;flex-wrap:wrap">'+tags+'</div>':'';
}
function rProps(){
  var q=(Q('srch').value||'').toLowerCase();
  var list=props;
  if(q)list=list.filter(function(p){return (p.num||'').toLowerCase().indexOf(q)>=0||(p.cli||'').toLowerCase().indexOf(q)>=0||(p.tit||'').toLowerCase().indexOf(q)>=0});
  if(fltSt!=='all')list=list.filter(function(p){return p.fas===fltSt});
  var g=Q('pG');
  if(!list.length){g.innerHTML='<div class="emp" style="grid-column:1/-1"><div class="emp-i">📋</div><p>Nenhuma proposta encontrada</p></div>';return}
  g.innerHTML=list.map(function(p){
    var f=FASE[p.fas]||FASE.em_elaboracao||FASE.enviada;
    var pRevs=p.revs||[];
    var pRevCount=pRevs.length;
    var revAtual=(p.revAtual||'').trim().toUpperCase();
    // Badge de revisão atual no topo
    var revBadge=revAtual
      ?'<span style="font-size:.65rem;font-weight:700;background:rgba(88,166,255,.12);border:1px solid rgba(88,166,255,.3);color:#58a6ff;padding:.1rem .35rem;border-radius:3px;vertical-align:middle;margin-left:.35rem">Rev. '+revAtual+'</span>'
      :'';
    // Lista de revisões (mais recente primeiro)
    var revListHtml='';
    if(pRevCount>0){
      revListHtml=pRevs.slice().reverse().map(function(r,i){
        var isAtiva=!r.status||r.status==='ativa';
        var bg=isAtiva?'rgba(88,166,255,.07)':'var(--bg)';
        var brd=isAtiva?'1px solid rgba(88,166,255,.25)':'1px solid var(--border)';
        var lc=isAtiva?'#58a6ff':'var(--text3)';
        var dp=(r.dat||'').split('/');
        var sd=dp.length>=2?dp[0]+'/'+dp[1]:r.dat||'';
        // Valor: usa snapshot se arquivada, ou valor atual se ativa
        var snapVal=r.snapshot&&r.snapshot.val!=null?r.snapshot.val:(isAtiva?p.val:null);
        var valStr=snapVal!=null?'· '+money(snapVal):'';
        // Badge de status
        var stBadge=isAtiva
          ?'<span style="font-size:.6rem;background:rgba(88,166,255,.15);border:1px solid rgba(88,166,255,.3);color:#58a6ff;padding:.02rem .28rem;border-radius:3px;flex-shrink:0">'+((FASE[p.fas]&&FASE[p.fas].n)||p.fas)+'</span>'
          :'<span style="font-size:.6rem;background:var(--bg);border:1px solid var(--border);color:var(--text3);padding:.02rem .28rem;border-radius:3px;flex-shrink:0">Arquivada</span>';
        return '<div style="display:flex;align-items:center;gap:.3rem;padding:.2rem .35rem;border-radius:4px;border:'+brd+';background:'+bg+';margin-bottom:.1rem">'
          +'<span style="font-weight:700;font-size:.72rem;color:'+lc+';min-width:14px;text-align:center;flex-shrink:0">'+esc(r.rev)+'</span>'
          +'<span style="font-size:.66rem;color:var(--text3);flex-shrink:0">'+esc(sd)+(valStr?' <span style="color:var(--text2)">'+valStr+'</span>':'')+'</span>'
          +'<span style="flex:1"></span>'
          +stBadge
        +'</div>';
      }).join('');
    }
    // Rodapé colapsável + botão
    var revFooter=
      '<div style="position:relative;z-index:1;margin-top:.55rem;padding-top:.45rem;border-top:1px solid var(--border)" onclick="event.stopPropagation()">'
      +(pRevCount>0
        ?'<details style="margin-bottom:.35rem" onclick="event.stopPropagation()">'
          +'<summary style="cursor:pointer;font-size:.72rem;color:var(--text3);list-style:none;outline:none;display:flex;align-items:center;gap:.25rem" onclick="event.stopPropagation()">'
          +'<span style="font-size:.6rem;display:inline-block">▸</span>'+(pRevCount+(pRevCount===1?' revisão':' revisões'))
          +'</summary>'
          +'<div style="margin-top:.3rem">'+revListHtml+'</div>'
          +'</details>'
        :'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.35rem">Sem revisões</div>'
      )
      +'<button style="display:block;width:100%;padding:.28rem 0;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text2);cursor:pointer;font-size:.74rem;text-align:center" '
      +'onclick="addRevCard(\''+p.id+'\');event.stopPropagation();">+ Nova Revisão</button>'
      +'</div>';
    return '<div class="pc" onclick="fmAbrirProposta(\''+p.id+'\')">'
      +'<div class="pc-act" onclick="event.stopPropagation()">'
      +'<select onchange="chSt(\''+p.id+'\',this.value)">'+Object.keys(FASE).map(function(k){return'<option value="'+k+'"'+(p.fas===k?' selected':'')+'>'+FASE[k].n+'</option>'}).join('')+'</select>'
      +'<button class="pc-del" style="background:#2563eb" title="Duplicar proposta" onclick="dupProp(\''+p.id+'\');event.stopPropagation();">⧉</button>'+'<button class="pc-del" onclick="delP(\''+p.id+'\')">×</button></div>'
      +'<div class="pc-top"><span class="pc-num">'+esc(p.num)+'</span>'+revBadge+'<span class="pc-date">'+p.dat+'</span></div>'
      +'<div class="pc-val">'+money(p.val)+'</div>'
      +'<div class="pc-tit">'+esc(p.tit||'')+'</div>'
      +'<div class="pc-cli">'+esc(p.loc||p.cli||'')+'</div>'
      +(( p.locCnpj||p.cnpj)?'<div class="pc-sub">'+esc(p.locCnpj||p.cnpj)+'</div>':'')
      +((p.csvc||p.cid)?'<div class="pc-sub">📍 '+esc(p.csvc||p.cid)+'</div>':'')
      +((p.ac)?'<div class="pc-sub">👤 '+esc(p.ac)+'</div>':'')
      +'<span class="bdg '+f.c+'">'+f.i+' '+f.n+'</span>'+_propAlerts(p)
      +revFooter
      +'</div>'
  }).join('');
}
function addRevCard(id){ _abrirModalNovaRev(id); }

function _abrirModalNovaRev(propId, preSelectedRevId){
  var p=props.find(function(x){return x.id===propId});
  if(!p) return;
  var pRevs=p.revs||[];
  var nextLetter=String.fromCharCode(65+pRevs.length);

  // Determina revisão padrão: preSelectedRevId > última ativa > última da lista
  var defId=preSelectedRevId||'';
  if(!defId){
    for(var i=pRevs.length-1;i>=0;i--){
      if(!pRevs[i].status||pRevs[i].status==='ativa'){defId=pRevs[i].id;break;}
    }
  }
  if(!defId&&pRevs.length) defId=pRevs[pRevs.length-1].id;

  var optHtml='';
  if(pRevs.length>0){
    optHtml=pRevs.slice().reverse().map(function(r){
      var isAtiva=!r.status||r.status==='ativa';
      var hasSnap=!!r.snapshot;
      var canSelect=isAtiva||hasSnap;
      var lbl='Rev. '+r.rev+(r.desc?' — '+(r.desc.length>28?r.desc.substring(0,28)+'…':r.desc):'');
      var stTxt=isAtiva?' <span style="font-size:.65rem;color:#58a6ff">(ativa)</span>'
               :hasSnap?' <span style="font-size:.65rem;color:var(--text3)">(arquivada)</span>'
               :'<span style="font-size:.65rem;color:var(--text3)">(sem snapshot)</span>';
      return '<label style="display:flex;align-items:center;gap:.5rem;padding:.35rem .5rem;border-radius:5px;'
        +(canSelect?'cursor:pointer;':'opacity:.45;cursor:not-allowed;')
        +'background:var(--bg3);border:1px solid var(--border);margin-bottom:.22rem">'
        +'<input type="radio" name="_revBase" value="'+r.id+'"'
        +(r.id===defId?' checked':'')+(canSelect?'':' disabled')+'>'
        +'<span style="font-size:.8rem;color:var(--text)">'+esc(lbl)+stTxt+'</span>'
        +'</label>';
    }).join('');
  } else {
    optHtml='<p style="font-size:.8rem;color:var(--text3);margin:.3rem 0">Primeira revisão — criada com os dados atuais da proposta.</p>';
  }

  var ex=document.getElementById('_modalNovaRev');if(ex)ex.remove();
  var el=document.createElement('div');
  el.id='_modalNovaRev';
  el.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center';
  el.innerHTML=
    '<div onclick="event.stopPropagation()" style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:1.5rem;min-width:320px;max-width:460px;width:92%;max-height:85vh;overflow-y:auto">'
    +'<div style="font-size:1rem;font-weight:700;color:var(--text);margin-bottom:1.1rem">+ Nova Revisão <span style="color:var(--accent)">'+nextLetter+'</span></div>'
    +(pRevs.length>0
      ?'<div style="margin-bottom:1rem"><div style="font-size:.78rem;font-weight:600;color:var(--text3);margin-bottom:.45rem">Clonar a partir de:</div>'+optHtml+'</div>'
      :'<div style="margin-bottom:1rem">'+optHtml+'</div>')
    +'<div style="margin-bottom:1.2rem">'
      +'<div style="font-size:.78rem;font-weight:600;color:var(--text3);margin-bottom:.35rem">Descrição desta revisão:</div>'
      +'<input id="_novaRevDesc" type="text" placeholder="Ex: Ajuste de escopo conforme reunião…" autocomplete="off" style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:.45rem .6rem;color:var(--text);font-size:.83rem;outline:none">'
    +'</div>'
    +'<div style="display:flex;gap:.5rem;justify-content:flex-end">'
      +'<button onclick="document.getElementById(\'_modalNovaRev\').remove()" style="padding:.38rem .9rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text2);cursor:pointer;font-size:.82rem">Cancelar</button>'
      +'<button onclick="_confirmarNovaRev(\''+propId+'\')" style="padding:.38rem 1rem;background:var(--blue);border:none;border-radius:5px;color:#fff;cursor:pointer;font-size:.82rem;font-weight:600">Criar Rev. '+nextLetter+'</button>'
    +'</div>'
    +'</div>';
  el.addEventListener('click',function(e){if(e.target===el)el.remove();});
  document.body.appendChild(el);
  setTimeout(function(){var inp=document.getElementById('_novaRevDesc');if(inp)inp.focus();},80);
}

function _confirmarNovaRev(propId){
  // Sincroniza escSecs/budg/aliq do formulário de volta para props antes de tirar snapshot
  if(editId===propId && typeof buildCurrentProposalSnapshot==='function'){
    var _sn=buildCurrentProposalSnapshot();
    var _idx=props.findIndex(function(x){return x.id===propId;});
    if(_idx>=0) props[_idx]=_sn; else props.push(_sn);
  }
  var p=props.find(function(x){return x.id===propId});
  if(!p) return;
  var pRevs=p.revs?JSON.parse(JSON.stringify(p.revs)):[];
  var nextLetter=String.fromCharCode(65+pRevs.length);

  // 1. Congela revisão ativa atual com snapshot completo
  var activeIdx=-1;
  for(var i=pRevs.length-1;i>=0;i--){
    if(!pRevs[i].status||pRevs[i].status==='ativa'){activeIdx=i;break;}
  }
  if(activeIdx>=0){
    pRevs[activeIdx].snapshot=_snapProp(p);
    pRevs[activeIdx].status='arquivada';
  }

  // 2. Determina snapshot base para clonar
  var sel=document.querySelector('#_modalNovaRev input[name="_revBase"]:checked');
  var baseRevId=sel?sel.value:null;
  var baseSnap=null;
  var baseLetter=null;
  if(baseRevId){
    var bRev=pRevs.find(function(r){return r.id===baseRevId;});
    if(bRev){
      baseLetter=bRev.rev;
      baseSnap=bRev.snapshot||null;
    }
  }
  // Se não tem snapshot (revisão sem snapshot), usa estado live atual (já congelado acima)
  if(!baseSnap&&activeIdx>=0) baseSnap=pRevs[activeIdx].snapshot;

  // 3. Cria nova revisão ativa
  var desc=(document.getElementById('_novaRevDesc')||{}).value||'';
  desc=desc.trim();
  pRevs.push({id:uid(),rev:nextLetter,dat:new Date().toLocaleDateString('pt-BR'),por:'EJN',desc:desc,status:'ativa',base:baseLetter,snapshot:null});

  // 4. Aplica snapshot ao estado live da proposta
  _applySnapToProp(p,baseSnap);

  // 5. Atualiza metadados
  p.revs=pRevs;
  p.revAtual=nextLetter;
  var m=(p.num||'').match(/^(\d+)[A-Z]*\.(\d+)$/);
  if(m) p.num=m[1]+nextLetter+'.'+m[2];

  // 6. Fecha modal, salva e atualiza
  var modal=document.getElementById('_modalNovaRev');if(modal)modal.remove();
  saveAll();
  rProps();
  toast('✔ Rev. '+nextLetter+' criada'+(baseLetter?' a partir da Rev. '+baseLetter:'')+' — '+esc(p.num),'ok');
}

function _desfazerUltimaRev(propId){
  var p=props.find(function(x){return x.id===propId}); if(!p) return;
  var pRevs=p.revs?JSON.parse(JSON.stringify(p.revs)):[];
  if(pRevs.length<2){ toast('Não há revisão anterior para restaurar.','err'); return; }
  var ultima=pRevs[pRevs.length-1];
  if(ultima.status!=='ativa'){ toast('Apenas a revisão ativa pode ser desfeita.','err'); return; }
  if(!confirm('Desfazer a Rev. '+ultima.rev+'?\n\nEla será excluída e a revisão anterior será reativada com seus dados originais.')){ return; }
  // Remove a revisão ativa
  pRevs.pop();
  // Reativa a última arquivada
  var anterior=pRevs[pRevs.length-1];
  var anteriorSnap=anterior.snapshot||null;
  anterior.status='ativa';
  p.revs=pRevs;
  p.revAtual=anterior.rev;
  var m=(p.num||'').match(/^(\d+)[A-Z]*\.(\d+)$/);
  if(m) p.num=m[1]+anterior.rev+'.'+m[2];
  // Restaura estado live da proposta com o snapshot da revisão anterior
  if(anteriorSnap) _applySnapToProp(p,anteriorSnap);
  saveAll();
  // Atualiza o editor se estiver aberto nesta proposta
  if(editId===propId){
    editP(propId);
    try{ rBudg(); updBT(); updKpi(); rRevs(); }catch(e){}
  }
  rProps();
  toast('↩ Rev. '+ultima.rev+' desfeita — Rev. '+anterior.rev+' reativada.','ok');
}

function chSt(id,s){
  var p=props.find(function(x){return x.id===id});
  if(!p) return;
  // Se está saindo de um status fechado e indo para outro fechado, atualiza direto
  var jaFechado = FAS_FECHADO.indexOf(p.fas)>=0;
  var vaiFicarFechado = FAS_FECHADO.indexOf(s)>=0;
  if(vaiFicarFechado){
    // Abre modal de confirmação de fechamento para preencher dtFech e verificar dat2
    _abrirFechModal(id, s);
  } else {
    // Abrindo novamente (saindo de fechado para aberto) — só troca a fase
    p.fas=s;
    saveAll();rDash();
    if(s==='cancelada'||s==='virou_outra_proposta'){
      editId=id;
      abrirLog();
    }
  }
}

// ── MODAL DE CONFIRMAÇÃO DE FECHAMENTO ───────────────────────────────────────
var _fechModalPropId=null, _fechModalFase=null;
function _abrirFechModal(id, fase){
  var p=props.find(function(x){return x.id===id}); if(!p) return;
  _fechModalPropId=id; _fechModalFase=fase;
  var hoje=new Date().toISOString().slice(0,10);
  var dtAtual=p.dtFech||hoje;
  var f=FASE[fase]||{n:fase,i:'✅'};
  var m=Q('fechConvModal'); if(!m) return;
  // Preenche dados do modal
  var el=Q('fcmTitulo'); if(el) el.textContent=f.i+' '+f.n;
  var ep=Q('fcmPropInfo');
  if(ep) ep.textContent='Nº '+esc(p.num)+' — '+esc(p.loc||p.cli||'')+(p.tit?' | '+esc(p.tit):'');
  var ev=Q('fcmValor');
  if(ev) ev.textContent=money(n2(p.val));
  var ed=Q('fcmDtFech'); if(ed){ ed.value=dtAtual; }
  m.style.display='flex';
  if(ed) setTimeout(function(){ed.focus();},120);
}
function _fecharFechModal(){
  var m=Q('fechConvModal'); if(m) m.style.display='none';
  _fechModalPropId=null; _fechModalFase=null;
}
function _confirmarFechModal(){
  var id=_fechModalPropId, fase=_fechModalFase;
  if(!id||!fase) return;
  var p=props.find(function(x){return x.id===id}); if(!p){_fecharFechModal();return;}
  var edDt=Q('fcmDtFech');
  var dtFech=edDt&&edDt.value?edDt.value:'';
  if(!dtFech){
    // Alerta visual no campo
    if(edDt){edDt.style.borderColor='var(--red)';edDt.focus();}
    toast('Informe a Data de Fechamento para continuar.','err');
    return;
  }
  // Aplica fase + dtFech
  p.fas=fase;
  p.dtFech=dtFech;
  // Garante dat2 (usado em getPropsAno para filtrar por ano)
  if(!p.dat2){
    // tenta converter dat DD/MM/YYYY para ISO
    var ps=String(p.dat||'').split('/');
    if(ps.length===3 && ps[2].length===4){
      p.dat2=ps[2]+'-'+ps[1]+'-'+ps[0];
    } else {
      p.dat2=new Date().toISOString().slice(0,10);
    }
  }
  _fecharFechModal();
  saveAll(); rDash();
  toast('✔ Proposta movida para '+((FASE[fase]&&FASE[fase].n)||fase)+' com data '+dtFech.split('-').reverse().join('/'),'ok');
}

function delP(id){
  if(confirm('Excluir proposta?')){
    props=props.filter(function(p){return p.id!==id});
    saveAll();
    rDash();
    // Deletar também no Supabase
    if(window.sbClient){
      window.sbClient.from('propostas').delete().eq('app_id', String(id))
        .then(function(r){
          if(r.error) console.error('[delP] erro Supabase:', r.error.message);
          else console.log('%c[delP] proposta excluída da nuvem: '+id, 'color:#f85149;font-weight:700');
        });
    }
  }
}

function dupProp(id){
  try{
    var p = props.find(function(x){ return x.id===id; });
    if(!p){ toast('Proposta não encontrada.','err'); return; }

    var cp = JSON.parse(JSON.stringify(p));
    cp.id = uid();

    // gera novo número automático usando o contador atual
    cp.num = nN();
    cp.fas = 'em_elaboracao';
    cp.dat2 = '';
    cp.dat = new Date().toLocaleDateString('pt-BR');

    props.push(cp);
    advN();
    saveAll();
    rDash();
    toast('✔ Proposta duplicada!','ok');
  }catch(e){
    console.error(e);
    alert('Erro ao duplicar proposta.');
  }
}

function editP(id){
  try{
  var p=props.find(function(x){return x.id===id});if(!p){console.error('editP: proposta não encontrada id='+id);return;}
  editId=id;_tempGantt=null;
  Q('pNum').value=p.num||'';Q('pDat').value=p.dat2||'';Q('pCli').value=p.cli||'';
  if(Q('pDatFech'))Q('pDatFech').value=p.dtFech||'';
  // Carregar timeline
  if(typeof tlCarregarDados==="function") tlCarregarDados(p.tl||{});
  if(Q('pRevAtual'))Q('pRevAtual').value=p.revAtual||'';
  Q('pCnpj').value=p.cnpj||'';Q('pCid').value=p.cid||'';Q('pAC').value=p.ac||'';
  Q('pDep').value=p.dep||'';Q('pMail').value=p.mail||'';Q('pTel').value=p.tel||'';
  Q('pLoc').value=p.loc||'';Q('pCsv').value=p.csvc||'';Q('pTit').value=p.tit||'';
  if(Q('pArea'))Q('pArea').value=p.area||'';
  if(Q('pEquip'))Q('pEquip').value=p.equip||'';
  if(Q('pLocCnpj'))Q('pLocCnpj').value=p.locCnpj||'';
  if(Q('pAC2'))Q('pAC2').value=p.ac2||'';
  if(Q('pDep2'))Q('pDep2').value=p.dep2||'';
  if(Q('pMail2'))Q('pMail2').value=p.mail2||'';
  if(Q('pTel2'))Q('pTel2').value=p.tel2||'';
  if(Q('pTensVal'))Q('pTensVal').value=p.tensVal||'';
  if(Q('pTensCmd'))Q('pTensCmd').value=p.tensCmd||'';
  var tens=p.tens||[];['pT1F','pT2F','pT3F','pTN','pTPE'].forEach(function(id){var el=Q(id);if(el)el.checked=tens.indexOf(id)>=0;});
  if(Q('fu1dat'))Q('fu1dat').value=p.fu1dat||'';if(Q('fu1desc'))Q('fu1desc').value=p.fu1desc||'';
  if(Q('fu2dat'))Q('fu2dat').value=p.fu2dat||'';if(Q('fu2desc'))Q('fu2desc').value=p.fu2desc||'';
  if(Q('fu3dat'))Q('fu3dat').value=p.fu3dat||'';if(Q('fu3desc'))Q('fu3desc').value=p.fu3desc||'';
  if(Q('fu4dat'))Q('fu4dat').value=p.fu4dat||'';if(Q('fu4desc'))Q('fu4desc').value=p.fu4desc||'';
  if(typeof rFuBadge==='function') rFuBadge();
  Q('pRes').value=p.res||'';Q('pFas').value=p.fas||'em_elaboracao';
  Q('vS').value=p.vS||0;Q('vM').value=p.vM||0;Q('vD').value=p.vD||0;
  // Restaurar descontos separados por tipo
  if(Q('vDSval'))Q('vDSval').value=p.vDS?p.vDS.toFixed(2):'';
  if(Q('vDMval'))Q('vDMval').value=p.vDM?p.vDM.toFixed(2):'';
  // Recalcular percentuais correspondentes
  if(p.vDS&&p.vDS>0&&p.vS>0&&Q('vDSpct'))Q('vDSpct').value=(p.vDS/p.vS*100).toFixed(2);
  else if(Q('vDSpct'))Q('vDSpct').value='';
  if(p.vDM&&p.vDM>0&&p.vM>0&&Q('vDMpct'))Q('vDMpct').value=(p.vDM/p.vM*100).toFixed(2);
  else if(Q('vDMpct'))Q('vDMpct').value='';

  // Restaurar categorias salvas na proposta (se existirem)
  // prc da proposta fica em p.prc e é usado via getPrcAtual()
  // Restaurar alíquotas salvas na proposta (se existirem)
  if(p.aliq){
    var al=p.aliq;
    if(al.nfS !==null&&al.nfS !==undefined&&Q('aNFS')) Q('aNFS').value=parseFloat(((al.nfS )*100).toFixed(4));
    if(al.nfM !==null&&al.nfM !==undefined&&Q('aNFM')) Q('aNFM').value=parseFloat(((al.nfM )*100).toFixed(4));
    if(al.rS  !==null&&al.rS  !==undefined&&Q('aRS'))  Q('aRS').value =parseFloat(((al.rS  )*100).toFixed(4));
    if(al.comS!==null&&al.comS!==undefined&&Q('aComS'))Q('aComS').value=parseFloat(((al.comS)*100).toFixed(4));
    if(al.comM!==null&&al.comM!==undefined&&Q('aComM'))Q('aComM').value=parseFloat(((al.comM)*100).toFixed(4));
    if(al.neg !==null&&al.neg !==undefined&&Q('aNeg')) Q('aNeg').value =parseFloat(((al.neg )*100).toFixed(4));
    if(Q('aNegZero')) Q('aNegZero').checked = p.fechadoSemDesc===true;
  }


  // Carregar escopo livre — converter string para array se necessário
  var rawEsc = p.esc||[];
  if(typeof rawEsc === 'string' && rawEsc.trim()){
    // Importado via JSON como string — converter para seções
    var linhas = rawEsc.split(/\n(?=\d+\.|[A-Z]{2,})/).filter(Boolean);
    rawEsc = linhas.length > 1
      ? linhas.map(function(bloco){
          var lines = bloco.split('\n');
          var titulo = lines[0].replace(/^\d+\.\s*/,'').trim();
          var desc = lines.slice(1).join('\n').trim();
          return {id:uid(), num:'', titulo:titulo, desc:desc, subs:[]};
        })
      : [{id:uid(), num:'', titulo:'Escopo', desc:rawEsc, subs:[]}];
  }
  // Normalizar todos os formatos possíveis de esc[] {t,c} -> {titulo,desc}
  var rawNorm = (Array.isArray(rawEsc) ? rawEsc : []).map(function(s){
    if(!s) return null;
    return {
      id:    s.id    || uid(),
      num:   s.num   || '',
      titulo:s.titulo|| s.t || s.nome || '',
      desc:  s.desc  || s.c || s.conteudo || '',
      subs:  Array.isArray(s.subs) ? s.subs.map(function(sb){
        return {id:sb.id||uid(), num:sb.num||'', nome:sb.nome||sb.titulo||sb.t||'', desc:sb.desc||sb.c||sb.conteudo||''};
      }) : []
    };
  }).filter(Boolean);
  escSecs = JSON.parse(JSON.stringify(rawNorm));


  // Sem filtro - todas as seções ficam visíveis no editor

  budg=JSON.parse(JSON.stringify(p.bi||[]));
  tplEdits={};
  // ── Migração definitiva: ts → escSecs usando todas as fontes disponíveis ──
  if(!escSecs.length && p.ts && p.ts.length){
    var _tpls  = getTpls();
    var _etpls = getEscTpls();
    p.ts.forEach(function(tid){
      // Buscar por ID em tf_tpls ou DEFT
      var t = _tpls.find(function(x){return x.id===tid})
           || DEFT.find(function(x){return x.id===tid});
      if(!t) return;
      var titulo = t.titulo||'';
      // Texto real: preferir tf_etpl (banco de escopos editado) depois template
      var et = _etpls.find(function(e){
        return e.titulo && e.titulo.toLowerCase()===titulo.toLowerCase();
      });
      var desc = et ? (et.desc||et.conteudo||'') : (t.conteudo||t.desc||'');
      var jaExiste = escSecs.some(function(s){
        return s.titulo && s.titulo.toLowerCase()===titulo.toLowerCase();
      });
      if(!jaExiste) escSecs.push({id:uid(),num:'',titulo:titulo,desc:desc,subs:[]});
    });
  }
  // selTpl só fica populado se migração falhou (fallback para genPrev)
  selTpl = escSecs.length ? [] : (p.ts ? p.ts.slice() : []);

  revs=JSON.parse(JSON.stringify(p.revs||[]));
  // Se revAtual estiver vazio mas houver uma revisão ativa nas revs, sincroniza
  if(!p.revAtual && revs.length){
    var _revAtiva=revs.find(function(r){return r.status==='ativa';})||revs[revs.length-1];
    if(_revAtiva){
      p.revAtual=_revAtiva.rev;
      if(Q('pRevAtual'))Q('pRevAtual').value=_revAtiva.rev;
      var _mN=(p.num||'').match(/^(\d+)[A-Z]*\.(\d+)$/);
      if(_mN){ p.num=_mN[1]+_revAtiva.rev+'.'+_mN[2]; Q('pNum').value=p.num; }
    }
  }
  rRevs();
  cTot();
  if(Q('escTplModal'))Q('escTplModal').style.display='none';
  go('nova',null);
  showActionBar(p);
  setTimeout(function(){
    step(2);
    rBudg();   // renderiza tabela de itens do orçamento
    updBT();   // sincroniza totais do orçamento
    updKpi();  // atualiza KPIs com as alíquotas restauradas
  }, 150);
  }catch(e){console.error('Erro em editP:',e);alert('Erro ao abrir proposta: '+e.message);}
}
function saveP(){
  var num=(Q('pNum').value||'').trim(),cli=(Q('pCli').value||'').trim();
  if(!num||!cli){alert('Preencha Nº e Cliente.');return}
  var isNew=!editId;
  // Auto-criar Rev A se a proposta ainda não tem nenhuma revisão
  if(revs.length===0){
    var _hoje=new Date().toLocaleDateString('pt-BR');
    revs=[{id:uid(),rev:'A',dat:_hoje,por:'EJN',desc:'',status:'ativa',snapshot:null}];
    if(Q('pRevAtual'))Q('pRevAtual').value='A';
    var _numAtual=(Q('pNum').value||'').trim();
    var _mRev=_numAtual.match(/^(\d+)[A-Z]*\.(\d+)$/);
    if(_mRev)Q('pNum').value=_mRev[1]+'A.'+_mRev[2];
    rRevs();
  }
  var sn=buildCurrentProposalSnapshot();
  // ── V466: garante dtFech e dat2 ao salvar proposta fechada ──
  if(FAS_FECHADO.indexOf(sn.fas)>=0){
    if(!sn.dtFech){
      sn.dtFech=new Date().toISOString().slice(0,10);
      if(Q('pDatFech')) Q('pDatFech').value=sn.dtFech;
    }
    if(!sn.dat2){
      var _ps=String(sn.dat||'').split('/');
      sn.dat2=(_ps.length===3&&_ps[2].length===4)?(_ps[2]+'-'+_ps[1]+'-'+_ps[0]):new Date().toISOString().slice(0,10);
    }
  }
  if(editId){
    var idx=props.findIndex(function(x){return x.id===editId});
    if(idx>=0) props[idx]=sn; else props.push(sn);
  }else{
    props.push(sn);
    advN(); // avança o contador; número do form muda, mas sn já foi salvo com o número correto
  }
  editId=sn.id;saveAll();rDash();
  // Atualiza o campo de número no form para refletir o que foi salvo (com letra da revisão)
  if(Q('pNum')&&sn.num) Q('pNum').value=sn.num;
  if(Q('pRevAtual')&&sn.revAtual) Q('pRevAtual').value=sn.revAtual;
  try{showActionBar(sn);}catch(e){}
  toast('✔Proposta salva!','ok');
}

// VALORES
function cTot(){
  var vS=n2(Q('vS')&&Q('vS').value);
  var vM=n2(Q('vM')&&Q('vM').value);
  var dS=n2(Q('vDSval')&&Q('vDSval').value)||0;
  var dM=n2(Q('vDMval')&&Q('vDMval').value)||0;
  var vD=dS+dM;
  if(Q('vD'))Q('vD').value=vD.toFixed(2);
  var liqS=Math.max(0,vS-dS);
  var liqM=Math.max(0,vM-dM);
  var total=liqS+liqM;
  if(Q('vTD'))Q('vTD').textContent=money(total);
  if(Q('vTS_liq'))Q('vTS_liq').textContent=money(liqS);
  if(Q('vTM_liq'))Q('vTM_liq').textContent=money(liqM);
  if(Q('vTS_desc'))Q('vTS_desc').textContent=dS>0?'– '+money(dS)+' de desconto':'';
  if(Q('vTM_desc'))Q('vTM_desc').textContent=dM>0?'– '+money(dM)+' de desconto':'';
  if(Q('vDesc_total'))Q('vDesc_total').textContent=money(vD);

  if(typeof cStep!=='undefined' && (cStep===3 || cStep===5)){
    syncValorDependentes(false);
  }
}

// Sincroniza % ↔ R$ para Serviços
function calcDescS(origem){
  var vS=n2(Q('vS')&&Q('vS').value);if(vS<=0)return;
  if(origem==='pct'){
    var pct=n2(Q('vDSpct').value);
    if(Q('vDSval'))Q('vDSval').value=(vS*pct/100).toFixed(2);
  } else {
    var val=n2(Q('vDSval').value);
    if(Q('vDSpct'))Q('vDSpct').value=vS>0?(val/vS*100).toFixed(2):'0';
  }
  cTot();updKpi();
}

// Sincroniza % ↔ R$ para Materiais
function calcDescM(origem){
  var vM=n2(Q('vM')&&Q('vM').value);if(vM<=0)return;
  if(origem==='pct'){
    var pct=n2(Q('vDMpct').value);
    if(Q('vDMval'))Q('vDMval').value=(vM*pct/100).toFixed(2);
  } else {
    var val=n2(Q('vDMval').value);
    if(Q('vDMpct'))Q('vDMpct').value=vM>0?(val/vM*100).toFixed(2):'0';
  }
  cTot();updKpi();
}

// Aplica desconto de Serviços: subtrai do vS e zera os campos de desconto
function aplicarDescS(){
  var vS=n2(Q('vS').value);
  var dS=n2(Q('vDSval')&&Q('vDSval').value)||0;
  if(dS<=0){toast('Informe um desconto de Serviços.','err');return;}
  if(dS>vS){toast('Desconto maior que o valor de Serviços!','err');return;}
  Q('vS').value=(vS-dS).toFixed(2);
  Q('vDSval').value='';Q('vDSpct').value='';
  cTot();updKpi();syncValorDependentes(true);
  toast('Desconto de '+money(dS)+' aplicado em Serviços.','ok');
}

// Aplica desconto de Materiais: subtrai do vM e zera os campos de desconto
function aplicarDescM(){
  var vM=n2(Q('vM').value);
  var dM=n2(Q('vDMval')&&Q('vDMval').value)||0;
  if(dM<=0){toast('Informe um desconto de Materiais.','err');return;}
  if(dM>vM){toast('Desconto maior que o valor de Materiais!','err');return;}
  Q('vM').value=(vM-dM).toFixed(2);
  Q('vDMval').value='';Q('vDMpct').value='';
  cTot();updKpi();syncValorDependentes(true);
  toast('Desconto de '+money(dM)+' aplicado em Materiais.','ok');
}

function updKpi(){
  var kpiGrid=Q('kpiGrid');if(!kpiGrid)return;
  var cfg=getPrcAtual(); // FIX V345 #4: era getPrc() — agora usa alíquotas da proposta em edição
  var pvS=n2(Q('vS')&&Q('vS').value);
  var pvM=n2(Q('vM')&&Q('vM').value);
  var desc=n2(Q('vD')&&Q('vD').value);
  // Itens excluídos / terceiros - mostrar nota nos KPIs
  var nExcl=budg.filter(function(x){return x.inc===false}).length;
  var nTerc=budg.filter(function(x){return x.terc===true&&x.inc!==false}).length;
  var pvTot=(pvS+pvM)-desc;
  var notas='';
  if(nExcl>0) notas+='<span style="background:rgba(255,255,255,.06);border-radius:4px;padding:.15rem .5rem">⚠️ '+nExcl+' item(ns) excluído(s) do total</span> ';
  if(nTerc>0) notas+='<span style="background:rgba(249,115,22,.1);border-radius:4px;padding:.15rem .5rem;color:#f97316">🤝 '+nTerc+' item(ns) por terceiro</span>';
  if(pvTot<=0){kpiGrid.innerHTML='<p style="color:var(--text3);font-size:.8rem">Preencha os valores no Step 4 para ver a rentabilidade.</p>'+(notas?'<div style="margin-top:.5rem;display:flex;gap:.4rem;flex-wrap:wrap;font-size:.72rem">'+notas+'</div>':''); if(Q('orcIndicadores')) Q('orcIndicadores').innerHTML='<p style="color:var(--text3);font-size:.8rem">Adicione itens e use os valores do orçamento para visualizar os indicadores.</p>'; return;}

  // Alíquotas (campos exibem %, dividir por 100 para decimal)
  var nfS =Q('aNFS')&&Q('aNFS').value!==''?n2(Q('aNFS').value)/100:cfg.aliq.nfS;
  var nfM =Q('aNFM')&&Q('aNFM').value!==''?n2(Q('aNFM').value)/100:cfg.aliq.nfM;
  var rs  =Q('aRS') &&Q('aRS').value!=='' ?n2(Q('aRS').value)/100 :cfg.aliq.rS;
  var comS=Q('aComS')&&Q('aComS').value!==''?n2(Q('aComS').value)/100:(cfg.aliq.comS!=null?cfg.aliq.comS:0.05);
  var comM=Q('aComM')&&Q('aComM').value!==''?n2(Q('aComM').value)/100:(cfg.aliq.comM!=null?cfg.aliq.comM:0.03);
  var neg =Q('aNeg') &&Q('aNeg').value!=='' ?n2(Q('aNeg').value)/100 :(cfg.aliq.neg !=null?cfg.aliq.neg :0.05);
  var fechadoSemDesc = Q('aNegZero')&&Q('aNegZero').checked;

  // Custos diretos por tipo
  // FIX V345 #7 — lógica de custo unificada para serviço E material:
  // • terc=true  → você compra/paga o terceiro → custo ABATE o lucro
  // • terc=false → item próprio (MO da equipe ou material de estoque) → custo NÃO abate o lucro (PV vira receita pura)
  // custoSTot/custoMTot = custo real por tipo para os cards visuais (independe de terc)
  var custoS=0,custoM=0,custoTerc=0,custoSTot=0,custoMTot=0,custoTercS=0,custoTercM=0;
  budg.forEach(function(it){
    if(it.inc===false) return;
    var cItem = n2(it.cu)*n2(it.mult);
    if(it.terc===true){
      // Terceiro (serviço ou material): você paga → abate lucro
      custoTerc += cItem;
      if(it.t==='material'){ custoMTot += cItem; custoTercM += cItem; }
      else { custoSTot += cItem; custoTercS += cItem; }
      return;
    }
    // Item próprio (MO da equipe OU material de estoque):
    // custo visual registrado, mas NÃO abate o LL — PV é receita pura
    if(it.t==='material') custoMTot += cItem;
    else custoSTot += cItem;
  });
  // custoTotal: APENAS itens terceirizados (serviço ou material que você paga)
  var custoTotal=custoTerc;

  // Deduções sobre PV (impostos + comissões + desconto — sem reserva de negociação)
  var deducNFS  = pvS * nfS;
  var deducNFM  = pvM * nfM;
  var deducRS   = pvS * rs;   // RS incide SOMENTE sobre serviços (E1)
  var deducComS = pvS * comS;
  var deducComM = pvM * comM;
  var deducNeg  = pvTot * neg;  // reserva — calculada mas não entra no totalDeduc
  var totalDeduc = deducNFS+deducNFM+deducRS+deducComS+deducComM+desc;

  // LUCRO LÍQUIDO = potencial máximo (sem reserva de negociação)
  var ll = pvTot - custoTotal - totalDeduc;
  var llPct = pvTot>0 ? (ll/pvTot)*100 : 0;

  // Lucro por origem da receita (sem reserva)
  var dS = n2(Q('vDSval')&&Q('vDSval').value)||0;
  var dM = n2(Q('vDMval')&&Q('vDMval').value)||0;
  var recSliq = Math.max(0, pvS - dS);
  var recMliq = Math.max(0, pvM - dM);
  var rsS = pvTot>0 ? deducRS*(recSliq/pvTot) : 0;
  var rsM = pvTot>0 ? deducRS*(recMliq/pvTot) : 0;
  // custoTercS/custoTercM = parcela do custo de terceiros por tipo de receita
  var llS = recSliq - custoTercS - deducNFS - deducComS - rsS;
  var llM = recMliq - custoTercM - deducNFM - deducComM - rsM;
  var llSPct = recSliq>0 ? (llS/recSliq)*100 : 0;
  var llMPct = recMliq>0 ? (llM/recMliq)*100 : 0;

  // LUCRO LÍQUIDO APÓS RESERVA = o que sobra se der o desconto máximo
  var pvNeg, llNeg, llNegPct, negLabel, negSub;
  if(desc > 0){
    pvNeg = pvTot;
    llNeg = ll;
    llNegPct = llPct;
    var descPct = (pvS+pvM)>0 ? (desc/(pvS+pvM)*100) : 0;
    negLabel = 'Com Desconto Aplicado';
    negSub   = 'Desconto de '+descPct.toFixed(1)+'% ('+money(desc)+') já aplicado';
  } else if(fechadoSemDesc && neg > 0){
    // Cliente fechou sem negociar — reserva vira lucro real
    pvNeg = pvTot;
    llNeg = ll;  // igual ao LL pois reserva não foi usada
    llNegPct = llPct;
    negLabel = '✅ Fechado sem desconto';
    negSub   = 'Reserva de '+money(deducNeg)+' incorporada ao lucro — cliente não negociou';
  } else if(neg > 0){
    pvNeg = pvTot;
    llNeg = ll - deducNeg;
    llNegPct = pvTot>0?(llNeg/pvTot)*100:0;
    negLabel = 'Lucro após Reserva ('+(neg*100).toFixed(0)+'%)';
    negSub   = 'Reserva: '+money(deducNeg)+' → lucro se der desconto máximo: '+llNegPct.toFixed(1)+'%';
  } else {
    pvNeg = pvTot; llNeg = ll; llNegPct = llPct;
    negLabel = 'Margem de Negociação';
    negSub   = 'Nenhuma margem de negociação configurada';
  }

  function kpiBox(icon,label,val,sub,color){
    return '<div style="background:var(--bg3);border-radius:var(--r);padding:.7rem .9rem;border-left:3px solid '+color+'">'
      +'<div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">'+icon+' '+label+'</div>'
      +'<div style="font-size:1.1rem;font-weight:700;color:'+color+'">'+val+'</div>'
      +(sub?'<div style="font-size:.7rem;color:var(--text3);margin-top:.1rem">'+sub+'</div>':'')
      +'</div>';
  }

  var llColor = ll>=0?(llPct>=20?'#3fb950':llPct>=10?'#d4a017':'#f97316'):'#f85149';
  var negColor= llNeg>=0?'#58a6ff':'#f85149';
  var precoMin = custoTotal + totalDeduc;
  var margemAposDesc = (neg > 0 && !fechadoSemDesc) ? llNegPct : llPct;
  var _card2labelB = (neg > 0 && !fechadoSemDesc) ? '2⃣ Margem líquida após reserva Neg ('+( neg*100).toFixed(0)+'%)' : '2⃣ Margem líquida (proposta sem desconto)';
  var _card2descB  = (neg > 0 && !fechadoSemDesc) ? 'LL após deduzir a reserva de negociação de '+(neg*100).toFixed(0)+'% — valor real se o cliente receber o desconto máximo.' : 'Lucro líquido após descontos, impostos, taxas e comissões.';
  var riscoFin = pvTot>0 ? (totalDeduc/pvTot)*100 : 0;
  var riscoTxt = riscoFin>=30?'ALTO':(riscoFin>=20?'MÉDIO':'BAIXO');
  var riscoCor = riscoFin>=30?'#f85149':(riscoFin>=20?'#d4a017':'#3fb950');
  var descMaxPct = pvTot>0 ? Math.max(0,(ll/pvTot)*100) : 0;
  var descMaxVal = pvTot>0 ? Math.max(0,ll) : 0;
  var descMaxCor = descMaxPct>=20 ? '#3fb950' : (descMaxPct>=10 ? '#d4a017' : '#f85149');

  var llSCor = llS>=0?(llSPct>=20?'#3fb950':llSPct>=10?'#d4a017':'#f97316'):'#f85149';
  var llMCor = llM>=0?(llMPct>=20?'#3fb950':llMPct>=10?'#d4a017':'#f97316'):'#f85149';

  // kpiBox helper para bloco visão geral
  var kpiBoxStr = function(icon,label,val,sub,color){
    return '<div style="background:var(--bg3);border-radius:var(--r);padding:.7rem .9rem;border-left:3px solid '+color+'">'
      +'<div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">'+icon+' '+label+'</div>'
      +'<div style="font-size:1.1rem;font-weight:700;color:'+color+'">'+val+'</div>'
      +(sub?'<div style="font-size:.7rem;color:var(--text3);margin-top:.1rem">'+sub+'</div>':'')
      +'</div>';
  };

  var advCards =
    '<div style="display:flex;flex-direction:column;gap:.8rem;width:100%">'

    // BLOCO 0: Visão Geral
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:.7rem">'
      +kpiBoxStr('💵','Receita Total', money(pvTot), 'Preço de venda líquido de desconto','#8b949e')
      +kpiBoxStr('🔧','Custo Direto', money(custoTotal), 'Materiais + terceiros (MO própria coberta no PV)','#bc8cff')
      +kpiBoxStr('📋','Total Deduções', money(totalDeduc), 'NF + RS + Comissões + Desconto','#f97316')
      +kpiBoxStr('✅', fechadoSemDesc?'Lucro Real Realizado':'Lucro Líquido Total', money(ll), llPct.toFixed(1)+'% da receita total', llColor)
    +'</div>'

    
    // BLOCO 0b: Custo e PV separados por tipo
    +'<div style="border-top:1px solid var(--border);padding-top:.6rem">'
      +'<div style="font-size:.67rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">📊 Custo &amp; Receita por Tipo</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:.55rem">'
        +kpiBoxStr('🔵 Custo','Serviços', money(custoSTot), (custoSTot>0&&pvS>0?'Markup: '+((pvS/custoSTot-1)*100).toFixed(1)+'%  |  ':'')+'PV: '+money(pvS), '#58a6ff')
        +kpiBoxStr('🔵 PV','Serviços', money(pvS), pvTot>0?(pvS/pvTot*100).toFixed(1)+'% da receita total':'—', '#3fb950')
        +kpiBoxStr('🟣 Custo','Materiais', money(custoMTot), (custoMTot>0&&pvM>0?'Markup: '+((pvM/custoMTot-1)*100).toFixed(1)+'%  |  ':'')+'PV: '+money(pvM), '#bc8cff')
        +kpiBoxStr('🟣 PV','Materiais', money(pvM), pvTot>0?(pvM/pvTot*100).toFixed(1)+'% da receita total':'—', '#a78bfa')
      +'</div>'
    +'</div>'

// BLOCO 1: Indicadores
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.7rem">'
      +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem">'
        +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">1️⃣ Break even (ponto de equilíbrio)</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:#f59e0b">'+money(precoMin)+'</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">Valor mínimo para cobrir custos + deduções sem prejuízo.</div>'
      +'</div>'
      +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem">'
        +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">'+_card2labelB+'</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:'+llColor+'">'+margemAposDesc.toFixed(1)+'%</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">'+_card2descB+'</div>'
      +'</div>'
      +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem">'
        +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">3️⃣ Risco financeiro</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:'+riscoCor+'">'+riscoTxt+' ('+riscoFin.toFixed(1)+'%)</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">Peso das deduções sobre a receita total da proposta.</div>'
      +'</div>'
      +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem">'
        +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">4️⃣ Desconto máximo possível</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:'+descMaxCor+'">'+descMaxPct.toFixed(1)+'%</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">Equivale a '+money(descMaxVal)+' antes de zerar o lucro.</div>'
      +'</div>'
      +(custoTotal>0
        ? '<div style="background:var(--bg3);border:1px solid #58a6ff;border-radius:var(--r);padding:.8rem .9rem;grid-column:1/-1">'
          +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.35rem">5⃣ FM Global — Fator de Multiplicação da Proposta (PV ÷ Custo)</div>'
          +'<div style="display:flex;align-items:baseline;gap:1.2rem;flex-wrap:wrap">'
            +'<div style="font-size:1.6rem;font-weight:900;color:#58a6ff;letter-spacing:.01em">×'+(pvTot/custoTotal).toFixed(4)+'</div>'
            +'<div style="font-size:.72rem;color:var(--text3);">'
              +'<div>PV Total: '+money(pvTot)+'</div>'
              +'<div>Custo Total: '+money(custoTotal)+'</div>'
            +'</div>'
            +(custoSTot>0
              ? '<div style="font-size:.72rem;color:var(--text3);border-left:1px solid var(--border);padding-left:.9rem">'
                  +'<div style="font-size:.62rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Serviços</div>'
                  +'<div style="font-size:1rem;font-weight:700;color:#58a6ff">×'+(pvS/custoSTot).toFixed(4)+'</div>'
                +'</div>'
              : '')
          +'</div>'
        +'</div>'
        : '')
    +'</div>'

    // BLOCO 3: Por Origem da Receita
    +'<div style="border-top:1px solid var(--border);padding-top:.7rem">'
      +'<div style="font-size:.67rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.5rem">📌 Lucro Líquido por Origem</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.7rem">'
        +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem;border-left:3px solid #58a6ff">'
          +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">🔵 Serviços</div>'
          +'<div style="font-size:1.1rem;font-weight:800;color:'+llSCor+'">'+money(llS)+'</div>'
          +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">'+(recSliq>0?llSPct.toFixed(1)+'% — receita líquida: '+money(recSliq):'Sem receita de serviços')+'</div>'
        +'</div>'
        +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem;border-left:3px solid #bc8cff">'
          +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">🟣 Materiais</div>'
          +'<div style="font-size:1.1rem;font-weight:800;color:'+llMCor+'">'+money(llM)+'</div>'
          +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">'+(recMliq>0?llMPct.toFixed(1)+'% — receita líquida: '+money(recMliq):'Sem receita de materiais')+'</div>'
        +'</div>'
        +(neg>0 && !fechadoSemDesc
          ? '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem;border-left:3px solid '+negColor+'">'
            +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">8️⃣ Lucro Após Reserva ('+(neg*100).toFixed(0)+'%)</div>'
            +'<div style="font-size:1.1rem;font-weight:800;color:'+negColor+'">'+money(llNeg)+'</div>'
            +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">'+llNegPct.toFixed(1)+'% — reserva deduzida: '+money(deducNeg)+'</div>'
          +'</div>'
          : neg>0 && fechadoSemDesc
          ? '<div style="background:rgba(63,185,80,.08);border:1px solid rgba(63,185,80,.3);border-radius:var(--r);padding:.8rem .9rem;border-left:3px solid #3fb950">'
            +'<div style="font-size:.72rem;color:var(--green);margin-bottom:.2rem">✅ Fechado sem desconto</div>'
            +'<div style="font-size:1.1rem;font-weight:800;color:#3fb950">'+money(ll)+'</div>'
            +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">Reserva de '+money(deducNeg)+' incorporada — lucro real: '+llPct.toFixed(1)+'%</div>'
          +'</div>'
          : ''
        )
      +'</div>'
    +'</div>'
    +'</div>';

  kpiGrid.innerHTML = advCards;

  // orcIndicadores (orçamento) e kpiGrid (valores) usam o mesmo advCards
  var orcIndic = Q('orcIndicadores');
  if(orcIndic) orcIndic.innerHTML = advCards;

  // Barra de composição
  if(notas) kpiGrid.innerHTML+='<div style="grid-column:1/-1;display:flex;gap:.4rem;flex-wrap:wrap;font-size:.72rem;margin-top:.2rem">'+notas+'</div>';
  var bar=Q('kpiBar'),leg=Q('kpiLegend');
  if(bar&&pvTot>0){
    var pCusto=(custoTotal/pvTot*100).toFixed(1);
    var pDeduc=(totalDeduc/pvTot*100).toFixed(1);
    var pctLucroServ=Math.max(0,(llS/pvTot*100)).toFixed(1);
    var pctLucroMat=Math.max(0,(llM/pvTot*100)).toFixed(1);
    // Label e valor do LL na barra: se fechado sem desconto → lucro real (ll);
    // se tem reserva → lucro após reserva (llNeg); senão → ll
    var llBarVal  = (fechadoSemDesc || neg<=0) ? ll    : llNeg;
    var llBarPct  = pvTot>0 ? Math.max(0,(llBarVal/pvTot*100)).toFixed(1) : '0.0';
    var llBarLabel= fechadoSemDesc ? 'Lucro Real Realizado' : (neg>0 ? 'Lucro Após Reserva ('+( neg*100).toFixed(0)+'%)' : 'Lucro Líquido Total');
    var llBarCor  = llBarVal>=0?llColor:'#f85149';
    bar.innerHTML=
      '<div style="width:'+pCusto+'%;background:#bc8cff" title="Custo '+pCusto+'%"></div>'+
      '<div style="width:'+pDeduc+'%;background:#f97316" title="Deduções '+pDeduc+'%"></div>'+
      '<div style="width:'+pctLucroServ+'%;background:#58a6ff" title="Lucro Líquido Serviços '+pctLucroServ+'%"></div>'+
      '<div style="width:'+pctLucroMat+'%;background:#3fb950" title="Lucro Líquido Materiais '+pctLucroMat+'%"></div>';
    leg.innerHTML=
      '<span>🟣 Custo '+pCusto+'%</span>'+
      '<span>🟠 Deduções '+pDeduc+'%</span>'+
      '<span style="color:#58a6ff">■ LL Serviços '+pctLucroServ+'%</span>'+
      '<span style="color:#3fb950">■ LL Materiais '+pctLucroMat+'%</span>'+
      '<span style="color:'+llBarCor+';font-weight:700">'+llBarLabel+' '+llBarPct+'%</span>';
  }
}

// TEMPLATES SEL
function rTplSel(){
  var tpls=getTpls(),g=Q('tSG');
  if(!g)return; // elemento não existe nesta view
  if(!tpls.length){g.innerHTML='<p style="color:var(--text3)">Nenhum template. Clique em + Novo.</p>';var tsc=Q('tSC');if(tsc)tsc.textContent='0 sel.';return}
  g.innerHTML=tpls.map(function(t){
    var s=selTpl.indexOf(t.id)>=0;
    return '<div class="tc'+(s?' on':'')+'" onclick="togT(\''+t.id+'\',this)">'
      +(s?'<span class="tc-ck">✓</span>':'')
      +'<div class="tc-cat">'+esc(t.g||'GERAL')+'</div>'
      +'<div class="tc-name">'+esc(t.titulo)+'</div>'
      +'<div class="tc-desc">'+esc(t.desc||'')+'</div></div>'
  }).join('');
  var _tsc=Q('tSC');if(_tsc)_tsc.textContent=selTpl.length+' sel.';
  rTplEd();
}
function togT(id,el){
  var i=selTpl.indexOf(id);if(i>=0)selTpl.splice(i,1);else selTpl.push(id);rTplSel();
}
function rTplEd(){
  var tpls=getTpls(),box=Q('tEB'),fields=Q('tEF');
  if(!selTpl.length){box.style.display='none';return}
  box.style.display='block';
  fields.innerHTML=selTpl.map(function(id){
    var t=tpls.find(function(x){return x.id===id});if(!t)return'';
    var val=tplEdits[id]!==undefined?tplEdits[id]:(t.conteudo||'');
    var tit=tplTitles[id]!==undefined?tplTitles[id]:t.titulo;
    return '<div style="margin-bottom:.85rem;border:1px solid var(--border);border-radius:var(--r2);padding:.65rem">'
      +'<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.45rem">'
      +'<input value="'+esc(tit)+'" placeholder="Titulo da secao" '
      +'style="flex:1;padding:.32rem .6rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);font-size:.78rem;font-weight:700;font-family:inherit" '
      +'onchange="tplTitles[\''+id+'\']= this.value" oninput="tplTitles[\''+id+'\']= this.value">'
      +'<span style="font-size:.65rem;color:var(--text3);white-space:nowrap">'+esc(t.g||'')+'</span>'
      +'</div>'
      +'<textarea style="width:100%;min-height:95px;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);padding:.45rem .65rem;resize:vertical;font-family:inherit;font-size:.78rem" '
      +'onchange="tplEdits[\''+id+'\']= this.value" oninput="tplEdits[\''+id+'\']= this.value">'+esc(val)+'</textarea>'
      +'</div>'
  }).join('');
}

// ESCOPOS
function getEscTpls(){return LS('tf_etpl')||[]}
function saveEscTpls(t){LS('tf_etpl',t)}
function addSec(){
  escSecs.push({id:uid(),num:'',titulo:'Nova Seção',desc:'',subs:[]});
  var el=Q('escList');
  if(el) el.scrollIntoView({behavior:'smooth', block:'nearest'});
  rEsc();
  toast('✔ Nova seção criada');
  setTimeout(function(){var inp=document.querySelectorAll('.es-ti');if(inp.length)inp[inp.length-1].select();},80);
}
function addValorSec(){
  var ja = escSecs.some(function(s){ return isValorSec(s); });
  if(ja){ toast('ℹ️ A seção de valor já existe.','ok'); return; }
  escSecs.push({id:uid(),type:'valor',num:'',titulo:'VALOR',desc:'',subs:[]});
  var el=Q('escList');
  if(el) el.scrollIntoView({behavior:'smooth', block:'nearest'});
  rEsc();
  toast('💰 Seção de valor inserida');
  setTimeout(function(){
    var secs=document.querySelectorAll('#escList .es');
    if(secs.length){
      var last=secs[secs.length-1].querySelector('.es-ti');
      if(last) last.select();
    }
  },80);
}
function remSec(id){escSecs=escSecs.filter(function(s){return s.id!==id});rEsc();}

var _escDragSi = null; // índice da seção sendo arrastada

// Move escopo para a posição digitada e renumera todos sequencialmente
function escMoverPorNumero(si, valor){
  var destino = parseInt(valor, 10);
  if(isNaN(destino) || destino < 1) return;
  var total = escSecs.length;
  var pos = Math.min(destino - 1, total - 1); // converte para índice 0-based
  if(pos === si) return; // mesma posição, nada a fazer
  var sec = escSecs.splice(si, 1)[0];
  escSecs.splice(pos, 0, sec);
  rEsc(); // rEsc já renumera todos sequencialmente
  if(typeof toast === 'function') toast('Seção movida para posição ' + (pos + 1));
}

function addGanttSec(){
  var ja=escSecs.some(function(s){return isPrazo(s);});
  if(ja){toast('ℹ️ Seção de cronograma já existe.','ok');
    var el=document.querySelector('#escList .es');
    if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});
    return;
  }
  escSecs.push({id:uid(),num:'',titulo:'PRAZO / CRONOGRAMA',desc:'',subs:[],hasGantt:true});
  rEsc();
  toast('📅 Seção Gantt inserida');
  setTimeout(function(){
    var el=Q('ganttPrev');
    if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});
  },200);
}

function addSub(si){
  escSecs[si].subs.push({id:uid(),nome:'Novo Item',desc:''});rEsc();
  setTimeout(function(){var nb=document.querySelectorAll('.esb-n');if(nb.length)nb[nb.length-1].focus();},80);
}
function remSub(si,subi){
  var nome=escSecs[si].subs[subi]?escSecs[si].subs[subi].nome:'Item';
  escSecs[si].subs.splice(subi,1);rEsc();
  toast('🗑 Item "'+nome+'" removido','ok');
}
function saveTplEsc(si){
  var sec=escSecs[si];if(!sec)return;
  var tpls=getEscTpls();
  if(tpls.some(function(t){return t.titulo===sec.titulo})){
    if(!confirm('Ja existe template "'+sec.titulo+'". Sobrescrever?'))return;
    tpls=tpls.filter(function(t){return t.titulo!==sec.titulo});
  }
  tpls.push({id:uid(),titulo:sec.titulo,desc:sec.desc||'',subs:JSON.parse(JSON.stringify(sec.subs||[]))});
  saveEscTpls(tpls);toast('💾 Template "'+sec.titulo+'" salvo!');
}
function showEscTpl(){if(Q('escTplModal')){Q('escTplModal').style.display='block';if(Q('escTplForm'))Q('escTplForm').style.display='none';_etEditId=null;rEscTpl();Q('escTplModal').scrollIntoView({behavior:'smooth'});}else{toggleBancoEscoposInline();}}
function hideEscTpl(){if(Q('escTplModal'))Q('escTplModal').style.display='none';}
function _etId(){return null}
var _etEditId=null;
function newEscTpl(){
  if(!Q('etFTit')||!Q('escTplForm'))return;
  _etEditId=null;Q('etFTit').value='';Q('etFTxt').value='';
  Q('escTplForm').style.display='block';Q('etFTit').focus();
}
function editEscTplItem(id){
  if(!Q('etFTit')||!Q('escTplForm'))return;
  var all=getEscTpls();var t=all.find(function(x){return x.id===id});if(!t)return;
  _etEditId=id;Q('etFTit').value=t.titulo||'';Q('etFTxt').value=t.desc||t.conteudo||'';
  Q('escTplForm').style.display='block';Q('etFTit').focus();
  Q('etFTit').scrollIntoView({behavior:'smooth'});
}
function saveEscTplForm(){
  if(!Q('etFTit'))return;
  var tit=(Q('etFTit').value||'').trim();
  if(!tit){toast('Título obrigatório','err');return}
  var txt=Q('etFTxt')?Q('etFTxt').value||'':'';
  var tpls=getEscTpls();
  if(_etEditId){
    var i=tpls.findIndex(function(x){return x.id===_etEditId});
    if(i>=0){tpls[i].titulo=tit;tpls[i].desc=txt;tpls[i].conteudo=txt;}
    else tpls.push({id:uid(),titulo:tit,desc:txt,conteudo:txt,subs:[]});
    toast('✔ "'+tit+'" atualizado');
  } else {
    tpls.push({id:uid(),titulo:tit,desc:txt,conteudo:txt,subs:[]});
    toast('✔ "'+tit+'" criado');
  }
  saveEscTpls(tpls);cancelEscTplForm();rEscTpl();
}
function cancelEscTplForm(){
  if(Q('escTplForm'))Q('escTplForm').style.display='none';_etEditId=null;
}
function rEscTpl(){
  var q=(Q('etSearch')&&Q('etSearch').value||'').toLowerCase();
  var el=Q('escTplList');
  if(!el) return;
  var tpls=getEscTpls().filter(function(t){
    return !q||(t.titulo||'').toLowerCase().indexOf(q)>=0||(t.desc||t.conteudo||'').toLowerCase().indexOf(q)>=0;
  });
  if(!tpls.length){
    el.innerHTML='<div class="emp" style="padding:1.2rem 0"><div class="emp-i">📚</div><p>Nenhum texto. Clique em "+ Novo" para criar.</p></div>';
    return;
  }
  el.innerHTML=tpls.map(function(t){
    var preview=(t.desc||t.conteudo||'');
    if(preview.length>80)preview=preview.substring(0,80)+'...';
    return '<div style="display:flex;align-items:center;gap:.4rem;padding:.5rem .7rem;border-bottom:1px solid var(--border)">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-weight:700;font-size:.83rem;color:var(--text)">'+esc(t.titulo)+'</div>'
      +(preview?'<div style="font-size:.71rem;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(preview)+'</div>':'')
      +'</div>'
      +'<button class="btn bs bsm etb-usar" data-id="'+t.id+'" title="Incluir na proposta">+ Usar</button>'
      +'<button class="btn ba bsm etb-edit" data-id="'+t.id+'" title="Editar">✏️</button>'
      +'<button class="btn bd bsm etb-del"  data-id="'+t.id+'" title="Excluir">🗑</button>'
      +'</div>'
  }).join('');
  el.onclick=function(e){
    var btn=e.target.closest('button');if(!btn)return;
    var id=btn.getAttribute('data-id');if(!id)return;
    if(btn.classList.contains('etb-usar')){useTplEsc(id);}
    else if(btn.classList.contains('etb-edit')){editEscTplItem(id);}
    else if(btn.classList.contains('etb-del')){delTplEsc(id);}
  };
}

function useDeftEsc(id){
  var t=getEscTpls().find(function(x){return x.id===id});if(!t)return;
  var nome=t.titulo||'Secao';
  escSecs.push({id:uid(),titulo:nome,desc:t.conteudo||t.desc||'',subs:[]});
  rEsc();
  toast('✔ "'+nome+'" adicionado');
  var el=Q('escList');
  if(el){
    el.scrollIntoView({behavior:'smooth',block:'nearest'});
    var items=el.querySelectorAll('.es');
    var last=items[items.length-1];
    if(last){last.style.transition='background .3s';last.style.background='rgba(21,74,21,.35)';setTimeout(function(){last.style.background='';},1200);}
  }
}

function useTplEsc(id){
  var t=getEscTpls().find(function(x){return x.id===id});if(!t)return;
  escSecs.push({id:uid(),titulo:t.titulo,desc:t.desc||t.conteudo||'',subs:JSON.parse(JSON.stringify(t.subs||[]))});
  hideEscTpl();
  rEsc();
  toast('✔ "'+t.titulo+'" adicionado');
  // Scroll to escopo list and highlight new item
  var el=Q('escList');
  if(el){
    el.scrollIntoView({behavior:'smooth',block:'nearest'});
    var items=el.querySelectorAll('.es');
    var last=items[items.length-1];
    if(last){
      last.style.transition='background .3s';
      last.style.background='rgba(21,74,21,.35)';
      setTimeout(function(){last.style.background='';},1200);
    }
  }
}
function delTplEsc(id){
  var t=getEscTpls().find(function(x){return x.id===id});
  if(!t||!confirm('Excluir template "'+t.titulo+'"?'))return;
  saveEscTpls(getEscTpls().filter(function(x){return x.id!==id}));rEscTpl();toast('🗑 Template excluído','ok');
}

function recarregarEscopo(){
  if(!editId){ toast('Nenhuma proposta aberta.','err'); return; }
  var p=props.find(function(x){return x.id===editId;});
  if(!p){ toast('Proposta não encontrada.','err'); return; }
  var rawEsc=p.esc||[];
  if(typeof rawEsc==='string'&&rawEsc.trim()){
    var linhas=rawEsc.split(/\n(?=\d+\.|[A-Z]{2,})/).filter(Boolean);
    rawEsc=linhas.length>1
      ?linhas.map(function(bloco){
          var lines=bloco.split('\n');
          return {id:uid(),num:'',titulo:lines[0].replace(/^\d+\.\s*/,'').trim(),desc:lines.slice(1).join('\n').trim(),subs:[]};
        })
      :[{id:uid(),num:'',titulo:'Escopo',desc:rawEsc,subs:[]}];
  }
  var norm=(Array.isArray(rawEsc)?rawEsc:[]).map(function(s){
    if(!s)return null;
    return {id:s.id||uid(),num:s.num||'',titulo:s.titulo||s.t||s.nome||'',
            desc:s.desc||s.c||s.conteudo||'',
            subs:Array.isArray(s.subs)?s.subs.map(function(sb){
              return {id:sb.id||uid(),num:sb.num||'',nome:sb.nome||sb.titulo||sb.t||'',desc:sb.desc||sb.c||sb.conteudo||''};
            }):[]};
  }).filter(Boolean);
  // TODAS as seções ficam no editor - sem filtrar!
  escSecs=JSON.parse(JSON.stringify(norm));
  rEsc();
  if(escSecs.length){
    toast('✅ '+escSecs.length+' seção(ões) carregada(s)!','ok');
  } else {
    var raw2=p.esc;
    var tipo=Array.isArray(raw2)?'array['+raw2.length+']':(typeof raw2);
    toast('⚠️ Escopo vazio na proposta ('+tipo+'). Use + Nova Seção.','err');
    console.warn('DEBUG p.esc =', JSON.stringify(raw2));
  }
}

function autoResize(el){el.style.height='auto';el.style.height=el.scrollHeight+'px';}
function autoResizeAll(){document.querySelectorAll('.esb-d').forEach(function(t){autoResize(t);});}


function getValorSecData(){
  try{updBT();}catch(e){}
  var vS=n2(Q('vS')&&Q('vS').value), vM=n2(Q('vM')&&Q('vM').value);
  var dS=n2(Q('vDSval')&&Q('vDSval').value)||0;
  var dM=n2(Q('vDMval')&&Q('vDMval').value)||0;
  var vd=dS+dM;
  var _p=props.find(function(x){return x.id===editId})||{};
  if(vS<=0) vS=n2(_p.vS);
  if(vM<=0) vM=n2(_p.vM);

  // Use budg (sorted by _budgGrupos) if available; otherwise use saved items
  var _budgAllRaw = budg.length ? budg : (_p.bi||[]);
  // Apply same sort as the table when using saved items
  var _budgAll = _budgAllRaw;
  if(!budg.length && _budgGrupos && _budgGrupos.length){
    _budgAll = _budgAllRaw.slice().sort(function(a,b){
      for(var _gi=0;_gi<_budgGrupos.length;_gi++){
        var _gk=_budgGrupos[_gi];
        var _va=_getGrupoVal(a,_gk), _vb=_getGrupoVal(b,_gk);
        var _gc=_va.localeCompare(_vb); if(_gc!==0) return _gc;
      }
      return 0;
    });
  }
  if(!vS && !vM){
    _budgAll.forEach(function(it){
      if(it.inc===false) return;
      if(it.t==='material') vM+=n2(it.pvt); else vS+=n2(it.pvt);
    });
  }

  var liqS=Math.max(0,vS-dS);
  var liqM=Math.max(0,vM-dM);
  var vtot=liqS+liqM;
  return {vs:vS,vm:vM,dS:dS,dM:dM,vd:vd,liqS:liqS,liqM:liqM,vtot:vtot,budg:_budgAll};
}

function valorSecEditorHTML(){
  var d=getValorSecData();
  var vs=d.vs, vm=d.vm, dS=d.dS, dM=d.dM, vd=d.vd, liqS=d.liqS, liqM=d.liqM, vtot=d.vtot, _budgAll=d.budg||[];
  var detRows='';

  _budgAll.forEach(function(it){
    if(it.inc===false) return;
    if(it.det===false) return;
    var lbl=esc(it.desc||it.cat||'');
    var tipo=it.t==='material'?'Mat':'Svc';
    var un1=it.un1||'',un2=it.un2||'';
    var ql;
    if(it.t==='material'){
      ql=it.mult+(un1?' '+un1:'');
    } else {
      var _gt=it.tec||1,_gd=it.dias||1,_gh=it.hpd||1;
      var _gp=[];
      if(_gt>1||it.dias!=null) _gp.push(_gt+' Tec.');
      _gp.push(_gd+(un1?' '+un1:''));
      if(_gh!==1) _gp.push(_gh+(un2?' '+un2:''));
      ql=_gp.join(' × ');
      if(_gh!==1) ql+=' = '+it.mult.toFixed(0)+(un2?' '+un2:'h');
    }
    detRows += '<tr>'
      +'<td style="padding:.38rem .45rem;border-bottom:1px solid var(--border)">'+lbl
      +'<div style="font-size:.68rem;color:var(--text3);margin-top:2px">'
      +'<span style="background:#203248;color:#79b8ff;padding:0 4px;border-radius:3px;font-weight:700;margin-right:4px">'+tipo+'</span>'
      +esc(it.cat||'')
      +' &nbsp;|&nbsp; Qtd: '+ql
      +' &nbsp;|&nbsp; PV Unit.: '+money(it.pvu)
      +(it.terc?' &nbsp;|&nbsp; <span style="color:#f97316">●Terc.</span>':'')
      +'</div></td>'
      +'<td style="padding:.38rem .45rem;border-bottom:1px solid var(--border);text-align:right;font-weight:700">'+money(it.pvt)+'</td>'
      +'</tr>';
  });

  return '<div class="pp-valor-editor" style="margin-top:.6rem;border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg2)">'
    +'<div style="padding:.5rem .7rem;background:var(--bg3);border-bottom:1px solid var(--border);font-size:.72rem;font-weight:700;color:var(--accent);text-transform:uppercase">Prévia automática dos valores desta seção</div>'
    +'<div style="padding:.55rem .7rem;font-size:.7rem;color:var(--text3);border-bottom:1px solid var(--border)">Os dados abaixo vêm da fase 2 / fase 4. Aqui na fase 3 você pode apenas posicionar esta seção na ordem da proposta e editar o número/título.</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.9rem">'
    +'<thead><tr>'
    +'<th style="padding:.5rem .6rem;background:var(--bg3);border-bottom:1px solid var(--border);text-align:left;color:var(--text3);font-size:.75rem;text-transform:uppercase">Itens</th>'
    +'<th style="padding:.5rem .6rem;background:var(--bg3);border-bottom:1px solid var(--border);text-align:right;color:var(--text3);font-size:.75rem;text-transform:uppercase">Valor</th>'
    +'</tr></thead><tbody>'
    +(detRows || '<tr><td colspan="2" style="padding:.75rem;text-align:center;color:var(--text3)">Nenhum item detalhado marcado para exibição. Os totais abaixo continuam válidos.</td></tr>')
    +(vs>0?'<tr><td style="padding:.42rem .5rem;border-top:1px solid var(--border)">'+(detRows?'Soma dos Serviços':'Serviços')+'</td><td style="padding:.42rem .5rem;border-top:1px solid var(--border);text-align:right">'+money(vs)+'</td></tr>':'')
    +(dS>0?'<tr><td style="padding:.42rem .5rem;border-top:1px solid var(--border)">Desconto Serviços</td><td style="padding:.42rem .5rem;border-top:1px solid var(--border);text-align:right">- '+money(dS)+'</td></tr>':'')
    +(dS>0?'<tr><td style="padding:.42rem .5rem;border-top:1px dashed var(--border)">Serviços líquidos</td><td style="padding:.42rem .5rem;border-top:1px dashed var(--border);text-align:right">'+money(liqS)+'</td></tr>':'')
    +(vm>0?'<tr><td style="padding:.42rem .5rem;border-top:1px solid var(--border)">'+(detRows?'Soma dos Materiais':'Materiais')+'</td><td style="padding:.42rem .5rem;border-top:1px solid var(--border);text-align:right">'+money(vm)+'</td></tr>':'')
    +(dM>0?'<tr><td style="padding:.42rem .5rem;border-top:1px solid var(--border)">Desconto Materiais</td><td style="padding:.42rem .5rem;border-top:1px solid var(--border);text-align:right">- '+money(dM)+'</td></tr>':'')
    +(dM>0?'<tr><td style="padding:.42rem .5rem;border-top:1px dashed var(--border)">Materiais líquidos</td><td style="padding:.42rem .5rem;border-top:1px dashed var(--border);text-align:right">'+money(liqM)+'</td></tr>':'')
    +(vd>0?'<tr><td style="padding:.42rem .5rem;border-top:1px solid var(--border)">Desconto total</td><td style="padding:.42rem .5rem;border-top:1px solid var(--border);text-align:right">- '+money(vd)+'</td></tr>':'')
    +'<tr><td style="padding:.5rem .5rem;border-top:1px solid var(--border);font-weight:800;background:rgba(63,185,80,.08)">TOTAL GERAL</td><td style="padding:.5rem .5rem;border-top:1px solid var(--border);text-align:right;font-weight:800;background:rgba(63,185,80,.08)">'+money(vtot)+'</td></tr>'
    +'</tbody></table></div></div>';
}

// ── Seletor de símbolos para textareas de escopo ──
var _ESC_SYMS = [
  {v:'• ', l:'• Marcador redondo'},
  {v:'- ', l:'- Traço simples'},
  {v:'– ', l:'– Travessão'},
  {v:'→ ', l:'→ Seta direita'},
  {v:'✓ ', l:'✓ Check / OK'},
  {v:'✗ ', l:'✗ Não / Excluir'},
  {v:'▪ ', l:'▪ Quadrado pequeno'},
  {v:'① ', l:'① Número 1'},
  {v:'② ', l:'② Número 2'},
  {v:'③ ', l:'③ Número 3'},
  {v:'④ ', l:'④ Número 4'},
  {v:'⑤ ', l:'⑤ Número 5'}
];
function escSymBar(){
  return '<select class="esc-sym-sel" onchange="escInsertSym(this)">'
    +'<option value="">＋ Inserir símbolo de tópico...</option>'
    +_ESC_SYMS.map(function(o){
      return '<option value="'+o.v+'">'+o.l+'</option>';
    }).join('')
    +'</select>';
}
function escInsertSym(sel){
  var sym=sel.value;
  if(!sym){return;}
  sel.value=''; // reset para placeholder
  var ta=sel.nextElementSibling;
  if(!ta||ta.tagName!=='TEXTAREA')return;
  ta.focus();
  var s=ta.selectionStart, e=ta.selectionEnd, v=ta.value;
  ta.value=v.substring(0,s)+sym+v.substring(e);
  ta.selectionStart=ta.selectionEnd=s+sym.length;
  ta.dispatchEvent(new Event('input'));
}

function rEsc(){
  try{updBT();}catch(e){}
  try{cTot();}catch(e){}
  var el=Q('escList');
  if(!escSecs.length){
    el.innerHTML='<div class="emp"><div class="emp-i">🔧</div><p>Clique em "+ Nova Seção" para começar.</p></div>';
    return;
  }
  // Migra seções antigas: marca hasGantt pelo título para que editar o título não apague o gantt
  escSecs.forEach(function(s,i){s.num=String(i+1);if(!s.hasGantt){var t=String(s.titulo||'').trim().toUpperCase();if(t==='PRAZO / CRONOGRAMA'||t==='PRAZO'||t==='CRONOGRAMA'||t==='PRAZO/CRONOGRAMA')s.hasGantt=true;}});
  var tot=escSecs.length;
  el.innerHTML=escSecs.map(function(sec,si){
    var isFirst=si===0,isLast=si===tot-1;
    var totSubs=(sec.subs||[]).length;
    var isValor=isValorSec(sec);
    return '<div class="es" data-sid="'+sec.id+'" data-si="'+si+'">'
      +'<div class="es-hd">'
      +'<div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0;margin-right:3px">'
      +'<button class="btn bg bxs es-up" data-si="'+si+'" title="Mover para cima" style="padding:.1rem .3rem;line-height:1;opacity:'+(isFirst?'0.2':'1')+'" '+(isFirst?'disabled':'')+'>▲</button>'
      +'<button class="btn bg bxs es-dn" data-si="'+si+'" title="Mover para baixo" style="padding:.1rem .3rem;line-height:1;opacity:'+(isLast?'0.2':'1')+'" '+(isLast?'disabled':'')+'>▼</button>'
      +'</div>'
      +'<input class="es-num" value="'+esc(sec.num||String(si+1))+'" placeholder="#" '
      +'style="width:44px;text-align:center;flex-shrink:0;font-weight:700;color:var(--accent);background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);padding:.28rem .3rem;font-family:inherit;font-size:.8rem;cursor:text" '
      +'title="Digite o número desejado e pressione Enter para reposicionar" '
      +'oninput="escSecs['+si+'].num=this.value" '      +'onkeydown="if(event.key===\'Enter\'){escMoverPorNumero('+si+',this.value);this.blur();event.preventDefault();}" '
      +'onblur="escMoverPorNumero('+si+',this.value)">'
      +'<input class="es-ti" value="'+esc(sec.titulo)+'" placeholder="Título da seção" '
      +'oninput="escSecs['+si+'].titulo=this.value;scheduleDraftSave()">'
      +'<div class="br" style="flex-shrink:0">'
      +(isValor
         ? '<button class="btn ba bxs" onclick="atualizarValorSecaoEscopo()" title="Recarregar tabela de valores considerando descontos atuais">↻ Atualizar valores</button><span class="tg2" title="Tabela de valores automática">💰 Auto</span>'
         : '<button class="btn bg bxs es-addsub" data-si="'+si+'" title="Adicionar sub-item">+ Item</button><button class="btn bp bxs es-save" data-si="'+si+'" title="Salvar no banco">💾</button>')
      +'<button class="btn bd bxs es-del" data-sid="'+sec.id+'" title="Excluir seção">🗑</button>'
      +'</div></div>'
      +(isValor
         ? '<div class="hint" style="margin:.2rem 0 .5rem 0">Esta seção puxa automaticamente os valores do orçamento e aparece na posição em que você deixar aqui. Você pode mover para cima/baixo, editar o número e clicar em Atualizar valores quando quiser recarregar com os descontos atuais. e trocar o título.</div>'
         : '')
      +escSymBar()
      +'<textarea class="esb-d" style="width:100%;margin-top:.2rem;background:var(--bg2)" '
      +'placeholder="'+(isValor?'Texto opcional acima da tabela de valores...':'Descrição da seção (vai direto na proposta)...')+'" '
      +'oninput="escSecs['+si+'].desc=this.value;autoResize(this);scheduleDraftSave()">'+esc(sec.desc||'')+'</textarea>'
      +(isValor ? valorSecEditorHTML() : '')
      +(isPrazo(sec) ? ganttEditorHTML(si) : '')
      +(isValor ? '' : (sec.subs||[]).map(function(sub,subi){
        var subFirst=subi===0,subLast=subi===totSubs-1;
        return '<div class="esb" style="margin-top:.45rem" data-subi="'+subi+'" data-si="'+si+'">'
          +'<div style="display:flex;align-items:center;gap:.3rem">'
          +'<div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">'
          +'<button class="btn bg bxs es-subup" data-si="'+si+'" data-subi="'+subi+'" title="Mover item para cima" style="padding:.1rem .28rem;line-height:1;opacity:'+(subFirst?'0.2':'1')+'" '+(subFirst?'disabled':'')+'>▲</button>'
          +'<button class="btn bg bxs es-subdn" data-si="'+si+'" data-subi="'+subi+'" title="Mover item para baixo" style="padding:.1rem .28rem;line-height:1;opacity:'+(subLast?'0.2':'1')+'" '+(subLast?'disabled':'')+'>▼</button>'
          +'</div>'
          +'<input value="'+esc(sub.num||'')+'" placeholder="Nº" '
          +'style="width:38px;text-align:center;flex-shrink:0;font-weight:700;color:var(--accent);background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);padding:.2rem .25rem;font-family:inherit;font-size:.76rem" '
          +'oninput="escSecs['+si+'].subs['+subi+'].num=this.value;scheduleDraftSave()">'
          +'<input class="esb-n" value="'+esc(sub.nome)+'" placeholder="Nome do sub-item" style="flex:1" oninput="escSecs['+si+'].subs['+subi+'].nome=this.value;scheduleDraftSave()">'
          +'<button class="btn bd bxs es-delsub" data-si="'+si+'" data-subi="'+subi+'" style="flex-shrink:0">×</button>'
          +'</div>'
          +escSymBar()
          +'<textarea class="esb-d" placeholder="Descrição do sub-item..." style="margin-top:.2rem" oninput="escSecs['+si+'].subs['+subi+'].desc=this.value;autoResize(this);scheduleDraftSave()">'+esc(sub.desc||'')+'</textarea>'
          +'</div>'
      }).join(''))
      +'</div>';
  }).join('');

  setTimeout(autoResizeAll, 0);

  el.onclick=function(e){
    var btn=e.target.closest('button');if(!btn)return;
    if(btn.classList.contains('es-del')){
      var sid=btn.getAttribute('data-sid');
      var sec=escSecs.find(function(s){return s.id===sid});
      var nome=sec?sec.titulo:'Seção';
      escSecs=escSecs.filter(function(s){return s.id!==sid});
      rEsc();toast('🗑 "'+nome+'" removida');
    } else if(btn.classList.contains('es-up')){
      var si=parseInt(btn.getAttribute('data-si'));
      if(si>0){var tmp=escSecs[si-1];escSecs[si-1]=escSecs[si];escSecs[si]=tmp;rEsc();toast('↑ Seção movida');}
    } else if(btn.classList.contains('es-dn')){
      var si=parseInt(btn.getAttribute('data-si'));
      if(si<escSecs.length-1){var tmp=escSecs[si+1];escSecs[si+1]=escSecs[si];escSecs[si]=tmp;rEsc();toast('↓ Seção movida');}
    } else if(btn.classList.contains('es-addsub')){
      var si=parseInt(btn.getAttribute('data-si'));
      escSecs[si].subs.push({id:uid(),num:'',nome:'Novo Item',desc:''});
      rEsc();
      setTimeout(function(){var nb=el.querySelectorAll('.esb-n');if(nb.length)nb[nb.length-1].focus();},80);
    } else if(btn.classList.contains('es-save')){
      saveTplEsc(parseInt(btn.getAttribute('data-si')));
    } else if(btn.classList.contains('es-subup')){
      var si=parseInt(btn.getAttribute('data-si'));
      var subi=parseInt(btn.getAttribute('data-subi'));
      if(subi>0){var tmp=escSecs[si].subs[subi-1];escSecs[si].subs[subi-1]=escSecs[si].subs[subi];escSecs[si].subs[subi]=tmp;rEsc();toast('↑ Item movido');}
    } else if(btn.classList.contains('es-subdn')){
      var si=parseInt(btn.getAttribute('data-si'));
      var subi=parseInt(btn.getAttribute('data-subi'));
      if(subi<escSecs[si].subs.length-1){var tmp=escSecs[si].subs[subi+1];escSecs[si].subs[subi+1]=escSecs[si].subs[subi];escSecs[si].subs[subi]=tmp;rEsc();toast('↓ Item movido');}
    } else if(btn.classList.contains('es-delsub')){
      var si2=parseInt(btn.getAttribute('data-si'));
      var subi=parseInt(btn.getAttribute('data-subi'));
      var nome2=escSecs[si2].subs[subi]?escSecs[si2].subs[subi].nome:'Item';
      escSecs[si2].subs.splice(subi,1);
      rEsc();toast('🗑 Item "'+nome2+'" removido');
    }
  };
}

function impEscDB(){
  var ts=Q('eTS');if(!ts)return;
  var tid=ts.value||'';if(!tid)return;
  var ti=eDB.titulos.find(function(t){return t.id===tid});if(!ti)return;
  var subs=eDB.subtitulos.filter(function(s){return s.tituloId===tid});
  escSecs.push({id:uid(),titulo:ti.nome,desc:ti.descricao||'',subs:subs.map(function(s){return{id:uid(),nome:s.nome,desc:s.descricao||''}})});
  rEsc();
}
// BUDGET
function refBudg(){
  var cfg=getPrc();
  // Só preenche com os valores globais se a proposta em edição NÃO tiver alíquotas próprias salvas
  // (se já foram restauradas pelo editP, não sobrescrever)
  var propAliq = editId ? (function(){ var p=props.find(function(x){return x.id===editId}); return p&&p.aliq?p.aliq:null; })() : null;
  if(!propAliq){
    // Proposta nova ou sem alíquotas salvas: usa os valores globais
    if(Q('aNFS'))Q('aNFS').value=parseFloat(((cfg.aliq.nfS||0.15)*100).toFixed(4));
    if(Q('aNFM'))Q('aNFM').value=parseFloat(((cfg.aliq.nfM||0.15)*100).toFixed(4));
    if(Q('aRS'))Q('aRS').value=parseFloat(((cfg.aliq.rS||0.041)*100).toFixed(4));
    if(Q('aComS'))Q('aComS').value=parseFloat((((cfg.aliq.comS!=null?cfg.aliq.comS:0.05))*100).toFixed(4));
    if(Q('aComM'))Q('aComM').value=parseFloat((((cfg.aliq.comM!=null?cfg.aliq.comM:0.03))*100).toFixed(4));
    if(Q('aNeg'))Q('aNeg').value=parseFloat((((cfg.aliq.neg!=null?cfg.aliq.neg:0.05))*100).toFixed(4));
  } else {
    // Proposta existente com alíquotas próprias: restaura os valores salvos (0 também é válido)
    var al=propAliq;
    if(Q('aNFS'))Q('aNFS').value=parseFloat(((al.nfS !=null?al.nfS :cfg.aliq.nfS ||0.15 )*100).toFixed(4));
    if(Q('aNFM'))Q('aNFM').value=parseFloat(((al.nfM !=null?al.nfM :cfg.aliq.nfM ||0.15 )*100).toFixed(4));
    if(Q('aRS')) Q('aRS').value =parseFloat(((al.rS  !=null?al.rS  :cfg.aliq.rS  ||0.041)*100).toFixed(4));
    if(Q('aComS'))Q('aComS').value=parseFloat(((al.comS!=null?al.comS:(cfg.aliq.comS!=null?cfg.aliq.comS:0.05))*100).toFixed(4));
    if(Q('aComM'))Q('aComM').value=parseFloat(((al.comM!=null?al.comM:(cfg.aliq.comM!=null?cfg.aliq.comM:0.03))*100).toFixed(4));
    if(Q('aNeg')) Q('aNeg').value =parseFloat(((al.neg !=null?al.neg :cfg.aliq.neg ||0.05 )*100).toFixed(4));
  }
  refCat();rBudg();updKpi();
}
function onTipo(){
  var _iTipo=Q('iTipo'); if(!_iTipo) return;
  var t=_iTipo.value;
  if(Q('cSvc')) Q('cSvc').style.display=t==='material'?'none':'grid';
  if(Q('cMat')) Q('cMat').style.display=t==='material'?'block':'none';
  refCat();
}
function refCat(){
  var _iTipo=Q('iTipo');
  var cfg=getPrcAtual(),t=_iTipo?_iTipo.value:'servico',sel=Q('iCat');if(!sel)return;
  var d=t==='material'?cfg.m:cfg.s;
  sel.innerHTML=Object.keys(d).sort().map(function(k){return'<option value="'+k+'">'+k+' — '+d[k].n+'</option>'}).join('');
}
function calcFMF(cfg,tipo,cat){
  var aliq=cfg.aliq;
  if(tipo==='material'){
    // Material: (1+Margem) / (1 - NF - RS - ComM - Neg)
    var mk=n2(cfg.m[cat]&&cfg.m[cat].mk);
    var a=1-(n2(aliq.nfM)+n2(aliq.rS)+n2(aliq.comM)+n2(aliq.neg));
    return(1+mk)/a;
  } else if(cat&&cat.indexOf('MB-')===0){
    // Mobilização: (1+Margem) / (1 - NF - RS - ComS - Neg)
    var mg=n2(cfg.s[cat]&&cfg.s[cat].m);
    var a=1-(n2(aliq.nfS)+n2(aliq.rS)+n2(aliq.comS)+n2(aliq.neg));
    return(1+mg)/a;
  } else {
    // Serviço Técnico: 1 / ((1-Margem) × (1 - NF - RS - ComS - Neg))
    var mg=n2(cfg.s[cat]&&cfg.s[cat].m);
    var a=1-(n2(aliq.nfS)+n2(aliq.rS)+n2(aliq.comS)+n2(aliq.neg));
    return 1/((1-mg)*a);
  }
}


function fmtPct(v){ return (n2(v)*100).toFixed(2).replace('.',',')+'%'; }

function getCatMeta(cfg,tipo,cat){
  if(tipo==='material') return (cfg.m&&cfg.m[cat])||null;
  return (cfg.s&&cfg.s[cat])||null;
}

function explainFMF(cfg,tipo,cat){
  var aliq=cfg.aliq||{};
  var meta=getCatMeta(cfg,tipo,cat)||{};
  var isMat=(tipo==='material');
  var isMob=(!isMat && cat && cat.indexOf('MB-')===0);

  var nf=isMat?n2(aliq.nfM):n2(aliq.nfS);
  var rs=n2(aliq.rS);
  var com=isMat?n2(aliq.comM):n2(aliq.comS);
  var neg=n2(aliq.neg);
  var impostosTaxas = nf + rs + com + neg;
  var a=1-impostosTaxas;

  var formulaTxt='', substituicao='', detalhe='', fmf=0;
  var margemBruta=0, rangeMin=0, rangeMax=0, rotuloMargem='';

  if(isMat){
    margemBruta=n2(meta.mk);
    rangeMin=n2(meta.rMin);
    rangeMax=n2(meta.rMax);
    rotuloMargem='Margem bruta sobre custo';
    fmf=(1+margemBruta)/a;
    formulaTxt='FMF = (1 + Margem Bruta do Material) ÷ (1 − Impostos e Taxas)';
    substituicao='FMF = (1 + '+margemBruta.toFixed(4)+') ÷ (1 − '+impostosTaxas.toFixed(4)+')';
    detalhe='FMF = '+(1+margemBruta).toFixed(4)+' ÷ '+a.toFixed(4)+' = '+fmf.toFixed(6);
  }else if(isMob){
    margemBruta=n2(meta.m);
    rangeMin=n2(meta.rMin);
    rangeMax=n2(meta.rMax);
    rotuloMargem='Margem bruta de mobilização';
    fmf=(1+margemBruta)/a;
    formulaTxt='FMF = (1 + Margem Bruta de Mobilização) ÷ (1 − Impostos e Taxas)';
    substituicao='FMF = (1 + '+margemBruta.toFixed(4)+') ÷ (1 − '+impostosTaxas.toFixed(4)+')';
    detalhe='FMF = '+(1+margemBruta).toFixed(4)+' ÷ '+a.toFixed(4)+' = '+fmf.toFixed(6);
  }else{
    margemBruta=n2(meta.m);
    rangeMin=n2(meta.rMin);
    rangeMax=n2(meta.rMax);
    rotuloMargem='Margem bruta de serviço';
    fmf=1/((1-margemBruta)*a);
    formulaTxt='FMF = 1 ÷ ((1 − Margem Bruta do Serviço) × (1 − Impostos e Taxas))';
    substituicao='FMF = 1 ÷ ((1 − '+margemBruta.toFixed(4)+') × (1 − '+impostosTaxas.toFixed(4)+'))';
    detalhe='FMF = 1 ÷ ('+(1-margemBruta).toFixed(4)+' × '+a.toFixed(4)+') = '+fmf.toFixed(6);
  }

  return {
    meta:meta, fmf:fmf, a:a, nf:nf, rs:rs, com:com, neg:neg, impostosTaxas:impostosTaxas,
    margemBruta:margemBruta, rangeMin:rangeMin, rangeMax:rangeMax, rotuloMargem:rotuloMargem,
    formulaTxt:formulaTxt, substituicao:substituicao, detalhe:detalhe,
    tipoLabel:isMat?'Material':(isMob?'Mobilização':'Serviço Técnico')
  };
}

function gerarMemorialFMF(){
  var cfg=getPrcAtual();
  var lista=(budg||[]).filter(function(it){ return !!it && it.inc!==false; });
  if(!lista.length){ alert('Nenhum item incluido no orcamento para gerar o memorial.'); return; }

  var grupos={};
  lista.forEach(function(it){
    var key=(it.t||'')+'|'+(it.cat||'');
    if(!grupos[key]) grupos[key]={tipo:it.t, cat:it.cat, itens:[]};
    grupos[key].itens.push(it);
  });

  function brN(n,dec){ return n2(n).toFixed(dec||4).replace('.',','); }
  function brPct(n){ return (n2(n)*100).toFixed(2).replace('.',',')+'%'; }
  function brR(n){ return 'R$ '+n2(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function e(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function li(txt){ return '<li style="margin-bottom:4px">'+txt+'</li>'; }

  var blocos='';
  Object.keys(grupos).sort().forEach(function(key,gi){
    var g=grupos[key];
    var exp=explainFMF(cfg,g.tipo,g.cat);
    var meta=exp.meta||{};
    var nomeCat=(meta.n||g.cat||'Categoria');
    var descCat=(meta.desc||'');
    var isMat=(g.tipo==='material');
    var isMob=(!isMat && g.cat && g.cat.indexOf('MB-')===0);
    var nf=exp.nf, rs=exp.rs, com=exp.com, neg=exp.neg, mb=exp.margemBruta;
    var somaAliq=nf+rs+com+neg; var fmf=exp.fmf;
    var rotuloMb=isMat?'mk (margem material)':isMob?'mm (margem mobilizacao)':'mb (margem servico)';

    var dadosHtml=''
      +li('<strong>'+e(rotuloMb)+'</strong> = '+brPct(mb)+' = '+brN(mb)+' - categoria '+e(g.cat))
      +li('<strong>NF '+(isMat?'Materiais':'Servicos')+'</strong> = '+brPct(nf)+' = '+brN(nf)+' - aliquotas da proposta')
      +li('<strong>Risco Sacado (RS)</strong> = '+brPct(rs)+' = '+brN(rs)+' - aliquotas da proposta')
      +li('<strong>Comissao (Com)</strong> = '+brPct(com)+' = '+brN(com)+' - aliquotas da proposta')
      +li('<strong>Negociacao (Neg)</strong> = '+brPct(neg)+' = '+brN(neg)+' - aliquotas da proposta');

    var formulaHtml='';
    if(isMat){
      formulaHtml=li('Total de aliquotas = NF + RS + Com + Neg')+li('FMF = (1 + mk) / (1 - aliquotas)')+li('PV unitario = Custo unitario x FMF')+li('PV total = PV unitario x Quantidade');
    } else if(isMob){
      formulaHtml=li('Total de aliquotas = NF + RS + Com + Neg')+li('FMF = (1 + mm) / (1 - aliquotas)')+li('PV unitario = Custo unitario x FMF')+li('PV total = PV unitario x Quantidade');
    } else {
      formulaHtml=li('Total de aliquotas = NF + RS + Com + Neg')+li('FMF = 1 / [ (1 - mb) x (1 - aliquotas) ]')+li('PV unitario = Custo unitario x FMF')+li('PV total = PV unitario x Quantidade');
    }

    var fmfHtml='';
    if(isMat||isMob){
      var rotuloM=isMat?'mk':'mm'; var num=1+mb, den=1-somaAliq;
      fmfHtml=li('FMF = (1 + '+rotuloM+') / (1 - aliquotas)')
        +li('FMF = (1 + '+brN(mb)+') / (1 - ('+brN(nf)+' + '+brN(rs)+' + '+brN(com)+' + '+brN(neg)+'))')
        +li('FMF = '+brN(num)+' / (1 - '+brN(somaAliq)+')')
        +li('FMF = '+brN(num)+' / '+brN(den))
        +li('<strong>FMF = '+brN(fmf,6)+'</strong>');
    } else {
      var f1=1-mb, f2=1-somaAliq, prod=f1*f2;
      fmfHtml=li('FMF = 1 / [ (1 - mb) x (1 - aliquotas) ]')
        +li('FMF = 1 / [ (1 - '+brN(mb)+') x (1 - ('+brN(nf)+' + '+brN(rs)+' + '+brN(com)+' + '+brN(neg)+')) ]')
        +li('FMF = 1 / [ (1 - '+brN(mb)+') x (1 - '+brN(somaAliq)+') ]')
        +li('FMF = 1 / [ '+brN(f1)+' x '+brN(f2)+' ]')
        +li('FMF = 1 / '+brN(prod))
        +li('<strong>FMF = '+brN(fmf,6)+'</strong>');
    }

    var itensHtml=g.itens.map(function(it,ii){
      var cu=n2(it.cu), pvUnit=n2(it.pvu), pvTot=n2(it.pvt);
      var ih='<div style="font-size:12px;font-weight:700;color:#166534;margin:12px 0 4px">Item '+(ii+1)+': '+e(it.desc||nomeCat)+'</div><ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.9">';
      if(isMat){
        var qtd=n2(it.mult||1), un=e(it.un1||'un');
        ih+=li('PV unitario = Custo unitario x FMF')+li('PV unitario = '+brR(cu)+' x '+brN(fmf,6))+li('<strong>PV unitario = '+brR(pvUnit)+'</strong>')
          +li('PV total = PV unitario x Quantidade')+li('PV total = '+brR(pvUnit)+' x '+qtd+' '+un)+li('<strong>PV total = '+brR(pvTot)+'</strong>');
      } else {
        var tec=n2(it.tec||1), dias=n2(it.dias||0), hpd=n2(it.hpd||0), un2=e(it.un2||'Horas'), qtdTotal=tec*dias*hpd;
        ih+=li('PV unitario = Custo unitario x FMF')+li('PV unitario = '+brR(cu)+' x '+brN(fmf,6))+li('<strong>PV unitario = '+brR(pvUnit)+'</strong>')
          +li('PV total = PV unitario x Quantidade')+li('PV total = '+brR(pvUnit)+' x ('+tec+' x '+dias+' x '+hpd+')')
          +li('PV total = '+brR(pvUnit)+' x '+qtdTotal+' '+un2)+li('<strong>PV total = '+brR(pvTot)+'</strong>');
      }
      ih+='</ul>'; return ih;
    }).join('');

    blocos+='<div style="page-break-inside:avoid;border:2px solid #1e3a5f;border-radius:10px;padding:18px 20px;margin:0 0 28px 0">'
      +'<div style="font-size:17px;font-weight:700;color:#0f172a;margin-bottom:4px">'+(gi+1)+'. '+e(g.cat)+' - '+e(nomeCat)+'</div>'
      +'<div style="font-size:12px;color:#475569;margin-bottom:16px"><strong>Tipo:</strong> '+e(exp.tipoLabel)+(descCat?' | <strong>Escopo:</strong> '+e(descCat):'')+'</div>'
      +'<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin-bottom:12px">'
        +'<div style="font-size:13px;font-weight:700;color:#1e3a8a;margin-bottom:8px">DADOS</div>'
        +'<ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.9">'+dadosHtml+'</ul></div>'
      +'<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 16px;margin-bottom:12px">'
        +'<div style="font-size:13px;font-weight:700;color:#9a3412;margin-bottom:8px">FORMULA</div>'
        +'<ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.9">'+formulaHtml+'</ul></div>'
      +'<div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px">'
        +'<div style="font-size:13px;font-weight:700;color:#854d0e;margin-bottom:8px">SUBSTITUINDO OS VALORES</div>'
        +'<ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.9">'+fmfHtml+'</ul>'
        +itensHtml+'</div></div>';
  });

  var agora=new Date().toLocaleString('pt-BR');
  var numP=(Q('pNum')&&Q('pNum').value)||'Sem numero';
  var cliP=(Q('pCli')&&Q('pCli').value)||'Cliente';
  var subtitulo=e(numP+' - '+cliP)+' | Gerado em: '+e(agora);

  var _mm=document.getElementById('memorialModal');
  if(!_mm){
    _mm=document.createElement('div');
    _mm.id='memorialModal';
    _mm.setAttribute('style','display:none;position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9999;align-items:flex-start;justify-content:center;padding:12px;overflow-y:auto');
    var _inner=document.createElement('div');
    _inner.setAttribute('style','width:min(860px,100%);background:#fff;border-radius:12px;overflow:hidden;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,.4)');
    var _hdr=document.createElement('div');
    _hdr.setAttribute('style','position:sticky;top:0;z-index:10;background:#1e3a5f;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px');
    var _titBox=document.createElement('div');
    var _tit=document.createElement('div'); _tit.setAttribute('style','font-size:16px;font-weight:700;color:#fff'); _tit.textContent='Memorial de Calculo do FMF';
    var _sub=document.createElement('div'); _sub.id='memorialSubtitle'; _sub.setAttribute('style','font-size:11px;color:rgba(255,255,255,.65);margin-top:2px');
    _titBox.appendChild(_tit); _titBox.appendChild(_sub);
    var _btnBox=document.createElement('div'); _btnBox.setAttribute('style','display:flex;gap:8px;flex-shrink:0');
    var _btnImp=document.createElement('button');
    _btnImp.setAttribute('style','padding:6px 14px;border:1px solid rgba(255,255,255,.3);background:transparent;color:#fff;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit');
    _btnImp.textContent='Imprimir';
    _btnImp.onclick=function(){
      var c=document.getElementById('memorialContent'); if(!c) return;
      var w=window.open('','_blank');
      w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Memorial FMF</title><style>@page{size:A4;margin:14mm}body{font-family:Arial,sans-serif;font-size:12px;color:#111;padding:10px}</style></head><body>'+c.innerHTML+'<script>window.onafterprint=function(){window.close()};window.onload=function(){window.print()};<\/script></body></html>');
      w.document.close();
    };
    var _btnFch=document.createElement('button');
    _btnFch.setAttribute('style','padding:6px 14px;border:none;background:rgba(255,255,255,.15);color:#fff;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:700');
    _btnFch.textContent='X Fechar'; _btnFch.onclick=function(){ _mm.style.display='none'; };
    _btnBox.appendChild(_btnImp); _btnBox.appendChild(_btnFch);
    _hdr.appendChild(_titBox); _hdr.appendChild(_btnBox);
    var _body=document.createElement('div'); _body.id='memorialContent';
    _body.setAttribute('style','padding:20px;font-family:Arial,sans-serif;font-size:13px;color:#111827;background:#fff');
    _inner.appendChild(_hdr); _inner.appendChild(_body);
    _mm.appendChild(_inner);
    _mm.addEventListener('click',function(ev){ if(ev.target===_mm) _mm.style.display='none'; });
    document.body.appendChild(_mm);
  }
  document.getElementById('memorialContent').innerHTML=blocos;
  var _ms=document.getElementById('memorialSubtitle'); if(_ms) _ms.textContent=subtitulo;
  _mm.style.display='flex'; _mm.scrollTop=0;
}


var editBId=null;

function fillItemForm(it){
  if(!it) return;
  if(Q('iTipo')) Q('iTipo').value = it.t || 'servico';
  onTipo();
  Q('iCat').value = it.cat || '';
  if(Q('iEquip')) Q('iEquip').value = it.equip || '';
  if(Q('iInst'))  Q('iInst').value  = it.inst  || '';
  _atualizarHistTrab();
  if(Q('iTipoTrab')) Q('iTipoTrab').value = it.tipoTrab || '';
  if(Q('iFaseTrab')) Q('iFaseTrab').value = it.faseTrab || '';
  Q('iDesc').value = it.desc || '';
  Q('iCU').value = n2(it.cu||0);
  if(it.t==='material'){
    Q('iQtd').value = n2(it.mult||1);
    if(Q('iQtdUn')) Q('iQtdUn').value = it.un1 || 'Unidade';
    if(Q('iLink')){ Q('iLink').value = it.link || ''; var b=document.getElementById('btnAbrirLink'); if(b) b.style.display=(it.link?'':'none'); }
  }else{
    Q('iTec').value = n2(it.tec||1);
    Q('iDias').value = n2(it.dias||1);
    Q('iHpd').value = n2(it.hpd||1);
    if(Q('iDiasUn')) Q('iDiasUn').value = it.un1 || 'Dias';
    if(Q('iHpdUn')) Q('iHpdUn').value = it.un2 || 'Horas';
  }
}

function resetItemForm(){
  editBId=null;
  if(Q('iTipo')) Q('iTipo').value='servico'; onTipo();
  Q('iCat').selectedIndex=0;
  if(Q('iEquip')) Q('iEquip').value='';
  if(Q('iInst'))  Q('iInst').value='';
  if(Q('iTipoTrab')) Q('iTipoTrab').value='';
  if(Q('iFaseTrab')) Q('iFaseTrab').value='';
  Q('iDesc').value='';
  Q('iCU').value=0;
  Q('iTec').value=1;
  Q('iDias').value=1;
  Q('iHpd').value=1;
  Q('iQtd').value=1;
  if(Q('iLink')){Q('iLink').value=''; var _bl=document.getElementById('btnAbrirLink'); if(_bl) _bl.style.display='none';}
  var btn=Q('btnAddItem'); if(btn) btn.innerHTML='➕ Adicionar';
  var info=Q('editItemInfo'); if(info) info.style.display='none';
}

function editItem(id){
  var it=budg.find(function(x){return x.id===id});
  if(!it) return;
  abrirItemModal(it);
}

function cancelEditB(){
  resetItemForm();
}

function dupItem(id){
  var it=budg.find(function(x){return x.id===id});
  if(!it) return;
  _dupSrcId=id;
  _dupCopias=[];
  var qt=parseInt(prompt('Quantas cópias deseja criar?','1'));
  if(!qt||isNaN(qt)||qt<1||qt>50) return;
  // Monta o array de cópias para edição
  for(var i=0;i<qt;i++){
    var cp=JSON.parse(JSON.stringify(it));
    cp.id=uid();
    cp._dupIdx=i;
    _dupCopias.push(cp);
  }
  _dupIdx=0;
  _abrirDupModal();
}

var _dupSrcId=null, _dupCopias=[], _dupIdx=0;

function _abrirDupModal(){
  var m=document.getElementById('dupModal');
  if(!m) return;
  var it=_dupCopias[_dupIdx];
  var total=_dupCopias.length;
  document.getElementById('dupModalTit').textContent='📄 Cópia '+((_dupIdx+1))+' de '+total;
  document.getElementById('dupDesc').textContent=(it.desc||it.cat||'');
  document.getElementById('dupEquip').value=it.equip||'';
  document.getElementById('dupInst').value=it.inst||'';
  document.getElementById('dupTipoTrab').value=it.tipoTrab||'';
  document.getElementById('dupFaseTrab').value=it.faseTrab||'';
  document.getElementById('dupBtnAnterior').style.display=_dupIdx>0?'':'none';
  document.getElementById('dupBtnProximo').textContent=_dupIdx<total-1?'Próxima cópia →':'✅ Confirmar e Adicionar';
  _atualizarHistTrab();
  m.style.display='flex';
}

function _dupSalvarAtual(){
  var it=_dupCopias[_dupIdx];
  it.equip=(document.getElementById('dupEquip').value||'').trim();
  it.inst=(document.getElementById('dupInst').value||'').trim();
  it.tipoTrab=(document.getElementById('dupTipoTrab').value||'').trim();
  it.faseTrab=(document.getElementById('dupFaseTrab').value||'').trim();
}

function dupModalProximo(){
  _dupSalvarAtual();
  if(_dupIdx<_dupCopias.length-1){
    _dupIdx++;
    _abrirDupModal();
  } else {
    _dupConfirmar();
  }
}

function dupModalAnterior(){
  _dupSalvarAtual();
  if(_dupIdx>0){ _dupIdx--; _abrirDupModal(); }
}

function dupModalAplicarTodas(){
  _dupSalvarAtual();
  var equip=document.getElementById('dupEquip').value;
  var inst=document.getElementById('dupInst').value;
  var tipoTrab=document.getElementById('dupTipoTrab').value;
  var faseTrab=document.getElementById('dupFaseTrab').value;
  _dupCopias.forEach(function(it){
    if(equip) it.equip=equip;
    if(inst)  it.inst=inst;
    if(tipoTrab) it.tipoTrab=tipoTrab;
    if(faseTrab) it.faseTrab=faseTrab;
  });
  toast('Campos aplicados a todas as cópias','ok');
}

function dupModalFechar(){
  document.getElementById('dupModal').style.display='none';
  _dupCopias=[]; _dupIdx=0; _dupSrcId=null;
}

function _dupConfirmar(){
  var srcIdx=budg.findIndex(function(x){return x.id===_dupSrcId});
  _dupCopias.forEach(function(cp,i){
    budg.splice(srcIdx+1+i,0,normalizeBudgetItem(cp));
  });
  rBudg(); updKpi();
  try{ if(editId) upsertCurrentDraft(true); }catch(e){}
  toast(_dupCopias.length+' cópia(s) adicionada(s)!','ok');
  document.getElementById('dupModal').style.display='none';
  _dupCopias=[]; _dupIdx=0; _dupSrcId=null;
}

function getCatLabel(tipo,cat){
  try{
    if(tipo==='material' && CAT && CAT.MAT && CAT.MAT[cat]) return CAT.MAT[cat].n||cat||'';
    if(CAT && CAT.SVC && CAT.SVC[cat]) return CAT.SVC[cat].n||cat||'';
  }catch(e){}
  return cat||'';
}
function normalizeBudgetItem(it){
  it=it||{};
  var tipo=(it.t==='material')?'material':'servico';
  var cat=(it.cat||it.categoria||'').toString();
  var descRaw=it.desc;
  if(descRaw===undefined || descRaw===null || String(descRaw).trim()==='') descRaw=it.descricao;
  if(descRaw===undefined || descRaw===null || String(descRaw).trim()==='') descRaw=it.nome;
  var desc=String(descRaw||'').trim();
  var mult=n2(it.mult||it.qtd||it.quantidade||1);
  if(mult<=0) mult=1;
  var cu=n2(it.cu||it.custoUnit||it.custo||0);
  var fmf=n2(it.fmf||0);
  var pvu=n2(it.pvu||0);
  var pvt=n2(it.pvt||0);
  var out={
    id:it.id||uid(),
    t:tipo,
    cat:cat,
    desc:desc,
    cu:cu,
    mult:mult,
    fmf:fmf,
    pvu:pvu,
    pvt:pvt,
    un1:(it.un1||it.unidade||'').toString(),
    un2:(it.un2||'').toString(),
    tec:Math.max(1,n2(it.tec||1)),
    dias:Math.max(0,n2(it.dias||1)),
    hpd:Math.max(0,n2(it.hpd||1)),
    inc:it.inc!==false,
    terc:it.terc===true,
    det:it.det!==false,
    link:(it.link||'').toString().trim(),
    equip:(it.equip||it.equipamento||'').toString().trim(),
    inst:(it.inst||it.instalacao||'').toString().trim(),
    tipoTrab:(it.tipoTrab||'').toString().trim(),
    faseTrab:(it.faseTrab||'').toString().trim(),
    cuFormula:(it.cuFormula||'').toString().trim(),
    cuLog:Array.isArray(it.cuLog)?it.cuLog:[]
  };
  if(!out.desc) out.desc=getCatLabel(out.t,out.cat);
  return out;
}

function addItem(){
  var _itipoEl=Q('iTipo'),_icatEl=Q('iCat'),_icuEl=Q('iCU');
  if(!_itipoEl||!_icatEl||!_icuEl) return;
  var cfg=getPrcAtual(),t=_itipoEl.value,cat=_icatEl.value,cu=n2(_icuEl.value);
  if(!cat){alert('Selecione categoria.');return}if(cu<=0){alert('Custo > 0.');return}
  var mult=1,un1='',un2='';
  if(t==='material'){
    mult=Math.max(1,n2(Q('iQtd').value));
    un1=Q('iQtdUn').value;
  } else {
    var tec=Math.max(1,n2(Q('iTec').value));
    var dias=Math.max(0,n2(Q('iDias').value));
    var hpd=Math.max(0,n2(Q('iHpd').value));
    un1=Q('iDiasUn').value;
    un2=Q('iHpdUn').value;
    mult=tec*dias*hpd;
  }
  var fmf=calcFMF(cfg,t,cat),pvu=cu*fmf,pvt=pvu*mult;
  var _tec=t==='material'?1:Math.max(1,n2(Q('iTec').value));
  var _dias=t==='material'?1:Math.max(0,n2(Q('iDias').value));
  var _hpd=t==='material'?1:Math.max(0,n2(Q('iHpd').value));
  var _link=t==='material'?((Q('iLink').value||'').trim()):'';
  var descDigitada=(Q('iDesc').value||'').trim();
  var _equip=(Q('iEquip')&&Q('iEquip').value||'').trim();
  var _inst=(Q('iInst')&&Q('iInst').value||'').trim();
  var _tipoTrab=(Q('iTipoTrab')&&Q('iTipoTrab').value||'').trim();
  var _faseTrab=(Q('iFaseTrab')&&Q('iFaseTrab').value||'').trim();
  var baseItem=normalizeBudgetItem({id:editBId||uid(),t:t,cat:cat,desc:descDigitada||getCatLabel(t,cat),cu:cu,mult:mult,fmf:fmf,pvu:pvu,pvt:pvt,un1:un1,un2:un2,tec:_tec,dias:_dias,hpd:_hpd,inc:true,terc:false,det:true,link:_link,equip:_equip,inst:_inst,tipoTrab:_tipoTrab,faseTrab:_faseTrab});

  if(editBId){
    var idx=budg.findIndex(function(x){return x.id===editBId});
    if(idx>-1){
      var old=budg[idx]||{};
      baseItem.inc = old.inc!==false;
      baseItem.terc = old.terc===true;
      baseItem.det = old.det!==false;
      budg[idx]=baseItem;
    }else{
      budg.unshift(baseItem);
    }
  }else{
    budg.unshift(baseItem);
  }

  resetItemForm();
  rBudg();
  updKpi();
  try{ if(editId) upsertCurrentDraft(true); }catch(e){}
}
function togIndicadores(){
  var body=Q('orcIndicadores'), ch=Q('indicChevron');
  if(!body||!ch) return;
  var open=body.style.display!=='none';
  body.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲';
}

function togKpiCard(){
  var body=Q('kpiCardBody'), ch=Q('kpiCardChevron');
  if(!body||!ch) return;
  var open=body.style.display!=='none';
  body.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲';
}

var _budgSortAtivo = '';  // campo de ordenação/agrupamento ativo
var _budgGrupos = [];      // array de agrupamentos ativos (multi-nível)


// ── Modo Planilha ──────────────────────────────────────────────
var _modoPlanilha = false;

// Corrige selects de categoria no modo planilha
// (selected via string HTML é ignorado pelo browser — precisamos setar .value)
function _fixPlanilhaSelects(){
  budg.forEach(function(it){
    var el = document.getElementById('psel_'+it.id);
    if(!el) return;
    var cat = (it.cat||'').trim().toUpperCase();

    // 1. Tenta setar direto (exact match)
    el.value = it.cat;
    if(el.value === it.cat) return;  // funcionou

    // 2. Tenta match case-insensitive / trim nas opções existentes
    var opts = Array.from(el.options);
    var found = opts.find(function(o){ return o.value.trim().toUpperCase() === cat; });
    if(found){ el.value = found.value; return; }

    // 3. Categoria não existe na lista — adiciona como opção no topo
    if(it.cat){
      var opt = document.createElement('option');
      opt.value = it.cat;
      opt.textContent = it.cat + ' — (cat. do item)';
      opt.style.color = 'var(--accent)';
      el.insertBefore(opt, el.firstChild);
      el.value = it.cat;
    }
  });
}

function _updateRowReadOnly(it){
  if(!_modoPlanilha) return;
  var custoTotal = n2(it.cu) * n2(it.mult);
  var selEl = document.getElementById('psel_'+it.id) || document.getElementById('ptyp_'+it.id);
  if(!selEl) return;
  var tr = selEl.closest('tr');
  if(!tr) return;
  var tds = tr.querySelectorAll('td');
  // #=0,Tipo=1,Cat=2,Equip=3,Inst=4,Desc=5,Qtd=6,CuUnit=7,CuTot=8,FMF=9,PVUnit=10,PVTot=11
  if(tds[8])  tds[8].textContent  = money(custoTotal);
  if(tds[9])  tds[9].textContent  = n2(it.fmf).toFixed(4);
  if(tds[10]) tds[10].textContent = money(it.pvu);
  if(tds[11]) tds[11].textContent = money(it.pvt)+(it.terc?' T':'');
}

function toggleModoPlanilha(){
  _modoPlanilha = !_modoPlanilha;
  var btn = Q('btnModoPlanilha');
  if(btn){
    btn.style.background = _modoPlanilha ? 'var(--accent)' : '';
    btn.style.color      = _modoPlanilha ? '#000' : '';
    btn.textContent      = _modoPlanilha ? '✅ Modo Planilha ON' : '📝 Modo Planilha';
  }
  rBudg();
}

// Salva edição inline de um campo e recalcula preços se necessário
function _saveInlineField(id, field, rawValue){
  var it = budg.find(function(x){ return x.id===id; });
  if(!it) return;
  var cfg = getPrcAtual();

  if(field==='desc'){
    it.desc = rawValue.trim();
  } else if(field==='equip'){
    it.equip = rawValue.trim();
  } else if(field==='inst'){
    it.inst = rawValue.trim();
  } else if(field==='cat'){
    it.cat = rawValue;
    // Detecta se a categoria pertence ao outro tipo e corrige automaticamente
    var catNoTipoAtual  = !!(cfg.m[it.cat]&&it.t==='material' || cfg.s[it.cat]&&it.t==='servico');
    var catNoOutroTipo  = !!(cfg.m[it.cat]&&it.t==='servico'  || cfg.s[it.cat]&&it.t==='material');
    if(!catNoTipoAtual && catNoOutroTipo){
      // Categoria pertence ao outro tipo — corrige o tipo
      it.t = cfg.m[it.cat] ? 'material' : 'servico';
      // Atualiza o select de Tipo na linha
      var selTipo2 = document.getElementById('ptyp_'+it.id);
      if(selTipo2) selTipo2.value = it.t;
    }
    // Recalcula FMF e preços com tipo (possivelmente corrigido)
    var fmf = calcFMF(cfg, it.t, it.cat);
    it.fmf = fmf||1;
    it.pvu = n2(it.cu) * it.fmf;
    it.pvt = it.pvu * n2(it.mult);
    // Atualiza células read-only sem rerenderizar a tabela inteira
    _updateRowReadOnly(it);
  } else if(field==='tipo'){
    var novoTipo = (rawValue==='material'||rawValue==='m') ? 'material' : 'servico';
    it.t = novoTipo;
    var dictNovo = novoTipo==='material' ? cfg.m : cfg.s;
    // Tenta manter a categoria atual se ela existir no novo tipo
    if(!dictNovo[it.cat]){
      // Categoria não existe no novo tipo — escolhe a primeira disponível
      var primeirasCats = Object.keys(dictNovo).sort();
      it.cat = primeirasCats.length ? primeirasCats[0] : '';
    }
    // Recalcula FMF com novo tipo e nova categoria
    var fmf2 = calcFMF(cfg, it.t, it.cat)||1;
    it.fmf = fmf2;
    it.pvu = n2(it.cu) * fmf2;
    it.pvt = it.pvu * n2(it.mult);
    // Recarrega select de categoria com opções do novo tipo e seta a categoria correta
    var selCat2 = document.getElementById('psel_'+it.id);
    if(selCat2){
      selCat2.innerHTML = _getCatOptions(it.t, '');
      setTimeout(function(){
        selCat2.value = it.cat;
        _updateRowReadOnly(it);
      }, 0);
    }
  } else if(field==='cu'){
    var v = n2(rawValue);
    if(v >= 0){
      it.cu  = v;
      it.pvu = v * n2(it.fmf);
      it.pvt = it.pvu * n2(it.mult);
      _updateRowReadOnly(it);
    }
  } else if(field==='mult'){
    var v = n2(rawValue);
    if(v > 0){
      if(it.t === 'material'){
        it.mult = v;
      } else {
        // Para serviço: quantidade = tec × dias × hpd
        // Armazena como dias (simplificado — mantém tec e hpd)
        it.dias = v;
        it.mult = n2(it.tec||1) * v * n2(it.hpd||1);
      }
      it.pvt = n2(it.pvu) * it.mult;
      _updateRowReadOnly(it);
    }
  }

  rBudg(); updKpi();
  try{ if(editId) upsertCurrentDraft(true); }catch(e){}
}

// Gera options do select de categoria para uso inline
function _getCatOptions(tipo, selectedCat){
  var cfg = getPrcAtual();
  var d   = tipo==='material' ? cfg.m : cfg.s;
  // Se selectedCat não existe no tipo atual, inclui também as do outro tipo
  var dAlt = tipo==='material' ? cfg.s : cfg.m;
  var catExiste = !selectedCat || !!d[selectedCat];
  var opts = Object.keys(d).sort().map(function(k){
    return '<option value="'+k+'"'+(k===selectedCat?' selected':'')+'>'+k+' — '+d[k].n+'</option>';
  });
  if(!catExiste && selectedCat){
    // Adiciona separador e categorias do outro tipo
    opts.push('<option disabled>── outras ──</option>');
    Object.keys(dAlt).sort().forEach(function(k){
      opts.push('<option value="'+k+'"'+(k===selectedCat?' selected':'')+'>'+k+' — '+dAlt[k].n+'</option>');
    });
  }
  return opts.join('');
}
// ────────────────────────────────────────────────────────────────

// ── Ordenação por coluna (clique no cabeçalho) ──────────────────
var _colSort = {key: '', dir: 0};  // dir: 0=none, 1=asc, -1=desc

function sortCol(key){
  if(_colSort.key === key){
    _colSort.dir = _colSort.dir === 1 ? -1 : (_colSort.dir === -1 ? 0 : 1);
  } else {
    _colSort.key = key;
    _colSort.dir = 1;
  }
  if(_colSort.dir !== 0){
    budg.sort(function(a,b){
      var va, vb;
      if(key==='tipo')  { va=a.t||'';         vb=b.t||''; }
      else if(key==='cat')   { va=a.cat||'';       vb=b.cat||''; }
      else if(key==='equip') { va=a.equip||'';     vb=b.equip||''; }
      else if(key==='inst')  { va=a.inst||'';      vb=b.inst||''; }
      else if(key==='desc')  { va=a.desc||'';      vb=b.desc||''; }
      else if(key==='mult')  { va=n2(a.mult);      vb=n2(b.mult); return _colSort.dir*(va-vb); }
      else if(key==='cu')    { va=n2(a.cu);        vb=n2(b.cu);   return _colSort.dir*(va-vb); }
      else if(key==='ctot')  { va=n2(a.cu)*n2(a.mult); vb=n2(b.cu)*n2(b.mult); return _colSort.dir*(va-vb); }
      else if(key==='fmf')   { va=n2(a.fmf);      vb=n2(b.fmf);  return _colSort.dir*(va-vb); }
      else if(key==='pvu')   { va=n2(a.pvu);      vb=n2(b.pvu);  return _colSort.dir*(va-vb); }
      else if(key==='pvt')   { va=n2(a.pvt);      vb=n2(b.pvt);  return _colSort.dir*(va-vb); }
      else { va=''; vb=''; }
      return _colSort.dir * va.localeCompare(vb);
    });
  }
  _updateColSortUI();
  rBudg(); updKpi();
  try{ if(editId) upsertCurrentDraft(true); }catch(e){}
}


// ── Seleção em lote ──────────────────────────────────────────────
function _onBudgSel(){
  var sel=document.querySelectorAll('.budg-sel:checked');
  var n=sel.length;
  var btn=Q('btnEditarSel');  if(btn)  btn.style.display=n>0?'':'none';
  var btn2=Q('btnDupSel');   if(btn2) btn2.style.display=n>0?'':'none';
  var cnt=Q('selCount');     if(cnt)  cnt.textContent=n;
}

function abrirEdicaoLote(){
  var sel=document.querySelectorAll('.budg-sel:checked');
  if(!sel.length){ toast('Selecione ao menos 1 item.','err'); return; }
  _atualizarHistTrab();
  // Limpa campos
  ['lotEquip','lotInst','lotTipoTrab','lotFaseTrab'].forEach(function(id){
    var el=Q(id); if(el) el.value='';
  });
  // Mostra quais itens estão selecionados
  var nomes=[];
  sel.forEach(function(cb){
    var it=budg.find(function(x){return x.id===cb.getAttribute('data-id');});
    if(it) nomes.push(it.desc||it.cat||'');
  });
  var preview=Q('lotPreview');
  if(preview) preview.innerHTML=nomes.map(function(n,i){
    return '<div style="font-size:.75rem;color:var(--text2);padding:.15rem 0;border-bottom:1px solid var(--border)">'+esc(n)+'</div>';
  }).join('');
  var m=Q('lotModal');
  if(m) m.style.display='flex';
}

function lotFechar(){
  var m=Q('lotModal'); if(m) m.style.display='none';
}

function lotAplicar(){
  var equip=(Q('lotEquip').value||'').trim();
  var inst=(Q('lotInst').value||'').trim();
  var tipoTrab=(Q('lotTipoTrab').value||'').trim();
  var faseTrab=(Q('lotFaseTrab').value||'').trim();

  var sel=document.querySelectorAll('.budg-sel:checked');
  var count=0;
  sel.forEach(function(cb){
    var it=budg.find(function(x){return x.id===cb.getAttribute('data-id');});
    if(!it) return;
    if(equip!=='')   it.equip=equip;
    if(inst!=='')    it.inst=inst;
    if(tipoTrab!=='') it.tipoTrab=tipoTrab;
    if(faseTrab!=='') it.faseTrab=faseTrab;
    count++;
  });

  // Desmarcar checkboxes
  sel.forEach(function(cb){ cb.checked=false; });
  _onBudgSel();
  lotFechar();
  rBudg(); updKpi();
  try{ if(editId) upsertCurrentDraft(true); }catch(e){}
  toast(count+' item(ns) atualizado(s)!','ok');
}


function abrirDupLote(){
  var sel=document.querySelectorAll('.budg-sel:checked');
  if(!sel.length){ toast('Selecione ao menos 1 item.','err'); return; }
  _atualizarHistTrab();
  // Monta lista de ids selecionados
  _dupLoteIds=[];
  sel.forEach(function(cb){ _dupLoteIds.push(cb.getAttribute('data-id')); });
  // Limpa campos
  ['dlEquip','dlInst','dlTipoTrab','dlFaseTrab'].forEach(function(id){
    var el=Q(id); if(el) el.value='';
  });
  // Mostra lista
  var preview=Q('dlPreview');
  if(preview) preview.innerHTML=_dupLoteIds.map(function(id){
    var it=budg.find(function(x){return x.id===id;});
    return it?'<div style="font-size:.75rem;color:var(--text2);padding:.15rem 0;border-bottom:1px solid var(--border)">'+esc(it.desc||it.cat||'')+'</div>':'';
  }).join('');
  var m=Q('dlModal'); if(m) m.style.display='flex';
}
var _dupLoteIds=[];

function dlFechar(){ var m=Q('dlModal'); if(m) m.style.display='none'; }

function dlConfirmar(){
  var equip=(Q('dlEquip').value||'').trim();
  var inst=(Q('dlInst').value||'').trim();
  var tipoTrab=(Q('dlTipoTrab').value||'').trim();
  var faseTrab=(Q('dlFaseTrab').value||'').trim();
  var count=0;
  _dupLoteIds.forEach(function(id){
    var it=budg.find(function(x){return x.id===id;});
    if(!it) return;
    var cp=JSON.parse(JSON.stringify(it));
    cp.id=uid();
    if(equip!=='')    cp.equip=equip;
    if(inst!=='')     cp.inst=inst;
    if(tipoTrab!=='') cp.tipoTrab=tipoTrab;
    if(faseTrab!=='') cp.faseTrab=faseTrab;
    var idx=budg.findIndex(function(x){return x.id===id;});
    budg.splice(idx+1,0,normalizeBudgetItem(cp));
    count++;
  });
  // Desmarcar checkboxes
  document.querySelectorAll('.budg-sel:checked').forEach(function(cb){ cb.checked=false; });
  _onBudgSel();
  dlFechar();
  rBudg(); updKpi();
  try{ if(editId) upsertCurrentDraft(true); }catch(e){}
  toast(count+' item(ns) duplicado(s)!','ok');
}

function lotSelecionarTodos(){
  var todos=document.querySelectorAll('.budg-sel');
  var algum=document.querySelector('.budg-sel:not(:checked)');
  todos.forEach(function(cb){ cb.checked=!!algum; });
  _onBudgSel();
}

function _updateColSortUI(){
  // Limpa todos
  ['tipo','cat','equip','inst','desc','mult','cu','ctot','fmf','pvu','pvt'].forEach(function(k){
    var el=document.getElementById('bTh_'+k);
    if(!el) return;
    el.classList.remove('asc','desc');
  });
  // Aplica ao ativo
  if(_colSort.dir !== 0){
    var el=document.getElementById('bTh_'+_colSort.key);
    if(el) el.classList.add(_colSort.dir===1?'asc':'desc');
  }
}
// ────────────────────────────────────────────────────────────────
function _getGrupoVal(it, key){
  if(key==='tipo') return it.t==='material'?'Material':'Serviço';
  if(key==='cat')  return it.cat||'';
  if(key==='desc') return (it.desc||it.cat||'');
  return (it[key]||'').trim();
}
function _getGrupoLabel(key, val){
  if(key==='equip')    return '⊜ '+val;
  if(key==='inst')     return '⊕ '+val;
  if(key==='tipoTrab') return '🔧 '+val;
  if(key==='faseTrab') return '📋 '+val;
  if(key==='tipo')     return val==='Material'?'🟣 '+val:'🔵 '+val;
  if(key==='cat')      return '📂 '+val;
  return '📝 '+val;
}
function sortBudg(por){
  if(!budg||!budg.length) return;
  // Multi-select: toggle cada botão independentemente
  var idx=_budgGrupos.indexOf(por);
  if(idx>=0) _budgGrupos.splice(idx,1);
  else _budgGrupos.push(por);
  // Compatibilidade: _budgSortAtivo = primeiro grupo ativo (para preview/export)
  _budgSortAtivo = _budgGrupos[0]||'';
  // Ordenar por todos os critérios ativos em cascata
  if(_budgGrupos.length){
    budg.sort(function(a,b){
      for(var i=0;i<_budgGrupos.length;i++){
        var k=_budgGrupos[i];
        var va=_getGrupoVal(a,k), vb=_getGrupoVal(b,k);
        var c=va.localeCompare(vb);
        if(c!==0) return c;
      }
      return 0;
    });
  }
  // Highlight: verde = ativo (com número de ordem), normal = inativo
  [{id:'sortBudgTipo', key:'tipo'},
   {id:'sortBudgCat',  key:'cat'},
   {id:'sortBudgDesc', key:'desc'},
   {id:'sortBudgEquip',key:'equip'},
   {id:'sortBudgInst',     key:'inst'},
   {id:'sortBudgTipoTrab', key:'tipoTrab'},
   {id:'sortBudgFaseTrab', key:'faseTrab'},
   {id:'sortBudgVal',      key:'val'}
  ].forEach(function(b){
    var btn=Q(b.id); if(!btn) return;
    var pos=_budgGrupos.indexOf(b.key);
    var ativo=pos>=0;
    btn.style.background = ativo ? 'var(--green)' : '';
    btn.style.color      = ativo ? '#000' : '';
    // Mostra número de ordem se mais de um ativo
    var baseText=btn.getAttribute('data-label')||btn.textContent.replace(/^\d+\.\s*/,'').trim();
    if(!btn.getAttribute('data-label')) btn.setAttribute('data-label', baseText);
    btn.textContent = ativo && _budgGrupos.length>1 ? (pos+1)+'. '+baseText : baseText;
    btn.title = ativo ? 'Nível '+(pos+1)+' — clique para remover' : 'Clique para agrupar por "'+b.key+'"';
  });
  rBudg(); updKpi();
  try{ if(editId) upsertCurrentDraft(true); }catch(e){}
}
function rBudg(){
  var tb=Q('bTb');if(!tb)return;
  budg=(budg||[]).map(normalizeBudgetItem);
  if(!budg.length){tb.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:.8rem">Nenhum item</td></tr>';updBT();return}

  // ── Função de renderização de uma linha ──
  function _rBudgRow(it,i){
    var un1=it.un1||'',un2=it.un2||'';
    var ql;
    if(it.t==='material'){
      ql=it.mult+(un1?' '+un1:'');
    } else {
      var _tec=it.tec||1,_dias=it.dias||1,_hpd=it.hpd||1;
      var _p=[];
      if(_tec>1) _p.push(_tec+' Tec.');
      _p.push(_dias+(un1?' '+un1:''));
      _p.push(_hpd+(un2?' '+un2:''));
      ql=_p.join(' × ');
      var resMult=n2(it.mult);
      if(resMult>0) ql+=' = '+fmtNumBr(resMult);
    }
    var inc=it.inc!==false;
    var terc=it.terc===true;
    var rowStyle='';
    if(!inc) rowStyle='opacity:.45;text-decoration:line-through';
    else if(terc) rowStyle='background:rgba(217,119,6,.08)';
    var custoTotal=n2(it.cu)*n2(it.mult);
    var pvTotDisplay=(!inc)?'<span style="color:var(--text3);font-size:.72rem">excluído</span>'
      :(terc?money(it.pvt)+'<span style="font-size:.65rem;margin-left:.3rem;color:#f97316;font-weight:700">T</span>':money(it.pvt));
    var btnInc='<button title="'+(inc?'Clique para excluir do cálculo':'Clique para incluir no cálculo')+'" '
      +'onclick="togInc(\''+it.id+'\',this)" '
      +'style="width:32px;height:24px;border-radius:4px;border:none;cursor:pointer;font-size:.75rem;font-weight:700;'
      +(inc?'background:#154a15;color:#3fb950':'background:rgba(255,255,255,.08);color:var(--text3)')+'\">'
      +(inc?'✓':'–')+'</button>';
    var btnTerc='<button title="'+(terc?'✅ EU PAGO o terceiro (custo sai do meu lucro) — clique para desmarcar':'Clique para marcar: EU pago o terceiro')+'" '
      +'onclick="togTerc(\''+it.id+'\',this)" '
      +'style="width:32px;height:24px;border-radius:4px;border:none;cursor:pointer;font-size:.7rem;font-weight:700;'
      +(terc?'background:rgba(249,115,22,.25);color:#f97316':'background:rgba(255,255,255,.08);color:var(--text3)')+'\">'
      +(terc?'T':'–')+'</button>';
    var det=it.det!==false;
    var btnDet='<button title="'+(det?'Aparece detalhado na proposta — clique para ocultar':'Oculto na proposta, só soma no total — clique para detalhar')+'" '
      +'onclick="togDet(\''+it.id+'\',this)" '
      +'style="width:32px;height:24px;border-radius:4px;border:none;cursor:pointer;font-size:.7rem;font-weight:700;'
      +(det?'background:rgba(88,166,255,.2);color:#58a6ff':'background:rgba(255,255,255,.08);color:var(--text3)')+'\">'
      +(det?'👁':'–')+'</button>';
    // ── Modo Planilha: células editáveis inline ──
    if(_modoPlanilha){
      var ISt='box-sizing:border-box;background:var(--bg2);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-family:inherit;font-size:.76rem;padding:2px 5px;width:100%';
      var ISn='box-sizing:border-box;background:var(--bg2);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-family:inherit;font-size:.76rem;padding:2px 5px;width:100%;text-align:right';
      var multVal=it.t==='material'?n2(it.mult):n2(it.dias||1);
      var _id=it.id; // captura explícita para closure seguro

      // Handler para inputs de texto (salva no blur e Enter/Tab)
      function evTxt(field){
        return 'onblur="_saveInlineField(\''+_id+'\',\''+field+'\',this.value)"'
          +' onkeydown="if(event.key===\'Tab\'||event.key===\'Enter\'){_saveInlineField(\''+_id+'\',\''+field+'\',this.value);}"';
      }
      // Handler para inputs numéricos (salva no blur e Enter/Tab)
      function evNum(field){
        return 'onblur="_saveInlineField(\''+_id+'\',\''+field+'\',this.value)"'
          +' onkeydown="if(event.key===\'Tab\'||event.key===\'Enter\'){_saveInlineField(\''+_id+'\',\''+field+'\',this.value);}"';
      }
      // Handler para SELECT — usa onchange (correto para dropdowns)
      function evSel(field){
        return 'onchange="_saveInlineField(\''+_id+'\',\''+field+'\',this.value)"';
      }

      return '<tr style="'+rowStyle+'">'
        // Col 1: #
        +'<td style="color:var(--text3);font-size:.7rem;padding:3px 4px;text-align:center">'+(i+1)+'</td>'
        // Col 2: Tipo — select editável (muda tipo e recarrega categorias)
        +'<td style="padding:2px 3px">'
          +'<select id="ptyp_'+_id+'" style="'+ISt+';font-size:.68rem;font-weight:700" title="Tipo"'
          +' onchange="_saveInlineField(\''+_id+'\',\'tipo\',this.value)">'
          +'<option value="servico"'+(it.t==='servico'?' selected':'')+'>Svc</option>'
          +'<option value="material"'+(it.t==='material'?' selected':'')+'>Mat</option>'
          +'</select>'
        +'</td>'
        // Col 3: Categoria — select filtrado pelo tipo atual
        +'<td style="padding:2px 3px;min-width:80px">'
          +'<select id="psel_'+_id+'" style="'+ISt+'" title="Categoria" '+evSel('cat')+'>'
          +_getCatOptions(it.t, '')  /* valor setado via _fixPlanilhaSelects */
          +'</select>'
        +'</td>'
                // Col 4: =Equip/Local
        +'<td style="padding:2px 3px;min-width:90px"><input type="text" style="'+ISt+'" value="'+esc(it.equip||'')+'" placeholder="=Equip." '+evTxt('equip')+'></td>'
        // Col 5: +Inst
        +'<td style="padding:2px 3px;min-width:80px"><input type="text" style="'+ISt+'" value="'+esc(it.inst||'')+'" placeholder="+Inst." '+evTxt('inst')+'></td>'
        // Col 6: Descrição
        +'<td style="padding:2px 3px;min-width:120px"><input type="text" style="'+ISt+'" value="'+esc(it.desc||getCatLabel(it.t,it.cat)||'')+'" placeholder="Descrição" '+evTxt('desc')+'></td>'
        // Col 7: Qtd/Dias
        +'<td style="padding:2px 3px;min-width:60px"><input type="number" style="'+ISn+'" value="'+multVal+'" min="0" step="0.01" title="'+(it.t==='material'?'Quantidade':'Dias')+'" '+evNum('mult')+'></td>'
        // Col 8: Custo Unit.
        +'<td style="padding:2px 3px;min-width:75px"><input type="number" style="'+ISn+'" value="'+n2(it.cu)+'" min="0" step="0.01" title="Custo Unitário" '+evNum('cu')+'></td>'
        // Col 9: Custo Total (read-only)
        +'<td style="text-align:right;white-space:nowrap;color:var(--blue);font-size:.75rem;padding:2px 6px;background:var(--bg3)">'+money(custoTotal)+'</td>'
        // Col 10: FMF (read-only)
        +'<td style="text-align:right;color:var(--text3);font-size:.72rem;padding:2px 6px;background:var(--bg3)">'+(n2(it.fmf)).toFixed(4)+'</td>'
        // Col 11: PV Unit. (read-only)
        +'<td style="text-align:right;white-space:nowrap;font-size:.75rem;padding:2px 6px;background:var(--bg3)">'+money(it.pvu)+'</td>'
        // Col 12: PV Total (read-only)
        +'<td style="text-align:right;white-space:nowrap;font-weight:700;padding:2px 6px;background:var(--bg3)">'+pvTotDisplay+'</td>'
        // Col 13: Inc
        +'<td style="text-align:center;padding:2px">'+btnInc+'</td>'
        // Col 14: Terc
        +'<td style="text-align:center;padding:2px">'+btnTerc+'</td>'
        // Col 15: Det
        +'<td style="text-align:center;padding:2px">'+btnDet+'</td>'
        // Col 16: Ações
        +'<td style="text-align:right;white-space:nowrap;padding:2px 4px">'
          +'<button class="btn bd bxs" onclick="delB(\''+_id+'\')" title="Excluir">×</button>'
        +'</td>'
        +'</tr>';
    }
    // ── Modo normal ──
    // ── Calcular LL unitário e métricas da 2ª linha ──
    var _cfg2=getPrcAtual();
    var _a2=_cfg2.aliq||{};
    var _nfS2=_a2.nfS!=null?_a2.nfS:DEFP.aliq.nfS;
    var _nfM2=_a2.nfM!=null?_a2.nfM:DEFP.aliq.nfM;
    var _rs2 =_a2.rS !=null?_a2.rS :DEFP.aliq.rS;
    var _comS2=_a2.comS!=null?_a2.comS:DEFP.aliq.comS;
    var _comM2=_a2.comM!=null?_a2.comM:DEFP.aliq.comM;
    var _neg2 =_a2.neg !=null?_a2.neg :DEFP.aliq.neg;
    var _isMat2=(it.t==='material');
    var _nf2   = _isMat2 ? it.pvu*_nfM2  : it.pvu*_nfS2;
    var _rs2v  = _isMat2 ? 0             : it.pvu*_rs2;
    var _com2  = _isMat2 ? it.pvu*_comM2 : it.pvu*_comS2;
    var _neg2v = it.pvu * _neg2;
    // LL unitário: custo unitário só abate se item terceirizado
    var _custoAbate2 = it.terc===true ? n2(it.cu) : 0;
    var _llU2  = it.pvu - _custoAbate2 - _nf2 - _rs2v - _com2;  // LL por unidade
    var _llU2tot = _llU2 * n2(it.mult);  // LL total do item (unitário × quantidade)
    var _llUp2 = it.pvu>0 ? (_llU2/it.pvu*100) : 0;
    var _llUcor= _llU2>=0?(_llUp2>=20?'#3fb950':_llUp2>=10?'#d4a017':'#f97316'):'#f85149';
    // Margem bruta da categoria
    var _catObj2=_isMat2?(_cfg2.m&&_cfg2.m[it.cat]):(_cfg2.s&&_cfg2.s[it.cat]);
    var _margPct2=_catObj2?(_isMat2?(_catObj2.mk||0):(_catObj2.m||0)):0;
    var _margLbl2=_isMat2?'Mk':'MB';
    var _rMin2=_catObj2&&_catObj2.rMin!=null?(_catObj2.rMin*100).toFixed(0):null;
    var _rMax2=_catObj2&&_catObj2.rMax!=null?(_catObj2.rMax*100).toFixed(0):null;
    var _margCor2=_rMin2&&_rMax2?(_margPct2*100<parseFloat(_rMin2)?'#f85149':_margPct2*100>parseFloat(_rMax2)?'#58a6ff':'#3fb950'):'var(--text3)';
    // String de alíquotas
    var _aliqStr2='NF:'+((_isMat2?_nfM2:_nfS2)*100).toFixed(1)+'%'
      +(_isMat2?'':' | RS:'+(_rs2*100).toFixed(1)+'%')
      +' | Com:'+( (_isMat2?_comM2:_comS2)*100).toFixed(1)+'%'
      +' | Neg:'+(_neg2*100).toFixed(1)+'%';

    var _cfg3r=getPrcAtual();
    var _co3r=it.t==='material'?(_cfg3r.m&&_cfg3r.m[it.cat]):(_cfg3r.s&&_cfg3r.s[it.cat]);
    var _catDescRaw=_co3r&&_co3r.desc?_co3r.desc:'';
    var _catDescFmt=_catDescRaw?_catDescRaw.split(';').map(function(s){return s.trim();}).filter(Boolean).map(function(s){return '• '+s;}).join(' '):'';
    var _catNameFmt=(_co3r&&_co3r.n?esc(it.cat)+' | '+esc(_co3r.n):'');
    var _id=it.id; // necessário para o checkbox data-id

    return '<tr style="'+rowStyle+'" data-id="'+_id+'">'
      // COL 1: # + checkbox
      +'<td style="text-align:center;vertical-align:top;padding:.3rem .2rem">'
        +'<input type="checkbox" class="budg-sel" data-id="'+_id+'" onchange="_onBudgSel()" style="margin-bottom:4px;cursor:pointer">'
        +'<div style="color:var(--text3);font-size:.68rem;margin-top:2px">'+(i+1)+'</div>'
      +'</td>'
      // COL 2: Tipo + Cat
      +'<td style="vertical-align:top;padding:.25rem .3rem">'
        +'<span style="display:inline-block;font-size:.6rem;padding:.08rem .28rem;border-radius:3px;font-weight:700;background:'+(it.t==='material'?'rgba(188,140,255,.15);color:#bc8cff':'rgba(88,166,255,.15);color:#58a6ff')+'">'+(it.t==='material'?'Mat':'Svc')+'</span>'
        +'<div style="font-family:monospace;font-size:.75rem;font-weight:700;margin-top:.15rem;color:var(--text)">'+esc(it.cat||'')+'</div>'
      +'</td>'
      // COL 3: linha1: equip+inst+tipoTrab+faseTrab | linha2: desc | linha3: desc categoria
      +'<td style="vertical-align:top;padding:.2rem .4rem">'
        // Linha 2: =Equip / +Inst / Tipo / Fase — tudo em linha
        +(( it.equip||it.inst||it.tipoTrab||it.faseTrab)?
          '<div style="font-size:.7rem;color:var(--text3);display:flex;flex-wrap:wrap;gap:.3rem .6rem;margin-bottom:.18rem">'
          +(it.equip?'<span><span style="opacity:.55">=</span>'+esc(it.equip)+'</span>':'')
          +(it.inst ?'<span><span style="opacity:.55">+</span>'+esc(it.inst)+'</span>':'')
          +(it.tipoTrab?'<span style="color:#7c3aed">🔧 '+esc(it.tipoTrab)+'</span>':'')
          +(it.faseTrab?'<span style="color:#0369a1">📋 '+esc(it.faseTrab)+'</span>':'')
          +'</div>':'')
        // Linha 3: Descrição
        +'<div style="font-size:.92rem;font-weight:700;color:var(--text)">'+esc((it.desc||getCatLabel(it.t,it.cat)||'').trim())+(it.link?' <a href="'+esc(it.link)+'" target="_blank" rel="noopener" style="color:var(--text3);text-decoration:none">🔗</a>':'')+'</div>'
        // Linha 4: Descrição da categoria completa
        +(_catDescFmt?'<div style="font-size:.68rem;color:var(--text3);margin-top:.12rem;line-height:1.4">'+esc(_catNameFmt)+(_catNameFmt?' | ':'')+_catDescFmt+'</div>':'')
      +'</td>'
      // COL 4: Qtd
      +'<td style="text-align:right;vertical-align:top;white-space:normal;font-size:.78rem;padding:.2rem .3rem">'+esc(ql)+'</td>'
      // COL 5: FMF
      +'<td style="text-align:right;vertical-align:top;color:var(--text3);font-size:.78rem">'+(n2(it.fmf)).toFixed(4)+'</td>'
      // COL 6: PV Unit.
      +'<td style="text-align:right;vertical-align:top;white-space:nowrap;font-size:.82rem">'+money(it.pvu)+'</td>'
      // COL 7: PV Total
      +'<td style="text-align:right;vertical-align:top;white-space:nowrap;font-weight:700">'+pvTotDisplay+'</td>'
      // COL 8: Inc / Terc / Det
      +'<td style="text-align:center;vertical-align:top;white-space:nowrap">'+btnInc+' '+btnTerc+' '+btnDet+'</td>'
      // COL 9: Ações
      +'<td style="text-align:right;vertical-align:top;white-space:nowrap">'
        +'<button class="btn ba bxs" onclick="editItem(\''+it.id+'\')" title="Editar">✏️</button> '
        +'<button class="btn bg bxs" onclick="dupItem(\''+it.id+'\')" title="Duplicar">📄</button> '
        +'<button class="btn bd bxs" onclick="delB(\''+it.id+'\')" title="Excluir">×</button>'
      +'</td>'
    +'</tr>'
    // ── LINHA 2: métricas financeiras ──
    +'<tr style="'+rowStyle+';border-bottom:2px solid var(--border2)">'
      // Col 1: vazio
      +'<td style="padding:0 0 .3rem 0"></td>'
      // Col 2: MB/Mk% + range
      +'<td style="padding:.05rem .3rem .3rem;vertical-align:top">'
        +'<div style="font-size:.72rem;font-weight:700;color:'+_margCor2+'">'+_margLbl2+' '+(_margPct2*100).toFixed(1)+'%</div>'
        +(_rMin2&&_rMax2?'<div style="font-size:.65rem;color:var(--text3)">'+_rMin2+'–'+_rMax2+'%</div>':'')
      +'</td>'
      // Col 3: Custo Unit. + Custo Total + Alíquotas
      +'<td style="padding:.05rem .4rem .3rem;vertical-align:top">'
        +'<span style="font-size:.68rem;color:var(--text3)">CU: </span><span style="font-size:.72rem;color:var(--blue);font-weight:600">'+money(it.cu)+'</span>'
        +'<span style="color:var(--border2);margin:0 .3rem">|</span>'
        +'<span style="font-size:.68rem;color:var(--text3)">CT: </span><span style="font-size:.72rem;color:var(--blue);font-weight:600">'+money(custoTotal)+'</span>'
        +'<div style="font-size:.66rem;color:var(--text3);margin-top:.1rem">'+_aliqStr2+'</div>'
      +'</td>'
      // Col 4: vazio
      +'<td></td>'
      // Col 5: vazio
      +'<td></td>'
      // Col 6: LL unitário
      +'<td style="text-align:right;padding:.05rem .3rem .3rem;vertical-align:top">'
        +'<div style="font-size:.68rem;color:var(--text3)">LL unit.</div>'
        +'<div style="font-size:.8rem;font-weight:700;color:'+_llUcor+'">'+money(_llU2)+'</div>'
      +'</td>'
      // Col 7: LL%
      +'<td style="text-align:right;padding:.05rem .3rem .3rem;vertical-align:top">'
        +'<div style="font-size:.68rem;color:var(--text3)">LL%</div>'
        +'<div style="font-size:.8rem;font-weight:700;color:'+_llUcor+'">'+_llUp2.toFixed(1)+'%</div>'
      +'</td>'
      // Col 8-9: vazio
      +'<td colspan="2"></td>'
    +'</tr>';
  }



  // ── Agrupamento multi-nível ──
  function _renderGrupoRec(itens, nivelKeys, nivel){
    if(!nivelKeys.length || !itens.length) return itens.map(function(it){ return _rBudgRow(it, budg.indexOf(it)); }).join('');
    var key=nivelKeys[0], restKeys=nivelKeys.slice(1);
    var grupos={}, ordem=[];
    itens.forEach(function(it){
      var v=_getGrupoVal(it,key)||'(sem '+key+')';
      if(!grupos[v]){ grupos[v]=[]; ordem.push(v); }
      grupos[v].push(it);
    });
    var h='';
    var bgColors=['var(--bg3)','var(--bg2)','var(--bg)'];
    var indents=[0,14,28];
    var bg=bgColors[Math.min(nivel,2)];
    var indent=indents[Math.min(nivel,2)];
    ordem.forEach(function(gVal){
      var gitens=grupos[gVal];
      var subtotal=gitens.reduce(function(s,it){return s+(it.inc!==false?n2(it.pvt):0);},0);
      var custo=gitens.reduce(function(s,it){return s+(it.inc!==false?n2(it.cu)*n2(it.mult):0);},0);
      var gLabel=_getGrupoLabel(key,gVal);
      var borderColor=nivel===0?'var(--border2)':'var(--border)';
      var borderWidth=nivel===0?'2px':'1px';
      h+='<tr>'
        +'<td colspan="9" style="background:'+bg+';color:var(--green);font-weight:700;font-size:'+(nivel===0?'.78':'.73')+'rem;padding:.3rem .6rem .3rem '+(indent+6)+'px;border-top:'+borderWidth+' solid '+borderColor+'">'
        +'<span style="margin-right:8px">'+esc(gLabel)+'</span>'
        +'<span style="float:right;color:var(--text2);font-weight:400;font-size:.7rem">'
          +gitens.length+' item(ns)'
          +' &nbsp;|&nbsp; Custo: <span style="color:var(--blue);font-weight:600">'+money(custo)+'</span>'
          +' &nbsp;|&nbsp; PV: <span style="color:var(--green);font-weight:600">'+money(subtotal)+'</span>'
        +'</span>'
        +'</td></tr>';
      h+=_renderGrupoRec(gitens, restKeys, nivel+1);
    });
    return h;
  }

  if(_budgGrupos.length){
    tb.innerHTML=_renderGrupoRec(budg, _budgGrupos, 0);
  } else {
    tb.innerHTML=budg.map(function(it,i){ return _rBudgRow(it,i); }).join('');
  }
  if(_modoPlanilha) setTimeout(_fixPlanilhaSelects, 0);

  updBT();
  // Atualiza datalists para autocomplete de equip/inst
  (function(){
    var equipSet={}, instSet={};
    (budg||[]).forEach(function(it){
      if(it.equip && it.equip.trim()) equipSet[it.equip.trim()]=1;
      if(it.inst  && it.inst.trim())  instSet[it.inst.trim()]=1;
    });
    var dl1=document.getElementById('equip-list');
    var dl2=document.getElementById('inst-list');
    if(dl1){ dl1.innerHTML=Object.keys(equipSet).map(function(v){return '<option value="'+esc(v)+'">';}).join(''); }
    if(dl2){ dl2.innerHTML=Object.keys(instSet).map(function(v){return '<option value="'+esc(v)+'">';}).join(''); }
  })();
}
function togInc(id){
  var it=budg.find(function(x){return x.id===id});if(!it)return;
  it.inc=it.inc===false?true:false;
  rBudg();updKpi();
}
function togTerc(id){
  var it=budg.find(function(x){return x.id===id});if(!it)return;
  it.terc=!it.terc;
  rBudg();updKpi();
}
function togDet(id){
  var it=budg.find(function(x){return x.id===id});if(!it)return;
  it.det=it.det===false?true:false;
  rBudg();
}
function togAllTerc(){
  if(!budg.length)return;
  var anyFalse=budg.some(function(x){return !x.terc;});
  budg.forEach(function(it){it.terc=anyFalse;});
  rBudg();updKpi();
}
function togAllDet(){
  if(!budg.length)return;
  var anyFalse=budg.some(function(x){return x.det===false;});
  budg.forEach(function(it){it.det=anyFalse;});
  rBudg();
}
function dupB(id){ dupItem(id); }
function delB(id){if(!confirm('Excluir?'))return;budg=budg.filter(function(x){return x.id!==id});rBudg()}
function limparPropostasZero(){
  var zeros=props.filter(function(p){return !n2(p.val);});
  if(!zeros.length){alert('Nenhuma proposta com valor R$0,00 encontrada.');return;}
  var sep=String.fromCharCode(10);
  var lista=zeros.slice(0,10).map(function(p){
    return (p.num||'S/N')+' - '+(p.cli||'?')+(p.tit?' ('+p.tit+')':'');
  }).join(sep)+(zeros.length>10?sep+'... e mais '+(zeros.length-10)+' proposta(s)':'');
  if(!confirm('Excluir '+zeros.length+' proposta(s) com valor R$0,00?'+sep+sep+lista+sep+sep+'Esta ação nao pode ser desfeita.'))return;
  props=props.filter(function(p){return n2(p.val)>0;});
  saveAll();rDash();
  toast('Limpeza: '+zeros.length+' proposta(s) com R$0 excluidas.','ok');
}
function delAllBudg(){
  if(!budg.length){alert('Nenhum item para excluir.');return;}
  if(!confirm('Excluir TODOS os '+budg.length+' itens do orçamento? Esta ação não pode ser desfeita.'))return;
  budg=[];
  rBudg();updKpi();
  try{if(typeof editId!=='undefined'&&editId)upsertCurrentDraft(true);}catch(e){}
}
// ─── SIMULADOR ATINGIR META ───────────────────────────────────────────
var _simResultado = null;
  var btnDes2=document.getElementById('simDesfazerBtn');
  if(btnDes2) btnDes2.style.display='none'; // guarda o FMF calculado para poder aplicar

function simModoChange(){
  var l=document.getElementById('simAlvoLabel');
  if(l) l.textContent=document.getElementById('simModo').value==='custo'?'Ajustar Custo de':'Ajustar FMF de';
}

function _populateSimItemPicker(){
  var sel=document.getElementById('simItemId'); if(!sel) return;
  sel.innerHTML='';
  (budg||[]).forEach(function(it,i){
    if(it.inc===false) return;
    var nome=it.desc||it.ref||('Item #'+(i+1));
    var tipo=it.t==='material'?'Mat':'Svc';
    var opt=document.createElement('option');
    opt.value=i;
    opt.textContent='['+tipo+'] '+nome+' — '+money(n2(it.pvt));
    sel.appendChild(opt);
  });
}

function simAlvoChange(){
  var alvo=document.getElementById('simAlvo').value;
  var div=document.getElementById('simItemPickerDiv');
  if(!div) return;
  if(alvo==='item'){ _populateSimItemPicker(); div.style.display='block'; }
  else div.style.display='none';
}

function rodarSimulacao(){
  var meta = n2(document.getElementById('simMeta').value);
  var alvo = document.getElementById('simAlvo').value;
  var modoEl = document.getElementById('simModo');
  var modo = modoEl ? modoEl.value : 'fmf';
  var res  = document.getElementById('simResultado');
  document.getElementById('simAplicarBtn').style.display = 'none';
  _simResultado = null;

  if(meta <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Informe um valor meta maior que zero.</span>'; return; }

  // Totais atuais separados por tipo (apenas itens incluídos)
  var totalM = 0, totalS = 0, custoM = 0, custoS = 0;
  budg.forEach(function(it){
    if(it.inc === false) return;
    if(it.t === 'material'){ totalM += n2(it.pvt); custoM += n2(it.cu) * n2(it.mult); }
    else                   { totalS += n2(it.pvt); custoS += n2(it.cu) * n2(it.mult); }
  });
  var totalAtual = totalM + totalS;

  if(totalAtual <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Nenhum item no orçamento.</span>'; return; }
  if(Math.abs(meta - totalAtual) < 0.01){ res.innerHTML = '<span style="color:#3fb950">✔ O total atual já é igual à meta!</span>'; return; }

  // ── MODO CUSTO ──────────────────────────────────────────────────────
  if(modo === 'custo'){
    var scaleM = null, scaleS = null;
    if(alvo === 'material'){
      if(totalM <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Não há itens de material no orçamento.</span>'; return; }
      scaleM = (meta - totalS) / totalM;
      if(scaleM <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Meta impossível: o custo resultante seria negativo ou zero.</span>'; return; }
      _simResultado = { modo:'custo', alvo:'material', scaleM:scaleM, scaleS:null, meta:meta, custoMOrig:custoM };
    } else if(alvo === 'servico'){
      if(totalS <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Não há itens de serviço no orçamento.</span>'; return; }
      scaleS = (meta - totalM) / totalS;
      if(scaleS <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Meta impossível: o custo resultante seria negativo ou zero.</span>'; return; }
      _simResultado = { modo:'custo', alvo:'servico', scaleM:null, scaleS:scaleS, meta:meta, custoSOrig:custoS };
    } else if(alvo === 'item'){
      var itemIdxEl = document.getElementById('simItemId');
      if(!itemIdxEl||itemIdxEl.value===''){ res.innerHTML='<span style="color:#f85149">⚠ Selecione um item.</span>'; return; }
      var itemIdx = parseInt(itemIdxEl.value);
      var itSel = budg[itemIdx];
      if(!itSel){ res.innerHTML='<span style="color:#f85149">⚠ Item não encontrado.</span>'; return; }
      var fmfI=n2(itSel.fmf), multI=n2(itSel.mult);
      if(fmfI<=0||multI<=0){ res.innerHTML='<span style="color:#f85149">⚠ Item sem FMF ou multiplicador definido.</span>'; return; }
      var pvtOther = totalAtual - n2(itSel.pvt);
      var pvtNeeded = meta - pvtOther;
      if(pvtNeeded<=0){ res.innerHTML='<span style="color:#f85149">⚠ Meta impossível: o custo resultante seria negativo ou zero.</span>'; return; }
      var cuNovo = pvtNeeded / (fmfI * multI);
      var cuOrig = n2(itSel.cu);
      _simResultado = { modo:'custo', alvo:'item', itemIdx:itemIdx, cuNovo:cuNovo, cuOrig:cuOrig, meta:meta };
      var diff2=meta-totalAtual, sinal2=diff2>0?'+':'', cor2=diff2>0?'#3fb950':'#f97316';
      var varPct=cuOrig>0?((cuNovo/cuOrig-1)*100).toFixed(1):'0.0';
      var corI=cuNovo>=cuOrig?'#3fb950':'#f97316';
      var nomeI=itSel.desc||itSel.ref||('Item #'+(itemIdx+1));
      var html2='<div style="display:flex;flex-wrap:wrap;gap:.8rem;align-items:flex-start;">';
      html2+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px"><div style="font-size:.68rem;color:var(--text3)">Total atual</div><div style="font-weight:700;color:var(--text)">'+money(totalAtual)+'</div></div>';
      html2+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px"><div style="font-size:.68rem;color:var(--text3)">Meta</div><div style="font-weight:700;color:#58a6ff">'+money(meta)+'</div></div>';
      html2+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px"><div style="font-size:.68rem;color:var(--text3)">Diferença</div><div style="font-weight:700;color:'+cor2+'">'+sinal2+money(Math.abs(diff2))+'</div></div>';
      html2+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:200px"><div style="font-size:.68rem;color:var(--text3)">Custo unitário · '+nomeI+'</div><div style="font-weight:700;color:'+corI+'">'+money(cuNovo)+' <span style="font-size:.68rem;color:var(--text3)">(era '+money(cuOrig)+')</span></div><div style="font-size:.68rem;color:'+corI+'">'+(varPct>0?'+':'')+varPct+'%</div></div>';
      html2+='</div>';
      res.innerHTML=html2;
      document.getElementById('simAplicarBtn').style.display='inline-flex';
      return;
    } else {
      scaleM = scaleS = meta / totalAtual;
      _simResultado = { modo:'custo', alvo:'ambos', scaleM:scaleM, scaleS:scaleS, meta:meta, custoMOrig:custoM, custoSOrig:custoS };
    }
    var diff = meta - totalAtual;
    var sinal = diff > 0 ? '+' : '';
    var cor   = diff > 0 ? '#3fb950' : '#f97316';
    var html  = '<div style="display:flex;flex-wrap:wrap;gap:.8rem;align-items:flex-start;">';
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px"><div style="font-size:.68rem;color:var(--text3)">Total atual</div><div style="font-weight:700;color:var(--text)">'+ money(totalAtual) +'</div></div>';
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px"><div style="font-size:.68rem;color:var(--text3)">Meta</div><div style="font-weight:700;color:#58a6ff">'+ money(meta) +'</div></div>';
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px"><div style="font-size:.68rem;color:var(--text3)">Diferença</div><div style="font-weight:700;color:'+cor+'">'+ sinal + money(Math.abs(diff)) +'</div></div>';
    if(scaleM !== null && custoM > 0){
      var varPctM = ((scaleM - 1) * 100).toFixed(1);
      var corM = scaleM >= 1 ? '#3fb950' : '#f97316';
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:160px"><div style="font-size:.68rem;color:var(--text3)">Custo Material</div><div style="font-weight:700;color:'+corM+'">'+ money(custoM*scaleM) +' <span style="font-size:.68rem;color:var(--text3)">(era '+ money(custoM) +')</span></div><div style="font-size:.68rem;color:'+corM+'">'+(varPctM>0?'+':'')+varPctM+'%</div></div>';
    }
    if(scaleS !== null && custoS > 0){
      var varPctS = ((scaleS - 1) * 100).toFixed(1);
      var corS = scaleS >= 1 ? '#3fb950' : '#f97316';
      html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:160px"><div style="font-size:.68rem;color:var(--text3)">Custo Serviço/MO</div><div style="font-weight:700;color:'+corS+'">'+ money(custoS*scaleS) +' <span style="font-size:.68rem;color:var(--text3)">(era '+ money(custoS) +')</span></div><div style="font-size:.68rem;color:'+corS+'">'+(varPctS>0?'+':'')+varPctS+'%</div></div>';
    }
    html += '</div>';
    res.innerHTML = html;
    document.getElementById('simAplicarBtn').style.display = 'inline-flex';
    return;
  }
  // ── FIM MODO CUSTO ───────────────────────────────────────────────────

  var novoFmfMat = null, novoFmfSvc = null;
  var fmfAtualMat = (custoM > 0) ? (totalM / custoM) : null;
  var fmfAtualSvc = (custoS > 0) ? (totalS / custoS) : null;

  if(alvo === 'material'){
    if(custoM <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Não há itens de material no orçamento.</span>'; return; }
    // meta = custoM * fmfNovo + totalS  →  fmfNovo = (meta - totalS) / custoM
    var fmfNovo = (meta - totalS) / custoM;
    if(fmfNovo <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Meta impossível: o FMF resultante seria negativo ou zero.</span>'; return; }
    novoFmfMat = fmfNovo;
    _simResultado = { alvo: 'material', fmfMat: fmfNovo, fmfSvc: null, meta: meta };

  } else if(alvo === 'servico'){
    if(custoS <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Não há itens de serviço no orçamento.</span>'; return; }
    // meta = totalM + custoS * fmfNovo  →  fmfNovo = (meta - totalM) / custoS
    var fmfNovo = (meta - totalM) / custoS;
    if(fmfNovo <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Meta impossível: o FMF resultante seria negativo ou zero.</span>'; return; }
    novoFmfSvc = fmfNovo;
    _simResultado = { alvo: 'servico', fmfMat: null, fmfSvc: fmfNovo, meta: meta };

  } else { // ambos - proporcional: mesmo fator de escala para cada grupo
    if(custoM <= 0 && custoS <= 0){ res.innerHTML = '<span style="color:#f85149">⚠ Nenhum item com custo no orçamento.</span>'; return; }
    // escala = meta / totalAtual  →  fmfNovos = fmfAtuais * escala
    var escala = meta / totalAtual;
    novoFmfMat = fmfAtualMat !== null ? fmfAtualMat * escala : null;
    novoFmfSvc = fmfAtualSvc !== null ? fmfAtualSvc * escala : null;
    _simResultado = { alvo: 'ambos', fmfMat: novoFmfMat, fmfSvc: novoFmfSvc, meta: meta };
  }

  // Monta HTML do resultado
  var diff = meta - totalAtual;
  var sinal = diff > 0 ? '+' : '';
  var cor   = diff > 0 ? '#3fb950' : '#f97316';
  var html  = '<div style="display:flex;flex-wrap:wrap;gap:.8rem;align-items:flex-start;">';

  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px">'
        + '<div style="font-size:.68rem;color:var(--text3)">Total atual</div>'
        + '<div style="font-weight:700;color:var(--text)">'+ money(totalAtual) +'</div></div>';

  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px">'
        + '<div style="font-size:.68rem;color:var(--text3)">Meta</div>'
        + '<div style="font-weight:700;color:#58a6ff">'+ money(meta) +'</div></div>';

  html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px">'
        + '<div style="font-size:.68rem;color:var(--text3)">Diferença</div>'
        + '<div style="font-weight:700;color:'+cor+'">'+ sinal + money(Math.abs(diff)) +'</div></div>';

  if(novoFmfMat !== null && fmfAtualMat !== null){
    var varM = ((novoFmfMat/fmfAtualMat - 1)*100).toFixed(1);
    var corM = novoFmfMat >= fmfAtualMat ? '#3fb950' : '#f97316';
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px">'
          + '<div style="font-size:.68rem;color:var(--text3)">FMF Material</div>'
          + '<div style="font-weight:700;color:'+corM+'">'+ novoFmfMat.toFixed(4)
          + ' <span style="font-size:.68rem;color:var(--text3)">(era '+ fmfAtualMat.toFixed(4) +')</span></div>'
          + '<div style="font-size:.68rem;color:'+corM+'">'+(varM>0?'+':'')+varM+'%</div>'
          +'</div>';
  }
  if(novoFmfSvc !== null && fmfAtualSvc !== null){
    var varS = ((novoFmfSvc/fmfAtualSvc - 1)*100).toFixed(1);
    var corS = novoFmfSvc >= fmfAtualSvc ? '#3fb950' : '#f97316';
    html += '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px">'
          + '<div style="font-size:.68rem;color:var(--text3)">FMF Serviço/MO</div>'
          + '<div style="font-weight:700;color:'+corS+'">'+ novoFmfSvc.toFixed(4)
          + ' <span style="font-size:.68rem;color:var(--text3)">(era '+ fmfAtualSvc.toFixed(4) +')</span></div>'
          + '<div style="font-size:.68rem;color:'+corS+'">'+(varS>0?'+':'')+varS+'%</div>'
          +'</div>';
  }
  html += '</div>';
  res.innerHTML = html;
  document.getElementById('simAplicarBtn').style.display = 'inline-flex';
}

function aplicarSimulacao(){
  if(!_simResultado){ alert('Rode a simulação primeiro.'); return; }
  // Salvar snapshot ANTES de aplicar para permitir desfazer
  _budgSnapshot = budg.map(function(it){ return JSON.parse(JSON.stringify(it)); });
  var r = _simResultado;
  var cfg = getPrcAtual();

  if(r.modo === 'custo'){
    if(r.alvo === 'item'){
      var itA = budg[r.itemIdx];
      if(itA && itA.inc !== false){
        itA.cu = r.cuNovo;
        itA.pvu = itA.cu * n2(itA.fmf);
        itA.pvt = itA.pvu * n2(itA.mult);
      }
    } else {
      budg.forEach(function(it){
        if(it.inc === false) return;
        if(it.t === 'material' && r.scaleM !== null){
          it.cu = n2(it.cu) * r.scaleM;
          it.pvu = it.cu * n2(it.fmf);
          it.pvt = it.pvu * n2(it.mult);
        } else if(it.t !== 'material' && r.scaleS !== null){
          it.cu = n2(it.cu) * r.scaleS;
          it.pvu = it.cu * n2(it.fmf);
          it.pvt = it.pvu * n2(it.mult);
        }
      });
    }
  } else {
    budg.forEach(function(it){
      if(it.inc === false) return;
      if(it.t === 'material' && r.fmfMat !== null){
        it.fmf = r.fmfMat;
        it.pvu = it.cu * it.fmf;
        it.pvt = it.pvu * n2(it.mult);
      } else if(it.t !== 'material' && r.fmfSvc !== null){
        it.fmf = r.fmfSvc;
        it.pvu = it.cu * it.fmf;
        it.pvt = it.pvu * n2(it.mult);
      }
    });
  }

  updBT(); rBudg();
  _simResultado = null;
  document.getElementById('simAplicarBtn').style.display = 'none';
  var btnDes=document.getElementById('simDesfazerBtn');
  if(btnDes) btnDes.style.display='inline-flex';
  var tipoMsg = r.modo === 'custo' ? 'Custo aplicado' : 'FMF aplicado';
  document.getElementById('simResultado').innerHTML =
    '<span style="color:#3fb950">✔ '+ tipoMsg +'! Total da proposta atualizado para '+ money(r.meta) +'. Use ↩ Desfazer para voltar aos valores originais.</span>';
}
// ─────────────────────────────────────────────────────────────────────

// ─── META LUCRO LÍQUIDO % ────────────────────────────────────────────
var _metaLLResultado = null;
var _metaLLSnapshot  = null;

function _populateMetaLLCat(){
  var sel=Q('metaLLCat'); if(!sel) return;
  var cur=sel.value;
  var seen={}, cats=[];
  (budg||[]).forEach(function(it){
    if(it.inc===false||!it.cat) return;
    var tipo=it.t==='material'?'m':'s';
    var key=it.cat+':'+tipo;
    if(!seen[key]){ seen[key]=true; cats.push({v:key,l:it.cat+' · '+(tipo==='m'?'Material':'Serviço')}); }
  });
  cats.sort(function(a,b){return a.l.localeCompare(b.l);});
  sel.innerHTML='<option value="">— Proposta inteira —</option>';
  cats.forEach(function(c){ var o=document.createElement('option'); o.value=c.v; o.textContent=c.l; sel.appendChild(o); });
  if(cur) sel.value=cur;
}

function simMetaLL(){
  var llPctAlvo = n2(Q('metaLLPct').value) / 100;
  var res = Q('metaLLResultado');
  Q('metaLLAplicarBtn').style.display = 'none';
  _metaLLResultado = null;

  if(llPctAlvo <= 0 || llPctAlvo >= 1){
    res.innerHTML = '<span style="color:#f85149">⚠ Informe um LL% entre 1 e 99.</span>'; return;
  }

  // Ler alíquotas da proposta atual
  var cfg = getPrcAtual();
  var nfS  = n2(Q('aNFS')&&Q('aNFS').value!==''?Q('aNFS').value:cfg.aliq.nfS*100)/100;
  var nfM  = n2(Q('aNFM')&&Q('aNFM').value!==''?Q('aNFM').value:cfg.aliq.nfM*100)/100;
  var rS   = n2(Q('aRS') &&Q('aRS').value!=='' ?Q('aRS').value :cfg.aliq.rS *100)/100;
  var comS = n2(Q('aComS')&&Q('aComS').value!==''?Q('aComS').value:cfg.aliq.comS*100)/100;
  var comM = n2(Q('aComM')&&Q('aComM').value!==''?Q('aComM').value:cfg.aliq.comM*100)/100;
  var neg  = n2(cfg.aliq.neg); // reserva de negociação (embutida no FMF)

  // Custos por tipo (apenas itens incluídos e não-terc ou terc que abate)
  var custoS=0, custoM=0, custoTerc=0;
  var pvSAtual=0, pvMAtual=0;
  budg.forEach(function(it){
    if(it.inc===false) return;
    var c = n2(it.cu)*n2(it.mult);
    if(it.t==='material'){ pvMAtual+=n2(it.pvt); if(it.terc) custoTerc+=c; else custoM+=c; }
    else                 { pvSAtual+=n2(it.pvt); if(it.terc) custoTerc+=c; else custoS+=c; }
  });
  // custoTotal = apenas terceirizados (consistente com updKpi)
  var custoTotal = custoTerc;
  var pvAtual = pvSAtual + pvMAtual;

  if(pvAtual<=0){ res.innerHTML='<span style="color:#f85149">⚠ Nenhum item no orçamento.</span>'; return; }

  // Proporção S/M no PV atual
  var fracS = pvAtual>0 ? pvSAtual/pvAtual : 0.5;
  var fracM = 1 - fracS;

  // Deduções como % do PV: depende de como pvS e pvM se dividem
  // Para um PV novo = pvNovo, pvS_novo = pvNovo*fracS, pvM_novo = pvNovo*fracM
  // totalDeduc = pvS_novo*nfS + pvM_novo*nfM + pvNovo*rS + pvS_novo*comS + pvM_novo*comM
  // = pvNovo * (fracS*nfS + fracM*nfM + rS + fracS*comS + fracM*comM)
  var taxaDeduc = fracS*nfS + fracM*nfM + rS + fracS*comS + fracM*comM;

  // Lucro Após Reserva (LAR) = pvNovo - custoTotal - pvNovo*taxaDeduc - pvNovo*neg
  // LAR = pvNovo*(1 - taxaDeduc - neg) - custoTotal
  // LAR% = LAR / pvNovo = (1 - taxaDeduc - neg) - custoTotal/pvNovo
  // → pvNovo = custoTotal / (1 - taxaDeduc - neg - llPctAlvo)
  var denominador = 1 - taxaDeduc - neg - llPctAlvo;
  if(denominador <= 0){
    res.innerHTML='<span style="color:#f85149">⚠ LAR% impossível com as alíquotas atuais. Máximo teórico: '+(((1-taxaDeduc-neg)*100).toFixed(1))+'%.</span>'; return;
  }

  var pvNovo = custoTotal / denominador;
  var pvNovoS = pvNovo * fracS;
  var pvNovoM = pvNovo * fracM;

  // FMFs novos (proporcional ao custo de cada grupo)
  var fmfAtualS = pvSAtual>0&&custoS>0 ? pvSAtual/custoS : null;
  var fmfAtualM = pvMAtual>0&&custoM>0 ? pvMAtual/custoM : null;
  // custoTerc não tem FMF — o custo já está fixo
  // Para o novo PV, ajustamos só os itens não-terc
  var pvNaoTercS = pvSAtual - budg.filter(function(it){return it.inc!==false&&it.t!=='material'&&it.terc;}).reduce(function(s,it){return s+n2(it.pvt);},0);
  var pvNaoTercM = pvMAtual - budg.filter(function(it){return it.inc!==false&&it.t==='material'&&it.terc;}).reduce(function(s,it){return s+n2(it.pvt);},0);
  var custoTercS = budg.filter(function(it){return it.inc!==false&&it.t!=='material'&&it.terc;}).reduce(function(s,it){return s+n2(it.cu)*n2(it.mult);},0);
  var custoTercM = budg.filter(function(it){return it.inc!==false&&it.t==='material'&&it.terc;}).reduce(function(s,it){return s+n2(it.cu)*n2(it.mult);},0);

  var novoFmfS = custoS>0 ? (pvNovoS - pvNaoTercS + pvSAtual - pvNaoTercS === 0 ? (pvNovoS/custoS) : ((pvNovoS - custoTercS) / custoS)) : null;
  var novoFmfM = custoM>0 ? ((pvNovoM - custoTercM) / custoM) : null;

  // Simplificado: proporcional pelo fator de escala de cada grupo
  var escalaS = pvSAtual>0 ? pvNovoS/pvSAtual : 1;
  var escalaM = pvMAtual>0 ? pvNovoM/pvMAtual : 1;
  novoFmfS = fmfAtualS !== null ? fmfAtualS * escalaS : null;
  novoFmfM = fmfAtualM !== null ? fmfAtualM * escalaM : null;

  // LAR real com pvNovo (Lucro Após Reserva)
  var llReal = pvNovo - custoTotal - pvNovo*taxaDeduc;
  var larReal = llReal - pvNovo*neg;
  var llPctReal = pvNovo>0 ? (larReal/pvNovo*100) : 0; // llPctReal agora é LAR%

  // ── MODO CATEGORIA ESPECÍFICA ────────────────────────────────────────
  var catSel = Q('metaLLCat') ? (Q('metaLLCat').value||'') : '';
  if(catSel){
    var _cp=catSel.split(':'), _catCod=_cp[0], _catTipo=_cp[1], _catIsMat=(_catTipo==='m');
    var pvCatNT=0, custoCatNT=0, fmfCatAtual=null;
    budg.forEach(function(it){
      if(it.inc===false||!it.cat) return;
      var inCat=it.cat===_catCod&&(_catIsMat?(it.t==='material'):(it.t!=='material'));
      if(!inCat) return;
      pvCatNT+=n2(it.pvt); custoCatNT+=n2(it.cu)*n2(it.mult);
    });
    if(custoCatNT<=0){
      res.innerHTML='<span style="color:#f85149">⚠ '+_catCod+': nenhum item incluído encontrado nesta proposta.</span>'; return;
    }
    fmfCatAtual = pvCatNT>0 ? pvCatNT/custoCatNT : null;
    var pvOther = pvAtual - pvCatNT;
    var pvCatNT_novo = pvNovo - pvOther;
    if(pvCatNT_novo <= 0){
      var larAtual = pvAtual>0 ? ((pvAtual*(1-taxaDeduc-neg)-custoTotal)/pvAtual*100) : 0;
      res.innerHTML='<span style="color:#f85149">⚠ A LAR atual desta proposta já é <strong>'+larAtual.toFixed(1)+'%</strong>. Para aumentar a LAR ajustando só '+_catCod+', informe uma meta <strong>acima de '+larAtual.toFixed(1)+'%</strong>.</span>'; return;
    }
    var novoFmfCat = pvCatNT_novo / custoCatNT;
    var escalaCat = fmfCatAtual ? novoFmfCat/fmfCatAtual : null;
    // Converter FMF → margem % da categoria
    var _aliq2=cfg.aliq;
    var _aCat=_catIsMat
      ? 1-(n2(_aliq2.nfM)+n2(_aliq2.rS)+n2(_aliq2.comM)+n2(_aliq2.neg))
      : 1-(n2(_aliq2.nfS)+n2(_aliq2.rS)+n2(_aliq2.comS)+n2(_aliq2.neg));
    var novaMargemCat=_catIsMat ? (novoFmfCat*_aCat-1) : (1-1/(novoFmfCat*_aCat));
    var margemAtualCat=fmfCatAtual!==null?(_catIsMat?(fmfCatAtual*_aCat-1):(1-1/(fmfCatAtual*_aCat))):null;
    _metaLLResultado={ catCod:_catCod, catTipo:_catTipo, catIsMat:_catIsMat,
      novoFmfCat:novoFmfCat, fmfCatAtual:fmfCatAtual, escalaCat:escalaCat,
      novaMargemCat:novaMargemCat, pvNovo:pvNovo, llPct:llPctReal };
    var diff2=pvNovo-pvAtual, s2=diff2>0?'+':'', cor2=diff2>0?'#3fb950':'#f97316';
    var corE=escalaCat>=1?'#3fb950':'#f97316';
    var tipoLabel=_catIsMat?'Material':'Serviço';
    function _card(label,val,cor){ return '<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:120px"><div style="font-size:.68rem;color:var(--text3)">'+label+'</div><div style="font-weight:700;color:'+(cor||'var(--text)')+'">'+val+'</div></div>'; }
    var h='<div style="display:flex;flex-wrap:wrap;gap:.7rem;align-items:flex-start;">';
    h+=_card('PV atual',money(pvAtual));
    h+=_card('PV necessário (total)',money(pvNovo),'#58a6ff');
    h+=_card('Diferença',s2+money(Math.abs(diff2)),cor2);
    h+=_card('LAR resultante',llPctReal.toFixed(1)+'%<br><span style="font-size:.66rem;color:var(--text3)">'+money(larReal)+'</span>','var(--green)');
    h+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:150px">'
      +'<div style="font-size:.68rem;color:var(--text3)">FMF '+_catCod+' ('+tipoLabel+')</div>'
      +'<div style="font-weight:700;color:'+corE+'">'+novoFmfCat.toFixed(4)
      +(fmfCatAtual!==null?' <span style="font-size:.67rem;color:var(--text3)">(era '+fmfCatAtual.toFixed(4)+')</span>':'')+'</div>'
      +(escalaCat!==null?'<div style="font-size:.68rem;color:'+corE+'">'+(escalaCat>=1?'+':'')+((escalaCat-1)*100).toFixed(1)+'% escala</div>':'')
      +'</div>';
    var marNova=(novaMargemCat*100).toFixed(1);
    var marAtual=margemAtualCat!==null?((margemAtualCat*100).toFixed(1)):'?';
    var rotulo=_catIsMat?'Markup s/ custo':'Margem s/ PV';
    h+='<div style="background:var(--bg);border:2px solid '+corE+';border-radius:6px;padding:.5rem .75rem;min-width:150px">'
      +'<div style="font-size:.68rem;color:var(--text3)">'+rotulo+' necessária — '+_catCod+'</div>'
      +'<div style="font-weight:700;font-size:1.05rem;color:'+corE+'">'+marNova+'%</div>'
      +'<div style="font-size:.66rem;color:var(--text3)">era '+marAtual+'%</div></div>';
    h+='</div>';
    res.innerHTML=h;
    Q('metaLLAplicarBtn').style.display='inline-flex';
    return;
  }
  // ── FIM MODO CATEGORIA ───────────────────────────────────────────────

  _metaLLResultado = { pvNovo:pvNovo, fmfS:novoFmfS, fmfM:novoFmfM, escalaS:escalaS, escalaM:escalaM, llPct:llPctReal };

  var diff = pvNovo - pvAtual;
  var sinal = diff>0?'+':'';
  var corDiff = diff>0?'#3fb950':'#f97316';

  var html='<div style="display:flex;flex-wrap:wrap;gap:.7rem;align-items:flex-start;">';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:120px">'
      +'<div style="font-size:.68rem;color:var(--text3)">PV atual</div>'
      +'<div style="font-weight:700;color:var(--text)">'+money(pvAtual)+'</div></div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:120px">'
      +'<div style="font-size:.68rem;color:var(--text3)">PV necessário</div>'
      +'<div style="font-weight:700;color:#58a6ff">'+money(pvNovo)+'</div></div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:120px">'
      +'<div style="font-size:.68rem;color:var(--text3)">Diferença</div>'
      +'<div style="font-weight:700;color:'+corDiff+'">'+sinal+money(Math.abs(diff))+'</div></div>';
  html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:120px">'
      +'<div style="font-size:.68rem;color:var(--text3)">LAR resultante</div>'
      +'<div style="font-weight:700;color:var(--green)">'+llPctReal.toFixed(1)+'%</div>'
      +'<div style="font-size:.66rem;color:var(--text3)">'+money(larReal)+'</div></div>';
  if(novoFmfS!==null&&fmfAtualS!==null){
    var varS=((escalaS-1)*100).toFixed(1);
    html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px">'
        +'<div style="font-size:.68rem;color:var(--text3)">FMF Serviço/MO</div>'
        +'<div style="font-weight:700;color:'+(escalaS>=1?'#3fb950':'#f97316')+'">'+novoFmfS.toFixed(4)
        +' <span style="font-size:.67rem;color:var(--text3)">(era '+fmfAtualS.toFixed(4)+')</span></div>'
        +'<div style="font-size:.68rem;color:'+(escalaS>=1?'#3fb950':'#f97316')+'">'+(varS>0?'+':'')+varS+'%</div></div>';
  }
  if(novoFmfM!==null&&fmfAtualM!==null){
    var varM=((escalaM-1)*100).toFixed(1);
    html+='<div style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:.5rem .75rem;min-width:130px">'
        +'<div style="font-size:.68rem;color:var(--text3)">FMF Material</div>'
        +'<div style="font-weight:700;color:'+(escalaM>=1?'#3fb950':'#f97316')+'">'+novoFmfM.toFixed(4)
        +' <span style="font-size:.67rem;color:var(--text3)">(era '+fmfAtualM.toFixed(4)+')</span></div>'
        +'<div style="font-size:.68rem;color:'+(escalaM>=1?'#3fb950':'#f97316')+'">'+(varM>0?'+':'')+varM+'%</div></div>';
  }
  html+='</div>';
  res.innerHTML=html;
  Q('metaLLAplicarBtn').style.display='inline-flex';
}

function aplicarMetaLL(){
  if(!_metaLLResultado){ alert('Rode o cálculo primeiro.'); return; }
  _metaLLSnapshot = budg.map(function(it){return JSON.parse(JSON.stringify(it));});
  var r = _metaLLResultado;
  function _apItem(it){ it.fmf=r.novoFmfCat; it.pvu=n2(it.cu)*it.fmf; it.pvt=it.pvu*n2(it.mult); }
  if(r.catCod){
    // Modo categoria: mesma lógica de aplicarMargNaProposta (persiste em p.bi + savePrcAtual)
    budg.forEach(function(it){
      if(it.inc===false) return;
      var inCat=it.cat===r.catCod&&(r.catIsMat?(it.t==='material'):(it.t!=='material'));
      if(inCat) _apItem(it);
    });
    if(editId){
      var _p=props.find(function(x){return x.id===editId;});
      if(_p&&_p.bi){
        _p.bi.forEach(function(it){
          if(it.inc===false) return;
          var inCat=it.cat===r.catCod&&(r.catIsMat?(it.t==='material'):(it.t!=='material'));
          if(inCat) _apItem(it);
        });
      }
      try{
        var _cfg=JSON.parse(JSON.stringify(getPrcAtual()));
        if(r.catIsMat){
          if(!_cfg.m)_cfg.m={}; if(!_cfg.m[r.catCod])_cfg.m[r.catCod]={n:r.catCod,mk:0,rMin:0,rMax:0};
          _cfg.m[r.catCod].mk=r.novaMargemCat;
        } else {
          if(!_cfg.s)_cfg.s={}; if(!_cfg.s[r.catCod])_cfg.s[r.catCod]={n:r.catCod,m:0,rMin:0,rMax:0};
          _cfg.s[r.catCod].m=r.novaMargemCat;
        }
        savePrcAtual(_cfg);
      }catch(e){ console.error('aplicarMetaLL savePrc err:',e); }
    }
    Q('metaLLResultado').innerHTML='<span style="color:#3fb950">✔ Margem '+(r.novaMargemCat*100).toFixed(1)+'% aplicada em '+r.catCod+'! LAR resultante: '+r.llPct.toFixed(1)+'%. Use ↩ Desfazer para voltar.</span>';
  } else {
    // Modo "proposta inteira": comportamento original (apenas budg)
    budg.forEach(function(it){
      if(it.inc===false) return;
      if(it.t==='material' && r.fmfM!==null && !it.terc){
        it.fmf=r.fmfM; it.pvu=it.cu*it.fmf; it.pvt=it.pvu*n2(it.mult);
      } else if(it.t!=='material' && r.fmfS!==null && !it.terc){
        it.fmf=r.fmfS; it.pvu=it.cu*it.fmf; it.pvt=it.pvu*n2(it.mult);
      }
    });
    Q('metaLLResultado').innerHTML='<span style="color:#3fb950">✔ FMFs aplicados! LAR resultante: '+r.llPct.toFixed(1)+'%. Use ↩ Desfazer para voltar.</span>';
  }
  updBT(); rBudg(); cTot(); updKpi(); rMargens();
  _metaLLResultado=null;
  Q('metaLLAplicarBtn').style.display='none';
  Q('metaLLDesfazerBtn').style.display='inline-flex';
}

function desfazerMetaLL(){
  if(!_metaLLSnapshot){ toast('Nada para desfazer.','err'); return; }
  budg=_metaLLSnapshot; _metaLLSnapshot=null;
  updBT(); rBudg(); updKpi();
  Q('metaLLDesfazerBtn').style.display='none';
  Q('metaLLResultado').innerHTML='<span style="color:#8b949e">↩ Valores originais restaurados.</span>';
}
// ─────────────────────────────────────────────────────────────────────

function updBT(){
  var pvS=0,pvM=0,cS=0,cM=0,sEx=0,mEx=0;
  budg.forEach(function(it){
    var inc=it.inc!==false;
    var cItem=n2(it.cu)*n2(it.mult);
    if(!inc){ if(it.t==='material')mEx+=n2(it.pvt);else sEx+=n2(it.pvt); return; }
    if(it.t==='material'){ pvM+=n2(it.pvt); cM+=cItem; }
    else                 { pvS+=n2(it.pvt); cS+=cItem; }
  });
  // Custo separado
  if(Q('bCS'))Q('bCS').textContent=money(cS);
  if(Q('bCM'))Q('bCM').textContent=money(cM);
  if(Q('bCT'))Q('bCT').textContent=money(cS+cM);
  // PV separado
  if(Q('bTS'))Q('bTS').textContent=money(pvS);
  if(Q('bTM'))Q('bTM').textContent=money(pvM);
  if(Q('bTT'))Q('bTT').textContent=money(pvS+pvM);
  // Sync campos de valor
  if(Q('vS'))Q('vS').value=pvS.toFixed(2);
  if(Q('vM'))Q('vM').value=pvM.toFixed(2);
  // FIX V345 #5: recalcular total (vD, pvTot) após atualizar vS/vM
  // sem isso togTerc/togInc disparam updKpi com total desatualizado
  if(typeof cTot==='function') cTot();
  // Excluídos e terceiros
  var ex=Q('bTEx');
  if(ex)ex.textContent=(sEx+mEx)>0?'Excluídos: '+money(sEx+mEx):'';
  var tc=Q('bTTc');
  var nT=budg.filter(function(x){return x.terc===true&&x.inc!==false}).length;
  if(tc)tc.textContent=nT>0?'🤝 '+nT+' item(ns) de terceiro':'';
}
function applyBudg(){
  var s=0,m=0;budg.forEach(function(it){if(it.t==='material')m+=n2(it.pvt);else s+=n2(it.pvt)});
  Q('vS').value=s.toFixed(2);Q('vM').value=m.toFixed(2);cTot();alert('Valores transferidos.');
}
// MARGENS POR CATEGORIA
function togMar(){
  var body=Q('marBody'), actions=Q('marActions'), chev=Q('marChevron');
  var open=body.style.display!=='none';
  if(open){
    // Apenas esconde — NÃO re-renderiza, preserva valores digitados
    body.style.display='none';
    actions.style.display='none';
    chev.textContent='▼ expandir';
  } else {
    body.style.display='block';
    actions.style.display='flex';
    chev.textContent='▲ recolher';
    // Só renderiza se ainda não tem conteúdo (primeira abertura ou após salvar/resetar)
    var bS=Q('marBodyS');
    if(!bS||!bS.children.length) rMargens();
    showMarTab((Q('marTbM')&&Q('marTbM').style.display!=='none')?'m':'s');
  }
}

function togAliq(){
  var body=Q('aliqBody'), ch=Q('aliqChevron'), act=Q('aliqActions');
  if(!body) return;
  var open = body.style.display!=='none';
  if(open){
    body.style.display='none';
    if(ch) ch.textContent='▼ expandir';
    if(act) act.style.display='none';
  }else{
    body.style.display='block';
    if(ch) ch.textContent='▲ recolher';
    if(act) act.style.display='flex';
  }
}
function showMarTab(t){
  Q('marTbS').style.display=t==='s'?'block':'none';
  Q('marTbM').style.display=t==='m'?'block':'none';
  Q('marTabSvc').className='btn '+(t==='s'?'bp':'bg')+' bsm';
  Q('marTabMat').className='btn '+(t==='m'?'bp':'bg')+' bsm';
}
function rMargens(){
  var cfg=getPrcAtual();
  var bS=Q('marBodyS'),bM=Q('marBodyM');
  if(!bS||!bM)return;
  // Indicador: margens são desta proposta ou do padrão global
  var _badgeEl=Q('marScopeBadge');
  if(_badgeEl){
    var _hasPropPrc=editId&&(function(){var _pp=props.find(function(x){return x.id===editId;});return _pp&&_pp.prc;})();
    _badgeEl.textContent=_hasPropPrc?'📋 desta proposta':'🌐 padrão global';
    _badgeEl.style.background=_hasPropPrc?'#1a3a2a':'#2a2a3a';
    _badgeEl.style.color=_hasPropPrc?'#3fb950':'#8b949e';
  }

  var nfS=cfg.aliq.nfS!=null?cfg.aliq.nfS:0.14;
  var nfM=cfg.aliq.nfM!=null?cfg.aliq.nfM:0.14;
  var rs =cfg.aliq.rS !=null?cfg.aliq.rS :0;
  var comS=cfg.aliq.comS!=null?cfg.aliq.comS:0.025;
  var comM=cfg.aliq.comM!=null?cfg.aliq.comM:0.025;
  var neg =cfg.aliq.neg !=null?cfg.aliq.neg :0.05;

  function fmtDesc(desc){
    if(!desc) return '';
    return desc
      .split(';')
      .map(function(x){ return (x||'').trim(); })
      .filter(Boolean)
      .map(function(x){ return '• '+esc(x); })
      .join('<br>');
  }

  bS.innerHTML=Object.keys(cfg.s).sort().map(function(k){
    var cat=cfg.s[k];
    var _cm=(cat.m||0);
    var _aS=nfS+rs+comS+neg; var _isMob=(k&&k.indexOf('MB-')===0); var fmf=_aS<1?(_isMob?(1+_cm)/(1-_aS):((_cm<1)?1/((1-_cm)*(1-_aS)):1)):1;
    var pvEx=fmf.toFixed(4);
    var pct=(_cm*100).toFixed(1);
    var rMin=cat.rMin!==undefined?(cat.rMin*100).toFixed(0):'-';
    var rMax=cat.rMax!==undefined?(cat.rMax*100).toFixed(0):'-';
    var cor=cat.m>=0.5?'#3fb950':cat.m>=0.35?'#d4a017':'#f85149';
    var rangeCor=(cat.m||0)<cat.rMin?'#f85149':(cat.m||0)>cat.rMax?'#58a6ff':'#3fb950';
    return '<tr>'
      +'<td style="font-family:monospace;font-size:.8rem;color:var(--text3);white-space:nowrap;vertical-align:top">'+k+'</td>'
      +'<td style="vertical-align:top">'
        +'<div style="font-weight:700;font-size:.92rem;color:var(--text)">'+cat.n+'</div>'
        +(cat.desc?'<div style="font-size:.78rem;color:var(--text2);margin-top:4px;line-height:1.45;white-space:normal">'+fmtDesc(cat.desc)+'</div>':'')
      +'</td>'
      +'<td style="white-space:nowrap;vertical-align:top">'
        +'<div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap">'
        +'<input type="number" value="'+pct+'" min="1" max="90" step="0.5" data-key="'+k+'" data-tipo="s"'
        +' style="width:82px;padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:.9rem;text-align:right"'
        +' oninput="updMarPrev(this)">'
        +'<span class="mar-badge" style="font-size:.82rem;font-weight:700;color:'+cor+'">'+pct+'%</span>'
        +'</div>'
        +'<div style="font-size:.76rem;color:'+rangeCor+';margin-top:4px;white-space:normal">Range: '+rMin+'–'+rMax+'%</div>'
      +'</td>'
      +'<td style="text-align:right;vertical-align:top">'+'<div style="font-size:.92rem;color:var(--accent);font-weight:700;white-space:nowrap" id="mpS_'+k+'">'+pvEx+'</div>'+(function(){var _fd=function(v){return v.toFixed(4).replace(/\.?0+$/,'').replace('.',',');};var _ms='(1−'+_fd(_cm)+')';var _den='(1 − (NF'+_fd(nfS)+' + RS'+_fd(rs)+' + Com'+_fd(comS)+' + Neg'+_fd(neg)+'))';if(k.indexOf('MB-')===0)  return '<div style="font-size:.73rem;color:var(--text3);margin-top:5px;white-space:nowrap;font-family:monospace">(1+'+_fd(_cm)+') ÷ '+_den+'</div>';return '<div style="font-size:.73rem;color:var(--text3);margin-top:5px;white-space:nowrap;font-family:monospace">1 ÷ ['+_ms+' × '+_den+']</div>';})()+'</td>'
      +'<td style="white-space:nowrap;vertical-align:top;text-align:right">'
      +'<button onclick="editCategoria(\''+k+'\',\'s\')" style="font-size:.65rem;padding:.18rem .4rem;border:1px solid var(--border);border-radius:3px;background:var(--bg3);color:var(--text2);cursor:pointer;margin-right:2px" title="Editar">✏️</button>'
      +'<button onclick="delCategoria(\''+k+'\',\'s\')" style="font-size:.65rem;padding:.18rem .4rem;border:1px solid var(--border);border-radius:3px;background:var(--bg3);color:#f85149;cursor:pointer" title="Excluir">🗑</button>'
      +'</td>'
      +'</tr>';
  }).join('');

  bM.innerHTML=Object.keys(cfg.m).sort().map(function(k){
    var cat=cfg.m[k];
    var _mk=(cat.mk||0);
    var _aM=nfM+rs+comM+neg; var fmf=_aM<1?(1+_mk)/(1-_aM):1;
    var pvEx=fmf.toFixed(4);
    var pct=(_mk*100).toFixed(1);
    var rMin=cat.rMin!==undefined?(cat.rMin*100).toFixed(0):'-';
    var rMax=cat.rMax!==undefined?(cat.rMax*100).toFixed(0):'-';
    var cor=_mk>=0.35?'#3fb950':cat.mk>=0.2?'#d4a017':'#f85149';
    var rangeCor=_mk<cat.rMin?'#f85149':_mk>cat.rMax?'#58a6ff':'#3fb950';
    return '<tr>'
      +'<td style="font-family:monospace;font-size:.8rem;color:var(--text3);white-space:nowrap;vertical-align:top">'+k+'</td>'
      +'<td style="vertical-align:top">'
        +'<div style="font-weight:700;font-size:.92rem;color:var(--text)">'+cat.n+'</div>'
        +(cat.desc?'<div style="font-size:.78rem;color:var(--text2);margin-top:4px;line-height:1.45;white-space:normal">'+fmtDesc(cat.desc)+'</div>':'')
      +'</td>'
      +'<td style="white-space:nowrap;vertical-align:top">'
        +'<div style="display:flex;align-items:center;gap:.35rem;flex-wrap:wrap">'
        +'<input type="number" value="'+pct+'" min="1" max="200" step="0.5" data-key="'+k+'" data-tipo="m"'
        +' style="width:82px;padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:.9rem;text-align:right"'
        +' oninput="updMarPrev(this)">'
        +'<span class="mar-badge" style="font-size:.82rem;font-weight:700;color:'+cor+'">'+pct+'%</span>'
        +'</div>'
        +'<div style="font-size:.76rem;color:'+rangeCor+';margin-top:4px;white-space:normal">Range: '+rMin+'–'+rMax+'%</div>'
      +'</td>'
      +'<td style="text-align:right;vertical-align:top">'+'<div style="font-size:.92rem;color:var(--accent);font-weight:700;white-space:nowrap" id="mpM_'+k+'">'+pvEx+'</div>'+(function(){var _fd=function(v){return v.toFixed(4).replace(/\.?0+$/,'').replace('.',',');};var _den='(1 − (NF'+_fd(nfM)+' + RS'+_fd(rs)+' + Com'+_fd(comM)+' + Neg'+_fd(neg)+'))';return '<div style="font-size:.73rem;color:var(--text3);margin-top:5px;white-space:nowrap;font-family:monospace">(1+'+_fd(_mk)+') ÷ '+_den+'</div>';})()+'</td>'
      +'<td style="white-space:nowrap;vertical-align:top;text-align:right">'
      +'<button onclick="editCategoria(\''+k+'\',\'m\')" style="font-size:.65rem;padding:.18rem .4rem;border:1px solid var(--border);border-radius:3px;background:var(--bg3);color:var(--text2);cursor:pointer;margin-right:2px" title="Editar">✏️</button>'
      +'<button onclick="delCategoria(\''+k+'\',\'m\')" style="font-size:.65rem;padding:.18rem .4rem;border:1px solid var(--border);border-radius:3px;background:var(--bg3);color:#f85149;cursor:pointer" title="Excluir">🗑</button>'
      +'</td>'
      +'</tr>';
  }).join('');
}
function updMarPrev(el){
  var k=el.getAttribute('data-key');
  var tipo=el.getAttribute('data-tipo');
  var v=parseFloat(el.value)||0;
  var cfg=getPrcAtual();
  var al=cfg.aliq;
  // Usar mesma fórmula do calcFMF para preview consistente
  if(tipo==='s'){
    var m=v/100;
    var isMob=(k&&k.indexOf('MB-')===0);
    var aS=1-(n2(al.nfS)+n2(al.rS)+n2(al.comS)+n2(al.neg));
    var fmf=isMob?(1+m)/aS:1/((1-m)*aS);
    var el2=document.getElementById('mpS_'+k);
    if(el2)el2.textContent=fmf.toFixed(4);
    // Atualizar badge cor
    var cor=m>=0.5?'#3fb950':m>=0.35?'#d4a017':'#f85149';
    el.nextElementSibling.style.color=cor;
    el.nextElementSibling.textContent=(v).toFixed(1)+'%';
  } else {
    var mk=v/100;
    var aM=1-(n2(al.nfM)+n2(al.rS)+n2(al.comM)+n2(al.neg));
    var fmf2=(1+mk)/aM;
    var el3=document.getElementById('mpM_'+k);
    if(el3)el3.textContent=fmf2.toFixed(4);
    var cor2=mk>=0.35?'#3fb950':mk>=0.2?'#d4a017':'#f85149';
    el.nextElementSibling.style.color=cor2;
    el.nextElementSibling.textContent=(v).toFixed(1)+'%';
  }
}
function saveMar(){
  var cfg=getPrcAtual();
  // Coletar todos os inputs de margens
  document.querySelectorAll('#marBodyS input[data-tipo="s"],#marBodyM input[data-tipo="m"]').forEach(function(el){
    var k=el.getAttribute('data-key');
    var tipo=el.getAttribute('data-tipo');
    var v=parseFloat(el.value)||0;
    if(tipo==='s'&&cfg.s[k]) cfg.s[k].m=v/100;
    if(tipo==='m'&&cfg.m[k]) cfg.m[k].mk=v/100;
  });
  savePrcAtual(cfg);

  // Recalcular FMF, PVU e PVT de TODOS os itens já no orçamento
  var recalc=0;
  budg.forEach(function(it){
    var novoFmf=calcFMF(cfg,it.t,it.cat);
    it.fmf=novoFmf;
    it.pvu=it.cu*novoFmf;
    it.pvt=it.pvu*it.mult;
    recalc++;
  });

  rBudg();
  updKpi();
  rMargens();          // Re-renderiza tabela com valores salvos (limpa estado dos inputs)
  upsertCurrentDraft(true);
  toast('✔ Margens salvas! '+recalc+' item(ns) recalculado(s).','ok');
}
function resetMar(){
  if(!confirm('Restaurar margens padrão?\nAs categorias padrão voltam aos valores originais.\nCategorias novas que você cadastrou serão mantidas.\nO FMF de todos os itens do orçamento será recalculado.'))return;
  var cfg=getPrcAtual();
  // Mesclar: restaurar apenas as categorias que existem no padrão, sem excluir as novas
  var defpMerged=getDefpMerged();
  Object.keys(defpMerged.s).forEach(function(k){
    cfg.s[k]=JSON.parse(JSON.stringify(defpMerged.s[k]));
  });
  Object.keys(defpMerged.m).forEach(function(k){
    cfg.m[k]=JSON.parse(JSON.stringify(defpMerged.m[k]));
  });
  savePrcAtual(cfg);
  // Recalcular FMF de todos os itens do orçamento
  var recalc=0;
  budg.forEach(function(it){
    var novoFmf=calcFMF(cfg,it.t,it.cat);
    it.fmf=novoFmf; it.pvu=it.cu*novoFmf; it.pvt=it.pvu*it.mult; recalc++;
  });
  var _abaAnt=(Q('marTbM')&&Q('marTbM').style.display!=='none')?'m':'s';
  rMargens();
  showMarTab(_abaAnt);
  updBT(); rBudg(); updKpi();
  toast('✔ Margens padrão restauradas! Categorias novas mantidas. '+recalc+' item(ns) recalculado(s).','ok');
}

function saveAliq(){
  var cfg=getPrcAtual();
  // Campos em %, converter para decimal ao salvar
  cfg.aliq.nfS=parseFloat((n2(Q('aNFS').value)/100).toFixed(5));
  cfg.aliq.nfM=parseFloat((n2(Q('aNFM').value)/100).toFixed(5));
  cfg.aliq.rS=parseFloat((n2(Q('aRS').value)/100).toFixed(5));
  cfg.aliq.comS=parseFloat((n2(Q('aComS').value)/100).toFixed(5));
  cfg.aliq.comM=parseFloat((n2(Q('aComM').value)/100).toFixed(5));
  cfg.aliq.neg=parseFloat((n2(Q('aNeg').value)/100).toFixed(5));
  savePrcAtual(cfg);
  // FIX V345 #2: REMOVIDO — DEFP.aliq NÃO deve ser contaminado com alíquota de uma proposta específica
  // Cada proposta tem suas próprias alíquotas em p.aliq; o DEFP é apenas o padrão para propostas novas
  // Recalcular FMF, PVU e PVT de TODOS os itens do orçamento com as novas alíquotas desta proposta
  var recalc=0;
  budg.forEach(function(it){
    var novoFmf=calcFMF(cfg,it.t,it.cat);
    it.fmf=novoFmf;
    it.pvu=it.cu*novoFmf;
    it.pvt=it.pvu*it.mult;
    recalc++;
  });
  rBudg(); updKpi(); rMargens();
  upsertCurrentDraft(true);
  toast('Alíquotas salvas nesta proposta! '+recalc+' item(ns) recalculado(s).','ok');
}



// PREVIEW – fluxo continuo
function genPrev(){try{
  // Garantir que vS/vM estão sempre calculados do orçamento antes de ler
  updBT();
  var num=Q('pNum').value||'000.00';
  var dv=Q('pDat').value;var df=dv?new Date(dv+'T12:00:00').toLocaleDateString('pt-BR'):new Date().toLocaleDateString('pt-BR');
  var cli=Q('pCli').value||'Cliente',cnpj=Q('pCnpj').value||'',cid=Q('pCid').value||'';
  var ac=Q('pAC').value||'',dep=Q('pDep').value||'',mail=Q('pMail').value||'',tel=Q('pTel').value||'';
  var loc=Q('pLoc').value||'',locCnpj=Q('pLocCnpj')&&Q('pLocCnpj').value||'',csvc=Q('pCsv').value||'',tit=Q('pTit').value||'Proposta Tecnica Comercial';
  var area=Q('pArea')&&Q('pArea').value||'',equip=Q('pEquip')&&Q('pEquip').value||'';
  var ac2=Q('pAC2')&&Q('pAC2').value||'',dep2=Q('pDep2')&&Q('pDep2').value||'',mail2=Q('pMail2')&&Q('pMail2').value||'',tel2=Q('pTel2')&&Q('pTel2').value||'';
  var tensValFld=Q('pTensVal')&&Q('pTensVal').value||'';
  var tensCmdFld=Q('pTensCmd')&&Q('pTensCmd').value||'';
  var tensSel=['pT1F','pT2F','pT3F','pTN','pTPE'].filter(function(id){return Q(id)&&Q(id).checked;});
  var tensLbls={'pT1F':'1F','pT2F':'2F','pT3F':'3F','pTN':'N','pTPE':'PE'};
  var tensFases=tensSel.map(function(id){return tensLbls[id];}).join(' + ');
  var tensStr=(tensValFld&&tensFases)?tensValFld+' — '+tensFases:(tensValFld||tensFases);
  var tensCmdStr=tensCmdFld;
  var res=Q('pRes').value||'';
  var vs=n2(Q('vS').value),vm=n2(Q('vM').value);
  var dS=n2(Q('vDSval')&&Q('vDSval').value)||0;
  var dM=n2(Q('vDMval')&&Q('vDMval').value)||0;
  var vd=dS+dM, vtot=0;
  var _p=props.find(function(x){return x.id===editId})||{};
  if(vs<=0) vs=n2(_p.vS);
  if(vm<=0) vm=n2(_p.vM);
  var _escPrev = escSecs.length ? escSecs : (_p.esc||[]);
  // Use budg (sorted by _budgGrupos) if available; otherwise use saved items
  var _budgAllRaw = budg.length ? budg : (_p.bi||[]);
  // Apply same sort as the table when using saved items
  var _budgAll = _budgAllRaw;
  if(!budg.length && _budgGrupos && _budgGrupos.length){
    _budgAll = _budgAllRaw.slice().sort(function(a,b){
      for(var _gi=0;_gi<_budgGrupos.length;_gi++){
        var _gk=_budgGrupos[_gi];
        var _va=_getGrupoVal(a,_gk), _vb=_getGrupoVal(b,_gk);
        var _gc=_va.localeCompare(_vb); if(_gc!==0) return _gc;
      }
      return 0;
    });
  }
  if(!vs && !vm){
    _budgAll.forEach(function(it){
      if(it.inc===false) return;
      if(it.t==='material') vm+=n2(it.pvt); else vs+=n2(it.pvt);
    });
  }
  var liqS=Math.max(0,vs-dS), liqM=Math.max(0,vm-dM);
  vtot=liqS+liqM;

  var revs = (typeof revs !== 'undefined' && revs.length) ? revs : (_p.revs||[]);

  // ── Assinatura ──
  var assina='<div class="pp-sg"><p class="pp-p">Atenciosamente,</p>'
    +'<p class="pp-p" style="margin-top:22px"><strong>Eng. Elivandro J. Nascimento</strong></p>'
    +'<p class="pp-p" style="font-size:9.5pt;color:#555">Engenheiro Eletricista | CREA SP: 5071802874</p>'
    +'<p class="pp-p" style="font-size:9.5pt;color:#555">Cel: +55 11 9.3937-6292 | +55 11 9.9929-9211</p>'
    +'<p class="pp-p" style="font-size:9.5pt;color:#555">e-mail: elivandro@tecfusion.com.br</p>'
    +'<p class="pp-p" style="font-size:9.5pt;color:#555">Tecfusion Soluções Elétricas Industriais.</p>'
    +'<p class="pp-p" style="font-size:9.5pt;color:#555">CNPJ: 23.624.491/0001-47</p></div>';

  // ── Tabela de VALOR (scroll contínuo, com agrupamento por equip/inst) ──
  function _buildValorRows(itensFiltrados){
    var nr=0;
    var rows='';
    itensFiltrados.forEach(function(it){
      if(it.inc===false) return;
      if(it.det===false) return;
      nr++;
      var lbl=esc(it.desc||it.cat||'');
      var tipo=it.t==='material'?'Mat':'Svc';
      var un1=it.un1||'',un2=it.un2||'';
      var ql;
      if(it.t==='material'){
        ql=it.mult+(un1?' '+un1:'');
      } else {
        var _gt=it.tec||1,_gd=it.dias||1,_gh=it.hpd||1;
        var _gp=[];
        if(_gt>1||it.dias!=null) _gp.push(_gt+' Tec.');
        _gp.push(_gd+(un1?' '+un1:''));
        if(_gh!==1) _gp.push(_gh+(un2?' '+un2:''));
        ql=_gp.join(' × ');
        if(_gh!==1) ql+=' = '+it.mult.toFixed(0)+(un2?' '+un2:'h');
      }
      // Linha 2: tudo em uma linha só
      var l2parts=[];
      l2parts.push('<span style="background:#e8f4e8;color:#2d6a2d;padding:0 4px;border-radius:3px;font-weight:600">'+tipo+'</span> '+esc(it.cat));
      if(it.equip) l2parts.push('<span style="color:#1a6b6b">⊜ '+esc(it.equip)+'</span>');
      if(it.inst)  l2parts.push('<span style="color:#6b3a1a">⊕ '+esc(it.inst)+'</span>');
      if(it.tipoTrab) l2parts.push('<span style="color:#5b21b6">🔧 '+esc(it.tipoTrab)+'</span>');
      if(it.faseTrab) l2parts.push('<span style="color:#0369a1">📋 '+esc(it.faseTrab)+'</span>');
      l2parts.push('Qtd: '+ql);
      l2parts.push('PV Unit.: '+money(it.pvu));
      if(it.terc) l2parts.push('<span style="color:#f97316">●Terc</span>');
      var sub='<div style="font-size:.68rem;color:#555;margin-top:2px">'+l2parts.join(' &nbsp;|&nbsp; ')+'</div>';
      rows+='<tr>'
        +'<td style="text-align:center;vertical-align:top;white-space:nowrap;width:28px;color:#555;font-size:.75rem;padding-right:3px;padding-top:3px">'+nr+'</td>'
        +'<td><div style="font-weight:700;font-size:10.5pt">'+lbl+'</div>'+sub+'</td>'
        +'<td style="text-align:right;vertical-align:top;font-weight:700">'+money(it.pvt)+'</td>'
        +'</tr>';
    });
    return rows;
  }

  function _buildGrupoHeader(gLabel, gitens){
    var subtotal=gitens.reduce(function(s,it){return s+(it.inc!==false?n2(it.pvt):0);},0);
    return '<tr><td colspan="3" style="background:#e8f4e8;color:#154a15;font-weight:700;font-size:.78rem;padding:.3rem .5rem;border-top:2px solid #c8dfc8">'
      +esc(gLabel)
      +'<span style="float:right;color:#555;font-weight:400;font-size:.71rem">'+gitens.length+' item(ns) &nbsp;|&nbsp; '+money(subtotal)+'</span>'
      +'</td></tr>';
  }

  function buildValorBlockPrev(secLabel, tituloValor, descValor){
    var out='<div style="margin-bottom:8px"><div class="ph1">'+secLabel+'. '+esc(tituloValor||'VALOR')+'</div>';
    if(descValor){ out+='<p class="pp-p">'+esc(descValor).replace(/\n/g,'<br>')+'</p>'; }

    var _activeGruposCheck=(_budgGrupos&&_budgGrupos.length)?_budgGrupos:(_budgSortAtivo?[_budgSortAtivo]:[]);
    var itensDet;
    if(_activeGruposCheck.length){
      // Com agrupamento ativo: mostra TODOS os itens incluídos, organizados pelos grupos
      itensDet=_budgAll.filter(function(it){ return it.inc!==false; });
    } else {
      // Sem agrupamento: respeita o botão DET (👁) de cada item
      itensDet=_budgAll.filter(function(it){ return it.inc!==false && it.det!==false; });
      // Fallback: se nenhum tem det=true, usa todos incluídos
      if(!itensDet.length && _budgAll.some(function(it){return it.inc!==false;})){
        itensDet=_budgAll.filter(function(it){ return it.inc!==false; });
      }
    }
    var hasDetRows=itensDet.length>0;

    // Agrupamento multi-nível (usa _budgGrupos)
    function _buildGrupoRec(itens, keys){
      if(!keys.length || !itens.length) return _buildValorRows(itens);
      var key=keys[0], rest=keys.slice(1);
      var grupos={}, ordem=[];
      itens.forEach(function(it){
        var v=(_getGrupoVal?_getGrupoVal(it,key):(it[key]||'').trim())||'(sem '+key+')';
        if(!grupos[v]){ grupos[v]=[]; ordem.push(v); }
        grupos[v].push(it);
      });
      var h='';
      ordem.forEach(function(gVal){
        var gitens=grupos[gVal];
        var gLabel;
        if(gVal==='Material') gLabel='🟣 '+gVal;
        else if(gVal==='Serviço') gLabel='🔵 '+gVal;
        else if(key==='equip') gLabel='⊜ '+gVal;
        else if(key==='inst')  gLabel='⊕ '+gVal;
        else if(key==='tipoTrab') gLabel='🔧 '+gVal;
        else if(key==='faseTrab') gLabel='📋 '+gVal;
        else if(key==='cat'){
          // Para categoria: mostra código + nome + descrição completa
          var _cfgG=getPrcAtual();
          var _firstIt=gitens[0];
          var _catObj=_firstIt?(_firstIt.t==='material'?(_cfgG.m&&_cfgG.m[gVal]):(_cfgG.s&&_cfgG.s[gVal])):null;
          var _catNome=(_catObj&&_catObj.n)?(' — '+String(_catObj.n)):'';
          var _catDescRaw=(_catObj&&_catObj.desc)?String(_catObj.desc):'';
          var _descFmt=_catDescRaw?_catDescRaw.split(';').map(function(s){return s.trim();}).filter(Boolean).map(function(s){return '• '+s;}).join(' '):'';
          gLabel='📂 '+String(gVal||'')+_catNome+(_descFmt?' | '+_descFmt:'');
        }
        else gLabel=gVal;
        h+=_buildGrupoHeader(gLabel, gitens);
        h+=_buildGrupoRec(gitens, rest);
      });
      return h;
    }
    var activeGrupos=(_budgGrupos&&_budgGrupos.length)?_budgGrupos:(_budgSortAtivo?[_budgSortAtivo]:[]);
    var detRows='';
    if(hasDetRows && activeGrupos.length){
      detRows=_buildGrupoRec(itensDet, activeGrupos);
    } else {
      detRows=_buildValorRows(itensDet);
    }

    var sepRow=hasDetRows?'<tr><td colspan="3" style="padding:0;border-top:1px solid #c8dfc8"></td></tr>':'';
    out+='<div class="pp-valor-wrap"><table class="pp-tb">'
      +'<tr><th style="text-align:center;width:28px">#</th><th>Itens</th><th style="text-align:right">Valor</th></tr>'
      +detRows+sepRow
      +(vs>0?'<tr><td></td><td>'+(hasDetRows?'Soma dos Serviços':'Serviços')+'</td><td style="text-align:right">'+money(vs)+'</td></tr>':'')
      +(dS>0?'<tr><td></td><td>Desconto Serviços</td><td style="text-align:right">- '+money(dS)+'</td></tr>':'')
      +(dS>0?'<tr><td></td><td>Serviços líquidos</td><td style="text-align:right">'+money(liqS)+'</td></tr>':'')
      +(vm>0?'<tr><td></td><td>'+(hasDetRows?'Soma dos Materiais':'Materiais')+'</td><td style="text-align:right">'+money(vm)+'</td></tr>':'')
      +(dM>0?'<tr><td></td><td>Desconto Materiais</td><td style="text-align:right">- '+money(dM)+'</td></tr>':'')
      +(dM>0?'<tr><td></td><td>Materiais líquidos</td><td style="text-align:right">'+money(liqM)+'</td></tr>':'')
      +(vd>0?'<tr><td></td><td>Desconto total</td><td style="text-align:right">- '+money(vd)+'</td></tr>':'')
      +'<tr class="tr"><td></td><td>TOTAL GERAL</td><td style="text-align:right">'+money(vtot)+'</td></tr>'
      +'</table></div></div>';
    return out;
  }


  // ── Capa ──
  var capa='<div class="pp-id"><table>'
    +'<tr><td class="lbl">Nome do Cliente:</td><td>'+esc(cli)+'</td><td class="lbl">CNPJ Cliente:</td><td>'+esc(cnpj)+'</td></tr>'
    +'<tr><td class="lbl">Cidade do Cliente:</td><td>'+esc(cid)+'</td><td class="lbl">Nome Contato 1:</td><td>'+esc(ac)+'</td></tr>'
    +'<tr><td class="lbl">Depto. Contato 1:</td><td>'+esc(dep)+'</td><td class="lbl">E-mail Contato 1:</td><td>'+esc(mail)+'</td></tr>'
    +'<tr><td class="lbl">Tel/Cel Contato 1:</td><td>'+esc(tel)+'</td>'
      +(ac2?'<td class="lbl">Nome Contato 2:</td><td>'+esc(ac2)+'</td>':'<td></td><td></td>')
      +'</tr>'
    +(ac2?'<tr>'
      +(dep2?'<td class="lbl">Depto. Contato 2:</td><td>'+esc(dep2)+'</td>':'<td></td><td></td>')
      +(mail2?'<td class="lbl">E-mail Contato 2:</td><td>'+esc(mail2)+'</td>':'<td></td><td></td>')
      +'</tr>':'')
    +(ac2&&tel2?'<tr><td class="lbl">Tel/Cel Contato 2:</td><td colspan="3">'+esc(tel2)+'</td></tr>':'')
    +'<tr><td class="lbl">Cliente do Serviço:</td><td>'+esc(loc)+'</td><td class="lbl">CNPJ do Local:</td><td>'+esc(locCnpj||'-')+'</td></tr>'
    +'<tr>'
      +'<td class="lbl">Cidade do Serviço:</td><td>'+esc(csvc)+'</td>'
      +(area?'<td class="lbl">Área/Local:</td><td>'+esc(area)+'</td>':'<td></td><td></td>')
      +'</tr>'
    +(equip?'<tr><td class="lbl">Equipamento:</td><td colspan="3">'+esc(equip)+'</td></tr>':'')
    +((tensStr||tensCmdStr)?'<tr>'
      +(tensStr?'<td class="lbl">Tensão Principal:</td><td>'+esc(tensStr)+'</td>':'<td></td><td></td>')
      +(tensCmdStr?'<td class="lbl">Tensão Comando:</td><td>'+esc(tensCmdStr)+'</td>':'<td></td><td></td>')
      +'</tr>':'')
    +'</table></div>'
    +'<hr class="pp-hr">'
    +'<div class="pp-ttl"><div class="pp-mt">Proposta Tecnica e Comercial</div>'
    +'<div class="pp-st">'+esc(tit)+'</div>'
    +'<div class="pp-dl">N '+esc(num)+' | Jundiai, '+esc(df)+'</div></div>'
    +'<hr class="pp-hr">'
    +'<p class="pp-p">Prezado(a) Sr(a). <strong>'+esc(ac||'[Contato]')+'</strong>,</p>'
    +'<p class="pp-p">Atendendo as suas solicitacoes, temos o prazer de apresentar nossa <strong>Proposta Tecnica Comercial</strong> para:</p>'
    +'<p class="pp-p" style="margin-left:12px;font-style:normal">'+esc(res||'[descricao do servico]')+'</p>'
    +'<p class="pp-p">O servico sera realizado na planta <strong>'+esc(loc||'[local]')+'</strong>, na cidade de <strong>'+esc(csvc||'[cidade]')+'</strong>.</p>'
    +'<p class="pp-p">Colocamo-nos a disposicao para quaisquer informacoes adicionais.</p>';

  // ── Seções do Escopo ──
  var secoes='';
  var secN=1;
  var temValorNoEscopo=false;
  _escPrev.forEach(function(sec){
    if(!sec) return;
    var curSecNum=sec.num?sec.num:String(secN);
    if(isValorSec(sec)){
      temValorNoEscopo=true;
      if(vs||vm||vd){
        secoes+=buildValorBlockPrev(curSecNum, sec.titulo||'VALOR', sec.desc||'');
      } else if(sec.titulo||sec.desc){
        secoes+='<div style="margin-bottom:8px"><div class="ph1">'+curSecNum+'. '+esc(sec.titulo||'VALOR')+'</div>'
          +(sec.desc?'<p class="pp-p">'+esc(sec.desc).replace(/\n/g,'<br>')+'</p>':'')
          +'</div>';
      }
      secN++;return;
    }
    var body='';
    if(sec.desc) body+='<p class="pp-p">'+esc(sec.desc).replace(/\n/g,'<br>')+'</p>';
    (sec.subs||[]).forEach(function(sub,subi){
      var subNum=(sub.num||'').trim()||(curSecNum+'.'+(subi+1));
      body+='<div class="ph3">'+subNum+'. '+esc(sub.nome||sub.titulo||'')+'</div>';
      if(sub.desc) body+='<p class="pp-p" style="margin-left:10px">'+esc(sub.desc).replace(/\n/g,'<br>')+'</p>';
    });
    var ganttBlock='';
    if(isPrazo(sec)){var _pg=props.find(function(x){return x.id===editId;})||{};ganttBlock=buildGanttPrev(_pg.gantt||{inicio:'',fases:[]});}
    if(sec.titulo||body||ganttBlock){
      secoes+='<div style="margin-bottom:8px"><div class="ph1">'+curSecNum+'. '+esc(sec.titulo||'')+'</div>'+body+ganttBlock+'</div>';
      secN++;
    }
  });

  // Fallback: seção VALOR no final se não existia no escopo
  if((vs||vm||vd)&&!temValorNoEscopo){
    secoes+=buildValorBlockPrev(String(secN),'VALOR','');
  }

  // ── Índice / Sumário ──
  var tocRows='';
  var si=1;
  _escPrev.forEach(function(sec){
    if(!sec) return;
    var curSecNum=sec.num?sec.num:String(si);
    var hasContent=sec.titulo||(sec.subs&&sec.subs.length)||(sec.desc&&sec.desc.trim());
    if(!hasContent && !isValorSec(sec)) return;
    var titulo=isValorSec(sec)?(sec.titulo||'VALOR'):esc(sec.titulo||'');
    if(!titulo && !isValorSec(sec)){si++;return;}
    tocRows+='<tr>'
      +'<td class="pp-tn">'+curSecNum+'</td>'
      +'<td style="font-weight:bold">'+titulo+'</td>'
      +'<td class="pp-td" style="color:#bbb;font-size:8pt">.....................................</td>'
      +'<td class="pp-tp">—</td>'
      +'</tr>';
    (sec.subs||[]).forEach(function(sub,subi){
      var subNum=(sub.num||'').trim()||(curSecNum+'.'+(subi+1));
      tocRows+='<tr style="opacity:.85">'
        +'<td class="pp-tn" style="color:#666;font-size:8.5pt">'+subNum+'</td>'
        +'<td style="padding-left:14px;font-size:9pt;color:#333">'+esc(sub.nome||sub.titulo||'')+'</td>'
        +'<td class="pp-td" style="color:#bbb;font-size:8pt">.....................................</td>'
        +'<td class="pp-tp" style="font-size:9pt;color:#666">—</td>'
        +'</tr>';
    });
    si++;
  });
  // VALOR como seção autônoma se não existir no escopo
  if((vs||vm||vd)&&!temValorNoEscopo){
    tocRows+='<tr>'
      +'<td class="pp-tn">'+si+'</td>'
      +'<td style="font-weight:bold">VALOR</td>'
      +'<td class="pp-td" style="color:#bbb;font-size:8pt">.....................................</td>'
      +'<td class="pp-tp">—</td>'
      +'</tr>';
  }
  var indice='';
  if(tocRows){
    indice='<div style="margin-bottom:24px">'
      +'<div class="ph1">ÍNDICE</div>'
      +'<table class="pp-toc" style="width:100%;border-collapse:collapse">'
      +'<tr style="border-bottom:2px solid #154a15">'
      +'<td class="pp-tn" style="color:#154a15;font-weight:bold">#</td>'
      +'<td style="font-weight:bold">Seção</td>'
      +'<td></td>'
      +'<td class="pp-tp" style="text-align:right;font-weight:bold"></td>'
      +'</tr>'
      +tocRows
      +'</table></div>';
  }

  // ── Lista de Revisões ──
  var revsHtml='';
  if(revs&&revs.length){
    revsHtml='<div style="margin-top:18px">'
      +'<div style="font-size:9pt;font-weight:bold;color:#154a15;border-bottom:2px solid #154a15;padding-bottom:3px;margin-bottom:4px;text-transform:uppercase">Lista de Revisões</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:9pt">'
      +'<thead><tr style="background:#154a15;color:#fff">'
      +'<th style="padding:4px 8px;text-align:center;width:44px;border:1px solid #154a15">Rev.</th>'
      +'<th style="padding:4px 8px;text-align:center;width:90px;border:1px solid #154a15">Data</th>'
      +'<th style="padding:4px 8px;text-align:center;width:54px;border:1px solid #154a15">Por</th>'
      +'<th style="padding:4px 8px;text-align:left;border:1px solid #154a15">Descrição</th>'
      +'</tr></thead><tbody>'
      +revs.map(function(r,i){
        var bg=i%2===0?'#fff':'#f5faf5';
        return '<tr style="background:'+bg+'">'
          +'<td style="padding:4px 8px;text-align:center;border:1px solid #c8d8c8;font-weight:700;color:#154a15">'+esc(r.rev)+'</td>'
          +'<td style="padding:4px 8px;text-align:center;border:1px solid #c8d8c8">'+esc(r.dat)+'</td>'
          +'<td style="padding:4px 8px;text-align:center;border:1px solid #c8d8c8">'+esc(r.por)+'</td>'
          +'<td style="padding:4px 8px;border:1px solid #c8d8c8">'+esc(r.desc)+'</td>'
          +'</tr>';
      }).join('')
      +'</tbody></table></div>';
  }

  // ── Monta o preview em scroll contínuo (sem paginação simulada) ──
  var LOGO_B64 = Q('pvWrap').querySelector && (function(){
    // Reutiliza a logo já presente nas páginas antigas se existir
    var img = document.querySelector('.pv-logo-header img');
    return img ? img.src : null;
  })();

  // Logo: usa a mesma base64 do arquivo original
  var logoSrc = 'data:image/png;base64,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';

  var pvContent =
    '<div style="text-align:center;margin-bottom:16px">'
      +'<img src="'+logoSrc+'" alt="Logo Tecfusion" style="height:70px;width:auto;display:block;margin:0 auto">'
    +'</div>'
    + capa
    + assina
    +'<hr style="border:none;border-top:2px solid #154a15;margin:24px 0 16px 0">'
    + indice
    + secoes
    + revsHtml
    + assina;

  // FIX V347: separadores de página visuais entre seções principais
  var pgSep = '<div style="position:relative;height:28px;margin:0 -56px;background:#e8e8e8;display:flex;align-items:center;justify-content:center;border-top:2px dashed #bbb;border-bottom:2px dashed #bbb">'    +'<span style="background:#e8e8e8;padding:0 12px;font-size:9pt;color:#999;font-family:Arial,sans-serif">— página —</span></div>';

  // Inserir separador entre blocos principais
  var pvContentFinal = pvContent
    .replace('</div>' + assina, '</div>' + pgSep + assina)
    .replace(indice + secoes, indice + pgSep + secoes);

  var wrap = '<div style="background:#fff;max-width:794px;margin:0 auto;padding:48px 56px 56px 56px;font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.15)">'
    + pvContentFinal
    + '</div>';

  Q('pvWrap').innerHTML = wrap;
  Q('pvWrap').scrollTop = 0;
}catch(e){console.error('genPrev ERRO:',e);Q('pvWrap').innerHTML='<div style="padding:2rem;color:red;font-weight:bold">❌ ERRO no preview: '+e.message+'<br><small>'+e.stack+'</small></div>';}
}
function fitPg(){}

function pCSS(){return [
  /* Reset e base */
  '@page{size:A4;margin:15mm 19mm 16mm 19mm}',
  '*{font-style:normal !important;font-family:Calibri,Arial,sans-serif;box-sizing:border-box}',
  'body{margin:0;background:#fff;font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a;-webkit-print-color-adjust:exact;print-color-adjust:exact}',

  /* Página A4 — overflow visível para impressão não cortar conteúdo */
  '.pv-page{position:relative;width:100%;padding:0;box-sizing:border-box;',
  'page-break-after:always;break-after:page;',
  'display:flex;flex-direction:column;overflow:visible}',
  '.pv-page:last-child{page-break-after:auto;break-after:auto}',
  '.pv-page-bg{display:none !important}',
  '.pv-page-content{position:relative;z-index:1;flex:1;overflow:visible}',

  /* Rodapé e logo sempre visíveis */
  '.pp-sg-wrap{position:relative;z-index:1;flex-shrink:0;page-break-inside:avoid;break-inside:avoid}',
  '.pv-footer{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start;',
  'font-size:8.5pt;color:#666;padding-top:6px;border-top:1px solid #d0d0d0;margin-top:6px;flex-shrink:0}',
  '.pv-logo-header{text-align:center;margin-bottom:10px;flex-shrink:0}',
  '.pv-logo-header img{height:60px;width:auto;display:block;margin:0 auto}',

  /* Cabeçalhos sem quebra interna */
  '.ph1,.ph2,.ph3,.pp-id,.pp-valor-wrap{page-break-inside:avoid;break-inside:avoid}',
  '.ph1{font-size:12pt;font-weight:bold;color:#154a15;border-bottom:2px solid #154a15;',
  'padding-bottom:3px;margin:8px 0 6px 0;text-transform:uppercase}',
  '.ph2{font-size:11pt;font-weight:bold;color:#154a15;margin:7px 0 3px 0}',
  '.ph3{font-size:11pt;font-weight:bold;color:#333;margin:7px 0 3px 0}',

  /* Parágrafo com controle de órfãs/viúvas */
  '.pp-p{margin:0 0 5px 0;text-align:justify;font-size:11pt;line-height:1.6;orphans:3;widows:3}',

  /* Tabela — quebra entre linhas, nunca corta célula */
  '.pp-tb{width:100%;border-collapse:collapse;margin:7px 0;font-size:9.5pt;',
  'page-break-inside:auto}',
  '.pp-tb thead{display:table-header-group}',          /* repete cabeçalho em cada página */
  '.pp-tb tfoot{display:table-footer-group}',
  '.pp-tb tr{page-break-inside:avoid;break-inside:avoid;page-break-after:auto}',
  '.pp-tb th,.pp-tb td{border:1px solid #b0b8b0;padding:4px 7px;text-align:left}',
  '.pp-tb th{background:#ddeedd !important;font-weight:bold;color:#154a15;',
  '-webkit-print-color-adjust:exact;print-color-adjust:exact}',
  '.pp-tb .tr{background:#154a15 !important;color:#fff !important;font-weight:bold;',
  '-webkit-print-color-adjust:exact;print-color-adjust:exact}',

  /* Sumário */
  '.pp-toc{width:100%;border-collapse:collapse;font-size:9.5pt;margin:4px 0}',
  '.pp-toc td{padding:2px 4px;border-bottom:1px dotted #ccc}',
  '.pp-tn{color:#154a15;font-weight:bold;width:28px}',
  '.pp-tp{text-align:right;width:35px;color:#666}',
  '.pp-td{color:#bbb;font-size:8pt}',

  /* Bloco de identificação */
  '.pp-id{border:1px solid #b0c8b0;background:rgba(221,238,221,.3);padding:6px 9px;margin:9px 0}',
  '.pp-id table{width:100%;border-collapse:collapse}',
  '.pp-id td{padding:2px 5px;font-size:10pt}',
  '.pp-id .lbl{font-weight:bold;color:#154a15;width:112px;white-space:nowrap}',

  /* Título e rodapé de assinatura */
  '.pp-ttl{text-align:center;padding:7px 0 9px 0;border-bottom:2px solid #154a15;margin-bottom:9px}',
  '.pp-mt{font-size:16pt;font-weight:bold;color:#154a15;text-transform:uppercase}',
  '.pp-st{font-size:12pt;font-weight:bold;color:#222;margin-top:3px}',
  '.pp-dl{font-size:12pt;font-weight:bold;color:#444;margin-top:3px}',
  '.pp-sg{margin-top:10px;text-align:center;border-top:1px solid #ccc;padding-top:8px}',
  '.pp-hr{border:none;border-top:1px solid #c8d8c8;margin:6px 0}',

  /* Ocultar elementos não imprimíveis */
  '.no-print,.pv-nav,.pv-ctrl{display:none !important}'
].join('');}

// ── Utilitário de impressão via Blob (funciona em file://) ──
function _printHtml(html, filename){
  var blob = new Blob([html], {type:'text/html;charset=utf-8'});
  var url  = URL.createObjectURL(blob);
  var win  = window.open(url, '_blank');
  if(!win){ alert('Popup bloqueado. Permita popups para este arquivo e tente novamente.'); URL.revokeObjectURL(url); return; }
  win.onload = function(){
    try{ win.focus(); win.print(); }
    catch(e){ console.warn('_printHtml erro:',e); }
    setTimeout(function(){ URL.revokeObjectURL(url); }, 60000);
  };
  // Fallback: se onload não disparar (alguns navegadores)
  setTimeout(function(){
    if(win && !win.closed){
      try{ win.focus(); win.print(); }catch(e){}
      setTimeout(function(){ URL.revokeObjectURL(url); }, 30000);
    }
  }, 1200);
}
function printP(){
  genPrev();
  var pvInner=Q('pvWrap').innerHTML;
  if(!pvInner||pvInner.indexOf('Clique em')>=0){alert('Gere o preview primeiro.');return}
  /* Sem wrapper extra: as .pv-page já têm padding próprio. @page define as margens. */
  var phtml='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+pCSS()+'</style></head><body>'+pvInner+'</body></html>';
  _printHtml(phtml);
}

function buildWordHTML(){
  genPrev();
  var pvInner=Q('pvWrap').innerHTML;
  if(!pvInner||pvInner.indexOf('Clique em')>=0){alert('Gere o preview primeiro.');return null}

  // Usa o conteúdo do pvWrap diretamente (scroll contínuo, sem pv-page)
  var clonedPages = '<div style="max-width:794px;margin:0 auto">'+pvInner+'</div>';

  var wordCss = `
  @page {
    size: A4;
    margin-top: 3.25cm;
    margin-bottom: 3.25cm;
    margin-left: 2.5cm;
    margin-right: 2.5cm;
    mso-header-margin: 1.25cm;
    mso-footer-margin: 1.25cm;
  }
  body{
    font-family: Calibri, Arial, sans-serif;
    font-size: 11pt;
    text-align: left;
    color:#000;
  }
  .pv-page{
    width:auto !important;
    min-height:auto !important;
    box-shadow:none !important;
    margin:0 auto 0 auto !important;
    padding:0 !important;
    background:#fff !important;
    page-break-after:always;
    break-after:page;
  }
  .pv-page:last-child{page-break-after:auto; break-after:auto;}
  .pv-page-bg{display:none !important;}
  .pv-page-content{position:relative !important; z-index:1 !important; overflow:visible !important;}
  .pv-footer{display:none !important;}

  body, p, div, span, td, th, li, .pp-p, .pp-id td{
    font-family: Calibri, Arial, sans-serif !important;
    font-size: 11pt !important;
    text-align: left !important;
    color:#000 !important;
  }

  .ph1, .ph2, .ph3, h1.ph1, h2.ph2, h3.ph3{
    font-family: Calibri, Arial, sans-serif !important;
    font-size: 14pt !important;
    font-weight: 700 !important;
    text-align:left !important;
    color:#000 !important;
    border: none !important;
    margin: 10pt 0 6pt 0 !important;
    text-transform: none !important;
    page-break-after: avoid;
  }
  h1.ph1{mso-outline-level:1;}
  h2.ph2{mso-outline-level:2;}
  h3.ph3{mso-outline-level:3;}

  .pp-mt{
    font-family: Calibri, Arial, sans-serif !important;
    font-size: 16pt !important;
    font-weight: 700 !important;
    text-transform: uppercase !important;
    text-align:center !important;
    color:#000 !important;
  }

  .pp-st{
    font-family: Calibri, Arial, sans-serif !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
    text-align:center !important;
    color:#000 !important;
  }

  .pp-dl{
    font-family: Calibri, Arial, sans-serif !important;
    font-size: 12pt !important;
    font-weight: 700 !important;
    text-align:center !important;
    color:#444 !important;
  }

  .pp-p{
    margin:0 0 6pt 0 !important;
    line-height:1.5 !important;
    font-style: normal !important;
  }

  .pp-tb,.pp-toc{
    width:100%;
    border-collapse:collapse;
    margin:7px 0;
    font-size:11pt !important;
  }
  .pp-tb th,.pp-tb td,.pp-toc td{
    border:1px solid #999;
    padding:4px 7px;
    text-align:left;
    vertical-align:top;
  }
  .pp-tb th{
    background:#f2f2f2;
    font-weight:700;
    color:#000;
  }
  .pp-tb .tr{
    background:#d9d9d9;
    color:#000;
    font-weight:700;
  }
  .pp-toc td{border-left:none;border-right:none;}

  .pp-id{
    border:1px solid #999;
    background:#fff;
    padding:6px 9px;
    margin:9px 0;
    border-radius:0;
  }
  .pp-id table{width:100%;border-collapse:collapse;}
  .pp-id td{padding:2px 5px;vertical-align:top;border:none;}
  .pp-id .lbl{
    font-weight:700 !important;
    width:112px;
    white-space:nowrap;
  }

  .pp-sg{
    margin-top:18px;
    text-align:center;
    border-top:1px solid #999;
    padding-top:10px;
  }
  .pp-hr{border:none;border-top:1px solid #999;margin:6px 0;}
  .ph1,.ph2,.ph3,.pp-tb,.pp-id,.pp-sg-wrap,.pp-valor-wrap{
    page-break-inside:avoid;
    break-inside:avoid;
  }
  `;
  var officeHead = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:w="urn:schemas-microsoft-com:office:word"
        xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta charset="utf-8">
    <meta name="ProgId" content="Word.Document">
    <meta name="Generator" content="Microsoft Word 15">
    <meta name="Originator" content="Microsoft Word 15">
    <title>Proposta Tecfusion</title>
    <style>${wordCss}</style>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
    </xml>
    <![endif]-->
  </head><body>`;
  return '<!DOCTYPE html>' + officeHead + clonedPages + '</body></html>';
}

function expWordDoc(){
  // Check docx library available
  if(typeof docx === 'undefined'){
    toast('Biblioteca docx.js não carregou. Verifique sua conexão.','err');
    return;
  }

  // Collect proposal data
  var num   = (Q('pNum').value||'proposta').trim();
  var tit   = (Q('pTit').value||'').trim();
  var cli   = (Q('pCli').value||'').trim();
  var cnpj  = (Q('pCnpj').value||'').trim();
  var cid   = (Q('pCid').value||'').trim();
  var ac    = (Q('pAC').value||'').trim();
  var dep   = (Q('pDep').value||'').trim();
  var mail  = (Q('pMail').value||'').trim();
  var tel   = (Q('pTel').value||'').trim();
  var loc    = (Q('pLoc').value||'').trim();
  var locCnpj= (Q('pLocCnpj')&&Q('pLocCnpj').value||'').trim();
  var csvc   = (Q('pCsv').value||'').trim();
  var area   = (Q('pArea')&&Q('pArea').value||'').trim();
  var equip  = (Q('pEquip')&&Q('pEquip').value||'').trim();
  var ac2    = (Q('pAC2')&&Q('pAC2').value||'').trim();
  var dep2   = (Q('pDep2')&&Q('pDep2').value||'').trim();
  var mail2  = (Q('pMail2')&&Q('pMail2').value||'').trim();
  var tel2   = (Q('pTel2')&&Q('pTel2').value||'').trim();
  var tensValW = (Q('pTensVal')&&Q('pTensVal').value||'').trim();
  var tensCmdW = (Q('pTensCmd')&&Q('pTensCmd').value||'').trim();
  var tensSel2=['pT1F','pT2F','pT3F','pTN','pTPE'].filter(function(id){return Q(id)&&Q(id).checked;});
  var tensLbls2={'pT1F':'1F','pT2F':'2F','pT3F':'3F','pTN':'N','pTPE':'PE'};
  var tensFases2=tensSel2.map(function(id){return tensLbls2[id];}).join(' + ');
  var tensStr2=(tensValW&&tensFases2)?tensValW+' — '+tensFases2:(tensValW||tensFases2);
  var tensCmdStr2=tensCmdW;
  var res   = (Q('pRes').value||'').trim();
  var dv    = Q('pDat').value;
  var df    = dv ? new Date(dv+'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  var vs    = n2(Q('vS').value), vm=n2(Q('vM').value);
  var dS    = n2(Q('vDSval')&&Q('vDSval').value)||0;
  var dM    = n2(Q('vDMval')&&Q('vDMval').value)||0;
  var vd    = dS+dM;
  var liqS  = Math.max(0,vs-dS), liqM=Math.max(0,vm-dM);
  var vtot  = liqS+liqM;
  var _p    = props.find(function(x){return x.id===editId})||{};
  // Use budg (sorted by _budgGrupos) if available; otherwise use saved items
  var _budgAllRaw = budg.length ? budg : (_p.bi||[]);
  // Apply same sort as the table when using saved items
  var _budgAll = _budgAllRaw;
  if(!budg.length && _budgGrupos && _budgGrupos.length){
    _budgAll = _budgAllRaw.slice().sort(function(a,b){
      for(var _gi=0;_gi<_budgGrupos.length;_gi++){
        var _gk=_budgGrupos[_gi];
        var _va=_getGrupoVal(a,_gk), _vb=_getGrupoVal(b,_gk);
        var _gc=_va.localeCompare(_vb); if(_gc!==0) return _gc;
      }
      return 0;
    });
  }
  // Recalcula vs/vm a partir do orçamento se não carregados
  if(!vs && !vm){
    _budgAll.forEach(function(it){
      if(it.inc===false) return;
      if(it.t==='material') vm+=n2(it.pvt); else vs+=n2(it.pvt);
    });
    liqS=Math.max(0,vs-dS); liqM=Math.max(0,vm-dM); vtot=liqS+liqM;
  }
  var _escPrev = escSecs.length ? escSecs : (_p.esc||[]);
  var _revs = revs.length ? revs : (_p.revs||[]);

  var nomeArq = (num+(tit?' - '+tit:'')).replace(/[/:*?"<>|\\]+/g,' ').replace(/\s+/g,' ').trim();

  var D = docx;

  // ── helpers ──
  var GREEN = '154a15';
  var GRAY  = '555555';
  var BLACK = '000000';

  function run(text, opts){
    opts = opts||{};
    return new D.TextRun({
      text: String(text||''),
      font: 'Calibri',
      size: opts.size || 22,        // half-points: 22 = 11pt
      bold: opts.bold||false,
      color: opts.color||BLACK,
      italics: false
    });
  }

  function para(children, opts){
    opts = opts||{};
    return new D.Paragraph({
      children: Array.isArray(children) ? children : [children],
      alignment: opts.align || D.AlignmentType.LEFT,
      spacing: { before: opts.before||0, after: opts.after||60, line: opts.line||276 },
      indent: opts.indent ? {left: opts.indent} : undefined
    });
  }

  function heading1(text){
    return new D.Paragraph({
      children: [new D.TextRun({text:text, font:'Calibri', size:24, bold:true, color:GREEN, allCaps:true, italics:false})],
      border: { bottom: { style: D.BorderStyle.SINGLE, size:6, color:GREEN, space:2 } },
      spacing: { before:200, after:120, line:276 },
      heading: D.HeadingLevel.HEADING_1
    });
  }

  function heading2(text){
    return new D.Paragraph({
      children: [new D.TextRun({text:text, font:'Calibri', size:22, bold:true, color:GREEN, italics:false})],
      spacing: { before:160, after:80, line:276 },
      heading: D.HeadingLevel.HEADING_2
    });
  }

  function heading3(text){
    return new D.Paragraph({
      children: [new D.TextRun({text:text, font:'Calibri', size:22, bold:true, color:'333333', italics:false})],
      spacing: { before:120, after:60, line:276 },
      heading: D.HeadingLevel.HEADING_3
    });
  }

  function hr(){
    return new D.Paragraph({
      children: [],
      border: { bottom: { style: D.BorderStyle.SINGLE, size:4, color:'c8d8c8', space:1 } },
      spacing: { before:60, after:60 }
    });
  }

  function pageBreak(){
    return new D.Paragraph({
      children: [new D.PageBreak()],
      spacing: { before:0, after:0 }
    });
  }

  // ── Build content ──
  var children = [];

  // Client info table
  var border1 = { style: D.BorderStyle.SINGLE, size:4, color:'b0c8b0' };
  var borders1 = { top:border1, bottom:border1, left:border1, right:border1 };
  var cellM = { top:80, bottom:80, left:120, right:120 };
  var W = 9026; // A4 content width DXA
  var colLbl = 1600, colVal = 2913; // 2 pairs side by side

  function iCell(text, bold){
    return new D.TableCell({
      borders: borders1,
      width: { size: bold ? colLbl : colVal, type: D.WidthType.DXA },
      margins: cellM,
      shading: bold ? { fill:'ddeedd', type:D.ShadingType.CLEAR } : { fill:'FFFFFF', type:D.ShadingType.CLEAR },
      children: [new D.Paragraph({
        children: [run(text||'-', {size:20, bold:bold||false, color: bold ? GREEN : BLACK})],
        spacing: { before:0, after:0 }
      })]
    });
  }

  // helper: célula colspan 3
  function iCell3(txt){
    return new D.TableCell({ borders:borders1, width:{size:colVal+colLbl+colVal,type:D.WidthType.DXA}, margins:cellM, columnSpan:3, shading:{fill:'FFFFFF',type:D.ShadingType.CLEAR},
      children:[new D.Paragraph({children:[run(txt||'-',{size:20})],spacing:{before:0,after:0}})] });
  }
  var idRows = [
    new D.TableRow({ children:[iCell('Nome do Cliente:', true), iCell(cli), iCell('CNPJ Cliente:', true), iCell(cnpj)] }),
    new D.TableRow({ children:[iCell('Cidade do Cliente:', true), iCell(cid), iCell('Nome Contato 1:', true), iCell(ac)] }),
    new D.TableRow({ children:[iCell('Depto. Contato 1:', true), iCell(dep), iCell('E-mail Contato 1:', true), iCell(mail)] }),
    new D.TableRow({ children:[iCell('Tel/Cel Contato 1:', true), iCell(tel), iCell(ac2?'Nome Contato 2:':'', ac2?true:false), iCell(ac2||'')] }),
  ];
  if(ac2){
    idRows.push(new D.TableRow({ children:[iCell('Depto. Contato 2:', true), iCell(dep2), iCell('E-mail Contato 2:', true), iCell(mail2)] }));
    if(tel2) idRows.push(new D.TableRow({ children:[iCell('Tel/Cel Contato 2:', true), iCell3(tel2)] }));
  }
  idRows.push(new D.TableRow({ children:[iCell('Cliente do Serviço:', true), iCell(loc), iCell('CNPJ do Local:', true), iCell(locCnpj||'-')] }));
  idRows.push(new D.TableRow({ children:[iCell('Cidade do Serviço:', true), iCell(csvc), iCell(area?'Área/Local:':'', area?true:false), iCell(area||'')] }));
  if(equip) idRows.push(new D.TableRow({ children:[iCell('Equipamento:', true), iCell3(equip)] }));
  if(tensStr2||tensCmdStr2) idRows.push(new D.TableRow({ children:[iCell('Tensão Principal:', true), iCell(tensStr2||'-'), iCell('Tensão Comando:', true), iCell(tensCmdStr2||'-')] }));
  children.push(new D.Table({
    width: { size:W, type:D.WidthType.DXA },
    columnWidths: [colLbl, colVal, colLbl, colVal],
    rows: idRows
  }));

  children.push(para([], {after:120}));
  children.push(hr());

  // Cover title block (abaixo da tabela)
  children.push(new D.Paragraph({
    children: [run('PROPOSTA TECNICA E COMERCIAL', {size:32, bold:true, color:GREEN})],
    alignment: D.AlignmentType.CENTER,
    spacing: { before:200, after:80, line:276 }
  }));
  if(tit) children.push(new D.Paragraph({
    children: [run(tit, {size:24, bold:true})],
    alignment: D.AlignmentType.CENTER,
    spacing: { before:0, after:60, line:276 }
  }));
  children.push(new D.Paragraph({
    children: [run('N '+num+' | '+csvc+', '+df, {size:24, bold:true, color:'444444'})],
    alignment: D.AlignmentType.CENTER,
    spacing: { before:0, after:200, line:276 }
  }));
  children.push(hr());

  // Greeting
  children.push(para([run('Prezado(a) Sr(a). ', {size:22}), run(ac||'[Contato]', {size:22, bold:true}), run(',', {size:22})], {after:80}));
  children.push(para([run('Atendendo as suas solicitações, temos o prazer de apresentar nossa ', {size:22}), run('Proposta Técnica Comercial', {size:22, bold:true}), run(' para:', {size:22})], {after:80}));
  if(res) children.push(para([run(res, {size:22})], {indent:360, after:80}));
  children.push(para([run('O serviço será realizado na planta ', {size:22}), run(loc||'[local]', {size:22, bold:true}), run(', na cidade de ', {size:22}), run(csvc||'[cidade]', {size:22, bold:true}), run('.', {size:22})], {after:80}));
  children.push(para([run('Colocamo-nos à disposição para quaisquer informações adicionais.', {size:22})], {after:160}));
  children.push(para([run('Atenciosamente,', {size:22})], {after:160}));
  children.push(para([run('Eng. Elivandro J. Nascimento', {size:22, bold:true})], {after:20}));
  children.push(para([run('Engenheiro Eletricista | CREA SP: 5071802874', {size:18, color:GRAY})], {after:20}));
  children.push(para([run('Cel: +55 11 9.3937-6292 | +55 11 9.9929-9211', {size:18, color:GRAY})], {after:20}));
  children.push(para([run('e-mail: elivandro@tecfusion.com.br', {size:18, color:GRAY})], {after:20}));
  children.push(para([run('Tecfusion Soluções Elétricas Industriais.', {size:18, color:GRAY})], {after:20}));
  children.push(para([run('CNPJ: 23.624.491/0001-47', {size:18, color:GRAY})], {after:200}));

  // Lista de Revisões — movida para após último item do escopo (ver abaixo)
  if(false && _revs && _revs.length){
    children.push(new D.Paragraph({ children:[], spacing:{before:0,after:0}, pageBreakBefore: false }));
    children.push(para([run('Lista de Revisões', {size:20, bold:true, color:GREEN})], {before:120, after:60}));
    var rBorder = { style: D.BorderStyle.SINGLE, size:4, color:'b0b8b0' };
    var rBorders = { top:rBorder, bottom:rBorder, left:rBorder, right:rBorder };
    var rM = { top:60, bottom:60, left:100, right:100 };
    var W5 = Math.floor(W/5);
    var rRows = [
      new D.TableRow({ children:[
        new D.TableCell({ borders:rBorders, margins:rM, width:{size:W5*0.6|0,type:D.WidthType.DXA}, shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[run('Rev.',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders, margins:rM, width:{size:W5,type:D.WidthType.DXA}, shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[run('Data',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders, margins:rM, width:{size:W5*0.7|0,type:D.WidthType.DXA}, shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[run('Por',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders, margins:rM, width:{size:W-(W5*0.6|0)-W5-(W5*0.7|0),type:D.WidthType.DXA}, shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[run('Descrição',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
      ]})
    ];
    _revs.forEach(function(r){
      rRows.push(new D.TableRow({ children:[
        new D.TableCell({ borders:rBorders, margins:rM, width:{size:W5*0.6|0,type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(r.rev||'',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders, margins:rM, width:{size:W5,type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(r.dat||'',{size:18})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders, margins:rM, width:{size:W5*0.7|0,type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(r.por||'',{size:18})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders, margins:rM, width:{size:W-(W5*0.6|0)-W5-(W5*0.7|0),type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(r.desc||'',{size:18})],spacing:{before:0,after:0}})] }),
      ]}));
    });
    children.push(new D.Table({ width:{size:W,type:D.WidthType.DXA}, columnWidths:[W5*0.6|0, W5, W5*0.7|0, W-(W5*0.6|0)-W5-(W5*0.7|0)], rows:rRows }));
    children.push(para([], {after:80}));
  }

  // ── Função auxiliar: tabela de valor ──
  function buildValorTable(secNum, secTitulo){
    children.push(heading1(secNum+(secTitulo||'VALOR')));
    var vBorder  = { style: D.BorderStyle.SINGLE, size:4, color:'999999' };
    var vBorders = { top:vBorder, bottom:vBorder, left:vBorder, right:vBorder };
    var W_NR  = 400;   // coluna #
    var W_VAL = 2800;  // coluna valor
    var W_DES = W - W_NR - W_VAL; // coluna descrição

    // ── Cabeçalho ──
    var rows = [new D.TableRow({ children:[
      new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_NR,type:D.WidthType.DXA},
        shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
        children:[new D.Paragraph({children:[run('#',{size:18,bold:true,color:GREEN})],alignment:D.AlignmentType.CENTER,spacing:{before:0,after:0}})] }),
      new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_DES,type:D.WidthType.DXA},
        shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
        children:[new D.Paragraph({children:[run('Descrição',{size:20,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
      new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_VAL,type:D.WidthType.DXA},
        shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
        children:[new D.Paragraph({children:[run('Valor',{size:20,bold:true,color:GREEN})],alignment:D.AlignmentType.RIGHT,spacing:{before:0,after:0}})] })
    ]})];

    // ── Itens detalhados com agrupamento multi-nível (igual à tela) ──
    var itensDet2=_budgAll.filter(function(it){ return it.inc!==false && it.det!==false; });
    var activeGrupos2=(_budgGrupos&&_budgGrupos.length)?_budgGrupos:(_budgSortAtivo?[_budgSortAtivo]:[]);

    function _getGrupoVal2(it,key){
      if(key==='tipo') return it.t==='material'?'Material':'Serviço';
      if(key==='cat')  return it.cat||'';
      if(key==='desc') return (it.desc||it.cat||'');
      return (it[key]||'').trim();
    }
    function _getGrupoLbl2(key,val,itensGrupo){
      // Sem emojis no DOCX (causa e.slice error em algumas versões da lib)
      if(key==='equip')    return '= '+String(val||'');
      if(key==='inst')     return '+ '+String(val||'');
      if(key==='tipoTrab') return 'Trabalho: '+String(val||'');
      if(key==='faseTrab') return 'Fase: '+String(val||'');
      if(key==='tipo')     return String(val||'');
      if(key==='cat'){
        var _cfgDx=getPrcAtual();
        var _fi=itensGrupo&&itensGrupo[0];
        var _co=_fi?(_fi.t==='material'?(_cfgDx.m&&_cfgDx.m[val]):(_cfgDx.s&&_cfgDx.s[val])):null;
        var _nm=(_co&&_co.n)?(' - '+String(_co.n)):'';
        var _descRaw=(_co&&_co.desc)?String(_co.desc):'';
        var _dc=_descRaw?_descRaw.split(';').map(function(s){return s.trim();}).filter(Boolean).map(function(s){return '- '+s;}).join(' | '):'';
        return String(String(val||'')+_nm+(_dc?' | '+_dc:''));
      }
      return String(val||'');
    }
    function _addWordGrupoHeader(gLabel, gitens2, nivel){
      var subtotal2=gitens2.reduce(function(s,it){return s+n2(it.pvt);},0);
      var gBorder={style:D.BorderStyle.SINGLE,size:4,color:'c8dfc8'};
      var fillColor=nivel===0?'e8f4e8':nivel===1?'f0faf0':'f7fdf7';
      rows.push(new D.TableRow({ children:[
        new D.TableCell({ borders:{top:gBorder,bottom:gBorder,left:{style:D.BorderStyle.NONE,size:0,color:'ffffff'},right:{style:D.BorderStyle.NONE,size:0,color:'ffffff'}},
          margins:{top:cellM.top,bottom:cellM.bottom,left:cellM.left+(nivel*120),right:cellM.right},
          width:{size:W,type:D.WidthType.DXA}, columnSpan:3,
          shading:{fill:fillColor,type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[
            run(gLabel,{size:nivel===0?18:16,bold:true,color:GREEN}),
            run('  ('+gitens2.length+' item(ns) | '+money(subtotal2)+')',{size:15,color:'555555'})
          ],spacing:{before:0,after:0}})]
        })
      ]}));
    }
    function _addWordGrupoRec(itens, keys, nivel){
      if(!keys.length || !itens.length){ itens.forEach(function(it){ nr++; _addWordItemRow(it,nr); }); return; }
      var key=keys[0], rest=keys.slice(1);
      var grupos={}, ordem=[];
      itens.forEach(function(it){
        var v=_getGrupoVal2(it,key)||'(sem '+key+')';
        if(!grupos[v]){ grupos[v]=[]; ordem.push(v); }
        grupos[v].push(it);
      });
      ordem.forEach(function(gVal){
        _addWordGrupoHeader(_getGrupoLbl2(key,gVal,grupos[gVal]), grupos[gVal], nivel);
        _addWordGrupoRec(grupos[gVal], rest, nivel+1);
      });
    }

    function _addWordItemRow(it, nrRef){
      var tipo2 = it.t==='material'?'Mat':'Svc';
      var un12=it.un1||'', un22=it.un2||'';
      var ql2;
      if(it.t==='material'){
        ql2=it.mult+(un12?' '+un12:'');
      } else {
        var _gt2=it.tec||1,_gd2=it.dias||1,_gh2=it.hpd||1;
        var _gp2=[];
        if(_gt2>1) _gp2.push(_gt2+' Tec.');
        _gp2.push(_gd2+(un12?' '+un12:''));
        if(_gh2!==1||un22) _gp2.push(_gh2+(un22?' '+un22:''));
        ql2=_gp2.join(' × ');
        if(it.mult!==_gd2) ql2+=' = '+it.mult.toFixed(0)+'h';
      }
      var subL2a2=['['+tipo2+'] '+it.cat];
      if(it.equip) subL2a2.push('⊜ '+it.equip);
      if(it.inst)  subL2a2.push('⊕ '+it.inst);
      if(it.tipoTrab) subL2a2.push('🔧 '+it.tipoTrab);
      if(it.faseTrab) subL2a2.push('📋 '+it.faseTrab);
      subL2a2.push('Qtd: '+ql2); subL2a2.push('PV Unit.: '+money(it.pvu));
      if(it.terc) subL2a2.push('●Terc');
      var subLine2a=subL2a2.join(' | ');
      var subLine3a='';
      rows.push(new D.TableRow({ children:[
        new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_NR,type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(String(nrRef),{size:18,color:'555555'})],alignment:D.AlignmentType.CENTER,spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_DES,type:D.WidthType.DXA},
          children:[
            new D.Paragraph({children:[run(it.desc||it.cat||'',{size:22,bold:true})],spacing:{before:0,after:20}}),
            new D.Paragraph({children:[run(subLine2a,{size:16,color:'555555'})],spacing:{before:0,after:0}})
          ]}),
        new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_VAL,type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(money(it.pvt),{size:20,bold:true})],alignment:D.AlignmentType.RIGHT,spacing:{before:0,after:0}})] })
      ]}));
    }

    var nr = 0;
    var hasDetRows = itensDet2.length > 0;

    // Usa agrupamento multi-nível igual à tela
    if(activeGrupos2.length){
      _addWordGrupoRec(itensDet2, activeGrupos2, 0);
    } else {
      itensDet2.forEach(function(it){ nr++; _addWordItemRow(it,nr); });
    }

    // ── Linha separadora se tiver itens detalhados ──
    if(hasDetRows){
      var sepBorder = { style: D.BorderStyle.SINGLE, size:4, color:'c8dfc8' };
      rows.push(new D.TableRow({ children:[
        new D.TableCell({ borders:{top:{style:D.BorderStyle.NONE,size:0,color:'ffffff'},bottom:sepBorder,left:{style:D.BorderStyle.NONE,size:0,color:'ffffff'},right:{style:D.BorderStyle.NONE,size:0,color:'ffffff'}}, margins:cellM, width:{size:W,type:D.WidthType.DXA}, columnSpan:3,
          children:[new D.Paragraph({children:[],spacing:{before:0,after:0}})] })
      ]}));
    }

    // ── Subtotais (Serviços / Materiais / Descontos / Total) ──
    function addSubRow(label, value, bold, bgColor){
      rows.push(new D.TableRow({ children:[
        new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_NR,type:D.WidthType.DXA},
          shading:bgColor?{fill:bgColor,type:D.ShadingType.CLEAR}:undefined,
          children:[new D.Paragraph({children:[],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_DES,type:D.WidthType.DXA},
          shading:bgColor?{fill:bgColor,type:D.ShadingType.CLEAR}:undefined,
          children:[new D.Paragraph({children:[run(label,{size:20,bold:bold,color:bgColor?'FFFFFF':BLACK})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:vBorders, margins:cellM, width:{size:W_VAL,type:D.WidthType.DXA},
          shading:bgColor?{fill:bgColor,type:D.ShadingType.CLEAR}:undefined,
          children:[new D.Paragraph({children:[run(value,{size:20,bold:bold,color:bgColor?'FFFFFF':BLACK})],alignment:D.AlignmentType.RIGHT,spacing:{before:0,after:0}})] })
      ]}));
    }

    if(vs>0)  addSubRow(hasDetRows?'Soma dos Serviços':'Serviços', money(vs), false);
    if(dS>0)  addSubRow('Desconto Serviços', '- '+money(dS), false);
    if(dS>0)  addSubRow('Serviços líquidos', money(liqS), false);
    if(vm>0)  addSubRow(hasDetRows?'Soma dos Materiais':'Materiais', money(vm), false);
    if(dM>0)  addSubRow('Desconto Materiais', '- '+money(dM), false);
    if(dM>0)  addSubRow('Materiais líquidos', money(liqM), false);
    if(vd>0)  addSubRow('Desconto total', '- '+money(vd), false);
    addSubRow('TOTAL GERAL', money(vtot), true, '154a15');

    children.push(new D.Table({ width:{size:W,type:D.WidthType.DXA}, columnWidths:[W_NR,W_DES,W_VAL], rows:rows }));
  }

  // ── Índice / Sumário (Word) ──
  (function(){
    var tocEntries = [];
    var si2 = 1;
    var temValorEsc2 = false;
    _escPrev.forEach(function(sec){
      if(!sec) return;
      var secNum = sec.num ? sec.num : String(si2);
      var isValor = isValorSec(sec);
      if(isValor) temValorEsc2 = true;
      var titulo = isValor ? (sec.titulo||'VALOR') : (sec.titulo||'');
      if(!titulo && !isValor){ si2++; return; }
      if(!titulo){ si2++; return; }
      tocEntries.push({num: secNum, titulo: titulo, level: 0});
      (sec.subs||[]).forEach(function(sub, subi){
        var subNum = (sub.num||'').trim() || (secNum+'.'+(subi+1));
        tocEntries.push({num: subNum, titulo: sub.nome||sub.titulo||'', level: 1});
      });
      si2++;
    });
    if((vtot>0) && !temValorEsc2){
      tocEntries.push({num: String(si2), titulo: 'VALOR', level: 0});
    }

    if(!tocEntries.length) return;

    children.push(pageBreak());
    // Título do índice
    children.push(new D.Paragraph({
      children: [new D.TextRun({text:'ÍNDICE', font:'Calibri', size:24, bold:true, color:GREEN, allCaps:true, italics:false})],
      border: { bottom: { style: D.BorderStyle.SINGLE, size:6, color:GREEN, space:2 } },
      spacing: { before:0, after:120, line:276 }
    }));

    var tBorder = { style: D.BorderStyle.NONE, size:0, color:'ffffff' };
    var tBorders = { top:tBorder, bottom:tBorder, left:tBorder, right:tBorder };
    var W_TOC = 8748; // largura útil em DXA (~15.5cm)
    var W_NUM = 500;
    var W_TIT = W_TOC - W_NUM;

    var tocRows = tocEntries.map(function(e){
      var indent = e.level === 1 ? 360 : 0;
      var fsize  = e.level === 1 ? 18 : 20;
      var fbold  = e.level === 0;
      var fcolor = e.level === 0 ? GREEN : '333333';
      return new D.TableRow({ children:[
        new D.TableCell({
          borders: tBorders,
          width: {size: W_NUM, type: D.WidthType.DXA},
          margins: {top:30, bottom:30, left:0, right:80},
          children: [new D.Paragraph({
            children: [new D.TextRun({text: e.num, font:'Calibri', size: fsize, bold:true, color:GREEN, italics:false})],
            spacing: {before:0, after:40, line:240}
          })]
        }),
        new D.TableCell({
          borders: tBorders,
          width: {size: W_TIT, type: D.WidthType.DXA},
          margins: {top:30, bottom:30, left:0, right:0},
          children: [new D.Paragraph({
            children: [new D.TextRun({text: e.titulo, font:'Calibri', size: fsize, bold:fbold, color:fcolor, italics:false})],
            indent: indent ? {left: indent} : undefined,
            spacing: {before:0, after:40, line:240},
            border: { bottom: { style: D.BorderStyle.DOTTED, size:2, color:'cccccc', space:1 } }
          })]
        })
      ]});
    });

    children.push(new D.Table({
      width: {size: W_TOC, type: D.WidthType.DXA},
      columnWidths: [W_NUM, W_TIT],
      rows: tocRows,
      borders: {
        top: tBorder, bottom: tBorder, left: tBorder, right: tBorder,
        insideH: tBorder, insideV: tBorder
      }
    }));
    children.push(para([], {after:80}));
  })();


  // Sections from escopo — respeitando a ordem e posição da seção VALOR
  var valorRendered = false;
  if(_escPrev && _escPrev.length){
    children.push(pageBreak());
    _escPrev.forEach(function(sec, si){
      if(!sec) return;
      var secNum = sec.num ? (sec.num+'. ') : ((si+1)+'. ');

      // Seção de VALOR — renderiza tabela na posição correta
      if(isValorSec(sec)){
        if(vtot > 0){
          buildValorTable(secNum, sec.titulo||'VALOR');
          valorRendered = true;
        }
        return;
      }

      // H1 = número + título da seção
      children.push(heading1(secNum+(sec.titulo||'')));

      // Conteúdo principal da seção (sec.desc) = texto normal, NÃO negrito
      if(sec.desc && !(sec.subs && sec.subs.length)){
        sec.desc.split('\n').forEach(function(line){
          if(line.trim()) children.push(para([run(line, {size:22})], {after:60}));
        });
      }

      // FIX V359: Gantt na seção PRAZO — gera tabela Word
      if(isPrazo(sec)){
        var _pGantt=props.find(function(x){return x.id===editId;})||{};
        var _g=_pGantt.gantt||{inicio:'',fases:[],trabSab:false,trabDom:false,feriados:[]};
        var _gFases=_g.fases||[];
        if(_gFases.length){
          var _gInicio=_g.inicio?new Date(_g.inicio+'T12:00:00'):null;
          function _gFmt(d){return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});}

          // Calcular datas reais usando dias úteis (mesma lógica do preview)
          var _gDatas=_gFases.map(function(f){
            if(!_gInicio) return null;
            var dtIni=faseInicio(_gInicio,f.offset||0,_g);
            var dtFim=faseFim(dtIni,f.dur||1,_g);
            return {dtIni:dtIni,dtFim:dtFim};
          });
          var _gFimMax=_gInicio?new Date(_gInicio):null;
          if(_gInicio) _gDatas.forEach(function(d){if(d&&d.dtFim>_gFimMax)_gFimMax=d.dtFim;});
          var _gTotalCorr=_gInicio&&_gFimMax?Math.max(1,diasCorridosEntre(_gInicio,_gFimMax)+1):1;

          // Linha de cabeçalho
          var _legIni=_gInicio&&_gFimMax
            ?('Início: '+_gFmt(_gInicio)+' | Término: '+_gFmt(_gFimMax)+' | Total: '+_gTotalCorr+' dias corridos')
            :'Cronograma — configure data de início para ver as datas';
          children.push(para([run(_legIni,{size:18,color:'555555'})],{after:80}));

          // Tabela do Gantt — 3 colunas: Nome | Barra (texto) | Datas
          var _W=8748;
          var _W1=1800;
          var _W2=5500;
          var _W3=_W-_W1-_W2;
          var _tBrd={style:D.BorderStyle.NONE,size:0,color:'ffffff'};
          var _tBrds={top:_tBrd,bottom:_tBrd,left:_tBrd,right:_tBrd};

          var _gRows=_gFases.map(function(f,_fi){
            var _off=f.offset||0;
            var _dur=f.dur||1;
            var _cor=(f.cor||'#2563eb').replace('#','');
            var _fd=_gDatas[_fi];
            var _dtIni=_fd?_gFmt(_fd.dtIni):('D+'+_off);
            var _dtFim=_fd?_gFmt(_fd.dtFim):('D+'+(_off+_dur-1));
            // Posição da barra em dias corridos
            var _offCorr=_fd&&_gInicio?diasCorridosEntre(_gInicio,_fd.dtIni):_off;
            var _durCorr=_fd?Math.max(1,diasCorridosEntre(_fd.dtIni,_fd.dtFim)+1):_dur;
            // Barra: blocos antes + blocos cheios + blocos depois (em dias corridos)
            var _barTotal=40;
            var _startChar=Math.round(_offCorr/_gTotalCorr*_barTotal);
            var _durChar=Math.max(1,Math.round(_durCorr/_gTotalCorr*_barTotal));
            var _endChar=_barTotal-_startChar-_durChar;
            var _barStr=(' '.repeat(Math.max(0,_startChar)))+'█'.repeat(_durChar)+(' '.repeat(Math.max(0,_endChar)));

            return new D.TableRow({children:[
              new D.TableCell({
                borders:_tBrds,
                width:{size:_W1,type:D.WidthType.DXA},
                margins:{top:40,bottom:40,left:0,right:80},
                children:[new D.Paragraph({
                  children:[new D.TextRun({text:f.nome||'',font:'Calibri',size:18,bold:true,color:'333333',italics:false})],
                  spacing:{before:0,after:30,line:240}
                })]
              }),
              new D.TableCell({
                borders:_tBrds,
                shading:{fill:'f3f4f6'},
                width:{size:_W2,type:D.WidthType.DXA},
                margins:{top:40,bottom:40,left:40,right:40},
                children:[new D.Paragraph({
                  children:[new D.TextRun({text:_barStr,font:'Courier New',size:14,bold:false,color:_cor,italics:false})],
                  spacing:{before:0,after:30,line:240}
                })]
              }),
              new D.TableCell({
                borders:_tBrds,
                width:{size:_W3,type:D.WidthType.DXA},
                margins:{top:40,bottom:40,left:60,right:0},
                children:[new D.Paragraph({
                  children:[
                    new D.TextRun({text:(_dur)+'d',font:'Calibri',size:16,bold:true,color:'333333',italics:false}),
                    new D.TextRun({text:'  '+_dtIni+' – '+_dtFim,font:'Calibri',size:14,bold:false,color:'777777',italics:false})
                  ],
                  spacing:{before:0,after:30,line:240}
                })]
              })
            ]});
          });

          children.push(new D.Table({
            width:{size:_W,type:D.WidthType.DXA},
            columnWidths:[_W1,_W2,_W3],
            rows:_gRows,
            borders:{top:_tBrd,bottom:_tBrd,left:_tBrd,right:_tBrd,insideH:_tBrd,insideV:_tBrd}
          }));
          children.push(para([],{after:80}));
        }
      }

      // Sub-itens: nome vira H2, desc vira texto normal
      if(sec.subs && sec.subs.length){
        sec.subs.forEach(function(s, subi){
          if(!s) return;
          var subNum = (s.ordem!=null ? s.ordem : (subi+1));
          var subLabel = secNum + subNum + '. ';
          children.push(heading2(subLabel+(s.nome||s.titulo||'')));
          if(s.desc){
            s.desc.split('\n').forEach(function(line){
              if(line.trim()) children.push(para([run(line, {size:22})], {after:60}));
            });
          }
        });
      }
    });
  }

  // Valor de fallback — só adiciona no final se não existia seção VALOR no escopo
  if(vtot > 0 && !valorRendered){
    children.push(pageBreak());
    buildValorTable('', 'VALOR DA PROPOSTA');
  }

  // ── Lista de Revisões após último item do escopo ──
  if(_revs && _revs.length){
    children.push(para([], {after:80}));
    children.push(para([run('Lista de Revisões', {size:20, bold:true, color:GREEN})], {before:120, after:60}));
    var rBorder2 = { style: D.BorderStyle.SINGLE, size:4, color:'b0b8b0' };
    var rBorders2 = { top:rBorder2, bottom:rBorder2, left:rBorder2, right:rBorder2 };
    var rM2 = { top:60, bottom:60, left:100, right:100 };
    var W52 = Math.floor(W/5);
    var rRows2 = [
      new D.TableRow({ children:[
        new D.TableCell({ borders:rBorders2, margins:rM2, width:{size:W52*0.6|0,type:D.WidthType.DXA}, shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[run('Rev.',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders2, margins:rM2, width:{size:W52,type:D.WidthType.DXA}, shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[run('Data',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders2, margins:rM2, width:{size:W52*0.7|0,type:D.WidthType.DXA}, shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[run('Por',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders2, margins:rM2, width:{size:W-(W52*0.6|0)-W52-(W52*0.7|0),type:D.WidthType.DXA}, shading:{fill:'ddeedd',type:D.ShadingType.CLEAR},
          children:[new D.Paragraph({children:[run('Descrição',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
      ]})
    ];
    _revs.forEach(function(r){
      rRows2.push(new D.TableRow({ children:[
        new D.TableCell({ borders:rBorders2, margins:rM2, width:{size:W52*0.6|0,type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(r.rev||'',{size:18,bold:true,color:GREEN})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders2, margins:rM2, width:{size:W52,type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(r.dat||'',{size:18})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders2, margins:rM2, width:{size:W52*0.7|0,type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(r.por||'',{size:18})],spacing:{before:0,after:0}})] }),
        new D.TableCell({ borders:rBorders2, margins:rM2, width:{size:W-(W52*0.6|0)-W52-(W52*0.7|0),type:D.WidthType.DXA},
          children:[new D.Paragraph({children:[run(r.desc||'',{size:18})],spacing:{before:0,after:0}})] }),
      ]}));
    });
    children.push(new D.Table({ width:{size:W,type:D.WidthType.DXA}, columnWidths:[W52*0.6|0, W52, W52*0.7|0, W-(W52*0.6|0)-W52-(W52*0.7|0)], rows:rRows2 }));
    children.push(para([], {after:80}));
  }

  // ── Assinatura no final ──
  children.push(para([], {after:200}));
  children.push(new D.Paragraph({
    children: [],
    border: { top: { style: D.BorderStyle.SINGLE, size:4, color:'cccccc', space:1 } },
    spacing: { before:0, after:80 }
  }));
  children.push(para([run('Atenciosamente,', {size:22})], {after:160}));
  children.push(para([run('Eng. Elivandro J. Nascimento', {size:22, bold:true})], {after:20}));
  children.push(para([run('Engenheiro Eletricista | CREA SP: 5071802874', {size:18, color:GRAY})], {after:20}));
  children.push(para([run('Cel: +55 11 9.3937-6292 | +55 11 9.9929-9211', {size:18, color:GRAY})], {after:20}));
  children.push(para([run('e-mail: elivandro@tecfusion.com.br', {size:18, color:GRAY})], {after:20}));
  children.push(para([run('Tecfusion Soluções Elétricas Industriais.', {size:18, color:GRAY})], {after:20}));
  children.push(para([run('CNPJ: 23.624.491/0001-47', {size:18, color:GRAY})], {after:0}));

  // ── Rodapé: linha acima + página X de Y (esq) + endereço (dir) via tabela sem bordas ──
  var ftNone = { style: D.BorderStyle.NIL };
  var footer = new D.Footer({
    children: [
      new D.Table({
        width: { size: 100, type: D.WidthType.PERCENTAGE },
        borders: { top: ftNone, bottom: ftNone, left: ftNone, right: ftNone, insideH: ftNone, insideV: ftNone },
        rows: [
          new D.TableRow({
            children: [
              new D.TableCell({
                borders: { top: ftNone, bottom: ftNone, left: ftNone, right: ftNone },
                width: { size: 50, type: D.WidthType.PERCENTAGE },
                margins: { top:0, bottom:0, left:0, right:0 },
                children: [new D.Paragraph({
                  children: [
                    new D.TextRun({ text: 'página ', font:'Calibri', size:16, color:'666666' }),
                    new D.TextRun({ children: [D.PageNumber.CURRENT], font:'Calibri', size:16, color:'666666' }),
                    new D.TextRun({ text: ' de ', font:'Calibri', size:16, color:'666666' }),
                    new D.TextRun({ children: [D.PageNumber.TOTAL_PAGES], font:'Calibri', size:16, color:'666666' }),
                  ],
                  alignment: D.AlignmentType.LEFT,
                  border: { top: { style: D.BorderStyle.SINGLE, size:4, color:'d0d0d0', space:4 } },
                  spacing: { before:60, after:0 }
                })]
              }),
              new D.TableCell({
                borders: { top: ftNone, bottom: ftNone, left: ftNone, right: ftNone },
                width: { size: 50, type: D.WidthType.PERCENTAGE },
                margins: { top:0, bottom:0, left:0, right:0 },
                children: [
                  new D.Paragraph({ children: [new D.TextRun({ text: 'Rua Vítor Meireles, 283', font:'Calibri', size:14, color:'888888' })], alignment: D.AlignmentType.RIGHT, border: { top: { style: D.BorderStyle.SINGLE, size:4, color:'d0d0d0', space:4 } }, spacing:{before:60,after:0} }),
                  new D.Paragraph({ children: [new D.TextRun({ text: 'Recanto Quarto Centenário - Jundiaí/SP', font:'Calibri', size:14, color:'888888' })], alignment: D.AlignmentType.RIGHT, spacing:{before:0,after:0} }),
                  new D.Paragraph({ children: [new D.TextRun({ text: 'Cep: 13211-760', font:'Calibri', size:14, color:'888888' })], alignment: D.AlignmentType.RIGHT, spacing:{before:0,after:0} }),
                ]
              }),
            ]
          })
        ]
      })
    ]
  });

  // Build document
  var doc = new D.Document({
    styles: {
      default: {
        document: { run: { font:'Calibri', size:22 } }
      },
      paragraphStyles: [
        { id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true,
          run:{ font:'Calibri', size:24, bold:true, color:GREEN, allCaps:true, italics:false },
          paragraph:{ spacing:{before:200,after:120}, outlineLevel:0,
            border:{ bottom:{style:D.BorderStyle.SINGLE,size:6,color:GREEN,space:2} } } },
        { id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true,
          run:{ font:'Calibri', size:22, bold:true, color:GREEN, italics:false },
          paragraph:{ spacing:{before:160,after:80}, outlineLevel:1 } },
        { id:'Heading3', name:'Heading 3', basedOn:'Normal', next:'Normal', quickFormat:true,
          run:{ font:'Calibri', size:22, bold:true, color:'333333', italics:false },
          paragraph:{ spacing:{before:120,after:60}, outlineLevel:2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width:11906, height:16838 },
          margin: { top:1418, right:1134, bottom:1700, left:1134 }
        }
      },
      headers: { default: new D.Header({
        children: [
          new D.Paragraph({
            children: [
              new D.ImageRun({
                data: Uint8Array.from(atob('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'), function(c){return c.charCodeAt(0);}),
                transformation: { width: 210, height: 70 }
              })
            ],
            alignment: D.AlignmentType.CENTER,
            spacing: { before: 0, after: 60 }
          })
        ]
      })},
      footers: { default: footer },
      children: children
    }]
  });

  toast('⏳ Gerando .docx...','ok');
  D.Packer.toBlob(doc).then(function(blob){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nomeArq+'.docx';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      URL.revokeObjectURL(a.href);
      if(a.parentNode) a.parentNode.removeChild(a);
    }, 1500);
    toast('✔ '+nomeArq+'.docx exportado!','ok');
  }).catch(function(err){
    console.error('Erro ao gerar .docx:', err);
    toast('Erro ao gerar .docx: '+err.message,'err');
  });
}

function expWord(){
  genPrev();
  var pvInner=Q('pvWrap').innerHTML;
  if(!pvInner||pvInner.indexOf('Clique em')>=0){alert('Gere o preview primeiro.');return}
  var dhtml='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+pCSS()+'</style></head><body><div style="max-width:794px;margin:0 auto;padding:25mm 19mm 16mm 19mm;font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a">'+pvInner+'</div></body></html>';
  var num=(Q('pNum').value||'proposta').trim();
  var tit=(Q('pTit').value||'').trim();
  var nomeArq=(num+(tit?' - '+tit:'')).replace(/[/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim();
  var blob=new Blob([dhtml],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=nomeArq+'.docx';
  a.click();URL.revokeObjectURL(a.href);
  setTimeout(function(){alert('Baixado! Abra no Chrome e use Imprimir para salvar PDF.');},400);
}
function expJSON(){
  var num=(Q('pNum').value||'prop').trim(),cli=(Q('pCli').value||'cli').replace(/[\\\\/:*?"<>|]+/g,' ').trim();
  var d={numero:num,cliente:cli};var blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=num+'-'+cli+'.json';a.click();URL.revokeObjectURL(a.href);
}
function importP(ev){
  var f=ev.target.files[0];if(!f)return;
  var r=new FileReader();r.onload=function(e){
    try{var d=JSON.parse(e.target.result);if(d.numero||d.cliente){if(d.numero)Q('pNum').value=d.numero;if(d.cliente)Q('pCli').value=d.cliente;alert('Importado. Complete e salve.');newProposal()}else alert('Formato não reconhecido.')}
    catch(er){alert('Erro: '+er.message)}
  };r.readAsText(f);ev.target.value='';
}

// TEMPLATES MANAGER
function rTplMgr(){
  var tpls=getTpls(),tb=Q('tMB');if(!tb)return;
  if(!tpls.length){tb.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:1.2rem">Nenhum template.</td></tr>';return}
  tb.innerHTML=tpls.map(function(t){
    return '<tr><td><span class="tg2">'+esc(t.g||'GERAL')+'</span></td><td style="font-weight:600">'+esc(t.titulo)+'</td><td style="color:var(--text2);font-size:.76rem">'+esc(t.desc||'')+'</td>'
      +'<td><button class="btn bg bsm" onclick="eTpl(\''+t.id+'\')">✏️</button> <button class="btn bd bsm" onclick="dTpl(\''+t.id+'\')">🗑</button></td></tr>'
  }).join('');
}
function openTF(){eTplId=null;Q('tFT').textContent='➕ Novo Template';Q('tG').value='OBJETIVO';Q('tTit').value='';Q('tDsc').value='';Q('tCon').value='';Q('tFrm').style.display='block';Q('tFrm').scrollIntoView({behavior:'smooth'})}
function eTpl(id){var t=getTpls().find(function(x){return x.id===id});if(!t)return;eTplId=id;Q('tFT').textContent='✏️ Editar';Q('tG').value=t.g||'GERAL';Q('tTit').value=t.titulo||'';Q('tDsc').value=t.desc||'';Q('tCon').value=t.conteudo||'';Q('tFrm').style.display='block';Q('tFrm').scrollIntoView({behavior:'smooth'})}
function saveT(){
  var tit=(Q('tTit').value||'').trim();if(!tit){alert('Título obrigatório.');return}
  var tpls=getTpls();var e={id:eTplId||uid(),g:Q('tG').value||'GERAL',titulo:tit,desc:Q('tDsc').value||'',conteudo:Q('tCon').value||''};
  if(eTplId){var i=tpls.findIndex(function(x){return x.id===eTplId});if(i>=0)tpls[i]=e;else tpls.push(e)}else tpls.push(e);
  saveTpls(tpls);eTplId=null;Q('tFrm').style.display='none';rTplMgr();
}
function dTpl(id){if(!confirm('Excluir?'))return;saveTpls(getTpls().filter(function(x){return x.id!==id}));rTplMgr()}

// ─── TEMPLATES DE SERVIÇO (stpl) ───────────────────────────────────────────
// Sequências de escopos pré-montados por tipo de serviço.
// Armazenado em localStorage key: 'tf_svc_templates'
var _stplId = null;

function getStpls(){
  // Tenta localStorage; se vazio e Supabase disponível, a carga já foi feita no init
  return LS('tf_svc_templates') || [];
}
function saveStpls(t){
  LS('tf_svc_templates', t); // salva local imediatamente
  if(typeof window.sbSalvarSvcTemplates === 'function') window.sbSalvarSvcTemplates(t); // sync nuvem
}

// Abre formulário para novo template
function stplOpenForm(){
  _stplId=null;
  Q('stplFormTitle').textContent='➕ Novo Template de Serviço';
  Q('stplNome').value='';Q('stplDesc').value='';Q('stplBusca').value='';
  beLoadDB();
  stplRenderPicker([]);
  Q('stplForm').style.display='block';
  Q('stplForm').scrollIntoView({behavior:'smooth'});
}

// Carrega template existente para edição
function stplEditar(id){
  var t=getStpls().find(function(x){return x.id===id});if(!t)return;
  _stplId=id;
  Q('stplFormTitle').textContent='✏️ Editar Template';
  Q('stplNome').value=t.nome||'';Q('stplDesc').value=t.desc||'';Q('stplBusca').value='';
  beLoadDB();
  stplRenderPicker(t.escopoIds||[]);
  Q('stplForm').style.display='block';
  Q('stplForm').scrollIntoView({behavior:'smooth'});
}

function stplCancelar(){_stplId=null;Q('stplForm').style.display='none';}

// Renderiza picker de escopos do banco (preserva checks ao filtrar)
function stplRenderPicker(selectedIds){
  var picker=Q('stplPicker');if(!picker)return;
  // Se chamado sem argumento (oninput), preserva estado atual dos checkboxes
  if(selectedIds===undefined){
    var cur=[];
    [].slice.call(document.querySelectorAll('.stplCheck:checked')).forEach(function(c){cur.push(c.value);});
    selectedIds=cur;
  }
  var busca=(Q('stplBusca')?Q('stplBusca').value:'').toLowerCase().trim();
  var escopos=_beEscopos||[];
  // Agrupar por grupo
  var grupos={};
  escopos.forEach(function(e){var g=e.grupo||'GERAL';if(!grupos[g])grupos[g]=[];grupos[g].push(e);});
  var html='';
  Object.keys(grupos).sort().forEach(function(g){
    var items=grupos[g].filter(function(e){return !busca||(e.titulo||'').toLowerCase().indexOf(busca)>=0||(e.descricao||'').toLowerCase().indexOf(busca)>=0;});
    if(!items.length)return;
    html+='<div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:var(--accent);padding:.4rem 0 .15rem;letter-spacing:.06em;border-top:1px solid var(--border);margin-top:.3rem">'+esc(g)+'</div>';
    items.forEach(function(e){
      var checked=selectedIds.indexOf(e.id)>=0;
      html+='<label style="display:flex;align-items:flex-start;gap:.5rem;padding:.3rem .3rem;border-radius:4px;cursor:pointer">'
        +'<input type="checkbox" class="stplCheck" value="'+e.id+'"'+(checked?' checked':'')+' style="margin-top:2px;flex-shrink:0;cursor:pointer;accent-color:var(--accent)">'
        +'<span style="font-size:.8rem;font-weight:600;color:var(--text)">'+esc(e.titulo)+'</span>'
        +(e.descricao?'<span style="font-size:.7rem;color:var(--text2);margin-left:.2rem;font-weight:400">'+esc(e.descricao)+'</span>':'')
        +'</label>';
    });
  });
  if(!escopos.length){
    html='<div style="color:var(--text3);font-size:.8rem;padding:1.2rem;text-align:center">Nenhum escopo no banco. Cadastre escopos no Banco de Escopos primeiro.</div>';
  }else if(!html){
    html='<div style="color:var(--text3);font-size:.8rem;padding:.8rem;text-align:center">Nenhum escopo encontrado para "'+esc(busca)+'"</div>';
  }
  picker.innerHTML=html;
}

// Salva o template (cria ou atualiza)
function stplSalvar(){
  var nome=(Q('stplNome').value||'').trim();
  if(!nome){alert('Informe o nome do template.');return;}
  var checks=[].slice.call(document.querySelectorAll('.stplCheck:checked'));
  var escopoIds=checks.map(function(c){return c.value;});
  var tpls=getStpls();
  var now=new Date().toISOString();
  var e={id:_stplId||uid(),nome:nome,desc:Q('stplDesc').value||'',escopoIds:escopoIds,criadoEm:now};
  if(_stplId){
    var existing=tpls.find(function(x){return x.id===_stplId;});
    if(existing)e.criadoEm=existing.criadoEm||now;
    var i=tpls.findIndex(function(x){return x.id===_stplId;});
    if(i>=0)tpls[i]=e;else tpls.push(e);
  }else{tpls.push(e);}
  saveStpls(tpls);
  _stplId=null;
  Q('stplForm').style.display='none';
  stplRenderLista();
  if(typeof toast==='function')toast('Template "'+nome+'" salvo!');
}

// Exclui template
function stplDeletar(id){
  if(!confirm('Excluir este template de serviço?'))return;
  saveStpls(getStpls().filter(function(x){return x.id!==id;}));
  stplRenderLista();
}

// Renderiza lista de templates na página
function stplRenderLista(){
  var cont=Q('stplLista');if(!cont)return;
  beLoadDB();
  var tpls=getStpls();
  // Se há templates locais, empurra para Supabase (garante sync de templates criados antes da nuvem)
  if(tpls.length && typeof window.sbSalvarSvcTemplates==='function') window.sbSalvarSvcTemplates(tpls);
  if(!tpls.length){
    cont.innerHTML='<div class="card" style="text-align:center;color:var(--text3);padding:2.5rem 1rem">'
      +'<div style="font-size:2rem;margin-bottom:.5rem">📋</div>'
      +'<div style="font-weight:600;margin-bottom:.3rem">Nenhum template criado ainda</div>'
      +'<div style="font-size:.78rem">Clique em "+ Novo Template" para criar o primeiro conjunto de escopos por tipo de serviço.</div>'
      +'</div>';
    return;
  }
  cont.innerHTML=tpls.map(function(t){
    var ids=t.escopoIds||[];
    var nomes=ids.map(function(eid){var e=(_beEscopos||[]).find(function(x){return x.id===eid;});return e?e.titulo:null;}).filter(Boolean);
    var tags=nomes.slice(0,5).map(function(n){
      return '<span style="background:var(--bg3);border:1px solid var(--border);border-radius:3px;padding:.12rem .42rem;font-size:.67rem;color:var(--text2)">'+esc(n)+'</span>';
    }).join('');
    if(nomes.length>5)tags+='<span style="font-size:.67rem;color:var(--text3)">+' +(nomes.length-5)+' mais</span>';
    return '<div class="card" style="margin-bottom:.6rem">'
      +'<div class="ch" style="margin-bottom:'+(nomes.length?'.5rem':'0')+'">'
      +'<div><span class="ct" style="font-size:.93rem">'+esc(t.nome)+'</span>'
      +(t.desc?'<div style="font-size:.72rem;color:var(--text2);margin-top:.15rem">'+esc(t.desc)+'</div>':'')
      +'</div>'
      +'<div class="br">'
      +'<span style="font-size:.7rem;color:var(--text3);align-self:center">'+ids.length+' escopo(s)</span>'
      +'<button class="btn bg bsm" onclick="stplEditar(\''+t.id+'\')">✏️ Editar</button>'
      +'<button class="btn bd bsm" onclick="stplDeletar(\''+t.id+'\')">🗑</button>'
      +'</div></div>'
      +(nomes.length?'<div style="display:flex;flex-wrap:wrap;gap:.3rem">'+tags+'</div>':'<div style="font-size:.71rem;color:var(--text3);font-style:italic">Nenhum escopo selecionado</div>')
      +'</div>';
  }).join('');
}

// Abre modal de seleção de template no Banco de Escopos
function stplAbrirModal(){
  var tpls=getStpls();
  var cont=Q('stplModalLista');if(!cont)return;
  if(!tpls.length){
    cont.innerHTML='<div style="text-align:center;color:var(--text3);padding:2rem;font-size:.82rem">'
      +'Nenhum template criado.<br>Acesse <b>Templates</b> no menu lateral para criar os primeiros.'
      +'</div>';
  }else{
    cont.innerHTML=tpls.map(function(t){
      var n=(t.escopoIds||[]).length;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.65rem .9rem;border-radius:var(--r2);cursor:pointer;border:1px solid var(--border);background:var(--bg3);transition:background .15s" '
        +'onclick="stplAplicar(\''+t.id+'\')" onmouseover="this.style.background=\'var(--bg4,var(--hover))\'" onmouseout="this.style.background=\'var(--bg3)\'">'
        +'<div><div style="font-weight:600;font-size:.86rem;color:var(--text)">'+esc(t.nome)+'</div>'
        +(t.desc?'<div style="font-size:.71rem;color:var(--text2)">'+esc(t.desc)+'</div>':'')
        +'</div>'
        +'<span style="font-size:.72rem;color:var(--accent);font-weight:600;white-space:nowrap;margin-left:.8rem">'+n+' escopo(s) ▶</span>'
        +'</div>';
    }).join('');
  }
  Q('stplModal').style.display='flex';
}

// Abre modal de template no contexto da proposta (Step 3 - Escopo)
function stplAbrirModalInline(){
  var tpls=getStpls();
  var cont=Q('stplModalLista');if(!cont)return;
  if(!tpls.length){
    cont.innerHTML='<div style="text-align:center;color:var(--text3);padding:2rem;font-size:.82rem">'
      +'Nenhum template criado.<br>Acesse <b>Templates</b> no menu lateral para criar os primeiros.'
      +'</div>';
  }else{
    cont.innerHTML=tpls.map(function(t){
      var n=(t.escopoIds||[]).length;
      return '<div style="display:flex;align-items:center;justify-content:space-between;padding:.65rem .9rem;border-radius:var(--r2);cursor:pointer;border:1px solid var(--border);background:var(--bg3);transition:background .15s" '
        +'onclick="stplAplicarInline(\''+t.id+'\')" onmouseover="this.style.background=\'var(--bg4,var(--hover))\'" onmouseout="this.style.background=\'var(--bg3)\'">'
        +'<div><div style="font-weight:600;font-size:.86rem;color:var(--text)">'+esc(t.nome)+'</div>'
        +(t.desc?'<div style="font-size:.71rem;color:var(--text2)">'+esc(t.desc)+'</div>':'')
        +'</div>'
        +'<span style="font-size:.72rem;color:var(--accent);font-weight:600;white-space:nowrap;margin-left:.8rem">'+n+' escopo(s) ▶</span>'
        +'</div>';
    }).join('');
  }
  Q('stplModal').style.display='flex';
}

// Aplica template direto na proposta (Step 3 - sem precisar do painel inline)
function stplAplicarInline(id){
  var t=getStpls().find(function(x){return x.id===id;});if(!t)return;
  beLoadDB();
  var ids=t.escopoIds||[];
  var adicionados=0;
  ids.forEach(function(eid){
    var e=_beEscopos.find(function(x){return x.id===eid;});
    if(!e)return;
    var subsForProp=(e.subs||[]).map(function(s){return{id:uid(),nome:s.nome||s.titulo||'',desc:s.desc||''};});
    escSecs.push({id:uid(),num:'',titulo:e.titulo||'',desc:e.conteudo||'',subs:subsForProp});
    adicionados++;
  });
  Q('stplModal').style.display='none';
  if(adicionados===0){alert('Nenhum escopo deste template foi encontrado no banco. Verifique o Banco de Escopos.');return;}
  rEsc();
  if(typeof toast==='function')toast('✔ Template "'+t.nome+'" aplicado — '+adicionados+' escopo(s) adicionado(s)!','ok');
}

// Aplica template no Banco de Escopos (marca os checkboxes correspondentes)
function stplAplicar(id){
  var t=getStpls().find(function(x){return x.id===id;});if(!t)return;
  var ids=t.escopoIds||[];
  // Desmarca todos
  document.querySelectorAll('.beCheck').forEach(function(c){c.checked=false;});
  // Marca os do template (se estiverem visíveis no DOM)
  var marcados=0;
  ids.forEach(function(eid){
    var cb=document.querySelector('.beCheck[data-id="'+eid+'"]');
    if(cb){cb.checked=true;marcados++;}
  });
  beContarSelecionados();
  Q('stplModal').style.display='none';
  var msg='Template "'+t.nome+'" aplicado! '+marcados+' escopo(s) marcado(s).';
  if(marcados<ids.length)msg+=' ('+(ids.length-marcados)+' não encontrado(s) — verifique o Banco de Escopos.)';
  if(typeof toast==='function')toast(msg);else alert(msg);
}
// ─── FIM TEMPLATES DE SERVIÇO ───────────────────────────────────────────────

// ESCOPO DB
function rT(){
  var sel=Q('eTS'),flt=(Q('eTF')&&Q('eTF').value||'').toLowerCase();if(!sel)return;
  var cur=sel.value;
  var list=eDB.titulos.filter(function(t){return !flt||(t.nome||'').toLowerCase().indexOf(flt)>=0}).sort(function(a,b){return(a.nome||'').localeCompare(b.nome||'','pt-BR')});
  sel.innerHTML='<option value="">— selecionar —</option>'+list.map(function(t){return'<option value="'+t.id+'">'+esc(t.nome||'(sem nome)')+'</option>'}).join('');
  if(cur&&[].slice.call(sel.options).some(function(o){return o.value===cur}))sel.value=cur;
}
function rS(){
  var sel=Q('eSS'),flt=(Q('eSF')&&Q('eSF').value||'').toLowerCase();var tid=Q('eTS')&&Q('eTS').value||'';if(!sel)return;
  var cur=sel.value;
  sel.innerHTML='<option value="">'+(tid?'— selecionar —':'— selecione título —')+'</option>';
  if(!tid)return;
  var list=eDB.subtitulos.filter(function(s){return s.tituloId===tid&&(!flt||(s.nome||'').toLowerCase().indexOf(flt)>=0)}).sort(function(a,b){return(a.nome||'').localeCompare(b.nome||'','pt-BR')});
  sel.innerHTML+= list.map(function(s){return'<option value="'+s.id+'">'+esc(s.nome||'(sem nome)')+'</option>'}).join('');
  if(cur&&[].slice.call(sel.options).some(function(o){return o.value===cur}))sel.value=cur;
}
function onTC(){var id=Q('eTS').value||'';var item=eDB.titulos.find(function(t){return t.id===id});if(Q('eTD'))Q('eTD').value=item?item.descricao||'':'';rS();if(Q('eSD'))Q('eSD').value=''}
function onSC(){var id=Q('eSS').value||'';var item=eDB.subtitulos.find(function(s){return s.id===id});if(Q('eSD'))Q('eSD').value=item?item.descricao||'':''}
function nT(){Q('eTS').value='';if(Q('eTD'))Q('eTD').value='';rS();if(Q('eSD'))Q('eSD').value=''}
function saveT2(){
  var sel=Q('eTS'),ta=Q('eTD'),ex=sel.value||'';
  if(ex){var item=eDB.titulos.find(function(t){return t.id===ex});if(!item){alert('Não encontrado.');return}item.descricao=ta.value||'';saveEDB();alert('Atualizado.');return}
  var nome=(prompt('Nome do TÍTULO:','')||'').trim();if(!nome){alert('Nome obrigatório.');return}
  var id=uid();eDB.titulos.push({id:id,nome:nome,descricao:ta.value||''});saveEDB();rT();sel.value=id;onTC();
}
function renT(){var id=Q('eTS').value||'';if(!id){alert('Selecione um título.');return}var item=eDB.titulos.find(function(t){return t.id===id});var n=(prompt('Novo nome:',item&&item.nome||'')||'').trim();if(!n){alert('Nome obrigatório.');return}item.nome=n;saveEDB();rT()}
function delT(){
  var id=Q('eTS').value||'';if(!id){alert('Selecione.');return}
  var item=eDB.titulos.find(function(t){return t.id===id});
  if(!confirm('Excluir "'+item.nome+'" e subtítulos?'))return;
  eDB.titulos=eDB.titulos.filter(function(t){return t.id!==id});eDB.subtitulos=eDB.subtitulos.filter(function(s){return s.tituloId!==id});
  saveEDB();nT();rT();rS();
}
function nS(){if(Q('eSS'))Q('eSS').value='';if(Q('eSD'))Q('eSD').value=''}
function saveS2(){
  var tid=Q('eTS').value||'';if(!tid){alert('Selecione um TÍTULO primeiro.');return}
  var sel=Q('eSS'),ta=Q('eSD'),ex=sel.value||'';
  if(ex){var item=eDB.subtitulos.find(function(s){return s.id===ex});if(!item){alert('Não encontrado.');return}item.descricao=ta.value||'';saveEDB();alert('Atualizado.');return}
  var nome=(prompt('Nome do SUBTÍTULO:','')||'').trim();if(!nome){alert('Nome obrigatório.');return}
  var id=uid();eDB.subtitulos.push({id:id,tituloId:tid,nome:nome,descricao:ta.value||''});saveEDB();rS();sel.value=id;onSC();
}
function renS(){var tid=Q('eTS').value||'';if(!tid){alert('Selecione título.');return}var id=Q('eSS').value||'';if(!id){alert('Selecione subtítulo.');return}var item=eDB.subtitulos.find(function(s){return s.id===id});var n=(prompt('Novo nome:',item&&item.nome||'')||'').trim();if(!n){alert('Nome obrigatório.');return}item.nome=n;saveEDB();rS()}
function delS(){var tid=Q('eTS').value||'';if(!tid){alert('Selecione título.');return}var id=Q('eSS').value||'';if(!id){alert('Selecione subtítulo.');return}var item=eDB.subtitulos.find(function(s){return s.id===id});if(!confirm('Excluir "'+item.nome+'"?'))return;eDB.subtitulos=eDB.subtitulos.filter(function(s){return s.id!==id});saveEDB();nS();rS()}

// ============================================================
// BANCO DE DADOS DE ESCOPO — funções completas
// ============================================================
var _beEscopos = [];
var _beEditId  = null;

function beLoadDB(){
  _beEscopos = LS('tf_bancoEscopos') || [];
}
function beSaveDB(){
  LS('tf_bancoEscopos', _beEscopos);
  // Sync com Supabase
  if(window.sbClient && _beEscopos && _beEscopos.length){
    window.sbClient.from('configuracoes').upsert({
      chave:'tf_etpl', valor:_beEscopos, updated_at:new Date().toISOString()
    },{onConflict:'chave'}).then(function(r){
      if(r.error) console.error('[beSaveDB]',r.error.message);
      else console.log('%c[beSaveDB] '+_beEscopos.length+' escopos sincronizados','color:green;font-weight:700');
    });
  }
}

/* Atualiza o datalist de grupos e o select de filtro */
function beAtualizarGrupos(){
  var grupos = [];
  _beEscopos.forEach(function(e){
    if(grupos.indexOf(e.grupo)<0) grupos.push(e.grupo);
  });
  grupos.sort(function(a,b){return a.localeCompare(b,'pt-BR')});

  // datalist para o input de cadastro
  var dl = Q('beGrupoList');
  if(dl){ dl.innerHTML = grupos.map(function(g){return '<option value="'+esc(g)+'">'; }).join(''); }

  // select de filtro
  var sf = Q('beFiltroGrupo');
  if(sf){
    var cur = sf.value;
    sf.innerHTML = '<option value="">— Todos os grupos —</option>' +
      grupos.map(function(g){return '<option value="'+esc(g)+'"'+(g===cur?' selected':'')+'>'+esc(g)+'</option>';}).join('');
  }
}

/* Limpa o formulário de cadastro */
function beLimparForm(){
  _beEditId = null;
  Q('beCadTitulo').textContent = '➕ Cadastrar Escopo';
  Q('beCancelarBtn').style.display = 'none';
  _beSubs = []; beRenderSubs();
  ['beGrupo','beTitulo','beDescricao','beConteudo','beOrdem'].forEach(function(id){
    var el=Q(id); if(el) el.value='';
  });
}

/* Cancela edição e volta ao modo cadastro */
function beCancelarEdicao(){
  beLimparForm();
}

// ============================================================
// BANCO DE ESCOPOS INLINE — painel dentro da Etapa 3
// ============================================================
function toggleBancoEscoposInline(){
  var painel = Q('bancoEscoposInline');
  var btn    = Q('btnBancoEscoposInline');
  if(!painel) return;
  var aberto = painel.style.display !== 'none';
  if(aberto){
    painel.style.display = 'none';
    if(btn) btn.classList.remove('bs');
  } else {
    beLoadDB();
    beInlineAtualizarGrupos();
    beInlineRender();
    painel.style.display = 'block';
    if(btn) btn.classList.add('bs');
    painel.scrollIntoView({behavior:'smooth', block:'start'});
  }
}

function beInlineAtualizarGrupos(){
  var grupos = [];
  _beEscopos.forEach(function(e){ if(grupos.indexOf(e.grupo)<0) grupos.push(e.grupo); });
  grupos.sort(function(a,b){return a.localeCompare(b,'pt-BR')});
  var sf = Q('beInlineFiltroGrupo');
  if(sf){
    var cur = sf.value;
    sf.innerHTML = '<option value="">— Todos os grupos —</option>' +
      grupos.map(function(g){return '<option value="'+esc(g)+'"'+(g===cur?' selected':'')+'>'+esc(g)+'</option>';}).join('');
  }
}

function beInlineRender(){
  var busca   = ((Q('beInlineBusca')||{}).value||'').toLowerCase().trim();
  var filtroG = ((Q('beInlineFiltroGrupo')||{}).value||'');
  var visiveis = _beEscopos.filter(function(e){
    var matchG = !filtroG || e.grupo===filtroG;
    var matchB = !busca ||
      (e.titulo||'').toLowerCase().indexOf(busca)>=0 ||
      (e.grupo||'').toLowerCase().indexOf(busca)>=0 ||
      (e.conteudo||'').toLowerCase().indexOf(busca)>=0 ||
      (e.descricao||'').toLowerCase().indexOf(busca)>=0;
    return matchG && matchB;
  });
  var grupos = {};
  visiveis.forEach(function(e){
    if(!grupos[e.grupo]) grupos[e.grupo]=[];
    grupos[e.grupo].push(e);
  });
  var keys = Object.keys(grupos).sort(function(a,b){return a.localeCompare(b,'pt-BR')});
  var html = '';
  if(keys.length===0){
    html = '<div class="emp" style="padding:1.5rem"><div class="emp-i">🗂️</div>'
         + '<p>'+(busca||filtroG?'Nenhum escopo encontrado. Tente outros termos.':'O banco de escopos está vazio. Cadastre escopos na aba 🗂️ Banco de Escopos.')+'</p></div>';
  } else {
    keys.forEach(function(g){
      html += '<div style="margin-bottom:.8rem">'
            + '<div style="font-size:.7rem;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.3rem;padding:.22rem .5rem;background:rgba(240,165,0,.08);border-radius:4px;border-left:3px solid var(--accent)">'
            + esc(g)+'</div>';
      grupos[g].forEach(function(e){
        html += '<div style="display:flex;align-items:flex-start;gap:.5rem;padding:.4rem .5rem;border-radius:5px;border:1px solid var(--border);background:var(--bg3);margin-bottom:.3rem">'
              + '<input type="checkbox" class="beInlineCheck" data-id="'+e.id+'" onchange="beInlineContarSel()" style="margin-top:3px;flex-shrink:0;cursor:pointer;width:15px;height:15px;accent-color:var(--green)">'
              + '<div style="flex:1;min-width:0">'
              + '<div style="font-weight:700;font-size:.83rem;color:var(--text)">'+esc(e.titulo)+'</div>'
              + (e.descricao?'<div style="font-size:.71rem;color:var(--blue);margin-top:.08rem">'+esc(e.descricao)+'</div>':'')
              + (e.conteudo?'<div style="font-size:.72rem;color:var(--text2);margin-top:.2rem;line-height:1.4;white-space:pre-wrap;max-height:52px;overflow:hidden">'+esc(e.conteudo.slice(0,200))+(e.conteudo.length>200?'…':'')+'</div>':'')
              + '</div></div>';
      });
      html += '</div>';
    });
  }
  var lista = Q('beInlineLista');
  if(lista) lista.innerHTML = html;
  beInlineContarSel();
}

function beInlineContarSel(){
  var n = document.querySelectorAll('.beInlineCheck:checked').length;
  var ctr = Q('beInlineContador');
  var num = Q('beInlineNumSel');
  if(ctr) ctr.style.display = n>0 ? 'block' : 'none';
  if(num) num.textContent = n;
}

function beInlineMarcarTodos(){
  document.querySelectorAll('.beInlineCheck').forEach(function(c){c.checked=true;});
  beInlineContarSel();
}

function beInlineDesmarcar(){
  document.querySelectorAll('.beInlineCheck').forEach(function(c){c.checked=false;});
  beInlineContarSel();
}

function beInlineAdicionar(){
  var checks = document.querySelectorAll('.beInlineCheck:checked');
  if(checks.length===0){ alert('Selecione ao menos um escopo.'); return; }
  var adicionados = 0;
  checks.forEach(function(c){
    var id = c.getAttribute('data-id');
    var e  = _beEscopos.find(function(x){return x.id===id});
    if(!e) return;
    var subsForProp = (e.subs||[]).map(function(s){
      return {id:uid(), nome:s.nome||s.titulo||'', desc:s.desc||''};
    });
    escSecs.push({
      id:    uid(),
      num:   '',
      titulo: e.titulo || '',
      desc:   e.conteudo || '',
      subs:  subsForProp
    });
    adicionados++;
  });
  rEsc();
  beInlineDesmarcar();
  Q('bancoEscoposInline').style.display = 'none';
  var btn = Q('btnBancoEscoposInline');
  if(btn) btn.classList.remove('bs');
  Q('escList').scrollIntoView({behavior:'smooth', block:'start'});
  toast('✔ '+adicionados+' escopo(s) adicionado(s)! Edite os textos abaixo.','ok');
}

/* ── SUBTÍTULOS DO FORMULÁRIO ── */
var _beSubs = []; // [{id, ordem, nome, desc}]

function beAddSub(data){
  var sub = data || {id:uid(), ordem:'', nome:'', desc:''};
  _beSubs.push(sub);
  beRenderSubs();
  setTimeout(function(){
    var inputs = Q('beSubList').querySelectorAll('.be-sub-nome');
    if(inputs.length) inputs[inputs.length-1].focus();
  },60);
}

function beRemSub(idx){
  _beSubs.splice(idx,1);
  beRenderSubs();
}

function beRenderSubs(){
  var el = Q('beSubList');
  if(!el) return;
  el.innerHTML = '';
  if(!_beSubs.length){
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:.72rem;color:var(--text3);padding:.25rem .1rem';
    hint.textContent = 'Nenhum subtítulo. Clique em + Adicionar.';
    el.appendChild(hint);
    return;
  }
  _beSubs.forEach(function(s,i){
    var row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:60px 1fr auto;gap:.4rem;align-items:center;background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:.38rem .5rem';
    // Ordem input
    var inpO = document.createElement('input');
    inpO.type='number'; inpO.placeholder='Nº'; inpO.min='0'; inpO.step='1';
    inpO.value = (s.ordem!=null && s.ordem!==undefined && s.ordem!=='') ? s.ordem : '';
    inpO.title = 'Nº de ordem do subtítulo';
    inpO.style.cssText = 'padding:.28rem .35rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--accent);font-weight:700;font-size:.78rem;text-align:center;width:100%;font-family:inherit';
    inpO.addEventListener('input', (function(idx){ return function(){ _beSubs[idx].ordem = this.value==='' ? null : parseInt(this.value); }; })(i));
    // Nome input
    var inpN = document.createElement('input');
    inpN.type='text'; inpN.placeholder='Ex: Pontos de Intervencao...';
    inpN.value = s.nome||'';
    inpN.className = 'be-sub-nome';
    inpN.style.cssText = 'padding:.28rem .45rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:.8rem;width:100%;font-family:inherit';
    inpN.addEventListener('input', (function(idx){ return function(){ _beSubs[idx].nome = this.value; }; })(i));
    // Remove button
    var btn = document.createElement('button');
    btn.className='btn bd bxs'; btn.type='button'; btn.title='Remover'; btn.textContent='x';
    btn.addEventListener('click', (function(idx){ return function(){ beRemSub(idx); }; })(i));
    row.appendChild(inpO); row.appendChild(inpN); row.appendChild(btn);
    el.appendChild(row);
  });
}

/* Salva (novo ou edição) */
function beSalvar(){
  var grupo    = (Q('beGrupo').value||'').trim();
  var titulo   = (Q('beTitulo').value||'').trim();
  var descricao= (Q('beDescricao').value||'').trim();
  var conteudo = (Q('beConteudo').value||'').trim();
  var ordemVal = Q('beOrdem').value.trim();
  var ordem    = ordemVal!=='' ? parseInt(ordemVal,10) : null;

  if(!grupo){  alert('Informe o Grupo / Categoria.'); Q('beGrupo').focus(); return; }
  if(!titulo){ alert('Informe o Título.'); Q('beTitulo').focus(); return; }

  // Build subs from form
  var subs = _beSubs
    .filter(function(s){ return (s.nome||'').trim(); })
    .sort(function(a,b){
      var oa = (a.ordem!=null&&a.ordem!=='')?parseInt(a.ordem):9999;
      var ob = (b.ordem!=null&&b.ordem!=='')?parseInt(b.ordem):9999;
      return oa-ob;
    })
    .map(function(s){
      return {id:s.id||uid(), nome:(s.nome||'').trim(), ordem:(s.ordem!=null&&s.ordem!=='')?parseInt(s.ordem):null, desc:''};
    });

  if(_beEditId){
    var item = _beEscopos.find(function(e){return e.id===_beEditId});
    if(item){
      item.grupo=grupo; item.titulo=titulo;
      item.descricao=descricao; item.conteudo=conteudo;
      item.ordem=ordem; item.subs=subs;
    }
    toast('✔ Escopo atualizado!','ok');
  } else {
    _beEscopos.push({id:uid(), grupo:grupo, titulo:titulo, descricao:descricao, conteudo:conteudo, ordem:ordem, subs:subs});
    toast('✔ Escopo salvo!','ok');
  }
  beSaveDB();
  beLimparForm();
  beAtualizarGrupos();
  beRenderLista();
}

/* Inicia edição de um escopo */
function beEditar(id){
  var item = _beEscopos.find(function(e){return e.id===id});
  if(!item) return;
  _beEditId = id;
  Q('beGrupo').value     = item.grupo     || '';
  Q('beTitulo').value    = item.titulo    || '';
  Q('beDescricao').value = item.descricao || '';
  Q('beConteudo').value  = item.conteudo  || '';
  Q('beOrdem').value     = (item.ordem!=null && item.ordem!==undefined) ? item.ordem : '';
  // Load subtitulos
  _beSubs = (item.subs||[]).map(function(s){ return {id:s.id||uid(), ordem:(s.ordem!=null?s.ordem:''), nome:s.nome||s.titulo||'', desc:s.desc||''}; });
  beRenderSubs();
  Q('beCadTitulo').textContent = '✏️ Editando Escopo';
  Q('beCancelarBtn').style.display = 'inline-flex';
  // Scroll para o formulário
  Q('beGrupo').scrollIntoView({behavior:'smooth', block:'center'});
  Q('beGrupo').focus();
  go('escopos', document.querySelector('.nb[onclick*="escopos"]'));
}

/* Exclui um escopo */
function beExcluir(id){
  var item = _beEscopos.find(function(e){return e.id===id});
  if(!item) return;
  if(!confirm('Excluir o escopo "'+item.titulo+'"?')) return;
  _beEscopos = _beEscopos.filter(function(e){return e.id!==id});
  beSaveDB();
  beAtualizarGrupos();
  beRenderLista();
  toast('🗑 Escopo excluído.','ok');
}

/* Render da lista agrupada */
function beRenderLista(){
  var busca  = ((Q('beBusca')||{}).value||'').toLowerCase().trim();
  var filtroG= ((Q('beFiltroGrupo')||{}).value||'');

  var visiveis = _beEscopos.filter(function(e){
    var matchG  = !filtroG || e.grupo===filtroG;
    var matchB  = !busca   ||
      (e.titulo||'').toLowerCase().indexOf(busca)>=0 ||
      (e.grupo||'').toLowerCase().indexOf(busca)>=0  ||
      (e.conteudo||'').toLowerCase().indexOf(busca)>=0 ||
      (e.descricao||'').toLowerCase().indexOf(busca)>=0;
    return matchG && matchB;
  });

  /* Agrupar */
  var grupos = {};
  visiveis.forEach(function(e){
    if(!grupos[e.grupo]) grupos[e.grupo]=[];
    grupos[e.grupo].push(e);
  });

  // Sort items within each group by "ordem" (nulls go to end), then by titulo
  Object.keys(grupos).forEach(function(g){
    grupos[g].sort(function(a,b){
      var oa = (a.ordem!=null && a.ordem!==undefined) ? a.ordem : 9999;
      var ob = (b.ordem!=null && b.ordem!==undefined) ? b.ordem : 9999;
      if(oa!==ob) return oa-ob;
      return (a.titulo||'').localeCompare(b.titulo||'','pt-BR');
    });
  });

  var keys = Object.keys(grupos).sort(function(a,b){return a.localeCompare(b,'pt-BR')});

  var html = '';
  if(keys.length===0){
    html = '<div class="emp" style="padding:2rem"><div class="emp-i">🗂️</div><p>Nenhum escopo encontrado.</p>'
         + (busca||filtroG?'<p style="font-size:.76rem;margin-top:.3rem">Tente outros termos.</p>':'<p style="font-size:.76rem;margin-top:.3rem">Cadastre o primeiro escopo ao lado ←</p>')
         + '</div>';
  } else {
    keys.forEach(function(g){
      html += '<div style="margin-bottom:.9rem">'
            + '<div style="font-size:.7rem;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.35rem;padding:.28rem .5rem;background:rgba(240,165,0,.08);border-radius:4px;border-left:3px solid var(--accent)">'
            + esc(g)
            + '</div>';
      grupos[g].forEach(function(e){
        var isChecked = document.querySelector('.beCheck[data-id="'+e.id+'"]')&&document.querySelector('.beCheck[data-id="'+e.id+'"]').checked;
        html += '<div style="display:flex;align-items:flex-start;gap:.5rem;padding:.45rem .5rem;border-radius:5px;border:1px solid var(--border);background:var(--bg3);margin-bottom:.35rem;transition:background .15s" id="beItem_'+e.id+'">'
              + '<input type="checkbox" class="beCheck" data-id="'+e.id+'" '+(isChecked?'checked':'')+' onchange="beContarSelecionados()" style="margin-top:3px;flex-shrink:0;cursor:pointer;width:15px;height:15px;accent-color:var(--green)">'
              + '<div style="flex:1;min-width:0">'
              + '<div style="font-weight:700;font-size:.92rem;color:var(--text);line-height:1.3">'
              + (e.ordem!=null&&e.ordem!==undefined?'<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--accent);color:#000;font-size:.65rem;font-weight:800;margin-right:.35rem;flex-shrink:0">'+e.ordem+'</span>':'')
              + esc(e.titulo)+'</div>'
              + (e.descricao?'<div style="font-size:.72rem;color:var(--blue);margin-top:.1rem">'+esc(e.descricao)+'</div>':'')
              + (e.conteudo?'<div style="font-size:.73rem;color:var(--text2);margin-top:.25rem;line-height:1.45;white-space:pre-wrap;max-height:64px;overflow:hidden;text-overflow:ellipsis">'+esc(e.conteudo.slice(0,220))+(e.conteudo.length>220?'…':'')+'</div>':'')
              + (e.subs&&e.subs.length?'<div style="margin-top:.35rem;display:flex;flex-direction:column;gap:.2rem">'
                +e.subs.map(function(s){
                  var on=(s.ordem!=null&&s.ordem!=='')?s.ordem:'';
                  return '<div style="display:flex;align-items:center;gap:.3rem;font-size:.71rem;color:var(--text2)">'
                    +(on!==''?'<span style="min-width:18px;height:18px;border-radius:50%;background:rgba(88,166,255,.15);border:1px solid rgba(88,166,255,.3);color:var(--blue);font-size:.62rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center">'+on+'</span>':'<span style="min-width:18px">•</span>')
                    +'<span>'+esc(s.nome||s.titulo||'')+'</span>'
                    +'</div>';
                }).join('')
                +'</div>':'')
              + '</div>'
              + '<div style="display:flex;flex-direction:column;gap:.25rem;flex-shrink:0">'
              + '<button class="btn bg bxs" onclick="beEditar(\''+e.id+'\')" title="Editar">✏️</button>'
              + '<button class="btn bd bxs" onclick="beExcluir(\''+e.id+'\')" title="Excluir">🗑</button>'
              + '</div>'
              + '</div>';
      });
      html += '</div>';
    });
  }

  var lista = Q('beLista');
  if(lista) lista.innerHTML = html;
  beContarSelecionados();
}

/* Conta checkboxes selecionados */
function beContarSelecionados(){
  var checks = document.querySelectorAll('.beCheck:checked');
  var n = checks.length;
  var ctr = Q('beContadorSel');
  var num = Q('beNumSel');
  if(ctr){ ctr.style.display = n>0?'block':'none'; }
  if(num){ num.textContent = n; }
}

/* Marcar todos visíveis */
function beMarcarTodosVisiveis(){
  document.querySelectorAll('.beCheck').forEach(function(c){ c.checked=true; });
  beContarSelecionados();
}

/* Desmarcar todos */
function beDesmarcarTodos(){
  document.querySelectorAll('.beCheck').forEach(function(c){ c.checked=false; });
  beContarSelecionados();
}

/* Adicionar escopos selecionados na proposta em edição (Etapa 3) */
function beAdicionarNaProposta(){
  var checks = document.querySelectorAll('.beCheck:checked');
  if(checks.length===0){
    alert('Selecione ao menos um escopo na biblioteca antes de adicionar à proposta.');
    return;
  }

  if(!editId){
    var ok = confirm('Nenhuma proposta está aberta para edição.\n\nDeseja abrir a seção de Nova Proposta para criar uma, ou voltar e abrir uma proposta existente?');
    if(ok) go('nova', document.querySelector('.nb[onclick*="newProposal"]'));
    return;
  }

  var adicionados = 0;
  checks.forEach(function(c){
    var id = c.getAttribute('data-id');
    var e  = _beEscopos.find(function(x){return x.id===id});
    if(!e) return;
    var subsForProp = (e.subs||[]).map(function(s){
      return {id:uid(), nome:s.nome||s.titulo||'', desc:s.desc||''};
    });
    escSecs.push({
      id:    uid(),
      num:   '',
      titulo: e.titulo || '',
      desc:   e.conteudo || '',
      subs:  subsForProp
    });
    adicionados++;
  });

  if(adicionados>0){
    // Navegar para o escopo da proposta
    go('nova', null);
    step(3);
    rEsc();
    toast('✔ '+adicionados+' escopo(s) adicionado(s) à proposta! Edite na Etapa 3.','ok');
    beDesmarcarTodos();
  }
}

/* Exportar banco como JSON */
function beExportar(){
  if(_beEscopos.length===0){ alert('O banco está vazio.'); return; }
  var dados = JSON.stringify(_beEscopos, null, 2);
  var blob = new Blob([dados],{type:'application/json'});
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href   = url;
  a.download = 'banco_escopos_'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('✔ Banco exportado!','ok');
}

/* Importar banco de JSON */
function beImportar(event){
  var file = event.target.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var dados = JSON.parse(e.target.result);
      if(!Array.isArray(dados)) throw new Error('Formato inválido.');
      var op = confirm('Importar '+dados.length+' escopo(s)?\n\n'
        +'[OK] = SUBSTITUIR o banco atual\n'
        +'[Cancelar] = MESCLAR com o banco atual');
      if(op){
        _beEscopos = dados;
      } else {
        // mesclar: não duplicar por id
        dados.forEach(function(d){
          if(!_beEscopos.find(function(x){return x.id===d.id})){
            _beEscopos.push(d);
          }
        });
      }
      beSaveDB();
      beAtualizarGrupos();
      beRenderLista();
      toast('✔ Importação concluída! '+_beEscopos.length+' escopos no banco.','ok');
    } catch(err){
      alert('Erro ao importar: '+err.message);
    }
    event.target.value='';
  };
  reader.readAsText(file);
}

/* Limpar todo o banco */
function beLimparTudo(){
  if(!confirm('Apagar TODOS os escopos do banco?\n\nEsta ação não pode ser desfeita.')) return;
  _beEscopos = [];
  beSaveDB();
  beAtualizarGrupos();
  beRenderLista();
  beLimparForm();
  toast('🗑 Banco limpo.','ok');
}

/* Inicializar o banco ao entrar na aba */
function beInit(){
  beLoadDB();
  beAtualizarGrupos();
  beRenderLista();
}

// ============================================================
// AUTOCOMPLETE DE CLIENTES / CONTATOS
var autoBox=null, autoState={input:null, items:[], index:-1, kind:''};

function normTxt(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}
function ensureAutoBox(){
  if(autoBox) return autoBox;
  autoBox=document.createElement('div');
  autoBox.id='autoBoxGlobal';
  autoBox.className='auto-box';
  document.body.appendChild(autoBox);
  return autoBox;
}
function buildClientDirectory(){
  var empresas={};
  (props||[]).forEach(function(p){
    var cli=(p.cli||'').trim();
    if(!cli) return;
    var key=normTxt(cli)+'|'+normTxt(p.cnpj||'')+'|'+normTxt(p.cid||'');
    if(!empresas[key]){
      empresas[key]={
        empresa:cli,
        cnpj:(p.cnpj||'').trim(),
        cidade:(p.cid||'').trim(),
        contatos:{},
        total:0,
        ultimaTs:0
      };
    }
    var emp=empresas[key];
    emp.total++;
    emp.ultimaTs=Math.max(emp.ultimaTs, n2(p.tsSaved||p.ts||0) || 0);
    var contato=(p.ac||'').trim();
    if(contato){
      var ckey=normTxt(contato)+'|'+normTxt(p.mail||'')+'|'+normTxt(p.tel||'');
      if(!emp.contatos[ckey]){
        emp.contatos[ckey]={
          nome:contato,
          departamento:(p.dep||'').trim(),
          email:(p.mail||'').trim(),
          tel:(p.tel||'').trim(),
          empresa:cli,
          cnpj:(p.cnpj||'').trim(),
          cidade:(p.cid||'').trim(),
          usos:0
        };
      }
      emp.contatos[ckey].usos++;
    }
  });
  return Object.keys(empresas).map(function(k){
    var e=empresas[k];
    e.contatos=Object.keys(e.contatos).map(function(ck){ return e.contatos[ck]; }).sort(function(a,b){
      if((b.usos||0)!==(a.usos||0)) return (b.usos||0)-(a.usos||0);
      return (a.nome||'').localeCompare(b.nome||'','pt-BR');
    });
    return e;
  }).sort(function(a,b){
    if((b.total||0)!==(a.total||0)) return (b.total||0)-(a.total||0);
    return (a.empresa||'').localeCompare(b.empresa||'','pt-BR');
  });
}
function currentCompanyMatches(rec){
  var empresa=normTxt(Q('pCli')&&Q('pCli').value);
  var cnpj=normTxt(Q('pCnpj')&&Q('pCnpj').value);
  var cidade=normTxt(Q('pCid')&&Q('pCid').value);
  if(!empresa) return false;
  if(empresa!==normTxt(rec.empresa)) return false;
  if(cnpj && cnpj!==normTxt(rec.cnpj)) return false;
  if(cidade && cidade!==normTxt(rec.cidade)) return false;
  return true;
}
function findSelectedCompanyRecord(){
  var dir=buildClientDirectory();
  for(var i=0;i<dir.length;i++) if(currentCompanyMatches(dir[i])) return dir[i];
  var empresa=normTxt(Q('pCli')&&Q('pCli').value);
  if(!empresa) return null;
  for(var j=0;j<dir.length;j++) if(normTxt(dir[j].empresa)===empresa) return dir[j];
  return null;
}
function getCompanySuggestions(query){
  var q=normTxt(query);
  return buildClientDirectory().filter(function(e){
    if(!q) return true;
    var hay=[e.empresa,e.cnpj,e.cidade].map(normTxt).join(' | ');
    return hay.indexOf(q)>=0;
  }).slice(0,12).map(function(e){
    return {
      kind:'company',
      title:e.empresa||'—',
      meta:[e.cnpj||'Sem CNPJ', e.cidade||'Sem cidade', (e.total||0)+' proposta(s)'].join(' • '),
      raw:e
    };
  });
}
function getContactSuggestions(query){
  var q=normTxt(query);
  var emp=findSelectedCompanyRecord();
  var contatos=[];
  if(emp && emp.contatos && emp.contatos.length){
    contatos=emp.contatos.slice();
  }else{
    var mapa={};
    buildClientDirectory().forEach(function(e){
      (e.contatos||[]).forEach(function(c){
        var k=[normTxt(c.nome),normTxt(c.email),normTxt(c.tel),normTxt(c.empresa)].join('|');
        if(!mapa[k]) mapa[k]=Object.assign({usos:0}, c);
        mapa[k].usos=(mapa[k].usos||0)+(c.usos||1);
      });
    });
    contatos=Object.keys(mapa).map(function(k){ return mapa[k]; }).sort(function(a,b){
      if((b.usos||0)!==(a.usos||0)) return (b.usos||0)-(a.usos||0);
      return (a.nome||'').localeCompare(b.nome||'','pt-BR');
    });
  }
  return contatos.filter(function(c){
    if(!q) return true;
    var hay=[c.nome,c.departamento,c.email,c.tel,c.empresa,c.cnpj,c.cidade].map(normTxt).join(' | ');
    return hay.indexOf(q)>=0;
  }).slice(0,12).map(function(c){
    var meta=[c.departamento||'Sem departamento', c.email||'Sem e-mail', c.tel||'Sem telefone', c.empresa||''].filter(Boolean).join(' • ');
    return {
      kind:'contact',
      title:c.nome||'—',
      meta:meta,
      raw:c
    };
  });
}
function getItemDescSuggestions(query){
  var q=normTxt(query);
  var mapa={};
  function pushDesc(desc,cat,tipo,cu,extra){
    var d=(desc||'').trim();
    if(!d) return;
    var k=normTxt(d);
    if(!k) return;
    if(!mapa[k]) mapa[k]={desc:d,cat:cat||'',tipo:tipo||'',cu:n2(cu||0),usos:0,un1:(extra&&extra.un1)||'',un2:(extra&&extra.un2)||''};
    mapa[k].usos++;
    if(!mapa[k].cat && cat) mapa[k].cat=cat;
    if(!mapa[k].tipo && tipo) mapa[k].tipo=tipo;
    if((!mapa[k].cu || mapa[k].cu<=0) && n2(cu||0)>0) mapa[k].cu=n2(cu||0);
    if(!mapa[k].un1 && extra && extra.un1) mapa[k].un1=extra.un1;
    if(!mapa[k].un2 && extra && extra.un2) mapa[k].un2=extra.un2;
  }
  (budg||[]).forEach(function(it){ pushDesc(it.desc,it.cat,it.t,it.cu,it); });
  (props||[]).slice().reverse().forEach(function(p){
    (p.bi||[]).forEach(function(it){ pushDesc(it.desc,it.cat,it.t,it.cu,it); });
  });
  return Object.keys(mapa).map(function(k){ return mapa[k]; }).filter(function(r){
    if(!q) return true;
    var hay=[r.desc,r.cat,r.tipo,fmtBRL(r.cu||0)].map(normTxt).join(' | ');
    return hay.indexOf(q)>=0;
  }).sort(function(a,b){
    if((b.usos||0)!==(a.usos||0)) return (b.usos||0)-(a.usos||0);
    if((b.cu||0)!==(a.cu||0)) return (b.cu||0)-(a.cu||0);
    return (a.desc||'').localeCompare(b.desc||'','pt-BR');
  }).slice(0,12).map(function(r){
    var tipo = r.tipo==='material' ? 'Material' : (r.tipo==='servico' ? 'Serviço' : 'Item');
    var meta=[tipo, r.cat||'Sem categoria', (r.usos||0)+' uso'+((r.usos||0)>1?'s':''), 'Custo: '+fmtBRL(r.cu||0)].join(' • ');
    return {kind:'itemdesc', title:r.desc, meta:meta, raw:r};
  });
}
function placeAutoBox(input){
  var box=ensureAutoBox();
  var r=input.getBoundingClientRect();
  box.style.left=Math.max(12, Math.round(r.left))+'px';
  box.style.top=Math.round(r.bottom+6)+'px';
  box.style.width=Math.max(320, Math.round(r.width))+'px';
}
function hideAutoBox(){
  var box=ensureAutoBox();
  box.style.display='none';
  box.innerHTML='';
  autoState={input:null, items:[], index:-1, kind:''};
}
function renderAutoItems(input, items, kind){
  var box=ensureAutoBox();
  autoState.input=input;
  autoState.items=items||[];
  autoState.index=-1;
  autoState.kind=kind||'';
  placeAutoBox(input);
  if(!items || !items.length){
    box.innerHTML='<div class="auto-empty">Nenhum cadastro encontrado ainda.</div>';
    box.style.display='block';
    return;
  }
  box.innerHTML=items.map(function(it,idx){
    return '<div class="auto-item" data-idx="'+idx+'">'
      +'<div class="auto-title">'+esc(it.title)+'</div>'
      +'<div class="auto-meta">'+esc(it.meta||'')+'</div>'
    +'</div>';
  }).join('');
  [].slice.call(box.querySelectorAll('.auto-item')).forEach(function(el){
    el.addEventListener('mousedown', function(ev){
      ev.preventDefault();
      var idx=parseInt(el.getAttribute('data-idx'),10);
      pickAutoItem(idx);
    });
  });
  box.style.display='block';
}
function applyCompanySelection(rec){
  if(!rec) return;
  if(Q('pCli')) Q('pCli').value=rec.empresa||'';
  if(Q('pCnpj')) Q('pCnpj').value=rec.cnpj||'';
  if(Q('pCid')) Q('pCid').value=rec.cidade||'';
  if(Q('pAC') && !Q('pAC').value && rec.contatos && rec.contatos[0]) Q('pAC').value=rec.contatos[0].nome||'';
  hideAutoBox();
}
function buildServiceLocDirectory(){
  var empresas={};
  (props||[]).forEach(function(p){
    var loc=(p.loc||'').trim();
    if(!loc) return;
    var key=normTxt(loc)+'|'+normTxt(p.locCnpj||'')+'|'+normTxt(p.csvc||'');
    if(!empresas[key]){
      empresas[key]={empresa:loc,cnpj:(p.locCnpj||'').trim(),cidade:(p.csvc||'').trim(),total:0,ultimaTs:0};
    }
    var emp=empresas[key];
    emp.total++;
    emp.ultimaTs=Math.max(emp.ultimaTs,n2(p.tsSaved||p.ts||0)||0);
  });
  return Object.keys(empresas).map(function(k){return empresas[k];}).sort(function(a,b){
    if((b.total||0)!==(a.total||0)) return (b.total||0)-(a.total||0);
    return (a.empresa||'').localeCompare(b.empresa||'','pt-BR');
  });
}
function getLocCompanySuggestions(query){
  var q=normTxt(query);
  return buildClientDirectory().filter(function(e){
    if(!q) return true;
    return [e.empresa,e.cnpj,e.cidade].map(normTxt).join(' | ').indexOf(q)>=0;
  }).slice(0,12).map(function(e){
    return {kind:'loc_company',title:e.empresa||'—',meta:[e.cnpj||'Sem CNPJ',e.cidade||'Sem cidade',(e.total||0)+' proposta(s)'].join(' • '),raw:e};
  });
}
function applyLocCompanySelection(rec){
  if(!rec) return;
  if(Q('pLoc')) Q('pLoc').value=rec.empresa||'';
  if(Q('pLocCnpj')) Q('pLocCnpj').value=rec.cnpj||'';
  if(Q('pCsv')) Q('pCsv').value=rec.cidade||'';
  hideAutoBox();
}
function applyContactSelection(rec){
  if(!rec) return;
  if(Q('pAC')) Q('pAC').value=rec.nome||'';
  if(Q('pDep')) Q('pDep').value=rec.departamento||'';
  if(Q('pMail')) Q('pMail').value=rec.email||'';
  if(Q('pTel')) Q('pTel').value=rec.tel||'';
  if(Q('pCli') && !Q('pCli').value && rec.empresa) Q('pCli').value=rec.empresa;
  if(Q('pCnpj') && !Q('pCnpj').value && rec.cnpj) Q('pCnpj').value=rec.cnpj;
  if(Q('pCid') && !Q('pCid').value && rec.cidade) Q('pCid').value=rec.cidade;
  hideAutoBox();
}
function applyItemDescSelection(rec){
  if(!rec) return;
  if(Q('iDesc')) Q('iDesc').value=rec.desc||'';
  if(Q('iTipo') && rec.tipo && Q('iTipo').value!==rec.tipo){
    Q('iTipo').value=rec.tipo;
    onTipo();
  }
  if(Q('iCU') && rec.cu!==undefined && rec.cu!==null && !isNaN(Number(rec.cu))) Q('iCU').value=n2(rec.cu);
  if(Q('iCat') && rec.cat) Q('iCat').value=rec.cat;
  if(rec.tipo==='material'){
    if(Q('iQtdUn') && rec.un1) Q('iQtdUn').value=rec.un1;
  }else{
    if(Q('iDiasUn') && rec.un1) Q('iDiasUn').value=rec.un1;
    if(Q('iHpdUn') && rec.un2) Q('iHpdUn').value=rec.un2;
    else if(Q('iHpdUn') && rec.un1 && !rec.un2) Q('iHpdUn').value=rec.un1;
  }
  hideAutoBox();
}
function pickAutoItem(idx){
  var it=autoState.items[idx];
  if(!it) return;
  if(it.kind==='company') applyCompanySelection(it.raw);
  if(it.kind==='loc_company') applyLocCompanySelection(it.raw);
  if(it.kind==='contact') applyContactSelection(it.raw);
  if(it.kind==='itemdesc') applyItemDescSelection(it.raw);
}
function moveAutoSelection(dir){
  var box=ensureAutoBox();
  if(box.style.display==='none' || !autoState.items.length) return;
  autoState.index += dir;
  if(autoState.index<0) autoState.index=autoState.items.length-1;
  if(autoState.index>=autoState.items.length) autoState.index=0;
  [].slice.call(box.querySelectorAll('.auto-item')).forEach(function(el,i){
    el.classList.toggle('on', i===autoState.index);
    if(i===autoState.index) el.scrollIntoView({block:'nearest'});
  });
}
function bindAutoInput(input, kind){
  if(!input || input.__autoBound) return;
  input.__autoBound=true;
  input.setAttribute('autocomplete','off');
  function openNow(){
    var items = kind==='company' ? getCompanySuggestions(input.value) : kind==='loc_company' ? getLocCompanySuggestions(input.value) : (kind==='contact' ? getContactSuggestions(input.value) : getItemDescSuggestions(input.value));
    renderAutoItems(input, items, kind);
  }
  input.addEventListener('focus', openNow);
  input.addEventListener('click', openNow);
  input.addEventListener('input', openNow);
  input.addEventListener('keydown', function(ev){
    var box=ensureAutoBox();
    if(ev.key==='ArrowDown'){ ev.preventDefault(); if(box.style.display==='none') openNow(); moveAutoSelection(1); }
    else if(ev.key==='ArrowUp'){ ev.preventDefault(); if(box.style.display==='none') openNow(); moveAutoSelection(-1); }
    else if(ev.key==='Enter'){
      if(box.style.display!=='none' && autoState.items.length){
        ev.preventDefault();
        pickAutoItem(autoState.index>=0 ? autoState.index : 0);
      }
    }else if(ev.key==='Escape'){
      hideAutoBox();
    }
  });
}
function initClientAutoComplete(){
  ensureAutoBox();
  bindAutoInput(Q('pCli'),'company');
  bindAutoInput(Q('pLoc'),'loc_company');
  bindAutoInput(Q('pAC'),'contact');
  bindAutoInput(Q('iDesc'),'itemdesc');
  window.addEventListener('resize', function(){
    if(autoState.input) placeAutoBox(autoState.input);
  });
  window.addEventListener('scroll', function(){
    if(autoState.input) placeAutoBox(autoState.input);
  }, true);
  document.addEventListener('click', function(ev){
    var box=ensureAutoBox();
    if(box.contains(ev.target)) return;
    if(ev.target===Q('pCli') || ev.target===Q('pLoc') || ev.target===Q('pAC') || ev.target===Q('iDesc')) return;
    hideAutoBox();
  });
}

function phaseKeysOrdered(){
  var keys=(PHASE_ORDER||[]).filter(function(k){ return FASE[k]; });
  Object.keys(FASE).forEach(function(k){ if(keys.indexOf(k)<0) keys.push(k); });
  return keys;
}
function renderPhaseControls(){
  var sel=Q('pFas');
  if(sel){
    sel.innerHTML=phaseKeysOrdered().map(function(k){
      return '<option value="'+k+'">'+FASE[k].n+'</option>';
    }).join('');
    if(!sel.value || !FASE[sel.value]) sel.value='em_elaboracao';
  }
  var regFas=Q('regFas');
  if(regFas){
    var cur=regFas.value;
    regFas.innerHTML='<option value="">Todas as fases</option>'
      +phaseKeysOrdered().map(function(k){
        return '<option value="'+k+'">'+FASE[k].n+'</option>';
      }).join('');
    if(cur) regFas.value=cur;
  }
  var wrap=Q('phaseFilters');
  if(wrap){
    wrap.innerHTML='<span class="ftg on" data-phase="all" onclick="flt(\'all\',this)">Todas</span>'
      + phaseKeysOrdered().map(function(k){
          return '<span class="ftg" data-phase="'+k+'" onclick="flt(\''+k+'\',this)">'+esc(FASE[k].n)+'</span>';
        }).join('');
  }
}
function proposalFormHasMeaningfulData(){
  var ids=['pCli','pCnpj','pCid','pAC','pDep','pMail','pTel','pLoc','pCsv','pTit','pRes'];
  for(var i=0;i<ids.length;i++){
    var el=Q(ids[i]);
    if(el && String(el.value||'').trim()) return true;
  }
  return false;
}
function buildCurrentProposalSnapshot(){
  var num=(Q('pNum').value||'').trim(),cli=(Q('pCli').value||'').trim();
  var dv=Q('pDat').value;
  var df=dv?new Date(dv+'T12:00:00').toLocaleDateString('pt-BR'):new Date().toLocaleDateString('pt-BR');
  var vs=n2(Q('vS').value),vm=n2(Q('vM').value);
  var vdS=n2(Q('vDSval')&&Q('vDSval').value)||0;
  var vdM=n2(Q('vDMval')&&Q('vDMval').value)||0;
  var vd=vdS+vdM;
  if(Q('vD'))Q('vD').value=vd.toFixed(2);
  return {
    id:editId||uid(),num:num,cli:cli,dat:df,dat2:dv,
    dtFech:Q('pDatFech')&&Q('pDatFech').value||'',
    revAtual:Q('pRevAtual')&&Q('pRevAtual').value||'',
    fas:(Q('pFas')&&Q('pFas').value)||'em_elaboracao',tsSaved:Date.now(),
    cnpj:Q('pCnpj').value||'',cid:Q('pCid').value||'',ac:Q('pAC').value||'',
    dep:Q('pDep').value||'',mail:Q('pMail').value||'',tel:Q('pTel').value||'',
    loc:Q('pLoc').value||'',locCnpj:Q('pLocCnpj')&&Q('pLocCnpj').value||'',
    csvc:Q('pCsv').value||'',tit:Q('pTit').value||'',
    ac2:Q('pAC2')&&Q('pAC2').value||'',dep2:Q('pDep2')&&Q('pDep2').value||'',
    mail2:Q('pMail2')&&Q('pMail2').value||'',tel2:Q('pTel2')&&Q('pTel2').value||'',
    area:Q('pArea')&&Q('pArea').value||'',equip:Q('pEquip')&&Q('pEquip').value||'',
    tensVal:Q('pTensVal')&&Q('pTensVal').value||'',tensCmd:Q('pTensCmd')&&Q('pTensCmd').value||'',
    tens:['pT1F','pT2F','pT3F','pTN','pTPE'].filter(function(id){return Q(id)&&Q(id).checked;}),
    fu1dat:Q('fu1dat')&&Q('fu1dat').value||'', fu1desc:Q('fu1desc')&&Q('fu1desc').value||'',
    fu2dat:Q('fu2dat')&&Q('fu2dat').value||'', fu2desc:Q('fu2desc')&&Q('fu2desc').value||'',
    fu3dat:Q('fu3dat')&&Q('fu3dat').value||'', fu3desc:Q('fu3desc')&&Q('fu3desc').value||'',
    fu4dat:Q('fu4dat')&&Q('fu4dat').value||'', fu4desc:Q('fu4desc')&&Q('fu4desc').value||'',
    res:Q('pRes').value||'',vS:vs,vM:vm,vD:vd,vDS:vdS,vDM:vdM,val:vs+vm-vd,
    prz:'',przI:'',przF:'',val2:'',gar:'',pag:'',cforn:'',imp:'',
    ts:[],esc:JSON.parse(JSON.stringify(escSecs)),bi:JSON.parse(JSON.stringify(budg)),revs:JSON.parse(JSON.stringify(revs)),
    log:(function(){ var _p=props.find(function(x){return x.id===editId;}); return (_p&&_p.log)?JSON.parse(JSON.stringify(_p.log)):{hist:[],relat:[]}; })(),
    gantt:(function(){ var _p=props.find(function(x){return x.id===editId;}); var _src=_p&&_p.gantt?_p.gantt:(_tempGantt||null); var _g=_src?JSON.parse(JSON.stringify(_src)):{inicio:'',fases:[],trabSab:false,trabDom:false,feriados:[]}; if(_g.trabSab===undefined)_g.trabSab=false; if(_g.trabDom===undefined)_g.trabDom=false; if(!_g.feriados)_g.feriados=[]; return _g; })(),
    stages:(function(){ var _p=props.find(function(x){return x.id===editId;}); return (_p&&_p.stages)?JSON.parse(JSON.stringify(_p.stages)):(typeof criarStagesVazios==='function'?criarStagesVazios():{}); })(),
    prc:(function(){ var c=getPrcAtual(); return {s:JSON.parse(JSON.stringify(c.s)),m:JSON.parse(JSON.stringify(c.m))}; })(),
    tl:(function(){
      var _p=props.find(function(x){return x.id===editId;});
      var _prev=(_p&&_p.tl)?JSON.parse(JSON.stringify(_p.tl)):{nfs:[],adiantamentos:[]};
      return {
        dtVisita:    Q('tlDtVisita')&&Q('tlDtVisita').value||'',
        dtEnvio:     Q('tlDtEnvio')&&Q('tlDtEnvio').value||'',
        canal:       Q('tlCanal')&&Q('tlCanal').value||'',
        dtInicioExec:Q('tlDtInicioExec')&&Q('tlDtInicioExec').value||'',
        dtTermino:   Q('tlDtTermino')&&Q('tlDtTermino').value||'',
        dtAceite:    Q('tlDtAceite')&&Q('tlDtAceite').value||'',
        dtRecebFinal:Q('tlDtRecebFinal')&&Q('tlDtRecebFinal').value||'',
        valRecebFinal:parseFloat(Q('tlValRecebFinal')&&Q('tlValRecebFinal').value)||0,
        prazoPgto:   Q('tlPrazoPgto')&&Q('tlPrazoPgto').value||'',
        adiantPct:   parseFloat(Q('tlAdiantPct')&&Q('tlAdiantPct').value)||0,
        nfs:         JSON.parse(JSON.stringify(_tlNFs)),
        adiantamentos:JSON.parse(JSON.stringify(_tlAdiantamentos))
      };
    })(),
    aliq:{
      nfS: Q('aNFS')&&Q('aNFS').value!=='' ? parseFloat((n2(Q('aNFS').value)/100).toFixed(5)) : null,
      nfM: Q('aNFM')&&Q('aNFM').value!=='' ? parseFloat((n2(Q('aNFM').value)/100).toFixed(5)) : null,
      rS:  Q('aRS') &&Q('aRS').value!==''  ? parseFloat((n2(Q('aRS').value) /100).toFixed(5)) : null,
      comS:Q('aComS')&&Q('aComS').value!==''? parseFloat((n2(Q('aComS').value)/100).toFixed(5)): null,
      comM:Q('aComM')&&Q('aComM').value!==''? parseFloat((n2(Q('aComM').value)/100).toFixed(5)): null,
      neg: Q('aNeg') &&Q('aNeg').value!=='' ? parseFloat((n2(Q('aNeg').value) /100).toFixed(5)) : null,
      fechadoSemDesc: Q('aNegZero')&&Q('aNegZero').checked ? true : false
    }
  };
}
function upsertCurrentDraft(silent){
  if(!proposalFormHasMeaningfulData()) return;
  var sn=buildCurrentProposalSnapshot();
  var idx=props.findIndex(function(x){return x.id===sn.id});
  if(idx>=0) props[idx]=sn; else props.push(sn);
  editId=sn.id;
  _tempGantt=null; // agora está em props[idx].gantt — libera temp
  saveAll();
  rDash();
  if(!silent) toast('✔ Rascunho atualizado!','ok');
}
var autoDraftTimer=null;
function scheduleDraftSave(){
  if(_vizModeState) return; // não salva enquanto em modo leitura
  clearTimeout(autoDraftTimer);
  autoDraftTimer=setTimeout(function(){ upsertCurrentDraft(true); }, 350);
}
var _FAS_LOG=['cancelada','virou_outra_proposta'];
function bindProposalDraftAutoSave(){
  ['pCli','pCnpj','pCid','pAC','pDep','pMail','pTel','pLoc','pCsv','pTit','pRes','pDat','pDatFech','pRevAtual','pFas','vS','vM','vDSval','vDMval','vDSpct','vDMpct'].forEach(function(id){
    var el=Q(id); if(!el || el.__draftBound) return;
    el.__draftBound=true;
    el.addEventListener('input', scheduleDraftSave);
    el.addEventListener('change', scheduleDraftSave);
  });
  var pFasEl=Q('pFas');
  if(pFasEl && !pFasEl.__logBound){
    pFasEl.__logBound=true;
    pFasEl.addEventListener('change',function(){
      if(_FAS_LOG.indexOf(this.value)>=0){
        setTimeout(function(){ abrirLog(); }, 400);
      }
    });
  }
}

// INIT
document.addEventListener('DOMContentLoaded',function(){
  loadAll();
  renderPhaseControls();
  loadAliqUI();
  rRevs();
  setNextProposalNumber(false);
  resetProposalForm();
  rDash();rT();rS();refCat();rEsc();
  initClientAutoComplete();
  bindProposalDraftAutoSave();
  if(Q('eTS')) Q('eTS').addEventListener('change',onTC);
  if(Q('eSS')) Q('eSS').addEventListener('change',onSC);
  if(Q('eTF')) Q('eTF').addEventListener('input',rT);
  if(Q('eSF')) Q('eSF').addEventListener('input',rS);
  beLoadDB();

  // Salva rascunho no localStorage antes de qualquer refresh/fechamento de aba
  window.addEventListener('beforeunload', function(){
    try{
      if(typeof proposalFormHasMeaningfulData==='function' && proposalFormHasMeaningfulData()){
        var sn=buildCurrentProposalSnapshot();
        var idx=props.findIndex(function(x){return x.id===sn.id;});
        if(idx>=0) props[idx]=sn; else props.push(sn);
        LS('tf_props', props);
      }
    }catch(e){}
  });
});
// ══════════════════════════════════════════════
// ANÁLISE FINANCEIRA
// ══════════════════════════════════════════════
function rAnalise(){
  // Popular select com propostas
  var sel=Q('anProp');
  var cur=sel.value;
  sel.innerHTML='<option value="">— Selecione uma proposta —</option>';
  props.forEach(function(p){
    var o=document.createElement('option');
    o.value=p.id;
    o.textContent='#'+p.num+' — '+p.cli+(p.tit?' | '+p.tit:'');
    sel.appendChild(o);
  });
  if(cur) sel.value=cur;
  if(!sel.value){
    Q('anSemaforo').innerHTML='<p style="color:var(--text3);text-align:center;padding:2rem">Selecione uma proposta para ver a análise financeira.</p>';
    Q('anExtrato').innerHTML='';
    Q('anDre').innerHTML='';
    Q('btnAcessarProp').style.display='none';
    return;
  }
  Q('btnAcessarProp').style.display='inline-flex';
  var p=props.find(function(x){return x.id===sel.value});
  if(!p){return;}
  gerarExtrato(p);
}


function acessarPropAnalise(){
  var id=Q('anProp').value;
  if(!id)return;
  editP(id);
}
function showAnTab(tab){
  Q('anExtrato').style.display  = tab==='extrato'  ? 'block' : 'none';
  Q('anDre').style.display      = tab==='dre'      ? 'block' : 'none';
  Q('anGraficos').style.display = tab==='graficos' ? 'block' : 'none';
  Q('tabExtrato').className  = 'btn '+(tab==='extrato' ?'bp':'bg')+' bsm';
  Q('tabDre').className      = 'btn '+(tab==='dre'     ?'bp':'bg')+' bsm';
  Q('tabGraficos').className = 'btn '+(tab==='graficos'?'bp':'bg')+' bsm';
  if(tab==='graficos') renderGraficos();
}


// ══════════════════════════════════════════════
// GRÁFICOS POR CATEGORIA
// ══════════════════════════════════════════════

// Engine de desenho nos canvas (aceita IDs ou objetos canvas)
function renderGraficosEmEl(idPizza, idBarra, callback){
  var pid=Q('anProp').value;
  var p=props.find(function(x){return x.id===pid});
  if(!p){ if(callback) callback(); return; }
  var budgP=(editId&&editId===p.id&&budg&&budg.length)?budg:(p.bi||[]);
  var catMap={}, totalPV=0;
  budgP.forEach(function(it){
    if(it.inc===false) return;
    var cat=it.cat||'Outros';
    if(!catMap[cat]) catMap[cat]={pv:0,cu:0,count:0,tipo:it.t};
    catMap[cat].pv+=n2(it.pvt); catMap[cat].cu+=n2(it.cu)*n2(it.mult);
    catMap[cat].count++; totalPV+=n2(it.pvt);
  });
  var cats=Object.keys(catMap).sort(function(a,b){return catMap[b].pv-catMap[a].pv;});
  var cores=['#58a6ff','#bc8cff','#3fb950','#d4a017','#f97316','#f85149','#79c0ff','#d2a8ff','#56d364','#e3b341','#ffa657','#ff7b72','#00bcd4','#9c27b0','#ff5722','#607d8b'];

  var cv=document.getElementById(idPizza);
  if(cv&&cv.getContext&&totalPV>0){
    var ctx=cv.getContext('2d'), W=cv.width, H=cv.height;
    var R=Math.min(W,H)/2-10;
    var cx=W/2, cy=H/2;
    ctx.clearRect(0,0,W,H);
    var start=-Math.PI/2;

    // Primeiro passo: desenhar fatias
    cats.forEach(function(cat,i){
      var slice=(catMap[cat].pv/totalPV)*Math.PI*2;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,R,start,start+slice); ctx.closePath();
      ctx.fillStyle=cores[i%cores.length]; ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=1.5; ctx.stroke();
      start+=slice;
    });

    // Segundo passo: textos nas fatias (% + nome curto se couber)
    start=-Math.PI/2;
    cats.forEach(function(cat,i){
      var slice=(catMap[cat].pv/totalPV)*Math.PI*2;
      var pct=(catMap[cat].pv/totalPV*100);
      var mid=start+slice/2;
      if(pct>5){
        var rx=cx+Math.cos(mid)*(R*0.62), ry=cy+Math.sin(mid)*(R*0.62);
        ctx.shadowColor='rgba(0,0,0,.8)'; ctx.shadowBlur=3;
        ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle';
        // Nome abreviado + %
        var abrev=cat.length>6?cat.slice(0,5)+'…':cat;
        if(pct>12){
          ctx.font='bold 11px sans-serif';
          ctx.fillText(abrev, rx, ry-6);
          ctx.font='10px sans-serif';
          ctx.fillText(pct.toFixed(0)+'%', rx, ry+7);
        } else {
          ctx.font='bold 11px sans-serif';
          ctx.fillText(pct.toFixed(0)+'%', rx, ry);
        }
        ctx.shadowBlur=0;
      }
      start+=slice;
    });

    // ── Legenda HTML abaixo do canvas (grid 2 colunas) ──
    var legDiv=document.getElementById(idPizza+'Legenda');
    if(legDiv){
      var legHtml='';
      cats.forEach(function(cat,i){
        var d=catMap[cat];
        var pct=(d.pv/totalPV*100).toFixed(1);
        var cor=cores[i%cores.length];
        legHtml+='<div style="display:flex;align-items:center;gap:.35rem;min-width:0" title="'+cat+': R$ '+d.pv.toFixed(2)+' ('+pct+'%)">'
          +'<span style="display:inline-block;width:10px;height:10px;border-radius:2px;flex-shrink:0;background:'+cor+'"></span>'
          +'<span style="font-size:.71rem;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:90px">'+esc(cat)+'</span>'
          +'<span style="font-size:.68rem;color:var(--text3);white-space:nowrap;margin-left:auto">'+pct+'%</span>'
        +'</div>';
      });
      legDiv.innerHTML=legHtml;
    }
  }

  var cv2=document.getElementById(idBarra);
  if(cv2&&cv2.getContext&&cats.length){
    var ctx2=cv2.getContext('2d'), W2=cv2.width, H2=cv2.height;
    ctx2.clearRect(0,0,W2,H2);
    var n=Math.min(cats.length,8);
    // Espaço para nomes abaixo: 2 linhas de 11px + margem
    var pad={l:10,r:10,t:22,b:54};
    var chartH=H2-pad.t-pad.b;
    var groupW=(W2-pad.l-pad.r)/n;
    var bw=Math.min(groupW*0.36, 22);
    var maxVal=0;
    cats.slice(0,n).forEach(function(c){maxVal=Math.max(maxVal,catMap[c].pv,catMap[c].cu);});
    if(!maxVal) maxVal=1;
    // Linhas de grade sutis
    ctx2.strokeStyle='rgba(255,255,255,.08)'; ctx2.lineWidth=1;
    [0.25,0.5,0.75,1].forEach(function(f){
      var y=pad.t+chartH*(1-f);
      ctx2.beginPath(); ctx2.moveTo(pad.l,y); ctx2.lineTo(W2-pad.r,y); ctx2.stroke();
    });
    // Barras + nomes
    cats.slice(0,n).forEach(function(cat,i){
      var d=catMap[cat];
      var gcx=pad.l+i*groupW+groupW/2; // centro do grupo
      var gx=gcx-bw-1;                 // início barra PV
      var hPV=Math.max(2,(d.pv/maxVal)*chartH);
      var hCU=Math.max(d.cu>0?2:0,(d.cu/maxVal)*chartH);
      // Barra PV
      ctx2.fillStyle=cores[i%cores.length];
      ctx2.beginPath();
      ctx2.roundRect ? ctx2.roundRect(gx, pad.t+chartH-hPV, bw, hPV, [3,3,0,0])
                     : ctx2.rect(gx, pad.t+chartH-hPV, bw, hPV);
      ctx2.fill();
      // Barra Custo
      ctx2.fillStyle='rgba(200,200,200,.28)';
      ctx2.beginPath();
      ctx2.roundRect ? ctx2.roundRect(gcx+1, pad.t+chartH-hCU, bw, hCU, [3,3,0,0])
                     : ctx2.rect(gcx+1, pad.t+chartH-hCU, bw, hCU);
      ctx2.fill();
      // Nome da categoria abaixo (2 linhas se necessário)
      var baseY=pad.t+chartH+6;
      ctx2.fillStyle='rgba(255,255,255,.85)';
      ctx2.font='bold 9px sans-serif';
      ctx2.textAlign='center';
      ctx2.textBaseline='top';
      // Quebrar nome em 2 partes se longo
      var nm=cat;
      var w1=ctx2.measureText(nm).width;
      var maxW=groupW-2;
      if(w1<=maxW){
        ctx2.fillText(nm, gcx, baseY);
      } else {
        // Tentar dividir por espaço
        var parts=nm.split(' ');
        if(parts.length>1){
          var l1=parts.slice(0,Math.ceil(parts.length/2)).join(' ');
          var l2=parts.slice(Math.ceil(parts.length/2)).join(' ');
          // Se l1 ainda longo, truncar
          while(ctx2.measureText(l1).width>maxW && l1.length>4) l1=l1.slice(0,-2)+'…';
          while(ctx2.measureText(l2).width>maxW && l2.length>4) l2=l2.slice(0,-2)+'…';
          ctx2.fillText(l1, gcx, baseY);
          ctx2.fillText(l2, gcx, baseY+11);
        } else {
          var trunc=nm;
          while(ctx2.measureText(trunc).width>maxW && trunc.length>3) trunc=trunc.slice(0,-1);
          if(trunc!==nm) trunc=trunc.slice(0,-1)+'…';
          ctx2.fillText(trunc, gcx, baseY);
        }
      }
    });
    // Linha base
    ctx2.strokeStyle='rgba(255,255,255,.25)'; ctx2.lineWidth=1;
    ctx2.beginPath(); ctx2.moveTo(pad.l,pad.t+chartH); ctx2.lineTo(W2-pad.r,pad.t+chartH); ctx2.stroke();
    // Legenda ■ PV / ■ Custo no topo
    var lx0=W2-120;
    ctx2.fillStyle='rgba(88,166,255,.9)'; ctx2.fillRect(lx0,5,10,10);
    ctx2.fillStyle='rgba(255,255,255,.8)'; ctx2.font='10px sans-serif'; ctx2.textAlign='left'; ctx2.textBaseline='top';
    ctx2.fillText('PV', lx0+13, 5);
    ctx2.fillStyle='rgba(200,200,200,.45)'; ctx2.fillRect(lx0+38,5,10,10);
    ctx2.fillStyle='rgba(255,255,255,.8)';
    ctx2.fillText('Custo', lx0+51, 5);
  }
  if(callback) setTimeout(callback, 20);
}

function renderGraficos(){
  var pid = Q('anProp').value;
  var p = props.find(function(x){return x.id===pid});
  if(!p){ Q('anGraficos').innerHTML='<p style="color:var(--text3);padding:2rem;text-align:center">Selecione uma proposta.</p>'; return; }

  var budgP = (editId && editId===p.id && budg && budg.length) ? budg : (p.bi||[]);

  // ── Agrupar por categoria ──
  var catMap={};
  var totalPV=0;
  budgP.forEach(function(it){
    if(it.inc===false) return;
    var cat = it.cat||'Outros';
    if(!catMap[cat]) catMap[cat]={pv:0,cu:0,count:0,tipo:it.t};
    catMap[cat].pv += n2(it.pvt);
    catMap[cat].cu += n2(it.cu)*n2(it.mult);
    catMap[cat].count++;
    totalPV += n2(it.pvt);
  });

  var cats = Object.keys(catMap).sort(function(a,b){ return catMap[b].pv-catMap[a].pv; });

  if(!cats.length){
    Q('anGraficos').innerHTML='<p style="color:var(--text3);padding:2rem;text-align:center">Nenhum item de orçamento nesta proposta.</p>';
    return;
  }

  // Paleta de cores
  var cores=['#58a6ff','#bc8cff','#3fb950','#d4a017','#f97316','#f85149','#79c0ff','#d2a8ff','#56d364','#e3b341','#ffa657','#ff7b72','#00bcd4','#9c27b0','#ff5722','#607d8b'];

  // ── Layout HTML dos gráficos ──
  var html = '<div style="padding:.5rem 0">';

  // Título
  html += '<div style="font-size:.9rem;font-weight:700;color:var(--accent);margin-bottom:1rem;padding-bottom:.4rem;border-bottom:1px solid var(--border)">📊 Análise por Categoria — #'+esc(p.num||'')+' | '+esc(p.cli||'')+'</div>';

  // ── Grid: pizza (com legenda HTML) + barra ──
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1.2rem;margin-bottom:1.2rem">';

  // Canvas Pizza + legenda HTML abaixo
  html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem">'
    +'<div style="font-size:.78rem;font-weight:700;color:var(--text2);margin-bottom:.5rem;text-align:center">💰 PV por Categoria</div>'
    +'<canvas id="grafPizza" width="260" height="220" style="display:block;margin:0 auto"></canvas>'
    +'<div id="grafPizzaLegenda" style="margin-top:.6rem;display:grid;grid-template-columns:1fr 1fr;gap:.25rem .8rem"></div>'
    +'</div>';

  // Canvas Barras (PV vs Custo por categoria)
  html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem">'
    +'<div style="font-size:.78rem;font-weight:700;color:var(--text2);margin-bottom:.6rem;text-align:center">📊 PV × Custo por Categoria</div>'
    +'<canvas id="grafBarra" width="360" height="260" style="display:block;margin:0 auto;max-width:100%"></canvas>'
    +'</div>';

  html += '</div>'; // fim grid

  // ── Tabela detalhada por categoria ──
  html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem;margin-bottom:1rem">'
    +'<div style="font-size:.78rem;font-weight:700;color:var(--text2);margin-bottom:.6rem">📋 Tabela por Categoria</div>'
    +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8rem">'
    +'<thead><tr style="border-bottom:2px solid var(--border)">'
    +'<th style="text-align:left;padding:.35rem .5rem;color:var(--text3)">#</th>'
    +'<th style="text-align:left;padding:.35rem .5rem;color:var(--text3)">Categoria</th>'
    +'<th style="text-align:center;padding:.35rem .5rem;color:var(--text3)">Tipo</th>'
    +'<th style="text-align:right;padding:.35rem .5rem;color:var(--text3)">PV Total</th>'
    +'<th style="text-align:right;padding:.35rem .5rem;color:var(--text3)">Custo</th>'
    +'<th style="text-align:right;padding:.35rem .5rem;color:var(--text3)">Margem Bruta</th>'
    +'<th style="text-align:right;padding:.35rem .5rem;color:var(--text3)">% do Total</th>'
    +'<th style="text-align:center;padding:.35rem .5rem;color:var(--text3)">Qtd Itens</th>'
    +'</tr></thead><tbody>';

  cats.forEach(function(cat,i){
    var d = catMap[cat];
    var mb = d.pv - d.cu;
    var mbPct = d.pv>0?(mb/d.pv*100):0;
    var pctTotal = totalPV>0?(d.pv/totalPV*100):0;
    var cor = cores[i%cores.length];
    var mbCor = mb>=0?'#3fb950':'#f85149';
    html += '<tr style="border-bottom:1px solid rgba(255,255,255,.04)">'
      +'<td style="padding:.3rem .5rem"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+cor+'"></span></td>'
      +'<td style="padding:.3rem .5rem;font-weight:600">'+esc(cat)+'</td>'
      +'<td style="padding:.3rem .5rem;text-align:center"><span style="font-size:.65rem;padding:.1rem .3rem;border-radius:3px;background:'+(d.tipo==='material'?'rgba(188,140,255,.15)':'rgba(88,166,255,.15)')+';color:'+(d.tipo==='material'?'#bc8cff':'#58a6ff')+'">'+(d.tipo==='material'?'Mat':'Svc')+'</span></td>'
      +'<td style="padding:.3rem .5rem;text-align:right;color:'+cor+';font-weight:700">'+money(d.pv)+'</td>'
      +'<td style="padding:.3rem .5rem;text-align:right;color:var(--text2)">'+money(d.cu)+'</td>'
      +'<td style="padding:.3rem .5rem;text-align:right;color:'+mbCor+'">'+money(mb)+' <span style="font-size:.68rem">('+mbPct.toFixed(1)+'%)</span></td>'
      +'<td style="padding:.3rem .5rem;text-align:right">'
        +'<div style="display:flex;align-items:center;gap:.3rem;justify-content:flex-end">'
          +'<div style="width:60px;height:6px;background:var(--bg2);border-radius:3px;overflow:hidden">'
            +'<div style="width:'+Math.min(100,pctTotal).toFixed(1)+'%;height:100%;background:'+cor+'"></div>'
          +'</div>'
          +'<span style="font-size:.72rem">'+pctTotal.toFixed(1)+'%</span>'
        +'</div>'
      +'</td>'
      +'<td style="padding:.3rem .5rem;text-align:center;color:var(--text3)">'+d.count+'</td>'
      +'</tr>';
  });

  // Total
  var totalCu=0; cats.forEach(function(c){totalCu+=catMap[c].cu;});
  var totalMb=totalPV-totalCu;
  html += '<tr style="border-top:2px solid var(--border);background:var(--bg2)">'
    +'<td colspan="3" style="padding:.4rem .5rem;font-weight:700;color:var(--accent)">TOTAL</td>'
    +'<td style="padding:.4rem .5rem;text-align:right;font-weight:700;color:#58a6ff">'+money(totalPV)+'</td>'
    +'<td style="padding:.4rem .5rem;text-align:right;font-weight:700">'+money(totalCu)+'</td>'
    +'<td style="padding:.4rem .5rem;text-align:right;font-weight:700;color:'+(totalMb>=0?'#3fb950':'#f85149')+'">'+money(totalMb)+'</td>'
    +'<td colspan="2" style="padding:.4rem .5rem;text-align:right;color:var(--text3)">100%</td>'
    +'</tr>';

  html += '</tbody></table></div></div>';

  // ── Gráfico de serviços vs materiais ──
  var cfg2=getPrc(), propAliq2=p.aliq||{};
  var nfS2  = propAliq2.nfS  != null ? propAliq2.nfS  : (cfg2.aliq.nfS  != null ? cfg2.aliq.nfS  : 0.15);
  var nfM2  = propAliq2.nfM  != null ? propAliq2.nfM  : (cfg2.aliq.nfM  != null ? cfg2.aliq.nfM  : 0.15);
  var rs2   = propAliq2.rS   != null ? propAliq2.rS   : (cfg2.aliq.rS   != null ? cfg2.aliq.rS   : 0.041);
  var comS2 = propAliq2.comS != null ? propAliq2.comS : (cfg2.aliq.comS != null ? cfg2.aliq.comS : 0.05);
  var comM2 = propAliq2.comM != null ? propAliq2.comM : (cfg2.aliq.comM != null ? cfg2.aliq.comM : 0.03);
  var neg2  = propAliq2.neg  != null ? propAliq2.neg  : (cfg2.aliq.neg  != null ? cfg2.aliq.neg  : 0.05);
  var descS2 = n2(p.vDS||0), descM2 = n2(p.vDM||0);

  var pvSvc=0,pvMat=0,cuSvc=0,cuMat=0,cuTercSvc=0,cuTercMat=0;
  budgP.forEach(function(it){
    if(it.inc===false) return;
    var cuItem=n2(it.cu)*n2(it.mult);
    if(it.t==='material'){
      pvMat+=n2(it.pvt);
      if(it.terc===true) cuTercMat+=cuItem;
      else if(it.terc!==false) cuMat+=cuItem;
    }else{
      pvSvc+=n2(it.pvt);
      if(it.terc===true) cuTercSvc+=cuItem;
      else if(it.terc!==false) cuSvc+=cuItem;
    }
  });

  var recSliq2=Math.max(0,pvSvc-descS2), recMliq2=Math.max(0,pvMat-descM2);
  var dNFS2=recSliq2*nfS2, dNFM2=recMliq2*nfM2;
  var pvTot2=recSliq2+recMliq2;
  var dRSs2=pvTot2>0?(pvTot2*rs2)*(recSliq2/pvTot2):0;
  var dRSm2=pvTot2>0?(pvTot2*rs2)*(recMliq2/pvTot2):0;
  var dComS2=recSliq2*comS2, dComM2=recMliq2*comM2;
  var llSvc2=recSliq2-(cuSvc+cuTercSvc)-dNFS2-dComS2-dRSs2;
  var llMat2=recMliq2-(cuMat+cuTercMat)-dNFM2-dComM2-dRSm2;
  var llSvcPct2=recSliq2>0?(llSvc2/recSliq2*100):0;
  var llMatPct2=recMliq2>0?(llMat2/recMliq2*100):0;

  html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem">'
    +'<div style="font-size:.78rem;font-weight:700;color:var(--text2);margin-bottom:.6rem">🔵 Lucro Bruto Serviços vs 🟣 Lucro Bruto Materiais</div>'
    +'<div style="display:flex;gap:1.5rem;flex-wrap:wrap">';

  function miniCard(label, lucro, recLiq, custoTotalLocal, pctLucro, cor){
    return '<div style="flex:1;min-width:160px;background:var(--bg2);border-radius:var(--r2);padding:.7rem .9rem;border-left:3px solid '+cor+'">'
      +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.3rem">'+label+'</div>'
      +'<div style="font-size:1rem;font-weight:700;color:'+cor+'">'+money(lucro)+'</div>'
      +'<div style="font-size:.72rem;color:var(--text2);margin-top:.2rem">Receita líquida: '+money(recLiq)+' | Custo: '+money(custoTotalLocal)+' | Lucro: <span style="color:'+(lucro>=0?'#3fb950':'#f85149')+'">'+pctLucro.toFixed(1)+'%</span></div>'
      +'</div>';
  }

  if(pvSvc>0) html+=miniCard('🔵 Lucro Bruto Serviços', llSvc2, recSliq2, (cuSvc+cuTercSvc), llSvcPct2, '#58a6ff');
  if(pvMat>0) html+=miniCard('🟣 Lucro Bruto Materiais', llMat2, recMliq2, (cuMat+cuTercMat), llMatPct2, '#bc8cff');
  if(pvSvc>0&&pvMat>0){
    var pctSvc=totalPV>0?(pvSvc/totalPV*100):0;
    var pctMat=totalPV>0?(pvMat/totalPV*100):0;
    html+='<div style="flex:1;min-width:160px;background:var(--bg2);border-radius:var(--r2);padding:.7rem .9rem">'
      +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.3rem">Proporção</div>'
      +'<div style="height:12px;border-radius:6px;overflow:hidden;display:flex;margin-bottom:.3rem">'
        +'<div style="width:'+pctSvc.toFixed(1)+'%;background:#58a6ff"></div>'
        +'<div style="width:'+pctMat.toFixed(1)+'%;background:#bc8cff"></div>'
      +'</div>'
      +'<div style="font-size:.7rem;color:var(--text2)">🔵 '+pctSvc.toFixed(1)+'% Svc &nbsp; 🟣 '+pctMat.toFixed(1)+'% Mat</div>'
      +'</div>';
  }

  html += '</div></div>';
  html += '</div>'; // fim container

  Q('anGraficos').innerHTML = html;

  // Desenhar canvas usando a engine reutilizável
  setTimeout(function(){ renderGraficosEmEl('grafPizza','grafBarra',null); }, 80);
}


// ══════════════════════════════════════════════
// IMPRIMIR TUDO: Proposta + DRE + Gráficos
// ══════════════════════════════════════════════
function printTudo(){
  var pid=Q('anProp').value;
  if(!pid){ toast('Selecione uma proposta na Análise.','err'); return; }
  var p=props.find(function(x){return x.id===pid});
  if(!p){ toast('Proposta não encontrada.','err'); return; }

  // 1) Garante que gráficos estejam renderizados
  function _executar(){
    // ── Capturar canvas ──
    var _cvP=document.getElementById('grafPizza')||document.getElementById('_tmpPizza');
    var _cvB=document.getElementById('grafBarra')||document.getElementById('_tmpBarra');
    var img64P=(_cvP&&_cvP.toDataURL&&_cvP.width>0&&_cvP.height>0)?_cvP.toDataURL('image/png'):'';
    var img64B=(_cvB&&_cvB.toDataURL&&_cvB.width>0&&_cvB.height>0)?_cvB.toDataURL('image/png'):'';

    // ── Gerar HTML da proposta formal (genPrev) ──
    // Usamos editId temporário para gerar o preview da proposta certa
    var savedEdit=editId;
    editId=pid;
    // Forçar budg da proposta
    var savedBudg=budg.slice();
    budg=(p.bi||[]).slice();
    var propostaPages='';
    try{
      // genPrev() escreve no pvWrap; capturamos o innerHTML depois
      genPrev();
      propostaPages='<div style="max-width:794px;margin:0 auto;padding:25mm 19mm 16mm 19mm;font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.6;color:#1a1a1a">'+(Q('pvWrap').innerHTML||'')+'</div>';
    }catch(e){ propostaPages='<p>Erro ao gerar proposta: '+e.message+'</p>'; }
    editId=savedEdit;
    budg=savedBudg;

    // ── Gerar DRE ──
    var dreHtml=Q('anDre').innerHTML||Q('anExtrato').innerHTML||'';

    // ── Gerar página de gráficos ──
    var budgP2=(p.bi||[]);
    var catMap2={}, totalPV2=0;
    budgP2.forEach(function(it){
      if(it.inc===false) return;
      var cat=it.cat||'Outros';
      if(!catMap2[cat]) catMap2[cat]={pv:0,cu:0,count:0,tipo:it.t};
      catMap2[cat].pv+=n2(it.pvt); catMap2[cat].cu+=n2(it.cu)*n2(it.mult);
      catMap2[cat].count++; totalPV2+=n2(it.pvt);
    });
    var cats2=Object.keys(catMap2).sort(function(a,b){return catMap2[b].pv-catMap2[a].pv;});
    var cores2=['#1a6b1a','#3a5fa0','#8b4513','#a0522d','#2e8b57','#6a3d9a','#b8860b','#4682b4','#c0392b','#16a085','#7d3c98','#1f618d','#d35400','#117a65','#2e4057'];
    var pvSvc2=0,pvMat2=0,cuSvc2=0,cuMat2=0;
    budgP2.forEach(function(it){
      if(it.inc===false) return;
      if(it.t==='material'){pvMat2+=n2(it.pvt);cuMat2+=n2(it.cu)*n2(it.mult);}
      else{pvSvc2+=n2(it.pvt);cuSvc2+=n2(it.cu)*n2(it.mult);}
    });
    var totalCu2=0; cats2.forEach(function(c){totalCu2+=catMap2[c].cu;});
    var totalMb2=totalPV2-totalCu2;

    var tabelaCatH='<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:6px">'
      +'<thead><tr style="background:#1a5c1a;color:#fff">'
      +'<th style="padding:4px 6px;text-align:left">Categoria</th>'
      +'<th style="padding:4px 6px;text-align:center">Tipo</th>'
      +'<th style="padding:4px 6px;text-align:right">PV Total</th>'
      +'<th style="padding:4px 6px;text-align:right">Custo</th>'
      +'<th style="padding:4px 6px;text-align:right">Margem</th>'
      +'<th style="padding:4px 6px;text-align:right">%</th>'
      +'<th style="padding:4px 6px;text-align:center">Itens</th>'
      +'</tr></thead><tbody>';
    cats2.forEach(function(cat,i){
      var d=catMap2[cat];
      var mb=d.pv-d.cu, mbp=d.pv>0?(mb/d.pv*100):0;
      var pctT=totalPV2>0?(d.pv/totalPV2*100):0;
      var cor=cores2[i%cores2.length];
      var bg=i%2===0?'#f9f9f9':'#fff';
      tabelaCatH+='<tr style="background:'+bg+'">'
        +'<td style="padding:3px 6px;border-bottom:1px solid #eee;font-weight:600">'
          +'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+cor+';margin-right:4px;vertical-align:middle"></span>'+esc(cat)+'</td>'
        +'<td style="padding:3px 6px;text-align:center;border-bottom:1px solid #eee;font-size:9px">'+(d.tipo==='material'?'Mat':'Svc')+'</td>'
        +'<td style="padding:3px 6px;text-align:right;border-bottom:1px solid #eee;font-weight:700;color:'+cor+'">'+money(d.pv)+'</td>'
        +'<td style="padding:3px 6px;text-align:right;border-bottom:1px solid #eee">'+money(d.cu)+'</td>'
        +'<td style="padding:3px 6px;text-align:right;border-bottom:1px solid #eee;color:'+(mb>=0?'#1a5c1a':'#c00')+'">'+money(mb)+' ('+mbp.toFixed(1)+'%)</td>'
        +'<td style="padding:3px 6px;text-align:right;border-bottom:1px solid #eee">'+pctT.toFixed(1)+'%</td>'
        +'<td style="padding:3px 6px;text-align:center;border-bottom:1px solid #eee;color:#666">'+d.count+'</td>'
      +'</tr>';
    });
    tabelaCatH+='<tr style="background:#e8f0e8;font-weight:700;border-top:2px solid #1a5c1a">'
      +'<td colspan="2" style="padding:4px 6px">TOTAL GERAL</td>'
      +'<td style="padding:4px 6px;text-align:right;color:#1a5c1a">'+money(totalPV2)+'</td>'
      +'<td style="padding:4px 6px;text-align:right">'+money(totalCu2)+'</td>'
      +'<td style="padding:4px 6px;text-align:right;color:'+(totalMb2>=0?'#1a5c1a':'#c00')+'">'+money(totalMb2)+' ('+(totalPV2>0?(totalMb2/totalPV2*100).toFixed(1):0)+'%)</td>'
      +'<td style="padding:4px 6px;text-align:right">100%</td>'
      +'<td style="padding:4px 6px;text-align:center">'+cats2.reduce(function(s,c){return s+catMap2[c].count;},0)+'</td>'
    +'</tr>';
    tabelaCatH+='</tbody></table>';

    // Legenda da pizza (HTML)
    var pizzaLegenda='<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px">';
    cats2.forEach(function(cat,i){
      var d=catMap2[cat];
      var pct=totalPV2>0?(d.pv/totalPV2*100):0;
      var cor=cores2[i%cores2.length];
      pizzaLegenda+='<div style="display:flex;align-items:center;gap:4px;font-size:9px;color:#333">'
        +'<span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+cor+'"></span>'
        +'<span>'+esc(cat)+'</span>'
        +'<span style="color:#888">('+pct.toFixed(1)+'%)</span>'
      +'</div>';
    });
    pizzaLegenda+='</div>';

    // Cards Svc/Mat
    function _card(label, pv, cu, cor){
      if(!pv) return '';
      var mb=pv-cu, mbp=pv>0?(mb/pv*100):0;
      return '<div style="flex:1;border:1.5px solid '+cor+';border-radius:6px;padding:9px 12px;min-width:140px">'
        +'<div style="font-size:10px;color:#555;margin-bottom:3px">'+label+'</div>'
        +'<div style="font-size:15px;font-weight:700;color:'+cor+'">'+money(pv)+'</div>'
        +'<div style="font-size:10px;color:#444;margin-top:2px">Custo: '+money(cu)+'</div>'
        +'<div style="font-size:10px;font-weight:600;color:'+(mb>=0?'#1a5c1a':'#c00')+';margin-top:1px">Margem: '+mbp.toFixed(1)+'%</div>'
      +'</div>';
    }
    var cardsH='<div style="display:flex;gap:10px;flex-wrap:wrap;margin:8px 0">'
      +_card('Serviços',pvSvc2,cuSvc2,'#1a5c1a')
      +_card('Materiais',pvMat2,cuMat2,'#3a5fa0');
    if(pvSvc2>0&&pvMat2>0){
      var pS=totalPV2>0?(pvSvc2/totalPV2*100):0, pM=totalPV2>0?(pvMat2/totalPV2*100):0;
      cardsH+='<div style="flex:2;min-width:160px;border:1px solid #ddd;border-radius:6px;padding:9px 12px">'
        +'<div style="font-size:10px;color:#555;margin-bottom:5px">Proporção</div>'
        +'<div style="height:12px;border-radius:6px;overflow:hidden;display:flex;margin-bottom:4px">'
          +'<div style="width:'+pS.toFixed(1)+'%;background:#1a5c1a"></div>'
          +'<div style="width:'+pM.toFixed(1)+'%;background:#3a5fa0"></div>'
        +'</div>'
        +'<div style="font-size:10px;display:flex;gap:12px">'
          +'<span><b style="color:#1a5c1a">■ Svc</b> '+pS.toFixed(1)+'%</span>'
          +'<span><b style="color:#3a5fa0">■ Mat</b> '+pM.toFixed(1)+'%</span>'
        +'</div>'
      +'</div>';
    }
    cardsH+='</div>';

    var cabTudo=''
      +'<div style="border-bottom:2px solid #1a5c1a;padding-bottom:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">'
        +'<div><div style="font-size:15px;font-weight:700;color:#1a5c1a">TECFUSION</div>'
          +'<div style="font-size:8px;color:#555">Ferramenta elaborada por: <strong>Eng. Elivandro</strong></div></div>'
        +'<div style="text-align:right"><div style="font-size:11px;font-weight:700">ANÁLISE GRÁFICA POR CATEGORIA</div>'
          +'<div style="font-size:8px;color:#e07000">⚠ Dados de proposta elaborada — Não é resultado final</div>'
          +'<div style="font-size:8px;color:#666">Proposta: #'+(p.num||'—')+' | '+esc(p.cli||'—')+'</div>'
        +'</div>'
      +'</div>';

    var assin=''
      +'<div style="margin-top:36px;display:flex;justify-content:center">'
        +'<div style="text-align:center">'
          +'<div style="border-top:1.5px solid #1a5c1a;width:260px;margin:0 auto 8px"></div>'
          +'<div style="font-size:12px;font-weight:700">Eng. Elivandro J. Nascimento</div>'
          +'<div style="font-size:9px;color:#444;margin-top:2px">Engenheiro Eletricista | CREA SP: 5071802874</div>'
          +'<div style="font-size:9px;color:#444">Tecfusion Solucoes Eletricas Industriais</div>'
          +'<div style="font-size:9px;color:#444">+55 11 999.299.211 | elivandro@tecfusion.com.br</div>'
        +'</div>'
      +'</div>';

    var paginaGraf='<div style="page-break-before:always">'
      +cabTudo
      // Gráficos: pizza+legenda e barras lado a lado
      +'<div style="display:flex;gap:14px;margin-bottom:12px;align-items:flex-start">'
        // Pizza + legenda
        +(img64P?'<div style="flex:0 0 auto">'
          +'<div style="font-size:10px;font-weight:700;color:#333;text-align:center;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">PV por Categoria</div>'
          +'<img src="'+img64P+'" style="width:190px;height:190px;display:block;border:1px solid #e0e0e0;border-radius:4px">'
          +pizzaLegenda
        +'</div>':'')
        // Barras
        +(img64B?'<div style="flex:1">'
          +'<div style="font-size:10px;font-weight:700;color:#333;text-align:center;margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em">PV × Custo por Categoria</div>'
          +'<img src="'+img64B+'" style="width:100%;max-width:380px;height:190px;object-fit:contain;display:block;border:1px solid #e0e0e0;border-radius:4px">'
        +'</div>':'')
      +'</div>'
      // Cards
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#555;background:#f0f0f0;padding:3px 7px;margin-bottom:0">Serviços × Materiais</div>'
      +cardsH
      // Tabela
      +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#555;background:#f0f0f0;padding:3px 7px;margin-top:8px">Detalhe por Categoria</div>'
      +tabelaCatH
      +assin
    +'</div>';

    // ── CSS da impressão ──
    var nomeArq=((p.num||'')+(p.tit?' - '+p.tit:'')).trim()||'Proposta';
    var stylesTudo=''
      +'<style>'
      +'@page{size:A4;margin:12mm 15mm 12mm 15mm}'
      +'body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
      // Proposta formal (páginas .pv-page já têm estilos próprios, precisamos reset leve)
      +'.pv-page{width:210mm!important;min-height:297mm!important;padding:29mm 19mm 18mm 19mm!important;box-sizing:border-box;page-break-after:always!important;break-after:page!important}'
      +'.pv-page:last-of-type{page-break-after:auto;break-after:auto}'
      +'.dre-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;background:#f0f0f0;padding:4px 8px;margin-top:10px}'
      +'.dre-row{display:flex;justify-content:space-between;padding:3px 8px;border-bottom:1px solid #eee}'
      +'.dre-row.indent1{padding-left:20px}.dre-row.indent2{padding-left:36px}'
      +'.dre-row.bold{font-weight:700}'
      +'.dre-total{display:flex;justify-content:space-between;padding:6px 8px;font-weight:700;font-size:12px;border-top:2px solid #000;margin-top:4px}'
      +'.pos{color:#1a7a1a}.neg{color:#c00}'
      +'img{max-width:100%;height:auto}'
      +'table{page-break-inside:auto}tr{page-break-inside:avoid}'
      +'</style>';

    // Para proposta formal precisamos incluir os CSS dela
    var propCSS=pCSS?('<style>'+pCSS()+'</style>'):'';

    var fullHtml='<html><head><title>'+esc(nomeArq)+'</title>'
      +propCSS+stylesTudo
      +'</head><body>'
      +propostaPages
      +'<div style="page-break-before:always">'+dreHtml+'</div>'
      +paginaGraf
      +'</body></html>';

    _printHtml(fullHtml);
  }

  // Garante que os canvas existam
  if(Q('anGraficos').style.display!=='none'){
    _executar();
  } else {
    var _tmp=document.createElement('div');
    _tmp.style.cssText='position:fixed;left:-9999px;top:0;width:700px;visibility:hidden';
    _tmp.id='_tmpGrafDiv2';
    _tmp.innerHTML='<canvas id="_tmpPizza" width="300" height="300"></canvas>'
      +'<canvas id="_tmpBarra" width="580" height="300"></canvas>';
    document.body.appendChild(_tmp);
    renderGraficosEmEl('_tmpPizza','_tmpBarra',function(){
      _executar();
      if(document.getElementById('_tmpGrafDiv2')) document.body.removeChild(_tmp);
    });
  }
}

function printDre(){
  var pid=Q('anProp').value;
  var p=props.find(function(x){return x.id===pid})||{};

  // ── Se aba gráficos visível, garante renderização antes de capturar ──
  var abaGraf = (Q('anGraficos').style.display!=='none');

  function _doprint(){
    var dreHtml=Q('anDre').innerHTML||Q('anExtrato').innerHTML;
  var dv=p.dat2?new Date(p.dat2+'T12:00:00').toLocaleDateString('pt-BR'):new Date().toLocaleDateString('pt-BR');
  // Nome do arquivo = "Nº Proposta - Título"
  var nomeArq = ((p.num||'')+(p.tit?' - '+p.tit:'')).trim()||'DRE';

  // Cabeçalho: esquerda = TECFUSION + subtítulo ferramenta; direita = título + aviso + data
  var cabecalho=''
    +'<div style="border-bottom:3px solid #1a5c1a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-start">'
      +'<div>'
        +'<div style="font-size:18px;font-weight:700;color:#1a5c1a;letter-spacing:.02em">TECFUSION</div>'
        +'<div style="font-size:9px;color:#555;margin-top:2px">Ferramenta elaborada por: <strong>Eng. Elivandro</strong></div>'
      +'</div>'
      +'<div style="text-align:right;font-size:11px;color:#444">'
        +'<div style="font-size:13px;font-weight:700">DEMONSTRATIVO DE RESULTADO</div>'
        +'<div style="font-size:9px;color:#e07000;font-style:normal;margin-top:2px">⚠ Dados de proposta elaborada — Não é resultado final</div>'
        +'<div style="font-size:10px;color:#666;margin-top:2px">Emitido em: '+new Date().toLocaleString('pt-BR')+'</div>'
      +'</div>'
    +'</div>'
    +'<table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px">'
      +'<tr style="background:#f0f0f0">'
        +'<td style="padding:5px 8px;font-weight:700;width:130px">Proposta Nº</td>'
        +'<td style="padding:5px 8px;font-weight:700">'+(p.num||'—')+'</td>'
        +'<td style="padding:5px 8px;font-weight:700;width:130px">Data</td>'
        +'<td style="padding:5px 8px">'+(dv||'—')+'</td>'
      +'</tr>'
      +'<tr>'
        +'<td style="padding:5px 8px;font-weight:700;background:#f8f8f8">Cliente</td>'
        +'<td style="padding:5px 8px" colspan="3">'+(p.cli||'—')+(p.cnpj?' &nbsp;|&nbsp; CNPJ: '+p.cnpj:'')+'</td>'
      +'</tr>'
      +'<tr style="background:#f0f0f0">'
        +'<td style="padding:5px 8px;font-weight:700">Título</td>'
        +'<td style="padding:5px 8px" colspan="3">'+(p.tit||'—')+'</td>'
      +'</tr>'
      +'<tr>'
        +'<td style="padding:5px 8px;font-weight:700;background:#f8f8f8">Cidade</td>'
        +'<td style="padding:5px 8px">'+(p.cid||'—')+'</td>'
        +'<td style="padding:5px 8px;font-weight:700;background:#f8f8f8">Fase</td>'
        +'<td style="padding:5px 8px">'+((FASE[p.fas]&&FASE[p.fas].n)||p.fas||'—')+'</td>'
      +'</tr>'
      +'<tr style="background:#f0f0f0">'
        +'<td style="padding:5px 8px;font-weight:700">Técnico Resp.</td>'
        +'<td style="padding:5px 8px">'+(p.ac||'—')+'</td>'
        +'<td style="padding:5px 8px;font-weight:700">E-mail</td>'
        +'<td style="padding:5px 8px">'+(p.mail||'—')+'</td>'
      +'</tr>'
      +'<tr>'
        +'<td style="padding:5px 8px;font-weight:700;background:#f8f8f8">Telefone</td>'
        +'<td style="padding:5px 8px">'+(p.tel||'—')+'</td>'
        +'<td style="padding:5px 8px;font-weight:700;background:#f8f8f8">Validade</td>'
        +'<td style="padding:5px 8px">'+(p.val2||'—')+'</td>'
      +'</tr>'
    +'</table>';

  // Assinatura no final do resultado
  var assinatura=''
    +'<div style="margin-top:48px;padding-top:0;display:flex;justify-content:center">'
      +'<div style="text-align:center;min-width:280px">'
        +'<div style="border-top:1.5px solid #1a5c1a;width:280px;margin:0 auto 10px auto"></div>'
        +'<div style="font-size:13px;font-weight:700;color:#1a1a1a">Eng. Elivandro J. Nascimento</div>'
        +'<div style="font-size:10px;color:#444;margin-top:3px">Engenheiro Eletricista | CREA SP: 5071802874</div>'
        +'<div style="font-size:10px;color:#444;margin-top:2px">Tecfusion Solucoes Eletricas Industriais</div>'
        +'<div style="font-size:10px;color:#444;margin-top:2px">+55 11 999.299.211 | elivandro@tecfusion.com.br</div>'
      +'</div>'
    +'</div>';

  // Rodapé personalizado com nome do arquivo (suprimindo o padrão do browser via @page)
  var rodape=''
    +'<div class="dre-rodape">'
      +'<span style="color:#888">'+nomeArq+'</span>'
    +'</div>';

  var styles=''
    +'<style>'
    +'@page{size:A4;margin:12mm 15mm 15mm 15mm}'
    +'body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}'
    +'.dre-title{font-size:16px;font-weight:700;margin-bottom:4px}'
    +'.dre-sub{font-size:11px;color:#555;margin-bottom:16px}'
    +'.dre-sec{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;background:#f0f0f0;padding:4px 8px;margin-top:12px}'
    +'.dre-row{display:flex;justify-content:space-between;padding:3px 8px;border-bottom:1px solid #eee}'
    +'.dre-row.indent1{padding-left:20px}.dre-row.indent2{padding-left:36px}'
    +'.dre-row.bold{font-weight:700}'
    +'.dre-total{display:flex;justify-content:space-between;padding:6px 8px;font-weight:700;font-size:13px;border-top:2px solid #000;margin-top:4px}'
    +'.pos{color:#1a7a1a}.neg{color:#c00}.neu{color:#555}'
    +'img{max-width:100%;height:auto}'
    +'table{page-break-inside:auto}tr{page-break-inside:avoid}'
    +'.graf-page-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#1a5c1a;border-bottom:1.5px solid #1a5c1a;padding-bottom:4px;margin-bottom:8px}'
    +'.dre-rodape{position:fixed;bottom:0;left:0;right:0;text-align:center;font-size:9px;color:#aaa;padding:4px 0;border-top:1px solid #e0e0e0;background:#fff}'
    +'</style>';

  // ── Capturar gráficos como imagens ──
  var _cvPizza = document.getElementById('grafPizza') || document.getElementById('_tmpPizza');
  var _cvBarra = document.getElementById('grafBarra') || document.getElementById('_tmpBarra');
  var img64Pizza = (_cvPizza&&_cvPizza.toDataURL&&_cvPizza.width>0&&_cvPizza.height>0) ? _cvPizza.toDataURL('image/png') : '';
  var img64Barra = (_cvBarra&&_cvBarra.toDataURL&&_cvBarra.width>0&&_cvBarra.height>0) ? _cvBarra.toDataURL('image/png') : '';

  // ── Montar página de gráficos para impressão ──
  var budgP2 = (editId && editId===p.id && budg && budg.length) ? budg : (p.bi||[]);
  var catMap2={};
  var totalPV2=0;
  budgP2.forEach(function(it){
    if(it.inc===false) return;
    var cat=it.cat||'Outros';
    if(!catMap2[cat]) catMap2[cat]={pv:0,cu:0,count:0,tipo:it.t};
    catMap2[cat].pv+=n2(it.pvt); catMap2[cat].cu+=n2(it.cu)*n2(it.mult);
    catMap2[cat].count++; totalPV2+=n2(it.pvt);
  });
  var cats2=Object.keys(catMap2).sort(function(a,b){return catMap2[b].pv-catMap2[a].pv;});
  var cores2=['#1a6b1a','#3a5fa0','#8b4513','#a0522d','#2e8b57','#6a3d9a','#b8860b','#4682b4','#c0392b','#16a085','#7d3c98','#1f618d','#d35400','#117a65','#2e4057'];

  var pvSvc2=0,pvMat2=0,cuSvc2=0,cuMat2=0;
  budgP2.forEach(function(it){
    if(it.inc===false) return;
    if(it.t==='material'){pvMat2+=n2(it.pvt);cuMat2+=n2(it.cu)*n2(it.mult);}
    else{pvSvc2+=n2(it.pvt);cuSvc2+=n2(it.cu)*n2(it.mult);}
  });

  // Tabela por categoria (para impressão)
  var tabelaCat='';
  tabelaCat+='<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:8px">'
    +'<thead><tr style="background:#1a5c1a;color:#fff">'
    +'<th style="padding:5px 7px;text-align:left">Categoria</th>'
    +'<th style="padding:5px 7px;text-align:center">Tipo</th>'
    +'<th style="padding:5px 7px;text-align:right">PV Total</th>'
    +'<th style="padding:5px 7px;text-align:right">Custo</th>'
    +'<th style="padding:5px 7px;text-align:right">Margem Bruta</th>'
    +'<th style="padding:5px 7px;text-align:right">% Total</th>'
    +'<th style="padding:5px 7px;text-align:center">Itens</th>'
    +'</tr></thead><tbody>';
  cats2.forEach(function(cat,i){
    var d=catMap2[cat];
    var mb=d.pv-d.cu, mbp=d.pv>0?(mb/d.pv*100):0;
    var pctT=totalPV2>0?(d.pv/totalPV2*100):0;
    var cor=cores2[i%cores2.length];
    var bg=i%2===0?'#f9f9f9':'#fff';
    var mbCor=mb>=0?'#1a5c1a':'#c00';
    tabelaCat+='<tr style="background:'+bg+'">'
      +'<td style="padding:4px 7px;font-weight:600;border-bottom:1px solid #e8e8e8">'
        +'<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+cor+';margin-right:5px;vertical-align:middle"></span>'+esc(cat)+'</td>'
      +'<td style="padding:4px 7px;text-align:center;border-bottom:1px solid #e8e8e8;font-size:9px">'+(d.tipo==='material'?'Material':'Serviço')+'</td>'
      +'<td style="padding:4px 7px;text-align:right;border-bottom:1px solid #e8e8e8;font-weight:700;color:'+cor+'">'+money(d.pv)+'</td>'
      +'<td style="padding:4px 7px;text-align:right;border-bottom:1px solid #e8e8e8">'+money(d.cu)+'</td>'
      +'<td style="padding:4px 7px;text-align:right;border-bottom:1px solid #e8e8e8;color:'+mbCor+'">'+money(mb)+' ('+mbp.toFixed(1)+'%)</td>'
      +'<td style="padding:4px 7px;text-align:right;border-bottom:1px solid #e8e8e8">'+pctT.toFixed(1)+'%</td>'
      +'<td style="padding:4px 7px;text-align:center;border-bottom:1px solid #e8e8e8;color:#666">'+d.count+'</td>'
      +'</tr>';
  });
  // Total
  var totalCu2=0; cats2.forEach(function(c){totalCu2+=catMap2[c].cu;});
  var totalMb2=totalPV2-totalCu2;
  tabelaCat+='<tr style="background:#e8f0e8;font-weight:700;border-top:2px solid #1a5c1a">'
    +'<td style="padding:5px 7px" colspan="2">TOTAL GERAL</td>'
    +'<td style="padding:5px 7px;text-align:right;color:#1a5c1a">'+money(totalPV2)+'</td>'
    +'<td style="padding:5px 7px;text-align:right">'+money(totalCu2)+'</td>'
    +'<td style="padding:5px 7px;text-align:right;color:'+(totalMb2>=0?'#1a5c1a':'#c00')+'">'+money(totalMb2)+' ('+(totalPV2>0?(totalMb2/totalPV2*100).toFixed(1):0)+'%)</td>'
    +'<td style="padding:5px 7px;text-align:right">100%</td>'
    +'<td style="padding:5px 7px;text-align:center">'+cats2.reduce(function(s,c){return s+catMap2[c].count;},0)+'</td>'
    +'</tr>';
  tabelaCat+='</tbody></table>';

  // Cards Svc vs Mat
  function printCard(label, pv, cu, cor){
    if(!pv) return '';
    var mb=pv-cu, mbp=pv>0?(mb/pv*100):0;
    return '<div style="flex:1;border:1.5px solid '+cor+';border-radius:6px;padding:10px 14px;min-width:160px">'
      +'<div style="font-size:10px;color:#555;margin-bottom:4px">'+label+'</div>'
      +'<div style="font-size:16px;font-weight:700;color:'+cor+'">'+money(pv)+'</div>'
      +'<div style="font-size:10px;color:#444;margin-top:3px">Custo: '+money(cu)+'</div>'
      +'<div style="font-size:10px;color:'+(mb>=0?'#1a5c1a':'#c00')+';font-weight:600;margin-top:2px">Margem: '+mbp.toFixed(1)+'%</div>'
      +'</div>';
  }
  var cardsHtml='<div style="display:flex;gap:12px;flex-wrap:wrap;margin:10px 0">'
    +printCard('Serviços',pvSvc2,cuSvc2,'#1a5c1a')
    +printCard('Materiais',pvMat2,cuMat2,'#3a5fa0');
  if(pvSvc2>0&&pvMat2>0){
    var pS=totalPV2>0?(pvSvc2/totalPV2*100):0, pM=totalPV2>0?(pvMat2/totalPV2*100):0;
    cardsHtml+='<div style="flex:2;min-width:180px;border:1px solid #ddd;border-radius:6px;padding:10px 14px">'
      +'<div style="font-size:10px;color:#555;margin-bottom:6px">Proporção Serviços × Materiais</div>'
      +'<div style="height:14px;border-radius:7px;overflow:hidden;display:flex;margin-bottom:5px">'
        +'<div style="width:'+pS.toFixed(1)+'%;background:#1a5c1a"></div>'
        +'<div style="width:'+pM.toFixed(1)+'%;background:#3a5fa0"></div>'
      +'</div>'
      +'<div style="font-size:10px;color:#444;display:flex;gap:16px">'
        +'<span><b style="color:#1a5c1a">■ Serviços</b> '+pS.toFixed(1)+'%</span>'
        +'<span><b style="color:#3a5fa0">■ Materiais</b> '+pM.toFixed(1)+'%</span>'
      +'</div>'
    +'</div>';
  }
  cardsHtml+='</div>';

  // ── Montar página de gráficos ──
  var paginaGraficos = '<div style="page-break-before:always">'
    // Cabeçalho desta página
    +'<div style="border-bottom:2px solid #1a5c1a;padding-bottom:10px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">'
      +'<div>'
        +'<div style="font-size:16px;font-weight:700;color:#1a5c1a">TECFUSION</div>'
        +'<div style="font-size:9px;color:#555">Ferramenta elaborada por: <strong>Eng. Elivandro</strong></div>'
      +'</div>'
      +'<div style="text-align:right">'
        +'<div style="font-size:12px;font-weight:700">ANÁLISE GRÁFICA POR CATEGORIA</div>'
        +'<div style="font-size:9px;color:#e07000">⚠ Dados de proposta elaborada — Não é resultado final</div>'
        +'<div style="font-size:9px;color:#666">Proposta: #'+(p.num||'—')+' | '+esc(p.cli||'—')+'</div>'
      +'</div>'
    +'</div>'
    // Gráficos lado a lado (pizza + barra)
    +(img64Pizza||img64Barra ? (
      '<div style="display:flex;gap:16px;margin-bottom:14px;align-items:flex-start">'
        +(img64Pizza?'<div style="flex:0 0 auto;text-align:center">'
          +'<div style="font-size:10px;font-weight:700;color:#333;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">PV por Categoria</div>'
          +'<img src="'+img64Pizza+'" style="width:240px;height:240px;display:block;border:1px solid #e0e0e0;border-radius:4px">'
        +'</div>':'')
        +(img64Barra?'<div style="flex:1;text-align:center">'
          +'<div style="font-size:10px;font-weight:700;color:#333;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">PV × Custo por Categoria</div>'
          +'<img src="'+img64Barra+'" style="width:100%;max-width:400px;height:240px;object-fit:contain;display:block;margin:0 auto;border:1px solid #e0e0e0;border-radius:4px">'
        +'</div>':'')
      +'</div>'
    ) : '')
    // Cards Svc vs Mat
    +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;background:#f0f0f0;padding:4px 8px;margin-bottom:4px">Serviços × Materiais</div>'
    +cardsHtml
    // Tabela categorias
    +'<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;background:#f0f0f0;padding:4px 8px;margin-top:10px;margin-bottom:0">Detalhe por Categoria</div>'
    +tabelaCat
    // Assinatura
    +assinatura
  +'</div>';

  var fullHtml='<html><head><title>'+nomeArq+'</title>'+styles+'</head><body>'+cabecalho+dreHtml+paginaGraficos+rodape+'</body></html>';

  _printHtml(fullHtml);
  } // fim _doprint

  // Se a aba de gráficos está aberta, os canvas já existem; senão renderiza agora
  if(abaGraf){
    _doprint();
  } else {
    // Renderiza gráficos em background (div oculto temporário) para capturar base64
    var _tmpDiv = document.createElement('div');
    _tmpDiv.style.cssText='position:fixed;left:-9999px;top:0;width:700px;visibility:hidden';
    _tmpDiv.id='_tmpGrafDiv';
    document.body.appendChild(_tmpDiv);
    // Injeta canvas temporários
    _tmpDiv.innerHTML = '<canvas id="_tmpPizza" width="300" height="300"></canvas>'
      + '<canvas id="_tmpBarra" width="580" height="300"></canvas>';
    renderGraficosEmEl('_tmpPizza','_tmpBarra', function(){
      _doprint();
      document.body.removeChild(_tmpDiv);
    });
  }
}

function gerarDRE(p, calc){
  // calc = objeto com todos os valores já calculados por gerarExtrato
  var c=calc;
  var pvTot=c.pvTot, pvS=c.pvS, pvM=c.pvM, desc=c.desc;
  var custoS=c.custoS, custoM=c.custoM, custoTerc=c.custoTerc;
  var dNFS=c.dNFS, dNFM=c.dNFM, dRS=c.dRS, dComS=c.dComS, dComM=c.dComM;
  var totalDeduc=c.totalDeduc, custoTotal=c.custoTotal;
  var ll=c.ll, llPct=c.llPct, llCor=c.llCor;
  var llNeg=c.llNeg, llNegPct=c.llNegP, negCor=c.negCor, neg=c.neg;
  var cfg=getPrcAtual();

  function pct(v){ return pvTot>0?(' <span style="color:#888;font-size:.72rem">('+((Math.abs(v)/pvTot)*100).toFixed(1)+'%)</span>'):''; }
  function fmtV(v,cor){ return '<span style="font-weight:600;color:'+cor+'">'+money(Math.abs(v))+'</span>'+pct(v); }

  function dreRow(label, val, indent, bold, cor){
    var ind='padding-left:'+(8+(indent||0)*18)+'px';
    var bld=bold?'font-weight:700;':'';
    var vc=cor||(val>=0?'#3fb950':'#f85149');
    return '<div class="dre-row indent'+(indent||0)+'" style="'+ind+';'+bld+'">'
      +'<span>'+label+'</span>'
      +fmtV(val, vc)
      +'</div>';
  }
  function dreSection(label){
    return '<div class="dre-sec">'+label+'</div>';
  }
  function dreTotal(label, val, cor){
    return '<div style="display:flex;justify-content:space-between;padding:.45rem .8rem;font-weight:700;font-size:.9rem;background:'+cor+'22;border-top:2px solid '+cor+';border-bottom:2px solid '+cor+';margin:.2rem 0;color:'+cor+'">'
      +'<span>'+label+'</span>'
      +'<span>'+money(val)+'<span style="font-size:.72rem;margin-left:.4rem">'+(pvTot>0?'('+((Math.abs(val)/pvTot)*100).toFixed(1)+'%)':'')+'</span></span>'
      +'</div>';
  }
  function dreSpace(){ return '<div style="height:4px"></div>'; }

  var html='';

  // Cabeçalho
  var dv=p.dat2?new Date(p.dat2+'T12:00:00').toLocaleDateString('pt-BR'):new Date().toLocaleDateString('pt-BR');
  html+='<div style="border-bottom:3px solid #154a15;padding-bottom:.6rem;margin-bottom:.8rem">'
    +'<div style="font-size:1rem;font-weight:700;color:var(--accent)">DRE — Demonstrativo de Resultado</div>'
    +'<div style="font-size:.78rem;color:var(--text2);margin-top:.15rem">'
    +'Proposta #'+esc(p.num)+' &nbsp;|&nbsp; '+esc(p.cli)+(p.tit?' &nbsp;|&nbsp; '+esc(p.tit):'')
    +' &nbsp;|&nbsp; '+dv+'</div>'
    +'</div>';

  // ── 1. RECEITA BRUTA ──
  html+=dreSection('1. RECEITA BRUTA DE VENDAS');
  if(pvS>0) html+=dreRow('(+) Receita de Serviços', pvS, 1, false, '#58a6ff');
  if(pvM>0) html+=dreRow('(+) Receita de Materiais', pvM, 1, false, '#bc8cff');
  if(desc>0) html+=dreRow('(–) Desconto Concedido', -desc, 1, false, '#f97316');
  html+=dreTotal('RECEITA LÍQUIDA', pvTot, '#58a6ff');

  // ── 2. DEDUÇÕES TRIBUTÁRIAS ──
  html+=dreSection('2. DEDUÇÕES SOBRE RECEITA (Impostos e Taxas)');
  if(dNFS>0)  html+=dreRow('(–) ISS / PIS / COFINS / CSLL — Serviços ('+((cfg.aliq.nfS||0.15)*100).toFixed(1)+'%)', -dNFS, 1);
  if(dNFM>0)  html+=dreRow('(–) ICMS / PIS / COFINS — Materiais ('+((cfg.aliq.nfM||0.15)*100).toFixed(1)+'%)', -dNFM, 1);
  if(dRS>0)   html+=dreRow('(–) Risco Sacado / Antecipação ('+((cfg.aliq.rS||0.041)*100).toFixed(1)+'%)', -dRS, 1);
  html+=dreTotal('TOTAL DEDUÇÕES TRIBUTÁRIAS', -(dNFS+dNFM+dRS), '#f97316');

  // Receita após impostos
  var recLiqTrib = pvTot - (dNFS+dNFM+dRS);
  html+=dreTotal('RECEITA APÓS IMPOSTOS', recLiqTrib, '#58a6ff');

  // ── 3. CUSTOS DIRETOS ──
  html+=dreSection('3. CUSTO DOS SERVIÇOS E MATERIAIS (CPV)');
  var itensSvc=[], itensMat=[], itensTerc=[], itensTercExt=[];
  var dreItems=(editId && editId===p.id && budg && budg.length)?budg:(p.bi||[]);
  dreItems.forEach(function(it){
    if(it.inc===false) return;
    if(it.terc===true){ itensTerc.push(it); return; }
    if(it.terc===false){ itensTercExt.push(it); return; } // cliente paga direto — PV vira receita
    if(it.t==='material') itensMat.push(it);
    else itensSvc.push(it);
  });
  if(itensSvc.length){
    html+=dreRow('Serviços:', 0, 1, true, '#8b949e');
    itensSvc.forEach(function(it){
      var cu=n2(it.cu)*n2(it.mult);
      html+=dreRow('(–) [SVC] '+esc(it.desc||it.cat), -cu, 2);
    });
    html+=dreRow('Subtotal Custo Serviços', -custoS, 1, true);
  }
  if(itensMat.length){
    html+=dreRow('Materiais:', 0, 1, true, '#8b949e');
    itensMat.forEach(function(it){
      var cu=n2(it.cu)*n2(it.mult);
      html+=dreRow('(–) [MAT] '+esc(it.desc||it.cat), -cu, 2);
    });
    html+=dreRow('Subtotal Custo Materiais', -custoM, 1, true);
  }
  // Itens pagos pelo cliente direto ao terceiro: custo=0 para empresa, PV = receita/lucro
  if(itensTercExt.length){
    var pvTercExt=0;
    html+='<div style="height:4px"></div>';
    html+=dreRow('ℹ️  Fornecido por Terceiro (cliente paga direto — custo zero para empresa):', 0, 1, true, '#8b949e');
    itensTercExt.forEach(function(it){
      var pv=n2(it.pvt);
      pvTercExt+=pv;
      html+=dreRow('['+(it.t==='material'?'MAT':'SVC')+'] '+esc(it.desc||it.cat), pv, 2, false, '#8b949e');
    });
    html+=dreRow('Receita líquida desses itens (entra como lucro)', pvTercExt, 1, true, '#3fb950');
  }
  if(itensTerc.length){
    html+='<div style="height:4px"></div>';
    html+=dreRow('Repasse a Terceiros (custo):', 0, 1, true, '#f97316');
    itensTerc.forEach(function(it){
      var cu=n2(it.cu)*n2(it.mult);
      html+=dreRow('(–) ['+(it.t==='material'?'MAT':'SVC')+'] '+esc(it.desc||it.cat)+' [custo: '+money(cu)+' | PV: '+money(it.pvt)+']', -cu, 2, false, '#f97316');
    });
    html+=dreRow('Subtotal Terceiros', -custoTerc, 1, true, '#f97316');
  }
  html+=dreTotal('TOTAL CPV', -custoTotal, '#bc8cff');

  // Lucro Bruto
  var lucroBruto = pvTot - custoTotal;
  html+=dreTotal('LUCRO BRUTO', lucroBruto, lucroBruto>=0?'#3fb950':'#f85149');

  // ── 4. DESPESAS COMERCIAIS ──
  html+=dreSection('4. DESPESAS COMERCIAIS (Comissões)');
  if(dComS>0) html+=dreRow('(–) Comissão sobre Serviços ('+((cfg.aliq.comS||0.05)*100).toFixed(1)+'%)', -dComS, 1);
  if(dComM>0) html+=dreRow('(–) Comissão sobre Materiais ('+((cfg.aliq.comM||0.03)*100).toFixed(1)+'%)', -dComM, 1);
  html+=dreTotal('TOTAL DESPESAS COMERCIAIS', -(dComS+dComM), '#f97316');

  // ── 5. RESULTADO ──
  html+=dreSection('5. RESULTADO POR ORIGEM E RESULTADO FINAL');
  if(recSliq>0){
    html+=dreRow('Receita líquida de Serviços', recSliq, 1, false, '#58a6ff');
    html+=dreRow('(–) Custos Serviços (inclui terceiros pagos por nós)', -custoServTotal, 1);
    html+=dreRow('(–) Impostos Serviços', -dNFS, 1);
    html+=dreRow('(–) Comissão Serviços', -dComS, 1);
    html+=dreRow('(–) Risco Sacado rateado em Serviços', -rsS, 1);
    html+=dreTotal('LUCRO LÍQUIDO SERVIÇOS', llS, llS>=0?'#58a6ff':'#f85149');
    html+=dreSpace();
  }
  if(recMliq>0){
    html+=dreRow('Receita líquida de Materiais', recMliq, 1, false, '#bc8cff');
    html+=dreRow('(–) Custos Materiais (inclui terceiros pagos por nós)', -custoMatTotal, 1);
    html+=dreRow('(–) Impostos Materiais', -dNFM, 1);
    html+=dreRow('(–) Comissão Materiais', -dComM, 1);
    html+=dreRow('(–) Risco Sacado rateado em Materiais', -rsM, 1);
    html+=dreTotal('LUCRO LÍQUIDO MATERIAIS', llM, llM>=0?'#bc8cff':'#f85149');
    html+=dreSpace();
  }
  html+=dreRow('(+) Receita Líquida Geral', pvTot, 1, false, '#58a6ff');
  html+=dreRow('(–) CPV — Custos Diretos', -custoTotal, 1);
  html+=dreRow('(–) Impostos e Taxas', -(dNFS+dNFM+dRS), 1);
  html+=dreRow('(–) Comissões', -(dComS+dComM), 1);
  html+=dreSpace();
  html+=dreTotal('🏆 LUCRO LÍQUIDO GERAL', ll, llCor);

  // ── 6. RESERVA DE NEGOCIAÇÃO + DESCONTO CONCEDIDO ──
  var dNegReserva = neg > 0 ? pvTot * neg : 0;
  var llAposNeg = ll - dNegReserva;
  var llAposNegPct = pvTot > 0 ? (llAposNeg / pvTot) * 100 : 0;
  if(neg > 0){
    html+=dreSection('6. RESERVA DE NEGOCIAÇÃO ('+(neg*100).toFixed(0)+'%)');
    html+=dreRow('Lucro líquido antes da reserva', ll, 1, false, '#8b949e');
    html+=dreRow('(–) Reserva de desconto ('+(neg*100).toFixed(0)+'% da receita)', -dNegReserva, 1, false, '#f97316');
    html+=dreTotal('LUCRO LÍQUIDO APÓS RESERVA', llAposNeg, llAposNeg>=0?'#3fb950':'#f85149');
    html+=dreSpace();
  }
  // ── DESCONTO CONCEDIDO (apenas se houver desconto real nos Valores) ──
  if(desc > 0){
    var descPct = (pvS+pvM) > 0 ? (desc / (pvS+pvM)) * 100 : 0;
    html+=dreSection((neg>0?'7.':'6.')+' DESCONTO CONCEDIDO — '+descPct.toFixed(1)+'% ('+money(desc)+')');
    html+=dreRow('Receita bruta (sem desconto)', pvS+pvM, 1, false, '#8b949e');
    if(descS>0) html+=dreRow('(–) Desconto em Serviços', -descS, 1, false, '#f97316');
    if(descM>0) html+=dreRow('(–) Desconto em Materiais', -descM, 1, false, '#f97316');
    html+=dreRow('Receita líquida após desconto', pvTot, 1, false, '#58a6ff');
    html+=dreRow('(–) Custos + Impostos + Comissões', -(custoTotal+totalDeduc-dDesc), 1);
    html+=dreTotal('LUCRO COM DESCONTO APLICADO', ll, c.llCor);
  } else if(neg <= 0){
    html+=dreSection('6. DESCONTO');
    html+=dreRow('Nenhum desconto aplicado nesta proposta.', 0, 1, false, '#8b949e');
  }

  // ── Itens excluídos (informativo) ──
  var itensExcl=(p.bi||[]).filter(function(it){return it.inc===false;});
  if(itensExcl.length){
    html+=dreSection('⛔ ITENS EXCLUÍDOS DO CÁLCULO (memória)');
    itensExcl.forEach(function(it){
      html+=dreRow(esc(it.desc||it.cat)+' — PV: '+money(it.pvt), 0, 1, false, '#8b949e');
    });
  }

  // Rodapé
  html+='<div style="margin-top:1rem;padding:.6rem .8rem;background:var(--bg3);border-radius:var(--r);font-size:.72rem;color:var(--text3)">'
    +'Documento gerado em '+new Date().toLocaleString('pt-BR')+' &nbsp;|&nbsp; TecFusion Gerador de Propostas'
    +'</div>';

  Q('anDre').innerHTML=html;
}

function gerarExtrato(p){
  var cfg=getPrc();
  // Alíquotas — usa as salvas na proposta primeiro, depois global (!= null para respeitar zeros)
  var propAliq = p.aliq || {};
  var nfS  = propAliq.nfS  != null ? propAliq.nfS  : (cfg.aliq.nfS  != null ? cfg.aliq.nfS  : 0.15);
  var nfM  = propAliq.nfM  != null ? propAliq.nfM  : (cfg.aliq.nfM  != null ? cfg.aliq.nfM  : 0.15);
  var rs   = propAliq.rS   != null ? propAliq.rS   : (cfg.aliq.rS   != null ? cfg.aliq.rS   : 0.041);
  var comS = propAliq.comS != null ? propAliq.comS : (cfg.aliq.comS != null ? cfg.aliq.comS : 0.05);
  var comM = propAliq.comM != null ? propAliq.comM : (cfg.aliq.comM != null ? cfg.aliq.comM : DEFP.aliq.comM);
  var neg  = propAliq.neg  != null ? propAliq.neg  : (cfg.aliq.neg  != null ? cfg.aliq.neg  : 0.05);

  // Valores da proposta
  var pvS  = n2(p.vS||0);
  var pvM  = n2(p.vM||0);
  // Descontos reais (separados por tipo, ou total como fallback para propostas antigas)
  var descS = n2(p.vDS||0);
  var descM = n2(p.vDM||0);
  var desc  = (descS+descM) > 0 ? (descS+descM) : n2(p.vD||0);
  var pvTot = pvS + pvM - desc;

  // Usar budg em memória se for a proposta atualmente aberta no editor (dados mais frescos)
  var budgP = (editId && editId === p.id && budg && budg.length) ? budg : (p.bi || []);
  var custoS=0, custoM=0, custoTerc=0, custoTercS=0, custoTercM=0;
  var itensSvc=[], itensMat=[], itensTerc=[], itensTercExt=[], itensExcl=[];
  budgP.forEach(function(it){
    if(it.inc===false){ itensExcl.push(it); return; }
    var cuItem=n2(it.cu)*n2(it.mult);
    if(it.terc===true){
      // Terc. MARCADO = eu pago o custo ao terceiro → custo real sai do lucro
      custoTerc+=cuItem;
      if(it.t==='material') custoTercM+=cuItem; else custoTercS+=cuItem;
      itensTerc.push(it);
      return;
    }
    if(it.terc===false){
      // Terc. NÃO marcado = cliente paga o terceiro direto → custo zero, PV vira receita/lucro
      itensTercExt.push(it);
      return;
    }
    // item normal sem flag terc: tem custo próprio real
    if(it.t==='material'){ itensMat.push(it); custoM+=cuItem; }
    else { itensSvc.push(it); custoS+=cuItem; }
  });
  // custoTotal = apenas terceirizados (você paga ao fornecedor), igual ao updKpi
  // MO própria e material de estoque não abatam o LL — PV é receita pura
  var custoTotal = custoTerc;
  var custoServTotal = custoTercS;  // custo real de serviços que você paga
  var custoMatTotal  = custoTercM;  // custo real de materiais que você paga

  // Deduções sobre receita (sem reserva de negociação)
  var dNFS  = pvS  * nfS;
  var dNFM  = pvM  * nfM;
  var dRS   = pvTot * rs;
  var dComS = pvS  * comS;
  var dComM = pvM  * comM;
  var dNeg  = pvTot * neg;  // reserva — calculada separadamente
  var dDesc = desc;
  var totalDeduc = dNFS + dNFM + dRS + dComS + dComM + dDesc;

  // LUCRO LÍQUIDO = potencial máximo (sem reserva)
  var ll    = pvTot - custoTotal - totalDeduc;
  var llPct = pvTot > 0 ? (ll/pvTot)*100 : 0;
  var llCor = ll>=0 ? (llPct>=20?'#3fb950':llPct>=10?'#d4a017':'#f97316') : '#f85149';

  // Lucro líquido separado por origem da receita (sem reserva)
  var recSliq = Math.max(0, pvS - descS);
  var recMliq = Math.max(0, pvM - descM);
  var rsS  = pvTot>0 ? dRS*(recSliq/pvTot) : 0;
  var rsM  = pvTot>0 ? dRS*(recMliq/pvTot) : 0;
  var llS = recSliq - custoServTotal - dNFS - dComS - rsS;
  var llM = recMliq - custoMatTotal - dNFM - dComM - rsM;
  var llSPct = recSliq>0 ? (llS/recSliq)*100 : 0;
  var llMPct = recMliq>0 ? (llM/recMliq)*100 : 0;

  // LUCRO LÍQUIDO APÓS RESERVA = o que sobra se der o desconto máximo
  var pvNeg  = pvTot;
  var llNeg  = ll - dNeg;
  var llNegP = pvTot>0?(llNeg/pvTot)*100:0;
  var negCor = llNeg>=0?'#58a6ff':'#f85149';

  function fmtPct(v){ return (v*100).toFixed(1)+'%'; }
  function row(label, val, cls, indent, bold, color){
    var ind = indent?'padding-left:'+(indent*18)+'px':'';
    var bld = bold?'font-weight:700':'';
    var clr = color?'color:'+color:'';
    var st  = [ind,bld,clr].filter(Boolean).join(';');
    var vCls= val<0?'color:#f85149':(val>0?'':'color:var(--text3)');
    return '<tr class="an-row '+(cls||'')+'">'
      +'<td style="'+st+'">'+label+'</td>'
      +'<td style="text-align:right;'+vCls+(bold?';font-weight:700':'')+(color?';color:'+color:'')+'">'+money(Math.abs(val))+'</td>'
      +'<td style="text-align:right;font-size:.72rem;color:var(--text3)">'+(pvTot>0?fmtPct(Math.abs(val)/pvTot):'–')+'</td>'
      +'</tr>';
  }
  function divider(label){
    return '<tr><td colspan="3" style="padding:.15rem .6rem;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);background:var(--bg3);border-top:1px solid var(--border)">'+label+'</td></tr>';
  }
  function total(label, val, color){
    return '<tr style="background:'+color+'22;border-top:2px solid '+color+'">'
      +'<td style="font-weight:700;font-size:.92rem;padding:.5rem .6rem;color:'+color+'">'+label+'</td>'
      +'<td style="text-align:right;font-weight:700;font-size:.92rem;color:'+color+'">'+money(val)+'</td>'
      +'<td style="text-align:right;font-size:.8rem;color:'+color+'">'+(pvTot>0?fmtPct(Math.abs(val)/pvTot):'–')+'</td>'
      +'</tr>';
  }

  var rows='';

  // ── RECEITA ──
  rows+=divider('💰 Receita Bruta');
  if(pvS>0) rows+=row('Serviços', pvS, '', 1, false, '#58a6ff');
  if(pvM>0) rows+=row('Materiais', pvM, '', 1, false, '#bc8cff');
  rows+=total('RECEITA TOTAL', pvTot, '#58a6ff');

  // ── CUSTOS DIRETOS ──
  rows+=divider('🔧 Custos Diretos (Custo Real)');
  itensSvc.forEach(function(it){ rows+=row('[SVC] '+(it.desc||it.cat), -(n2(it.cu)*n2(it.mult)), '', 2, false, null); });
  if(custoS>0) rows+=row('Subtotal Serviços', -custoS, '', 1, true, null);
  itensMat.forEach(function(it){ rows+=row('[MAT] '+(it.desc||it.cat), -(n2(it.cu)*n2(it.mult)), '', 2, false, null); });
  if(custoM>0) rows+=row('Subtotal Materiais', -custoM, '', 1, true, null);
  // Itens fornecidos por terceiro (cliente paga direto) — custo zero, PV entra como receita
  if(itensTercExt.length){
    var pvTercExt=0;
    rows+=row('ℹ️  Fornecido por Terceiro — cliente paga direto (custo zero para empresa):', 0, '', 1, true, '#8b949e');
    itensTercExt.forEach(function(it){
      var pv=n2(it.pvt);
      pvTercExt+=pv;
      rows+=row(it.desc||it.cat, pv, '', 2, false, '#8b949e');
    });
    rows+=row('✅ Receita desses itens (entra integralmente como lucro)', pvTercExt, '', 1, true, '#3fb950');
  }
  rows+=total('TOTAL CUSTOS DIRETOS (próprios)', -(custoS+custoM), '#bc8cff');

  // ── DEDUÇÕES ──
  rows+=divider('📋 Deduções sobre Receita');
  if(dNFS>0) rows+=row('Imposto NF Serviços ('+fmtPct(nfS)+')', -dNFS, '', 1);
  if(dNFM>0) rows+=row('Imposto NF Materiais ('+fmtPct(nfM)+')', -dNFM, '', 1);
  if(dRS>0)  rows+=row('Risco Sacado ('+fmtPct(rs)+')', -dRS, '', 1);
  if(dComS>0)rows+=row('Comissão Serviços ('+fmtPct(comS)+')', -dComS, '', 1);
  if(dComM>0)rows+=row('Comissão Materiais ('+fmtPct(comM)+')', -dComM, '', 1);
  if(dDesc>0)rows+=row('Desconto concedido', -dDesc, '', 1, false, '#f97316');
  rows+=total('TOTAL DEDUÇÕES', -totalDeduc, '#f97316');

  // ── TERCEIROS (eu pago — entra no custo) ──
  if(itensTerc.length){
    rows+=divider('🤝 Terceiros — Eu pago (repasse ao fornecedor)');
    itensTerc.forEach(function(it){ rows+=row('['+(it.t==='material'?'MAT':'SVC')+'] '+(it.desc||it.cat)+' (custo: '+money(n2(it.cu)*n2(it.mult))+' | PV: '+money(it.pvt)+')', -(n2(it.cu)*n2(it.mult)), '', 2, false, '#f97316'); });
    rows+=total('TOTAL TERCEIROS', -custoTerc, '#f97316');
  }

  // ── EXCLUÍDOS ──
  if(itensExcl.length){
    rows+=divider('⛔ Itens Excluídos do Cálculo');
    itensExcl.forEach(function(it){ rows+=row('['+(it.t==='material'?'MAT':'SVC')+'] '+(it.desc||it.cat), n2(it.pvt), '', 2, false, '#8b949e'); });
  }

  // ── RESULTADO POR ORIGEM ──
  rows+=divider('📌 Lucro Líquido por Origem da Receita');
  if(recSliq>0){
    rows+=row('Receita líquida Serviços', recSliq, '', 1, false, '#58a6ff');
    rows+=row('(–) Custos Serviços (inclui terceiros pagos por nós)', -custoServTotal, '', 1);
    rows+=row('(–) Impostos Serviços', -dNFS, '', 1);
    rows+=row('(–) Comissão Serviços', -dComS, '', 1);
    rows+=row('(–) Risco Sacado rateado em Serviços', -rsS, '', 1);
    rows+=total('LUCRO LÍQUIDO SERVIÇOS', llS, llS>=0?'#58a6ff':'#f85149');
  }
  if(recMliq>0){
    rows+=row('Receita líquida Materiais', recMliq, '', 1, false, '#bc8cff');
    rows+=row('(–) Custos Materiais (inclui terceiros pagos por nós)', -custoMatTotal, '', 1);
    rows+=row('(–) Impostos Materiais', -dNFM, '', 1);
    rows+=row('(–) Comissão Materiais', -dComM, '', 1);
    rows+=row('(–) Risco Sacado rateado em Materiais', -rsM, '', 1);
    rows+=total('LUCRO LÍQUIDO MATERIAIS', llM, llM>=0?'#bc8cff':'#f85149');
  }

  // ── RESULTADO ──
  rows+=divider('✅ Resultado Final');
  rows+=row('Receita Total', pvTot, '', 1, false, '#58a6ff');
  rows+=row('(–) Custos Diretos próprios', -(custoS+custoM), '', 1);
  if(custoTerc>0) rows+=row('(–) Repasse Terceiros', -custoTerc, '', 1, false, '#f97316');
  rows+=row('(–) Total Deduções (impostos/comissões)', -totalDeduc, '', 1);
  rows+=total('LUCRO LÍQUIDO', ll, llCor);

  // ── RESERVA DE NEGOCIAÇÃO ──
  var dNegReserva2 = neg > 0 ? pvTot * neg : 0;
  var llAposNeg2 = ll - dNegReserva2;
  if(neg > 0){
    rows+=divider('🤝 Reserva de Negociação ('+(neg*100).toFixed(0)+'%)');
    rows+=row('Lucro líquido antes da reserva', ll, '', 1, false, '#8b949e');
    rows+=row('(–) Reserva de desconto ('+(neg*100).toFixed(0)+'% da receita)', -dNegReserva2, '', 1, false, '#f97316');
    rows+=total('LUCRO LÍQUIDO APÓS RESERVA', llAposNeg2, llAposNeg2>=0?'#3fb950':'#f85149');
  }

  // ── DESCONTO REAL (apenas se houver desconto aplicado nos Valores) ──
  if(desc > 0){
    var descPctReal = (pvS+pvM)>0 ? (desc/(pvS+pvM)*100) : 0;
    rows+=divider('🤝 Desconto Concedido: '+descPctReal.toFixed(1)+'% — '+money(desc));
    if(descS>0) rows+=row('(–) Desconto em Serviços', -descS, '', 1, false, '#f97316');
    if(descM>0) rows+=row('(–) Desconto em Materiais', -descM, '', 1, false, '#f97316');
    rows+=row('Receita líquida após desconto', pvTot, '', 1, false, '#58a6ff');
    rows+=row('(–) Custos + Deduções', -(custoTotal+totalDeduc-dDesc), '', 1);
    rows+=total('LUCRO COM DESCONTO APLICADO', ll, llCor);
  } else if(neg <= 0){
    rows+=divider('🤝 Desconto');
    rows+=row('Nenhum desconto aplicado nesta proposta.', 0, '', 1, false, '#8b949e');
  }

  // Semáforo
  var semaforo='';
  var status='', statusCor='', statusIcon='';
  if(ll<0){        status='PREJUÍZO';         statusCor='#f85149'; statusIcon='🔴';}
  else if(llPct<10){status='MARGEM BAIXA';    statusCor='#f97316'; statusIcon='🟡';}
  else if(llPct<20){status='MARGEM RAZOÁVEL'; statusCor='#d4a017'; statusIcon='🟡';}
  else {             status='MARGEM SAUDÁVEL'; statusCor='#3fb950'; statusIcon='🟢';}

  semaforo='<div style="display:flex;align-items:center;gap:1rem;padding:.8rem 1rem;border-radius:var(--r);background:'+statusCor+'18;border:1.5px solid '+statusCor+';margin-bottom:1rem">'
    +'<span style="font-size:2rem">'+statusIcon+'</span>'
    +'<div>'
      +'<div style="font-size:1rem;font-weight:700;color:'+statusCor+'">'+status+'</div>'
      +'<div style="font-size:.78rem;color:var(--text2)">Lucro líquido: '+money(ll)+' ('+llPct.toFixed(1)+'% da receita) &nbsp;|&nbsp; Proposta: #'+p.num+' – '+esc(p.cli)+'</div>'
    +'</div>'
    +'</div>';

  var barra='';
  if(pvTot>0){
    var pCusto=(custoTotal/pvTot*100).toFixed(1);
    var pDeduc=(totalDeduc/pvTot*100).toFixed(1);
    var pLucro=Math.max(0,(ll/pvTot*100)).toFixed(1);
    var pctLucroServ=Math.max(0,(llS/pvTot*100)).toFixed(1);
    var pctLucroMat=Math.max(0,(llM/pvTot*100)).toFixed(1);
    barra='<div style="margin-bottom:1rem">'
      +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.3rem">Composição da Receita</div>'
      +'<div style="height:22px;border-radius:8px;overflow:hidden;display:flex">'
        +'<div style="width:'+pCusto+'%;background:#bc8cff" title="Custo '+pCusto+'%"></div>'
        +'<div style="width:'+pDeduc+'%;background:#f97316" title="Deduções '+pDeduc+'%"></div>'
        +'<div style="width:'+pctLucroServ+'%;background:#58a6ff" title="Lucro Bruto Serviços '+pctLucroServ+'%"></div>'
        +'<div style="width:'+pctLucroMat+'%;background:#3fb950" title="Lucro Bruto Materiais '+pctLucroMat+'%"></div>'
      +'</div>'
      +'<div style="display:flex;gap:1rem;font-size:.72rem;color:var(--text2);margin-top:.3rem;flex-wrap:wrap">'
        +'<span>🟣 Custo '+pCusto+'%</span>'
        +'<span>🟠 Deduções '+pDeduc+'%</span>'
        +'<span style="color:#58a6ff">■ Lucro Líquido Serviços '+pctLucroServ+'%</span>'
        +'<span style="color:#3fb950">■ Lucro Líquido Materiais '+pctLucroMat+'%</span>'
        +'<span style="color:'+llCor+'">■ Lucro Líquido Geral '+pLucro+'%</span>'
      +'</div>'
    +'</div>';
  }

  // Indicadores avançados
  var precoMin = custoTotal + totalDeduc;
  var _fechadoSD = p.aliq && p.aliq.fechadoSemDesc === true;
  var _llAposNeg = ll - dNegReserva2;
  var margemAposDesc = (neg > 0 && !_fechadoSD) ? (pvTot>0 ? _llAposNeg/pvTot*100 : 0) : llPct;
  var _card2label = (neg > 0 && !_fechadoSD) ? '2⃣ Margem líquida após reserva Neg ('+( neg*100).toFixed(0)+'%)' : '2⃣ Margem líquida (proposta sem desconto)';
  var _card2desc  = (neg > 0 && !_fechadoSD) ? 'LL após deduzir a reserva de negociação de '+(neg*100).toFixed(0)+'% — valor real se o cliente receber o desconto máximo.' : 'Lucro líquido total após descontos, impostos, taxas e comissões.';
  var riscoFin = pvTot>0 ? (totalDeduc/pvTot)*100 : 0;
  var riscoTxt = riscoFin>=30?'ALTO':(riscoFin>=20?'MÉDIO':'BAIXO');
  var riscoCor = riscoFin>=30?'#f85149':(riscoFin>=20?'#d4a017':'#3fb950');
  var descMaxPct = pvTot>0 ? Math.max(0,(ll/pvTot)*100) : 0;
  var descMaxVal = pvTot>0 ? Math.max(0,ll) : 0;
  var descMaxCor = descMaxPct>=20 ? '#3fb950' : (descMaxPct>=10 ? '#d4a017' : '#f85149');

  var cardsAdv =
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.8rem;margin-bottom:1rem">'
      +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem">'
        +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">1️⃣ Break even (ponto de equilíbrio)</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:#f59e0b">'+money(precoMin)+'</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">Valor mínimo para cobrir custos + deduções sem prejuízo.</div>'
      +'</div>'
      +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem">'
        +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">'+_card2label+'</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:'+llCor+'">'+margemAposDesc.toFixed(1)+'%</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">'+_card2desc+'</div>'
      +'</div>'
      +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem">'
        +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">3️⃣ Risco financeiro da proposta</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:'+riscoCor+'">'+riscoTxt+' ('+riscoFin.toFixed(1)+'%)</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">Peso das deduções sobre a receita total da proposta.</div>'
      +'</div>'
      +'<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.8rem .9rem">'
        +'<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem">4️⃣ Desconto máximo possível</div>'
        +'<div style="font-size:1.1rem;font-weight:800;color:'+descMaxCor+'">'+descMaxPct.toFixed(1)+'%</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">Equivale a '+money(descMaxVal)+' de margem líquida disponível antes de zerar o lucro.</div>'
      +'</div>'
    +'</div>';

  // Semáforo sempre visível
  Q('anSemaforo').innerHTML = semaforo + barra + cardsAdv;

  // Extrato
  Q('anExtrato').innerHTML =
    '<div style="overflow-x:auto">'
    +'<table style="width:100%;border-collapse:collapse">'
    +'<thead><tr>'
    +'<th style="text-align:left;padding:.4rem .6rem;border-bottom:2px solid var(--border);font-size:.78rem;color:var(--text3)">Item</th>'
    +'<th style="text-align:right;padding:.4rem .6rem;border-bottom:2px solid var(--border);font-size:.78rem;color:var(--text3)">Valor (R$)</th>'
    +'<th style="text-align:right;padding:.4rem .6rem;border-bottom:2px solid var(--border);font-size:.78rem;color:var(--text3)">% Receita</th>'
    +'</tr></thead>'
    +'<tbody style="font-size:.82rem">'+rows+'</tbody>'
    +'</table></div>'
    +'<style>.an-row td{padding:.3rem .6rem;border-bottom:1px solid rgba(255,255,255,.04)}.an-row:hover td{background:rgba(255,255,255,.03)}</style>';

  // Gerar DRE com todos os valores calculados
  var dNeg2 = pvNeg>0?(pvNeg*(nfS*(pvS/pvTot||0.5)+nfM*(pvM/pvTot||0.5)+rs+comS*(pvS/pvTot||0.5)+comM*(pvM/pvTot||0.5))):0;
  gerarDRE(p, {
    pvTot:pvTot, pvS:pvS, pvM:pvM, desc:desc,
    custoS:custoS, custoM:custoM, custoTerc:custoTerc, custoTotal:custoTotal,
    dNFS:dNFS, dNFM:dNFM, dRS:dRS, dComS:dComS, dComM:dComM, totalDeduc:totalDeduc,
    ll:ll, llPct:llPct, llCor:llCor,
    llNeg:llNeg, llNegP:llNegPct, negCor:negCor, neg:neg, dNeg:dNeg2
  });

  // Mostrar aba extrato por padrão
  showAnTab('extrato');
}


// ══════════════════════════════════════════════
// EXPORTAR / IMPORTAR JSON
// ══════════════════════════════════════════════
function exportJSON(){
  var cfg=getPrc();
  var backup={
    versao: '1.0',
    exportadoEm: new Date().toISOString(),
    dispositivo: navigator.userAgent.substring(0,80),
    propostas: props,
    templates: (function(){ try{return JSON.parse(localStorage.getItem('tf_tpls')||'[]')}catch(e){return[]} })(),
    escopos:   (function(){ try{return JSON.parse(localStorage.getItem('tf_etpl')||'[]')}catch(e){return[]} })(),
    config:    cfg
  };
  // Salvar backup na nuvem automaticamente
  if(typeof sbSalvarBackup === 'function') sbSalvarBackup(backup);
  // Download do arquivo local
  var json=JSON.stringify(backup, null, 2);
  var blob=new Blob([json],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  var d=new Date();
  var fname='fortex_backup_'
    +d.getFullYear()
    +String(d.getMonth()+1).padStart(2,'0')
    +String(d.getDate()).padStart(2,'0')
    +'_'+String(d.getHours()).padStart(2,'0')
    +String(d.getMinutes()).padStart(2,'0')
    +'.json';
  a.href=url; a.download=fname;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('✔ Exportado e salvo na nuvem: '+fname,'ok');
}

function importJSON(input){
  var file=input.files[0];
  if(!file){return;}
  var reader=new FileReader();
  reader.onload=function(e){
    try{
      var bk=JSON.parse(e.target.result);
      if(!bk.versao||!bk.propostas){
        alert('Arquivo inválido. Verifique se é um backup TecFusion.');
        return;
      }
      // Confirmar antes de sobrescrever
      var exp2=bk.exportadoEm?new Date(bk.exportadoEm).toLocaleString('pt-BR'):'desconhecido';
      var nP=bk.propostas?bk.propostas.length:0;
      var nT=bk.templates?bk.templates.length:0;
      var nE=bk.escopos?bk.escopos.length:0;
      var msg='IMPORTAR BACKUP - Exportado: '+exp2+' | Propostas: '+nP+' | Templates: '+nT+' | Escopos: '+nE+' | OK=Mesclar / Cancelar=Abortar';
            var merge=confirm(msg);
      if(!merge){input.value='';return;}
      // Mesclar propostas (por ID, sem duplicar)
      if(bk.propostas&&bk.propostas.length){
        bk.propostas.forEach(function(p){
          var idx=props.findIndex(function(x){return x.id===p.id});
          if(idx>=0){
            // Proposta já existe — perguntar
            if(confirm('Proposta #'+p.num+' ('+p.cli+') já existe. Substituir pela versão importada?')){
              props[idx]=p;
            }
          } else {
            props.push(p);
          }
        });
        LS('tf_props', props);
      }
      // Mesclar templates
      if(bk.templates&&bk.templates.length){
        try{
          var locTpls=JSON.parse(localStorage.getItem('tf_tpls')||'[]');
          bk.templates.forEach(function(t){
            if(!locTpls.find(function(x){return x.id===t.id})) locTpls.push(t);
          });
          localStorage.setItem('tf_tpls', JSON.stringify(locTpls));
        }catch(e){}
      }
      // Mesclar escopos
      if(bk.escopos&&bk.escopos.length){
        try{
          var locEsc=JSON.parse(localStorage.getItem('tf_etpl')||'[]');
          bk.escopos.forEach(function(s){
            if(!locEsc.find(function(x){return x.id===s.id})) locEsc.push(s);
          });
          localStorage.setItem('tf_etpl', JSON.stringify(locEsc));
        }catch(e){}
      }
      // Config (só importa se não tiver local)
      if(bk.config&&!localStorage.getItem('tf_prc')){
        LS('tf_prc', bk.config);
      }
      input.value='';
      rDash();
      toast('✔ Importação concluída! '+bk.propostas.length+' proposta(s) mesclada(s).','ok');
    }catch(err){
      alert('Erro ao importar: '+err.message);
      input.value='';
    }
  };
  reader.readAsText(file);
}

// ══════════════════════════════════════════════
// PAINEL DE METAS
// ══════════════════════════════════════════════
function getMeta(){
  try{ return JSON.parse(localStorage.getItem('tf_meta')||'null'); }catch(e){ return null; }
}
function salvarMeta(){
  var meta={
    ano:   parseInt(Q('mAno').value)||new Date().getFullYear(),
    prop:  parseInt(Q('mProp').value)||142,
    fech:  parseInt(Q('mFech').value)||38,
    rec:   parseFloat(Q('mRec').value)||0,
    antProp: parseInt(Q('mAntProp').value)||109,
    antFech: parseInt(Q('mAntFech').value)||29,
    antRec:    parseFloat(Q('mAntRec').value)||0,
    antTicket: (function(){var v=Q('mAntTicket');return v&&v.value!==''?parseFloat(v.value)||0:75000;})()
  };
  localStorage.setItem('tf_meta', JSON.stringify(meta));
  Q('metaModal').style.display='none';
  rMeta();
  toast('✔ Metas salvas!','ok');
}
function abrirConfigMeta(){
  var m=getMeta()||{ano:2026,prop:142,fech:38,rec:0,antProp:109,antFech:29,antRec:0,antTicket:75000};
  Q('mAno').value=m.ano; Q('mProp').value=m.prop; Q('mFech').value=m.fech;
  Q('mRec').value=m.rec; Q('mAntProp').value=m.antProp;
  Q('mAntFech').value=m.antFech; Q('mAntRec').value=m.antRec;
  if(Q('mAntTicket'))Q('mAntTicket').value=(m.antTicket!=null&&m.antTicket!==0)?m.antTicket:75000;
  Q('metaModal').style.display='flex';
}
function togMeta(){
  var b=Q('metaBody'), ch=Q('metaChevron');
  var open=b.style.display!=='none';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲';
}
function rMeta(){
  var m=getMeta();
  var ano=m&&m.ano ? n2(m.ano) : new Date().getFullYear();
  Q('anoAtual').textContent=ano;
  if(!m){
    Q('metaBars').innerHTML='<p style="color:var(--text3);font-size:.8rem;grid-column:1/-1">Configure suas metas clicando em ⚙️ Configurar.</p>';
    Q('metaKpis').innerHTML='';
    return;
  }

  // Defaults seguros
  var metaProp = n2(m.prop||0);
  var metaFech = n2(m.fech||0);
  var metaRec  = n2(m.rec||0);
  var antProp  = n2(m.antProp||0);
  var antFech  = n2(m.antFech||0);
  var antRec     = n2(m.antRec||0);
  var antTicket  = n2(m.antTicket&&m.antTicket>0?m.antTicket:75000);

  // Propostas do ano — fonte única
  var propsAno=getPropsAno();
  var totalAno=propsAno.length;
  var fechAno=getFechAno().length;
  var recAno=getRecAno();

  var txConvNum = totalAno>0 ? (fechAno/totalAno)*100 : 0;
  var txConv = txConvNum.toFixed(1);

  // Mês atual
  var hoje=new Date();
  var mesAtual=hoje.getMonth()+1;
  var metaMensalProp=metaProp>0?(metaProp/12).toFixed(1):'0,0';
  var metaMensalFech=metaFech>0?(metaFech/12).toFixed(1):'0,0';

  // Projeção anual baseada no ritmo atual do ano corrido
  var fracAno=mesAtual/12;
  var projProp=fracAno>0?Math.round(totalAno/fracAno):0;
  var projFech=fracAno>0?Math.round(fechAno/fracAno):0;
  var projRec=fracAno>0?Math.round(recAno/fracAno):0;

  function progBarComMarco(label, atual, meta, antAno, cor, fmt){
    var pct    = meta>0 ? Math.min(100,(atual/meta)*100) : 0;
    var val    = fmt ? money(atual) : atual;
    var metaFmt= fmt ? money(meta)  : String(meta);
    var barCor = pct>=100?'#3fb950':pct>=70?'#d4a017':'#f85149';
    var pctAnt = meta>0&&antAno>0 ? Math.min(100,(antAno/meta)*100) : 0;
    var antLabel = fmt ? money(antAno) : String(antAno);
    var faltam = meta - atual;
    var faltamLabel = faltam>0 ? (fmt?money(faltam):faltam)+' para a meta' : '✅ Meta atingida!';
    var faltamCor = faltam>0 ? 'var(--text3)' : '#3fb950';
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.75rem .9rem">'
      // Linha 1: label + % grande em destaque
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">'
        +'<span style="font-size:.78rem;font-weight:600;color:var(--text2)">'+label+'</span>'
        +'<div style="text-align:right;line-height:1.1">'
          +'<div style="font-size:1.15rem;font-weight:900;color:'+barCor+';letter-spacing:-.02em">'+pct.toFixed(1)+'%</div>'
          +'<div style="font-size:.62rem;color:var(--text3)">da meta</div>'
        +'</div>'
      +'</div>'
      // Barra com marco do ano anterior
      +'<div style="position:relative;background:var(--bg2);border-radius:6px;height:10px;margin-bottom:.3rem">'
        +'<div style="height:100%;width:'+pct+'%;background:'+barCor+';border-radius:6px;transition:width .5s ease"></div>'
        +(pctAnt>0?'<div style="position:absolute;top:-4px;left:'+pctAnt.toFixed(1)+'%;width:3px;height:calc(100% + 8px);background:#f59e0b;border-radius:2px"></div>':'')
      +'</div>'
      // Label do ano anterior posicionado abaixo do marco
      +(pctAnt>0?'<div style="position:relative;height:14px;margin-bottom:.3rem"><span style="position:absolute;left:'+pctAnt.toFixed(1)+'%;transform:translateX(-50%);font-size:.65rem;color:#f59e0b;font-weight:700;white-space:nowrap">'+antLabel+'</span></div>':'')
      // Linha inferior: realizado | faltam | meta em destaque
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.1rem">'
        +'<div>'
          +'<div style="font-size:.72rem;color:var(--text3)">Realizado: <b style="color:var(--text);font-size:.8rem">'+val+'</b></div>'
          +'<div style="font-size:.68rem;color:'+faltamCor+'">'+faltamLabel+'</div>'
        +'</div>'
        // META em destaque — box separado
        +'<div class="meta-box">'
          +'<div class="meta-box-lbl">META</div>'
          +'<div class="meta-box-val">'+metaFmt+'</div>'
        +'</div>'
      +'</div>'
    +'</div>';
  }



function progBar(label, atual, meta, cor, fmt){
    var pct=meta>0?Math.min(100,(atual/meta)*100):0;
    var pctLabel=pct.toFixed(1)+'%';
    var val=fmt?money(atual):atual;
    var metaFmt=fmt?money(meta):meta;
    var barCor=pct>=100?'#3fb950':pct>=70?'#d4a017':'#f85149';
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.7rem .9rem">'
      +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.35rem">'
        +'<span style="font-size:.78rem;font-weight:600;color:var(--text2)">'+label+'</span>'
        +'<span style="font-size:.78rem;color:'+barCor+';font-weight:700">'+pctLabel+'</span>'
      +'</div>'
      +'<div style="background:var(--bg2);border-radius:6px;height:14px;overflow:hidden;margin-bottom:.35rem">'
        +'<div style="height:100%;width:'+pct+'%;background:'+barCor+';border-radius:6px;transition:width .4s ease"></div>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text3)">'
        +'<span>Realizado: <b style="color:var(--text)">'+val+'</b></span>'
        +'<span>Meta: <b style="color:var(--text)">'+metaFmt+'</b></span>'
      +'</div>'
    +'</div>';
  }

  function miniKpi(icon, label, val, sub, cor){
    return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.6rem .8rem">'
      +'<div style="font-size:.65rem;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.2rem">'+icon+' '+label+'</div>'
      +'<div style="font-size:1.05rem;font-weight:700;color:'+(cor||'var(--text)')+'">'+val+'</div>'
      +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">'+sub+'</div>'
    +'</div>';
  }

  function fmtDelta(v){
    var n=n2(v);
    var s=n>=0?'+':'';
    return s+n.toFixed(1)+'%';
  }

  // Barras principais
  Q('metaBars').innerHTML =
    progBarComMarco('📨 Propostas enviadas no ano ('+ano+')', totalAno, metaProp, antProp, '#58a6ff', false)
    +progBarComMarco('✅ Fechamentos no ano', fechAno, metaFech, antFech, '#3fb950', false)
    +(function(){
      // Barra de faturamento aprovado com projeção
      var pctRec=metaRec>0?Math.min(100,(recAno/metaRec)*100):0;
      var corRec=pctRec>=100?'#3fb950':pctRec>=70?'#d4a017':'#f85149';
      var pctAntRec=antRec>0&&metaRec>0?Math.min(100,(antRec/metaRec)*100):0;
      var vsAntRecLocal=antRec>0?(((projRec-antRec)/antRec)*100).toFixed(1)+'%':null;
      var faltaRec=Math.max(0,metaRec-recAno);
      var infoTexto='Ritmo atual: '+money(projRec)+' projetado no ano'+(vsAntRecLocal?' | '+(projRec>=antRec?'▲':'▼')+' '+vsAntRecLocal+' vs ano anterior':'');
      return (metaRec>0?'<div style="grid-column:1/-1;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.75rem .9rem">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">'
          +'<span style="font-size:.78rem;font-weight:600;color:var(--text2)">💰 Faturamento aprovado no ano</span>'
          +'<div style="text-align:right;line-height:1.1">'
            +'<div style="font-size:1.15rem;font-weight:900;color:'+corRec+';letter-spacing:-.02em">'+pctRec.toFixed(1)+'%</div>'
            +'<div style="font-size:.62rem;color:var(--text3)">da meta</div>'
          +'</div>'
        +'</div>'
        +'<div style="position:relative;background:var(--bg2);border-radius:6px;height:10px;margin-bottom:.3rem">'
          +'<div style="height:100%;width:'+pctRec+'%;background:'+corRec+';border-radius:6px;transition:width .5s ease"></div>'
          +(pctAntRec>0?'<div style="position:absolute;top:-4px;left:'+pctAntRec.toFixed(1)+'%;width:3px;height:calc(100% + 8px);background:#f59e0b;border-radius:2px"></div>':'')
        +'</div>'
        +(pctAntRec>0?'<div style="position:relative;height:14px;margin-bottom:.3rem"><span style="position:absolute;left:'+pctAntRec.toFixed(1)+'%;transform:translateX(-50%);font-size:.65rem;color:#f59e0b;font-weight:700;white-space:nowrap">'+money(antRec)+'</span></div>':'')
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-top:.1rem">'
          +'<div>'
            +'<div style="font-size:.72rem;color:var(--text3)">Realizado: <b style="color:var(--text);font-size:.8rem">'+money(recAno)+'</b></div>'
            +'<div style="font-size:.68rem;color:var(--text3)">'+infoTexto+'</div>'
          +'</div>'
          +'<div class="meta-box">'
            +'<div class="meta-box-lbl">META</div>'
            +'<div class="meta-box-val">'+money(metaRec)+'</div>'
          +'</div>'
        +'</div>'
      +'</div>':'');
    })()
    +(function(){
      var metaTx = metaProp>0?(metaFech/metaProp)*100:0;
      var pctReal = Math.min(100, Math.max(0, txConvNum));
      var cor = txConvNum>=metaTx ? '#3fb950' : txConvNum>=metaTx*0.7 ? '#d4a017' : '#f85149';
      return '<div style="grid-column:1/-1;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:.7rem .9rem">'
        +'<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.35rem">'
          +'<span style="font-size:.78rem;font-weight:600;color:var(--text2)">📈 Taxa de conversão do ano</span>'
          +'<span style="font-size:.78rem;color:'+cor+';font-weight:700">'+txConv+'%</span>'
        +'</div>'
        +'<div style="position:relative;background:var(--bg2);border-radius:6px;height:14px;margin-bottom:.35rem">'
          +'<div style="height:100%;width:'+pctReal+'%;background:'+cor+';border-radius:6px;transition:width .4s ease"></div>'
          +(metaTx>0?'<div style="position:absolute;top:-3px;left:'+Math.min(99,metaTx).toFixed(1)+'%;width:3px;height:calc(100% + 6px);background:#f59e0b;border-radius:2px"></div>':'')
        +'</div>'
        +(metaTx>0?'<div style="position:relative;height:14px;margin-bottom:.15rem"><span style="position:absolute;left:'+Math.min(99,metaTx).toFixed(1)+'%;transform:translateX(-50%);font-size:.67rem;color:#f59e0b;font-weight:700;white-space:nowrap">'+metaTx.toFixed(1)+'%</span></div>':'')
        +'<div style="display:flex;justify-content:space-between;font-size:.72rem;color:var(--text3)">'
          +'<span>Realizado: <b style="color:var(--text)">'+txConv+'%</b></span>'
          +'<span>Meta: <b style="color:var(--text)">'+metaTx.toFixed(1)+'%</b> <span style="opacity:.6">(linha de meta)</span></span>'
        +'</div>'
      +'</div>';
    })();

  var vsAntProp = antProp>0 ? ((projProp-antProp)/antProp)*100 : 0;
  var vsAntFech = antFech>0 ? ((projFech-antFech)/antFech)*100 : 0;
  var vsAntRec  = antRec>0 ? ((projRec-antRec)/antRec)*100 : 0;
  var metaTxAno = metaProp>0 ? ((metaFech/metaProp)*100) : 0;
  var antTxAno  = antProp>0 ? ((antFech/antProp)*100) : 0;

  // Coluna MENSAL
  var colMensal = '<div>'
    +'<div style="font-size:.67rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.45rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)">📅 Mensal</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.5rem">'
    +miniKpi('📨','Meta de Propostas/mês', metaMensalProp+'/mês', 'Baseado na meta anual de '+metaProp, '#58a6ff')
    +miniKpi('✅','Meta de Fechamentos/mês', metaMensalFech+'/mês', 'Baseado na meta anual de '+metaFech, '#3fb950')
    +miniKpi('📍','Mês atual', mesAtual+'/12', 'Ano corrido: '+(fracAno*100).toFixed(0)+'%', 'var(--text3)')
    +'</div></div>';

  // Coluna ANUAL
  var colAnual = '<div>'
    +'<div style="font-size:.67rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.45rem;padding-bottom:.3rem;border-bottom:1px solid var(--border)">📆 Anual</div>'
    +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.5rem">'
    +miniKpi('🔮','Projeção de Propostas', projProp, 'Ritmo atual | '+fmtDelta(vsAntProp)+' vs '+antProp+' ano ant.', projProp>=metaProp?'#3fb950':'#f97316')
    +miniKpi('🔮','Projeção de Fechamentos', projFech, 'Ritmo atual | '+fmtDelta(vsAntFech)+' vs '+antFech+' ano ant.', projFech>=metaFech?'#3fb950':'#f97316')
    +miniKpi('💰','Prev. Faturamento Anual', money(projRec), fmtDelta(vsAntRec)+' vs '+money(antRec)+' ano ant.', projRec>=metaRec && metaRec>0 ? '#3fb950' : '#f97316')
    +miniKpi('🔄','Taxa de Conversão', txConv+'%', 'Meta: '+metaTxAno.toFixed(1)+'% | Ano ant.: '+antTxAno.toFixed(1)+'%', txConvNum>=metaTxAno?'#3fb950':'#f97316')
    +'</div></div>';

  Q('metaKpis').innerHTML = colMensal + colAnual;
}

// ══════════════════════════════════════════════
// IMPORTAR PROPOSTA VIA JSON (colar do Claude)
// ══════════════════════════════════════════════
var _pasteObj = null;

function abrirImportProposta(){
  Q('pasteJson').value = '';
  Q('pastePreview').style.display = 'none';
  Q('pasteSaveBtn').style.display = 'none';
  _pasteObj = null;
  Q('pasteModal').style.display = 'flex';
}

function previewPasteJSON(){
  var txt = Q('pasteJson').value.trim();
  if(!txt){ alert('Cole o JSON primeiro.'); return; }
  try{
    // Aceitar JSON com ou sem wrapper de proposta
    var obj = JSON.parse(txt.replace(/```json|```/g,'').trim());
    // Se vier com wrapper {propostas:[...]} pegar a primeira
    if(obj.propostas && obj.propostas.length) obj = obj.propostas[0];
    _pasteObj = obj;
    var vs = parseFloat(obj.vS)||0;
    var vm = parseFloat(obj.vM)||0;
    var vd = parseFloat(obj.vD)||0;
    Q('pastePreview').style.display = 'block';
    Q('pastePreview').innerHTML =
      '<div style="font-weight:700;color:var(--accent);margin-bottom:.4rem">✅ JSON válido — dados identificados:</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.2rem .8rem;font-size:.75rem">'
      +'<span style="color:var(--text3)">Nº Proposta:</span><span><b>'+(obj.num||'—')+'</b></span>'
      +'<span style="color:var(--text3)">Cliente:</span><span>'+(obj.cli||'—')+'</span>'
      +'<span style="color:var(--text3)">Título:</span><span>'+(obj.tit||'—')+'</span>'
      +'<span style="color:var(--text3)">Data:</span><span>'+(obj.dat||obj.dat2||'—')+'</span>'
      +'<span style="color:var(--text3)">Cidade:</span><span>'+(obj.cid||'—')+'</span>'
      +'<span style="color:var(--text3)">Técnico:</span><span>'+(obj.ac||'—')+'</span>'
      +'<span style="color:var(--text3)">Serviços:</span><span style="color:var(--green)">'+money(vs)+'</span>'
      +'<span style="color:var(--text3)">Materiais:</span><span style="color:var(--green)">'+money(vm)+'</span>'
      +'<span style="color:var(--text3)">Desconto:</span><span style="color:#f97316">'+money(vd)+'</span>'
      +'<span style="color:var(--text3)">Total:</span><span style="color:var(--accent);font-weight:700">'+money(vs+vm-vd)+'</span>'
      +'</div>';
    Q('pasteSaveBtn').style.display = 'inline-flex';
  } catch(e){
    Q('pastePreview').style.display = 'block';
    Q('pastePreview').innerHTML = '<span style="color:#f85149">❌ JSON inválido: '+e.message+'</span>';
    Q('pasteSaveBtn').style.display = 'none';
  }
}

function salvarPasteJSON(){
  if(!_pasteObj){ alert('Verifique o JSON primeiro.'); return; }
  var o = _pasteObj;
  // Garantir campos obrigatórios
  var nova = Object.assign({
    id:uid(), num:'', cli:'', tit:'', dat:'', dat2:'', fas:'em_elaboracao',
    cid:'', ac:'', mail:'', tel:'', dep:'', cnpj:'', loc:'', csvc:'',
    res:'', val2:'', gar:'', pag:'', prz:'', cforn:'', imp:'',
    vS:0, vM:0, vD:0, val:0, ts:[], esc:[], bi:[], revs:[]
  }, o);
  // Mapear campo 'for' (palavra reservada) para 'cforn'
  if(o['for'] && !nova.cforn) nova.cforn = o['for'];
  // Recalcular val
  nova.val = (parseFloat(nova.vS)||0) + (parseFloat(nova.vM)||0) - (parseFloat(nova.vD)||0);
  // Garantir id único
  if(!nova.id || props.find(function(x){return x.id===nova.id})) nova.id = uid();
  // Converter escopo string para array se necessário
  if(typeof nova.esc === 'string' && nova.esc){
    nova.esc = [{id:uid(), num:'', titulo:'Escopo', desc:nova.esc, subs:[]}];
  }
  // Normalizar formato antigo {t,c} -> {titulo,desc}
  if(Array.isArray(nova.esc)){
    nova.esc = nova.esc.map(function(s){
      if(!s) return null;
      return {
        id:s.id||uid(), num:s.num||'',
        titulo:s.titulo||s.t||s.nome||'',
        desc:s.desc||s.c||s.conteudo||'',
        subs:Array.isArray(s.subs)?s.subs:[]
      };
    }).filter(Boolean);
  }
  props.unshift(nova);
  LS('tf_props', props);
  Q('pasteModal').style.display = 'none';
  _pasteObj = null;
  rDash();
  toast('✔ Proposta #'+nova.num+' importada!','ok');
}

var _milItens=[];
function openImportLote(){Q("milModal").style.display="block";}
function milFechar(){Q("milModal").style.display="none";}
// ═══════════════════════════════════════════════════════════════
// IMPORTAÇÃO EM LOTE — nova versão com mapeamento de colunas
// ═══════════════════════════════════════════════════════════════
var _milItens = [];
var _milMap   = {};  // {campo: indice_coluna (1-based, 0=ignorar)}
var _milNCols = 0;

// Campos disponíveis para mapeamento
var _milCampos = [
  {key:'tipo',  label:'Tipo *',          hint:'servico/material'},
  {key:'cat',   label:'Categoria *',     hint:'Ex: HT-01'},
  {key:'desc',  label:'Descrição',       hint:'Vazio = nome cat.'},
  {key:'tec',   label:'Técnicos',        hint:'Padrão: 1'},
  {key:'qtd',   label:'Quantidade',      hint:'Ex: 5 Dias'},
  {key:'fat',   label:'Fator/Unid.',     hint:'Ex: 8 Horas'},
  {key:'cu',    label:'Custo Unit. R$ *',hint:'Só número'},
  {key:'equip', label:'=Equip./Local',   hint:'Padrão: vazio'},
  {key:'inst',  label:'+Instalação',     hint:'Padrão: vazio'},
];

function milFechar(){ Q('milModal').style.display='none'; }

function milLimpar(){
  var ta=Q('milRawData'); if(ta) ta.value='';
  _milItens=[]; _milNCols=0;
  if(Q('milPrevia'))  Q('milPrevia').style.display='none';
  if(Q('milMsg'))     Q('milMsg').textContent='';
  if(Q('milColInfo')) Q('milColInfo').textContent='';
  _milMap={};
  milDetectarColunas();
}

function milLinhas(){
  var ta=Q('milRawData'); if(!ta) return [];
  var raw=(ta.value||'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
  if(!raw) return [];
  return raw.split('\n').filter(function(l){ return l.trim(); });
}

function milDetectarColunas(){
  var linhas = milLinhas();
  if(!linhas.length){ _milNCols=0; milRenderMap(); return; }
  // Detecta número máximo de colunas
  var maxCols = 0;
  linhas.forEach(function(l){ var n=l.split('\t').length; if(n>maxCols) maxCols=n; });
  _milNCols = maxCols;
  if(Q('milColInfo'))
    Q('milColInfo').textContent = linhas.length+' linha(s) detectada(s), '+maxCols+' coluna(s).';
  milRenderMap();
}

function milRenderMap(){
  var grid=Q('milMapGrid'); if(!grid) return;
  var opts='<option value="0">— ignorar —</option>';
  for(var i=1;i<=_milNCols;i++) opts+='<option value="'+i+'">Col '+i+'</option>';

  grid.innerHTML = _milCampos.map(function(f){
    var sel='<select id="milM_'+f.key+'" style="padding:.25rem .4rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:.76rem;width:100%">'+opts+'</select>';
    var saved=_milMap[f.key]||0;
    return '<label style="color:var(--text2);white-space:nowrap;font-size:.76rem" title="'+f.hint+'">'+f.label+'</label>'+sel;
  }).join('');

  // Restaura mapa salvo
  _milCampos.forEach(function(f){
    var el=document.getElementById('milM_'+f.key);
    if(el && _milMap[f.key]) el.value=_milMap[f.key];
  });
}

function _milSaveMap(){
  _milMap={};
  _milCampos.forEach(function(f){
    var el=document.getElementById('milM_'+f.key);
    if(el) _milMap[f.key]=parseInt(el.value)||0;
  });
}

function _milColVal(cols, key){
  var idx=(_milMap[key]||0)-1;
  if(idx<0||idx>=cols.length) return '';
  return (cols[idx]||'').trim();
}

function milPresetServico(){
  // Tipo|Cat|Desc|Tec|Qtd|Fator|Custo|Equip|Inst
  var preset={tipo:1,cat:2,desc:3,tec:4,qtd:5,fat:6,cu:7,equip:8,inst:9};
  _milMap=preset; milRenderMap();
  _milCampos.forEach(function(f){
    var el=document.getElementById('milM_'+f.key);
    if(el && preset[f.key]) el.value=preset[f.key];
  });
}

function milPresetMaterial(){
  // Tipo|Cat|Desc|Qtd|Custo|Equip|Inst (sem Tec/Fator)
  var preset={tipo:1,cat:2,desc:3,tec:0,qtd:4,fat:0,cu:5,equip:6,inst:7};
  _milMap=preset; milRenderMap();
  _milCampos.forEach(function(f){
    var el=document.getElementById('milM_'+f.key);
    if(el) el.value=preset[f.key]||0;
  });
}

function milNum(s){
  if(s===undefined||s===null||s==='') return null;
  var c=String(s).trim().replace(/[^0-9,.-]/g,'');
  if(!c) return null;
  var hasCom=c.indexOf(',')>=0, hasDot=c.indexOf('.')>=0;
  if(hasCom&&hasDot){ c=c.replace(/\./g,'').replace(',','.'); }
  else if(hasCom&&!hasDot){ c=c.replace(',','.'); }
  else if(hasDot&&!hasCom){
    var pts=c.split('.'); if(pts.length===2&&pts[1].length===3&&pts[0].length>=1) c=c.replace('.','');
  }
  var v=parseFloat(c); return isNaN(v)?null:v;
}

function milQtdUn(s){
  s=(s||'').trim(); if(!s) return{n:1,un:''};
  var parts=s.split(' ');
  var n=parseFloat((parts[0]||'').replace(',','.'));
  var un=parts.slice(1).join(' ').trim();
  return{n:isNaN(n)?1:n,un:un};
}

function milProcessar(){
  _milSaveMap();
  var linhas=milLinhas();
  if(!linhas.length){ Q('milMsg').textContent='Cole dados no campo acima.'; return; }

  // Detecta se primeira linha é cabeçalho
  var primeiraLinha=linhas[0].split('\t');
  var temCabecalho=isNaN(milNum(primeiraLinha[(_milMap.cu||1)-1]));
  var dados=temCabecalho?linhas.slice(1):linhas;

  if(!dados.length){ Q('milMsg').textContent='Nenhuma linha de dados encontrada.'; return; }

  var cfg=getPrcAtual(); _milItens=[]; var erros=0;
  var tbody=Q('milTbody'); if(!tbody) return;
  tbody.innerHTML='';

  dados.forEach(function(linha, idx){
    var cols=linha.split('\t');

    var tipo=(_milColVal(cols,'tipo')||'servico').toLowerCase();
    if(tipo==='s'||tipo.indexOf('serv')===0) tipo='servico';
    else if(tipo==='m'||tipo.indexOf('mat')===0) tipo='material';

    var cat=(_milColVal(cols,'cat')||'').toUpperCase();
    var desc=_milColVal(cols,'desc');
    var equip=_milColVal(cols,'equip');
    var inst=_milColVal(cols,'inst');
    var tec=Math.max(1,Math.round(milNum(_milColVal(cols,'tec'))||1));
    var qtdP=milQtdUn(_milColVal(cols,'qtd'));
    var fatP=milQtdUn(_milColVal(cols,'fat'));
    var cu=milNum(_milColVal(cols,'cu'));

    var erroLinha=[];
    if(tipo!=='servico'&&tipo!=='material') erroLinha.push('tipo inválido');
    if(!cat) erroLinha.push('categoria vazia');
    if(!cu||cu<=0) erroLinha.push('custo inválido');

    var mult,un1,un2,dias,hpd;
    if(tipo==='material'){
      mult=Math.max(1,qtdP.n); un1=qtdP.un||'Unidade'; un2=''; dias=1; hpd=1;
    } else {
      dias=Math.max(1,qtdP.n); hpd=Math.max(1,fatP.n);
      un1=qtdP.un||'Dias'; un2=fatP.un||'Horas'; mult=tec*dias*hpd;
    }

    var fmf=calcFMF(cfg,tipo,cat)||1;
    var pvu=(cu||0)*fmf, pvt=pvu*mult;

    var item={id:uid(),t:tipo,cat:cat,
      desc:desc||getCatLabel(tipo,cat),
      cu:cu||0,mult:mult,fmf:fmf,pvu:pvu,pvt:pvt,
      un1:un1,un2:un2,tec:tec,dias:dias,hpd:hpd,
      inc:true,terc:false,det:true,link:'',
      equip:equip,inst:inst,
      _ok:erroLinha.length===0};
    _milItens.push(item);
    if(!item._ok) erros++;

    var td='padding:.28rem .4rem;border:1px solid var(--border);';
    var IS='style="width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--border2);border-radius:3px;color:var(--text);font-family:inherit;font-size:.74rem;padding:2px 4px"';
    var stHtml=item._ok
      ? '<span style="color:#3fb950">✓ OK</span>'
      : '<span style="color:#f85149" title="'+erroLinha.join(', ')+'">✗ '+erroLinha.join(', ')+'</span>';
    var tr=document.createElement('tr');
    tr.setAttribute('data-mil-idx', _milItens.length-1);
    if(!item._ok) tr.style.background='rgba(248,81,73,.07)';
    // Tipo: select
    var tipoSel='<select '+IS+' onchange="milEditCampo(this,&apos;tipo&apos;)">'
      +'<option value="servico"'+(tipo==='servico'?' selected':'')+'>Svc</option>'
      +'<option value="material"'+(tipo==='material'?' selected':'')+'>Mat</option>'
      +'</select>';
    // Categoria: select com opções do tipo atual
    var catSel='<select '+IS+' id="milcat_'+(_milItens.length-1)+'" onchange="milEditCampo(this,&apos;cat&apos;)">'
      +_getCatOptions(tipo,'')
      +'</select>';
    // Decide se cada campo é editável ou ignorado (mapeamento = 0)
    function milCell(field, html){
      var mapeado = (_milMap[field]||0) > 0;
      if(mapeado) return '<td style="'+td+';padding:2px 3px">'+html+'</td>';
      return '<td style="'+td+';text-align:center;color:var(--text3);font-size:.7rem">—</td>';
    }
    tr.innerHTML=
      '<td style="'+td+';text-align:center;color:var(--text3)">'+(idx+1)+'</td>'
      // Tipo — sempre editável (derivado ou mapeado)
      +'<td style="'+td+';padding:2px 3px">'+tipoSel+'</td>'
      // Cat — sempre editável
      +'<td style="'+td+';padding:2px 3px">'+catSel+'</td>'
      // Campos que respeitam mapeamento
      +milCell('desc','<input type="text" '+IS+' value="'+esc(item.desc)+'" onchange="milEditCampo(this,&apos;desc&apos;)">')
      +milCell('qtd','<input type="number" '+IS+' value="'+(tipo==='material'?qtdP.n:dias)+'" min="0" step="0.01" onchange="milEditCampo(this,&apos;qtd&apos;)">')
      +milCell('cu','<input type="number" '+IS+' value="'+(cu||0)+'" min="0" step="0.01" onchange="milEditCampo(this,&apos;cu&apos;)">')
      +milCell('equip','<input type="text" '+IS+' value="'+esc(equip||'')+'" placeholder="=Equip." onchange="milEditCampo(this,&apos;equip&apos;)">')
      +milCell('inst','<input type="text" '+IS+' value="'+esc(inst||'')+'" placeholder="+Inst." onchange="milEditCampo(this,&apos;inst&apos;)">')
      +'<td class="mil-pvt" style="'+td+';text-align:right;font-weight:700">'+money(pvt)+'</td>'
      +'<td class="mil-st" style="'+td+'">'+stHtml+'</td>'
      // Botão excluir linha
      +'<td style="'+td+';text-align:center;width:28px">'
        +'<button onclick="milExcluirLinha(this)" style="background:rgba(248,81,73,.2);border:none;border-radius:3px;color:#f85149;cursor:pointer;font-size:.75rem;padding:2px 5px;line-height:1" title="Excluir esta linha">×</button>'
      +'</td>';
    tbody.appendChild(tr);
    // Seta categoria via JS (evita bug do selected em innerHTML)
    setTimeout((function(i,v){ return function(){
      var s=document.getElementById('milcat_'+i);
      if(s){ s.value=v; if(s.value!==v&&v){
        var o=document.createElement('option');o.value=v;o.textContent=v+' (cat. atual)';o.style.color='var(--accent)';
        s.insertBefore(o,s.firstChild);s.value=v;
      }}
    }; })(_milItens.length-1, cat), 0);
  });

  var okCount=_milItens.filter(function(x){return x._ok;}).length;
  Q('milPrevia').style.display='block';
  Q('milMsg').textContent='';
  Q('milMsgOk').textContent=(erros?erros+' com erro (serão ignorados). ':'')+okCount+' prontos para importar.';
}

// Edita um campo de item na prévia de importação
function milExcluirLinha(btn){
  var tr = btn.closest('tr');
  if(!tr) return;
  var idx = parseInt(tr.getAttribute('data-mil-idx'));
  if(isNaN(idx)) return;
  if(_milItens[idx]) { _milItens[idx]._ok=false; _milItens[idx]._excluido=true; }
  tr.parentNode.removeChild(tr);
  milRevalidarContador();
}

function milEditCampo(el, field){
  var tr = el.closest('tr');
  if(!tr) return;
  var idx = parseInt(tr.getAttribute('data-mil-idx'));
  if(isNaN(idx)||idx<0||idx>=_milItens.length) return;
  var it = _milItens[idx];
  var cfg = getPrcAtual();
  var val = el.value;

  if(field==='tipo'){
    it.t = val;
    // Recarrega select de categoria com opções do novo tipo
    var selCat = document.getElementById('milcat_'+idx);
    if(selCat){
      selCat.innerHTML = _getCatOptions(it.t, '');
      // Tenta manter a cat atual no novo tipo
      selCat.value = it.cat;
      if(selCat.value !== it.cat){
        // Categoria não existe no novo tipo — escolhe a primeira
        it.cat = selCat.options[0] ? selCat.options[0].value : '';
        selCat.value = it.cat;
      }
    }
  } else if(field==='cat'){
    it.cat = val;
    // Se categoria pertence ao outro tipo, corrige o tipo
    var dictM = cfg.m, dictS = cfg.s;
    if(dictM[it.cat] && it.t==='servico')  it.t='material';
    if(dictS[it.cat] && it.t==='material') it.t='servico';
    // Atualiza select de tipo na linha
    var selTipo = tr.querySelector('select:first-of-type');
    if(selTipo) selTipo.value = it.t;
  } else if(field==='desc')  { it.desc  = val.trim(); }
  else if(field==='equip')   { it.equip = val.trim(); }
  else if(field==='inst')    { it.inst  = val.trim(); }
  else if(field==='qtd'){
    var n = parseFloat(val)||1;
    if(it.t==='material'){ it.mult=Math.max(1,n); it.dias=1; }
    else { it.dias=Math.max(1,n); it.mult=n*(it.tec||1)*(it.hpd||1); }
  } else if(field==='cu'){
    it.cu = parseFloat(val)||0;
  }

  // Recalcula FMF e PV
  it.fmf = calcFMF(cfg, it.t, it.cat)||1;
  it.pvu  = it.cu * it.fmf;
  it.pvt  = it.pvu * it.mult;

  // Valida e atualiza células de PV Total e Status
  var erros=[];
  if(it.t!=='servico'&&it.t!=='material') erros.push('tipo inválido');
  if(!it.cat) erros.push('categoria vazia');
  if(!it.cu||it.cu<=0) erros.push('custo inválido');
  it._ok = erros.length===0;

  var pvtCell = tr.querySelector('.mil-pvt');
  var stCell  = tr.querySelector('.mil-st');
  if(pvtCell) pvtCell.textContent = money(it.pvt);
  if(stCell)  stCell.innerHTML = it._ok
    ? '<span style="color:#3fb950">✓ OK</span>'
    : '<span style="color:#f85149">✗ '+erros.join(', ')+'</span>';
  tr.style.background = it._ok ? '' : 'rgba(248,81,73,.07)';

  // Atualiza contador
  milRevalidarContador();
}

// Revalida todos os itens e atualiza contador
function milRevalidar(){
  var cfg = getPrcAtual();
  _milItens.forEach(function(it, idx){
    it.fmf = calcFMF(cfg, it.t, it.cat)||1;
    it.pvu = it.cu * it.fmf;
    it.pvt = it.pvu * it.mult;
    var erros=[];
    if(it.t!=='servico'&&it.t!=='material') erros.push('tipo inválido');
    if(!it.cat) erros.push('categoria vazia');
    if(!it.cu||it.cu<=0) erros.push('custo inválido');
    it._ok = erros.length===0;
    var tr = Q('milTbody').querySelector('[data-mil-idx="'+idx+'"]');
    if(!tr) return;
    var pvtCell=tr.querySelector('.mil-pvt'), stCell=tr.querySelector('.mil-st');
    if(pvtCell) pvtCell.textContent = money(it.pvt);
    if(stCell)  stCell.innerHTML = it._ok
      ? '<span style="color:#3fb950">✓ OK</span>'
      : '<span style="color:#f85149">✗ '+erros.join(', ')+'</span>';
    tr.style.background = it._ok ? '' : 'rgba(248,81,73,.07)';
  });
  milRevalidarContador();
}

function milRevalidarContador(){
  var ok=_milItens.filter(function(x){return x._ok&&!x._excluido;}).length;
  var err=_milItens.length-ok;
  var el=Q('milMsgOk');
  if(el) el.textContent=(err?err+' com erro. ':'')+ok+' prontos para importar.';
}

function milConfirmar(){
  var validos=_milItens.filter(function(x){return x._ok && !x._excluido;});
  if(!validos.length){ Q('milMsgOk').textContent='Nenhum item válido.'; return; }
  validos.forEach(function(it){ budg.push(normalizeBudgetItem(it)); });
  rBudg(); updKpi();
  try{ if(typeof editId!=='undefined'&&editId) upsertCurrentDraft(true); }catch(e){}
  milFechar(); milLimpar();
  toast(validos.length+' item(s) importados com sucesso!','ok');
}


// ══════════════════════════════════════════════
// CRUD DE CATEGORIAS
// ══════════════════════════════════════════════
var _catEditKey=null, _catEditTipo=null;

function catTipoChange(){
  var t=Q('catTipo').value;
  Q('catMarLabel').textContent=t==='s'?'Margem % (sobre PV)':'Markup % (sobre custo)';
}

function novaCategoria(){
  _catEditKey=null; _catEditTipo=null;
  Q('catModalTit').textContent='➕ Nova Categoria';
  Q('catCod').value=''; Q('catCod').disabled=false;
  Q('catNome').value=''; Q('catMar').value='50';
  Q('catRMin').value='35'; Q('catRMax').value='55'; Q('catDesc').value='';
  if(Q('catSalvPadrao')) Q('catSalvPadrao').checked=true;
  var abaAtiva=(Q('marTbM')&&Q('marTbM').style.display!=='none')?'m':'s';
  Q('catTipo').value=abaAtiva; Q('catTipo').disabled=false;
  catTipoChange();
  Q('catModal').style.display='flex';
}

function editCategoria(k,tipo){
  var cfg=getPrcAtual();
  var cat=tipo==='s'?cfg.s[k]:cfg.m[k];
  if(!cat)return;
  _catEditKey=k; _catEditTipo=tipo;
  Q('catModalTit').textContent='✏️ Editar Categoria: '+k;
  Q('catCod').value=k; Q('catCod').disabled=false; // código editável
  Q('catTipo').value=tipo; Q('catTipo').disabled=true;
  Q('catNome').value=cat.n||'';
  var marVal=tipo==='s'?((cat.m||0)*100):((cat.mk||0)*100);
  Q('catMar').value=marVal.toFixed(1);
  Q('catRMin').value=((cat.rMin||0)*100).toFixed(0);
  Q('catRMax').value=((cat.rMax||0)*100).toFixed(0);
  Q('catDesc').value=(cat.desc||'').replace(/;\s*/g,'; ');
  catTipoChange();
  if(Q('catSalvPadrao')) Q('catSalvPadrao').checked=false;
  Q('catModal').style.display='flex';
}

function salvarCategoria(){
  var cfg=getPrcAtual();
  var tipo=Q('catTipo').value;
  var cod=(Q('catCod').value||'').trim().toUpperCase();
  var nome=(Q('catNome').value||'').trim();
  var mar=parseFloat(Q('catMar').value)||0;
  var rMin=parseFloat(Q('catRMin').value)||0;
  var rMax=parseFloat(Q('catRMax').value)||0;
  var desc=(Q('catDesc').value||'').trim();

  if(!cod){alert('Informe o código da categoria.');return;}
  if(!nome){alert('Informe o nome da categoria.');return;}
  if(rMin>rMax){alert('Range Mín não pode ser maior que Range Máx.');return;}

  // Verificar duplicidade — só bloquear se for código DIFERENTE do original em edição
  var codOriginal=_catEditKey||'';
  if(cod!==codOriginal){
    if(tipo==='s'&&cfg.s[cod]){alert('Código '+cod+' já existe em Serviços.');return;}
    if(tipo==='m'&&cfg.m[cod]){alert('Código '+cod+' já existe em Materiais.');return;}
  }

  var obj={n:nome, rMin:rMin/100, rMax:rMax/100, desc:desc};
  if(tipo==='s') obj.m=mar/100; else obj.mk=mar/100;

  // Se código mudou: remover chave antiga e renomear nos itens do orçamento
  if(_catEditKey && cod!==codOriginal){
    if(tipo==='s') delete cfg.s[codOriginal]; else delete cfg.m[codOriginal];
    // Registrar código antigo como excluído para o merge não recriar
    var _excl2=LS('tf_cats_excluidas')||{s:{},m:{}};
    if(!_excl2.s)_excl2.s={}; if(!_excl2.m)_excl2.m={};
    if(tipo==='s')_excl2.s[codOriginal]=true; else _excl2.m[codOriginal]=true;
    LS('tf_cats_excluidas',_excl2);
    // Renomear cat nos itens do orçamento
    budg.forEach(function(it){
      if(it.cat===codOriginal&&it.t===tipo) it.cat=cod;
    });
  }

  if(tipo==='s') cfg.s[cod]=obj; else cfg.m[cod]=obj;
  savePrcAtual(cfg);

  // Recalcular itens do orçamento que usam esta categoria
  var recalc=0;
  budg.forEach(function(it){
    if(it.cat===cod&&it.t===tipo){
      var novoFmf=calcFMF(cfg,it.t,it.cat);
      it.fmf=novoFmf; it.pvu=it.cu*novoFmf; it.pvt=it.pvu*it.mult; recalc++;
    }
  });

  var salvarPadrao=Q('catSalvPadrao')&&Q('catSalvPadrao').checked;
  if(salvarPadrao){
    salvarComoDefp(cod, tipo, obj);
    // Also write directly to tf_prc global so new proposals see it immediately
    var globalCfg=LS('tf_prc')||JSON.parse(JSON.stringify(DEFP));
    if(!globalCfg.s) globalCfg.s={};
    if(!globalCfg.m) globalCfg.m={};
    if(tipo==='s') globalCfg.s[cod]=JSON.parse(JSON.stringify(obj));
    else globalCfg.m[cod]=JSON.parse(JSON.stringify(obj));
    LS('tf_prc', globalCfg);
  }
  Q('catModal').style.display='none';
  rMargens();
  if(recalc>0){rBudg();updKpi();toast('✔ Categoria salva'+(salvarPadrao?' e definida como padrão':'')+'. '+recalc+' item(ns) recalculado(s).','ok');}
  else toast('✔ Categoria salva'+(salvarPadrao?' e definida como padrão':'')+'!','ok');
}

function aplicarMargNaProposta(){
  if(!editId){ toast('Abra uma proposta primeiro para usar esta função.','err'); return; }
  var p=props.find(function(x){return x.id===editId;});
  if(!p||!p.bi||!p.bi.length){ toast('Esta proposta não tem itens de orçamento.','err'); return; }
  var cod=_catEditKey;
  var tipo=Q('catTipo').value; // 's' ou 'm'
  var mar=parseFloat(Q('catMar').value)||0;
  if(!cod){ toast('Nenhuma categoria selecionada.','err'); return; }
  try{
    var cfg=JSON.parse(JSON.stringify(getPrcAtual()));
    if(tipo==='s'){ if(!cfg.s)cfg.s={}; if(!cfg.s[cod])cfg.s[cod]={n:cod,m:0,rMin:0,rMax:0}; cfg.s[cod].m=mar/100; }
    else           { if(!cfg.m)cfg.m={}; if(!cfg.m[cod])cfg.m[cod]={n:cod,mk:0,rMin:0,rMax:0}; cfg.m[cod].mk=mar/100; }
    var count=0;
    p.bi.forEach(function(it){
      var isMat=(it.t==='material');
      var match=(tipo==='m')?isMat:!isMat;
      if(it.cat===cod&&match&&it.inc!==false){
        var novoFmf=calcFMF(cfg,it.t,it.cat);
        it.fmf=novoFmf; it.pvu=(it.cu||0)*novoFmf; it.pvt=it.pvu*(it.mult||1);
        // Sync budg (deep copy used by rBudg renderer)
        var bi=budg.find(function(b){return b.id===it.id;});
        if(bi){ bi.fmf=it.fmf; bi.pvu=it.pvu; bi.pvt=it.pvt; }
        count++;
      }
    });
    if(!count){ toast('Nenhum item da categoria '+cod+' encontrado nesta proposta.','warn'); return; }
    savePrcAtual(cfg); // persiste a nova margem em p.prc + global + chama saveAll()
    Q('catModal').style.display='none';
    try{ rBudg(); }catch(e){ console.warn('rBudg err:',e); }
    try{ rMargens(); }catch(e){}
    try{ updKpi(); }catch(e){}
    var _msg='✔ Margem '+mar.toFixed(1)+'% aplicada a '+count+' item(ns) de '+cod+'!';
    setTimeout(function(){ toast(_msg,'ok'); }, 80);
  }catch(e){
    toast('Erro ao aplicar margem: '+e.message,'err');
    console.error('aplicarMargNaProposta erro:',e);
  }
}

function delCategoria(k,tipo){
  var usada=budg.filter(function(it){return it.cat===k&&it.t===tipo;}).length;
  var msg='Excluir categoria '+k+'?';
  if(usada>0) msg+=' ATENÇÃO: '+usada+' item(ns) no orçamento atual usam esta categoria e ficarão sem FMF correto.';
  if(!confirm(msg))return;
  var cfg=getPrcAtual();
  if(tipo==='s') delete cfg.s[k]; else delete cfg.m[k];
  savePrcAtual(cfg);
  // Registrar exclusão para o merge não recriar
  var _excl=LS('tf_cats_excluidas')||{s:{},m:{}};
  if(!_excl.s)_excl.s={}; if(!_excl.m)_excl.m={};
  if(tipo==='s')_excl.s[k]=true; else _excl.m[k]=true;
  LS('tf_cats_excluidas',_excl);
  removerDeDefp(k, tipo);
  rMargens();
  toast('🗑 Categoria '+k+' excluída.','ok');
}


var _budgSnapshot = null;

function desfazerSimulacao(){
  if(!_budgSnapshot){ toast('Nenhum snapshot disponível para desfazer.','err'); return; }
  if(!confirm('Desfazer simulação? Os FMF voltarão aos valores anteriores à simulação.'))return;
  budg = _budgSnapshot.map(function(it){ return JSON.parse(JSON.stringify(it)); });
  _budgSnapshot = null;
  upsertCurrentDraft();
  updBT(); rBudg(); updKpi();
  var btnDes=document.getElementById('simDesfazerBtn');
  if(btnDes) btnDes.style.display='none';
  document.getElementById('simResultado').innerHTML='<span style="color:#3fb950">↩ FMF restaurado ao valor anterior à simulação.</span>';
  toast('↩ Simulação desfeita.','ok');
}


// ══════════════════════════════════════════════
// DEFP CUSTOMIZADO — padrões editáveis pelo usuário
// ══════════════════════════════════════════════
function getDefpCustom(){
  try{ return JSON.parse(localStorage.getItem('tf_defp_custom')||'null'); }catch(e){ return null; }
}
function saveDefpCustom(d){ localStorage.setItem('tf_defp_custom', JSON.stringify(d)); }

// Retorna o DEFP mesclado: hardcoded + customizações do usuário
function getDefpMerged(){
  var base={ s:JSON.parse(JSON.stringify(DEFP.s)), m:JSON.parse(JSON.stringify(DEFP.m)) };
  var custom=getDefpCustom();
  if(custom){
    if(custom.s) Object.keys(custom.s).forEach(function(k){ base.s[k]=custom.s[k]; });
    if(custom.m) Object.keys(custom.m).forEach(function(k){ base.m[k]=custom.m[k]; });
  }
  return base;
}

// Salvar categoria como padrão (no custom)
function salvarComoDefp(k, tipo, obj){
  var custom=getDefpCustom()||{s:{},m:{}};
  if(!custom.s) custom.s={};
  if(!custom.m) custom.m={};
  if(tipo==='s') custom.s[k]=JSON.parse(JSON.stringify(obj));
  else custom.m[k]=JSON.parse(JSON.stringify(obj));
  saveDefpCustom(custom);
}

// Remover categoria do padrão customizado (quando excluída)
function removerDeDefp(k, tipo){
  var custom=getDefpCustom();
  if(!custom) return;
  if(tipo==='s'&&custom.s) delete custom.s[k];
  if(tipo==='m'&&custom.m) delete custom.m[k];
  saveDefpCustom(custom);
}


// ══════════════════════════════════════════════════════
// CATEGORIAS POR PROPOSTA
// getPrcProp(p) → retorna cfg de categorias da proposta
// V345: aliq da proposta (p.aliq) tem prioridade sobre o global
// ══════════════════════════════════════════════════════
function getPrcProp(p){
  var global=getPrc(); // already merges tf_defp_custom
  if(!p||!p.prc) {
    var r0=JSON.parse(JSON.stringify(global));
    if(p&&p.aliq) r0.aliq=JSON.parse(JSON.stringify(p.aliq));
    return r0;
  }
  // Mescla: começa com global (que inclui custom), depois sobrepõe com dados da proposta
  var r=JSON.parse(JSON.stringify(global));
  if(p.prc.s) Object.keys(p.prc.s).forEach(function(k){ r.s[k]=JSON.parse(JSON.stringify(p.prc.s[k])); });
  if(p.prc.m) Object.keys(p.prc.m).forEach(function(k){ r.m[k]=JSON.parse(JSON.stringify(p.prc.m[k])); });
  // FIX V345 #1: aplicar aliq da proposta (não usar aliq global para calcFMF)
  if(p.aliq) r.aliq=JSON.parse(JSON.stringify(p.aliq));
  return r;
}

// Retorna cfg de categorias da proposta em edição
function getPrcAtual(){
  if(!editId) return getPrc();
  var p=props.find(function(x){return x.id===editId;});
  return getPrcProp(p);
}

// Salva cfg de categorias na proposta em edição
// FIX V345 #3: salva aliq na proposta (p.aliq); NÃO grava aliq da proposta no global tf_prc
function savePrcAtual(cfg){
  if(!editId){ LS('tf_prc',cfg); return; }
  var idx=props.findIndex(function(x){return x.id===editId;});
  if(idx<0){ LS('tf_prc',cfg); return; }
  if(!props[idx].prc) props[idx].prc={};
  props[idx].prc.s=JSON.parse(JSON.stringify(cfg.s));
  props[idx].prc.m=JSON.parse(JSON.stringify(cfg.m));
  // FIX V345 #3: salvar aliq na proposta, não no global
  props[idx].aliq=JSON.parse(JSON.stringify(cfg.aliq));
  // Salva s/m no global tf_prc (categorias), mas preserva aliq global intacta
  var globalCfg=LS('tf_prc')||JSON.parse(JSON.stringify(DEFP));
  globalCfg.s=JSON.parse(JSON.stringify(cfg.s));
  globalCfg.m=JSON.parse(JSON.stringify(cfg.m));
  LS('tf_prc',globalCfg);
  saveAll();
}

// ══ BLOCO 2 ══
function togVisaoGeral(){
  var b=Q('visaoGeralBody'), ch=Q('visaoGeralChevron');
  if(!b||!ch) return;
  var open=b.style.display!=='none';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲';
}
function togRanking(){
  var b=Q('rankingBody'), ch=Q('rankingChevron');
  if(!b||!ch) return;
  var open=b.style.display!=='none';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲';
}

// ══ BLOCO 3 ══
var _logTab='hist';
function abrirLog(){
  if(!editId){toast('Abra uma proposta primeiro.','err');return;}
  var m=Q('logModal');if(!m)return;
  m.style.display='flex';
  _logTab='hist';
  rLogModal();
}
function fecharLog(){var m=Q('logModal');if(m)m.style.display='none';}
function logSetTab(t){_logTab=t;rLogModal();}
function getLogData(){
  var p=props.find(function(x){return x.id===editId;});
  if(!p)return{hist:[],relat:[]};
  return p.log||{hist:[],relat:[]};
}
function saveLogData(log){
  var idx=props.findIndex(function(x){return x.id===editId;});
  if(idx<0)return;
  props[idx].log=log;
  saveAll();
}
function rLogModal(){
  var log=getLogData();
  var lista=_logTab==='hist'?log.hist:log.relat;
  var tabHist=(_logTab==='hist');
  var tabs=Q('logTabs');
  if(tabs){
    var btnH='<button onclick="logSetTab(\'hist\')" style="padding:.4rem 1.1rem;border:none;cursor:pointer;border-radius:6px 6px 0 0;font-weight:700;font-size:.88rem;'+(tabHist?'background:var(--bg2);color:var(--accent);border-bottom:2px solid var(--accent)':'background:var(--bg3);color:var(--text3)')+'">&#128203; Hist&oacute;rico Comercial</button>';
    var btnR='<button onclick="logSetTab(\'relat\')" style="padding:.4rem 1.1rem;border:none;cursor:pointer;border-radius:6px 6px 0 0;font-weight:700;font-size:.88rem;margin-left:4px;'+(!tabHist?'background:var(--bg2);color:var(--green);border-bottom:2px solid var(--green)':'background:var(--bg3);color:var(--text3)')+'">&#128295; Relat&oacute;rio de Servi&ccedil;o</button>';
    tabs.innerHTML=btnH+btnR;
  }
  var ctr=Q('logCount');
  if(ctr)ctr.textContent=lista.length+' registro'+(lista.length!==1?'s':'');
  var el=Q('logLista');if(!el)return;
  if(!lista.length){
    el.innerHTML='<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.88rem">Nenhum registro ainda. Clique em <strong>+ Novo Registro</strong>.</div>';
    return;
  }
  var sorted=lista.slice().sort(function(a,b){return(b.ts||0)-(a.ts||0);});
  el.innerHTML=sorted.map(function(item){
    var iid=item.id;
    return '<div style="border:1px solid var(--border);border-radius:8px;padding:.85rem 1rem;margin-bottom:.6rem;background:var(--bg3)">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.45rem">'
        +'<div style="font-weight:700;font-size:.9rem;color:var(--text);flex:1">'+esc(item.titulo||'(sem t&iacute;tulo)')+'</div>'
        +'<div style="display:flex;gap:.35rem;flex-shrink:0">'
          +'<span style="font-size:.75rem;color:var(--text3);padding:.15rem .5rem;background:var(--bg2);border-radius:4px">'+esc(item.data||'')+'</span>'
          +'<button onclick="logEditar(\''+iid+'\')" style="font-size:.72rem;padding:.18rem .45rem;border:1px solid var(--border);border-radius:4px;background:var(--bg2);color:var(--text2);cursor:pointer">&#9998;</button>'
          +'<button onclick="logExcluir(\''+iid+'\')" style="font-size:.72rem;padding:.18rem .45rem;border:1px solid var(--border);border-radius:4px;background:var(--bg2);color:var(--red);cursor:pointer">&#128465;</button>'
        +'</div>'
      +'</div>'
      +'<div style="font-size:.85rem;color:var(--text2);white-space:pre-wrap;line-height:1.55">'+esc(item.texto||'')+'</div>'
    +'</div>';
  }).join('');
}
function logNovoForm(){
  var f=Q('logForm');if(!f)return;
  f.style.display='block';
  Q('logFTitulo').value='';Q('logFTexto').value='';
  Q('logFData').value=new Date().toISOString().slice(0,10);
  Q('logFId').value='';Q('logFTitulo').focus();
}
function logEditar(id){
  var log=getLogData();
  var lista=_logTab==='hist'?log.hist:log.relat;
  var item=lista.find(function(x){return x.id===id;});
  if(!item)return;
  var f=Q('logForm');if(!f)return;
  f.style.display='block';
  Q('logFTitulo').value=item.titulo||'';Q('logFTexto').value=item.texto||'';
  Q('logFData').value=item.data||'';Q('logFId').value=id;Q('logFTitulo').focus();
}
function logSalvarForm(){
  var titulo=(Q('logFTitulo').value||'').trim();
  var texto=(Q('logFTexto').value||'').trim();
  var data=Q('logFData').value||'';
  var fid=Q('logFId').value||'';
  if(!titulo){toast('Informe um t\u00edtulo.','err');Q('logFTitulo').focus();return;}
  var log=getLogData();
  var lista=_logTab==='hist'?log.hist:log.relat;
  if(fid){
    var idx=lista.findIndex(function(x){return x.id===fid;});
    if(idx>=0){lista[idx].titulo=titulo;lista[idx].texto=texto;lista[idx].data=data;lista[idx].ts=Date.now();}
  }else{
    lista.push({id:uid(),titulo:titulo,texto:texto,data:data,ts:Date.now()});
  }
  if(_logTab==='hist')log.hist=lista;else log.relat=lista;
  saveLogData(log);
  Q('logForm').style.display='none';
  rLogModal();
  toast('Registro salvo!','ok');
}
function logCancelarForm(){var f=Q('logForm');if(f)f.style.display='none';}
function logExcluir(id){
  if(!confirm('Excluir este registro?'))return;
  var log=getLogData();
  if(_logTab==='hist')log.hist=log.hist.filter(function(x){return x.id!==id;});
  else log.relat=log.relat.filter(function(x){return x.id!==id;});
  saveLogData(log);rLogModal();toast('Registro exclu\u00eddo.','ok');
}

// ══ BLOCO 4 ══
var _tempGantt=null;
function getGantt(){
  var p=props.find(function(x){return x.id===editId;});
  if(!p){
    // Proposta ainda não salva: usa armazenamento temporário em memória
    if(!_tempGantt)_tempGantt={inicio:'',fases:[],trabSab:false,trabDom:false,feriados:[]};
    return _tempGantt;
  }
  if(!p.gantt)p.gantt={inicio:'',fases:[],trabSab:false,trabDom:false,feriados:[]};
  if(p.gantt.trabSab===undefined)p.gantt.trabSab=false;
  if(p.gantt.trabDom===undefined)p.gantt.trabDom=false;
  if(!p.gantt.feriados)p.gantt.feriados=[];
  return p.gantt;
}
function saveGantt(g){
  var idx=props.findIndex(function(x){return x.id===editId;});
  if(idx<0){_tempGantt=g;return;} // sem proposta salva: mantém só em memória
  props[idx].gantt=g;saveAll();
}

// Feriados nacionais BR (fixos) — MM-DD
var FERIADOS_BR_FIXOS=[
  '01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'
];
// Feriados móveis calculados por ano
function feriadosMoveisAno(ano){
  // Páscoa (algoritmo de Meeus/Jones/Butcher)
  var a=ano%19,b=Math.floor(ano/100),c=ano%100;
  var d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25);
  var g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  var i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7;
  var m=Math.floor((a+11*h+22*l)/451);
  var mes=Math.floor((h+l-7*m+114)/31);
  var dia=(h+l-7*m+114)%31+1;
  var pascoa=new Date(ano,mes-1,dia);
  function addD(d,n){var r=new Date(d);r.setDate(r.getDate()+n);return r;}
  function toKey(d){return (d.getMonth()+1+'').padStart(2,'0')+'-'+(d.getDate()+'').padStart(2,'0');}
  return [
    toKey(addD(pascoa,-48)), // 2a Carnaval
    toKey(addD(pascoa,-47)), // 3a Carnaval
    toKey(addD(pascoa,-2)),  // Sexta Santa
    toKey(pascoa),           // Páscoa
    toKey(addD(pascoa,60)),  // Corpus Christi
  ];
}
function isFeriado(dt, g){
  var ano=dt.getFullYear();
  var mmdd=(dt.getMonth()+1+'').padStart(2,'0')+'-'+(dt.getDate()+'').padStart(2,'0');
  var yyyymmdd=ano+'-'+mmdd;
  // Nacionais fixos
  if(FERIADOS_BR_FIXOS.indexOf(mmdd)>=0) return true;
  // Nacionais móveis
  if(feriadosMoveisAno(ano).indexOf(mmdd)>=0) return true;
  // Lista manual da proposta
  var lista=g.feriados||[];
  for(var i=0;i<lista.length;i++){
    var fk=(lista[i].data||'').trim();
    if(fk===yyyymmdd||fk===mmdd) return true;
  }
  return false;
}
function isDiaUtil(dt,g){
  var dow=dt.getDay(); // 0=dom,6=sab
  if(dow===6&&!g.trabSab) return false;
  if(dow===0&&!g.trabDom) return false;
  if(isFeriado(dt,g)) return false;
  return true;
}
// Avança para o próximo dia útil a partir de d (inclusive d)
function proxDiaUtil(d,g){
  var r=new Date(d);
  while(!isDiaUtil(r,g)) r.setDate(r.getDate()+1);
  return r;
}
// Avança exatamente n dias úteis a partir de d
// offset=0 → retorna o próprio d (ou próximo útil se d não for útil)
// offset=1 → avança 1 dia útil a partir de d
function addDiasUteis(d,n,g){
  // FIX V364: arredondar n para evitar bug de float (3.5 < 3.5 = false, mas 3 < 3.5 = true)
  var nInt=Math.round(n);
  var r=proxDiaUtil(d,g); // garante que começa num dia útil
  var contados=0;
  while(contados<nInt){
    r.setDate(r.getDate()+1);
    if(isDiaUtil(r,g)) contados++;
  }
  return r;
}
// Data de início da fase: offset dias úteis após o início do projeto
function faseInicio(inicio,offsetUteis,g){
  return addDiasUteis(inicio,offsetUteis,g);
}
// Data de fim da fase: dtIni + (dur-1) dias úteis
function faseFim(dtIni,durUteis,g){
  if(durUteis<=1) return new Date(dtIni);
  return addDiasUteis(dtIni,durUteis-1,g);
}
// Total de dias corridos de uma fase (para posicionar na barra)
function diasCorridosEntre(d1,d2){
  return Math.round((d2-d1)/(1000*60*60*24));
}

function ganttEditorHTML(si){
  var g=getGantt();
  var fases=g.fases||[];
  var inicio=g.inicio||'';
  var cores=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];

  var rows='';
  var nFases=fases.length;
  fases.forEach(function(f,fi){
    var cor=f.cor||cores[fi%cores.length];
    var isFirst=fi===0,isLast=fi===nFases-1;
    var btnUp='<button onclick="ganttMover('+fi+',-1)" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:.7rem;padding:0;line-height:1;opacity:'+(isFirst?'0.2':'1')+'" '+(isFirst?'disabled':'')+' title="Subir">&#9650;</button>';
    var btnDn='<button onclick="ganttMover('+fi+',1)" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:.7rem;padding:0;line-height:1;opacity:'+(isLast?'0.2':'1')+'" '+(isLast?'disabled':'')+' title="Descer">&#9660;</button>';
    var btnIns='<button onclick="ganttInsAbaixo('+fi+')" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:.82rem;padding:0;line-height:1;font-weight:700" title="Inserir abaixo">&#43;</button>';
    rows+='<tr style="font-size:.8rem">'
      +'<td style="padding:.1rem .2rem;width:26px"><div style="display:flex;flex-direction:column;align-items:center;gap:1px">'+btnUp+btnDn+'</div></td>'
      +'<td style="padding:.2rem .3rem"><input type="text" value="'+esc(f.nome||'')+'" placeholder="Nome da fase"'
      +' style="width:100%;padding:.2rem .35rem;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:.8rem"'
      +' oninput="ganttUpd('+fi+',\'nome\',this.value)"></td>'
      +'<td style="padding:.2rem .3rem;width:72px"><input type="number" value="'+Number(f.offset||0)+'" min="0" step="0.5"'
      +' style="width:64px;padding:.2rem .25rem;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:.8rem;text-align:right"'
      +' oninput="ganttUpd('+fi+',\'offset\',+this.value)"></td>'
      +'<td style="padding:.2rem .3rem;width:72px"><input type="number" value="'+Number(f.dur||1)+'" min="0.5" step="0.5"'
      +' style="width:64px;padding:.2rem .25rem;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);font-family:inherit;font-size:.8rem;text-align:right"'
      +' oninput="ganttUpd('+fi+',\'dur\',+this.value)"></td>'
      +'<td style="padding:.2rem .3rem;width:34px"><input type="color" value="'+cor+'"'
      +' style="width:26px;height:22px;padding:1px;border:1px solid var(--border);border-radius:3px;cursor:pointer"'
      +' oninput="ganttUpd('+fi+',\'cor\',this.value)"></td>'
      +'<td style="padding:.2rem .3rem;width:24px;text-align:center">'+btnIns+'</td>'
      +'<td style="padding:.2rem .3rem;width:22px"><button onclick="ganttDel('+fi+')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.9rem;padding:0">&#215;</button></td>'
      +'</tr>';
  });

  var tbl=fases.length
    ? '<table style="width:100%;border-collapse:collapse;margin-bottom:.5rem">'
      +'<thead><tr style="font-size:.7rem;color:var(--text3)">'
      +'<th style="width:26px"></th>'
      +'<th style="text-align:left;padding:.15rem .3rem">Fase</th>'
      +'<th style="text-align:right;padding:.15rem .3rem">In&iacute;cio (d&uacute;teis)</th>'
      +'<th style="text-align:right;padding:.15rem .3rem">Dura&ccedil;&atilde;o (d&uacute;teis)</th>'
      +'<th style="padding:.15rem .3rem">Cor</th><th></th><th></th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table>'
    : '';

  // Opções de dias úteis
  var optSab=g.trabSab?'checked':'';
  var optDom=g.trabDom?'checked':'';
  var ferListHTML=_ganttFerListHTML(g);

  var configUteis='<div style="border-top:1px solid var(--border);margin-top:.55rem;padding-top:.5rem">'
    +'<button onclick="ganttCalToggle()" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:.4rem;padding:0;margin-bottom:.4rem;color:var(--text2);font-size:.77rem;font-weight:700;width:100%;text-align:left">&#128197; Configura&ccedil;&otilde;es de calend&aacute;rio <span id="ganttCalChev" style="font-size:.65rem;color:var(--text3)">'+(_ganttCalOpen?'▲':'▼')+'</span></button>'
    +'<div id="ganttCalBody" style="display:'+(_ganttCalOpen?'block':'none')+'">'
    +'<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.45rem">'
    +'<label style="display:flex;align-items:center;gap:.3rem;font-size:.78rem;cursor:pointer">'
    +'<input type="checkbox" '+optSab+' onchange="ganttCfg(\'trabSab\',this.checked)"> Trabalha S&aacute;bado</label>'
    +'<label style="display:flex;align-items:center;gap:.3rem;font-size:.78rem;cursor:pointer">'
    +'<input type="checkbox" '+optDom+' onchange="ganttCfg(\'trabDom\',this.checked)"> Trabalha Domingo</label>'
    +'</div>'
    +'<div style="font-size:.75rem;color:var(--text3);margin-bottom:.3rem">Feriados adicionais (municipais, estaduais, pontos facultativos):</div>'
    +'<div id="ganttFerList">'+ferListHTML+'</div>'
    +'<button onclick="ganttFerAdd()" style="margin-top:.3rem;padding:.22rem .6rem;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--text2);cursor:pointer;font-size:.75rem">+ Feriado</button>'
    +'</div>'
    +'</div>';

  var prev=buildGanttPrev(g);

  return '<div id="ganttEditorWrap" style="margin-top:.7rem;border:1px solid var(--accent);border-radius:8px;padding:.75rem;background:var(--bg3)">'
    +'<div style="font-weight:700;font-size:.82rem;color:var(--accent);margin-bottom:.55rem">&#128197; Cronograma / Gantt</div>'
    +'<div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.55rem;flex-wrap:wrap">'
    +'<label style="font-size:.8rem;color:var(--text2);display:flex;align-items:center;gap:.3rem">Data de in&iacute;cio:'
    +'<input type="date" value="'+inicio+'"'
    +' style="padding:.22rem .4rem;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:inherit;font-size:.8rem"'
    +' onchange="ganttIni(this.value)"></label>'
    +'<button onclick="ganttAdd()" style="padding:.25rem .7rem;background:var(--accent);color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:.78rem;font-weight:700">+ Fase</button>'
    +'</div>'
    +tbl
    +configUteis
    +'<div id="ganttPrev" style="margin-top:.6rem">'+prev+'</div>'
    +'</div>';
}

var _ganttCalOpen=true;
function _ganttFerListHTML(g){
  return (g.feriados||[]).map(function(f,fi){
    return '<div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.2rem">'
      +'<input type="date" value="'+esc(f.data||'')+'" style="padding:.18rem .35rem;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.77rem" onchange="ganttFerData('+fi+',this.value)">'
      +'<input type="text" value="'+esc(f.nome||'')+'" placeholder="Nome do feriado" style="flex:1;padding:.18rem .35rem;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.77rem" oninput="ganttFerNome('+fi+',this.value)">'
      +'<button onclick="ganttFerDel('+fi+')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.85rem;padding:0 .2rem">x</button>'
      +'</div>';
  }).join('');
}
function ganttCalToggle(){
  _ganttCalOpen=!_ganttCalOpen;
  var body=Q('ganttCalBody'),chev=Q('ganttCalChev');
  if(body)body.style.display=_ganttCalOpen?'block':'none';
  if(chev)chev.textContent=_ganttCalOpen?'▲':'▼';
}
function ganttRefreshPrev(){var g=getGantt();var el=Q('ganttPrev');if(el)el.innerHTML=buildGanttPrev(g);}
function ganttReRender(){
  var el=Q('ganttEditorWrap');
  if(el){el.outerHTML=ganttEditorHTML(0);}
  else{rEsc();}
}
function ganttFerListRefresh(){
  var g=getGantt();
  var el=Q('ganttFerList');
  if(el)el.innerHTML=_ganttFerListHTML(g);
}
function ganttUpd(fi,campo,val){var g=getGantt();if(!g.fases[fi])return;g.fases[fi][campo]=val;saveGantt(g);ganttRefreshPrev();}
function ganttIni(v){var g=getGantt();g.inicio=v;saveGantt(g);ganttRefreshPrev();}
function ganttCfg(campo,val){var g=getGantt();g[campo]=val;saveGantt(g);ganttRefreshPrev();}
function ganttFerAdd(){var g=getGantt();if(!g.feriados)g.feriados=[];g.feriados.push({data:'',nome:''});saveGantt(g);ganttFerListRefresh();}
function ganttFerDel(fi){var g=getGantt();g.feriados.splice(fi,1);saveGantt(g);ganttFerListRefresh();}
function ganttFerData(fi,v){var g=getGantt();if(g.feriados[fi])g.feriados[fi].data=v;saveGantt(g);ganttRefreshPrev();}
function ganttFerNome(fi,v){var g=getGantt();if(g.feriados[fi])g.feriados[fi].nome=v;saveGantt(g);}
function ganttMover(fi,dir){
  var g=getGantt();var fases=g.fases;
  var ni=fi+dir;if(ni<0||ni>=fases.length)return;
  var tmp=fases[fi];fases[fi]=fases[ni];fases[ni]=tmp;
  g.fases=fases;saveGantt(g);ganttReRender();
}
function ganttInsAbaixo(fi){
  var g=getGantt();var fases=g.fases||[];
  var cores=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];
  var cor=cores[(fi+1)%cores.length];
  var fRef=fases[fi]||{};
  var off=(fRef.offset||0)+(fRef.dur||1);
  fases.splice(fi+1,0,{id:uid(),nome:'Nova Fase',offset:off,dur:1,cor:cor});
  g.fases=fases;saveGantt(g);ganttReRender();
}
function ganttAdd(){
  var g=getGantt();var fases=g.fases||[];
  var cores=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];
  var cor=cores[fases.length%cores.length];
  var off=0;
  if(fases.length){var last=fases[fases.length-1];off=(last.offset||0)+(last.dur||1);}
  fases.push({id:uid(),nome:'Nova Fase',offset:off,dur:5,cor:cor});
  g.fases=fases;saveGantt(g);ganttReRender();
}
function ganttDel(fi){var g=getGantt();g.fases.splice(fi,1);saveGantt(g);ganttReRender();}

function buildGanttPrev(g){
  if(!g||!g.fases||!g.fases.length)return '<div style="font-size:.78rem;color:#999;font-style:italic">Nenhuma fase cadastrada. Clique em + Fase.</div>';
  var fases=g.fases;
  var inicio=g.inicio?new Date(g.inicio+'T12:00:00'):null;
  function fmtDt(d){return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});}

  // Calcular datas reais de cada fase em dias úteis
  var faseDatas=fases.map(function(f){
    if(!inicio) return null;
    var dtIni=faseInicio(inicio,f.offset||0,g);
    var dtFim=faseFim(dtIni,f.dur||1,g);
    return {dtIni:dtIni,dtFim:dtFim};
  });

  // Total de dias corridos para escala da barra
  var dtFimMax=inicio?new Date(inicio):null;
  if(inicio){
    faseDatas.forEach(function(fd){if(fd&&fd.dtFim>dtFimMax)dtFimMax=fd.dtFim;});
  }
  var totalCorridos=inicio&&dtFimMax?Math.max(1,diasCorridosEntre(inicio,dtFimMax)+1):1;

  var rows='';
  fases.forEach(function(f,fi){
    var cor=f.cor||'#2563eb';
    var fd=faseDatas[fi];
    var dtIniStr=fd?fmtDt(fd.dtIni):'D+'+(f.offset||0);
    var dtFimStr=fd?fmtDt(fd.dtFim):'D+'+((f.offset||0)+(f.dur||1)-1);
    var durLabel=(f.dur||1)+'d';

    var offPct=0,durPct=10;
    if(inicio&&fd){
      var offCorr=diasCorridosEntre(inicio,fd.dtIni);
      var durCorr=Math.max(1,diasCorridosEntre(fd.dtIni,fd.dtFim)+1);
      offPct=(offCorr/totalCorridos*100).toFixed(1);
      durPct=(durCorr/totalCorridos*100).toFixed(1);
    } else {
      offPct=((f.offset||0)/Math.max(1,(f.offset||0)+(f.dur||1))*100).toFixed(1);
      durPct=((f.dur||1)/Math.max(1,(f.offset||0)+(f.dur||1))*100).toFixed(1);
    }

    // Faixas de fins de semana/feriados sobre a barra
    var faixasNaoUtil='';
    if(inicio&&fd){
      var d=new Date(inicio);
      for(var ci=0;ci<=totalCorridos;ci++){
        if(!isDiaUtil(d,g)){
          var fPct=(ci/totalCorridos*100).toFixed(2);
          var fW=(1/totalCorridos*100).toFixed(2);
          faixasNaoUtil+='<div style="position:absolute;left:'+fPct+'%;width:'+fW+'%;height:100%;background:rgba(0,0,0,.12);z-index:1"></div>';
        }
        d=new Date(d);d.setDate(d.getDate()+1);
      }
    }

    rows+='<div style="display:grid;grid-template-columns:130px 1fr 30px 90px;align-items:center;gap:5px;margin-bottom:4px">'
      +'<div style="font-size:7.5pt;color:#333;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(f.nome||'')+'">'+esc(f.nome||'')+'</div>'
      +'<div style="position:relative;height:15px;background:#e5e7eb;border-radius:3px;overflow:hidden">'
      +faixasNaoUtil
      +'<div style="position:absolute;left:'+offPct+'%;width:'+durPct+'%;height:100%;background:'+cor+';border-radius:3px;opacity:.88;z-index:2"></div>'
      +'</div>'
      +'<div style="font-size:6.5pt;color:#555;font-weight:700;white-space:nowrap;text-align:right">'+durLabel+'</div>'
      +'<div style="font-size:6.5pt;color:#888;white-space:nowrap;text-align:right">'+dtIniStr+' – '+dtFimStr+'</div>'
      +'</div>';
  });

  var legIni=inicio&&dtFimMax
    ?('<span style="font-size:7pt;color:#555">In&iacute;cio: '+fmtDt(inicio)+' | T&eacute;rmino: '+fmtDt(dtFimMax)+' | Total: '+totalCorridos+' dias corridos'+(g.trabSab?'':' | Sem s&aacute;b')+(g.trabDom?'':'/dom')+'</span>')
    :'<span style="font-size:7pt;color:#999;font-style:italic">Configure a data de in&iacute;cio para ver as datas</span>';

  return '<div style="font-family:Calibri,Arial,sans-serif;padding:2px 0">'
    +'<div style="margin-bottom:5px">'+legIni+'</div>'
    +rows
    +'</div>';
}

// ══ BLOCO 5 ══
// ══════════════════════════════════════════════════════
// ANÁLISE POR CATEGORIA
// ══════════════════════════════════════════════════════
var _catSort='ll';
var _catTipo='todos'; // 'todos','S','M'

function togCatAnalise(){
  var b=Q('catAnaliseBody'),ch=Q('catAnaliseChevron');
  if(!b)return;
  var open=b.style.display==='block';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲ recolher';
  if(!open)rCatAnalise();
}

function catSetSort(s){
  _catSort=s;
  ['LL','Apr','Nao','Marg','Tk'].forEach(function(k){
    var btn=Q('catSort'+k);
    if(!btn)return;
    var active=(s===k.toLowerCase());
    btn.style.background=active?'var(--accent)':'var(--bg3)';
    btn.style.color=active?'#000':'var(--text2)';
    btn.style.fontWeight=active?'700':'400';
  });
  rCatAnalise();
}

function catSetTipo(t){
  _catTipo=t;
  ['todos','S','M'].forEach(function(k){
    var btn=Q('catTipo'+k);
    if(!btn)return;
    var active=(t===k);
    btn.style.background=active?'var(--blue)':'var(--bg3)';
    btn.style.color=active?'#fff':'var(--text2)';
    btn.style.fontWeight=active?'700':'400';
  });
  rCatAnalise();
}

// ── CÁLCULO LL DE UMA PROPOSTA ──────────────────────────────────
function calcLLProp(p){
  var bi=p.bi||[];
  var a=p.aliq||{};
  var nfS =a.nfS !=null?a.nfS :DEFP.aliq.nfS;
  var nfM =a.nfM !=null?a.nfM :DEFP.aliq.nfM;
  var rS  =a.rS  !=null?a.rS  :DEFP.aliq.rS;
  var comS=a.comS!=null?a.comS:DEFP.aliq.comS;
  var comM=a.comM!=null?a.comM:DEFP.aliq.comM;
  var pvS=0,pvM=0,custoTerc=0;
  bi.forEach(function(it){
    if(it.inc===false)return;
    var pv=n2(it.pvt);
    if(it.t==='material')pvM+=pv; else pvS+=pv;
    if(it.terc)custoTerc+=n2(it.cu)*n2(it.mult);
  });
  var desc=(p.prc&&p.prc.dS?n2(p.prc.dS):0)+(p.prc&&p.prc.dM?n2(p.prc.dM):0);
  var pvTot=pvS+pvM-desc;
  if(pvTot<=0)return 0;
  var deduc=pvS*nfS+pvM*nfM+pvS*rS+pvS*comS+pvM*comM+desc; // RS somente sobre pvS (E1)
  return pvTot-custoTerc-deduc;
}

// ── AGRUPAMENTO POR CATEGORIA ───────────────────────────────────
function calcCatData(){
  var cats={};
  var FAS_APR=FAS_FECHADO;

  props.forEach(function(p){
    if(p.fas==='em_elaboracao')return;
    var isApr=FAS_APR.indexOf(p.fas)>=0;
    var isNao=!isApr;
    var llTotal=isApr?calcLLProp(p):0;
    var bi=p.bi||[];
    var pvBiTot=bi.reduce(function(s,it){return it.inc!==false?s+n2(it.pvt):s;},0);
    var pvBiS=bi.reduce(function(s,it){return it.inc!==false&&it.t!=='material'?s+n2(it.pvt):s;},0);
    var pvBiM=bi.reduce(function(s,it){return it.inc!==false&&it.t==='material'?s+n2(it.pvt):s;},0);
    var llS_prop=pvBiTot>0?llTotal*(pvBiS/pvBiTot):0;
    var llM_prop=pvBiTot>0?llTotal*(pvBiM/pvBiTot):0;

    bi.forEach(function(it){
      if(it.inc===false)return;
      // Normalizar cat: extrair só o código (ex: 'MB-01') descartando ' | Nome completo'
      var _rawCat=(it.cat||'SEM_CAT').trim();
      var cat=(_rawCat.indexOf(' ')>=0?_rawCat.split(' ')[0]:_rawCat).toUpperCase();
      if(!cat||cat.length<2)cat='SEM_CAT';
      var catNome=(function(){
        try{
          if(it.t==='material'&&DEFP.m&&DEFP.m[cat])return cat+' — '+DEFP.m[cat].n;
          if(DEFP.s&&DEFP.s[cat])return cat+' — '+DEFP.s[cat].n;
          if(DEFP.m&&DEFP.m[cat])return cat+' — '+DEFP.m[cat].n;
        }catch(e){}
        return cat;
      })();
      var pvt=n2(it.pvt);
      var ct=n2(it.cu)*n2(it.mult);
      var tipo=it.t==='material'?'M':'S';
      var frac=pvBiTot>0?pvt/pvBiTot:0;
      var llItem=tipo==='S'?(pvBiS>0?llS_prop*(pvt/pvBiS):0):(pvBiM>0?llM_prop*(pvt/pvBiM):0);
      var marg=(pvt>0&&ct>0)?(pvt-ct)/pvt*100:null;

      if(!cats[cat])cats[cat]={
        nome:catNome,
        ll:0, llS:0, llM:0,
        pvApr:{S:0,M:0}, nApr:{S:0,M:0},
        pvNao:{S:0,M:0}, nNao:{S:0,M:0},
        margNum:{S:0,M:0}, margDen:{S:0,M:0},
        pvAll:{S:[],M:[]}
      };
      var c=cats[cat];
      if(isApr){
        c.ll+=llItem;
        if(tipo==='S')c.llS+=llItem; else c.llM+=llItem;
        c.pvApr[tipo]+=pvt;
        c.nApr[tipo]+=1;
        if(marg!==null){c.margNum[tipo]+=marg*pvt; c.margDen[tipo]+=pvt;}
        c.pvAll[tipo].push(pvt);
      }
      if(isNao){
        c.pvNao[tipo]+=pvt;
        c.nNao[tipo]+=1;
      }
    });
  });

  return Object.keys(cats).map(function(k){
    var d=cats[k];
    function margCalc(t){return d.margDen[t]>0?d.margNum[t]/d.margDen[t]:null;}
    function tkCalc(t){var arr=d.pvAll[t];return arr.length>0?arr.reduce(function(s,v){return s+v;},0)/arr.length:0;}
    function soma(obj){return obj.S+obj.M;}
    return {
      cat:k, nome:d.nome,
      // Lucro Líquido
      ll:d.ll, llS:d.llS||0, llM:d.llM||0,
      // Aprovações
      pvAprS:d.pvApr.S, nAprS:d.nApr.S,
      pvAprM:d.pvApr.M, nAprM:d.nApr.M,
      pvAprTot:soma(d.pvApr), nAprTot:soma(d.nApr),
      // Não Convertido
      pvNaoS:d.pvNao.S, nNaoS:d.nNao.S,
      pvNaoM:d.pvNao.M, nNaoM:d.nNao.M,
      pvNaoTot:soma(d.pvNao), nNaoTot:soma(d.nNao),
      // Margens
      margS:margCalc('S'), margM:margCalc('M'),
      margGeral:(d.margDen.S+d.margDen.M)>0?(d.margNum.S+d.margNum.M)/(d.margDen.S+d.margDen.M):null,
      // Ticket
      tkS:tkCalc('S'), tkM:tkCalc('M'),
      tkGeral:(d.pvAll.S.concat(d.pvAll.M)).length>0?(d.pvAll.S.concat(d.pvAll.M)).reduce(function(s,v){return s+v;},0)/(d.pvAll.S.length+d.pvAll.M.length):0
    };
  }).filter(function(d){return d.nAprTot>0||d.nNaoTot>0;});
}

// ── RENDER ──────────────────────────────────────────────────────
function rCatAnalise(){
  var el=Q('catAnaliseGrid');if(!el)return;
  var arr=calcCatData();
  if(!arr.length){
    el.innerHTML='<p class="hint">Nenhuma proposta com itens de orçamento cadastrados.</p>';
    Q('catAnaliseInsights').innerHTML='';return;
  }

  var t=_catTipo; // 'todos','S','M'

  // Valores para o sort conforme tipo selecionado
  function getVal(d){
    if(_catSort==='ll')   return t==='S'?d.llS:t==='M'?d.llM:d.ll;
    if(_catSort==='apr')  return t==='S'?d.pvAprS:t==='M'?d.pvAprM:d.pvAprTot;
    if(_catSort==='nao')  return t==='S'?d.pvNaoS:t==='M'?d.pvNaoM:d.pvNaoTot;
    if(_catSort==='marg') return (t==='S'?d.margS:t==='M'?d.margM:d.margGeral)||0;
    if(_catSort==='tk')   return t==='S'?d.tkS:t==='M'?d.tkM:d.tkGeral;
    return 0;
  }

  // Filtrar categorias sem dados para o tipo/métrica selecionados
  var arrFiltrado=arr.filter(function(d){
    if(t==='S'){
      if(_catSort==='ll')   return (d.llS||0)>0;
      if(_catSort==='apr')  return d.nAprS>0;
      if(_catSort==='nao')  return d.nNaoS>0;
      if(_catSort==='marg') return d.margS!=null&&d.nAprS>0;
      if(_catSort==='tk')   return d.tkS>0;
    } else if(t==='M'){
      if(_catSort==='ll')   return (d.llM||0)>0;
      if(_catSort==='apr')  return d.nAprM>0;
      if(_catSort==='nao')  return d.nNaoM>0;
      if(_catSort==='marg') return d.margM!=null&&d.nAprM>0;
      if(_catSort==='tk')   return d.tkM>0;
    }
    // Todos: mostrar apenas quem tem algum dado na métrica
    if(_catSort==='ll')   return d.ll!==0;
    if(_catSort==='apr')  return d.nAprTot>0;
    if(_catSort==='nao')  return d.nNaoTot>0;
    if(_catSort==='marg') return d.margGeral!=null&&d.nAprTot>0;
    if(_catSort==='tk')   return d.tkGeral>0;
    return true;
  });
  var sorted=arrFiltrado.slice().sort(function(a,b){return getVal(b)-getVal(a);});
  var maxVal=Math.max.apply(null,sorted.map(function(d){return Math.abs(getVal(d));}));
  if(maxVal<=0)maxVal=1;
  var llTotalGeral=arr.reduce(function(s,d){return s+d.ll;},0);

  var corMap={ll:'#3fb950',apr:'#2563eb',nao:'#f97316',marg:'#7c3aed',tk:'#0891b2'};
  var cor=corMap[_catSort];

  function getLabel(d){
    if(_catSort==='ll'){
      var llVal=t==='S'?d.llS:t==='M'?d.llM:d.ll;
      var llBase=t==='S'?arr.reduce(function(s,x){return s+(x.llS||0);},0):t==='M'?arr.reduce(function(s,x){return s+(x.llM||0);},0):llTotalGeral;
      var pct=llBase>0?((llVal/llBase)*100).toFixed(0)+'%':'—';
      return {val:money(llVal),sub:pct+' do total'+(t!=='todos'?' ('+( t==='S'?'Svc':'Mat')+')':'')};
    }
    if(_catSort==='apr'){
      var n=t==='S'?d.nAprS:t==='M'?d.nAprM:d.nAprTot;
      var pv=t==='S'?d.pvAprS:t==='M'?d.pvAprM:d.pvAprTot;
      return {val:n+' itens',sub:money(pv)+' aprovado'};
    }
    if(_catSort==='nao'){
      var n=t==='S'?d.nNaoS:t==='M'?d.nNaoM:d.nNaoTot;
      var pv=t==='S'?d.pvNaoS:t==='M'?d.pvNaoM:d.pvNaoTot;
      return {val:n+' itens',sub:money(pv)+' cotado'};
    }
    if(_catSort==='marg'){
      var m=t==='S'?d.margS:t==='M'?d.margM:d.margGeral;
      return {val:m!=null?m.toFixed(1)+'%':'—',sub:d.nAprTot+' itens apr.'};
    }
    if(_catSort==='tk'){
      var tk=t==='S'?d.tkS:t==='M'?d.tkM:d.tkGeral;
      return {val:money(tk),sub:'ticket médio'};
    }
    return {val:'—',sub:''};
  }

  // Linha extra com detalhamento S/M
  function getDetail(d){
    if(_catSort==='ll')
      return '<span style="color:var(--blue);font-size:.68rem">Svc: '+money(d.llS||0)+'</span>'
            +' <span style="color:var(--purple);font-size:.68rem">Mat: '+money(d.llM||0)+'</span>';
    if(_catSort==='apr')
      return '<span style="color:var(--blue);font-size:.68rem">Svc: '+d.nAprS+' ('+money(d.pvAprS)+')</span>'
            +' <span style="color:var(--purple);font-size:.68rem">Mat: '+d.nAprM+' ('+money(d.pvAprM)+')</span>';
    if(_catSort==='nao')
      return '<span style="color:var(--blue);font-size:.68rem">Svc: '+d.nNaoS+'</span>'
            +' <span style="color:var(--purple);font-size:.68rem">Mat: '+d.nNaoM+'</span>';
    if(_catSort==='marg')
      return '<span style="color:var(--blue);font-size:.68rem">Svc: '+(d.margS!=null?d.margS.toFixed(1)+'%':'—')+'</span>'
            +' <span style="color:var(--purple);font-size:.68rem">Mat: '+(d.margM!=null?d.margM.toFixed(1)+'%':'—')+'</span>';
    if(_catSort==='tk')
      return '<span style="color:var(--blue);font-size:.68rem">Svc: '+money(d.tkS)+'</span>'
            +' <span style="color:var(--purple);font-size:.68rem">Mat: '+money(d.tkM)+'</span>';
    return '';
  }

  var rows=sorted.map(function(d,i){
    var v=getVal(d);
    var bar=maxVal>0?Math.abs(v)/maxVal*100:0;
    var lbl=getLabel(d);
    var det=t==='todos'?getDetail(d):'';
    var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':('<span style="font-size:.75rem;color:var(--text3)">'+(i+1)+'</span>');
    return '<div style="display:grid;grid-template-columns:32px 1fr 120px;align-items:center;gap:.5rem;padding:.5rem 0;border-bottom:1px solid var(--border)">'
      +'<div style="text-align:center;font-weight:700">'+medal+'</div>'
      +'<div>'
        +'<div style="font-size:.78rem;font-weight:600;color:var(--text);margin-bottom:.2rem">'+esc(d.nome)+'</div>'
        +'<div style="height:5px;background:var(--bg3);border-radius:3px;overflow:hidden;margin-bottom:.2rem">'
          +'<div style="width:'+bar.toFixed(1)+'%;height:100%;background:'+cor+';border-radius:3px"></div>'
        +'</div>'
        +(det?'<div style="margin-top:.15rem">'+det+'</div>':'')
      +'</div>'
      +'<div style="text-align:right">'
        +'<div style="font-weight:700;font-size:.82rem;color:'+cor+'">'+lbl.val+'</div>'
        +'<div style="font-size:.68rem;color:var(--text3)">'+lbl.sub+'</div>'
      +'</div>'
      +'</div>';
  }).join('');

  var titulos={ll:'💰 Lucro Líquido',apr:'✅ Aprovações',nao:'⚠️ Não Convertido',marg:'📈 Margem Média',tk:'🎟️ Ticket Médio'};
  el.innerHTML='<div style="border:1px solid var(--border);border-radius:var(--r);overflow:hidden;padding:.2rem .8rem">'
    +'<div style="display:grid;grid-template-columns:32px 1fr 120px;gap:.5rem;padding:.4rem 0;border-bottom:2px solid var(--border)">'
      +'<div></div>'
      +'<div style="font-size:.68rem;color:var(--text3);text-transform:uppercase;letter-spacing:.05em">CATEGORIA</div>'
      +'<div style="font-size:.68rem;color:var(--text3);text-align:right;text-transform:uppercase;letter-spacing:.05em">'+titulos[_catSort]+'</div>'
    +'</div>'
    +rows
    +'</div>';

  rCatInsights(arr,llTotalGeral);
}

function rCatInsights(arr,llTotal){
  var el=Q('catAnaliseInsights');if(!el)return;
  var ins=[];

  // Top LL
  var byLL=arr.slice().sort(function(a,b){return b.ll-a.ll;});
  if(byLL[0]&&byLL[0].ll>0)
    ins.push('🥇 <strong>'+esc(byLL[0].nome)+'</strong> — categoria mais lucrativa: <strong>'+money(byLL[0].ll)+'</strong>'+(llTotal>0?' ('+((byLL[0].ll/llTotal)*100).toFixed(0)+'% do LL total)':'')+'.');

  // Maior esforço não convertido
  var byNao=arr.slice().sort(function(a,b){return b.nNaoTot-a.nNaoTot;});
  if(byNao[0]&&byNao[0].nNaoTot>0){
    var tot=byNao[0].nAprTot+byNao[0].nNaoTot;
    var conv=tot>0?((byNao[0].nAprTot/tot)*100).toFixed(0):0;
    ins.push('⚠️ <strong>'+esc(byNao[0].nome)+'</strong> — maior esforço não convertido: '+byNao[0].nNaoTot+' itens ('+money(byNao[0].pvNaoTot)+' cotado). Conversão: '+conv+'%.');
  }

  // Melhor margem (Serviços)
  var byMargS=arr.filter(function(d){return d.margS!=null&&d.nAprS>=2;}).sort(function(a,b){return b.margS-a.margS;});
  if(byMargS[0])
    ins.push('📈 Melhor margem em Serviços: <strong>'+esc(byMargS[0].nome)+'</strong> com '+byMargS[0].margS.toFixed(1)+'% ('+byMargS[0].nAprS+' itens aprovados).');

  // Melhor margem (Materiais)
  var byMargM=arr.filter(function(d){return d.margM!=null&&d.nAprM>=2;}).sort(function(a,b){return b.margM-a.margM;});
  if(byMargM[0])
    ins.push('📦 Melhor margem em Materiais: <strong>'+esc(byMargM[0].nome)+'</strong> com '+byMargM[0].margM.toFixed(1)+'%.');

  // Alta margem, baixo volume
  arr.filter(function(d){return d.margGeral!=null&&d.margGeral>=50&&d.nAprTot<=2;}).forEach(function(d){
    ins.push('💡 <strong>'+esc(d.nome)+'</strong>: margem de '+d.margGeral.toFixed(0)+'% mas apenas '+d.nAprTot+' aprovação(ões). Potencial subexplorado.');
  });

  // Alto volume, baixa margem
  arr.filter(function(d){return d.nAprTot>=3&&d.margGeral!=null&&d.margGeral<25;}).forEach(function(d){
    ins.push('📉 <strong>'+esc(d.nome)+'</strong>: '+d.nAprTot+' aprovações mas margem de '+d.margGeral.toFixed(0)+'%. Revisar precificação.');
  });

  // Baixa relevância
  var baixa=arr.filter(function(d){return d.nAprTot+d.nNaoTot===1;});
  if(baixa.length)
    ins.push('ℹ️ '+baixa.length+' categoria(s) com apenas 1 item — baixa relevância estatística: '+baixa.map(function(d){return d.cat;}).join(', ')+'.');

  el.innerHTML=ins.length
    ?ins.map(function(i){return '<div style="margin-bottom:.35rem">'+i+'</div>';}).join('')
    :'<div style="color:var(--text3)">Adicione mais propostas com itens para gerar insights.</div>';
}

// MARGENS — Imprimir e Exportar Excel
function getCatRows(){
  var cfg=getPrcAtual();
  var nfS=cfg.aliq.nfS||0.14, rs=cfg.aliq.rS||0.051, comS=cfg.aliq.comS||0.05, neg=cfg.aliq.neg||0.05;
  var rows=[];
  Object.keys(cfg.s).sort().forEach(function(k){
    var c=cfg.s[k];
    var m=c.m||0;
    var aS=nfS+rs+comS+neg;
    var isMob=(k&&k.indexOf('MB-')===0); var fmf=aS<1?(isMob?(1+m)/(1-aS):((m<1)?1/((1-m)*(1-aS)):1)):1;
    var desc=(c.desc||'').split(';').map(function(x){return x.trim();}).filter(Boolean).join('\n');
    rows.push({tipo:'Serviço',cod:k,nome:c.n||'',desc:desc,mar:(m*100).toFixed(1)+'%',rMin:c.rMin!=null?(c.rMin*100).toFixed(0)+'%':'-',rMax:c.rMax!=null?(c.rMax*100).toFixed(0)+'%':'-',fmf:fmf.toFixed(4)});
  });
  Object.keys(cfg.m).sort().forEach(function(k){
    var c=cfg.m[k];
    var mk=c.mk||0;
    var aM=n2(cfg.aliq.nfM)+n2(cfg.aliq.rS)+n2(cfg.aliq.comM)+n2(cfg.aliq.neg);
    var fmf=aM<1?(1+mk)/(1-aM):1;
    var desc=(c.desc||'').split(';').map(function(x){return x.trim();}).filter(Boolean).join('\n');
    rows.push({tipo:'Material',cod:k,nome:c.n||'',desc:desc,mar:(mk*100).toFixed(1)+'%',rMin:c.rMin!=null?(c.rMin*100).toFixed(0)+'%':'-',rMax:c.rMax!=null?(c.rMax*100).toFixed(0)+'%':'-',fmf:fmf.toFixed(4)});
  });
  return rows;
}

function imprimirCategorias(){
  var rows=getCatRows();
  var estilos='body{font-family:Calibri,Arial,sans-serif;font-size:9pt;color:#111;margin:10mm 8mm}'
    +'h2{font-size:12pt;color:#154a15;border-bottom:2px solid #154a15;padding-bottom:4px;margin-bottom:8px}'
    +'table{width:100%;border-collapse:collapse}'
    +'th{background:#154a15;color:#fff;font-size:7.5pt;padding:4px 5px;text-align:left}'
    +'td{border-bottom:1px solid #ddd;padding:4px 5px;vertical-align:top;font-size:8pt}'
    +'td.cod{font-family:monospace;font-weight:700;color:#154a15;white-space:nowrap}'
    +'td.num{text-align:right;font-family:monospace;white-space:nowrap}'
    +'td.desc{font-size:7pt;color:#444;white-space:pre-line;line-height:1.4}'
    +'tr:nth-child(even){background:#f7faf7}'
    +'@page{size:A4 landscape;margin:10mm}';
  var thead='<thead><tr>'
    +'<th>Tipo</th><th>Código</th><th>Nome</th><th>Descrição</th>'
    +'<th>Margem %</th><th>Range</th><th>FMF</th>'
    +'</tr></thead>';
  var tbody='<tbody>';
  rows.forEach(function(r){
    var corTipo=r.tipo==='Serviço'?'#2563eb':'#7c3aed';
    tbody+='<tr>'
      +'<td style="color:'+corTipo+';font-weight:700;white-space:nowrap">'+r.tipo+'</td>'
      +'<td class="cod">'+r.cod+'</td>'
      +'<td style="font-weight:600">'+r.nome+'</td>'
      +'<td class="desc">'+r.desc.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</td>'
      +'<td class="num">'+r.mar+'</td>'
      +'<td class="num">'+r.rMin+' – '+r.rMax+'</td>'
      +'<td class="num">'+r.fmf+'</td>'
      +'</tr>';
  });
  tbody+='</tbody>';
  var html='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Tecfusion Categorias</title>'
    +'<style>'+estilos+'</style></head><body>'
    +'<h2>Tecfusion — Categorias de Orçamento</h2>'
    +'<table>'+thead+tbody+'</table>'
    +'</body></html>';
  var w=window.open('','_blank');
  if(w){w.document.write(html);w.document.close();w.focus();setTimeout(function(){w.print();},400);}
}

function exportarCategoriasXLSX(){
  var rows=getCatRows();
  var cab=['"Tipo"','"Código"','"Nome"','"Descrição"','"Margem %"','"Range Mín"','"Range Máx"','"FMF"'];
  var linhas=[cab.join(';')];
  rows.forEach(function(r){
    linhas.push([
      '"'+r.tipo+'"',
      '"'+r.cod+'"',
      '"'+r.nome+'"',
      '"'+r.desc.replace(/"/g,'""')+'"',
      '"'+r.mar+'"',
      '"'+r.rMin+'"',
      '"'+r.rMax+'"',
      '"'+r.fmf+'"'
    ].join(';'));
  });
  var csv='\uFEFF'+linhas.join('\r\n');
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='Tecfusion_Categorias_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},500);
  toast('Categorias exportadas!','ok');
}
function forcarMergeCats(){
  var _cfg=LS('tf_prc');
  if(!_cfg) _cfg=JSON.parse(JSON.stringify(DEFP));
  if(!_cfg.s) _cfg.s={};
  if(!_cfg.m) _cfg.m={};
  var _excl=LS('tf_cats_excluidas')||{s:{},m:{}};
  var added=[];
  Object.keys(DEFP.s).forEach(function(k){
    if(!_cfg.s[k]&&!_excl.s[k]){ _cfg.s[k]=JSON.parse(JSON.stringify(DEFP.s[k])); added.push(k); }
  });
  Object.keys(DEFP.m).forEach(function(k){
    if(!_cfg.m[k]&&!_excl.m[k]){ _cfg.m[k]=JSON.parse(JSON.stringify(DEFP.m[k])); added.push(k); }
  });
  LS('tf_prc',_cfg);
  if(editId){
    var _pi=props.findIndex(function(x){return x.id===editId;});
    if(_pi>=0&&props[_pi].prc){
      var _pp=props[_pi].prc;
      if(!_pp.s)_pp.s={};
      if(!_pp.m)_pp.m={};
      Object.keys(DEFP.s).forEach(function(k){if(!_pp.s[k]&&!_excl.s[k])_pp.s[k]=JSON.parse(JSON.stringify(DEFP.s[k]));});
      Object.keys(DEFP.m).forEach(function(k){if(!_pp.m[k]&&!_excl.m[k])_pp.m[k]=JSON.parse(JSON.stringify(DEFP.m[k]));});
      saveAll();
    }
  }
  if(added.length){toast('✅ '+added.length+' adicionada(s): '+added.join(', '),'ok');}
  else{toast('Nenhuma categoria nova para adicionar.','ok');}
  rMargens();
}

// ══════ MODAL ITEM ══════
var _itemModalId = null; // null = novo, string = editando

function _atualizarHistTrab(){
  var tiposSet={}, fasesSet={}, equipSet={}, instSet={}, descSet={};
  function _coletarItem(it){
    if(it.tipoTrab && it.tipoTrab.trim()) tiposSet[it.tipoTrab.trim()]=1;
    if(it.faseTrab && it.faseTrab.trim()) fasesSet[it.faseTrab.trim()]=1;
    if(it.equip    && it.equip.trim())    equipSet[it.equip.trim()]=1;
    if(it.inst     && it.inst.trim())     instSet[it.inst.trim()]=1;
    if(it.desc     && it.desc.trim())     descSet[it.desc.trim()]=1;
  }
  (budg||[]).forEach(_coletarItem);
  (props||[]).forEach(function(p){ (p.bi||[]).forEach(_coletarItem); });

  var mapaDl={
    'hist-tipoTrab': Object.keys(tiposSet),
    'hist-faseTrab': Object.keys(fasesSet),
    'hist-desc':     Object.keys(descSet),
    'equip-list':    Object.keys(equipSet),
    'inst-list':     Object.keys(instSet)
  };
  Object.keys(mapaDl).forEach(function(dlId){
    var dl=document.getElementById(dlId); if(!dl) return;
    dl.innerHTML=mapaDl[dlId].sort().map(function(v){
      return '<option value="'+v.replace(/"/g,'&quot;')+'">';
    }).join('');
  });
}
function abrirItemModal(it){
  _atualizarHistTrab();
  _itemModalId = it ? it.id : null;
  _cuLog = it ? (it.cuLog||[]) : [];
  var m = Q('itemModal');
  Q('itemModalTit').textContent = it ? '✏️ Editar Item' : '➕ Novo Item';
  Q('btnSalvarItemModal').textContent = it ? '💾 Atualizar' : '➕ Adicionar';

  // Preencher tipo e categoria
  var tipo = it ? it.t : 'servico';
  var catVal = it ? (it.cat || '') : '';
  Q('mTipo').value = tipo;
  mPopularCats(tipo); // popula o select primeiro
  // Setar categoria DEPOIS de popular o select
  if(catVal) Q('mCat').value = catVal;

  if(it){
    Q('mEquip').value = it.equip || '';
    Q('mInst').value  = it.inst  || '';
    Q('mDesc').value  = it.desc  || '';
    Q('mCU').value    = it.cuFormula || it.cu || 0;
    if(Q('mTipoTrab')) Q('mTipoTrab').value = it.tipoTrab || '';
    if(Q('mFaseTrab')) Q('mFaseTrab').value = it.faseTrab || '';
    if(tipo !== 'material'){
      Q('mTec').value    = it.tec  || 1;
      Q('mDias').value   = it.dias || 1;
      Q('mDiasUn').value = it.un1  || 'Dias';
      Q('mHpd').value    = it.hpd  || 1;
      Q('mHpdUn').value  = it.un2  || 'Dias';
    } else {
      Q('mQtd').value   = it.mult || 1;
      Q('mQtdUn').value = it.un1  || 'Unidade';
      Q('mLink').value  = it.link || '';
    }
  } else {
    Q('mCU').value=''; Q('mTec').value=1; Q('mDias').value=1; Q('mHpd').value=1; Q('mQtd').value=1;
    Q('mEquip').value=''; Q('mInst').value=''; Q('mDesc').value=''; Q('mLink').value='';
    if(Q('mTipoTrab')) Q('mTipoTrab').value='';
    if(Q('mFaseTrab')) Q('mFaseTrab').value='';
  }
  Q('mCSvc').style.display=tipo!=='material'?'':'none';
  Q('mCMat').style.display=tipo==='material'?'block':'none';
  mCalcPV();
  m.style.display='flex';
  mAtualizarMargemPanel(); // agora cat já está setado
  if(typeof cuLogBadge==='function') cuLogBadge();
  setTimeout(function(){ Q('mCU').focus(); }, 100);
}

function fecharItemModal(){
  Q('itemModal').style.display='none';
  _itemModalId=null;
}

function mPopularCats(tipo){
  var cfg=getPrcAtual();
  var cats=tipo==='material'?cfg.m:cfg.s;
  var sel=Q('mCat');
  sel.innerHTML='<option value="">-- Categoria --</option>';
  Object.keys(cats).sort().forEach(function(k){
    var o=document.createElement('option');
    o.value=k; o.textContent=k+' — '+(cats[k].n||k);
    sel.appendChild(o);
  });
}

function mOnTipo(){
  var t=Q('mTipo').value;
  mPopularCats(t);
  Q('mCSvc').style.display=t!=='material'?'':'none';
  Q('mCMat').style.display=t==='material'?'block':'none';
  mCalcPV();
  // Cat foi resetada — esconder painel de margem até usuário escolher
  if(Q('mMargemPanel')) Q('mMargemPanel').style.display='none';
}

function mOnCat(){ mCalcPV(); mAtualizarMargemPanel(); }

function mCalcPV(){
  var cfg=getPrcAtual();
  var tipo=Q('mTipo').value;
  var cat=Q('mCat').value;
  var cu=typeof mEvalCU==='function'?mEvalCU():n2((Q('mCU').value||'').replace(',','.'));
  if(!cat||cu<=0){ Q('mPVPreview').style.display='none'; return; }
  var fmf=calcFMF(cfg,tipo,cat);
  var mult=tipo==='material'?n2(Q('mQtd').value):n2(Q('mTec').value)*n2(Q('mDias').value)*n2(Q('mHpd').value);
  var pvu=cu*fmf;
  var pvt=pvu*mult;
  Q('mFMFval').textContent=fmf.toFixed(4);
  Q('mPVUval').textContent=money(pvu);
  Q('mPVTval').textContent=money(pvt);
  Q('mPVPreview').style.display='block';
  if(Q('mMargemPVT')) Q('mMargemPVT').textContent=money(pvt);
  if(Q('mMargemPVU')) Q('mMargemPVU').textContent=money(pvu);
  mCalcItemLL(pvt, cu*mult, tipo);
}

function salvarItemModal(){
  var cfg=getPrcAtual();
  var tipo=Q('mTipo').value;
  var cat=Q('mCat').value;
  var cu=typeof mEvalCU==='function'?mEvalCU():n2((Q('mCU').value||'').replace(',','.'));
  var cuFormula=(Q('mCU').value||'').trim();
  if(!cat){toast('Selecione a categoria.','err'); return;}
  if(cu<=0){toast('Informe o custo > 0.','err'); return;}

  var fmf=calcFMF(cfg,tipo,cat);
  var mult,un1,un2,tec,dias,hpd,link;
  if(tipo==='material'){
    mult=n2(Q('mQtd').value)||1;
    un1=Q('mQtdUn').value; un2=''; tec=1; dias=mult; hpd=1;
    link=Q('mLink').value||'';
  } else {
    tec=Math.max(1,n2(Q('mTec').value)||1);
    dias=n2(Q('mDias').value)||1;
    hpd=n2(Q('mHpd').value)||1;
    mult=tec*dias*hpd;
    un1=Q('mDiasUn').value; un2=Q('mHpdUn').value; link='';
  }
  var descDigitada=(Q('mDesc').value||'').trim();
  var pvu=cu*fmf; var pvt=pvu*mult;

  var baseItem=normalizeBudgetItem({
    id:_itemModalId||uid(), t:tipo, cat:cat,
    desc:descDigitada||getCatLabel(tipo,cat),
    cu:cu, cuFormula:cuFormula, cuLog:_cuLog, mult:mult, fmf:fmf, pvu:pvu, pvt:pvt,
    un1:un1, un2:un2, tec:tec, dias:dias, hpd:hpd,
    inc:true, terc:false, det:true, link:link,
    equip:(Q('mEquip').value||'').trim(),
    inst:(Q('mInst').value||'').trim(),
    tipoTrab:(Q('mTipoTrab')&&Q('mTipoTrab').value)||'',
    faseTrab:(Q('mFaseTrab')&&Q('mFaseTrab').value)||''
  });

  if(_itemModalId){
    var idx=budg.findIndex(function(x){return x.id===_itemModalId;});
    if(idx>=0){
      // Preservar inc/terc/det do item original
      baseItem.inc  = budg[idx].inc  !== false;
      baseItem.terc = budg[idx].terc === true;
      baseItem.det  = budg[idx].det  !== false;
      budg[idx]=baseItem;
    }
    toast('Item atualizado!','ok');
  } else {
    budg.push(baseItem);
    toast('Item adicionado!','ok');
  }

  fecharItemModal();
  updBT(); rBudg(); cTot(); updKpi();
  try{ if(editId) upsertCurrentDraft(true); }catch(e){}
}


function mAtualizarMargemPanel(){
  var tipo=Q('mTipo').value;
  var cat=Q('mCat').value;
  var panel=Q('mMargemPanel');
  if(!cat){ if(panel) panel.style.display='none'; return; }
  var cfg=getPrcAtual();
  var catObj=tipo==='material'?cfg.m[cat]:cfg.s[cat];
  if(!catObj){ if(panel) panel.style.display='none'; return; }

  var marVal=tipo==='material'?((catObj.mk||0)*100):((catObj.m||0)*100);
  var rMin=catObj.rMin!=null?(catObj.rMin*100).toFixed(0):'—';
  var rMax=catObj.rMax!=null?(catObj.rMax*100).toFixed(0):'—';
  var cor=marVal>=50?'#3fb950':marVal>=25?'#d4a017':'#f85149';
  var rangeCor=(marVal/100)<(catObj.rMin||0)?'#f85149':(marVal/100)>(catObj.rMax||1)?'#58a6ff':'#3fb950';

  if(Q('mMargemCatCod'))  Q('mMargemCatCod').textContent=cat;
  if(Q('mMargemCatNome')) Q('mMargemCatNome').textContent=catObj.n||'';
  if(Q('mMargemCatDesc')) Q('mMargemCatDesc').textContent='';
  Q('mMargemInput').value=marVal.toFixed(1);
  if(Q('mMargemPct')){Q('mMargemPct').textContent=marVal.toFixed(1)+'%';Q('mMargemPct').style.color=cor;}
  if(Q('mMargemRange')){Q('mMargemRange').textContent='Range: '+rMin+'% – '+rMax+'%';Q('mMargemRange').style.color=rangeCor;}

  var hasPropPrc=editId&&(function(){var _pp=props.find(function(x){return x.id===editId;});return _pp&&_pp.prc;}());
  Q('mMargemScope').textContent=hasPropPrc?'📋 desta proposta':'🌐 padrão global';

  mOnMargemChange(marVal.toFixed(1));
  panel.style.display='block';
}

function mOnMargemChange(val){
  var cfg=getPrcAtual();
  var tipo=Q('mTipo').value;
  var cat=Q('mCat').value;
  if(!cat) return;
  var m=parseFloat(val)/100;
  var nfS=cfg.aliq.nfS||0.14, rs=cfg.aliq.rS||0.051, comS=cfg.aliq.comS||0.05, neg=cfg.aliq.neg||0.05;
  var fmf;
  var fmlStr='';
  if(tipo==='material'){
    var nfM=cfg.aliq.nfM||0.14, comM=cfg.aliq.comM||0.025;
    var aM=nfM+rs+comM+neg;
    fmf=aM<1?(1+m)/(1-aM):1;
    fmlStr='(1+'+m.toFixed(2)+')÷(1-'+aM.toFixed(3)+')';
  } else if(cat && cat.indexOf('MB-')===0){
    // Mobilização: mesma fórmula que material — (1+Margem)/(1-deduções)
    var aS=nfS+rs+comS+neg;
    fmf=(aS<1)?(1+m)/(1-aS):1;
    fmlStr='(1+'+m.toFixed(2)+')÷(1-'+aS.toFixed(3)+')';
  } else {
    var aS=nfS+rs+comS+neg;
    fmf=(m<1&&aS<1)?1/((1-m)*(1-aS)):1;
    fmlStr='1÷[(1-'+m.toFixed(2)+')×(1-'+aS.toFixed(3)+')]';
  }
  var cor=m*100>=50?'#3fb950':m*100>=25?'#d4a017':'#f85149';
  if(Q('mMargemFMF')) Q('mMargemFMF').textContent=fmf.toFixed(4);
  if(Q('mMargemFMFfml')) Q('mMargemFMFfml').textContent=fmlStr;
  if(Q('mMargemPct')){Q('mMargemPct').textContent=(m*100).toFixed(1)+'%';Q('mMargemPct').style.color=cor;}
  mCalcPVcomFMF(fmf);
}

function mCalcPVcomFMF(fmf){
  var tipo=Q('mTipo').value;
  var cu=typeof mEvalCU==='function'?mEvalCU():n2((Q('mCU').value||'').replace(',','.'));
  if(cu<=0){ Q('mPVPreview').style.display='none'; return; }
  var mult=tipo==='material'?n2(Q('mQtd').value):n2(Q('mTec').value)*n2(Q('mDias').value)*n2(Q('mHpd').value);
  var pvu=cu*fmf; var pvt=pvu*mult;
  Q('mFMFval').textContent=fmf.toFixed(4);
  Q('mPVUval').textContent=money(pvu);
  Q('mPVTval').textContent=money(pvt);
  Q('mPVPreview').style.display='block';
  if(Q('mMargemPVT')) Q('mMargemPVT').textContent=money(pvt);
  if(Q('mMargemPVU')) Q('mMargemPVU').textContent=money(pvu);
  mCalcItemLL(pvt, cu*mult, tipo);
}

function mCalcItemLL(pvt, custoTotal, tipo){
  var cfg=getPrcAtual();
  var a=cfg.aliq||{};
  var nfS =a.nfS !=null?a.nfS :DEFP.aliq.nfS;
  var nfM =a.nfM !=null?a.nfM :DEFP.aliq.nfM;
  var rs  =a.rS  !=null?a.rS  :DEFP.aliq.rS;
  var comS=a.comS!=null?a.comS:DEFP.aliq.comS;
  var comM=a.comM!=null?a.comM:DEFP.aliq.comM;
  if(pvt<=0){
    if(Q('mItemLL')){Q('mItemLL').textContent='--';Q('mItemLLpct').textContent='--';}
    return;
  }
  var isTerceirizado=false;
  if(_itemModalId){
    var _it=budg.find(function(x){return x.id===_itemModalId;});
    if(_it) isTerceirizado=(_it.terc===true);
  }
  var custoAbate=isTerceirizado?custoTotal:0;
  var nf  = tipo==='material'?pvt*nfM:pvt*nfS;
  var rsV = tipo==='material'?0:pvt*rs; // RS nao incide sobre material (E1/E5)
  var com = tipo==='material'?pvt*comM:pvt*comS;
  var ll  = pvt - custoAbate - nf - rsV - com;
  var llPct = ll/pvt*100;
  var cor = ll>=0?(llPct>=20?'#3fb950':llPct>=10?'#d4a017':'#f97316'):'#f85149';
  if(Q('mItemLL')){Q('mItemLL').style.color=cor; Q('mItemLL').textContent=money(ll);}
  if(Q('mItemLLpct')){
    var lbl=isTerceirizado?' (c/ custo terceiro)':' da receita';
    Q('mItemLLpct').textContent=llPct.toFixed(1)+'%'+lbl;
  }
}

function mSalvarMargem(){
  var cfg=getPrcAtual();
  var tipo=Q('mTipo').value;
  var cat=Q('mCat').value;
  var mar=parseFloat(Q('mMargemInput').value)||0;
  if(!cat||mar<=0) return;
  var catObj=tipo==='material'?cfg.m[cat]:cfg.s[cat];
  if(!catObj) return;
  if(tipo==='material') catObj.mk=mar/100; else catObj.m=mar/100;
  savePrcAtual(cfg);
  // Se salvar como padrão
  if(Q('mMargemPadrao')&&Q('mMargemPadrao').checked){
    salvarComoDefp(cat,tipo,catObj);
  }
  mCalcPV(); // recalcular com nova margem salva
  toast('Margem de '+cat+' atualizada para '+mar+'%!','ok');
}


// ══════════════════════════════════════════════════════════════
// FECHAMENTOS POR MÊS
// ══════════════════════════════════════════════════════════════
function togFechMes(){
  var b=Q('fechMesBody'),ch=Q('fechMesChevron');
  if(!b)return;
  var open=b.style.display==='block';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲ recolher';
  if(!open){ _populaFechMesAnos(); rFechMes(); }
}

function _parseDateProp(p){
  // Retorna Date ou null. Prioridade: dtFech > dat2 > dat
  var s=p.dtFech||p.dat2||'';
  if(s){
    var d=new Date(s+'T12:00:00');
    if(!isNaN(d.getTime())) return d;
  }
  if(p.dat){
    var ps=String(p.dat).split('/');
    if(ps.length===3){
      var d2=new Date(ps[2]+'-'+ps[1]+'-'+ps[0]+'T12:00:00');
      if(!isNaN(d2.getTime())) return d2;
    }
  }
  return null;
}

function _populaFechMesAnos(){
  var sel=Q('fechMesAno'); if(!sel)return;
  var anos={};
  props.forEach(function(p){
    if(FAS_FECHADO.indexOf(p.fas)<0) return;
    var d=_parseDateProp(p);
    if(d) anos[d.getFullYear()]=1;
  });
  var anoAtual=new Date().getFullYear();
  anos[anoAtual]=1;
  var lista=Object.keys(anos).map(Number).sort(function(a,b){return b-a;});
  var valAtual=sel.value;
  sel.innerHTML=lista.map(function(a){return '<option value="'+a+'"'+(a===anoAtual?' selected':'')+'>'+ a+'</option>';}).join('');
  if(valAtual && lista.indexOf(parseInt(valAtual))>=0) sel.value=valAtual;
}

function rFechMes(){
  var kpisEl=Q('fechMesKpis'), chartEl=Q('fechMesChart');
  if(!kpisEl||!chartEl) return;

  var anoSel=parseInt((Q('fechMesAno')&&Q('fechMesAno').value)||new Date().getFullYear());
  var filtro=(Q('fmFiltro')&&Q('fmFiltro').value)||'todos';
  var valorFiltro=(Q('fmValor')&&Q('fmValor').value)||'';
  var MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  // Coletar propostas fechadas do ano
  var base=props.filter(function(p){
    if(FAS_FECHADO.indexOf(p.fas)<0) return false;
    var d=_parseDateProp(p); return d && d.getFullYear()===anoSel;
  });

  // Popular select de valores do filtro
  _fmPopularValores(base, filtro);

  // Aplicar filtro de valor
  var filtradas;
  if(!valorFiltro){
    filtradas = base;
  } else if(filtro==='categoria'||filtro==='tipo'){
    filtradas = base.filter(function(p){
      return (p.bi||[]).some(function(it){
        if(it.inc===false) return false;
        if(filtro==='categoria') return (it.cat||'').split(' ')[0].toUpperCase()===valorFiltro;
        if(filtro==='tipo')      return it.t===valorFiltro;
        return false;
      });
    });
  } else {
    filtradas = base.filter(function(p){ return _fmGetValor(p,filtro)===valorFiltro; });
  }

  // Agrupar por mês
  var dados=MESES.map(function(_,i){return {mes:i,n:0,val:0,props:[]};});
  filtradas.forEach(function(p){
    var d=_parseDateProp(p);
    var m=d.getMonth();
    var pv=_fmGetPV(p,filtro,valorFiltro);
    if(pv>0||filtro==='todos'||(!valorFiltro)){
      dados[m].n++;
      dados[m].val+=pv;
      dados[m].props.push(p);
    }
  });

  // KPIs
  var totalN  =dados.reduce(function(s,d){return s+d.n;},0);
  var totalVal=dados.reduce(function(s,d){return s+d.val;},0);
  var mesesCom=dados.filter(function(d){return d.n>0;}).length;
  var melhor  =dados.reduce(function(a,b){return b.val>a.val?b:a;},dados[0]);
  var media   =mesesCom>0?totalVal/mesesCom:0;
  var labelFiltro=valorFiltro?(' — '+valorFiltro):'';

  var ks='background:var(--bg3);border-radius:8px;padding:.5rem .8rem;min-width:130px;flex:1';
  kpisEl.innerHTML=
    '<div style="'+ks+'"><div style="font-size:.65rem;color:var(--text3);margin-bottom:.15rem">FECHAMENTOS '+anoSel+labelFiltro+'</div><div style="font-size:1.05rem;font-weight:800;color:var(--accent)">'+totalN+' propostas</div></div>'
   +'<div style="'+ks+'"><div style="font-size:.65rem;color:var(--text3);margin-bottom:.15rem">RECEITA FECHADA</div><div style="font-size:1rem;font-weight:800;color:#3fb950">'+money(totalVal)+'</div></div>'
   +(mesesCom>0?'<div style="'+ks+'"><div style="font-size:.65rem;color:var(--text3);margin-bottom:.15rem">MÉDIA/MÊS ATIVO</div><div style="font-size:.9rem;font-weight:700;color:var(--text)">'+money(media)+'</div></div>':'')
   +(melhor.n>0?'<div style="'+ks+'"><div style="font-size:.65rem;color:var(--text3);margin-bottom:.15rem">MELHOR MÊS</div><div style="font-size:.88rem;font-weight:700;color:#d4a017">'+MESES[melhor.mes]+' — '+money(melhor.val)+'</div></div>':'');

  // GRÁFICO
  var H=180, padT=28, padB=32, padL=48, padR=12, barW=46, gap=12;
  var chartW=Math.max(600, 12*(barW+gap)+padL+padR);
  var maxVal=Math.max.apply(null,dados.map(function(d){return d.val;}));
  if(maxVal<=0) maxVal=1;
  var mesAtual=new Date().getFullYear()===anoSel?new Date().getMonth():-1;

  var svg='<svg viewBox="0 0 '+chartW+' '+(H+padT+padB)+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;font-family:inherit">';

  // Grid horizontal com valores no eixo Y
  for(var gi=0;gi<=4;gi++){
    var gy=padT+(H/4)*gi;
    var gval=maxVal*(1-gi/4);
    svg+='<line x1="'+padL+'" y1="'+gy+'" x2="'+(chartW-padR)+'" y2="'+gy+'" stroke="rgba(128,128,128,.15)" stroke-width="1" stroke-dasharray="'+(gi===0?'0':'4,3')+'"/>';
    svg+='<text x="'+(padL-6)+'" y="'+(gy+4)+'" text-anchor="end" font-size="9" fill="rgba(150,150,150,.8)">'+_fmtK(gval)+'</text>';
  }

  dados.forEach(function(d,i){
    var x=padL+i*(barW+gap);
    var cx=x+barW/2;
    var barH=maxVal>0?Math.min(H-50,(d.val/maxVal)*H):0;
    var barY=padT+H-barH; // barH limitado: sempre 50px livres no topo
    var isAtual=(i===mesAtual);
    var temDados=d.n>0;
    var cor=temDados?(isAtual?'#58a6ff':'#3fb950'):'rgba(128,128,128,.12)';

    // Valor R$ ACIMA → bolinha → barra
    var _barTopo = padT + H - barH;  // topo da barra
    var _bolaY   = _barTopo - 12;     // bolinha sempre 12px acima do topo da barra
    var _valY    = _barTopo - 28;     // valor sempre 28px acima do topo (acima da bolinha)

    if(temDados){
      svg+='<text x="'+cx+'" y="'+_valY+'" text-anchor="middle" font-size="9.5" font-weight="700" fill="'+cor+'" style="cursor:pointer" onclick="fmMostrarDetalhe('+i+','+anoSel+')">'+_fmtK(d.val)+'</text>';
      svg+='<circle cx="'+cx+'" cy="'+_bolaY+'" r="10" fill="'+(isAtual?'rgba(88,166,255,.25)':'rgba(63,185,80,.2)')+'" stroke="'+(isAtual?'#58a6ff':'#3fb950')+'" stroke-width="1.5" style="cursor:pointer" onclick="fmMostrarDetalhe('+i+','+anoSel+')"/>';
      svg+='<text x="'+cx+'" y="'+(_bolaY+4)+'" text-anchor="middle" font-size="9" font-weight="700" fill="'+(isAtual?'#58a6ff':'#3fb950')+'" style="cursor:pointer" onclick="fmMostrarDetalhe('+i+','+anoSel+')">'+d.n+'</text>';
    }
    if(barH>1){
      svg+='<rect x="'+x+'" y="'+barY+'" width="'+barW+'" height="'+barH+'" rx="4" fill="'+cor+'" opacity="0.88" style="cursor:pointer" onclick="fmMostrarDetalhe('+i+','+anoSel+')" />';
    } else if(temDados){
      svg+='<rect x="'+x+'" y="'+(padT+H-3)+'" width="'+barW+'" height="3" rx="2" fill="'+cor+'" style="cursor:pointer" onclick="fmMostrarDetalhe('+i+','+anoSel+')"/>';
    } else {
      svg+='<rect x="'+x+'" y="'+(padT+H-2)+'" width="'+barW+'" height="2" rx="1" fill="rgba(128,128,128,.12)"/>';
    }
    // Label mês
    var corLabel=isAtual?'#58a6ff':(temDados?'rgba(200,200,200,.9)':'rgba(120,120,120,.5)');
    svg+='<text x="'+cx+'" y="'+(padT+H+16)+'" text-anchor="middle" font-size="10.5" font-weight="'+(isAtual?'700':'400')+'" fill="'+corLabel+'">'+MESES[i]+'</text>';

    // Destaque mês atual
    if(isAtual){
      svg+='<rect x="'+(x-2)+'" y="'+(padT-6)+'" width="'+(barW+4)+'" height="'+(H+6)+'" rx="5" fill="none" stroke="#58a6ff" stroke-width="1" opacity="0.3"/>';
    }
  });

  svg+='</svg>';
  chartEl.innerHTML=svg;

  // Limpar detalhe
  if(Q('fechMesDetalhe')) Q('fechMesDetalhe').style.display='none';
}

function _fmGetValor(p, filtro){
  if(filtro==='cliente'){var _cidade=(p.csvc||p.cid||'').trim();return (p.cli||'')+(_cidade?' ('+_cidade+')':'');}
  if(filtro==='contato1')    return p.ac||'';
  if(filtro==='contato2')    return p.ac2||'';
  if(filtro==='cidade')      return (p.cid||'').split('-')[0].trim();
  if(filtro==='estado')      return (p.cid||'').split('-').pop().trim();
  if(filtro==='cidade_svc')  return (p.csvc||p.cid||'').split('-')[0].trim();
  if(filtro==='categoria')   return ''; // especial — por item
  if(filtro==='tipo')        return ''; // especial — por item
  return '';
}

function _fmGetPV(p, filtro, valor){
  // Para tipo: usa p.val (valor total da proposta) — bi pode não estar preenchido
  if(filtro==='tipo'){
    return n2(p.val);
  }
  if(filtro==='categoria'){
    var bi=p.bi||[];
    return bi.reduce(function(s,it){
      if(it.inc===false) return s;
      if((it.cat||'').split(' ')[0].toUpperCase()!==valor) return s;
      return s+n2(it.pvt);
    },0);
  }
  return n2(p.val);
}

function _fmPopularValores(base, filtro){
  var sel=Q('fmValor'), lbl=Q('fmFiltroLabel');
  if(!sel) return;
  if(filtro==='todos'){
    sel.style.display='none';
    if(lbl) lbl.style.display='none';
    return;
  }
  sel.style.display='block';
  if(lbl) lbl.style.display='none';

  var vals={};
  base.forEach(function(p){
    if(filtro==='categoria'){
      (p.bi||[]).forEach(function(it){
        if(it.inc===false) return;
        var cat=(it.cat||'').split(' ')[0].toUpperCase();
        if(cat) vals[cat]=1;
      });
    } else if(filtro==='tipo'){
      vals['servico']=1; vals['material']=1;
    } else {
      var v=_fmGetValor(p,filtro);
      if(v) vals[v]=1;
    }
  });

  var lista=Object.keys(vals).sort();
  var cur=sel.value;
  sel.innerHTML='<option value="">— Todos —</option>'+lista.map(function(v){
    var label=v;
    if(filtro==='tipo') label=v==='servico'?'🔵 Serviço':'🟣 Material';
    return '<option value="'+v+'"'+(v===cur?' selected':'')+'>'+label+'</option>';
  }).join('');
}

function fmMostrarDetalhe(mes, ano){
  var el=Q('fechMesDetalhe'); if(!el) return;
  var MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var filtro=(Q('fmFiltro')&&Q('fmFiltro').value)||'todos';
  var valorFiltro=(Q('fmValor')&&Q('fmValor').value)||'';

  var lista=props.filter(function(p){
    if(FAS_FECHADO.indexOf(p.fas)<0) return false;
    var d=_parseDateProp(p);
    if(!d||d.getFullYear()!==ano||d.getMonth()!==mes) return false;
    if(valorFiltro && _fmGetValor(p,filtro)!==valorFiltro) return false;
    return true;
  });

  if(!lista.length){ el.style.display='none'; return; }

  var rows=lista.map(function(p){
    var cli=(p.cli||'').trim();
    var cliAbrev=cli.length>22?cli.slice(0,20)+'…':cli;
    var cid=(p.csvc||p.cid||'').trim();
    var tit=(p.tit||'').trim();
    var titAbrev=tit.length>30?tit.slice(0,28)+'…':tit;
    return '<div onclick="fmAbrirProposta(\''+p.id+'\')" '
      +'style="display:flex;justify-content:space-between;align-items:flex-start;'
      +'padding:.45rem .4rem;border-bottom:1px solid var(--border);cursor:pointer;gap:.5rem;'
      +'border-radius:4px;transition:background .12s" '
      +'onmouseover="this.style.background=\'rgba(88,166,255,.08)\'" '
      +'onmouseout="this.style.background=\'\'">'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:.78rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(cli)+(cid?' ('+esc(cid)+')':'')+'">'+esc(cliAbrev)+(cid?' <span style="color:var(--text3);font-weight:400;font-size:.7rem">('+esc(cid)+')</span>':'')+'</div>'
      +'<div style="font-size:.7rem;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.1rem" title="'+esc(tit)+'">'+(p.num?'<span style="color:var(--accent)">#'+esc(p.num)+'</span> — ':'')+esc(titAbrev)+'</div>'
      +'</div>'
      +'<div style="font-size:.8rem;font-weight:700;color:#3fb950;flex-shrink:0;text-align:right;padding-top:.05rem">'+money(n2(p.val))+'</div>'
      +'</div>';
  }).join('');

  el.style.display='block';
  el.innerHTML='<div style="background:var(--bg3);border-radius:8px;padding:.6rem .8rem;border:1px solid var(--border)">'
    +'<div style="font-size:.75rem;font-weight:700;color:var(--accent);margin-bottom:.45rem">📋 '+MESES[mes]+' — '+lista.length+' proposta(s)</div>'
    +rows+'</div>';
}


function _fmtK(v){
  if(v>=1000000) return 'R$'+(v/1000000).toFixed(1)+'M';
  if(v>=1000)    return 'R$'+(v/1000).toFixed(0)+'k';
  return 'R$'+Math.round(v);
}


// ══════════════════════════════════════════════════════════════
// LINHA DO TEMPO COMERCIAL & FINANCEIRA
// ══════════════════════════════════════════════════════════════
var _tlNFs = [];
var _tlAdiantamentos = [];

function _podeEditarProposta(){
  var p=window._perfilUsuario;
  if(!p) return true; // sem perfil carregado → modo local, permite edição
  return ['colaborador','prestador'].indexOf(p)<0;
}

function rFuBadge(){
  var badge=Q('fuBadge');if(!badge)return;

  // Aplica readonly/disabled conforme perfil de acesso
  var somenteLeitura=!_podeEditarProposta();
  ['fu1dat','fu2dat','fu3dat','fu4dat'].forEach(function(id){
    var el=Q(id);if(!el)return;
    if(somenteLeitura){el.setAttribute('readonly','readonly');el.style.opacity='.55';el.style.cursor='not-allowed';}
    else{el.removeAttribute('readonly');el.style.opacity='';el.style.cursor='';}
  });
  ['fu1desc','fu2desc','fu3desc','fu4desc'].forEach(function(id){
    var el=Q(id);if(!el)return;
    if(somenteLeitura){el.setAttribute('readonly','readonly');el.style.opacity='.55';el.style.cursor='not-allowed';}
    else{el.removeAttribute('readonly');el.style.opacity='';el.style.cursor='';}
  });

  var datas=[Q('fu4dat'),Q('fu3dat'),Q('fu2dat'),Q('fu1dat')];
  var ultima=null,idx=-1;
  for(var i=0;i<datas.length;i++){if(datas[i]&&datas[i].value){ultima=datas[i].value;idx=3-i+1;break;}}
  if(!ultima){badge.style.display='none';return;}
  var diff=Math.floor((Date.now()-new Date(ultima+'T12:00:00').getTime())/86400000);
  var cor=diff>14?'var(--red)':diff>7?'var(--accent)':'var(--green)';
  badge.style.display='block';
  badge.innerHTML='Último contato: <strong>Follow-up '+idx+'</strong> — <span style="color:'+cor+';font-weight:700">'+diff+' dia'+(diff!==1?'s':'')+' atrás</span>'
    +(somenteLeitura?' <span style="color:var(--text3);font-size:.68rem">(somente leitura)</span>':'');
}

function togTimeline(){
  var b=Q('timelineBody'),ch=Q('timelineChevron');
  if(!b)return;
  var open=b.style.display==='block';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲ recolher';
  if(!open){ rTlNFList(); rTlAdiantList(); rCiclos(); }
}

function tlCarregarDados(tl){
  tl=tl||{};
  _tlNFs          = JSON.parse(JSON.stringify(tl.nfs||[]));
  _tlAdiantamentos= JSON.parse(JSON.stringify(tl.adiantamentos||[]));
  if(Q('tlDtVisita'))     Q('tlDtVisita').value     = tl.dtVisita||'';
  if(Q('tlDtEnvio'))      Q('tlDtEnvio').value      = tl.dtEnvio||'';
  if(Q('tlCanal'))        Q('tlCanal').value         = tl.canal||'';
  if(Q('tlDtInicioExec')) Q('tlDtInicioExec').value  = tl.dtInicioExec||'';
  if(Q('tlDtTermino'))    Q('tlDtTermino').value     = tl.dtTermino||'';
  if(Q('tlDtAceite'))     Q('tlDtAceite').value      = tl.dtAceite||'';
  if(Q('tlDtRecebFinal')) Q('tlDtRecebFinal').value  = tl.dtRecebFinal||'';
  if(Q('tlValRecebFinal'))Q('tlValRecebFinal').value  = tl.valRecebFinal||'';
  if(Q('tlPrazoPgto'))    Q('tlPrazoPgto').value     = tl.prazoPgto||'';
  if(Q('tlAdiantPct'))    Q('tlAdiantPct').value      = tl.adiantPct||'';
  rTlNFList(); rTlAdiantList(); rCiclos();
}

// ── NFs ──────────────────────────────────────────────────────
function tlAddNF(){
  _tlNFs.push({num:'',data:'',tipo:'servico',valor:0});
  rTlNFList(); rCiclos();
}
function tlRemNF(i){
  _tlNFs.splice(i,1); rTlNFList(); rCiclos();
}
function tlSaveNF(i,campo,val){
  if(!_tlNFs[i]) return;
  if(campo==='valor') _tlNFs[i][campo]=parseFloat(val)||0;
  else _tlNFs[i][campo]=val;
  rCiclos();
}
function rTlNFList(){
  var el=Q('tlNFList'); if(!el) return;
  if(!_tlNFs.length){
    el.innerHTML='<div style="font-size:.75rem;color:var(--text3);padding:.3rem 0">Nenhuma NF registrada. Clique em + NF.</div>';
    return;
  }
  var hdr='<div style="display:grid;grid-template-columns:100px 110px 90px 120px 30px;gap:.4rem;align-items:center;font-size:.68rem;color:var(--text3);font-weight:700;margin-bottom:.3rem;padding:0 .2rem">'
    +'<div>Nº NF</div><div>Data</div><div>Tipo</div><div style="text-align:right">Valor (R$)</div><div></div>'
    +'</div>';
  var rows=_tlNFs.map(function(nf,i){
    return '<div style="display:grid;grid-template-columns:100px 110px 90px 120px 30px;gap:.4rem;align-items:center;margin-bottom:.3rem">'
      +'<input type="text" value="'+esc(nf.num||'')+'" placeholder="Ex: 000123" style="padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.78rem" oninput="tlSaveNF('+i+',\'num\',this.value)">'
      +'<input type="date" value="'+(nf.data||'')+'" style="padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.78rem" oninput="tlSaveNF('+i+',\'data\',this.value);rCiclos()">'
      +'<select style="padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.78rem" onchange="tlSaveNF('+i+',\'tipo\',this.value)">'
        +'<option value="servico"'+(nf.tipo==='servico'?' selected':'')+'>Serviço</option>'
        +'<option value="material"'+(nf.tipo==='material'?' selected':'')+'>Material</option>'
      +'</select>'
      +'<input type="number" value="'+(nf.valor||'')+'" min="0" step="0.01" placeholder="0,00" style="padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.78rem;text-align:right" oninput="tlSaveNF('+i+',\'valor\',this.value)">'
      +'<button onclick="tlRemNF('+i+')" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:1rem;padding:0">×</button>'
      +'</div>';
  }).join('');
  el.innerHTML = hdr + rows;
}

// ── Adiantamentos ─────────────────────────────────────────────
function tlAddAdiant(){
  _tlAdiantamentos.push({data:'',valor:0,descricao:''});
  rTlAdiantList(); rCiclos();
}
function tlRemAdiant(i){
  _tlAdiantamentos.splice(i,1); rTlAdiantList(); rCiclos();
}
function tlSaveAdiant(i,campo,val){
  if(!_tlAdiantamentos[i]) return;
  if(campo==='valor') _tlAdiantamentos[i][campo]=parseFloat(val)||0;
  else _tlAdiantamentos[i][campo]=val;
  rCiclos();
}
function rTlAdiantList(){
  var el=Q('tlAdiantList'); if(!el) return;
  if(!_tlAdiantamentos.length){
    el.innerHTML='<div style="font-size:.75rem;color:var(--text3);padding:.3rem 0">Nenhum adiantamento registrado.</div>';
    return;
  }
  var hdr='<div style="display:grid;grid-template-columns:110px 120px 1fr 30px;gap:.4rem;align-items:center;font-size:.68rem;color:var(--text3);font-weight:700;margin-bottom:.3rem;padding:0 .2rem">'
    +'<div>Data</div><div style="text-align:right">Valor (R$)</div><div>Descrição</div><div></div>'
    +'</div>';
  var rows=_tlAdiantamentos.map(function(a,i){
    return '<div style="display:grid;grid-template-columns:110px 120px 1fr 30px;gap:.4rem;align-items:center;margin-bottom:.3rem">'
      +'<input type="date" value="'+(a.data||'')+'" style="padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.78rem" oninput="tlSaveAdiant('+i+',\'data\',this.value)">'
      +'<input type="number" value="'+(a.valor||'')+'" min="0" step="0.01" placeholder="0,00" style="padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.78rem;text-align:right" oninput="tlSaveAdiant('+i+',\'valor\',this.value)">'
      +'<input type="text" value="'+esc(a.descricao||'')+'" placeholder="Ex: 50% na assinatura" style="padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.78rem" oninput="tlSaveAdiant('+i+',\'descricao\',this.value)">'
      +'<button onclick="tlRemAdiant('+i+')" style="background:none;border:none;color:#f85149;cursor:pointer;font-size:1rem;padding:0">×</button>'
      +'</div>';
  }).join('');
  el.innerHTML = hdr + rows;
}

// ── CÁLCULO DOS KPIs ──────────────────────────────────────────
function _difDias(d1str, d2str){
  if(!d1str||!d2str) return null;
  var d1=new Date(d1str+'T12:00:00'), d2=new Date(d2str+'T12:00:00');
  if(isNaN(d1)||isNaN(d2)) return null;
  return Math.round((d2-d1)/(1000*60*60*24));
}
function _kpiBox(icone, label, valor, sub, cor){
  cor=cor||'var(--text)';
  return '<div style="background:var(--bg3);border-radius:8px;padding:.55rem .8rem;min-width:150px;flex:1">'
    +'<div style="font-size:.65rem;color:var(--text3);margin-bottom:.15rem">'+icone+' '+label+'</div>'
    +'<div style="font-size:.95rem;font-weight:800;color:'+cor+'">'+valor+'</div>'
    +(sub?'<div style="font-size:.68rem;color:var(--text3);margin-top:.1rem">'+sub+'</div>':'')
    +'</div>';
}
function _diasStr(d){ return d===null?'—':d+'d'; }

function rCiclos(){
  var el=Q('tlKpis'); if(!el) return;

  // Coletar datas
  var dtContato   = (Q('pDat')&&Q('pDat').value)||'';
  var dtVisita    = (Q('tlDtVisita')&&Q('tlDtVisita').value)||'';
  var dtEnvio     = (Q('tlDtEnvio')&&Q('tlDtEnvio').value)||'';
  var dtFech      = (Q('pDatFech')&&Q('pDatFech').value)||'';
  var dtInicioExec= (Q('tlDtInicioExec')&&Q('tlDtInicioExec').value)||'';
  var dtTermino   = (Q('tlDtTermino')&&Q('tlDtTermino').value)||'';
  var dtAceite    = (Q('tlDtAceite')&&Q('tlDtAceite').value)||'';
  var dtRecebFinal= (Q('tlDtRecebFinal')&&Q('tlDtRecebFinal').value)||'';
  var valContrato = n2(Q('vS')&&Q('vS').value) + n2(Q('vM')&&Q('vM').value);
  var adiantPct   = parseFloat(Q('tlAdiantPct')&&Q('tlAdiantPct').value)||0;
  var prazoPgto   = (Q('tlPrazoPgto')&&Q('tlPrazoPgto').value)||'';

  // Totais financeiros
  var totalNF   = _tlNFs.reduce(function(s,nf){return s+(nf.valor||0);},0);
  var totalNFSvc= _tlNFs.filter(function(nf){return nf.tipo==='servico';}).reduce(function(s,nf){return s+(nf.valor||0);},0);
  var totalNFMat= _tlNFs.filter(function(nf){return nf.tipo==='material';}).reduce(function(s,nf){return s+(nf.valor||0);},0);
  var totalAdiant=_tlAdiantamentos.reduce(function(s,a){return s+(a.valor||0);},0);
  var valRecebFinal=parseFloat(Q('tlValRecebFinal')&&Q('tlValRecebFinal').value)||0;
  var totalReceb = totalAdiant + valRecebFinal;
  var emAberto   = Math.max(0, totalNF - totalReceb);
  var adiantPctReal = totalNF>0 ? (totalAdiant/totalNF*100) : 0;
  var adiantAcordado = valContrato>0&&adiantPct>0 ? valContrato*adiantPct/100 : 0;

  // Ciclos em dias
  var cicProsp   = _difDias(dtContato, dtVisita);
  var cicElab    = _difDias(dtVisita||dtContato, dtEnvio);
  var cicDecisao = _difDias(dtEnvio, dtFech);
  var cicComerc  = _difDias(dtContato, dtFech);
  var gapPreObra = _difDias(dtFech, dtInicioExec);
  var cicExecucao= _difDias(dtInicioExec, dtTermino);
  var gapEntregaNF=_difDias(dtAceite||dtTermino, _tlNFs.length>0?(_tlNFs[0].data||''):'');
  var cicFinanc  = _difDias(dtInicioExec, dtRecebFinal);
  // PMR: data última NF → recebimento final
  var ultimaNFData = _tlNFs.length>0 ? _tlNFs.reduce(function(max,nf){return (nf.data||'')>(max||'')?nf.data:max;},'') : '';
  var pmrReal = _difDias(ultimaNFData, dtRecebFinal);

  var temDados = dtContato||dtFech||dtInicioExec||totalNF>0;
  if(!temDados){ el.innerHTML=''; return; }

  var html='<div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.6rem">📊 KPIs dos Ciclos</div>';

  // ── Ciclo Comercial
  html+='<div style="margin-bottom:.7rem">'
    +'<div style="font-size:.7rem;color:var(--blue);font-weight:700;margin-bottom:.4rem">🔵 Ciclo Comercial</div>'
    +'<div style="display:flex;gap:.5rem;flex-wrap:wrap">'
    +_kpiBox('📞','Prospecção',_diasStr(cicProsp),'Contato → Visita','var(--blue)')
    +_kpiBox('📝','Elaboração',_diasStr(cicElab),(dtVisita?'Visita':'Contato')+' → Envio','var(--blue)')
    +_kpiBox('⏳','Decisão do Cliente',_diasStr(cicDecisao),'Envio → Fechamento',cicDecisao===null?'var(--text3)':cicDecisao<=15?'#3fb950':cicDecisao<=30?'#d4a017':'#f85149')
    +_kpiBox('🏆','Ciclo Comercial Total',_diasStr(cicComerc),'Contato → Fechamento',cicComerc===null?'var(--text3)':cicComerc<=30?'#3fb950':cicComerc<=60?'#d4a017':'#f85149')
    +'</div></div>';

  // ── Ciclo de Execução
  html+='<div style="margin-bottom:.7rem">'
    +'<div style="font-size:.7rem;color:#3fb950;font-weight:700;margin-bottom:.4rem">🟢 Ciclo de Execução</div>'
    +'<div style="display:flex;gap:.5rem;flex-wrap:wrap">'
    +_kpiBox('🚀','Gap Pré-Obra',_diasStr(gapPreObra),'Fechamento → Início Exec.','#d4a017')
    +_kpiBox('⚙️','Duração da Execução',_diasStr(cicExecucao),'Início → Término','#3fb950')
    +(dtAceite||dtTermino?_kpiBox('📋','Entrega → 1ª NF',_difDias(dtAceite||dtTermino,_tlNFs.length>0&&_tlNFs[0].data?_tlNFs[0].data:'')===null?'—':_difDias(dtAceite||dtTermino,_tlNFs.length>0&&_tlNFs[0].data?_tlNFs[0].data:'')+'d','Aceite/Término → NF','var(--text2)'):'')
    +'</div></div>';

  // ── Ciclo Financeiro
  html+='<div style="margin-bottom:.7rem">'
    +'<div style="font-size:.7rem;color:#d4a017;font-weight:700;margin-bottom:.4rem">🟡 Ciclo Financeiro</div>'
    +'<div style="display:flex;gap:.5rem;flex-wrap:wrap">'
    +(totalNF>0?_kpiBox('📄','Total NF Emitidas',money(totalNF),'Svc: '+money(totalNFSvc)+' | Mat: '+money(totalNFMat),'var(--accent)'):'')
    +(totalAdiant>0?_kpiBox('💰','Adiantamentos',money(totalAdiant),adiantAcordado>0?'Acordado: '+money(adiantAcordado)+' ('+adiantPct+'%)':'Recebidos: '+_tlAdiantamentos.length,'#3fb950'):'')
    +(totalNF>0?_kpiBox('⚠️','Em Aberto (Risco Sacado)',money(emAberto),adiantPctReal.toFixed(1)+'% adiantado vs total NF',emAberto<=0?'#3fb950':emAberto>valContrato*0.5?'#f85149':'#f97316'):'')
    +(pmrReal!==null?_kpiBox('📅','PMR Real',pmrReal+'d',(prazoPgto?'Acordado: '+prazoPgto:'última NF → recebimento'),pmrReal<=30?'#3fb950':pmrReal<=60?'#d4a017':'#f85149'):'')
    +(cicFinanc!==null?_kpiBox('🔄','Ciclo Financeiro Total',cicFinanc+'d','Início Exec. → Receb. Final',cicFinanc<=60?'#3fb950':cicFinanc<=120?'#d4a017':'#f85149'):'')
    +'</div></div>';

  // ── Visão geral do recebimento
  if(totalNF>0||totalAdiant>0||valRecebFinal>0){
    var pctReceb = totalNF>0?(totalReceb/totalNF*100):0;
    html+='<div style="background:var(--bg3);border-radius:8px;padding:.6rem .9rem;margin-top:.4rem">'
      +'<div style="font-size:.7rem;font-weight:700;color:var(--text3);margin-bottom:.4rem">📊 Recebimento vs Faturamento</div>'
      +'<div style="display:flex;align-items:center;gap:.8rem;flex-wrap:wrap">'
      +'<div style="flex:1;min-width:200px">'
        +'<div style="display:flex;justify-content:space-between;font-size:.72rem;margin-bottom:.2rem">'
          +'<span style="color:var(--text2)">Recebido: '+money(totalReceb)+'</span>'
          +'<span style="color:var(--text3)">NF: '+money(totalNF)+'</span>'
        +'</div>'
        +'<div style="height:8px;background:var(--bg);border-radius:4px;overflow:hidden">'
          +'<div style="width:'+Math.min(100,pctReceb).toFixed(1)+'%;height:100%;background:'+(pctReceb>=100?'#3fb950':pctReceb>=50?'#d4a017':'#f97316')+';border-radius:4px"></div>'
        +'</div>'
        +'<div style="font-size:.68rem;color:var(--text3);margin-top:.15rem">'+pctReceb.toFixed(1)+'% recebido do total faturado</div>'
      +'</div>'
      +(valContrato>0?'<div style="font-size:.78rem;color:var(--text2)">Contrato: <strong style="color:var(--text)">'+money(valContrato)+'</strong></div>':'')
      +'</div></div>';
  }

  el.innerHTML = html;
}


function togCl(id){
  var el=Q(id); if(!el) return;
  var open=el.style.display!=='none';
  el.style.display=open?'none':'block';
  var ch=el.previousElementSibling;
  if(ch){
    var arr=ch.querySelector('span:last-child');
    if(arr) arr.textContent=arr.textContent.replace(open?'▲':'▼',open?'▼':'▲');
  }
}
// Preencher versão atual no changelog
(function(){
  var el=Q('clVerAtual');
  var subs=document.querySelectorAll('.logo-sub');
  var verText='';
  subs.forEach(function(s){ if(s.textContent.indexOf('Versão:')>=0) verText=s.textContent.replace('Versão:','').trim(); });
  if(el) el.textContent=verText||'V441_OFICIAL';
})();


function fmAbrirProposta(id){
  var p=props.find(function(x){return x.id===id;});
  if(!p) return;

  _pdId = id;

  var numEl = document.getElementById('pd-num');
  var cliEl = document.getElementById('pd-cli');
  var badgeEl = document.getElementById('pd-fase-badge');

  if(numEl) numEl.textContent = '#' + (p.num || '');
  if(cliEl) cliEl.textContent = p.cli || '';

  if(badgeEl){
    var _fo=FASE[p.fas]||{n:p.fas||'--',c:'b-elab',i:''};
    badgeEl.innerHTML='<span class="bdg '+_fo.c+'">'+(_fo.i?_fo.i+' ':'')+esc(_fo.n)+'</span>';
  }

  go('proposta-detalhe', null);

  window.scrollTo({top:0, behavior:'smooth'});
}


// ══════════════════════════════════════════════════════════════
// PAINEL KPIs DE CICLOS — DASHBOARD
// ══════════════════════════════════════════════════════════════
function togCiclosDash(){
  var b=Q('ciclosDashBody'), ch=Q('ciclosDashChevron');
  if(!b) return;
  var open = b.style.display==='block';
  b.style.display = open?'none':'block';
  ch.textContent  = open?'▼ expandir':'▲ recolher';
  if(!open) rCiclosDash();
}

function _difD(d1,d2){
  if(!d1||!d2) return null;
  var a=new Date(d1+'T12:00:00'), b=new Date(d2+'T12:00:00');
  if(isNaN(a)||isNaN(b)) return null;
  var d=Math.round((b-a)/86400000);
  return d>=0?d:null;
}

function _media(arr){ return arr.length>0 ? Math.round(arr.reduce(function(s,v){return s+v;},0)/arr.length) : null; }

function rCiclosDash(){
  var el=Q('ciclosDashGrid'); if(!el) return;

  // Acumular valores de todas as propostas com tl preenchido
  var prosp=[],elab=[],dec=[],cicCom=[],gapPre=[],exec=[],entNF=[];
  var pmr=[],cicFin=[],adiantPcts=[],emAberto=[];

  props.forEach(function(p){
    if(p.fas==='em_elaboracao') return;
    var tl=p.tl||{};
    var dtC =p.dat2||'';
    var dtV =tl.dtVisita||'';
    var dtE =tl.dtEnvio||'';
    var dtF =p.dtFech||'';
    var dtI =tl.dtInicioExec||'';
    var dtT =tl.dtTermino||'';
    var dtA =tl.dtAceite||'';
    var dtRF=tl.dtRecebFinal||'';
    var nfs =tl.nfs||[];
    var adi =tl.adiantamentos||[];
    var val =n2(p.val)||0;

    // Ciclo Comercial
    var d;
    d=_difD(dtC,dtV); if(d!==null) prosp.push(d);
    d=_difD(dtV||dtC,dtE); if(d!==null&&dtE) elab.push(d);
    d=_difD(dtE,dtF); if(d!==null&&dtE&&dtF) dec.push(d);
    d=_difD(dtC,dtF); if(d!==null&&dtF) cicCom.push(d);

    // Ciclo Execução
    d=_difD(dtF,dtI); if(d!==null&&dtF&&dtI) gapPre.push(d);
    d=_difD(dtI,dtT); if(d!==null&&dtI&&dtT) exec.push(d);
    var primNFdata=nfs.length>0?nfs.reduce(function(mn,nf){return (!mn||nf.data<mn)?nf.data:mn;},''):null;
    d=_difD(dtA||dtT,primNFdata); if(d!==null&&primNFdata) entNF.push(d);

    // Ciclo Financeiro
    var ultNFdata=nfs.length>0?nfs.reduce(function(mx,nf){return nf.data>mx?nf.data:mx;},''):null;
    d=_difD(ultNFdata,dtRF); if(d!==null&&dtRF&&ultNFdata) pmr.push(d);
    d=_difD(dtI,dtRF); if(d!==null&&dtI&&dtRF) cicFin.push(d);

    // Adiantamento
    var totNF=nfs.reduce(function(s,nf){return s+(nf.valor||0);},0);
    var totAdi=adi.reduce(function(s,a){return s+(a.valor||0);},0);
    if(totNF>0) adiantPcts.push(totAdi/totNF*100);
    if(val>0&&totNF>0) emAberto.push(Math.max(0,totNF-totAdi-(tl.valRecebFinal||0)));
  });

  function _mStr(arr){ var m=_media(arr); return m!==null?m+'d':'—'; }
  function _mCor(arr,bom,ok){ var m=_media(arr); if(m===null) return 'var(--text3)'; return m<=bom?'#3fb950':m<=ok?'#d4a017':'#f97316'; }
  function _mCorInv(arr,bom,ok){ var m=_media(arr); if(m===null) return 'var(--text3)'; return m>=bom?'#3fb950':m>=ok?'#d4a017':'#f97316'; }

  var mProsp=_media(prosp), mElab=_media(elab), mDec=_media(dec), mCom=_media(cicCom);
  var mGap=_media(gapPre), mExec=_media(exec), mEntNF=_media(entNF);
  var mPMR=_media(pmr), mCicFin=_media(cicFin);
  var mAdiPct=adiantPcts.length>0?Math.round(adiantPcts.reduce(function(s,v){return s+v;},0)/adiantPcts.length):null;

  function kpi(icone,label,valor,sub,cor,n){
    cor=cor||'var(--text)';
    return '<div style="background:var(--bg3);border-radius:8px;padding:.55rem .8rem">'
      +'<div style="font-size:.65rem;color:var(--text3);margin-bottom:.1rem">'+icone+' '+label+(n?' <span style="opacity:.5">('+n+')</span>':'')+'</div>'
      +'<div style="font-size:1.1rem;font-weight:800;color:'+cor+'">'+valor+'</div>'
      +(sub?'<div style="font-size:.65rem;color:var(--text3);margin-top:.1rem">'+sub+'</div>':'')
      +'</div>';
  }

  var html='';

  // Comercial
  html+='<div style="font-size:.7rem;color:var(--blue);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem">🔵 Ciclo Comercial</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin-bottom:.9rem">';
  html+=kpi('📞','Prospecção',_mStr(prosp),'Contato → Visita',_mCor(prosp,7,15),prosp.length);
  html+=kpi('📝','Elaboração',_mStr(elab),'Visita/Contato → Envio',_mCor(elab,6,12),elab.length);
  html+=kpi('⏳','Decisão do Cliente',_mStr(dec),'Envio → Fechamento',_mCor(dec,30,60),dec.length);
  html+=kpi('🏆','Ciclo Comercial Total',_mStr(cicCom),'Contato → Fechamento',_mCor(cicCom,45,90),cicCom.length);
  html+='</div>';

  // Execução
  html+='<div style="font-size:.7rem;color:#3fb950;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem">🟢 Ciclo de Execução</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin-bottom:.9rem">';
  html+=kpi('🚀','Gap Pré-Obra',_mStr(gapPre),'Fechamento → Início Exec.',_mCor(gapPre,15,30),gapPre.length);
  html+=kpi('⚙️','Duração da Execução',_mStr(exec),'Início → Término','var(--text3)',exec.length);
  html+=(entNF.length?kpi('📋','Entrega → 1ª NF',_mStr(entNF),'Aceite/Término → NF',_mCor(entNF,3,7),entNF.length):'');
  html+='</div>';

  // Financeiro
  html+='<div style="font-size:.7rem;color:#d4a017;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem">🟡 Ciclo Financeiro</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem">';
  html+=(mPMR!==null?kpi('📅','PMR Médio Real',mPMR+'d','Última NF → Recebimento',_mCor(pmr,30,60),pmr.length):'');
  html+=(mCicFin!==null?kpi('🔄','Ciclo Financeiro Total',mCicFin+'d','Início Exec. → Receb. Final',_mCor(cicFin,60,120),cicFin.length):'');
  html+=(mAdiPct!==null?kpi('💰','Adiantamento Médio',mAdiPct+'%','% do total faturado recebido antec.',_mCorInv(adiantPcts,40,20),adiantPcts.length):'');
  html+='</div>';

  if(!prosp.length&&!elab.length&&!dec.length&&!cicCom.length&&!exec.length&&!pmr.length){
    html='<div style="text-align:center;color:var(--text3);padding:1rem;font-size:.82rem">Preencha a Linha do Tempo nas propostas para ver as médias dos ciclos aqui.</div>';
  }

  el.innerHTML=html;
}


// ══════════════════════════════════════════════════════════════
// LINHA DO TEMPO DE EXECUÇÃO
// ══════════════════════════════════════════════════════════════
function togExecTimeline(){
  var b=Q('execTlBody'),ch=Q('execTlChevron');
  if(!b)return;
  var open=b.style.display==='block';
  b.style.display=open?'none':'block';
  ch.textContent=open?'▼ expandir':'▲ recolher';
  if(!open){_populaExecTlAnos();rExecTimeline();}
}

function _populaExecTlAnos(){
  var sel=Q('execTlAno');if(!sel)return;
  var anos={};
  props.forEach(function(p){
    var tl=p.tl||{};
    var d=tl.dtInicioExec||tl.dtTermino||'';
    if(d) anos[d.slice(0,4)]=1;
  });
  var anoAtual=String(new Date().getFullYear());
  anos[anoAtual]=1;
  var lista=Object.keys(anos).sort().reverse();
  var cur=sel.value||anoAtual;
  sel.innerHTML=lista.map(function(a){return '<option value="'+a+'"'+(a===cur?' selected':'')+'>'+a+'</option>';}).join('');
}

function rExecTimeline(){
  var el=Q('execTlChart');if(!el)return;
  var ano=Q('execTlAno')&&Q('execTlAno').value||String(new Date().getFullYear());
  var anoN=parseInt(ano);

  // Coletar projetos com dtInicioExec no ano selecionado ou que atravessam o ano
  var itens=[];
  props.forEach(function(p){
    var tl=p.tl||{};
    var ini=tl.dtInicioExec||'';
    var fim=tl.dtTermino||tl.dtAceite||'';
    if(!ini) return;
    var dIni=new Date(ini+'T12:00:00');
    if(isNaN(dIni)) return;
    // Incluir se início ou fim está no ano, ou se atravessa o ano
    var dFim=fim?new Date(fim+'T12:00:00'):null;
    var anoIni=dIni.getFullYear();
    var anoFim=dFim?dFim.getFullYear():anoIni;
    if(anoFim<anoN||anoIni>anoN) return;
    itens.push({
      id:p.id, num:p.num||'', cli:p.cli||'', tit:p.tit||'',
      ini:ini, fim:fim||ini,
      dIni:dIni, dFim:dFim||dIni,
      fas:p.fas||''
    });
  });

  // Ordenar por data de início
  itens.sort(function(a,b){return a.dIni-b.dIni;});

  // Escala: 1 Jan → 31 Dez do ano selecionado
  var anoStart=new Date(anoN+'-01-01T12:00:00');
  var anoEnd  =new Date(anoN+'-12-31T12:00:00');
  var totalMs =anoEnd-anoStart;

  function pct(d){return Math.max(0,Math.min(100,((d-anoStart)/totalMs)*100));}

  // Meses para eixo X
  var MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  var hoje=new Date();
  var hojePct=pct(hoje);

  var rowH=32, padL=130, padR=12, padT=28, padB=8;
  var svgW=760;
  var svgH=padT + itens.length*rowH + padB + 20;

  var svg='<div style="overflow-x:auto"><svg viewBox="0 0 '+svgW+' '+svgH+'" xmlns="http://www.w3.org/2000/svg" style="width:100%;min-width:560px;display:block;font-family:inherit">';

  // Grid e labels dos meses
  for(var m=0;m<12;m++){
    var mx=padL+(svgW-padL-padR)*(m/12);
    svg+='<line x1="'+mx+'" y1="'+padT+'" x2="'+mx+'" y2="'+(svgH-padB-20)+'" stroke="rgba(128,128,128,.15)" stroke-width="1"/>';
    svg+='<text x="'+mx+'" y="'+(padT-6)+'" text-anchor="middle" font-size="9" fill="rgba(150,150,150,.7)">'+MESES[m]+'</text>';
  }

  if(itens.length===0){
    svg+='<text x="'+((svgW+padL)/2)+'" y="'+(padT+40)+'" text-anchor="middle" font-size="12" fill="rgba(150,150,150,.6)">Nenhum projeto com data de execução em '+ano+'</text>';
  }

  // Calcular janelas sem execução
  var janelas=[];
  for(var i=1;i<itens.length;i++){
    var prevFim=itens[i-1].dFim;
    var curIni=itens[i].dIni;
    if(curIni>prevFim){
      var gap=Math.round((curIni-prevFim)/86400000);
      if(gap>=2) janelas.push({dIni:prevFim,dFim:curIni,gap:gap});
    }
  }

  // Desenhar janelas sem execução (fundo)
  janelas.forEach(function(j){
    var x1=padL+(svgW-padL-padR)*pct(j.dIni)/100;
    var x2=padL+(svgW-padL-padR)*pct(j.dFim)/100;
    svg+='<rect x="'+x1+'" y="'+padT+'" width="'+(x2-x1)+'" height="'+(svgH-padT-padB-20)+'" fill="rgba(248,81,73,.06)" stroke="rgba(248,81,73,.2)" stroke-width="1" stroke-dasharray="4,3"/>';
    if(x2-x1>30){
      svg+='<text x="'+((x1+x2)/2)+'" y="'+(padT+12)+'" text-anchor="middle" font-size="9" fill="rgba(248,81,73,.7)">⚠ '+j.gap+'d sem exec.</text>';
    }
  });

  // Desenhar projetos
  itens.forEach(function(it,i){
    var y=padT+i*rowH+4;
    var barH=rowH-8;
    var x1pct=pct(it.dIni);
    var x2pct=pct(it.dFim);
    var x1=padL+(svgW-padL-padR)*x1pct/100;
    var x2=padL+(svgW-padL-padR)*x2pct/100;
    var bw=Math.max(3,x2-x1);

    // Cor por fase
    var FAS_OK=['andamento','faturado','recebido','taf','sat','finalizado'];
    var FAS_APR=['aprovado'];
    var cor=FAS_OK.indexOf(it.fas)>=0?'#3fb950':FAS_APR.indexOf(it.fas)>=0?'#58a6ff':'#d4a017';

    // Label à esquerda
    var label=(it.num?it.num+' ':'')+it.cli;
    if(label.length>22) label=label.slice(0,21)+'…';
    svg+='<text x="'+(padL-6)+'" y="'+(y+barH/2+4)+'" text-anchor="end" font-size="9.5" fill="rgba(180,180,180,.85)" style="cursor:pointer" onclick="fmAbrirProposta(\''+it.id+'\')">'+esc(label)+'</text>';

    // Barra
    svg+='<rect x="'+x1+'" y="'+y+'" width="'+bw+'" height="'+barH+'" rx="3" fill="'+cor+'" opacity=".85" style="cursor:pointer" onclick="fmAbrirProposta(\''+it.id+'\')">';
    svg+='<title>'+esc(it.cli+(it.tit?' — '+it.tit:''))+'\n'+it.ini+' → '+it.fim+'</title>';
    svg+='</rect>';

    // Duração em dias dentro da barra se couber
    var dias=Math.round((it.dFim-it.dIni)/86400000);
    if(bw>30&&dias>0){
      svg+='<text x="'+(x1+bw/2)+'" y="'+(y+barH/2+4)+'" text-anchor="middle" font-size="8.5" fill="rgba(255,255,255,.9)">'+dias+'d</text>';
    }
  });

  // Linha "hoje"
  if(anoN===hoje.getFullYear()){
    var hx=padL+(svgW-padL-padR)*hojePct/100;
    svg+='<line x1="'+hx+'" y1="'+padT+'" x2="'+hx+'" y2="'+(svgH-padB-20)+'" stroke="#f0a500" stroke-width="1.5" stroke-dasharray="4,3"/>';
    svg+='<text x="'+hx+'" y="'+(svgH-padB-6)+'" text-anchor="middle" font-size="9" fill="#f0a500">hoje</text>';
  }

  svg+='</svg></div>';

  // Resumo de janelas
  if(janelas.length>0){
    var maiorJanela=janelas.reduce(function(a,b){return b.gap>a.gap?b:a;},janelas[0]);
    svg+='<div style="margin-top:.5rem;font-size:.72rem;color:var(--text3)">'+
      janelas.length+' janela(s) sem execução em '+ano+' | '+
      'Maior intervalo: <b style="color:#f85149">'+maiorJanela.gap+' dias</b> ('+maiorJanela.dIni.toLocaleDateString('pt-BR')+' → '+maiorJanela.dFim.toLocaleDateString('pt-BR')+')</div>';
  } else if(itens.length>0){
    svg+='<div style="margin-top:.5rem;font-size:.72rem;color:#3fb950">✅ Sem janelas sem execução em '+ano+'</div>';
  }

  el.innerHTML=svg;
}

// ══ BLOCO 6 ══
// ════ V473: LÓGICA DO MODAL DE COTAÇÃO — TABELA HTML ════
var _cotItens = [];

var COT_ASSINATURA_HTML =
  '<p style="margin:0">Atenciosamente,</p>' +
  '<p style="margin:16px 0 0 0"><strong>Eng. Elivandro J. Nascimento</strong><br>' +
  'Engenheiro Eletricista | CREA SP: 5071802874<br>' +
  'Tecfusion Soluções Elétricas Industriais<br>' +
  '+55 11 999.299.211 | elivandro@tecfusion.com.br</p>';

function abrirCotModal(){
  _cotItens = (budg||[]).filter(function(it){ return it && it.inc !== false; });
  if(!_cotItens.length){ toast('Nenhum item no orçamento para gerar cotação.','err'); return; }
  _renderCotLista();
  var m = Q('cotModal');
  if(m) m.style.display = 'flex';
  atualizarPreviewCot();
}

function fecharCotModal(){
  var m = Q('cotModal');
  if(m) m.style.display = 'none';
}

function _cotItemDesc(it){
  return (it.desc || getCatLabel(it.t, it.cat) || '').trim() || '(sem descrição)';
}

function _renderCotLista(){
  var mats = _cotItens.filter(function(it){ return it.t === 'material'; });
  var svcs = _cotItens.filter(function(it){ return it.t !== 'material'; });

  function listaHTML(arr, tipo){
    return arr.map(function(it, i){
      var desc = _cotItemDesc(it);
      var qtd  = fmtNumBr(n2(it.mult));
      var un   = it.un1 || (it.t==='material'?'un':'dias');
      return '<label style="display:flex;align-items:flex-start;gap:.4rem;font-size:.74rem;color:var(--text);cursor:pointer;background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:.3rem .5rem;line-height:1.4">'
        + '<input type="checkbox" data-cot-id="' + it.id + '" data-cot-tipo="' + tipo + '" checked style="margin-top:2px;flex-shrink:0" onchange="atualizarPreviewCot()">'
        + '<span><b>' + (i+1) + '.</b> ' + esc(desc) + ' <span style="color:var(--accent);font-weight:600">— ' + qtd + ' ' + un + '</span></span>'
        + '</label>';
    }).join('');
  }

  var lm=Q('cotListaMat'),sm=Q('cotSemMat'),ls=Q('cotListaSvc'),ss=Q('cotSemSvc');
  if(lm){ lm.innerHTML=mats.length?listaHTML(mats,'mat'):''; if(sm) sm.style.display=mats.length?'none':'block'; }
  if(ls){ ls.innerHTML=svcs.length?listaHTML(svcs,'svc'):''; if(ss) ss.style.display=svcs.length?'none':'block'; }
}

function cotSelAll(tipo, val){
  document.querySelectorAll('input[data-cot-tipo="'+tipo+'"]').forEach(function(cb){ cb.checked=val; });
  atualizarPreviewCot();
}

function _cotGetSelecionados(){
  var ids={};
  document.querySelectorAll('input[data-cot-id]').forEach(function(cb){ if(cb.checked) ids[cb.getAttribute('data-cot-id')]=true; });
  var sel=_cotItens.filter(function(it){ return ids[it.id]; });
  return { mats:sel.filter(function(it){return it.t==='material';}), svcs:sel.filter(function(it){return it.t!=='material';}) };
}

// Estilo das células da tabela (inline para compatibilidade Outlook)
var _tbStyle = 'border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;margin-bottom:16px';
var _thStyle = 'border:1px solid #000;background:#1a3a5c;color:#fff;padding:6px 8px;text-align:center;font-weight:700;white-space:nowrap';
var _tdStyle = 'border:1px solid #000;padding:5px 8px;vertical-align:middle';
var _tdCStyle= 'border:1px solid #000;padding:5px 8px;vertical-align:middle;text-align:center';
var _tdRStyle= 'border:1px solid #000;padding:5px 8px;vertical-align:middle;text-align:right';

function _buildTableHtml(itens, tipo){
  var isMat = tipo === 'mat';
  var rows = itens.map(function(it, i){
    var desc = _cotItemDesc(it);
    var qtd  = fmtNumBr(n2(it.mult));
    var un   = it.un1 || (isMat ? 'un' : 'dias');
    var escopo = '';
    if(!isMat){
      var tec=n2(it.tec||1),dias=n2(it.dias||1),hpd=n2(it.hpd||1);
      escopo = tec>1
        ? fmtNumBr(tec)+' tec. × '+fmtNumBr(dias)+' d × '+fmtNumBr(hpd)+'h'
        : fmtNumBr(dias)+' dia(s) × '+fmtNumBr(hpd)+'h/dia';
    }
    var rowBg = i%2===0 ? '#ffffff' : '#f7f7f7';
    var tdBg  = 'border:1px solid #000;padding:5px 8px;vertical-align:middle;background:'+rowBg;
    var tdCBg = 'border:1px solid #000;padding:5px 8px;vertical-align:middle;text-align:center;background:'+rowBg;
    var tdRBg = 'border:1px solid #000;padding:5px 8px;vertical-align:middle;text-align:right;background:'+rowBg;
    if(isMat){
      return '<tr>'
        + '<td style="'+tdCBg+'">' + (i+1) + '</td>'
        + '<td style="'+tdCBg+'">' + qtd + '</td>'
        + '<td style="'+tdCBg+'">' + un + '</td>'
        + '<td style="'+tdBg+'">'  + desc + '</td>'
        + '<td style="'+tdRBg+'"></td>'
        + '<td style="'+tdRBg+'"></td>'
        + '</tr>';
    } else {
      return '<tr>'
        + '<td style="'+tdCBg+'">' + (i+1) + '</td>'
        + '<td style="'+tdBg+';text-align:center">' + escopo + '</td>'
        + '<td style="'+tdBg+'">'  + desc + '</td>'
        + '<td style="'+tdRBg+'"></td>'
        + '</tr>';
    }
  }).join('');

  if(isMat){
    return '<table style="'+_tbStyle+'">'
      + '<thead><tr>'
      + '<th style="'+_thStyle+';width:40px">Item</th>'
      + '<th style="'+_thStyle+';width:55px">Qtd</th>'
      + '<th style="'+_thStyle+';width:55px">Und</th>'
      + '<th style="'+_thStyle+'">Descrição / Cód. / Ref.</th>'
      + '<th style="'+_thStyle+';width:110px">R$ Unit.</th>'
      + '<th style="'+_thStyle+';width:110px">R$ Total</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table>';
  } else {
    return '<table style="'+_tbStyle+'">'
      + '<thead><tr>'
      + '<th style="'+_thStyle+';width:40px">Item</th>'
      + '<th style="'+_thStyle+';width:170px">Escopo</th>'
      + '<th style="'+_thStyle+'">Descrição</th>'
      + '<th style="'+_thStyle+';width:120px">R$ Total</th>'
      + '</tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table>';
  }
}

function _buildCondicoesHtml(){
  return '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin-bottom:16px">'
    + '<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:700">Prazo de entrega:</td><td style="border-bottom:1px solid #000;min-width:220px;padding:4px 8px">&nbsp;</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:700">Prazo de pagamento:</td><td style="border-bottom:1px solid #000;padding:4px 8px">&nbsp;</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:700">Frete / Condição:</td><td style="border-bottom:1px solid #000;padding:4px 8px">&nbsp;</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:700">Garantia:</td><td style="border-bottom:1px solid #000;padding:4px 8px">&nbsp;</td></tr>'
    + '<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:700">Impostos inclusos:</td><td style="padding:4px 8px">☐ Sim &nbsp;&nbsp; ☐ Não</td></tr>'
    + '</table>';
}

function atualizarPreviewCot(){
  var dest  = (Q('cotDestinatario')&&Q('cotDestinatario').value)||'Fornecedor';
  var intro = (Q('cotMsgIntro')    &&Q('cotMsgIntro').value)    ||'';
  var obs   = (Q('cotObs')         &&Q('cotObs').value)         ||'';
  var sel   = _cotGetSelecionados();
  var total = sel.mats.length + sel.svcs.length;
  var ctr   = Q('cotContador'); if(ctr) ctr.textContent = total+' item(ns) selecionado(s)';

  var html = '';

  // Saudação
  html += '<p style="margin:0 0 12px 0">Prezado(a) <strong>' + esc(dest) + '</strong>,</p>';

  // Intro
  if(intro) html += '<p style="margin:0 0 16px 0">' + esc(intro).replace(/\n/g,'<br>') + '</p>';

  // Tabela de materiais
  if(sel.mats.length){
    html += '<p style="margin:0 0 6px 0;font-weight:700;font-size:13px">📦 MATERIAIS PARA COTAÇÃO</p>';
    html += _buildTableHtml(sel.mats, 'mat');
    html += '<p style="margin:0 0 6px 0;font-weight:700;font-size:13px">Condições comerciais (materiais):</p>';
    html += _buildCondicoesHtml();
  }

  // Tabela de serviços
  if(sel.svcs.length){
    html += '<p style="margin:0 0 6px 0;font-weight:700;font-size:13px">🔧 SERVIÇOS / TERCEIROS PARA COTAÇÃO</p>';
    html += _buildTableHtml(sel.svcs, 'svc');
    html += '<p style="margin:0 0 6px 0;font-weight:700;font-size:13px">Condições comerciais (serviços):</p>';
    html += '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin-bottom:16px">'
      + '<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:700">Prazo de pagamento:</td><td style="border-bottom:1px solid #000;min-width:220px;padding:4px 8px">&nbsp;</td></tr>'
      + '<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:700">Disponibilidade:</td><td style="border-bottom:1px solid #000;padding:4px 8px">&nbsp;</td></tr>'
      + '<tr><td style="padding:4px 12px 4px 0;white-space:nowrap;font-weight:700">Garantia / Suporte:</td><td style="border-bottom:1px solid #000;padding:4px 8px">&nbsp;</td></tr>'
      + '</table>';
  }

  if(!sel.mats.length && !sel.svcs.length) html += '<p style="color:#999">[Nenhum item selecionado]</p>';
  if(obs) html += '<p style="margin:0 0 12px 0">' + esc(obs).replace(/\n/g,'<br>') + '</p>';

  html += '<p style="margin:16px 0 0 0">Fico no aguardo do retorno.</p>';
  html += '<br>' + COT_ASSINATURA_HTML;

  var el = Q('cotPreviewHtml');
  if(el) el.innerHTML = html;
}

function cotCopiarEmail(){
  var el = Q('cotPreviewHtml');
  if(!el) return;

  // Copia como rich text (HTML) para Outlook
  var htmlContent = el.innerHTML;
  var fullHtml = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;font-size:13px;color:#111">' + htmlContent + '</body></html>';

  try{
    var blob = new Blob([fullHtml], {type:'text/html'});
    var blobPlain = new Blob([el.innerText||el.textContent||''], {type:'text/plain'});
    var item = new ClipboardItem({'text/html': blob, 'text/plain': blobPlain});
    navigator.clipboard.write([item]).then(_cotMsgCopiado).catch(function(){
      // Fallback: selecionar o conteúdo da div e copiar
      _cotCopiarFallback(el);
    });
  }catch(e){
    _cotCopiarFallback(el);
  }
}

function _cotCopiarFallback(el){
  // Seleciona o conteúdo renderizado e copia (funciona no Outlook)
  var range = document.createRange();
  range.selectNodeContents(el);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('copy');
  sel.removeAllRanges();
  _cotMsgCopiado();
}

function _cotMsgCopiado(){
  var msg = Q('cotCopiadoMsg');
  if(msg){ msg.style.display='inline'; setTimeout(function(){msg.style.display='none';},4000); }
  toast('📋 E-mail copiado! Cole no Outlook com Ctrl+V','ok');
}

// ══ Módulo Gestão CEO (inline) ══ v2
// Migrado de gestao.html — usa window.sbClient compartilhado
var _sb = window.sbClient; // usa cliente global
// Debounce para não salvar a cada tecla

let _saveTimer = null;

// Chave dinâmica por usuário — inicializada em _initGestaoChave()
var _gestaoChave = 'tf_planejador';

async function _initGestaoChave() {
  try {
    var r = await (window.sbClient || _sb).auth.getUser();
    if (r.data && r.data.user && r.data.user.id) {
      _gestaoChave = 'tf_planejador_' + r.data.user.id;
    }
  } catch(e) {}
}

function sbSaveGestao(dados) {

  clearTimeout(_saveTimer);

  _saveTimer = setTimeout(async function() {

    var sb = window.sbClient || _sb;

    if (!sb) return;

    try {

      await sb.from('configuracoes').upsert({

        chave: _gestaoChave,

        valor: dados,

        updated_at: new Date().toISOString()

      }, { onConflict: 'chave' });

    } catch(e) {

      console.warn('[gestao-sync] erro ao salvar:', e);

    }

  }, 800);

}



async function sbLoadGestao() {

  var sb = window.sbClient || _sb;

  if (!sb) return null;

  try {

    const res = await sb.from('configuracoes')

      .select('valor')

      .eq('chave', _gestaoChave)

      .maybeSingle();

    if (res.data && res.data.valor) return res.data.valor;

  } catch(e) {}

  return null;

}



async function sbLogoutGestao() {

  await _sb.auth.signOut();

  // redirect handled by main portal

}



async function sbProtegerGestao() {

  const { data } = await _sb.auth.getUser();

  if (!data?.user) { /* auth handled by main portal — redirect via login.html */ return; }

}
// ===== DADOS =====

// Individual: cada usuário tem o seu
let dados = {

  dias:{},          // chave: 'YYYY-MM-DD' → {prios,tarefas,abertos,reflexao,explosoes}

  diaAtivo:'',      // data sendo visualizada

  visitas:[],

  theme:'dark'

};

// Geral: compartilhado por todos os usuários
var dadosGeral = {

  kpi:{env:0,apr:0,val:0,acum:0,dep:0},

  crescimento:'',

  proxPasso:'',

  trim:{fat:2100000,dep:90,meta:4800000},

  revVelocidade:'',

  revMudanca:'',

  checkContr:[],

  reuniaoSegunda:[]

};



function dateStr(d){

  if(!d)d=new Date();

  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

}



function getDia(d){

  if(!d)d=dados.diaAtivo||dateStr();

  if(!dados.dias)dados.dias={};

  if(!dados.dias[d])dados.dias[d]={

    prios:{p1:'',p2:'',p3:'',c1:false,c2:false,c3:false},

    tarefas:[],abertos:[],reflexao:'',explosoes:[]

  };

  return dados.dias[d];

}



function diaHoje(){return dateStr();}



function applyDados(parsed) {

  if (!parsed) return;

  // Migração do formato antigo

  if(parsed.tarefas!==undefined&&!parsed.dias){

    const hoje=dateStr();

    parsed.dias={};

    parsed.dias[hoje]={

      prios:parsed.prios||{p1:'',p2:'',p3:'',c1:false,c2:false,c3:false},

      tarefas:parsed.tarefas||[],

      abertos:parsed.abertos||[],

      reflexao:parsed.reflexao||'',

      explosoes:parsed.explosoes||[]

    };

    delete parsed.prios;delete parsed.tarefas;

    delete parsed.abertos;delete parsed.reflexao;delete parsed.explosoes;

  }

  // Migrar campos geral do formato antigo
  var geralFields = ['kpi','crescimento','proxPasso','trim','revVelocidade','revMudanca','checkContr'];
  geralFields.forEach(function(k){ if(parsed[k]!==undefined && parsed[k]!==null){ if(typeof parsed[k]==='object' && !Array.isArray(parsed[k])){ dadosGeral[k]=Object.assign({},dadosGeral[k],parsed[k]); } else { dadosGeral[k]=dadosGeral[k]||parsed[k]; } delete parsed[k]; } });

  dados=Object.assign(dados,parsed);

}



function load(){

  // Carregar localStorage como fallback imediato (chave por usuário)

  const s=localStorage.getItem(_gestaoChave) || localStorage.getItem('tf_planejador');

  if(s)try{ applyDados(JSON.parse(s)); }catch(e){}

  // Carregar dados gerais compartilhados
  const sg=localStorage.getItem('tf_planejador_geral');

  if(sg)try{ var pg=JSON.parse(sg); if(pg&&typeof pg==='object') Object.keys(pg).forEach(function(k){ if(dadosGeral[k]!==undefined){ if(typeof dadosGeral[k]==='object'&&!Array.isArray(dadosGeral[k])){ dadosGeral[k]=Object.assign({},dadosGeral[k],pg[k]); } else { dadosGeral[k]=pg[k]; } } }); }catch(e){}

}



function save(){

  // Salva localStorage + nuvem

  localStorage.setItem(_gestaoChave,JSON.stringify(dados));

  if(typeof sbSaveGestao==='function') sbSaveGestao(dados);

}



async function loadNuvem(){

  try {

    const cloud = await sbLoadGestao();

    if(cloud){

      applyDados(cloud);

      localStorage.setItem(_gestaoChave,JSON.stringify(dados));

      // Re-renderizar tudo com dados da nuvem

      if(typeof init==='function') init();

      console.log('%c[gestao] dados carregados da nuvem','color:#F05A1A;font-weight:700');

    }

  } catch(e){ console.warn('[gestao] erro ao carregar nuvem:', e); }

}



function saveGeral(){

  localStorage.setItem('tf_planejador_geral',JSON.stringify(dadosGeral));

  if(typeof sbSaveGestaoGeral==='function') sbSaveGestaoGeral(dadosGeral);

}



async function loadNuvemGeral(){

  try {

    if(typeof sbLoadGestaoGeral==='function'){

      var cloud=await sbLoadGestaoGeral();

      if(cloud){

        Object.keys(cloud).forEach(function(k){ if(dadosGeral[k]!==undefined){ if(typeof dadosGeral[k]==='object'&&!Array.isArray(dadosGeral[k])){ dadosGeral[k]=Object.assign({},dadosGeral[k],cloud[k]); } else { dadosGeral[k]=cloud[k]; } } });

        localStorage.setItem('tf_planejador_geral',JSON.stringify(dadosGeral));

        _aplicarGeralNaUI();

        console.log('%c[gestao] dados gerais carregados da nuvem','color:#F05A1A;font-weight:700');

      }

    }

  } catch(e){ console.warn('[gestao] erro ao carregar geral da nuvem:', e); }

}



function _aplicarGeralNaUI(){

  var el;

  if((el=document.getElementById('crescimento-mes')))el.value=dadosGeral.crescimento||'';

  if((el=document.getElementById('prox-passo')))el.value=dadosGeral.proxPasso||'';

  if((el=document.getElementById('rev-velocidade')))el.value=dadosGeral.revVelocidade||'';

  if((el=document.getElementById('rev-mudanca')))el.value=dadosGeral.revMudanca||'';

  renderTrim();

  renderCheckContr();

  renderReuniaoSegunda();

}



// ===== INIT =====

load();

if(dados.theme==='light')document.body.classList.add('light');



function abrirDia(d){

  if(!d)d=diaHoje();

  dados.diaAtivo=d;

  getDia(d);

  const isHoje=d===diaHoje();

  if(isHoje){

    if(!dados.diasAbertos)dados.diasAbertos={};

    if(!dados.diasAbertos[d]){

      dados.diasAbertos[d]=true;

      migrarDiaAnterior(d);

    }

  }

  save();

  renderDiaNav();

  renderPrios();

  renderTarefas();

  renderExplosoes();

  renderAbertos();

  const dia=getDia(d);

  const el=document.getElementById('reflexao-dia');

  if(el)el.value=dia.reflexao||'';

}



function migrarDiaAnterior(dAtual){

  const diasKeys=Object.keys(dados.dias).filter(k=>k<dAtual).sort().reverse();

  if(!diasKeys.length)return;

  const diaAnt=dados.dias[diasKeys[0]];

  const diaAtualObj=getDia(dAtual);

  let migradas=0;

  const naoConcluidas=(diaAnt.tarefas||[]).filter(t=>!t.done);

  naoConcluidas.forEach(t=>{

    if(!diaAtualObj.tarefas.find(x=>x.txt===t.txt&&x.resp===t.resp)){

      diaAtualObj.tarefas.push(Object.assign({},t,{_migrada:true,done:false}));

      migradas++;

    }

  });

  const exploAbertas=(diaAnt.explosoes||[]).filter(e=>!e.dest);

  exploAbertas.forEach(e=>{

    if(!diaAtualObj.explosoes.find(x=>x.txt===e.txt)){

      diaAtualObj.explosoes.push(Object.assign({},e,{sels:[],_migrada:true,dest:null}));

      migradas++;

    }

  });

  save();

  if(migradas>0)setTimeout(()=>toast('↩ '+migradas+' item'+(migradas>1?'s':'')+' migrado'+(migradas>1?'s':'')+' do dia anterior'),600);

}



function renderDiaNav(){

  const d=dados.diaAtivo||diaHoje();

  const isHoje=d===diaHoje();

  const dt=new Date(d+'T12:00:00');

  const dias2=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  const meses2=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  const label=`${dias2[dt.getDay()]}, ${dt.getDate()} de ${meses2[dt.getMonth()]} de ${dt.getFullYear()}`;

  const el=document.getElementById('data-hoje');

  if(el)el.textContent=label;

  // Nav badge

  const nav=document.getElementById('dia-nav');

  if(nav){

    const hoje=diaHoje();

    const todosOsDias=Object.keys(dados.dias).sort();

    const idxAtual=todosOsDias.indexOf(d);

    const temProximo=d<hoje;

    nav.innerHTML=`
      <button class="btn bg btn-sm" onclick="navDia(-1)" title="Dia anterior">‹</button>
      <span style="font-size:.82rem;color:${isHoje?'var(--green)':'var(--accent)'};font-weight:700;cursor:pointer;min-width:80px;text-align:center" onclick="abrirDia(diaHoje())">${isHoje?'📅 Hoje':d}</span>
      <button class="btn bg btn-sm" onclick="navDia(1)" title="Próximo dia" ${!temProximo?'disabled':''}>›</button>
    `

  }

  // Indicador de histórico

  const hist=document.getElementById('dia-hist-badge');

  if(hist){

    const total=Object.keys(dados.dias).length;

    hist.textContent=total>1?`${total} dias registrados`:'';

    hist.style.color='var(--text3)';

    hist.style.fontSize='.65rem';

  }

  // Modo leitura se não for hoje

  const readOnly=!isHoje;

  document.querySelectorAll('.dia-input-area').forEach(el=>{

    el.style.opacity=readOnly?'.7':'1';

    el.style.pointerEvents=readOnly?'none':'auto';

  });

  if(document.getElementById('dia-readonly-banner')){

    document.getElementById('dia-readonly-banner').style.display=readOnly?'flex':'none';

  }

}



function navDia(dir){

  const d=dados.diaAtivo||diaHoje();

  const todosOsDias=Object.keys(dados.dias).sort();

  const idx=todosOsDias.indexOf(d);

  if(dir===-1){

    // Vai para o dia anterior registrado, ou subtrai 1 dia

    const ant=idx>0?todosOsDias[idx-1]:null;

    if(ant){abrirDia(ant);}else{

      const dt=new Date(d+'T12:00:00');dt.setDate(dt.getDate()-1);

      abrirDia(dateStr(dt));

    }

  } else {

    // Próximo: só avança até hoje

    const prox=idx>=0&&idx<todosOsDias.length-1?todosOsDias[idx+1]:null;

    if(prox&&prox<=diaHoje()){abrirDia(prox);}else{

      const dt=new Date(d+'T12:00:00');dt.setDate(dt.getDate()+1);

      const next=dateStr(dt);

      if(next<=diaHoje())abrirDia(next);

    }

  }

}



function init(){

  atualizarDataHoje();

  // CORREÇÃO: sempre abre hoje — nunca restaura dia passado como ativo

  dados.diaAtivo=diaHoje();

  abrirDia(diaHoje());

  renderJanelas();

  renderAlertas();

  renderSemana();

  renderVisitas();

  renderKPIs();

  renderRelacionamentoMes();

  renderTrim();

  renderFabricantes();

  _aplicarGeralNaUI();

  // Pré-carrega cache do Motor de Decisão e renderiza seções auto-pull
  setTimeout(function(){
    getOrRunDecisionEngine();
    renderCiclos();
    renderFollowups();
  }, 600);

}



// ===== NAV =====

function gestaoShowSec(id){
  // Troca seção interna sem tocar no sidebar do portal
  document.querySelectorAll('.gsec').forEach(s=>s.classList.remove('on'));
  var el = document.getElementById('sec-'+id);
  if(el) el.classList.add('on');

  // Persiste seção ativa para restaurar ao voltar ao módulo
  dados.secAtiva = id;

  // Re-renderiza e injeta sugestões da IA por seção
  if(id==='dia'){
    renderPrios();renderTarefas();renderExplosoes();renderAbertos();
    renderSugestoesIA('dia');
  }
  if(id==='semana'){ renderSemana(); renderCiclos(); renderFollowups(); renderVisitas(); renderReuniaoSegunda(); renderSugestoesIA('semana'); }
  if(id==='mes')   { renderKPIs(); renderRelacionamentoMes(); renderSugestoesIA('mes'); }
  if(id==='trimestre'){ renderTrim(); renderSugestoesIA('trimestre'); }
  if(id==='calendario'){ if(typeof renderCalendario==='function') renderCalendario(); }
  if(id==='versoes'){ renderVersoes(); }
}

// ── Bridge: obtém resultado do Motor de Decisão (lazy + cache 5min) ──────────
function getOrRunDecisionEngine(){
  if(window._deResult && window._deResult._ts && (Date.now()-window._deResult._ts)<300000){
    return window._deResult;
  }
  if(typeof runDecisionEngine==='function' && window.props && window.props.length>0){
    var r=runDecisionEngine();
    if(r) r._ts=Date.now();
    return r;
  }
  return null;
}

// ── Importa sugestão da IA como prioridade do dia ─────────────────────────────
function setPrio(n, texto){
  var dia=getDia();
  dia.prios['p'+n]=texto;
  save();
  renderPrios();
  renderSugestoesIA('dia');
}

// ── Renderiza sugestões contextuais da IA em cada seção de planejamento ───────
function renderSugestoesIA(secId){
  var r=getOrRunDecisionEngine();

  if(secId==='dia'){
    var cont=document.getElementById('sugestoes-ia-dia');
    if(!cont)return;
    if(!r||(!r.decisions.length&&!r.alerts.length)){cont.innerHTML='';return;}

    var corPri={Alta:'var(--red)',Média:'var(--accent)',Baixa:'var(--text3)'};
    var corImp={alto:'var(--red)',medio:'var(--accent)',baixo:'var(--text3)',critico:'#ff5555'};

    var criticos=r.alerts.filter(function(a){return a.tipo==='critico'||a.impacto==='alto';});
    var alertasHtml=criticos.map(function(a){
      var cor=corImp[a.tipo==='critico'?'critico':a.impacto]||'var(--red)';
      return '<div style="padding:.28rem .55rem;border-left:3px solid '+cor+';background:rgba(255,85,85,.05);border-radius:0 4px 4px 0;margin-bottom:.22rem;font-size:.72rem;color:var(--text)">'
        +(a.icone?a.icone+' ':'')+esc(a.mensagem)
        +(a.valor>0?'<span style="color:var(--accent);margin-left:.45rem;font-size:.67rem">'+(typeof money==='function'?money(a.valor):a.valor)+'</span>':'')
        +'</div>';
    }).join('');

    var dia=getDia();
    var decsHtml=r.decisions.slice(0,3).map(function(d,i){
      var n=i+1;
      var jaPreenchida=dia.prios['p'+n]&&dia.prios['p'+n].trim().length>0;
      var cor=corPri[d.prioridade_label]||'var(--text3)';
      var textoSugestao=d.titulo.replace(/^[^\s]+\s/,'');
      return '<div style="display:flex;align-items:flex-start;gap:.45rem;padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:5px;margin-bottom:.22rem">'
        +'<span style="font-size:.62rem;font-weight:800;color:'+cor+';flex-shrink:0;margin-top:.1rem;min-width:26px;text-align:center;border:1px solid '+cor+';border-radius:3px;padding:.05rem .2rem">'+d.prioridade_label+'</span>'
        +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:.72rem;font-weight:600;color:var(--text);line-height:1.3">'+esc(d.titulo)+'</div>'
        +'<div style="font-size:.65rem;color:var(--text3);margin-top:.06rem;line-height:1.35">'+esc(d.descricao)+'</div>'
        +'</div>'
        +(jaPreenchida
          ?'<span style="font-size:.61rem;color:var(--text3);flex-shrink:0;margin-top:.1rem;font-style:italic">P'+n+' preenchida</span>'
          :'<button class="btn ba btn-sm" style="flex-shrink:0;font-size:.62rem;padding:.15rem .4rem" data-pn="'+n+'" data-txt="'+textoSugestao.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')+'" onclick="setPrio(+this.dataset.pn,this.dataset.txt)">→ P'+n+'</button>')
        +'</div>';
    }).join('');

    cont.innerHTML='<div style="background:rgba(88,166,255,.06);border:1px solid rgba(88,166,255,.2);border-radius:var(--r);padding:.5rem .7rem;margin-bottom:.65rem">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.3rem">'
      +'<span style="font-size:.63rem;font-weight:700;color:#79b8ff;text-transform:uppercase;letter-spacing:.07em">🧠 Motor de Decisão — sugestões para hoje</span>'
      +'<button class="nb" style="font-size:.63rem;color:var(--text3);padding:.1rem .3rem" onclick="document.getElementById(\'sugestoes-ia-dia\').style.display=\'none\'">✕</button>'
      +'</div>'
      +(alertasHtml?'<div style="margin-bottom:.35rem">'+alertasHtml+'</div>':'')
      +'<div style="font-size:.61rem;color:var(--text3);margin-bottom:.25rem;text-transform:uppercase;letter-spacing:.05em">Sugestões de prioridade</div>'
      +decsHtml
      +'</div>';
    return;
  }

  if(secId==='semana'){
    var cont=document.getElementById('sugestoes-ia-semana');
    if(!cont)return;
    if(!r||!r.weekly_focus||!r.weekly_focus.length){cont.innerHTML='';return;}

    var corPri={Alta:'var(--red)',Média:'var(--accent)',Baixa:'var(--text3)'};
    cont.innerHTML='<div style="background:rgba(240,165,0,.06);border:1px solid rgba(240,165,0,.22);border-radius:var(--r);padding:.55rem .8rem;margin-bottom:.7rem">'
      +'<div style="font-size:.63rem;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.35rem">🎯 Foco da semana — Motor de Decisão</div>'
      +r.weekly_focus.map(function(f){
        var cor={Alta:'var(--red)',Média:'var(--accent)',Baixa:'var(--text3)'}[f.prioridade_label]||'var(--text3)';
        return '<div style="display:flex;gap:.5rem;align-items:flex-start;padding:.25rem 0;border-bottom:1px solid rgba(240,165,0,.1)">'
          +'<span style="font-weight:800;color:'+cor+';flex-shrink:0;font-size:.74rem;width:16px">'+f.posicao+'.</span>'
          +'<div style="flex:1">'
          +'<div style="font-size:.73rem;font-weight:600;color:var(--text)">'+esc(f.titulo)+'</div>'
          +'<div style="font-size:.65rem;color:var(--text3);margin-top:.05rem;line-height:1.4">'+esc(f.motivo)+'</div>'
          +(f.impacto>0?'<div style="font-size:.64rem;color:var(--green);margin-top:.05rem">Impacto estimado: '+(typeof money==='function'?money(f.impacto):f.impacto)+'</div>':'')
          +'</div>'
          +'<span style="font-size:.59rem;font-weight:700;color:'+cor+';border:1px solid '+cor+';border-radius:20px;padding:.08rem .28rem;flex-shrink:0">'+f.prioridade_label+'</span>'
          +'</div>';
      }).join('')
      +'</div>';
    return;
  }

  if(secId==='mes'){
    var cont=document.getElementById('sugestoes-ia-mes');
    if(!cont)return;
    if(!r||!r.executive_items||!r.executive_items.length){cont.innerHTML='';return;}

    cont.innerHTML='<div style="background:rgba(63,185,80,.06);border:1px solid rgba(63,185,80,.22);border-radius:var(--r);padding:.55rem .8rem;margin-bottom:.7rem">'
      +'<div style="font-size:.63rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.07em;margin-bottom:.35rem">📊 Inteligência em tempo real — Motor de Decisão</div>'
      +r.executive_items.map(function(it){
        return '<div style="display:flex;gap:.45rem;align-items:baseline;padding:.18rem 0;border-bottom:1px solid rgba(63,185,80,.1);font-size:.74rem">'
          +'<span style="flex-shrink:0;width:20px;text-align:center">'+it.icone+'</span>'
          +'<span style="color:var(--text3);flex-shrink:0;min-width:115px;font-size:.67rem">'+esc(it.label)+'</span>'
          +'<span style="color:var(--text);font-weight:600">'+esc(it.valor)+'</span>'
          +'</div>';
      }).join('')
      +'</div>';
    return;
  }

  if(secId==='trimestre'){
    var cont=document.getElementById('sugestoes-ia-trim');
    if(!cont)return;
    if(!r||!r.opportunities||!r.opportunities.length){cont.innerHTML='';return;}

    cont.innerHTML='<div style="background:rgba(188,140,255,.06);border:1px solid rgba(188,140,255,.22);border-radius:var(--r);padding:.55rem .8rem;margin-bottom:.7rem">'
      +'<div style="font-size:.63rem;font-weight:700;color:#bc8cff;text-transform:uppercase;letter-spacing:.07em;margin-bottom:.35rem">💡 Oportunidades identificadas — Motor de Decisão</div>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:.4rem">'
      +r.opportunities.map(function(o){
        return '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:.38rem .55rem">'
          +'<div style="font-size:.71rem;font-weight:600;color:var(--text)">'+(o.icone?o.icone+' ':'')+esc(o.titulo)+'</div>'
          +'<div style="font-size:.66rem;color:var(--text2);margin-top:.07rem;line-height:1.35">'+esc(o.descricao)+'</div>'
          +(o.valor>0?'<div style="font-size:.69rem;font-weight:700;color:var(--accent);margin-top:.12rem">'+(typeof money==='function'?money(o.valor):o.valor)+'</div>':'')
          +'<div style="font-size:.61rem;color:var(--text3);margin-top:.04rem">'+esc(o.detalhe)+'</div>'
          +'</div>';
      }).join('')
      +'</div>'
      +'</div>';
    return;
  }
}



function toggleTheme(){

  document.body.classList.toggle('light');

  dados.theme=document.body.classList.contains('light')?'light':'dark';

  save();

}



// ===== DATA =====

function atualizarDataHoje(){

  const now=new Date();

  const dias=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];

  const meses=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  const str=`${dias[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]} de ${now.getFullYear()}`;

  var _dh=document.getElementById('data-hoje'); if(_dh)_dh.textContent=str;

  var _lbl=document.getElementById('todayLbl'); if(_lbl)_lbl.textContent=`${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

}



// ===== PRIORIDADES =====

function renderPrios(){

  const dia=getDia();

  [1,2,3].forEach(i=>{

    const inp=document.getElementById('p'+i);

    const chk=document.getElementById('pc'+i);

    const item=document.getElementById('prio-'+i);

    if(inp)inp.value=dia.prios['p'+i]||'';

    const done=dia.prios['c'+i];

    if(chk){chk.classList.toggle('checked',done);chk.textContent=done?'✓':'';}

    if(item)item.classList.toggle('done',done);

  });

  atualizarPrioPct();

}

function savePrios(){

  const dia=getDia();

  dia.prios.p1=document.getElementById('p1').value;

  dia.prios.p2=document.getElementById('p2').value;

  dia.prios.p3=document.getElementById('p3').value;

  save();

}

function togglePrio(i){

  const dia=getDia();

  dia.prios['c'+i]=!dia.prios['c'+i];

  save();renderPrios();

}

function atualizarPrioPct(){

  const dia=getDia();

  const done=[1,2,3].filter(i=>dia.prios['c'+i]&&dia.prios['p'+i]&&dia.prios['p'+i].trim()).length;

  const total=[1,2,3].filter(i=>dia.prios['p'+i]&&dia.prios['p'+i].trim()).length;

  const pct=total?Math.round(done/total*100):0;

  document.getElementById('prio-pct').textContent=pct+'%';

  document.getElementById('prio-bar').style.width=pct+'%';

  document.getElementById('prio-bar').className='prog-fill'+(pct===100?' green':'');

}



// ===== JANELAS =====

var JANELAS_DEFAULT=[

  {hora:'9h30',horaNum:9.5,lbl:'Abertura',status:'Prioridades do dia'},

  {hora:'12h00',horaNum:12,lbl:'Janela 1',status:'E-mail + Zap'},

  {hora:'17h00',horaNum:17,lbl:'Janela 2',status:'E-mail + Zap'},

  {hora:'17h30',horaNum:17.5,lbl:'Fechamento',status:'Processar anotações'}

];

function getJanelas(){return (dados.janelasConfig&&dados.janelasConfig.length)?dados.janelasConfig:JANELAS_DEFAULT;}

function parseHora(s){var p=s.replace('h',':').split(':');return parseInt(p[0])+(parseInt(p[1]||0)/60);}

function renderJanelas(){

  var wrap=document.getElementById('janelas-wrap');

  if(!wrap)return;

  var now=new Date();

  var h=now.getHours()+now.getMinutes()/60;

  var jans=getJanelas();

  wrap.innerHTML='';

  jans.forEach(function(j,i){

    var horaNum=j.horaNum!=null?j.horaNum:parseHora(j.hora);

    var ativa=Math.abs(h-horaNum)<0.5;

    var passada=h>horaNum+0.5;

    var div=document.createElement('div');

    div.className='janela'+(ativa?' ativa':passada?' passada':'');

    div.innerHTML='<div class="janela-hora">'+esc(j.hora)+'</div>'

      +'<div class="janela-lbl">'+esc(j.lbl)+'</div>'

      +'<div class="janela-status">'+(ativa?'🟢 Agora':esc(j.status))+'</div>';

    wrap.appendChild(div);

  });

}

function toggleJanelaConfig(){

  var area=document.getElementById('janela-config-area');

  if(!area)return;

  if(area.style.display==='none'){

    area.style.display='block';

    _renderJanelaConfigForm();

  } else {

    area.style.display='none';

  }

}

function _renderJanelaConfigForm(){

  var area=document.getElementById('janela-config-area');

  var jans=getJanelas();

  area.innerHTML='<div style="font-size:.72rem;font-weight:600;color:var(--text3);margin-bottom:.5rem">Configure seus horários de comunicação:</div>'

    +jans.map(function(j,i){

      return '<div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.4rem">'

        +'<input style="width:60px;padding:.28rem .4rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);font-size:.78rem;text-align:center;font-family:inherit" '

        +'id="jc-hora-'+i+'" value="'+esc(j.hora)+'" placeholder="9h30">'

        +'<input style="flex:1;padding:.28rem .5rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);font-size:.78rem;font-family:inherit" '

        +'id="jc-lbl-'+i+'" value="'+esc(j.lbl)+'" placeholder="Label">'

        +'<input style="flex:2;padding:.28rem .5rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);font-size:.78rem;font-family:inherit" '

        +'id="jc-status-'+i+'" value="'+esc(j.status)+'" placeholder="Descrição">'

        +'</div>';

    }).join('')

    +'<button class="btn bg btn-sm" style="margin-top:.25rem" onclick="saveJanelaConfig()">💾 Salvar</button>';

}

function saveJanelaConfig(){

  var jans=getJanelas().map(function(j,i){

    var hora=document.getElementById('jc-hora-'+i);

    var lbl=document.getElementById('jc-lbl-'+i);

    var status=document.getElementById('jc-status-'+i);

    if(!hora)return j;

    var horaVal=(hora.value||j.hora).trim();

    return {hora:horaVal,horaNum:parseHora(horaVal),lbl:(lbl.value||j.lbl).trim(),status:(status.value||j.status).trim()};

  });

  dados.janelasConfig=jans;

  save();

  renderJanelas();

  document.getElementById('janela-config-area').style.display='none';

  toast('Janelas de comunicação salvas!','ok');

}



// ===== ALERTAS =====

function renderAlertas(){

  const cont=document.getElementById('alertas-dia');

  cont.innerHTML='';

  const hoje=new Date();


  // Alertas críticos do Motor de Decisão
  var r=getOrRunDecisionEngine();
  if(r&&r.alerts&&r.alerts.length){
    var criticos=r.alerts.filter(function(a){return a.tipo==='critico'||a.impacto==='alto';});
    criticos.forEach(function(a){
      cont.innerHTML+='<div class="alerta danger">'+(a.icone||'⚠')
        +' <strong>Motor de Decisão:</strong> '+esc(a.mensagem)
        +(a.valor>0?' — <span style="color:var(--accent)">'+money(a.valor)+'</span>':'')
        +'</div>';
    });
  }

}



// ===== TIPOS E RESPONSÁVEIS DEFAULTS =====

const TIPOS_DEFAULT=[

  {id:'fazer',nome:'Fazer',cor:'#58a6ff'},

  {id:'mover',nome:'Mover',cor:'#f0a500'},

  {id:'construir',nome:'Construir',cor:'#3fb950'},

  {id:'admin',nome:'Administrativo',cor:'#8b949e'},

  {id:'conformidade',nome:'Conformidade',cor:'#bc8cff'}

];

const RESPS_DEFAULT=[

  {id:'eu',nome:'Eu',func:'Engenheiro'},

  {id:'filho',nome:'Meu filho',func:'Auxiliar'}

];



function getTipos(){return(dados.tiposCustom&&dados.tiposCustom.length)?dados.tiposCustom:JSON.parse(JSON.stringify(TIPOS_DEFAULT));}

function getResps(){return(dados.respsCustom&&dados.respsCustom.length)?dados.respsCustom:JSON.parse(JSON.stringify(RESPS_DEFAULT));}



let _mtPrioSel = 3; // prioridade selecionada no modal



function setPrioModal(p){

  _mtPrioSel = p;

  updatePrioGridUI();

}



function updatePrioGridUI(){

  const cores = ['#f85149','#f0a500','#e3702a','var(--border2)'];

  const bgs   = ['#f8514922','#f0a50022','#e3702a22','transparent'];

  [0,1,2,3].forEach(i=>{

    const el = document.getElementById('mt-pq'+i);

    if(!el) return;

    if(i === _mtPrioSel){

      el.style.borderColor = cores[i];

      el.style.background  = bgs[i];

    } else {

      el.style.borderColor = 'var(--border)';

      el.style.background  = 'transparent';

    }

  });

}



function popularSelectTipo(){

  const sel=document.getElementById('mt-tipo');if(!sel)return;

  const val=sel.value;sel.innerHTML='';

  getTipos().forEach(t=>{

    const o=document.createElement('option');o.value=t.id;o.textContent=t.nome;sel.appendChild(o);

  });

  if(val)sel.value=val;

}

function popularSelectResp(){

  const sel=document.getElementById('mt-resp');if(!sel)return;

  const val=sel.value;sel.innerHTML='';

  getResps().forEach(r=>{

    const o=document.createElement('option');o.value=r.id;o.textContent=r.nome+(r.func?' — '+r.func:'');sel.appendChild(o);

  });

  if(val)sel.value=val;

}



// ===== TAREFAS =====

let tarefaEditIdx=-1;



function renderTarefas(){

  const list=document.getElementById('tarefas-dia-list');

  if(!list)return;

  const _dia=getDia();

  if(!_dia.tarefas.length){

    list.innerHTML='<div class="empty">Nenhuma tarefa ainda</div>';return;

  }

  list.innerHTML='';

  const tipos=getTipos();

  const resps=getResps();

  const hoje=new Date();

  _dia.tarefas.forEach((t,i)=>{

    const tipo=tipos.find(x=>x.id===t.tipo)||{nome:t.tipo,cor:'#8b949e'};

    const resp=resps.find(x=>x.id===t.resp)||{nome:t.resp||'—'};

    // Gantt info

    let ganttHTML='';

    if(t.inicio&&t.fim){

      const ini=new Date(t.inicio+'T12:00:00');

      const fim=new Date(t.fim+'T12:00:00');

      const prog=parseInt(t.progresso)||0;

      const total=fim-ini||1;

      const passado=Math.max(0,Math.min(hoje-ini,total));

      const tempoPercent=Math.round((passado/total)*100);

      const diasTotal=Math.round((fim-ini)/86400000)+1;

      const atrasado=hoje>fim&&prog<100;

      const fimStr=fim.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});

      const iniStr=ini.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});

      const durLabel=t.durTipo==='horas'?`${t.duracao}h`:`${diasTotal}d`;

      ganttHTML=`<div style="margin-top:.4rem">

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.2rem">

          <span style="font-size:.63rem;color:var(--text3)">${iniStr} → ${fimStr} · ${durLabel}</span>

          <span style="font-size:.63rem;font-weight:700;color:${atrasado?'var(--red)':prog===100?'var(--green)':'var(--accent)'}">${prog}%${atrasado?' ⚠ Atrasado':''}</span>

        </div>

        <div style="height:5px;background:var(--border);border-radius:3px;overflow:hidden;position:relative">

          <div style="position:absolute;height:100%;background:${atrasado?'var(--red)':prog===100?'var(--green)':'var(--accent)'};width:${prog}%;border-radius:3px;transition:width .3s"></div>

          ${tempoPercent>0&&tempoPercent<100?`<div style="position:absolute;height:100%;width:${tempoPercent}%;border-right:1.5px dashed rgba(255,255,255,.4)"></div>`:''}

        </div>

      </div>`;

    } else if(t.prazo){

      const venc=new Date(t.prazo+'T12:00:00');

      const diff=Math.ceil((venc-hoje)/86400000);

      const cor=diff<0?'var(--red)':diff<=3?'var(--orange)':'var(--text3)';

      ganttHTML=`<div style="font-size:.63rem;color:${cor};margin-top:.2rem">📅 ${diff<0?`Venceu há ${Math.abs(diff)}d`:diff===0?'Vence hoje':`Vence em ${diff}d`}</div>`;

    }

    const div=document.createElement('div');

    div.className='task-item'+(t.done?' done':'');

    div.innerHTML=`<div class="task-check${t.done?' checked':''}" onclick="toggleTarefa(${i})">${t.done?'✓':''}</div>

    <div class="task-body">

      <div class="task-txt">${t.txt}${t.obs?`<span style="font-size:.72rem;color:var(--text3);margin-left:.4rem">· ${t.obs}</span>`:''}</div>

      <div class="task-meta">

        <span class="bdg" style="background:${tipo.cor}22;color:${tipo.cor}">${tipo.nome}</span>

        <span class="bdg b-muted">${resp.nome}</span>

        ${(()=>{const p=getPrioTarefa(t);return p===0?'<span class="bdg" style="background:rgba(248,81,73,.15);color:#f85149">🔴 Urgente+Importante</span>':p===1?'<span class="bdg" style="background:rgba(248,81,73,.1);color:#f85149">Urgente</span>':p===2?'<span class="bdg" style="background:rgba(227,112,42,.1);color:#e3702a">Importante</span>':''})()}

        ${t._migrada?'<span class="bdg b-muted" title="Migrada do dia anterior">↩</span>':''}

      </div>

      ${ganttHTML}

    </div>

    <div class="task-menu-wrap">

      <button class="task-menu-btn" onclick="toggleTaskMenu(event,${i})">⋯</button>

      <div class="task-dropdown" id="task-dd-${i}">

        <button class="task-dd-item" onclick="closeAllMenus();editarTarefa(${i})">✏️ &nbsp;Editar</button>

        <button class="task-dd-item" onclick="closeAllMenus();duplicarTarefa(${i})">⧉ &nbsp;Duplicar</button>

        <div class="task-dd-sep"></div>

        <button class="task-dd-item red" onclick="closeAllMenus();delTarefa(${i})">✕ &nbsp;Excluir</button>

      </div>

    </div>`;

    list.appendChild(div);

  });

}

function toggleTarefa(i){const _d=getDia();_d.tarefas[i].done=!_d.tarefas[i].done;save();renderTarefas();}

function delTarefa(i){const _d=getDia();_d.tarefas.splice(i,1);save();renderTarefas();}

function duplicarTarefa(i){

  const _d=getDia();

  const copia=Object.assign({},_d.tarefas[i],{done:false,txt:_d.tarefas[i].txt+' (cópia)',_migrada:false});

  _d.tarefas.splice(i+1,0,copia);

  save();renderTarefas();toast('Tarefa duplicada');

}

function toggleTaskMenu(e,i){

  e.stopPropagation();

  closeAllMenus();

  const dd=document.getElementById('task-dd-'+i);

  if(dd)dd.classList.toggle('open');

}

function closeAllMenus(){

  document.querySelectorAll('.task-dropdown.open').forEach(d=>d.classList.remove('open'));

}

document.addEventListener('click',closeAllMenus);

function calcularFimTarefa(){

  const inicio=document.getElementById('mt-inicio').value;

  const dur=parseInt(document.getElementById('mt-duracao').value)||0;

  const tipo=document.getElementById('mt-dur-tipo').value;

  const preview=document.getElementById('mt-gantt-preview');

  const resumo=document.getElementById('mt-gantt-resumo');

  const prog=parseInt(document.getElementById('mt-progresso').value)||0;

  if(!inicio||!dur){

    document.getElementById('mt-fim').value='';

    preview.style.display='none';resumo.style.display='none';return;

  }

  const ini=new Date(inicio+'T12:00:00');

  let fim;

  if(tipo==='dias'){

    fim=new Date(ini);fim.setDate(fim.getDate()+dur-1);

  } else {

    fim=new Date(ini);fim.setHours(fim.getHours()+dur);

  }

  const fimStr=fim.toISOString().split('T')[0];

  document.getElementById('mt-fim').value=fimStr;

  // preview gantt

  document.getElementById('mt-gantt-bar').style.width=prog+'%';

  preview.style.display='block';

  const hoje=new Date();

  const total=fim-ini;

  const passado=Math.min(hoje-ini,total);

  const diasTotal=tipo==='dias'?dur:Math.round(dur/8);

  resumo.style.display='block';

  resumo.innerHTML=`Início: ${ini.toLocaleDateString('pt-BR')} → Fim: ${fim.toLocaleDateString('pt-BR')} · ${diasTotal} dia${diasTotal!==1?'s':''} · ${prog}% concluído`;

}



function salvarTarefa(){

  const txt=document.getElementById('mt-txt').value.trim();

  if(!txt)return;

  const exploIdx=document.getElementById('m-tarefa').dataset.exploIdx;

  const _prio=(_exploModalQueue.length>0&&exploIdx!==undefined&&exploIdx!=='')?(_exploModalQueue[parseInt(exploIdx)]?._prio??3):_mtPrioSel;

  const t={

    txt,

    tipo:document.getElementById('mt-tipo').value,

    resp:document.getElementById('mt-resp').value,

    prazo:document.getElementById('mt-fim').value||document.getElementById('mt-inicio').value,

    inicio:document.getElementById('mt-inicio').value,

    fim:document.getElementById('mt-fim').value,

    duracao:document.getElementById('mt-duracao').value,

    durTipo:document.getElementById('mt-dur-tipo').value,

    progresso:document.getElementById('mt-progresso').value,

    obs:document.getElementById('mt-obs').value,

    _prio,

    done:false

  };

  const _sd=getDia();

  if(tarefaEditIdx>=0){

    t.done=_sd.tarefas[tarefaEditIdx].done;

    _sd.tarefas[tarefaEditIdx]=t;

    toast('Tarefa atualizada');

    fecharModal('m-tarefa');

  } else {

    _sd.tarefas.push(t);

    // Se veio de fila de explosão, avança para próxima

    if(_exploModalQueue.length>0&&exploIdx!==undefined&&exploIdx!==''){

      _exploModalIdx++;

      if(_exploModalIdx<_exploModalQueue.length){

        save();ordenarTarefasCEO();renderTarefas();

        abrirProximoModalExplosao();

        toast(`Tarefa ${_exploModalIdx}/${_exploModalQueue.length} salva`);

        return;

      } else {

        _exploModalQueue=[];_exploModalIdx=0;

        document.getElementById('m-tarefa').dataset.exploIdx='';

        toast('✅ Todas as tarefas criadas');

      }

    } else {

      toast('Tarefa adicionada');

    }

    fecharModal('m-tarefa');

  }

  ordenarTarefasCEO();

  save();renderTarefas();

}



function editarTarefa(i){

  tarefaEditIdx=i;

  const t=getDia().tarefas[i];

  document.getElementById('mt-titulo-modal').textContent='Editar Tarefa';

  document.getElementById('mt-btn-salvar').textContent='Salvar';

  popularSelectTipo();popularSelectResp();

  document.getElementById('mt-txt').value=t.txt||'';

  document.getElementById('mt-inicio').value=t.inicio||t.prazo||'';

  document.getElementById('mt-fim').value=t.fim||t.prazo||'';

  document.getElementById('mt-duracao').value=t.duracao||'';

  document.getElementById('mt-obs').value=t.obs||'';

  document.getElementById('mt-progresso').value=t.progresso||0;

  document.getElementById('mt-prog-val').textContent=(t.progresso||0)+'%';

  _mtPrioSel=t._prio!==undefined?t._prio:3;

  setTimeout(()=>{

    document.getElementById('mt-tipo').value=t.tipo||'fazer';

    document.getElementById('mt-resp').value=t.resp||'eu';

    if(t.durTipo)document.getElementById('mt-dur-tipo').value=t.durTipo;

    calcularFimTarefa();

    updatePrioGridUI();

  },10);

  abrirModal('m-tarefa');

}



function abrirModalTarefa(){

  tarefaEditIdx=-1;

  _exploModalQueue=[];_exploModalIdx=0;

  document.getElementById('m-tarefa').dataset.exploIdx='';

  document.getElementById('mt-titulo-modal').textContent='Nova Tarefa';

  document.getElementById('mt-btn-salvar').textContent='Adicionar';

  document.getElementById('mt-txt').value='';

  document.getElementById('mt-inicio').value='';

  document.getElementById('mt-fim').value='';

  document.getElementById('mt-duracao').value='';

  document.getElementById('mt-obs').value='';

  document.getElementById('mt-progresso').value=0;

  document.getElementById('mt-prog-val').textContent='0%';

  document.getElementById('mt-gantt-preview').style.display='none';

  document.getElementById('mt-gantt-resumo').style.display='none';

  _mtPrioSel=3;

  popularSelectTipo();popularSelectResp();

  setTimeout(updatePrioGridUI,10);

  abrirModal('m-tarefa');

}



// ===== TIPOS CUSTOM =====

function addTipoCustom(){

  const nome=document.getElementById('tipo-nome-input').value.trim();

  if(!nome)return;

  if(!dados.tiposCustom||!dados.tiposCustom.length)dados.tiposCustom=JSON.parse(JSON.stringify(TIPOS_DEFAULT));

  const id='tipo_'+Date.now();

  const cor=document.getElementById('tipo-cor-input').value;

  dados.tiposCustom.push({id,nome,cor});

  save();renderTiposModal();

  document.getElementById('tipo-nome-input').value='';

  toast('Tipo criado: '+nome);

}

function delTipoCustom(id){

  if(!dados.tiposCustom)return;

  dados.tiposCustom=dados.tiposCustom.filter(t=>t.id!==id);

  save();renderTiposModal();

}

function editarTipoInline(id){

  if(!dados.tiposCustom||!dados.tiposCustom.length)dados.tiposCustom=JSON.parse(JSON.stringify(TIPOS_DEFAULT));

  const t=dados.tiposCustom.find(x=>x.id===id);

  if(!t)return;

  const novoNome=prompt('Novo nome para "'+t.nome+'":', t.nome);

  if(!novoNome||!novoNome.trim())return;

  t.nome=novoNome.trim();

  save();renderTiposModal();popularSelectTipo();

  toast('Tipo renomeado: '+t.nome);

}

function renderTiposModal(){

  const list=document.getElementById('tipos-list-modal');if(!list)return;

  list.innerHTML='';

  getTipos().forEach(t=>{

    const div=document.createElement('div');

    div.className='task-item';div.style.marginBottom='.3rem';

    div.innerHTML=`<span style="width:12px;height:12px;border-radius:50%;background:${t.cor};flex-shrink:0;display:inline-block;margin-top:2px"></span>

    <div class="task-body"><div class="task-txt">${t.nome}</div></div>

    <button class="task-del" style="color:var(--blue);opacity:.7;margin-right:2px" onclick="editarTipoInline('${t.id}')" title="Renomear">✏</button>

    <button class="task-del" onclick="delTipoCustom('${t.id}')" title="Excluir">✕</button>`;

    list.appendChild(div);

  });

}



// ===== RESPONSÁVEIS CUSTOM =====

function addRespCustom(){

  const nome=document.getElementById('resp-nome-input').value.trim();

  if(!nome)return;

  if(!dados.respsCustom||!dados.respsCustom.length)dados.respsCustom=JSON.parse(JSON.stringify(RESPS_DEFAULT));

  const id='resp_'+Date.now();

  const func=document.getElementById('resp-func-input').value.trim();

  dados.respsCustom.push({id,nome,func});

  save();renderRespsModal();

  document.getElementById('resp-nome-input').value='';

  document.getElementById('resp-func-input').value='';

  toast('Responsável cadastrado: '+nome);

}

function delRespCustom(id){

  if(!dados.respsCustom||!dados.respsCustom.length)dados.respsCustom=JSON.parse(JSON.stringify(RESPS_DEFAULT));

  dados.respsCustom=dados.respsCustom.filter(r=>r.id!==id);

  save();renderRespsModal();

}

function renderRespsModal(){

  const list=document.getElementById('resps-list-modal');if(!list)return;

  list.innerHTML='';

  getResps().forEach(r=>{

    const div=document.createElement('div');

    div.className='task-item';div.style.marginBottom='.3rem';

    div.innerHTML=`<div class="task-body">

      <div class="task-txt">${r.nome}</div>

      ${r.func?`<div style="font-size:.7rem;color:var(--text3)">${r.func}</div>`:''}

    </div>

    <button class="task-del" style="color:var(--blue);opacity:.7;margin-right:2px" onclick="editarRespInline('${r.id}')" title="Editar">✏</button>

    <button class="task-del" onclick="delRespCustom('${r.id}')" title="Excluir">✕</button>`;

    list.appendChild(div);

  });

}

function editarRespInline(id){

  if(!dados.respsCustom||!dados.respsCustom.length)dados.respsCustom=JSON.parse(JSON.stringify(RESPS_DEFAULT));

  const r=dados.respsCustom.find(x=>x.id===id);

  if(!r)return;

  const novoNome=prompt('Novo nome para "'+r.nome+'":', r.nome);

  if(!novoNome||!novoNome.trim())return;

  const novaFunc=prompt('Função:', r.func||'');

  r.nome=novoNome.trim();

  r.func=(novaFunc||'').trim();

  save();renderRespsModal();popularSelectResp();

  toast('Responsável atualizado');

}



function formatData(str){

  if(!str)return'';

  const d=new Date(str+'T12:00:00');

  return d.getDate()+'/'+(d.getMonth()+1);

}



// ===== DESTINOS DA EXPLOSÃO =====

const DESTINOS_DEFAULT=[

  {id:'eu',nome:'Eu',cor:'#58a6ff',tipo:'pessoa'},

  {id:'filho',nome:'Filho',cor:'#3fb950',tipo:'pessoa'},

  {id:'adriano',nome:'Adriano',cor:'#bc8cff',tipo:'pessoa'},

  {id:'bitrix',nome:'Bitrix',cor:'#f0a500',tipo:'sistema'},

  {id:'urgente',nome:'Urgente',cor:'#f85149',tipo:'urgente'},

  {id:'importante',nome:'Importante',cor:'#e3702a',tipo:'importante'}

];

function getDestinos(){return(dados.destinosCustom&&dados.destinosCustom.length)?dados.destinosCustom:JSON.parse(JSON.stringify(DESTINOS_DEFAULT));}



function addDestinoCustom(){

  const nome=document.getElementById('dest-nome-input').value.trim();

  if(!nome)return;

  if(!dados.destinosCustom||!dados.destinosCustom.length)dados.destinosCustom=JSON.parse(JSON.stringify(DESTINOS_DEFAULT));

  dados.destinosCustom.push({id:'dest_'+Date.now(),nome,cor:document.getElementById('dest-cor-input').value,tipo:document.getElementById('dest-tipo-input').value});

  save();renderDestinosModal();document.getElementById('dest-nome-input').value='';

  toast('Destino criado: '+nome);

}

function delDestinoCustom(id){

  if(!dados.destinosCustom)return;

  dados.destinosCustom=dados.destinosCustom.filter(d=>d.id!==id);

  save();renderDestinosModal();

}

function renderDestinosModal(){

  const list=document.getElementById('destinos-list-modal');if(!list)return;

  list.innerHTML='';

  getDestinos().forEach(d=>{

    const isDefault=DESTINOS_DEFAULT.some(x=>x.id===d.id);

    const div=document.createElement('div');

    div.className='task-item';div.style.marginBottom='.3rem';

    const tipoLabel={pessoa:'Pessoa',urgente:'Urgente',importante:'Importante',sistema:'Sistema'}[d.tipo]||d.tipo;

    div.innerHTML=`<span style="width:10px;height:10px;border-radius:50%;background:${d.cor};flex-shrink:0;display:inline-block"></span>

    <div class="task-body"><div class="task-txt">${d.nome} <span style="font-size:.65rem;color:var(--text3)">· ${tipoLabel}</span></div></div>

    ${!isDefault?`<button class="task-del" onclick="delDestinoCustom('${d.id}')">✕</button>`:'<span style="font-size:.65rem;color:var(--text3);padding:.1rem .4rem">padrão</span>'}`;

    list.appendChild(div);

  });

}



// ===== EXPLOSÃO =====

function addExplosao(){

  const inp=document.getElementById('explo-input');

  const txt=inp.value.trim();

  if(!txt)return;

  getDia().explosoes.push({txt,dest:null,sels:[]});

  save();renderExplosoes();inp.value='';

}



function toggleDestinoExplosao(i,destId,btn){

  const _ted=getDia();if(!_ted.explosoes[i].sels)_ted.explosoes[i].sels=[];

  const idx=_ted.explosoes[i].sels.indexOf(destId);

  if(idx>=0){_ted.explosoes[i].sels.splice(idx,1);btn.classList.remove('sel');}

  else{_ted.explosoes[i].sels.push(destId);btn.classList.add('sel');}

}



function confirmarExplosao(i){

  const e=getDia().explosoes[i];

  const sels=e.sels||[];

  if(!sels.length){toast('Selecione ao menos um destino');return;}

  const destinos=getDestinos();



  const pessoas=sels.map(id=>destinos.find(d=>d.id===id)).filter(d=>d&&d.tipo==='pessoa');

  const isUrgente=sels.some(id=>destinos.find(d=>d.id===id&&d.tipo==='urgente'));

  const isImportante=sels.some(id=>destinos.find(d=>d.id===id&&d.tipo==='importante'));



  let tipo='fazer';

  let obs='';

  let prefixo='';

  let _prio=3;

  if(isUrgente&&isImportante){prefixo='🔴';obs='URGENTE + IMPORTANTE';tipo='fazer';_prio=0;}

  else if(isUrgente){prefixo='🔴';obs='URGENTE';tipo='fazer';_prio=1;}

  else if(isImportante){prefixo='🟠';obs='IMPORTANTE';tipo='construir';_prio=2;}



  const resps=pessoas.length>0?pessoas.map(p=>p.id):['eu'];



  // Marcar explosão como processada

  const _eDia=getDia();

  if(_eDia.explosoes[i])_eDia.explosoes[i].dest='processado';

  save();renderExplosoes();



  // Abrir modal de edição para cada responsável em sequência

  _exploModalQueue=resps.map(respId=>({

    txt:(prefixo?prefixo+' ':'')+e.txt,

    tipo,resp:respId,obs,_prio,done:false

  }));

  _exploModalIdx=0;

  abrirProximoModalExplosao();

}



let _exploModalQueue=[];

let _exploModalIdx=0;



function abrirProximoModalExplosao(){

  if(_exploModalIdx>=_exploModalQueue.length)return;

  const t=_exploModalQueue[_exploModalIdx];

  const resps=getResps();

  const resp=resps.find(r=>r.id===t.resp);

  const total=_exploModalQueue.length;

  const atual=_exploModalIdx+1;



  tarefaEditIdx=-1;

  document.getElementById('mt-titulo-modal').textContent=

    total>1?`Nova Tarefa ${atual}/${total} — ${resp?resp.nome:t.resp}`:'Nova Tarefa';

  document.getElementById('mt-btn-salvar').textContent= total>1&&atual<total?'Salvar e próxima ›':'Salvar';

  document.getElementById('mt-txt').value=t.txt||'';

  document.getElementById('mt-inicio').value='';

  document.getElementById('mt-fim').value='';

  document.getElementById('mt-duracao').value='';

  document.getElementById('mt-obs').value=t.obs||'';

  document.getElementById('mt-progresso').value=0;

  document.getElementById('mt-prog-val').textContent='0%';

  document.getElementById('mt-gantt-preview').style.display='none';

  document.getElementById('mt-gantt-resumo').style.display='none';

  popularSelectTipo();popularSelectResp();

  setTimeout(()=>{

    document.getElementById('mt-tipo').value=t.tipo||'fazer';

    document.getElementById('mt-resp').value=t.resp||'eu';

  },10);

  // Guardar _prio atual para usar ao salvar

  document.getElementById('m-tarefa').dataset.exploIdx=_exploModalIdx;

  abrirModal('m-tarefa');

}



function ordenarTarefasCEO(){

  // Prioridade: 0=Urgente+Importante, 1=Urgente, 2=Importante, 3=Normal

  // Dentro de cada grupo: tarefas não feitas primeiro, depois por prazo

  const hoje=new Date();

  const _od=getDia();_od.tarefas.sort((a,b)=>{

    if(a.done!==b.done)return a.done?1:-1;

    const pa=getPrioTarefa(a);

    const pb=getPrioTarefa(b);

    if(pa!==pb)return pa-pb;

    // Mesmo nível: ordem por prazo mais próximo

    const da=a.fim||a.prazo?new Date((a.fim||a.prazo)+'T12:00:00'):null;

    const db=b.fim||b.prazo?new Date((b.fim||b.prazo)+'T12:00:00'):null;

    if(da&&db)return da-db;

    if(da)return-1;

    if(db)return 1;

    return 0;

  });

}



function getPrioTarefa(t){

  if(t._prio!==undefined)return t._prio;

  const obs=(t.obs||'').toUpperCase();

  const txt=(t.txt||'').toUpperCase();

  if(obs.includes('URGENTE')&&obs.includes('IMPORTANTE'))return 0;

  if(txt.includes('🔴')&&(obs.includes('IMPORTANTE')||txt.includes('IMPORTANTE')))return 0;

  if(obs.includes('URGENTE')||txt.includes('🔴'))return 1;

  if(obs.includes('IMPORTANTE')||txt.includes('🟠'))return 2;

  return 3;

}



function renderExplosoes(){

  const list=document.getElementById('explo-list');

  if(!list)return;

  const _ded=getDia();

  const pendentes=_ded.explosoes.filter(e=>!e.dest);

  if(!pendentes.length){list.innerHTML='<div class="empty">Nenhuma anotação pendente</div>';return;}

  list.innerHTML='';

  const destinos=getDestinos();

  _ded.explosoes.forEach((e,i)=>{

    if(e.dest)return;

    if(!e.sels)e.sels=[];

    const div=document.createElement('div');

    div.className='explo-item';

    const btns=destinos.map(d=>{

      const isSel=e.sels.includes(d.id);

      return`<button class="explo-btn${isSel?' sel':''}" style="border-color:${d.cor}${isSel?'':' 55'};color:${d.cor}" onclick="toggleDestinoExplosao(${i},'${d.id}',this)">${d.nome}</button>`;

    }).join('');

    div.innerHTML=`

      <div class="explo-item-top">

        <div class="explo-txt">${e.txt}</div>

        <button class="explo-del" onclick="delExplosao(${i})">✕</button>

      </div>

      <div class="explo-actions">${btns}</div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:.4rem">

        <span style="font-size:.65rem;color:var(--text3)" id="explo-sel-${i}">${e.sels.length?e.sels.map(id=>{const d=destinos.find(x=>x.id===id);return d?d.nome:id;}).join(' + '):'Selecione os destinos acima'}</span>

        <button class="explo-ok" onclick="confirmarExplosao(${i})">✓ OK</button>

      </div>`;

    list.appendChild(div);

  });

}



function delExplosao(i){getDia().explosoes.splice(i,1);save();renderExplosoes();}





// ===== ABERTOS =====

function addAberto(){

  const inp=document.getElementById('aberto-input');

  const txt=inp.value.trim();

  if(!txt)return;

  getDia().abertos.push({txt,done:false});

  save();renderAbertos();inp.value='';

}

function renderAbertos(){

  const list=document.getElementById('abertos-list');list.innerHTML='';

  const _abd=getDia();

  if(!_abd.abertos.length){list.innerHTML='';return;}

  _abd.abertos.forEach((a,i)=>{

    const div=document.createElement('div');

    div.className='task-item'+(a.done?' done':'');

    div.style.marginBottom='.3rem';

    div.innerHTML=`<div class="task-check${a.done?' checked':''}" onclick="toggleAberto(${i})">${a.done?'✓':''}</div>

    <div class="task-body"><div class="task-txt">${a.txt}</div></div>

    <button class="task-del" onclick="delAberto(${i})">✕</button>`;

    list.appendChild(div);

  });

}

function toggleAberto(i){const _ab=getDia();_ab.abertos[i].done=!_ab.abertos[i].done;save();renderAbertos();}

function delAberto(i){getDia().abertos.splice(i,1);save();renderAbertos();}

function saveReflexao(){getDia().reflexao=document.getElementById('reflexao-dia').value;save();}



// ===== SEMANA =====

var SEMANA_DEFAULT=[

  [{tipo:'fazer',txt:'Foco — Proposta'},{tipo:'mover',txt:'Visita / Campo'}],

  [{tipo:'mover',txt:'Visitas / Campo'},{tipo:'mover',txt:'Reuniões / Follow-up'}],

  [{tipo:'fazer',txt:'Foco — Proposta'},{tipo:'mover',txt:'Visita / Campo'}],

  [{tipo:'mover',txt:'Visitas / Campo'},{tipo:'mover',txt:'Cliente fixo'}],

  [{tipo:'fazer',txt:'Proposta — manhã'},{tipo:'construir',txt:'CEO — tarde'}]

];

var _semanaEditando=false;

function getSemanaConfig(){return (dados.semanaConfig&&dados.semanaConfig.length)?dados.semanaConfig:SEMANA_DEFAULT;}

function toggleSemanaEdit(){

  _semanaEditando=!_semanaEditando;

  var btn=document.getElementById('btn-semana-edit');

  if(btn)btn.textContent=_semanaEditando?'💾 Salvar':'✏️ Editar';

  if(!_semanaEditando) saveSemanaConfig();

  renderSemana();

}

function saveSemanaConfig(){

  var blocos=getSemanaConfig();

  var novo=blocos.map(function(dia,i){

    return dia.map(function(b,j){

      var inp=document.getElementById('se-'+i+'-'+j);

      var sel=document.getElementById('se-tipo-'+i+'-'+j);

      return {tipo:sel?sel.value:b.tipo,txt:inp?inp.value.trim():b.txt};

    });

  });

  dados.semanaConfig=novo;

  save();

  _semanaEditando=false;

  var btn=document.getElementById('btn-semana-edit');

  if(btn)btn.textContent='✏️ Editar';

  toast('Semana salva!','ok');

}

function renderSemana(){

  const grid=document.getElementById('week-grid');grid.innerHTML='';

  const now=new Date();

  const dow=now.getDay();

  const monday=new Date(now);

  monday.setDate(now.getDate()-(dow===0?6:dow-1));

  const dias=['Seg','Ter','Qua','Qui','Sex'];

  const blocos=getSemanaConfig();

  for(let i=0;i<5;i++){

    const d=new Date(monday);d.setDate(monday.getDate()+i);

    const isToday=d.toDateString()===now.toDateString();

    const div=document.createElement('div');

    div.className='week-day'+(isToday?' today':'');

    let blHTML='';

    (blocos[i]||[]).forEach(function(b,j){

      const cls='wd-'+b.tipo;

      if(_semanaEditando){

        var tipoOpts=['fazer','mover','construir'].map(function(t){

          var labels={fazer:'Ação — Fazer',mover:'Ação — Se Mover',construir:'Ação — Construir/Crescer'};

          return '<option value="'+t+'"'+(b.tipo===t?' selected':'')+'>'+labels[t]+'</option>';

        }).join('');

        blHTML+='<div class="wd-block '+cls+'" style="padding:.2rem;gap:.2rem;flex-direction:column;align-items:stretch">'

          +'<select id="se-tipo-'+i+'-'+j+'" onchange="this.closest(\'.wd-block\').className=\'wd-block wd-\'+this.value" style="width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.65rem;padding:.15rem .3rem;font-family:inherit;margin-bottom:.2rem">'+tipoOpts+'</select>'

          +'<input id="se-'+i+'-'+j+'" style="width:100%;background:transparent;border:none;border-bottom:1px solid var(--accent);color:var(--text);font-size:.72rem;font-family:inherit;outline:none;padding:.1rem 0" value="'+esc(b.txt)+'">'

          +'</div>';

      } else {

        blHTML+='<div class="wd-block '+cls+'">'+esc(b.txt)+'</div>';

      }

    });

    div.innerHTML='<div class="wd-hdr"><span class="wd-name">'+dias[i]+'</span><span class="wd-date">'+d.getDate()+'/'+(d.getMonth()+1)+'</span></div><div class="wd-body">'+blHTML+'</div>';

    grid.appendChild(div);

  }

  const monday2=new Date(monday);

  const friday=new Date(monday2);friday.setDate(monday2.getDate()+4);

  const meses=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  document.getElementById('semana-periodo').textContent=`${monday2.getDate()} ${meses[monday2.getMonth()]} — ${friday.getDate()} ${meses[friday.getMonth()]}`;

}



// ===== CICLOS — auto-pull de Visão Executiva (window.props) =====

function renderCiclos(){

  var elNeg=document.getElementById('ciclos-negociacao');
  var elExe=document.getElementById('ciclos-execucao');
  if(!elNeg&&!elExe)return;

  var FAS_EXE=['aprovado','taf','sat','atrasado','em_pausa_falta_material','em_pausa_aguardando_cliente','em_pausa_aguardando_terceiro'];

  var FASE_LABEL={
    aprovado:{n:'Aprovado',c:'var(--green)'},
    taf:{n:'TAF',c:'var(--blue)'},
    sat:{n:'SAT',c:'var(--blue)'},
    atrasado:{n:'Atrasado',c:'var(--red)'},
    em_pausa_falta_material:{n:'Pausa — Material',c:'var(--accent)'},
    em_pausa_aguardando_cliente:{n:'Pausa — Cliente',c:'var(--accent)'},
    em_pausa_aguardando_terceiro:{n:'Pausa — Terceiro',c:'var(--accent)'}
  };

  var all=window.props||[];
  var negoc=all.filter(function(p){return p.fas==='andamento';})
               .sort(function(a,b){return (b.val||0)-(a.val||0);});
  var exec=all.filter(function(p){return FAS_EXE.indexOf(p.fas)>=0;})
              .sort(function(a,b){
                // atrasado primeiro, depois por valor
                var aAtr=p.fas==='atrasado'?0:1; // note: intentional closure over loop var not used; use a/b
                var aOrd=a.fas==='atrasado'?0:1;
                var bOrd=b.fas==='atrasado'?0:1;
                if(aOrd!==bOrd) return aOrd-bOrd;
                return (b.val||0)-(a.val||0);
              });

  function itemHtml(p, showBadge){
    var badgeHtml='';
    if(showBadge && FASE_LABEL[p.fas]){
      var fl=FASE_LABEL[p.fas];
      badgeHtml='<span style="font-size:.6rem;font-weight:700;color:'+fl.c+';background:'+fl.c+'22;border:1px solid '+fl.c+'55;border-radius:3px;padding:.1rem .35rem;margin-top:.2rem;display:inline-block">'+fl.n+'</span>';
    }
    return '<div class="ciclo-item">'
      +'<div class="ciclo-num">'+esc(p.num||'')+'</div>'
      +'<div class="ciclo-body">'
      +'<div style="font-size:.82rem;font-weight:700;color:var(--text);line-height:1.3">'+esc(p.tit||'')+'</div>'
      +'<div style="font-size:.68rem;color:var(--text3);margin-top:.05rem">'+esc(p.cli||p.loc||'')+'</div>'
      +badgeHtml
      +'</div>'
      +'<div style="text-align:right;flex-shrink:0">'
      +(p.val?'<div style="font-size:.68rem;color:var(--green)">R$ '+Number(p.val).toLocaleString('pt-BR')+'</div>':'')
      +'</div>'
      +'</div>';
  }

  function secLabel(icon, titulo, cor){
    return '<div style="font-size:.63rem;font-weight:700;color:'+cor+';text-transform:uppercase;letter-spacing:.06em;padding:.5rem .1rem .3rem;border-bottom:1px solid var(--border);margin-bottom:.35rem">'+icon+' '+titulo+'</div>';
  }

  if(elNeg){
    elNeg.innerHTML= negoc.length
      ? secLabel('🤝','Em Negociação','var(--accent)')+negoc.map(function(p){return itemHtml(p,false);}).join('')
      : secLabel('🤝','Em Negociação','var(--text3)')+'<div class="empty" style="padding:.5rem 0;font-size:.75rem">Nenhuma proposta em negociação</div>';
  }

  if(elExe){
    elExe.innerHTML= exec.length
      ? secLabel('🔧','Em Execução','var(--blue)')+exec.map(function(p){return itemHtml(p,true);}).join('')
      : secLabel('🔧','Em Execução','var(--text3)')+'<div class="empty" style="padding:.5rem 0;font-size:.75rem">Nenhuma proposta em execução</div>';
  }

}



// ===== FOLLOWUPS — auto-pull de window.props (pendentes por valor) =====

function renderFollowups(){

  var list=document.getElementById('followups-list');

  if(!list)return;

  var EXCLUIR=['finalizado','aprovado','perdido','virou_budget','perdido_valor_alto','perdido_concorrente','perdido_cliente_decidiu_nao_fazer','perdido_fazer_no_futuro'];

  var ps=(window.props||[]).filter(function(p){ return EXCLUIR.indexOf(p.fas)<0; });

  // Ordenar por valor decrescente (prioridade)
  ps=ps.slice().sort(function(a,b){ return (b.val||0)-(a.val||0); });

  if(!ps.length){list.innerHTML='<div class="empty">Nenhum follow-up pendente</div>';return;}

  // Índice de historico por proposta_id (mais recente primeiro)
  var hist=(typeof window.getHistoricoData==='function')?window.getHistoricoData():[];
  var histIdx={};
  hist.forEach(function(h){
    if(!h.proposta_id) return;
    if(!histIdx[h.proposta_id]) histIdx[h.proposta_id]=[];
    histIdx[h.proposta_id].push(h);
  });
  Object.keys(histIdx).forEach(function(k){
    histIdx[k].sort(function(a,b){ return new Date(b.data)-new Date(a.data); });
  });

  list.innerHTML='';

  // Calcular valor máximo para barra de prioridade visual
  var maxVal=ps[0]?ps[0].val||0:0;
  var hoje=new Date(); hoje.setHours(0,0,0,0);

  function diasDiff(dataStr){
    var d=new Date(dataStr); d.setHours(0,0,0,0);
    return Math.round((hoje-d)/(1000*60*60*24));
  }

  function fmtData(dataStr){
    if(!dataStr) return '';
    var d=new Date(dataStr);
    return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  }

  ps.forEach(function(p,idx){

    var pct=maxVal>0?Math.round(((p.val||0)/maxVal)*100):0;
    var priBg=idx===0?'var(--red)':idx<3?'var(--accent)':'var(--text3)';

    var entries=histIdx[p.id]||[];
    var last=entries[0]||null;

    // Próxima ação: do registro mais recente que tem proxima_acao
    var comAcao=entries.filter(function(h){ return h.proxima_acao; })[0]||null;

    // Bloco de último contato
    var contatoHtml='';
    if(last){
      var dias=diasDiff(last.data);
      var corDias=dias<=7?'var(--green)':dias<=14?'var(--accent)':'var(--red)';
      var lblDias=dias===0?'hoje':dias===1?'ontem':dias+'d atrás';
      var canalIco={WhatsApp:'💬',Email:'📧',Visita:'🤝',Telefone:'📞',Reunião:'🗂️'}[last.canal]||'📌';
      contatoHtml='<div style="display:flex;align-items:center;gap:.3rem;margin-top:.35rem;flex-wrap:wrap">'
        +'<span style="font-size:.66rem;color:'+corDias+';font-weight:700">'+canalIco+' '+lblDias+'</span>'
        +(last.decisao?'<span style="font-size:.63rem;color:var(--text3)">· '+esc(last.decisao.slice(0,60))+(last.decisao.length>60?'…':'')+'</span>':'')
        +'</div>';
    } else {
      contatoHtml='<div style="margin-top:.35rem;font-size:.66rem;color:var(--red);font-weight:600">⚠ Sem contato registrado</div>';
    }

    // Bloco de próxima ação
    var acaoHtml='';
    if(comAcao && comAcao.proxima_acao){
      var prazoStr=comAcao.prazo_acao?fmtData(comAcao.prazo_acao):'';
      var prazoAtrasado=comAcao.prazo_acao && new Date(comAcao.prazo_acao)<hoje;
      var corPrazo=prazoAtrasado?'var(--red)':comAcao.prazo_acao?'var(--accent)':'var(--text3)';
      acaoHtml='<div style="margin-top:.25rem;font-size:.67rem;display:flex;align-items:center;gap:.3rem">'
        +'<span style="color:var(--blue)">⚡ '+esc(comAcao.proxima_acao.slice(0,55))+(comAcao.proxima_acao.length>55?'…':'')+'</span>'
        +(prazoStr?'<span style="color:'+corPrazo+';font-weight:600">'+(prazoAtrasado?'⏰ ':'')+prazoStr+'</span>':'')
        +'</div>';
    }

    var div=document.createElement('div');
    div.style.cssText='padding:.55rem .55rem;border-bottom:1px solid var(--border);display:flex;gap:.6rem;align-items:flex-start';

    div.innerHTML='<div style="flex-shrink:0;margin-top:.15rem">'
      +'<div style="width:6px;height:48px;background:var(--border);border-radius:3px;overflow:hidden">'
      +'<div style="width:100%;height:'+pct+'%;background:'+priBg+';border-radius:3px;margin-top:auto;transition:.3s"></div>'
      +'</div></div>'
      +'<div style="flex:1;min-width:0">'
      +'<div style="font-size:.75rem;font-weight:700;color:var(--text);line-height:1.3">'+esc(p.tit||'')+'</div>'
      +'<div style="font-size:.68rem;color:var(--text3);margin-top:.05rem">'+esc(p.cli||p.loc||'')+'</div>'
      +contatoHtml
      +acaoHtml
      +'</div>'
      +'<div style="flex-shrink:0;text-align:right">'
      +'<div style="font-size:.65rem;color:var(--text3);font-family:monospace">'+esc(p.num||'')+'</div>'
      +(p.val?'<div style="font-size:.72rem;color:var(--green);font-weight:600;margin-top:.1rem">R$ '+Number(p.val).toLocaleString('pt-BR')+'</div>':'')
      +'</div>';

    list.appendChild(div);

  });

}



// ===== VISITAS =====

function renderVisitas(){

  const list=document.getElementById('visitas-list');

  if(!list)return;

  if(!dados.visitas.length){list.innerHTML='<div class="empty">Nenhuma visita agendada</div>';return;}

  list.innerHTML='';

  dados.visitas.forEach((v,i)=>{

    const data=new Date(v.data+'T12:00:00');

    const dias=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

    const meses=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

    const ehTerOuQui=data.getDay()===2||data.getDay()===4;

    const div=document.createElement('div');

    div.className='task-item';

    div.innerHTML=`<div class="task-body">

      <div class="task-txt">${v.cliente} — ${v.obj}</div>

      <div class="task-meta">

        <span class="bdg ${ehTerOuQui?'b-ok':'b-warn'}">${dias[data.getDay()]} ${data.getDate()} ${meses[data.getMonth()]}</span>

        <span class="bdg b-muted">${v.hora}</span>

        ${v.local?`<span class="bdg b-muted">${v.local}</span>`:''}

        ${!ehTerOuQui?'<span class="bdg b-warn">Fora do padrão Ter/Qui</span>':''}

      </div>

    </div>

    <button class="task-del" onclick="delVisita(${i})">✕</button>`;

    list.appendChild(div);

  });

}

function salvarVisita(){

  const cliente=document.getElementById('mv-cliente').value.trim();

  const data=document.getElementById('mv-data').value;

  if(!cliente||!data)return;

  dados.visitas.push({cliente,data,hora:document.getElementById('mv-hora').value,obj:document.getElementById('mv-obj').value,local:document.getElementById('mv-local').value});

  save();renderVisitas();fecharModal('m-visita');toast('Visita agendada');

}

function delVisita(i){dados.visitas.splice(i,1);save();renderVisitas();}



// ===== CHECK SEGUNDA =====

function toggleCheckSeg(el){

  el.classList.toggle('done');

  const chk=el.querySelector('.task-check');

  chk.classList.toggle('checked');

  chk.textContent=chk.classList.contains('checked')?'✓':'';

}



// ===== KPIs MÊS =====

function renderKPIs(){

  // Enriquece com dados reais do Motor de Decisão se disponíveis
  var r=getOrRunDecisionEngine();
  var autoKpi=r&&r._data?r._data.kpis:null;

  const k=dadosGeral.kpi;

  var env=k.env||0;
  var apr=autoKpi?(autoKpi.fechMes||k.apr||0):(k.apr||0);
  var val=autoKpi?(autoKpi.valFechMes||k.val||0):(k.val||0);
  var acum=autoKpi?(autoKpi.recAno||k.acum||0):(k.acum||0);

  document.getElementById('k-enviadas').textContent=env;

  document.getElementById('k-aprovadas').textContent=apr;

  document.getElementById('k-valor').textContent='R$ '+(val>=1000?Math.round(val/1000)+'k':val.toLocaleString('pt-BR'));

  var tx=autoKpi&&autoKpi.taxaConv>0?Math.round(autoKpi.taxaConv):(env?Math.round((apr/env)*100):0);

  document.getElementById('k-tx').textContent=tx+'%';

  const meta=2730000;

  const metaPct=Math.min(100,Math.round((acum/meta)*100));

  document.getElementById('meta-pct-txt').textContent=metaPct+'%';

  document.getElementById('meta-bar').style.width=metaPct+'%';

  document.getElementById('meta-acum').textContent='R$ '+acum.toLocaleString('pt-BR');

  const dep=k.dep||0;

  document.getElementById('dep-pct-txt').textContent=dep+'%';

  const depBar=document.getElementById('dep-bar');

  depBar.style.width=Math.min(100,dep)+'%';

  depBar.className='prog-fill'+(dep>80?'':dep>60?' ':'');

  depBar.style.background=dep>80?'var(--red)':dep>60?'var(--orange)':'var(--green)';

  // Indicador de fonte
  var srcEl=document.getElementById('k-fonte-dados');
  if(srcEl) srcEl.textContent=autoKpi?'🔄 tempo real':'✏️ manual';

}

function salvarDados(){

  dadosGeral.kpi.env=parseInt(document.getElementById('mk-env').value)||0;

  dadosGeral.kpi.apr=parseInt(document.getElementById('mk-apr').value)||0;

  dadosGeral.kpi.val=parseFloat(document.getElementById('mk-val').value)||0;

  dadosGeral.kpi.acum=parseFloat(document.getElementById('mk-acum').value)||0;

  dadosGeral.kpi.dep=parseFloat(document.getElementById('mk-dep').value)||0;

  dadosGeral.trim.fat=parseFloat(document.getElementById('mtr-fat').value)||0;

  dadosGeral.trim.dep=dadosGeral.kpi.dep;

  saveGeral();renderKPIs();renderTrim();fecharModal('m-atualizar');toast('Dados atualizados');

}

function abrirModalAtualizar(){

  document.getElementById('mk-env').value=dadosGeral.kpi.env||'';

  document.getElementById('mk-apr').value=dadosGeral.kpi.apr||'';

  document.getElementById('mk-val').value=dadosGeral.kpi.val||'';

  document.getElementById('mk-acum').value=dadosGeral.kpi.acum||'';

  document.getElementById('mk-dep').value=dadosGeral.kpi.dep||'';

  document.getElementById('mtr-fat').value=dadosGeral.trim.fat||dadosGeral.kpi.acum||'';

  abrirModal('m-atualizar');

}

function salvarKPI(){salvarDados();}

function abrirModalKPI(){abrirModalAtualizar();}



// ===== RELACIONAMENTO DO MÊS — auto-pull do módulo Relacionamento =====

function renderRelacionamentoMes(){

  var list=document.getElementById('funil-list');

  if(!list)return;

  var todos=(typeof window.getHistoricoData==='function')?window.getHistoricoData():[];

  var hoje=new Date();

  var mesAtual=hoje.getFullYear()+'-'+String(hoje.getMonth()+1).padStart(2,'0');

  var doMes=todos.filter(function(h){

    var d=(h.data||h.created_at||h.dataRegistro||'').substring(0,7);

    return d===mesAtual;

  });

  if(!doMes.length){list.innerHTML='<div class="empty">Nenhum relacionamento registrado este mês</div>';return;}

  list.innerHTML='';

  var statusCls={resolvido:'b-ok',pendente:'b-warn','em andamento':'b-info'};

  var statusNome={resolvido:'Resolvido',pendente:'Pendente','em andamento':'Em andamento'};

  // Resumo no topo
  var total=doMes.length;

  var resolvidos=doMes.filter(function(h){return (h.status||'').toLowerCase()==='resolvido';}).length;

  var pendentes=total-resolvidos;

  var resumoDiv=document.createElement('div');

  resumoDiv.style.cssText='display:flex;gap:.5rem;padding:.35rem .5rem .5rem;border-bottom:1px solid var(--border);margin-bottom:.25rem';

  resumoDiv.innerHTML='<span class="bdg b-ok">'+resolvidos+' resolvidos</span>'

    +'<span class="bdg b-warn">'+pendentes+' pendentes</span>'

    +'<span style="font-size:.67rem;color:var(--text3);margin-left:auto;align-self:center">'+total+' no mês</span>';

  list.appendChild(resumoDiv);

  doMes.slice(0,10).forEach(function(h){

    var div=document.createElement('div');

    div.className='funil-item';

    var st=(h.status||'pendente').toLowerCase();

    div.innerHTML='<div class="funil-body">'

      +'<div class="funil-cliente">'+esc(h.cliente||h.titulo||h.assunto||'')+'</div>'

      +'<div class="funil-desc">'+esc(h.descricao||h.assunto||'')+'</div>'

      +'</div>'

      +'<span class="bdg '+(statusCls[st]||'b-muted')+'">'+( statusNome[st]||st)+'</span>';

    list.appendChild(div);

  });

}

function renderFunil(){renderRelacionamentoMes();}



// ===== CRESCIMENTO (Geral) =====

function saveCrescimento(){dadosGeral.crescimento=document.getElementById('crescimento-mes').value;saveGeral();}

function saveProxPasso(){dadosGeral.proxPasso=document.getElementById('prox-passo').value;saveGeral();}



// ===== REUNIÃO DE SEGUNDA (Geral) =====

function _reuniaoLista(){

  if(!Array.isArray(dadosGeral.reuniaoSegunda)) dadosGeral.reuniaoSegunda=[];

  return dadosGeral.reuniaoSegunda;

}

function renderReuniaoSegunda(){

  var cont=document.getElementById('reuniao-segunda-lista');

  if(!cont)return;

  var lista=_reuniaoLista();

  if(!lista.length){cont.innerHTML='<div class="empty" style="font-size:.76rem">Nenhum item na pauta</div>';return;}

  cont.innerHTML='';

  lista.forEach(function(item){

    var div=document.createElement('div');

    div.style.cssText='display:flex;align-items:center;gap:.4rem;padding:.38rem .3rem;border-bottom:1px solid var(--border)';

    div.innerHTML='<div class="task-check'+(item.feito?' checked':'')+'" onclick="toggleReuniaoItem(\''+item.id+'\')" style="cursor:pointer;width:18px;height:18px;border-radius:4px;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0;'+(item.feito?'background:var(--green);border-color:var(--green);color:#fff':'')+'">'+( item.feito?'✓':'')+'</div>'

      +'<div id="reuniao-txt-'+item.id+'" style="flex:1;font-size:.78rem;'+(item.feito?'text-decoration:line-through;color:var(--text3)':'color:var(--text)')+'" ondblclick="editarReuniaoItem(\''+item.id+'\')">'+esc(item.texto)+'</div>'

      +'<button onclick="editarReuniaoItem(\''+item.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:.72rem;padding:.1rem .25rem" title="Editar">✏️</button>'

      +'<button onclick="deletarReuniaoItem(\''+item.id+'\')" style="background:none;border:none;cursor:pointer;color:var(--text3);font-size:.72rem;padding:.1rem .25rem" title="Excluir">✕</button>';

    cont.appendChild(div);

  });

}

function adicionarReuniaoItem(){

  var inp=document.getElementById('reuniao-segunda-input');

  if(!inp||!inp.value.trim())return;

  _reuniaoLista().push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),texto:inp.value.trim(),feito:false});

  inp.value='';

  saveGeral();

  renderReuniaoSegunda();

}

function toggleReuniaoItem(id){

  var item=_reuniaoLista().find(function(x){return x.id===id;});

  if(item){item.feito=!item.feito;saveGeral();renderReuniaoSegunda();}

}

function deletarReuniaoItem(id){

  dadosGeral.reuniaoSegunda=_reuniaoLista().filter(function(x){return x.id!==id;});

  saveGeral();renderReuniaoSegunda();

}

function editarReuniaoItem(id){

  var item=_reuniaoLista().find(function(x){return x.id===id;});

  if(!item)return;

  var el=document.getElementById('reuniao-txt-'+id);

  if(!el)return;

  var novo=prompt('Editar item:',item.texto);

  if(novo!==null&&novo.trim()){item.texto=novo.trim();saveGeral();renderReuniaoSegunda();}

}

function saveReuniaoSegunda(){} // mantido por compatibilidade



// ===== TRIMESTRE =====

function renderTrim(){

  const t=dadosGeral.trim;

  const dep=t.dep||dadosGeral.kpi.dep||90;

  // Usa receita real do Motor de Decisão se disponível; senão cai em dadosGeral.trim.fat
  var r=getOrRunDecisionEngine();
  var fatReal=(r&&r._data&&r._data.kpis&&r._data.kpis.recAno>0)?r._data.kpis.recAno:(t.fat||0);
  var metaBase=t.meta||4800000;

  document.getElementById('trim-fat').textContent='R$ '+fatReal.toLocaleString('pt-BR');

  var trimMetaLbl=document.getElementById('trim-meta-lbl');
  if(trimMetaLbl) trimMetaLbl.textContent='de R$ '+metaBase.toLocaleString('pt-BR')+' (meta 3 anos)';

  const pctMeta=Math.round((fatReal/metaBase)*100);

  document.getElementById('trim-pct-meta').textContent=pctMeta+'% do caminho';

  document.getElementById('trim-fat-pct-txt').textContent=pctMeta+'%';

  document.getElementById('trim-fat-bar').style.width=Math.min(100,pctMeta)+'%';

  document.getElementById('trim-dep').textContent=dep+'%';

  document.getElementById('trim-dep-status').textContent=dep>80?'⚠ Risco alto':dep>60?'Atenção — reduzir':'Bem diversificado';

  document.getElementById('trim-dep-status').style.color=dep>80?'var(--red)':dep>60?'var(--orange)':'var(--green)';

}

function salvarTrim(){salvarDados();}

function abrirModalTrim(){abrirModalAtualizar();}





// ===== FABRICANTES =====

function renderFabricantes(){

  if(!dados.fabricantes||!dados.fabricantes.length)return;

  const list=document.getElementById('fab-list');

  list.innerHTML='';

  const statusCls={Prospectar:'b-warn',Contatado:'b-info','Em negociação':'b-warn',Integrador:'b-ok'};

  dados.fabricantes.forEach((f,i)=>{

    const div=document.createElement('div');

    div.className='fab-item';

    div.innerHTML=`<div class="fab-logo">${f.sigla}</div>

    <div class="fab-body"><div class="fab-nome">${f.nome}</div><div class="fab-status">${f.obs||''}</div></div>

    <span class="bdg ${statusCls[f.status]||'b-muted'}">${f.status}</span>

    <button class="task-del" onclick="delFab(${i})">✕</button>`;

    list.appendChild(div);

  });

}

function salvarFab(){

  const nome=document.getElementById('mfab-nome').value.trim();

  if(!nome)return;

  if(!dados.fabricantes)dados.fabricantes=[];

  dados.fabricantes.push({nome,sigla:document.getElementById('mfab-sigla').value.toUpperCase(),status:document.getElementById('mfab-status').value,obs:document.getElementById('mfab-obs').value});

  save();renderFabricantes();fecharModal('m-fab');toast('Fabricante adicionado');

}

function delFab(i){dados.fabricantes.splice(i,1);save();renderFabricantes();}



// ===== CHECK CONTRATAÇÃO =====

function renderCheckContr(){

  const items=document.querySelectorAll('#check-contrat .task-item');

  items.forEach((el,i)=>{

    const done=dadosGeral.checkContr&&dadosGeral.checkContr[i];

    el.classList.toggle('done',!!done);

    const chk=el.querySelector('.task-check');

    chk.classList.toggle('checked',!!done);

    chk.textContent=done?'✓':'';

  });

}

function toggleCheckContr(el){

  const items=[...document.querySelectorAll('#check-contrat .task-item')];

  const i=items.indexOf(el);

  if(!dadosGeral.checkContr)dadosGeral.checkContr=[];

  dadosGeral.checkContr[i]=!dadosGeral.checkContr[i];

  saveGeral();renderCheckContr();

}



// ===== SAVE REV TRIM =====

function saveRevTrim(tipo){

  if(tipo==='velocidade')dadosGeral.revVelocidade=document.getElementById('rev-velocidade').value;

  else dadosGeral.revMudanca=document.getElementById('rev-mudanca').value;

  saveGeral();

}



// ===== FRASES MOTIVACIONAIS =====

const FRASES_DEFAULT=[

  {icone:'💡',txt:'Quem não mede, não gerencia. Quem não gerencia, não melhora.',autor:'Peter Drucker'},

  {icone:'🎯',txt:'O segredo do sucesso é fazer coisas comuns de forma extraordinariamente bem.',autor:'John D. Rockefeller'},

  {icone:'🔥',txt:'Disciplina é escolher entre o que você quer agora e o que você quer mais.',autor:'Abraham Lincoln'}

];

let fraseEditIdx=-1;



function renderFrases(){

  const wrap=document.getElementById('frases-wrap');

  wrap.innerHTML='';

  const frases=dados.frases&&dados.frases.length?dados.frases:FRASES_DEFAULT;

  frases.forEach((f,i)=>{

    const div=document.createElement('div');

    div.className='frase-card';

    div.innerHTML=`<button class="frase-edit-btn" onclick="editarFrase(${i})">✏ editar</button>

    <span class="frase-icone">${f.icone||'💡'}</span>

    <div class="frase-txt">${f.txt||'Clique em editar para adicionar sua frase...'}</div>

    ${f.autor?`<div class="frase-autor">— ${f.autor}</div>`:''}`;

    wrap.appendChild(div);

  });

}

function editarFrase(i){

  fraseEditIdx=i;

  const frases=dados.frases&&dados.frases.length?dados.frases:JSON.parse(JSON.stringify(FRASES_DEFAULT));

  const f=frases[i]||{icone:'💡',txt:'',autor:''};

  document.getElementById('mfr-icone').value=f.icone||'';

  document.getElementById('mfr-txt').value=f.txt||'';

  document.getElementById('mfr-autor').value=f.autor||'';

  abrirModal('m-frase');

}

function salvarFrase(){

  if(!dados.frases||!dados.frases.length)dados.frases=JSON.parse(JSON.stringify(FRASES_DEFAULT));

  dados.frases[fraseEditIdx]={

    icone:document.getElementById('mfr-icone').value||'💡',

    txt:document.getElementById('mfr-txt').value.trim(),

    autor:document.getElementById('mfr-autor').value.trim()

  };

  save();renderFrases();fecharModal('m-frase');toast('Frase salva');

}



// ===== THEME =====

function toggleTheme(){

  document.body.classList.toggle('light');

  dados.theme=document.body.classList.contains('light')?'light':'dark';

  var _tb=document.getElementById('theme-btn'); if(_tb) _tb.textContent=dados.theme==='light'?'🌙':'☀️';

  save();

}





function abrirModal(id){document.getElementById(id).classList.add('on');}

function fecharModal(id){document.getElementById(id).classList.remove('on');}

function abrirModalCiclo(){abrirModal('m-ciclo');}

function abrirModalFollowup(){abrirModal('m-followup');}

function abrirModalVisita(){abrirModal('m-visita');}

function abrirModalFunil(){abrirModal('m-funil');}

function abrirModalEquipe(){abrirModal('m-equipe');}

function abrirModalFab(){abrirModal('m-fab');}



// abrir modais de tipos/resps com render

const _abrirModalOrig=abrirModal;

function abrirModal(id){

  document.getElementById(id).classList.add('on');

  if(id==='m-tipos')renderTiposModal();

  if(id==='m-resps')renderRespsModal();

  if(id==='m-destinos')renderDestinosModal();

}



// Fechar modal clicando fora

document.querySelectorAll('.modal-bg').forEach(m=>{

  m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('on');});

});



// ===== TOAST =====

function toast(msg){

  const t=document.getElementById('toast');

  t.textContent=msg;t.classList.add('show');

  setTimeout(()=>t.classList.remove('show'),2200);

}



// ===== BACKUP =====

function exportarBackup(){

  const str=JSON.stringify(dados,null,2);

  const blob=new Blob([str],{type:'application/json'});

  const url=URL.createObjectURL(blob);

  const a=document.createElement('a');

  const now=new Date();

  const dt=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;

  a.href=url;a.download=`EJN_PLANEJADOR_BACKUP_${dt}.json`;

  a.click();URL.revokeObjectURL(url);

  toast('Backup exportado com sucesso!');

}

function importarBackup(){

  const file=document.getElementById('backup-file').files[0];

  if(!file){toast('Selecione um arquivo .json');return;}

  const reader=new FileReader();

  reader.onload=async e=>{

    try{

      const importado=JSON.parse(e.target.result);

      dados=Object.assign({},importado);

      save(); // salva localStorage

      // Salvar imediatamente na nuvem (sem debounce)

      try{

        await _sb.from('configuracoes').upsert({

          chave:_gestaoChave,

          valor:dados,

          updated_at:new Date().toISOString()

        },{onConflict:'chave'});

        const st=document.getElementById('backup-status');

        st.textContent='✅ Backup restaurado e salvo na nuvem! Recarregando...';

        st.style.display='block';

      }catch(err2){

        const st=document.getElementById('backup-status');

        st.textContent='✅ Backup restaurado localmente (erro ao salvar nuvem). Recarregando...';

        st.style.display='block';

      }

      setTimeout(()=>location.reload(),1800);

    }catch(err){

      const st=document.getElementById('backup-status');

      st.textContent='❌ Arquivo inválido. Verifique se é um backup correto.';

      st.style.color='var(--red)';st.style.display='block';

    }

  };

  reader.readAsText(file);

}



// ===== CALENDÁRIO =====

let calAno=new Date().getFullYear();

const MESES_PT=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const DIAS_PT=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];



function isAnoBissexto(y){return(y%4===0&&y%100!==0)||(y%400===0);}

function getDiasNoAno(y){return isAnoBissexto(y)?366:365;}

function getDiaDaAno(d){

  const ini=new Date(d.getFullYear(),0,1);

  return Math.ceil((d-ini)/86400000)+1;

}

function getSemana(d){

  const ini=new Date(d.getFullYear(),0,1);

  const diasDesdeIni=Math.floor((d-ini)/86400000);

  return Math.ceil((diasDesdeIni+ini.getDay()+1)/7);

}



function calAnterior(){calAno--;renderCalendario();}

function calProximo(){calAno++;renderCalendario();}



function renderCalendario(){

  const hoje=new Date();

  document.getElementById('cal-ano-lbl').textContent=calAno;



  // Resumo

  const bissexto=isAnoBissexto(calAno);

  const totalDias=getDiasNoAno(calAno);

  const resumo=document.getElementById('cal-resumo');

  resumo.innerHTML=`

    <div class="cal-resumo-item"><strong>${calAno}</strong>Ano</div>

    <div class="cal-resumo-item"><strong>${totalDias}</strong>Dias no ano</div>

    <div class="cal-resumo-item"><strong>52–53</strong>Semanas</div>

    <div class="cal-resumo-item"><strong>${bissexto?'Sim':'Não'}</strong>Ano bissexto</div>

    ${calAno===hoje.getFullYear()?`<div class="cal-resumo-item"><strong>Dia ${getDiaDaAno(hoje)}/${totalDias}</strong>Hoje no ano</div>`:''}

    ${calAno===hoje.getFullYear()?`<div class="cal-resumo-item"><strong>Sem. ${getSemana(hoje)}</strong>Semana atual</div>`:''}

  `;



  // Grid anual

  const grid=document.getElementById('cal-anual');

  grid.innerHTML='';

  for(let m=0;m<12;m++){

    const div=document.createElement('div');

    div.className='cal-mini';

    div.onclick=(()=>{const mm=m;return()=>expandirMes(mm);})();

    const primeiroDia=new Date(calAno,m,1).getDay();

    const diasNoMes=new Date(calAno,m+1,0).getDate();

    let cells='';

    // Cabeçalho dias da semana

    DIAS_PT.forEach(d=>{cells+=`<div class="cal-mini-dw">${d[0]}</div>`;});

    // Espaços vazios antes do dia 1

    for(let i=0;i<primeiroDia;i++)cells+='<div></div>';

    for(let d=1;d<=diasNoMes;d++){

      const dt=new Date(calAno,m,d);

      const isDom=dt.getDay()===6||dt.getDay()===0;

      const isHoje=dt.toDateString()===hoje.toDateString();

      cells+=`<div class="cal-mini-d${isHoje?' hoje':''}${dt.getDay()===0?' dom':''}">${d}</div>`;

    }

    const semIni=getSemana(new Date(calAno,m,1));

    const semFim=getSemana(new Date(calAno,m,diasNoMes));

    div.innerHTML=`

      <div class="cal-mini-hdr">

        <span class="cal-mini-nome">${MESES_PT[m]}</span>

        <span class="cal-mini-num">Sem ${semIni}–${semFim}</span>

      </div>

      <div class="cal-mini-grid">${cells}</div>`;

    grid.appendChild(div);

  }

}



function expandirMes(m){

  const hoje=new Date();

  const card=document.getElementById('cal-mes-card');

  const titulo=document.getElementById('cal-mes-titulo');

  const exp=document.getElementById('cal-mes-expand');

  titulo.textContent=`${MESES_PT[m]} ${calAno}`;

  card.style.display='block';

  card.scrollIntoView({behavior:'smooth',block:'nearest'});



  const primeiroDia=new Date(calAno,m,1).getDay();

  const diasNoMes=new Date(calAno,m+1,0).getDate();

  let html=`<div class="cal-exp-grid">`;

  // Cabeçalhos

  html+=`<div class="cal-exp-dw" style="font-size:.6rem;color:var(--accent);border-right:1px solid var(--border)">Sem.</div>`;

  DIAS_PT.forEach(d=>{html+=`<div class="cal-exp-dw">${d}</div>`;});

  html+='</div>';



  // Semanas

  let dia=1;

  let primeiraLinha=true;

  while(dia<=diasNoMes){

    html+=`<div class="cal-exp-grid" style="margin-top:3px">`;

    const inicioSemana=primeiraLinha?primeiroDia:0;

    const dtSemana=new Date(calAno,m,dia-(primeiraLinha?0:0));

    const numSem=getSemana(new Date(calAno,m,dia));

    html+=`<div class="cal-exp-dw" style="border-right:1px solid var(--border);color:var(--accent);font-size:.62rem;display:flex;align-items:center;justify-content:center">S${numSem}</div>`;

    for(let col=0;col<7;col++){

      if(primeiraLinha&&col<primeiroDia){

        html+='<div class="cal-exp-d out"></div>';

      } else if(dia>diasNoMes){

        html+='<div class="cal-exp-d out"></div>';

      } else {

        const dt=new Date(calAno,m,dia);

        const diaAno=getDiaDaAno(dt);

        const isHoje=dt.toDateString()===hoje.toDateString();

        const isDom=dt.getDay()===0;

        html+=`<div class="cal-exp-d${isHoje?' hoje':''}${isDom?' dom':''}">

          <span class="cal-exp-num">${dia}</span>

          <span class="cal-exp-dia-ano">Dia ${diaAno}</span>

        </div>`;

        dia++;

      }

    }

    html+='</div>';

    primeiraLinha=false;

  }

  exp.innerHTML=html;

}



// ===== VERSÕES =====

const VERSOES=[

  {v:'V14',data:'2026-04-02',titulo:'Correção do congelamento + explosão migra por dia',itens:[

    '🔧 Corrigido bug crítico: ferramenta congelava ao abrir porque diaAtivo do dia anterior bloqueava entradas com pointer-events:none',

    '🔧 init() agora sempre força abertura do dia de hoje, independente do que estava salvo',

    '🔧 Migração agora usa controle diasAbertos para migrar apenas uma vez por dia (evita duplicação)',

    '➕ Explosões não processadas (pendentes) migram automaticamente para o próximo dia junto com as tarefas',

    '➕ Explosões migradas também chegam com badge ↩ indicando origem'

  ]},

  {v:'V13',data:'2026-04-02',titulo:'Histórico de versões + Explosão por dia',itens:[

    '➕ Nova aba "Versões" com histórico completo de todas as alterações',

    '🔧 Explosão de Informações agora é carregada por dia — cada dia tem sua própria lista independente',

    '🔧 Explosões do dia anterior não contaminam o dia atual',

    '✅ Número de versão atualizado no nome do arquivo e dentro da ferramenta'

  ]},

  {v:'V12',data:'2026-04-02',titulo:'Histórico por dia — Diário estruturado',itens:[

    '➕ Cada dia tem registro independente: prioridades, tarefas, explosões, reflexão e o que ficou aberto',

    '➕ Navegação ‹ Hoje › para consultar qualquer dia passado',

    '➕ Modo leitura automático ao visualizar dias passados',

    '➕ Migração automática: tarefas não concluídas do dia anterior aparecem hoje com badge ↩',

    '➕ Calendário marca em verde os dias que têm registros',

    '🔧 Migração automática de dados do formato antigo (V11 e anteriores) sem perda de dados'

  ]},

  {v:'V11',data:'2026-04-01',titulo:'Explosão multi-destino + modal sequencial',itens:[

    '➕ Ao clicar OK na Explosão, abre o modal de edição pré-preenchido para detalhar a tarefa',

    '➕ Com múltiplos responsáveis selecionados, modais abrem em sequência (1/3, 2/3, 3/3)',

    '➕ Botão do modal mostra "Salvar e próxima ›" até o último'

  ]},

  {v:'V10',data:'2026-04-01',titulo:'Explosão com seleção múltipla e ordenação CEO',itens:[

    '➕ Explosão de Informações com seleção múltipla de destinos (toggle por clique)',

    '➕ Botão ✓ OK confirma e processa todos os selecionados de uma vez',

    '➕ Urgente + Importante cria tarefa com prioridade máxima e badge 🔴',

    '➕ Múltiplos responsáveis criam uma tarefa para cada',

    '➕ Botão ↕ Priorizar reorganiza tarefas pela matriz CEO: Urgente+Importante → Urgente → Importante → Normal',

    '➕ Badge de prioridade visível em cada tarefa na lista'

  ]},

  {v:'V9',data:'2026-04-01',titulo:'Gantt por tarefa',itens:[

    '➕ Campo de Data de início + Duração (dias ou horas) no modal de tarefa',

    '➕ Data de entrega calculada automaticamente',

    '➕ Slider de progresso (0–100%) por tarefa',

    '➕ Barra Gantt inline em cada tarefa: cor muda por status (normal, atrasado, concluído)',

    '➕ Linha tracejada indica posição do tempo atual dentro da barra'

  ]},

  {v:'V8',data:'2026-04-01',titulo:'Backup e Calendário anual',itens:[

    '➕ Botão 💾 no cabeçalho para exportar/importar backup em .json com data no nome',

    '➕ Nova aba Calendário com visão do ano inteiro em 12 mini-calendários',

    '➕ Cada mês exibe intervalo de semanas (ex: Sem 14–18)',

    '➕ Clique em qualquer mês abre visão expandida com dia do ano (1–365/366) e número de semana',

    '➕ Navegação por ano com ‹ ›, detecção automática de ano bissexto'

  ]},

  {v:'V7',data:'2026-04-01',titulo:'Modal único de atualização + responsáveis editáveis',itens:[

    '➕ Botão Atualizar do Mês e do Trimestre unificados em um único modal com todos os campos',

    '🔧 Responsáveis padrão (Eu, Meu filho) agora podem ser editados e excluídos',

    '🔧 Um salvar atualiza KPIs do mês e Visão Estratégica ao mesmo tempo'

  ]},

  {v:'V6',data:'2026-04-01',titulo:'Explosão configurável + tipos editáveis',itens:[

    '➕ Explosão com 6 destinos padrão: Eu, Filho, Adriano, Bitrix, Urgente, Importante',

    '➕ Link [gerenciar destinos] para criar novos destinos com nome, cor e tipo',

    '🔧 Tipos de tarefa padrão agora têm botão ✏ para renomear — acabou o bloqueio "padrão"'

  ]},

  {v:'V5',data:'2026-04-01',titulo:'Menu de ações por tarefa',itens:[

    '➕ Botão ⋯ em cada tarefa revela menu com Editar, Duplicar e Excluir',

    '🔧 Menu fecha automaticamente ao clicar fora'

  ]},

  {v:'V4',data:'2026-04-01',titulo:'Editar tarefa + tipos e responsáveis customizáveis',itens:[

    '➕ Edição de tarefas existentes com modal pré-preenchido',

    '➕ Tipos de tarefa customizáveis com nome e cor',

    '➕ Responsáveis cadastráveis com nome e função',

    '➕ Campos de prazo e observação nas tarefas',

    '🔧 Corrigido bug que impedia adição de tarefas (erro null no elemento empty)'

  ]},

  {v:'V3',data:'2026-03-31',titulo:'Frases motivacionais + tema claro/escuro',itens:[

    '➕ 3 cards de frases motivacionais editáveis no topo da aba Dia',

    '➕ Botão de alternância de tema com ícone 🌙/☀️ e preferência salva',

    '✅ Nome da ferramenta: ENG. ELIVANDRO — PLANEJADOR'

  ]},

  {v:'V2',data:'2026-03-31',titulo:'Protótipo base',itens:[

    '➕ Estrutura inicial com abas Dia, Semana, Mês e Trimestre',

    '➕ Prioridades do dia com progresso',

    '➕ Janelas de comunicação com status automático por horário',

    '➕ Explosão de Informações com captura rápida',

    '➕ Ciclos de proposta (8 dias), follow-ups, visitas',

    '➕ KPIs do mês, funil de propostas, conformidade da equipe',

    '➕ Visão estratégica com meta R$ 4,8M e dependência cliente fixo',

    '➕ Fabricantes e parcerias, checklist para contratar',

    '➕ Persistência local (localStorage)'

  ]}

];



function renderVersoes(){

  const lista=document.getElementById('versoes-lista');

  if(!lista)return;

  lista.innerHTML='';

  VERSOES.forEach((v,vi)=>{

    const div=document.createElement('div');

    div.style.cssText='border-bottom:1px solid var(--border);padding:1rem 0;'+(vi===0?'':'');

    if(vi===VERSOES.length-1)div.style.borderBottom='none';

    const badgeStyle=vi===0

      ?'background:var(--accent);color:#000;font-weight:800;'

      :'background:var(--bg3);color:var(--text2);border:1px solid var(--border);';

    div.innerHTML=`

      <div style="display:flex;align-items:center;gap:.65rem;margin-bottom:.5rem">

        <span style="padding:.18rem .55rem;border-radius:20px;font-size:.72rem;${badgeStyle}font-family:monospace">${v.v}</span>

        <span style="font-size:.85rem;font-weight:500;color:var(--text)">${v.titulo}</span>

        <span style="font-size:.65rem;color:var(--text3);margin-left:auto">${v.data}</span>

      </div>

      <div style="display:flex;flex-direction:column;gap:.2rem;padding-left:.5rem">

        ${v.itens.map(it=>`<div style="font-size:.78rem;color:var(--text2);line-height:1.5">${it}</div>`).join('')}

      </div>`;

    lista.appendChild(div);

  });

}



// ===== START =====

init();

(async function(){
  await _initGestaoChave();
  // Recarregar localStorage agora com a chave correta do usuário
  load();
  init();
  if(typeof loadNuvem==="function") loadNuvem();
  if(typeof loadNuvemGeral==="function") loadNuvemGeral();
})();

renderFrases();

var _tb=document.getElementById('theme-btn'); if(_tb) _tb.textContent=dados.theme==='light'?'🌙':'☀️';

// Atualizar janelas a cada minuto

setInterval(()=>{renderJanelas();atualizarDataHoje();},60000);
function _gestaoShowSecAlias(id) {

  // Chamar função original

  gestaoShowSec(id);

  // Atualizar botões da sidebar

  // querySelectorAll removido (sidebar agora no shell pai)
  var btn = document.getElementById('nb-' + id);

  if (btn) btn.classList.add('on');

  // Fechar sidebar no mobile

  if (window.innerWidth <= 768) toggleSidebarG(false);

}



function updateThemeBtn() {

  var btn = document.getElementById('theme-btn');

  if (btn) btn.textContent = dados.theme === 'light' ? '🌙' : '☀️';

}

// ── Navegação direta para seção do Planejamento (usada pelo sidebar) ─────────
// Garante que a área gestão está visível e exibe a sub-seção correta.
// Independe de go() para evitar efeitos colaterais externos.
function gestaoNav(sec){
  // 1. Mostra a área gestão se estiver oculta
  var secEl=document.getElementById('gestao');
  if(secEl&&!secEl.classList.contains('on')){
    document.querySelectorAll('.sec').forEach(function(s){s.classList.remove('on');});
    secEl.classList.add('on');
  }
  // 2. Exibe a sub-seção e injeta inteligência da IA
  gestaoShowSec(sec);
}

// ── Expor funções para uso global pelos event listeners inline ────────────────
window.gestaoShowSec  = typeof gestaoShowSec  === 'function' ? gestaoShowSec  : function(){};
window.gestaoNav      = typeof gestaoNav      === 'function' ? gestaoNav      : function(){};
window.setPrio        = typeof setPrio        === 'function' ? setPrio        : function(){};
window.abrirDia       = typeof abrirDia       !== 'undefined' ? abrirDia       : function(){};
window.togglePrio     = typeof togglePrio     !== 'undefined' ? togglePrio     : function(){};
window.addTarefa      = typeof addTarefa      !== 'undefined' ? addTarefa      : function(){};
window.addExplosao    = typeof addExplosao    !== 'undefined' ? addExplosao    : function(){};
window.renderCalendario = typeof renderCalendario !== 'undefined' ? renderCalendario : function(){};

window.rGestaoCeo = function() {
  // Restaura a seção onde o usuário estava; cai em 'dia' se nunca foi definida
  var secParaAbrir = (dados && dados.secAtiva) ? dados.secAtiva : 'dia';
  if(typeof gestaoShowSec === 'function') gestaoShowSec(secParaAbrir);
  if(typeof loadNuvem === 'function') loadNuvem();
};

// Chamado por rDash() sempre que uma proposta muda de status
// Atualiza a seção de planejamento ativa sem precisar que o usuário navegue nela
window.gestaoRefreshActive = function() {
  // Só age se o módulo de Gestão estiver visível na tela
  var gestaoSec = document.getElementById('gestao');
  if(!gestaoSec || !gestaoSec.classList.contains('on')) return;
  var secAtiva = (dados && dados.secAtiva) ? dados.secAtiva : null;
  if(secAtiva && typeof gestaoShowSec === 'function') gestaoShowSec(secAtiva);
};

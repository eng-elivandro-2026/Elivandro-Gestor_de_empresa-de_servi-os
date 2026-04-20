// ══ Módulo Gestão CEO (inline) ══ v2
// Migrado de gestao.html — usa window.sbClient compartilhado
var _sb = window.sbClient; // usa cliente global
// Debounce para não salvar a cada tecla

let _saveTimer = null;

function sbSaveGestao(dados) {

  clearTimeout(_saveTimer);

  _saveTimer = setTimeout(async function() {

    try {

      await _sb.from('configuracoes').upsert({

        chave: 'tf_planejador',

        valor: dados,

        updated_at: new Date().toISOString()

      }, { onConflict: 'chave' });

    } catch(e) {

      console.warn('[gestao-sync] erro ao salvar:', e);

    }

  }, 800);

}



async function sbLoadGestao() {

  try {

    const res = await _sb.from('configuracoes')

      .select('valor')

      .eq('chave', 'tf_planejador')

      .single();

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

let dados = {

  dias:{},          // chave: 'YYYY-MM-DD' → {prios,tarefas,abertos,reflexao,explosoes}

  diaAtivo:'',      // data sendo visualizada

  ciclos:[],

  followups:[],

  visitas:[],

  kpi:{env:0,apr:0,val:0,acum:0,dep:0},

  funil:[],

  equipe:[],

  crescimento:'',

  proxPasso:'',

  trim:{fat:2100000,dep:90},

  revVelocidade:'',

  revMudanca:'',

  checkContr:[],

  theme:'dark'

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

  dados=Object.assign(dados,parsed);

}



function load(){

  // Carregar localStorage como fallback imediato

  const s=localStorage.getItem('tf_planejador');

  if(s)try{ applyDados(JSON.parse(s)); }catch(e){}

}



function save(){

  // Salva localStorage + nuvem

  localStorage.setItem('tf_planejador',JSON.stringify(dados));

  if(typeof sbSaveGestao==='function') sbSaveGestao(dados);

}



async function loadNuvem(){

  try {

    const cloud = await sbLoadGestao();

    if(cloud){

      applyDados(cloud);

      localStorage.setItem('tf_planejador',JSON.stringify(dados));

      // Re-renderizar tudo com dados da nuvem

      if(typeof init==='function') init();

      console.log('%c[gestao] dados carregados da nuvem','color:#F05A1A;font-weight:700');

    }

  } catch(e){ console.warn('[gestao] erro ao carregar nuvem:', e); }

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

  renderCiclos();

  renderFollowups();

  renderVisitas();

  renderKPIs();

  renderFunil();

  renderEquipe();

  renderTrim();

  renderFabricantes();

  if(dados.crescimento)document.getElementById('crescimento-mes').value=dados.crescimento;

  if(dados.proxPasso)document.getElementById('prox-passo').value=dados.proxPasso;

  if(dados.revVelocidade)document.getElementById('rev-velocidade').value=dados.revVelocidade;

  if(dados.revMudanca)document.getElementById('rev-mudanca').value=dados.revMudanca;

  renderCheckContr();

  // Pré-carrega cache do Motor de Decisão em background
  setTimeout(function(){ getOrRunDecisionEngine(); }, 500);

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
  if(id==='semana'){ renderSemana(); renderSugestoesIA('semana'); }
  if(id==='mes')   { renderKPIs();   renderSugestoesIA('mes'); }
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

function renderJanelas(){

  const now=new Date();

  const h=now.getHours()+now.getMinutes()/60;

  const janelas=[

    {id:'j-manha',hora:9.5,ids:'js-abertura',lbl:'Aberta'},

    {id:'j-meio',hora:12,ids:'js-meio',lbl:'Aberta'},

    {id:'j-tarde',hora:17,ids:'js-tarde',lbl:'Aberta'},

    {id:'j-fecha',hora:17.5,ids:'js-fecha',lbl:'Hora de fechar'}

  ];

  janelas.forEach(j=>{

    const el=document.getElementById(j.id);

    const sl=document.getElementById(j.ids);

    if(Math.abs(h-j.hora)<0.5){

      el.classList.add('ativa');

      if(sl)sl.textContent='🟢 Agora';

    } else if(h>j.hora+0.5){

      el.classList.add('passada');

    }

  });

}



// ===== ALERTAS =====

function renderAlertas(){

  const cont=document.getElementById('alertas-dia');

  cont.innerHTML='';

  const hoje=new Date();

  dados.equipe.forEach(p=>{

    ['aso','int','exam'].forEach(tipo=>{

      if(!p[tipo])return;

      const venc=new Date(p[tipo]);

      const diff=Math.ceil((venc-hoje)/(1000*60*60*24));

      const labels={aso:'ASO',int:'Integração',exam:'Exame médico'};

      if(diff<=7&&diff>=0){

        cont.innerHTML+=`<div class="alerta danger">⚠ <strong>${labels[tipo]} de ${p.nome}</strong> vence em ${diff} dia${diff!==1?'s':''}! Providenciar urgente.</div>`;

      } else if(diff<=30&&diff>=0){

        cont.innerHTML+=`<div class="alerta warn">⚠ <strong>${labels[tipo]} de ${p.nome}</strong> vence em ${diff} dias.</div>`;

      }

    });

  });

  dados.followups.forEach(f=>{

    const env=new Date(f.data);

    const diff=Math.ceil((hoje-env)/(1000*60*60*24));

    if(diff>=10){

      cont.innerHTML+=`<div class="alerta warn">📞 Follow-up ${f.num} — ${f.cliente} enviada há ${diff} dias sem resposta.</div>`;

    }

  });

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

function renderSemana(){

  const grid=document.getElementById('week-grid');grid.innerHTML='';

  const now=new Date();

  const dow=now.getDay();

  const monday=new Date(now);

  monday.setDate(now.getDate()-(dow===0?6:dow-1));

  const dias=['Seg','Ter','Qua','Qui','Sex'];

  const jiu=[1,3,5];

  const blocos=[

    [{tipo:'jiu',txt:'Jiu-jitsu'},{tipo:'fazer',txt:'Foco — Proposta'}],

    [{tipo:'mover',txt:'Visitas / Campo'},{tipo:'mover',txt:'Reuniões / Follow-up'}],

    [{tipo:'jiu',txt:'Jiu-jitsu'},{tipo:'fazer',txt:'Foco — Proposta'}],

    [{tipo:'mover',txt:'Visitas / Campo'},{tipo:'mover',txt:'Cliente fixo'}],

    [{tipo:'jiu',txt:'Jiu-jitsu'},{tipo:'fazer',txt:'Proposta — manhã'},{tipo:'construir',txt:'CEO — tarde'}]

  ];

  for(let i=0;i<5;i++){

    const d=new Date(monday);d.setDate(monday.getDate()+i);

    const isToday=d.toDateString()===now.toDateString();

    const div=document.createElement('div');

    div.className='week-day'+(isToday?' today':'');

    let blHTML='';

    blocos[i].forEach(b=>{

      const cls='wd-'+b.tipo;

      blHTML+=`<div class="wd-block ${cls}">${b.txt}</div>`;

    });

    div.innerHTML=`<div class="wd-hdr"><span class="wd-name">${dias[i]}</span><span class="wd-date">${d.getDate()}/${d.getMonth()+1}</span></div><div class="wd-body">${blHTML}</div>`;

    grid.appendChild(div);

  }

  const monday2=new Date(monday);

  const friday=new Date(monday2);friday.setDate(monday2.getDate()+4);

  const meses=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

  document.getElementById('semana-periodo').textContent=`${monday2.getDate()} ${meses[monday2.getMonth()]} — ${friday.getDate()} ${meses[friday.getMonth()]}`;

}



// ===== CICLOS =====

function renderCiclos(){

  const list=document.getElementById('ciclos-list');

  if(!list)return;

  if(!dados.ciclos.length){list.innerHTML='<div class="empty">Nenhuma proposta em andamento</div>';return;}

  list.innerHTML='';

  const fases=['','Visita técnica','Organizar campo','Levantar materiais','Escopo e cronograma','Aguardando cotações','Valores e margens','Revisão final','Envio da proposta'];

  dados.ciclos.forEach((c,i)=>{

    const pct=Math.round((c.dia/8)*100);

    const div=document.createElement('div');

    div.className='ciclo-item';

    div.innerHTML=`<div class="ciclo-num">${c.num}</div>

    <div class="ciclo-body">

      <div class="ciclo-cliente">${c.cliente}</div>

      <div class="ciclo-fase">${fases[c.dia]||'Dia '+c.dia}</div>

      <div class="ciclo-progress"><div class="ciclo-bar" style="width:${pct}%"></div></div>

    </div>

    <div style="text-align:right">

      <div class="ciclo-dia">Dia ${c.dia}/8</div>

      ${c.valor?`<div style="font-size:.68rem;color:var(--green)">R$ ${Number(c.valor).toLocaleString('pt-BR')}</div>`:''}

    </div>

    <button class="task-del" onclick="delCiclo(${i})">✕</button>`;

    list.appendChild(div);

  });

}

function salvarCiclo(){

  const num=document.getElementById('mc-num').value.trim();

  const cliente=document.getElementById('mc-cliente').value.trim();

  if(!num||!cliente)return;

  dados.ciclos.push({num,cliente,dia:parseInt(document.getElementById('mc-fase').value),valor:document.getElementById('mc-valor').value});

  save();renderCiclos();fecharModal('m-ciclo');toast('Proposta adicionada ao ciclo');

}

function delCiclo(i){dados.ciclos.splice(i,1);save();renderCiclos();}



// ===== FOLLOWUPS =====

function renderFollowups(){

  const list=document.getElementById('followups-list');

  if(!list)return;

  if(!dados.followups.length){list.innerHTML='<div class="empty">Nenhum follow-up pendente</div>';return;}

  list.innerHTML='';

  const hoje=new Date();

  dados.followups.forEach((f,i)=>{

    const env=new Date(f.data);

    const diff=Math.ceil((hoje-env)/(1000*60*60*24));

    const cls=diff>=10?'danger':diff>=5?'warn':'ok';

    const div=document.createElement('div');

    div.className='fu-item';

    div.innerHTML=`<div class="fu-dias ${cls}">${diff}d</div>

    <div class="fu-body">

      <div class="fu-prop">${f.num} — ${f.cliente}</div>

      <div class="fu-cliente">${f.servico}${f.valor?` · R$ ${Number(f.valor).toLocaleString('pt-BR')}`:''}</div>

    </div>

    <span class="bdg ${cls==='danger'?'b-danger':cls==='warn'?'b-warn':'b-ok'}">${cls==='danger'?'Atrasado':cls==='warn'?'Atenção':'OK'}</span>

    <button class="task-del" onclick="delFollowup(${i})">✕</button>`;

    list.appendChild(div);

  });

}

function salvarFollowup(){

  const num=document.getElementById('mf-num').value.trim();

  const cliente=document.getElementById('mf-cliente').value.trim();

  const data=document.getElementById('mf-data').value;

  if(!num||!cliente||!data)return;

  dados.followups.push({num,cliente,data,servico:document.getElementById('mf-servico').value,valor:document.getElementById('mf-valor').value});

  save();renderFollowups();renderAlertas();fecharModal('m-followup');toast('Follow-up adicionado');

}

function delFollowup(i){dados.followups.splice(i,1);save();renderFollowups();}



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

  const k=dados.kpi;

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

  dados.kpi.env=parseInt(document.getElementById('mk-env').value)||0;

  dados.kpi.apr=parseInt(document.getElementById('mk-apr').value)||0;

  dados.kpi.val=parseFloat(document.getElementById('mk-val').value)||0;

  dados.kpi.acum=parseFloat(document.getElementById('mk-acum').value)||0;

  dados.kpi.dep=parseFloat(document.getElementById('mk-dep').value)||0;

  dados.trim.fat=parseFloat(document.getElementById('mtr-fat').value)||0;

  dados.trim.dep=dados.kpi.dep;

  save();renderKPIs();renderTrim();fecharModal('m-atualizar');toast('Dados atualizados');

}

function abrirModalAtualizar(){

  document.getElementById('mk-env').value=dados.kpi.env||'';

  document.getElementById('mk-apr').value=dados.kpi.apr||'';

  document.getElementById('mk-val').value=dados.kpi.val||'';

  document.getElementById('mk-acum').value=dados.kpi.acum||'';

  document.getElementById('mk-dep').value=dados.kpi.dep||'';

  document.getElementById('mtr-fat').value=dados.trim.fat||dados.kpi.acum||'';

  abrirModal('m-atualizar');

}

function salvarKPI(){salvarDados();}

function abrirModalKPI(){abrirModalAtualizar();}



// ===== FUNIL =====

function renderFunil(){

  const list=document.getElementById('funil-list');

  if(!list)return;

  if(!dados.funil.length){list.innerHTML='<div class="empty">Nenhuma proposta no funil</div>';return;}

  list.innerHTML='';

  const hoje=new Date();

  const statusCls={enviada:'b-info',negociando:'b-warn',aguardando:'b-warn',aprovada:'b-ok',perdida:'b-danger'};

  const statusNome={enviada:'Enviada',negociando:'Negociando',aguardando:'Aguardando',aprovada:'Aprovada',perdida:'Perdida'};

  dados.funil.forEach((f,i)=>{

    const env=new Date(f.data+'T12:00:00');

    const diff=Math.ceil((hoje-env)/(1000*60*60*24));

    const div=document.createElement('div');

    div.className='funil-item';

    div.innerHTML=`<div class="funil-num">${f.num}</div>

    <div class="funil-body">

      <div class="funil-cliente">${f.cliente}</div>

      <div class="funil-desc">${f.servico}${f.valor?` · R$ ${Number(f.valor).toLocaleString('pt-BR')}`:''}</div>

    </div>

    <div style="text-align:right;flex-shrink:0">

      <span class="bdg ${statusCls[f.status]||'b-muted'}">${statusNome[f.status]||f.status}</span>

      <div class="funil-dias" style="margin-top:.2rem;color:${diff>30?'var(--red)':diff>14?'var(--accent)':'var(--text3)'}">${diff}d</div>

    </div>

    <button class="task-del" onclick="delFunil(${i})">✕</button>`;

    list.appendChild(div);

  });

}

function salvarFunil(){

  const num=document.getElementById('mfun-num').value.trim();

  const cliente=document.getElementById('mfun-cliente').value.trim();

  const data=document.getElementById('mfun-data').value;

  if(!num||!cliente||!data)return;

  dados.funil.push({num,cliente,data,servico:document.getElementById('mfun-servico').value,valor:document.getElementById('mfun-valor').value,status:document.getElementById('mfun-status').value});

  save();renderFunil();fecharModal('m-funil');toast('Proposta adicionada ao funil');

}

function delFunil(i){dados.funil.splice(i,1);save();renderFunil();}



// ===== EQUIPE =====

function renderEquipe(){

  const list=document.getElementById('conf-list');

  if(!list)return;

  if(!dados.equipe.length){list.innerHTML='<div class="empty">Nenhum membro cadastrado</div>';return;}

  list.innerHTML='';

  const hoje=new Date();

  dados.equipe.forEach((p,i)=>{

    const initials=p.nome.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();

    const badges=[];

    ['aso','int','exam'].forEach(tipo=>{

      if(!p[tipo])return;

      const venc=new Date(p[tipo]);

      const diff=Math.ceil((venc-hoje)/(1000*60*60*24));

      const labels={aso:'ASO',int:'Integr.',exam:'Exame'};

      const mes=venc.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});

      const cls=diff<0?'b-danger':diff<=30?'b-warn':'b-ok';

      badges.push(`<span class="bdg ${cls}">${labels[tipo]} ${mes}</span>`);

    });

    const div=document.createElement('div');

    div.className='conf-item';

    div.innerHTML=`<div class="conf-ava">${initials}</div>

    <div class="conf-name">${p.nome}<div style="font-size:.65rem;color:var(--text3)">${p.func||''}</div></div>

    <div class="conf-badges">${badges.join('')}</div>

    <button class="task-del" onclick="delEquipe(${i})">✕</button>`;

    list.appendChild(div);

  });

}

function salvarEquipe(){

  const nome=document.getElementById('me-nome').value.trim();

  if(!nome)return;

  dados.equipe.push({nome,func:document.getElementById('me-func').value,aso:document.getElementById('me-aso').value,int:document.getElementById('me-int').value,exam:document.getElementById('me-exam').value});

  save();renderEquipe();renderAlertas();fecharModal('m-equipe');toast('Membro adicionado');

  ['me-nome','me-func','me-aso','me-int','me-exam'].forEach(id=>{document.getElementById(id).value='';});

}

function delEquipe(i){dados.equipe.splice(i,1);save();renderEquipe();}



// ===== CRESCIMENTO =====

function saveCrescimento(){dados.crescimento=document.getElementById('crescimento-mes').value;save();}

function saveProxPasso(){dados.proxPasso=document.getElementById('prox-passo').value;save();}



// ===== TRIMESTRE =====

function renderTrim(){

  const t=dados.trim;

  const dep=t.dep||90;

  // Usa receita real do Motor de Decisão se disponível; senão cai em dados.trim.fat
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

    const done=dados.checkContr&&dados.checkContr[i];

    el.classList.toggle('done',!!done);

    const chk=el.querySelector('.task-check');

    chk.classList.toggle('checked',!!done);

    chk.textContent=done?'✓':'';

  });

}

function toggleCheckContr(el){

  const items=[...document.querySelectorAll('#check-contrat .task-item')];

  const i=items.indexOf(el);

  if(!dados.checkContr)dados.checkContr=[];

  dados.checkContr[i]=!dados.checkContr[i];

  save();renderCheckContr();

}



// ===== SAVE REV TRIM =====

function saveRevTrim(tipo){

  if(tipo==='velocidade')dados.revVelocidade=document.getElementById('rev-velocidade').value;

  else dados.revMudanca=document.getElementById('rev-mudanca').value;

  save();

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

          chave:'tf_planejador',

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

if(typeof loadNuvem==="function") loadNuvem();

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

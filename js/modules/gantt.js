// ── Gantt: acesso e persistência ─────────────────────────────────────────────
var GANTT_NOTA_DEFAULT='⚠️ Esse cronograma é apenas uma referência, visão macro. Após recebimento do pedido de compra, as datas e sequências das tarefas sofrerão variações.';

function getGantt(){
  var p=props.find(function(x){return x.id===editId;});
  if(!p){
    if(!_tempGantt)_tempGantt={inicio:'',fases:[],trabSab:false,trabDom:false,feriados:[],nota:GANTT_NOTA_DEFAULT};
    return _tempGantt;
  }
  if(!p.gantt)p.gantt={inicio:'',fases:[],trabSab:false,trabDom:false,feriados:[],nota:GANTT_NOTA_DEFAULT};
  if(p.gantt.trabSab===undefined)p.gantt.trabSab=false;
  if(p.gantt.trabDom===undefined)p.gantt.trabDom=false;
  if(!p.gantt.feriados)p.gantt.feriados=[];
  if(p.gantt.nota===undefined)p.gantt.nota=GANTT_NOTA_DEFAULT;
  return p.gantt;
}
function saveGantt(g){
  var idx=props.findIndex(function(x){return x.id===editId;});
  if(idx<0){_tempGantt=g;return;}
  props[idx].gantt=g;
  saveAll();
}

// ── Duração em dias úteis ─────────────────────────────────────────────────────
function ganttDurDias(f){
  if(f.unidade==='horas') return Math.max(0.5,Math.ceil((f.durHoras||1)/8*2)/2);
  return Math.max(0.5,f.dur||1);
}

// ── Recalcula offsets com suporte a dependências ──────────────────────────────
// Tipos de relação (rel):
//   'fs'  — Finish-to-Start: começa após anterior terminar (+ lag dias)
//   'ss'  — Start-to-Start : começa junto com anterior   (+ lag dias)
// lag > 0 = delay (espera N dias a mais)
// lag < 0 = sobreposição (começa N dias antes do ponto de referência)
function ganttRecalcOffsets(g){
  var fases=g.fases||[];
  fases.forEach(function(f,fi){
    if(fi===0){ f.offset=0; return; }
    var prev=fases[fi-1];
    var rel=f.rel||'fs';
    var lag=Number(f.lag)||0;
    var prevOff=prev.offset||0;
    var prevDur=ganttDurDias(prev);
    if(rel==='ss'){
      f.offset=Math.max(0, prevOff+lag);
    } else { // fs (padrão)
      f.offset=Math.max(0, prevOff+prevDur+lag);
    }
  });
}

// ── Calendário BR ─────────────────────────────────────────────────────────────
var FERIADOS_BR_FIXOS=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'];
function feriadosMoveisAno(ano){
  var a=ano%19,b=Math.floor(ano/100),c=ano%100,d=Math.floor(b/4),e=b%4;
  var f=Math.floor((b+8)/25),gg=Math.floor((b-f+1)/3),h=(19*a+b-d-gg+15)%30;
  var i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  var mes=Math.floor((h+l-7*m+114)/31),dia=(h+l-7*m+114)%31+1;
  var pascoa=new Date(ano,mes-1,dia);
  function aD(d,n){var r=new Date(d);r.setDate(r.getDate()+n);return r;}
  function tk(d){return (d.getMonth()+1+'').padStart(2,'0')+'-'+(d.getDate()+'').padStart(2,'0');}
  return[tk(aD(pascoa,-48)),tk(aD(pascoa,-47)),tk(aD(pascoa,-2)),tk(pascoa),tk(aD(pascoa,60))];
}
function isFeriado(dt,g){
  var ano=dt.getFullYear(),mmdd=(dt.getMonth()+1+'').padStart(2,'0')+'-'+(dt.getDate()+'').padStart(2,'0');
  var yyyymmdd=ano+'-'+mmdd;
  if(FERIADOS_BR_FIXOS.indexOf(mmdd)>=0)return true;
  if(feriadosMoveisAno(ano).indexOf(mmdd)>=0)return true;
  var lista=g.feriados||[];
  for(var i=0;i<lista.length;i++){var fk=(lista[i].data||'').trim();if(fk===yyyymmdd||fk===mmdd)return true;}
  return false;
}
function isDiaUtil(dt,g){
  var dow=dt.getDay();
  if(dow===6&&!g.trabSab)return false;
  if(dow===0&&!g.trabDom)return false;
  return !isFeriado(dt,g);
}
function proxDiaUtil(d,g){var r=new Date(d);while(!isDiaUtil(r,g))r.setDate(r.getDate()+1);return r;}
function addDiasUteis(d,n,g){
  var nInt=Math.ceil(n-0.001);
  var r=proxDiaUtil(d,g);
  var c=0;
  while(c<nInt){r.setDate(r.getDate()+1);if(isDiaUtil(r,g))c++;}
  return r;
}
function faseInicio(inicio,off,g){return addDiasUteis(inicio,off,g);}
function faseFim(dtIni,dur,g){if(dur<=1)return new Date(dtIni);return addDiasUteis(dtIni,dur-1,g);}
function diasCorridosEntre(d1,d2){return Math.round((d2-d1)/(1000*60*60*24));}

// ── Editor HTML ───────────────────────────────────────────────────────────────
function ganttEditorHTML(si){
  var g=getGantt();
  ganttRecalcOffsets(g);
  var fases=g.fases||[];
  var CORES=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];

  var INP='padding:.42rem .5rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:inherit;font-size:.95rem;width:100%';
  var SEL='padding:.42rem .4rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:inherit;font-size:.88rem';

  // Mapa de labels para relações
  var REL_LABELS={'fs':'Após terminar','ss':'Junto com (SS)'};

  var rows=fases.map(function(f,fi){
    var cor=f.cor||CORES[fi%CORES.length];
    var unidade=f.unidade||'dias';
    var durVal=unidade==='horas'?(f.durHoras||8):(f.dur||1);
    var rel=f.rel||'fs';
    var lag=Number(f.lag)||0;
    var isFirst=fi===0,isLast=fi===fases.length-1;

    // Label de relação para exibição na barra
    var relLabel='';
    if(fi>0){
      if(rel==='ss') relLabel='junto c/ anterior';
      else if(lag>0) relLabel='após '+lag+'d extra';
      else if(lag<0) relLabel=(Math.abs(lag))+'d antes de terminar';
      else relLabel='sequencial';
    }

    // Controles de dependência (apenas para tarefas não-primeiras)
    var depRow='';
    if(fi>0){
      depRow='<div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-top:.3rem;padding:.3rem .5rem;background:var(--bg3);border-radius:5px;border:1px dashed var(--border)">'
        +'<span style="font-size:.72rem;color:var(--text3);white-space:nowrap">↳ Relação com anterior:</span>'
        +'<select style="'+SEL+';flex:0 0 auto" onchange="ganttUpdRel('+fi+',this.value)">'
        +'<option value="fs"'+(rel==='fs'?' selected':'')+'>⬇ Após terminar</option>'
        +'<option value="ss"'+(rel==='ss'?' selected':'')+'>⇉ Junto com (início juntos)</option>'
        +'</select>'
        +'<span style="font-size:.72rem;color:var(--text3);white-space:nowrap">Lag (dias úteis):</span>'
        +'<input type="number" value="'+lag+'" step="1"'
        +' title="Positivo = aguardar N dias. Negativo = começar N dias antes do ponto de referência."'
        +' style="'+INP+';width:64px;text-align:center"'
        +' oninput="ganttUpdLag('+fi+',+this.value)">'
        +'<span style="font-size:.68rem;color:var(--text3);font-style:italic">'
        +(lag>0?'⏳ +'+lag+'d depois':(lag<0?'⚡ '+Math.abs(lag)+'d overlap':'0 = imediato'))
        +'</span>'
        +'</div>';
    }

    return '<div class="gantt-row" style="padding:.5rem 0;border-bottom:1px solid var(--border)">'
      +'<div style="display:grid;grid-template-columns:auto 1fr auto auto auto auto;align-items:center;gap:.4rem">'
      +'<div style="display:flex;flex-direction:column;gap:2px">'
      +'<button onclick="ganttMover('+fi+',-1)" class="nb" style="font-size:.6rem;padding:.1rem .22rem;opacity:'+(isFirst?.25:1)+'" '+(isFirst?'disabled':'')+'>▲</button>'
      +'<button onclick="ganttMover('+fi+',1)"  class="nb" style="font-size:.6rem;padding:.1rem .22rem;opacity:'+(isLast?.25:1)+'"  '+(isLast?'disabled':'')+'>▼</button>'
      +'</div>'
      +'<input type="text" value="'+esc(f.nome||'')+'" placeholder="Nome da tarefa" style="'+INP+'" oninput="ganttUpd('+fi+',\'nome\',this.value)">'
      +'<input type="number" value="'+durVal+'" min="1" step="1" style="'+INP+';width:64px;text-align:center" oninput="ganttUpdDur('+fi+',+this.value)">'
      +'<select style="'+SEL+'" onchange="ganttUpdUnidade('+fi+',this.value)">'
      +'<option value="dias"'+(unidade==='dias'?' selected':'')+'>dias</option>'
      +'<option value="horas"'+(unidade==='horas'?' selected':'')+'>horas</option>'
      +'</select>'
      +'<input type="color" value="'+cor+'" style="width:34px;height:38px;padding:2px;border:1px solid var(--border);border-radius:5px;cursor:pointer" oninput="ganttUpd('+fi+',\'cor\',this.value)">'
      +'<button onclick="ganttDel('+fi+')" class="nb" style="color:var(--red);font-size:1.1rem;padding:.2rem .4rem">×</button>'
      +'</div>'
      +depRow
      +'</div>';
  }).join('');

  var header='<div style="display:grid;grid-template-columns:auto 1fr auto auto auto auto;gap:.4rem;padding:.3rem 0;font-size:.68rem;color:var(--text3);font-weight:700;text-transform:uppercase;border-bottom:2px solid var(--border)">'
    +'<div></div><div>Tarefa</div><div style="text-align:center">Qtd</div><div>Unidade</div><div>Cor</div><div></div>'
    +'</div>';

  var configUteis='<details id="ganttCalDetails" style="margin-top:.75rem">'
    +'<summary style="font-size:.82rem;font-weight:700;color:var(--text2);cursor:pointer;padding:.3rem 0">⚙️ Configurações de calendário</summary>'
    +'<div style="margin-top:.5rem">'
    +'<div style="display:flex;gap:1.2rem;flex-wrap:wrap;margin-bottom:.55rem">'
    +'<label style="display:flex;align-items:center;gap:.4rem;font-size:.88rem;cursor:pointer"><input type="checkbox" '+(g.trabSab?'checked':'')+' onchange="ganttCfg(\'trabSab\',this.checked)" style="width:18px;height:18px"> Trabalha Sábado</label>'
    +'<label style="display:flex;align-items:center;gap:.4rem;font-size:.88rem;cursor:pointer"><input type="checkbox" '+(g.trabDom?'checked':'')+' onchange="ganttCfg(\'trabDom\',this.checked)" style="width:18px;height:18px"> Trabalha Domingo</label>'
    +'</div>'
    +'<div style="font-size:.78rem;color:var(--text3);margin-bottom:.4rem">Feriados municipais / estaduais adicionais:</div>'
    +'<div id="ganttFerList">'+ganttFerListHTML(g)+'</div>'
    +'<button onclick="ganttFerAdd()" class="btn bg bsm" style="margin-top:.3rem">+ Feriado</button>'
    +'</div>'
    +'</details>';

  // Nota/aviso
  var notaHtml='<div style="margin-top:.75rem">'
    +'<div style="font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:.25rem">📌 Nota / aviso (aparece na proposta)</div>'
    +'<textarea style="width:100%;padding:.45rem .6rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text2);font-size:.88rem;font-family:inherit;min-height:56px;resize:vertical" oninput="ganttUpdNota(this.value)">'+esc(g.nota||GANTT_NOTA_DEFAULT)+'</textarea>'
    +'</div>';

  var prev=buildGanttPrev(g);

  return '<div id="ganttEditorWrap" style="margin-top:.8rem;border:2px solid var(--accent);border-radius:10px;padding:.9rem;background:var(--bg3)">'
    +'<div style="font-weight:700;font-size:.9rem;color:var(--accent);margin-bottom:.6rem">📅 Cronograma de tarefas</div>'
    +'<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.65rem">'
    +'<label style="font-size:.9rem;color:var(--text2);display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">'
    +'<span style="white-space:nowrap">📆 Data de início:</span>'
    +'<input type="date" value="'+(g.inicio||'')+'"'
    +' style="padding:.4rem .6rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:1rem"'
    +' onchange="ganttIni(this.value)"></label>'
    +'<button onclick="ganttAdd()" class="btn ba" style="font-size:.9rem;padding:.45rem 1rem">+ Tarefa</button>'
    +'</div>'
    +(fases.length ? header+rows : '<div style="font-size:.9rem;color:var(--text3);font-style:italic;padding:.5rem 0">Nenhuma tarefa. Clique em "+ Tarefa" para começar.</div>')
    +'<div id="ganttPrev" style="margin-top:.8rem">'+prev+'</div>'
    +notaHtml
    +configUteis
    +'</div>';
}

// ── Helpers de feriados e re-render ──────────────────────────────────────────
function ganttFerListHTML(g){
  return (g.feriados||[]).map(function(f,fi){
    return '<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem">'
      +'<input type="date" value="'+esc(f.data||'')+'" style="flex:0 0 auto;padding:.35rem .4rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:.85rem" onchange="ganttFerData('+fi+',this.value)">'
      +'<input type="text" value="'+esc(f.nome||'')+'" placeholder="Ex: Corpus Christi" style="flex:1;padding:.35rem .5rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:.85rem" oninput="ganttFerNome('+fi+',this.value)">'
      +'<button onclick="ganttFerDel('+fi+')" class="nb" style="color:var(--red);flex-shrink:0">×</button>'
      +'</div>';
  }).join('');
}
function ganttFerListRefresh(){
  var g=getGantt();
  var el=Q('ganttFerList');
  if(el) el.innerHTML=ganttFerListHTML(g);
}
function ganttReRender(){
  var wrap=Q('ganttEditorWrap');
  if(!wrap){rEsc();return;}
  // Preserve <details open> state before replacing HTML
  var details=wrap.querySelector('#ganttCalDetails');
  var calWasOpen=details&&details.open;
  wrap.outerHTML=ganttEditorHTML(0);
  if(calWasOpen){
    var newDetails=Q('ganttCalDetails');
    if(newDetails) newDetails.open=true;
  }
}

// ── Funções de mutação ────────────────────────────────────────────────────────
function ganttRefreshPrev(){
  var g=getGantt();
  ganttRecalcOffsets(g);
  var el=Q('ganttPrev');
  if(el) el.innerHTML=buildGanttPrev(g);
}
function ganttUpd(fi,campo,val){
  var g=getGantt();
  if(!g.fases[fi])return;
  g.fases[fi][campo]=val;
  ganttRecalcOffsets(g);
  saveGantt(g);
  ganttRefreshPrev();
}
function ganttUpdDur(fi,val){
  var g=getGantt();
  if(!g.fases[fi])return;
  var f=g.fases[fi];
  if(f.unidade==='horas'){ f.durHoras=Math.max(1,val); f.dur=Math.max(0.5,Math.ceil(val/8*2)/2); }
  else { f.dur=Math.max(0.5,val); }
  ganttRecalcOffsets(g);
  saveGantt(g);
  ganttRefreshPrev();
}
function ganttUpdUnidade(fi,unidade){
  var g=getGantt();
  if(!g.fases[fi])return;
  var f=g.fases[fi];
  f.unidade=unidade;
  if(unidade==='horas'&&!f.durHoras) f.durHoras=(f.dur||1)*8;
  if(unidade==='dias'&&!f.dur)       f.dur=Math.ceil((f.durHoras||8)/8);
  ganttRecalcOffsets(g);
  saveGantt(g);
  ganttReRender();
}
function ganttUpdRel(fi,rel){
  var g=getGantt();
  if(!g.fases[fi])return;
  g.fases[fi].rel=rel;
  ganttRecalcOffsets(g);
  saveGantt(g);
  ganttRefreshPrev();
}
function ganttUpdLag(fi,val){
  var g=getGantt();
  if(!g.fases[fi])return;
  g.fases[fi].lag=val;
  ganttRecalcOffsets(g);
  saveGantt(g);
  ganttRefreshPrev();
}
function ganttUpdNota(val){
  var g=getGantt();
  g.nota=val;
  saveGantt(g);
}
function ganttIni(v){var g=getGantt();g.inicio=v;saveGantt(g);ganttRefreshPrev();}
function ganttCfg(campo,val){var g=getGantt();g[campo]=val;saveGantt(g);ganttRefreshPrev();}
function ganttAdd(){
  var g=getGantt();
  var fases=g.fases||[];
  var CORES=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];
  fases.push({id:uid(),nome:'Nova Tarefa',dur:1,unidade:'dias',durHoras:8,cor:CORES[fases.length%CORES.length],offset:0,rel:'fs',lag:0});
  g.fases=fases;
  ganttRecalcOffsets(g);
  saveGantt(g);
  ganttReRender();
}
function ganttDel(fi){
  var g=getGantt();
  g.fases.splice(fi,1);
  ganttRecalcOffsets(g);
  saveGantt(g);
  ganttReRender();
}
function ganttMover(fi,dir){
  var g=getGantt();
  var fases=g.fases;
  var ni=fi+dir;
  if(ni<0||ni>=fases.length)return;
  var tmp=fases[fi];fases[fi]=fases[ni];fases[ni]=tmp;
  g.fases=fases;
  ganttRecalcOffsets(g);
  saveGantt(g);
  ganttReRender();
}
function ganttFerAdd(){var g=getGantt();if(!g.feriados)g.feriados=[];g.feriados.push({data:'',nome:''});saveGantt(g);ganttFerListRefresh();}
function ganttFerDel(fi){var g=getGantt();g.feriados.splice(fi,1);saveGantt(g);ganttFerListRefresh();}
function ganttFerData(fi,v){var g=getGantt();if(g.feriados[fi])g.feriados[fi].data=v;saveGantt(g);ganttRefreshPrev();}
function ganttFerNome(fi,v){var g=getGantt();if(g.feriados[fi])g.feriados[fi].nome=v;saveGantt(g);}

// ── Preview visual ────────────────────────────────────────────────────────────
function buildGanttPrev(g){
  if(!g||!g.fases||!g.fases.length)
    return '<div style="font-size:.85rem;color:var(--text3);font-style:italic">As barras aparecerão aqui conforme você adicionar tarefas.</div>';

  ganttRecalcOffsets(g);
  var fases=g.fases;
  var inicio=g.inicio?new Date(g.inicio+'T12:00:00'):null;
  function fmtDt(d){return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});}
  function fmtDur(f){
    var d=ganttDurDias(f);
    if(f.unidade==='horas') return (f.durHoras||8)+'h';
    return d+(d===1?' dia':' dias');
  }
  function relTag(f,fi){
    if(fi===0)return '';
    var rel=f.rel||'fs', lag=Number(f.lag)||0;
    if(rel==='ss') return lag===0?'⇉ junto':'⇉ SS '+(lag>0?'+':'')+lag+'d';
    if(lag>0) return '⏳ +'+lag+'d';
    if(lag<0) return '⚡ '+lag+'d';
    return '';
  }

  // Calcular datas reais
  var faseDatas=fases.map(function(f){
    if(!inicio)return null;
    var dtIni=faseInicio(inicio,f.offset||0,g);
    var dtFim=faseFim(dtIni,ganttDurDias(f),g);
    return{dtIni:dtIni,dtFim:dtFim};
  });
  var dtFimMax=inicio?new Date(inicio):null;
  if(inicio) faseDatas.forEach(function(fd){if(fd&&fd.dtFim>dtFimMax)dtFimMax=fd.dtFim;});
  var totalCorridos=inicio&&dtFimMax?Math.max(1,diasCorridosEntre(inicio,dtFimMax)+1):1;

  // Cabeçalho de meses
  var mesesHdr='';
  if(inicio&&dtFimMax){
    var cur=new Date(inicio.getFullYear(),inicio.getMonth(),1);
    var fim2=new Date(dtFimMax.getFullYear(),dtFimMax.getMonth()+1,1);
    var prev2=0;
    var meses=[];
    while(cur<fim2){
      var mEnd=new Date(Math.min(new Date(cur.getFullYear(),cur.getMonth()+1,0),dtFimMax));
      var pct=Math.min(100,(diasCorridosEntre(inicio,mEnd)+1)/totalCorridos*100);
      meses.push({lbl:cur.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}),pct:pct.toFixed(1)});
      cur.setMonth(cur.getMonth()+1);
    }
    mesesHdr='<div style="position:relative;height:18px;margin-bottom:4px;font-size:6.5pt;color:var(--text3)">';
    prev2=0;
    meses.forEach(function(m){
      var w=Math.max(0,parseFloat(m.pct)-prev2).toFixed(1);
      mesesHdr+='<div style="position:absolute;left:'+prev2+'%;width:'+w+'%;text-align:center;border-left:1px solid var(--border);overflow:hidden;white-space:nowrap;padding-left:2px">'+m.lbl+'</div>';
      prev2=parseFloat(m.pct);
    });
    mesesHdr+='</div>';
  }

  // Linhas
  var rows=fases.map(function(f,fi){
    var cor=f.cor||'#2563eb';
    var fd=faseDatas[fi];
    var dtIniStr=fd?fmtDt(fd.dtIni):'D+'+(f.offset||0);
    var dtFimStr=fd?fmtDt(fd.dtFim):'';
    var durLbl=fmtDur(f);
    var rt=relTag(f,fi);

    var offPct=0,durPct=10;
    if(inicio&&fd){
      var offCorr=diasCorridosEntre(inicio,fd.dtIni);
      var durCorr=Math.max(1,diasCorridosEntre(fd.dtIni,fd.dtFim)+1);
      offPct=Math.max(0,(offCorr/totalCorridos*100)).toFixed(1);
      durPct=Math.min(100-parseFloat(offPct),(durCorr/totalCorridos*100)).toFixed(1);
    } else {
      var totRaw=Math.max(1,(f.offset||0)+ganttDurDias(f));
      offPct=((f.offset||0)/totRaw*100).toFixed(1);
      durPct=(ganttDurDias(f)/totRaw*100).toFixed(1);
    }

    return '<div style="display:grid;grid-template-columns:minmax(80px,140px) 1fr auto;align-items:center;gap:5px;margin-bottom:5px">'
      +'<div style="font-size:7.5pt;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
      +(rt?'<span style="font-size:6pt;color:var(--accent);margin-right:2px">'+rt+'</span>':'')
      +esc(f.nome||'Tarefa')
      +'</div>'
      +'<div style="position:relative;height:18px;background:var(--bg2);border:1px solid var(--border);border-radius:4px;overflow:hidden">'
      +'<div style="position:absolute;left:'+offPct+'%;width:'+durPct+'%;height:100%;background:'+cor+';border-radius:3px;display:flex;align-items:center;justify-content:center">'
      +'<span style="font-size:6.5pt;color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;padding:0 3px">'+durLbl+'</span>'
      +'</div></div>'
      +'<div style="font-size:6.8pt;color:var(--text3);white-space:nowrap;text-align:right">'+(fd?dtIniStr+' → '+dtFimStr:'')+'</div>'
      +'</div>';
  }).join('');

  var nota=g.nota||GANTT_NOTA_DEFAULT;
  var notaHtml=nota
    ?'<div style="margin-top:.6rem;padding:.45rem .6rem;background:rgba(240,165,0,.08);border-left:3px solid var(--accent);border-radius:0 5px 5px 0;font-size:.78rem;color:var(--text2);font-style:italic">'+esc(nota)+'</div>'
    :'';

  var legenda=inicio&&dtFimMax
    ?'<div style="font-size:7.5pt;color:var(--text2);margin-bottom:5px;display:flex;gap:.5rem;flex-wrap:wrap">'
      +'<span>🗓 Início: <strong>'+fmtDt(inicio)+'</strong></span>'
      +'<span>🏁 Término: <strong>'+fmtDt(dtFimMax)+'</strong></span>'
      +'<span>📏 '+totalCorridos+' dias corridos</span>'
      +(g.trabSab?'':'<span style="color:var(--text3)">Sem sáb</span>')
      +(g.trabDom?'':'<span style="color:var(--text3)">/dom</span>')
      +'</div>'
    :'<div style="font-size:7.5pt;color:var(--text3);margin-bottom:4px">Configure a data de início para ver as datas reais ↑</div>';

  return '<div style="border-top:1px solid var(--border);padding-top:.65rem">'
    +'<div style="font-size:.75rem;font-weight:700;color:var(--text2);margin-bottom:.45rem">📊 Visualização</div>'
    +legenda+mesesHdr+rows+notaHtml
    +'</div>';
}

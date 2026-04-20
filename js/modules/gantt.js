// ── Gantt: acesso aos dados ──────────────────────────────────────────────────
function getGantt(){
  var p=props.find(function(x){return x.id===editId;});
  if(!p)return{inicio:'',fases:[],trabSab:false,trabDom:false,feriados:[]};
  if(!p.gantt)p.gantt={inicio:'',fases:[],trabSab:false,trabDom:false,feriados:[]};
  if(p.gantt.trabSab===undefined)p.gantt.trabSab=false;
  if(p.gantt.trabDom===undefined)p.gantt.trabDom=false;
  if(!p.gantt.feriados)p.gantt.feriados=[];
  return p.gantt;
}
function saveGantt(g){
  var idx=props.findIndex(function(x){return x.id===editId;});
  if(idx<0)return;
  props[idx].gantt=g;
  saveAll();
}

// ── Recalcula offsets sequencialmente (cada tarefa começa após a anterior) ──
function ganttRecalcOffsets(g){
  var acc=0;
  (g.fases||[]).forEach(function(f){
    f.offset=acc;
    acc+=ganttDurDias(f); // duração em dias úteis
  });
}

// Converte duração para dias úteis conforme unidade escolhida
function ganttDurDias(f){
  if(f.unidade==='horas'){
    return Math.max(0.5, Math.ceil((f.durHoras||1)/8*2)/2); // arredonda para 0.5d
  }
  return Math.max(0.5, f.dur||1);
}

// ── Calendário: feriados nacionais BR ────────────────────────────────────────
var FERIADOS_BR_FIXOS=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'];
function feriadosMoveisAno(ano){
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
  return[toKey(addD(pascoa,-48)),toKey(addD(pascoa,-47)),toKey(addD(pascoa,-2)),toKey(pascoa),toKey(addD(pascoa,60))];
}
function isFeriado(dt,g){
  var ano=dt.getFullYear();
  var mmdd=(dt.getMonth()+1+'').padStart(2,'0')+'-'+(dt.getDate()+'').padStart(2,'0');
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
  if(isFeriado(dt,g))return false;
  return true;
}
function proxDiaUtil(d,g){var r=new Date(d);while(!isDiaUtil(r,g))r.setDate(r.getDate()+1);return r;}
function addDiasUteis(d,n,g){
  var nInt=Math.ceil(n-0.001); // garante que 0.5 → 1 iteração
  var r=proxDiaUtil(d,g);
  var contados=0;
  while(contados<nInt){r.setDate(r.getDate()+1);if(isDiaUtil(r,g))contados++;}
  return r;
}
function faseInicio(inicio,offsetUteis,g){return addDiasUteis(inicio,offsetUteis,g);}
function faseFim(dtIni,durUteis,g){if(durUteis<=1)return new Date(dtIni);return addDiasUteis(dtIni,durUteis-1,g);}
function diasCorridosEntre(d1,d2){return Math.round((d2-d1)/(1000*60*60*24));}

// ── Editor de Gantt ──────────────────────────────────────────────────────────
function ganttEditorHTML(si){
  var g=getGantt();
  ganttRecalcOffsets(g); // garante offsets sequenciais
  var fases=g.fases||[];
  var inicio=g.inicio||'';
  var CORES=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];

  // Cada linha de tarefa
  var rows=fases.map(function(f,fi){
    var cor=f.cor||CORES[fi%CORES.length];
    var unidade=f.unidade||'dias';
    var durVal=unidade==='horas'?(f.durHoras||8):(f.dur||1);
    var isFirst=fi===0, isLast=fi===fases.length-1;

    var INP_STYLE='padding:.45rem .5rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:inherit;font-size:1rem;width:100%';
    var SEL_STYLE='padding:.45rem .4rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-family:inherit;font-size:1rem';

    return '<div class="gantt-row" style="display:grid;grid-template-columns:auto 1fr auto auto auto auto;align-items:center;gap:.4rem;padding:.5rem 0;border-bottom:1px solid var(--border)">'
      // Ordenação
      +'<div style="display:flex;flex-direction:column;gap:2px">'
      +'<button onclick="ganttMover('+fi+',-1)" class="nb" style="font-size:.65rem;padding:.1rem .25rem;opacity:'+(isFirst?.25:1)+'" '+(isFirst?'disabled':'')+'>▲</button>'
      +'<button onclick="ganttMover('+fi+',1)"  class="nb" style="font-size:.65rem;padding:.1rem .25rem;opacity:'+(isLast?.25:1)+'" '+(isLast?'disabled':'')+'>▼</button>'
      +'</div>'
      // Nome da tarefa
      +'<input type="text" value="'+esc(f.nome||'')+'" placeholder="Nome da tarefa"'
      +' style="'+INP_STYLE+'" oninput="ganttUpd('+fi+',\'nome\',this.value)">'
      // Duração (número)
      +'<input type="number" value="'+durVal+'" min="1" step="1"'
      +' style="'+INP_STYLE+';width:68px;text-align:center"'
      +' oninput="ganttUpdDur('+fi+',+this.value)">'
      // Unidade (dias/horas)
      +'<select style="'+SEL_STYLE+'" onchange="ganttUpdUnidade('+fi+',this.value)">'
      +'<option value="dias"'+(unidade==='dias'?' selected':'')+'>dias</option>'
      +'<option value="horas"'+(unidade==='horas'?' selected':'')+'>horas</option>'
      +'</select>'
      // Cor
      +'<input type="color" value="'+cor+'"'
      +' style="width:34px;height:38px;padding:2px;border:1px solid var(--border);border-radius:5px;cursor:pointer"'
      +' oninput="ganttUpd('+fi+',\'cor\',this.value)">'
      // Deletar
      +'<button onclick="ganttDel('+fi+')" class="nb" style="color:var(--red);font-size:1.1rem;padding:.2rem .4rem">×</button>'
      +'</div>';
  }).join('');

  // Cabeçalho das colunas
  var header='<div style="display:grid;grid-template-columns:auto 1fr auto auto auto auto;gap:.4rem;padding:.3rem 0;font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;border-bottom:2px solid var(--border)">'
    +'<div></div>'
    +'<div>Tarefa</div>'
    +'<div style="text-align:center">Qtd</div>'
    +'<div>Unidade</div>'
    +'<div>Cor</div>'
    +'<div></div>'
    +'</div>';

  // Config dias úteis
  var optSab=g.trabSab?'checked':'';
  var optDom=g.trabDom?'checked':'';
  var ferList=(g.feriados||[]).map(function(f,fi){
    return '<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.3rem">'
      +'<input type="date" value="'+esc(f.data||'')+'" style="flex:0 0 auto;padding:.35rem .4rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:.88rem" onchange="ganttFerData('+fi+',this.value)">'
      +'<input type="text" value="'+esc(f.nome||'')+'" placeholder="Ex: Corpus Christi" style="flex:1;padding:.35rem .5rem;background:var(--bg);border:1px solid var(--border);border-radius:5px;color:var(--text);font-size:.88rem" oninput="ganttFerNome('+fi+',this.value)">'
      +'<button onclick="ganttFerDel('+fi+')" class="nb" style="color:var(--red);flex-shrink:0">×</button>'
      +'</div>';
  }).join('');

  var configUteis='<details style="margin-top:.75rem">'
    +'<summary style="font-size:.82rem;font-weight:700;color:var(--text2);cursor:pointer;padding:.3rem 0">⚙️ Configurações de calendário</summary>'
    +'<div style="margin-top:.5rem">'
    +'<div style="display:flex;gap:1.2rem;flex-wrap:wrap;margin-bottom:.55rem">'
    +'<label style="display:flex;align-items:center;gap:.4rem;font-size:.9rem;cursor:pointer"><input type="checkbox" '+optSab+' onchange="ganttCfg(\'trabSab\',this.checked)" style="width:18px;height:18px"> Trabalha Sábado</label>'
    +'<label style="display:flex;align-items:center;gap:.4rem;font-size:.9rem;cursor:pointer"><input type="checkbox" '+optDom+' onchange="ganttCfg(\'trabDom\',this.checked)" style="width:18px;height:18px"> Trabalha Domingo</label>'
    +'</div>'
    +'<div style="font-size:.8rem;color:var(--text3);margin-bottom:.4rem">Feriados municipais / estaduais adicionais:</div>'
    +ferList
    +'<button onclick="ganttFerAdd()" class="btn bg bsm" style="margin-top:.3rem">+ Feriado</button>'
    +'</div>'
    +'</details>';

  var prev=buildGanttPrev(g);

  return '<div style="margin-top:.8rem;border:2px solid var(--accent);border-radius:10px;padding:.9rem;background:var(--bg3)">'
    +'<div style="font-weight:700;font-size:.9rem;color:var(--accent);margin-bottom:.6rem">📅 Cronograma de tarefas</div>'
    // Data de início
    +'<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:.65rem">'
    +'<label style="font-size:.9rem;color:var(--text2);display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">'
    +'<span style="white-space:nowrap">📆 Data de início:</span>'
    +'<input type="date" value="'+inicio+'"'
    +' style="padding:.4rem .6rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:inherit;font-size:1rem"'
    +' onchange="ganttIni(this.value)"></label>'
    +'<button onclick="ganttAdd()" class="btn ba" style="font-size:.9rem;padding:.45rem 1rem">+ Tarefa</button>'
    +'</div>'
    // Tabela de tarefas
    +(fases.length ? header+rows : '<div style="font-size:.9rem;color:var(--text3);font-style:italic;padding:.5rem 0">Nenhuma tarefa. Clique em "+ Tarefa" para começar.</div>')
    // Preview do Gantt
    +'<div id="ganttPrev" style="margin-top:.8rem">'+prev+'</div>'
    +configUteis
    +'</div>';
}

// ── Funções de mutação ───────────────────────────────────────────────────────
function ganttRefreshPrev(){
  var g=getGantt();
  ganttRecalcOffsets(g);
  var el=Q('ganttPrev');
  if(el)el.innerHTML=buildGanttPrev(g);
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
  rEsc(); // re-render para trocar o input
}

function ganttIni(v){var g=getGantt();g.inicio=v;saveGantt(g);ganttRefreshPrev();}
function ganttCfg(campo,val){var g=getGantt();g[campo]=val;saveGantt(g);ganttRefreshPrev();}

function ganttAdd(){
  var g=getGantt();
  var fases=g.fases||[];
  var CORES=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];
  fases.push({id:uid(),nome:'Nova Tarefa',dur:1,unidade:'dias',durHoras:8,cor:CORES[fases.length%CORES.length],offset:0});
  g.fases=fases;
  ganttRecalcOffsets(g);
  saveGantt(g);
  rEsc();
}

function ganttDel(fi){
  var g=getGantt();
  g.fases.splice(fi,1);
  ganttRecalcOffsets(g);
  saveGantt(g);
  rEsc();
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
  rEsc();
}

function ganttFerAdd(){var g=getGantt();if(!g.feriados)g.feriados=[];g.feriados.push({data:'',nome:''});saveGantt(g);rEsc();}
function ganttFerDel(fi){var g=getGantt();g.feriados.splice(fi,1);saveGantt(g);rEsc();}
function ganttFerData(fi,v){var g=getGantt();if(g.feriados[fi])g.feriados[fi].data=v;saveGantt(g);ganttRefreshPrev();}
function ganttFerNome(fi,v){var g=getGantt();if(g.feriados[fi])g.feriados[fi].nome=v;saveGantt(g);}

// ── Preview visual do Gantt ──────────────────────────────────────────────────
function buildGanttPrev(g){
  if(!g||!g.fases||!g.fases.length)
    return '<div style="font-size:.85rem;color:var(--text3);font-style:italic">As barras aparecerão aqui conforme você adicionar tarefas.</div>';

  ganttRecalcOffsets(g);
  var fases=g.fases;
  var inicio=g.inicio?new Date(g.inicio+'T12:00:00'):null;

  function fmtDt(d){return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit'});}
  function fmtDur(f){
    var d=ganttDurDias(f);
    if(f.unidade==='horas') return (f.durHoras||8)+'h (≈'+d+'d)';
    return d+(d===1?' dia':' dias');
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

  // Cabeçalho de datas (meses)
  var mesesHdr='';
  if(inicio&&dtFimMax){
    var cur=new Date(inicio.getFullYear(),inicio.getMonth(),1);
    var fim2=new Date(dtFimMax.getFullYear(),dtFimMax.getMonth()+1,1);
    var meses=[];
    while(cur<fim2){
      var mStart=new Date(Math.max(cur,inicio));
      var mEnd=new Date(Math.min(new Date(cur.getFullYear(),cur.getMonth()+1,0),dtFimMax));
      var pct=(diasCorridosEntre(inicio,mEnd)+1)/totalCorridos*100;
      var lbl=cur.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
      meses.push({lbl:lbl,pct:pct.toFixed(1)});
      cur.setMonth(cur.getMonth()+1);
    }
    var prev2=0;
    mesesHdr='<div style="position:relative;height:18px;margin-bottom:4px;font-size:7pt;color:var(--text3)">'
      +meses.map(function(m){
        var w=(parseFloat(m.pct)-prev2).toFixed(1);
        var left=prev2;
        prev2=parseFloat(m.pct);
        return '<div style="position:absolute;left:'+left+'%;width:'+w+'%;text-align:center;border-left:1px solid var(--border);overflow:hidden;white-space:nowrap;padding-left:2px">'+m.lbl+'</div>';
      }).join('')+'</div>';
  }

  // Linhas das tarefas
  var rows=fases.map(function(f,fi){
    var cor=f.cor||'#2563eb';
    var fd=faseDatas[fi];
    var dtIniStr=fd?fmtDt(fd.dtIni):'D+'+(f.offset||0);
    var dtFimStr=fd?fmtDt(fd.dtFim):'';
    var durLbl=fmtDur(f);

    var offPct=0,durPct=10;
    if(inicio&&fd){
      var offCorr=diasCorridosEntre(inicio,fd.dtIni);
      var durCorr=Math.max(1,diasCorridosEntre(fd.dtIni,fd.dtFim)+1);
      offPct=Math.max(0,(offCorr/totalCorridos*100)).toFixed(1);
      durPct=Math.min(100-parseFloat(offPct),(durCorr/totalCorridos*100)).toFixed(1);
    } else {
      var totRaw=(f.offset||0)+ganttDurDias(f);
      offPct=((f.offset||0)/Math.max(1,totRaw)*100).toFixed(1);
      durPct=(ganttDurDias(f)/Math.max(1,totRaw)*100).toFixed(1);
    }

    return '<div style="display:grid;grid-template-columns:minmax(80px,140px) 1fr auto;align-items:center;gap:5px;margin-bottom:5px">'
      // Nome
      +'<div style="font-size:8pt;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="'+esc(f.nome||'')+'">'+esc(f.nome||'Tarefa')+'</div>'
      // Barra
      +'<div style="position:relative;height:18px;background:var(--bg);border:1px solid var(--border);border-radius:4px;overflow:hidden">'
      +'<div style="position:absolute;left:'+offPct+'%;width:'+durPct+'%;height:100%;background:'+cor+';border-radius:3px;display:flex;align-items:center;justify-content:center">'
      +'<span style="font-size:6.5pt;color:#fff;font-weight:700;white-space:nowrap;overflow:hidden;padding:0 3px">'+durLbl+'</span>'
      +'</div></div>'
      // Datas
      +'<div style="font-size:7pt;color:var(--text3);white-space:nowrap;text-align:right">'
      +(fd?dtIniStr+' → '+dtFimStr:'')
      +'</div>'
      +'</div>';
  }).join('');

  var legenda=inicio&&dtFimMax
    ?'<div style="font-size:8pt;color:var(--text2);margin-bottom:6px;display:flex;gap:.6rem;flex-wrap:wrap">'
      +'<span>🗓 Início: <strong>'+fmtDt(inicio)+'</strong></span>'
      +'<span>🏁 Término: <strong>'+fmtDt(dtFimMax)+'</strong></span>'
      +'<span>📏 '+totalCorridos+' dias corridos</span>'
      +(g.trabSab?'':'<span style="color:var(--text3)">Sem sáb</span>')
      +(g.trabDom?'':'<span style="color:var(--text3)">/dom</span>')
      +'</div>'
    :'<div style="font-size:8pt;color:var(--text3);margin-bottom:4px">Configure a data de início para ver as datas reais ↑</div>';

  return '<div style="border-top:1px solid var(--border);padding-top:.65rem">'
    +'<div style="font-size:.78rem;font-weight:700;color:var(--text2);margin-bottom:.5rem">📊 Visualização</div>'
    +legenda
    +mesesHdr
    +rows
    +'</div>';
}

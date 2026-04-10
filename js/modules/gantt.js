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
  if(idx<0)return;props[idx].gantt=g;saveAll();
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
  var ferList=(g.feriados||[]).map(function(f,fi){
    return '<div style="display:flex;align-items:center;gap:.35rem;margin-bottom:.2rem">'
      +'<input type="date" value="'+esc(f.data||'')+'" style="padding:.18rem .35rem;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.77rem" onchange="ganttFerData('+fi+',this.value)">'
      +'<input type="text" value="'+esc(f.nome||'')+'" placeholder="Nome do feriado" style="flex:1;padding:.18rem .35rem;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);font-size:.77rem" oninput="ganttFerNome('+fi+',this.value)">'
      +'<button onclick="ganttFerDel('+fi+')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.85rem;padding:0 .2rem">x</button>'
      +'</div>';
  }).join('');

  var configUteis='<div style="border-top:1px solid var(--border);margin-top:.55rem;padding-top:.5rem">'
    +'<div style="font-size:.77rem;font-weight:700;color:var(--text2);margin-bottom:.4rem">&#128197; Dias &uacute;teis</div>'
    +'<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:.45rem">'
    +'<label style="display:flex;align-items:center;gap:.3rem;font-size:.78rem;cursor:pointer">'
    +'<input type="checkbox" '+optSab+' onchange="ganttCfg(\'trabSab\',this.checked)"> Trabalha S&aacute;bado</label>'
    +'<label style="display:flex;align-items:center;gap:.3rem;font-size:.78rem;cursor:pointer">'
    +'<input type="checkbox" '+optDom+' onchange="ganttCfg(\'trabDom\',this.checked)"> Trabalha Domingo</label>'
    +'</div>'
    +'<div style="font-size:.75rem;color:var(--text3);margin-bottom:.3rem">Feriados adicionais (municipais, estaduais, pontos facultativos):</div>'
    +ferList
    +'<button onclick="ganttFerAdd()" style="margin-top:.3rem;padding:.22rem .6rem;background:var(--bg2);border:1px solid var(--border);border-radius:4px;color:var(--text2);cursor:pointer;font-size:.75rem">+ Feriado</button>'
    +'</div>';

  var prev=buildGanttPrev(g);

  return '<div style="margin-top:.7rem;border:1px solid var(--accent);border-radius:8px;padding:.75rem;background:var(--bg3)">'
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

function ganttRefreshPrev(){var g=getGantt();var el=Q('ganttPrev');if(el)el.innerHTML=buildGanttPrev(g);}
function ganttUpd(fi,campo,val){var g=getGantt();if(!g.fases[fi])return;g.fases[fi][campo]=val;saveGantt(g);ganttRefreshPrev();}
function ganttIni(v){var g=getGantt();g.inicio=v;saveGantt(g);ganttRefreshPrev();}
function ganttCfg(campo,val){var g=getGantt();g[campo]=val;saveGantt(g);ganttRefreshPrev();}
function ganttFerAdd(){var g=getGantt();if(!g.feriados)g.feriados=[];g.feriados.push({data:'',nome:''});saveGantt(g);rEsc();}
function ganttFerDel(fi){var g=getGantt();g.feriados.splice(fi,1);saveGantt(g);rEsc();}
function ganttFerData(fi,v){var g=getGantt();if(g.feriados[fi])g.feriados[fi].data=v;saveGantt(g);ganttRefreshPrev();}
function ganttFerNome(fi,v){var g=getGantt();if(g.feriados[fi])g.feriados[fi].nome=v;saveGantt(g);}
function ganttMover(fi,dir){
  var g=getGantt();var fases=g.fases;
  var ni=fi+dir;if(ni<0||ni>=fases.length)return;
  var tmp=fases[fi];fases[fi]=fases[ni];fases[ni]=tmp;
  g.fases=fases;saveGantt(g);rEsc();
}
function ganttInsAbaixo(fi){
  var g=getGantt();var fases=g.fases||[];
  var cores=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];
  var cor=cores[(fi+1)%cores.length];
  var fRef=fases[fi]||{};
  var off=(fRef.offset||0)+(fRef.dur||1);
  fases.splice(fi+1,0,{id:uid(),nome:'Nova Fase',offset:off,dur:1,cor:cor});
  g.fases=fases;saveGantt(g);rEsc();
}
function ganttAdd(){
  var g=getGantt();var fases=g.fases||[];
  var cores=['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d','#78350f'];
  var cor=cores[fases.length%cores.length];
  var off=0;
  if(fases.length){var last=fases[fases.length-1];off=(last.offset||0)+(last.dur||1);}
  fases.push({id:uid(),nome:'Nova Fase',offset:off,dur:5,cor:cor});
  g.fases=fases;saveGantt(g);rEsc();
}
function ganttDel(fi){var g=getGantt();g.fases.splice(fi,1);saveGantt(g);rEsc();}

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

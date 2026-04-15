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
    if(_catSort==='apr')  return t==='S'?d.nAprS:t==='M'?d.nAprM:d.nAprTot;
    if(_catSort==='nao')  return t==='S'?d.nNaoS:t==='M'?d.nNaoM:d.nNaoTot;
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
    Q('mCU').value    = it.cu    || 0;
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
    Q('mCU').value=0; Q('mTec').value=1; Q('mDias').value=1; Q('mHpd').value=1; Q('mQtd').value=1;
    Q('mEquip').value=''; Q('mInst').value=''; Q('mDesc').value=''; Q('mLink').value='';
    if(Q('mTipoTrab')) Q('mTipoTrab').value='';
    if(Q('mFaseTrab')) Q('mFaseTrab').value='';
  }
  Q('mCSvc').style.display=tipo!=='material'?'':'none';
  Q('mCMat').style.display=tipo==='material'?'block':'none';
  mCalcPV();
  m.style.display='flex';
  mAtualizarMargemPanel(); // agora cat já está setado
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
  var cu=n2(Q('mCU').value);
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
  var cu=n2(Q('mCU').value);
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
    cu:cu, mult:mult, fmf:fmf, pvu:pvu, pvt:pvt,
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
  var cu=n2(Q('mCU').value);
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
    var trStyle='border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s';
    return '<tr style="'+trStyle+'" onclick="fmAbrirProposta(\''+p.id+'\')" onmouseover="this.style.background=\'rgba(88,166,255,.08)\'" onmouseout="this.style.background=\'\'">'
      +'<td style="padding:.35rem .5rem;font-size:.78rem;font-weight:700;color:var(--accent)">'+esc(p.num||'')+'</td>'
      +'<td style="padding:.35rem .5rem;font-size:.78rem">'+esc(p.cli||'')+(p.csvc||p.cid?' <span style="font-size:.7rem;color:var(--text3)">('+esc(p.csvc||p.cid)+')</span>':'')+'</td>'
      +'<td style="padding:.35rem .5rem;font-size:.75rem;color:var(--text2)">'+esc(p.tit||'')+'</td>'
      +'<td style="padding:.35rem .5rem;font-size:.78rem;text-align:right;font-weight:700;color:#3fb950">'+money(n2(p.val))+'</td>'
      +'<td style="padding:.35rem .5rem;font-size:.75rem;color:var(--text3);text-align:center">'
        +'<span style="font-size:.65rem;color:#3fb950">↗ Abrir</span>'
      +'</td>'
      +'</tr>';
  }).join('');

  el.style.display='block';
  el.innerHTML='<div style="background:var(--bg3);border-radius:8px;padding:.6rem .8rem;border:1px solid var(--border)">'
    +'<div style="font-size:.75rem;font-weight:700;color:var(--accent);margin-bottom:.5rem">📋 '+MESES[mes]+' — '+lista.length+' proposta(s)</div>'
    +'<table style="width:100%;border-collapse:collapse"><thead><tr>'
    +'<th style="text-align:left;font-size:.68rem;color:var(--text3);padding:.2rem .5rem;border-bottom:2px solid var(--border)">Nº</th>'
    +'<th style="text-align:left;font-size:.68rem;color:var(--text3);padding:.2rem .5rem;border-bottom:2px solid var(--border)">Cliente</th>'
    +'<th style="text-align:left;font-size:.68rem;color:var(--text3);padding:.2rem .5rem;border-bottom:2px solid var(--border)">Título</th>'
    +'<th style="text-align:right;font-size:.68rem;color:var(--text3);padding:.2rem .5rem;border-bottom:2px solid var(--border)">Valor</th>'
    +'<th style="text-align:left;font-size:.68rem;color:var(--text3);padding:.2rem .5rem;border-bottom:2px solid var(--border)">Cidade</th>'
    +'</tr></thead><tbody>'+rows+'</tbody></table></div>';
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
  console.log('fmAbrirProposta runtime winner', { id: id, hasPdDados: !!document.getElementById('pd-dados') });
  var p=props.find(function(x){return x.id===id;});
  if(!p) return;

  _pdId = id;

  var numEl = document.getElementById('pd-num');
  var cliEl = document.getElementById('pd-cli');
  var badgeEl = document.getElementById('pd-fase-badge');

  if(numEl) numEl.textContent = '#' + (p.num || '');
  if(cliEl) cliEl.textContent = p.cli || '';

  if(badgeEl){
    badgeEl.innerHTML = p.fas || '';
  }

  // Render Dados tab
  var dadosEl = document.getElementById('pd-dados');
  if(dadosEl){
    var fasObj = (typeof FASE !== 'undefined' && FASE[p.fas]) || null;
    var fasLabel = fasObj ? (fasObj.i + ' ' + fasObj.n) : (p.fas || '—');
    var descricao = p.desc || p.tit || '—';
    var valorFmt = (typeof money === 'function') ? money(parseFloat(p.val) || 0) : String(p.val || '0');
    dadosEl.innerHTML =
      '<div style="display:grid;gap:.6rem">'
      + '<div class="card" style="margin:0">'
      +   '<div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.2rem">Número</div>'
      +   '<div style="font-family:monospace;font-size:1.05rem;font-weight:700;color:var(--accent)">#' + esc(p.num || '—') + '</div>'
      + '</div>'
      + '<div class="card" style="margin:0">'
      +   '<div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.2rem">Cliente</div>'
      +   '<div style="font-size:.92rem;font-weight:600">' + esc(p.cli || '—') + '</div>'
      + '</div>'
      + '<div class="card" style="margin:0">'
      +   '<div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.2rem">Descrição</div>'
      +   '<div style="font-size:.85rem;color:var(--text2)">' + esc(descricao) + '</div>'
      + '</div>'
      + '<div class="card" style="margin:0">'
      +   '<div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.2rem">Valor Total</div>'
      +   '<div style="font-size:1.1rem;font-weight:700;color:var(--green)">' + valorFmt + '</div>'
      + '</div>'
      + '<div class="card" style="margin:0">'
      +   '<div style="font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.2rem">Status</div>'
      +   '<div style="font-size:.88rem;font-weight:600">' + esc(fasLabel) + '</div>'
      + '</div>'
      + '</div>';
  }

  // Render Escopo tab
  renderEscopoTab(p);
  renderItensTab(p);
  renderFinanceiroTab(p);
  renderDocumentosTab(p);
  renderComercialTab(p);
  renderVisitaTab(p);
  renderConsolidacaoTab(p);
  renderEngenhariaTab(p);
  renderExecucaoTab(p);

  // Reset to Dados tab
  document.querySelectorAll('.pd-tab').forEach(function(b){ b.classList.remove('on'); });
  document.querySelectorAll('.pd-panel').forEach(function(panel){ panel.classList.remove('on'); });
  var firstTab = document.querySelector('.pd-tab');
  if(firstTab) firstTab.classList.add('on');
  var dadosPanel = document.getElementById('pd-panel-dados');
  if(dadosPanel) dadosPanel.classList.add('on');

  go('proposta-detalhe', null);

  window.scrollTo({top:0, behavior:'smooth'});
}


// ══════════════════════════════════════════════════════════════
// ESCOPO TAB
// ══════════════════════════════════════════════════════════════
var _escopoEditIdx = null;

function renderEscopoTab(p) {
  var el = document.getElementById('pd-panel-escopo');
  if (!el) return;

  var itens = (p.stages && p.stages.escopo && Array.isArray(p.stages.escopo.itens))
    ? p.stages.escopo.itens : [];

  var inpStyle = 'width:100%;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text);padding:.42rem .6rem;font-size:.8rem;font-family:inherit;box-sizing:border-box';
  var labelStyle = 'font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.15rem';

  var cardsHtml = '';
  if (itens.length) {
    cardsHtml = itens.map(function(it, i) {
      var badge = it.gera_item
        ? '<span style="background:rgba(63,185,80,.15);color:var(--green);padding:.1rem .45rem;border-radius:3px;font-size:.7rem">Gera item: Sim</span>'
        : '<span style="background:var(--bg3);color:var(--text3);padding:.1rem .45rem;border-radius:3px;font-size:.7rem">Gera item: Não</span>';
      return '<div class="card" style="margin:0">'
        + '<div style="display:flex;justify-content:flex-end;gap:.3rem;margin-bottom:.35rem">'
        + '<button class="btn bd bsm" style="font-size:.7rem;padding:.18rem .5rem" onclick="editEscopoItem(' + i + ')">✏ Editar</button>'
        + '<button class="btn bd bsm" style="font-size:.7rem;padding:.18rem .5rem;color:var(--red);border-color:var(--red)" onclick="deleteEscopoItem(' + i + ')">× Excluir</button>'
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem .8rem;font-size:.8rem;margin-bottom:.4rem">'
        + '<div><div style="' + labelStyle + '">Fase</div><div style="font-weight:600">' + esc(it.fase || '—') + '</div></div>'
        + '<div><div style="' + labelStyle + '">Disciplina</div><div style="font-weight:600">' + esc(it.disciplina || '—') + '</div></div>'
        + '<div><div style="' + labelStyle + '">Equipamento</div><div>' + esc(it.equipamento || '—') + '</div></div>'
        + '<div><div style="' + labelStyle + '">Atividade</div><div>' + esc(it.atividade || '—') + '</div></div>'
        + '</div>'
        + (it.descricao ? '<div style="font-size:.78rem;color:var(--text2);margin-bottom:.4rem">' + esc(it.descricao) + '</div>' : '')
        + badge
        + '</div>';
    }).join('');
  } else {
    cardsHtml = '<div class="card" style="margin:0;color:var(--text3);font-size:.83rem;text-align:center;padding:1.5rem">Nenhum escopo cadastrado</div>';
  }

  var formHtml = '<div id="escopo-form" style="display:none">'
    + '<div class="card" style="margin:0;display:grid;gap:.45rem">'
    + '<div id="escopo-form-title" style="font-size:.78rem;font-weight:700;color:var(--accent)">Novo Escopo</div>'
    + '<div><div style="' + labelStyle + '">Fase</div><input id="esc-fase" placeholder="ex: Instalação" style="' + inpStyle + '"></div>'
    + '<div><div style="' + labelStyle + '">Disciplina</div><input id="esc-disc" placeholder="ex: Elétrica" style="' + inpStyle + '"></div>'
    + '<div><div style="' + labelStyle + '">Equipamento</div><input id="esc-equip" placeholder="ex: Painel CC" style="' + inpStyle + '"></div>'
    + '<div><div style="' + labelStyle + '">Atividade</div><input id="esc-ativ" placeholder="ex: Cabeamento" style="' + inpStyle + '"></div>'
    + '<div><div style="' + labelStyle + '">Descrição</div><textarea id="esc-desc" placeholder="Descrição detalhada..." rows="2" style="' + inpStyle + 'resize:vertical;min-height:56px"></textarea></div>'
    + '<label style="font-size:.8rem;display:flex;align-items:center;gap:.4rem;cursor:pointer"><input type="checkbox" id="esc-gera"> Gera item de orçamento</label>'
    + '<div style="display:flex;gap:.4rem;margin-top:.2rem">'
    + '<button class="btn bg bsm" onclick="addEscopoItem()">Salvar</button>'
    + '<button class="btn bd bsm" onclick="toggleEscopoForm()">Cancelar</button>'
    + '</div>'
    + '</div>'
    + '</div>';

  el.innerHTML = '<div style="display:grid;gap:.6rem">'
    + cardsHtml
    + '<button class="btn ba bsm" onclick="toggleEscopoForm()" style="justify-self:start;margin-top:.2rem">+ Adicionar Escopo</button>'
    + formHtml
    + '</div>';
}

function toggleEscopoForm() {
  var f = document.getElementById('escopo-form');
  if (!f) return;
  var isOpen = f.style.display !== 'none';
  if (isOpen) {
    f.style.display = 'none';
    _escopoEditIdx = null;
  } else {
    f.style.display = 'block';
  }
}

function editEscopoItem(idx) {
  if (!_pdId) return;
  var p = props.find(function(x){ return x.id === _pdId; });
  if (!p || !p.stages || !p.stages.escopo || !p.stages.escopo.itens) return;
  var it = p.stages.escopo.itens[idx];
  if (!it) return;

  _escopoEditIdx = idx;

  var f = document.getElementById('escopo-form');
  if (f) f.style.display = 'block';

  var title = document.getElementById('escopo-form-title');
  if (title) title.textContent = 'Editar Escopo';

  var set = function(id, val){ var el = document.getElementById(id); if (el) el.value = val || ''; };
  set('esc-fase',  it.fase);
  set('esc-disc',  it.disciplina);
  set('esc-equip', it.equipamento);
  set('esc-ativ',  it.atividade);
  set('esc-desc',  it.descricao);
  var gera = document.getElementById('esc-gera');
  if (gera) gera.checked = !!it.gera_item;

  f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function deleteEscopoItem(idx) {
  if (!_pdId) return;
  var p = props.find(function(x){ return x.id === _pdId; });
  if (!p || !p.stages || !p.stages.escopo || !p.stages.escopo.itens) return;
  p.stages.escopo.itens.splice(idx, 1);
  _escopoEditIdx = null;
  renderEscopoTab(p);
}

function addEscopoItem() {
  if (!_pdId) return;
  var p = props.find(function(x){ return x.id === _pdId; });
  if (!p) return;
  if (!p.stages) p.stages = (typeof criarStagesVazios === 'function') ? criarStagesVazios() : {};
  if (!p.stages.escopo) p.stages.escopo = { itens: [] };
  if (!Array.isArray(p.stages.escopo.itens)) p.stages.escopo.itens = [];

  var item = {
    _id:         (_escopoEditIdx !== null && p.stages.escopo.itens[_escopoEditIdx]
                    ? p.stages.escopo.itens[_escopoEditIdx]._id
                    : Date.now().toString(36) + Math.random().toString(36).slice(2, 5)),
    fase:        (document.getElementById('esc-fase')  || {}).value || '',
    disciplina:  (document.getElementById('esc-disc')  || {}).value || '',
    equipamento: (document.getElementById('esc-equip') || {}).value || '',
    atividade:   (document.getElementById('esc-ativ')  || {}).value || '',
    descricao:   (document.getElementById('esc-desc')  || {}).value || '',
    gera_item:  !!(document.getElementById('esc-gera')  || {}).checked,
    item_ref:    null
  };

  if (_escopoEditIdx !== null) {
    p.stages.escopo.itens[_escopoEditIdx] = item;
    _escopoEditIdx = null;
  } else {
    p.stages.escopo.itens.push(item);
  }

  renderEscopoTab(p);
}

// ══════════════════════════════════════════════════════════════
// ITENS TAB
// ══════════════════════════════════════════════════════════════
function renderItensTab(p) {
  var el = document.getElementById('pd-panel-itens');
  if (!el) return;

  var itens = p.bi || [];

  if (!itens.length) {
    el.innerHTML = '<div class="card" style="margin:0;color:var(--text3);font-size:.83rem;text-align:center;padding:1.5rem">Nenhum item orçado</div>';
    return;
  }

  var escopoItens = (p.stages && p.stages.escopo && Array.isArray(p.stages.escopo.itens))
    ? p.stages.escopo.itens : [];
  var selStyle = 'margin-top:.28rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);color:var(--text3);font-size:.67rem;font-family:inherit;padding:.15rem .3rem;max-width:100%;cursor:pointer';

  var totalIncluido = 0;
  var rows = itens.map(function(it) {
    var inc = it.inc !== false;
    var tipo = it.t === 'material' ? 'Mat' : 'Svc';
    var tipoColor = it.t === 'material' ? 'var(--purple)' : 'var(--blue)';
    var tipoBg   = it.t === 'material' ? 'rgba(188,140,255,.12)' : 'rgba(88,166,255,.12)';

    var qty = '';
    if (it.t === 'material') {
      qty = String(n2(it.mult)) + (it.un1 ? ' ' + it.un1 : '');
    } else {
      var parts = [];
      if ((it.tec || 1) > 1) parts.push((it.tec || 1) + ' Tec.');
      parts.push((it.dias || 1) + (it.un1 ? ' ' + it.un1 : ' d'));
      parts.push((it.hpd || 1) + (it.un2 ? ' ' + it.un2 : 'h'));
      qty = parts.join(' × ');
    }

    var pvt = n2(it.pvt);
    if (inc) totalIncluido += pvt;

    var rowOp = inc ? '1' : '0.45';
    var pvtDisplay = inc
      ? '<span style="font-weight:700;color:var(--green)">' + money(pvt) + '</span>'
      : '<span style="color:var(--text3);font-size:.75rem;text-decoration:line-through">' + money(pvt) + '</span>';

    var tercBadge = it.terc
      ? '<span style="font-size:.65rem;color:#f97316;margin-left:.3rem">●Terc</span>'
      : '';

    var origemLabel = '';
    if (it.escopo_id) {
      var _escopoItens = (p.stages && p.stages.escopo && p.stages.escopo.itens) || [];
      var escopoRef = _escopoItens.find(function(e){ return e._id === it.escopo_id; });
      if (escopoRef) {
        var origemParts = [escopoRef.fase, escopoRef.equipamento, escopoRef.atividade].filter(Boolean);
        origemLabel = '<div style="font-size:.65rem;color:var(--text3);margin-top:.15rem">'
          + 'Origem: Escopo [' + esc(origemParts.join(' | ')) + ']'
          + '</div>';
      }
    }

    // Build selector — explicit selected check per option, no string replace
    var selOpts = '<option value=""' + (!it.escopo_id ? ' selected' : '') + '>— sem vínculo —</option>'
      + escopoItens.map(function(e) {
          if (!e._id) return '';
          var label = [e.fase, e.equipamento, e.atividade].filter(Boolean).join(' | ') || e.descricao || e._id;
          var isSel = it.escopo_id === e._id;
          return '<option value="' + esc(e._id) + '"' + (isSel ? ' selected' : '') + '>' + esc(label) + '</option>';
        }).join('');
    var selector = '<div>'
      + '<select style="' + selStyle + '" onchange="linkEscopoItem(\'' + esc(it.id) + '\',this.value)">'
      + selOpts
      + '</select>'
      + '</div>';

    return '<tr style="opacity:' + rowOp + ';border-bottom:1px solid var(--border)">'
      + '<td style="padding:.38rem .5rem;font-size:.78rem">'
      +   '<span style="background:' + tipoBg + ';color:' + tipoColor + ';padding:.05rem .35rem;border-radius:3px;font-size:.66rem;font-weight:700;margin-right:.35rem">' + tipo + '</span>'
      +   esc(it.desc || it.cat || '—') + tercBadge
      +   origemLabel
      +   selector
      + '</td>'
      + '<td style="padding:.38rem .5rem;font-size:.75rem;color:var(--text2);white-space:nowrap">' + esc(qty) + '</td>'
      + '<td style="padding:.38rem .5rem;font-size:.75rem;text-align:right;color:var(--text2)">' + money(n2(it.pvu)) + '</td>'
      + '<td style="padding:.38rem .5rem;font-size:.78rem;text-align:right">' + pvtDisplay + '</td>'
      + '</tr>';
  }).join('');

  el.innerHTML = '<div style="overflow-x:auto">'
    + '<table style="width:100%;border-collapse:collapse;font-size:.78rem">'
    + '<thead><tr style="background:var(--bg3)">'
    +   '<th style="padding:.38rem .5rem;text-align:left;font-size:.66rem;text-transform:uppercase;color:var(--text3);font-weight:600">Descrição</th>'
    +   '<th style="padding:.38rem .5rem;text-align:left;font-size:.66rem;text-transform:uppercase;color:var(--text3);font-weight:600">Qtd</th>'
    +   '<th style="padding:.38rem .5rem;text-align:right;font-size:.66rem;text-transform:uppercase;color:var(--text3);font-weight:600">PV Unit.</th>'
    +   '<th style="padding:.38rem .5rem;text-align:right;font-size:.66rem;text-transform:uppercase;color:var(--text3);font-weight:600">PV Total</th>'
    + '</tr></thead>'
    + '<tbody>' + rows + '</tbody>'
    + '<tfoot><tr style="border-top:2px solid var(--border)">'
    +   '<td colspan="3" style="padding:.42rem .5rem;font-size:.78rem;font-weight:700;color:var(--text2)">Total incluído</td>'
    +   '<td style="padding:.42rem .5rem;font-size:.88rem;font-weight:700;color:var(--green);text-align:right">' + money(totalIncluido) + '</td>'
    + '</tr></tfoot>'
    + '</table>'
    + '</div>';
}

function linkEscopoItem(itemId, escopoId) {
  if (!_pdId) return;
  var p = props.find(function(x){ return x.id === _pdId; });
  if (!p || !p.bi) return;
  var it = p.bi.find(function(x){ return x.id === itemId; });
  if (!it) return;
  if (escopoId) {
    it.escopo_id = escopoId;
  } else {
    delete it.escopo_id;
  }
  // Persist: localStorage + Supabase
  try { localStorage.setItem('tf_props', JSON.stringify(props)); } catch(e) {}
  if (typeof sbSalvarProposta === 'function') sbSalvarProposta(p);
  renderItensTab(p);
}

// ══════════════════════════════════════════════════════════════
// FINANCEIRO TAB
// ══════════════════════════════════════════════════════════════
function renderFinanceiroTab(p) {
  var el = document.getElementById('pd-panel-financeiro');
  if (!el) return;

  var labelStyle = 'font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.15rem';

  function pct(v) {
    if (v === null || v === undefined || v === '') return '—';
    return (n2(v) * 100).toFixed(2).replace('.', ',') + '%';
  }
  function row(label, value, valueStyle) {
    return '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:.28rem 0;border-bottom:1px solid var(--border)">'
      + '<span style="font-size:.78rem;color:var(--text2)">' + label + '</span>'
      + '<span style="font-size:.82rem;font-weight:600;' + (valueStyle || '') + '">' + value + '</span>'
      + '</div>';
  }

  // ── Resumo de valores ───────────────────────────────────────
  var vS   = n2(p.vS);
  var vM   = n2(p.vM);
  var vD   = n2(p.vD);
  var vTot = n2(p.val) || (vS + vM - vD);

  var resumoRows = '';
  if (vS) resumoRows += row('Serviços', money(vS), 'color:var(--blue)');
  if (vM) resumoRows += row('Materiais', money(vM), 'color:var(--purple)');
  if (vD) resumoRows += row('Desconto', '– ' + money(vD), 'color:var(--red)');
  resumoRows += '<div style="display:flex;justify-content:space-between;align-items:baseline;padding:.38rem 0;margin-top:.15rem">'
    + '<span style="font-size:.8rem;font-weight:700;color:var(--text2)">Total</span>'
    + '<span style="font-size:1.15rem;font-weight:700;color:var(--green)">' + money(vTot) + '</span>'
    + '</div>';

  var resumoCard = '<div class="card" style="margin:0">'
    + '<div style="' + labelStyle + ';margin-bottom:.5rem">Resumo Financeiro</div>'
    + resumoRows
    + '</div>';

  // ── Alíquotas ──────────────────────────────────────────────
  var aliqCard = '';
  var a = p.aliq || {};
  if (p.aliq) {
    var aliqRows = ''
      + row('NF Serviços',   pct(a.nfS))
      + row('NF Materiais',  pct(a.nfM))
      + row('Retenção Svc',  pct(a.rS))
      + row('Comissão Svc',  pct(a.comS))
      + row('Comissão Mat',  pct(a.comM))
      + row('Negociação',    pct(a.neg));
    if (a.fechadoSemDesc)
      aliqRows += row('Fechado sem desconto', 'Sim', 'color:var(--green)');
    aliqCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + ';margin-bottom:.5rem">Alíquotas / Impostos</div>'
      + aliqRows
      + '</div>';
  }

  // ── Status ─────────────────────────────────────────────────
  var fasObj = (typeof FASE !== 'undefined' && FASE[p.fas]) || null;
  var fasLabel = fasObj ? (fasObj.i + ' ' + fasObj.n) : (p.fas || '—');
  var statusCard = '<div class="card" style="margin:0">'
    + '<div style="' + labelStyle + ';margin-bottom:.3rem">Status</div>'
    + '<div style="font-size:.92rem;font-weight:600">' + esc(fasLabel) + '</div>'
    + '</div>';

  el.innerHTML = '<div style="display:grid;gap:.6rem">'
    + resumoCard
    + aliqCard
    + statusCard
    + '</div>';
}

// ══════════════════════════════════════════════════════════════
// DOCUMENTOS TAB
// ══════════════════════════════════════════════════════════════
function renderDocumentosTab(p) {
  var el = document.getElementById('pd-panel-documentos');
  if (!el) return;

  var labelStyle = 'font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.4rem';

  function checkRow(label, ok, detail) {
    return '<div style="display:flex;align-items:center;gap:.55rem;padding:.28rem 0;border-bottom:1px solid var(--border);font-size:.8rem">'
      + '<span style="font-size:.85rem">' + (ok ? '✅' : '⬜') + '</span>'
      + '<span style="' + (ok ? 'color:var(--text)' : 'color:var(--text3)') + '">' + label + '</span>'
      + (detail ? '<span style="margin-left:auto;font-size:.72rem;color:var(--text3)">' + esc(String(detail)) + '</span>' : '')
      + '</div>';
  }

  // ── Checklist de conteúdo ──────────────────────────────────
  var escSecs = p.esc || [];
  var biItens  = p.bi  || [];
  var revs     = p.revs || [];
  var logHist  = (p.log && Array.isArray(p.log.hist))  ? p.log.hist  : [];
  var logRelat = (p.log && Array.isArray(p.log.relat)) ? p.log.relat : [];

  var checksHtml = ''
    + checkRow('Escopo / Seções',    escSecs.length > 0, escSecs.length  ? escSecs.length + ' seção(ões)' : '')
    + checkRow('Itens de orçamento', biItens.length > 0, biItens.length  ? biItens.length + ' item(ns)' : '')
    + checkRow('Revisões',           revs.length > 0,    revs.length     ? revs.length + ' revisão(ões)' : '')
    + checkRow('Histórico comercial',logHist.length > 0, logHist.length  ? logHist.length + ' registro(s)' : '')
    + checkRow('Relatórios de serviço', logRelat.length > 0, logRelat.length ? logRelat.length + ' relatório(s)' : '');

  var checkCard = '<div class="card" style="margin:0">'
    + '<div style="' + labelStyle + '">Conteúdo da Proposta</div>'
    + checksHtml
    + '</div>';

  // ── Revisões ───────────────────────────────────────────────
  var revsCard = '';
  if (revs.length) {
    var revsRows = revs.map(function(r) {
      return '<div style="display:flex;gap:.6rem;align-items:baseline;padding:.25rem 0;border-bottom:1px solid var(--border);font-size:.78rem">'
        + '<span style="font-weight:700;color:var(--accent);flex-shrink:0">Rev. ' + esc(r.rev || '') + '</span>'
        + '<span style="color:var(--text3);flex-shrink:0">' + esc(r.dat || '') + '</span>'
        + '<span style="color:var(--text2);flex:1">' + esc(r.desc || '') + '</span>'
        + '<span style="color:var(--text3);font-size:.7rem;flex-shrink:0">' + esc(r.por || '') + '</span>'
        + '</div>';
    }).join('');
    revsCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Revisões</div>'
      + revsRows
      + '</div>';
  }

  // ── Histórico comercial (últimos 3) ────────────────────────
  var histCard = '';
  if (logHist.length) {
    var sorted = logHist.slice().sort(function(a, b){ return (b.ts||0) - (a.ts||0); });
    var histRows = sorted.slice(0, 3).map(function(item) {
      return '<div style="padding:.35rem 0;border-bottom:1px solid var(--border)">'
        + '<div style="display:flex;justify-content:space-between;gap:.5rem;margin-bottom:.15rem">'
        +   '<span style="font-size:.78rem;font-weight:600">' + esc(item.titulo || '(sem título)') + '</span>'
        +   '<span style="font-size:.7rem;color:var(--text3)">' + esc(item.data || '') + '</span>'
        + '</div>'
        + (item.texto ? '<div style="font-size:.73rem;color:var(--text2);line-height:1.45;white-space:pre-wrap">' + esc(item.texto.slice(0, 120)) + (item.texto.length > 120 ? '…' : '') + '</div>' : '')
        + '</div>';
    }).join('');
    var moreLabel = logHist.length > 3 ? '<div style="font-size:.7rem;color:var(--text3);margin-top:.35rem">+ ' + (logHist.length - 3) + ' registro(s) adicionais</div>' : '';
    histCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Histórico Comercial</div>'
      + histRows + moreLabel
      + '</div>';
  }

  // ── Sem histórico ─────────────────────────────────────────
  var hasContent = revs.length || logHist.length || logRelat.length;
  var placeholderCard = !hasContent
    ? '<div class="card" style="margin:0;color:var(--text3);font-size:.83rem;text-align:center;padding:1.5rem">Nenhum histórico de documentos disponível</div>'
    : '';

  el.innerHTML = '<div style="display:grid;gap:.6rem">'
    + checkCard
    + revsCard
    + histCard
    + placeholderCard
    + '</div>';
}

function renderVisitaTab(p) {
  var el = document.getElementById('pd-panel-visita');
  if (!el) return;

  var labelStyle = 'font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.4rem';
  var rowStyle   = 'display:flex;gap:.5rem;padding:.22rem 0;border-bottom:1px solid var(--border);font-size:.8rem';
  var keyStyle   = 'color:var(--text3);flex-shrink:0;min-width:9rem';
  var valStyle   = 'color:var(--text);flex:1';

  function infoRow(label, value) {
    if (!value) return '';
    return '<div style="' + rowStyle + '">'
      + '<span style="' + keyStyle + '">' + label + '</span>'
      + '<span style="' + valStyle + '">' + esc(value) + '</span>'
      + '</div>';
  }

  // ── Resolve data: stages.visita → legacy tl/p fields ─────
  var sv  = (p.stages && p.stages.visita)     || {};
  var sov = (p.stages && p.stages.org_visita) || {};
  var tl  = p.tl || {};

  var dataVisita   = sv.data_visita   || tl.dtVisita || '';
  var local        = sv.local         || p.loc       || '';
  var responsavel  = sv.responsavel   || p.res       || '';
  var objetivo     = sv.objetivo      || '';
  var observacoes  = sv.observacoes   || '';

  var hasAnyData = dataVisita || local || responsavel || objetivo || observacoes;

  // ── Dados da visita ───────────────────────────────────────
  var dadosHtml = ''
    + infoRow('Data da visita',  dataVisita)
    + infoRow('Local',           local)
    + infoRow('Responsável',     responsavel)
    + infoRow('Objetivo',        objetivo);

  var dadosCard = hasAnyData
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Dados da Visita</div>'
      + dadosHtml
      + '</div>'
    : '';

  // ── Observações ───────────────────────────────────────────
  var observCard = (observacoes && observacoes.trim())
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Observações</div>'
      + '<div style="font-size:.8rem;color:var(--text2);white-space:pre-wrap;line-height:1.5">' + esc(observacoes.trim()) + '</div>'
      + '</div>'
    : '';

  // ── Notas de logística (org_visita) ───────────────────────
  var notasCard = (sov.notas_logistica && sov.notas_logistica.trim())
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Notas de Logística</div>'
      + '<div style="font-size:.8rem;color:var(--text2);white-space:pre-wrap;line-height:1.5">' + esc(sov.notas_logistica.trim()) + '</div>'
      + '</div>'
    : '';

  // ── Checklist pré-visita ──────────────────────────────────
  var checklist = Array.isArray(sv.checklist_pre) ? sv.checklist_pre : [];
  var checkCard = '';
  if (checklist.length) {
    var checkRows = checklist.map(function(item) {
      return '<div style="display:flex;align-items:center;gap:.55rem;padding:.25rem 0;border-bottom:1px solid var(--border);font-size:.8rem">'
        + '<span style="font-size:.85rem">' + (item.concluido ? '✅' : '⬜') + '</span>'
        + '<span style="color:' + (item.concluido ? 'var(--text)' : 'var(--text2)') + '">' + esc(item.descricao || '') + '</span>'
        + '</div>';
    }).join('');
    checkCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Checklist Pré-Visita</div>'
      + checkRows
      + '</div>';
  }

  // ── Equipe (org_visita) ───────────────────────────────────
  var equipe = Array.isArray(sov.equipe) ? sov.equipe : [];
  var equipeCard = '';
  if (equipe.length) {
    var equipeRows = equipe.map(function(m) {
      return '<div style="' + rowStyle + '">'
        + '<span style="' + valStyle + '">' + esc(m.nome || '') + '</span>'
        + '<span style="font-size:.73rem;color:var(--text3)">' + esc(m.funcao || '') + '</span>'
        + '</div>';
    }).join('');
    equipeCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Equipe</div>'
      + equipeRows
      + '</div>';
  }

  // ── Placeholder ───────────────────────────────────────────
  var hasContent = hasAnyData || checklist.length || equipe.length
                 || (sov.notas_logistica && sov.notas_logistica.trim());
  var placeholderCard = !hasContent
    ? '<div class="card" style="margin:0;color:var(--text3);font-size:.83rem;text-align:center;padding:1.5rem">Nenhuma visita registrada</div>'
    : '';

  el.innerHTML = '<div style="display:grid;gap:.6rem">'
    + dadosCard
    + observCard
    + notasCard
    + checkCard
    + equipeCard
    + placeholderCard
    + '</div>';
}

function renderConsolidacaoTab(p) {
  var el = document.getElementById('pd-panel-consolidacao');
  if (!el) return;

  var labelStyle = 'font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.4rem';
  var rowStyle   = 'display:flex;gap:.5rem;padding:.22rem 0;border-bottom:1px solid var(--border);font-size:.8rem';
  var keyStyle   = 'color:var(--text3);flex-shrink:0;min-width:10rem';
  var valStyle   = 'color:var(--text);flex:1';

  function infoRow(label, value) {
    if (!value) return '';
    return '<div style="' + rowStyle + '">'
      + '<span style="' + keyStyle + '">' + label + '</span>'
      + '<span style="' + valStyle + '">' + esc(value) + '</span>'
      + '</div>';
  }

  function tagList(items) {
    return items.map(function(s) {
      return '<span style="display:inline-block;background:var(--bg3);border:1px solid var(--border);border-radius:4px;padding:.15rem .5rem;font-size:.73rem;color:var(--text2);margin:.15rem .2rem .15rem 0">' + esc(s) + '</span>';
    }).join('');
  }

  function bulletList(items) {
    return items.map(function(s) {
      return '<div style="padding:.2rem 0;border-bottom:1px solid var(--border);font-size:.8rem;color:var(--text2);display:flex;gap:.5rem">'
        + '<span style="color:var(--text3);flex-shrink:0">•</span>'
        + '<span>' + esc(s) + '</span>'
        + '</div>';
    }).join('');
  }

  // ── Resolve sources ───────────────────────────────────────
  var sc  = (p.stages && p.stages.consolidacao) || {};
  var tl  = p.tl || {};

  var disciplinas = Array.isArray(sc.disciplinas)  ? sc.disciplinas.filter(Boolean)  : [];
  var premissas   = Array.isArray(sc.premissas)    ? sc.premissas.filter(Boolean)    : [];
  var restricoes  = Array.isArray(sc.restricoes)   ? sc.restricoes.filter(Boolean)   : [];
  var requisitos  = Array.isArray(sc.requisitos)   ? sc.requisitos.filter(Boolean)   : [];
  var tensEsp     = Array.isArray(sc.tensoes_especiais)
                    ? sc.tensoes_especiais
                    : (Array.isArray(p.tens) ? p.tens : []);

  // Tension id → display label
  var TENS_LABEL = { pT1F: '1F', pT2F: '2F', pT3F: '3F', pTN: 'N', pTPE: 'PE' };

  var notasTec    = sc.notas_tecnicas          || p.area    || '';
  var equipPrinc  = sc.equipamentos_principais || p.equip   || '';
  var tensVal     = sc.tensao_alimentacao      || p.tensVal || '';
  var tensCmd     = sc.tensao_comando          || p.tensCmd || '';

  // Cronograma preliminar from planejamento stage
  var plan      = (p.stages && p.stages.planejamento) || {};
  var dtInicio  = plan.data_inicio  || tl.dtInicioExec || '';
  var dtTermino = plan.data_termino || tl.dtTermino    || '';

  // ── Disciplinas (tags) ────────────────────────────────────
  var discCard = disciplinas.length
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Disciplinas</div>'
      + '<div style="margin-top:.25rem">' + tagList(disciplinas) + '</div>'
      + '</div>'
    : '';

  // ── Equipamentos / tensões ────────────────────────────────
  var tensEspLabels = tensEsp.map(function(id) {
    return TENS_LABEL[id] || id;
  }).join(', ');

  var tecHtml = ''
    + infoRow('Equipamentos principais', equipPrinc)
    + infoRow('Tensão de alimentação',   tensVal)
    + infoRow('Tensão de comando',       tensCmd)
    + (tensEspLabels ? infoRow('Tensões especiais', tensEspLabels) : '');

  var tecCard = tecHtml
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Informações Técnicas</div>'
      + tecHtml
      + '</div>'
    : '';

  // ── Notas técnicas / escopo entendido ─────────────────────
  var notasCard = (notasTec && notasTec.trim())
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Notas Técnicas / Escopo Entendido</div>'
      + '<div style="font-size:.8rem;color:var(--text2);white-space:pre-wrap;line-height:1.5">' + esc(notasTec.trim()) + '</div>'
      + '</div>'
    : '';

  // ── Premissas ─────────────────────────────────────────────
  var premCard = premissas.length
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Premissas</div>'
      + bulletList(premissas)
      + '</div>'
    : '';

  // ── Restrições / Exclusões ────────────────────────────────
  var restCard = restricoes.length
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Restrições / Exclusões</div>'
      + bulletList(restricoes)
      + '</div>'
    : '';

  // ── Requisitos ────────────────────────────────────────────
  var reqCard = '';
  if (requisitos.length) {
    var reqRows = requisitos.map(function(r) {
      return '<div style="padding:.25rem 0;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:.8rem;color:var(--text2)">' + esc(r.descricao || '') + '</div>'
        + (r.origem ? '<div style="font-size:.7rem;color:var(--text3);margin-top:.1rem">Origem: ' + esc(r.origem) + '</div>' : '')
        + '</div>';
    }).join('');
    reqCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Requisitos</div>'
      + reqRows
      + '</div>';
  }

  // ── Cronograma preliminar ─────────────────────────────────
  var cronHtml = ''
    + infoRow('Início previsto',   dtInicio)
    + infoRow('Término previsto',  dtTermino);

  var cronCard = (dtInicio || dtTermino)
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Cronograma Preliminar</div>'
      + cronHtml
      + '</div>'
    : '';

  // ── Placeholder ───────────────────────────────────────────
  var hasContent = disciplinas.length || premissas.length || restricoes.length
                 || requisitos.length || notasTec || equipPrinc
                 || dtInicio || dtTermino;

  var placeholderCard = !hasContent
    ? '<div class="card" style="margin:0;color:var(--text3);font-size:.83rem;text-align:center;padding:1.5rem">Nenhuma consolidação técnica registrada</div>'
    : '';

  el.innerHTML = '<div style="display:grid;gap:.6rem">'
    + discCard
    + tecCard
    + notasCard
    + premCard
    + restCard
    + reqCard
    + cronCard
    + placeholderCard
    + '</div>';
}

function renderEngenhariaTab(p) {
  var el = document.getElementById('pd-panel-engenharia');
  if (!el) return;

  var labelStyle = 'font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.4rem';
  var rowStyle   = 'display:flex;gap:.5rem;padding:.22rem 0;border-bottom:1px solid var(--border);font-size:.8rem;align-items:baseline';
  var keyStyle   = 'color:var(--text3);flex-shrink:0;min-width:9rem';
  var valStyle   = 'color:var(--text);flex:1';

  var se  = (p.stages && p.stages.engenharia) || {};
  var sr  = (p.stages && p.stages.recursos)   || {};

  var especificacoes = Array.isArray(se.especificacoes) ? se.especificacoes.filter(function(x){ return x && x.parametro; }) : [];
  var memoriais      = Array.isArray(se.memoriais)      ? se.memoriais.filter(function(x){ return x && x.titulo; })      : [];
  var documentos     = Array.isArray(se.documentos_ref) ? se.documentos_ref.filter(function(x){ return x && x.titulo; }) : [];
  var notas          = se.notas || '';

  var materiais  = Array.isArray(sr.materiais)  ? sr.materiais.filter(function(x){ return x && x.descricao; })  : [];
  var maoObra    = Array.isArray(sr.mao_obra)   ? sr.mao_obra.filter(function(x){ return x && x.funcao; })      : [];
  var terceiros  = Array.isArray(sr.terceiros)  ? sr.terceiros.filter(function(x){ return x && x.servico; })    : [];

  // ── Especificações / Parâmetros técnicos ──────────────────
  var especCard = '';
  if (especificacoes.length) {
    var especRows = especificacoes.map(function(e) {
      var valorStr = e.valor + (e.unidade ? ' ' + e.unidade : '');
      return '<div style="' + rowStyle + '">'
        + '<span style="' + keyStyle + '">' + esc(e.parametro) + '</span>'
        + '<span style="' + valStyle + ';font-weight:600">' + esc(valorStr) + '</span>'
        + (e.norma ? '<span style="font-size:.7rem;color:var(--text3);flex-shrink:0">' + esc(e.norma) + '</span>' : '')
        + '</div>';
    }).join('');
    especCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Parâmetros Técnicos</div>'
      + especRows
      + '</div>';
  }

  // ── Notas de engenharia ───────────────────────────────────
  var notasCard = (notas && notas.trim())
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Notas de Engenharia</div>'
      + '<div style="font-size:.8rem;color:var(--text2);white-space:pre-wrap;line-height:1.5">' + esc(notas.trim()) + '</div>'
      + '</div>'
    : '';

  // ── Memoriais / notas de cálculo ─────────────────────────
  var memCard = '';
  if (memoriais.length) {
    var memRows = memoriais.map(function(m) {
      return '<div style="padding:.3rem 0;border-bottom:1px solid var(--border)">'
        + '<div style="font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:.15rem">' + esc(m.titulo) + '</div>'
        + (m.conteudo && m.conteudo.trim()
            ? '<div style="font-size:.75rem;color:var(--text2);white-space:pre-wrap;line-height:1.45">'
              + esc(m.conteudo.trim().slice(0, 200)) + (m.conteudo.trim().length > 200 ? '…' : '')
              + '</div>'
            : '')
        + '</div>';
    }).join('');
    memCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Memoriais Descritivos / Notas de Cálculo</div>'
      + memRows
      + '</div>';
  }

  // ── Documentos de referência ──────────────────────────────
  var docCard = '';
  if (documentos.length) {
    var docRows = documentos.map(function(d) {
      return '<div style="display:flex;align-items:center;gap:.5rem;padding:.22rem 0;border-bottom:1px solid var(--border);font-size:.8rem">'
        + '<span style="color:var(--text2);flex:1">' + esc(d.titulo) + '</span>'
        + (d.url_ou_path ? '<span style="font-size:.7rem;color:var(--text3);flex-shrink:0">' + esc(d.url_ou_path) + '</span>' : '')
        + '</div>';
    }).join('');
    docCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Referências Técnicas</div>'
      + docRows
      + '</div>';
  }

  // ── Lista de materiais (recursos) ─────────────────────────
  var matCard = '';
  if (materiais.length) {
    var matRows = materiais.map(function(m) {
      var qtdStr = m.quantidade ? (m.quantidade + (m.unidade ? ' ' + m.unidade : '')) : '';
      var custoStr = m.custo_unit ? 'R$ ' + n2(m.custo_unit).toFixed(2).replace('.', ',') : '';
      return '<div style="' + rowStyle + '">'
        + '<span style="' + valStyle + '">' + esc(m.descricao) + '</span>'
        + (qtdStr   ? '<span style="font-size:.73rem;color:var(--text3);flex-shrink:0">' + esc(qtdStr)   + '</span>' : '')
        + (custoStr ? '<span style="font-size:.73rem;color:var(--text3);flex-shrink:0">' + esc(custoStr) + '</span>' : '')
        + '</div>';
    }).join('');
    matCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Lista de Materiais</div>'
      + matRows
      + '</div>';
  }

  // ── Mão de obra (recursos) ────────────────────────────────
  var moCard = '';
  if (maoObra.length) {
    var moRows = maoObra.map(function(m) {
      var detalhe = [
        m.quantidade ? m.quantidade + ' profissional(is)' : '',
        m.dias ? m.dias + ' dia(s)' : ''
      ].filter(Boolean).join(' · ');
      return '<div style="' + rowStyle + '">'
        + '<span style="' + valStyle + '">' + esc(m.funcao) + '</span>'
        + (detalhe ? '<span style="font-size:.73rem;color:var(--text3);flex-shrink:0">' + esc(detalhe) + '</span>' : '')
        + '</div>';
    }).join('');
    moCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Mão de Obra</div>'
      + moRows
      + '</div>';
  }

  // ── Terceiros (recursos) ──────────────────────────────────
  var tercCard = '';
  if (terceiros.length) {
    var tercRows = terceiros.map(function(t) {
      var valorStr = t.valor ? 'R$ ' + n2(t.valor).toFixed(2).replace('.', ',') : '';
      return '<div style="' + rowStyle + '">'
        + '<span style="color:var(--text3);flex-shrink:0;min-width:7rem">' + esc(t.fornecedor || '') + '</span>'
        + '<span style="' + valStyle + '">' + esc(t.servico) + '</span>'
        + (valorStr ? '<span style="font-size:.73rem;color:var(--text3);flex-shrink:0">' + esc(valorStr) + '</span>' : '')
        + '</div>';
    }).join('');
    tercCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Terceiros / Subcontratados</div>'
      + tercRows
      + '</div>';
  }

  // ── Placeholder ───────────────────────────────────────────
  var hasContent = especificacoes.length || memoriais.length || documentos.length
                 || notas || materiais.length || maoObra.length || terceiros.length;

  var placeholderCard = !hasContent
    ? '<div class="card" style="margin:0;color:var(--text3);font-size:.83rem;text-align:center;padding:1.5rem">Nenhum dado de engenharia registrado</div>'
    : '';

  el.innerHTML = '<div style="display:grid;gap:.6rem">'
    + especCard
    + notasCard
    + memCard
    + docCard
    + matCard
    + moCard
    + tercCard
    + placeholderCard
    + '</div>';
}

function renderExecucaoTab(p) {
  var el = document.getElementById('pd-panel-execucao');
  if (!el) return;

  var labelStyle = 'font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.4rem';
  var rowStyle   = 'display:flex;gap:.5rem;padding:.22rem 0;border-bottom:1px solid var(--border);font-size:.8rem';
  var keyStyle   = 'color:var(--text3);flex-shrink:0;min-width:9rem';
  var valStyle   = 'color:var(--text);flex:1';

  function infoRow(label, value) {
    if (!value) return '';
    return '<div style="' + rowStyle + '">'
      + '<span style="' + keyStyle + '">' + label + '</span>'
      + '<span style="' + valStyle + '">' + esc(value) + '</span>'
      + '</div>';
  }

  // ── Resolve sources ───────────────────────────────────────
  var sx  = (p.stages && p.stages.execucao)    || {};
  var se  = (p.stages && p.stages.entrega)     || {};
  var sp  = (p.stages && p.stages.planejamento)|| {};
  var tl  = p.tl || {};

  var progresso    = (typeof sx.progresso_pct === 'number') ? sx.progresso_pct : 0;
  var registros    = Array.isArray(sx.registros)        ? sx.registros.filter(function(r){ return r && r.descricao; }) : [];
  var apontIds     = Array.isArray(sx.apontamento_ids)  ? sx.apontamento_ids : [];

  var dtInicio     = sp.data_inicio   || tl.dtInicioExec || '';
  var dtTermino    = sp.data_termino  || tl.dtTermino    || '';
  var dtEntrega    = se.data_entrega  || '';
  var dtAceite     = se.data_aceite   || tl.dtAceite     || '';
  var respAceite   = se.responsavel_aceite || '';
  var observacoes  = se.observacoes   || '';
  var checklist    = Array.isArray(se.checklist) ? se.checklist.filter(function(c){ return c && c.item; }) : [];

  var fasObj   = (typeof FASE !== 'undefined' && FASE[p.fas]) || null;
  var fasLabel = fasObj ? (fasObj.i + ' ' + fasObj.n) : (p.fas || '—');

  // Execution-phase fases only for status colour
  var FAS_EXEC = ['andamento','em_pausa_falta_material','em_pausa_aguardando_cliente',
                  'em_pausa_aguardando_terceiro','taf','sat','atrasado'];
  var FAS_DONE = ['finalizado','faturado','recebido'];
  var fasColor = FAS_DONE.indexOf(p.fas) >= 0 ? '#3fb950'
               : p.fas === 'atrasado'          ? '#f85149'
               : FAS_EXEC.indexOf(p.fas) >= 0  ? '#d4a017'
               : 'var(--text2)';

  var hasDates = dtInicio || dtTermino || dtEntrega || dtAceite;

  // ── Status / Progresso ────────────────────────────────────
  var pctBar = progresso > 0
    ? '<div style="background:var(--bg3);border-radius:4px;height:8px;margin-top:.5rem;overflow:hidden">'
      + '<div style="background:var(--accent);width:' + Math.min(progresso, 100) + '%;height:100%;border-radius:4px"></div>'
      + '</div>'
      + '<div style="font-size:.7rem;color:var(--text3);margin-top:.2rem;text-align:right">' + progresso + '%</div>'
    : '';

  var statusCard = '<div class="card" style="margin:0">'
    + '<div style="' + labelStyle + '">Status de Execução</div>'
    + '<div style="font-size:.88rem;font-weight:700;color:' + fasColor + ';margin-bottom:' + (pctBar ? '.4rem' : '0') + '">' + esc(fasLabel) + '</div>'
    + pctBar
    + '</div>';

  // ── Datas ─────────────────────────────────────────────────
  var datasCard = hasDates
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Datas</div>'
      + infoRow('Início',          dtInicio)
      + infoRow('Término previsto',dtTermino)
      + infoRow('Entrega',         dtEntrega)
      + infoRow('Aceite',          dtAceite)
      + infoRow('Responsável aceite', respAceite)
      + '</div>'
    : '';

  // ── Checklist de entrega ──────────────────────────────────
  var checkCard = '';
  if (checklist.length) {
    var checkRows = checklist.map(function(c) {
      return '<div style="display:flex;align-items:center;gap:.55rem;padding:.25rem 0;border-bottom:1px solid var(--border);font-size:.8rem">'
        + '<span style="font-size:.85rem">' + (c.concluido ? '✅' : '⬜') + '</span>'
        + '<span style="color:' + (c.concluido ? 'var(--text)' : 'var(--text2)') + '">' + esc(c.item) + '</span>'
        + '</div>';
    }).join('');
    var done = checklist.filter(function(c){ return c.concluido; }).length;
    checkCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + ';display:flex;justify-content:space-between">'
      + '<span>Checklist de Entrega</span>'
      + '<span style="font-weight:600;color:var(--accent)">' + done + '/' + checklist.length + '</span>'
      + '</div>'
      + checkRows
      + '</div>';
  }

  // ── Registros de execução ─────────────────────────────────
  var regCard = '';
  if (registros.length) {
    var regRows = registros.slice().sort(function(a, b){
      return (b.data || '').localeCompare(a.data || '');
    }).map(function(r) {
      var statusColor = r.status === 'concluido' ? '#3fb950'
                      : r.status === 'pendente'  ? '#d4a017'
                      : 'var(--text3)';
      return '<div style="padding:.3rem 0;border-bottom:1px solid var(--border)">'
        + '<div style="display:flex;justify-content:space-between;gap:.5rem;margin-bottom:.12rem">'
        +   '<span style="font-size:.78rem;color:var(--text2);flex:1">' + esc(r.descricao) + '</span>'
        +   '<span style="font-size:.7rem;color:var(--text3);flex-shrink:0">' + esc(r.data || '') + '</span>'
        + '</div>'
        + (r.responsavel || r.status
            ? '<div style="font-size:.7rem;display:flex;gap:.6rem">'
              + (r.responsavel ? '<span style="color:var(--text3)">' + esc(r.responsavel) + '</span>' : '')
              + (r.status ? '<span style="color:' + statusColor + ';font-weight:600">' + esc(r.status) + '</span>' : '')
              + '</div>'
            : '')
        + '</div>';
    }).join('');
    regCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Registros de Execução</div>'
      + regRows
      + '</div>';
  }

  // ── Observações ───────────────────────────────────────────
  var observCard = (observacoes && observacoes.trim())
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Observações de Entrega</div>'
      + '<div style="font-size:.8rem;color:var(--text2);white-space:pre-wrap;line-height:1.5">' + esc(observacoes.trim()) + '</div>'
      + '</div>'
    : '';

  // ── Apontamentos / Despesas (RH — não vinculados ainda) ───
  var apont = apontIds.length
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Apontamentos</div>'
      + '<div style="font-size:.8rem;color:var(--text2)">' + apontIds.length + ' apontamento(s) vinculado(s) (detalhe disponível no módulo RH)</div>'
      + '</div>'
    : '';

  // ── Placeholder ───────────────────────────────────────────
  var hasContent = hasDates || checklist.length || registros.length
                 || progresso > 0 || observacoes || apontIds.length;

  var placeholderCard = !hasContent
    ? '<div class="card" style="margin:0;color:var(--text3);font-size:.83rem;text-align:center;padding:1.5rem">Nenhuma informação de execução registrada</div>'
    : '';

  el.innerHTML = '<div style="display:grid;gap:.6rem">'
    + statusCard
    + datasCard
    + checkCard
    + regCard
    + observCard
    + apont
    + placeholderCard
    + '</div>';
}

function renderComercialTab(p) {
  var el = document.getElementById('pd-panel-comercial');
  if (!el) return;

  var labelStyle = 'font-size:.65rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:.4rem';
  var rowStyle   = 'display:flex;gap:.5rem;padding:.22rem 0;border-bottom:1px solid var(--border);font-size:.8rem';
  var keyStyle   = 'color:var(--text3);flex-shrink:0;min-width:9rem';
  var valStyle   = 'color:var(--text);flex:1';

  function infoRow(label, value) {
    if (!value) return '';
    return '<div style="' + rowStyle + '">'
      + '<span style="' + keyStyle + '">' + label + '</span>'
      + '<span style="' + valStyle + '">' + esc(value) + '</span>'
      + '</div>';
  }

  // ── Status ────────────────────────────────────────────────
  var fasObj   = (typeof FASE !== 'undefined' && FASE[p.fas]) || null;
  var fasLabel = fasObj ? (fasObj.i + ' ' + fasObj.n) : (p.fas || '—');
  var fasColor = p.fas && p.fas.indexOf('perdido') === 0 ? '#f85149'
               : p.fas === 'aprovado' || p.fas === 'recebido' ? '#3fb950'
               : 'var(--text)';

  var statusCard = '<div class="card" style="margin:0">'
    + '<div style="' + labelStyle + '">Status</div>'
    + '<div style="font-size:.95rem;font-weight:700;color:' + fasColor + '">' + esc(fasLabel) + '</div>'
    + '</div>';

  // ── Datas ─────────────────────────────────────────────────
  var datasHtml = ''
    + infoRow('Data da proposta',  p.dat    || '')
    + infoRow('Envio / Follow-up', p.dat2   || '')
    + infoRow('Fechamento',        p.dtFech || '');

  var datasCard = datasHtml
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Datas</div>'
      + datasHtml
      + '</div>'
    : '';

  // ── Contato ───────────────────────────────────────────────
  var contatoHtml = ''
    + infoRow('Responsável', p.ac   || '')
    + infoRow('E-mail',      p.mail || '')
    + infoRow('Telefone',    p.tel  || '');

  var contatoCard = contatoHtml
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Contato</div>'
      + contatoHtml
      + '</div>'
    : '';

  // ── Observações ───────────────────────────────────────────
  var observCard = (p.cmnt && String(p.cmnt).trim())
    ? '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Observações</div>'
      + '<div style="font-size:.8rem;color:var(--text2);white-space:pre-wrap;line-height:1.5">' + esc(String(p.cmnt).trim()) + '</div>'
      + '</div>'
    : '';

  // ── Follow-up histórico ───────────────────────────────────
  var followHist = (p.stages && p.stages.followup && Array.isArray(p.stages.followup.historico))
    ? p.stages.followup.historico
    : [];

  var followCard = '';
  if (followHist.length) {
    var followRows = followHist.slice().sort(function(a, b) {
      return (b.data || '').localeCompare(a.data || '');
    }).map(function(h) {
      return '<div style="padding:.35rem 0;border-bottom:1px solid var(--border)">'
        + '<div style="display:flex;justify-content:space-between;gap:.5rem;margin-bottom:.15rem">'
        +   '<span style="font-size:.78rem;font-weight:600">' + esc(h.tipo || 'follow-up') + '</span>'
        +   '<span style="font-size:.7rem;color:var(--text3)">' + esc(h.data || '') + '</span>'
        + '</div>'
        + (h.contato  ? '<div style="font-size:.73rem;color:var(--text3)">Contato: ' + esc(h.contato) + '</div>' : '')
        + (h.outcome  ? '<div style="font-size:.73rem;color:var(--text2);margin-top:.1rem">' + esc(h.outcome) + '</div>' : '')
        + (h.proxima_acao ? '<div style="font-size:.7rem;color:var(--accent);margin-top:.15rem">Próxima ação: ' + esc(h.proxima_acao) + (h.proxima_data ? ' — ' + esc(h.proxima_data) : '') + '</div>' : '')
        + '</div>';
    }).join('');
    followCard = '<div class="card" style="margin:0">'
      + '<div style="' + labelStyle + '">Histórico de Follow-up</div>'
      + followRows
      + '</div>';
  }

  // ── Placeholder ───────────────────────────────────────────
  var hasFollow = followHist.length > 0;
  var placeholderCard = !hasFollow
    ? '<div class="card" style="margin:0;color:var(--text3);font-size:.83rem;text-align:center;padding:1.5rem">Nenhum histórico comercial disponível</div>'
    : '';

  el.innerHTML = '<div style="display:grid;gap:.6rem">'
    + statusCard
    + datasCard
    + contatoCard
    + observCard
    + followCard
    + placeholderCard
    + '</div>';
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
  html+=kpi('📞','Prospecção',_mStr(prosp),'Contato → Visita',_mCor(prosp,3,7),prosp.length);
  html+=kpi('📝','Elaboração',_mStr(elab),'Visita/Contato → Envio',_mCor(elab,5,15),elab.length);
  html+=kpi('⏳','Decisão do Cliente',_mStr(dec),'Envio → Fechamento',_mCor(dec,15,30),dec.length);
  html+=kpi('🏆','Ciclo Comercial Total',_mStr(cicCom),'Contato → Fechamento',_mCor(cicCom,30,60),cicCom.length);
  html+='</div>';

  // Execução
  html+='<div style="font-size:.7rem;color:#3fb950;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem">🟢 Ciclo de Execução</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin-bottom:.9rem">';
  html+=kpi('🚀','Gap Pré-Obra',_mStr(gapPre),'Fechamento → Início Exec.',_mCor(gapPre,7,30),gapPre.length);
  html+=kpi('⚙️','Duração da Execução',_mStr(exec),'Início → Término','#3fb950',exec.length);
  html+=(entNF.length?kpi('📋','Entrega → 1ª NF',_mStr(entNF),'Aceite/Término → NF',_mCor(entNF,3,10),entNF.length):'');
  html+='</div>';

  // Financeiro
  html+='<div style="font-size:.7rem;color:#d4a017;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.4rem">🟡 Ciclo Financeiro</div>';
  html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem">';
  html+=(mPMR!==null?kpi('📅','PMR Médio Real',mPMR+'d','Última NF → Recebimento',_mCor(pmr,30,60),pmr.length):'');
  html+=(mCicFin!==null?kpi('🔄','Ciclo Financeiro Total',mCicFin+'d','Início Exec. → Receb. Final',_mCor(cicFin,60,120),cicFin.length):'');
  html+=(mAdiPct!==null?kpi('💰','Adiantamento Médio',mAdiPct+'%','% do total faturado recebido antec.','#3fb950',adiantPcts.length):'');
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

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

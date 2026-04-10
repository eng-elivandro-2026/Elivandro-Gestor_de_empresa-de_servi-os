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

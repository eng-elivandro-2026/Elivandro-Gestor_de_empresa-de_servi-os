// ============================================================
// recuperacao-oficial-cnpj.js  v2 — Curadoria Manual por CNPJ
// Branch: portal/relacionamento-recuperar-clientes-cnpj-cidades
//
// PRÉVIA   → window.rcnpjExecutarPrevia()
//   Somente leitura. Exibe cards de curadoria manual por item.
//   NUNCA aplica nada automaticamente.
//
// APLICAÇÃO → window.rcnpjAplicarSelecionados()
//   Lê estado do DOM: só aplica itens com checkbox marcado.
//   Respeita edições manuais nos campos.
//   Não sobrescreve campo preenchido sem checkbox "Sobrescrever".
//   Cria backup antes de qualquer gravação.
//   Confirmação: "APLICAR SELECIONADOS TECFUSION"
//
// NUNCA apaga, migra, deduplica ou aplica sem seleção manual.
// ============================================================

(function (window) {
  'use strict';

  // ── Dados Oficiais (PDFs de CNPJ) ────────────────────────────
  var DADOS_OFICIAIS = [
    {
      _id_oficial:  'jde_jundiai',
      nome:         'JDE Jundiaí',
      razao_social: 'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:         '02.333.707/0049-90',
      cidade:       'JUNDIAI',
      uf:           'SP',
      endereco:     'AV JOSE BENASSI, 1000 — PARQUE INDUSTRIAL',
      cep:          '13.213-085',
      telefone:     '(11) 4199-6192 / (11) 4199-6115',
      email:        ''
    },
    {
      _id_oficial:  'jde_salvador',
      nome:         'JDE Salvador',
      razao_social: 'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:         '02.333.707/0036-75',
      cidade:       'SALVADOR',
      uf:           'BA',
      endereco:     'R DO LUXEMBURGO, 586 — GRANJAS RURAIS PRESIDENTE VARGAS',
      cep:          '41.230-130',
      telefone:     '(11) 4525-6111',
      email:        ''
    },
    {
      _id_oficial:  'jde_itaporanga',
      nome:         "JDE Itaporanga d'Ajuda",
      razao_social: 'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:         '02.333.707/0065-00',
      cidade:       "ITAPORANGA D'AJUDA",
      uf:           'SE',
      endereco:     'ROD BR 101 KM 118, S/N — ZONA RURAL',
      cep:          '49.120-000',
      telefone:     '(77) 3423-0339',
      email:        ''
    },
    {
      _id_oficial:  'jde_vitoria_conquista',
      nome:         'JDE Vitória da Conquista',
      razao_social: 'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:         '02.333.707/0066-90',
      cidade:       'VITORIA DA CONQUISTA',
      uf:           'BA',
      endereco:     'R I DT IND IMBORES, 375 — DISTRITO INDUSTRIAL',
      complemento:  'QUADRA I LOTE 03/04/09/10',
      cep:          '45.089-410',
      telefone:     '(77) 3423-0339',
      email:        ''
    },
    {
      _id_oficial:  'foods_piumhi',
      nome:         'Foods Piumhí',
      razao_social: 'FOODS INDUSTRIA E COMERCIO LTDA',
      cnpj:         '19.731.877/0001-80',
      cidade:       'PIUMHI',
      uf:           'MG',
      endereco:     'AV QUEROBINO MOURAO FILHO, 703 — BELA VISTA',
      cep:          '37.925-000',
      telefone:     '(37) 3371-4939',
      email:        ''
    },
    {
      _id_oficial:  'fago',
      nome:         'FAGO',
      razao_social: 'FAGO PROGRAMACAO LTDA.',
      cnpj:         '43.133.454/0001-43',
      cidade:       'JUNDIAI',
      uf:           'SP',
      endereco:     'R CORINA SOAVE GANDRA, 105 — JARDIM TORRES SAO JOSE',
      cep:          '13.214-531',
      telefone:     '(11) 5311-1736',
      email:        'YAGO@FENIXPROGRAMACAO.COM.BR'
    }
  ];

  // Padrões de nome de legados suspeitos (não apagar — só marcar)
  var NOMES_LEGADOS_SUSPEITOS = [
    'jde jdi','jde jundiai','jde jundiaí','jde salvador','jdi','piumhi','piumí','piumi'
  ];

  // Campos editáveis com rótulos amigáveis
  var CAMPOS_EDITAVEIS = [
    { key: 'nome',         label: 'Nome / Apelido exibido' },
    { key: 'razao_social', label: 'Razão social' },
    { key: 'cnpj',         label: 'CNPJ' },
    { key: 'cidade',       label: 'Cidade' },
    { key: 'uf',           label: 'UF' },
    { key: 'endereco',     label: 'Endereço' },
    { key: 'cep',          label: 'CEP' },
    { key: 'telefone',     label: 'Telefone' },
    { key: 'email',        label: 'E-mail' },
    { key: 'observacao',   label: 'Observação' }
  ];

  // ── Helpers ──────────────────────────────────────────────────
  function _normCnpj(s) { return String(s||'').replace(/\D/g,''); }
  function _norm(s)     { return String(s||'').toLowerCase().trim().replace(/\s+/g,' '); }
  function _esc(s)      { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _id()        { return 'rcnpj_'+Date.now()+'_'+Math.random().toString(36).substr(2,5); }
  function _normNome(n) {
    return _norm(n).replace(/[áàãâ]/g,'a').replace(/[éê]/g,'e').replace(/[íi]/g,'i')
      .replace(/[óôõ]/g,'o').replace(/[úü]/g,'u').replace(/ç/g,'c')
      .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  }
  function _v(id) { var e=document.getElementById(id); return e ? e.value : ''; }
  function _chk(id) { var e=document.getElementById(id); return e ? e.checked : false; }
  function _setChk(id, v) { var e=document.getElementById(id); if(e) e.checked=!!v; }
  function _highlight(id, on) {
    var e=document.getElementById(id);
    if(e) e.style.borderColor = on ? 'var(--blue)' : '';
  }

  // ── Empresa ativa ────────────────────────────────────────────
  function _getEmpresaId() {
    if (typeof window.getEmpresaAtivaId==='function'){ var r=window.getEmpresaAtivaId(); if(r) return r; }
    if (typeof window.getEmpresaAtiva==='function'){ var o=window.getEmpresaAtiva(); if(o&&o.id) return o.id; }
    if (window._empresaAtiva&&window._empresaAtiva.id) return window._empresaAtiva.id;
    try{ var s=JSON.parse(localStorage.getItem('tf_empresa_ativa')||'null'); if(s&&s.id) return s.id; }catch(e){}
    return null;
  }
  function _getEmpresaNome() {
    if (typeof window.getEmpresaAtiva==='function'){ var o=window.getEmpresaAtiva(); if(o&&o.nome_curto) return o.nome_curto; }
    if (window._empresaAtiva&&window._empresaAtiva.nome_curto) return window._empresaAtiva.nome_curto;
    try{ var s=JSON.parse(localStorage.getItem('tf_empresa_ativa')||'null'); if(s&&s.nome_curto) return s.nome_curto; }catch(e){}
    return null;
  }

  // ── localStorage / Supabase ──────────────────────────────────
  function _lsReadArr(k){ try{var v=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(v)?v:[];}catch(e){return[];} }
  function _lsWrite(k,v){ try{localStorage.setItem(k,JSON.stringify(v));}catch(e){console.error('[rcnpj] lsWrite falha',k,e);} }
  async function _sbLer(c){
    if(!window.sbClient) return null;
    try{var r=await window.sbClient.from('configuracoes').select('valor').eq('chave',c).maybeSingle();
    if(r.data&&Array.isArray(r.data.valor)) return r.data.valor;}catch(e){console.warn('[rcnpj] sbLer',c,e);}
    return null;
  }
  async function _sbGravar(c,v){
    if(!window.sbClient) return;
    try{var r=await window.sbClient.from('configuracoes')
      .upsert({chave:c,valor:v,updated_at:new Date().toISOString()},{onConflict:'chave'});
      if(r.error) console.warn('[rcnpj] sbGravar erro',c,r.error);}catch(e){console.warn('[rcnpj] sbGravar ex',c,e);}
  }

  // ── Comparação ───────────────────────────────────────────────
  function _isLegadoSuspeito(nome){
    var n=_normNome(nome);
    return NOMES_LEGADOS_SUSPEITOS.some(function(p){ var pn=_normNome(p);
      return n===pn||n.indexOf(pn)>=0||pn.indexOf(n)>=0; });
  }
  function _buscarPorCnpj(lista,cnpj){
    var n=_normCnpj(cnpj); if(!n) return null;
    return lista.find(function(c){return _normCnpj(c.cnpj||'')===n;})||null;
  }
  function _buscarPorNomeSimilar(lista,nome){
    var n=_normNome(nome);
    var tokens=n.split(' ').filter(function(t){return t.length>=3;});
    return lista.find(function(c){
      var cn=_normNome(c.nome||'');
      if(cn===n) return true;
      if(cn.indexOf(n)>=0||n.indexOf(cn)>=0) return true;
      if(tokens.length>=2){var com=tokens.filter(function(t){return cn.indexOf(t)>=0;});if(com.length>=2)return true;}
      return false;
    })||null;
  }
  // Retorna {campo: valorOficial} para campos VAZIOS no atual
  function _camposVaziosComplementaveis(atual,oficial){
    var r={};
    ['cnpj','cidade','uf','endereco','cep','telefone','email','razao_social','complemento'].forEach(function(c){
      var va=String(atual[c]||'').trim(); var vo=String(oficial[c]||'').trim();
      if(!va&&vo) r[c]=vo;
    });
    return r;
  }
  // Retorna {campo: {atual, novo}} para campos JÁ PREENCHIDOS que diferem
  function _camposPreenchidosConflito(atual,oficial){
    var r={};
    ['cnpj','cidade','uf','endereco','cep','telefone','email','razao_social'].forEach(function(c){
      var va=String(atual[c]||'').trim(); var vo=String(oficial[c]||'').trim();
      if(va&&vo&&va!==vo) r[c]={atual:va,novo:vo};
    });
    return r;
  }

  // ============================================================
  // PRÉVIA — somente leitura, monta estrutura para curadoria
  // ============================================================
  async function executarPrevia(){
    var eid=_getEmpresaId(); var enome=_getEmpresaNome()||'(desconhecida)';
    if(!eid) throw new Error('Empresa ativa não encontrada. Selecione uma empresa antes de continuar.');

    console.info('%c[rcnpj v2] PRÉVIA somente leitura','color:#f59e0b;font-weight:700');

    // Ler clientes atuais
    var keyCli='tf_clientes_'+eid;
    var cliLS=_lsReadArr(keyCli);
    var cliSB=await _sbLer(keyCli)||[];
    var idxLocal={}; cliLS.forEach(function(c){if(c.id)idxLocal[c.id]=true;});
    var cliAtual=cliLS.slice();
    cliSB.forEach(function(c){if(c.id&&!idxLocal[c.id])cliAtual.push(c);});

    // Clientes globais legados (somente leitura para cruzamento)
    var cliGlobal=_lsReadArr('tf_clientes');
    var cliSBG=await _sbLer('tf_clientes')||[];
    var idxG={}; cliGlobal.forEach(function(c){if(c.id)idxG[c.id]=true;});
    var cliGlobalAll=cliGlobal.slice();
    cliSBG.forEach(function(c){if(c.id&&!idxG[c.id])cliGlobalAll.push(c);});

    // Classificar cada dado oficial
    var itens=[];
    DADOS_OFICIAIS.forEach(function(of){
      var porCnpj     =_buscarPorCnpj(cliAtual,of.cnpj);
      var porNome     =!porCnpj?_buscarPorNomeSimilar(cliAtual,of.nome):null;
      var porCnpjG    =!porCnpj?_buscarPorCnpj(cliGlobalAll,of.cnpj):null;
      var tipo, existente=null, camposVazios={}, camposConflito={};

      if(porCnpj){
        existente=porCnpj;
        camposVazios=_camposVaziosComplementaveis(porCnpj,of);
        camposConflito=_camposPreenchidosConflito(porCnpj,of);
        tipo=Object.keys(camposVazios).length>0?'COMPLETAR':'JA_COMPLETO';
      } else if(porNome){
        existente=porNome;
        camposVazios=_camposVaziosComplementaveis(porNome,of);
        camposConflito=_camposPreenchidosConflito(porNome,of);
        tipo='POSSIVEL_DUPLICATA';
      } else if(porCnpjG){
        existente=porCnpjG;
        camposVazios=_camposVaziosComplementaveis(porCnpjG,of);
        tipo='RECUPERAR_DO_LEGADO';
      } else {
        tipo='CRIAR';
      }

      itens.push({
        tipo:tipo, oficial:of, existente:existente,
        camposVazios:camposVazios, camposConflito:camposConflito
      });
    });

    // Detectar legados suspeitos entre os clientes atuais
    var legadosSuspeitos=cliAtual.filter(function(c){
      return _isLegadoSuspeito(c.nome||'')&&!c._legado_suspeito;
    });

    return {
      empresa_id:eid, empresa_nome:enome, chave_alvo:keyCli,
      itens:itens, legados_suspeitos:legadosSuspeitos,
      timestamp:new Date().toISOString(),
      aviso:'PRÉVIA SOMENTE LEITURA — nenhum dado foi alterado.'
    };
  }

  // ============================================================
  // RENDERIZAÇÃO — curadoria manual por card
  // ============================================================

  var _COR={CRIAR:'#22c55e',COMPLETAR:'#3b82f6',JA_COMPLETO:'#6b7280',
    POSSIVEL_DUPLICATA:'#f59e0b',RECUPERAR_DO_LEGADO:'#8b5cf6',LEGADO:'#ef4444'};
  var _ICON={CRIAR:'➕',COMPLETAR:'✏️',JA_COMPLETO:'✅',POSSIVEL_DUPLICATA:'⚠️',RECUPERAR_DO_LEGADO:'♻️'};
  var _LABEL={CRIAR:'Criar novo',COMPLETAR:'Completar existente',JA_COMPLETO:'Já completo',
    POSSIVEL_DUPLICATA:'Possível duplicata',RECUPERAR_DO_LEGADO:'Recuperar do legado'};

  function _inputStyle(preenchido){
    return 'width:100%;background:var(--bg2);border:1px solid '+(preenchido?'var(--blue)':'var(--border)')+';color:var(--text);border-radius:4px;padding:.28rem .5rem;font-size:.73rem;box-sizing:border-box';
  }

  function _cardItem(item, idx){
    var of=item.oficial; var id=of._id_oficial;
    var cor=_COR[item.tipo]||'#6b7280';
    var acaoPadrao=item.tipo==='JA_COMPLETO'?'ignorar'
      :item.tipo==='POSSIVEL_DUPLICATA'?'revisar'
      :item.tipo==='RECUPERAR_DO_LEGADO'?'completar'
      :item.tipo==='COMPLETAR'?'completar':'criar';
    var selPadrao=item.tipo!=='JA_COMPLETO'&&item.tipo!=='POSSIVEL_DUPLICATA';

    var html='<div id="rcnpj-card-'+id+'" style="border:1px solid '+cor+'44;border-left:3px solid '+cor+';border-radius:8px;padding:0;margin-bottom:.7rem;background:var(--bg2);overflow:hidden">';

    // ── Cabeçalho clicável ─────────────────────────────────────
    html+='<div style="display:flex;align-items:center;gap:.6rem;padding:.6rem .85rem;background:var(--bg3);cursor:pointer" '
      +'onclick="(function(){ var b=document.getElementById(\'rcnpj-body-'+id+'\'); b.style.display=b.style.display===\'none\'?\'\':(b.style.display===\'\'?\'none\':\'none\'); })()">'
      +'<input type="checkbox" id="rcnpj_sel_'+id+'" '+(selPadrao?'checked':'')+' '
      +'onclick="event.stopPropagation();rcnpjAtualizarContador()" '
      +'style="width:16px;height:16px;cursor:pointer;accent-color:var(--blue)">'
      +'<span style="font-size:.82rem;font-weight:700;color:var(--text);flex:1">'+_esc(of.nome)+'</span>'
      +'<span style="font-size:.66rem;font-weight:700;color:'+cor+';background:'+cor+'1a;border-radius:4px;padding:.07rem .38rem">'
      +(_ICON[item.tipo]||'')+' '+(_LABEL[item.tipo]||item.tipo)+'</span>'
      +'<span style="font-size:.7rem;color:var(--text3)">▼</span>'
      +'</div>';

    // ── Corpo expansível ───────────────────────────────────────
    html+='<div id="rcnpj-body-'+id+'" style="padding:.7rem .85rem">';

    // Aviso geral
    html+='<div style="font-size:.68rem;color:var(--text3);margin-bottom:.6rem">'
      +'⚠️ Este item só será aplicado se o checkbox estiver marcado acima.</div>';

    // Seletor de ação
    html+='<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.75rem;flex-wrap:wrap">'
      +'<span style="font-size:.72rem;color:var(--text2);font-weight:600">Ação:</span>'
      +'<select id="rcnpj_acao_'+id+'" onchange="rcnpjAtualizarCard(\''+id+'\')" '
      +'style="background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:5px;padding:.28rem .5rem;font-size:.73rem">'
      +'<option value="criar"'+(acaoPadrao==='criar'?' selected':'')+'>➕ Criar novo</option>'
      +'<option value="completar"'+(acaoPadrao==='completar'?' selected':'')+'>✏️ Completar existente</option>'
      +'<option value="ignorar"'+(acaoPadrao==='ignorar'?' selected':'')+'>⏭️ Ignorar</option>'
      +'<option value="legado"'+(acaoPadrao==='legado'?' selected':'')+'>🚩 Marcar como duplicado legado</option>'
      +'<option value="revisar"'+(acaoPadrao==='revisar'?' selected':'')+'>🔖 Revisar depois</option>'
      +'</select>'
      +'</div>';

    // Campos editáveis
    html+='<div style="margin-bottom:.75rem">'
      +'<div style="font-size:.7rem;color:var(--text3);font-weight:600;margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.04em">Campos editáveis</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:.35rem .6rem">';

    CAMPOS_EDITAVEIS.forEach(function(campo){
      var vOficial=String(of[campo.key]||'').trim();
      var vAtual=item.existente?String(item.existente[campo.key]||'').trim():'';
      var temConflito=vAtual&&vOficial&&vAtual!==vOficial;
      var temComplemento=!vAtual&&vOficial;
      // Nome sempre usa o oficial como valor inicial
      var valorInicial=campo.key==='nome'?of.nome:vOficial;
      var colSpan=campo.key==='endereco'||campo.key==='razao_social'||campo.key==='observacao'?'grid-column:1/-1':'';

      html+='<div style="'+colSpan+'">'
        +'<div style="font-size:.63rem;color:var(--text3);margin-bottom:.08rem">'+_esc(campo.label)
        +(temComplemento?'<span style="color:#22c55e;margin-left:.25rem">● novo</span>':'')
        +(temConflito?'<span style="color:#f59e0b;margin-left:.25rem">⚠ conflito</span>':'')
        +'</div>'
        +'<input id="rcnpj_f_'+campo.key+'_'+id+'" type="text" value="'+_esc(valorInicial)+'" '
        +'style="'+_inputStyle(!!valorInicial)+'">';

      // Se campo atual já preenchido E diferente do oficial → opção sobrescrever
      if(temConflito){
        html+='<div style="font-size:.62rem;color:#f59e0b;margin-top:.1rem">Atual: <em>'+_esc(vAtual)+'</em></div>'
          +'<label style="font-size:.62rem;color:var(--text3);display:flex;align-items:center;gap:.25rem;cursor:pointer;margin-top:.05rem">'
          +'<input type="checkbox" id="rcnpj_sobr_'+campo.key+'_'+id+'" style="accent-color:#f59e0b">'
          +'Sobrescrever este campo</label>';
      }
      html+='</div>';
    });

    html+='</div></div>';

    // Cadastro atual encontrado
    if(item.existente){
      html+='<details style="margin-bottom:.6rem"><summary style="font-size:.69rem;color:var(--text3);cursor:pointer;padding:.2rem 0">📋 Cadastro atual encontrado na empresa</summary>';
      html+='<div style="background:var(--bg3);border-radius:4px;padding:.4rem .6rem;margin-top:.3rem;font-size:.7rem;color:var(--text2);display:grid;grid-template-columns:1fr 1fr;gap:.15rem .6rem">';
      var ex=item.existente;
      [['Nome',ex.nome],['CNPJ',ex.cnpj],['Cidade',ex.cidade],['UF',ex.uf],
       ['Endereço',ex.endereco],['CEP',ex.cep],['Telefone',ex.telefone],['E-mail',ex.email]]
        .forEach(function(par){
          html+='<span style="'+(par[0]==='Endereço'?'grid-column:1/-1':'')+'">'
            +par[0]+': '+(par[1]?'<strong>'+_esc(par[1])+'</strong>':'<em style="color:var(--text3)">vazio</em>')+'</span>';
        });
      html+='</div></details>';
    }

    // Diff: o que vai mudar
    var camposVaziosKeys=Object.keys(item.camposVazios||{});
    var camposConflitoKeys=Object.keys(item.camposConflito||{});
    if(camposVaziosKeys.length||camposConflitoKeys.length){
      html+='<details open style="margin-bottom:.6rem"><summary style="font-size:.69rem;color:var(--blue);cursor:pointer;padding:.2rem 0">🔄 Campos que serão alterados (se ação = Completar)</summary>';
      html+='<div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.2);border-radius:4px;padding:.4rem .6rem;margin-top:.3rem">';
      camposVaziosKeys.forEach(function(c){
        html+='<div style="font-size:.69rem;color:var(--text2);padding:.1rem 0">'
          +'<strong>'+_esc(c)+'</strong>: <em style="color:var(--text3)">vazio</em>'
          +' → <span style="color:#22c55e;font-weight:600">'+_esc(item.camposVazios[c])+'</span></div>';
      });
      camposConflitoKeys.forEach(function(c){
        var cf=item.camposConflito[c];
        html+='<div style="font-size:.69rem;color:var(--text2);padding:.1rem 0">'
          +'<strong>'+_esc(c)+'</strong>: <em>'+_esc(cf.atual)+'</em>'
          +' → <span style="color:#f59e0b;font-weight:600">'+_esc(cf.novo)+'</span>'
          +' <em style="color:var(--text3)">(somente com Sobrescrever)</em></div>';
      });
      html+='</div></details>';
    }

    // Botão "Confirmar decisão deste card"
    html+='<div style="display:flex;align-items:center;gap:.5rem;padding-top:.4rem;border-top:1px dashed var(--border)">'
      +'<button class="nb" onclick="rcnpjConfirmarCard(\''+id+'\')" '
      +'style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:.3rem .75rem;font-size:.72rem;font-weight:600;color:var(--text)">'
      +'💾 Confirmar decisão deste cadastro</button>'
      +'<span id="rcnpj_status_'+id+'" style="font-size:.68rem;color:var(--text3)"></span>'
      +'</div>';

    html+='</div></div>';
    return html;
  }

  function _cardLegado(cli, idx){
    var sid='leg_'+idx+'_'+(cli.id||'').replace(/[^a-z0-9]/gi,'').slice(-6);
    return '<div id="rcnpj-card-'+sid+'" style="border:1px solid rgba(239,68,68,.3);border-left:3px solid #ef4444;border-radius:8px;padding:.55rem .85rem;margin-bottom:.45rem;background:var(--bg2)">'
      +'<div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap">'
      +'<input type="checkbox" id="rcnpj_sel_'+sid+'" onclick="rcnpjAtualizarContador()" style="accent-color:#ef4444;width:15px;height:15px">'
      +'<span style="font-size:.78rem;font-weight:700;color:var(--text);flex:1">🚩 '+_esc(cli.nome||'?')+'</span>'
      +'<span style="font-size:.64rem;color:#ef4444">Duplicado legado suspeito</span>'
      +'</div>'
      +'<div style="font-size:.7rem;color:var(--text2);margin-top:.25rem;margin-left:1.4rem">'
      +(cli.cnpj?'CNPJ: '+_esc(cli.cnpj)+' · ':'<em>Sem CNPJ</em> · ')
      +(cli.cidade?_esc(cli.cidade):'<em>Sem cidade</em>')
      +'</div>'
      +'<div style="font-size:.66rem;color:var(--text3);margin-top:.2rem;margin-left:1.4rem">'
      +'Se marcado: recebe flag <code>_legado_suspeito: true</code> + aviso. <strong>Não será apagado.</strong>'
      +'</div>'
      +'<input type="hidden" id="rcnpj_legado_id_'+sid+'" value="'+_esc(cli.id||'')+'">'
      +'</div>';
  }

  function _renderizarCuradoria(preview, elId){
    var el=document.getElementById(elId);
    if(!el) return;
    var html='';

    // Aviso principal
    html+='<div style="background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.3);border-radius:6px;padding:.5rem .85rem;margin-bottom:.75rem;font-size:.73rem;color:var(--text2)">'
      +'✅ <strong>Curadoria manual</strong> — nenhum item é aplicado automaticamente. '
      +'Selecione, edite e confirme cada cadastro individualmente antes de aplicar.'
      +'</div>';

    // Empresa
    html+='<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.5rem .85rem;margin-bottom:.75rem;display:flex;align-items:center;gap:.6rem">'
      +'<div style="flex:1"><div style="font-size:.7rem;color:var(--text3);font-weight:600">Empresa alvo</div>'
      +'<div style="font-weight:700;color:var(--text)">'+_esc(preview.empresa_nome)+'</div>'
      +'<code style="font-size:.64rem;color:var(--text3)">'+_esc(preview.chave_alvo)+'</code></div>'
      +'</div>';

    // Contador de selecionados (atualizado via JS)
    html+='<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.4rem .75rem;margin-bottom:.75rem;display:flex;align-items:center;gap:.6rem;font-size:.74rem;color:var(--text2)">'
      +'<span>Selecionados para aplicar: <strong id="rcnpj_contador">...</strong></span>'
      +'<span style="margin-left:auto;font-size:.68rem;color:var(--text3)">Marque ou desmarque os checkboxes abaixo</span>'
      +'</div>';

    // Cadastros oficiais
    html+='<div style="font-size:.75rem;font-weight:700;color:var(--text2);margin-bottom:.45rem">'
      +'📋 Cadastros oficiais por CNPJ ('+preview.itens.length+')</div>';
    preview.itens.forEach(function(item,i){ html+=_cardItem(item,i); });

    // Legados suspeitos
    if(preview.legados_suspeitos&&preview.legados_suspeitos.length){
      html+='<div style="font-size:.75rem;font-weight:700;color:#ef4444;margin-top:.85rem;margin-bottom:.45rem">'
        +'🚩 Cadastros suspeitos de duplicidade ('+preview.legados_suspeitos.length+') — selecione os que deseja marcar</div>'
        +'<div style="font-size:.69rem;color:var(--text3);margin-bottom:.5rem">'
        +'Marcar apenas adiciona um aviso visual. Nenhum será apagado.</div>';
      preview.legados_suspeitos.forEach(function(c,i){ html+=_cardLegado(c,i); });
    }

    // Botão aplicar selecionados
    html+='<div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.3);border-radius:6px;padding:.8rem .9rem;margin-top:.85rem">'
      +'<div style="font-size:.74rem;font-weight:700;color:var(--text);margin-bottom:.35rem">🚀 Aplicar somente selecionados</div>'
      +'<div style="font-size:.7rem;color:var(--text2);margin-bottom:.55rem">'
      +'Será criado backup automático antes de qualquer gravação.<br>'
      +'Confirmação obrigatória: <strong>APLICAR SELECIONADOS TECFUSION</strong>'
      +'</div>'
      +'<button class="nb" onclick="rcnpjAplicarSelecionados()" '
      +'style="background:var(--blue);color:#fff;border-radius:6px;padding:.42rem 1.1rem;font-size:.78rem;font-weight:700">'
      +'✅ Aplicar somente selecionados</button>'
      +'</div>';

    el.innerHTML=html;

    // Atualizar contador inicial
    setTimeout(function(){ rcnpjAtualizarContador(); },50);
  }

  // ============================================================
  // APLICAÇÃO — lê seleções e edições do DOM
  // ============================================================
  async function aplicarSelecionados(preview){
    var eid=_getEmpresaId();
    if(!eid) throw new Error('Empresa ativa não encontrada.');
    if(eid!==preview.empresa_id) throw new Error('A empresa ativa mudou desde a prévia. Execute a prévia novamente.');

    var PALAVRA='APLICAR SELECIONADOS TECFUSION';
    var digitado=window.prompt(
      'Para confirmar a aplicação dos itens selecionados para "'+preview.empresa_nome+'":\n\nDigite exatamente:\n\n'+PALAVRA
    );
    if(digitado===null) return {cancelado:true,msg:'Cancelado pelo usuário.'};
    if((digitado||'').trim()!==PALAVRA) return {cancelado:true,msg:'Texto incorreto. Nenhum dado foi gravado.'};

    var keyCli='tf_clientes_'+eid;
    var lista=_lsReadArr(keyCli);

    // ── BACKUP antes de qualquer alteração ─────────────────────
    var ts=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
    var chvBkp='tf_clientes_backup_'+ts+'_'+eid;
    _lsWrite(chvBkp,lista);
    await _sbGravar(chvBkp,lista);
    console.info('[rcnpj v2] Backup criado:',chvBkp,'(',lista.length,'registros)');

    // Índice por id
    var idxId={}; lista.forEach(function(c,i){if(c.id) idxId[c.id]=i;});

    var rel={
      empresa_id:eid, empresa_nome:preview.empresa_nome, chave_backup:chvBkp,
      criados:0, completados:0, ignorados:0, marcados_legado:0,
      erros:[], cancelado:false, itens_aplicados:[]
    };

    // ── Processar itens oficiais selecionados ──────────────────
    preview.itens.forEach(function(item){
      var id=item.oficial._id_oficial;
      var selecionado=_chk('rcnpj_sel_'+id);
      if(!selecionado){ rel.ignorados++; return; }

      var acao=_v('rcnpj_acao_'+id)||'ignorar';
      if(acao==='ignorar'||acao==='revisar'){ rel.ignorados++; return; }

      try{
        // Coletar campos editados pelo usuário
        var campos={};
        CAMPOS_EDITAVEIS.forEach(function(c){
          var v=_v('rcnpj_f_'+c.key+'_'+id);
          if(v.trim()) campos[c.key]=v.trim();
        });

        if(acao==='criar'){
          var novo={
            id:_id(),
            nome:campos.nome||item.oficial.nome,
            razao_social:campos.razao_social||item.oficial.razao_social||'',
            cnpj:campos.cnpj||item.oficial.cnpj||'',
            cidade:campos.cidade||item.oficial.cidade||'',
            uf:campos.uf||item.oficial.uf||'',
            endereco:campos.endereco||item.oficial.endereco||'',
            complemento:campos.complemento||item.oficial.complemento||'',
            cep:campos.cep||item.oficial.cep||'',
            telefone:campos.telefone||item.oficial.telefone||'',
            email:campos.email||item.oficial.email||'',
            observacao:campos.observacao||'',
            criado:new Date().toISOString(),
            _recuperado:true,
            _fonte:'cnpj_oficial'
          };
          lista.push(novo);
          rel.criados++;
          rel.itens_aplicados.push({acao:'CRIADO',nome:novo.nome});
        }
        else if(acao==='completar'){
          var existeId=item.existente&&item.existente.id;
          if(existeId&&idxId[existeId]!==undefined){
            var idx2=idxId[existeId];
            var cAtual=Object.assign({},lista[idx2]);
            // Campos vazios: preencher com valor do input
            Object.keys(item.camposVazios||{}).forEach(function(c){
              var inputVal=campos[c]||item.camposVazios[c];
              if(inputVal&&!String(cAtual[c]||'').trim()) cAtual[c]=inputVal;
            });
            // Campos em conflito: sobrescrever só se checkbox marcado
            Object.keys(item.camposConflito||{}).forEach(function(c){
              if(_chk('rcnpj_sobr_'+c+'_'+id)){
                var inputVal=campos[c]||item.camposConflito[c].novo;
                if(inputVal) cAtual[c]=inputVal;
              }
            });
            lista[idx2]=cAtual;
            rel.completados++;
            rel.itens_aplicados.push({acao:'COMPLETADO',nome:cAtual.nome||'?'});
          }
        }
        else if(acao==='legado'){
          // Marcar como legado suspeito sem apagar
          if(item.existente&&item.existente.id&&idxId[item.existente.id]!==undefined){
            var idx3=idxId[item.existente.id];
            lista[idx3]=Object.assign({},lista[idx3],{
              _legado_suspeito:true,
              _aviso:'Duplicado legado suspeito — revisar manualmente'
            });
            rel.marcados_legado++;
            rel.itens_aplicados.push({acao:'MARCADO_LEGADO',nome:(lista[idx3].nome||'?')});
          }
        }
      }catch(e){
        rel.erros.push('Item '+id+': '+e.message);
        console.error('[rcnpj v2] Erro item',id,e);
      }
    });

    // ── Processar legados suspeitos selecionados ───────────────
    if(preview.legados_suspeitos&&preview.legados_suspeitos.length){
      preview.legados_suspeitos.forEach(function(cli,i){
        var sid='leg_'+i+'_'+(cli.id||'').replace(/[^a-z0-9]/gi,'').slice(-6);
        if(!_chk('rcnpj_sel_'+sid)) return;
        var cliId=_v('rcnpj_legado_id_'+sid)||cli.id;
        if(cliId&&idxId[cliId]!==undefined){
          lista[idxId[cliId]]=Object.assign({},lista[idxId[cliId]],{
            _legado_suspeito:true,
            _aviso:'Duplicado legado suspeito — revisar manualmente'
          });
          rel.marcados_legado++;
          rel.itens_aplicados.push({acao:'LEGADO_MARCADO',nome:(lista[idxId[cliId]].nome||'?')});
        }
      });
    }

    // ── Gravar ────────────────────────────────────────────────
    _lsWrite(keyCli,lista);
    await _sbGravar(keyCli,lista);
    try{if(typeof window.renderTabelaClientes==='function') window.renderTabelaClientes();}catch(e){}

    console.info('[rcnpj v2] Aplicação concluída:',rel);
    return rel;
  }

  // ── Renderizar relatório de aplicação ────────────────────────
  function _renderizarRelatorio(rel, elId){
    var el=document.getElementById(elId);
    if(!el) return;
    if(rel.cancelado){
      el.innerHTML='<div style="padding:1rem;background:rgba(107,114,128,.08);border:1px solid var(--border);border-radius:6px;font-size:.78rem;color:var(--text2)">🚫 '+_esc(rel.msg||'Cancelado.')+'</div>';
      return;
    }
    var html='<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.35);border-radius:6px;padding:.85rem;margin-bottom:.75rem">'
      +'<div style="font-weight:700;color:#22c55e;font-size:.9rem;margin-bottom:.55rem">✅ Aplicado com sucesso — '+_esc(rel.empresa_nome)+'</div>'
      +'<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.45rem">'
      +_bv('➕ Criados',rel.criados,'#22c55e')
      +_bv('✏️ Completados',rel.completados,'#3b82f6')
      +_bv('🚩 Marcados legado',rel.marcados_legado,'#ef4444')
      +_bv('⏭️ Ignorados',rel.ignorados,'#6b7280')
      +'</div>';
    if(rel.itens_aplicados.length){
      html+='<div style="font-size:.7rem;color:var(--text2)">';
      rel.itens_aplicados.forEach(function(a){
        html+='<div>'+_esc(a.acao)+': <strong>'+_esc(a.nome)+'</strong></div>';
      });
      html+='</div>';
    }
    html+='</div>';
    html+='<div style="font-size:.72rem;color:var(--text2);background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:.5rem .75rem;margin-bottom:.6rem">'
      +'💾 Backup: <code style="font-size:.68rem">'+_esc(rel.chave_backup)+'</code></div>';
    if(rel.erros&&rel.erros.length){
      html+='<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:5px;padding:.6rem .75rem;margin-bottom:.6rem">'
        +'<div style="font-size:.72rem;font-weight:600;color:#ef4444;margin-bottom:.25rem">Erros</div>';
      rel.erros.forEach(function(e){ html+='<div style="font-size:.7rem;color:var(--text2)">• '+_esc(e)+'</div>'; });
      html+='</div>';
    }
    html+='<div style="font-size:.68rem;color:var(--text3);text-align:center">Nenhum dado foi apagado. Legados suspeitos foram apenas marcados.</div>';
    el.innerHTML=html;
  }

  function _bv(label,n,cor){ return '<span style="background:'+cor+'1a;color:'+cor+';border:1px solid '+cor+'55;border-radius:4px;padding:.07rem .38rem;font-size:.68rem;font-weight:700">'+label+' '+n+'</span>'; }

  // ============================================================
  // FUNÇÕES GLOBAIS DE UI
  // ============================================================

  // Atualiza contador de itens selecionados
  window.rcnpjAtualizarContador = function(){
    var total=0; var selecionados=0;
    document.querySelectorAll('[id^="rcnpj_sel_"]').forEach(function(el){
      total++; if(el.checked) selecionados++;
    });
    var el=document.getElementById('rcnpj_contador');
    if(el) el.textContent=selecionados+' de '+total;
  };

  // Atualiza visual do card quando ação muda
  window.rcnpjAtualizarCard = function(id){
    var acao=_v('rcnpj_acao_'+id);
    var selEl=document.getElementById('rcnpj_sel_'+id);
    if(selEl){
      // Desmarcar automaticamente se ação for ignorar/revisar
      if(acao==='ignorar') selEl.checked=false;
      if(acao==='criar'||acao==='completar'||acao==='legado') selEl.checked=true;
    }
    rcnpjAtualizarContador();
  };

  // Confirmar decisão individual (visual apenas — não grava nada)
  window.rcnpjConfirmarCard = function(id){
    var acao=_v('rcnpj_acao_'+id)||'ignorar';
    var sel=_chk('rcnpj_sel_'+id);
    var statusEl=document.getElementById('rcnpj_status_'+id);
    var cardEl=document.getElementById('rcnpj-card-'+id);
    var labelAcao={criar:'Criar',completar:'Completar',ignorar:'Ignorar',legado:'Marcar legado',revisar:'Revisar depois'};
    if(statusEl){
      statusEl.style.color='#22c55e';
      statusEl.textContent='✔ Decisão: '+(sel?labelAcao[acao]||acao:'Não aplicar')+' (confirme pelo botão geral abaixo)';
    }
    if(cardEl) cardEl.style.opacity='.8';
    // Colapsar card após confirmação
    var body=document.getElementById('rcnpj-body-'+id);
    if(body) body.style.display='none';
  };

  // Executar prévia
  window.rcnpjExecutarPrevia = async function(){
    var el=document.getElementById('rcnpjResultado');
    if(!el){console.warn('[rcnpj] #rcnpjResultado não encontrado');return;}
    el.innerHTML='<div style="padding:1.5rem;text-align:center;color:var(--text3);font-size:.8rem">'
      +'🔍 Analisando cadastros oficiais vs clientes atuais...<br>'
      +'<span style="font-size:.7rem">Somente leitura — nada será alterado</span></div>';
    window._rcnpjPrevia=null;
    try{
      var preview=await executarPrevia();
      window._rcnpjPrevia=preview;
      _renderizarCuradoria(preview,'rcnpjResultado');
    }catch(e){
      console.error('[rcnpj] Erro prévia:',e);
      el.innerHTML='<div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;color:#ef4444;font-size:.77rem">❌ Erro: '+_esc(e.message)+'</div>';
    }
  };

  // Aplicar selecionados
  window.rcnpjAplicarSelecionados = async function(){
    if(!window._rcnpjPrevia){alert('Execute a prévia antes de aplicar.');return;}
    var el=document.getElementById('rcnpjResultado');
    try{
      var rel=await aplicarSelecionados(window._rcnpjPrevia);
      if(!rel.cancelado) window._rcnpjPrevia=null;
      _renderizarRelatorio(rel,'rcnpjResultado');
    }catch(e){
      console.error('[rcnpj] Erro aplicação:',e);
      if(el){
        var prev=el.innerHTML;
        el.innerHTML='<div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;color:#ef4444;font-size:.77rem;margin-bottom:.75rem">❌ '+_esc(e.message)+'</div>'+prev;
      }
    }
  };

  // Expor para console
  window.RcnpjPreview={executar:executarPrevia};
  window.RcnpjApply={aplicar:aplicarSelecionados};

  console.info('%c[rcnpj v2] curadoria manual carregada — window.rcnpjExecutarPrevia()','color:#22c55e;font-weight:700');

}(window));

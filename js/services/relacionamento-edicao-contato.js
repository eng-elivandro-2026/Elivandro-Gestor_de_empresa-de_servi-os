// ============================================================
// relacionamento-edicao-contato.js — Modal completo de edição
// de Contato com vínculo bidirecional a Empresa
//
// Regras:
//  - Respeita empresa_id / DataGuard / sem apagar dados
//  - Usa ctsSaveDirect (via cadastro.js)
//  - Usa ctsRenomear para propagação de renomeação
//  - empresa_cliente_id armazena o id da empresa vinculada
//  - Compatível com registros antigos (campo empresa como texto)
//  - Modal criado lazily — sem HTML hardcoded no index.html
//  - Sobrescreve window.editarContato
// ============================================================

(function () {
  'use strict';

  // ── Empresa ativa ───────────────────────────────────────────
  function _eid() {
    if (typeof window.getEmpresaAtivaId === 'function') {
      var id = window.getEmpresaAtivaId(); if (id) return id;
    }
    if (typeof window.getEmpresaAtiva === 'function') {
      var obj = window.getEmpresaAtiva(); if (obj && obj.id) return obj.id;
    }
    if (window._empresaAtiva && window._empresaAtiva.id) return window._empresaAtiva.id;
    try {
      var s = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
      if (s && s.id) return s.id;
    } catch (e) {}
    return null;
  }

  function _ctsLoad() { return typeof window.ctsGetAll === 'function' ? window.ctsGetAll() : []; }
  function _cliLoad() { return typeof window.cliGetAll === 'function' ? window.cliGetAll() : []; }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function _normTel(s) { return String(s || '').replace(/\D/g, ''); }

  // ── Estado interno ───────────────────────────────────────────
  var _cst = {
    contatoId:        null,
    modo:             'editar',
    callback:         null,
    empresaClienteId: null   // id da empresa selecionada no dropdown
  };

  // ── Estilos ─────────────────────────────────────────────────
  var S_INP = 'width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;'
    + 'border-radius:6px;padding:.46rem .6rem;font-size:.82rem;margin-top:.22rem;'
    + 'box-sizing:border-box';
  var S_LBL = 'font-size:.62rem;font-weight:600;color:#94a3b8;'
    + 'text-transform:uppercase;letter-spacing:.06em';
  var S_SEC = 'font-size:.72rem;font-weight:800;color:#38bdf8;'
    + 'text-transform:uppercase;letter-spacing:.07em;'
    + 'padding:.25rem 0 .45rem;border-bottom:1px solid #334155;margin-top:.15rem';
  var S_PANEL = 'background:#111827;border:1px solid #334155;border-radius:8px;padding:.85rem;display:flex;flex-direction:column;gap:.65rem';
  var S_BTN = 'padding:.46rem .85rem;border-radius:7px;cursor:pointer;font-size:.8rem;font-weight:700;border:1px solid #334155';
  var S_BTN_MUTED = S_BTN + ';background:#1e2535;color:#cbd5e1';
  var S_BTN_PRIMARY = S_BTN + ';background:#f05a1a;color:#000;border-color:#f05a1a';
  var S_BTN_DISABLED = S_BTN + ';background:#111827;color:#64748b;border-color:#334155;cursor:not-allowed';

  function _fld(lbl, id, type, ph) {
    return '<div><label style="' + S_LBL + '">' + lbl + '</label>'
      + '<input id="' + id + '" type="' + (type || 'text') + '" placeholder="'
      + ph + '" autocomplete="off" style="' + S_INP + '"></div>';
  }

  function _grid(cols, inner) {
    return '<div style="display:grid;grid-template-columns:' + cols + ';gap:.7rem">' + inner + '</div>';
  }

  function _id(prefix) {
    return (prefix || 'cta') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  function _setTituloModalContato() {
    var t = document.getElementById('m-editar-contato-titulo');
    var s = document.getElementById('m-editar-contato-sub');
    if (t) t.textContent = _cst.modo === 'novo' ? 'Novo Contato' : 'Editar Contato';
    if (s) s.textContent = _cst.modo === 'novo'
      ? 'Cadastre a pessoa e, se possível, vincule a uma empresa já existente.'
      : 'Ficha profissional da pessoa dentro da conta, mantendo compatibilidade com dados antigos.';
  }

  // ── Importar contato via imagem (OCR autocontido) ───────────
  // Loader do Tesseract.js duplicado de relacionamento-edicao-empresa.js (opção b),
  // adaptado para usar o status próprio do modal de contato (#eCtaOcrStatus).
  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  var _tesseractLoading = null;
  function _loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (_tesseractLoading) return _tesseractLoading;
    _tesseractLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = TESSERACT_URL;
      s.async = true;
      s.onload = function () {
        if (!window.Tesseract) { reject(new Error('Tesseract.js não ficou disponível após o carregamento.')); return; }
        resolve(window.Tesseract);
      };
      s.onerror = function () { reject(new Error('Não foi possível carregar Tesseract.js pela CDN.')); };
      document.head.appendChild(s);
    });
    return _tesseractLoading;
  }

  function _ctaIsImage(file) {
    return !!file && (/^image\/(jpeg|png|webp)$/i.test(file.type || '') || /\.(jpe?g|png|webp)$/i.test(file.name || ''));
  }

  function _setOcrStatus(msg, tipo) {
    var el = document.getElementById('eCtaOcrStatus');
    if (!el) return;
    var cor = tipo === 'erro' ? '#f87171' : (tipo === 'ok' ? '#34d399' : '#94a3b8');
    el.style.display = msg ? 'block' : 'none';
    el.style.color = cor;
    el.innerHTML = msg || '';
  }

  function _normalizarTextoOCR(txt) {
    return String(txt || '')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[|]/g, ' ')
      .trim();
  }

  async function _lerImagemPorOCR(imageSource, origem) {
    _setOcrStatus('Executando OCR, isso pode levar alguns segundos...', 'aviso');
    var Tesseract = await _loadTesseract();
    var result = await Tesseract.recognize(imageSource, 'por+eng', {
      logger: function (m) {
        if (!m || m.status !== 'recognizing text' || !m.progress) return;
        _setOcrStatus('Executando OCR... ' + Math.round(m.progress * 100) + '%', 'aviso');
      }
    });
    var texto = result && result.data && result.data.text ? result.data.text : '';
    texto = _normalizarTextoOCR(texto);
    if (!texto || texto.replace(/\s+/g, '').length < 40) {
      throw new Error('OCR sem resultado útil em ' + (origem || 'imagem'));
    }
    return texto;
  }

  // Heurística por palavras-chave (regex com limites de palavra p/ evitar falsos positivos).
  var _CARGO_RE = /\b(engenheir[oa]|analista|gerente|coordenador[a]?|diretor[a]?|supervisor[a]?|t[ée]cnic[oa]|assistente|consultor[a]?|especialista|manager|engineer|ceo|cto|cfo)\b/i;
  var _EMP_RE   = /\b(ltda|s\.?\/?a|me|eireli|inc|corp|group|grupo|solu[çc][õo]es|servi[çc]os|ind[úu]stria|com[ée]rcio)\b/i;
  var _DEPT_RE  = /\b(engenharia|manuten[çc][ãa]o|produ[çc][ãa]o|compras|ti|rh|financeiro|comercial|opera[çc][õo]es|log[íi]stica|qualidade)\b/i;

  function _linhasContato(txt) {
    return String(txt || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
  }

  function _extrairDadosContato(texto) {
    var lines = _linhasContato(texto);
    var reEmail    = /[\w.+-]+@[\w-]+\.[a-z]{2,}/i;
    var reTelG     = /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g;   // global: pega todos os números
    var reTelLine  = /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/;    // não-global: teste por linha
    var reLinkedin = /linkedin\.com\/in\/[\w-]+/i;
    var reLinkLike = /@|https?:|www\.|\.com/i;

    var email    = (texto.match(reEmail) || [''])[0];
    var linkedin = (texto.match(reLinkedin) || [''])[0];
    var tels     = texto.match(reTelG) || [];
    var telefone = tels[0] || '';
    var whatsapp = tels[1] || '';

    var nome = '', cargo = '', empresa = '', departamento = '';
    var usadas = {};

    // Cada linha entra em no máximo uma categoria (prioridade: cargo > empresa > departamento).
    for (var i = 0; i < lines.length; i++) {
      if (usadas[i]) continue;
      if (!cargo && _CARGO_RE.test(lines[i]))        { cargo = lines[i];        usadas[i] = true; continue; }
      if (!empresa && _EMP_RE.test(lines[i]))        { empresa = lines[i];      usadas[i] = true; continue; }
      if (!departamento && _DEPT_RE.test(lines[i]))  { departamento = lines[i]; usadas[i] = true; continue; }
    }

    // Nome: 1ª linha "limpa" (sem e-mail/url/telefone), 3–50 chars, com >= 2 palavras.
    for (var j = 0; j < lines.length; j++) {
      if (usadas[j]) continue;
      var l = lines[j];
      if (reLinkLike.test(l) || reTelLine.test(l)) continue;
      if (l.length < 3 || l.length > 50) continue;
      if (l.split(/\s+/).length < 2) continue;
      nome = l; usadas[j] = true; break;
    }

    // Empresa (fallback): última linha não usada que não seja e-mail/url/telefone.
    if (!empresa) {
      for (var k = lines.length - 1; k >= 0; k--) {
        if (usadas[k]) continue;
        var lk = lines[k];
        if (reLinkLike.test(lk) || reTelLine.test(lk)) continue;
        if (lk.length < 3) continue;
        empresa = lk; break;
      }
    }

    return {
      nome: nome, cargo: cargo, departamento: departamento,
      empresa: empresa, email: email, telefone: telefone,
      whatsapp: whatsapp, linkedin: linkedin
    };
  }

  // Preenche apenas campos VAZIOS — nunca sobrescreve o que o usuário já digitou.
  function _aplicarContatoAoForm(d) {
    var mapa = [
      { id: 'eCtaNome',     val: d.nome,         label: 'Nome' },
      { id: 'eCtaCargo',    val: d.cargo,        label: 'Cargo' },
      { id: 'eCtaDept',     val: d.departamento, label: 'Departamento' },
      { id: 'eCtaEmail',    val: d.email,        label: 'E-mail' },
      { id: 'eCtaTelefone', val: d.telefone,     label: 'Telefone' },
      { id: 'eCtaWhatsapp', val: d.whatsapp,     label: 'WhatsApp' },
      { id: 'eCtaLinkedin', val: d.linkedin,     label: 'LinkedIn' }
    ];
    var preenchidos = [], emBranco = [];
    mapa.forEach(function (f) {
      var el = document.getElementById(f.id);
      if (!el) return;
      var jaTem  = String(el.value || '').trim() !== '';
      var temDado = String(f.val || '').trim() !== '';
      if (jaTem) return;                       // não sobrescreve
      if (temDado) { el.value = f.val; preenchidos.push(f.label); }
      else { emBranco.push(f.label); }
    });
    var msg = '';
    if (preenchidos.length) msg += '✅ Preenchido(s): ' + preenchidos.join(', ') + '. ';
    if (emBranco.length)    msg += '✏️ Revise/complete: ' + emBranco.join(', ') + '.';
    if (!preenchidos.length && !emBranco.length) msg = 'Nenhum campo alterado (já estavam preenchidos).';
    _setOcrStatus(msg, preenchidos.length ? 'ok' : 'aviso');
  }

  window._ctaSelecionarImagem = function () {
    var input = document.getElementById('eCtaImgFile');
    if (!input) return;
    input.value = '';
    input.click();
  };

  // Núcleo: processa um File vindo de input file, colar (Ctrl+V) ou arrastar.
  async function _ctaProcessarArquivo(file) {
    if (!file) return;
    if (!_ctaIsImage(file)) { _setOcrStatus('Selecione uma imagem JPG, PNG ou WebP.', 'erro'); return; }
    if (file.size > 12 * 1024 * 1024) { _setOcrStatus('Imagem muito grande (limite 12 MB).', 'erro'); return; }
    try {
      _setOcrStatus('Lendo imagem...', 'aviso');
      var texto = await _lerImagemPorOCR(file, file.name || 'imagem');
      var dados = _extrairDadosContato(texto);
      _aplicarContatoAoForm(dados);
    } catch (e) {
      console.error('[ImportarContato OCR] erro:', e);
      _setOcrStatus('Não foi possível ler a imagem. Tente uma foto mais nítida ou preencha manualmente.', 'erro');
    }
  }

  window._ctaProcessarImagem = function (input) {
    var file = input && input.files && input.files[0];
    _ctaProcessarArquivo(file);
  };

  // ── Colar (Ctrl+V) e arrastar imagem ─────────────────────────
  // Listener de paste no document, ativo só enquanto o modal está aberto.
  function _ctaPasteHandler(ev) {
    var modal = document.getElementById('m-editar-contato');
    if (!modal || modal.style.display === 'none') return;
    var items = (ev.clipboardData && ev.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) {
      if (items[i] && /^image\//i.test(items[i].type || '')) {
        var file = items[i].getAsFile();
        if (file) { ev.preventDefault(); _ctaProcessarArquivo(file); return; }
      }
    }
  }
  function _ctaAtivarPaste() {
    document.removeEventListener('paste', _ctaPasteHandler); // evita duplicar
    document.addEventListener('paste', _ctaPasteHandler);
  }
  function _ctaDesativarPaste() {
    document.removeEventListener('paste', _ctaPasteHandler);
  }
  // Liga drag&drop + clique na drop zone (uma única vez, na criação do modal).
  function _ctaWireDropZone() {
    var dz = document.getElementById('eCtaDropZone');
    if (!dz || dz._wired) return;
    dz._wired = true;
    function hl(on) {
      dz.style.background = on ? '#15233b' : '#0f172a';
      dz.style.borderColor = on ? '#38bdf8' : '#334155';
    }
    dz.addEventListener('click', function () { window._ctaSelecionarImagem(); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); hl(true); });
    dz.addEventListener('dragleave', function (e) { e.preventDefault(); hl(false); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); hl(false);
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      if (!String(file.type || '').startsWith('image/')) { _setOcrStatus('Arraste um arquivo de imagem.', 'erro'); return; }
      _ctaProcessarArquivo(file);
    });
  }


  // ── Criar modal lazily ───────────────────────────────────────
  function _ensureModal() {
    if (document.getElementById('m-editar-contato')) return;

    var html = '<div id="m-editar-contato" style="display:none;position:fixed;inset:0;'
      + 'z-index:99991;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,.78);padding:1rem">'

      + '<div style="background:#1e2535;border:1px solid #334155;border-radius:10px;'
      + 'width:min(820px,98vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column">'

      // Header
      + '<div style="display:flex;align-items:center;justify-content:space-between;'
      + 'padding:.9rem 1rem;border-bottom:1px solid #334155;'
      + 'position:sticky;top:0;background:#1e2535;z-index:2;border-radius:10px 10px 0 0">'
      + '<div><div id="m-editar-contato-titulo" style="font-size:1rem;font-weight:800;color:#e2e8f0">Editar Contato</div>'
      + '<div id="m-editar-contato-sub" style="font-size:.72rem;color:#94a3b8;margin-top:.15rem"></div></div>'
      + '<button onclick="_fecharModalContato2()" style="background:none;border:none;'
      + 'color:#94a3b8;cursor:pointer;font-size:1rem;padding:.2rem .4rem">✕</button>'
      + '</div>'

      // Corpo
      + '<div style="padding:1rem;display:flex;flex-direction:column;gap:.9rem">'

      // Identificação da pessoa
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Identificação da pessoa</div>'
      + _grid('3fr 1fr',
          _fld('Nome *', 'eCtaNome', 'text', 'Ex: Rafael Soares')
      + '<div><label style="' + S_LBL + '">Status</label>'
      + '<select id="eCtaAtivo" style="' + S_INP + '">'
      + '<option value="true">Ativo</option>'
      + '<option value="false">Inativo</option>'
      + '</select></div>')
      + '<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">'
      + '<button type="button" onclick="_ctaSelecionarImagem()" title="Extrair dados de uma foto de cartão de visita ou assinatura de e-mail" style="' + S_BTN_MUTED + '">📷 Selecionar arquivo</button>'
      + '<input id="eCtaImgFile" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" style="display:none" onchange="_ctaProcessarImagem(this)">'
      + '<span style="font-size:.66rem;color:#64748b">OCR local · revise os campos antes de salvar</span>'
      + '</div>'
      + '<div id="eCtaDropZone" title="Clique, arraste uma imagem ou cole com Ctrl+V" style="cursor:pointer;border:1px dashed #334155;background:#0f172a;border-radius:8px;padding:.7rem;text-align:center;font-size:.74rem;color:#94a3b8;transition:background .15s,border-color .15s">📋 Arraste uma imagem ou cole com Ctrl+V</div>'
      + '<div id="eCtaOcrStatus" style="display:none;font-size:.72rem;margin-top:.1rem"></div>'
      + '</section>'

      // Comunicação
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Comunicação</div>'
      + _grid('1fr 1fr',
          _fld('E-mail', 'eCtaEmail', 'email', 'email@empresa.com')
        + _fld('Telefone', 'eCtaTelefone', 'text', '(11) 9999-0000'))
      + _grid('1fr 1fr',
          _fld('WhatsApp', 'eCtaWhatsapp', 'text', '(11) 9999-0000')
        + _fld('LinkedIn', 'eCtaLinkedin', 'text', 'linkedin.com/in/...'))
      + '<div><label style="' + S_LBL + '">Preferência de contato</label>'
      + '<select id="eCtaPreferencia" style="' + S_INP + '">'
      + '<option value="">Não definido</option>'
      + '<option value="email">E-mail</option>'
      + '<option value="telefone">Telefone</option>'
      + '<option value="whatsapp">WhatsApp</option>'
      + '<option value="linkedin">LinkedIn</option>'
      + '</select></div>'
      + '</section>'

      // Empresa vinculada
      + '<section style="' + S_PANEL + '">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">'
      + '<div style="' + S_SEC + ';flex:1;margin:0">Empresa vinculada</div>'
      + '<button type="button" onclick="_eeCtaFocarEmpresa()" style="' + S_BTN_MUTED + '">Vincular empresa</button>'
      + '<button type="button" disabled title="Fase futura: criar empresa sem perder os dados do contato" style="' + S_BTN_DISABLED + '">Criar empresa — em breve</button>'
      + '</div>'
      + '<div><label style="' + S_LBL + '">Empresa Vinculada</label>'
      + '<div style="position:relative">'
      + '<input id="eCtaEmpresa" type="text" placeholder="Buscar ou digitar empresa..." '
      + 'autocomplete="off" style="' + S_INP + '" '
      + 'oninput="_eeCtaEmpresaInput(this.value)" onfocus="_eeCtaEmpresaInput(this.value)" '
      + 'onblur="_eeCtaEmpresaBlur()">'
      + '<div id="eCtaEmpresaDD" style="display:none;position:absolute;top:calc(100% + 2px);'
      + 'left:0;right:0;z-index:9999;background:#1e2535;border:1px solid #334155;'
      + 'border-radius:6px;overflow-y:auto;max-height:180px;box-shadow:0 6px 18px rgba(0,0,0,.3)"></div>'
      + '</div>'
      + '<div id="eCtaEmpresaInfo" style="display:none;font-size:.7rem;color:#94a3b8;'
      + 'margin-top:.25rem;padding:.2rem .4rem;background:#0f172a;border-radius:4px"></div>'
      + '</div>'
      + '<div style="font-size:.72rem;color:#94a3b8;line-height:1.45">'
      + 'Ao selecionar uma empresa cadastrada, o contato mantém <code>empresa_cliente_id</code>. Se digitar livremente, o texto legado <code>empresa</code> continua válido.</div>'
      + '</section>'

      // Função/departamento
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Função / Departamento</div>'
      + _grid('1fr 1fr',
          _fld('Cargo / Função', 'eCtaCargo', 'text', 'Ex: Diretor de Compras')
        + _fld('Departamento', 'eCtaDept', 'text', 'Ex: Engenharia'))
      + _grid('1fr 1fr',
          _fld('Tipo / Origem do contato', 'eCtaOrigem', 'text', 'Ex: Indicação, LinkedIn')
        + _fld('Data do último contato', 'eCtaUltimoContato', 'date', ''))
      + '</section>'

      // Observações
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Observações</div>'
      + '<textarea id="eCtaObs" rows="3" placeholder="Informações de relacionamento, preferências, histórico ou cuidados..." '
      + 'style="' + S_INP + ';resize:vertical;min-height:4.2rem"></textarea>'
      + '</section>'

      + '</div>' // fim corpo

      // Footer
      + '<div style="display:flex;gap:.5rem;justify-content:space-between;align-items:center;flex-wrap:wrap;'
      + 'padding:.75rem 1rem;border-top:1px solid #334155;'
      + 'position:sticky;bottom:0;background:#1e2535;border-radius:0 0 10px 10px">'
      + '<div style="font-size:.7rem;color:#64748b">Sem migration, mantendo vínculo simples atual.</div>'
      + '<div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end">'
      + '<button onclick="_fecharModalContato2()" style="' + S_BTN_MUTED + '">Cancelar</button>'
      + '<button onclick="salvarEdicaoContato({novoDepois:true})" style="' + S_BTN_MUTED + '">Salvar e novo</button>'
      + '<button onclick="salvarEdicaoContato()" style="' + S_BTN_PRIMARY + '">Salvar</button>'
      + '</div>'
      + '</div>'

      + '</div></div>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstElementChild);
    _ctaWireDropZone();
  }

  window._eeCtaFocarEmpresa = function () {
    var inp = document.getElementById('eCtaEmpresa');
    if (inp) {
      inp.focus();
      _eeCtaRenderDD(inp.value || '');
    }
  };

  // ── Dropdown de empresas ────────────────────────────────────

  function _eeCtaRenderDD(q) {
    var dd  = document.getElementById('eCtaEmpresaDD');
    if (!dd) return;
    var all = _cliLoad();
    var ql  = (q || '').toLowerCase().trim();
    var hits = ql
      ? all.filter(function (e) {
          return (e.nome    || '').toLowerCase().indexOf(ql) >= 0
              || (e.apelido || '').toLowerCase().indexOf(ql) >= 0;
        }).slice(0, 8)
      : all.slice(0, 8);

    if (!hits.length) { dd.style.display = 'none'; return; }

    dd.innerHTML = hits.map(function (e) {
      var label = e.apelido ? e.apelido + ' — ' + e.nome : e.nome;
      var sub   = [e.cnpj, e.cidade].filter(Boolean).join(' · ');
      return '<div style="padding:.4rem .7rem;cursor:pointer;border-bottom:1px solid #334155;'
        + 'color:#e2e8f0;font-size:.8rem" '
        + 'data-eid="' + esc(e.id) + '" '
        + 'data-label="' + esc(e.apelido || e.nome) + '" '
        + 'data-rs="' + esc(e.nome) + '" '
        + 'data-cnpj="' + esc(e.cnpj || '') + '" '
        + 'data-cidade="' + esc(e.cidade || '') + '" '
        + 'onmouseover="this.style.background=\'#334155\'" '
        + 'onmouseout="this.style.background=\'\'">'
        + '<div style="font-weight:600">' + esc(label) + '</div>'
        + (sub ? '<div style="font-size:.7rem;color:#94a3b8;margin-top:.1rem">' + esc(sub) + '</div>' : '')
        + '</div>';
    }).join('');

    dd.querySelectorAll('div[data-eid]').forEach(function (item) {
      item.addEventListener('mousedown', function (e) {
        e.preventDefault();
        _eeCtaSelectEmpresa(
          item.getAttribute('data-eid'),
          item.getAttribute('data-label'),
          item.getAttribute('data-rs'),
          item.getAttribute('data-cnpj'),
          item.getAttribute('data-cidade')
        );
      });
    });

    dd.style.display = 'block';
  }

  function _eeCtaSelectEmpresa(id, label, rs, cnpj, cidade) {
    _cst.empresaClienteId = id;
    var inp  = document.getElementById('eCtaEmpresa');
    var info = document.getElementById('eCtaEmpresaInfo');
    var dd   = document.getElementById('eCtaEmpresaDD');
    if (inp) inp.value = label;
    if (dd)  dd.style.display = 'none';
    if (info) {
      var parts = [];
      if (rs !== label) parts.push('Razão Social: ' + rs);
      if (cnpj)         parts.push('CNPJ: ' + cnpj);
      if (cidade)       parts.push(cidade);
      if (parts.length) {
        info.textContent = parts.join(' · ');
        info.style.display = '';
      } else {
        info.style.display = 'none';
      }
    }
  }

  window._eeCtaEmpresaInput = function (val) {
    // Clear previous selection when user types manually
    _cst.empresaClienteId = null;
    var info = document.getElementById('eCtaEmpresaInfo');
    if (info) info.style.display = 'none';
    _eeCtaRenderDD(val);
  };

  window._eeCtaEmpresaBlur = function () {
    setTimeout(function () {
      var dd = document.getElementById('eCtaEmpresaDD');
      if (dd) dd.style.display = 'none';
    }, 220);
  };

  // ── Abrir modal ─────────────────────────────────────────────
  window.abrirModalEditarContato = function (id) {
    _ensureModal();
    var all  = _ctsLoad();
    var item = all.find(function (x) { return x.id === id; });
    if (!item) { console.error('[EdicaoContato] contato não encontrado:', id); return; }

    _cst.contatoId        = id;
    _cst.modo             = 'editar';
    _cst.callback         = null;
    _cst.empresaClienteId = item.empresa_cliente_id || null;
    _setTituloModalContato();

    function sv(elId, val) {
      var el = document.getElementById(elId);
      if (el) el.value = (val !== undefined && val !== null) ? String(val) : '';
    }

    sv('eCtaNome',          item.nome          || '');
    sv('eCtaEmpresa',       item.empresa        || '');
    sv('eCtaCargo',         item.cargo          || (item.departamento || ''));
    sv('eCtaDept',          item.departamento   || '');
    sv('eCtaEmail',         item.email          || '');
    sv('eCtaTelefone',      item.telefone       || '');
    sv('eCtaWhatsapp',      item.whatsapp       || '');
    sv('eCtaLinkedin',      item.linkedin       || '');
    sv('eCtaOrigem',        item.origem         || '');
    sv('eCtaUltimoContato', item.ultimo_contato || '');
    sv('eCtaObs',           item.obs            || '');

    var ativoEl = document.getElementById('eCtaAtivo');
    if (ativoEl) ativoEl.value = (item.ativo === false) ? 'false' : 'true';

    var prefEl = document.getElementById('eCtaPreferencia');
    if (prefEl) prefEl.value = item.preferencia_contato || '';

    // Empresa info (se já vinculada)
    var info = document.getElementById('eCtaEmpresaInfo');
    if (info) {
      if (item.empresa_cliente_id) {
        var emp = _cliLoad().find(function (e) { return e.id === item.empresa_cliente_id; });
        if (emp) {
          var sub = [emp.cnpj, emp.cidade].filter(Boolean).join(' · ');
          if (emp.nome !== item.empresa) sub = 'Razão Social: ' + emp.nome + (sub ? ' · ' + sub : '');
          info.textContent = sub || '';
          info.style.display = sub ? '' : 'none';
        } else {
          info.style.display = 'none';
        }
      } else {
        info.style.display = 'none';
      }
    }

    // Clear dropdown
    var dd = document.getElementById('eCtaEmpresaDD');
    if (dd) dd.style.display = 'none';

    _setOcrStatus('');      // limpa status de OCR de uma abertura anterior
    _ctaAtivarPaste();      // habilita colar imagem (Ctrl+V) enquanto o modal está aberto

    var m = document.getElementById('m-editar-contato');
    if (m) { m.style.display = 'flex'; m.scrollTop = 0; }
  };

  window.abrirModalNovoContatoProfissional = function (nome, callback) {
    _ensureModal();
    _cst.contatoId        = null;
    _cst.modo             = 'novo';
    _cst.callback         = callback || null;
    _cst.empresaClienteId = null;
    _setTituloModalContato();

    [
      'eCtaNome','eCtaEmpresa','eCtaCargo','eCtaDept','eCtaEmail','eCtaTelefone',
      'eCtaWhatsapp','eCtaLinkedin','eCtaOrigem','eCtaUltimoContato','eCtaObs'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var nomeEl = document.getElementById('eCtaNome');
    if (nomeEl) nomeEl.value = nome || '';
    var ativoEl = document.getElementById('eCtaAtivo');
    if (ativoEl) ativoEl.value = 'true';
    var prefEl = document.getElementById('eCtaPreferencia');
    if (prefEl) prefEl.value = '';
    var info = document.getElementById('eCtaEmpresaInfo');
    if (info) info.style.display = 'none';
    var dd = document.getElementById('eCtaEmpresaDD');
    if (dd) dd.style.display = 'none';

    _setOcrStatus('');      // limpa status de OCR de uma abertura anterior
    _ctaAtivarPaste();      // habilita colar imagem (Ctrl+V) enquanto o modal está aberto

    var m = document.getElementById('m-editar-contato');
    if (m) { m.style.display = 'flex'; m.scrollTop = 0; }
  };

  // ── Fechar modal ─────────────────────────────────────────────
  window._fecharModalContato2 = function () {
    _ctaDesativarPaste();   // remove o listener de paste para não vazar
    var m = document.getElementById('m-editar-contato');
    if (m) m.style.display = 'none';
    _cst.contatoId        = null;
    _cst.modo             = 'editar';
    _cst.callback         = null;
    _cst.empresaClienteId = null;
  };

  // ── Salvar contato ───────────────────────────────────────────
  window.salvarEdicaoContato = function (opcoes) {
    opcoes = opcoes || {};
    var gv = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    var nome = gv('eCtaNome');
    if (!nome) { alert('Nome é obrigatório.'); return; }
    if (!_eid()) { alert('Empresa ativa não identificada.'); return; }

    var email = gv('eCtaEmail').toLowerCase();
    var tel   = _normTel(gv('eCtaTelefone'));

    // Verificar duplicata de e-mail/telefone (ignorando o próprio contato)
    if (email || tel) {
      var dup = _ctsLoad().find(function (c) {
        if (_cst.contatoId && c.id === _cst.contatoId) return false;
        if (email && c.email && c.email.trim().toLowerCase() === email) return true;
        if (tel   && _normTel(c.telefone) === tel && tel.length >= 8)   return true;
        return false;
      });
      if (dup) {
        alert('Já existe um contato com este e-mail ou telefone:\n' + dup.nome);
        return;
      }
    }

    var allCts = _ctsLoad();
    var idx = -1;
    if (_cst.contatoId) {
      for (var i = 0; i < allCts.length; i++) { if (allCts[i].id === _cst.contatoId) { idx = i; break; } }
      if (idx < 0) { alert('Contato não encontrado. Feche e tente novamente.'); return; }
    }

    var old     = idx >= 0 ? allCts[idx] : {};
    var oldNome = old.nome || '';

    var empTexto = gv('eCtaEmpresa');
    var empId    = _cst.empresaClienteId || null;

    // Se o texto foi apagado, limpar empresa_cliente_id também
    if (!empTexto) empId = null;

    var updated = Object.assign({}, old, {
      id:                 old.id || _id('cad'),
      nome:               nome,
      cargo:              gv('eCtaCargo'),
      departamento:       gv('eCtaDept'),
      empresa:            empTexto,
      empresa_cliente_id: empId,
      email:              gv('eCtaEmail'),
      telefone:           gv('eCtaTelefone'),
      whatsapp:           gv('eCtaWhatsapp'),
      linkedin:           gv('eCtaLinkedin'),
      origem:             gv('eCtaOrigem'),
      ultimo_contato:     gv('eCtaUltimoContato'),
      preferencia_contato: (document.getElementById('eCtaPreferencia') || {value:''}).value,
      ativo:              document.getElementById('eCtaAtivo')
                            ? document.getElementById('eCtaAtivo').value !== 'false'
                            : (old.ativo !== false),
      obs:                (document.getElementById('eCtaObs') || {value:''}).value.trim()
    });

    var newList = idx >= 0
      ? allCts.map(function (c, j) { return j === idx ? updated : c; })
      : [updated].concat(allCts);

    if (typeof window.ctsSaveDirect === 'function') {
      window.ctsSaveDirect(newList);
    } else {
      console.error('[EdicaoContato] ctsSaveDirect não disponível');
      return;
    }

    // Propagar renomeação
    if (idx >= 0 && oldNome && oldNome !== nome) {
      if (typeof window.ctsRenomear === 'function') window.ctsRenomear(oldNome, nome);
    }

    var cb = _cst.callback;
    window._fecharModalContato2();
    if (typeof window.renderTabelaContatos === 'function') window.renderTabelaContatos();
    if (typeof cb === 'function') cb(updated);
    if (typeof toast === 'function') toast((idx >= 0 ? '✅ Contato atualizado: ' : '✅ Contato cadastrado: ') + nome, 'ok');
    if (opcoes.novoDepois) window.abrirModalNovoContatoProfissional('', cb || null);
  };

  // ── Override: editarContato agora abre o modal completo ──────
  window.editarContato = function (id) {
    window.abrirModalEditarContato(id);
  };

  window.abrirModalNovoContato = function (nome, callback) {
    window.abrirModalNovoContatoProfissional(nome || '', callback || null);
  };

})();

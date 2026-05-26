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

  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
  var _pdfJsLoading = null;
  var _tesseractLoading = null;
  var _contatoOcr = { texto: '', dados: null, arquivo: null, empresaProvavel: null };

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
      + '</section>'

      // Comunicação
      + '<section style="' + S_PANEL + '">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">'
      + '<div style="' + S_SEC + ';flex:1;margin:0">Comunicação</div>'
      + '<button type="button" onclick="_eeSelecionarArquivoContato()" '
      + 'title="Importa imagem, PDF, cartão ou assinatura para conferência antes de preencher o contato" '
      + 'style="' + S_BTN_MUTED + '">Importar imagem/PDF do contato</button>'
      + '</div>'
      + '<input id="eCtaArquivoContato" type="file" '
      + 'accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" '
      + 'onchange="_eeProcessarArquivoContato(this)" style="display:none">'
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
  }

  function _toast(msg, tipo) {
    if (typeof window.toast === 'function') window.toast(msg, tipo || 'info');
    else if (typeof toast === 'function') toast(msg, tipo || 'info');
    else alert(msg);
  }

  function _ensureImportContatoModal() {
    if (document.getElementById('m-contato-ocr')) return;

    var fields = [
      ['nome', 'Nome'],
      ['cargo', 'Cargo / Função'],
      ['departamento', 'Departamento'],
      ['tipoContato', 'Tipo / Origem do contato'],
      ['empresa', 'Empresa textual'],
      ['email', 'E-mail'],
      ['telefone', 'Telefone'],
      ['whatsapp', 'WhatsApp'],
      ['obs', 'Observações sugeridas']
    ].map(function (f) {
      var textarea = f[0] === 'obs';
      return '<div><label style="' + S_LBL + '">' + f[1] + '</label>'
        + (textarea
          ? '<textarea data-contato-ocr-field="' + f[0] + '" rows="3" style="' + S_INP + ';resize:vertical;min-height:4rem"></textarea>'
          : '<input data-contato-ocr-field="' + f[0] + '" type="text" style="' + S_INP + '">')
        + '<div data-contato-ocr-missing="' + f[0] + '" style="display:none;color:#f59e0b;font-size:.68rem;margin-top:.18rem">Campo não identificado automaticamente.</div>'
        + '</div>';
    }).join('');

    var html = '<div id="m-contato-ocr" style="display:none;position:fixed;inset:0;z-index:99994;'
      + 'align-items:center;justify-content:center;background:rgba(0,0,0,.78);padding:1rem">'
      + '<div style="background:#1e2535;border:1px solid #334155;border-radius:10px;'
      + 'width:min(900px,98vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;'
      + 'padding:.9rem 1rem;border-bottom:1px solid #334155;position:sticky;top:0;background:#1e2535;z-index:2">'
      + '<div><div style="font-size:1rem;font-weight:800;color:#e2e8f0">Conferência de dados do contato</div>'
      + '<div style="font-size:.72rem;color:#94a3b8;margin-top:.15rem">Dados extraídos automaticamente devem ser conferidos antes de salvar.</div></div>'
      + '<button onclick="_eeFecharConferenciaContatoOcr()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1rem;padding:.2rem .4rem">✕</button>'
      + '</div>'
      + '<div style="padding:1rem;display:flex;flex-direction:column;gap:.85rem">'
      + '<div id="contatoOcrStatus" style="font-size:.78rem;color:#94a3b8"></div>'
      + '<div id="contatoOcrDuplicado" style="display:none;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.35);'
      + 'border-radius:8px;padding:.7rem;color:#f59e0b;font-size:.76rem;line-height:1.45"></div>'
      + '<div id="contatoOcrEmpresaAviso" style="display:none;background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.3);'
      + 'border-radius:8px;padding:.7rem;color:#7dd3fc;font-size:.76rem;line-height:1.45"></div>'
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Dados encontrados para conferência</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem">' + fields + '</div>'
      + '</section>'
      + '<section style="' + S_PANEL + '">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">'
      + '<div style="' + S_SEC + ';flex:1;margin:0">Texto extraído</div>'
      + '<button onclick="_eeToggleTextoContatoOcr()" style="' + S_BTN_MUTED + '">Ver texto extraído</button>'
      + '</div>'
      + '<pre id="contatoOcrTexto" style="display:none;white-space:pre-wrap;max-height:220px;overflow:auto;'
      + 'background:#0f172a;border:1px solid #334155;border-radius:8px;padding:.7rem;color:#cbd5e1;font-size:.72rem"></pre>'
      + '</section>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap;padding:.75rem 1rem;'
      + 'border-top:1px solid #334155;position:sticky;bottom:0;background:#1e2535">'
      + '<button onclick="_eeFecharConferenciaContatoOcr()" style="' + S_BTN_MUTED + '">Cancelar importação</button>'
      + '<button onclick="_eeAplicarContatoOcrAoFormulario()" style="' + S_BTN_PRIMARY + '">Aplicar dados ao contato</button>'
      + '</div>'
      + '</div></div>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstElementChild);
  }

  function _setStatusContatoImport(msg, tipo) {
    var el = document.getElementById('contatoOcrStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = tipo === 'erro' ? '#f87171' : (tipo === 'ok' ? '#34d399' : '#f59e0b');
  }

  function _loadPdfJsContato() {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return Promise.resolve(window.pdfjsLib);
    }
    if (_pdfJsLoading) return _pdfJsLoading;
    _pdfJsLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = PDFJS_URL;
      s.async = true;
      s.onload = function () {
        if (!window.pdfjsLib) { reject(new Error('pdf.js não ficou disponível após o carregamento.')); return; }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error('Não foi possível carregar pdf.js pela CDN.')); };
      document.head.appendChild(s);
    });
    return _pdfJsLoading;
  }

  function _loadTesseractContato() {
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

  function _isPdfContato(file) {
    return !!file && ((file.type || '') === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
  }

  function _isImagemContato(file) {
    return !!file && (/^image\/(jpeg|png|webp)$/i.test(file.type || '') || /\.(jpe?g|png|webp)$/i.test(file.name || ''));
  }

  async function _lerImagemContatoPorOCR(imageSource, origem) {
    _setStatusContatoImport('Executando OCR, isso pode levar alguns segundos...', 'aviso');
    var Tesseract = await _loadTesseractContato();
    var result = await Tesseract.recognize(imageSource, 'por+eng', {
      logger: function (m) {
        if (!m || m.status !== 'recognizing text' || !m.progress) return;
        _setStatusContatoImport('Executando OCR... ' + Math.round(m.progress * 100) + '%', 'aviso');
      }
    });
    var texto = result && result.data && result.data.text ? result.data.text : '';
    texto = _normalizarTextoContatoOCR(texto);
    if (!texto || texto.replace(/\s+/g, '').length < 25) {
      throw new Error('OCR sem resultado útil em ' + (origem || 'imagem'));
    }
    return texto;
  }

  async function _renderPdfContatoPageToCanvas(pdf, pageNum) {
    var page = await pdf.getPage(pageNum);
    var viewport = page.getViewport({ scale: 2 });
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
    return canvas;
  }

  async function _lerPdfContatoEscaneadoPorOCR(pdf) {
    var maxPages = Math.min(pdf.numPages || 0, 2);
    if (!maxPages) throw new Error('PDF sem páginas para OCR.');
    var partes = [];
    _setStatusContatoImport('PDF sem texto selecionável, iniciando OCR nas primeiras ' + maxPages + ' página(s)...', 'aviso');
    for (var i = 1; i <= maxPages; i++) {
      _setStatusContatoImport('Renderizando página ' + i + ' para OCR...', 'aviso');
      var canvas = await _renderPdfContatoPageToCanvas(pdf, i);
      partes.push(await _lerImagemContatoPorOCR(canvas, 'página ' + i));
    }
    return _normalizarTextoContatoOCR(partes.join('\n\n'));
  }

  window._eeSelecionarArquivoContato = function () {
    _ensureImportContatoModal();
    var input = document.getElementById('eCtaArquivoContato');
    if (!input) return;
    input.value = '';
    input.click();
  };

  window._eeProcessarArquivoContato = async function (input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    if (!_isPdfContato(file) && !_isImagemContato(file)) {
      _toast('Selecione um PDF ou imagem válida (JPG, PNG ou WebP).', 'err');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      _toast('Arquivo muito grande. Limite sugerido nesta fase: 12 MB.', 'err');
      return;
    }
    try {
      _ensureImportContatoModal();
      _abrirConferenciaContatoOcr();
      _setStatusContatoImport('Lendo arquivo...', 'aviso');
      _contatoOcr = { texto: '', dados: null, arquivo: file.name || '', empresaProvavel: null };
      var texto = '';

      if (_isImagemContato(file)) {
        _setStatusContatoImport('Imagem selecionada. Executando OCR, isso pode levar alguns segundos...', 'aviso');
        texto = await _lerImagemContatoPorOCR(file, file.name || 'imagem');
        _finalizarTextoContatoImportado(texto);
        return;
      }

      var pdfjs = await _loadPdfJsContato();
      _setStatusContatoImport('Tentando extrair texto...', 'aviso');
      var buffer = await file.arrayBuffer();
      var pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      var partes = [];
      for (var p = 1; p <= pdf.numPages; p++) {
        var page = await pdf.getPage(p);
        var content = await page.getTextContent();
        var pageText = (content.items || []).map(function (it) { return it.str || ''; }).join('\n');
        partes.push(pageText);
      }
      texto = _normalizarTextoContatoPDF(partes.join('\n'));
      if (!texto || texto.replace(/\s+/g, '').length < 50) {
        texto = await _lerPdfContatoEscaneadoPorOCR(pdf);
      }
      _finalizarTextoContatoImportado(texto);
    } catch (e) {
      console.error('[Contato OCR] erro:', e);
      _setStatusContatoImport('Não foi possível identificar dados com segurança. Tente uma imagem mais nítida ou cadastre manualmente.', 'erro');
      _renderTextoContatoOcr();
    }
  };

  function _normalizarTextoContatoPDF(txt) {
    return String(txt || '')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function _normalizarTextoContatoOCR(txt) {
    return _normalizarTextoContatoPDF(txt)
      .replace(/[|]/g, ' ')
      .replace(/\bE\s*-\s*mail\b/gi, 'Email')
      .replace(/\bWhats\s*App\b/gi, 'WhatsApp')
      .replace(/(\+?\d{2})\s*\(?(\d{2})\)?\s*(\d{4,5})\s*[-.\s]?\s*(\d{4})/g, '$1 ($2) $3-$4');
  }

  function _semAcentoContato(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function _linhasContato(txt) {
    return String(txt || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
  }

  function _extrairEmailsContato(texto) {
    var m = String(texto || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig);
    return m ? m.filter(function (x, i, arr) { return arr.indexOf(x) === i; }) : [];
  }

  function _extrairTelefonesContato(texto) {
    var matches = String(texto || '').match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-.\s]?\d{4}/g) || [];
    var vistos = {};
    return matches.map(function (t) { return t.trim(); }).filter(function (t) {
      var n = _normTel(t);
      if (n.length < 8 || vistos[n]) return false;
      vistos[n] = true;
      return true;
    });
  }

  function _inferirTipoContato(texto) {
    var t = _semAcentoContato(texto);
    if (/compras|comprador|suprimentos/.test(t)) return 'Compras';
    if (/engenharia|engenheiro|projetos/.test(t)) return 'Engenharia';
    if (/manutencao|manutenção/.test(t)) return 'Manutenção';
    if (/financeiro|contas a pagar|contas a receber/.test(t)) return 'Financeiro';
    if (/seguranca|segurança|sesmt|hse|sst/.test(t)) return 'Segurança';
    if (/diretor|diretoria|presidente|ceo|socio|sócio/.test(t)) return 'Diretoria';
    return texto ? 'Outro' : '';
  }

  function _linhaEmpresaProvavel(lines) {
    var re = /(ltda|s\/a|s\.a\.|industria|indústria|tecnologia|engenharia|comercial|serviços|servicos|me\b|epp\b)/i;
    for (var i = 0; i < lines.length; i++) {
      if (re.test(lines[i]) && !/@/.test(lines[i])) return lines[i];
    }
    return '';
  }

  function _linhaCargoProvavel(lines) {
    var re = /(engenheir|comprador|coordenador|supervisor|gerente|diretor|analista|t[eé]cnico|manuten[cç][aã]o|projetos|financeiro|compras|seguran[cç]a)/i;
    for (var i = 0; i < lines.length; i++) {
      if (re.test(lines[i]) && !/@/.test(lines[i])) return lines[i];
    }
    return '';
  }

  function _linhaNomeProvavel(lines, email, cargo, empresa) {
    function ruim(l) {
      var s = _semAcentoContato(l);
      return !l || l.length < 4 || /@|www\.|http|telefone|whatsapp|celular|email|e-mail/.test(s)
        || _normTel(l).length >= 8 || l === cargo || l === empresa
        || /(ltda|s\/a|industria|industria|tecnologia|engenharia|comercial|servicos|serviços)/i.test(l);
    }
    var emailIndex = -1;
    if (email) {
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().indexOf(email.toLowerCase()) >= 0) { emailIndex = i; break; }
      }
    }
    var inicio = emailIndex > 0 ? Math.max(0, emailIndex - 4) : 0;
    var fim = emailIndex > 0 ? emailIndex : Math.min(lines.length, 8);
    for (var j = inicio; j < fim; j++) {
      if (!ruim(lines[j]) && lines[j].split(/\s+/).length >= 2 && lines[j].split(/\s+/).length <= 6) return lines[j];
    }
    for (var k = 0; k < Math.min(lines.length, 10); k++) {
      if (!ruim(lines[k]) && lines[k].split(/\s+/).length >= 2 && lines[k].split(/\s+/).length <= 6) return lines[k];
    }
    return '';
  }

  function _extrairCamposContato(texto) {
    var lines = _linhasContato(texto);
    var emails = _extrairEmailsContato(texto);
    var tels = _extrairTelefonesContato(texto);
    var cargo = _linhaCargoProvavel(lines);
    var empresa = _linhaEmpresaProvavel(lines);
    var nome = _linhaNomeProvavel(lines, emails[0] || '', cargo, empresa);
    var tipo = _inferirTipoContato([cargo, empresa, texto].join(' '));
    var departamento = '';
    if (tipo && tipo !== 'Outro') departamento = tipo;

    return {
      nome: nome,
      cargo: cargo,
      departamento: departamento,
      empresa: empresa,
      email: emails[0] || '',
      telefone: tels[0] || '',
      whatsapp: tels[1] || tels[0] || '',
      tipoContato: tipo,
      obs: _obsContatoExtraida(texto, emails.slice(1), tels.slice(2))
    };
  }

  function _obsContatoExtraida(texto, emailsExtras, telefonesExtras) {
    var rows = [];
    rows.push('Dados extraídos de arquivo do contato (' + (_contatoOcr.arquivo || 'arquivo') + ').');
    if (emailsExtras && emailsExtras.length) rows.push('E-mails adicionais: ' + emailsExtras.join(', '));
    if (telefonesExtras && telefonesExtras.length) rows.push('Telefones adicionais: ' + telefonesExtras.join(', '));
    if (String(texto || '').length < 120) rows.push('Texto extraído: ' + texto);
    return rows.join('\n');
  }

  function _localizarEmpresaContatoProvavel(dados) {
    var alvo = _semAcentoContato(dados && dados.empresa);
    if (!alvo) return null;
    var alvoLimpo = alvo.replace(/\b(ltda|s\/a|s\.a\.|me|epp)\b/g, '').replace(/\s+/g, ' ').trim();
    var empresas = _cliLoad();
    var melhor = null;
    empresas.some(function (e) {
      var vals = [e.nome, e.apelido, e.razaoSocial, e.razao_social, e.fantasia].filter(Boolean);
      return vals.some(function (v) {
        var n = _semAcentoContato(v);
        var nLimpo = n.replace(/\b(ltda|s\/a|s\.a\.|me|epp)\b/g, '').replace(/\s+/g, ' ').trim();
        if ((alvoLimpo && nLimpo && (alvoLimpo.indexOf(nLimpo) >= 0 || nLimpo.indexOf(alvoLimpo) >= 0))
          || (alvo && n && (alvo.indexOf(n) >= 0 || n.indexOf(alvo) >= 0))) {
          melhor = e;
          return true;
        }
        return false;
      });
    });
    return melhor;
  }

  function _finalizarTextoContatoImportado(texto) {
    texto = _normalizarTextoContatoOCR(texto || '');
    _contatoOcr.texto = texto;
    var dados = _extrairCamposContato(texto);
    _contatoOcr.dados = dados;
    _contatoOcr.empresaProvavel = _localizarEmpresaContatoProvavel(dados);
    _renderConferenciaContatoOcr(dados);
    if (!dados.nome && !dados.email && !dados.telefone) {
      _setStatusContatoImport('Não foi possível identificar dados com segurança. Tente uma imagem mais nítida ou cadastre manualmente.', 'erro');
    }
  }

  function _abrirConferenciaContatoOcr() {
    var m = document.getElementById('m-contato-ocr');
    if (m) m.style.display = 'flex';
  }

  window._eeFecharConferenciaContatoOcr = function () {
    var m = document.getElementById('m-contato-ocr');
    if (m) m.style.display = 'none';
  };

  window._eeToggleTextoContatoOcr = function () {
    var el = document.getElementById('contatoOcrTexto');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };

  function _renderTextoContatoOcr() {
    var el = document.getElementById('contatoOcrTexto');
    if (el) el.textContent = _contatoOcr.texto || 'Nenhum texto extraído.';
  }

  function _renderConferenciaContatoOcr(dados) {
    var encontrados = 0;
    Object.keys(dados || {}).forEach(function (k) {
      var el = document.querySelector('#m-contato-ocr [data-contato-ocr-field="' + k + '"]');
      var miss = document.querySelector('#m-contato-ocr [data-contato-ocr-missing="' + k + '"]');
      if (el) el.value = dados[k] || '';
      if (miss) miss.style.display = dados[k] ? 'none' : '';
      if (dados[k]) encontrados++;
    });
    _renderTextoContatoOcr();
    _renderDuplicidadeContatoOcr(dados);
    _renderEmpresaContatoOcr(dados);
    _setStatusContatoImport(encontrados >= 4
      ? 'Dados encontrados para conferência.'
      : 'Não foi possível identificar todos os campos. Revise e complete manualmente.', encontrados >= 4 ? 'ok' : 'aviso');
  }

  function _renderDuplicidadeContatoOcr(dados) {
    var box = document.getElementById('contatoOcrDuplicado');
    if (!box) return;
    var email = String(dados && dados.email || '').trim().toLowerCase();
    var tel = _normTel((dados && dados.telefone) || (dados && dados.whatsapp) || '');
    var dup = _ctsLoad().find(function (c) {
      if (_cst.contatoId && c.id === _cst.contatoId) return false;
      if (email && c.email && c.email.trim().toLowerCase() === email) return true;
      if (tel && tel.length >= 8 && (_normTel(c.telefone) === tel || _normTel(c.whatsapp) === tel)) return true;
      return false;
    });
    if (!dup) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = 'Atenção: possível contato duplicado encontrado: <strong>'
      + esc(dup.nome || 'contato sem nome') + '</strong>. Aplicar os dados não salva nem sobrescreve automaticamente.';
  }

  function _renderEmpresaContatoOcr(dados) {
    var box = document.getElementById('contatoOcrEmpresaAviso');
    if (!box) return;
    var emp = _localizarEmpresaContatoProvavel(dados) || _contatoOcr.empresaProvavel;
    if (emp) {
      box.style.display = '';
      box.innerHTML = 'Empresa provável encontrada: <strong>' + esc(emp.apelido || emp.nome || 'empresa sem nome')
        + '</strong>. Ela será sugerida no vínculo simples atual ao aplicar os dados.';
      return;
    }
    if (dados && dados.empresa) {
      box.style.display = '';
      box.textContent = 'Empresa não encontrada na base atual. O texto será preenchido no campo legado e você pode vincular manualmente.';
      return;
    }
    box.style.display = 'none';
  }

  function _getDadosConferenciaContatoOcr() {
    var dados = {};
    document.querySelectorAll('#m-contato-ocr [data-contato-ocr-field]').forEach(function (el) {
      dados[el.getAttribute('data-contato-ocr-field')] = el.value.trim();
    });
    return dados;
  }

  function _formTemDadosContato() {
    return ['eCtaNome','eCtaEmpresa','eCtaCargo','eCtaDept','eCtaEmail','eCtaTelefone','eCtaWhatsapp','eCtaLinkedin','eCtaOrigem','eCtaObs']
      .some(function (id) { var el = document.getElementById(id); return el && el.value.trim(); });
  }

  function _setValContato(id, val) {
    var el = document.getElementById(id);
    if (el && val) el.value = val;
  }

  window._eeAplicarContatoOcrAoFormulario = function () {
    var dadosEditados = _getDadosConferenciaContatoOcr();
    if (_formTemDadosContato()) {
      var ok = confirm('Já existem dados preenchidos na ficha. Aplicar os dados importados pode substituir campos visíveis preenchidos.\n\nDeseja continuar?');
      if (!ok) return;
    }
    _setValContato('eCtaNome', dadosEditados.nome);
    _setValContato('eCtaCargo', dadosEditados.cargo);
    _setValContato('eCtaDept', dadosEditados.departamento);
    _setValContato('eCtaEmail', dadosEditados.email);
    _setValContato('eCtaTelefone', dadosEditados.telefone);
    _setValContato('eCtaWhatsapp', dadosEditados.whatsapp);
    _setValContato('eCtaOrigem', dadosEditados.tipoContato);

    var emp = _localizarEmpresaContatoProvavel(dadosEditados) || null;
    _contatoOcr.empresaProvavel = emp;
    if (emp) {
      _eeCtaSelectEmpresa(emp.id, emp.apelido || emp.nome || dadosEditados.empresa, emp.nome || '', emp.cnpj || '', emp.cidade || '');
    } else if (dadosEditados.empresa) {
      _cst.empresaClienteId = null;
      _setValContato('eCtaEmpresa', dadosEditados.empresa);
      var info = document.getElementById('eCtaEmpresaInfo');
      if (info) info.style.display = 'none';
    }

    if (dadosEditados.obs) {
      var obsEl = document.getElementById('eCtaObs');
      if (obsEl) obsEl.value = (obsEl.value.trim() ? obsEl.value.trim() + '\n\n' : '') + dadosEditados.obs;
    }
    window._eeFecharConferenciaContatoOcr();
    _toast('Dados aplicados ao contato. Revise e clique em Salvar para gravar.', 'ok');
  };

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

    var m = document.getElementById('m-editar-contato');
    if (m) { m.style.display = 'flex'; m.scrollTop = 0; }
  };

  // ── Fechar modal ─────────────────────────────────────────────
  window._fecharModalContato2 = function () {
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

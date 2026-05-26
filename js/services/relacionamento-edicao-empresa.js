// ============================================================
// relacionamento-edicao-empresa.js — Modal completo de edição
// de Empresa com todos os campos + contatos relacionados
// + vinculação de contatos existentes
//
// Regras:
//  - Respeita empresa_id / DataGuard / sem apagar dados
//  - Usa cliSaveDirect / ctsSaveDirect (via cadastro.js)
//  - Usa cliRenomear / ctsAtualizarEmpresaRef / ctsRenomear
//  - Lookup de contatos por (1) empresa_cliente_id, (2) razão
//    social, (3) apelido — compatível com registros antigos
//  - Modal criado lazily — sem HTML hardcoded no index.html
//  - Sobrescreve window.editarCliente
// ============================================================

(function () {
  'use strict';

  // ── Acesso seguro a empresa ativa ───────────────────────────
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

  function _cliLoad() { return typeof window.cliGetAll === 'function' ? window.cliGetAll() : []; }
  function _ctsLoad() { return typeof window.ctsGetAll === 'function' ? window.ctsGetAll() : []; }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── Contatos relacionados à empresa ─────────────────────────
  // Prioridade: (1) empresa_cliente_id, (2) razão social, (3) apelido
  function _findContatos(empresa) {
    var nNorm = (empresa.nome    || '').toLowerCase().trim();
    var aNorm = (empresa.apelido || '').toLowerCase().trim();
    return _ctsLoad().filter(function (c) {
      if (c.empresa_cliente_id && c.empresa_cliente_id === empresa.id) return true;
      var eNorm = (c.empresa || '').toLowerCase().trim();
      if (!eNorm) return false;
      if (nNorm && eNorm === nNorm) return true;
      if (aNorm && eNorm === aNorm) return true;
      return false;
    });
  }

  // ── Estado interno do modal ─────────────────────────────────
  var _st = {
    empresaId: null,
    modo:      'editar',
    callback:  null,
    contatos:  [],
    ctsMod:    {},
    empresa:   null,  // empresa object completo (para vincular section)
    extraEmpresa: {}
  };

  var PDFJS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  var PDFJS_WORKER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var _pdfJsLoading = null;
  var _cnpjPdf = { texto: '', dados: null, arquivo: null };

  // ── Estilos reutilizáveis ───────────────────────────────────
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
    return (prefix || 'emp') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  function _toast(msg, tipo) {
    if (typeof window.toast === 'function') window.toast(msg, tipo || 'aviso');
    else alert(msg);
  }

  function _normCnpj(s) { return String(s || '').replace(/\D/g, ''); }

  function _setStatusPdf(msg, tipo) {
    var el = document.getElementById('cnpjPdfStatus');
    if (!el) return;
    var cor = tipo === 'erro' ? '#f87171' : (tipo === 'ok' ? '#22c55e' : '#f59e0b');
    el.innerHTML = '<span style="color:' + cor + ';font-weight:700">' + esc(msg) + '</span>';
  }

  function _setTituloModalEmpresa() {
    var t = document.getElementById('m-editar-empresa-titulo');
    var s = document.getElementById('m-editar-empresa-sub');
    if (t) t.textContent = _st.modo === 'novo' ? 'Nova Empresa' : 'Editar Empresa';
    if (s) s.textContent = _st.modo === 'novo'
      ? 'Cadastre uma conta/cliente com dados mínimos e revise depois se necessário.'
      : 'Ficha profissional da conta/cliente, preservando dados atuais e vínculos existentes.';
  }

  // ── Criar modal lazily ──────────────────────────────────────
  function _ensureModal() {
    if (document.getElementById('m-editar-empresa')) return;

    var html = '<div id="m-editar-empresa" style="display:none;position:fixed;inset:0;'
      + 'z-index:99990;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,.78);padding:1rem">'

      + '<div style="background:#1e2535;border:1px solid #334155;border-radius:10px;'
      + 'width:min(860px,98vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column">'

      // Header fixo
      + '<div style="display:flex;align-items:center;justify-content:space-between;'
      + 'padding:.9rem 1rem;border-bottom:1px solid #334155;'
      + 'position:sticky;top:0;background:#1e2535;z-index:2;border-radius:10px 10px 0 0">'
      + '<div><div id="m-editar-empresa-titulo" style="font-size:1rem;font-weight:800;color:#e2e8f0">Editar Empresa</div>'
      + '<div id="m-editar-empresa-sub" style="font-size:.72rem;color:#94a3b8;margin-top:.15rem"></div></div>'
      + '<button onclick="_fecharModalEmpresa()" style="background:none;border:none;'
      + 'color:#94a3b8;cursor:pointer;font-size:1rem;padding:.2rem .4rem">✕</button>'
      + '</div>'

      // Corpo
      + '<div style="padding:1rem;display:flex;flex-direction:column;gap:.9rem">'

      // ── Identificação
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Identificação</div>'
      + _grid('2fr 1fr',
          _fld('Razão Social *', 'eEmpNome', 'text', 'Ex: JDE Indústrias Ltda')
        + _fld('Apelido Empresa', 'eEmpApelido', 'text', 'Ex: JDE Jundiaí'))
      + _fld('Site', 'eEmpSite', 'text', 'https://www.empresa.com.br')
      + '</section>'

      // ── Comunicação
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Comunicação</div>'
      + _grid('1fr 1fr',
          _fld('Telefone', 'eEmpTelefone', 'text', '(11) 9999-0000')
        + _fld('E-mail', 'eEmpEmail', 'email', 'contato@empresa.com'))
      + '</section>'

      // ── Dados fiscais
      + '<section style="' + S_PANEL + '">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">'
      + '<div style="' + S_SEC + ';flex:1;margin:0">Dados fiscais / CNPJ</div>'
      + '<button type="button" onclick="_eeConferirDadosEmpresa()" style="' + S_BTN_MUTED + '">Conferir dados</button>'
      + '<button type="button" onclick="_eeSelecionarPdfCnpj()" title="Importa texto de PDF CNPJ para conferência antes de preencher a ficha" style="' + S_BTN_MUTED + '">Importar PDF CNPJ</button>'
      + '</div>'
      + _grid('1fr 1fr',
          _fld('CNPJ', 'eEmpCnpj', 'text', '00.000.000/0000-00')
      + '<div><label style="' + S_LBL + '">Status</label>'
      + '<select id="eEmpAtivo" style="' + S_INP + '">'
      + '<option value="true">Ativa</option>'
      + '<option value="false">Inativa</option>'
      + '</select></div>')
      + '</section>'

      // ── Endereço
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Endereço</div>'
      + _grid('3fr 1fr',
          _fld('Endereço', 'eEmpEndereco', 'text', 'Rua, Av...')
        + _fld('Número', 'eEmpNumero', 'text', '100'))
      + _grid('2fr 1fr',
          _fld('Bairro', 'eEmpBairro', 'text', 'Centro')
        + _fld('CEP', 'eEmpCep', 'text', '00000-000'))
      + _grid('2fr 1fr',
          _fld('Cidade', 'eEmpCidade', 'text', 'Ex: Jundiaí')
        + _fld('UF', 'eEmpEstado', 'text', 'SP'))
      + '</section>'

      // ── Contatos vinculados
      + '<section style="' + S_PANEL + '">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap">'
      + '<div style="' + S_SEC + ';flex:1;margin:0">Contatos vinculados</div>'
      + '<button type="button" onclick="_eeFocarVincularContato()" style="' + S_BTN_MUTED + '">Vincular contato</button>'
      + '</div>'
      + '<div id="m-editar-empresa-contatos" style="display:flex;flex-direction:column;gap:.75rem"></div>'

      // ── Vincular contatos existentes
      + '<div style="font-size:.73rem;color:#94a3b8">'
      + 'Compatibilidade atual: contatos podem ser relacionados por <code>empresa_cliente_id</code> ou pelo texto legado da empresa.</div>'
      + '<input id="eEmpVincularBusca" type="text" placeholder="Buscar contato..." '
      + 'oninput="_eeVincularFiltrar(this.value)" '
      + 'style="' + S_INP + ';margin-top:0">'
      + '<div id="m-editar-empresa-vincular" '
      + 'style="display:flex;flex-direction:column;gap:.35rem;margin-top:.5rem;'
      + 'max-height:200px;overflow-y:auto"></div>'
      + '</section>'

      // ── Observações
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Observações</div>'
      + '<textarea id="eEmpObs" rows="3" placeholder="Informações comerciais, histórico cadastral ou cuidados de atendimento..." '
      + 'style="' + S_INP + ';resize:vertical;min-height:4.2rem"></textarea>'
      + '</section>'

      // ── Ações / governança
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Ações / Governança</div>'
      + '<div style="font-size:.74rem;color:#94a3b8;line-height:1.45">'
      + 'Ações administrativas como replicação entre empresas e importação por PDF ficam separadas para evitar alterações acidentais. Nesta fase, a ficha apenas prepara a experiência visual.</div>'
      + '</section>'
      + '<input id="eEmpPdfCnpjFile" type="file" accept="application/pdf,.pdf" style="display:none" onchange="_eeProcessarPdfCnpj(this)">'

      + '</div>' // fim corpo

      // Footer fixo
      + '<div style="display:flex;gap:.5rem;justify-content:space-between;align-items:center;flex-wrap:wrap;'
      + 'padding:.75rem 1rem;border-top:1px solid #334155;'
      + 'position:sticky;bottom:0;background:#1e2535;border-radius:0 0 10px 10px">'
      + '<div style="font-size:.7rem;color:#64748b">Sem migration, sem alteração de banco.</div>'
      + '<div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end">'
      + '<button onclick="_fecharModalEmpresa()" style="' + S_BTN_MUTED + '">Cancelar</button>'
      + '<button onclick="salvarEdicaoEmpresa({novoDepois:true})" style="' + S_BTN_MUTED + '">Salvar e novo</button>'
      + '<button onclick="salvarEdicaoEmpresa()" style="' + S_BTN_PRIMARY + '">Salvar</button>'
      + '</div>'
      + '</div>'

      + '</div></div>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstElementChild);
    _ensurePdfModal();
  }

  window._eeConferirDadosEmpresa = function () {
    var nome = (document.getElementById('eEmpNome') || {}).value || '';
    var cnpj = (document.getElementById('eEmpCnpj') || {}).value || '';
    var apelido = (document.getElementById('eEmpApelido') || {}).value || '';
    var faltas = [];
    if (!nome.trim()) faltas.push('Razão Social');
    if (!apelido.trim()) faltas.push('Apelido Empresa');
    if (!cnpj.trim()) faltas.push('CNPJ');
    if (faltas.length) {
      alert('Conferência cadastral:\n\nCampos a revisar: ' + faltas.join(', ') + '.\n\nNada foi salvo automaticamente.');
      return;
    }
    alert('Conferência cadastral:\n\nDados principais preenchidos. Revise endereço, contatos e observações antes de salvar.\n\nNada foi salvo automaticamente.');
  };

  window._eeFocarVincularContato = function () {
    var inp = document.getElementById('eEmpVincularBusca');
    if (inp) inp.focus();
  };

  function _ensurePdfModal() {
    if (document.getElementById('m-cnpj-pdf')) return;
    var fields = [
      ['razaoSocial', 'Razão Social'],
      ['fantasia', 'Nome Fantasia'],
      ['apelido', 'Apelido Empresa'],
      ['cnpj', 'CNPJ'],
      ['situacao', 'Situação cadastral'],
      ['dataAbertura', 'Data de abertura'],
      ['cnaePrincipal', 'CNAE principal'],
      ['cnaesSecundarios', 'CNAEs secundários'],
      ['naturezaJuridica', 'Natureza jurídica'],
      ['logradouro', 'Logradouro'],
      ['numero', 'Número'],
      ['complemento', 'Complemento'],
      ['bairro', 'Bairro'],
      ['municipio', 'Município'],
      ['uf', 'UF'],
      ['cep', 'CEP'],
      ['email', 'E-mail'],
      ['telefone', 'Telefone'],
      ['qsa', 'Quadro societário'],
      ['atividadeEconomica', 'Atividade econômica']
    ];
    var inputs = fields.map(function (f) {
      var area = ['cnaesSecundarios', 'qsa', 'atividadeEconomica'].indexOf(f[0]) >= 0;
      return '<div data-cnpj-field-wrap="' + f[0] + '">'
        + '<label style="' + S_LBL + '">' + f[1] + '</label>'
        + (area
          ? '<textarea data-cnpj-field="' + f[0] + '" rows="2" style="' + S_INP + ';resize:vertical;min-height:3rem"></textarea>'
          : '<input data-cnpj-field="' + f[0] + '" type="text" style="' + S_INP + '">')
        + '<div data-cnpj-missing="' + f[0] + '" style="display:none;font-size:.68rem;color:#f59e0b;margin-top:.18rem">Campo não identificado no PDF.</div>'
        + '</div>';
    }).join('');

    var html = '<div id="m-cnpj-pdf" style="display:none;position:fixed;inset:0;z-index:100002;'
      + 'align-items:center;justify-content:center;background:rgba(0,0,0,.82);padding:1rem">'
      + '<div style="background:#1e2535;border:1px solid #334155;border-radius:10px;'
      + 'width:min(900px,98vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;'
      + 'padding:.9rem 1rem;border-bottom:1px solid #334155;position:sticky;top:0;background:#1e2535;z-index:2">'
      + '<div><div style="font-size:1rem;font-weight:800;color:#e2e8f0">Conferência de dados do CNPJ</div>'
      + '<div style="font-size:.72rem;color:#94a3b8;margin-top:.15rem">Dados extraídos automaticamente devem ser conferidos antes de salvar.</div></div>'
      + '<button onclick="_eeFecharConferenciaPdfCnpj()" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:1rem;padding:.2rem .4rem">✕</button>'
      + '</div>'
      + '<div style="padding:1rem;display:flex;flex-direction:column;gap:.85rem">'
      + '<div id="cnpjPdfStatus" style="font-size:.78rem;color:#94a3b8"></div>'
      + '<div id="cnpjPdfDuplicado" style="display:none;background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.35);'
      + 'border-radius:8px;padding:.7rem;color:#f59e0b;font-size:.76rem;line-height:1.45"></div>'
      + '<section style="' + S_PANEL + '">'
      + '<div style="' + S_SEC + '">Dados encontrados para conferência</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem">' + inputs + '</div>'
      + '</section>'
      + '<section style="' + S_PANEL + '">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap">'
      + '<div style="' + S_SEC + ';margin:0;flex:1">Texto extraído</div>'
      + '<button type="button" onclick="_eeToggleTextoPdfCnpj()" style="' + S_BTN_MUTED + '">Ver texto extraído</button>'
      + '</div>'
      + '<pre id="cnpjPdfTexto" style="display:none;white-space:pre-wrap;max-height:230px;overflow:auto;'
      + 'background:#0f172a;border:1px solid #334155;border-radius:7px;padding:.75rem;color:#cbd5e1;font-size:.72rem"></pre>'
      + '</section>'
      + '</div>'
      + '<div style="display:flex;justify-content:flex-end;gap:.5rem;flex-wrap:wrap;padding:.75rem 1rem;'
      + 'border-top:1px solid #334155;position:sticky;bottom:0;background:#1e2535">'
      + '<button onclick="_eeFecharConferenciaPdfCnpj()" style="' + S_BTN_MUTED + '">Cancelar importação</button>'
      + '<button onclick="_eeAplicarPdfCnpjAoCadastro()" style="' + S_BTN_PRIMARY + '">Aplicar dados ao cadastro</button>'
      + '</div>'
      + '</div></div>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstElementChild);
  }

  function _loadPdfJs() {
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

  window._eeSelecionarPdfCnpj = function () {
    _ensurePdfModal();
    var input = document.getElementById('eEmpPdfCnpjFile');
    if (!input) return;
    input.value = '';
    input.click();
  };

  window._eeProcessarPdfCnpj = async function (input) {
    var file = input && input.files && input.files[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name || '') && file.type !== 'application/pdf') {
      _toast('Selecione um arquivo PDF válido.', 'err');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      _toast('PDF muito grande. Limite sugerido nesta fase: 12 MB.', 'err');
      return;
    }
    try {
      _ensurePdfModal();
      _abrirConferenciaPdf();
      _setStatusPdf('Lendo PDF...', 'aviso');
      _cnpjPdf = { texto: '', dados: null, arquivo: file.name || '' };
      var pdfjs = await _loadPdfJs();
      _setStatusPdf('Extraindo texto...', 'aviso');
      var buffer = await file.arrayBuffer();
      var pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
      var partes = [];
      for (var p = 1; p <= pdf.numPages; p++) {
        var page = await pdf.getPage(p);
        var content = await page.getTextContent();
        var pageText = (content.items || []).map(function (it) { return it.str || ''; }).join('\n');
        partes.push(pageText);
      }
      var texto = _normalizarTextoPdf(partes.join('\n'));
      if (!texto || texto.replace(/\s+/g, '').length < 80) {
        _setStatusPdf('PDF sem texto selecionável. Parece ser imagem/escaneado; OCR ficará para fase futura.', 'erro');
        _cnpjPdf.texto = texto || '';
        _renderTextoPdf();
        return;
      }
      var dados = _extrairDadosCnpj(texto);
      _cnpjPdf.texto = texto;
      _cnpjPdf.dados = dados;
      _renderConferenciaPdf(dados);
    } catch (e) {
      console.error('[CNPJ PDF] erro:', e);
      _setStatusPdf('PDF ilegível ou falha ao carregar a biblioteca. Nenhum dado foi alterado.', 'erro');
    }
  };

  function _normalizarTextoPdf(txt) {
    return String(txt || '')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function _linhas(txt) {
    return String(txt || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
  }

  function _semAcento(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function _isLabelLine(line) {
    var l = _semAcento(line);
    return [
      'numero de inscricao', 'nome empresarial', 'titulo do estabelecimento',
      'codigo e descricao', 'logradouro', 'numero', 'complemento', 'cep',
      'bairro/distrito', 'municipio', 'uf', 'endereco eletronico', 'telefone',
      'situacao cadastral', 'data da situacao cadastral', 'data de abertura',
      'natureza juridica', 'porte', 'ente federativo'
    ].some(function (x) { return l.indexOf(x) >= 0; });
  }

  function _valorAposLabel(lines, labels) {
    labels = labels.map(_semAcento);
    for (var i = 0; i < lines.length; i++) {
      var l = _semAcento(lines[i]);
      var hit = labels.some(function (lab) { return l.indexOf(lab) >= 0; });
      if (!hit) continue;
      for (var j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        if (lines[j] && !_isLabelLine(lines[j])) return lines[j].trim();
      }
    }
    return '';
  }

  function _blocoAposLabel(lines, label, stopLabels) {
    var out = [];
    var started = false;
    var lab = _semAcento(label);
    var stops = (stopLabels || []).map(_semAcento);
    for (var i = 0; i < lines.length; i++) {
      var l = _semAcento(lines[i]);
      if (!started && l.indexOf(lab) >= 0) { started = true; continue; }
      if (!started) continue;
      if (stops.some(function (s) { return l.indexOf(s) >= 0; })) break;
      if (lines[i] && !_isLabelLine(lines[i])) out.push(lines[i]);
      if (out.length >= 8) break;
    }
    return out.join('\n').trim();
  }

  function _sugerirApelido(fantasia, razao) {
    var base = (fantasia || razao || '').replace(/\s+(LTDA|S\/A|SA|EIRELI|ME|EPP)$/i, '').trim();
    return base.split(/\s+/).slice(0, 3).join(' ');
  }

  function _extrairDadosCnpj(texto) {
    var lines = _linhas(texto);
    var cnpjMatch = texto.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
    var cepMatch = texto.match(/\d{5}-\d{3}/);
    var emailMatch = texto.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    var telMatch = texto.match(/\(?\d{2}\)?\s?\d{4,5}-?\d{4}/);
    var razao = _valorAposLabel(lines, ['NOME EMPRESARIAL']);
    var fantasia = _valorAposLabel(lines, ['TÍTULO DO ESTABELECIMENTO', 'NOME DE FANTASIA']);
    if (/^SEM\s+INFORMA/i.test(fantasia)) fantasia = '';
    var logradouro = _valorAposLabel(lines, ['LOGRADOURO']);
    var numero = _valorAposLabel(lines, ['NÚMERO']);
    var bairro = _valorAposLabel(lines, ['BAIRRO/DISTRITO']);
    var municipio = _valorAposLabel(lines, ['MUNICÍPIO']);
    var uf = _valorAposLabel(lines, ['UF']);

    return {
      razaoSocial: razao,
      fantasia: fantasia,
      apelido: _sugerirApelido(fantasia, razao),
      cnpj: cnpjMatch ? cnpjMatch[0] : '',
      situacao: _valorAposLabel(lines, ['SITUAÇÃO CADASTRAL']),
      dataAbertura: _valorAposLabel(lines, ['DATA DE ABERTURA']),
      cnaePrincipal: _blocoAposLabel(lines, 'ATIVIDADE ECONÔMICA PRINCIPAL', ['ATIVIDADES ECONÔMICAS SECUNDÁRIAS', 'NATUREZA JURÍDICA']),
      cnaesSecundarios: _blocoAposLabel(lines, 'ATIVIDADES ECONÔMICAS SECUNDÁRIAS', ['NATUREZA JURÍDICA', 'LOGRADOURO']),
      naturezaJuridica: _valorAposLabel(lines, ['NATUREZA JURÍDICA']),
      logradouro: logradouro,
      numero: numero,
      complemento: _valorAposLabel(lines, ['COMPLEMENTO']),
      bairro: bairro,
      municipio: municipio,
      uf: uf,
      cep: cepMatch ? cepMatch[0] : _valorAposLabel(lines, ['CEP']),
      email: emailMatch ? emailMatch[0] : _valorAposLabel(lines, ['ENDEREÇO ELETRÔNICO']),
      telefone: telMatch ? telMatch[0] : _valorAposLabel(lines, ['TELEFONE']),
      qsa: _blocoAposLabel(lines, 'QUADRO DE SÓCIOS', ['SITUAÇÃO CADASTRAL', 'DATA DA SITUAÇÃO']),
      atividadeEconomica: _blocoAposLabel(lines, 'ATIVIDADE ECONÔMICA PRINCIPAL', ['NATUREZA JURÍDICA'])
    };
  }

  function _abrirConferenciaPdf() {
    var m = document.getElementById('m-cnpj-pdf');
    if (m) m.style.display = 'flex';
  }

  window._eeFecharConferenciaPdfCnpj = function () {
    var m = document.getElementById('m-cnpj-pdf');
    if (m) m.style.display = 'none';
  };

  window._eeToggleTextoPdfCnpj = function () {
    var el = document.getElementById('cnpjPdfTexto');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };

  function _renderTextoPdf() {
    var el = document.getElementById('cnpjPdfTexto');
    if (el) el.textContent = _cnpjPdf.texto || 'Nenhum texto extraído.';
  }

  function _renderConferenciaPdf(dados) {
    var encontrados = 0;
    Object.keys(dados || {}).forEach(function (k) {
      var el = document.querySelector('[data-cnpj-field="' + k + '"]');
      var miss = document.querySelector('[data-cnpj-missing="' + k + '"]');
      if (el) el.value = dados[k] || '';
      if (miss) miss.style.display = dados[k] ? 'none' : '';
      if (dados[k]) encontrados++;
    });
    _renderTextoPdf();
    _setStatusPdf(encontrados >= 8
      ? 'Dados encontrados para conferência.'
      : 'Não foi possível identificar todos os campos. Revise e complete manualmente.', encontrados >= 8 ? 'ok' : 'aviso');
    _renderDuplicidadePdf(dados);
  }

  function _renderDuplicidadePdf(dados) {
    var box = document.getElementById('cnpjPdfDuplicado');
    if (!box) return;
    var cn = _normCnpj(dados && dados.cnpj);
    if (!cn) { box.style.display = 'none'; return; }
    var dup = _cliLoad().find(function (e) { return _normCnpj(e.cnpj || '') === cn && e.id !== _st.empresaId; });
    if (!dup) { box.style.display = 'none'; return; }
    box.style.display = '';
    box.innerHTML = 'Atenção: já existe uma empresa com este CNPJ na base atual: <strong>'
      + esc(dup.apelido || dup.nome || 'empresa sem nome') + '</strong>. Aplicar os dados não salva nem sobrescreve automaticamente.';
  }

  function _getDadosConferenciaPdf() {
    var dados = {};
    document.querySelectorAll('#m-cnpj-pdf [data-cnpj-field]').forEach(function (el) {
      dados[el.getAttribute('data-cnpj-field')] = el.value.trim();
    });
    return dados;
  }

  function _formTemDadosEmpresa() {
    return ['eEmpNome','eEmpApelido','eEmpCnpj','eEmpTelefone','eEmpEmail','eEmpEndereco','eEmpNumero','eEmpBairro','eEmpCep','eEmpCidade','eEmpEstado']
      .some(function (id) { var el = document.getElementById(id); return el && el.value.trim(); });
  }

  function _setVal(id, val) {
    var el = document.getElementById(id);
    if (el && val) el.value = val;
  }

  function _obsFiscal(d) {
    var rows = [];
    if (d.fantasia) rows.push('Nome fantasia: ' + d.fantasia);
    if (d.situacao) rows.push('Situação cadastral: ' + d.situacao);
    if (d.dataAbertura) rows.push('Data de abertura: ' + d.dataAbertura);
    if (d.cnaePrincipal) rows.push('CNAE principal: ' + d.cnaePrincipal);
    if (d.cnaesSecundarios) rows.push('CNAEs secundários: ' + d.cnaesSecundarios);
    if (d.naturezaJuridica) rows.push('Natureza jurídica: ' + d.naturezaJuridica);
    if (d.complemento) rows.push('Complemento: ' + d.complemento);
    if (d.qsa) rows.push('Quadro societário: ' + d.qsa);
    if (d.atividadeEconomica && d.atividadeEconomica !== d.cnaePrincipal) rows.push('Atividade econômica: ' + d.atividadeEconomica);
    return rows.length ? 'Dados extraídos de PDF CNPJ (' + (_cnpjPdf.arquivo || 'arquivo') + '):\n' + rows.join('\n') : '';
  }

  window._eeAplicarPdfCnpjAoCadastro = function () {
    var d = _getDadosConferenciaPdf();
    if (_formTemDadosEmpresa()) {
      var ok = confirm('Já existem dados preenchidos na ficha. Aplicar os dados do PDF pode substituir campos visíveis preenchidos.\n\nDeseja continuar?');
      if (!ok) return;
    }
    _setVal('eEmpNome', d.razaoSocial);
    _setVal('eEmpApelido', d.apelido || d.fantasia || d.razaoSocial);
    _setVal('eEmpCnpj', d.cnpj);
    _setVal('eEmpTelefone', d.telefone);
    _setVal('eEmpEmail', d.email);
    _setVal('eEmpEndereco', d.logradouro);
    _setVal('eEmpNumero', d.numero);
    _setVal('eEmpBairro', d.bairro);
    _setVal('eEmpCep', d.cep);
    _setVal('eEmpCidade', d.municipio);
    _setVal('eEmpEstado', d.uf);
    _st.extraEmpresa = Object.assign({}, _st.extraEmpresa || {}, {
      razaoSocial: d.razaoSocial || '',
      fantasia: d.fantasia || ''
    });

    var obsExtra = _obsFiscal(d);
    if (obsExtra) {
      var obsEl = document.getElementById('eEmpObs');
      if (obsEl) obsEl.value = (obsEl.value.trim() ? obsEl.value.trim() + '\n\n' : '') + obsExtra;
    }
    window._eeFecharConferenciaPdfCnpj();
    _toast('Dados aplicados ao cadastro. Revise e clique em Salvar para gravar.', 'ok');
  };

  // ── Abrir modal ─────────────────────────────────────────────
  window.abrirModalEditarEmpresa = function (id) {
    _ensureModal();
    var all  = _cliLoad();
    var item = all.find(function (x) { return x.id === id; });
    if (!item) { console.error('[EdicaoEmpresa] empresa não encontrada:', id); return; }

    _st.empresaId = id;
    _st.modo      = 'editar';
    _st.callback  = null;
    _st.contatos  = _findContatos(item);
    _st.ctsMod    = {};
    _st.empresa   = item;
    _st.extraEmpresa = {
      razaoSocial: item.razaoSocial || item.razao_social || '',
      fantasia: item.fantasia || ''
    };
    _setTituloModalEmpresa();

    function sv(elId, val) {
      var el = document.getElementById(elId);
      if (el) el.value = (val !== undefined && val !== null) ? String(val) : '';
    }

    sv('eEmpNome',     item.nome     || '');
    sv('eEmpApelido',  item.apelido  || '');
    sv('eEmpCnpj',     item.cnpj     || '');
    sv('eEmpTelefone', item.telefone || '');
    sv('eEmpEmail',    item.email    || '');
    sv('eEmpSite',     item.site     || '');
    sv('eEmpEndereco', item.endereco || '');
    sv('eEmpNumero',   item.numero   || '');
    sv('eEmpBairro',   item.bairro   || '');
    sv('eEmpCep',      item.cep      || '');
    sv('eEmpCidade',   item.cidade   || '');
    sv('eEmpEstado',   item.estado   || '');

    var ativoEl = document.getElementById('eEmpAtivo');
    if (ativoEl) ativoEl.value = (item.ativo === false) ? 'false' : 'true';

    var obsEl = document.getElementById('eEmpObs');
    if (obsEl) obsEl.value = item.obs || '';

    _renderContatos();
    _renderVincularDisponiveis('');

    var bEl = document.getElementById('eEmpVincularBusca');
    if (bEl) bEl.value = '';

    var m = document.getElementById('m-editar-empresa');
    if (m) { m.style.display = 'flex'; m.scrollTop = 0; }
  };

  window.abrirModalNovaEmpresaProfissional = function (nome, callback) {
    _ensureModal();
    _st.empresaId = null;
    _st.modo      = 'novo';
    _st.callback  = callback || null;
    _st.contatos  = [];
    _st.ctsMod    = {};
    _st.empresa   = null;
    _st.extraEmpresa = {};
    _setTituloModalEmpresa();

    [
      'eEmpNome','eEmpApelido','eEmpCnpj','eEmpTelefone','eEmpEmail','eEmpSite',
      'eEmpEndereco','eEmpNumero','eEmpBairro','eEmpCep','eEmpCidade','eEmpEstado'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var nomeEl = document.getElementById('eEmpNome');
    if (nomeEl) nomeEl.value = nome || '';
    var ativoEl = document.getElementById('eEmpAtivo');
    if (ativoEl) ativoEl.value = 'true';
    var obsEl = document.getElementById('eEmpObs');
    if (obsEl) obsEl.value = '';
    var busca = document.getElementById('eEmpVincularBusca');
    if (busca) busca.value = '';
    _renderContatos();
    _renderVincularDisponiveis('');

    var m = document.getElementById('m-editar-empresa');
    if (m) { m.style.display = 'flex'; m.scrollTop = 0; }
  };

  // ── Render: contatos vinculados (editáveis inline) ──────────
  function _renderContatos() {
    var el = document.getElementById('m-editar-empresa-contatos');
    if (!el) return;
    var cts = _st.contatos;

    if (!cts.length) {
      el.innerHTML = '<div style="font-size:.78rem;color:#94a3b8;text-align:center;'
        + 'padding:.8rem;border:1px dashed #334155;border-radius:7px;background:#0f172a">'
        + 'Nenhum contato vinculado nesta ficha. Cadastre ou selecione contatos sem apagar registros existentes.</div>';
      return;
    }

    var INP = 'width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;'
      + 'border-radius:4px;padding:.3rem .5rem;font-size:.78rem;box-sizing:border-box';
    var LBL = 'font-size:.6rem;font-weight:600;color:#94a3b8;'
      + 'text-transform:uppercase;letter-spacing:.05em';

    el.innerHTML = cts.map(function (c) {
      var vinculadoBadge = c.empresa_cliente_id
        ? '<span style="font-size:.65rem;color:#22c55e;margin-left:.4rem">🔗</span>'
        : '';
      return '<div style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:.75rem">'
        + '<div style="font-size:.8rem;font-weight:700;color:#e2e8f0;margin-bottom:.6rem">'
        + '👤 ' + esc(c.nome) + vinculadoBadge + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">'

        + '<div><label style="' + LBL + '">Nome</label>'
        + '<input data-cid="' + esc(c.id) + '" data-campo="nome" type="text" '
        + 'value="' + esc(c.nome) + '" style="' + INP + '" oninput="window._eeCtsMark(this)"></div>'

        + '<div><label style="' + LBL + '">Cargo / Função</label>'
        + '<input data-cid="' + esc(c.id) + '" data-campo="departamento" type="text" '
        + 'value="' + esc(c.departamento || '') + '" style="' + INP + '" oninput="window._eeCtsMark(this)"></div>'

        + '<div><label style="' + LBL + '">E-mail</label>'
        + '<input data-cid="' + esc(c.id) + '" data-campo="email" type="email" '
        + 'value="' + esc(c.email || '') + '" style="' + INP + '" oninput="window._eeCtsMark(this)"></div>'

        + '<div><label style="' + LBL + '">Telefone</label>'
        + '<input data-cid="' + esc(c.id) + '" data-campo="telefone" type="text" '
        + 'value="' + esc(c.telefone || '') + '" style="' + INP + '" oninput="window._eeCtsMark(this)"></div>'

        + '</div></div>';
    }).join('');
  }

  // ── Render: contatos disponíveis para vincular ──────────────
  function _renderVincularDisponiveis(q) {
    var el = document.getElementById('m-editar-empresa-vincular');
    if (!el) return;
    if (!_st.empresa) {
      el.innerHTML = '<div style="font-size:.75rem;color:#94a3b8;padding:.55rem;border:1px dashed #334155;border-radius:7px">'
        + 'Salve a empresa para habilitar vínculos usando a estrutura atual.</div>';
      return;
    }

    // Hash de IDs já vinculados
    var vinculadosHash = {};
    _st.contatos.forEach(function (c) { vinculadosHash[c.id] = true; });

    var todos      = _ctsLoad();
    var disponiveis = todos.filter(function (c) { return !vinculadosHash[c.id]; });

    if (q) {
      var ql = q.toLowerCase();
      disponiveis = disponiveis.filter(function (c) {
        return (c.nome    || '').toLowerCase().indexOf(ql) >= 0
            || (c.empresa || '').toLowerCase().indexOf(ql) >= 0;
      });
    }

    if (!disponiveis.length) {
      el.innerHTML = '<div style="font-size:.76rem;color:#94a3b8;text-align:center;padding:.5rem 0">'
        + (q ? 'Nenhum contato encontrado.' : 'Todos os contatos já estão vinculados a uma empresa.') + '</div>';
      return;
    }

    el.innerHTML = disponiveis.map(function (c) {
      var sub = c.empresa
        ? '<span style="color:#94a3b8;font-size:.72rem"> (' + esc(c.empresa) + ')</span>'
        : '<span style="color:#64748b;font-size:.72rem"> (sem empresa)</span>';
      return '<label style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;'
        + 'color:#e2e8f0;cursor:pointer;padding:.2rem 0">'
        + '<input type="checkbox" data-cid="' + esc(c.id) + '" style="cursor:pointer;flex-shrink:0">'
        + '<span><strong>' + esc(c.nome) + '</strong>' + sub + '</span>'
        + '</label>';
    }).join('');
  }

  // ── Handlers públicos ───────────────────────────────────────

  window._eeCtsMark = function (input) {
    var cid   = input.getAttribute('data-cid');
    var campo = input.getAttribute('data-campo');
    if (!cid || !campo) return;
    if (!_st.ctsMod[cid]) _st.ctsMod[cid] = {};
    _st.ctsMod[cid][campo] = input.value;
  };

  window._eeVincularFiltrar = function (q) {
    _renderVincularDisponiveis(q);
  };

  // ── Fechar modal ────────────────────────────────────────────
  window._fecharModalEmpresa = function () {
    var m = document.getElementById('m-editar-empresa');
    if (m) m.style.display = 'none';
    _st.empresaId = null;
    _st.modo      = 'editar';
    _st.callback  = null;
    _st.contatos  = [];
    _st.ctsMod    = {};
    _st.empresa   = null;
    _st.extraEmpresa = {};
  };

  // ── Salvar empresa + contatos + vincular ────────────────────
  window.salvarEdicaoEmpresa = function (opcoes) {
    opcoes = opcoes || {};
    var gv = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    var nome = gv('eEmpNome');
    if (!nome) { alert('Razão Social é obrigatória.'); return; }
    if (!_eid()) { alert('Empresa ativa não identificada.'); return; }

    // 1. Criar ou atualizar empresa
    var all = _cliLoad();
    var idx = -1;
    if (_st.empresaId) {
      for (var i = 0; i < all.length; i++) { if (all[i].id === _st.empresaId) { idx = i; break; } }
      if (idx < 0) { alert('Empresa não encontrada. Feche e reabra.'); return; }
    }

    var old     = idx >= 0 ? all[idx] : {};
    var oldNome = old.nome || '';

    var updated = Object.assign({}, old, {
      id:       old.id || _id('cad'),
      nome:     nome,
      apelido:  gv('eEmpApelido'),
      cnpj:     gv('eEmpCnpj'),
      telefone: gv('eEmpTelefone'),
      email:    gv('eEmpEmail'),
      site:     gv('eEmpSite'),
      razaoSocial: (_st.extraEmpresa && _st.extraEmpresa.razaoSocial) || old.razaoSocial || old.razao_social || '',
      fantasia: (_st.extraEmpresa && _st.extraEmpresa.fantasia) || old.fantasia || '',
      endereco: gv('eEmpEndereco'),
      numero:   gv('eEmpNumero'),
      bairro:   gv('eEmpBairro'),
      cep:      gv('eEmpCep'),
      cidade:   gv('eEmpCidade'),
      estado:   gv('eEmpEstado'),
      ativo:    document.getElementById('eEmpAtivo')
                  ? document.getElementById('eEmpAtivo').value !== 'false'
                  : (old.ativo !== false),
      obs:      (document.getElementById('eEmpObs') || { value: '' }).value.trim()
    });

    var newList = idx >= 0
      ? all.map(function (x, j) { return j === idx ? updated : x; })
      : [updated].concat(all);
    if (typeof window.cliSaveDirect === 'function') {
      window.cliSaveDirect(newList);
    } else {
      console.error('[EdicaoEmpresa] cliSaveDirect não disponível');
      return;
    }

    // 2. Propagar mudança de razão social
    if (idx >= 0 && oldNome && oldNome !== nome) {
      if (typeof window.cliRenomear          === 'function') window.cliRenomear(oldNome, nome);
      if (typeof window.ctsAtualizarEmpresaRef === 'function') window.ctsAtualizarEmpresaRef(oldNome, nome);
    }

    // 3. Coletar alterações de contatos (ctsMod) + vínculos novos — passe único
    var mods = _st.ctsMod;
    var modsIds = Object.keys(mods);

    // Coletar checkboxes de vincular selecionados
    var vincularEl = document.getElementById('m-editar-empresa-vincular');
    var vincularIds = [];
    if (vincularEl) {
      var checks = vincularEl.querySelectorAll('input[type="checkbox"][data-cid]:checked');
      for (var ci = 0; ci < checks.length; ci++) {
        vincularIds.push(checks[ci].getAttribute('data-cid'));
      }
    }

    if (modsIds.length > 0 || vincularIds.length > 0) {
      var allCts     = _ctsLoad();
      var empNome    = updated.apelido || updated.nome;
      var empId      = updated.id;
      var ctsChanged = false;

      allCts = allCts.map(function (c) {
        var isMod      = mods[c.id]                    !== undefined;
        var isVincular = vincularIds.indexOf(c.id) >= 0;
        if (!isMod && !isVincular) return c;

        ctsChanged = true;
        var merged = Object.assign({}, c);

        if (isMod) {
          var delta = mods[c.id];
          Object.keys(delta).forEach(function (k) { merged[k] = delta[k]; });
          // Propagar renomeação de contato
          if (delta.nome && delta.nome !== c.nome) {
            if (typeof window.ctsRenomear === 'function') window.ctsRenomear(c.nome, delta.nome);
          }
        }

        if (isVincular) {
          merged.empresa            = empNome;
          merged.empresa_cliente_id = empId;
        }

        return merged;
      });

      if (ctsChanged && typeof window.ctsSaveDirect === 'function') {
        window.ctsSaveDirect(allCts);
      }
    }

    var cb = _st.callback;
    window._fecharModalEmpresa();
    if (typeof window.renderTabelaClientes === 'function') window.renderTabelaClientes();
    if (typeof window.renderTabelaContatos === 'function') window.renderTabelaContatos();
    if (typeof cb === 'function') cb(updated);
    if (typeof toast === 'function') toast((idx >= 0 ? '✅ Empresa atualizada: ' : '✅ Empresa cadastrada: ') + nome, 'ok');
    if (opcoes.novoDepois) window.abrirModalNovaEmpresaProfissional('', cb || null);
  };

  // ── Override: editarCliente abre o modal completo ───────────
  window.editarCliente = function (id) {
    window.abrirModalEditarEmpresa(id);
  };

  window.abrirModalNovoCliente = function (nome, callback) {
    window.abrirModalNovaEmpresaProfissional(nome || '', callback || null);
  };

})();

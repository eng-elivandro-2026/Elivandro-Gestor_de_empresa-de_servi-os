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

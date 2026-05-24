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
    empresaClienteId: null   // id da empresa selecionada no dropdown
  };

  // ── Estilos ─────────────────────────────────────────────────
  var S_INP = 'width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;'
    + 'border-radius:4px;padding:.38rem .55rem;font-size:.82rem;margin-top:.2rem;'
    + 'box-sizing:border-box';
  var S_LBL = 'font-size:.62rem;font-weight:600;color:#94a3b8;'
    + 'text-transform:uppercase;letter-spacing:.06em';
  var S_SEC = 'font-size:.72rem;font-weight:700;color:#38bdf8;'
    + 'text-transform:uppercase;letter-spacing:.06em;'
    + 'padding-bottom:.3rem;border-bottom:1px solid #334155;margin-top:.25rem';

  function _fld(lbl, id, type, ph) {
    return '<div><label style="' + S_LBL + '">' + lbl + '</label>'
      + '<input id="' + id + '" type="' + (type || 'text') + '" placeholder="'
      + ph + '" autocomplete="off" style="' + S_INP + '"></div>';
  }

  // ── Criar modal lazily ───────────────────────────────────────
  function _ensureModal() {
    if (document.getElementById('m-editar-contato')) return;

    var html = '<div id="m-editar-contato" style="display:none;position:fixed;inset:0;'
      + 'z-index:99991;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,.8);padding:1rem">'

      + '<div style="background:#1e2535;border:1px solid #334155;border-radius:10px;'
      + 'width:min(640px,98vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column">'

      // Header
      + '<div style="display:flex;align-items:center;justify-content:space-between;'
      + 'padding:.85rem 1rem;border-bottom:1px solid #334155;'
      + 'position:sticky;top:0;background:#1e2535;z-index:2;border-radius:10px 10px 0 0">'
      + '<div style="font-size:.88rem;font-weight:700;color:#e2e8f0">✏️ Editar Contato</div>'
      + '<button onclick="_fecharModalContato2()" style="background:none;border:none;'
      + 'color:#94a3b8;cursor:pointer;font-size:1rem;padding:.2rem .4rem">✕</button>'
      + '</div>'

      // Corpo
      + '<div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem">'

      // Seção: dados do contato
      + '<div style="' + S_SEC + '">👤 Dados do Contato</div>'

      // Nome + Status
      + '<div style="display:grid;grid-template-columns:3fr 1fr;gap:.6rem">'
      + _fld('Nome *', 'eCtaNome', 'text', 'Ex: Rafael Soares')
      + '<div><label style="' + S_LBL + '">Status</label>'
      + '<select id="eCtaAtivo" style="' + S_INP + '">'
      + '<option value="true">Ativo</option>'
      + '<option value="false">Inativo</option>'
      + '</select></div>'
      + '</div>'

      // Empresa vinculada (campo especial com dropdown)
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

      // Cargo + Departamento
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">'
      + _fld('Cargo', 'eCtaCargo', 'text', 'Ex: Diretor de Compras')
      + _fld('Departamento', 'eCtaDept', 'text', 'Ex: Engenharia')
      + '</div>'

      // E-mail + Telefone
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">'
      + _fld('E-mail', 'eCtaEmail', 'email', 'email@empresa.com')
      + _fld('Telefone', 'eCtaTelefone', 'text', '(11) 9999-0000')
      + '</div>'

      // WhatsApp + LinkedIn
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">'
      + _fld('WhatsApp', 'eCtaWhatsapp', 'text', '(11) 9999-0000')
      + _fld('LinkedIn', 'eCtaLinkedin', 'text', 'linkedin.com/in/...')
      + '</div>'

      // Seção: relacionamento
      + '<div style="' + S_SEC + '">📋 Relacionamento</div>'

      // Origem + Preferência de contato
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">'
      + _fld('Origem do Contato', 'eCtaOrigem', 'text', 'Ex: Indicação, LinkedIn')
      + '<div><label style="' + S_LBL + '">Preferência de Contato</label>'
      + '<select id="eCtaPreferencia" style="' + S_INP + '">'
      + '<option value="">Não definido</option>'
      + '<option value="email">E-mail</option>'
      + '<option value="telefone">Telefone</option>'
      + '<option value="whatsapp">WhatsApp</option>'
      + '<option value="linkedin">LinkedIn</option>'
      + '</select></div>'
      + '</div>'

      // Último contato (data)
      + _fld('Data do Último Contato', 'eCtaUltimoContato', 'date', '')

      // Observações
      + '<div><label style="' + S_LBL + '">Observações</label>'
      + '<textarea id="eCtaObs" rows="2" placeholder="Informações adicionais..." '
      + 'style="' + S_INP + ';resize:vertical;min-height:3rem"></textarea></div>'

      + '</div>' // fim corpo

      // Footer
      + '<div style="display:flex;gap:.5rem;justify-content:flex-end;'
      + 'padding:.75rem 1rem;border-top:1px solid #334155;'
      + 'position:sticky;bottom:0;background:#1e2535;border-radius:0 0 10px 10px">'
      + '<button onclick="_fecharModalContato2()" style="padding:.38rem 1rem;'
      + 'background:#1e2535;border:1px solid #334155;color:#94a3b8;border-radius:6px;'
      + 'cursor:pointer;font-size:.82rem">Cancelar</button>'
      + '<button onclick="salvarEdicaoContato()" style="padding:.38rem 1rem;'
      + 'background:#f05a1a;border:none;color:#000;border-radius:6px;'
      + 'cursor:pointer;font-size:.82rem;font-weight:700">💾 Salvar</button>'
      + '</div>'

      + '</div></div>';

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstElementChild);
  }

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
    _cst.empresaClienteId = item.empresa_cliente_id || null;

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

  // ── Fechar modal ─────────────────────────────────────────────
  window._fecharModalContato2 = function () {
    var m = document.getElementById('m-editar-contato');
    if (m) m.style.display = 'none';
    _cst.contatoId        = null;
    _cst.empresaClienteId = null;
  };

  // ── Salvar contato ───────────────────────────────────────────
  window.salvarEdicaoContato = function () {
    var gv = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    var nome = gv('eCtaNome');
    if (!nome) { alert('Nome é obrigatório.'); return; }
    if (!_cst.contatoId) return;
    if (!_eid()) { alert('Empresa ativa não identificada.'); return; }

    var email = gv('eCtaEmail').toLowerCase();
    var tel   = _normTel(gv('eCtaTelefone'));

    // Verificar duplicata de e-mail/telefone (ignorando o próprio contato)
    if (email || tel) {
      var dup = _ctsLoad().find(function (c) {
        if (c.id === _cst.contatoId) return false;
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
    for (var i = 0; i < allCts.length; i++) { if (allCts[i].id === _cst.contatoId) { idx = i; break; } }
    if (idx < 0) { alert('Contato não encontrado. Feche e tente novamente.'); return; }

    var old     = allCts[idx];
    var oldNome = old.nome || '';

    var empTexto = gv('eCtaEmpresa');
    var empId    = _cst.empresaClienteId || null;

    // Se o texto foi apagado, limpar empresa_cliente_id também
    if (!empTexto) empId = null;

    var updated = Object.assign({}, old, {
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

    var newList = allCts.map(function (c, j) { return j === idx ? updated : c; });

    if (typeof window.ctsSaveDirect === 'function') {
      window.ctsSaveDirect(newList);
    } else {
      console.error('[EdicaoContato] ctsSaveDirect não disponível');
      return;
    }

    // Propagar renomeação
    if (oldNome && oldNome !== nome) {
      if (typeof window.ctsRenomear === 'function') window.ctsRenomear(oldNome, nome);
    }

    window._fecharModalContato2();
    if (typeof window.renderTabelaContatos === 'function') window.renderTabelaContatos();
    if (typeof toast === 'function') toast('✅ Contato atualizado: ' + nome, 'ok');
  };

  // ── Override: editarContato agora abre o modal completo ──────
  window.editarContato = function (id) {
    window.abrirModalEditarContato(id);
  };

})();

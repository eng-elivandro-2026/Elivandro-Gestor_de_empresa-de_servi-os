// ============================================================
// relacionamento-edicao-empresa.js — Modal completo de edição
// de Empresa com todos os campos + contatos relacionados
//
// Regras:
//  - Respeita empresa_id / DataGuard / sem apagar dados
//  - Usa cliSaveDirect / ctsSaveDirect (via cadastro.js)
//  - Usa cliRenomear / ctsAtualizarEmpresaRef / ctsRenomear
//    (expostos em cadastro.js por esta feature)
//  - Sobrescreve window.editarCliente (cadastro.js original
//    abre modal simples; aqui abre modal completo)
//  - Modal criado lazily (sem HTML hardcoded no index.html)
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

  // ── Contatos relacionados à empresa ────────────────────────
  // Critério: c.empresa === nome (razão social) OR apelido
  function _findContatos(empresa) {
    var nNorm = (empresa.nome    || '').toLowerCase().trim();
    var aNorm = (empresa.apelido || '').toLowerCase().trim();
    return _ctsLoad().filter(function (c) {
      var eNorm = (c.empresa || '').toLowerCase().trim();
      if (!eNorm) return false;
      if (nNorm && eNorm === nNorm) return true;
      if (aNorm && eNorm === aNorm) return true;
      return false;
    });
  }

  // ── Estado interno do modal ─────────────────────────────────
  var _st = {
    empresaId:  null,
    contatos:   [],
    ctsMod:     {}   // { cid: { campo: valor, ... } }
  };

  // ── Estilos reutilizáveis ───────────────────────────────────
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

  // ── Criar modal lazily ──────────────────────────────────────
  function _ensureModal() {
    if (document.getElementById('m-editar-empresa')) return;

    var html = '<div id="m-editar-empresa" style="display:none;position:fixed;inset:0;'
      + 'z-index:99990;align-items:center;justify-content:center;'
      + 'background:rgba(0,0,0,.8);padding:1rem">'

      // Painel
      + '<div style="background:#1e2535;border:1px solid #334155;border-radius:10px;'
      + 'width:min(700px,98vw);max-height:92vh;overflow-y:auto;display:flex;flex-direction:column">'

      // Header fixo
      + '<div style="display:flex;align-items:center;justify-content:space-between;'
      + 'padding:.85rem 1rem;border-bottom:1px solid #334155;'
      + 'position:sticky;top:0;background:#1e2535;z-index:2;border-radius:10px 10px 0 0">'
      + '<div style="font-size:.88rem;font-weight:700;color:#e2e8f0">✏️ Editar Empresa</div>'
      + '<button onclick="_fecharModalEmpresa()" style="background:none;border:none;'
      + 'color:#94a3b8;cursor:pointer;font-size:1rem;padding:.2rem .4rem">✕</button>'
      + '</div>'

      // Corpo
      + '<div style="padding:1rem;display:flex;flex-direction:column;gap:.75rem">'

      // Seção: dados da empresa
      + '<div style="' + S_SEC + '">🏢 Dados da Empresa</div>'

      // Razão Social + Apelido
      + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:.6rem">'
      + _fld('Razão Social *', 'eEmpNome', 'text', 'Ex: JDE Indústrias Ltda')
      + _fld('Apelido / Nome curto', 'eEmpApelido', 'text', 'Ex: JDE Jundiaí')
      + '</div>'

      // CNPJ + Status
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">'
      + _fld('CNPJ', 'eEmpCnpj', 'text', '00.000.000/0000-00')
      + '<div><label style="' + S_LBL + '">Status</label>'
      + '<select id="eEmpAtivo" style="' + S_INP + '">'
      + '<option value="true">Ativa</option>'
      + '<option value="false">Inativa</option>'
      + '</select></div>'
      + '</div>'

      // Telefone + E-mail
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem">'
      + _fld('Telefone', 'eEmpTelefone', 'text', '(11) 9999-0000')
      + _fld('E-mail', 'eEmpEmail', 'email', 'contato@empresa.com')
      + '</div>'

      // Site
      + _fld('Site', 'eEmpSite', 'text', 'https://www.empresa.com.br')

      // Endereço + Número
      + '<div style="display:grid;grid-template-columns:3fr 1fr;gap:.6rem">'
      + _fld('Endereço', 'eEmpEndereco', 'text', 'Rua, Av...')
      + _fld('Número', 'eEmpNumero', 'text', '100')
      + '</div>'

      // Bairro + CEP
      + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:.6rem">'
      + _fld('Bairro', 'eEmpBairro', 'text', 'Centro')
      + _fld('CEP', 'eEmpCep', 'text', '00000-000')
      + '</div>'

      // Cidade + Estado
      + '<div style="display:grid;grid-template-columns:2fr 1fr;gap:.6rem">'
      + _fld('Cidade', 'eEmpCidade', 'text', 'Ex: Jundiaí')
      + _fld('Estado (UF)', 'eEmpEstado', 'text', 'SP')
      + '</div>'

      // Observações (textarea)
      + '<div><label style="' + S_LBL + '">Observações</label>'
      + '<textarea id="eEmpObs" rows="2" placeholder="Informações adicionais..." '
      + 'style="' + S_INP + ';resize:vertical;min-height:3rem"></textarea></div>'

      // Seção: contatos relacionados
      + '<div style="' + S_SEC + '">👤 Contatos Relacionados</div>'
      + '<div id="m-editar-empresa-contatos" style="display:flex;flex-direction:column;gap:.75rem"></div>'

      + '</div>' // fim corpo

      // Footer fixo
      + '<div style="display:flex;gap:.5rem;justify-content:flex-end;'
      + 'padding:.75rem 1rem;border-top:1px solid #334155;'
      + 'position:sticky;bottom:0;background:#1e2535;border-radius:0 0 10px 10px">'
      + '<button onclick="_fecharModalEmpresa()" style="padding:.38rem 1rem;'
      + 'background:#1e2535;border:1px solid #334155;color:#94a3b8;border-radius:6px;'
      + 'cursor:pointer;font-size:.82rem">Cancelar</button>'
      + '<button onclick="salvarEdicaoEmpresa()" style="padding:.38rem 1rem;'
      + 'background:#f05a1a;border:none;color:#000;border-radius:6px;'
      + 'cursor:pointer;font-size:.82rem;font-weight:700">💾 Salvar</button>'
      + '</div>'

      + '</div></div>'; // fim painel + modal

    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    document.body.appendChild(tmp.firstElementChild);
  }

  // ── Abrir modal ─────────────────────────────────────────────
  window.abrirModalEditarEmpresa = function (id) {
    _ensureModal();
    var all  = _cliLoad();
    var item = all.find(function (x) { return x.id === id; });
    if (!item) { console.error('[EdicaoEmpresa] empresa não encontrada:', id); return; }

    _st.empresaId = id;
    _st.contatos  = _findContatos(item);
    _st.ctsMod    = {};

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

    var m = document.getElementById('m-editar-empresa');
    if (m) { m.style.display = 'flex'; m.scrollTop = 0; }
  };

  // ── Render contatos relacionados inline ─────────────────────
  function _renderContatos() {
    var el = document.getElementById('m-editar-empresa-contatos');
    if (!el) return;
    var cts = _st.contatos;

    if (!cts.length) {
      el.innerHTML = '<div style="font-size:.78rem;color:#94a3b8;text-align:center;'
        + 'padding:.75rem 0">Nenhum contato relacionado a esta empresa.</div>';
      return;
    }

    var INP_CTS = 'width:100%;background:#0f172a;border:1px solid #334155;color:#e2e8f0;'
      + 'border-radius:4px;padding:.3rem .5rem;font-size:.78rem;box-sizing:border-box';
    var LBL_CTS = 'font-size:.6rem;font-weight:600;color:#94a3b8;'
      + 'text-transform:uppercase;letter-spacing:.05em';

    el.innerHTML = cts.map(function (c) {
      return '<div style="background:#0f172a;border:1px solid #334155;border-radius:6px;padding:.75rem">'
        + '<div style="font-size:.8rem;font-weight:700;color:#e2e8f0;margin-bottom:.6rem">'
        + '👤 ' + esc(c.nome) + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">'

        + '<div><label style="' + LBL_CTS + '">Nome</label>'
        + '<input data-cid="' + esc(c.id) + '" data-campo="nome" type="text" '
        + 'value="' + esc(c.nome) + '" style="' + INP_CTS + '" '
        + 'oninput="window._eeCtsMark(this)"></div>'

        + '<div><label style="' + LBL_CTS + '">Cargo / Função</label>'
        + '<input data-cid="' + esc(c.id) + '" data-campo="departamento" type="text" '
        + 'value="' + esc(c.departamento || '') + '" style="' + INP_CTS + '" '
        + 'oninput="window._eeCtsMark(this)"></div>'

        + '<div><label style="' + LBL_CTS + '">E-mail</label>'
        + '<input data-cid="' + esc(c.id) + '" data-campo="email" type="email" '
        + 'value="' + esc(c.email || '') + '" style="' + INP_CTS + '" '
        + 'oninput="window._eeCtsMark(this)"></div>'

        + '<div><label style="' + LBL_CTS + '">Telefone</label>'
        + '<input data-cid="' + esc(c.id) + '" data-campo="telefone" type="text" '
        + 'value="' + esc(c.telefone || '') + '" style="' + INP_CTS + '" '
        + 'oninput="window._eeCtsMark(this)"></div>'

        + '</div></div>';
    }).join('');
  }

  // ── Marcar campo de contato modificado ─────────────────────
  window._eeCtsMark = function (input) {
    var cid   = input.getAttribute('data-cid');
    var campo = input.getAttribute('data-campo');
    if (!cid || !campo) return;
    if (!_st.ctsMod[cid]) _st.ctsMod[cid] = {};
    _st.ctsMod[cid][campo] = input.value;
  };

  // ── Fechar modal ────────────────────────────────────────────
  window._fecharModalEmpresa = function () {
    var m = document.getElementById('m-editar-empresa');
    if (m) m.style.display = 'none';
    _st.empresaId = null;
    _st.contatos  = [];
    _st.ctsMod    = {};
  };

  // ── Salvar empresa + contatos ───────────────────────────────
  window.salvarEdicaoEmpresa = function () {
    var gv = function (id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    var nome = gv('eEmpNome');
    if (!nome) { alert('Razão Social é obrigatória.'); return; }
    if (!_st.empresaId) return;
    if (!_eid()) { alert('Empresa ativa não identificada.'); return; }

    // 1. Atualizar empresa
    var all = _cliLoad();
    var idx = -1;
    for (var i = 0; i < all.length; i++) { if (all[i].id === _st.empresaId) { idx = i; break; } }
    if (idx < 0) { alert('Empresa não encontrada. Feche e reabra.'); return; }

    var old     = all[idx];
    var oldNome = old.nome || '';

    var updated = Object.assign({}, old, {
      nome:     nome,
      apelido:  gv('eEmpApelido'),
      cnpj:     gv('eEmpCnpj'),
      telefone: gv('eEmpTelefone'),
      email:    gv('eEmpEmail'),
      site:     gv('eEmpSite'),
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

    var newList = all.map(function (x, j) { return j === idx ? updated : x; });

    if (typeof window.cliSaveDirect === 'function') {
      window.cliSaveDirect(newList);
    } else {
      console.error('[EdicaoEmpresa] cliSaveDirect não disponível');
      return;
    }

    // 2. Propagar mudança de razão social
    if (oldNome && oldNome !== nome) {
      if (typeof window.cliRenomear === 'function')          window.cliRenomear(oldNome, nome);
      if (typeof window.ctsAtualizarEmpresaRef === 'function') window.ctsAtualizarEmpresaRef(oldNome, nome);
    }

    // 3. Salvar contatos modificados
    var cids = Object.keys(_st.ctsMod);
    if (cids.length > 0) {
      var allCts    = _ctsLoad();
      var mods      = _st.ctsMod;
      var ctsChanged = false;

      allCts = allCts.map(function (c) {
        if (!mods[c.id]) return c;
        ctsChanged = true;
        var delta  = mods[c.id];
        var merged = Object.assign({}, c);
        Object.keys(delta).forEach(function (k) { merged[k] = delta[k]; });
        // Propagação de renomeação de contato
        if (delta.nome && delta.nome !== c.nome) {
          if (typeof window.ctsRenomear === 'function') window.ctsRenomear(c.nome, delta.nome);
        }
        return merged;
      });

      if (ctsChanged && typeof window.ctsSaveDirect === 'function') {
        window.ctsSaveDirect(allCts);
      }
    }

    window._fecharModalEmpresa();
    if (typeof window.renderTabelaClientes === 'function') window.renderTabelaClientes();
    if (typeof window.renderTabelaContatos === 'function') window.renderTabelaContatos();
    if (typeof toast === 'function') toast('✅ Empresa atualizada: ' + nome, 'ok');
  };

  // ── Override: editarCliente agora abre o modal completo ─────
  window.editarCliente = function (id) {
    window.abrirModalEditarEmpresa(id);
  };

})();

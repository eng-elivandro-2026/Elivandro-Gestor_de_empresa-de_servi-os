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
    empresa:   null   // empresa object completo (para vincular section)
  };

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
      + '<button type="button" disabled title="Fase futura: importação com conferência antes de salvar" style="' + S_BTN_DISABLED + '">Importar PDF CNPJ — em breve</button>'
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

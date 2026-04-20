// ============================================================
// usuarios.js — Módulo de Administração de Usuários
// Gerencia convites, permissões, reset de senha e modo simulação
// ============================================================

(function () {

  var _usuarios = [];
  var _convites = [];
  var _modoSimulacao = null;

  var MODULOS_LISTA = [
    { id: 'comercial',  label: 'Comercial',      icon: '📊' },
    { id: 'gestao',     label: 'Gestão CEO',      icon: '🎯' },
    { id: 'rh',         label: 'RH / Equipes',    icon: '👷' },
    { id: 'financeiro', label: 'Financeiro',       icon: '💰' },
    { id: 'historico',  label: 'Relacionamento',   icon: '💬' },
  ];

  // ── Renderiza o painel de administração ──────────────────
  window.rUsuarios = async function () {
    var sec = document.getElementById('admin');
    if (!sec) return;
    sec.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text3);font-size:.82rem;">Carregando...</div>';

    var res1 = await window.sbClient.from('usuarios')
      .select('id, nome, email, perfil, modulos_permitidos, ativo')
      .order('nome');

    var res2 = await window.sbClient.from('convites')
      .select('*').eq('usado', false)
      .order('criado_em', { ascending: false });

    _usuarios = res1.data || [];
    _convites  = res2.data || [];

    _renderAdmin();
  };

  function _renderAdmin() {
    var sec = document.getElementById('admin');
    if (!sec) return;

    var html = '';

    // Cabeçalho da seção
    html += '<div style="max-width:860px;margin:0 auto;padding:.5rem 0">';

    // Banner de simulação (quando ativo)
    if (_modoSimulacao) {
      html += '<div style="background:rgba(248,81,73,.12);border:1px solid rgba(248,81,73,.45);border-radius:var(--r);padding:.7rem 1rem;margin-bottom:1rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">' +
        '<span style="font-size:.83rem;color:#f85149">👁️ Simulando acesso de <strong>' + _escHtml(_modoSimulacao.nome) + '</strong></span>' +
        '<button class="btn bd bsm" onclick="uSairSimulacao()">Sair da Simulação</button>' +
      '</div>';
    }

    // Usuários ativos
    html += '<div class="card">' +
      '<div class="ch"><span class="ct">👥 Usuários</span>' +
      '<button class="btn ba bsm" onclick="uConvidar()">✉️ Convidar</button></div>';

    if (!_usuarios.length) {
      html += '<p style="color:var(--text3);font-size:.82rem;text-align:center;padding:.8rem">Nenhum usuário encontrado.</p>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:.45rem">';
      _usuarios.forEach(function (u) {
        var modStr = u.modulos_permitidos === null
          ? '<span style="color:var(--green);font-size:.7rem">Acesso total</span>'
          : (u.modulos_permitidos && u.modulos_permitidos.length
              ? '<span style="font-size:.7rem;color:var(--accent)">' + u.modulos_permitidos.join(', ') + '</span>'
              : '<span style="color:var(--red);font-size:.7rem">Sem módulos</span>');
        var badge = u.ativo
          ? '<span class="bdg" style="background:rgba(63,185,80,.15);color:#3fb950;flex-shrink:0">Ativo</span>'
          : '<span class="bdg" style="background:rgba(248,81,73,.15);color:#f85149;flex-shrink:0">Inativo</span>';
        var initials = (u.nome || '?').slice(0, 2).toUpperCase();

        html += '<div style="display:flex;align-items:center;gap:.7rem;padding:.6rem .8rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2)">' +
          '<div style="width:34px;height:34px;background:var(--accent);border-radius:50%;display:grid;place-items:center;font-weight:800;color:#000;flex-shrink:0;font-size:.78rem">' + initials + '</div>' +
          '<div style="flex:1;min-width:0;overflow:hidden">' +
            '<div style="font-weight:600;font-size:.84rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + _escHtml(u.nome) + '</div>' +
            '<div style="font-size:.7rem;color:var(--text3)">' + _escHtml(u.perfil || '') + ' — ' + modStr + '</div>' +
          '</div>' +
          badge +
          '<div style="display:flex;gap:.25rem;flex-shrink:0">' +
            '<button class="btn bg bxs" title="Simular acesso" onclick="uSimularAcesso(\'' + u.id + '\')">👁️</button>' +
            '<button class="btn bg bxs" title="Resetar senha" onclick="uResetSenha(\'' + u.id + '\')">🔑</button>' +
            '<button class="btn bg bxs" title="Editar permissões" onclick="uEditarPermissoes(\'' + u.id + '\')">✏️</button>' +
          '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // Convites pendentes
    if (_convites.length) {
      html += '<div class="card"><div class="ch"><span class="ct">✉️ Convites Pendentes</span></div>';
      html += '<div style="display:flex;flex-direction:column;gap:.45rem">';
      _convites.forEach(function (c) {
        var mods = c.modulos_permitidos && c.modulos_permitidos.length ? c.modulos_permitidos.join(', ') : 'Acesso total';
        var data = c.criado_em ? new Date(c.criado_em).toLocaleDateString('pt-BR') : '';
        html += '<div style="display:flex;align-items:center;gap:.7rem;padding:.6rem .8rem;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2)">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;font-size:.84rem">' + _escHtml(c.nome) + ' <span style="font-size:.72rem;color:var(--text3)">(' + _escHtml(c.email) + ')</span></div>' +
            '<div style="font-size:.7rem;color:var(--text3)">Módulos: ' + _escHtml(mods) + (data ? ' · Enviado ' + data : '') + '</div>' +
          '</div>' +
          '<span class="bdg" style="background:rgba(240,165,0,.15);color:var(--accent);flex-shrink:0">Aguardando</span>' +
          '<button class="btn bd bxs" title="Revogar convite" onclick="uRevogarConvite(\'' + c.id + '\')">✕</button>' +
        '</div>';
      });
      html += '</div></div>';
    }

    // Log de acessos
    html += '<div class="card"><div class="ch"><span class="ct">📋 Log de Acessos</span></div>' +
      '<div id="admin-log-body" style="font-size:.78rem;color:var(--text3)">Carregando...</div></div>';

    html += '</div>'; // max-width wrapper

    sec.innerHTML = html;
    _carregarLogs();
  }

  async function _carregarLogs() {
    var el = document.getElementById('admin-log-body');
    if (!el) return;
    var { data: logs } = await window.sbClient.from('logs_acesso')
      .select('*').order('criado_em', { ascending: false }).limit(25);

    if (!logs || !logs.length) {
      el.textContent = 'Nenhum log registrado ainda.';
      return;
    }
    el.innerHTML = logs.map(function (l) {
      var d = new Date(l.criado_em).toLocaleString('pt-BR');
      return '<div style="padding:.35rem 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap">' +
        '<span><span style="color:var(--accent)">' + _escHtml(l.usuario_nome || l.usuario_email || '?') + '</span> — ' + _escHtml(l.acao) + '</span>' +
        '<span style="color:var(--text3);white-space:nowrap">' + d + '</span>' +
      '</div>';
    }).join('');
  }

  // ── Modal: Convidar usuário ──────────────────────────────
  window.uConvidar = function () {
    _fecharModal('modal-usuarios');
    var modHtml = MODULOS_LISTA.map(function (m) {
      return '<label style="display:flex;align-items:center;gap:.45rem;cursor:pointer;font-size:.82rem">' +
        '<input type="checkbox" name="mod-inv" value="' + m.id + '" style="cursor:pointer"> ' +
        m.icon + ' ' + m.label + '</label>';
    }).join('');

    var modal = _criarModal('modal-usuarios',
      '✉️ Convidar Usuário',
      '<div class="g" style="gap:.75rem">' +
        '<div class="f"><label>Nome *</label><input type="text" id="inv-nome" placeholder="Nome completo"></div>' +
        '<div class="f"><label>E-mail *</label><input type="email" id="inv-email" placeholder="email@exemplo.com"></div>' +
        '<div class="f"><label>Módulos Permitidos</label>' +
          '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);padding:.75rem;display:flex;flex-direction:column;gap:.5rem">' +
          modHtml + '</div>' +
          '<p style="font-size:.68rem;color:var(--text3);margin-top:.25rem">Deixe todos desmarcados para dar acesso a todos os módulos.</p>' +
        '</div>' +
      '</div>',
      '<button class="btn bg bsm" onclick="_fecharModal(\'modal-usuarios\')">Cancelar</button>' +
      '<button class="btn ba bsm" onclick="uEnviarConvite()">✉️ Enviar Convite</button>'
    );

    document.body.appendChild(modal);
    setTimeout(function () { var el = document.getElementById('inv-nome'); if (el) el.focus(); }, 50);
  };

  window.uEnviarConvite = async function () {
    var nome  = (document.getElementById('inv-nome')  || {}).value || '';
    var email = (document.getElementById('inv-email') || {}).value || '';
    if (!nome.trim() || !email.trim()) { alert('Preencha nome e e-mail.'); return; }

    var checks = document.querySelectorAll('input[name="mod-inv"]:checked');
    var modulos = Array.from(checks).map(function (cb) { return cb.value; });

    var btn = document.querySelector('#modal-usuarios .btn.ba');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    try {
      var empresaId = window.getEmpresaAtivaId ? window.getEmpresaAtivaId() : null;

      var { error: errI } = await window.sbClient.from('convites').insert({
        email:              email.trim().toLowerCase(),
        nome:               nome.trim(),
        modulos_permitidos: modulos.length ? modulos : null,
        empresa_id:         empresaId,
        criado_por:         (await window.sbClient.auth.getUser()).data.user.id
      });
      if (errI) throw errI;

      var { error: errM } = await window.sbClient.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin + '/'
        }
      });
      if (errM) throw errM;

      _fecharModal('modal-usuarios');
      alert('Convite enviado para ' + email + '!\nO usuário receberá um e-mail com link de acesso.');
      rUsuarios();
    } catch (e) {
      alert('Erro ao enviar convite: ' + (e.message || String(e)));
      if (btn) { btn.disabled = false; btn.textContent = '✉️ Enviar Convite'; }
    }
  };

  // ── Modal: Editar permissões ─────────────────────────────
  window.uEditarPermissoes = function (id) {
    var u = _usuarios.find(function (x) { return x.id === id; });
    if (!u) return;
    _fecharModal('modal-usuarios');

    var modHtml = MODULOS_LISTA.map(function (m) {
      var checked = u.modulos_permitidos === null ||
        (Array.isArray(u.modulos_permitidos) && u.modulos_permitidos.indexOf(m.id) >= 0);
      return '<label style="display:flex;align-items:center;gap:.45rem;cursor:pointer;font-size:.82rem">' +
        '<input type="checkbox" name="mod-edit" value="' + m.id + '" ' + (checked ? 'checked' : '') + ' style="cursor:pointer"> ' +
        m.icon + ' ' + m.label + '</label>';
    }).join('');

    var acaoBtn = u.ativo
      ? '<button class="btn bd bsm" onclick="uToggleAtivo(\'' + u.id + '\',false)">⛔ Desativar</button>'
      : '<button class="btn bs bsm" onclick="uToggleAtivo(\'' + u.id + '\',true)">✅ Reativar</button>';

    var modal = _criarModal('modal-usuarios',
      '✏️ Permissões — ' + _escHtml(u.nome),
      '<div class="f"><label>Módulos Permitidos</label>' +
        '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:var(--r2);padding:.75rem;display:flex;flex-direction:column;gap:.5rem">' +
        modHtml + '</div>' +
        '<p style="font-size:.68rem;color:var(--text3);margin-top:.25rem">Marque todos para dar acesso total.</p>' +
      '</div>',
      acaoBtn +
      '<div style="display:flex;gap:.4rem">' +
        '<button class="btn bg bsm" onclick="_fecharModal(\'modal-usuarios\')">Cancelar</button>' +
        '<button class="btn bs bsm" onclick="uSalvarPermissoes(\'' + u.id + '\')">💾 Salvar</button>' +
      '</div>'
    );

    document.body.appendChild(modal);
  };

  window.uSalvarPermissoes = async function (id) {
    var checks = document.querySelectorAll('input[name="mod-edit"]:checked');
    var modulos = Array.from(checks).map(function (cb) { return cb.value; });
    var todosChecked = modulos.length === MODULOS_LISTA.length;

    try {
      var { error } = await window.sbClient.from('usuarios')
        .update({ modulos_permitidos: todosChecked ? null : modulos })
        .eq('id', id);
      if (error) throw error;
      _fecharModal('modal-usuarios');
      rUsuarios();
    } catch (e) {
      alert('Erro ao salvar: ' + (e.message || String(e)));
    }
  };

  window.uToggleAtivo = async function (id, ativar) {
    var u = _usuarios.find(function (x) { return x.id === id; });
    var nome = u ? u.nome : 'este usuário';
    var acao = ativar ? 'reativar' : 'desativar';
    if (!confirm('Tem certeza que deseja ' + acao + ' ' + nome + '?')) return;

    try {
      var { error } = await window.sbClient.from('usuarios')
        .update({ ativo: ativar }).eq('id', id);
      if (error) throw error;
      _fecharModal('modal-usuarios');
      rUsuarios();
    } catch (e) {
      alert('Erro: ' + (e.message || String(e)));
    }
  };

  // ── Revogar convite ──────────────────────────────────────
  window.uRevogarConvite = async function (id) {
    if (!confirm('Revogar este convite?')) return;
    var { error } = await window.sbClient.from('convites').delete().eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    rUsuarios();
  };

  // ── Reset de senha ───────────────────────────────────────
  window.uResetSenha = async function (id) {
    var u = _usuarios.find(function (x) { return x.id === id; });
    if (!u) return;

    var email = u.email;
    if (!email) {
      email = prompt('Informe o e-mail de ' + u.nome + ':');
      if (!email) return;
    }

    if (!confirm('Enviar link de redefinição de senha para ' + email + '?')) return;

    var { error } = await window.sbClient.auth.resetPasswordForEmail(email.trim());
    if (error) { alert('Erro: ' + error.message); return; }
    alert('Link de redefinição enviado para ' + email + '!');
  };

  // ── Modo Simulação (Spy Mode) ────────────────────────────
  window.uSimularAcesso = function (id) {
    var u = _usuarios.find(function (x) { return x.id === id; });
    if (!u) return;
    if (!confirm('Simular o que ' + u.nome + ' vê na plataforma?')) return;

    _modoSimulacao = { id: u.id, nome: u.nome, modulos: u.modulos_permitidos };

    if (typeof Router !== 'undefined' && typeof Router.aplicarPermissoes === 'function') {
      Router.aplicarPermissoes(u.modulos_permitidos);
    }

    // Navegar para o primeiro módulo permitido
    var primeiro = u.modulos_permitidos && u.modulos_permitidos.length
      ? u.modulos_permitidos[0]
      : 'comercial';
    if (typeof Router !== 'undefined') Router.ir(primeiro);

    _renderSpyBanner();
  };

  function _renderSpyBanner() {
    var old = document.getElementById('spy-banner-global');
    if (old) old.remove();

    var banner = document.createElement('div');
    banner.id = 'spy-banner-global';
    banner.style.cssText = [
      'position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%)',
      'background:rgba(20,0,0,.92);border:1.5px solid #f85149',
      'border-radius:var(--r);padding:.55rem 1.1rem',
      'z-index:9999;display:flex;align-items:center;gap:.75rem',
      'font-size:.82rem;color:#fff',
      'box-shadow:0 4px 24px rgba(248,81,73,.35)',
      'white-space:nowrap;max-width:90vw'
    ].join(';');
    banner.innerHTML = '👁️ Simulando: <strong style="color:#f85149">' + _escHtml(_modoSimulacao.nome) + '</strong>' +
      ' <button onclick="uSairSimulacao()" style="background:#f85149;border:none;color:#fff;border-radius:4px;padding:.2rem .6rem;font-size:.75rem;cursor:pointer;font-weight:700;margin-left:.3rem">Sair</button>';
    document.body.appendChild(banner);
  }

  window.uSairSimulacao = function () {
    _modoSimulacao = null;
    var banner = document.getElementById('spy-banner-global');
    if (banner) banner.remove();

    // Restaura permissões do admin (acesso total)
    if (typeof Router !== 'undefined' && typeof Router.aplicarPermissoes === 'function') {
      Router.aplicarPermissoes(null);
    }
    if (typeof Router !== 'undefined') Router.ir('admin');
    rUsuarios();
  };

  // ── Helpers de modal ─────────────────────────────────────
  function _criarModal(id, titulo, corpo, rodape) {
    var el = document.createElement('div');
    el.id = id;
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem';
    el.innerHTML =
      '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:1.4rem;width:100%;max-width:460px;max-height:90vh;overflow-y:auto">' +
        '<div class="ch"><span class="ct">' + titulo + '</span>' +
          '<button class="nb" onclick="_fecharModal(\'' + id + '\')" style="font-size:1rem;padding:.2rem .5rem">✕</button>' +
        '</div>' +
        '<div style="margin-bottom:1.1rem">' + corpo + '</div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.4rem">' +
          rodape +
        '</div>' +
      '</div>';
    return el;
  }

  window._fecharModal = function (id) {
    var el = document.getElementById(id);
    if (el) el.remove();
  };

  function _escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Log de acesso ────────────────────────────────────────
  window.registrarLog = async function (acao, modulo) {
    try {
      var authU = (await window.sbClient.auth.getUser()).data.user;
      if (!authU) return;
      await window.sbClient.from('logs_acesso').insert({
        usuario_email: authU.email,
        usuario_nome:  window._nomeUsuario || authU.email,
        acao:          acao,
        modulo:        modulo || null
      });
    } catch (e) {}
  };

  console.log('%c[usuarios] carregado', 'color:#f0a500;font-weight:700');

})();

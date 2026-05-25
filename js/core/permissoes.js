// ============================================================
// permissoes.js — Matriz centralizada de permissões G4A
// Fonte única de verdade para perfis, módulos e ações.
// ============================================================

(function () {

  // ── Superadmin provisório ────────────────────────────────
  // nascimento.gaube@gmail.com é o dono do software/plataforma.
  // Bypass total enquanto tela formal de gestão (G4B) não existe.
  var _SUPERADMIN_EMAIL = 'nascimento.gaube@gmail.com';

  // ── Matriz de permissões ─────────────────────────────────
  // Chaves de módulo correspondem exatamente aos IDs do Router:
  //   comercial, operacional, historico (= Relacionamento),
  //   gestao, rh, financeiro
  // Módulos lógicos sem ID próprio no Router:
  //   cofre (botão dentro do Financeiro), configuracoes (botões 🏢/👥)
  window.PERMISSOES_PADRAO = {
    financeiro: {
      ver:           ['dono', 'admin', 'gestor', 'financeiro'],
      criar_cp_cr:   ['dono', 'admin', 'gestor', 'financeiro'],
      editar_cp_cr:  ['dono', 'admin', 'gestor', 'financeiro'],
      cancelar_cp_cr:['dono', 'admin', 'gestor'],
      importar_nf:   ['dono', 'admin', 'gestor', 'financeiro'],
      cofre:         ['dono', 'admin']
    },
    comercial: {
      ver:              ['dono', 'admin', 'gestor', 'comercial', 'colaborador'],
      criar_proposta:   ['dono', 'admin', 'gestor', 'comercial'],
      aprovar_proposta: ['dono', 'admin', 'gestor'],
      editar_margem:    ['dono', 'admin']
    },
    historico: {
      // ID do Router para o módulo Relacionamento é 'historico'
      ver:    ['dono', 'admin', 'gestor', 'comercial', 'colaborador'],
      editar: ['dono', 'admin', 'gestor', 'comercial']
    },
    operacional: {
      ver:    ['dono', 'admin', 'gestor', 'colaborador', 'prestador'],
      editar: ['dono', 'admin', 'gestor', 'colaborador']
    },
    gestao: {
      ver:    ['dono', 'admin', 'gestor'],
      editar: ['dono', 'admin']
    },
    rh: {
      ver:    ['dono', 'admin', 'gestor'],
      editar: ['dono', 'admin']
    },
    cofre: {
      acesso: ['dono', 'admin']
    },
    configuracoes: {
      empresa:  ['dono', 'admin'],
      usuarios: ['dono', 'admin'],
      modulos:  ['dono']
    }
  };

  // Lista canônica de módulos do Router (mesma ordem da sidebar)
  var _MODULOS_ROUTER = ['comercial', 'operacional', 'historico', 'gestao', 'rh', 'financeiro'];

  // ── Helpers internos ─────────────────────────────────────

  function _isSuperadmin() {
    return !!(window._userEmail && window._userEmail === _SUPERADMIN_EMAIL);
  }

  function _getPerfil() {
    return window.getPerfilUsuario ? window.getPerfilUsuario() : null;
  }

  // ── API pública ──────────────────────────────────────────

  // Verifica se o perfil atual pode acessar um módulo (ação 'ver' / 'acesso')
  window.podeAcessarModulo = function (modulo) {
    if (_isSuperadmin()) return true;
    var perfil = _getPerfil();
    if (!perfil) return false;
    if (perfil === 'dono') return true;
    var mat = window.PERMISSOES_PADRAO[modulo];
    if (!mat) return false;
    var permitidos = mat.ver || mat.acesso || [];
    return permitidos.indexOf(perfil) >= 0;
  };

  // Verifica se pode executar uma ação específica em um módulo
  window.podeAcao = function (modulo, acao) {
    if (_isSuperadmin()) return true;
    var perfil = _getPerfil();
    if (!perfil) return false;
    if (perfil === 'dono') return true;
    var mat = window.PERMISSOES_PADRAO[modulo];
    if (!mat) return false;
    var permitidos = mat[acao] || [];
    return permitidos.indexOf(perfil) >= 0;
  };

  // Retorna lista de IDs de módulos do Router acessíveis ao perfil atual
  window.getModulosPermitidos = function () {
    return _MODULOS_ROUTER.filter(function (m) {
      return window.podeAcessarModulo(m);
    });
  };

  // Retorna mapa completo de permissões para o perfil atual (útil para debug / G4B)
  window.getPermissoesPerfilAtual = function () {
    var perfil = _getPerfil();
    if (!perfil) return {};
    var result = {};
    Object.keys(window.PERMISSOES_PADRAO).forEach(function (modulo) {
      result[modulo] = {};
      var mat = window.PERMISSOES_PADRAO[modulo];
      Object.keys(mat).forEach(function (acao) {
        result[modulo][acao] = window.podeAcao(modulo, acao);
      });
    });
    return result;
  };

  console.log('%c[permissoes] carregado — matriz G4A ativa', 'color:#f0a500;font-weight:700');

})();

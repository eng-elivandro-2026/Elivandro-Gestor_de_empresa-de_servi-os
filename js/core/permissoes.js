// ============================================================
// permissoes.js — Matriz centralizada de permissões G4A/G4B
// Fonte única de verdade para perfis, módulos e ações.
// G4B: suporta override por empresa via config_json.permissoes
// ============================================================

(function () {

  // ── Superadmin provisório ────────────────────────────────
  // nascimento.gaube@gmail.com é o dono do software/plataforma.
  // Bypass total enquanto gestão formal de superadmin não existe.
  var _SUPERADMIN_EMAIL = 'nascimento.gaube@gmail.com';

  // ── Matriz de permissões padrão ──────────────────────────
  // Chaves de módulo correspondem exatamente aos IDs do Router:
  //   comercial, operacional, historico (= Relacionamento),
  //   gestao, rh, financeiro
  // Módulos lógicos sem ID no Router:
  //   cofre (botão dentro do Financeiro), configuracoes (botões 🏢/👥/⚙️)
  // Perfis canônicos do sistema (mesma lista dos selects de usuário):
  //   dono · admin · gestor · financeiro · comercial · rh · operacional
  //   colaborador · leitura · prestador
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
      ver:              ['dono', 'admin', 'gestor', 'comercial', 'colaborador', 'leitura'],
      criar_proposta:   ['dono', 'admin', 'gestor', 'comercial'],
      aprovar_proposta: ['dono', 'admin', 'gestor'],
      editar_margem:    ['dono', 'admin']
    },
    historico: {
      // ID do Router para o módulo Relacionamento é 'historico'
      ver:    ['dono', 'admin', 'gestor', 'comercial', 'colaborador', 'rh', 'operacional', 'leitura'],
      editar: ['dono', 'admin', 'gestor', 'comercial']
    },
    operacional: {
      ver:    ['dono', 'admin', 'gestor', 'colaborador', 'prestador', 'rh', 'operacional', 'leitura'],
      editar: ['dono', 'admin', 'gestor', 'colaborador', 'operacional']
    },
    gestao: {
      ver:    ['dono', 'admin', 'gestor'],
      editar: ['dono', 'admin']
    },
    rh: {
      ver:    ['dono', 'admin', 'gestor', 'rh'],
      editar: ['dono', 'admin', 'rh']
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

  // Retorna a matriz ativa: override da empresa ativa ou PERMISSOES_PADRAO como fallback.
  // Para cada módulo, usa o override se existir; caso contrário cai no padrão.
  function _getMatriz() {
    var emp = window._empresaAtiva;
    if (emp && emp.config_json && emp.config_json.permissoes) {
      return emp.config_json.permissoes;
    }
    return window.PERMISSOES_PADRAO;
  }

  // Retorna permissões do módulo: override da empresa ou fallback para PERMISSOES_PADRAO
  function _getMatrizMod(modulo) {
    var emp = window._empresaAtiva;
    if (emp && emp.config_json && emp.config_json.permissoes) {
      var custom = emp.config_json.permissoes[modulo];
      if (custom) return custom;
    }
    return window.PERMISSOES_PADRAO[modulo] || null;
  }

  function _isGrant(valor) {
    return valor === true || valor === 1 || valor === 'true' || valor === '1';
  }

  function _temPermissaoIndividual(modulo, acao) {
    var emp = window._empresaAtiva;
    var perms = emp && emp.permissoes_json;
    if (!perms || typeof perms !== 'object') return false;

    var chave = modulo + '.' + acao;
    if (_isGrant(perms[chave])) return true;

    var mod = perms[modulo];
    if (!mod) return false;

    if (Array.isArray(mod)) {
      return mod.indexOf(acao) >= 0 || (acao === 'ver' && mod.indexOf('acesso') >= 0);
    }

    if (typeof mod === 'object') {
      if (_isGrant(mod[acao])) return true;
      if (acao === 'ver' && _isGrant(mod.acesso)) return true;
      if (Array.isArray(mod.acoes)) {
        return mod.acoes.indexOf(acao) >= 0 || (acao === 'ver' && mod.acoes.indexOf('acesso') >= 0);
      }
      if (mod.acoes && typeof mod.acoes === 'object') {
        return _isGrant(mod.acoes[acao]) || (acao === 'ver' && _isGrant(mod.acoes.acesso));
      }
    }

    return false;
  }

  // ── API pública ──────────────────────────────────────────

  // Verifica se o perfil atual pode acessar um módulo (ação 'ver' / 'acesso')
  window.podeAcessarModulo = function (modulo) {
    if (_isSuperadmin()) return true;
    // Quadro de Avisos: acesso restrito a Dono e ao gestor Adriano (por e-mail).
    if (modulo === 'avisos') {
      if (_getPerfil() === 'dono') return true;
      return !!(window._userEmail && String(window._userEmail).toLowerCase() === 'adriano@tecfusion.com.br');
    }
    var perfil = _getPerfil();
    if (!perfil) return false;
    if (perfil === 'dono') return true;
    if (_temPermissaoIndividual(modulo, 'ver') || _temPermissaoIndividual(modulo, 'acesso')) return true;
    var mat = _getMatrizMod(modulo);
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
    if (_temPermissaoIndividual(modulo, acao)) return true;
    var mat = _getMatrizMod(modulo);
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

  // Retorna a matriz ativa (usada pela tela G4B para carregar valores atuais)
  window.getMatrizAtiva = function () {
    return _getMatriz();
  };

  // Retorna mapa completo de permissões para o perfil atual (debug / G4B)
  window.getPermissoesPerfilAtual = function () {
    var perfil = _getPerfil();
    if (!perfil) return {};
    var result = {};
    Object.keys(window.PERMISSOES_PADRAO).forEach(function (modulo) {
      result[modulo] = {};
      var mat = _getMatrizMod(modulo) || window.PERMISSOES_PADRAO[modulo];
      Object.keys(mat).forEach(function (acao) {
        result[modulo][acao] = window.podeAcao(modulo, acao);
      });
    });
    return result;
  };

  console.log('%c[permissoes] carregado — G4A/G4B ativa', 'color:#f0a500;font-weight:700');

})();

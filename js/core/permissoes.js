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
    'gestao-tempo': {
      // Diário pessoal de atividades — todo perfil autenticado pode registrar
      // o próprio dia (RLS de registro_atividades já restringe cada um a ver
      // só os próprios registros; 'leitura' só visualiza, não edita).
      ver:    ['dono', 'admin', 'gestor', 'financeiro', 'comercial', 'rh', 'operacional', 'colaborador', 'leitura', 'prestador'],
      editar: ['dono', 'admin', 'gestor', 'financeiro', 'comercial', 'rh', 'operacional', 'colaborador', 'prestador']
    },
    'gestao-a-vista': {
      ver:         ['dono', 'admin', 'gestor', 'financeiro', 'comercial', 'operacional', 'colaborador', 'leitura', 'prestador'],
      editar:      ['dono', 'admin', 'gestor'],
      editar_pdca: ['dono', 'admin', 'gestor']
    },
    'reuniao-radar': {
      ver:    ['dono', 'admin', 'gestor', 'financeiro', 'comercial', 'operacional', 'colaborador', 'leitura', 'prestador'],
      editar: ['dono', 'admin', 'gestor']
    },
    'dashboard-estrategico': {
      ver: ['dono', 'admin']
    },
    'dashboard-minha-empresa': {
      ver:    ['dono', 'gestor'],
      editar: ['dono', 'gestor']
    },
    'planejamento-estrategico': {
      ver:    ['dono'],
      editar: ['dono']
    },
    rh: {
      ver:    ['dono', 'admin', 'gestor', 'rh'],
      editar: ['dono', 'admin', 'rh']
    },
    prospeccao: {
      // Prospecção Comercial (Etapas 1-2) — EXCLUSIVO de dono/admin nesta
      // fase (decisão aprovada); Elivandro abre p/ outros perfis depois,
      // quando o módulo estiver validado em uso real. Ações granulares já
      // previstas p/ essa abertura futura.
      ver:                 ['dono', 'admin'],
      capturar:            ['dono', 'admin'],
      wizard:              ['dono', 'admin'],
      editar_outros:       ['dono', 'admin'],
      excluir:             ['dono', 'admin'],
      metricas_usuarios:   ['dono', 'admin'],
      definir_responsavel: ['dono', 'admin']
    },
    'recursos-produtividade': {
      // Dashboard agregado (mostra toda a equipe) — default restrito a
      // gestão. Governável nas DUAS telas: por perfil (G4B, esta matriz)
      // e individual (chave 'recursos_produtividade' no JSON). Só 'ver':
      // a aba Configurações do módulo é só-dono por decisão de produto.
      ver: ['dono', 'admin', 'gestor']
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
  var _MODULOS_ROUTER = ['comercial', 'prospeccao', 'gestao-a-vista', 'operacional', 'historico', 'gestao-tempo', 'rh', 'recursos-produtividade', 'financeiro', 'dashboard-estrategico', 'dashboard-minha-empresa', 'planejamento-estrategico'];

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

  // ── Permissões individuais por usuário (migration 054) ────
  // O JSON do cliente usa vocabulário próprio (relacionamento, mpe,
  // minha_empresa, quadro_avisos, ...) e ações uniformes
  // ver/editar/excluir/aprovar. Mapas de tradução:

  // ID do Router → chave de módulo no JSON.
  // Sem entrada aqui = sem correspondente no JSON → fallback por perfil
  // (reuniao-radar, dashboard-estrategico, cofre, configuracoes e
  // gestao-tempo — sem chave individual nesta etapa).
  var MAPA_MODULO_JSON = {
    'comercial':                'comercial',
    'operacional':              'operacional',
    'financeiro':               'financeiro',
    'rh':                       'rh',
    'historico':                'relacionamento',
    'gestao-a-vista':           'mpe',
    'dashboard-minha-empresa':  'minha_empresa',
    'planejamento-estrategico': 'planejamento',
    'recursos-produtividade':   'recursos_produtividade',
    'avisos':                   'quadro_avisos'
  };

  // Ações atuais → ações do JSON (ver/editar/excluir/aprovar).
  var MAPA_ACAO_JSON_BASE = { ver: 'ver', acesso: 'ver', editar: 'editar', excluir: 'excluir', aprovar: 'aprovar' };
  // Overrides por módulo. Ação sem mapeamento (ex.: financeiro.cofre,
  // configuracoes.*) → fallback por perfil.
  var MAPA_ACAO_JSON_MOD = {
    'comercial':      { criar_proposta: 'editar', editar_margem: 'editar', aprovar_proposta: 'aprovar' },
    'financeiro':     { criar_cp_cr: 'editar', editar_cp_cr: 'editar', importar_nf: 'editar', cancelar_cp_cr: 'excluir' },
    'gestao-a-vista': { editar_pdca: 'editar' }
  };

  // Resolve a permissão individual explícita do usuário na empresa ativa.
  // Retorna true/false (AUTORITATIVO — concede ou revoga) ou null
  // (sem configuração explícita → chamador usa o fallback por perfil).
  function _resolverIndividual(modulo, acao) {
    var emp = window._empresaAtiva;
    var pm = emp && emp.permissoes_modulos;
    if (!pm || typeof pm !== 'object') return null;
    var chave = MAPA_MODULO_JSON[modulo] || modulo; // aceita chave do JSON direta
    var entry = pm[chave];
    if ((!entry || typeof entry !== 'object') && chave !== modulo) entry = pm[modulo];
    if (!entry || typeof entry !== 'object') return null;
    var acaoJson = (MAPA_ACAO_JSON_MOD[modulo] && MAPA_ACAO_JSON_MOD[modulo][acao]) || MAPA_ACAO_JSON_BASE[acao] || null;
    if (!acaoJson) return null;
    var v = entry[acaoJson];
    return (v === true || v === false) ? v : null;
  }

  // ── Grupos da tela "Permissões Individuais" (Etapa 3) ─────
  // As 19 chaves reais do JSON usado no seed (supabase/seeds/
  // seed_permissoes_modulos.sql), agrupadas apenas para exibição.
  // Cada chave tem sempre as 4 ações uniformes ver/editar/excluir/
  // aprovar — mesmo formato gravado em permissoes_modulos. Fonte
  // única para a tela em index.html não duplicar esta lista.
  window.PERMISSOES_INDIVIDUAIS_GRUPOS = [
    { label: '📊 Comercial', chaves: [
      { key: 'comercial',       label: 'Comercial (módulo)' },
      { key: 'propostas',       label: 'Propostas' },
      { key: 'pipeline',        label: 'Pipeline' },
      { key: 'banco_escopos',   label: 'Banco de Escopos' },
      { key: 'metas',           label: 'Metas' },
      { key: 'analise_ia',      label: 'Análise IA' },
      { key: 'ranking_clientes',label: 'Ranking de Clientes' }
    ]},
    { label: '📊 Comercial — painéis', chaves: [
      // 'gestao_ceo' foi removida do módulo (Gestão CEO virou Gestão do
      // Tempo). 'visao_executiva' segue viva: é uma subseção do próprio
      // Comercial hoje (item "Visão Executiva" em renderMenuComercialOrganizado,
      // index.html). Chaves antigas 'gestao_ceo' já gravadas no banco (seed)
      // ficam inertes — nenhum módulo do Router aponta mais para elas.
      { key: 'visao_executiva', label: 'Visão Executiva' }
    ]},
    { label: '🏗️ Operacional', chaves: [
      { key: 'operacional', label: 'Operacional (módulo)' },
      { key: 'obras',       label: 'Obras' }
    ]},
    { label: '💰 Financeiro', chaves: [ { key: 'financeiro', label: 'Financeiro' } ] },
    { label: '👷 RH', chaves: [ { key: 'rh', label: 'RH / Equipes' } ] },
    { label: '💬 Relacionamento', chaves: [ { key: 'relacionamento', label: 'Relacionamento' } ] },
    { label: '📊 MPE', chaves: [ { key: 'mpe', label: 'MPE' } ] },
    { label: '🧭 Planejamento', chaves: [ { key: 'planejamento', label: 'Planejamento Estratégico' } ] },
    { label: '🏢 Minha Empresa', chaves: [ { key: 'minha_empresa', label: 'Minha Empresa' } ] },
    // Só a ação 'ver' tem efeito (dashboard puro; editar/excluir/aprovar
    // ficam gravadas mas inertes, como nos demais módulos ver-only).
    { label: '📈 Recursos & Produtividade', chaves: [ { key: 'recursos_produtividade', label: 'Recursos & Produtividade' } ] },
    { label: '📌 Quadro de Avisos', chaves: [ { key: 'quadro_avisos', label: 'Quadro de Avisos' } ] },
    { label: '🗄️ Backup', chaves: [ { key: 'backup', label: 'Backup (sem módulo no portal ainda)' } ] }
  ];
  window.PERMISSOES_INDIVIDUAIS_ACOES = [
    { key: 'ver',     label: 'Ver' },
    { key: 'editar',  label: 'Editar' },
    { key: 'excluir', label: 'Excluir' },
    { key: 'aprovar', label: 'Aprovar' }
  ];

  // ── API pública ──────────────────────────────────────────

  // Verifica se o perfil atual pode acessar um módulo (ação 'ver' / 'acesso')
  window.podeAcessarModulo = function (modulo) {
    if (_isSuperadmin()) return true;
    var perfil = _getPerfil();
    if (perfil === 'dono') return true;
    // Permissão individual explícita (migration 054) — autoritativa,
    // inclusive para o Quadro de Avisos (substitui o hardcode por e-mail).
    var ind = _resolverIndividual(modulo, 'ver');
    if (ind === true || ind === false) return ind;
    // Quadro de Avisos sem JSON: fallback hardcoded (gestor Adriano por e-mail).
    if (modulo === 'avisos') {
      return !!(window._userEmail && String(window._userEmail).toLowerCase() === 'adriano@tecfusion.com.br');
    }
    if (!perfil) return false;
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
    if (perfil === 'dono') return true;
    // Permissão individual explícita (migration 054) — autoritativa
    var ind = _resolverIndividual(modulo, acao);
    if (ind === true || ind === false) return ind;
    if (!perfil) return false;
    if (_temPermissaoIndividual(modulo, acao)) return true;
    var mat = _getMatrizMod(modulo);
    if (!mat) return false;
    var permitidos = mat[acao] || [];
    return permitidos.indexOf(perfil) >= 0;
  };

  // Visibilidade de SUBSEÇÃO do menu (itens de nav com tag sub: no Router).
  // Chaves do JSON sem módulo próprio: propostas, pipeline, banco_escopos,
  // metas, analise_ia, ranking_clientes, visao_executiva, obras.
  // true/false explícito governa; sem configuração → visível (a visibilidade
  // do MÓDULO já foi decidida por podeAcessarModulo).
  window.podeVerSubsecao = function (modulo, subKey) {
    if (_isSuperadmin()) return true;
    if (_getPerfil() === 'dono') return true;
    var emp = window._empresaAtiva;
    var pm = emp && emp.permissoes_modulos;
    if (!pm || typeof pm !== 'object') return true;
    var entry = pm[subKey];
    if (!entry || typeof entry !== 'object') return true;
    var v = entry.ver;
    return (v === true || v === false) ? v : true;
  };

  // Retorna lista de IDs de módulos do Router acessíveis ao perfil atual
  window.getModulosPermitidos = function () {
    return _MODULOS_ROUTER.filter(function (m) {
      return window.podeAcessarModulo(m);
    });
  };

  // ── Leitor direto de permissão individual ─────────────────
  // Lê usuario_empresas.permissoes_modulos, carregada no boot em
  // window._empresaAtiva (multi-empresa.js). Aceita tanto IDs do
  // Router quanto chaves do JSON (tradução via _resolverIndividual).
  // Resolução:
  //   1. superadmin / perfil dono → true (bypass, nunca restringidos)
  //   2. true/false EXPLÍCITO no JSON → autoritativo (concede OU revoga)
  //   3. módulo/ação ausente, ou coluna NULL → fallback podeAcao (perfil)
  window.getPermissoesUsuario = function (modulo, acao) {
    if (_isSuperadmin()) return true;
    if (_getPerfil() === 'dono') return true;
    var ind = _resolverIndividual(modulo, acao);
    if (ind === true || ind === false) return ind; // autoritativo
    return window.podeAcao(modulo, acao); // fallback: matriz por perfil
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

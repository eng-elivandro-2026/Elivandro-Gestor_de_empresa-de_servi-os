// ============================================================
// router.js — Roteador de módulos da plataforma TecFusion
// Gerencia navegação, sidebar e carregamento de módulos
// ============================================================

(function () {

  // ── Registro de módulos ──────────────────────────────────
  // Cada módulo define: id, label, icon, tipo ('inline' | 'iframe'),
  // src (para iframe) ou init (função para inline),
  // nav (subitens do sidebar), badge (opcional)
  var MODULOS = [
    {
      id: 'dashboard-minha-empresa',
      label: 'Minha Empresa',
      icon: '🏢',
      tipo: 'iframe',
      src: 'pages/dashboard-minha-empresa.html',
      nav: [
        { label: 'Missão, Visão e Valores', icon: '🏢', action: "Router.ir('dashboard-minha-empresa');Router.iframeMsg('dashboard-minha-empresa','SHOW_SECTION','principal')" },
        { label: 'IE - Identidade da Empresa', icon: '🪪', action: "Router.ir('dashboard-minha-empresa');Router.iframeMsg('dashboard-minha-empresa','SHOW_SECTION','identidade')" },
        { label: 'Cadeia de Valor', icon: '🔗', emBreve: true },
        { label: 'Macro-processo',  icon: '🗺️', emBreve: true },
        { label: 'Organograma',     icon: '🏛️', emBreve: true },
        { label: 'Processos',       icon: '⚙️', emBreve: true },
        { separator: true, label: 'Pessoas' },
        { label: 'Departamentos',   icon: '🏢', emBreve: true },
        { label: 'Funções e RCF',   icon: '📋', emBreve: true },
        { label: 'Colaboradores',   icon: '👤', emBreve: true },
        { label: 'Matriz Nine Box', icon: '🎯', emBreve: true },
        { label: 'PDI',             icon: '📈', emBreve: true },
        { label: 'Kanban',          icon: '🗂️', emBreve: true },
        { label: 'Reunião 1:1',     icon: '💬', emBreve: true },
        { separator: true, label: 'Reuniões' },
        { label: 'Diárias',     icon: '📅', emBreve: true },
        { label: '↳ Semanais',  icon: '🗓️', action: "Router.ir('reuniao-radar')" },
        { label: 'Quinzenais',  icon: '📆', emBreve: true },
        { label: 'Trimestrais', icon: '📊', emBreve: true },
        { label: 'Anuais',      icon: '🎯', emBreve: true },
      ]
    },
    {
      id: 'planejamento-estrategico',
      label: 'Estratégia',
      icon: '🧭',
      tipo: 'iframe',
      src: 'pages/planejamento-estrategico.html',
      nav: [
        { label: 'Planos Estratégicos',       icon: '🗂️', action: "Router.iframeMsg('planejamento-estrategico','SHOW_SECTION','planos');Router._setNavAtivo(this)" },
        { label: 'Criar Plano',               icon: '➕', action: "Router.iframeMsg('planejamento-estrategico','SHOW_SECTION','criar');Router._setNavAtivo(this)" },
        { label: 'Biblioteca de Ferramentas', icon: '🧰', action: "Router.iframeMsg('planejamento-estrategico','SHOW_SECTION','ferramentas');Router._setNavAtivo(this)" },
      ]
    },
    {
      id: 'rh',
      label: 'Pessoas',
      icon: '👷',
      tipo: 'inline',
      init: function () { go('rh'); if (typeof rRH === 'function') rRH(); },
      nav: [
        { label: 'Colaboradores', icon: '👷', action: "go('rh',this);rhShowSec('colaboradores',null)" },
        { label: 'Apontamentos',  icon: '⏱️', action: "go('rh',this);rhShowSec('apontamentos',null)" },
        { label: 'Boletins',      icon: '📋', action: "go('rh',this);rhShowSec('boletins',null)" },
        { label: 'Férias',        icon: '🌴', action: "go('rh',this);rhShowSec('ferias-geral',null)" },
        { label: 'Despesas',      icon: '💰', action: "go('rh',this);rhShowSec('despesas',null)" },
      ]
    },
    {
      id: 'comercial',
      label: 'Comercial',
      icon: '📊',
      tipo: 'inline',
      init: function () { go('dashboard'); setTimeout(function(){ irParaPainel('propostasCard','togPropostas'); }, 60); },
      nav: [
        { label: 'Dashboard',          icon: '📊', action: "go('dashboard',this);document.getElementById('area-inline').scrollTop=0" },
        { separator: true, label: 'Comercial' },
        { label: '↳ Propostas',        icon: '📄', sub: 'propostas',        action: "go('dashboard',this);irParaPainel('propostasCard','togPropostas')" },
        { label: '↳ Metas',            icon: '🎯', sub: 'metas',            action: "irParaPainel('metaPanel','togMeta')" },
        { label: '↳ Visão Geral',      icon: '📈', action: "irParaPainel('visaoGeralCard','togVisaoGeral')" },
        { label: '↳ Análise IA',       icon: '🤖', sub: 'analise_ia',       action: "irParaPainel('analisePanel','togAnalise')" },
        { label: '↳ Ranking',          icon: '🏢', sub: 'ranking_clientes', action: "irParaPainel('rankingCard','togRanking')" },
        { label: '↳ Fechamentos',      icon: '📅', action: "irParaPainel('fechMesCard','togFechMes')" },
        { label: '↳ Linha do Tempo',   icon: '📅', action: "irParaPainel('execTimelineCard','togExecTimeline')" },
        { separator: true, label: 'Ferramentas' },
        { label: 'Templates',          icon: '📋', action: "go('templates',this);beLoadDB();stplRenderLista()" },
        { label: 'Banco de Escopos',   icon: '🗂️', sub: 'banco_escopos', action: "go('escopos',this);setTimeout(beInit,80)" },
        { label: 'Análise',            icon: '📈', action: "go('analise',this);rAnalise()" },
        { label: 'Pipeline',           icon: '🔀', sub: 'pipeline',      action: "go('registro',this);rRegistro()" },
        { label: 'Versões',            icon: '📋', action: "go('changelog',this)" },
      ]
    },
    {
      id: 'operacional',
      label: 'Execução',
      icon: 'OP',
      tipo: 'inline',
      init: function () { go('operacional'); if (typeof rOperacional === 'function') rOperacional(); },
      nav: [
        { label: 'Obras', icon: 'OP', action: "go('operacional',this);rOperacional()" },
        { separator: true, label: 'Status' },
        { label: 'Aprovado', icon: '✅', action: "go('operacional',this);opSetFiltroStatus('aprovado')" },
        { label: 'Em Andamento', icon: '🔧', action: "go('operacional',this);opSetFiltroStatus('andamento')" },
        { label: 'TAF', icon: '🧪', action: "go('operacional',this);opSetFiltroStatus('taf')" },
        { label: 'SAT', icon: '🛠️', action: "go('operacional',this);opSetFiltroStatus('sat')" },
        { label: 'Finalizado', icon: '🏁', action: "go('operacional',this);opSetFiltroStatus('finalizado')" },
        { label: 'Atrasado', icon: '⚠️', action: "go('operacional',this);opSetFiltroStatus('atrasado')" },
        { label: 'Em Pausa Falta Material', icon: '⏸️', action: "go('operacional',this);opSetFiltroStatus('em_pausa_falta_material')" },
        { label: 'Em Pausa Ag. Cliente', icon: '⏸️', action: "go('operacional',this);opSetFiltroStatus('em_pausa_aguardando_cliente')" },
        { label: 'Em Pausa Ag. Terceiro', icon: '⏸️', action: "go('operacional',this);opSetFiltroStatus('em_pausa_aguardando_terceiro')" },
      ]
    },
    {
      id: 'engenharia',
      label: 'Engenharia',
      icon: '⚡',
      tipo: 'iframe',
      src: 'pages/engenharia.html',
      nav: [
        // SHOW_SECTION preparado para futuros cálculos (queda de tensão,
        // curto-circuito, luminotécnica, SPDA...) — mesmo padrão simples
        // que a Prospecção já usa.
        { label: 'Dimensionamento de Cabos', icon: '🔌', action: "Router.ir('engenharia');Router.iframeMsg('engenharia','SHOW_SECTION','cabos')" },
        { label: 'Curto-Circuito BT',        icon: '⚡', action: "Router.ir('curto-circuito')" },
      ]
    },
    {
      // Módulo OCULTO: acessado pelo item "Curto-Circuito BT" na subnav de
      // Engenharia (não vira botão próprio no sidebar). Mesmo padrão do
      // reuniao-radar. Iframe autocontido (pages/curto-circuito.html).
      id: 'curto-circuito',
      label: 'Curto-Circuito BT',
      icon: '⚡',
      oculto: true,
      tipo: 'iframe',
      src: 'pages/curto-circuito.html',
      nav: [
        // Dois itens no MESMO nível (nenhum é subitem do outro) — igual à
        // subnav de Engenharia. NÃO usar o prefixo '↳' (ele indenta o item
        // como subitem em _renderNavMod).
        { label: 'Dimensionamento de Cabos', icon: '🔌', action: "Router.ir('engenharia');Router.iframeMsg('engenharia','SHOW_SECTION','cabos')" },
        { label: 'Curto-Circuito BT',        icon: '⚡', action: "Router.ir('curto-circuito')" },
      ]
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: '💰',
      tipo: 'iframe',
      src: 'pages/financeiro.html',
      nav: [
        { label: 'Notas Fiscais de Faturamento',  icon: '📄', action: "Router.iframeMsg('financeiro','SHOW_TAB','nfs');Router._setNavAtivo(this)" },
        { label: 'Notas Fiscais de Fornecedores', icon: '📥', action: "Router.iframeMsg('financeiro','SHOW_TAB','nf-fornecedor');Router._setNavAtivo(this)" },
        { label: 'Contas a Receber',              icon: '💰', action: "Router.iframeMsg('financeiro','SHOW_TAB','contas');Router._setNavAtivo(this)" },
        { label: 'Contas a Pagar',                icon: '💳', action: "Router.iframeMsg('financeiro','SHOW_TAB','cp');Router._setNavAtivo(this)" },
        { label: 'Fontes Financeiras',            icon: '🏦', action: "Router.iframeMsg('financeiro','SHOW_TAB','bancos-contas');Router._setNavAtivo(this)" },
        { label: 'Fluxo de Caixa',                icon: '💵', action: "Router.iframeMsg('financeiro','SHOW_TAB','fluxo');Router._setNavAtivo(this)" },
        { label: 'DRE Gerencial',                 icon: '📊', action: "Router.iframeMsg('financeiro','SHOW_TAB','dre');Router._setNavAtivo(this)" },
        { label: 'Ferramentas',                   icon: '⚙️', action: "Router.iframeMsg('financeiro','SHOW_TAB','ferramentas');Router._setNavAtivo(this)" },
      ]
    },
    {
      id: 'gestao-a-vista',
      label: 'Indicadores',
      icon: '📊',
      tipo: 'iframe',
      src: 'pages/gestao-a-vista.html',
      nav: [
        { label: 'Indicadores',         icon: '📊', action: "Router.iframeMsg('gestao-a-vista','SCROLL_TO','kpis');Router._setNavAtivo(this)" },
        { label: 'Fechamentos por Mês', icon: '📅', action: "Router.iframeMsg('gestao-a-vista','SCROLL_TO','fechmes');Router._setNavAtivo(this)" },
      ]
    },
    {
      id: 'reuniao-radar',
      label: 'Gestão',
      icon: '🗓️',
      tipo: 'iframe',
      src: 'pages/reuniao-radar.html',
      nav: [
        { label: 'Reunião de Radar', icon: '🗓️', action: "Router.ir('reuniao-radar')" },
      ]
    },
    {
      id: 'recursos-produtividade',
      label: 'Produtividade',
      icon: '📈',
      tipo: 'iframe',
      src: 'pages/recursos-produtividade.html',
      nav: [
        { label: 'Visão Geral',     icon: '📊', action: "Router.ir('recursos-produtividade');Router.iframeMsg('recursos-produtividade','SHOW_SECTION','geral')" },
        { label: 'Por Colaborador', icon: '👤', action: "Router.ir('recursos-produtividade');Router.iframeMsg('recursos-produtividade','SHOW_SECTION','colaborador')" },
        { label: 'Por Cliente',     icon: '🏢', action: "Router.ir('recursos-produtividade');Router.iframeMsg('recursos-produtividade','SHOW_SECTION','cliente')" },
        { label: 'Por Proposta',    icon: '📁', action: "Router.ir('recursos-produtividade');Router.iframeMsg('recursos-produtividade','SHOW_SECTION','proposta')" },
        { label: 'Mapa de Alocação', icon: '🗺️', action: "Router.ir('recursos-produtividade');Router.iframeMsg('recursos-produtividade','SHOW_SECTION','mapa')" },
        { label: 'Configurações',   icon: '⚙️', action: "Router.ir('recursos-produtividade');Router.iframeMsg('recursos-produtividade','SHOW_SECTION','config')" },
      ]
    },
    {
      id: 'gestao-tempo',
      label: 'Tempo',
      icon: '⏱️',
      tipo: 'iframe',
      src: 'pages/gestao-tempo.html',
      nav: [
        { label: 'Registrar Atividades', icon: '📝', action: "Router.ir('gestao-tempo');Router.iframeMsg('gestao-tempo','SHOW_SECTION','registrar')" },
        { label: 'Dashboard',            icon: '📊', action: "Router.ir('gestao-tempo');Router.iframeMsg('gestao-tempo','SHOW_SECTION','dashboard')" },
        { label: 'Categorias',           icon: '🏷️', action: "Router.ir('gestao-tempo');Router.iframeMsg('gestao-tempo','SHOW_SECTION','categorias')" },
      ]
    },
    {
      id: 'prospeccao',
      label: 'Prospecção',
      icon: '🎯',
      badge: 'DONO',
      tipo: 'iframe',
      src: 'pages/prospeccao.html',
      nav: [
        { label: 'Alvos',            icon: '📋', action: "Router.ir('prospeccao');Router.iframeMsg('prospeccao','SHOW_SECTION','alvos')" },
        { label: 'Captura em massa', icon: '📥', action: "Router.ir('prospeccao');Router.iframeMsg('prospeccao','SHOW_SECTION','captura')" },
      ]
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: '👥',
      badge: 'DONO',
      tipo: 'iframe',
      src: 'pages/clientes.html',
      nav: [
        { label: 'Lista de clientes', icon: '📋', action: "Router.ir('clientes')" },
      ]
    },
    {
      id: 'dashboard-estrategico',
      label: 'Painel CEO',
      icon: '📊',
      badge: 'CEO',
      tipo: 'iframe',
      src: 'pages/dashboard-estrategico.html',
      nav: [
        { label: 'Visão Estratégica', icon: '📊', action: "Router.ir('dashboard-estrategico')" },
      ]
    },
    {
      id: 'avisos',
      label: 'Avisos',
      icon: '📌',
      tipo: 'inline',
      init: function () { go('avisos'); if (typeof rAvisos === 'function') rAvisos(); },
      nav: [
        { label: 'Quadro', icon: '📌', action: "go('avisos',this);avAbrirQuadro()" },
        { separator: true, label: 'Visualizacao' },
        { label: 'Resolvidos', icon: '✅', action: "go('avisos',this);avAbrirResolvidos()" },
      ]
    },
    // ── Relacionamento ESCONDIDO do menu (ordem explícita de Elivandro,
    // 18/07/2026 — fim do PR-D do módulo Clientes, que o substitui).
    // TODO o código segue vivo (rHistorico, hShowSec, telas e dados) —
    // para reativar, basta descomentar este bloco e bump do router.
    // {
    //   id: 'historico',
    //   label: 'Relacionamento',
    //   icon: '💬',
    //   tipo: 'inline',
    //   init: function () { go('historico'); if (typeof rHistorico === 'function') rHistorico(); },
    //   nav: [
    //     { label: 'Visão Geral',        icon: '📊', action: "go('historico',this);rHistorico()" },
    //     { separator: true, label: 'Ação Rápida' },
    //     { label: '↳ Atrasados',        icon: '🔴', action: "go('historico',this);hFiltroRapido('atrasados')" },
    //     { label: '↳ Alta Prioridade',  icon: '⚡', action: "go('historico',this);hFiltroRapido('alta')" },
    //     { label: '↳ Em Andamento',     icon: '🔄', action: "go('historico',this);hFiltroRapido('em_andamento')" },
    //     { label: '↳ Resolvidos',       icon: '✅', action: "go('historico',this);hFiltroRapido('resolvido')" },
    //     { separator: true, label: 'Registros' },
    //     { label: '↳ Todos',            icon: '📋', action: "go('historico',this);hFiltroRapido('todos')" },
    //     { separator: true, label: 'Cadastros' },
    //     { label: '↳ Empresas',         icon: '🏢', action: "go('historico',this);hShowSec('clientes');Router._setNavAtivo(this)" },
    //     { label: '↳ Contatos',         icon: '👤', action: "go('historico',this);hShowSec('contatos');Router._setNavAtivo(this)" },
    //     { separator: true, label: 'Ferramentas' },
    //     { label: '↳ Recuperação',      icon: '🔧', action: "go('historico',this);hShowSec('recuperacao');Router._setNavAtivo(this)" },
    //   ]
    // },
    {
      // Módulo OCULTO: painel do superadmin para aprovar cadastros de
      // novas empresas. Acessado pelo botão 🗳️ no header (só master).
      // Enforcement real: gate de master no iframe + RLS master-only +
      // Edge Function provisionar-empresa (checa is_master).
      id: 'admin-aprovacoes',
      label: 'Aprovações de Acesso',
      icon: '🗳️',
      oculto: true,
      tipo: 'iframe',
      src: 'pages/admin-aprovacoes.html',
      nav: [
        { label: 'Aprovações de Acesso', icon: '🗳️', action: "Router.ir('admin-aprovacoes')" },
      ]
    },
  ];

  var _moduloAtivo = null;

  // ── API pública ──────────────────────────────────────────
  window.Router = {

    // Inicializa o roteador: renderiza módulos no sidebar e ativa o inicial
    init: function (moduloInicial) {
      moduloInicial = moduloInicial || 'comercial';
      this._renderSidebarModulos();
      // Se o módulo salvo não está acessível, usar o primeiro permitido
      if (typeof window.podeAcessarModulo === 'function' && !window.podeAcessarModulo(moduloInicial)) {
        var _permitidos = typeof window.getModulosPermitidos === 'function' ? window.getModulosPermitidos() : [];
        moduloInicial = _permitidos.length > 0 ? _permitidos[0] : moduloInicial;
      }
      this.ir(moduloInicial);
    },

    // Navega para um módulo
    ir: function (id) {
      var mod = this._getMod(id);
      if (!mod) return console.warn('[Router] Módulo não encontrado:', id);

      // Guard via matriz centralizada (permissoes.js — fail-closed)
      if (typeof window.podeAcessarModulo === 'function' && !window.podeAcessarModulo(id)) {
        var _p = window.getPerfilUsuario ? window.getPerfilUsuario() : null;
        console.warn('[Router] Acesso bloqueado ao módulo "' + id + '" — perfil:', _p);
        if (typeof toast === 'function') {
          toast('Você não tem acesso ao módulo "' + mod.label + '" nesta empresa.', 'err');
        }
        return;
      }

      // Desativa módulo anterior
      if (_moduloAtivo && _moduloAtivo !== id) {
        this._desativarModulo(_moduloAtivo);
      }

      _moduloAtivo = id;

      // Atualiza destaque no sidebar de módulos
      document.querySelectorAll('.mod-btn').forEach(function (b) {
        b.classList.toggle('on', b.dataset.mod === id);
      });

      // Renderiza subitens do módulo
      this._renderNavMod(mod);

      // Mostra/esconde conteúdo
      if (mod.tipo === 'iframe') {
        this._ativarIframe(mod);
      } else {
        this._ativarInline(mod);
      }

      // Persiste última rota
      try { localStorage.setItem('tf_route', id); } catch(e) {}

      // Dispara evento para módulos que precisam saber
      window.dispatchEvent(new CustomEvent('router:change', { detail: { modulo: id } }));
    },

    // Envia mensagem para iframe de um módulo
    iframeMsg: function (moduloId, tipo, payload) {
      var frame = document.getElementById('frame-' + moduloId);
      if (frame && frame.contentWindow) {
        frame.contentWindow.postMessage({ type: tipo, payload: payload }, '*');
      }
    },

    // Retorna módulo ativo
    getAtivo: function () { return _moduloAtivo; },

    // Registra um novo módulo dinamicamente
    registrar: function (mod) {
      MODULOS.push(mod);
      this._renderSidebarModulos();
    },

    // Recalcula menus e redireciona se módulo ativo perdeu permissão (chamado ao trocar empresa)
    atualizarMenus: function () {
      this._renderSidebarModulos();
      if (_moduloAtivo && typeof window.podeAcessarModulo === 'function' && !window.podeAcessarModulo(_moduloAtivo)) {
        var permitidos = typeof window.getModulosPermitidos === 'function' ? window.getModulosPermitidos() : [];
        if (permitidos.length > 0) {
          this.ir(permitidos[0]);
        } else {
          // Nenhum módulo disponível para este perfil
          var el = document.getElementById('sidebar-modulos');
          if (el) el.innerHTML = '<div style="color:var(--text3);font-size:.78rem;padding:.8rem .6rem;line-height:1.4">Nenhum módulo disponível para seu perfil nesta empresa.</div>';
          var elNav = document.getElementById('sidebar-nav-mod');
          if (elNav) elNav.innerHTML = '';
        }
      }
    },

    // ── Internos ─────────────────────────────────────────

    _getMod: function (id) {
      return MODULOS.find(function (m) { return m.id === id; });
    },

    _renderSidebarModulos: function () {
      var el = document.getElementById('sidebar-modulos');
      if (!el) return;
      // Filtra módulos pelo perfil atual (permissoes.js); sem filtro se ainda não carregou
      var visiveis = MODULOS.filter(function (m) {
        if (m.oculto) return false; // módulos acessíveis só por link interno (não viram botão no menu)
        return typeof window.podeAcessarModulo === 'function'
          ? window.podeAcessarModulo(m.id)
          : true;
      });
      if (!visiveis.length) {
        el.innerHTML = '<div style="color:var(--text3);font-size:.78rem;padding:.8rem .6rem;line-height:1.4">Nenhum módulo disponível para seu perfil nesta empresa.</div>';
        return;
      }
      el.innerHTML = visiveis.map(function (m) {
        return '<button class="mod-btn nb" data-mod="' + m.id + '" onclick="Router.ir(\'' + m.id + '\')">' +
          '<span class="mod-icon">' + m.icon + '</span>' +
          '<span class="mod-label">' + m.label + '</span>' +
          (m.badge ? '<span class="mod-badge">' + m.badge + '</span>' : '') +
          '</button>';
      }).join('');
      // Reaplica destaque ao módulo ativo (se ainda visível)
      if (_moduloAtivo) {
        el.querySelectorAll('.mod-btn').forEach(function (b) {
          b.classList.toggle('on', b.dataset.mod === _moduloAtivo);
        });
      }
    },

    _renderNavMod: function (mod) {
      var el = document.getElementById('sidebar-nav-mod');
      if (!el) return;
      // Filtra subseções por permissão individual (permissoes_modulos).
      // Itens sem tag sub: sempre visíveis quando o módulo é acessível.
      var navVisivel = (mod.nav || []).filter(function (item) {
        if (!item.sub) return true;
        return typeof window.podeVerSubsecao === 'function'
          ? window.podeVerSubsecao(mod.id, item.sub)
          : true;
      });
      if (!navVisivel.length) {
        el.innerHTML = '<div class="nav-vazio">Nenhuma seção disponível</div>';
        return;
      }
      el.innerHTML = navVisivel.map(function (item) {
        if (item.separator) {
          return '<div style="font-size:.58rem;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;padding:.7rem .6rem .2rem;margin-top:.2rem;border-top:1px solid var(--border)">' + item.label + '</div>';
        }
        if (item.emBreve) {
          // Item ainda não disponível: alinhado como subitem (recuado dentro do pai),
          // não clicável, com badge "Em breve". Sem classe .nav-item para não receber
          // o destaque "on" nem o clique.
          return '<div style="width:100%;display:flex;align-items:center;gap:.45rem;padding:.38rem .6rem .38rem 1.5rem;border-radius:var(--r2);color:var(--text3);font-size:.76rem;opacity:.7;cursor:not-allowed;white-space:nowrap;overflow:hidden" title="Em breve">' +
              '<span>' + item.icon + '</span>' +
              '<span style="flex:1;text-align:left">' + item.label + '</span>' +
              '<span style="font-size:.55rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:.1rem .4rem;border-radius:10px;background:var(--emp-bg,rgba(240,165,0,.1));border:1px solid var(--emp-bdr,rgba(240,165,0,.28));color:var(--emp-cor,var(--accent));flex-shrink:0">Em breve</span>' +
            '</div>';
        }
        var isSubitem = item.label.indexOf('↳') === 0;
        var labelClean = isSubitem ? item.label.slice(2) : item.label;
        return '<button class="nb nav-item' + (isSubitem ? ' subitem' : '') + '" onclick="' + item.action + ';Router._setNavAtivo(this);setTimeout(fecharSidebar,100)">' +
            '<span>' + item.icon + '</span> ' + labelClean +
            '</button>';
      }).join('');
      var primeiro = el.querySelector('.nav-item');
      if (primeiro) primeiro.classList.add('on');
    },

    _setNavAtivo: function (el) {
      var container = document.getElementById('sidebar-nav-mod');
      if (container) container.querySelectorAll('.nav-item').forEach(function (b) { b.classList.remove('on'); });
      if (el) el.classList.add('on');
    },

    _ativarIframe: function (mod) {
      // Esconde área inline
      var inline = document.getElementById('area-inline');
      if (inline) inline.style.display = 'none';

      // Esconde todos os iframes
      document.querySelectorAll('.mod-frame').forEach(function (f) {
        f.classList.remove('visible');
      });

      // Mostra ou cria o iframe do módulo
      var frameId = 'frame-' + mod.id;
      var frame = document.getElementById(frameId);
      if (!frame) {
        frame = document.createElement('iframe');
        frame.id = frameId;
        frame.className = 'mod-frame';
        frame.src = mod.src;
        frame.title = mod.label;
        var area = document.getElementById('area-frames');
        if (area) area.appendChild(frame);

        // Enviar empresa quando iframe terminar de carregar
        frame.addEventListener('load', function() {
          try {
            var emp = window.getEmpresaAtiva ? window.getEmpresaAtiva() : null;
            if (emp && frame.contentWindow) {
              frame.contentWindow.postMessage({
                type:               'SET_EMPRESA',
                empresaId:          emp.id,
                empresaNome:        emp.nome,
                empresaNomeCurto:   emp.nome_curto,
                empresaCnpj:        emp.cnpj            || null,
                empresaRazaoSocial: emp.razao_social     || null,
                empresaEmailFin:    emp.email_financeiro || null
              }, '*');
            }
          } catch(e) {}
        });
      }
      frame.classList.add('visible');
    },

    _ativarInline: function (mod) {
      // Esconde todos os iframes
      document.querySelectorAll('.mod-frame').forEach(function (f) {
        f.classList.remove('visible');
      });

      // Mostra área inline
      var inline = document.getElementById('area-inline');
      if (inline) inline.style.display = '';

      // Chama init do módulo se existir
      if (typeof mod.init === 'function') {
        try { mod.init(); } catch(e) { console.error('[Router] Erro ao iniciar módulo:', mod.id, e); }
      }
    },

    _desativarModulo: function (id) {
      // Hook para módulos fazerem cleanup
      window.dispatchEvent(new CustomEvent('router:leave', { detail: { modulo: id } }));
    }
  };

  // ── Listener de mensagens dos iframes ───────────────────
  window.addEventListener('message', function (e) {
    if (!e.data || !e.data.type) return;
    if (e.data.type === 'ROUTER_IR') {
      var _destino = e.data.modulo;
      // Deep-link entre módulos: além de navegar, entrega uma mensagem
      // opcional ao iframe destino (ex.: "abra o cálculo X"). Se o iframe
      // acabou de ser criado por Router.ir (nunca visitado antes), ele ainda
      // está carregando — entrega a mensagem no evento 'load'; se já existia
      // e está pronto, entrega imediatamente.
      var _msg = e.data.msg || null;
      var _jaExistia = !!document.getElementById('frame-' + _destino);
      Router.ir(_destino);
      // Só entrega se a navegação foi de fato permitida (Router.ir respeita
      // o gate de acesso — se bloqueou, o módulo ativo não mudou).
      if (_msg && Router.getAtivo() === _destino) {
        if (_jaExistia) {
          Router.iframeMsg(_destino, _msg.type, _msg.payload);
        } else {
          var _f = document.getElementById('frame-' + _destino);
          if (_f) {
            _f.addEventListener('load', function _once() {
              _f.removeEventListener('load', _once);
              Router.iframeMsg(_destino, _msg.type, _msg.payload);
            });
          }
        }
      }
    }
    if (e.data.type === 'SET_TEMA') {
      document.body.classList.toggle('light', e.data.tema === 'light');
    }
    // iframe pede empresa ativa — responder imediatamente
    if (e.data.type === 'RH_PEDIR_EMPRESA') {
      try {
        var emp = window.getEmpresaAtiva ? window.getEmpresaAtiva() : null;
        if (emp && e.source) {
          e.source.postMessage({
            type: 'SET_EMPRESA',
            empresaId: emp.id,
            empresaNome: emp.nome,
            empresaNomeCurto: emp.nome_curto
          }, '*');
        }
      } catch(err) {}
    }
  });

  console.log('%c[Router] carregado — ' + MODULOS.length + ' módulos registrados', 'color:#f0a500;font-weight:700');

})();

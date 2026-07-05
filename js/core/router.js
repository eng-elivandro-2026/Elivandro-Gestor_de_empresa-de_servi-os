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
        { label: 'Missão, Visão e Valores', icon: '🏢', action: "Router.ir('dashboard-minha-empresa')" },
        { label: 'PVE',             icon: '📈', emBreve: true },
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
      label: 'Planejamento Estratégico',
      icon: '🧭',
      badge: 'DONO',
      tipo: 'iframe',
      src: 'pages/planejamento-estrategico.html',
      nav: [
        { label: 'Planos Estratégicos',       icon: '🗂️', action: "Router.iframeMsg('planejamento-estrategico','SHOW_SECTION','planos');Router._setNavAtivo(this)" },
        { label: 'Criar Plano',               icon: '➕', action: "Router.iframeMsg('planejamento-estrategico','SHOW_SECTION','criar');Router._setNavAtivo(this)" },
        { label: 'Biblioteca de Ferramentas', icon: '🧰', action: "Router.iframeMsg('planejamento-estrategico','SHOW_SECTION','ferramentas');Router._setNavAtivo(this)" },
      ]
    },
    {
      id: 'reuniao-radar',
      label: 'Reunião de Radar',
      icon: '🗓️',
      oculto: true,
      tipo: 'iframe',
      src: 'pages/reuniao-radar.html',
      nav: [
        { label: 'Reunião de Radar', icon: '🗓️', action: "Router.ir('reuniao-radar')" },
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
        { label: '↳ Propostas',        icon: '📄', action: "go('dashboard',this);irParaPainel('propostasCard','togPropostas')" },
        { label: '↳ Metas',            icon: '🎯', action: "irParaPainel('metaPanel','togMeta')" },
        { label: '↳ Visão Geral',      icon: '📈', action: "irParaPainel('visaoGeralCard','togVisaoGeral')" },
        { label: '↳ Análise IA',       icon: '🤖', action: "irParaPainel('analisePanel','togAnalise')" },
        { label: '↳ Ranking',          icon: '🏢', action: "irParaPainel('rankingCard','togRanking')" },
        { label: '↳ Fechamentos',      icon: '📅', action: "irParaPainel('fechMesCard','togFechMes')" },
        { label: '↳ Linha do Tempo',   icon: '📅', action: "irParaPainel('execTimelineCard','togExecTimeline')" },
        { separator: true, label: 'Ferramentas' },
        { label: 'Templates',          icon: '📋', action: "go('templates',this);beLoadDB();stplRenderLista()" },
        { label: 'Banco de Escopos',   icon: '🗂️', action: "go('escopos',this);setTimeout(beInit,80)" },
        { label: 'Análise',            icon: '📈', action: "go('analise',this);rAnalise()" },
        { label: 'Pipeline',           icon: '🔀', action: "go('registro',this);rRegistro()" },
        { label: 'Versões',            icon: '📋', action: "go('changelog',this)" },
      ]
    },
    {
      id: 'gestao-a-vista',
      label: 'MPE',
      icon: '📊',
      tipo: 'iframe',
      src: 'pages/gestao-a-vista.html',
      nav: [
        { label: 'Indicadores',         icon: '📊', action: "Router.iframeMsg('gestao-a-vista','SCROLL_TO','kpis');Router._setNavAtivo(this)" },
        { label: 'Fechamentos por Mês', icon: '📅', action: "Router.iframeMsg('gestao-a-vista','SCROLL_TO','fechmes');Router._setNavAtivo(this)" },
      ]
    },
    {
      id: 'operacional',
      label: 'Operacional',
      icon: 'OP',
      tipo: 'inline',
      init: function () { go('operacional'); if (typeof rOperacional === 'function') rOperacional(); },
      nav: [
        { label: 'Obras', icon: 'OP', action: "go('operacional',this);rOperacional()" },
        { separator: true, label: 'Status' },
        { label: 'Aguardando Recebimento', icon: 'AR', action: "go('operacional',this);opSetFiltroStatus('aguardando_recebimento')" },
        { label: 'Planejamento', icon: 'PL', action: "go('operacional',this);opSetFiltroStatus('planejamento_em_andamento')" },
        { label: 'Em Execucao', icon: 'EX', action: "go('operacional',this);opSetFiltroStatus('em_execucao')" },
        { label: 'Entregues', icon: 'OK', action: "go('operacional',this);opSetFiltroStatus('entregue_ao_cliente')" },
      ]
    },
    {
      id: 'avisos',
      label: 'Quadro de Avisos',
      icon: '📌',
      tipo: 'inline',
      init: function () { go('avisos'); if (typeof rAvisos === 'function') rAvisos(); },
      nav: [
        { label: 'Quadro', icon: '📌', action: "go('avisos',this);avAbrirQuadro()" },
        { separator: true, label: 'Visualizacao' },
        { label: 'Resolvidos', icon: '✅', action: "go('avisos',this);avAbrirResolvidos()" },
      ]
    },
    {
      id: 'historico',
      label: 'Relacionamento',
      icon: '💬',
      tipo: 'inline',
      init: function () { go('historico'); if (typeof rHistorico === 'function') rHistorico(); },
      nav: [
        { label: 'Visão Geral',        icon: '📊', action: "go('historico',this);rHistorico()" },
        { separator: true, label: 'Ação Rápida' },
        { label: '↳ Atrasados',        icon: '🔴', action: "go('historico',this);hFiltroRapido('atrasados')" },
        { label: '↳ Alta Prioridade',  icon: '⚡', action: "go('historico',this);hFiltroRapido('alta')" },
        { label: '↳ Em Andamento',     icon: '🔄', action: "go('historico',this);hFiltroRapido('em_andamento')" },
        { label: '↳ Resolvidos',       icon: '✅', action: "go('historico',this);hFiltroRapido('resolvido')" },
        { separator: true, label: 'Registros' },
        { label: '↳ Todos',            icon: '📋', action: "go('historico',this);hFiltroRapido('todos')" },
        { separator: true, label: 'Cadastros' },
        { label: '↳ Empresas',         icon: '🏢', action: "go('historico',this);hShowSec('clientes');Router._setNavAtivo(this)" },
        { label: '↳ Contatos',         icon: '👤', action: "go('historico',this);hShowSec('contatos');Router._setNavAtivo(this)" },
        { separator: true, label: 'Ferramentas' },
        { label: '↳ Recuperação',      icon: '🔧', action: "go('historico',this);hShowSec('recuperacao');Router._setNavAtivo(this)" },
      ]
    },
    {
      id: 'gestao',
      label: 'Gestão CEO',
      icon: '🎯',
      tipo: 'inline',
      init: function () { go('gestao'); if (typeof rGestaoCeo === 'function') rGestaoCeo(); },
      nav: [
        { separator: true, label: 'Gestão Executiva' },
        { label: '↳ Motor de Decisão', icon: '🧠', action: "go('dashboard',this);irParaPainel('motorDecisaoCard','togMotorDecisao')" },
        { label: '↳ Visão Executiva',  icon: '🏢', action: "go('dashboard',this);irParaPainel('ceoDashCard','togCeoDash')" },
        { label: '↳ KPIs Ciclos',      icon: '📊', action: "go('dashboard',this);irParaPainel('ciclosCard','togCiclosDash')" },
        { label: '↳ Por Categoria',    icon: '📂', action: "go('dashboard',this);irParaPainel('catAnaliseCard','togCatAnalise')" },
        { separator: true, label: 'Planejamento' },
        { label: '↳ Hoje',       icon: '📅', action: "gestaoNav('dia')" },
        { label: '↳ Semana',    icon: '📆', action: "gestaoNav('semana')" },
        { label: '↳ Mês',       icon: '📊', action: "gestaoNav('mes')" },
        { label: '↳ Trimestre', icon: '🎯', action: "gestaoNav('trimestre')" },
        { label: '↳ Calendário',icon: '🗓️', action: "gestaoNav('calendario')" },
        { label: '↳ Guia de Fluxo', icon: '❓', action: "abrirModal('m-guia')" },
      ]
    },
    {
      id: 'rh',
      label: 'RH / Equipes',
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
      id: 'dashboard-estrategico',
      label: 'Painel Estratégico',
      icon: '📊',
      badge: 'CEO',
      tipo: 'iframe',
      src: 'pages/dashboard-estrategico.html',
      nav: [
        { label: 'Visão Estratégica', icon: '📊', action: "Router.ir('dashboard-estrategico')" },
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
      if (!mod.nav || !mod.nav.length) {
        el.innerHTML = '<div class="nav-vazio">Nenhuma seção disponível</div>';
        return;
      }
      el.innerHTML = mod.nav.map(function (item) {
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
      Router.ir(e.data.modulo);
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

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
      id: 'comercial',
      label: 'Comercial',
      icon: '📊',
      tipo: 'inline',
      nav: [
        { label: 'Dashboard',          icon: '📊', action: "go('dashboard',this);document.getElementById('area-inline').scrollTop=0" },
        { separator: true, label: 'Gestão Executiva' },
        { label: '↳ Motor de Decisão', icon: '🧠', action: "irParaPainel('motorDecisaoCard','togMotorDecisao')" },
        { label: '↳ Visão Executiva',  icon: '🏢', action: "irParaPainel('ceoDashCard','togCeoDash')" },
        { label: '↳ KPIs Ciclos',      icon: '📊', action: "irParaPainel('ciclosCard','togCiclosDash')" },
        { label: '↳ Por Categoria',    icon: '📂', action: "irParaPainel('catAnaliseCard','togCatAnalise')" },
        { separator: true, label: 'Comercial' },
        { label: '↳ Metas',            icon: '🎯', action: "irParaPainel('metaPanel','togMeta')" },
        { label: '↳ Visão Geral',      icon: '📈', action: "irParaPainel('visaoGeralCard','togVisaoGeral')" },
        { label: '↳ Análise IA',       icon: '🤖', action: "irParaPainel('analisePanel','togAnalise')" },
        { label: '↳ Ranking',          icon: '🏢', action: "irParaPainel('rankingCard','togRanking')" },
        { label: '↳ Fechamentos',      icon: '📅', action: "irParaPainel('fechMesCard','togFechMes')" },
        { label: '↳ Linha do Tempo',   icon: '📅', action: "irParaPainel('execTimelineCard','togExecTimeline')" },
        { separator: true, label: 'Ferramentas' },
        { label: 'Templates',          icon: '📋', action: "go('templates',this);rTplMgr()" },
        { label: 'Banco de Escopos',   icon: '🗂️', action: "go('escopos',this);setTimeout(beInit,80)" },
        { label: 'Análise',            icon: '📈', action: "go('analise',this);rAnalise()" },
        { label: 'Pipeline',           icon: '🔀', action: "go('registro',this);rRegistro()" },
        { label: 'Versões',            icon: '📋', action: "go('changelog',this)" },
      ]
    },
    {
      id: 'gestao',
      label: 'Gestão CEO',
      icon: '🎯',
      tipo: 'iframe',
      src: 'gestao.html',
      nav: [
        { label: 'Hoje',        icon: '📅', action: "gestaoMsg('dia')" },
        { label: 'Semana',      icon: '📆', action: "gestaoMsg('semana')" },
        { label: 'Mês',         icon: '📊', action: "gestaoMsg('mes')" },
        { label: 'Trimestre',   icon: '🎯', action: "gestaoMsg('trimestre')" },
        { label: 'Calendário',  icon: '🗓️', action: "gestaoMsg('calendario')" },
      ]
    },
    {
      id: 'rh',
      label: 'RH / Equipes',
      icon: '👷',
      tipo: 'iframe',
      src: 'pages/rh.html',
      nav: [
        { label: 'Colaboradores', icon: '👷', action: "Router.iframeMsg('rh','SHOW_SEC','colaboradores')" },
        { label: 'Apontamentos',  icon: '⏱️', action: "Router.iframeMsg('rh','SHOW_SEC','apontamentos')" },
        { label: 'Boletins',      icon: '📋', action: "Router.iframeMsg('rh','SHOW_SEC','boletins')" },
      ]
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: '💰',
      tipo: 'iframe',
      src: 'pages/financeiro.html',
      badge: 'Em breve',
      nav: []
    },
    {
      id: 'historico',
      label: 'Relacionamento',
      icon: '💬',
      tipo: 'inline',
      init: function () { go('historico'); if (typeof rHistorico === 'function') rHistorico(); },
      nav: [
        { label: 'Todos os registros', icon: '📋', action: "go('historico',this);rHistorico()" },
        { separator: true, label: 'Filtrar por status' },
        { label: '↳ Em andamento',     icon: '🔄', action: "go('historico',this);document.getElementById('hFiltroStatus').value='em_andamento';hFiltrar()" },
        { label: '↳ Resolvidos',        icon: '✅', action: "go('historico',this);document.getElementById('hFiltroStatus').value='resolvido';hFiltrar()" },
      ]
    }
  ];

  var _moduloAtivo = null;

  // ── API pública ──────────────────────────────────────────
  window.Router = {

    // Inicializa o roteador: renderiza módulos no sidebar e ativa o inicial
    init: function (moduloInicial) {
      moduloInicial = moduloInicial || 'comercial';
      this._renderSidebarModulos();
      this.ir(moduloInicial);
    },

    // Navega para um módulo
    ir: function (id) {
      var mod = this._getMod(id);
      if (!mod) return console.warn('[Router] Módulo não encontrado:', id);

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

    // ── Internos ─────────────────────────────────────────

    _getMod: function (id) {
      return MODULOS.find(function (m) { return m.id === id; });
    },

    _renderSidebarModulos: function () {
      var el = document.getElementById('sidebar-modulos');
      if (!el) return;
      el.innerHTML = MODULOS.map(function (m) {
        return '<button class="mod-btn nb" data-mod="' + m.id + '" onclick="Router.ir(\'' + m.id + '\')">' +
          '<span class="mod-icon">' + m.icon + '</span>' +
          '<span class="mod-label">' + m.label + '</span>' +
          (m.badge ? '<span class="mod-badge">' + m.badge + '</span>' : '') +
          '</button>';
      }).join('');
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
        var isSubitem = item.label.indexOf('↳') === 0;
        var labelClean = isSubitem ? item.label.slice(2) : item.label;
        return '<button class="nb nav-item' + (isSubitem ? ' subitem' : '') + '" onclick="' + item.action + ';Router._setNavAtivo(this)">' +
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
                type: 'SET_EMPRESA',
                empresaId: emp.id,
                empresaNome: emp.nome,
                empresaNomeCurto: emp.nome_curto
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

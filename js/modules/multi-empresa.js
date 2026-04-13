// ============================================================
// multi-empresa.js — Controle de acesso multi-empresa
// Gerencia qual empresa está ativa e o perfil do usuário
// ============================================================

(function () {

  // Estado global da empresa ativa
  window._empresaAtiva = null;
  window._perfilUsuario = null;
  window._empresasUsuario = [];

  // ── Carregar empresas do usuário logado ──────────────────
  window.carregarEmpresasUsuario = async function () {
    if (!window.sbClient) return [];
    try {
      var { data: authData } = await window.sbClient.auth.getUser();
      if (!authData || !authData.user) return [];

      var authId = authData.user.id;

      // Buscar usuário pelo auth_id
      var { data: usuario } = await window.sbClient
        .from('usuarios')
        .select('id, nome, perfil')
        .eq('auth_id', authId)
        .maybeSingle();

      if (!usuario) {
        console.warn('[multi-empresa] usuário não encontrado para auth_id:', authId);
        return [];
      }
      window._perfilUsuario = usuario.perfil;

      // Buscar empresas vinculadas pelo usuario_id (não depende de RLS/auth.uid)
      var { data: vinculos, error: errV } = await window.sbClient
        .from('usuario_empresas')
        .select('empresa_id')
        .eq('usuario_id', usuario.id)
        .eq('ativo', true);

      if (errV || !vinculos || !vinculos.length) {
        console.warn('[multi-empresa] sem vínculos de empresa');
        return [];
      }

      var ids = vinculos.map(function(v){ return v.empresa_id; });

      // Buscar dados das empresas pelos IDs
      var { data: empresas } = await window.sbClient
        .from('empresas')
        .select('id, nome, nome_curto, cnpj, regime_fiscal, logo_url')
        .in('id', ids)
        .eq('ativo', true);

      window._empresasUsuario = empresas || [];
      console.log('%c[multi-empresa] ' + (empresas||[]).length + ' empresa(s) carregada(s) para ' + usuario.nome, 'color:#f0a500');
      return empresas || [];

    } catch (e) {
      console.warn('[multi-empresa] erro ao carregar empresas:', e);
      return [];
    }
  };

  // ── Definir empresa ativa ────────────────────────────────
  var _trocandoEmpresa = false;
  window.setEmpresaAtiva = function (empresa) {
    if (_trocandoEmpresa) return;
    if (window._empresaAtiva && window._empresaAtiva.id === empresa.id) return;
    _trocandoEmpresa = true;
    window._empresaAtiva = empresa;

    // Salvar no localStorage para restaurar na próxima visita
    try {
      localStorage.setItem('tf_empresa_ativa', JSON.stringify({
        id: empresa.id,
        nome: empresa.nome,
        nome_curto: empresa.nome_curto,
        cnpj: empresa.cnpj
      }));
    } catch (e) {}

    // Atualizar visual do header
    atualizarHeaderEmpresa(empresa);

    // Recarregar propostas da empresa ativa
    recarregarDadosEmpresa(empresa);

    console.log('%c[Empresa] ' + empresa.nome_curto + ' ativa', 'color:#f0a500;font-weight:700');
    setTimeout(function(){ _trocandoEmpresa = false; }, 500);

    // Notificar todos os iframes ativos sobre a troca de empresa
    document.querySelectorAll('.mod-frame').forEach(function(frame) {
      try {
        frame.contentWindow.postMessage({
          type: 'SET_EMPRESA',
          empresaId: empresa.id,
          empresaNome: empresa.nome,
          empresaNomeCurto: empresa.nome_curto
        }, '*');
      } catch(e) {}
    });
  };

  // ── Atualizar header com empresa ativa ───────────────────
  function atualizarHeaderEmpresa(empresa) {
    var logoTxt = document.getElementById('hdr-logo-txt');
    var logoSub = document.getElementById('hdr-logo-sub');
    var logoMk  = document.getElementById('hdr-logo-mk');

    if (logoTxt) logoTxt.textContent = empresa.nome_curto;
    if (logoSub) logoSub.textContent = empresa.nome.replace(empresa.nome_curto, '').trim();

    // Cor diferente por empresa
    if (logoMk) {
      if (empresa.nome_curto === 'Tecfusion') {
        logoMk.style.background = '#f0a500'; // amarelo
        logoMk.textContent = 'TC';
      } else if (empresa.nome_curto === 'Fortex') {
        logoMk.style.background = '#F05A1A'; // laranja
        logoMk.textContent = 'FX';
      } else {
        logoMk.textContent = empresa.nome_curto.slice(0, 2).toUpperCase();
      }
    }

    // Atualizar seletor
    var sel = document.getElementById('seletor-empresa');
    if (sel) sel.value = empresa.id;
  }

  // ── Recarregar dados ao trocar empresa ───────────────────
  var _recarregando = false;
  async function recarregarDadosEmpresa(empresa) {
    if (_recarregando) return;
    _recarregando = true;
    try {
      if (!window.sbClient) return;

      // Buscar propostas diretamente filtradas por empresa_id no Supabase
      var res = await window.sbClient
        .from('propostas')
        .select('dados_json, app_id')
        .eq('empresa_id', empresa.id)
        .order('updated_at', { ascending: false });

      if (res.error) {
        console.warn('[multi-empresa] erro ao carregar propostas:', res.error.message);
        return;
      }

      var propsFiltradas = (res.data || []).map(function (r) {
        var p = r.dados_json || {};
        if (!p.id && r.app_id) p.id = r.app_id;
        return p;
      });

      // Atualizar variável global props
      if (typeof props !== 'undefined') props = propsFiltradas;
      try { localStorage.setItem('tf_props', JSON.stringify(propsFiltradas)); } catch (e) {}

      console.log('%c[Empresa] ' + empresa.nome_curto + ' — ' + propsFiltradas.length + ' proposta(s)', 'color:#f0a500');

      // Re-renderizar
      try { if (typeof rDash === 'function') rDash(); } catch (e) {}
      try { if (typeof rProps === 'function') rProps(); } catch (e) {}

    } finally {
      _recarregando = false;
    }
  }

  // ── Renderizar seletor de empresa no header ──────────────
  window.renderizarSeletorEmpresa = function (empresas) {
    var container = document.getElementById('seletor-empresa-container');
    if (!container) return;

    // Dono vê seletor — gestor e colaborador não veem
    if (!empresas || empresas.length <= 1) {
      // Só uma empresa — mostra nome fixo sem seletor
      if (empresas && empresas.length === 1) {
        setEmpresaAtiva(empresas[0]);
      }
      container.style.display = 'none';
      return;
    }

    // Duas ou mais empresas — mostra seletor
    var html = '<select id="seletor-empresa" onchange="trocarEmpresa(this.value)" '
      + 'style="padding:.28rem .6rem;background:var(--bg3);border:1px solid var(--border);'
      + 'border-radius:var(--r2);color:var(--text);font-size:.72rem;font-family:inherit;cursor:pointer;'
      + 'max-width:160px;">';

    empresas.forEach(function (e) {
      html += '<option value="' + e.id + '">' + e.nome_curto + '</option>';
    });

    html += '</select>';
    container.innerHTML = html;
    container.style.display = 'flex';

    // Restaurar empresa ativa do localStorage — sem disparar onChange
    try {
      var saved = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
      var inicial = saved
        ? (empresas.find(function (e) { return e.id === saved.id; }) || empresas[0])
        : empresas[0];

      // Setar valor do select sem disparar evento
      var sel = document.getElementById('seletor-empresa');
      if (sel) sel.value = inicial.id;

      // Ativar empresa
      setEmpresaAtiva(inicial);
    } catch (e) {
      setEmpresaAtiva(empresas[0]);
    }
  };

  // ── Trocar empresa ───────────────────────────────────────
  window.trocarEmpresa = function (empresaId) {
    var empresa = window._empresasUsuario.find(function (e) {
      return e.id === empresaId;
    });
    if (!empresa) return;
    setEmpresaAtiva(empresa);
  };

  // ── Getter da empresa ativa ──────────────────────────────
  window.getEmpresaAtiva = function () {
    return window._empresaAtiva;
  };

  window.getEmpresaAtivaId = function () {
    return window._empresaAtiva ? window._empresaAtiva.id : null;
  };

  window.getPerfilUsuario = function () {
    return window._perfilUsuario;
  };

  console.log('%c[multi-empresa] carregado', 'color:#f0a500;font-weight:700');

})();

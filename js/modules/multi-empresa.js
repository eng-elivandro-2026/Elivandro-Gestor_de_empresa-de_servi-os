// ============================================================
// multi-empresa.js — Controle de acesso multi-empresa
// Gerencia qual empresa está ativa e o perfil do usuário
// ============================================================

(function () {

  // Estado global da empresa ativa
  window._empresaAtiva    = null;
  window._perfilUsuario   = null;  // perfil na empresa ativa (perfil_empresa com fallback)
  window._perfilGlobal    = null;  // usuarios.perfil — fallback e enforcement do RLS
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
      // Salvar perfil global como fallback e para RLS
      window._perfilGlobal  = usuario.perfil;
      window._perfilUsuario = usuario.perfil; // será sobrescrito em setEmpresaAtiva()

      // Buscar empresas vinculadas com perfil_empresa (migration 020)
      var { data: vinculos, error: errV } = await window.sbClient
        .from('usuario_empresas')
        .select('empresa_id, perfil_empresa, permissoes_json')
        .eq('usuario_id', usuario.id)
        .eq('ativo', true);

      if (errV || !vinculos || !vinculos.length) {
        console.warn('[multi-empresa] sem vínculos de empresa');
        return [];
      }

      // Mapear perfil_empresa por empresa_id
      var vinculoMap = {};
      vinculos.forEach(function(v) {
        vinculoMap[v.empresa_id] = {
          perfil_empresa: v.perfil_empresa || null,
          permissoes_json: v.permissoes_json || null
        };
      });

      var ids = vinculos.map(function(v){ return v.empresa_id; });

      // Buscar dados das empresas pelos IDs
      var { data: empresas } = await window.sbClient
        .from('empresas')
        .select('id, nome, nome_curto, cnpj, regime_fiscal, logo_url, razao_social, inscricao_estadual, inscricao_municipal, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_municipio, endereco_uf, endereco_cep, telefone, email, email_financeiro, logo_storage_path, config_json')
        .in('id', ids)
        .eq('ativo', true);

      // Mesclar perfil_empresa em cada objeto de empresa
      window._empresasUsuario = (empresas || []).map(function(emp) {
        var vinculo = vinculoMap[emp.id] || {};
        return Object.assign({}, emp, {
          perfil_empresa: vinculo.perfil_empresa || usuario.perfil, // fallback para global
          permissoes_json: vinculo.permissoes_json || null
        });
      });
      console.log('%c[multi-empresa] ' + (empresas||[]).length + ' empresa(s) carregada(s) para ' + usuario.nome, 'color:#f0a500');
      return window._empresasUsuario;

    } catch (e) {
      console.warn('[multi-empresa] erro ao carregar empresas:', e);
      return [];
    }
  };

  // ── Overlay global: troca de empresa ────────────────────────────────────
  // Token global evita que carregamento antigo esconda overlay de troca mais nova.
  window._empresaSwitchToken = 0;

  window.showEmpresaSwitchLoading = function (empresa) {
    var token = ++window._empresaSwitchToken;
    var overlay = document.getElementById('empresaSwitchOverlay');
    var nameEl  = document.getElementById('empresaSwitchName');
    if (overlay) overlay.classList.add('visible');
    if (nameEl)  nameEl.textContent = (empresa && (empresa.nome_curto || empresa.nome)) || '';
    // Fallback: garante que o overlay some mesmo se nenhum módulo sinalizar término (máx. 4s)
    setTimeout(function () { window.hideEmpresaSwitchLoading(token); }, 4000);
    return token;
  };

  window.hideEmpresaSwitchLoading = function (token) {
    // Ignora se já há uma troca mais recente em andamento
    if (token !== undefined && token !== window._empresaSwitchToken) return;
    var overlay = document.getElementById('empresaSwitchOverlay');
    if (overlay) overlay.classList.remove('visible');
  };

  // ── Tema visual por empresa ─────────────────────────────────────────────────
  window.aplicarTemaEmpresa = function (empresa) {
    document.body.classList.remove('empresa-tema-tecfusion', 'empresa-tema-fortex');
    var nome = String((empresa && (empresa.nome_curto || empresa.nome)) || '').toLowerCase();
    if (nome.includes('tecfusion')) {
      document.body.classList.add('empresa-tema-tecfusion');
    } else if (nome.includes('fortex')) {
      document.body.classList.add('empresa-tema-fortex');
    }
    // Atualizar tooltip da faixa de ambiente
    var faixa = document.getElementById('empresa-faixa');
    if (faixa) faixa.setAttribute('title', empresa ? (empresa.nome_curto || empresa.nome || '') : '');
  };

  // ── Definir empresa ativa ────────────────────────────────
  var _trocandoEmpresa = false;
  window.setEmpresaAtiva = function (empresa) {
    if (_trocandoEmpresa) return;
    if (window._empresaAtiva && window._empresaAtiva.id === empresa.id) return;
    _trocandoEmpresa = true;
    window._empresaAtiva = empresa;

    // Atualizar perfil operacional para a empresa ativa
    // perfil_empresa foi mesclado no objeto em carregarEmpresasUsuario()
    window._perfilUsuario = empresa.perfil_empresa || window._perfilGlobal || null;

    // Atualizar visibilidade dos botões de administração e menus
    if (typeof window._atualizarBotoesAdmin === 'function') window._atualizarBotoesAdmin();
    // Recalcular menus conforme nova empresa/perfil (G4A)
    if (typeof window.Router !== 'undefined' && typeof window.Router.atualizarMenus === 'function') {
      window.Router.atualizarMenus();
    }

    // Aplicar tema visual imediatamente (antes do overlay)
    if (typeof window.aplicarTemaEmpresa === 'function') window.aplicarTemaEmpresa(empresa);

    // Mostrar overlay global imediatamente (antes de qualquer carga async)
    var _switchToken = typeof window.showEmpresaSwitchLoading === 'function'
      ? window.showEmpresaSwitchLoading(empresa) : 0;

    // Salvar no localStorage para restaurar na próxima visita
    try {
      localStorage.setItem('tf_empresa_ativa', JSON.stringify({
        id:                  empresa.id,
        nome:                empresa.nome,
        nome_curto:          empresa.nome_curto,
        cnpj:                empresa.cnpj,
        razao_social:        empresa.razao_social        || null,
        inscricao_estadual:  empresa.inscricao_estadual  || null,
        email_financeiro:    empresa.email_financeiro     || null,
        regime_fiscal:       empresa.regime_fiscal        || null
      }));
    } catch (e) {}

    // Atualizar visual do header
    atualizarHeaderEmpresa(empresa);

    // Recarregar propostas da empresa ativa (passa token para esconder overlay ao concluir)
    recarregarDadosEmpresa(empresa, _switchToken);

    console.log('%c[Empresa] ' + empresa.nome_curto + ' ativa', 'color:#f0a500;font-weight:700');
    setTimeout(function(){ _trocandoEmpresa = false; }, 500);

    // Notificar todos os iframes ativos sobre a troca de empresa
    document.querySelectorAll('.mod-frame').forEach(function(frame) {
      try {
        frame.contentWindow.postMessage({
          type:              'SET_EMPRESA',
          empresaId:         empresa.id,
          empresaNome:       empresa.nome,
          empresaNomeCurto:  empresa.nome_curto,
          empresaCnpj:       empresa.cnpj            || null,
          empresaRazaoSocial:empresa.razao_social     || null,
          empresaEmailFin:   empresa.email_financeiro || null
        }, '*');
      } catch(e) {}
    });

    // Notificar módulos no mesmo contexto (Relacionamento, etc.)
    // Disparado APÓS window._empresaAtiva já estar atualizado para que
    // os listeners leiam a empresa correta ao limpar/recarregar.
    try {
      window.dispatchEvent(new CustomEvent('empresa:changed', {
        detail: { empresa: empresa }
      }));
    } catch(e) {}
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
  // Token de race condition: descarta respostas de empresas antigas
  var _comercialLoadToken = 0;
  async function recarregarDadosEmpresa(empresa, switchToken) {
    var empresaId = empresa.id;
    var token = ++_comercialLoadToken;

    try {
      if (!window.sbClient) {
        // Sem cliente ainda — esconde overlay via fallback, não travar
        if (token === _comercialLoadToken && typeof window.hideEmpresaSwitchLoading === 'function') {
          window.hideEmpresaSwitchLoading(switchToken);
        }
        return;
      }

      // Buscar propostas diretamente filtradas por empresa_id no Supabase
      var res = await window.sbClient
        .from('propostas')
        .select('dados_json, app_id')
        .eq('empresa_id', empresaId)
        .order('updated_at', { ascending: false });

      // Race condition: descarta se empresa trocou enquanto aguardávamos
      if (token !== _comercialLoadToken) return;

      if (res.error) {
        console.warn('[multi-empresa] erro ao carregar propostas:', res.error.message);
        if (typeof window.hideEmpresaSwitchLoading === 'function') window.hideEmpresaSwitchLoading(switchToken);
        return;
      }

      var propsFiltradas = (res.data || []).map(function (r) {
        var p = r.dados_json || {};
        if (!p.id && r.app_id) p.id = r.app_id;
        return p;
      });

      if (token !== _comercialLoadToken) return;

      // Atualizar variável global props
      if (typeof props !== 'undefined') props = propsFiltradas;
      try { localStorage.setItem('tf_props', JSON.stringify(propsFiltradas)); } catch (e) {}

      console.log('%c[Empresa] ' + empresa.nome_curto + ' — ' + propsFiltradas.length + ' proposta(s)', 'color:#f0a500');

      // Re-renderizar
      try { if (typeof rDash === 'function') rDash(); } catch (e) {}
      try { if (typeof rProps === 'function') rProps(); } catch (e) {}

      // Esconder overlay global: carga Comercial concluída
      if (typeof window.hideEmpresaSwitchLoading === 'function') {
        window.hideEmpresaSwitchLoading(switchToken);
      }

    } catch (e) {
      if (token === _comercialLoadToken) {
        console.warn('[multi-empresa] erro ao recarregar propostas:', e);
        if (typeof window.hideEmpresaSwitchLoading === 'function') window.hideEmpresaSwitchLoading(switchToken);
      }
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

  // Retorna perfil da empresa ativa (perfil_empresa com fallback para global)
  window.getPerfilUsuario = function () {
    return window._perfilUsuario;
  };

  // Retorna perfil global (usuarios.perfil) — usado como fallback e pelo RLS
  window.getPerfilGlobal = function () {
    return window._perfilGlobal;
  };

  // ── Controle de visibilidade dos botões de administração ─────────────────
  // Usa matriz de permissões (G4A): configuracoes.empresa/usuarios = ['dono','admin']
  // G4B: btn-permissoes para configuracoes.modulos = ['dono']
  window._atualizarBotoesAdmin = function () {
    var podeEmpresa  = typeof window.podeAcao === 'function'
      ? window.podeAcao('configuracoes', 'empresa')
      : (window._perfilUsuario === 'dono'); // fallback antes de permissoes.js carregar
    var podeUsuarios = typeof window.podeAcao === 'function'
      ? window.podeAcao('configuracoes', 'usuarios')
      : (window._perfilUsuario === 'dono');
    var podeModulos  = typeof window.podeAcao === 'function'
      ? window.podeAcao('configuracoes', 'modulos')
      : (window._perfilUsuario === 'dono');
    var btnU = document.getElementById('btn-usuarios');
    var btnE = document.getElementById('btn-empresa');
    var btnP = document.getElementById('btn-permissoes');
    if (btnU) btnU.style.display = podeUsuarios ? '' : 'none';
    if (btnE) btnE.style.display = podeEmpresa  ? '' : 'none';
    if (btnP) btnP.style.display = podeModulos  ? '' : 'none';
    console.log('%c[multi-empresa] perfil na empresa ativa: ' + window._perfilUsuario, 'color:#f0a500');
  };

  // ── Atualizar cadastro da empresa (apenas dono — RLS enforça) ────────────
  window.sbAtualizarEmpresa = async function (empresaId, campos) {
    if (!window.sbClient) return { error: { message: 'Supabase não disponível' } };
    var res = await window.sbClient
      .from('empresas')
      .update(campos)
      .eq('id', empresaId)
      .select('id, nome, nome_curto, cnpj, regime_fiscal, logo_url, razao_social, inscricao_estadual, inscricao_municipal, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_municipio, endereco_uf, endereco_cep, telefone, email, email_financeiro, logo_storage_path, config_json')
      .maybeSingle();
    return res;
  };

  // ── Sincronizar empresa ativa após edição ────────────────────────────────
  window.sincronizarEmpresaAtiva = function (empresaAtualizada) {
    // Preservar perfil_empresa (vem de usuario_empresas, não da tabela empresas)
    var perfilEmpresaAtual = window._empresaAtiva && window._empresaAtiva.id === empresaAtualizada.id
      ? (window._empresaAtiva.perfil_empresa || null)
      : null;
    var permissoesIndividuaisAtuais = window._empresaAtiva && window._empresaAtiva.id === empresaAtualizada.id
      ? (window._empresaAtiva.permissoes_json || null)
      : null;
    var empresaCompleta = Object.assign({}, empresaAtualizada, {
      perfil_empresa: perfilEmpresaAtual,
      permissoes_json: permissoesIndividuaisAtuais
    });

    // Atualizar no array global
    var idx = (window._empresasUsuario || []).findIndex(function(e){ return e.id === empresaCompleta.id; });
    if (idx >= 0) window._empresasUsuario[idx] = empresaCompleta;
    // Atualizar empresa ativa em memória sem disparar troca (só propaga)
    window._empresaAtiva = empresaCompleta;
    // Atualizar localStorage
    try {
      localStorage.setItem('tf_empresa_ativa', JSON.stringify({
        id:                  empresaCompleta.id,
        nome:                empresaCompleta.nome,
        nome_curto:          empresaCompleta.nome_curto,
        cnpj:                empresaCompleta.cnpj,
        razao_social:        empresaCompleta.razao_social        || null,
        inscricao_estadual:  empresaCompleta.inscricao_estadual  || null,
        email_financeiro:    empresaCompleta.email_financeiro     || null,
        regime_fiscal:       empresaCompleta.regime_fiscal        || null
      }));
    } catch(e) {}
    // Atualizar header visual
    if (typeof atualizarHeaderEmpresa === 'function') atualizarHeaderEmpresa(empresaCompleta);
    // Propagar para iframes via postMessage (atualiza _empresaAtiva.cnpj no financeiro etc.)
    document.querySelectorAll('.mod-frame').forEach(function(frame) {
      try {
        frame.contentWindow.postMessage({
          type:               'SET_EMPRESA',
          empresaId:          empresaCompleta.id,
          empresaNome:        empresaCompleta.nome,
          empresaNomeCurto:   empresaCompleta.nome_curto,
          empresaCnpj:        empresaCompleta.cnpj            || null,
          empresaRazaoSocial: empresaCompleta.razao_social     || null,
          empresaEmailFin:    empresaCompleta.email_financeiro || null
        }, '*');
      } catch(e2) {}
    });
    // Disparar evento para módulos inline
    try {
      window.dispatchEvent(new CustomEvent('empresa:atualizada', { detail: { empresa: empresaCompleta } }));
    } catch(e) {}
  };

  console.log('%c[multi-empresa] carregado', 'color:#f0a500;font-weight:700');

})();

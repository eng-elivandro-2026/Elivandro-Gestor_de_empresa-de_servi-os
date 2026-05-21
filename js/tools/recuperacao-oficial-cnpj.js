// ============================================================
// recuperacao-oficial-cnpj.js
// Prévia e aplicação controlada de cadastros oficiais por CNPJ
// Branch: portal/relacionamento-recuperar-clientes-cnpj-cidades
//
// MODO PRÉVIA  → window.rcnpjExecutarPrevia()
//   Somente leitura. Compara dados oficiais com clientes atuais.
//   Classifica: CRIAR | COMPLETAR | JÁ_COMPLETO | LEGADO_SUSPEITO
//   Nunca grava nada.
//
// MODO APLICAÇÃO → window.rcnpjAplicar(preview)
//   Exige digitação de "RECUPERAR CLIENTES TECFUSION".
//   Cria backup ANTES de qualquer gravação.
//   Nunca sobrescreve campo já preenchido.
//   Nunca apaga nem deduplica.
//   Marca legados suspeitos com _legado_suspeito: true.
// ============================================================

(function (window) {
  'use strict';

  // ── Dados Oficiais (baseados nos PDFs de CNPJ) ───────────────
  var DADOS_OFICIAIS = [
    {
      _id_oficial:  'jde_jundiai',
      nome:         'JDE Jundiaí',
      razao_social: 'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:         '02.333.707/0049-90',
      cidade:       'JUNDIAI',
      uf:           'SP',
      endereco:     'AV JOSE BENASSI, 1000 — PARQUE INDUSTRIAL',
      cep:          '13.213-085',
      telefone:     '(11) 4199-6192 / (11) 4199-6115',
      email:        ''
    },
    {
      _id_oficial:  'jde_salvador',
      nome:         'JDE Salvador',
      razao_social: 'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:         '02.333.707/0036-75',
      cidade:       'SALVADOR',
      uf:           'BA',
      endereco:     'R DO LUXEMBURGO, 586 — GRANJAS RURAIS PRESIDENTE VARGAS',
      cep:          '41.230-130',
      telefone:     '(11) 4525-6111',
      email:        ''
    },
    {
      _id_oficial:  'jde_itaporanga',
      nome:         "JDE Itaporanga d'Ajuda",
      razao_social: 'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:         '02.333.707/0065-00',
      cidade:       "ITAPORANGA D'AJUDA",
      uf:           'SE',
      endereco:     'ROD BR 101 KM 118, S/N — ZONA RURAL',
      cep:          '49.120-000',
      telefone:     '(77) 3423-0339',
      email:        ''
    },
    {
      _id_oficial:  'jde_vitoria_conquista',
      nome:         'JDE Vitória da Conquista',
      razao_social: 'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:         '02.333.707/0066-90',
      cidade:       'VITORIA DA CONQUISTA',
      uf:           'BA',
      endereco:     'R I DT IND IMBORES, 375 — DISTRITO INDUSTRIAL',
      complemento:  'QUADRA I LOTE 03/04/09/10',
      cep:          '45.089-410',
      telefone:     '(77) 3423-0339',
      email:        ''
    },
    {
      _id_oficial:  'foods_piumhi',
      nome:         'Foods Piumhí',
      razao_social: 'FOODS INDUSTRIA E COMERCIO LTDA',
      cnpj:         '19.731.877/0001-80',
      cidade:       'PIUMHI',
      uf:           'MG',
      endereco:     'AV QUEROBINO MOURAO FILHO, 703 — BELA VISTA',
      cep:          '37.925-000',
      telefone:     '(37) 3371-4939',
      email:        ''
    },
    {
      _id_oficial:  'fago',
      nome:         'FAGO',
      razao_social: 'FAGO PROGRAMACAO LTDA.',
      cnpj:         '43.133.454/0001-43',
      cidade:       'JUNDIAI',
      uf:           'SP',
      endereco:     'R CORINA SOAVE GANDRA, 105 — JARDIM TORRES SAO JOSE',
      cep:          '13.214-531',
      telefone:     '(11) 5311-1736',
      email:        'YAGO@FENIXPROGRAMACAO.COM.BR'
    }
  ];

  // ── Nomes suspeitos de duplicidade legada ─────────────────────
  // NÃO serão apagados — apenas marcados como _legado_suspeito: true
  var NOMES_LEGADOS_SUSPEITOS = [
    'jde jdi',
    'jde jundiai',
    'jde jundiaí',
    'jde salvador',
    'jdi',
    'piumhi',
    'piumí',
    'piumi'
  ];

  // ── Helpers ───────────────────────────────────────────────────
  function _normCnpj(s) { return String(s || '').replace(/\D/g, ''); }
  function _norm(s)     { return String(s || '').toLowerCase().trim().replace(/\s+/g, ' '); }
  function _esc(s)      { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function _id()        { return 'rcnpj_' + Date.now() + '_' + Math.random().toString(36).substr(2,5); }

  function _normNome(n) {
    return _norm(n)
      .replace(/[áàãâ]/g,'a').replace(/[éê]/g,'e').replace(/[íi]/g,'i')
      .replace(/[óôõ]/g,'o').replace(/[úü]/g,'u').replace(/ç/g,'c')
      .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  }

  // Resolução de empresa ativa
  function _getEmpresaId() {
    if (typeof window.getEmpresaAtivaId === 'function') { var r = window.getEmpresaAtivaId(); if (r) return r; }
    if (typeof window.getEmpresaAtiva === 'function') { var o = window.getEmpresaAtiva(); if (o && o.id) return o.id; }
    if (window._empresaAtiva && window._empresaAtiva.id) return window._empresaAtiva.id;
    try { var s = JSON.parse(localStorage.getItem('tf_empresa_ativa')||'null'); if (s&&s.id) return s.id; } catch(e) {}
    return null;
  }
  function _getEmpresaNome() {
    if (typeof window.getEmpresaAtiva === 'function') { var o = window.getEmpresaAtiva(); if (o && o.nome_curto) return o.nome_curto; }
    if (window._empresaAtiva && window._empresaAtiva.nome_curto) return window._empresaAtiva.nome_curto;
    try { var s = JSON.parse(localStorage.getItem('tf_empresa_ativa')||'null'); if (s&&s.nome_curto) return s.nome_curto; } catch(e) {}
    return null;
  }

  function _lsReadArr(k) {
    try { var v = JSON.parse(localStorage.getItem(k)||'[]'); return Array.isArray(v)?v:[]; } catch(e) { return []; }
  }
  function _lsWrite(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) { console.error('[rcnpj] Falha ao gravar', k, e); }
  }

  // ── Leitura Supabase ─────────────────────────────────────────
  async function _sbLer(chave) {
    if (!window.sbClient) return null;
    try {
      var r = await window.sbClient.from('configuracoes').select('valor').eq('chave', chave).maybeSingle();
      if (r.data && Array.isArray(r.data.valor)) return r.data.valor;
    } catch(e) { console.warn('[rcnpj] sbLer erro', chave, e); }
    return null;
  }
  async function _sbGravar(chave, valor) {
    if (!window.sbClient) return;
    try {
      var r = await window.sbClient.from('configuracoes')
        .upsert({ chave: chave, valor: valor, updated_at: new Date().toISOString() }, { onConflict: 'chave' });
      if (r.error) console.warn('[rcnpj] sbGravar erro', chave, r.error);
    } catch(e) { console.warn('[rcnpj] sbGravar exceção', chave, e); }
  }

  // ── Detectar se nome é legado suspeito ────────────────────────
  function _isLegadoSuspeito(nome) {
    var n = _normNome(nome);
    return NOMES_LEGADOS_SUSPEITOS.some(function(p) {
      var pn = _normNome(p);
      return n === pn || n.indexOf(pn) >= 0 || pn.indexOf(n) >= 0;
    });
  }

  // ── Encontrar cliente existente por CNPJ ──────────────────────
  function _buscarPorCnpj(lista, cnpj) {
    var cnpjN = _normCnpj(cnpj);
    if (!cnpjN) return null;
    return lista.find(function(c) { return _normCnpj(c.cnpj||'') === cnpjN; }) || null;
  }

  // ── Encontrar cliente existente por nome similar ──────────────
  function _buscarPorNomeSimilar(lista, nome) {
    var n = _normNome(nome);
    var tokens = n.split(' ').filter(function(t){ return t.length >= 3; });
    return lista.find(function(c) {
      var cn = _normNome(c.nome || '');
      // Coincidência exata normalizada
      if (cn === n) return true;
      // Contém ou é contido
      if (cn.indexOf(n) >= 0 || n.indexOf(cn) >= 0) return true;
      // Pelo menos 2 tokens em comum
      if (tokens.length >= 2) {
        var comuns = tokens.filter(function(t){ return cn.indexOf(t) >= 0; });
        if (comuns.length >= 2) return true;
      }
      return false;
    }) || null;
  }

  // ── Verificar quais campos podem ser completados ──────────────
  // Retorna { campo: valor_oficial } para campos vazios no registro atual
  // NUNCA inclui campos já preenchidos
  function _calcularCamposCompletar(atual, oficial) {
    var complementos = {};
    var CAMPOS = ['cnpj','cidade','uf','endereco','cep','telefone','email','razao_social','complemento'];
    CAMPOS.forEach(function(c) {
      var vAtual   = String(atual[c]   || '').trim();
      var vOficial = String(oficial[c] || '').trim();
      if (!vAtual && vOficial) complementos[c] = vOficial;
    });
    return complementos;
  }

  // ============================================================
  // PRÉVIA — SOMENTE LEITURA
  // ============================================================
  async function executarPrevia() {
    var eid   = _getEmpresaId();
    var enome = _getEmpresaNome() || '(desconhecida)';

    if (!eid) throw new Error('Empresa ativa não encontrada. Selecione uma empresa antes de continuar.');

    console.info('%c[rcnpj] PRÉVIA — somente leitura', 'color:#f59e0b;font-weight:700');

    // Ler clientes atuais — localStorage tem prioridade; mescla com Supabase se disponível
    var keyCli  = 'tf_clientes_' + eid;
    var cliLS   = _lsReadArr(keyCli);
    var cliSB   = await _sbLer(keyCli) || [];

    // Mescla: preservar localStorage como verdade; adicionar do SB só o que não existe localmente
    var idxLocal = {};
    cliLS.forEach(function(c) { if (c.id) idxLocal[c.id] = true; });
    var cliMesclados = cliLS.slice();
    cliSB.forEach(function(c) { if (c.id && !idxLocal[c.id]) cliMesclados.push(c); });

    console.info('[rcnpj] Clientes atuais na empresa', enome, ':', cliMesclados.length);

    // Também ler clientes legados globais (somente para cruzar — nunca para gravar)
    var cliGlobal = _lsReadArr('tf_clientes');
    var cliSBGlobal = await _sbLer('tf_clientes') || [];
    var cliGlobalTodos = cliGlobal.slice();
    var idxLsG = {}; cliGlobal.forEach(function(c){ if(c.id) idxLsG[c.id]=true; });
    cliSBGlobal.forEach(function(c){ if(c.id && !idxLsG[c.id]) cliGlobalTodos.push(c); });

    // ── Classificar cada dado oficial ─────────────────────────
    var acoes = [];

    DADOS_OFICIAIS.forEach(function(of) {
      var porCnpj       = _buscarPorCnpj(cliMesclados, of.cnpj);
      var porNome       = !porCnpj ? _buscarPorNomeSimilar(cliMesclados, of.nome) : null;
      var porCnpjGlobal = !porCnpj ? _buscarPorCnpj(cliGlobalTodos, of.cnpj) : null;
      var porNomeGlobal = (!porCnpj && !porNome) ? _buscarPorNomeSimilar(cliGlobalTodos, of.nome) : null;

      if (porCnpj) {
        // CNPJ já existe na empresa ativa
        var compl = _calcularCamposCompletar(porCnpj, of);
        acoes.push({
          tipo:         Object.keys(compl).length > 0 ? 'COMPLETAR' : 'JA_COMPLETO',
          oficial:      of,
          existente:    porCnpj,
          complementos: compl,
          chave_alvo:   keyCli,
          aviso:        null
        });
      } else if (porNome) {
        // Nome similar sem CNPJ coincidente — possível duplicata
        var compl2 = _calcularCamposCompletar(porNome, of);
        acoes.push({
          tipo:         'POSSIVEL_DUPLICATA',
          oficial:      of,
          existente:    porNome,
          complementos: compl2,
          chave_alvo:   keyCli,
          aviso:        'Nome similar encontrado mas CNPJ diferente/ausente. Verifique manualmente antes de aplicar.'
        });
      } else if (porCnpjGlobal) {
        // Está nos legados globais — pode ser recuperado
        var complG = _calcularCamposCompletar(porCnpjGlobal, of);
        acoes.push({
          tipo:         'RECUPERAR_DO_LEGADO',
          oficial:      of,
          existente:    porCnpjGlobal,
          complementos: complG,
          chave_alvo:   keyCli,
          aviso:        'Cliente encontrado na chave global legada (tf_clientes). Será copiado para a empresa ativa com campos complementados.'
        });
      } else {
        // Não existe em nenhuma fonte — criar novo
        acoes.push({
          tipo:         'CRIAR',
          oficial:      of,
          existente:    null,
          complementos: null,
          chave_alvo:   keyCli,
          aviso:        null
        });
      }
    });

    // ── Detectar legados suspeitos nos clientes atuais ────────
    var legadosSuspeitos = cliMesclados.filter(function(c) {
      return _isLegadoSuspeito(c.nome || '') && !c._legado_suspeito;
    });
    // Também nos globais
    var legadosSuspeitosGlobal = cliGlobalTodos.filter(function(c) {
      return _isLegadoSuspeito(c.nome || '') && !c._legado_suspeito;
    });

    var resultado = {
      empresa_id:              eid,
      empresa_nome:            enome,
      chave_alvo:              keyCli,
      total_atuais:            cliMesclados.length,
      total_globais:           cliGlobalTodos.length,
      acoes:                   acoes,
      legados_suspeitos:       legadosSuspeitos,
      legados_suspeitos_global:legadosSuspeitosGlobal,
      resumo: {
        criar:              acoes.filter(function(a){ return a.tipo==='CRIAR'; }).length,
        completar:          acoes.filter(function(a){ return a.tipo==='COMPLETAR'; }).length,
        ja_completo:        acoes.filter(function(a){ return a.tipo==='JA_COMPLETO'; }).length,
        possivel_duplicata: acoes.filter(function(a){ return a.tipo==='POSSIVEL_DUPLICATA'; }).length,
        recuperar_legado:   acoes.filter(function(a){ return a.tipo==='RECUPERAR_DO_LEGADO'; }).length,
        legados_suspeitos:  legadosSuspeitos.length + legadosSuspeitosGlobal.length
      },
      aviso: 'MODO PRÉVIA — nenhum dado foi alterado, apagado ou migrado.',
      timestamp: new Date().toISOString()
    };

    console.info('[rcnpj] Prévia concluída:', resultado.resumo);
    return resultado;
  }

  // ============================================================
  // APLICAÇÃO CONTROLADA
  // ============================================================
  async function aplicar(preview) {
    if (!preview || !preview.acoes) throw new Error('Prévia inválida. Execute a prévia antes de aplicar.');

    var eid = _getEmpresaId();
    if (!eid) throw new Error('Empresa ativa não encontrada.');
    if (eid !== preview.empresa_id) {
      throw new Error('A empresa ativa mudou desde a prévia. Execute a prévia novamente.');
    }

    // ── Confirmação obrigatória ───────────────────────────────
    var PALAVRA = 'RECUPERAR CLIENTES TECFUSION';
    var digitado = window.prompt(
      'Para confirmar a recuperação de clientes para a empresa "' + preview.empresa_nome + '",\n'
      + 'digite exatamente:\n\n' + PALAVRA
    );
    if (digitado === null) return { cancelado: true, msg: 'Cancelado pelo usuário. Nenhum dado foi gravado.' };
    if ((digitado || '').trim() !== PALAVRA) return { cancelado: true, msg: 'Texto incorreto. Nenhum dado foi gravado.' };

    var keyCli = 'tf_clientes_' + eid;

    // ── BACKUP obrigatório antes de qualquer gravação ─────────
    var cliAtual = _lsReadArr(keyCli);
    var tsBackup = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    var chaveBackup = 'tf_clientes_backup_' + tsBackup + '_' + eid;
    _lsWrite(chaveBackup, cliAtual);
    await _sbGravar(chaveBackup, cliAtual);
    console.info('[rcnpj] Backup criado:', chaveBackup, '(', cliAtual.length, 'registros)');

    // ── Aplicar ações ─────────────────────────────────────────
    var relatorio = {
      empresa_id:   eid,
      empresa_nome: preview.empresa_nome,
      chave_backup: chaveBackup,
      criados:      0,
      completados:  0,
      ignorados_ja_completo: 0,
      ignorados_duplicata:   0,
      recuperados_legado:    0,
      marcados_legado_suspeito: 0,
      erros:        [],
      cancelado:    false
    };

    // Reler para garantir estado mais recente
    var lista = _lsReadArr(keyCli);

    // Indexar por id
    var idxId = {};
    lista.forEach(function(c, i) { if (c.id) idxId[c.id] = i; });

    preview.acoes.forEach(function(acao) {
      try {
        if (acao.tipo === 'JA_COMPLETO') {
          relatorio.ignorados_ja_completo++;
          return;
        }
        if (acao.tipo === 'POSSIVEL_DUPLICATA') {
          // Completar campos vazios mesmo na duplicata (sem sobrescrever)
          if (acao.existente && acao.existente.id && idxId[acao.existente.id] !== undefined) {
            var idx = idxId[acao.existente.id];
            var c = lista[idx];
            var compl = _calcularCamposCompletar(c, acao.oficial);
            if (Object.keys(compl).length > 0) {
              Object.assign(c, compl);
              lista[idx] = c;
              relatorio.completados++;
            } else {
              relatorio.ignorados_duplicata++;
            }
          } else {
            relatorio.ignorados_duplicata++;
          }
          return;
        }
        if (acao.tipo === 'COMPLETAR') {
          // Completar campos vazios no registro existente
          if (acao.existente && acao.existente.id && idxId[acao.existente.id] !== undefined) {
            var idx2 = idxId[acao.existente.id];
            var c2 = lista[idx2];
            Object.assign(c2, acao.complementos);
            lista[idx2] = c2;
            relatorio.completados++;
          }
          return;
        }
        if (acao.tipo === 'CRIAR') {
          // Criar novo registro com dados oficiais
          var novo = {
            id:          _id(),
            nome:        acao.oficial.nome,
            razao_social:acao.oficial.razao_social,
            cnpj:        acao.oficial.cnpj,
            cidade:      acao.oficial.cidade + (acao.oficial.uf ? ' - ' + acao.oficial.uf : ''),
            uf:          acao.oficial.uf,
            endereco:    acao.oficial.endereco,
            complemento: acao.oficial.complemento || '',
            cep:         acao.oficial.cep,
            telefone:    acao.oficial.telefone,
            email:       acao.oficial.email,
            criado:      new Date().toISOString(),
            _recuperado:  true,
            _fonte:       'cnpj_oficial'
          };
          lista.push(novo);
          relatorio.criados++;
          return;
        }
        if (acao.tipo === 'RECUPERAR_DO_LEGADO') {
          // Copiar do legado para empresa ativa, completar campos vazios
          var base = Object.assign({}, acao.existente);
          // Novo ID para evitar colisão
          base.id = _id();
          base._recuperado = true;
          base._fonte = 'legado_global';
          // Completar campos vazios com dados oficiais
          Object.assign(base, acao.complementos);
          lista.push(base);
          relatorio.recuperados_legado++;
          return;
        }
      } catch(e) {
        relatorio.erros.push('Ação ' + acao.tipo + ' para ' + (acao.oficial ? acao.oficial.nome : '?') + ': ' + e.message);
        console.error('[rcnpj] Erro na ação', acao.tipo, e);
      }
    });

    // ── Marcar legados suspeitos (NÃO apagar) ─────────────────
    var todosLegados = (preview.legados_suspeitos || []).concat(preview.legados_suspeitos_global || []);
    if (todosLegados.length > 0) {
      // Marcar na lista atual (se existirem)
      var nomesSuspeitos = todosLegados.map(function(c){ return c.id; });
      lista = lista.map(function(c) {
        if (c.id && nomesSuspeitos.indexOf(c.id) >= 0) {
          return Object.assign({}, c, {
            _legado_suspeito: true,
            _aviso: 'Duplicado legado suspeito — revisar manualmente'
          });
        }
        return c;
      });
      relatorio.marcados_legado_suspeito = nomesSuspeitos.length;
    }

    // ── Gravar resultado ──────────────────────────────────────
    _lsWrite(keyCli, lista);
    await _sbGravar(keyCli, lista);

    // ── Atualizar UI ──────────────────────────────────────────
    try { if (typeof window.renderTabelaClientes === 'function') window.renderTabelaClientes(); } catch(e) {}

    console.info('[rcnpj] Aplicação concluída:', relatorio);
    return relatorio;
  }

  // ============================================================
  // RENDERIZAÇÃO HTML
  // ============================================================
  function _badge(label, n, cor) {
    cor = cor || '#6b7280';
    return '<span style="display:inline-flex;align-items:center;gap:.25rem;background:' + cor + '1a;color:' + cor + ';border:1px solid ' + cor + '55;border-radius:4px;padding:.06rem .38rem;font-size:.68rem;font-weight:700">'
      + label + ' ' + n + '</span>';
  }

  var _COR = {
    CRIAR:              '#22c55e',
    COMPLETAR:          '#3b82f6',
    JA_COMPLETO:        '#6b7280',
    POSSIVEL_DUPLICATA: '#f59e0b',
    RECUPERAR_DO_LEGADO:'#8b5cf6',
    LEGADO:             '#ef4444'
  };
  var _ICON = {
    CRIAR:'➕',COMPLETAR:'✏️',JA_COMPLETO:'✅',
    POSSIVEL_DUPLICATA:'⚠️',RECUPERAR_DO_LEGADO:'♻️'
  };
  var _LABEL = {
    CRIAR:'Criar novo',COMPLETAR:'Completar',JA_COMPLETO:'Já completo',
    POSSIVEL_DUPLICATA:'Possível duplicata',RECUPERAR_DO_LEGADO:'Recuperar do legado'
  };

  function _cardAcao(acao) {
    var cor = _COR[acao.tipo] || '#6b7280';
    var html = '<div style="border:1px solid ' + cor + '44;border-left:3px solid ' + cor + ';border-radius:6px;padding:.6rem .85rem;margin-bottom:.4rem;background:var(--bg2)">';
    // Linha 1: tipo + nome oficial
    html += '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.4rem;margin-bottom:.3rem">';
    html += '<span style="font-size:.68rem;font-weight:700;color:' + cor + ';background:' + cor + '1a;border-radius:4px;padding:.06rem .38rem">'
      + (_ICON[acao.tipo]||'') + ' ' + (_LABEL[acao.tipo]||acao.tipo) + '</span>';
    html += '<span style="font-size:.8rem;font-weight:700;color:var(--text)">' + _esc(acao.oficial.nome) + '</span>';
    html += '</div>';
    // Dados oficiais
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.12rem .8rem;font-size:.71rem;color:var(--text2);margin-bottom:.3rem">';
    if (acao.oficial.cnpj)        html += '<span>CNPJ: <strong>' + _esc(acao.oficial.cnpj) + '</strong></span>';
    if (acao.oficial.cidade)      html += '<span>📍 ' + _esc(acao.oficial.cidade) + (acao.oficial.uf ? ' - ' + _esc(acao.oficial.uf) : '') + '</span>';
    if (acao.oficial.razao_social) html += '<span style="grid-column:1/-1">Razão social: ' + _esc(acao.oficial.razao_social) + '</span>';
    if (acao.oficial.telefone)    html += '<span>📞 ' + _esc(acao.oficial.telefone) + '</span>';
    if (acao.oficial.email)       html += '<span>📧 ' + _esc(acao.oficial.email) + '</span>';
    if (acao.oficial.endereco)    html += '<span style="grid-column:1/-1">📌 ' + _esc(acao.oficial.endereco) + '</span>';
    html += '</div>';
    // Existente (se houver)
    if (acao.existente) {
      html += '<div style="font-size:.68rem;color:var(--text3);background:var(--bg3);border-radius:4px;padding:.25rem .45rem;margin-bottom:.3rem">';
      html += '↳ Cadastro atual: <strong>' + _esc(acao.existente.nome||'?') + '</strong>'
        + (acao.existente.cnpj ? ' · CNPJ: ' + _esc(acao.existente.cnpj) : ' · <em>sem CNPJ</em>')
        + (acao.existente.cidade ? ' · ' + _esc(acao.existente.cidade) : '');
      html += '</div>';
    }
    // Campos a completar
    if (acao.complementos && Object.keys(acao.complementos).length) {
      html += '<div style="font-size:.68rem;color:var(--blue);margin-bottom:.2rem">Campos que serão preenchidos (somente os vazios):</div>';
      html += '<div style="font-size:.69rem;color:var(--text2);display:flex;flex-wrap:wrap;gap:.3rem">';
      Object.keys(acao.complementos).forEach(function(k) {
        html += '<span style="background:rgba(59,130,246,.1);border:1px solid rgba(59,130,246,.3);border-radius:3px;padding:.05rem .28rem">'
          + _esc(k) + ': <strong>' + _esc(acao.complementos[k]) + '</strong></span>';
      });
      html += '</div>';
    }
    // Aviso
    if (acao.aviso) {
      html += '<div style="font-size:.68rem;color:#f59e0b;margin-top:.2rem">⚠️ ' + _esc(acao.aviso) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function _renderizarPrevia(preview, elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var r = preview.resumo;
    var html = '';

    // Aviso somente leitura
    html += '<div style="background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.3);border-radius:6px;padding:.5rem .8rem;margin-bottom:.7rem;font-size:.73rem;color:var(--text2)">'
      + '✅ Prévia somente leitura — nenhum dado foi alterado. Revise abaixo e clique em <strong>Aplicar</strong> para confirmar.'
      + '</div>';

    // Empresa
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.6rem .85rem;margin-bottom:.7rem">'
      + '<div style="font-size:.7rem;color:var(--text3);margin-bottom:.15rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Empresa alvo</div>'
      + '<div style="font-weight:700;color:var(--text)">' + _esc(preview.empresa_nome) + '</div>'
      + '<code style="font-size:.65rem;color:var(--text3)">' + _esc(preview.chave_alvo) + '</code>'
      + '</div>';

    // Resumo
    html += '<div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.8rem">';
    html += _badge('➕ Criar', r.criar, _COR.CRIAR);
    html += _badge('✏️ Completar', r.completar, _COR.COMPLETAR);
    html += _badge('✅ Já completo', r.ja_completo, _COR.JA_COMPLETO);
    html += _badge('⚠️ Duplicata', r.possivel_duplicata, _COR.POSSIVEL_DUPLICATA);
    html += _badge('♻️ Recuperar legado', r.recuperar_legado, _COR.RECUPERAR_DO_LEGADO);
    if (r.legados_suspeitos > 0) html += _badge('🚩 Legados suspeitos', r.legados_suspeitos, _COR.LEGADO);
    html += '</div>';

    // Legados suspeitos
    var todosLeg = (preview.legados_suspeitos||[]).concat(preview.legados_suspeitos_global||[]);
    if (todosLeg.length > 0) {
      html += '<div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:.6rem .85rem;margin-bottom:.7rem">';
      html += '<div style="font-size:.71rem;font-weight:700;color:#ef4444;margin-bottom:.3rem">🚩 Cadastros suspeitos de duplicidade legada — serão MARCADOS, não apagados</div>';
      todosLeg.forEach(function(c) {
        html += '<div style="font-size:.72rem;color:var(--text2);padding:.15rem 0">'
          + '• <strong>' + _esc(c.nome||'?') + '</strong>'
          + (c.cnpj ? ' · CNPJ: ' + _esc(c.cnpj) : ' · <em>sem CNPJ</em>')
          + ' → receberá flag <code>_legado_suspeito: true</code> + aviso visual'
          + '</div>';
      });
      html += '</div>';
    }

    // Ações por tipo
    var ordemTipos = ['CRIAR','RECUPERAR_DO_LEGADO','COMPLETAR','POSSIVEL_DUPLICATA','JA_COMPLETO'];
    ordemTipos.forEach(function(tipo) {
      var lista = preview.acoes.filter(function(a){ return a.tipo === tipo; });
      if (!lista.length) return;
      html += '<details open style="margin-bottom:.6rem"><summary style="cursor:pointer;font-size:.74rem;font-weight:700;color:' + (_COR[tipo]||'var(--text2)') + ';padding:.3rem 0">'
        + (_ICON[tipo]||'') + ' ' + (_LABEL[tipo]||tipo) + ' — ' + lista.length + ' cliente(s)</summary><div style="margin-top:.5rem">';
      lista.forEach(function(a){ html += _cardAcao(a); });
      html += '</div></details>';
    });

    // Botão aplicar
    var temAcoes = r.criar + r.completar + r.recuperar_legado + r.possivel_duplicata > 0 || todosLeg.length > 0;
    if (temAcoes) {
      html += '<div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.3);border-radius:6px;padding:.7rem .9rem;margin-top:.7rem">'
        + '<div style="font-size:.73rem;color:var(--text2);margin-bottom:.5rem">'
        + 'Para aplicar, você precisará digitar <strong>RECUPERAR CLIENTES TECFUSION</strong>.<br>'
        + 'Um <strong>backup automático</strong> será criado antes de qualquer alteração.'
        + '</div>'
        + '<button class="nb" id="rcnpjBtnAplicar" onclick="rcnpjAplicarUI()"'
        + ' style="background:var(--blue);color:#fff;border-radius:6px;padding:.42rem 1rem;font-size:.78rem;font-weight:700">'
        + '✅ Aplicar Recuperação Oficial</button>'
        + '</div>';
    }

    html += '<div style="font-size:.66rem;color:var(--text3);text-align:center;margin-top:.5rem">'
      + 'Prévia gerada em ' + new Date(preview.timestamp).toLocaleString('pt-BR') + ' — nenhum dado foi alterado.'
      + '</div>';

    el.innerHTML = html;
  }

  function _renderizarRelatorio(relatorio, elId) {
    var el = document.getElementById(elId);
    if (!el) return;
    var html = '';

    if (relatorio.cancelado) {
      html = '<div style="padding:1rem;background:rgba(107,114,128,.08);border:1px solid var(--border);border-radius:6px;font-size:.78rem;color:var(--text2)">'
        + '🚫 ' + _esc(relatorio.msg || 'Cancelado.') + '</div>';
      el.innerHTML = html;
      return;
    }

    html += '<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.35);border-radius:6px;padding:.85rem;margin-bottom:.75rem">'
      + '<div style="font-weight:700;color:#22c55e;font-size:.9rem;margin-bottom:.5rem">✅ Recuperação concluída — ' + _esc(relatorio.empresa_nome) + '</div>'
      + '<div style="display:flex;flex-wrap:wrap;gap:.4rem">';
    html += _badge('➕ Criados', relatorio.criados, _COR.CRIAR);
    html += _badge('✏️ Completados', relatorio.completados, _COR.COMPLETAR);
    html += _badge('⏭️ Já completos', relatorio.ignorados_ja_completo, _COR.JA_COMPLETO);
    html += _badge('♻️ Recuperados do legado', relatorio.recuperados_legado, _COR.RECUPERAR_DO_LEGADO);
    html += _badge('🚩 Legados marcados', relatorio.marcados_legado_suspeito, _COR.LEGADO);
    html += '</div></div>';

    html += '<div style="font-size:.73rem;color:var(--text2);background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.6rem .85rem;margin-bottom:.6rem">'
      + '💾 Backup criado antes da aplicação:<br><code style="font-size:.7rem">' + _esc(relatorio.chave_backup) + '</code>'
      + '</div>';

    if (relatorio.erros && relatorio.erros.length) {
      html += '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:.7rem .85rem;margin-bottom:.6rem">'
        + '<div style="font-size:.74rem;font-weight:600;color:#ef4444;margin-bottom:.3rem">Erros encontrados</div>';
      relatorio.erros.forEach(function(e){ html += '<div style="font-size:.72rem;color:var(--text2)">• ' + _esc(e) + '</div>'; });
      html += '</div>';
    }

    html += '<div style="font-size:.7rem;color:var(--text3);text-align:center">'
      + 'Nenhum dado foi apagado. Legados suspeitos foram apenas marcados (não removidos).'
      + '</div>';

    el.innerHTML = html;
  }

  // ── Funções UI públicas ──────────────────────────────────────
  window.rcnpjExecutarPrevia = async function () {
    var el = document.getElementById('rcnpjResultado');
    if (!el) { console.warn('[rcnpj] #rcnpjResultado não encontrado'); return; }
    el.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text3);font-size:.8rem">'
      + '🔍 Comparando dados oficiais com cadastros atuais...<br>'
      + '<span style="font-size:.7rem">Somente leitura — nada será alterado</span></div>';

    window._rcnpjPrevia = null;
    try {
      var preview = await executarPrevia();
      window._rcnpjPrevia = preview;
      _renderizarPrevia(preview, 'rcnpjResultado');
    } catch(e) {
      console.error('[rcnpj] Erro na prévia:', e);
      if (el) el.innerHTML = '<div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;color:#ef4444;font-size:.77rem">'
        + '❌ Erro: ' + _esc(e.message) + '</div>';
    }
  };

  window.rcnpjAplicarUI = async function () {
    if (!window._rcnpjPrevia) { alert('Execute a prévia antes de aplicar.'); return; }
    var el = document.getElementById('rcnpjResultado');
    try {
      var rel = await aplicar(window._rcnpjPrevia);
      if (!rel.cancelado) window._rcnpjPrevia = null;
      _renderizarRelatorio(rel, 'rcnpjResultado');
    } catch(e) {
      console.error('[rcnpj] Erro na aplicação:', e);
      if (el) {
        var prev = el.innerHTML;
        el.innerHTML = '<div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;color:#ef4444;font-size:.77rem;margin-bottom:.75rem">'
          + '❌ Erro ao aplicar: ' + _esc(e.message) + '</div>' + prev;
      }
    }
  };

  // Expor também para console
  window.RcnpjPreview = { executar: executarPrevia };
  window.RcnpjApply   = { aplicar: aplicar };

  console.info('%c[rcnpj] carregado — window.rcnpjExecutarPrevia()', 'color:#22c55e;font-weight:700');

}(window));

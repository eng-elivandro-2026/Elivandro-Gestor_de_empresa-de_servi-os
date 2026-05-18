// ============================================================
// relacionamento-recovery.js
// R2 — Recuperação de Clientes, Contatos e Histórico Antigos
//
// MODO PRÉVIA (window.RelacionamentoRecoveryPreview.executar)
//   Somente leitura. Analisa todas as fontes e retorna relatório.
//   NUNCA grava nem altera nenhum dado.
//
// MODO APLICAÇÃO (window.RelacionamentoRecoveryApply.aplicar)
//   Recebe o resultado da prévia.
//   Exige digitação de "RECUPERAR RELACIONAMENTO".
//   Mescla apenas o que está faltando. Nunca apaga ou sobrescreve.
//   Respeita 100% multiempresa.
//
// UI (funções globais)
//   window.rrExecutarPrevia()          — botão "Executar Prévia"
//   window.rrAplicarComConfirmacao()   — botão "Aplicar Recuperação"
//   window.rrRenderizarEmpresaInfo()   — atualiza cabeçalho da seção
// ============================================================

(function (window) {
  'use strict';

  // ── Resolução de empresa ativa ────────────────────────────
  function _getEmpresaId() {
    if (typeof window.getEmpresaAtivaId === 'function') {
      var id = window.getEmpresaAtivaId();
      if (id) return id;
    }
    if (typeof window.getEmpresaAtiva === 'function') {
      var obj = window.getEmpresaAtiva();
      if (obj && obj.id) return obj.id;
    }
    if (window._empresaAtiva && window._empresaAtiva.id) return window._empresaAtiva.id;
    try {
      var salvo = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
      if (salvo && salvo.id) return salvo.id;
    } catch (e) {}
    return null;
  }

  function _getEmpresaNome() {
    if (typeof window.getEmpresaAtiva === 'function') {
      var obj = window.getEmpresaAtiva();
      if (obj && obj.nome_curto) return obj.nome_curto;
    }
    if (window._empresaAtiva && window._empresaAtiva.nome_curto) return window._empresaAtiva.nome_curto;
    try {
      var salvo = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
      if (salvo && salvo.nome_curto) return salvo.nome_curto;
    } catch (e) {}
    return '(empresa desconhecida)';
  }

  function _keyFor(base) {
    var eid = _getEmpresaId();
    return eid ? base + '_' + eid : null;
  }

  // ── ID gerador ────────────────────────────────────────────
  function _id(prefix) {
    return (prefix || 'rec') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
  }

  // ── Normalização ─────────────────────────────────────────
  function _norm(s) {
    return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
  }
  function _normCnpj(s) {
    return String(s || '').replace(/\D/g, '');
  }
  function _normTel(s) {
    return String(s || '').replace(/\D/g, '');
  }
  function _normEmail(s) {
    return String(s || '').toLowerCase().trim();
  }

  // ── Leitura / escrita localStorage ───────────────────────
  function _lsRead(chave) {
    try {
      var v = JSON.parse(localStorage.getItem(chave) || 'null');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  function _lsWrite(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) {}
  }

  // ── Leitura Supabase (Promise<Array|null>) ────────────────
  async function _sbRead(chave) {
    if (!window.sbClient) return null;
    try {
      var r = await window.sbClient
        .from('configuracoes')
        .select('valor')
        .eq('chave', chave)
        .maybeSingle();
      if (r.data && Array.isArray(r.data.valor)) return r.data.valor;
    } catch (e) {
      console.warn('[Recovery] sbRead erro para "' + chave + '":', e);
    }
    return null;
  }

  // ── Escrita Supabase ──────────────────────────────────────
  async function _sbWrite(chave, valor) {
    if (!window.sbClient) return;
    try {
      var r = await window.sbClient
        .from('configuracoes')
        .upsert(
          { chave: chave, valor: valor, updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        );
      if (r.error) console.warn('[Recovery] sbWrite erro para "' + chave + '":', r.error);
    } catch (e) {
      console.warn('[Recovery] sbWrite exceção para "' + chave + '":', e);
    }
  }

  // ── Mesclar de forma segura (localStorage ganha prioridade) ──
  function _mesclarComSb(ls, sb) {
    if (!sb || !sb.length) return ls.slice();
    var merged = ls.slice();
    var idsLs = {};
    ls.forEach(function (x) { if (x.id) idsLs[x.id] = true; });
    sb.forEach(function (x) {
      if (x.id && !idsLs[x.id]) merged.push(x);
    });
    return merged;
  }

  // ============================================================
  // DEDUPLICAÇÃO
  // ============================================================

  /**
   * Retorna { para_adicionar: [], duplicados: [] }
   * Clientes: CNPJ > nome+cidade > nome
   * Atualiza os índices com cada item aceito (previne duplicados no lote).
   */
  function _dedupCli(existentes, candidatos) {
    var idxCnpj       = {};
    var idxNomeCidade = {};
    var idxNome       = {};

    existentes.forEach(function (c) {
      var cnpj = _normCnpj(c.cnpj || '');
      if (cnpj.length >= 11) idxCnpj[cnpj] = true;
      idxNomeCidade[_norm(c.nome) + '|' + _norm(c.cidade || '')] = true;
      idxNome[_norm(c.nome)] = true;
    });

    var para_adicionar = [];
    var duplicados = [];

    candidatos.forEach(function (c) {
      var cnpj  = _normCnpj(c.cnpj || '');
      var nNome = _norm(c.nome);
      var nCid  = _norm(c.cidade || '');

      if (cnpj.length >= 11 && idxCnpj[cnpj]) {
        duplicados.push({ item: c, motivo: 'CNPJ já existe (' + c.cnpj + ')' });
        return;
      }
      if (idxNomeCidade[nNome + '|' + nCid]) {
        duplicados.push({ item: c, motivo: 'Nome + cidade já existem' });
        return;
      }
      if (idxNome[nNome]) {
        duplicados.push({ item: c, motivo: 'Nome já existe' });
        return;
      }
      // Aceito — atualiza índices para evitar duplicatas dentro do lote
      if (cnpj.length >= 11) idxCnpj[cnpj] = true;
      idxNomeCidade[nNome + '|' + nCid] = true;
      idxNome[nNome] = true;
      para_adicionar.push(c);
    });

    return { para_adicionar: para_adicionar, duplicados: duplicados };
  }

  /**
   * Contatos: email > nome+empresa > nome+telefone > nome
   */
  function _dedupCts(existentes, candidatos) {
    var idxEmail     = {};
    var idxNomeEmp   = {};
    var idxNomeTel   = {};
    var idxNome      = {};

    existentes.forEach(function (c) {
      var email = _normEmail(c.email || '');
      var tel   = _normTel(c.telefone || '');
      if (email) idxEmail[email] = true;
      idxNomeEmp[_norm(c.nome) + '|' + _norm(c.empresa || '')] = true;
      if (tel.length >= 8) idxNomeTel[_norm(c.nome) + '|' + tel] = true;
      idxNome[_norm(c.nome)] = true;
    });

    var para_adicionar = [];
    var duplicados = [];

    candidatos.forEach(function (c) {
      var email = _normEmail(c.email || '');
      var tel   = _normTel(c.telefone || '');
      var nNome = _norm(c.nome);
      var nEmp  = _norm(c.empresa || '');

      if (email && idxEmail[email]) {
        duplicados.push({ item: c, motivo: 'E-mail já existe (' + c.email + ')' });
        return;
      }
      if (idxNomeEmp[nNome + '|' + nEmp]) {
        duplicados.push({ item: c, motivo: 'Nome + empresa já existem' });
        return;
      }
      if (tel.length >= 8 && idxNomeTel[nNome + '|' + tel]) {
        duplicados.push({ item: c, motivo: 'Nome + telefone já existem' });
        return;
      }
      if (idxNome[nNome]) {
        duplicados.push({ item: c, motivo: 'Nome já existe' });
        return;
      }
      // Aceito — atualiza índices
      if (email) idxEmail[email] = true;
      idxNomeEmp[nNome + '|' + nEmp] = true;
      if (tel.length >= 8) idxNomeTel[nNome + '|' + tel] = true;
      idxNome[nNome] = true;
      para_adicionar.push(c);
    });

    return { para_adicionar: para_adicionar, duplicados: duplicados };
  }

  /**
   * Histórico: id único
   */
  function _dedupHist(existentes, candidatos) {
    var idxId = {};
    existentes.forEach(function (h) { if (h.id) idxId[h.id] = true; });

    var para_adicionar = [];
    var duplicados = [];

    candidatos.forEach(function (h) {
      if (h.id && idxId[h.id]) {
        duplicados.push({ item: h, motivo: 'ID já existe (' + h.id + ')' });
        return;
      }
      if (h.id) idxId[h.id] = true;
      para_adicionar.push(h);
    });

    return { para_adicionar: para_adicionar, duplicados: duplicados };
  }

  // ============================================================
  // EXTRAÇÃO DE PROPOSTAS
  // ============================================================

  function _clientesDePropostas(propostas) {
    var seen = {};
    var lista = [];
    propostas.forEach(function (p) {
      var nome  = ((p.loc || p.cli || '')).trim();
      var cnpj  = ((p.locCnpj || p.cnpj || '')).trim();
      var cidade = ((p.csvc || '')).trim();
      if (!nome) return;
      var key = _normCnpj(cnpj) || _norm(nome);
      if (seen[key]) return;
      seen[key] = true;
      lista.push({
        id:     _id('prop_cli'),
        nome:   nome,
        cnpj:   cnpj,
        cidade: cidade,
        criado: p.criado || new Date().toISOString(),
        _fonte: 'proposta'
      });
    });
    return lista;
  }

  function _contatosDePropostas(propostas) {
    var seen = {};
    var lista = [];
    propostas.forEach(function (p) {
      var empresa = ((p.loc || p.cli || '')).trim();
      var nomes = [p.ac, p.ac2].filter(Boolean);
      nomes.forEach(function (nome) {
        nome = nome.trim();
        if (!nome) return;
        var key = _norm(nome) + '|' + _norm(empresa);
        if (seen[key]) return;
        seen[key] = true;
        lista.push({
          id:          _id('prop_cts'),
          nome:        nome,
          empresa:     empresa,
          email:       '',
          telefone:    '',
          departamento:'',
          criado:      p.criado || new Date().toISOString(),
          _fonte:      'proposta'
        });
      });
    });
    return lista;
  }

  // ============================================================
  // PRÉVIA (SOMENTE LEITURA)
  // ============================================================

  async function executarPrevia() {
    var eid   = _getEmpresaId();
    var enome = _getEmpresaNome();

    if (!eid) {
      throw new Error('[Recovery] Empresa ativa não encontrada. Faça login e selecione uma empresa.');
    }

    console.info('[Recovery] Iniciando prévia para empresa:', enome, '(', eid, ')');
    console.info('[Recovery] MODO SOMENTE LEITURA — nenhum dado será alterado.');

    // ── 1. Ler chaves antigas globais (localStorage) ──────────
    var ls_cli_antigo  = _lsRead('tf_clientes').map(function(c) { return Object.assign({}, c, { _fonte: c._fonte || 'localStorage antigo' }); });
    var ls_cts_antigo  = _lsRead('tf_contatos').map(function(c) { return Object.assign({}, c, { _fonte: c._fonte || 'localStorage antigo' }); });
    var ls_hist_antigo = _lsRead('tf_historico').map(function(h) { return Object.assign({}, h, { _fonte: h._fonte || 'localStorage antigo' }); });
    var ls_cli_del     = _lsRead('tf_cli_del');
    var ls_cts_del     = _lsRead('tf_cts_del');

    // ── 2. Ler chaves novas por empresa (localStorage) ────────
    var keyCli  = _keyFor('tf_clientes');
    var keyCts  = _keyFor('tf_contatos');
    var keyHist = _keyFor('tf_historico');

    var ls_cli_novo  = keyCli  ? _lsRead(keyCli)  : [];
    var ls_cts_novo  = keyCts  ? _lsRead(keyCts)  : [];
    var ls_hist_novo = keyHist ? _lsRead(keyHist) : [];

    // ── 3. Ler do Supabase — antigo global ────────────────────
    console.info('[Recovery] Consultando Supabase — chaves antigas...');
    var sb_cli_antigo  = (await _sbRead('tf_clientes')  || []).map(function(c) { return Object.assign({}, c, { _fonte: c._fonte || 'Supabase antigo' }); });
    var sb_cts_antigo  = (await _sbRead('tf_contatos')  || []).map(function(c) { return Object.assign({}, c, { _fonte: c._fonte || 'Supabase antigo' }); });
    var sb_hist_antigo = (await _sbRead('tf_historico') || []).map(function(h) { return Object.assign({}, h, { _fonte: h._fonte || 'Supabase antigo' }); });

    // ── 4. Ler do Supabase — novo por empresa ─────────────────
    console.info('[Recovery] Consultando Supabase — chaves novas...');
    var sb_cli_novo  = keyCli  ? (await _sbRead(keyCli)  || []) : [];
    var sb_cts_novo  = keyCts  ? (await _sbRead(keyCts)  || []) : [];
    var sb_hist_novo = keyHist ? (await _sbRead(keyHist) || []) : [];

    // ── 5. Montar "existentes" (o que já tem na empresa) ──────
    var existentes_cli  = _mesclarComSb(ls_cli_novo,  sb_cli_novo);
    var existentes_cts  = _mesclarComSb(ls_cts_novo,  sb_cts_novo);
    var existentes_hist = _mesclarComSb(ls_hist_novo, sb_hist_novo);

    // ── 6. Montar "antigos" (fontes globais) ──────────────────
    var antigo_cli  = _mesclarComSb(ls_cli_antigo,  sb_cli_antigo);
    var antigo_cts  = _mesclarComSb(ls_cts_antigo,  sb_cts_antigo);
    var antigo_hist = _mesclarComSb(ls_hist_antigo, sb_hist_antigo);

    // ── 7. Propostas da empresa ativa ─────────────────────────
    var propostas = [];
    try {
      var lsProps = JSON.parse(localStorage.getItem('tf_props') || '[]');
      propostas = Array.isArray(lsProps) ? lsProps : [];
    } catch (e) {}
    if (!propostas.length && window.props) propostas = window.props;

    var prop_cli = _clientesDePropostas(propostas);
    var prop_cts = _contatosDePropostas(propostas);

    // ── 8. Juntar candidatos (antigo + propostas) ─────────────
    // Usamos dedup interno para unir antigos + propostas sem duplicatas
    var candidatos_cli_raw  = antigo_cli.slice();
    var candidatos_cts_raw  = antigo_cts.slice();
    var candidatos_hist_raw = antigo_hist.slice();

    // Adicionar propostas aos candidatos (dedupados dentro do lote)
    var dp_prop_cli = _dedupCli(antigo_cli,  prop_cli);
    dp_prop_cli.para_adicionar.forEach(function (x) { candidatos_cli_raw.push(x); });

    var dp_prop_cts = _dedupCts(antigo_cts,  prop_cts);
    dp_prop_cts.para_adicionar.forEach(function (x) { candidatos_cts_raw.push(x); });

    // ── 9. Deduplicar candidatos contra existentes ────────────
    var dedup_cli  = _dedupCli(existentes_cli,   candidatos_cli_raw);
    var dedup_cts  = _dedupCts(existentes_cts,   candidatos_cts_raw);
    var dedup_hist = _dedupHist(existentes_hist, candidatos_hist_raw);

    // ── 10. Classificar riscos ────────────────────────────────
    var riscos = [];

    if (antigo_cli.length > 0) {
      riscos.push({
        nivel: 'aviso',
        msg: antigo_cli.length + ' clientes encontrados nas chaves globais antigas sem empresa_id. '
           + 'Confirme que pertencem à empresa "' + enome + '" antes de recuperar.'
      });
    }
    if (antigo_hist.length > 0) {
      riscos.push({
        nivel: 'aviso',
        msg: antigo_hist.length + ' registros de histórico antigos sem empresa_id. '
           + 'Serão recuperados somente para a empresa ativa (' + enome + ').'
      });
    }
    var semCnpj   = dedup_cli.para_adicionar.filter(function (c) { return !c.cnpj || !_normCnpj(c.cnpj).length; }).length;
    var semCidade = dedup_cli.para_adicionar.filter(function (c) { return !c.cidade || !c.cidade.trim(); }).length;
    if (semCnpj > 0) {
      riscos.push({ nivel: 'info', msg: semCnpj + ' clientes sem CNPJ (podem ser adicionados assim mesmo).' });
    }
    if (semCidade > 0) {
      riscos.push({ nivel: 'info', msg: semCidade + ' clientes sem cidade (podem ser adicionados assim mesmo).' });
    }
    if (!window.sbClient) {
      riscos.push({ nivel: 'aviso', msg: 'Supabase não conectado — dados da nuvem não foram lidos.' });
    }

    // ── 11. Resumo ────────────────────────────────────────────
    var resumo = {
      empresa_id:   eid,
      empresa_nome: enome,

      // Fontes encontradas
      antigos_ls_cli:  ls_cli_antigo.length,
      antigos_ls_cts:  ls_cts_antigo.length,
      antigos_ls_hist: ls_hist_antigo.length,
      antigos_sb_cli:  sb_cli_antigo.length,
      antigos_sb_cts:  sb_cts_antigo.length,
      antigos_sb_hist: sb_hist_antigo.length,

      // De propostas
      de_propostas_cli: prop_cli.length,
      de_propostas_cts: prop_cts.length,

      // Existentes na empresa
      existentes_cli:  existentes_cli.length,
      existentes_cts:  existentes_cts.length,
      existentes_hist: existentes_hist.length,

      // O que pode ser recuperado
      clientes_recuperaveis:  dedup_cli.para_adicionar.length,
      contatos_recuperaveis:  dedup_cts.para_adicionar.length,
      historico_recuperavel:  dedup_hist.para_adicionar.length,

      // Duplicados ignorados
      duplicados_cli:  dedup_cli.duplicados.length,
      duplicados_cts:  dedup_cts.duplicados.length,
      duplicados_hist: dedup_hist.duplicados.length,

      // Incompletos
      sem_cnpj:   semCnpj,
      sem_cidade: semCidade,

      riscos: riscos.length,
      aviso: 'MODO PRÉVIA — nenhum dado foi alterado ou inserido.'
    };

    console.info('[Recovery] Prévia concluída:', resumo);

    return {
      empresa_id:   eid,
      empresa_nome: enome,

      // Dados brutos por fonte (para inspeção)
      fontes: {
        ls_cli_antigo:  ls_cli_antigo,
        ls_cts_antigo:  ls_cts_antigo,
        ls_hist_antigo: ls_hist_antigo,
        sb_cli_antigo:  sb_cli_antigo,
        sb_cts_antigo:  sb_cts_antigo,
        sb_hist_antigo: sb_hist_antigo,
        prop_cli:       prop_cli,
        prop_cts:       prop_cts
      },

      existentes: {
        clientes:  existentes_cli,
        contatos:  existentes_cts,
        historico: existentes_hist
      },

      para_recuperar: {
        clientes:  dedup_cli.para_adicionar,
        contatos:  dedup_cts.para_adicionar,
        historico: dedup_hist.para_adicionar
      },

      duplicados: {
        clientes:  dedup_cli.duplicados,
        contatos:  dedup_cts.duplicados,
        historico: dedup_hist.duplicados
      },

      riscos:  riscos,
      resumo:  resumo
    };
  }

  // ============================================================
  // APLICAÇÃO CONTROLADA
  // ============================================================

  async function aplicar(preview) {
    if (!preview || !preview.para_recuperar) {
      throw new Error('[Recovery] Prévia inválida. Execute RelacionamentoRecoveryPreview.executar() primeiro.');
    }

    // ── Validar que a empresa não mudou desde a prévia ────────
    var eid = _getEmpresaId();
    if (!eid) {
      throw new Error('[Recovery] Empresa ativa não encontrada. Verifique o login.');
    }
    if (eid !== preview.empresa_id) {
      throw new Error(
        '[Recovery] A empresa ativa mudou desde a prévia! '
        + 'Prévia era para "' + preview.empresa_nome + '" (' + preview.empresa_id + '), '
        + 'agora a empresa ativa é ' + _getEmpresaNome() + ' (' + eid + '). '
        + 'Execute a prévia novamente.'
      );
    }

    // ── Confirmação obrigatória ───────────────────────────────
    var PALAVRA_CHAVE = 'RECUPERAR RELACIONAMENTO';
    var digitado = window.prompt(
      'Para confirmar a recuperação de dados para a empresa "' + preview.empresa_nome + '",\n'
      + 'digite exatamente:\n\n'
      + PALAVRA_CHAVE
    );

    if (digitado === null) {
      return {
        cancelado: true,
        msg: 'Recuperação cancelada pelo usuário. Nenhum dado foi gravado.'
      };
    }

    if ((digitado || '').trim() !== PALAVRA_CHAVE) {
      return {
        cancelado: true,
        msg: 'Texto incorreto. Recuperação cancelada. Nenhum dado foi gravado.'
      };
    }

    console.info('[Recovery] Confirmação recebida. Iniciando aplicação para:', preview.empresa_nome, '(', eid, ')');

    var keyCli  = _keyFor('tf_clientes');
    var keyCts  = _keyFor('tf_contatos');
    var keyHist = _keyFor('tf_historico');

    if (!keyCli || !keyCts || !keyHist) {
      throw new Error('[Recovery] Chaves por empresa não puderam ser construídas. empresa_id: ' + eid);
    }

    var erros = [];
    var relatorio = {
      empresa_id:           eid,
      empresa_nome:         preview.empresa_nome,
      clientes_recuperados: 0,
      contatos_recuperados: 0,
      historico_recuperado: 0,
      duplicados_ignorados: {
        clientes:  preview.duplicados.clientes.length,
        contatos:  preview.duplicados.contatos.length,
        historico: preview.duplicados.historico.length
      },
      erros: [],
      cancelado: false
    };

    // ── Aplicar clientes ──────────────────────────────────────
    try {
      var cliAtual = _lsRead(keyCli);
      // Re-dedup de segurança: garante que nada duplica mesmo que a lista
      // tenha mudado entre a prévia e a aplicação
      var safeDedup = _dedupCli(cliAtual, preview.para_recuperar.clientes);
      var novosCli = safeDedup.para_adicionar;

      if (novosCli.length) {
        // Atribuir novo ID para evitar colisão com IDs de outra empresa
        novosCli = novosCli.map(function (c) {
          return {
            id:     _id('rec_cli'),
            nome:   c.nome   || '',
            cnpj:   c.cnpj   || '',
            cidade: c.cidade || '',
            criado: c.criado || new Date().toISOString(),
            _recuperado: true
          };
        });
        var cliMesclado = cliAtual.concat(novosCli);
        _lsWrite(keyCli, cliMesclado);
        await _sbWrite(keyCli, cliMesclado);
        relatorio.clientes_recuperados = novosCli.length;
        console.info('[Recovery] Clientes recuperados:', novosCli.length);
      }
    } catch (e) {
      erros.push('Clientes: ' + e.message);
      console.error('[Recovery] Erro ao recuperar clientes:', e);
    }

    // ── Aplicar contatos ──────────────────────────────────────
    try {
      var ctsAtual = _lsRead(keyCts);
      var safeDedupCts = _dedupCts(ctsAtual, preview.para_recuperar.contatos);
      var novosCts = safeDedupCts.para_adicionar;

      if (novosCts.length) {
        novosCts = novosCts.map(function (c) {
          return {
            id:          _id('rec_cts'),
            nome:        c.nome        || '',
            empresa:     c.empresa     || '',
            email:       c.email       || '',
            telefone:    c.telefone    || '',
            departamento:c.departamento|| '',
            criado:      c.criado      || new Date().toISOString(),
            _recuperado: true
          };
        });
        var ctsMesclado = ctsAtual.concat(novosCts);
        _lsWrite(keyCts, ctsMesclado);
        await _sbWrite(keyCts, ctsMesclado);
        relatorio.contatos_recuperados = novosCts.length;
        console.info('[Recovery] Contatos recuperados:', novosCts.length);
      }
    } catch (e) {
      erros.push('Contatos: ' + e.message);
      console.error('[Recovery] Erro ao recuperar contatos:', e);
    }

    // ── Aplicar histórico ─────────────────────────────────────
    try {
      var histAtual = _lsRead(keyHist);
      var safeDedupHist = _dedupHist(histAtual, preview.para_recuperar.historico);
      var novosHist = safeDedupHist.para_adicionar;

      if (novosHist.length) {
        novosHist = novosHist.map(function (h) {
          return Object.assign({}, h, { _recuperado: true });
        });
        var histMesclado = histAtual.concat(novosHist);
        _lsWrite(keyHist, histMesclado);
        await _sbWrite(keyHist, histMesclado);
        relatorio.historico_recuperado = novosHist.length;
        console.info('[Recovery] Histórico recuperado:', novosHist.length);
      }
    } catch (e) {
      erros.push('Histórico: ' + e.message);
      console.error('[Recovery] Erro ao recuperar histórico:', e);
    }

    // ── Atualizar UI ──────────────────────────────────────────
    try { if (typeof window.renderTabelaClientes === 'function') window.renderTabelaClientes(); } catch (e) {}
    try { if (typeof window.renderTabelaContatos === 'function') window.renderTabelaContatos(); } catch (e) {}
    try {
      if (typeof window.renderLista === 'undefined' && typeof window.rHistorico === 'function') {
        window.rHistorico();
      }
    } catch (e) {}

    relatorio.erros = erros;

    console.info('[Recovery] Aplicação concluída:', relatorio);
    return relatorio;
  }

  // ============================================================
  // EXPOSIÇÃO PÚBLICA
  // ============================================================

  window.RelacionamentoRecoveryPreview = { executar: executarPrevia };
  window.RelacionamentoRecoveryApply   = { aplicar: aplicar };

  // ============================================================
  // FUNÇÕES DE UI
  // ============================================================

  // Armazena a última prévia executada
  window._rrPreview = null;

  // Atualiza o cabeçalho da seção de recuperação com empresa ativa
  window.rrRenderizarEmpresaInfo = function () {
    var el = document.getElementById('rrEmpresaInfo');
    if (!el) return;
    var eid   = _getEmpresaId();
    var enome = _getEmpresaNome();
    if (!eid) {
      el.innerHTML = '<div style="color:var(--text3);font-size:.77rem">⚠️ Nenhuma empresa ativa detectada.</div>';
      return;
    }
    el.innerHTML =
      '<div style="display:flex;align-items:center;gap:.5rem;font-size:.77rem;color:var(--text2)">'
      + '<span style="background:var(--blue);color:#fff;border-radius:4px;padding:.15rem .45rem;font-size:.7rem;font-weight:700">'
      + _escHtml(enome) + '</span>'
      + '<span>Dados serão recuperados <strong>somente</strong> para esta empresa.</span>'
      + '</div>';
  };

  function _setBtnAplicar(enabled) {
    var btn = document.getElementById('rrBtnAplicar');
    if (!btn) return;
    btn.disabled = !enabled;
    btn.style.opacity       = enabled ? '1'            : '.45';
    btn.style.cursor        = enabled ? 'pointer'      : 'not-allowed';
  }

  // Executa prévia e renderiza resultado
  window.rrExecutarPrevia = async function () {
    var el = document.getElementById('rrResultado');
    if (el) el.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--text3);font-size:.8rem">🔍 Analisando fontes de dados...</div>';
    _setBtnAplicar(false);
    window._rrPreview = null;

    try {
      var preview = await RelacionamentoRecoveryPreview.executar();
      window._rrPreview = preview;
      if (el) el.innerHTML = _renderPrevia(preview);
      _setBtnAplicar(preview.resumo.clientes_recuperaveis > 0
        || preview.resumo.contatos_recuperaveis > 0
        || preview.resumo.historico_recuperavel > 0);
    } catch (e) {
      if (el) el.innerHTML =
        '<div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;color:#ef4444;font-size:.77rem">'
        + '❌ Erro ao executar prévia: ' + _escHtml(e.message) + '</div>';
      console.error('[Recovery UI] Erro na prévia:', e);
    }
  };

  // Aplica recuperação com confirmação e renderiza resultado
  window.rrAplicarComConfirmacao = async function () {
    if (!window._rrPreview) {
      alert('Execute a prévia antes de aplicar a recuperação.');
      return;
    }
    var el = document.getElementById('rrResultado');

    try {
      var relatorio = await RelacionamentoRecoveryApply.aplicar(window._rrPreview);
      if (!relatorio.cancelado) {
        window._rrPreview = null; // invalida prévia após aplicação com sucesso
        _setBtnAplicar(false);
      }
      if (el) el.innerHTML = _renderRelatorio(relatorio);
    } catch (e) {
      if (el) {
        var extra = el.innerHTML;
        el.innerHTML =
          '<div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;color:#ef4444;font-size:.77rem;margin-bottom:.75rem">'
          + '❌ Erro ao aplicar: ' + _escHtml(e.message) + '</div>' + extra;
      }
      console.error('[Recovery UI] Erro na aplicação:', e);
    }
  };

  // ── Helpers de renderização ───────────────────────────────

  function _escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _badge(n, cor) {
    var c = cor || 'var(--blue)';
    return '<span style="display:inline-block;background:' + c + ';color:#fff;border-radius:4px;padding:.1rem .4rem;font-size:.68rem;font-weight:700;min-width:22px;text-align:center">' + n + '</span>';
  }

  function _row(label, valor, destaque) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.3rem 0;border-bottom:1px solid var(--border)">'
      + '<span style="font-size:.77rem;color:var(--text2)">' + label + '</span>'
      + '<span style="font-size:.77rem;font-weight:' + (destaque ? '700' : '400') + ';color:' + (destaque ? 'var(--text)' : 'var(--text3)') + '">' + valor + '</span>'
      + '</div>';
  }

  function _renderPrevia(p) {
    var r = p.resumo;
    var html = '';

    // Empresa
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.75rem;margin-bottom:.75rem">'
      + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.35rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Empresa ativa</div>'
      + '<div style="font-weight:700;color:var(--text);font-size:.88rem">' + _escHtml(r.empresa_nome) + '</div>'
      + '<div style="font-size:.7rem;color:var(--text3)">' + _escHtml(r.empresa_id) + '</div>'
      + '</div>';

    // Aviso multiempresa
    html += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.35);border-radius:6px;padding:.6rem .8rem;margin-bottom:.75rem;font-size:.75rem;color:var(--text2)">'
      + '⚠️ Os dados antigos nas chaves globais <strong>não possuem empresa_id</strong>. '
      + 'Confirme que pertencem à empresa <strong>' + _escHtml(r.empresa_nome) + '</strong> antes de aplicar.'
      + '</div>';

    // Resumo recuperável
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.75rem;margin-bottom:.75rem">'
      + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.45rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">O que pode ser recuperado</div>'
      + _row('Clientes recuperáveis',  _badge(r.clientes_recuperaveis,  r.clientes_recuperaveis  > 0 ? '#22c55e' : '#6b7280'), r.clientes_recuperaveis  > 0)
      + _row('Contatos recuperáveis',  _badge(r.contatos_recuperaveis,  r.contatos_recuperaveis  > 0 ? '#22c55e' : '#6b7280'), r.contatos_recuperaveis  > 0)
      + _row('Histórico recuperável',  _badge(r.historico_recuperavel,  r.historico_recuperavel  > 0 ? '#22c55e' : '#6b7280'), r.historico_recuperavel  > 0)
      + '</div>';

    // Fontes
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.75rem;margin-bottom:.75rem">'
      + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.45rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Fontes encontradas</div>'
      + _row('Clientes no localStorage antigo (global)',  r.antigos_ls_cli)
      + _row('Contatos no localStorage antigo (global)',  r.antigos_ls_cts)
      + _row('Histórico no localStorage antigo (global)', r.antigos_ls_hist)
      + _row('Clientes no Supabase antigo (global)',      r.antigos_sb_cli)
      + _row('Contatos no Supabase antigo (global)',      r.antigos_sb_cts)
      + _row('Histórico no Supabase antigo (global)',     r.antigos_sb_hist)
      + _row('Clientes reconstruíveis de propostas',      r.de_propostas_cli)
      + _row('Contatos reconstruíveis de propostas',      r.de_propostas_cts)
      + '</div>';

    // Já existentes
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.75rem;margin-bottom:.75rem">'
      + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.45rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Já existentes na empresa ativa</div>'
      + _row('Clientes existentes',  r.existentes_cli)
      + _row('Contatos existentes',  r.existentes_cts)
      + _row('Histórico existente',  r.existentes_hist)
      + '</div>';

    // Duplicados
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.75rem;margin-bottom:.75rem">'
      + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.45rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Duplicados — serão ignorados</div>'
      + _row('Clientes duplicados ignorados',  r.duplicados_cli)
      + _row('Contatos duplicados ignorados',  r.duplicados_cts)
      + _row('Histórico duplicado ignorado',   r.duplicados_hist)
      + _row('Clientes sem CNPJ',              r.sem_cnpj)
      + _row('Clientes sem cidade',            r.sem_cidade)
      + '</div>';

    // Riscos
    if (p.riscos.length) {
      html += '<div style="background:rgba(245,158,11,.06);border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:.75rem;margin-bottom:.75rem">'
        + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.45rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Riscos identificados</div>';
      p.riscos.forEach(function (r) {
        var icon = r.nivel === 'aviso' ? '⚠️' : 'ℹ️';
        html += '<div style="font-size:.75rem;color:var(--text2);padding:.25rem 0">' + icon + ' ' + _escHtml(r.msg) + '</div>';
      });
      html += '</div>';
    }

    // ── Listas detalhadas — abertas por padrão para inspeção antes de aplicar ──
    html += _renderListaDetalhada('🟢 Clientes que serão recuperados',  p.para_recuperar.clientes,  _cardCli,    'rec_cli',  true);
    html += _renderListaDetalhada('🟢 Contatos que serão recuperados',  p.para_recuperar.contatos,  _cardCts,    'rec_cts',  true);
    html += _renderListaDetalhada('🟢 Histórico que será recuperado',   p.para_recuperar.historico, _cardHist,   'rec_hist', true);
    // ── Duplicados — colapsados por padrão (info secundária) ─────────────────
    html += _renderListaDetalhada('⚪ Clientes duplicados (ignorados)', p.duplicados.clientes.map(function(d){return Object.assign({}, d.item, {_motivo:d.motivo});}), _cardDupCli, 'dup_cli', false);
    html += _renderListaDetalhada('⚪ Contatos duplicados (ignorados)', p.duplicados.contatos.map(function(d){return Object.assign({}, d.item, {_motivo:d.motivo});}), _cardDupCts, 'dup_cts', false);

    html += '<div style="font-size:.7rem;color:var(--text3);margin-top:.5rem;text-align:center">'
      + '✔ MODO PRÉVIA — nenhum dado foi gravado. Clique em "Aplicar Recuperação" para prosseguir.'
      + '</div>';

    return html;
  }

  // ── Badge de origem colorido ──────────────────────────────
  function _fonteBadge(fonte) {
    if (!fonte) return '';
    var cor = fonte === 'localStorage antigo' ? '#6366f1'
            : fonte === 'Supabase antigo'      ? '#0ea5e9'
            : fonte === 'proposta'              ? '#10b981'
            :                                    '#6b7280';
    return '<span style="display:inline-block;background:' + cor
      + ';color:#fff;border-radius:3px;padding:.07rem .32rem;font-size:.62rem;font-weight:600;margin-left:.3rem">'
      + _escHtml(fonte) + '</span>';
  }

  // ── Card: Cliente ─────────────────────────────────────────
  function _cardCli(c) {
    var cnpjOk   = c.cnpj   && _normCnpj(c.cnpj).length >= 11;
    var cidadeOk = c.cidade && c.cidade.trim();
    return '<div style="padding:.55rem .75rem;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.25rem;margin-bottom:.25rem">'
      +   '<span style="font-weight:700;font-size:.82rem;color:var(--text)">🏢 ' + _escHtml(c.nome || '—') + '</span>'
      +   _fonteBadge(c._fonte)
      + '</div>'
      + '<div style="font-size:.74rem;color:var(--text2);display:flex;gap:1.25rem;flex-wrap:wrap">'
      +   '<span>CNPJ: ' + (cnpjOk   ? _escHtml(c.cnpj)   : '<span style="color:#f59e0b">—</span>') + '</span>'
      +   '<span>Cidade: ' + (cidadeOk ? _escHtml(c.cidade) : '<span style="color:#f59e0b">—</span>') + '</span>'
      + '</div>'
      + (!cnpjOk   ? '<div style="font-size:.69rem;color:#f59e0b;margin-top:.18rem">⚠️ Sem CNPJ</div>'   : '')
      + (!cidadeOk ? '<div style="font-size:.69rem;color:#f59e0b;margin-top:.12rem">⚠️ Sem cidade</div>' : '')
      + '</div>';
  }

  // ── Card: Contato ─────────────────────────────────────────
  function _cardCts(c) {
    return '<div style="padding:.55rem .75rem;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.25rem;margin-bottom:.25rem">'
      +   '<span style="font-weight:700;font-size:.82rem;color:var(--text)">👤 ' + _escHtml(c.nome || '—') + '</span>'
      +   _fonteBadge(c._fonte)
      + '</div>'
      + '<div style="font-size:.73rem;color:var(--text2);display:grid;grid-template-columns:1fr 1fr;gap:.18rem .9rem">'
      +   '<span>Cliente: <strong>' + _escHtml(c.empresa     || '—') + '</strong></span>'
      +   '<span>E-mail: '          + _escHtml(c.email        || '—') + '</span>'
      +   '<span>Telefone: '        + _escHtml(c.telefone     || '—') + '</span>'
      +   '<span>Depto: '           + _escHtml(c.departamento || '—') + '</span>'
      + '</div>'
      + '</div>';
  }

  // ── Card: Histórico ───────────────────────────────────────
  function _cardHist(h) {
    var data   = (h.data   || '').slice(0, 16).replace('T', ' ');
    var resumo = h.resumo  || '';
    return '<div style="padding:.55rem .75rem;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.3rem;margin-bottom:.22rem">'
      +   (data    ? '<span style="font-size:.75rem;font-weight:700;color:var(--text)">'   + _escHtml(data)    + '</span>' : '')
      +   (h.canal ? '<span style="font-size:.7rem;color:var(--text3)">•</span><span style="font-size:.72rem;color:var(--text2)">' + _escHtml(h.canal) + '</span>' : '')
      +   (h.status? '<span style="font-size:.7rem;color:var(--text3)">•</span><span style="font-size:.7rem;color:var(--text3)">'  + _escHtml(h.status)+ '</span>' : '')
      +   _fonteBadge(h._fonte)
      + '</div>'
      + '<div style="font-size:.73rem;color:var(--text2);display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.2rem">'
      +   '<span>Cliente: <strong>' + _escHtml(h.cliente || '—')  + '</strong></span>'
      +   (h.contato     ? '<span>Contato: '     + _escHtml(h.contato)     + '</span>' : '')
      +   (h.responsavel ? '<span>Resp.: '       + _escHtml(h.responsavel) + '</span>' : '')
      +   (h.prioridade  ? '<span>Prior.: '      + _escHtml(h.prioridade)  + '</span>' : '')
      + '</div>'
      + (resumo ? '<div style="font-size:.72rem;color:var(--text3);overflow:hidden;max-height:3em">'
        + _escHtml(resumo.slice(0, 180)) + (resumo.length > 180 ? '…' : '') + '</div>' : '')
      + (h.proxima_acao ? '<div style="font-size:.7rem;color:var(--text3);margin-top:.2rem">⚡ ' + _escHtml(h.proxima_acao) + '</div>' : '')
      + '</div>';
  }

  // ── Card: Cliente duplicado ───────────────────────────────
  function _cardDupCli(c) {
    return '<div style="padding:.45rem .75rem;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.25rem;margin-bottom:.18rem">'
      +   '<span style="font-size:.78rem;font-weight:600;color:var(--text2)">🏢 ' + _escHtml(c.nome || '—') + '</span>'
      +   _fonteBadge(c._fonte)
      + '</div>'
      + '<div style="font-size:.72rem;color:var(--text2);display:flex;gap:.9rem;flex-wrap:wrap">'
      +   '<span>CNPJ: '   + _escHtml(c.cnpj   || '—') + '</span>'
      +   '<span>Cidade: ' + _escHtml(c.cidade  || '—') + '</span>'
      + '</div>'
      + '<div style="font-size:.69rem;color:#f59e0b;margin-top:.18rem">⚠️ ' + _escHtml(c._motivo || '') + '</div>'
      + '</div>';
  }

  // ── Card: Contato duplicado ───────────────────────────────
  function _cardDupCts(c) {
    return '<div style="padding:.45rem .75rem;border-bottom:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.25rem;margin-bottom:.18rem">'
      +   '<span style="font-size:.78rem;font-weight:600;color:var(--text2)">👤 ' + _escHtml(c.nome || '—') + '</span>'
      +   _fonteBadge(c._fonte)
      + '</div>'
      + '<div style="font-size:.72rem;color:var(--text2);display:flex;gap:.9rem;flex-wrap:wrap">'
      +   (c.empresa ? '<span>Cliente: ' + _escHtml(c.empresa) + '</span>' : '')
      +   (c.email   ? '<span>E-mail: '  + _escHtml(c.email)   + '</span>' : '')
      + '</div>'
      + '<div style="font-size:.69rem;color:#f59e0b;margin-top:.18rem">⚠️ ' + _escHtml(c._motivo || '') + '</div>'
      + '</div>';
  }

  // ── Lista detalhada expansível (expandido = abre por padrão) ─
  function _renderListaDetalhada(titulo, lista, cardFn, domId, expandido) {
    if (!lista.length) return '';
    var id  = 'rrLista_' + domId;
    var aberto = expandido ? 'block' : 'none';
    var icone  = expandido ? '▲' : '▼';
    var corBadge = lista.length > 0 ? (expandido ? '#22c55e' : '#6b7280') : '#6b7280';
    var html = '<div style="border:1px solid var(--border);border-radius:6px;margin-bottom:.7rem;overflow:hidden">';
    // Cabeçalho clicável
    html += '<div '
      + 'onclick="(function(el,ic){'
      +   'el.style.display=el.style.display===\'none\'?\'block\':\'none\';'
      +   'ic.textContent=el.style.display===\'none\'?\'▼\':\'▲\';'
      + '})(document.getElementById(\'' + id + '\'),this.querySelector(\'.rr-ic\'))" '
      + 'style="cursor:pointer;padding:.52rem .75rem;display:flex;justify-content:space-between;align-items:center;background:var(--bg3)">'
      +   '<span style="font-size:.76rem;font-weight:700;color:var(--text2)">' + _escHtml(titulo) + '</span>'
      +   '<span style="display:flex;align-items:center;gap:.4rem">'
      +     _badge(lista.length, corBadge)
      +     '<span class="rr-ic" style="font-size:.68rem;color:var(--text3)">' + icone + '</span>'
      +   '</span>'
      + '</div>';
    // Corpo
    html += '<div id="' + id + '" style="display:' + aberto + ';max-height:460px;overflow-y:auto;background:var(--bg2)">';
    lista.forEach(function (item) { html += cardFn(item); });
    html += '</div></div>';
    return html;
  }

  function _renderRelatorio(rel) {
    if (rel.cancelado) {
      return '<div style="padding:1rem;background:rgba(107,114,128,.08);border:1px solid var(--border);border-radius:6px;font-size:.78rem;color:var(--text2)">'
        + '🚫 ' + _escHtml(rel.msg) + '</div>';
    }

    var html = '<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.35);border-radius:6px;padding:.85rem;margin-bottom:.75rem">'
      + '<div style="font-weight:700;color:#22c55e;font-size:.9rem;margin-bottom:.5rem">✅ Recuperação concluída — ' + _escHtml(rel.empresa_nome) + '</div>'
      + _row('Clientes recuperados',  _badge(rel.clientes_recuperados, '#22c55e'), rel.clientes_recuperados > 0)
      + _row('Contatos recuperados',  _badge(rel.contatos_recuperados, '#22c55e'), rel.contatos_recuperados > 0)
      + _row('Histórico recuperado',  _badge(rel.historico_recuperado, '#22c55e'), rel.historico_recuperado > 0)
      + _row('Clientes dup. ignorados', rel.duplicados_ignorados.clientes)
      + _row('Contatos dup. ignorados', rel.duplicados_ignorados.contatos)
      + _row('Histórico dup. ignorado', rel.duplicados_ignorados.historico)
      + '</div>';

    if (rel.erros.length) {
      html += '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:.75rem;margin-bottom:.75rem">'
        + '<div style="font-size:.74rem;font-weight:600;color:#ef4444;margin-bottom:.3rem">Erros encontrados</div>';
      rel.erros.forEach(function (e) {
        html += '<div style="font-size:.73rem;color:var(--text2)">• ' + _escHtml(e) + '</div>';
      });
      html += '</div>';
    }

    if (rel.clientes_recuperados === 0 && rel.contatos_recuperados === 0 && rel.historico_recuperado === 0) {
      html += '<div style="font-size:.75rem;color:var(--text3);text-align:center;padding:.5rem">'
        + 'Nenhum item novo foi adicionado (todos já existiam ou não havia dados para recuperar).'
        + '</div>';
    }

    html += '<div style="font-size:.7rem;color:var(--text3);margin-top:.5rem;text-align:center">'
      + 'Para verificar, abra as seções Empresas e Contatos no menu Relacionamento.'
      + '</div>';

    return html;
  }

  console.info('[RelacionamentoRecovery] Carregado. '
    + 'Prévia: window.RelacionamentoRecoveryPreview.executar() | '
    + 'Aplicar: window.RelacionamentoRecoveryApply.aplicar(preview)');

}(window));

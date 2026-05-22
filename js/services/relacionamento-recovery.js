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
      // [CURADORIA] Renderiza em modo curadoria manual — sem aplicação automática
      if (el) el.innerHTML = _renderCuradoria(preview);
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

  // [CURADORIA] Aplica somente os itens selecionados pelo utilizador
  // Redireciona para rrAplicarSelecionados() — sem aplicação em massa automática.
  window.rrAplicarComConfirmacao = async function () {
    if (!window._rrPreview) {
      alert('Execute a prévia antes de aplicar a recuperação.');
      return;
    }
    // [CURADORIA] Verificar DataGuard
    if (typeof window.dgCheckBloqueio === 'function' && window.dgCheckBloqueio('Aplicar Recuperação')) return;
    // Delegar para o fluxo de curadoria manual
    if (typeof window.rrAplicarSelecionados === 'function') {
      return window.rrAplicarSelecionados();
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

  // ============================================================
  // CURADORIA MANUAL — renderização e aplicação seletiva
  // Nada aplica automaticamente. Cada item tem checkbox + edição.
  // ============================================================

  // ── CSS injetado uma vez ────────────────────────────────────
  (function () {
    if (document.getElementById('rr-curadoria-style')) return;
    var s = document.createElement('style');
    s.id = 'rr-curadoria-style';
    s.textContent =
      '.rr-inp{width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);'
      + 'border-radius:4px;padding:.28rem .45rem;font-size:.74rem;font-family:inherit;box-sizing:border-box}'
      + '.rr-inp:focus{outline:none;border-color:var(--blue)}'
      + '.rr-lbl{font-size:.65rem;color:var(--text3);margin-bottom:.18rem;display:block}'
      + '.rr-sel{background:var(--bg3);border:1px solid var(--border);color:var(--text);'
      + 'border-radius:4px;padding:.22rem .38rem;font-size:.72rem;font-family:inherit;cursor:pointer}'
      + '.rr-card{border:1px solid var(--border);border-radius:6px;margin-bottom:.45rem;overflow:hidden}'
      + '.rr-card-hdr{display:flex;align-items:center;gap:.55rem;padding:.42rem .65rem;background:var(--bg3);flex-wrap:wrap}'
      + '.rr-card-body{padding:.55rem .65rem;background:var(--bg2)}'
      + '.rr-grid2{display:grid;grid-template-columns:1fr 1fr;gap:.35rem .75rem}'
      + '.rr-grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.35rem .75rem}'
      + '.rr-warn{font-size:.7rem;color:#f59e0b;margin-top:.3rem}'
      + '.rr-badge-fonte{display:inline-block;border-radius:3px;padding:.06rem .3rem;font-size:.62rem;font-weight:600;color:#fff}'
      + '.rr-dup-item{padding:.4rem .65rem;border-bottom:1px solid var(--border);font-size:.76rem;color:var(--text2)}';
    document.head.appendChild(s);
  }());

  // ── Helpers de ID ───────────────────────────────────────────
  function _cidC(i, campo) { return 'rrC_' + i + '_' + campo; }
  function _cidT(j, campo) { return 'rrT_' + j + '_' + campo; }

  // ── Cores de fonte ──────────────────────────────────────────
  function _corFonte(f) {
    if (!f) return '#6b7280';
    f = String(f).toLowerCase();
    if (f.includes('supabase')) return '#0ea5e9';
    if (f.includes('localStorage antigo') || f.includes('local')) return '#6366f1';
    if (f.includes('proposta')) return '#10b981';
    if (f.includes('hist')) return '#f59e0b';
    return '#6b7280';
  }
  function _badgeFonte(f) {
    if (!f) return '';
    return '<span class="rr-badge-fonte" style="background:' + _corFonte(f) + '">' + _escHtml(f) + '</span>';
  }

  // ── Render: campo de input ──────────────────────────────────
  function _inp(id, valor, placeholder) {
    return '<input type="text" id="' + id + '" class="rr-inp" value="' + _escHtml(valor || '') + '"'
         + (placeholder ? ' placeholder="' + _escHtml(placeholder) + '"' : '') + '>';
  }

  // ── Toggle visibilidade do body do card ─────────────────────
  window._rrToggleCard = function (tipo, idx) {
    var id = tipo === 'cli' ? _cidC(idx, 'body') : _cidT(idx, 'body');
    var acao = (document.getElementById(tipo === 'cli' ? _cidC(idx, 'acao') : _cidT(idx, 'acao')) || {}).value || 'criar';
    var el = document.getElementById(id);
    if (!el) return;
    var ocultar = (acao === 'ignorar' || acao === 'revisar' || acao === 'legado');
    el.style.display = ocultar ? 'none' : '';
    window._rrAtualizarContadores();
  };

  // ── Atualizar contadores ────────────────────────────────────
  window._rrAtualizarContadores = function () {
    if (!window._rrPreview) return;
    var cli  = window._rrPreview.para_recuperar.clientes;
    var cts  = window._rrPreview.para_recuperar.contatos;
    var nCli = cli.length, nCts = cts.length;
    var sCli = 0, sCts = 0, ign = 0, rev = 0, leg = 0;
    for (var i = 0; i < nCli; i++) {
      var chk = document.getElementById(_cidC(i, 'sel'));
      if (!chk || !chk.checked) continue;
      var acao = (document.getElementById(_cidC(i, 'acao')) || {}).value || 'criar';
      if (acao === 'ignorar') { ign++; continue; }
      if (acao === 'revisar') { rev++; continue; }
      if (acao === 'legado')  { leg++; continue; }
      sCli++;
    }
    for (var j = 0; j < nCts; j++) {
      var chkT = document.getElementById(_cidT(j, 'sel'));
      if (!chkT || !chkT.checked) continue;
      var acaoT = (document.getElementById(_cidT(j, 'acao')) || {}).value || 'criar';
      if (acaoT === 'ignorar' || acaoT === 'revisar') continue;
      sCts++;
    }
    var total = sCli + sCts;
    var el = document.getElementById('rr-cont');
    if (!el) return;
    el.innerHTML =
      '<span style="margin-right:.6rem">🔍 ' + nCli + ' clientes · ' + nCts + ' contatos encontrados</span>'
      + '<span style="color:#22c55e;font-weight:700;margin-right:.5rem">✅ ' + total + ' selecionados para aplicar</span>'
      + (ign  ? '<span style="color:#6b7280;margin-right:.5rem">⏭ ' + ign + ' ignorados</span>' : '')
      + (rev  ? '<span style="color:#f59e0b;margin-right:.5rem">⏳ ' + rev + ' revisar</span>' : '')
      + (leg  ? '<span style="color:#ef4444;margin-right:.5rem">🚩 ' + leg + ' legado</span>' : '');
    // Atualizar texto do botão
    var btn = document.getElementById('rr-btn-sel');
    if (btn) btn.textContent = total > 0 ? ('✅ Aplicar ' + total + ' selecionados') : '✅ Aplicar selecionados';
  };

  // ── Card de cliente (curadoria) ────────────────────────────
  function _cardCuradoriaCli(c, i, existentes) {
    // Verificar se já existe na empresa ativa
    var cn = _normCnpj(c.cnpj || '');
    var jáExiste = existentes.find(function (e) {
      if (cn && _normCnpj(e.cnpj || '') === cn) return true;
      if (_norm(e.nome) === _norm(c.nome)) return true;
      return false;
    });

    var selId  = _cidC(i, 'sel');
    var acaoId = _cidC(i, 'acao');
    var bodyId = _cidC(i, 'body');

    var html = '<div class="rr-card">';

    // Cabeçalho do card
    html += '<div class="rr-card-hdr">'
          + '<input type="checkbox" id="' + selId + '" checked '
          + 'onchange="window._rrAtualizarContadores()" style="width:15px;height:15px;cursor:pointer;flex-shrink:0">'
          + '<label for="' + selId + '" style="font-weight:700;font-size:.8rem;cursor:pointer;flex:1">'
          + '🏢 ' + _escHtml(c.nome || '—') + '</label>'
          + _badgeFonte(c._fonte)
          + (jáExiste ? '<span style="font-size:.67rem;background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.4);border-radius:3px;padding:.05rem .3rem;color:#f59e0b">⚠️ já existe</span>' : '')
          + '<select id="' + acaoId + '" class="rr-sel"'
          + ' onchange="window._rrToggleCard(\'cli\',' + i + ')" style="margin-left:auto">'
          + '<option value="criar">Criar novo</option>'
          + '<option value="completar">Completar existente</option>'
          + '<option value="ignorar">Ignorar</option>'
          + '<option value="revisar">Revisar depois</option>'
          + '<option value="legado">Legado suspeito</option>'
          + '</select>'
          + '</div>';

    // Corpo editável
    html += '<div id="' + bodyId + '" class="rr-card-body">';

    // Se já existe: mostrar comparação
    if (jáExiste) {
      html += '<div style="background:rgba(245,158,11,.07);border:1px solid rgba(245,158,11,.25);border-radius:4px;padding:.4rem .55rem;margin-bottom:.45rem;font-size:.72rem;color:var(--text2)">'
            + '⚠️ Já existe na empresa ativa: <strong>' + _escHtml(jáExiste.nome) + '</strong>'
            + (jáExiste.cnpj  ? ' | CNPJ: ' + _escHtml(jáExiste.cnpj)  : ' | CNPJ: —')
            + (jáExiste.cidade? ' | Cidade: ' + _escHtml(jáExiste.cidade): ' | Cidade: —')
            + '<br><span style="color:#f59e0b">Ação "Criar novo" adicionará este como entrada separada. '
            + 'Use "Completar existente" para preencher campos vazios do registro acima.</span>'
            + '</div>';
    }

    // Campos editáveis
    html += '<div class="rr-grid2" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Nome / Razão Social *</label>' + _inp(_cidC(i,'nome'), c.nome) + '</div>'
          + '<div><label class="rr-lbl">CNPJ</label>' + _inp(_cidC(i,'cnpj'), c.cnpj) + '</div>'
          + '</div>'
          + '<div class="rr-grid3" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Cidade</label>' + _inp(_cidC(i,'cidade'), c.cidade) + '</div>'
          + '<div><label class="rr-lbl">UF</label><input type="text" id="' + _cidC(i,'uf') + '" class="rr-inp" value="' + _escHtml(c.uf||'') + '" maxlength="2"></div>'
          + '<div><label class="rr-lbl">CEP</label>' + _inp(_cidC(i,'cep'), c.cep||'', '00000-000') + '</div>'
          + '</div>'
          + '<div class="rr-grid2" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Telefone</label>' + _inp(_cidC(i,'tel'), c.telefone||'') + '</div>'
          + '<div><label class="rr-lbl">E-mail</label>' + _inp(_cidC(i,'email'), c.email||'') + '</div>'
          + '</div>'
          + '<div><label class="rr-lbl">Endereço</label>' + _inp(_cidC(i,'end'), c.endereco||'') + '</div>'
          + '<div style="margin-top:.35rem"><label class="rr-lbl">Observação</label>' + _inp(_cidC(i,'obs'), '') + '</div>';

    // Origem detalhada
    html += '<div style="font-size:.67rem;color:var(--text3);margin-top:.4rem">Origem: ' + _badgeFonte(c._fonte)
          + (c.criado ? ' · criado: ' + String(c.criado).slice(0,10) : '') + '</div>';

    html += '</div>'; // fim body
    html += '</div>'; // fim card
    return html;
  }

  // ── Card de contato (curadoria) ────────────────────────────
  function _cardCuradoriaCts(c, j, existentes_cts, existentes_cli) {
    // Verificar se empresa vinculada existe
    var empresaOk = false;
    var empresa   = (c.empresa || '').trim();
    if (empresa && existentes_cli) {
      empresaOk = existentes_cli.some(function (e) {
        return _norm(e.nome) === _norm(empresa);
      });
    }

    var selId  = _cidT(j, 'sel');
    var acaoId = _cidT(j, 'acao');
    var bodyId = _cidT(j, 'body');

    var html = '<div class="rr-card">';

    // Cabeçalho
    html += '<div class="rr-card-hdr">'
          + '<input type="checkbox" id="' + selId + '" ' + (empresaOk ? 'checked' : '') + ' '
          + 'onchange="window._rrAtualizarContadores()" style="width:15px;height:15px;cursor:pointer;flex-shrink:0">'
          + '<label for="' + selId + '" style="font-weight:700;font-size:.8rem;cursor:pointer;flex:1">'
          + '👤 ' + _escHtml(c.nome || '—') + '</label>'
          + _badgeFonte(c._fonte)
          + (!empresaOk ? '<span style="font-size:.67rem;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);border-radius:3px;padding:.05rem .3rem;color:#ef4444">⚠️ empresa não encontrada</span>' : '')
          + '<select id="' + acaoId + '" class="rr-sel"'
          + ' onchange="window._rrToggleCard(\'cts\',' + j + ')" style="margin-left:auto">'
          + '<option value="criar">Criar novo</option>'
          + '<option value="completar">Completar existente</option>'
          + '<option value="ignorar">Ignorar</option>'
          + '<option value="revisar">Revisar depois</option>'
          + '</select>'
          + '</div>';

    // Aviso empresa não encontrada
    if (!empresaOk) {
      html += '<div style="background:rgba(239,68,68,.06);border-bottom:1px solid var(--border);padding:.35rem .65rem;font-size:.71rem;color:#ef4444">'
            + '⚠️ Empresa "' + _escHtml(empresa || '(vazia)') + '" não encontrada na empresa ativa. '
            + 'Complete ou corrija o campo abaixo antes de aplicar. Contato desmarcado por padrão.'
            + '</div>';
    }

    // Corpo editável
    html += '<div id="' + bodyId + '" class="rr-card-body">';
    html += '<div class="rr-grid2" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Nome *</label>' + _inp(_cidT(j,'nome'), c.nome) + '</div>'
          + '<div><label class="rr-lbl">Empresa vinculada *</label>' + _inp(_cidT(j,'empresa'), c.empresa, 'Razão social da empresa...') + '</div>'
          + '</div>'
          + '<div class="rr-grid2" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Departamento / Função</label>' + _inp(_cidT(j,'dept'), c.departamento) + '</div>'
          + '<div><label class="rr-lbl">E-mail</label>' + _inp(_cidT(j,'email'), c.email) + '</div>'
          + '</div>'
          + '<div class="rr-grid2" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Telefone</label>' + _inp(_cidT(j,'tel'), c.telefone) + '</div>'
          + '<div><label class="rr-lbl">Observação</label>' + _inp(_cidT(j,'obs'), '') + '</div>'
          + '</div>';
    html += '<div style="font-size:.67rem;color:var(--text3);margin-top:.3rem">Origem: ' + _badgeFonte(c._fonte)
          + (c.criado ? ' · criado: ' + String(c.criado).slice(0,10) : '') + '</div>';
    html += '</div></div>';
    return html;
  }

  // ── _renderCuradoria: substituição de _renderPrevia ─────────
  function _renderCuradoria(p) {
    var r = p.resumo;
    var html = '';

    // ── Banner modo curadoria ───────────────────────────────
    html += '<div style="background:rgba(14,165,233,.09);border:1px solid rgba(14,165,233,.3);border-radius:6px;'
          + 'padding:.55rem .8rem;margin-bottom:.75rem;font-size:.78rem;color:var(--text2)">'
          + '✋ <strong>Modo curadoria manual</strong> — nada será aplicado sem seleção explícita. '
          + 'Marque os itens desejados, edite os campos e clique em <strong>Aplicar selecionados</strong>.'
          + '</div>';

    // ── Empresa ─────────────────────────────────────────────
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;'
          + 'padding:.55rem .8rem;margin-bottom:.75rem;display:flex;align-items:center;gap:.6rem">'
          + '<span style="background:var(--blue);color:#fff;border-radius:4px;padding:.15rem .45rem;font-size:.7rem;font-weight:700">'
          + _escHtml(r.empresa_nome) + '</span>'
          + '<span style="font-size:.74rem;color:var(--text2)">ID: ' + _escHtml(r.empresa_id) + '</span>'
          + '</div>';

    // ── Contadores ao vivo ──────────────────────────────────
    html += '<div id="rr-cont" style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;'
          + 'padding:.45rem .8rem;margin-bottom:.75rem;font-size:.74rem;display:flex;flex-wrap:wrap;gap:.3rem .6rem">'
          + '🔍 ' + r.existentes_cli + ' clientes existentes · '
          + p.para_recuperar.clientes.length + ' recuperáveis · '
          + p.para_recuperar.contatos.length + ' contatos recuperáveis · '
          + p.duplicados.clientes.length + ' duplicados ignorados'
          + '</div>';

    // ── Clientes recuperáveis ───────────────────────────────
    if (p.para_recuperar.clientes.length) {
      html += '<div style="font-size:.78rem;font-weight:700;color:var(--text);margin-bottom:.4rem">'
            + '🏢 Clientes recuperáveis (' + p.para_recuperar.clientes.length + ')'
            + '<span style="font-size:.68rem;font-weight:400;color:var(--text3);margin-left:.5rem">'
            + '— marque para aplicar, edite conforme necessário</span></div>';
      p.para_recuperar.clientes.forEach(function (c, i) {
        html += _cardCuradoriaCli(c, i, p.existentes.clientes);
      });
    } else {
      html += '<div style="font-size:.77rem;color:var(--text3);padding:.5rem 0">Nenhum cliente novo recuperável.</div>';
    }

    // ── Contatos recuperáveis ───────────────────────────────
    if (p.para_recuperar.contatos.length) {
      html += '<div style="font-size:.78rem;font-weight:700;color:var(--text);margin:.75rem 0 .4rem">'
            + '👤 Contatos recuperáveis (' + p.para_recuperar.contatos.length + ')'
            + '<span style="font-size:.68rem;font-weight:400;color:var(--text3);margin-left:.5rem">'
            + '— contatos sem empresa vinculada ficam desmarcados</span></div>';
      p.para_recuperar.contatos.forEach(function (c, j) {
        html += _cardCuradoriaCts(c, j, p.existentes.contatos, p.existentes.clientes);
      });
    }

    // ── Duplicados (leitura, marcados como tal) ─────────────
    if (p.duplicados.clientes.length) {
      html += '<div style="font-size:.77rem;font-weight:700;color:var(--text3);margin:.75rem 0 .3rem">'
            + '⚪ Clientes duplicados — não serão aplicados automaticamente (' + p.duplicados.clientes.length + ')</div>';
      html += '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:.5rem">';
      p.duplicados.clientes.forEach(function (d) {
        html += '<div class="rr-dup-item">'
              + '🏢 <strong>' + _escHtml((d.item||d).nome||'—') + '</strong>'
              + _badgeFonte((d.item||d)._fonte)
              + ' <span style="color:#f59e0b;font-size:.68rem">· ' + _escHtml(d.motivo||'duplicado') + '</span>'
              + '</div>';
      });
      html += '</div>';
    }
    if (p.duplicados.contatos.length) {
      html += '<div style="font-size:.77rem;font-weight:700;color:var(--text3);margin:.5rem 0 .3rem">'
            + '⚪ Contatos duplicados — não serão aplicados automaticamente (' + p.duplicados.contatos.length + ')</div>';
      html += '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:.5rem">';
      p.duplicados.contatos.forEach(function (d) {
        html += '<div class="rr-dup-item">'
              + '👤 <strong>' + _escHtml((d.item||d).nome||'—') + '</strong>'
              + _badgeFonte((d.item||d)._fonte)
              + ' <span style="color:#f59e0b;font-size:.68rem">· ' + _escHtml(d.motivo||'duplicado') + '</span>'
              + '</div>';
      });
      html += '</div>';
    }

    // ── Botão aplicar selecionados ──────────────────────────
    html += '<div style="margin-top:.85rem;padding-top:.65rem;border-top:1px solid var(--border);'
          + 'display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem">'
          + '<div style="font-size:.72rem;color:var(--text3)">'
          + '⚠️ A aplicação exige confirmação digitando <strong>APLICAR SELECIONADOS RELACIONAMENTO</strong>.'
          + '<br>Backup automático será criado antes de qualquer gravação.'
          + '</div>'
          + '<button id="rr-btn-sel" class="nb" onclick="window.rrAplicarSelecionados()" '
          + 'style="background:var(--blue);color:#fff;border-radius:6px;padding:.45rem 1.1rem;'
          + 'font-size:.78rem;font-weight:700;white-space:nowrap">'
          + '✅ Aplicar selecionados'
          + '</button></div>';

    html += '<div style="font-size:.69rem;color:var(--text3);text-align:center;margin-top:.4rem">'
          + '✔ MODO CURADORIA — nada foi gravado ainda.'
          + '</div>';

    // Inicializar contadores após render (DOM atualizado)
    html += '<script>setTimeout(function(){if(typeof window._rrAtualizarContadores==="function")window._rrAtualizarContadores();},80);<\/script>';

    return html;
  }

  // ── rrAplicarSelecionados: aplicação curada ─────────────────
  window.rrAplicarSelecionados = async function () {
    if (!window._rrPreview) {
      alert('Execute a prévia antes de aplicar a recuperação.');
      return;
    }

    // DataGuard
    if (typeof window.dgCheckBloqueio === 'function' && window.dgCheckBloqueio('Aplicar Selecionados')) return;

    // Validar empresa
    var eid    = window._rrPreview.empresa_id;
    var eidNow = _getEmpresaId();
    if (!eid || eid !== eidNow) {
      alert('Empresa ativa mudou desde a prévia!\n\nPrévia era para: ' + window._rrPreview.empresa_nome
            + '\nEmpresa atual:  ' + _getEmpresaNome() + '\n\nExecute a prévia novamente.');
      return;
    }

    // ── Coletar clientes selecionados ─────────────────────────
    var cliParaAplicar = [];
    (window._rrPreview.para_recuperar.clientes || []).forEach(function (c, i) {
      var chk  = document.getElementById(_cidC(i, 'sel'));
      if (!chk || !chk.checked) return;
      var acao = (document.getElementById(_cidC(i, 'acao')) || {}).value || 'criar';
      if (acao === 'ignorar' || acao === 'revisar' || acao === 'legado') return;
      var nome = ((document.getElementById(_cidC(i,'nome')) || {}).value || c.nome || '').trim();
      if (!nome) return;
      cliParaAplicar.push({
        acao: acao,
        nome:   nome,
        cnpj:   ((document.getElementById(_cidC(i,'cnpj'))   || {}).value || c.cnpj   || '').trim(),
        cidade: ((document.getElementById(_cidC(i,'cidade')) || {}).value || c.cidade || '').trim(),
        uf:     ((document.getElementById(_cidC(i,'uf'))     || {}).value || c.uf     || '').trim(),
        cep:    ((document.getElementById(_cidC(i,'cep'))    || {}).value || '').trim(),
        telefone: ((document.getElementById(_cidC(i,'tel'))  || {}).value || c.telefone || '').trim(),
        email:  ((document.getElementById(_cidC(i,'email'))  || {}).value || c.email   || '').trim(),
        endereco: ((document.getElementById(_cidC(i,'end'))  || {}).value || '').trim(),
        obs:    ((document.getElementById(_cidC(i,'obs'))    || {}).value || '').trim(),
        _fonte: c._fonte || '',
        _recuperado: true
      });
    });

    // ── Coletar contatos selecionados ─────────────────────────
    var ctsParaAplicar = [];
    (window._rrPreview.para_recuperar.contatos || []).forEach(function (c, j) {
      var chk = document.getElementById(_cidT(j, 'sel'));
      if (!chk || !chk.checked) return;
      var acao = (document.getElementById(_cidT(j, 'acao')) || {}).value || 'criar';
      if (acao === 'ignorar' || acao === 'revisar') return;
      var nome    = ((document.getElementById(_cidT(j,'nome'))    || {}).value || c.nome    || '').trim();
      var empresa = ((document.getElementById(_cidT(j,'empresa')) || {}).value || c.empresa || '').trim();
      if (!nome) return;
      if (!empresa) {
        console.warn('[Recovery Curadoria] Contato "' + nome + '" sem empresa vinculada — ignorado.');
        return;
      }
      ctsParaAplicar.push({
        acao: acao,
        nome:         nome,
        empresa:      empresa,
        departamento: ((document.getElementById(_cidT(j,'dept'))  || {}).value || c.departamento || '').trim(),
        email:        ((document.getElementById(_cidT(j,'email')) || {}).value || c.email        || '').trim(),
        telefone:     ((document.getElementById(_cidT(j,'tel'))   || {}).value || c.telefone     || '').trim(),
        obs:          ((document.getElementById(_cidT(j,'obs'))   || {}).value || '').trim(),
        _fonte: c._fonte || '',
        _recuperado: true
      });
    });

    if (!cliParaAplicar.length && !ctsParaAplicar.length) {
      alert('Nenhum item selecionado para aplicar.\n\nMarque ao menos um cliente ou contato com a ação "Criar novo" ou "Completar existente".');
      return;
    }

    // ── Resumo para confirmação ───────────────────────────────
    var resumo = '';
    if (cliParaAplicar.length) {
      resumo += cliParaAplicar.length + ' cliente(s):\n';
      cliParaAplicar.forEach(function (c) { resumo += '  • ' + c.nome + ' [' + c.acao + ']\n'; });
    }
    if (ctsParaAplicar.length) {
      resumo += ctsParaAplicar.length + ' contato(s):\n';
      ctsParaAplicar.forEach(function (c) { resumo += '  • ' + c.nome + ' (' + (c.empresa||'sem empresa') + ')\n'; });
    }

    var PALAVRA = 'APLICAR SELECIONADOS RELACIONAMENTO';
    var digitado = window.prompt(
      'Confirme a recuperação curada para a empresa "' + window._rrPreview.empresa_nome + '".\n\n'
      + resumo + '\nDigite exatamente:\n\n' + PALAVRA
    );
    if (digitado === null) { return; }
    if ((digitado || '').trim() !== PALAVRA) {
      alert('Texto incorreto. Cancelado. Nenhum dado foi alterado.');
      return;
    }

    // ── Aplicar clientes ──────────────────────────────────────
    var keyCli  = _keyFor('tf_clientes');
    var keyCts  = _keyFor('tf_contatos');
    var erros   = [];
    var relatorio = {
      empresa_id: eid, empresa_nome: window._rrPreview.empresa_nome,
      clientes_aplicados: 0, contatos_aplicados: 0, erros: []
    };

    try {
      var cliAtual = _lsRead(keyCli);
      // DataGuard backup (adição não bloqueia)
      if (typeof window.dgAntesDeSalvar === 'function') {
        window.dgAntesDeSalvar(keyCli, cliAtual, 'rrAplicarSelecionados-pre-cli');
      }
      var candidatosCli = cliParaAplicar.map(function (c) {
        return { id: _id('rrs_c'), nome: c.nome, cnpj: c.cnpj, cidade: c.cidade,
          uf: c.uf, cep: c.cep, telefone: c.telefone, email: c.email,
          endereco: c.endereco, obs: c.obs, criado: new Date().toISOString(),
          _recuperado: true, _fonte: c._fonte };
      });
      var dedupCli = _dedupCli(cliAtual, candidatosCli);
      if (dedupCli.para_adicionar.length) {
        var cliResult = cliAtual.concat(dedupCli.para_adicionar);
        _lsWrite(keyCli, cliResult);
        await _sbWrite(keyCli, cliResult);
        relatorio.clientes_aplicados = dedupCli.para_adicionar.length;
        console.info('[Recovery Curadoria] Clientes aplicados:', dedupCli.para_adicionar.length);
      }
      if (dedupCli.duplicados.length) {
        console.warn('[Recovery Curadoria] Clientes ignorados (dedup segurança):', dedupCli.duplicados.length);
      }
    } catch (e) {
      erros.push('Clientes: ' + e.message);
      console.error('[Recovery Curadoria] Erro ao aplicar clientes:', e);
    }

    // ── Aplicar contatos ──────────────────────────────────────
    try {
      var ctsAtual = _lsRead(keyCts);
      if (typeof window.dgAntesDeSalvar === 'function') {
        window.dgAntesDeSalvar(keyCts, ctsAtual, 'rrAplicarSelecionados-pre-cts');
      }
      var candidatosCts = ctsParaAplicar.map(function (c) {
        return { id: _id('rrs_t'), nome: c.nome, empresa: c.empresa,
          departamento: c.departamento, email: c.email, telefone: c.telefone,
          obs: c.obs, criado: new Date().toISOString(), _recuperado: true, _fonte: c._fonte };
      });
      var dedupCts = _dedupCts(ctsAtual, candidatosCts);
      if (dedupCts.para_adicionar.length) {
        var ctsResult = ctsAtual.concat(dedupCts.para_adicionar);
        _lsWrite(keyCts, ctsResult);
        await _sbWrite(keyCts, ctsResult);
        relatorio.contatos_aplicados = dedupCts.para_adicionar.length;
        console.info('[Recovery Curadoria] Contatos aplicados:', dedupCts.para_adicionar.length);
      }
    } catch (e) {
      erros.push('Contatos: ' + e.message);
      console.error('[Recovery Curadoria] Erro ao aplicar contatos:', e);
    }

    relatorio.erros = erros;

    // ── Atualizar UI ──────────────────────────────────────────
    try { if (typeof window.renderTabelaClientes === 'function') window.renderTabelaClientes(); } catch (e) {}
    try { if (typeof window.renderTabelaContatos === 'function') window.renderTabelaContatos(); } catch (e) {}

    // ── Mostrar resultado ─────────────────────────────────────
    var elR = document.getElementById('rrResultado');
    if (elR) elR.innerHTML = _renderRelatorioSelecionados(relatorio);
    window._rrPreview = null;
    _setBtnAplicar(false);
    console.info('[Recovery Curadoria] Aplicação concluída:', relatorio);
  };

  // ── Render relatório curadoria ─────────────────────────────
  function _renderRelatorioSelecionados(rel) {
    var total = rel.clientes_aplicados + rel.contatos_aplicados;
    var ok = total > 0 || (!rel.erros || !rel.erros.length);
    var html = '<div style="background:rgba(' + (ok?'34,197,94':'245,158,11') + ',.08);'
             + 'border:1px solid rgba(' + (ok?'34,197,94':'245,158,11') + ',.3);'
             + 'border-radius:6px;padding:.85rem;margin-bottom:.75rem">'
             + '<div style="font-weight:700;color:' + (ok?'#22c55e':'#f59e0b') + ';font-size:.9rem;margin-bottom:.5rem">'
             + (ok?'✅':'⚠️') + ' Curadoria aplicada — ' + _escHtml(rel.empresa_nome) + '</div>';
    html += '<div style="font-size:.77rem;color:var(--text2);display:flex;gap:.75rem;flex-wrap:wrap">'
          + '<span>Clientes aplicados: <strong>' + rel.clientes_aplicados + '</strong></span>'
          + '<span>Contatos aplicados: <strong>' + rel.contatos_aplicados + '</strong></span>'
          + '</div>';
    if (rel.erros && rel.erros.length) {
      html += '<div style="margin-top:.45rem;font-size:.73rem;color:#ef4444">';
      rel.erros.forEach(function (e) { html += '<div>❌ ' + _escHtml(e) + '</div>'; });
      html += '</div>';
    }
    html += '<div style="font-size:.7rem;color:var(--text3);margin-top:.45rem">'
          + 'Backup automático criado antes da gravação. Verifique Empresas e Contatos no menu Relacionamento.'
          + '</div></div>';
    return html;
  }

  // ============================================================
  // CADASTROS OFICIAIS POR CNPJ
  // Dados dos comprovantes de CNPJ já levantados — pré-preenchidos.
  // O utilizador só seleciona, revisa e confirma.
  // Confirmação: "APLICAR SELECIONADOS TECFUSION"
  // ============================================================

  var _CADASTROS_OFICIAIS = [
    {
      nome:        'JDE Jundiaí',
      razao_social:'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:        '02.333.707/0049-90',
      cidade:      'JUNDIAI',
      uf:          'SP',
      endereco:    'AV JOSE BENASSI, 1000 — PARQUE INDUSTRIAL',
      complemento: '',
      cep:         '13.213-085',
      telefone:    '(11) 4199-6192 / (11) 4199-6115',
      email:       '',
      obs:         'Cadastro oficial via comprovante CNPJ.',
      _fonte:      'CNPJ oficial'
    },
    {
      nome:        'JDE Salvador',
      razao_social:'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:        '02.333.707/0036-75',
      cidade:      'SALVADOR',
      uf:          'BA',
      endereco:    'R DO LUXEMBURGO, 586 — GRANJAS RURAIS PRESIDENTE VARGAS',
      complemento: '',
      cep:         '41.230-130',
      telefone:    '(11) 4525-6111',
      email:       '',
      obs:         'Cadastro oficial via comprovante CNPJ.',
      _fonte:      'CNPJ oficial'
    },
    {
      nome:        "JDE Itaporanga d'Ajuda",
      razao_social:'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:        '02.333.707/0065-00',
      cidade:      "ITAPORANGA D'AJUDA",
      uf:          'SE',
      endereco:    'ROD BR 101 KM 118, S/N — ZONA RURAL',
      complemento: '',
      cep:         '49.120-000',
      telefone:    '(77) 3423-0339',
      email:       '',
      obs:         'Cadastro oficial via comprovante CNPJ.',
      _fonte:      'CNPJ oficial'
    },
    {
      nome:        'JDE Vitória da Conquista',
      razao_social:'JACOBS DOUWE EGBERTS BR COMERCIALIZACAO DE CAFES LTDA.',
      cnpj:        '02.333.707/0066-90',
      cidade:      'VITORIA DA CONQUISTA',
      uf:          'BA',
      endereco:    'R I DT IND IMBORES, 375 — DISTRITO INDUSTRIAL',
      complemento: 'QUADRA VI LOTE 03/04/09/10',
      cep:         '45.089-410',
      telefone:    '(77) 3423-0339',
      email:       '',
      obs:         'Cadastro oficial via comprovante CNPJ.',
      _fonte:      'CNPJ oficial'
    },
    {
      nome:        'Foods Piumhí',
      razao_social:'FOODS INDUSTRIA E COMERCIO LTDA',
      cnpj:        '19.731.877/0001-80',
      cidade:      'PIUMHI',
      uf:          'MG',
      endereco:    'AV QUEROBINO MOURAO FILHO, 703 — BELA VISTA',
      complemento: '',
      cep:         '37.925-000',
      telefone:    '(37) 3371-4939',
      email:       '',
      obs:         'Cadastro oficial via comprovante CNPJ. Atenção: razão social não é JDE.',
      _fonte:      'CNPJ oficial'
    },
    {
      nome:        'FAGO',
      razao_social:'FAGO PROGRAMACAO LTDA.',
      cnpj:        '43.133.454/0001-43',
      cidade:      'JUNDIAI',
      uf:          'SP',
      endereco:    'R CORINA SOAVE GANDRA, 105 — JARDIM TORRES SAO JOSE',
      complemento: '',
      cep:         '13.214-531',
      telefone:    '(11) 5311-1736',
      email:       'YAGO@FENIXPROGRAMACAO.COM.BR',
      obs:         'Cadastro oficial via cartão CNPJ.',
      _fonte:      'CNPJ oficial'
    }
  ];

  // ── ID helper para cadastros oficiais ─────────────────────
  function _cidO(i, campo) { return 'rrO_' + i + '_' + campo; }

  // ── DataGuard helpers visuais para seção oficial ──────────
  function _avisoElOf() { return document.getElementById('rr-dg-aviso'); }

  // Mostra aviso de bloqueio DataGuard com botões de diagnóstico e desbloqueio
  function _mostrarAvisoDataGuard() {
    var el = _avisoElOf();
    if (!el) return;
    el.innerHTML = '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);'
      + 'border-radius:7px;padding:.7rem .9rem;margin-bottom:.5rem">'
      + '<div style="font-weight:700;color:#ef4444;font-size:.83rem;margin-bottom:.35rem">'
      + '🛡️ DataGuard bloqueou a aplicação</div>'
      + '<div style="font-size:.77rem;color:var(--text2);margin-bottom:.5rem">'
      + 'O DataGuard está ativo para proteger seus clientes e contatos.<br>'
      + 'Execute o Diagnóstico DataGuard e depois clique em Desbloquear para continuar.'
      + '</div>'
      + '<div style="display:flex;gap:.5rem;flex-wrap:wrap">'
      + '<button class="nb" onclick="window.rrDgDiagnosticoOficial()" '
      + 'style="background:var(--bg3);color:var(--text);border:1px solid var(--border);'
      + 'border-radius:5px;padding:.32rem .7rem;font-size:.76rem;font-weight:600">'
      + '🔍 Executar Diagnóstico DataGuard</button>'
      + '<button class="nb" onclick="window.rrDgDesbloquearOficial()" '
      + 'style="background:#22c55e;color:#fff;border-radius:5px;padding:.32rem .7rem;'
      + 'font-size:.76rem;font-weight:600">'
      + '🔓 Desbloquear DataGuard</button>'
      + '</div>'
      + '</div>';
  }

  // Executa diagnóstico DataGuard e atualiza aviso local
  window.rrDgDiagnosticoOficial = async function () {
    var el = _avisoElOf();
    if (el) el.innerHTML = '<div style="font-size:.76rem;color:var(--text3);padding:.4rem 0">'
      + '🔍 Executando diagnóstico DataGuard…</div>';
    // Dispara diagnóstico padrão (escreve resultado no banner #dg-resultado)
    if (typeof window.dgDiagnosticoUI === 'function') await window.dgDiagnosticoUI();
    window._dgDiagnosticoExecutado = true;
    var bloqueado = window._dgBloqueioAtivo;
    if (el) {
      el.innerHTML = '<div style="background:rgba(14,165,233,.08);border:1px solid rgba(14,165,233,.3);'
        + 'border-radius:7px;padding:.6rem .9rem;margin-bottom:.5rem">'
        + '<div style="font-weight:700;color:var(--blue);font-size:.8rem;margin-bottom:.3rem">'
        + '🔍 Diagnóstico executado</div>'
        + '<div style="font-size:.75rem;color:var(--text2);margin-bottom:.4rem">'
        + (bloqueado
            ? 'DataGuard ainda ativo. Veja o resultado acima (faixa DataGuard). '
            + 'Quando estiver pronto, clique em Desbloquear.'
            : '✅ DataGuard livre — pode clicar em "Aplicar cadastros selecionados".')
        + '</div>'
        + (bloqueado
            ? '<button class="nb" onclick="window.rrDgDesbloquearOficial()" '
            + 'style="background:#22c55e;color:#fff;border-radius:5px;padding:.32rem .7rem;'
            + 'font-size:.76rem;font-weight:600">🔓 Desbloquear DataGuard</button>'
            : '')
        + '</div>';
    }
  };

  // Desbloqueia DataGuard — exige que diagnóstico tenha sido executado
  window.rrDgDesbloquearOficial = function () {
    var el = _avisoElOf();
    if (!window._dgDiagnosticoExecutado) {
      if (el) el.innerHTML = '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);'
        + 'border-radius:7px;padding:.6rem .9rem;margin-bottom:.5rem;font-size:.77rem;color:#f59e0b">'
        + '⚠️ <strong>Execute o Diagnóstico DataGuard primeiro</strong> antes de desbloquear.<br>'
        + 'Clique em "🔍 Executar Diagnóstico DataGuard" acima.'
        + '</div>';
      return;
    }
    if (typeof window.dgDesbloquear === 'function') window.dgDesbloquear();
    if (el) el.innerHTML = '<div style="background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.3);'
      + 'border-radius:7px;padding:.6rem .9rem;margin-bottom:.5rem;font-size:.77rem;color:#22c55e">'
      + '🔓 <strong>DataGuard desbloqueado.</strong> Clique em "Aplicar cadastros selecionados" para continuar.'
      + '</div>';
  };

  // ── Determinar ação sugerida (apenas por CNPJ) ────────────
  // Retorna { acao: 'criar'|'completar', existente: obj|null }
  // Regra: somente CNPJ determina ação. Sem correspondência por nome para evitar
  // falsos positivos (JDE JDI ≠ JDE Jundiaí, etc.).
  function _acaoSugerida(cadastro, existentes) {
    var cnr = _normCnpj(cadastro.cnpj || '');

    // CNPJ idêntico → completar existente
    var porCnpj = cnr
      ? existentes.find(function (e) { return _normCnpj(e.cnpj || '') === cnr; })
      : null;
    if (porCnpj) return { acao: 'completar', existente: porCnpj };

    // Sem correspondência → criar novo
    return { acao: 'criar', existente: null };
  }

  // Similaridade aproximada de Levenshtein (0-1) — sem lib externa
  function _levenshteinSim(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    var m = a.length, n = b.length;
    if (m > 30 || n > 30) return 0; // evita cálculo em strings longas
    var d = [];
    for (var i = 0; i <= m; i++) { d[i] = [i]; }
    for (var j = 0; j <= n; j++) { d[0][j] = j; }
    for (var ii = 1; ii <= m; ii++) {
      for (var jj = 1; jj <= n; jj++) {
        d[ii][jj] = a[ii-1] === b[jj-1]
          ? d[ii-1][jj-1]
          : 1 + Math.min(d[ii-1][jj], d[ii][jj-1], d[ii-1][jj-1]);
      }
    }
    return 1 - d[m][n] / Math.max(m, n);
  }

  // ── Render: card de cadastro oficial ─────────────────────
  function _cardOficial(cad, i, existentes) {
    var sug    = _acaoSugerida(cad, existentes);
    var acao   = sug.acao;    // 'criar' | 'completar'
    var exist  = sug.existente;

    // Cor do badge de ação sugerida
    var acaoCor = acao === 'completar' ? '#0ea5e9' : '#22c55e';
    var acaoTxt = acao === 'completar' ? '🔗 Completar existente' : '✨ Criar novo';

    var selId  = _cidO(i, 'sel');
    var acaoId = _cidO(i, 'acao');
    var bodyId = _cidO(i, 'body');

    var html = '<div class="rr-card" data-seguro="1">';

    // Cabeçalho
    html += '<div class="rr-card-hdr">'
          + '<input type="checkbox" id="' + selId + '" checked '
          + 'onchange="window._rrContOficiais()" style="width:15px;height:15px;cursor:pointer;flex-shrink:0">'
          + '<label for="' + selId + '" style="font-weight:700;font-size:.82rem;cursor:pointer;flex:1">'
          + '🏢 ' + _escHtml(cad.nome) + '</label>'
          + '<span style="background:' + acaoCor + ';color:#fff;border-radius:3px;padding:.05rem .35rem;font-size:.67rem;font-weight:700">' + acaoTxt + '</span>'
          + '<span class="rr-badge-fonte" style="background:#6b7280">' + _escHtml(cad._fonte) + '</span>'
          + '<select id="' + acaoId + '" class="rr-sel" onchange="window._rrContOficiais()" style="margin-left:auto">'
          + '<option value="criar"'     + (acao==='criar'    ?' selected':'') + '>Criar novo</option>'
          + '<option value="completar"' + (acao==='completar'?' selected':'') + '>Completar existente</option>'
          + '<option value="ignorar">Ignorar</option>'
          + '</select>'
          + '</div>';

    // Se existe match: mostrar o registro atual
    if (exist) {
      var corBg = acao === 'completar' ? 'rgba(14,165,233,.07)' : 'rgba(245,158,11,.07)';
      var corBd = acao === 'completar' ? 'rgba(14,165,233,.3)'  : 'rgba(245,158,11,.3)';
      html += '<div style="background:' + corBg + ';border-bottom:1px solid ' + corBd + ';'
            + 'padding:.38rem .65rem;font-size:.72rem;color:var(--text2)">'
            + '🔗 CNPJ já cadastrado como: <strong>' + _escHtml(exist.nome) + '</strong>'
            + (exist.cidade ? ' · ' + _escHtml(exist.cidade) : '')
            + ' — campos vazios serão preenchidos com dados oficiais.'
            + '</div>';
    }

    // Corpo editável
    html += '<div id="' + bodyId + '" class="rr-card-body">';

    // Grid de campos editáveis
    html += '<div class="rr-grid2" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Nome de exibição *</label>' + _inp(_cidO(i,'nome'), cad.nome) + '</div>'
          + '<div><label class="rr-lbl">CNPJ</label>' + _inp(_cidO(i,'cnpj'), cad.cnpj) + '</div>'
          + '</div>'
          + '<div style="margin-bottom:.35rem"><label class="rr-lbl">Razão Social</label>' + _inp(_cidO(i,'razao'), cad.razao_social) + '</div>'
          + '<div class="rr-grid3" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Cidade</label>' + _inp(_cidO(i,'cidade'), cad.cidade) + '</div>'
          + '<div><label class="rr-lbl">UF</label><input type="text" id="' + _cidO(i,'uf') + '" class="rr-inp" value="' + _escHtml(cad.uf) + '" maxlength="2"></div>'
          + '<div><label class="rr-lbl">CEP</label>' + _inp(_cidO(i,'cep'), cad.cep) + '</div>'
          + '</div>'
          + '<div style="margin-bottom:.35rem"><label class="rr-lbl">Endereço</label>' + _inp(_cidO(i,'end'), cad.endereco) + '</div>'
          + (cad.complemento ? '<div style="margin-bottom:.35rem"><label class="rr-lbl">Complemento</label>' + _inp(_cidO(i,'comp'), cad.complemento) + '</div>' : '')
          + '<div class="rr-grid2" style="margin-bottom:.35rem">'
          + '<div><label class="rr-lbl">Telefone</label>' + _inp(_cidO(i,'tel'), cad.telefone) + '</div>'
          + '<div><label class="rr-lbl">E-mail</label>' + _inp(_cidO(i,'email'), cad.email) + '</div>'
          + '</div>'
          + '<div><label class="rr-lbl">Observação</label>' + _inp(_cidO(i,'obs'), cad.obs) + '</div>';

    // Se "completar": mostrar campos a preencher vs existente
    if (exist) {
      var campos = ['razao_social','cnpj','cidade','uf','cep','endereco','telefone','email','obs'];
      var aCompletar = campos.filter(function(c) { return !exist[c] && cad[c]; });
      if (aCompletar.length) {
        html += '<div style="font-size:.7rem;color:#0ea5e9;margin-top:.3rem">'
              + '🔗 Campos que serão preenchidos (vazios no atual): '
              + aCompletar.join(', ') + '</div>';
      }
    }

    html += '</div></div>'; // fecha body e card
    return html;
  }

  // ── Render: seção completa de cadastros oficiais ──────────
  function _renderCadastraisOficiais(existentes) {
    var html = '';

    // Banner modo curadoria
    html += '<div style="background:rgba(14,165,233,.09);border:1px solid rgba(14,165,233,.3);border-radius:6px;'
          + 'padding:.55rem .8rem;margin-bottom:.65rem;font-size:.77rem;color:var(--text2)">'
          + '✋ <strong>Modo curadoria manual</strong> — 6 cadastros pré-preenchidos com dados dos comprovantes CNPJ. '
          + 'Selecione, edite se necessário e confirme.'
          + '</div>';

    // Contador ao vivo + botão selecionar seguros
    html += '<div style="display:flex;align-items:center;justify-content:space-between;gap:.5rem;flex-wrap:wrap;margin-bottom:.55rem">'
          + '<div id="rr-cont-o" style="font-size:.74rem;color:var(--text2)">…</div>'
          + '<button class="nb" onclick="window.rrSelecionarTodosSeguros()" '
          + 'style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:5px;'
          + 'padding:.28rem .65rem;font-size:.72rem;font-weight:600">'
          + '⚡ Selecionar todos os cadastros seguros</button></div>';

    // Cards
    _CADASTROS_OFICIAIS.forEach(function (cad, i) {
      html += _cardOficial(cad, i, existentes);
    });

    // ── Footer: área de aviso DataGuard + botões de ação ────
    html += '<div style="margin-top:.85rem;padding-top:.65rem;border-top:1px solid var(--border)">';

    // Área de aviso DataGuard (bloqueio / diagnóstico / desbloqueio)
    html += '<div id="rr-dg-aviso"></div>';

    // Instrução de confirmação
    html += '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.55rem">'
          + '⚠️ Confirmação: digite <strong>APLICAR CADASTROS OFICIAIS TECFUSION</strong>.'
          + '<br>Backup automático criado antes de gravar. Nenhum dado existente será apagado.'
          + '</div>';

    // Botões: diagnóstico + desbloquear + aplicar
    html += '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:.5rem">'
          + '<button class="nb" onclick="window.rrDgDiagnosticoOficial()" '
          + 'style="background:var(--bg3);color:var(--text);border:1px solid var(--border);border-radius:5px;'
          + 'padding:.38rem .7rem;font-size:.76rem;font-weight:600">🔍 Executar Diagnóstico DataGuard</button>'
          + '<button class="nb" onclick="window.rrDgDesbloquearOficial()" '
          + 'style="background:rgba(34,197,94,.12);color:#22c55e;border:1px solid rgba(34,197,94,.4);border-radius:5px;'
          + 'padding:.38rem .7rem;font-size:.76rem;font-weight:600">🔓 Desbloquear DataGuard</button>'
          + '<button id="rr-btn-o" class="nb" onclick="window.rrAplicarOficiais()" '
          + 'style="background:var(--blue);color:#fff;border-radius:6px;padding:.45rem 1.1rem;'
          + 'font-size:.78rem;font-weight:700;white-space:nowrap;margin-left:auto">✅ Aplicar selecionados</button>'
          + '</div>'
          + '</div>';

    html += '<script>setTimeout(function(){if(typeof window._rrContOficiais==="function")window._rrContOficiais();},80);<\/script>';
    return html;
  }

  // ── Executar prévia oficial ───────────────────────────────
  window.rrExecutarPreviaOficial = function () {
    var el = document.getElementById('rrResultadoOficial');
    if (el) el.innerHTML = '<div style="padding:.8rem;text-align:center;color:var(--text3);font-size:.8rem">🔍 Lendo cadastros atuais…</div>';

    // Verificar empresa ativa
    var eid   = _getEmpresaId();
    var enome = _getEmpresaNome();
    if (!eid) {
      if (el) el.innerHTML = '<div style="color:#ef4444;font-size:.77rem">❌ Empresa ativa não encontrada. Selecione uma empresa no topo.</div>';
      return;
    }

    // Aviso se não for Tecfusion (os dados são da Tecfusion)
    var isTecfusion = enome.toLowerCase().includes('tecfusion');
    var avisoEmpresa = '';
    if (!isTecfusion) {
      avisoEmpresa = '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;'
                   + 'padding:.5rem .75rem;margin-bottom:.65rem;font-size:.74rem;color:#ef4444">'
                   + '⚠️ Empresa ativa: <strong>' + _escHtml(enome) + '</strong>. '
                   + 'Estes cadastros oficiais pertencem à <strong>Tecfusion</strong>. '
                   + 'A aplicação será bloqueada se a empresa ativa não for Tecfusion.'
                   + '</div>';
    }

    // Ler existentes
    var keyCli   = _keyFor('tf_clientes');
    var existentes = keyCli ? (function(){ try { var v = JSON.parse(localStorage.getItem(keyCli)||'[]'); return Array.isArray(v)?v:[]; } catch(e){ return []; } }()) : [];

    if (el) el.innerHTML = avisoEmpresa + _renderCadastraisOficiais(existentes);
  };

  // ── Contador ao vivo (oficiais) ───────────────────────────
  window._rrContOficiais = function () {
    var total = _CADASTROS_OFICIAIS.length;
    var sel = 0, criar = 0, completar = 0, ign = 0;
    for (var i = 0; i < total; i++) {
      var chk = document.getElementById(_cidO(i,'sel'));
      if (!chk || !chk.checked) continue;
      var acao = (document.getElementById(_cidO(i,'acao'))||{}).value||'criar';
      if (acao === 'ignorar') { ign++; continue; }
      sel++;
      if (acao === 'completar') completar++;
      else criar++;
    }
    var el = document.getElementById('rr-cont-o');
    if (!el) return;
    el.innerHTML =
      '<strong>' + sel + '</strong> de ' + total + ' selecionados'
      + (criar     ? ' · <span style="color:#22c55e">✨ ' + criar + ' criar</span>'         : '')
      + (completar ? ' · <span style="color:#0ea5e9">🔗 ' + completar + ' completar</span>' : '')
      + (ign       ? ' · <span style="color:#6b7280">⏭ ' + ign + ' ignorados</span>'        : '');
    var btn = document.getElementById('rr-btn-o');
    if (btn) btn.textContent = sel > 0 ? ('✅ Aplicar ' + sel + ' selecionados') : '✅ Aplicar selecionados';
  };

  // ── Selecionar todos os seguros ───────────────────────────
  // Marca todos exceto os que o usuário mudou para "ignorar".
  window.rrSelecionarTodosSeguros = function () {
    var total = _CADASTROS_OFICIAIS.length;
    for (var i = 0; i < total; i++) {
      var chk  = document.getElementById(_cidO(i,'sel'));
      var acao = (document.getElementById(_cidO(i,'acao'))||{}).value||'criar';
      if (!chk) continue;
      chk.checked = (acao !== 'ignorar');
    }
    window._rrContOficiais();
  };

  // ── Aplicar cadastros oficiais selecionados ───────────────
  window.rrAplicarOficiais = async function () {
    var elAviso  = _avisoElOf();
    var elResult = document.getElementById('rrResultadoOficial');

    // DataGuard — verifica sem alert; mostra aviso visual na tela
    if (window._dgBloqueioAtivo) {
      _mostrarAvisoDataGuard();
      return;
    }
    // Limpar avisos anteriores
    if (elAviso) elAviso.innerHTML = '';

    // Validar empresa Tecfusion
    var eid   = _getEmpresaId();
    var enome = _getEmpresaNome();
    function _avisoErr(msg) {
      if (elAviso) elAviso.innerHTML = '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);'
        + 'border-radius:7px;padding:.6rem .9rem;font-size:.78rem;color:#ef4444;margin-bottom:.5rem">'
        + '❌ ' + msg + '</div>';
    }
    if (!eid) { _avisoErr('Empresa ativa não encontrada. Selecione uma empresa no topo.'); return; }
    var isTecfusion = enome.toLowerCase().includes('tecfusion');
    if (!isTecfusion) {
      _avisoErr('Empresa ativa: <strong>' + _escHtml(enome) + '</strong>.<br>'
        + 'Estes cadastros pertencem à Tecfusion. Selecione a empresa Tecfusion antes de aplicar.');
      return;
    }

    // Ler base atual para validação
    var keyCli   = _keyFor('tf_clientes');
    var cliAtual = (function(){ try { var v = JSON.parse(localStorage.getItem(keyCli)||'[]'); return Array.isArray(v)?v:[]; } catch(e){ return []; } }());

    // Coletar selecionados
    var parAplicar = [];
    _CADASTROS_OFICIAIS.forEach(function (cad, i) {
      var chk  = document.getElementById(_cidO(i,'sel'));
      if (!chk || !chk.checked) return;
      var acao = (document.getElementById(_cidO(i,'acao'))||{}).value||'criar';
      if (acao === 'ignorar') return;
      var nome = ((document.getElementById(_cidO(i,'nome'))||{}).value||cad.nome||'').trim();
      if (!nome) return;
      parAplicar.push({
        acao:        acao,
        nome:        nome,
        razao_social: ((document.getElementById(_cidO(i,'razao'))||{}).value||cad.razao_social||'').trim(),
        cnpj:        ((document.getElementById(_cidO(i,'cnpj'))  ||{}).value||cad.cnpj||'').trim(),
        cidade:      ((document.getElementById(_cidO(i,'cidade'))||{}).value||cad.cidade||'').trim(),
        uf:          ((document.getElementById(_cidO(i,'uf'))    ||{}).value||cad.uf||'').trim(),
        cep:         ((document.getElementById(_cidO(i,'cep'))   ||{}).value||cad.cep||'').trim(),
        endereco:    ((document.getElementById(_cidO(i,'end'))   ||{}).value||cad.endereco||'').trim(),
        complemento: ((document.getElementById(_cidO(i,'comp'))  ||{}).value||cad.complemento||'').trim(),
        telefone:    ((document.getElementById(_cidO(i,'tel'))   ||{}).value||cad.telefone||'').trim(),
        email:       ((document.getElementById(_cidO(i,'email')) ||{}).value||cad.email||'').trim(),
        obs:         ((document.getElementById(_cidO(i,'obs'))   ||{}).value||cad.obs||'').trim(),
        _fonte:      cad._fonte,
        _recuperado: true
      });
    });

    if (!parAplicar.length) {
      _avisoErr('Nenhum cadastro selecionado. Marque ao menos um com ação "Criar novo" ou "Completar existente".');
      return;
    }

    // Validar "Completar existente" — CNPJ deve existir na base atual
    var errosValidacao = [];
    parAplicar.forEach(function (cad) {
      if (cad.acao === 'completar') {
        var cnr = _normCnpj(cad.cnpj || '');
        if (!cnr) {
          errosValidacao.push('"' + cad.nome + '": sem CNPJ para localizar cadastro existente. Corrija o CNPJ ou mude a ação para "Criar novo".');
          return;
        }
        var existe = cliAtual.some(function (e) { return _normCnpj(e.cnpj || '') === cnr; });
        if (!existe) {
          errosValidacao.push('"' + cad.nome + '" (CNPJ ' + cad.cnpj + '): nenhum cadastro encontrado com este CNPJ. Altere a ação para "Criar novo" ou revise o CNPJ.');
        }
      }
    });
    if (errosValidacao.length) {
      if (elAviso) elAviso.innerHTML = '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.3);'
        + 'border-radius:7px;padding:.65rem .9rem;font-size:.78rem;color:#f59e0b;margin-bottom:.5rem">'
        + '<div style="font-weight:700;margin-bottom:.3rem">⚠️ Corrija antes de aplicar:</div>'
        + errosValidacao.map(function(e){ return '• ' + e; }).join('<br>') + '</div>';
      return;
    }

    // Resumo e confirmação
    var resumo = parAplicar.length + ' cadastro(s):\n';
    parAplicar.forEach(function (c) { resumo += '  • ' + c.nome + ' [' + c.acao + ']\n'; });

    var PALAVRA = 'APLICAR CADASTROS OFICIAIS TECFUSION';
    var digitado = window.prompt(
      'Confirme aplicação de cadastros oficiais para "' + enome + '".\n\n'
      + resumo + '\nDigite exatamente:\n\n' + PALAVRA
    );
    if (digitado === null) return;
    if ((digitado||'').trim() !== PALAVRA) {
      _avisoErr('Texto de confirmação incorreto. Cancelado. Nenhum dado foi gravado.');
      return;
    }

    var erros  = [];
    var relatorio = { empresa: enome, criados: 0, completados: 0, ignorados: 0, erros: [], naoAlterado: [] };

    try {
      // cliAtual já foi lida para validação — reutilizar
      // DataGuard backup antes de qualquer escrita
      if (typeof window.dgAntesDeSalvar === 'function') {
        window.dgAntesDeSalvar(keyCli, cliAtual, 'rrAplicarOficiais-backup');
      }

      var cliResultado = cliAtual.slice(); // cópia — não altera o original

      parAplicar.forEach(function (cad) {
        var cnrOficial = _normCnpj(cad.cnpj || '');
        // Procurar existente por CNPJ (para completar)
        var idxExist = -1;
        if (cnrOficial) {
          idxExist = cliResultado.findIndex(function (e) { return _normCnpj(e.cnpj||'') === cnrOficial; });
        }

        if (cad.acao === 'completar' && idxExist >= 0) {
          // Completar: preencher somente campos vazios no existente
          var ex = Object.assign({}, cliResultado[idxExist]);
          var campos = ['razao_social','cnpj','cidade','uf','cep','endereco','complemento','telefone','email','obs'];
          var completouAlgo = false;
          campos.forEach(function (campo) {
            var valorCad = cad[campo] || '';
            if (!ex[campo] && valorCad) { ex[campo] = valorCad; completouAlgo = true; }
          });
          if (completouAlgo) {
            ex._completado_em = new Date().toISOString();
            ex._fonte_complemento = cad._fonte;
            cliResultado[idxExist] = ex;
            relatorio.completados++;
            console.info('[Oficiais] Completado:', ex.nome);
          } else {
            console.info('[Oficiais] Nenhum campo vazio para completar em:', ex.nome);
            relatorio.naoAlterado.push(cad.nome + ' (todos os campos já estavam preenchidos)');
            relatorio.ignorados++;
          }
        } else {
          // Criar novo — dedup de segurança por CNPJ
          var jaExiste = cnrOficial
            ? cliResultado.some(function (e) { return _normCnpj(e.cnpj||'') === cnrOficial; })
            : cliResultado.some(function (e) { return _norm(e.nome) === _norm(cad.nome); });

          if (!jaExiste) {
            cliResultado.push({
              id:           _id('off_c'),
              nome:         cad.nome,
              razao_social: cad.razao_social,
              cnpj:         cad.cnpj,
              cidade:       cad.cidade,
              uf:           cad.uf,
              cep:          cad.cep,
              endereco:     cad.endereco,
              complemento:  cad.complemento,
              telefone:     cad.telefone,
              email:        cad.email,
              obs:          cad.obs,
              criado:       new Date().toISOString(),
              _recuperado:  true,
              _fonte:       cad._fonte
            });
            relatorio.criados++;
            console.info('[Oficiais] Criado:', cad.nome);
          } else {
            console.warn('[Oficiais] Dedup segurança: já existe', cad.nome, '— ignorado.');
            relatorio.ignorados++;
          }
        }
      });

      // Gravar somente se houve alteração
      if (relatorio.criados > 0 || relatorio.completados > 0) {
        _lsWrite(keyCli, cliResultado);
        await _sbWrite(keyCli, cliResultado);
      }

    } catch (e) {
      erros.push(e.message);
      console.error('[Oficiais] Erro ao aplicar:', e);
    }

    relatorio.erros = erros;

    // Atualizar tabela de clientes (recarregar lista na tela Empresas)
    try { if (typeof window.renderTabelaClientes === 'function') window.renderTabelaClientes(); } catch (e) {}

    var ok = relatorio.criados > 0 || relatorio.completados > 0;

    // Limpar aviso DataGuard após sucesso
    if (ok && elAviso) elAviso.innerHTML = '';

    // Montar mensagem de resultado
    var linhasNaoAlt = (relatorio.naoAlterado||[]).length
      ? '<div style="font-size:.73rem;color:#f59e0b;margin-top:.35rem">'
        + '⚠️ Sem alteração (campos já preenchidos): '
        + relatorio.naoAlterado.map(_escHtml).join(', ')
        + '</div>'
      : '';

    var linhasErros = erros.length
      ? '<div style="color:#ef4444;font-size:.73rem;margin-top:.35rem">'
        + '❌ Erros: ' + erros.map(_escHtml).join('<br>') + '</div>'
      : '';

    var botaoEmpresas = ok
      ? '<div style="margin-top:.6rem">'
        + '<button class="nb" onclick="if(typeof window.hShowSec===\'function\')window.hShowSec(\'clientes\')" '
        + 'style="background:var(--blue);color:#fff;border-radius:5px;padding:.32rem .75rem;font-size:.76rem;font-weight:600">'
        + '→ Ver lista de Empresas/Clientes</button></div>'
      : '';

    // Exibir resultado
    if (elResult) {
      elResult.innerHTML = (ok
        ? '<div style="background:rgba(34,197,94,.09);border:1px solid rgba(34,197,94,.35);'
        : '<div style="background:rgba(245,158,11,.09);border:1px solid rgba(245,158,11,.35);')
        + 'border-radius:6px;padding:.85rem;margin-bottom:.5rem">'
        + '<div style="font-weight:700;color:' + (ok?'#22c55e':'#f59e0b') + ';font-size:.92rem;margin-bottom:.4rem">'
        + (ok ? '✅ Cadastros aplicados com sucesso — ' : '⚠️ Nenhuma alteração — ') + _escHtml(enome) + '</div>'
        + '<div style="font-size:.78rem;color:var(--text2);display:flex;gap:.75rem;flex-wrap:wrap">'
        + '<span>✨ Criados: <strong>' + relatorio.criados + '</strong></span>'
        + '<span>🔗 Completados: <strong>' + relatorio.completados + '</strong></span>'
        + '<span>⏭ Ignorados/sem alteração: <strong>' + relatorio.ignorados + '</strong></span>'
        + '</div>'
        + linhasNaoAlt
        + linhasErros
        + '<div style="font-size:.7rem;color:var(--text3);margin-top:.4rem">🛡️ Backup criado antes da gravação. Nenhum dado foi apagado.</div>'
        + botaoEmpresas
        + '</div>';
    }

    // Navegar para lista de clientes automaticamente em caso de sucesso
    if (ok) {
      setTimeout(function () {
        try { if (typeof window.hShowSec === 'function') window.hShowSec('clientes'); } catch (e) {}
      }, 2500);
    }

    console.info('[Oficiais] Aplicação concluída:', relatorio);
  };

  console.info('[RelacionamentoRecovery] Carregado. '
    + 'Prévia: window.RelacionamentoRecoveryPreview.executar() | '
    + 'Curadoria: window.rrAplicarSelecionados() | '
    + 'Oficiais: window.rrExecutarPreviaOficial() | '
    + 'Aplicar: window.RelacionamentoRecoveryApply.aplicar(preview) [legado]');

}(window));

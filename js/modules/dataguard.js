// ============================================================
// dataguard.js — Proteção permanente de clientes, contatos e
//                histórico no módulo Relacionamento
//
// REGRA MÁXIMA: NÃO APAGA, NÃO SOBRESCREVE, NÃO MIGRA.
//   Cria backup antes de qualquer gravação protegida.
//   Bloqueia reduções suspeitas de dados.
//   Fornece diagnóstico de todas as fontes.
//
// API global:
//   window.dgAntesDeSalvar(key, novaLista, motivo, opcoes)
//   window.dgDiagnostico(empresaId)    — async, retorna relatório
//   window.dgDiagnosticoUI()           — chama diagnóstico e exibe na UI
//   window.dgCheckBloqueio(acao)       — true se ação bloqueada
//   window.dgDesbloquear()             — remove bloqueio temporário
//   window._dgBloqueioAtivo            — flag de estado
// ============================================================

(function (window) {
  'use strict';

  // ── Configuração ───────────────────────────────────────────
  var DG_BACKUP_PREFIX   = 'tf_dg_bk_';   // prefixo de backup
  var DG_LOG_KEY         = 'tf_dg_log';   // chave do log de auditoria
  var DG_BACKUP_MANTER   = 3;             // máximo de backups por chave
  // Bloquear se: itens removidos > DG_BLOCO_MIN_ITENS AND redução% > DG_BLOCO_PCT
  var DG_BLOCO_MIN_ITENS = 5;
  var DG_BLOCO_PCT       = 0.40;          // 40%
  // Avisar se: itens removidos > DG_AVISO_MIN_ITENS AND redução% > DG_AVISO_PCT
  var DG_AVISO_MIN_ITENS = 2;
  var DG_AVISO_PCT       = 0.15;          // 15%

  // Chaves protegidas — qualquer chave que COMEÇA com estes prefixos
  var DG_PROTEGIDOS = ['tf_clientes', 'tf_contatos', 'tf_historico'];

  // ── Estado ─────────────────────────────────────────────────
  // true = bloqueia "Aplicar Recuperação" e ações destrutivas.
  // O utilizador pode desbloquear via dgDesbloquear() após confirmar
  // que o diagnóstico está OK.
  window._dgBloqueioAtivo = true;

  // true = diagnóstico foi executado nesta sessão (requisito para desbloquear)
  window._dgDiagnosticoExecutado = false;

  // ── Helpers de leitura/escrita ─────────────────────────────
  function _lsRead(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; }
  }
  function _lsWrite(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }
  function _isProtected(key) {
    if (!key) return false;
    return DG_PROTEGIDOS.some(function (p) {
      return key === p || key.startsWith(p + '_');
    });
  }

  // ── Backup automático ──────────────────────────────────────
  function _criarBackup(key, dados) {
    if (!Array.isArray(dados) || !dados.length) return null;
    var ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    var bk = DG_BACKUP_PREFIX + key + '_' + ts;
    _lsWrite(bk, dados);
    // Manter só DG_BACKUP_MANTER backups por chave base
    _purgarBackupsAntigos(key);
    return bk;
  }

  function _purgarBackupsAntigos(key) {
    try {
      var prefixo = DG_BACKUP_PREFIX + key + '_';
      var chaves = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(prefixo)) chaves.push(k);
      }
      chaves.sort(); // ISO → lexicográfico = cronológico
      while (chaves.length > DG_BACKUP_MANTER) {
        localStorage.removeItem(chaves.shift());
      }
    } catch (e) {}
  }

  // ── Log de auditoria ──────────────────────────────────────
  function _audit(evento) {
    try {
      var log = _lsRead(DG_LOG_KEY) || [];
      log.unshift(Object.assign({ ts: new Date().toISOString() }, evento));
      if (log.length > 100) log = log.slice(0, 100);
      localStorage.setItem(DG_LOG_KEY, JSON.stringify(log));
    } catch (e) {}
  }

  // ── Validação de redução ───────────────────────────────────
  function _avaliarReducao(key, antes, depois) {
    var reducao = antes - depois;
    if (reducao <= 0) return { nivel: 'ok' };

    var pct = antes > 0 ? reducao / antes : 0;
    var msg = '[DataGuard] ' + key + ': ' + antes + ' → ' + depois
            + ' (-' + reducao + ' = ' + Math.round(pct * 100) + '%)';

    if (reducao > DG_BLOCO_MIN_ITENS && pct > DG_BLOCO_PCT) {
      return {
        nivel: 'bloqueado',
        msg: 'PROTEÇÃO DE DADOS: esta operação reduziria ' + key
           + ' de ' + antes + ' para ' + depois + ' registros (-' + reducao
           + ' = ' + Math.round(pct * 100) + '%). OPERAÇÃO CANCELADA.'
           + ' Use { forcar: true } apenas se intencional.'
      };
    }
    if (reducao > DG_AVISO_MIN_ITENS && pct > DG_AVISO_PCT) {
      return { nivel: 'aviso', msg: msg };
    }
    return { nivel: 'ok', msg: msg };
  }

  // ── Allowlist de motivos permitidos para gravação ─────────
  // Escritas com motivo NÃO listado aqui são registradas como SUSPEITAS no log.
  // Motivos automáticos (init/load/empresa:changed/seed) devem ser BLOQUEADOS
  // antes de chegar aqui (em cadastro.js). Esta lista é apenas para auditoria.
  var DG_MOTIVOS_PERMITIDOS = [
    'cliSave(excluir-manual)',    // exclusão manual confirmada
    'salvarNovoCliente',          // modal "Novo Cliente"
    'salvarNovoContato',          // modal "Novo Contato"
    'editarCliente',              // modal "Editar Cliente"
    'editarContato',              // modal "Editar Contato"
    'rrAplicarOficiais-backup',   // backup antes de aplicar oficiais
    'rrAplicarOficiais',          // aplicar cadastros oficiais (confirmado)
    'rrAplicarSelecionados',      // aplicar recuperação manual (confirmado)
    'aplicarLimpezaClientesManual' // limpeza manual explícita
  ];

  // Motivos automáticos que NUNCA devem chegar aqui (detectados como violação)
  var DG_MOTIVOS_BLOQUEADOS_AUTO = [
    'cliSave(auto)', 'ctsSave(auto)', 'init', 'seedFromData',
    '_limkarClientes_auto', 'sync_auto', 'empresa:changed'
  ];

  // ── dgAntesDeSalvar ───────────────────────────────────────
  // Retorna { ok: bool, bloqueado: bool, backupKey: string|null, msg: string|null }
  // Chamado por cadastro.js (cliSave e ctsSave) ANTES de gravar.
  // Não grava nada — apenas valida e faz backup.
  window.dgAntesDeSalvar = function (key, novaLista, motivo, opcoes) {
    opcoes = opcoes || {};

    // Auditar motivos automáticos (apenas log — não bloqueia)
    // Bloqueio por motivo foi removido: era agressivo demais e impedia seed legítimo.
    // A proteção real é o check de redução percentual (_avaliarReducao) abaixo.
    if (motivo && DG_MOTIVOS_BLOQUEADOS_AUTO.some(function(m) { return motivo.indexOf(m) >= 0; })) {
      console.info('[DataGuard] Escrita com motivo automático detectada: "' + motivo
        + '" | Chave: "' + key + '" — auditada mas não bloqueada por motivo.');
      _audit({ tipo: 'ESCRITA_AUTO', key: key, motivo: motivo });
    }

    if (!_isProtected(key)) {
      return { ok: true, bloqueado: false, backupKey: null };
    }

    var atualArr = (function () { var v = _lsRead(key); return Array.isArray(v) ? v : []; }());
    var novaArr  = Array.isArray(novaLista) ? novaLista : [];

    // 1. Criar backup antes de qualquer validação
    var backupKey = _criarBackup(key, atualArr);

    // 2. Validar redução (ignorado se forcar:true)
    if (!opcoes.forcar) {
      var avaliacao = _avaliarReducao(key, atualArr.length, novaArr.length);
      if (avaliacao.nivel === 'bloqueado') {
        _audit({
          tipo: 'BLOQUEADO',
          key: key,
          antes: atualArr.length,
          depois: novaArr.length,
          motivo: motivo || '',
          msg: avaliacao.msg
        });
        console.warn('%c' + avaliacao.msg, 'color:#ef4444;font-weight:700');
        if (typeof toast === 'function') toast('🛡️ ' + avaliacao.msg, 'erro');
        return { ok: false, bloqueado: true, backupKey: backupKey, msg: avaliacao.msg };
      }
      if (avaliacao.nivel === 'aviso' && avaliacao.msg) {
        console.warn('[DataGuard] Aviso:', avaliacao.msg);
      }
    }

    // 3. Log da gravação
    _audit({
      tipo: 'GRAVACAO',
      key: key,
      antes: atualArr.length,
      depois: novaArr.length,
      motivo: motivo || '',
      backupKey: backupKey || ''
    });
    if (atualArr.length !== novaArr.length) {
      console.log(
        '%c[DataGuard] ' + key + ': ' + atualArr.length + ' → ' + novaArr.length
        + (backupKey ? ' | backup: ' + backupKey : ''),
        'color:#22c55e'
      );
    }

    return { ok: true, bloqueado: false, backupKey: backupKey };
  };

  // ── Diagnóstico de fontes ──────────────────────────────────
  // SOMENTE LEITURA. Nunca grava, altera ou migra nada.
  window.dgDiagnostico = async function (empresaId) {
    var eid = empresaId;
    if (!eid) {
      if (typeof window.getEmpresaAtivaId === 'function') eid = window.getEmpresaAtivaId();
      if (!eid && window._empresaAtiva) eid = window._empresaAtiva.id;
      if (!eid) {
        try {
          var _ls = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null');
          if (_ls && _ls.id) eid = _ls.id;
        } catch (e) {}
      }
    }

    var resultado = { empresa_id: eid, fontes: [], resumo: {} };

    console.group('%c[DataGuard] Diagnóstico de Fontes', 'color:#f0a500;font-weight:700;font-size:14px');
    console.log('Empresa ID:', eid || '(não identificada)');
    console.log('Timestamp:', new Date().toISOString());
    console.log('MODO SOMENTE LEITURA — nada será alterado.');

    function _inspecionar(chave, descricao, tipo) {
      try {
        var raw = localStorage.getItem(chave);
        if (raw === null) {
          resultado.fontes.push({ chave: chave, descricao: descricao, tipo: tipo, existe: false, quantidade: 0 });
          return;
        }
        var data = JSON.parse(raw);
        if (!Array.isArray(data)) {
          resultado.fontes.push({ chave: chave, descricao: descricao, tipo: tipo, existe: true, formato: typeof data, quantidade: 0 });
          return;
        }
        var comCnpj = 0, comCidade = 0, comNome = 0, exemplos = [];
        data.forEach(function (x) {
          if (x.nome && String(x.nome).trim()) comNome++;
          if (x.cnpj && String(x.cnpj).replace(/\D/g, '').length >= 11) comCnpj++;
          if (x.cidade && String(x.cidade).trim()) comCidade++;
          if (exemplos.length < 5 && x.nome) exemplos.push(x.nome.trim());
        });
        var f = { chave: chave, descricao: descricao, tipo: tipo, existe: true, quantidade: data.length, comNome: comNome, comCnpj: comCnpj, comCidade: comCidade, exemplos: exemplos, data: data };
        resultado.fontes.push(f);
        if (data.length > 0) {
          console.log(
            '%c  ✔ ' + chave, 'color:#22c55e;font-weight:600',
            '→', data.length, 'itens | CNPJ:', comCnpj, '| Cidade:', comCidade,
            '| Ex:', exemplos.slice(0, 3).join(', ')
          );
        }
      } catch (e) {
        resultado.fontes.push({ chave: chave, descricao: descricao, tipo: tipo, existe: true, erro: e.message });
        console.warn('  ✗ ' + chave + ':', e.message);
      }
    }

    // ── Chaves globais antigas ────────────────────────────────
    console.groupCollapsed('── Chaves globais (pre-multiempresa) ──');
    _inspecionar('tf_clientes',  'Clientes global antigo (SEM empresa_id)', 'global');
    _inspecionar('tf_contatos',  'Contatos global antigo (SEM empresa_id)', 'global');
    _inspecionar('tf_historico', 'Histórico global antigo (SEM empresa_id)', 'global');
    console.groupEnd();

    // ── Chaves por empresa ────────────────────────────────────
    if (eid) {
      console.groupCollapsed('── Chaves empresa ativa: ' + eid + ' ──');
      _inspecionar('tf_clientes_'  + eid, 'Clientes Empresa Ativa (LIDA PELA TELA)', 'empresa-ativa');
      _inspecionar('tf_contatos_'  + eid, 'Contatos Empresa Ativa (LIDO PELA TELA)', 'empresa-ativa');
      _inspecionar('tf_historico_' + eid, 'Histórico Empresa Ativa (LIDO PELA TELA)', 'empresa-ativa');
      _inspecionar('tf_cli_del_'   + eid, 'Tombstones de clientes excluídos', 'tombstone');
      _inspecionar('tf_cts_del_'   + eid, 'Tombstones de contatos excluídos', 'tombstone');
      console.groupEnd();
    }

    // ── Backups do DataGuard ──────────────────────────────────
    var backups = [];
    try {
      for (var bi = 0; bi < localStorage.length; bi++) {
        var bk = localStorage.key(bi);
        if (bk && bk.startsWith(DG_BACKUP_PREFIX)) backups.push(bk);
      }
    } catch (e) {}
    if (backups.length) {
      console.groupCollapsed('── Backups automáticos DataGuard (' + backups.length + ') ──');
      backups.sort().forEach(function (k) { _inspecionar(k, 'Backup DataGuard', 'backup'); });
      console.groupEnd();
    }

    // ── Busca ampla por chaves relacionadas ───────────────────
    var palavras = ['cliente', 'contato', 'historico', 'relacionamento', 'recuper', 'recovery'];
    var extras = [];
    try {
      for (var ei = 0; ei < localStorage.length; ei++) {
        var ek = localStorage.key(ei);
        if (!ek) continue;
        var ekl = ek.toLowerCase();
        var jaInspecionado = resultado.fontes.some(function (f) { return f.chave === ek; });
        if (!jaInspecionado && palavras.some(function (p) { return ekl.includes(p); })) {
          extras.push(ek);
        }
      }
    } catch (e) {}
    if (extras.length) {
      console.groupCollapsed('── Outras chaves relacionadas (' + extras.length + ') ──');
      extras.forEach(function (k) { _inspecionar(k, 'Descoberta por busca', 'descoberta'); });
      console.groupEnd();
    }

    // ── Supabase ──────────────────────────────────────────────
    var sbFontes = [];
    if (window.sbClient) {
      var sbChaves = ['tf_clientes', 'tf_contatos', 'tf_historico'];
      if (eid) sbChaves.push('tf_clientes_' + eid, 'tf_contatos_' + eid, 'tf_historico_' + eid);
      console.groupCollapsed('── Supabase configuracoes ──');
      for (var si = 0; si < sbChaves.length; si++) {
        try {
          var r = await window.sbClient
            .from('configuracoes')
            .select('valor, updated_at')
            .eq('chave', sbChaves[si])
            .maybeSingle();
          if (r.data && Array.isArray(r.data.valor)) {
            var sv = r.data.valor;
            var sbComCnpj = sv.filter(function (x) { return x.cnpj && String(x.cnpj).replace(/\D/g, '').length >= 11; }).length;
            var sbExemplos = sv.slice(0, 4).map(function (x) { return x.nome || ''; }).filter(Boolean);
            var sf = { chave: '[SB] ' + sbChaves[si], descricao: 'Supabase configuracoes', tipo: 'supabase', existe: true, quantidade: sv.length, comCnpj: sbComCnpj, exemplos: sbExemplos, updatedAt: r.data.updated_at, data: sv };
            sbFontes.push(sf);
            resultado.fontes.push(sf);
            console.log('%c  ✔ [SB] ' + sbChaves[si], 'color:#0ea5e9;font-weight:600',
              '→', sv.length, 'itens | CNPJ:', sbComCnpj,
              '| updated_at:', r.data.updated_at || '?',
              '| Ex:', sbExemplos.join(', '));
          } else {
            console.log('  – [SB] ' + sbChaves[si] + ': vazia ou não encontrada');
          }
        } catch (e) {
          console.warn('  ✗ [SB] ' + sbChaves[si] + ':', e.message);
        }
      }
      console.groupEnd();
    } else {
      console.warn('── Supabase não conectado — pulando ──');
    }

    // ── Resumo e diagnóstico ──────────────────────────────────
    console.group('── RESUMO DIAGNÓSTICO ──');

    var fAtual   = resultado.fontes.find(function (f) { return f.chave === 'tf_clientes_' + eid; });
    var fGlobal  = resultado.fontes.find(function (f) { return f.chave === 'tf_clientes' && f.tipo === 'global'; });
    var fSbAtual = resultado.fontes.find(function (f) { return f.chave === '[SB] tf_clientes_' + eid; });
    var fSbGlobal= resultado.fontes.find(function (f) { return f.chave === '[SB] tf_clientes'; });

    var qtdAtual   = fAtual   ? fAtual.quantidade   : 0;
    var qtdGlobal  = fGlobal  ? fGlobal.quantidade  : 0;
    var qtdSbAtual = fSbAtual ? fSbAtual.quantidade : 0;
    var qtdSbGlob  = fSbGlobal? fSbGlobal.quantidade: 0;

    resultado.resumo = {
      empresa_id:             eid,
      clientes_lidos_pela_tela: qtdAtual,
      clientes_global_antigo_ls: qtdGlobal,
      clientes_global_antigo_sb: qtdSbGlob,
      clientes_empresa_supabase: qtdSbAtual,
      base_incompleta: qtdGlobal > qtdAtual || qtdSbGlob > qtdAtual
    };

    console.log('Fonte ATUAL (lida pela tela):', qtdAtual, 'clientes em tf_clientes_' + eid);
    console.log('Fonte global LS (antigo):    ', qtdGlobal, 'clientes em tf_clientes');
    console.log('Fonte global SB (antigo):    ', qtdSbGlob, 'clientes em [SB] tf_clientes');
    console.log('Fonte empresa SB (atual):    ', qtdSbAtual, 'clientes em [SB] tf_clientes_' + eid);

    var fonteMaisCompleta = qtdAtual;
    var nomeCompleта = 'tf_clientes_' + eid;
    if (qtdGlobal > fonteMaisCompleta)  { fonteMaisCompleta = qtdGlobal;  nomeCompleта = 'tf_clientes (localStorage global)'; }
    if (qtdSbGlob > fonteMaisCompleta)  { fonteMaisCompleta = qtdSbGlob;  nomeCompleта = '[SB] tf_clientes (Supabase global)'; }
    if (qtdSbAtual > fonteMaisCompleta) { fonteMaisCompleta = qtdSbAtual; nomeCompleта = '[SB] tf_clientes_' + eid + ' (Supabase atual)'; }

    resultado.resumo.fonte_mais_completa = nomeCompleта;
    resultado.resumo.clientes_fonte_mais_completa = fonteMaisCompleta;

    if (resultado.resumo.base_incompleta) {
      console.warn(
        '%c⚠️ BASE INCOMPLETA DETECTADA\n'
        + '  Tela mostra: ' + qtdAtual + ' clientes\n'
        + '  Fonte mais completa: ' + fonteMaisCompleta + ' clientes em "' + nomeCompleта + '"\n'
        + '  CAUSA PROVÁVEL: base foi migrada para chave por empresa_id mas os '
        + 'clientes adicionados manualmente (não extraídos de propostas) '
        + 'ficaram na chave global.\n'
        + '  SOLUÇÃO: Execute window.RelacionamentoRecoveryPreview.executar() para '
        + 'ver a prévia de restauração, depois confirme com "RECUPERAR RELACIONAMENTO".',
        'color:#f59e0b;font-weight:700;font-size:13px'
      );
    } else {
      console.log('%c✅ Base parece completa — tela e fontes com mesma quantidade.', 'color:#22c55e;font-weight:700');
    }

    console.groupEnd();
    console.groupEnd(); // fecha grupo principal

    return resultado;
  };

  // ── dgDiagnosticoUI ──────────────────────────────────────
  // Chama dgDiagnostico() e exibe resultado resumido na UI do Relacionamento
  window.dgDiagnosticoUI = async function () {
    var el = document.getElementById('dg-resultado');
    if (el) el.innerHTML = '<div style="font-size:.75rem;color:var(--text3);padding:.5rem 0">🔍 Analisando fontes de dados…</div>';

    try {
      var rel = await window.dgDiagnostico();
      window._dgDiagnosticoExecutado = true; // marcar diagnóstico executado nesta sessão
      var r   = rel.resumo;
      var html = '';

      // Status
      var corStatus = r.base_incompleta ? '#f59e0b' : '#22c55e';
      var icone     = r.base_incompleta ? '⚠️ BASE INCOMPLETA' : '✅ Base OK';
      html += '<div style="background:rgba(' + (r.base_incompleta ? '245,158,11' : '34,197,94') + ',.1);'
            + 'border:1px solid rgba(' + (r.base_incompleta ? '245,158,11' : '34,197,94') + ',.35);'
            + 'border-radius:6px;padding:.6rem .8rem;margin-top:.5rem">'
            + '<div style="font-weight:700;color:' + corStatus + ';font-size:.82rem;margin-bottom:.3rem">' + icone + '</div>';

      html += '<div style="font-size:.74rem;color:var(--text2);display:grid;grid-template-columns:1fr 1fr;gap:.2rem .8rem">'
            + '<span>Tela mostra (atual):</span><span><strong>' + r.clientes_lidos_pela_tela + '</strong> clientes</span>'
            + '<span>Global LS (antigo):</span><span><strong>' + r.clientes_global_antigo_ls + '</strong> clientes</span>'
            + '<span>Global Supabase:</span><span><strong>' + r.clientes_global_antigo_sb + '</strong> clientes</span>'
            + '<span>Empresa Supabase:</span><span><strong>' + r.clientes_empresa_supabase + '</strong> clientes</span>'
            + '</div>';

      if (r.base_incompleta) {
        html += '<div style="font-size:.73rem;color:#f59e0b;margin-top:.4rem">'
              + '⚠️ Fonte mais completa: <strong>' + r.clientes_fonte_mais_completa + ' clientes</strong> em "' + r.fonte_mais_completa + '"<br>'
              + 'Use <strong>Recuperação de Dados Antigos</strong> (menu Relacionamento) para restaurar a base completa.<br>'
              + 'Veja detalhes completos no console do navegador (F12).'
              + '</div>';
        html += '<div style="margin-top:.5rem">'
              + '<button class="nb" onclick="window.hShowSec(\'recuperacao\')" '
              + 'style="background:var(--blue);color:#fff;border-radius:5px;padding:.28rem .65rem;font-size:.72rem;font-weight:600">'
              + '→ Ir para Recuperação de Dados</button></div>';
      } else {
        html += '<div style="font-size:.73rem;color:#22c55e;margin-top:.3rem">Bases sincronizadas. Nenhuma ação necessária.</div>';
        // Após diagnóstico positivo, oferecer desbloqueio
        html += '<div style="margin-top:.5rem">'
              + '<button class="nb" onclick="window.dgDesbloquear()" '
              + 'style="background:#22c55e;color:#fff;border-radius:5px;padding:.28rem .65rem;font-size:.72rem;font-weight:600">'
              + '🔓 Desbloquear DataGuard</button></div>';
      }

      html += '</div>';
      if (el) el.innerHTML = html;

    } catch (e) {
      console.error('[DataGuard] Erro no diagnóstico:', e);
      if (el) el.innerHTML = '<div style="font-size:.74rem;color:#ef4444;padding:.5rem 0">❌ Erro ao diagnosticar: ' + (e.message || e) + '</div>';
    }
  };

  // ── Bloqueio temporário ───────────────────────────────────
  window.dgCheckBloqueio = function (acao) {
    if (!window._dgBloqueioAtivo) return false;
    var msg = '🛡️ DataGuard: "' + (acao || 'esta ação') + '" está bloqueada temporariamente. '
            + 'Execute o Diagnóstico em Relacionamento → Empresas e confirme que a base está correta. '
            + 'Depois clique "Desbloquear DataGuard" ou chame window.dgDesbloquear() no console.';
    console.warn('[DataGuard] ' + msg);
    if (typeof toast === 'function') toast(msg, 'aviso');
    else alert(msg);
    return true;
  };

  window.dgDesbloquear = function () {
    window._dgBloqueioAtivo = false;
    console.log('%c[DataGuard] Bloqueio temporário removido. Aplicar Recuperação reabilitado.', 'color:#22c55e;font-weight:700');
    // Atualizar banner
    var banner = document.getElementById('dg-bloqueio-banner');
    if (banner) {
      banner.style.background = 'rgba(34,197,94,.08)';
      banner.style.borderColor = 'rgba(34,197,94,.3)';
      banner.querySelector && (banner.querySelector('[data-dg-texto]') || banner).textContent;
      banner.innerHTML = '🔓 <strong>DataGuard desbloqueado.</strong> Ações de recuperação reabilitadas. Backups automáticos continuam ativos.';
    }
  };

  // ── Listar backups disponíveis ────────────────────────────
  window.dgListarBackups = function () {
    var lista = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.startsWith(DG_BACKUP_PREFIX)) {
          var v = _lsRead(k);
          lista.push({
            chave: k,
            itens: Array.isArray(v) ? v.length : 0,
            exemplos: Array.isArray(v) ? v.slice(0, 3).map(function (x) { return x.nome || '?'; }).join(', ') : ''
          });
        }
      }
    } catch (e) {}
    lista.sort(function (a, b) { return b.chave.localeCompare(a.chave); });
    console.table(lista);
    return lista;
  };

  // ── Log de auditoria ──────────────────────────────────────
  window.dgVerLog = function () {
    var log = _lsRead(DG_LOG_KEY) || [];
    console.table(log.slice(0, 30));
    return log;
  };

  console.log('%c[DataGuard] Carregado. Proteção ativa. Bloqueio temporário: ON', 'color:#f0a500;font-weight:700');

}(window));

// ============================================================
// diagnostico-clientes-cnpj.js
// Diagnóstico somente leitura de clientes/contatos/histórico
// Localiza dados em TODAS as chaves possíveis:
//   - localStorage global (legado)
//   - localStorage per-empresa
//   - Supabase (chaves globais e per-empresa)
//
// NÃO grava, NÃO altera, NÃO migra, NÃO deduplica.
// ============================================================

(function (window) {
  'use strict';

  // ── Helpers básicos ─────────────────────────────────────────
  function _lsRead(chave) {
    try {
      var v = JSON.parse(localStorage.getItem(chave) || 'null');
      return Array.isArray(v) ? v : (v !== null ? null : null);
    } catch (e) { return null; }
  }
  function _lsReadArr(chave) {
    var v = _lsRead(chave);
    return Array.isArray(v) ? v : [];
  }
  function _normCnpj(s) { return String(s || '').replace(/\D/g, ''); }
  function _esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── Resolução de empresa ativa ──────────────────────────────
  function _getEmpresaId() {
    if (typeof window.getEmpresaAtivaId === 'function') { var r = window.getEmpresaAtivaId(); if (r) return r; }
    if (typeof window.getEmpresaAtiva === 'function') { var o = window.getEmpresaAtiva(); if (o && o.id) return o.id; }
    if (window._empresaAtiva && window._empresaAtiva.id) return window._empresaAtiva.id;
    try { var s = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null'); if (s && s.id) return s.id; } catch(e) {}
    return null;
  }
  function _getEmpresaNome() {
    if (typeof window.getEmpresaAtiva === 'function') { var o = window.getEmpresaAtiva(); if (o && o.nome_curto) return o.nome_curto; }
    if (window._empresaAtiva && window._empresaAtiva.nome_curto) return window._empresaAtiva.nome_curto;
    try { var s = JSON.parse(localStorage.getItem('tf_empresa_ativa') || 'null'); if (s && s.nome_curto) return s.nome_curto; } catch(e) {}
    return null;
  }

  // ── Varredura de TODAS as chaves de clientes no localStorage ─
  function _escanearLocalStorage() {
    var chaves = [];
    var padraoCli  = /^tf_clientes/;
    var padraoCts  = /^tf_contatos/;
    var padraoHist = /^tf_historico/;
    var padraoDel  = /^tf_cli_del|^tf_cts_del/;

    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (padraoCli.test(k) || padraoCts.test(k) || padraoHist.test(k) || padraoDel.test(k)) {
        chaves.push(k);
      }
    }
    return chaves.sort();
  }

  // ── Análise de lista de clientes ────────────────────────────
  function _analisarClientes(lista) {
    if (!Array.isArray(lista)) return { total: 0, comCnpj: 0, comCidade: 0, amostras: [] };
    var comCnpj  = lista.filter(function(c) { return _normCnpj(c.cnpj || '').length >= 11; }).length;
    var comCidade = lista.filter(function(c) { return (c.cidade || '').trim().length > 0; }).length;
    var amostras = lista.slice(0, 5).map(function(c) {
      return {
        nome:   (c.nome   || '(sem nome)').slice(0, 60),
        cnpj:   c.cnpj   || '',
        cidade: c.cidade  || '',
        criado: c.criado  || ''
      };
    });
    return { total: lista.length, comCnpj: comCnpj, comCidade: comCidade, amostras: amostras };
  }

  // ── Análise de lista de contatos ────────────────────────────
  function _analisarContatos(lista) {
    if (!Array.isArray(lista)) return { total: 0, comEmail: 0, comTelefone: 0, amostras: [] };
    var comEmail    = lista.filter(function(c) { return (c.email    || '').trim().length > 0; }).length;
    var comTelefone = lista.filter(function(c) { return (c.telefone || '').trim().length > 0; }).length;
    var amostras = lista.slice(0, 5).map(function(c) {
      return {
        nome:     (c.nome     || '(sem nome)').slice(0, 60),
        empresa:  c.empresa   || '',
        email:    c.email     || '',
        telefone: c.telefone  || '',
        criado:   c.criado    || ''
      };
    });
    return { total: lista.length, comEmail: comEmail, comTelefone: comTelefone, amostras: amostras };
  }

  // ── Leitura do Supabase — uma chave ─────────────────────────
  async function _sbLer(chave) {
    if (!window.sbClient) return null;
    try {
      var r = await window.sbClient
        .from('configuracoes')
        .select('valor, updated_at')
        .eq('chave', chave)
        .maybeSingle();
      if (r.data) return { valor: Array.isArray(r.data.valor) ? r.data.valor : null, updated_at: r.data.updated_at };
    } catch (e) { console.warn('[Diag] Supabase erro ao ler', chave, e); }
    return null;
  }

  // ── Execução principal ───────────────────────────────────────
  async function executarDiagnostico() {
    var eid   = _getEmpresaId();
    var enome = _getEmpresaNome() || '(desconhecida)';
    console.info('%c[Diagnóstico] SOMENTE LEITURA — iniciando', 'color:#f59e0b;font-weight:700');
    console.info('[Diagnóstico] Empresa ativa:', enome, '(', eid, ')');

    // ── 1. Varrer localStorage ─────────────────────────────────
    var chaveLS = _escanearLocalStorage();
    console.info('[Diagnóstico] Chaves encontradas no localStorage:', chaveLS);

    // ── 2. Ler cada chave ──────────────────────────────────────
    var fontes = [];

    // Globais legadas (sem empresa_id)
    var globaisBase = ['tf_clientes', 'tf_contatos', 'tf_historico', 'tf_cli_del', 'tf_cts_del'];
    globaisBase.forEach(function(base) {
      var val = _lsReadArr(base);
      var existe = localStorage.getItem(base) !== null;
      var tipo = base.startsWith('tf_clientes') ? 'clientes'
               : base.startsWith('tf_contatos') ? 'contatos'
               : base.startsWith('tf_historico') ? 'historico'
               : 'tombstone';
      fontes.push({
        chave: base,
        escopo: 'global-legado',
        tipo: tipo,
        existe: existe,
        tamanho_bytes: (localStorage.getItem(base) || '').length,
        analise_cli: tipo === 'clientes' ? _analisarClientes(val) : null,
        analise_cts: tipo === 'contatos' ? _analisarContatos(val) : null,
        analise_hist: tipo === 'historico' ? { total: val.length } : null,
        tombstone: tipo === 'tombstone' ? val : null,
        raw_count: val.length
      });
    });

    // Per-empresa via localStorage (varredura)
    chaveLS.forEach(function(k) {
      // Pular as globais que já mapeamos
      if (globaisBase.indexOf(k) >= 0) return;
      var tipo = k.startsWith('tf_clientes') ? 'clientes'
               : k.startsWith('tf_contatos') ? 'contatos'
               : k.startsWith('tf_historico') ? 'historico'
               : 'tombstone';
      // Extrair empresa_id da chave
      var partes = k.split('_');
      var eidChave = partes.slice(tipo === 'tombstone' ? 3 : 2).join('_');
      var val = _lsReadArr(k);
      fontes.push({
        chave: k,
        escopo: 'per-empresa',
        empresa_id_chave: eidChave,
        is_empresa_ativa: eid && k.indexOf(eid) >= 0,
        tipo: tipo,
        existe: true,
        tamanho_bytes: (localStorage.getItem(k) || '').length,
        analise_cli: tipo === 'clientes' ? _analisarClientes(val) : null,
        analise_cts: tipo === 'contatos' ? _analisarContatos(val) : null,
        analise_hist: tipo === 'historico' ? { total: val.length } : null,
        tombstone: tipo === 'tombstone' ? val : null,
        raw_count: val.length
      });
    });

    // ── 3. Supabase ────────────────────────────────────────────
    var sbFontes = [];
    if (window.sbClient) {
      console.info('[Diagnóstico] Lendo Supabase...');

      // Globais legadas
      for (var i = 0; i < globaisBase.length; i++) {
        var base = globaisBase[i];
        var res = await _sbLer(base);
        if (res) {
          var v = res.valor || [];
          var tipo2 = base.startsWith('tf_clientes') ? 'clientes'
                    : base.startsWith('tf_contatos') ? 'contatos'
                    : base.startsWith('tf_historico') ? 'historico'
                    : 'tombstone';
          sbFontes.push({
            chave: base,
            escopo: 'supabase-global-legado',
            tipo: tipo2,
            updated_at: res.updated_at,
            analise_cli: tipo2 === 'clientes' ? _analisarClientes(v) : null,
            analise_cts: tipo2 === 'contatos' ? _analisarContatos(v) : null,
            analise_hist: tipo2 === 'historico' ? { total: v.length } : null,
            raw_count: v.length
          });
        }
      }

      // Per-empresa — chaves baseadas nas empresas do localStorage
      var empresasDetectadas = {};
      if (eid) empresasDetectadas[eid] = true;
      chaveLS.forEach(function(k) {
        // Extrair possível empresa_id (UUID de 36 chars)
        var match = k.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        if (match) empresasDetectadas[match[1]] = true;
      });

      for (var eidD in empresasDetectadas) {
        var bases = ['tf_clientes_' + eidD, 'tf_contatos_' + eidD, 'tf_historico_' + eidD];
        for (var j = 0; j < bases.length; j++) {
          var chaveEmp = bases[j];
          var resEmp = await _sbLer(chaveEmp);
          if (resEmp && Array.isArray(resEmp.valor) && resEmp.valor.length > 0) {
            var vEmp = resEmp.valor;
            var tipoEmp = chaveEmp.startsWith('tf_clientes') ? 'clientes'
                        : chaveEmp.startsWith('tf_contatos') ? 'contatos'
                        : 'historico';
            sbFontes.push({
              chave: chaveEmp,
              escopo: 'supabase-per-empresa',
              empresa_id_chave: eidD,
              is_empresa_ativa: eidD === eid,
              tipo: tipoEmp,
              updated_at: resEmp.updated_at,
              analise_cli: tipoEmp === 'clientes' ? _analisarClientes(vEmp) : null,
              analise_cts: tipoEmp === 'contatos' ? _analisarContatos(vEmp) : null,
              analise_hist: tipoEmp === 'historico' ? { total: vEmp.length } : null,
              raw_count: vEmp.length
            });
          }
        }
      }
    } else {
      console.warn('[Diagnóstico] sbClient não disponível — Supabase não consultado.');
    }

    var resultado = {
      empresa_ativa: { id: eid, nome: enome },
      localStorage: fontes,
      supabase: sbFontes,
      timestamp: new Date().toISOString(),
      aviso: 'SOMENTE LEITURA — nenhum dado foi alterado, migrado ou apagado.'
    };

    console.info('[Diagnóstico] Resultado completo:', JSON.stringify(resultado, null, 2));
    return resultado;
  }

  // ── Renderização HTML ────────────────────────────────────────
  function _badge(n, cor, label) {
    var c = cor || '#6b7280';
    return '<span style="display:inline-flex;align-items:center;gap:.2rem;background:' + c + '22;color:' + c + ';border:1px solid ' + c + '55;border-radius:4px;padding:.08rem .38rem;font-size:.68rem;font-weight:700">'
      + (label ? label + ' ' : '') + n + '</span>';
  }

  function _cardFonte(f, idx) {
    var isAtivo = f.is_empresa_ativa;
    var borda = isAtivo ? '#22c55e' : (f.escopo.indexOf('legado') >= 0 ? '#f59e0b' : '#6366f1');
    var escH  = f.escopo.indexOf('legado') >= 0 ? '⚠️ legado' : (isAtivo ? '✅ empresa ativa' : '🔵 per-empresa');
    var html = '';
    html += '<div style="border:1px solid var(--border);border-left:3px solid ' + borda + ';border-radius:6px;padding:.65rem .9rem;margin-bottom:.5rem;background:var(--bg2)">';
    // Cabeçalho
    html += '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem;margin-bottom:.4rem;flex-wrap:wrap">';
    html += '<code style="font-size:.72rem;color:var(--blue);background:var(--bg3);padding:.1rem .35rem;border-radius:3px">' + _esc(f.chave) + '</code>';
    html += '<span style="font-size:.68rem;color:' + borda + ';font-weight:700">' + escH + '</span>';
    html += '</div>';

    // Contagem por tipo
    if (f.tipo === 'clientes' && f.analise_cli) {
      var a = f.analise_cli;
      html += '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem">';
      html += _badge(a.total, '#3b82f6', '🏢 clientes');
      html += _badge(a.comCnpj, a.comCnpj > 0 ? '#22c55e' : '#6b7280', '✅ com CNPJ');
      html += _badge(a.comCidade, a.comCidade > 0 ? '#8b5cf6' : '#6b7280', '📍 com cidade');
      html += '</div>';
      if (a.amostras.length) {
        html += '<div style="font-size:.67rem;color:var(--text3);margin-bottom:.25rem;font-weight:600">Exemplos:</div>';
        html += '<div style="font-size:.71rem;color:var(--text2)">';
        a.amostras.forEach(function(c) {
          html += '<div style="padding:.2rem 0;border-bottom:1px dashed var(--border)">'
            + '🏢 <strong>' + _esc(c.nome) + '</strong>'
            + (c.cnpj   ? ' &nbsp;<span style="color:#22c55e">CNPJ: ' + _esc(c.cnpj) + '</span>' : '')
            + (c.cidade ? ' &nbsp;<span style="color:#8b5cf6">📍 ' + _esc(c.cidade) + '</span>' : '')
            + '</div>';
        });
        html += '</div>';
      }
    } else if (f.tipo === 'contatos' && f.analise_cts) {
      var ac = f.analise_cts;
      html += '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem">';
      html += _badge(ac.total, '#0ea5e9', '👤 contatos');
      html += _badge(ac.comEmail, ac.comEmail > 0 ? '#22c55e' : '#6b7280', '📧 com e-mail');
      html += _badge(ac.comTelefone, ac.comTelefone > 0 ? '#f59e0b' : '#6b7280', '📞 com telefone');
      html += '</div>';
      if (ac.amostras.length) {
        html += '<div style="font-size:.67rem;color:var(--text3);margin-bottom:.25rem;font-weight:600">Exemplos:</div>';
        html += '<div style="font-size:.71rem;color:var(--text2)">';
        ac.amostras.forEach(function(c) {
          html += '<div style="padding:.2rem 0;border-bottom:1px dashed var(--border)">'
            + '👤 <strong>' + _esc(c.nome) + '</strong>'
            + (c.empresa  ? ' — ' + _esc(c.empresa) : '')
            + (c.email    ? ' &nbsp;📧 ' + _esc(c.email) : '')
            + (c.telefone ? ' &nbsp;📞 ' + _esc(c.telefone) : '')
            + '</div>';
        });
        html += '</div>';
      }
    } else if (f.tipo === 'historico') {
      html += '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.4rem">';
      html += _badge(f.analise_hist ? f.analise_hist.total : f.raw_count, '#f59e0b', '💬 registros');
      html += '</div>';
    } else if (f.tipo === 'tombstone') {
      html += '<div style="font-size:.7rem;color:var(--text3)">🪦 tombstone — ' + f.raw_count + ' nome(s) deletado(s) explicitamente</div>';
    }

    // Metadata
    if (f.updated_at) {
      html += '<div style="font-size:.65rem;color:var(--text3);margin-top:.3rem">Atualizado: ' + _esc(new Date(f.updated_at).toLocaleString('pt-BR')) + '</div>';
    }
    if (f.tamanho_bytes !== undefined) {
      html += '<div style="font-size:.65rem;color:var(--text3)">' + Math.ceil(f.tamanho_bytes / 1024) + ' KB no localStorage</div>';
    }
    html += '</div>';
    return html;
  }

  function _renderizarResultado(resultado, elId) {
    var el = document.getElementById(elId);
    if (!el) { console.warn('[Diagnóstico] elemento #' + elId + ' não encontrado'); return; }

    var html = '';

    // Empresa ativa
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.7rem .9rem;margin-bottom:.8rem">'
      + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.2rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Empresa ativa no momento do diagnóstico</div>'
      + (resultado.empresa_ativa.id
          ? '<div style="font-weight:700;color:var(--text)">' + _esc(resultado.empresa_ativa.nome) + '</div>'
            + '<div style="font-size:.68rem;color:var(--text3)">' + _esc(resultado.empresa_ativa.id) + '</div>'
          : '<div style="color:var(--red);font-size:.78rem">⚠️ Nenhuma empresa ativa detectada — selecione uma empresa antes de continuar.</div>')
      + '</div>';

    // Aviso
    html += '<div style="background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.3);border-radius:6px;padding:.55rem .8rem;margin-bottom:.8rem;font-size:.73rem;color:var(--text2)">'
      + '✅ Diagnóstico somente leitura — nenhum dado foi alterado, migrado ou apagado.'
      + '</div>';

    // Resumo por tipo
    var totalCliLS  = 0, totalCliLSCnpj  = 0, totalCliLSCid = 0;
    var totalCtLS   = 0;
    var totalHistLS = 0;
    var totalCliSB  = 0, totalCliSBCnpj  = 0, totalCliSBCid = 0;
    var totalCtSB   = 0;
    var fontesMaisCompletas = [];

    resultado.localStorage.forEach(function(f) {
      if (f.tipo === 'clientes' && f.analise_cli) {
        totalCliLS  += f.analise_cli.total;
        totalCliLSCnpj += f.analise_cli.comCnpj;
        totalCliLSCid  += f.analise_cli.comCidade;
        if (f.analise_cli.comCnpj > 0 || f.analise_cli.comCidade > 0) {
          fontesMaisCompletas.push({ origem: 'localStorage', chave: f.chave, total: f.analise_cli.total, cnpj: f.analise_cli.comCnpj, cid: f.analise_cli.comCidade });
        }
      }
      if (f.tipo === 'contatos' && f.analise_cts) totalCtLS  += f.analise_cts.total;
      if (f.tipo === 'historico' && f.analise_hist) totalHistLS += f.analise_hist.total;
    });
    resultado.supabase.forEach(function(f) {
      if (f.tipo === 'clientes' && f.analise_cli) {
        totalCliSB  += f.analise_cli.total;
        totalCliSBCnpj += f.analise_cli.comCnpj;
        totalCliSBCid  += f.analise_cli.comCidade;
        if (f.analise_cli.comCnpj > 0 || f.analise_cli.comCidade > 0) {
          fontesMaisCompletas.push({ origem: 'Supabase', chave: f.chave, total: f.analise_cli.total, cnpj: f.analise_cli.comCnpj, cid: f.analise_cli.comCidade });
        }
      }
      if (f.tipo === 'contatos' && f.analise_cts) totalCtSB  += f.analise_cts.total;
    });

    // Card de resumo geral
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.75rem .9rem;margin-bottom:.8rem">'
      + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.5rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">Resumo geral — todas as fontes</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.4rem">';
    function _statCard(label, val, cor) {
      return '<div style="background:' + cor + '15;border:1px solid ' + cor + '44;border-radius:5px;padding:.4rem .6rem;text-align:center">'
        + '<div style="font-size:1.2rem;font-weight:800;color:' + cor + '">' + val + '</div>'
        + '<div style="font-size:.62rem;color:' + cor + ';text-transform:uppercase;letter-spacing:.04em;font-weight:600">' + label + '</div>'
        + '</div>';
    }
    html += _statCard('Clientes (LS)', totalCliLS, '#3b82f6');
    html += _statCard('Com CNPJ (LS)', totalCliLSCnpj, '#22c55e');
    html += _statCard('Com cidade (LS)', totalCliLSCid, '#8b5cf6');
    html += _statCard('Contatos (LS)', totalCtLS, '#0ea5e9');
    html += _statCard('Históricos (LS)', totalHistLS, '#f59e0b');
    html += _statCard('Clientes (Nuvem)', totalCliSB, '#3b82f6');
    html += _statCard('Com CNPJ (Nuvem)', totalCliSBCnpj, '#22c55e');
    html += _statCard('Com cidade (Nuvem)', totalCliSBCid, '#8b5cf6');
    html += '</div></div>';

    // Fontes mais completas
    if (fontesMaisCompletas.length) {
      fontesMaisCompletas.sort(function(a,b){ return (b.cnpj + b.cid) - (a.cnpj + a.cid); });
      html += '<div style="background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.3);border-radius:6px;padding:.7rem .9rem;margin-bottom:.8rem">'
        + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.4rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">⭐ Fontes com dados mais completos (CNPJ/cidade)</div>';
      fontesMaisCompletas.forEach(function(f) {
        html += '<div style="display:flex;align-items:center;gap:.5rem;padding:.25rem 0;border-bottom:1px dashed rgba(34,197,94,.3);font-size:.74rem">'
          + '<span style="color:var(--text2);font-weight:600">' + _esc(f.origem) + '</span>'
          + '<code style="font-size:.68rem;color:var(--blue);background:var(--bg3);padding:.05rem .3rem;border-radius:3px">' + _esc(f.chave) + '</code>'
          + _badge(f.total, '#3b82f6', '🏢')
          + _badge(f.cnpj, '#22c55e', '✅ CNPJ')
          + _badge(f.cid, '#8b5cf6', '📍 cidade')
          + '</div>';
      });
      html += '</div>';
    } else {
      html += '<div style="background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.3);border-radius:6px;padding:.65rem .9rem;margin-bottom:.8rem;font-size:.76rem;color:var(--text2)">'
        + '⚠️ Nenhuma fonte com clientes que possuam CNPJ ou cidade encontrada. Os dados podem estar no Supabase — certifique-se de estar logado.'
        + '</div>';
    }

    // Detalhe localStorage
    var lsFiltradas = resultado.localStorage.filter(function(f) { return f.raw_count > 0 || f.existe; });
    if (lsFiltradas.length) {
      html += '<details open style="margin-bottom:.7rem"><summary style="cursor:pointer;font-size:.76rem;font-weight:700;color:var(--text2);padding:.4rem 0">💾 localStorage — ' + lsFiltradas.length + ' chave(s) com dados</summary><div style="margin-top:.5rem">';
      lsFiltradas.forEach(function(f, i) { html += _cardFonte(f, i); });
      html += '</div></details>';
    } else {
      html += '<div style="font-size:.74rem;color:var(--text3);margin-bottom:.5rem">💾 Nenhuma chave de clientes/contatos encontrada no localStorage.</div>';
    }

    // Detalhe Supabase
    if (resultado.supabase.length) {
      html += '<details open style="margin-bottom:.7rem"><summary style="cursor:pointer;font-size:.76rem;font-weight:700;color:var(--text2);padding:.4rem 0">☁️ Supabase — ' + resultado.supabase.length + ' chave(s) com dados</summary><div style="margin-top:.5rem">';
      resultado.supabase.forEach(function(f, i) { html += _cardFonte(f, i); });
      html += '</div></details>';
    } else if (!window.sbClient) {
      html += '<div style="background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.3);border-radius:6px;padding:.65rem .9rem;margin-bottom:.7rem;font-size:.75rem;color:var(--text2)">'
        + '⚠️ Supabase não conectado — dados da nuvem não foram verificados. Certifique-se de estar logado.'
        + '</div>';
    } else {
      html += '<div style="font-size:.73rem;color:var(--text3);margin-bottom:.5rem">☁️ Nenhum dado encontrado no Supabase para as chaves inspecionadas.</div>';
    }

    // Plano de recuperação
    var temDadosParaRecuperar = fontesMaisCompletas.length > 0;
    html += '<div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:.75rem .9rem;margin-bottom:.5rem">'
      + '<div style="font-size:.72rem;color:var(--text3);margin-bottom:.5rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em">🗺️ Próximo passo recomendado</div>';
    if (temDadosParaRecuperar) {
      html += '<div style="font-size:.75rem;color:var(--text2);line-height:1.6">'
        + '1. Selecione a empresa correta no menu superior.<br>'
        + '2. Clique em <strong>🔍 Executar Prévia</strong> para ver exatamente o que será recuperado.<br>'
        + '3. Verifique os clientes listados na prévia (CNPJ, cidade, nome).<br>'
        + '4. Se correto, confirme digitando <strong>RECUPERAR RELACIONAMENTO</strong>.<br>'
        + '5. Os dados antigos NÃO serão apagados — apenas mesclados na empresa ativa.'
        + '</div>';
    } else {
      html += '<div style="font-size:.75rem;color:var(--text2)">'
        + 'Nenhum dado com CNPJ/cidade foi encontrado nas fontes disponíveis. Verifique se está logado no Supabase e se a empresa correta está selecionada.'
        + '</div>';
    }
    html += '</div>';

    html += '<div style="font-size:.67rem;color:var(--text3);text-align:center;margin-top:.5rem">'
      + 'Diagnóstico executado em ' + new Date(resultado.timestamp).toLocaleString('pt-BR') + ' — nenhum dado foi alterado.'
      + '</div>';

    el.innerHTML = html;
  }

  // ── UI pública ───────────────────────────────────────────────
  window.rrDiagnosticoCompleto = async function () {
    var el = document.getElementById('rrResultado');
    if (el) {
      el.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--text3);font-size:.8rem">'
        + '🔬 Varrendo todas as fontes de dados...<br>'
        + '<span style="font-size:.7rem">localStorage + Supabase — somente leitura</span>'
        + '</div>';
    }

    try {
      var resultado = await executarDiagnostico();
      window._rrDiagResultado = resultado; // salva para inspeção no console
      _renderizarResultado(resultado, 'rrResultado');
    } catch (e) {
      console.error('[Diagnóstico] Erro:', e);
      if (el) {
        el.innerHTML = '<div style="padding:1rem;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;color:#ef4444;font-size:.77rem">'
          + '❌ Erro ao executar diagnóstico: ' + _esc(e.message) + '</div>';
      }
    }
  };

  // Expõe também para uso no console
  window.rrDiagnosticoConsolePuro = executarDiagnostico;

  console.info('%c[Diagnóstico Clientes/CNPJ] carregado — window.rrDiagnosticoCompleto()', 'color:#f59e0b;font-weight:700');

}(window));

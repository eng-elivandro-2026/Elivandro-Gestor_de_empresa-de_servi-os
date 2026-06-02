// ============================================================
// avisos-inline.js — Quadro de Avisos (post-its internos)
// Comunicacao rapida Comercial/Operacional (Elivandro/Adriano).
// Tabela: quadro_avisos (migration 032). Acesso: dono + adriano@tecfusion.com.br.
// ============================================================
(function (window, document) {
  'use strict';

  var ADRIANO_EMAIL = 'adriano@tecfusion.com.br';

  var PRIORIDADES = { normal: 'Normal', alta: 'Alta', urgente: 'Urgente' };
  var STATUSES = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido', arquivado: 'Arquivado' };

  var state = {
    avisos: [],
    usuarios: [],
    carregando: false,
    erro: '',
    busca: '',
    fStatus: '',
    fResp: '',
    fPrio: '',
    fData: '',
    verResolvidos: false,
    form: null // objeto do aviso em edicao/criacao (modal aberto) ou null
  };

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function getEmpresaId() {
    if (typeof window.getEmpresaAtivaId === 'function') return window.getEmpresaAtivaId();
    return window._empresaAtiva ? window._empresaAtiva.id : null;
  }
  function perfilAtual() {
    return String((typeof window.getPerfilUsuario === 'function' ? window.getPerfilUsuario() : window._perfilUsuario) || '').toLowerCase();
  }
  function emailAtual() {
    return String(window._userEmail || '').trim().toLowerCase();
  }
  function ehDono() { return perfilAtual() === 'dono'; }
  // Pode usar o quadro (criar/editar/resolver): dono ou adriano.
  function podeUsar() { return ehDono() || emailAtual() === ADRIANO_EMAIL; }
  function notify(t, tipo) {
    if (typeof window.toast === 'function') { try { window.toast(t, tipo === 'err' ? 'err' : 'ok'); return; } catch (e) {} }
    if (typeof window.msg === 'function') { try { window.msg(t, tipo); return; } catch (e) {} }
  }
  function hojeISO() { return new Date().toISOString().slice(0, 10); }
  function dataBR(d) { return d ? String(d).split('-').reverse().join('/') : ''; }
  function estaVencido(a) {
    return a && a.data_final && a.status !== 'resolvido' && a.status !== 'arquivado' && String(a.data_final) < hojeISO();
  }

  // ── Dados ────────────────────────────────────────────────
  async function carregarAvisos() {
    var empId = getEmpresaId();
    if (!window.sbClient || !empId) { state.erro = 'Supabase nao conectado ou empresa nao selecionada.'; return; }
    state.carregando = true; state.erro = '';
    render();
    try {
      var res = await window.sbClient
        .from('quadro_avisos')
        .select('*')
        .eq('empresa_id', empId)
        .order('atualizado_em', { ascending: false });
      if (res.error) throw res.error;
      state.avisos = res.data || [];
    } catch (e) {
      state.erro = (e && e.message) || String(e);
    } finally {
      state.carregando = false;
      render();
    }
  }

  async function carregarUsuarios() {
    var empId = getEmpresaId();
    if (!window.sbClient || !empId) return;
    try {
      var res = await window.sbClient
        .from('usuario_empresas')
        .select('usuario_id, ativo, perfil_empresa, usuarios(nome, email)')
        .eq('empresa_id', empId)
        .eq('ativo', true);
      if (res.error) throw res.error;
      var lista = [];
      (res.data || []).forEach(function (r) {
        var u = r && r.usuarios ? r.usuarios : null;
        var perfil = String((r && r.perfil_empresa) || '').toLowerCase();
        // Apenas usuarios com perfil dono ou gestor podem ser responsaveis.
        if (perfil !== 'dono' && perfil !== 'gestor') return;
        if (u && u.email) lista.push({ nome: u.nome || u.email, email: String(u.email).toLowerCase() });
      });
      // ordena por nome
      lista.sort(function (a, b) { return a.nome.localeCompare(b.nome); });
      state.usuarios = lista;
    } catch (e) {
      state.usuarios = []; // fallback: select de responsavel fica vazio (texto livre no modal)
    }
  }

  // ── Filtro ───────────────────────────────────────────────
  function avisosFiltrados() {
    var busca = (state.busca || '').toLowerCase();
    return (state.avisos || []).filter(function (a) {
      var resolvido = a.status === 'resolvido' || a.status === 'arquivado';
      // Quadro principal mostra nao-resolvidos; pagina "Resolvidos" mostra resolvidos/arquivados.
      if (state.verResolvidos) { if (!resolvido) return false; }
      else { if (resolvido) return false; }

      if (state.fStatus && a.status !== state.fStatus) return false;
      if (state.fResp && String(a.responsavel_email || '').toLowerCase() !== state.fResp.toLowerCase()) return false;
      if (state.fPrio && a.prioridade !== state.fPrio) return false;
      if (state.fData && String(a.data_final || '') !== state.fData) return false;
      if (busca) {
        var hay = [a.assunto, a.descricao, a.responsavel_email, a.cliente_ref, a.proposta_ref, a.obra_ref, a.criado_por_email].join(' ').toLowerCase();
        if (hay.indexOf(busca) < 0) return false;
      }
      return true;
    });
  }

  // ── Render ───────────────────────────────────────────────
  function render() {
    var root = document.getElementById('avisos-root');
    if (!root) return;

    if (!podeUsar()) {
      root.innerHTML = '<div class="card" style="color:var(--text3);margin:1rem">Voce nao tem permissao para acessar o Quadro de Avisos.</div>';
      return;
    }

    var todos = state.avisos || [];
    var abertos = todos.filter(function (a) { return a.status === 'aberto'; }).length;
    var emand = todos.filter(function (a) { return a.status === 'em_andamento'; }).length;
    var vencidos = todos.filter(estaVencido).length;
    var resolvidos = todos.filter(function (a) { return a.status === 'resolvido' || a.status === 'arquivado'; }).length;

    var html = '';
    // Estilo post-it: dobrinha discreta no canto superior direito do card.
    html += '<style id="avEstilos">'
      + '.av-card::after{content:"";position:absolute;top:0;right:0;width:0;height:0;'
      + 'border-style:solid;border-width:0 14px 14px 0;'
      + 'border-color:transparent rgba(15,23,42,.14) transparent transparent;'
      + 'border-top-right-radius:8px;}'
      + '</style>';
    html += '<div style="padding:1rem;max-width:1200px;margin:0 auto">';
    // Cabecalho
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;margin-bottom:.85rem">'
      + '<div><div style="font-size:1.35rem;font-weight:900;color:var(--text)">📌 Quadro de Avisos</div>'
      + '<div style="font-size:.85rem;color:var(--text2);margin-top:.15rem">Comunicacao rapida e lembretes entre Comercial e Operacional.</div></div>'
      + '<div style="display:flex;gap:.5rem;flex-wrap:wrap">'
      + '<button class="btn" onclick="avNovo()" style="background:var(--accent);color:#000;font-weight:800;padding:.5rem .9rem;border:none;border-radius:7px;cursor:pointer">+ Novo Aviso</button>'
      + '<button class="btn" onclick="avToggleResolvidos()" style="padding:.5rem .9rem;border:1px solid var(--border);border-radius:7px;cursor:pointer;background:' + (state.verResolvidos ? 'var(--accent);color:#000' : 'var(--bg3);color:var(--text2)') + ';font-weight:700">' + (state.verResolvidos ? '← Voltar ao Quadro' : '✅ Resolvidos') + '</button>'
      + '</div></div>';

    // KPIs
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.6rem;margin-bottom:.9rem">'
      + kpi('Abertos', abertos, 'var(--blue)')
      + kpi('Em andamento', emand, '#2563eb')
      + kpi('Vencidos', vencidos, '#f85149')
      + kpi('Resolvidos', resolvidos, '#3fb950')
      + '</div>';

    // Filtros
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin-bottom:.9rem">'
      + '<input id="avBusca" placeholder="Buscar..." value="' + esc(state.busca) + '" oninput="avSetFiltro(\'busca\',this.value)" style="padding:.48rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">'
      + selFiltro('avFStatus', 'fStatus', 'Status', STATUSES)
      + selRespFiltro()
      + selFiltro('avFPrio', 'fPrio', 'Prioridade', PRIORIDADES)
      + '<input id="avFData" type="date" value="' + esc(state.fData) + '" onchange="avSetFiltro(\'fData\',this.value)" style="padding:.48rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">'
      + '</div>';

    // Estado
    if (state.carregando) {
      html += '<div class="card" style="color:var(--text3)">Carregando avisos...</div>';
    } else if (state.erro) {
      html += '<div class="card" style="border-color:rgba(248,81,73,.4);color:#f85149">' + esc(state.erro) + '</div>';
    } else {
      var lista = avisosFiltrados();
      if (!lista.length) {
        html += '<div class="card" style="color:var(--text3)">' + (state.verResolvidos ? 'Nenhum aviso resolvido.' : 'Nenhum aviso no quadro. Clique em "+ Novo Aviso".') + '</div>';
      } else {
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:.7rem">'
          + lista.map(cardAviso).join('') + '</div>';
      }
    }

    html += '</div>'; // wrapper
    html += state.form ? modalHtml() : '';
    root.innerHTML = html;
  }

  function kpi(label, valor, cor) {
    return '<div style="border:1px solid var(--border);border-radius:8px;background:var(--bg2);padding:.6rem .75rem">'
      + '<div style="font-size:1.5rem;font-weight:900;color:' + cor + ';line-height:1">' + valor + '</div>'
      + '<div style="font-size:.72rem;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-top:.15rem">' + esc(label) + '</div></div>';
  }

  function selFiltro(id, chave, label, obj) {
    var cur = state[chave] || '';
    var html = '<select id="' + id + '" onchange="avSetFiltro(\'' + chave + '\',this.value)" style="padding:.48rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">';
    html += '<option value="">' + esc(label) + ': todos</option>';
    Object.keys(obj).forEach(function (k) {
      html += '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + esc(obj[k]) + '</option>';
    });
    return html + '</select>';
  }

  function selRespFiltro() {
    var html = '<select id="avFResp" onchange="avSetFiltro(\'fResp\',this.value)" style="padding:.48rem .6rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text)">';
    html += '<option value="">Responsavel: todos</option>';
    (state.usuarios || []).forEach(function (u) {
      html += '<option value="' + esc(u.email) + '"' + (state.fResp === u.email ? ' selected' : '') + '>' + esc(u.nome) + '</option>';
    });
    return html + '</select>';
  }

  function corStatus(st) {
    return st === 'em_andamento' ? '#2563eb' : st === 'resolvido' ? '#3fb950' : st === 'arquivado' ? 'var(--text3)' : 'var(--blue)';
  }
  // Cor por prioridade: Normal=azul, Alta=laranja, Urgente=vermelho.
  function corPrio(p) {
    return p === 'urgente' ? '#f85149' : p === 'alta' ? '#f97316' : '#2563eb';
  }
  function fundoPrio(p) {
    return p === 'urgente' ? 'rgba(248,81,73,.06)' : p === 'alta' ? 'rgba(249,115,22,.06)' : 'rgba(37,99,235,.05)';
  }
  function dataHoraBR(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    if (isNaN(d)) return '';
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return p2(d.getDate()) + '/' + p2(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function bdg(texto, cor) {
    return '<span style="display:inline-flex;align-items:center;background:' + cor + '22;border:1px solid ' + cor + '66;color:' + cor + ';border-radius:5px;padding:.08rem .42rem;font-size:.66rem;font-weight:800;white-space:nowrap">' + esc(texto) + '</span>';
  }

  function cardAviso(a) {
    var vencido = estaVencido(a);
    // Cor do card pela PRIORIDADE (Normal=azul, Alta=laranja, Urgente=vermelho).
    var borda = corPrio(a.prioridade);
    var fundo = fundoPrio(a.prioridade);
    var resp = a.responsavel_email ? nomeUsuario(a.responsavel_email) : '';
    var refs = [];
    if (a.cliente_ref) refs.push('👤 ' + esc(a.cliente_ref));
    if (a.proposta_ref) refs.push('📄 ' + esc(a.proposta_ref));
    if (a.obra_ref) refs.push('🏗️ ' + esc(a.obra_ref));

    var podeEditar = podeUsar();
    var acoes = '';
    if (podeEditar) {
      acoes += '<button onclick="avEditar(\'' + esc(a.id) + '\')" style="' + btnMini('var(--bg3)', 'var(--text2)') + '">✏️ Editar</button>';
      if (a.status !== 'em_andamento' && a.status !== 'resolvido') acoes += '<button onclick="avStatus(\'' + esc(a.id) + '\',\'em_andamento\')" style="' + btnMini('rgba(37,99,235,.15)', '#2563eb') + '">▶ Em andamento</button>';
      if (a.status !== 'resolvido') acoes += '<button onclick="avResolver(\'' + esc(a.id) + '\')" style="' + btnMini('rgba(63,185,80,.15)', '#3fb950') + '">✓ Resolver</button>';
      if (a.status === 'resolvido') acoes += '<button onclick="avStatus(\'' + esc(a.id) + '\',\'aberto\')" style="' + btnMini('var(--bg3)', 'var(--text2)') + '">↩ Reabrir</button>';
      if (ehDono()) acoes += '<button onclick="avExcluir(\'' + esc(a.id) + '\')" style="' + btnMini('rgba(248,81,73,.12)', '#f85149') + '">🗑 Excluir</button>';
    }

    return '<div class="av-card" style="position:relative;border:1px solid ' + borda + ';border-left:4px solid ' + borda + ';border-radius:8px;background:' + fundo + ';padding:.7rem .8rem;display:flex;flex-direction:column;gap:.4rem;box-shadow:0 2px 6px rgba(15,23,42,.08)">'
      + '<div style="display:flex;gap:.35rem;flex-wrap:wrap;align-items:center;padding-right:1.1rem">'
      + bdg(STATUSES[a.status] || a.status, corStatus(a.status))
      + bdg(PRIORIDADES[a.prioridade] || a.prioridade, corPrio(a.prioridade))
      + (vencido ? bdg('VENCIDO', '#f85149') : '')
      + '</div>'
      + '<div style="font-weight:800;color:var(--text);font-size:.95rem;line-height:1.25">' + esc(a.assunto || '-') + '</div>'
      + (a.descricao ? '<div style="font-size:.95rem;font-weight:400;color:var(--text2);line-height:1.4;white-space:pre-wrap;word-break:break-word">' + esc(a.descricao) + '</div>' : '')
      + '<div style="font-size:.74rem;color:var(--text3);display:flex;flex-direction:column;gap:.15rem">'
      + (resp ? '<div>Responsavel: <strong style="color:var(--text2)">' + esc(resp) + '</strong></div>' : '')
      + (a.data_final ? '<div>Prazo: <strong style="color:' + (vencido ? '#f85149' : 'var(--text2)') + '">' + esc(dataBR(a.data_final)) + '</strong></div>' : '')
      + (a.criado_por_email ? '<div>Criado por: ' + esc(a.criado_por_email) + '</div>' : '')
      + (a.criado_em ? '<div>Criado em: ' + esc(dataHoraBR(a.criado_em)) + '</div>' : '')
      + (refs.length ? '<div>' + refs.join(' &nbsp; ') + '</div>' : '')
      + '</div>'
      + (acoes ? '<div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-top:.2rem">' + acoes + '</div>' : '')
      + '</div>';
  }
  function btnMini(bg, cor) {
    return 'padding:.25rem .5rem;border:1px solid ' + cor + '55;border-radius:5px;background:' + bg + ';color:' + cor + ';font-size:.7rem;font-weight:700;cursor:pointer';
  }
  function nomeUsuario(email) {
    var u = (state.usuarios || []).find(function (x) { return x.email === String(email).toLowerCase(); });
    return u ? u.nome : email;
  }

  // ── Modal criar/editar ───────────────────────────────────
  function modalHtml() {
    var f = state.form || {};
    var ehNovo = !f.id;
    var respOpts = '<option value="">— selecione —</option>'
      + (state.usuarios || []).map(function (u) { return '<option value="' + esc(u.email) + '"' + (f.responsavel_email === u.email ? ' selected' : '') + '>' + esc(u.nome) + '</option>'; }).join('');
    function selObj(obj, cur) {
      return Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (cur === k ? ' selected' : '') + '>' + esc(obj[k]) + '</option>'; }).join('');
    }
    function campo(label, inner) {
      return '<label style="display:flex;flex-direction:column;gap:.25rem;font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase">' + esc(label) + inner + '</label>';
    }
    var inp = 'padding:.42rem .55rem;border:1px solid var(--border);border-radius:6px;background:var(--bg3);color:var(--text);font-size:.86rem;font-weight:400;text-transform:none;width:100%;box-sizing:border-box';
    var g2 = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.55rem';
    var g3 = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.55rem';
    return '<div id="avModalOverlay" onclick="if(event.target===this)avFecharModal()" style="position:fixed;inset:0;z-index:960;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;padding:.7rem;overflow:auto">'
      + '<div style="width:min(600px,96vw);max-height:95vh;background:var(--bg2);border:1px solid var(--border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.6);display:flex;flex-direction:column">'
      + '<div style="flex:0 0 auto;padding:.65rem .9rem;border-bottom:1px solid var(--border);font-weight:900;color:var(--text)">' + (ehNovo ? '📌 Novo Aviso' : '✏️ Editar Aviso') + '</div>'
      + '<div style="flex:1 1 auto;min-height:0;overflow-y:auto;padding:.8rem .9rem;display:grid;gap:.55rem">'
      + campo('Assunto *', '<input id="avfAssunto" value="' + esc(f.assunto || '') + '" style="' + inp + '">')
      + campo('Descricao', '<textarea id="avfDescricao" rows="2" style="' + inp + ';resize:vertical;min-height:48px">' + esc(f.descricao || '') + '</textarea>')
      + '<div style="' + g2 + '">'
      + campo('Responsavel', '<select id="avfResp" style="' + inp + '">' + respOpts + '</select>')
      + campo('Prioridade', '<select id="avfPrio" style="' + inp + '">' + selObj(PRIORIDADES, f.prioridade || 'normal') + '</select>')
      + '</div>'
      + '<div style="' + g2 + '">'
      + campo('Status', '<select id="avfStatus" style="' + inp + '">' + selObj(STATUSES, f.status || 'aberto') + '</select>')
      + campo('Data final', '<input id="avfData" type="date" value="' + esc(f.data_final || '') + '" style="' + inp + '">')
      + '</div>'
      + '<div style="' + g3 + '">'
      + campo('Cliente (opcional)', '<input id="avfCliente" value="' + esc(f.cliente_ref || '') + '" style="' + inp + '">')
      + campo('Proposta (opcional)', '<input id="avfProposta" value="' + esc(f.proposta_ref || '') + '" style="' + inp + '">')
      + campo('Obra (opcional)', '<input id="avfObra" value="' + esc(f.obra_ref || '') + '" style="' + inp + '">')
      + '</div>'
      + '</div>'
      + '<div style="flex:0 0 auto;padding:.7rem .9rem;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:.5rem">'
      + '<button onclick="avFecharModal()" style="padding:.5rem .9rem;border:1px solid var(--border);border-radius:7px;background:var(--bg3);color:var(--text2);font-weight:700;cursor:pointer">Cancelar</button>'
      + '<button onclick="avSalvar()" style="padding:.5rem 1.1rem;border:none;border-radius:7px;background:var(--accent);color:#000;font-weight:800;cursor:pointer">Salvar</button>'
      + '</div></div></div>';
  }

  // ── Acoes (window.*) ─────────────────────────────────────
  function rAvisos() {
    if (!podeUsar()) { render(); return; }
    carregarUsuarios().then(carregarAvisos);
  }
  function setFiltro(chave, valor) {
    state[chave] = valor;
    // Selecionar status "Resolvido"/"Arquivado" alterna para a pasta Resolvidos.
    // Selecionar um status aberto volta para o quadro principal.
    if (chave === 'fStatus') {
      if (valor === 'resolvido' || valor === 'arquivado') state.verResolvidos = true;
      else if (valor) state.verResolvidos = false;
    }
    // re-render mantendo foco da busca
    if (chave === 'busca') {
      render();
      var b = document.getElementById('avBusca');
      if (b) { b.focus(); b.value = valor; b.setSelectionRange(valor.length, valor.length); }
    } else { render(); }
  }
  function toggleResolvidos() { state.verResolvidos = !state.verResolvidos; render(); }
  function abrirQuadro() { state.verResolvidos = false; rAvisos(); }
  function abrirResolvidos() { state.verResolvidos = true; rAvisos(); }
  function novo() {
    if (!podeUsar()) return notify('Sem permissao.', 'err');
    state.form = { prioridade: 'normal', status: 'aberto' };
    render();
  }
  function editar(id) {
    var a = (state.avisos || []).find(function (x) { return String(x.id) === String(id); });
    if (!a) return;
    state.form = Object.assign({}, a);
    render();
  }
  function fecharModal() { state.form = null; render(); }

  function lerForm() {
    function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
    return {
      assunto: v('avfAssunto').trim(),
      descricao: v('avfDescricao').trim() || null,
      responsavel_email: v('avfResp') || null,
      prioridade: v('avfPrio') || 'normal',
      status: v('avfStatus') || 'aberto',
      data_final: v('avfData') || null,
      cliente_ref: v('avfCliente').trim() || null,
      proposta_ref: v('avfProposta').trim() || null,
      obra_ref: v('avfObra').trim() || null
    };
  }

  async function salvar() {
    if (!podeUsar()) return notify('Sem permissao.', 'err');
    var dados = lerForm();
    if (!dados.assunto) return notify('Informe o assunto.', 'err');
    var empId = getEmpresaId();
    if (!window.sbClient || !empId) return notify('Supabase/empresa indisponivel.', 'err');
    // controla resolvido_em conforme status
    if (dados.status === 'resolvido') dados.resolvido_em = new Date().toISOString();
    else dados.resolvido_em = null;
    if (dados.status === 'arquivado') dados.arquivado_em = new Date().toISOString();
    var editId = state.form && state.form.id;
    try {
      var res;
      if (editId) {
        res = await window.sbClient.from('quadro_avisos').update(dados).eq('id', editId).eq('empresa_id', empId).select('*').single();
      } else {
        dados.empresa_id = empId;
        dados.criado_por_email = emailAtual();
        res = await window.sbClient.from('quadro_avisos').insert(dados).select('*').single();
      }
      if (res.error) throw res.error;
      state.form = null;
      notify(editId ? 'Aviso atualizado.' : 'Aviso criado.');
      await carregarAvisos();
    } catch (e) {
      notify((e && e.message) || 'Nao foi possivel salvar o aviso.', 'err');
    }
  }

  async function mudarStatus(id, novoStatus) {
    if (!podeUsar()) return notify('Sem permissao.', 'err');
    var empId = getEmpresaId();
    var patch = { status: novoStatus };
    if (novoStatus === 'resolvido') patch.resolvido_em = new Date().toISOString();
    if (novoStatus === 'aberto') patch.resolvido_em = null;
    try {
      var res = await window.sbClient.from('quadro_avisos').update(patch).eq('id', id).eq('empresa_id', empId).select('*').single();
      if (res.error) throw res.error;
      notify('Status atualizado para "' + (STATUSES[novoStatus] || novoStatus) + '".');
      await carregarAvisos();
    } catch (e) {
      notify((e && e.message) || 'Nao foi possivel atualizar.', 'err');
    }
  }
  function resolver(id) { mudarStatus(id, 'resolvido'); }

  async function excluir(id) {
    if (!ehDono()) return notify('Apenas o Dono pode excluir.', 'err');
    if (!window.confirm('Excluir este aviso definitivamente?')) return;
    var empId = getEmpresaId();
    try {
      var res = await window.sbClient.from('quadro_avisos').delete().eq('id', id).eq('empresa_id', empId);
      if (res.error) throw res.error;
      notify('Aviso excluido.');
      await carregarAvisos();
    } catch (e) {
      notify((e && e.message) || 'Nao foi possivel excluir.', 'err');
    }
  }

  // ── Exports ──────────────────────────────────────────────
  window.rAvisos = rAvisos;
  window.avSetFiltro = setFiltro;
  window.avToggleResolvidos = toggleResolvidos;
  window.avAbrirQuadro = abrirQuadro;
  window.avAbrirResolvidos = abrirResolvidos;
  window.avNovo = novo;
  window.avEditar = editar;
  window.avFecharModal = fecharModal;
  window.avSalvar = salvar;
  window.avStatus = mudarStatus;
  window.avResolver = resolver;
  window.avExcluir = excluir;

  // Recarrega ao trocar de empresa, se o modulo estiver ativo.
  window.addEventListener('empresa:changed', function () {
    state.avisos = []; state.usuarios = [];
    if (window.Router && window.Router.getAtivo && window.Router.getAtivo() === 'avisos') rAvisos();
  });

})(window, document);

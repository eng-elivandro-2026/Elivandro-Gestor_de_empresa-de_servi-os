/* =====================================================================
   INTEGRAÇÃO SUPABASE — PAINEL ESTRATÉGICO
   Busca propostas ao vivo (2021→hoje), agrega por ano e alimenta o painel.
   ---------------------------------------------------------------------
   CASCATA DE ANO (duas populações na tabela 'propostas'):
   - Históricas 2021-2025 (origem='importacao_historica_planilhas'):
       dados_json.ano = ano correto; created_at = data real;
       dados_json.dat2/dat/dtFech = null.
   - 2026 do portal:
       dados_json.dat2/dat preenchidos; dtFech quando fechada;
       created_at = data de SYNC (NÃO confiável para ano).

   Regras (idênticas ao portal — app-core.js getPropsAno / getFechAno /
   isPropostaGanhaOuAprovada):
   - ano de CRIAÇÃO  = parseAnoISO(dj.dat2) || parseAnoBR(dj.dat)
                       || Number(dj.ano) || ano(created_at)
   - ano de FECHAMENTO = parseAnoISO(dj.dtFech) || ano de criação
   - "ganha" = FAS_FECHADO.indexOf(fas||fase) >= 0
   - exclui em_elaboracao das contagens por ano
   - valor = coluna valor_total; se null/0 → dados_json.val

   Tudo client-side. Não toca em banco/RLS.
   ===================================================================== */

const SB_URL = "https://ojuuzojwnyxdsavdosif.supabase.co";
const SB_KEY = "sb_publishable_uqS8EZTOs5-sHKr1IpFhzg_eZrZOr7u";
const TECFUSION_EMPRESA_ID = "9ffb1910-dc3d-4848-aa99-3c42ced4e284";

// Cliente: reusa o do portal (mesma origem) ou cria o próprio. Sessão herdada
// do localStorage same-origin → RLS aplica com a identidade do usuário logado.
let _sbDash = null;
function getSbClient() {
  if (_sbDash) return _sbDash;
  if (window.parent && window.parent !== window && window.parent.sbClient) {
    _sbDash = window.parent.sbClient; return _sbDash;
  }
  if (window.supabase) { _sbDash = window.supabase.createClient(SB_URL, SB_KEY); return _sbDash; }
  throw new Error("Supabase SDK não carregado.");
}

/* ---------------------------------------------------------------------
   REGRA DE "GANHA" — réplica de isPropostaGanhaOuAprovada (app-core.js:343)
   --------------------------------------------------------------------- */
const FAS_FECHADO = ['ganho','aprovado','andamento','faturado','recebido','taf','sat','finalizado','atrasado',
  'em_pausa_falta_material','em_pausa_aguardando_cliente','em_pausa_aguardando_terceiro'];
// Fases de pipeline abertas conhecidas → bucket "abertas"
const FAS_PIPELINE = ['enviada','budget','cobrir','rascunho','follow1','follow3','follow4','cliente_analisando','outro_pipeline'];
function faseDaProposta(row, dj) {
  // coluna 'fase' (= p.fas no sync) com fallback p/ dados_json.fas / .fase
  return String(row.fase || (dj && (dj.fas || dj.fase)) || '').toLowerCase().trim();
}
function ehGanha(fase) { return FAS_FECHADO.indexOf(fase) >= 0; }
function ehEmElaboracao(fase) { return fase === 'em_elaboracao'; }
function ehPipelineConhecido(fase) { return FAS_PIPELINE.indexOf(fase) >= 0; }

/* ---------------------------------------------------------------------
   HELPERS DE ANO — robustos contra null/vazio
   --------------------------------------------------------------------- */
// ISO 'YYYY-MM-DD...' → ano (Number) ou null
function parseAnoISO(v) {
  if (!v) return null;
  const d = new Date(String(v) + 'T12:00:00');
  if (isNaN(d.getTime())) {
    // tolera ISO já com hora/timezone
    const d2 = new Date(String(v));
    return isNaN(d2.getTime()) ? null : d2.getFullYear();
  }
  return d.getFullYear();
}
// 'DD/MM/YYYY' → ano (Number) ou null
function parseAnoBR(v) {
  if (!v) return null;
  const ps = String(v).split('/');
  if (ps.length !== 3) return null;
  const d = new Date(ps[2] + '-' + ps[1] + '-' + ps[0] + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d.getFullYear();
}
function anoCriacao(row, dj) {
  return parseAnoISO(dj.dat2)
      || parseAnoBR(dj.dat)
      || (dj.ano ? Number(dj.ano) : null)
      || (row.created_at ? new Date(row.created_at).getFullYear() : null);
}
function anoFechamento(row, dj) {
  return parseAnoISO(dj.dtFech) || anoCriacao(row, dj);
}
function valorDaProposta(row, dj) {
  const v = Number(row.valor_total);
  if (v) return v;
  const vj = Number(dj && dj.val);
  return vj || 0;
}

/* ---------------------------------------------------------------------
   BUSCA — inclui dados_json (dat2/dat/dtFech/ano/val vivem nele)
   --------------------------------------------------------------------- */
async function buscarPropostas() {
  const sb = getSbClient();
  const { data, error } = await sb
    .from('propostas')
    .select('numero_proposta, cliente, valor_total, fase, created_at, dados_json')
    .eq('empresa_id', TECFUSION_EMPRESA_ID)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/* ---------------------------------------------------------------------
   AGREGAÇÃO POR ANO
   - props/abertas/perdidas/carteira/concentração → ano de CRIAÇÃO
   - ganhas/faturado/ticket                       → ano de FECHAMENTO
   - em_elaboracao excluído de tudo
   --------------------------------------------------------------------- */
function _novoAno(ano) {
  return {
    ano, props: 0, ganhas: 0, abertas: 0, perdidas: 0, semStatus: 0,
    carteira: 0, faturado: 0, abertoValor: 0, perdidoValor: 0,
    conversao: 0, ticketMedio: 0, concentracaoTop1: 0,
    clientes: {}, topClientes: []
  };
}
function agregarPorAno(propostas) {
  const anos = {};
  const get = (ano) => (anos[ano] || (anos[ano] = _novoAno(ano)));

  for (const row of propostas) {
    const dj = row.dados_json || {};
    const fase = faseDaProposta(row, dj);
    if (ehEmElaboracao(fase)) continue;            // exclui em_elaboracao (igual ao portal)

    const valor = valorDaProposta(row, dj);
    const aCri = anoCriacao(row, dj);
    const ganha = ehGanha(fase);

    // ── Bucket de CRIAÇÃO: total de props, carteira, abertas/perdidas, clientes ──
    if (aCri) {
      const a = get(aCri);
      a.props++;
      a.carteira += valor;
      if (ganha) {
        // contabilizada como ganha no ano de FECHAMENTO (abaixo); aqui não soma aberta/perdida
      } else if (/perdido/.test(fase) || fase === 'virou_outra_proposta') {
        a.perdidas++; a.perdidoValor += valor;
      } else if (ehPipelineConhecido(fase)) {
        a.abertas++; a.abertoValor += valor;
      } else {
        // fase não reconhecida (vazio, 'outro', etc.) — não conta como pipeline ativo
        a.semStatus++;
      }
      const cli = (row.cliente || dj.cli || dj.loc || 'SEM CLIENTE').toUpperCase().trim();
      a.clientes[cli] = (a.clientes[cli] || 0) + valor;
    }

    // ── Bucket de FECHAMENTO: ganhas + faturado ──
    if (ganha) {
      const aFch = anoFechamento(row, dj);
      if (aFch) {
        const af = get(aFch);
        af.ganhas++;
        af.faturado += valor;
      }
    }
  }

  // ── Métricas derivadas ──
  for (const k in anos) {
    const a = anos[k];
    a.conversao = a.props ? (a.ganhas / a.props) * 100 : 0;
    a.ticketMedio = a.ganhas ? a.faturado / a.ganhas : 0;
    const arr = Object.entries(a.clientes).sort((x, y) => y[1] - x[1]);
    a.topClientes = arr.slice(0, 5).map(([nome, val]) => ({
      nome, val, pct: a.carteira ? (val / a.carteira) * 100 : 0
    }));
    a.concentracaoTop1 = (arr.length && a.carteira) ? (arr[0][1] / a.carteira) * 100 : 0;
    delete a.clientes; // limpa estrutura intermediária
  }
  return anos;
}

/* ---------------------------------------------------------------------
   ESTADO GLOBAL + CARGA
   --------------------------------------------------------------------- */
window.DADOS_ANOS = {};
window.DADOS_PROPOSTAS = [];

async function carregarDashboard({ silent = false } = {}) {
  const statusEl = document.getElementById('sbStatus');
  try {
    if (statusEl && !silent) { statusEl.textContent = '⟳ Carregando dados...'; statusEl.style.color = 'var(--muted)'; }
    const propostas = await buscarPropostas();
    window.DADOS_PROPOSTAS = propostas;
    window.DADOS_ANOS = agregarPorAno(propostas);
    if (typeof window.renderDashboard === 'function') window.renderDashboard(window.DADOS_ANOS, propostas);
    if (statusEl) {
      const upd = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      statusEl.textContent = '✓ ' + propostas.length + ' propostas · atualizado ' + upd;
      statusEl.style.color = 'var(--green2, #3fb950)';
    }
    return window.DADOS_ANOS;
  } catch (err) {
    console.error('[Dashboard] erro ao carregar:', err);
    if (statusEl) { statusEl.textContent = '⚠ Erro ao carregar — ' + (err.message || err); statusEl.style.color = 'var(--red2, #f85149)'; }
    throw err;
  }
}

window.atualizarDashboard = () => carregarDashboard({ silent: false });
window.addEventListener('load', () => { carregarDashboard().catch(() => {}); });

/* renderDashboard será definido na etapa seguinte (PASSO 3), alimentando
   os 12 charts, 8 KPIs, tabela histórica, donut e pipeline a partir de
   window.DADOS_ANOS / window.DADOS_PROPOSTAS. */

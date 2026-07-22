// ============================================================
// provisionar-empresa — Edge Function
// Aprova um pedido de cadastros_pendentes e provisiona a empresa:
// cria empresa + vínculo do dono + seeds neutros de categorias
// (gestão do tempo, financeiro, colaborador) e marca o cadastro
// como aprovado.
//
// Espelha o padrão de criar-usuario-acesso: dois clients
// (userClient anon p/ identificar o chamador; admin service_role
// p/ escrever), CORS, dry_run (default true).
//
// AUTORIZAÇÃO: só o master (is_master) — e-mail em SUPER_ADMIN_EMAILS
// ou o e-mail-mestre do projeto. (O projeto identifica o master pelo
// e-mail do JWT — mesma lógica de is_master() no SQL; não há tabela
// "profiles" neste projeto.)
// ============================================================

import { serve } from "std/http/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

type Payload = {
  cadastro_id?: unknown;
  dry_run?: unknown;
};

type Cadastro = {
  id: string;
  auth_id: string | null;
  nome: string;
  email: string;
  empresa_nome: string;
  empresa_cnpj: string;
  status: string;
};

const MASTER_EMAIL = "nascimento.gaube@gmail.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Seeds neutros (espelham as migrations 056 / 024 / 058) ──
const CATEGORIAS_TEMPO = [
  "Comercial", "Engenharia", "Operacional", "Gestão",
  "Portal", "Suporte", "Administrativo", "Pessoal",
];

const CATEGORIAS_COLABORADOR = [
  "Comercial", "Engenharia", "Montagem", "Operacional", "Administrativo", "Viagem",
];

// [codigo, nome, tipo_movimento, grupo, subgrupo, natureza, impacta_fluxo_caixa, impacta_dre, impacta_resultado_operacional, ordem]
const CATEGORIAS_FINANCEIRO: Array<[string, string, string, string, string, string, boolean, boolean, boolean, number]> = [
  ["REC.OP.001", "Receita de Serviços Técnicos", "entrada", "Receitas Operacionais", "Serviços", "operacional", true, true, true, 101],
  ["REC.OP.002", "Receita de Projetos Elétricos", "entrada", "Receitas Operacionais", "Projetos", "operacional", true, true, true, 102],
  ["REC.OP.003", "Receita de Montagem de Painéis", "entrada", "Receitas Operacionais", "Montagem", "operacional", true, true, true, 103],
  ["REC.OP.004", "Receita de Automação Industrial", "entrada", "Receitas Operacionais", "Automação", "operacional", true, true, true, 104],
  ["REC.OP.005", "Receita de Venda de Materiais", "entrada", "Receitas Operacionais", "Materiais", "operacional", true, true, true, 105],
  ["REC.OP.006", "Receita de Locação", "entrada", "Receitas Operacionais", "Locação", "operacional", true, true, true, 106],
  ["REC.OP.007", "Receita de Treinamentos", "entrada", "Receitas Operacionais", "Treinamentos", "operacional", true, true, true, 107],
  ["REC.OP.008", "Receita de Software / Licenças / Assinaturas", "entrada", "Receitas Operacionais", "Software", "operacional", true, true, true, 108],
  ["REC.NO.001", "Reembolso de Despesas", "entrada", "Entradas Não Operacionais", "Reembolsos", "financeira", true, false, false, 201],
  ["REC.NO.002", "Estorno", "entrada", "Entradas Não Operacionais", "Estornos", "financeira", true, false, false, 202],
  ["REC.NO.003", "Empréstimo Recebido", "entrada", "Entradas Não Operacionais", "Dívidas / Empréstimos", "divida", true, false, false, 203],
  ["REC.NO.004", "Rendimentos Financeiros", "entrada", "Entradas Não Operacionais", "Financeiras", "financeira", true, true, false, 204],
  ["REC.NO.005", "Juros Recebidos", "entrada", "Entradas Não Operacionais", "Financeiras", "financeira", true, true, false, 205],
  ["CD.MAT.001", "Materiais Aplicados em Obra", "saida", "Custos Diretos", "Materiais", "operacional", true, true, true, 301],
  ["CD.MAT.002", "Materiais para Revenda", "saida", "Custos Diretos", "Materiais", "operacional", true, true, true, 302],
  ["CD.MOD.001", "Mão de Obra Direta — Funcionários em Obra", "saida", "Custos Diretos", "Mão de Obra Direta", "operacional", true, true, true, 311],
  ["CD.MOD.002", "Mão de Obra Direta — Projetos Elétricos", "saida", "Custos Diretos", "Mão de Obra Direta", "operacional", true, true, true, 312],
  ["CD.MOD.003", "Mão de Obra Direta — Comissionamento / Start-up", "saida", "Custos Diretos", "Mão de Obra Direta", "operacional", true, true, true, 313],
  ["CD.MOD.004", "Mão de Obra Direta — Terceiros / Prestadores", "saida", "Custos Diretos", "Mão de Obra Direta", "operacional", true, true, true, 314],
  ["CD.OBR.001", "Deslocamento de Obra", "saida", "Custos Diretos", "Obra / Campo", "operacional", true, true, true, 321],
  ["CD.OBR.002", "Hospedagem de Obra", "saida", "Custos Diretos", "Obra / Campo", "operacional", true, true, true, 322],
  ["CD.OBR.003", "Alimentação de Obra", "saida", "Custos Diretos", "Obra / Campo", "operacional", true, true, true, 323],
  ["CD.OBR.004", "Ferramentas de Obra", "saida", "Custos Diretos", "Obra / Campo", "operacional", true, true, true, 324],
  ["CD.OBR.005", "EPIs de Obra", "saida", "Custos Diretos", "Obra / Campo", "operacional", true, true, true, 325],
  ["CD.OBR.006", "Fretes de Obra / Entrega", "saida", "Custos Diretos", "Obra / Campo", "operacional", true, true, true, 326],
  ["DO.SAL.001", "Salários — Equipe Interna", "saida", "Despesas Operacionais", "Salários", "operacional", true, true, true, 401],
  ["DO.SAL.002", "Salários — Administrativo", "saida", "Despesas Operacionais", "Salários", "operacional", true, true, true, 402],
  ["DO.SAL.003", "Salários — Financeiro", "saida", "Despesas Operacionais", "Salários", "operacional", true, true, true, 403],
  ["DO.SAL.004", "Salários — Comercial", "saida", "Despesas Operacionais", "Salários", "operacional", true, true, true, 404],
  ["DO.SAL.005", "Salários — Operacional Interno", "saida", "Despesas Operacionais", "Salários", "operacional", true, true, true, 405],
  ["DO.RH.001", "Encargos Trabalhistas", "saida", "Despesas Operacionais", "Pessoas", "operacional", true, true, true, 411],
  ["DO.RH.002", "Benefícios de Colaboradores", "saida", "Despesas Operacionais", "Pessoas", "operacional", true, true, true, 412],
  ["DO.ADM.001", "Administrativo", "saida", "Despesas Operacionais", "Administrativo", "operacional", true, true, true, 421],
  ["DO.COM.001", "Comercial / Marketing", "saida", "Despesas Operacionais", "Comercial", "operacional", true, true, true, 431],
  ["DO.PRO.001", "Contabilidade", "saida", "Despesas Operacionais", "Profissionais", "operacional", true, true, true, 441],
  ["DO.PRO.002", "Jurídico", "saida", "Despesas Operacionais", "Profissionais", "operacional", true, true, true, 442],
  ["DO.SIS.001", "Sistemas / Softwares", "saida", "Despesas Operacionais", "Tecnologia", "operacional", true, true, true, 451],
  ["DO.TEL.001", "Telefonia / Internet", "saida", "Despesas Operacionais", "Infraestrutura", "operacional", true, true, true, 461],
  ["DO.IMV.001", "Imóvel / Aluguel / Energia / Água", "saida", "Despesas Operacionais", "Infraestrutura", "operacional", true, true, true, 471],
  ["DO.VEI.001", "Veículos / Combustível / Pedágio / Manutenção", "saida", "Despesas Operacionais", "Veículos", "operacional", true, true, true, 481],
  ["DO.DIR.001", "Diretoria / Pró-labore", "saida", "Despesas Operacionais", "Diretoria", "operacional", true, true, true, 491],
  ["IMP.001", "DAS Simples Nacional", "saida", "Impostos", "Tributos", "imposto", true, true, false, 501],
  ["IMP.002", "ISS", "saida", "Impostos", "Tributos", "imposto", true, true, false, 502],
  ["IMP.003", "Retenções", "saida", "Impostos", "Tributos", "imposto", true, true, false, 503],
  ["IMP.004", "INSS", "saida", "Impostos", "Tributos", "imposto", true, true, false, 504],
  ["IMP.005", "IRRF", "saida", "Impostos", "Tributos", "imposto", true, true, false, 505],
  ["IMP.006", "Taxas e Alvarás", "saida", "Impostos", "Taxas", "imposto", true, true, false, 506],
  ["FIN.001", "Tarifas Bancárias", "saida", "Financeiras", "Tarifas", "financeira", true, true, false, 601],
  ["FIN.002", "Juros Pagos", "saida", "Financeiras", "Juros / Multas", "financeira", true, true, false, 602],
  ["FIN.003", "Multas Pagas", "saida", "Financeiras", "Juros / Multas", "financeira", true, true, false, 603],
  ["FIN.004", "Descontos Concedidos", "saida", "Financeiras", "Descontos", "financeira", true, true, false, 604],
  ["FIN.005", "Descontos Obtidos", "entrada", "Financeiras", "Descontos", "financeira", true, true, false, 605],
  ["INV.001", "Máquinas e Equipamentos", "saida", "Investimentos / Imobilizado", "Equipamentos", "investimento", true, false, false, 701],
  ["INV.002", "Computadores e Periféricos", "saida", "Investimentos / Imobilizado", "Tecnologia", "investimento", true, false, false, 702],
  ["INV.003", "Ferramentas", "saida", "Investimentos / Imobilizado", "Ferramentas", "investimento", true, false, false, 703],
  ["INV.004", "Veículos", "saida", "Investimentos / Imobilizado", "Veículos", "investimento", true, false, false, 704],
  ["INV.005", "Benfeitorias", "saida", "Investimentos / Imobilizado", "Infraestrutura", "investimento", true, false, false, 705],
  ["INV.006", "Software Permanente", "saida", "Investimentos / Imobilizado", "Tecnologia", "investimento", true, false, false, 706],
  ["SOC.001", "Distribuição de Lucros", "saida", "Sócios / Capital", "Distribuição", "socios", true, false, false, 801],
  ["SOC.002", "Adiantamento a Sócio", "saida", "Sócios / Capital", "Adiantamentos", "socios", true, false, false, 802],
  ["SOC.003", "Aporte de Sócio", "entrada", "Sócios / Capital", "Aportes", "socios", true, false, false, 803],
  ["SOC.004", "AFAC", "entrada", "Sócios / Capital", "Aportes", "socios", true, false, false, 804],
  ["SOC.005", "Integralização de Capital", "entrada", "Sócios / Capital", "Aportes", "socios", true, false, false, 805],
  ["DIV.001", "Pagamento de Principal", "saida", "Dívidas / Empréstimos", "Principal", "divida", true, false, false, 901],
  ["DIV.002", "Juros de Empréstimos", "saida", "Dívidas / Empréstimos", "Juros", "divida", true, true, false, 902],
  ["DIV.003", "Parcelamentos", "saida", "Dívidas / Empréstimos", "Parcelamentos", "divida", true, false, false, 903],
  ["DIV.004", "Financiamentos", "saida", "Dívidas / Empréstimos", "Financiamentos", "divida", true, false, false, 904],
  ["TRF.001", "Transferência entre Contas", "transferencia", "Transferências Internas", "Transferências", "transferencia", true, false, false, 1001],
  ["TRF.002", "Ajustes Internos de Caixa", "transferencia", "Transferências Internas", "Ajustes", "transferencia", true, false, false, 1002],
];

// ── Helpers (espelham criar-usuario-acesso) ──
function json(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function boolValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["1", "true", "sim", "yes"].includes(value.toLowerCase());
  return fallback;
}
function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Variavel de ambiente ausente: ${name}`);
  return value;
}
function getSuperAdminEmails(): Set<string> {
  return new Set(
    (Deno.env.get("SUPER_ADMIN_EMAILS") || "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("Falha ao consultar Auth.");
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
  throw new Error("Limite de consulta Auth excedido.");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json(405, { ok: false, erro: "Metodo nao permitido." });

  try {
    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const anonKey = getRequiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = req.headers.get("authorization") || "";

    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { ok: false, erro: "Usuario nao autenticado." });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Identifica e autoriza o chamador (só master) ──
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json(401, { ok: false, erro: "Usuario nao autenticado." });
    }
    const masterAuthId = authData.user.id;
    const masterEmail = (authData.user.email || "").toLowerCase();
    const superAdmins = getSuperAdminEmails();
    const isMaster = masterEmail === MASTER_EMAIL || superAdmins.has(masterEmail);
    if (!isMaster) {
      return json(403, { ok: false, erro: "Acesso restrito ao administrador da plataforma." });
    }

    const payload = (await req.json().catch(() => ({}))) as Payload;
    const cadastroId = str(payload.cadastro_id);
    const dryRun = boolValue(payload.dry_run, true);
    if (!cadastroId) return json(400, { ok: false, erro: "cadastro_id obrigatorio." });

    // ── 1. Busca o cadastro pendente ──
    const { data: cadastroData, error: cadastroErr } = await admin
      .from("cadastros_pendentes")
      .select("id, auth_id, nome, email, empresa_nome, empresa_cnpj, status")
      .eq("id", cadastroId)
      .maybeSingle();
    if (cadastroErr) throw new Error("Falha ao consultar cadastro.");
    const cadastro = cadastroData as Cadastro | null;
    if (!cadastro) return json(404, { ok: false, erro: "Cadastro nao encontrado." });
    if (cadastro.status !== "pendente") {
      return json(409, { ok: false, erro: `Cadastro ja processado (status: ${cadastro.status}).` });
    }

    const nome = str(cadastro.nome);
    const email = str(cadastro.email).toLowerCase();
    const empresaNome = str(cadastro.empresa_nome);
    const empresaCnpj = str(cadastro.empresa_cnpj);
    const nomeCurto = empresaNome.slice(0, 20);

    // ── Localiza o Auth user do dono (criado no cadastro público) ──
    const authUser = await findAuthUserByEmail(admin, email);
    if (!authUser) {
      return json(404, { ok: false, erro: "Usuario Auth do cadastro nao encontrado (o cadastro concluiu o signUp?)." });
    }

    if (dryRun) {
      return json(200, {
        ok: true,
        dry_run: true,
        mensagem: "Validacao concluida. Nada foi provisionado.",
        cadastro_id: cadastroId,
        empresa_nome: empresaNome,
        empresa_cnpj: empresaCnpj,
        seeds_previstos: {
          categorias_tempo: CATEGORIAS_TEMPO.length,
          categorias_financeiro: CATEGORIAS_FINANCEIRO.length,
          categorias_colaborador: CATEGORIAS_COLABORADOR.length,
        },
      });
    }

    // ── 2. Cria a empresa ──
    const { data: empresaIns, error: empresaErr } = await admin
      .from("empresas")
      .insert({ nome: empresaNome, cnpj: empresaCnpj, nome_curto: nomeCurto, ativo: true })
      .select("id")
      .single();
    if (empresaErr || !empresaIns) throw new Error("Falha ao criar empresa: " + (empresaErr?.message || ""));
    const empresaId = empresaIns.id as string;

    // ── 3-4. Cria/atualiza o usuario interno (dono) ──
    const { data: usuarioExistente, error: usuarioBuscaErr } = await admin
      .from("usuarios")
      .select("id, auth_id")
      .eq("email", email)
      .maybeSingle();
    if (usuarioBuscaErr) throw new Error("Falha ao consultar usuario interno.");

    let usuarioId: string;
    if (usuarioExistente) {
      const { data, error } = await admin
        .from("usuarios")
        .update({ auth_id: usuarioExistente.auth_id || authUser.id, nome, perfil: "dono", ativo: true })
        .eq("id", usuarioExistente.id)
        .select("id")
        .single();
      if (error || !data) throw new Error("Falha ao atualizar usuario interno.");
      usuarioId = data.id as string;
    } else {
      const { data, error } = await admin
        .from("usuarios")
        .insert({ auth_id: authUser.id, nome, email, perfil: "dono", ativo: true })
        .select("id")
        .single();
      if (error || !data) throw new Error("Falha ao criar usuario interno.");
      usuarioId = data.id as string;
    }

    // ── 5. Vincula o dono à empresa ──
    const { error: vinculoErr } = await admin
      .from("usuario_empresas")
      .upsert(
        { usuario_id: usuarioId, empresa_id: empresaId, ativo: true, perfil_empresa: "dono" },
        { onConflict: "usuario_id,empresa_id" },
      );
    if (vinculoErr) throw new Error("Falha ao vincular dono a empresa: " + vinculoErr.message);

    // ── 6. Seed categorias de gestão do tempo ──
    const { error: tempoErr } = await admin
      .from("gestao_tempo_categorias")
      .insert(CATEGORIAS_TEMPO.map((n) => ({ empresa_id: empresaId, nome: n })));
    if (tempoErr) throw new Error("Falha no seed de categorias (tempo): " + tempoErr.message);

    // ── 7. Seed plano de contas gerencial (financeiro) ──
    const { error: finErr } = await admin
      .from("financeiro_categorias_gerenciais")
      .insert(CATEGORIAS_FINANCEIRO.map((c) => ({
        empresa_id: empresaId,
        codigo: c[0], nome: c[1], tipo_movimento: c[2], grupo: c[3], subgrupo: c[4],
        natureza: c[5], impacta_fluxo_caixa: c[6], impacta_dre: c[7],
        impacta_resultado_operacional: c[8], ordem: c[9],
      })));
    if (finErr) throw new Error("Falha no seed de categorias (financeiro): " + finErr.message);

    // ── 8. Seed categorias de colaborador ──
    const { error: colabErr } = await admin
      .from("colaboradores_categorias")
      .insert(CATEGORIAS_COLABORADOR.map((n) => ({ empresa_id: empresaId, nome: n })));
    if (colabErr) throw new Error("Falha no seed de categorias (colaborador): " + colabErr.message);

    // ── 9. Marca o cadastro como aprovado ──
    const { error: updErr } = await admin
      .from("cadastros_pendentes")
      .update({ status: "aprovado", aprovado_em: new Date().toISOString(), aprovado_por: masterAuthId })
      .eq("id", cadastroId);
    if (updErr) throw new Error("Empresa provisionada, mas falha ao marcar cadastro como aprovado: " + updErr.message);

    // ── 10. Sucesso ──
    return json(200, {
      ok: true,
      dry_run: false,
      empresa_id: empresaId,
      usuario_id: usuarioId,
      auth_id: authUser.id,
      seeds: {
        categorias_tempo: CATEGORIAS_TEMPO.length,
        categorias_financeiro: CATEGORIAS_FINANCEIRO.length,
        categorias_colaborador: CATEGORIAS_COLABORADOR.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return json(500, { ok: false, erro: message });
  }
});

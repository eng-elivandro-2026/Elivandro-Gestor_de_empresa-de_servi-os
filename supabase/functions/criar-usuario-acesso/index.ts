import { serve } from "std/http/server";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

type Payload = {
  nome?: unknown;
  email?: unknown;
  empresa_id?: unknown;
  perfil_empresa?: unknown;
  dry_run?: unknown;
  enviar_email?: unknown;
};

type UsuarioInterno = {
  id: string;
  auth_id: string | null;
  nome: string;
  email: string;
  perfil: string;
  ativo: boolean | null;
};

type VinculoEmpresa = {
  usuario_id: string;
  empresa_id: string;
  ativo: boolean | null;
  perfil_empresa: string | null;
  permissoes_json: JsonRecord | null;
};

type ColaboradorOperacional = {
  id: string;
  auth_id: string | null;
  nome: string;
  email: string | null;
  tipo: string | null;
  ativo: boolean | null;
};

type VinculoColaboradorEmpresa = {
  id: string;
  colaborador_id: string | null;
  empresa_id: string | null;
  tipo: string | null;
  email: string | null;
  nome: string | null;
  ativo: boolean | null;
};

type ResultadoVinculoOperacional = {
  aplicavel: boolean;
  colaborador_id?: string;
  colaborador_criado: boolean;
  colaborador_atualizado: boolean;
  vinculo_id?: string;
  vinculo_criado: boolean;
  vinculo_atualizado: boolean;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PERFIS_PERMITIDOS = new Set([
  "admin",
  "colaborador",
  "comercial",
  "dono",
  "financeiro",
  "gestor",
  "leitura",
  "operacional",
  "prestador",
  "rh",
]);

const PERFIS_SOLICITANTES = new Set(["admin", "dono"]);

function json(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown): string {
  return str(value).toLowerCase();
}

function normalizePerfil(value: unknown): string {
  return str(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getPortalLoginUrl(req: Request): string {
  const defaultOrigin = Deno.env.get("PORTAL_SITE_URL") || "https://fortex-gestao-empresarial.vercel.app";
  const origin = req.headers.get("origin") || defaultOrigin;
  const allowed = new Set(
    (Deno.env.get("PORTAL_ALLOWED_ORIGINS") || defaultOrigin)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const safeOrigin = allowed.has(origin) ? origin : defaultOrigin;
  return `${safeOrigin.replace(/\/$/, "")}/login`;
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<User | null> {
  const perPage = 1000;
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error("Falha ao consultar Auth.");
    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < perPage) return null;
  }
  throw new Error("Limite de consulta Auth excedido.");
}

async function inserirAuditoria(
  admin: SupabaseClient,
  campos: JsonRecord,
): Promise<void> {
  const { error } = await admin.from("usuarios_convites_acesso").insert(campos);
  if (error) throw new Error("Falha ao registrar auditoria.");
}

function deveCriarVinculoOperacional(perfilEmpresa: string): boolean {
  return perfilEmpresa === "colaborador" || perfilEmpresa === "prestador";
}

async function buscarColaboradorOperacional(
  admin: SupabaseClient,
  authId: string,
  email: string,
): Promise<ColaboradorOperacional | null> {
  const { data: porAuth, error: erroAuth } = await admin
    .from("colaboradores")
    .select("id, auth_id, nome, email, tipo, ativo")
    .eq("auth_id", authId)
    .maybeSingle();
  if (erroAuth) throw new Error("Falha ao consultar colaborador operacional.");
  if (porAuth) return porAuth as ColaboradorOperacional;

  const { data: porEmail, error: erroEmail } = await admin
    .from("colaboradores")
    .select("id, auth_id, nome, email, tipo, ativo")
    .eq("email", email)
    .maybeSingle();
  if (erroEmail) throw new Error("Falha ao consultar colaborador operacional.");
  return (porEmail || null) as ColaboradorOperacional | null;
}

async function garantirVinculoOperacional(
  admin: SupabaseClient,
  params: {
    nome: string;
    email: string;
    authId: string;
    empresaId: string;
    perfilEmpresa: string;
  },
): Promise<ResultadoVinculoOperacional> {
  if (!deveCriarVinculoOperacional(params.perfilEmpresa)) {
    return {
      aplicavel: false,
      colaborador_criado: false,
      colaborador_atualizado: false,
      vinculo_criado: false,
      vinculo_atualizado: false,
    };
  }

  let colaborador = await buscarColaboradorOperacional(admin, params.authId, params.email);
  let colaboradorCriado = false;
  let colaboradorAtualizado = false;

  if (!colaborador) {
    const { data, error } = await admin
      .from("colaboradores")
      .insert({
        auth_id: params.authId,
        nome: params.nome,
        tipo: params.perfilEmpresa,
        email: params.email,
        ativo: true,
      })
      .select("id, auth_id, nome, email, tipo, ativo")
      .single();
    if (error || !data) throw new Error("Falha ao criar colaborador operacional.");
    colaborador = data as ColaboradorOperacional;
    colaboradorCriado = true;
  } else {
    const patch: JsonRecord = {};
    if (!colaborador.auth_id) patch.auth_id = params.authId;
    if (!colaborador.email) patch.email = params.email;
    if (!colaborador.nome) patch.nome = params.nome;
    if (!colaborador.tipo) patch.tipo = params.perfilEmpresa;
    if (colaborador.ativo === false) patch.ativo = true;

    if (Object.keys(patch).length > 0) {
      const { data, error } = await admin
        .from("colaboradores")
        .update(patch)
        .eq("id", colaborador.id)
        .select("id, auth_id, nome, email, tipo, ativo")
        .single();
      if (error || !data) throw new Error("Falha ao atualizar colaborador operacional.");
      colaborador = data as ColaboradorOperacional;
      colaboradorAtualizado = true;
    }
  }

  const { data: vinculoExistenteData, error: vinculoBuscaError } = await admin
    .from("colaborador_empresas")
    .select("id, colaborador_id, empresa_id, tipo, email, nome, ativo")
    .eq("colaborador_id", colaborador.id)
    .eq("empresa_id", params.empresaId)
    .maybeSingle();
  if (vinculoBuscaError) throw new Error("Falha ao consultar vinculo operacional.");

  const vinculoExistente = vinculoExistenteData as VinculoColaboradorEmpresa | null;
  let vinculoId = vinculoExistente?.id || "";
  let vinculoCriado = false;
  let vinculoAtualizado = false;

  if (!vinculoExistente) {
    const { data, error } = await admin
      .from("colaborador_empresas")
      .insert({
        colaborador_id: colaborador.id,
        empresa_id: params.empresaId,
        ativo: true,
        tipo: params.perfilEmpresa,
        email: params.email,
        nome: params.nome,
      })
      .select("id")
      .single();
    if (error || !data) throw new Error("Falha ao criar vinculo operacional.");
    vinculoId = data.id;
    vinculoCriado = true;
  } else {
    const patch: JsonRecord = {};
    if (vinculoExistente.ativo === false) patch.ativo = true;
    if (!vinculoExistente.tipo) patch.tipo = params.perfilEmpresa;
    if (!vinculoExistente.email) patch.email = params.email;
    if (!vinculoExistente.nome) patch.nome = params.nome;

    if (Object.keys(patch).length > 0) {
      const { data, error } = await admin
        .from("colaborador_empresas")
        .update(patch)
        .eq("id", vinculoExistente.id)
        .select("id")
        .single();
      if (error || !data) throw new Error("Falha ao atualizar vinculo operacional.");
      vinculoId = data.id;
      vinculoAtualizado = true;
    }
  }

  return {
    aplicavel: true,
    colaborador_id: colaborador.id,
    colaborador_criado: colaboradorCriado,
    colaborador_atualizado: colaboradorAtualizado,
    vinculo_id: vinculoId,
    vinculo_criado: vinculoCriado,
    vinculo_atualizado: vinculoAtualizado,
  };
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

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return json(401, { ok: false, erro: "Usuario nao autenticado." });
    }

    const payload = (await req.json().catch(() => ({}))) as Payload;
    const nome = str(payload.nome);
    const email = normalizeEmail(payload.email);
    const empresaId = str(payload.empresa_id);
    const perfilEmpresa = normalizePerfil(payload.perfil_empresa);
    const dryRun = boolValue(payload.dry_run, true);
    const enviarEmail = boolValue(payload.enviar_email, false);
    const redirectTo = getPortalLoginUrl(req);

    if (!nome || nome.length < 2 || nome.length > 160) {
      return json(400, { ok: false, erro: "Nome invalido." });
    }
    if (!email || !email.includes("@") || email.length > 254) {
      return json(400, { ok: false, erro: "Email invalido." });
    }
    if (!empresaId) {
      return json(400, { ok: false, erro: "empresa_id obrigatorio." });
    }
    if (!PERFIS_PERMITIDOS.has(perfilEmpresa)) {
      return json(400, { ok: false, erro: "perfil_empresa invalido." });
    }

    const { data: solicitanteAuthData, error: solicitanteAuthError } = await admin
      .from("usuarios")
      .select("id, auth_id, nome, email, perfil, ativo")
      .eq("auth_id", authData.user.id)
      .eq("ativo", true)
      .maybeSingle();
    let solicitante = solicitanteAuthData as UsuarioInterno | null;

    if (solicitanteAuthError) {
      return json(403, { ok: false, erro: "Solicitante sem permissao." });
    }

    if (!solicitante && authData.user.email) {
      const { data: solicitanteEmailData, error: solicitanteEmailError } = await admin
        .from("usuarios")
        .select("id, auth_id, nome, email, perfil, ativo")
        .eq("email", authData.user.email.toLowerCase())
        .eq("ativo", true)
        .maybeSingle();
      if (solicitanteEmailError) {
        return json(403, { ok: false, erro: "Solicitante sem permissao." });
      }
      solicitante = solicitanteEmailData as UsuarioInterno | null;
    }

    if (!solicitante) {
      return json(403, { ok: false, erro: "Solicitante sem permissao." });
    }

    const { data: empresa, error: empresaError } = await admin
      .from("empresas")
      .select("id, nome, nome_curto, ativo")
      .eq("id", empresaId)
      .eq("ativo", true)
      .maybeSingle();

    if (empresaError || !empresa) {
      return json(404, { ok: false, erro: "Empresa nao encontrada." });
    }

    const { data: vinculoData, error: vinculoError } = await admin
      .from("usuario_empresas")
      .select("usuario_id, empresa_id, ativo, perfil_empresa, permissoes_json")
      .eq("usuario_id", solicitante.id)
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .maybeSingle();
    const vinculo = vinculoData as VinculoEmpresa | null;

    const superAdminEmails = getSuperAdminEmails();
    const solicitanteEmail = (authData.user.email || solicitante.email || "").toLowerCase();
    const isSuperAdmin = superAdminEmails.has(solicitanteEmail);
    const perfilGlobalSolicitante = normalizePerfil(solicitante.perfil);
    const perfilEmpresaSolicitante = normalizePerfil(vinculo?.perfil_empresa || "");
    const autorizadoPorPerfil = PERFIS_SOLICITANTES.has(perfilGlobalSolicitante)
      && PERFIS_SOLICITANTES.has(perfilEmpresaSolicitante);

    if (vinculoError || (!isSuperAdmin && !vinculo)) {
      return json(403, { ok: false, erro: "Solicitante sem acesso a empresa." });
    }
    if (!isSuperAdmin && !autorizadoPorPerfil) {
      return json(403, { ok: false, erro: "Perfil sem permissao para criar acesso." });
    }
    if (perfilEmpresa === "dono" && !isSuperAdmin && perfilEmpresaSolicitante !== "dono") {
      return json(403, { ok: false, erro: "Somente dono pode criar acesso com perfil dono." });
    }
    if (perfilEmpresa === "admin" && !isSuperAdmin && !["dono", "admin"].includes(perfilEmpresaSolicitante)) {
      return json(403, { ok: false, erro: "Perfil sem permissao para criar admin." });
    }

    const auditBase = {
      empresa_id: empresaId,
      email,
      nome,
      perfil_empresa: perfilEmpresa,
      solicitado_por_usuario_id: solicitante.id,
      solicitado_por_auth_id: authData.user.id,
      dry_run: dryRun,
      enviar_email: enviarEmail,
      redirect_to: redirectTo,
      metadata: {
        origem: "edge-function/criar-usuario-acesso",
        solicitante_email: solicitanteEmail,
        empresa_nome: empresa.nome_curto || empresa.nome,
      },
    };

    if (dryRun) {
      return json(200, {
        ok: true,
        dry_run: true,
        mensagem: "Validacao concluida. Nenhum usuario foi criado.",
        empresa_id: empresaId,
        email,
        perfil_empresa: perfilEmpresa,
        vinculo_operacional_previsto: deveCriarVinculoOperacional(perfilEmpresa),
        redirect_to: redirectTo,
      });
    }

    let authUser = await findAuthUserByEmail(admin, email);
    let authCriado = false;

    if (!authUser) {
      if (enviarEmail) {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { nome },
          redirectTo,
        });
        if (error || !data.user) throw new Error("Falha ao criar convite Auth.");
        authUser = data.user;
      } else {
        const { data, error } = await admin.auth.admin.createUser({
          email,
          email_confirm: false,
          user_metadata: { nome },
        });
        if (error || !data.user) throw new Error("Falha ao criar usuario Auth.");
        authUser = data.user;
      }
      authCriado = true;
    }

    const { data: usuarioExistenteData, error: usuarioBuscaError } = await admin
      .from("usuarios")
      .select("id, auth_id, nome, email, perfil, ativo")
      .eq("email", email)
      .maybeSingle();
    const usuarioExistente = usuarioExistenteData as UsuarioInterno | null;

    if (usuarioBuscaError) throw new Error("Falha ao consultar usuario interno.");

    let usuarioId = usuarioExistente?.id || "";
    const perfilGlobalPreservado = usuarioExistente?.perfil || perfilEmpresa;

    if (usuarioExistente) {
      const { data, error } = await admin
        .from("usuarios")
        .update({
          auth_id: usuarioExistente.auth_id || authUser.id,
          nome,
          ativo: true,
        })
        .eq("id", usuarioExistente.id)
        .select("id")
        .single();
      if (error || !data) throw new Error("Falha ao atualizar usuario interno.");
      usuarioId = data.id;
    } else {
      const { data, error } = await admin
        .from("usuarios")
        .insert({
          auth_id: authUser.id,
          nome,
          email,
          perfil: perfilEmpresa,
          ativo: true,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error("Falha ao criar usuario interno.");
      usuarioId = data.id;
    }

    const { error: vinculoUpsertError } = await admin
      .from("usuario_empresas")
      .upsert({
        usuario_id: usuarioId,
        empresa_id: empresaId,
        ativo: true,
        perfil_empresa: perfilEmpresa,
        modulos_json: {},
        permissoes_json: {},
      }, { onConflict: "usuario_id,empresa_id" });

    if (vinculoUpsertError) throw new Error("Falha ao vincular usuario a empresa.");

    const vinculoOperacional = await garantirVinculoOperacional(admin, {
      nome,
      email,
      authId: authUser.id,
      empresaId,
      perfilEmpresa,
    });

    await inserirAuditoria(admin, {
      ...auditBase,
      usuario_id: usuarioId,
      auth_id: authUser.id,
      status: "concluido",
      auth_criado: authCriado,
      metadata: {
        ...(auditBase.metadata as JsonRecord),
        vinculo_operacional: vinculoOperacional,
      },
    });

    return json(200, {
      ok: true,
      dry_run: false,
      usuario_id: usuarioId,
      auth_id: authUser.id,
      auth_criado: authCriado,
      email_enviado: enviarEmail,
      perfil_global_preservado: perfilGlobalPreservado,
      empresa_id: empresaId,
      perfil_empresa: perfilEmpresa,
      vinculo_operacional: vinculoOperacional,
      redirect_to: redirectTo,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return json(500, { ok: false, erro: message });
  }
});

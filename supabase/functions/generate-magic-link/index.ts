// ============================================================
// generate-magic-link — Edge Function
// Gera um magic link (login temporário) para um usuário alvo, para
// o superadmin "entrar como" ele de verdade (impersonation real) numa
// aba anônima. O link expira automaticamente pelo Supabase (~1h).
//
// Espelha o padrão de provisionar-empresa: imports ESM absolutos,
// dois clients (userClient anon p/ identificar o chamador; admin
// service_role p/ gerar o link), CORS, só master autoriza.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type JsonRecord = Record<string, unknown>;
type Payload = { user_id?: unknown };

const MASTER_EMAIL = "nascimento.gaube@gmail.com";
const REDIRECT_TO = "https://fortex-gestao-empresarial.vercel.app";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: JsonRecord): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

    // ── Autoriza o chamador (só master) ──
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
    const userId = str(payload.user_id);
    if (!userId) return json(400, { ok: false, erro: "user_id obrigatorio." });

    // Não gerar link para o próprio master
    if (userId === masterAuthId) {
      return json(400, { ok: false, erro: "Nao e possivel gerar link para o proprio administrador." });
    }

    // ── Resolve o e-mail do usuario alvo (por auth_id) ──
    const { data: alvo, error: alvoErr } = await admin.auth.admin.getUserById(userId);
    if (alvoErr || !alvo || !alvo.user) {
      return json(404, { ok: false, erro: "Usuario alvo nao encontrado." });
    }
    const email = (alvo.user.email || "").trim();
    if (!email) return json(400, { ok: false, erro: "Usuario alvo sem e-mail." });
    if (email.toLowerCase() === MASTER_EMAIL || superAdmins.has(email.toLowerCase())) {
      return json(400, { ok: false, erro: "Nao e possivel gerar link para o administrador da plataforma." });
    }

    // ── Gera o magic link (expira ~1h pelo Supabase) ──
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: REDIRECT_TO },
    });
    if (linkErr) throw new Error("Falha ao gerar link: " + linkErr.message);
    const link = linkData?.properties?.action_link;
    if (!link) throw new Error("Link nao retornado pelo provedor.");

    console.log(`Magic link gerado para ${email} por ${masterEmail}`);

    return json(200, { ok: true, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return json(500, { ok: false, erro: message });
  }
});

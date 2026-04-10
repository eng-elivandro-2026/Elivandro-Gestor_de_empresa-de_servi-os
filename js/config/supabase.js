// CONFIGURAÇÃO SUPABASE
const SUPABASE_URL = "https://ojuuzojwnyxdsavdosif.supabase.co";
const SUPABASE_KEY = "sb_publishable_uqS8EZTOs5-sHKr1IpFhzg_eZrZOr7u";

// CRIA CLIENTE GLOBAL
window.sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("✅ Supabase conectado!");

// ==========================
// 🔐 PEGAR USUÁRIO LOGADO
// ==========================
window.getUser = async function () {
  const { data, error } = await window.sbClient.auth.getUser();

  if (error) {
    console.error("Erro ao pegar usuário:", error.message);
    return null;
  }

  return data?.user || null;
};

// ==========================
// 🔒 PROTEGER PÁGINA
// ==========================
window.protegerPagina = async function () {
  const user = await window.getUser();

  if (!user) {
    console.warn("⛔ Usuário não logado");
    window.location.href = "/login.html";
    return;
  }

  console.log("👤 Usuário logado:", user.email);
};

// ==========================
// 🚪 LOGOUT
// ==========================
window.logout = async function () {
  await window.sbClient.auth.signOut();
  window.location.href = "/login.html";
};

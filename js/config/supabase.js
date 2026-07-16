(function () {
  const SUPABASE_URL = "https://ojuuzojwnyxdsavdosif.supabase.co";
  const SUPABASE_KEY = "sb_publishable_uqS8EZTOs5-sHKr1IpFhzg_eZrZOr7u";
  // Expostos para o envio keepalive de emergência no unload (app-core):
  // fetch normal é cancelado pelo navegador ao fechar a aba; o keepalive não.
  window.SB_URL = SUPABASE_URL;
  window.SB_KEY = SUPABASE_KEY;

  if (window.sbClient) {
    console.log("Supabase já conectado.");
    return;
  }

  window.sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("Supabase conectado!");

  window.logout = async function () {
    await window.sbClient.auth.signOut();
    window.location.href = "/login.html";
  };

  window.protegerPagina = async function () {
    const { data } = await window.sbClient.auth.getUser();
    if (!data?.user) {
      window.location.href = "/login.html";
    }
  };
})();

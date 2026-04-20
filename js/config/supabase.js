(function () {
  if (window.sbClient) {
    console.log("Supabase já conectado.");
    return;
  }

  const SUPABASE_URL = "https://ojuuzojwnyxdsavdosif.supabase.co";
  const SUPABASE_KEY = "sb_publishable_uqS8EZTOs5-sHKr1IpFhzg_eZrZOr7u";

  window.sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("Supabase conectado!");

  window.logout = async function () {
    await window.sbClient.auth.signOut();
    window.location.href = "/login.html";
  };

  window.protegerPagina = async function () {
    // Se há magic link token no hash, aguardar o Supabase processar antes de verificar
    if (window.location.hash && window.location.hash.includes('access_token')) {
      await new Promise(function (resolve) {
        var timeout = setTimeout(resolve, 5000);
        var sub = window.sbClient.auth.onAuthStateChange(function (event, session) {
          if (session || event === 'SIGNED_IN') {
            clearTimeout(timeout);
            sub.data.subscription.unsubscribe();
            resolve();
          }
        });
      });
    }
    const { data } = await window.sbClient.auth.getUser();
    if (!data?.user) {
      window.location.href = "/login.html";
    }
  };
})();

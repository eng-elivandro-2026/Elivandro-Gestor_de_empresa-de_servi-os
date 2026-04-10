const SUPABASE_URL = "https://ojuuzojwnyxdsavdosif.supabase.co";
const SUPABASE_KEY = "sb_publishable_uqS8EZTOs5-sHKr1IpFhzg_eZrZOr7u";

window.sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

console.log("Supabase conectado!");

window.logout = async function () {
  await window.sbClient.auth.signOut();
  window.location.href = "/login.html";
};

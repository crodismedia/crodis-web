(function () {
  "use strict";

  const SUPABASE_URL = "https://cnyptelvbsndpkzbrete.supabase.co";
  const SUPABASE_KEY = "sb_publishable_91-iI-ra1PfQhXraaU8B9Q_TZPzWfEh";

  if (!window.supabase?.createClient) {
    console.error("Supabase JS no se ha cargado.");
    return;
  }

  window.supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );
})();

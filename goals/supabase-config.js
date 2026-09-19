/* =====================================================================
   GOALS — settings
   =====================================================================
   As long as `supabase` is null the app works completely, but your
   goals live only on this device and there is no sign-in screen.

   Want them on your phone and your laptop?

     1. Go to supabase.com and create a free project.
     2. Open SQL Editor → New query, paste in the whole of
        supabase.sql from this folder, and press Run. That makes the
        table and the rules that keep your rows yours.
     3. Go to Project Settings → API keys and copy two things:
          • Project URL          → url
          • publishable key      → anonKey
     4. Paste them below, in place of `null`.
     5. Under Authentication → Providers, make sure Email is on. For a
        personal app it is easier to switch "Confirm email" off, so a
        new account can sign in straight away.

   This project may hold other apps. Everything this one creates is
   prefixed `goals_`, so it cannot collide with theirs, and the policies
   in supabase.sql scope every row to the account that wrote it.

   The anon key belongs in a web app and is not a password: every
   request it makes still has to pass the row-level security policies
   from supabase.sql, which only ever return your own rows.

   NEVER put a secret key here — `sb_secret_…`, or the older
   `service_role` one. Those bypass every policy, and this file is
   public the moment it is pushed.
   ===================================================================== */

window.GOALS_CONFIG = {

  supabase: {
    url: "https://dqwkbtsstvakcvlnwvwk.supabase.co",

    /* The publishable key. It belongs in a web app: every request it
       makes still has to pass the row-level security policies from
       supabase.sql, which only ever return your own rows. */
    anonKey: "sb_publishable_3XXbckuhutQNsEimUOBjPg_n4ag9IG-",
  },

  /* With a cloud configured, should the app insist on an account?
     Leave this off and the app stays usable offline before signing in;
     turn it on and nothing is shown or changed until you do. */
  requireAccount: false,

  /* How often to check for changes made on your other device while
     the app is open. Your own changes go up immediately. */
  pollSeconds: 45,
};

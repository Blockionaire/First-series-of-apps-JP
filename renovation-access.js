/* Closed-group entry for the Supabase-backed renovation pages. Database RLS
 * remains the authority; this screen never substitutes for the SQL policy. */
(function () {
  'use strict';
  let ready = false;
  let client;
  let view;
  let resolveAccess;
  let accessPromise;
  let resolved = false;
  let checking = false;
  let signingOut = false;

  function message(text) {
    view.querySelector('[data-status]').textContent = text;
  }

  function lock(text) {
    ready = false;
    document.body.removeAttribute('data-ovs-unlocked');
    if (view) {
      view.hidden = false;
      message(text);
    }
    if (client) client.removeAllChannels().catch(function () {});
    const bar = document.getElementById('ovs-account-bar');
    if (bar) bar.hidden = true;
  }

  async function verify() {
    const result = await client.auth.getUser();
    if (result.error || !result.data.user || result.data.user.is_anonymous) {
      lock('Log in met een account dat toegang heeft tot deze verbouwing.');
      return false;
    }
    const permission = await client.rpc('ovs_can_access');
    if (permission.error) {
      lock('Toegang kon niet worden gecontroleerd. Controleer de verbinding en de toegangsinstellingen.');
      return false;
    }
    if (permission.data !== true) {
      lock('Dit account heeft geen toegang tot deze verbouwing. Vraag de beheerder om toegang.');
      return false;
    }
    ready = true;
    if (resolved) {
      // Reload shared state after a new login; never reuse another session's view.
      window.location.reload();
    } else {
      resolved = true;
      resolveAccess(true);
    }
    return true;
  }

  async function signOut() {
    signingOut = true;
    lock('Uitloggen…');
    localStorage.removeItem('ovs-v16');
    try {
      await client.auth.signOut({ scope: 'local' });
    } finally {
      // Also clear this app's persisted session if the remote sign-out failed.
      localStorage.removeItem('ovs-private-session');
      localStorage.removeItem('ovs-private-session-user');
      localStorage.removeItem('ovs-private-session-code-verifier');
      window.location.reload();
    }
  }

  async function requireAccess(sb) {
    if (accessPromise) return accessPromise;
    client = sb;
    accessPromise = new Promise(function (resolve) { resolveAccess = resolve; });
    if (document.readyState === 'loading') {
      await new Promise(function (resolve) {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
      });
    }
    view = document.getElementById('ovs-access');
    view.innerHTML = '<div class="ovs-access-card"><p class="ovs-access-label">ALLEEN VOOR GENODIGDEN</p>' +
      '<h1>Samen aan ons huis.</h1><p>Log in om de gedeelde verbouwing te openen.</p>' +
      '<form><label>E-mailadres<input name="email" type="email" autocomplete="username" required></label>' +
      '<label>Wachtwoord<input name="password" type="password" autocomplete="current-password" required></label>' +
      '<button type="submit">Inloggen</button></form>' +
      '<p data-status role="status" aria-live="polite">Toegang controleren…</p>' +
      '<button type="button" data-switch class="ovs-access-secondary">Ander account gebruiken</button>' +
      '<p class="ovs-access-note">Geen account aanmaken. Alleen goedgekeurde gebruikers hebben toegang.</p></div>';
    view.querySelector('[data-switch]').addEventListener('click', signOut);
    view.querySelector('form').addEventListener('submit', async function (event) {
      event.preventDefault();
      if (checking) return;
      checking = true;
      const form = event.currentTarget;
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      message('Inloggen…');
      try {
        const result = await client.auth.signInWithPassword({
          email: form.elements.email.value.trim(),
          password: form.elements.password.value,
        });
        form.elements.password.value = '';
        if (result.error) {
          lock('Inloggen is niet gelukt. Controleer je gegevens of vraag de beheerder om hulp.');
        } else {
          await verify();
        }
      } catch (_) {
        lock('De verbinding is onderbroken. Probeer opnieuw.');
      } finally {
        checking = false;
        submit.disabled = false;
      }
    });
    client.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT' && !signingOut) {
        lock('Je sessie is verlopen. Log opnieuw in.');
      }
    });
    window.addEventListener('focus', async function () {
      if (!ready || checking) return;
      checking = true;
      try {
        const user = await client.auth.getUser();
        const permission = !user.error && user.data.user && !user.data.user.is_anonymous
          ? await client.rpc('ovs_can_access') : null;
        if (!permission || permission.error || permission.data !== true) {
          lock('Je toegang kon niet worden bevestigd. Log opnieuw in.');
        }
      } catch (_) {
        lock('Je toegang kon niet worden bevestigd. Controleer je verbinding.');
      } finally {
        checking = false;
      }
    });
    try {
      await verify();
    } catch (_) {
      lock('Toegang kon niet worden gecontroleerd. Controleer je verbinding.');
    }
    return accessPromise;
  }

  window.RenovationAccess = {
    require: requireAccess,
    isReady: function () { return ready; },
    reveal: function () {
      if (!ready) return;
      view.hidden = true;
      document.body.setAttribute('data-ovs-unlocked', '');
      let bar = document.getElementById('ovs-account-bar');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'ovs-account-bar';
        bar.innerHTML = '<button type="button">Uitloggen</button>';
        bar.querySelector('button').addEventListener('click', signOut);
        document.body.appendChild(bar);
      }
      bar.hidden = false;
    },
    failed: function () { lock('De verbouwing kon niet worden geladen. Vernieuw de pagina om opnieuw te proberen.'); },
  };
}());

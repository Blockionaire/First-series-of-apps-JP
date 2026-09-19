/* =====================================================================
   GOALS — signing in
   =====================================================================
   Only ever shown when supabase-config.js has a project AND asks for
   an account. Without that configuration this screen never appears and
   the app belongs to the device.
   ===================================================================== */

import { Sync } from "../store.js";
import { $, esc, toast } from "../util.js";

export const title = () => "Sign in";

export function html() {
  return `
    <div class="page" style="max-width:420px;padding-top:14vh">
      <p class="eyebrow">Goals</p>
      <h1 class="title" style="margin:12px 0 8px">Sign in to continue</h1>
      <p class="prose" style="margin-bottom:26px">Your goals, logs and notes are stored under your own account and are not visible to anyone else.</p>

      <form id="form" class="stack">
        <label class="field">
          <span class="field__label">Email</span>
          <input class="input" type="email" name="email" autocomplete="email" required>
        </label>
        <label class="field">
          <span class="field__label">Password</span>
          <input class="input" type="password" name="password" autocomplete="current-password"
                 minlength="6" required>
        </label>
        <button class="button button--solid button--block" type="submit" id="submit">Sign in</button>
        <p class="meta" id="error" role="alert"></p>
      </form>

      <div class="row row--between" style="margin-top:22px">
        <button class="link" id="toggle">Create an account</button>
        <button class="link" id="forgot">Forgot password</button>
      </div>
    </div>`;
}

export function mount(root) {
  const form = $("#form", root);
  const error = $("#error", root);
  const submit = $("#submit", root);
  const toggle = $("#toggle", root);
  let mode = "in";

  toggle.addEventListener("click", () => {
    mode = mode === "in" ? "up" : "in";
    submit.textContent = mode === "in" ? "Sign in" : "Create account";
    toggle.textContent = mode === "in" ? "Create an account" : "I already have an account";
    error.textContent = "";
  });

  $("#forgot", root).addEventListener("click", async () => {
    const email = form.email.value.trim();
    if (!email) { error.textContent = "Fill in your email address first."; return; }
    try {
      await Sync.resetPassword(email);
      toast("Check your inbox for the reset link.");
    } catch (e) {
      error.textContent = readable(e);
    }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    submit.disabled = true;
    error.textContent = "";
    try {
      if (mode === "in") await Sync.signIn(form.email.value.trim(), form.password.value);
      else await Sync.register(form.email.value.trim(), form.password.value);
    } catch (err) {
      error.textContent = readable(err);
    } finally {
      submit.disabled = false;
    }
  });
}

/* The sync layer already turns Supabase's JSON into sentences. */
function readable(error) {
  return esc(error && error.message ? error.message : "Something went wrong.");
}

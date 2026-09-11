/* =====================================================================
   GOALS — settings
   =====================================================================
   Everything that is not a goal: how it looks, where it is stored, and
   how to get your data out again.
   ===================================================================== */

import { state, saveSettings, snapshot, restore, wipe, Sync } from "../store.js";
import { $, esc, on, toast, applyTheme, sheet, confirmSheet, formatDate } from "../util.js";

export const title = () => "Settings";

export function html() {
  const s = state.settings;

  return `
    <section class="stack-xl" style="padding-top:8px">
      <div>
        <p class="eyebrow">Settings</p>
        <h1 class="title" style="margin-top:10px">Your setup</h1>
      </div>

      <div>
        <div class="section-head"><h2 class="subtitle">You</h2></div>
        <label class="field">
          <span class="field__label">Name</span>
          <input class="input" id="name" value="${esc(s.name)}" placeholder="Your name" maxlength="60">
        </label>
        <p class="meta">Only used to greet you on the home screen.</p>
      </div>

      <div>
        <div class="section-head"><h2 class="subtitle">Appearance</h2></div>
        <div class="chips" id="theme">
          ${["auto", "light", "dark"].map(option => `
            <button class="chip ${(s.theme || "auto") === option ? "is-on" : ""}" data-theme="${option}">
              ${option === "auto" ? "Follow system" : option[0].toUpperCase() + option.slice(1)}
            </button>`).join("")}
        </div>
      </div>

      <div>
        <div class="section-head"><h2 class="subtitle">Storage</h2></div>
        ${storageBlock()}
      </div>

      <div>
        <div class="section-head"><h2 class="subtitle">Your data</h2></div>
        <div class="list">
          <button class="list__item" data-do="export">
            <span class="list__main">
              <span class="list__title">Download a backup</span>
              <span class="list__sub">One JSON file with every goal, log, topic and note.</span>
            </span>
          </button>
          <button class="list__item" data-do="import">
            <span class="list__main">
              <span class="list__title">Restore from a backup</span>
              <span class="list__sub">Merge it in, or replace everything.</span>
            </span>
          </button>
          <button class="list__item" data-do="wipe">
            <span class="list__main">
              <span class="list__title">Erase everything</span>
              <span class="list__sub">Every goal, log and note. Cannot be undone.</span>
            </span>
          </button>
        </div>
        <input type="file" id="file" accept="application/json,.json" aria-label="Backup file" hidden>
      </div>

      <div>
        <div class="section-head"><h2 class="subtitle">About</h2></div>
        <p class="prose">
          A personal operating system for what you want to achieve and what you want to learn.
          It works offline, it is yours alone, and it keeps nothing you did not type.
        </p>
        <p class="meta" style="margin-top:14px">
          ${state.goals.length} goals · ${state.entries.length} logs ·
          ${state.topics.length} topics · ${state.modules.filter(m => m.done).length} modules completed
        </p>
      </div>
    </section>`;
}

function storageBlock() {
  if (!Sync.sync.available) {
    return `
      <p class="prose">Everything is stored on this device. Nothing leaves it, and no account is needed.</p>
      <p class="prose" style="margin-top:10px">To have the same goals on your phone and your laptop, fill in
      <code>firebase-config.js</code> — the steps are in the README. Until then, use a backup file to move data across.</p>`;
  }

  const { user, status, busy, lastPush } = Sync.sync;

  if (!user) {
    return `
      <p class="prose">Signed out. Your goals are on this device only until you sign in.</p>
      <div class="row" style="margin-top:14px"><button class="button" data-do="signin">Sign in</button></div>`;
  }

  return `
    <p class="prose">Signed in as <b>${esc(user.email || "")}</b>. Changes appear on your other devices
    ${status === "active" ? "as you make them" : "as soon as the connection is back"}.</p>
    <p class="meta" style="margin-top:8px">
      ${busy ? "Saving…" : lastPush ? `Last change sent ${new Date(lastPush).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "Nothing sent yet"}
    </p>
    <div class="row" style="margin-top:14px">
      <button class="button" data-do="signout">Sign out</button>
      <button class="button button--ghost" data-do="pushall">Upload everything again</button>
    </div>`;
}

export function mount(root) {
  const name = $("#name", root);
  name.addEventListener("change", () => saveSettings({ name: name.value.trim() }));

  on(root, "[data-theme]", "click", (e, button) => {
    const theme = button.dataset.theme;
    applyTheme(theme);
    localStorage.setItem("goals.theme", theme);
    saveSettings({ theme });
  });

  on(root, "[data-do]", "click", async (e, button) => {
    const action = button.dataset.do;

    if (action === "export") exportBackup();

    if (action === "import") $("#file", root).click();

    if (action === "wipe") {
      const sure = await confirmSheet({
        title: "Erase everything?",
        message: "Every goal, milestone, log, topic and note goes. Download a backup first if you are not certain.",
        confirmLabel: "Erase everything",
      });
      if (sure) { await wipe(); toast("Everything erased."); }
    }

    if (action === "signin") signInSheet();

    if (action === "signout") { await Sync.signOut(); toast("Signed out."); }

    if (action === "pushall") { await Sync.pushAll(); toast("Everything uploaded."); }
  });

  $("#file", root).addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const replace = await confirmSheet({
        title: "Restore backup",
        message: "Merge this backup into what is already here, or replace everything with it?",
        confirmLabel: "Replace everything",
      });
      await restore(data, { replace: Boolean(replace) });
      toast(replace ? "Everything replaced." : "Backup merged in.");
    } catch (e) {
      console.error(e);
      toast("That file could not be read.", "bad");
    } finally {
      event.target.value = "";
    }
  });
}

function exportBackup() {
  const data = { app: "goals", version: 1, exported: new Date().toISOString(), ...snapshot() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `goals-backup-${formatDate(new Date().toISOString().slice(0, 10), "short").replace(/\s/g, "-").toLowerCase()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Backup downloaded.");
}

function signInSheet() {
  sheet({
    title: "Sign in",
    subtitle: "Same goals on every device.",
    body: `
      <label class="field">
        <span class="field__label">Email</span>
        <input class="input" type="email" id="email" autocomplete="email">
      </label>
      <label class="field">
        <span class="field__label">Password</span>
        <input class="input" type="password" id="password" autocomplete="current-password" minlength="6">
      </label>
      <p class="meta" id="error" role="alert"></p>`,
    footer: `
      <button class="button button--ghost" data-register>Create account</button>
      <button class="button button--solid" data-signin>Sign in</button>`,
    onMount: (dialog, close) => {
      const email = $("#email", dialog);
      const password = $("#password", dialog);
      const error = $("#error", dialog);

      const attempt = async fn => {
        error.textContent = "";
        try {
          await fn(email.value.trim(), password.value);
          close(true);
          toast("Signed in.");
        } catch (e) {
          error.textContent = e.message || "That did not work.";
        }
      };

      $("[data-signin]", dialog).addEventListener("click", () => attempt(Sync.signIn));
      $("[data-register]", dialog).addEventListener("click", () => attempt(Sync.register));
    },
  });
}

/* =====================================================================
   GOALS — settings
   =====================================================================
   As long as `firebase` is null the app works completely, but your
   goals live only on this device and there is no sign-in screen.

   Want them on your phone and your laptop?

     1. Go to console.firebase.google.com and create a free project.
     2. Add a web app (the </> icon) and copy the firebaseConfig block.
     3. Paste it below instead of `null`.
     4. In the console: Authentication → Sign-in method → Email/password.
     5. Create a Firestore database and paste in firestore.rules.

   The key below is meant to be public in a web app; it is not a
   password. What protects your data are the rules in firestore.rules,
   which only let you at your own documents.
   ===================================================================== */

window.GOALS_CONFIG = {

  firebase: null,

  /* What it looks like once filled in:

  firebase: {
    apiKey: "AIza…",
    authDomain: "my-goals.firebaseapp.com",
    projectId: "my-goals",
    storageBucket: "my-goals.firebasestorage.app",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
  },

  */

  /* With a cloud configured, should the app insist on an account?
     Leave this off and the app stays usable offline before signing in;
     turn it on and nothing is shown or changed until you do. */
  requireAccount: false,
};

/* =====================================================================
   GEHEIME DIENST — pushmeldingen versturen
   =====================================================================
   Deze functies kijken mee in de database en sturen een melding zodra er
   iets voor iemand is. Uitrollen doe je één keer; zie README.md, kopje
   "Pushmeldingen aanzetten".

   Belangrijk: er gaat nooit inhoud mee. De melding bevat alleen een
   soort ("bericht", "genoemd", "verzoek", "rol", "deadline"); de app en de
   worker maken daar zelf een anonieme zin van. Zo staat er nooit een
   naam of een stuk chat op iemands vergrendelscherm.
   ===================================================================== */

const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {getMessaging} = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

/** Stuur een anonieme melding naar een lijstje spelers. */
async function stuur(spelerIds, soort) {
  const ids = [...new Set(spelerIds)].filter(Boolean);
  if (!ids.length) return;
  const docs = await Promise.all(ids.map((id) => db.doc(`players/${id}`).get()));
  const tokens = docs.map((d) => d.exists && d.get("pushToken")).filter(Boolean);
  if (!tokens.length) return;
  await getMessaging().sendEachForMulticast({
    tokens,
    data: {soort},                       // alleen het soort, nooit inhoud
    apns: {payload: {aps: {"content-available": 1}}},
    webpush: {headers: {Urgency: "high"}},
  });
}

/** Wie zitten er in deze chat? Spelleider leest overal mee. */
async function ontvangers(chatId, afzenderId) {
  const [chat, spelers] = await Promise.all([
    db.doc(`chats/${chatId}`).get(),
    db.collection("players").get(),
  ]);
  const alle = spelers.docs.map((d) => ({id: d.id, ...d.data()}));
  const leider = alle.filter((p) => p.isLeader).map((p) => p.id);
  if (!chat.exists) return leider;
  const type = chat.get("type");
  let leden;
  if (type === "all") leden = alle.filter((p) => !p.isLeader).map((p) => p.id);
  else if (type === "dm") leden = [chat.get("dmFor")];
  else leden = chat.get("members") || [];
  return [...leden, ...leider].filter((id) => id && id !== afzenderId);
}

// nieuw bericht in een chat
exports.bijNieuwBericht = onDocumentCreated("chats/{chatId}/messages/{msgId}", async (event) => {
  const m = event.data && event.data.data();
  if (!m) return;
  const allen = await ontvangers(event.params.chatId, m.sid);
  // wie met @ genoemd is krijgt een ander soort; nog steeds zonder naam of inhoud
  const genoemd = (m.mentions || []).filter((id) => allen.includes(id));
  const rest = allen.filter((id) => !genoemd.includes(id));
  await Promise.all([
    genoemd.length ? stuur(genoemd, "genoemd") : null,
    rest.length ? stuur(rest, "bericht") : null,
  ]);
});

// verleidingsverzoek dat bij iemand komt te liggen
exports.bijVerleidingsverzoek = onDocumentUpdated("verleidDoelen/{id}", async (event) => {
  const voor = event.data.before.data();
  const na = event.data.after.data();
  if (voor.status === na.status || na.status !== "gevraagd" || !na.doelPid) return;
  await stuur([na.doelPid], "verzoek");
});

// de spelleider vraagt iemand een rol over te nemen
exports.bijRolverzoek = onDocumentCreated("takeovers/{id}", async (event) => {
  const t = event.data && event.data.data();
  if (t && t.targetPid) await stuur([t.targetPid], "verzoek");
});

// antwoord van de spelleider op een hackervraag
exports.bijHackerAntwoord = onDocumentUpdated("hackerQuestions/{id}", async (event) => {
  const voor = event.data.before.data();
  const na = event.data.after.data();
  if (!na.answer || voor.answer === na.answer || !na.pid) return;
  await stuur([na.pid], "rol");
});

// nieuwe deadline — alleen naar de chat waar hij voor bedoeld is
exports.bijDeadline = onDocumentCreated("deadlines/{id}", async (event) => {
  const d = event.data && event.data.data();
  if (!d) return;
  await stuur(await ontvangers(d.chatId || "all", null), "deadline");
});

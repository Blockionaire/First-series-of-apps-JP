import { sql } from "./sql";

/**
 * Outbox pattern: every outbound message is durably recorded first, then
 * relayed if a transport is configured (RESEND_API_KEY). Nothing is ever
 * silently lost — the admin outbox shows exactly what left (or didn't).
 */
export async function sendMail(to: string, subject: string, body: string) {
  const info = await sql().run("INSERT INTO outbox (to_email, subject, body) VALUES (?, ?, ?)", [
    to,
    subject,
    body,
  ]);

  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? "STAI <info@stai-ahead.com>";
  if (!key) return { queued: true, sent: false };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text: body }),
    });
    if (res.ok) {
      await sql().run("UPDATE outbox SET sent_at=datetime('now') WHERE id=?", [info.lastRowId]);
      return { queued: true, sent: true };
    }
  } catch {
    // stays queued; visible in admin outbox
  }
  return { queued: true, sent: false };
}

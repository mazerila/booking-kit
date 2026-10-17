/** Sends e-mails through Resend and logs every attempt in Firestore. */
import * as logger from "firebase-functions/logger";
import { COL, type EmailKind, type RenderedEmail } from "../core/index.js";
import { db } from "./db.js";

export type Mail = RenderedEmail & {
  to: string[];
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
};

export type MailerConfig = {
  from: string;
  /** Resend API key. Empty: e-mails are only logged (local development). */
  apiKey: string;
  /** Override for tests / local mock server. */
  url?: string;
};

export async function sendMail(cfg: MailerConfig, mail: Mail, meta: { kind: EmailKind; bookingId: string }) {
  const log = { ...meta, to: mail.to, subject: mail.subject, at: new Date().toISOString() };
  if (!mail.to.length) return false;
  if (!cfg.apiKey) {
    logger.info("booking: e-mail not sent (no RESEND_API_KEY), logged only", { ...log, text: mail.text });
    await db().collection(COL.mail).add({ ...log, ok: false, error: "no_api_key" });
    return false;
  }
  try {
    const r = await fetch(cfg.url || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: cfg.from,
        to: mail.to,
        reply_to: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content).toString("base64"),
          content_type: a.contentType,
        })),
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      logger.error("booking: Resend rejected the e-mail", { ...log, status: r.status, body });
      await db().collection(COL.mail).add({ ...log, ok: false, error: `resend_${r.status}` });
      return false;
    }
    await db().collection(COL.mail).add({ ...log, ok: true });
    return true;
  } catch (err) {
    logger.error("booking: Resend unreachable", { ...log, err: String(err) });
    await db().collection(COL.mail).add({ ...log, ok: false, error: "unreachable" });
    return false;
  }
}

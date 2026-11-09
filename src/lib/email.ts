import "server-only";
import nodemailer from "nodemailer";
import { logger } from "./logger";

export type Email = { to: string; subject: string; text: string };

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

/**
 * Sends transactional email via SMTP (any provider: Resend, Brevo, Mailgun, Zoho...).
 * Without SMTP_URL in development, the message is printed to the server console so
 * verification/reset links can be followed locally. In production a missing
 * SMTP_URL is logged as an error (users would not receive emails).
 */
export async function sendEmail(email: Email): Promise<boolean> {
  const url = process.env.SMTP_URL;
  const from = process.env.EMAIL_FROM ?? "Businestra <no-reply@localhost>";
  if (!url) {
    if (process.env.NODE_ENV === "production") {
      logger.error("email_not_configured", { subject: email.subject });
      return false;
    }
    if (process.env.NODE_ENV !== "test") {
      console.log(`\n──── DEV EMAIL to ${email.to} ────\nSubject: ${email.subject}\n\n${email.text}\n────────────────────────────\n`);
    }
    return true;
  }
  try {
    transport ??= nodemailer.createTransport(url);
    await transport.sendMail({ from, to: email.to, subject: email.subject, text: email.text });
    return true;
  } catch (err) {
    logger.error("email_send_failed", { subject: email.subject, err });
    return false;
  }
}

export const appUrl = (path = "") => `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}${path}`;

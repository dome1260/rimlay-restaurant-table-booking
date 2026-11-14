import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let cached: Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

function getTransport(): Transporter {
  cached ??= nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
  return cached;
}

export async function deliverEmail(to: string, subject: string, text: string, html: string): Promise<void> {
  await getTransport().sendMail({
    from: `"Rimlay" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
}

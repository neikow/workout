import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) throw new Error("SMTP_HOST not set");
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });
  return transporter;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  const from = process.env.SMTP_FROM ?? "no-reply@workout.local";
  const subject = "Your Workout sign-in code";
  const text = `Your sign-in code is: ${code}\n\nIt expires in 10 minutes.\nIf you didn't request this, ignore this email.`;
  const html = `<p>Your sign-in code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:ui-monospace,monospace">${code}</p>
<p>It expires in 10 minutes. If you didn't request this, ignore this email.</p>`;

  await getTransporter().sendMail({ from, to, subject, text, html });
}

/**
 * Email service — wraps Resend for transactional emails.
 *
 * In development without RESEND_API_KEY, emails are logged to console instead
 * of sent. This keeps the dev workflow unblocked.
 */

import { Resend } from "resend";

type EmailResult = { sent: true } | { sent: false; reason: string };

function getFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL ?? "noreply@careerlaunch.studio";
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

/**
 * Send an email verification link.
 *
 * The raw token goes in the URL; only the SHA-256 hash is stored in the DB.
 */
export async function sendVerificationEmail(
  email: string,
  name: string | null,
  rawToken: string,
): Promise<EmailResult> {
  const url = `${getBaseUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const subject = "Verify your email — CareerLaunch Studio";

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
  <p style="font-size: 18px; font-weight: 700; color: #123c3a;">CareerLaunch Studio</p>
  <h1 style="font-size: 24px; color: #123c3a; margin-top: 24px;">Verify your email</h1>
  <p style="color: #4b4b4b; line-height: 1.6;">Hi ${name || "there"},</p>
  <p style="color: #4b4b4b; line-height: 1.6;">
    Thanks for creating an account. Click the button below to verify your email address.
    This link expires in 24 hours.
  </p>
  <a href="${url}" style="display: inline-block; background: #123c3a; color: #fff; font-weight: 700; padding: 12px 28px; border-radius: 9999px; text-decoration: none; margin: 24px 0;">
    Verify email
  </a>
  <p style="color: #7a7a7a; font-size: 14px;">Or paste this link into your browser:<br/>${url}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin-top: 32px;"/>
  <p style="color: #7a7a7a; font-size: 13px;">If you didn't create an account, you can ignore this email.</p>
</body>
</html>`;

  return sendEmail({ to: email, subject, html });
}

/**
 * Send a password reset link.
 *
 * Link includes both the raw token and the email address so the reset form
 * can pre-fill the email field. The raw token itself is one-time-use.
 */
export async function sendPasswordResetEmail(
  email: string,
  rawToken: string,
): Promise<EmailResult> {
  const url = `${getBaseUrl()}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`;
  const subject = "Reset your password — CareerLaunch Studio";

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
  <p style="font-size: 18px; font-weight: 700; color: #123c3a;">CareerLaunch Studio</p>
  <h1 style="font-size: 24px; color: #123c3a; margin-top: 24px;">Reset your password</h1>
  <p style="color: #4b4b4b; line-height: 1.6;">Hi there,</p>
  <p style="color: #4b4b4b; line-height: 1.6;">
    We received a request to reset your password. Click the button below to set a new one.
    This link expires in 1 hour and can only be used once.
  </p>
  <a href="${url}" style="display: inline-block; background: #123c3a; color: #fff; font-weight: 700; padding: 12px 28px; border-radius: 9999px; text-decoration: none; margin: 24px 0;">
    Reset password
  </a>
  <p style="color: #7a7a7a; font-size: 14px;">Or paste this link into your browser:<br/>${url}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin-top: 32px;"/>
  <p style="color: #7a7a7a; font-size: 13px;">If you didn't request a password reset, you can ignore this email.</p>
</body>
</html>`;

  return sendEmail({ to: email, subject, html });
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log("[email] No RESEND_API_KEY — logging email instead of sending:");
    console.log(`  To: ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body: ${html.slice(0, 300)}...`);
    return { sent: true };
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    console.error("[email] Failed to send:", reason);
    return { sent: false, reason };
  }
}

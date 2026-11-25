import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SendOtpOptions {
  to: string;
  otp: string;
  name?: string;
}

export interface SendPasswordResetOptions {
  to: string;
  resetUrl?: string;
  token?: string;
  name?: string;
}

let cachedTransporter: Transporter | null = null;

/**
 * Resolve the full application URL for web links (e.g. password resets).
 */
export function appUrl(path: string): string {
  const base = (
    process.env.APP_URL ||
    process.env.WEB_APP_URL ||
    process.env.PUBLIC_API_URL ||
    'http://localhost:3001'
  ).replace(/\/$/, '');
  return path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Check whether SMTP configuration is present in environment variables.
 * Returns false if credentials are placeholder defaults (e.g. 'your-email@gmail.com').
 */
export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  const isPlaceholder = (val?: string) =>
    !val ||
    val === 'your-email@gmail.com' ||
    val === 'your-app-password' ||
    val.includes('example.com') ||
    val.startsWith('change-me');

  if (user && pass && !isPlaceholder(user) && !isPlaceholder(pass)) {
    return true;
  }
  // Allow custom local/intranet relays if host is explicitly specified and not the placeholder
  if (host && host !== 'smtp.gmail.com' && !host.includes('example.com') && host !== 'localhost') {
    return true;
  }
  return false;
}

/**
 * Escape HTML special characters to prevent injection in email templates.
 */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

/**
 * Get or create the Nodemailer transporter using environment variables.
 */
export function getMailTransporter(): Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  } else {
    // Development / unconfigured fallback: create a stream or test transport
    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: user ? { user, pass: '' } : undefined,
    });
  }

  return cachedTransporter;
}

/**
 * Build the HTML email content for the ResolveX OTP notification.
 */
function buildOtpEmailHtml(otp: string, name?: string): string {
  const displayName = name ? name.trim() : 'there';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ResolveX Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f4ec; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #14201a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f6f4ec; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; border: 1px solid #dfdbcc; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 20px 36px; text-align: left; border-bottom: 1px solid #f0eee6;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="background-color: #177a43; width: 36px; height: 36px; border-radius: 10px; text-align: center; line-height: 36px; color: #ffffff; font-weight: 800; font-size: 18px;">
                      R
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="font-size: 20px; font-weight: 800; color: #14201a; letter-spacing: -0.5px;">
                      Resolve<span style="color: #177a43;">X</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #14201a; line-height: 1.3;">
                Verification Code
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #5f6b64;">
                Hi <strong>${escapeHtml(displayName)}</strong>,<br>
                Please use the following 6-digit one-time password (OTP) to complete your sign-in to ResolveX:
              </p>

              <!-- OTP Code Display Card -->
              <div style="background-color: #fbfaf6; border: 2px dashed #b2e2a8; border-radius: 14px; padding: 24px; text-align: center; margin: 24px 0;">
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #177a43; text-indent: 10px;">
                  ${otp}
                </div>
                <div style="margin-top: 8px; font-size: 12px; font-weight: 600; color: #177a43;">
                  Valid for 10 minutes
                </div>
              </div>

              <p style="margin: 24px 0 8px 0; font-size: 13px; line-height: 1.5; color: #5f6b64;">
                <strong>Security Notice:</strong> Never share this code with anyone. ResolveX staff will never ask for your verification code.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #88938c;">
                If you did not attempt to sign in to ResolveX, someone may have entered your email by mistake or knows your password. Please sign in and update your password immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fbfaf6; padding: 20px 36px; text-align: center; border-top: 1px solid #dfdbcc; font-size: 11px; color: #88938c;">
              ResolveX Inc. &bull; High-Availability Incident Response & Workspace Platform<br>
              This is an automated notification. Replies to this email are not monitored.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send an OTP verification email using Nodemailer.
 */
export async function sendOtpEmail(options: SendOtpOptions): Promise<{ success: boolean; error?: string }> {
  const { to, otp, name } = options;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'ResolveX <noreply@resolvex.ai>';
  const subject = `${otp} is your ResolveX verification code`;

  // Always log OTP in server console for visibility & development convenience
  console.log('\n' + '━'.repeat(64));
  console.log(`🔑 [ResolveX Mailer] One-Time Password for ${to}: [ ${otp} ]`);
  if (!isSmtpConfigured()) {
    console.log(`ℹ️  [ResolveX Mailer] SMTP not configured in .env; set SMTP_USER and SMTP_PASS to send real emails.`);
  }
  console.log('━'.repeat(64) + '\n');

  if (!isSmtpConfigured()) {
    // In development, still return success so auth isn't blocked;
    // in production, you must configure SMTP_USER/SMTP_PASS
    return { success: true };
  }

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from,
      to,
      subject,
      text: `Your ResolveX verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nDo not share this code with anyone.`,
      html: buildOtpEmailHtml(otp, name),
    });
    console.log(`✉️  [ResolveX Mailer] OTP email successfully dispatched to ${to}`);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to send email';
    console.error(`⚠️  [ResolveX Mailer] Failed to dispatch email via Nodemailer to ${to}:`, errorMsg);
    // Don't crash the authentication pipeline if SMTP provider fails temporarily in dev
    return { success: false, error: errorMsg };
  }
}

/**
 * Build the HTML email content for the ResolveX Password Reset notification.
 */
function buildPasswordResetEmailHtml(resetUrl: string, name?: string): string {
  const displayName = name ? name.trim() : 'there';
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your ResolveX Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f4ec; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #14201a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f6f4ec; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 20px; border: 1px solid #dfdbcc; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 36px 20px 36px; text-align: left; border-bottom: 1px solid #f0eee6;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="background-color: #177a43; width: 36px; height: 36px; border-radius: 10px; text-align: center; line-height: 36px; color: #ffffff; font-weight: 800; font-size: 18px;">
                      R
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="font-size: 20px; font-weight: 800; color: #14201a; letter-spacing: -0.5px;">
                      Resolve<span style="color: #177a43;">X</span>
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 800; color: #14201a; line-height: 1.3;">
                Reset Your Password
              </h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #5f6b64;">
                Hi <strong>${escapeHtml(displayName)}</strong>,<br>
                We received a request to reset the password for your ResolveX account. Click the button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 28px 0;">
                <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background-color: #177a43; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 2px 4px rgba(23,122,67,0.2);">
                  Reset Password
                </a>
              </div>

              <!-- Fallback Link Box -->
              <div style="background-color: #fbfaf6; border: 1px solid #dfdbcc; border-radius: 12px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6b64; font-weight: 600;">
                  If the button above does not work, copy and paste this link into your browser:
                </p>
                <p style="margin: 0; font-size: 12px; word-break: break-all; color: #177a43;">
                  <a href="${escapeHtml(resetUrl)}" style="color: #177a43; text-decoration: underline;">
                    ${escapeHtml(resetUrl)}
                  </a>
                </p>
              </div>

              <p style="margin: 24px 0 8px 0; font-size: 13px; line-height: 1.5; color: #5f6b64;">
                <strong>Security Notice:</strong> This password reset link is valid for <strong>1 hour</strong>.
              </p>
              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #88938c;">
                If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged and your account is secure.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #fbfaf6; padding: 20px 36px; text-align: center; border-top: 1px solid #dfdbcc; font-size: 11px; color: #88938c;">
              ResolveX Inc. &bull; High-Availability Incident Response & Workspace Platform<br>
              This is an automated notification. Replies to this email are not monitored.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send a password reset (forgot password) email using Nodemailer.
 */
export async function sendPasswordResetEmail(
  options: SendPasswordResetOptions,
): Promise<{ success: boolean; error?: string }> {
  const { to, name } = options;
  const resetUrl = options.resetUrl || (options.token ? appUrl(`/reset-password?token=${encodeURIComponent(options.token)}`) : '');
  if (!resetUrl) {
    throw new Error('Either resetUrl or token must be provided to sendPasswordResetEmail');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'ResolveX <noreply@resolvex.ai>';
  const subject = 'Reset your ResolveX password';

  // Always log reset link in server console for visibility & development convenience
  console.log('\n' + '━'.repeat(64));
  console.log(`🔑 [ResolveX Mailer] Password Reset Link for ${to}:`);
  console.log(`🔗 ${resetUrl}`);
  if (!isSmtpConfigured()) {
    console.log(`ℹ️  [ResolveX Mailer] SMTP not configured in .env; set SMTP_USER and SMTP_PASS to send real emails.`);
  }
  console.log('━'.repeat(64) + '\n');

  if (!isSmtpConfigured()) {
    // In development or when unconfigured, return success so recovery flow is testable via console
    return { success: true };
  }

  try {
    const transporter = getMailTransporter();
    await transporter.sendMail({
      from,
      to,
      subject,
      text: [
        `Reset your ResolveX password`,
        ``,
        `Hi ${name ? name.trim() : 'there'},`,
        `We received a request to reset your ResolveX password.`,
        `Click the link below or copy it into your browser:`,
        resetUrl,
        ``,
        `This link will expire in 1 hour.`,
        `If you did not request a password reset, you can safely ignore this email.`,
      ].join('\n'),
      html: buildPasswordResetEmailHtml(resetUrl, name),
    });
    console.log(`✉️  [ResolveX Mailer] Password reset email successfully dispatched to ${to}`);
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to send email';
    console.error(`⚠️  [ResolveX Mailer] Failed to dispatch password reset email via Nodemailer to ${to}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

export const sendForgotPasswordEmail = sendPasswordResetEmail;

import nodemailer, { type Transporter } from "nodemailer";

type MailerConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

let transporter: Transporter | null = null;
let configuredKey: string | null = null;

function getConfig(): MailerConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const from = process.env.SMTP_FROM?.trim() || process.env.MAIL_FROM?.trim();
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT must be a valid TCP port");
  }

  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER?.trim() || undefined;
  const pass = process.env.SMTP_PASS || undefined;
  if ((user && !pass) || (!user && pass)) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured together");
  }

  return { host, port, secure, user, pass, from };
}

function getTransporter(config: MailerConfig): Transporter {
  const key = JSON.stringify(config);
  if (transporter && configuredKey === key) return transporter;

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth:
      config.user && config.pass
        ? { user: config.user, pass: config.pass }
        : undefined,
  });
  configuredKey = key;
  return transporter;
}

export type InvitationEmail = {
  to: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
};

export async function sendInvitationEmail(
  email: InvitationEmail,
): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;

  await getTransporter(config).sendMail({
    from: config.from,
    to: email.to,
    subject: `You've been invited to join ${email.organizationName}`,
    text: [
      `You have been invited to join ${email.organizationName} as ${email.role}.`,
      "",
      `Accept the invitation: ${email.inviteUrl}`,
      `This invitation expires on ${email.expiresAt}.`,
    ].join("\n"),
    html: [
      `<p>You have been invited to join <strong>${escapeHtml(email.organizationName)}</strong> as ${escapeHtml(email.role)}.</p>`,
      `<p><a href="${escapeHtml(email.inviteUrl)}">Accept invitation</a></p>`,
      `<p>This invitation expires on ${escapeHtml(email.expiresAt)}.</p>`,
    ].join(""),
  });
  return true;
}

export async function sendAlertEmail(args: {
  to: string[];
  incidentId: number;
  severity: string;
  title: string;
  description: string | null;
  step: number;
}): Promise<boolean> {
  const config = getConfig();
  if (!config || args.to.length === 0) return false;

  await getTransporter(config).sendMail({
    from: config.from,
    to: args.to,
    subject: `[${args.severity.toUpperCase()}] ${args.title}`,
    text: [
      `Incident #${args.incidentId} requires attention.`,
      `Severity: ${args.severity}`,
      `Escalation step: ${args.step}`,
      `Title: ${args.title}`,
      args.description ? `\n${args.description}` : "",
    ].join("\n"),
    html: [
      `<p>Incident <strong>#${args.incidentId}</strong> requires attention.</p>`,
      `<p><strong>Severity:</strong> ${escapeHtml(args.severity)}<br>`,
      `<strong>Escalation step:</strong> ${args.step}<br>`,
      `<strong>Title:</strong> ${escapeHtml(args.title)}</p>`,
      args.description ? `<p>${escapeHtml(args.description)}</p>` : "",
    ].join(""),
  });
  return true;
}

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

export function isMailerConfigured(): boolean {
  try {
    return getConfig() !== null;
  } catch {
    return false;
  }
}

function appUrl(path: string): string {
  const base = (process.env.APP_URL || process.env.WEB_APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Generic transactional email (notifications, verification, password reset). Returns false when SMTP is not configured. */
export async function sendGenericEmail(args: {
  to: string;
  subject: string;
  heading: string;
  body?: string | null;
  link?: string | null;
  linkLabel?: string;
}): Promise<boolean> {
  const config = getConfig();
  if (!config) return false;
  const url = args.link ? appUrl(args.link) : null;
  await getTransporter(config).sendMail({
    from: config.from,
    to: args.to,
    subject: args.subject,
    text: [args.heading, '', args.body ?? '', url ? `\n${args.linkLabel ?? 'Open in ResolveX'}: ${url}` : ''].join('\n'),
    html: [
      `<div style="font-family:system-ui,sans-serif;max-width:560px">`,
      `<h2 style="margin:0 0 12px">${escapeHtml(args.heading)}</h2>`,
      args.body ? `<p style="white-space:pre-wrap;color:#333">${escapeHtml(args.body)}</p>` : '',
      url
        ? `<p><a href="${escapeHtml(url)}" style="display:inline-block;background:#177a43;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${escapeHtml(args.linkLabel ?? 'Open in ResolveX')}</a></p>`
        : '',
      `<p style="color:#888;font-size:12px">You can change which emails you receive in ResolveX → Settings → Notifications.</p>`,
      `</div>`,
    ].join(''),
  });
  return true;
}

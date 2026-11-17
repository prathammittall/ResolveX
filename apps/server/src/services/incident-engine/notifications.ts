import { db } from "../../prisma/db.js";
import { sendAlertEmail } from "../email/mailer.js";

export type NotificationRequest = {
  channel: string;
  targetType: string;
  targetId: string;
  incidentId: number;
  severity: string;
  title: string;
  description: string | null;
  step: number;
  companyId?: number;
};

export type NotificationResult = {
  delivered: boolean;
  error?: string;
};

function timeoutMs(): number {
  const configured = Number(process.env.NOTIFICATION_REQUEST_TIMEOUT_MS);
  return Number.isInteger(configured) && configured > 0 ? configured : 5_000;
}

function endpoint(
  value: string | undefined,
  label: string,
): string | NotificationResult {
  if (!value)
    return {
      delivered: false,
      error: `${label} notification endpoint is not configured`,
    };
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return {
        delivered: false,
        error: `${label} notification endpoint must use HTTP or HTTPS`,
      };
    }
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
      return {
        delivered: false,
        error: `${label} notification endpoint must use HTTPS in production`,
      };
    }
    return url.toString();
  } catch {
    return {
      delivered: false,
      error: `${label} notification endpoint is invalid`,
    };
  }
}

async function postJson(
  url: string,
  request: NotificationRequest,
): Promise<NotificationResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: request.channel,
        recipient: request.targetId,
        incident: {
          id: request.incidentId,
          severity: request.severity,
          title: request.title,
          description: request.description,
        },
        escalationStep: request.step,
      }),
      signal: AbortSignal.timeout(timeoutMs()),
    });
    if (!response.ok) {
      return {
        delivered: false,
        error: `Notification endpoint returned HTTP ${response.status}`,
      };
    }
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      error:
        error instanceof Error ? error.message : "Notification request failed",
    };
  }
}

export async function sendNotification(
  request: NotificationRequest,
): Promise<NotificationResult> {
  if (request.channel === "in_app") return { delivered: true };

  if (request.channel === "webhook") {
    const configured = endpoint(request.targetId, "Webhook");
    return typeof configured === "string"
      ? postJson(configured, request)
      : configured;
  }

  if (request.channel === "email") {
    if (process.env.NOTIFICATION_EMAIL_WEBHOOK_URL) {
      const configured = endpoint(
        process.env.NOTIFICATION_EMAIL_WEBHOOK_URL,
        "Email",
      );
      return typeof configured === "string"
        ? postJson(configured, request)
        : configured;
    }
    if (!process.env.SMTP_HOST?.trim() || !(process.env.SMTP_FROM?.trim() || process.env.MAIL_FROM?.trim())) {
      return { delivered: false, error: "SMTP email is not configured" };
    }
    try {
      const recipients = await resolveEmailRecipients(request);
      if (recipients.length === 0)
        return {
          delivered: false,
          error: "No email recipients found for notification target",
        };
      const delivered = await sendAlertEmail({
        to: recipients,
        incidentId: request.incidentId,
        severity: request.severity,
        title: request.title,
        description: request.description,
        step: request.step,
      });
      return delivered
        ? { delivered: true }
        : { delivered: false, error: "SMTP email is not configured" };
    } catch (error) {
      return {
        delivered: false,
        error: error instanceof Error ? error.message : "Email delivery failed",
      };
    }
  }

  if (request.channel === "sms") {
    const configured = endpoint(
      process.env.NOTIFICATION_SMS_WEBHOOK_URL,
      "SMS",
    );
    return typeof configured === "string"
      ? postJson(configured, request)
      : configured;
  }

  return {
    delivered: false,
    error: `Unsupported notification channel: ${request.channel}`,
  };
}

async function resolveEmailRecipients(
  request: NotificationRequest,
): Promise<string[]> {
  if (request.targetType === "user") {
    const userId = Number(request.targetId);
    if (!Number.isInteger(userId) || userId < 1) return [];
    const user = await db.orm.public.User.where({ id: userId }).first();
    return user &&
      (request.companyId === undefined || user.companyId === request.companyId)
      ? [user.email]
      : [];
  }

  if (request.targetType !== "team") return [];
  const members = await db.orm.public.TeamMember.where({
    teamId: request.targetId,
  }).all();
  members.sort(
    (a, b) =>
      Number(b.isLead) - Number(a.isLead) ||
      a.createdAt.localeCompare(b.createdAt),
  );
  const recipients: string[] = [];
  for (const member of members) {
    const user = await db.orm.public.User.where({ id: member.userId }).first();
    if (
      user &&
      (request.companyId === undefined || user.companyId === request.companyId)
    )
      recipients.push(user.email);
  }
  return [...new Set(recipients)];
}

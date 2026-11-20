import { db } from "../../prisma/db.js";
import { sendAlertEmail } from "../email/mailer.js";
import { notifyUsers } from "../notify/index.js";
import { currentOnCallForSchedule } from "../oncall/resolve.js";
import { orgIdForCompany } from "../../lib/tenant-bridge.js";
import { withTenant } from "../../prisma/tenant.js";

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
  if (request.channel === "in_app") {
    if (request.companyId === undefined) return { delivered: false, error: "Missing company" };
    const userIds = await resolveTargetUserIds(request);
    if (userIds.length === 0) return { delivered: false, error: "No recipients found for notification target" };
    await notifyUsers(request.companyId, userIds, {
      type: "incident.escalated",
      title: `[${request.severity.toUpperCase()}] ${request.title}`,
      body: `Escalation step ${request.step + 1} — acknowledge to stop further escalation.`,
      link: `/dashboard/incidents/${request.incidentId}`,
      entityType: "incident",
      entityId: request.incidentId,
      dedupeKey: `incident:${request.incidentId}:escalation:${request.step}`,
    });
    return { delivered: true };
  }

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

/**
 * Users addressed by an escalation step: a user, every member of a team (lead first), or whoever is on
 * call for a schedule right now (primary). Only current members of the incident's organization qualify.
 */
export async function resolveTargetUserIds(request: NotificationRequest): Promise<number[]> {
  let ids: number[] = [];
  if (request.targetType === "user") {
    const userId = Number(request.targetId);
    if (Number.isInteger(userId) && userId > 0) ids = [userId];
  } else if (request.targetType === "schedule") {
    const scheduleId = Number(request.targetId);
    if (Number.isInteger(scheduleId) && scheduleId > 0 && request.companyId !== undefined) {
      const onCall = await currentOnCallForSchedule(scheduleId, request.companyId);
      ids = [onCall?.primary, onCall?.secondary].filter((v): v is number => typeof v === "number");
      // Primary first; secondary only from the second escalation step onward.
      if (request.step === 0) ids = ids.slice(0, 1);
    }
  } else if (request.targetType === "team") {
    const orgId = request.companyId !== undefined ? await orgIdForCompany(request.companyId) : null;
    if (orgId) {
      const members = await withTenant(orgId, (tx) => tx.orm.public.TeamMember.where({ teamId: request.targetId, organizationId: orgId }).all());
      members.sort((a, b) => Number(b.isLead) - Number(a.isLead) || a.createdAt.localeCompare(b.createdAt));
      ids = members.map((m) => m.userId);
    }
  }
  if (ids.length === 0 || request.companyId === undefined) return [];
  const orgId = await orgIdForCompany(request.companyId);
  if (!orgId) return [];
  const members = await withTenant(orgId, (tx) => tx.orm.public.Membership.where({ organizationId: orgId }).all());
  const allowed = new Set(members.map((m) => m.userId));
  return [...new Set(ids)].filter((id) => allowed.has(id));
}

async function resolveEmailRecipients(request: NotificationRequest): Promise<string[]> {
  const ids = await resolveTargetUserIds(request);
  const emails: string[] = [];
  for (const id of ids) {
    const user = await db.orm.public.User.where({ id }).first();
    if (user) emails.push(user.email);
  }
  return [...new Set(emails)];
}

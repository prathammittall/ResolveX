import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../prisma/db.js';
import { isMailerConfigured, sendGenericEmail } from '../email/mailer.js';
import { log } from '../../lib/logger.js';

/**
 * Unified notification architecture.
 *
 *   notifyUsers()  ─▶  Notification rows (in-app, read/unread)  ─▶  worker: deliverPendingEmails()
 *
 * Every notification is first an in-app row. If the recipient's preferences allow email for that type and
 * SMTP is configured, the row is marked `emailStatus = pending` and the background worker sends it with
 * retries/backoff, recording delivery status on the same row. Producers never block on SMTP.
 */

export const NOTIFICATION_TYPES = [
  'incident.created',
  'incident.assigned',
  'incident.escalated',
  'incident.resolved',
  'incident.comment',
  'service.down',
  'service.recovered',
  'task.assigned',
  'task.comment',
  'task.mentioned',
  'task.status',
  'org.invitation',
  'maintenance.scheduled',
  'postmortem.action_item',
  'oncall.shift',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

type ChannelPrefs = { inApp: boolean; email: boolean };
export type NotificationSettings = Partial<Record<NotificationType, ChannelPrefs>>;

/** Defaults: everything in-app; email only for things that need attention now. */
const DEFAULT_EMAIL: ReadonlySet<NotificationType> = new Set([
  'incident.created',
  'incident.assigned',
  'incident.escalated',
  'service.down',
  'task.assigned',
  'task.mentioned',
  'org.invitation',
  'postmortem.action_item',
]);

export function defaultPrefs(type: NotificationType): ChannelPrefs {
  return { inApp: true, email: DEFAULT_EMAIL.has(type) };
}

export function resolvePrefs(settings: unknown, type: NotificationType): ChannelPrefs {
  const s = (settings && typeof settings === 'object' ? (settings as Record<string, unknown>)[type] : null) as
    | Partial<ChannelPrefs>
    | null;
  const d = defaultPrefs(type);
  return { inApp: s?.inApp ?? d.inApp, email: s?.email ?? d.email };
}

export type NotifyInput = {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | number | null;
  /** Idempotency: the same key is only ever delivered once per user. */
  dedupeKey?: string | null;
  /** Do not notify this user (usually the actor who caused the event). */
  excludeUserId?: number | null;
};

/** Create notifications for users of a company. Failures are logged, never thrown into the caller's flow. */
export async function notifyUsers(companyId: number, userIds: Array<number | null | undefined>, input: NotifyInput): Promise<number> {
  const ids = [...new Set(userIds.filter((id): id is number => typeof id === 'number' && id > 0))].filter(
    (id) => id !== input.excludeUserId,
  );
  if (ids.length === 0) return 0;
  try {
    const prefs = await db.orm.public.NotificationPreference.where((p) => and(p.companyId.eq(companyId), p.userId.in(ids))).all();
    const byUser = new Map(prefs.map((p) => [p.userId, p.settings]));
    const mailer = isMailerConfigured();
    let created = 0;
    for (const userId of ids) {
      const channel = resolvePrefs(byUser.get(userId), input.type);
      if (!channel.inApp && !channel.email) continue;
      const dedupeKey = input.dedupeKey ? `${input.dedupeKey}:u${userId}` : null;
      if (dedupeKey) {
        const existing = await db.orm.public.Notification.where({ dedupeKey }).first();
        if (existing) continue;
      }
      try {
        await db.orm.public.Notification.create({
          companyId,
          userId,
          type: input.type,
          title: input.title.slice(0, 300),
          body: input.body ? input.body.slice(0, 4000) : null,
          link: input.link ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId != null ? String(input.entityId) : null,
          // An email-only preference still records the row (as read) so delivery status is visible.
          readAt: channel.inApp ? null : new Date().toISOString(),
          emailStatus: channel.email && mailer ? 'pending' : 'skipped',
          emailNextAttemptAt: channel.email && mailer ? new Date().toISOString() : null,
          dedupeKey,
        });
        created++;
      } catch (error) {
        // Unique violation on dedupeKey under a race = already delivered.
        log.debug('notify.create_skipped', { error: error instanceof Error ? error.message : 'unknown' });
      }
    }
    return created;
  } catch (error) {
    log.error('notify.failed', { type: input.type, error: error instanceof Error ? error.message : 'unknown' });
    return 0;
  }
}

/** Members of a company with one of the given roles (used for broadcast notifications). */
export async function companyUserIdsWithRoles(orgId: string, roles: string[]): Promise<number[]> {
  const rows = await db.orm.public.Membership.where((m) => and(m.organizationId.eq(orgId), m.role.in(roles as never))).all();
  return rows.map((r) => r.userId);
}

const MAX_EMAIL_ATTEMPTS = 5;

/** Worker step: send due notification emails. Returns how many were attempted. */
export async function deliverPendingEmails(batch = 25): Promise<number> {
  const now = new Date().toISOString();
  const due = await db.orm.public.Notification.where((n) => and(n.emailStatus.eq('pending'), n.emailNextAttemptAt.lte(now)))
    .orderBy((n) => n.emailNextAttemptAt.asc())
    .limit(batch)
    .all();
  for (const n of due) {
    // Claim the row: push the next attempt out so a second worker skips it.
    const claimUntil = new Date(Date.now() + 120_000).toISOString();
    const claimed = await db.orm.public.Notification.where((x) => and(x.id.eq(n.id), x.emailStatus.eq('pending'), x.emailNextAttemptAt.lte(now))).update({
      emailNextAttemptAt: claimUntil,
    });
    if (!claimed) continue;
    const user = await db.orm.public.User.where({ id: n.userId }).first();
    const attempts = n.emailAttempts + 1;
    try {
      if (!user) throw new Error('Recipient no longer exists');
      const sent = await sendGenericEmail({
        to: user.email,
        subject: `[ResolveX] ${n.title}`,
        heading: n.title,
        body: n.body,
        link: n.link,
      });
      if (!sent) throw new Error('SMTP is not configured');
      await db.orm.public.Notification.where({ id: n.id }).update({ emailStatus: 'sent', emailAttempts: attempts, emailError: null, emailNextAttemptAt: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      const final = attempts >= MAX_EMAIL_ATTEMPTS;
      await db.orm.public.Notification.where({ id: n.id }).update({
        emailStatus: final ? 'failed' : 'pending',
        emailAttempts: attempts,
        emailError: message.slice(0, 500),
        emailNextAttemptAt: final ? null : new Date(Date.now() + Math.min(2 ** attempts * 30_000, 3_600_000)).toISOString(),
      });
      log.warn('notify.email_failed', { notificationId: n.id, attempts, error: message });
    }
  }
  return due.length;
}

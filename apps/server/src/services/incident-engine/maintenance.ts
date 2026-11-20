import { db } from '../../prisma/db.js';
import { notifyUsers } from '../notify/index.js';
import { orgIdForCompany } from '../../lib/tenant-bridge.js';
import { companyUserIdsWithRoles } from '../notify/index.js';
import { log } from '../../lib/logger.js';

export type MaintenanceWindowRow = {
  id: number;
  companyId: number;
  serviceId: number | null;
  serviceIds: unknown;
  name: string;
  startsAt: string;
  endsAt: string;
  enabled: boolean;
  bypassSeverity: string | null;
  recurrence: string | null;
  recurrenceUntil: string | null;
};

const PERIOD: Record<string, number> = { daily: 86_400_000, weekly: 7 * 86_400_000 };

export function windowServiceIds(w: Pick<MaintenanceWindowRow, 'serviceId' | 'serviceIds'>): number[] | null {
  const list = Array.isArray(w.serviceIds) ? w.serviceIds.filter((v): v is number => Number.isInteger(v)) : [];
  if (w.serviceId !== null) list.push(w.serviceId);
  return list.length > 0 ? [...new Set(list)] : null; // null = all services
}

/** Whether the window (including its recurrences) is in effect at `at` for `serviceId`. */
export function windowCovers(w: MaintenanceWindowRow, serviceId: number, at: number): boolean {
  if (!w.enabled) return false;
  const ids = windowServiceIds(w);
  if (ids && !ids.includes(serviceId)) return false;
  const start = Date.parse(w.startsAt);
  const end = Date.parse(w.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || at < start) return false;
  if (at < end) return true;
  const period = w.recurrence ? PERIOD[w.recurrence] : undefined;
  if (!period) return false;
  if (w.recurrenceUntil && at > Date.parse(w.recurrenceUntil)) return false;
  const offset = (at - start) % period;
  return offset < end - start;
}

/** End of the current occurrence (for deferring escalation until maintenance ends). */
export function occurrenceEnd(w: MaintenanceWindowRow, at: number): string {
  const start = Date.parse(w.startsAt);
  const end = Date.parse(w.endsAt);
  const period = w.recurrence ? PERIOD[w.recurrence] : undefined;
  if (!period || at < end) return w.endsAt;
  const n = Math.floor((at - start) / period);
  return new Date(start + n * period + (end - start)).toISOString();
}

const severityRank: Record<string, number> = { sev1: 1, sev2: 2, sev3: 3, sev4: 4 };

/**
 * Active window suppressing alerts of `severity` for the service. A window's bypass severity lets
 * incidents at that severity or worse page anyway, so critical alerts are never silently swallowed.
 */
export async function activeMaintenanceFor(companyId: number, serviceId: number, severity: string | null, at = Date.now()) {
  const windows = (await db.orm.public.MaintenanceWindow.where({ companyId, enabled: true }).all()) as MaintenanceWindowRow[];
  return (
    windows.find((w) => {
      if (!windowCovers(w, serviceId, at)) return false;
      if (!severity || !w.bypassSeverity) return true;
      return (severityRank[severity] ?? 4) > (severityRank[w.bypassSeverity] ?? 0);
    }) ?? null
  );
}

/** Tell service owners and org admins about newly scheduled maintenance (best effort). */
export async function announceMaintenance(companyId: number, windowId: number): Promise<void> {
  try {
    const w = await db.orm.public.MaintenanceWindow.where({ id: windowId, companyId }).first();
    if (!w || w.notifiedAt) return;
    const ids = windowServiceIds(w as MaintenanceWindowRow);
    const services = ids
      ? await Promise.all(ids.map((id) => db.orm.public.Service.where({ id, companyId }).first()))
      : await db.orm.public.Service.where({ companyId }).all();
    const recipients = new Set<number>();
    for (const s of services) {
      if (s?.ownerId) recipients.add(s.ownerId);
      if (s?.backupOwnerId) recipients.add(s.backupOwnerId);
    }
    const orgId = await orgIdForCompany(companyId);
    if (orgId) for (const id of await companyUserIdsWithRoles(orgId, ['owner', 'admin', 'manager'])) recipients.add(id);
    const names = services.filter(Boolean).map((s) => s!.name);
    await notifyUsers(companyId, [...recipients], {
      type: 'maintenance.scheduled',
      title: `Maintenance scheduled: ${w.name}`,
      body: `${new Date(w.startsAt).toUTCString()} → ${new Date(w.endsAt).toUTCString()}${w.recurrence ? ` (repeats ${w.recurrence})` : ''}\nAffected: ${names.length ? names.join(', ') : 'all services'}${w.description ? `\n\n${w.description}` : ''}`,
      link: '/dashboard/maintenance',
      entityType: 'maintenance',
      entityId: w.id,
      dedupeKey: `maintenance:${w.id}:scheduled`,
    });
    await db.orm.public.MaintenanceWindow.where({ id: w.id }).update({ notifiedAt: new Date().toISOString() });
  } catch (error) {
    log.warn('maintenance.announce_failed', { windowId, error: error instanceof Error ? error.message : 'unknown' });
  }
}

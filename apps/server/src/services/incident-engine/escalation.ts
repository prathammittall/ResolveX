import { db as defaultDb } from '../../prisma/db.js';
import type { IncidentSeverityValue } from './types.js';
import { occurrenceEnd, windowCovers, type MaintenanceWindowRow } from './maintenance.js';

type DbClient = typeof defaultDb;
export type Transaction = Parameters<Parameters<DbClient['transaction']>[0]>[0];

const severityRank: Record<IncidentSeverityValue, number> = {
  sev1: 1,
  sev2: 2,
  sev3: 3,
  sev4: 4,
};

export async function findActiveMaintenanceWindow(
  tx: Transaction,
  args: { companyId: number; serviceId: number; severity: IncidentSeverityValue; at: string },
) {
  const windows = (await tx.orm.public.MaintenanceWindow.where({
    companyId: args.companyId,
    enabled: true,
  }).all()) as MaintenanceWindowRow[];
  const at = Date.parse(args.at);
  if (!Number.isFinite(at)) return null;
  const hit = windows.find((window) => {
    if (!windowCovers(window, args.serviceId, at)) return false;
    // A configured bypass severity allows incidents at that severity or higher
    // to page during maintenance (sev1 is the highest severity).
    return !window.bypassSeverity || severityRank[args.severity] > severityRank[window.bypassSeverity as IncidentSeverityValue];
  });
  return hit ? { ...hit, endsAt: occurrenceEnd(hit, at) } : null;
}

type PolicyRow = {
  id: number;
  serviceId: number | null;
  severities: unknown;
  environment: string | null;
  teamId: string | null;
  activeHours: unknown;
  priority: number;
};

function hourMatches(activeHours: unknown, at: Date): boolean {
  if (!activeHours || typeof activeHours !== 'object') return true;
  const h = activeHours as { start?: number; end?: number; days?: number[]; timezone?: string };
  let hour = at.getUTCHours();
  let day = at.getUTCDay();
  if (h.timezone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: h.timezone, hour: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(at);
      hour = Number(parts.find((p) => p.type === 'hour')?.value ?? hour);
      day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.find((p) => p.type === 'weekday')?.value ?? '');
    } catch {
      // Unknown timezone: fall back to UTC.
    }
  }
  if (Array.isArray(h.days) && h.days.length > 0 && !h.days.includes(day)) return false;
  const start = h.start ?? 0;
  const end = h.end ?? 24;
  return start <= end ? hour >= start && hour < end : hour >= start || hour < end;
}

/**
 * Choose the escalation policy for an incident. Candidates are enabled policies scoped to the service or
 * to the whole company; each condition (severity list, environment, owning team, active hours) must match
 * when set. Service-scoped beats company-wide, then higher priority, then more specific conditions.
 */
async function findPolicy(tx: Transaction, companyId: number, serviceId: number, severity?: IncidentSeverityValue) {
  const service = await tx.orm.public.Service.where({ id: serviceId }).first();
  const policies = (await tx.orm.public.EscalationPolicy.where({ companyId, enabled: true }).all()) as Array<PolicyRow & { name: string }>;
  const now = new Date();
  const matches = policies.filter((p) => {
    if (p.serviceId !== null && p.serviceId !== serviceId) return false;
    const sevs = Array.isArray(p.severities) ? (p.severities as string[]) : null;
    if (sevs && sevs.length > 0 && severity && !sevs.includes(severity)) return false;
    if (p.environment && service && p.environment !== service.environment) return false;
    if (p.teamId && service?.teamId !== p.teamId) return false;
    return hourMatches(p.activeHours, now);
  });
  const specificity = (p: PolicyRow) =>
    (p.serviceId !== null ? 1000 : 0) + p.priority * 10 + (p.environment ? 1 : 0) + (p.teamId ? 1 : 0) + (Array.isArray(p.severities) ? 1 : 0) + (p.activeHours ? 1 : 0);
  matches.sort((a, b) => specificity(b) - specificity(a));
  return matches[0] ?? null;
}

export async function initializeIncidentEscalation(
  tx: Transaction,
  args: {
    incidentId: number;
    companyId: number;
    serviceId: number;
    severity: IncidentSeverityValue;
    occurredAt: string;
  },
): Promise<{ policyId: number; suppressed: boolean } | null> {
  const policy = await findPolicy(tx, args.companyId, args.serviceId, args.severity);
  if (!policy) return null;

  const steps = (await tx.orm.public.EscalationStep.where({ policyId: policy.id }).all()).sort(
    (a, b) => a.position - b.position,
  );
  if (steps.length === 0) return null;

  const maintenanceWindow = await findActiveMaintenanceWindow(tx, {
    companyId: args.companyId,
    serviceId: args.serviceId,
    severity: args.severity,
    at: args.occurredAt,
  });

  if (maintenanceWindow) {
    await tx.orm.public.IncidentEvent.create({
      incidentId: args.incidentId,
      eventType: 'system',
      message: `Escalation notifications suppressed by maintenance window "${maintenanceWindow.name}"`,
      occurredAt: args.occurredAt,
    });
    await tx.orm.public.Incident.where({ id: args.incidentId }).update({
      escalationPolicyId: policy.id,
    });
    return { policyId: policy.id, suppressed: true };
  }

  const existing = await tx.orm.public.IncidentEscalation.where({ incidentId: args.incidentId }).first();
  if (existing) return { policyId: existing.policyId, suppressed: false };

  const firstStep = steps[0];
  const firstDeadline = new Date(Date.parse(args.occurredAt) + firstStep.delaySeconds * 1000).toISOString();

  await tx.orm.public.Incident.where({ id: args.incidentId }).update({
    escalationPolicyId: policy.id,
    escalationStatus: 'active',
    acknowledgmentDueAt: firstDeadline,
  });

  await tx.orm.public.IncidentEscalation.create({
    incidentId: args.incidentId,
    policyId: policy.id,
    currentStep: 0,
    status: 'active',
    nextEscalationAt: firstDeadline,
  });

  await tx.orm.public.QueueJob.create({
    companyId: args.companyId,
    incidentId: args.incidentId,
    type: 'notify',
    status: 'pending',
    runAt: args.occurredAt,
    attempts: 0,
    idempotencyKey: `incident:${args.incidentId}:step:0:notify`,
    payload: {
      incidentId: args.incidentId,
      policyId: policy.id,
      step: 0,
    } as any,
  });

  return { policyId: policy.id, suppressed: false };
}

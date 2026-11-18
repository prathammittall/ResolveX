import { db as defaultDb } from '../../prisma/db.js';
import type { IncidentSeverityValue } from './types.js';

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
  const windows = await tx.orm.public.MaintenanceWindow.where({
    companyId: args.companyId,
    enabled: true,
  }).all();
  const at = Date.parse(args.at);

  return (
    windows.find((window) => {
      if (window.serviceId !== null && window.serviceId !== args.serviceId) return false;
      const startsAt = Date.parse(window.startsAt);
      const endsAt = Date.parse(window.endsAt);
      if (!Number.isFinite(at) || !Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return false;
      if (at < startsAt || at >= endsAt) return false;

      // A configured bypass severity allows incidents at that severity or higher
      // to page during maintenance (sev1 is the highest severity).
      return !window.bypassSeverity || severityRank[args.severity] > severityRank[window.bypassSeverity as IncidentSeverityValue];
    }) ?? null
  );
}

async function findPolicy(tx: Transaction, companyId: number, serviceId: number) {
  const servicePolicies = await tx.orm.public.EscalationPolicy.where({
    companyId,
    serviceId,
    enabled: true,
  }).all();
  if (servicePolicies.length > 0) return servicePolicies[0];

  const companyPolicies = await tx.orm.public.EscalationPolicy.where({
    companyId,
    enabled: true,
  }).all();
  return companyPolicies.find((policy) => policy.serviceId === null) ?? null;
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
  const policy = await findPolicy(tx, args.companyId, args.serviceId);
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

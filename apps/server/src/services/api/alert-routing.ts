import { z } from 'zod';
import { db } from '../../prisma/db.js';
import { announceMaintenance } from '../incident-engine/maintenance.js';
import {
  badRequestResponse,
  conflictResponse,
  notFoundResponse,
  serverErrorResponse,
} from './auth.js';

const severityEnum = z.enum(['sev1', 'sev2', 'sev3', 'sev4']);
const targetTypeEnum = z.enum(['user', 'team', 'webhook', 'schedule']);
const channelEnum = z.enum(['in_app', 'email', 'webhook', 'sms']);
const isoTimestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid timestamp');

const stepSchema = z
  .object({
    position: z.number().int().min(0).optional(),
    delaySeconds: z.number().int().positive().max(31_536_000),
    targetType: targetTypeEnum,
    targetId: z.string().trim().min(1).max(500),
    notificationChannels: z.array(channelEnum).min(1),
    acknowledgmentRequired: z.boolean().default(true),
  })
  .strict();

const policySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    serviceId: z.number().int().positive().nullable().optional(),
    enabled: z.boolean().default(true),
    severities: z.array(severityEnum).max(4).nullable().optional(),
    environment: z.enum(['production', 'staging', 'development']).nullable().optional(),
    teamId: z.string().uuid().nullable().optional(),
    activeHours: z
      .object({ start: z.number().int().min(0).max(23), end: z.number().int().min(0).max(24), days: z.array(z.number().int().min(0).max(6)).max(7).optional(), timezone: z.string().max(64).optional() })
      .nullable()
      .optional(),
    priority: z.number().int().min(-100).max(100).optional(),
    steps: z.array(stepSchema).min(1).max(20),
  })
  .strict();

const policyUpdateSchema = policySchema.partial().extend({
  steps: z.array(stepSchema).min(1).max(20).optional(),
});

const maintenanceFields = z.object({
  serviceId: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(150),
  startsAt: isoTimestamp,
  endsAt: isoTimestamp,
  timezone: z.string().trim().min(1).max(100),
  enabled: z.boolean().default(true),
  bypassSeverity: severityEnum.nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly']).nullable().optional(),
  recurrenceUntil: isoTimestamp.nullable().optional(),
  serviceIds: z.array(z.number().int().positive()).max(100).nullable().optional(),
});

const maintenanceSchema = maintenanceFields
  .strict()
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  });

const maintenanceUpdateSchema = z
  .object({
    serviceId: z.number().int().positive().nullable().optional(),
    name: z.string().trim().min(1).max(150).optional(),
    startsAt: isoTimestamp.optional(),
    endsAt: isoTimestamp.optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    enabled: z.boolean().optional(),
    bypassSeverity: severityEnum.nullable().optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    recurrence: z.enum(['none', 'daily', 'weekly']).nullable().optional(),
    recurrenceUntil: isoTimestamp.nullable().optional(),
    serviceIds: z.array(z.number().int().positive()).max(100).nullable().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.startsAt === undefined ||
      value.endsAt === undefined ||
      Date.parse(value.endsAt) > Date.parse(value.startsAt),
    {
      message: 'endsAt must be after startsAt',
      path: ['endsAt'],
    },
  );

async function serviceBelongsToCompany(companyId: number, serviceId: number | null | undefined): Promise<boolean> {
  if (serviceId == null) return true;
  const service = await db.orm.public.Service.where({ id: serviceId }).first();
  return service?.companyId === companyId;
}

function shapeStep(step: {
  id: number;
  position: number;
  delaySeconds: number;
  targetType: string;
  targetId: string;
  notificationChannels: unknown;
  acknowledgmentRequired: boolean;
}) {
  return {
    id: step.id,
    position: step.position,
    delaySeconds: step.delaySeconds,
    targetType: step.targetType,
    targetId: step.targetId,
    notificationChannels: step.notificationChannels,
    acknowledgmentRequired: step.acknowledgmentRequired,
  };
}

async function shapePolicy(policy: {
  id: number;
  companyId: number;
  serviceId: number | null;
  name: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}) {
  const steps = await db.orm.public.EscalationStep.where({ policyId: policy.id }).all();
  steps.sort((a, b) => a.position - b.position);
  return {
    ...policy,
    steps: steps.map(shapeStep),
  };
}

export async function listEscalationPolicies(companyId: number): Promise<Response> {
  try {
    const policies = await db.orm.public.EscalationPolicy.where({ companyId }).all();
    return Response.json({ ok: true, policies: await Promise.all(policies.map(shapePolicy)) });
  } catch (error) {
    console.error('[api/alert-routing] list policies error:', error);
    return serverErrorResponse();
  }
}

export async function createEscalationPolicy(companyId: number, body: unknown): Promise<Response> {
  const parsed = policySchema.safeParse(body);
  if (!parsed.success) return badRequestResponse('Invalid escalation policy', parsed.error.flatten());
  if (!(await serviceBelongsToCompany(companyId, parsed.data.serviceId))) {
    return notFoundResponse('Service not found');
  }

  try {
    const duplicate = await db.orm.public.EscalationPolicy.where({
      companyId,
      name: parsed.data.name,
    }).first();
    if (duplicate) return conflictResponse('An escalation policy with this name already exists');

    const policy = await db.transaction(async (tx) => {
      const created = await tx.orm.public.EscalationPolicy.create({
        companyId,
        serviceId: parsed.data.serviceId ?? null,
        name: parsed.data.name,
        enabled: parsed.data.enabled,
        severities: (parsed.data.severities ?? null) as never,
        environment: parsed.data.environment ?? null,
        teamId: parsed.data.teamId ?? null,
        activeHours: (parsed.data.activeHours ?? null) as never,
        priority: parsed.data.priority ?? 0,
      });
      for (const [index, step] of parsed.data.steps.entries()) {
        await tx.orm.public.EscalationStep.create({
          policyId: created.id,
          position: step.position ?? index,
          delaySeconds: step.delaySeconds,
          targetType: step.targetType,
          targetId: step.targetId,
          notificationChannels: step.notificationChannels,
          acknowledgmentRequired: step.acknowledgmentRequired,
        });
      }
      return created;
    });

    return Response.json({ ok: true, policy: await shapePolicy(policy) }, { status: 201 });
  } catch (error) {
    console.error('[api/alert-routing] create policy error:', error);
    return serverErrorResponse();
  }
}

export async function updateEscalationPolicy(companyId: number, id: number, body: unknown): Promise<Response> {
  const parsed = policyUpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return badRequestResponse('No valid policy fields to update', parsed.success ? undefined : parsed.error.flatten());
  }

  try {
    const existing = await db.orm.public.EscalationPolicy.where({ id }).first();
    if (!existing || existing.companyId !== companyId) return notFoundResponse('Escalation policy not found');
    if (parsed.data.serviceId !== undefined && !(await serviceBelongsToCompany(companyId, parsed.data.serviceId))) {
      return notFoundResponse('Service not found');
    }
    if (parsed.data.name && parsed.data.name !== existing.name) {
      const duplicate = await db.orm.public.EscalationPolicy.where({
        companyId,
        name: parsed.data.name,
      }).first();
      if (duplicate && duplicate.id !== id) return conflictResponse('An escalation policy with this name already exists');
    }

    const updated = await db.transaction(async (tx) => {
      const update: Record<string, unknown> = {};
      if (parsed.data.name !== undefined) update.name = parsed.data.name;
      if (parsed.data.serviceId !== undefined) update.serviceId = parsed.data.serviceId;
      if (parsed.data.enabled !== undefined) update.enabled = parsed.data.enabled;
      if (parsed.data.severities !== undefined) update.severities = parsed.data.severities;
      if (parsed.data.environment !== undefined) update.environment = parsed.data.environment;
      if (parsed.data.teamId !== undefined) update.teamId = parsed.data.teamId;
      if (parsed.data.activeHours !== undefined) update.activeHours = parsed.data.activeHours;
      if (parsed.data.priority !== undefined) update.priority = parsed.data.priority;
      await tx.orm.public.EscalationPolicy.where({ id }).update(update);

      if (parsed.data.steps) {
        await tx.orm.public.EscalationStep.where({ policyId: id }).deleteAll();
        for (const [index, step] of parsed.data.steps.entries()) {
          await tx.orm.public.EscalationStep.create({
            policyId: id,
            position: step.position ?? index,
            delaySeconds: step.delaySeconds,
            targetType: step.targetType,
            targetId: step.targetId,
            notificationChannels: step.notificationChannels,
            acknowledgmentRequired: step.acknowledgmentRequired,
          });
        }
      }
      return tx.orm.public.EscalationPolicy.where({ id }).first();
    });

    return Response.json({ ok: true, policy: updated ? await shapePolicy(updated) : null });
  } catch (error) {
    console.error('[api/alert-routing] update policy error:', error);
    return serverErrorResponse();
  }
}

export async function listMaintenanceWindows(companyId: number): Promise<Response> {
  try {
    const windows = await db.orm.public.MaintenanceWindow.where({ companyId }).all();
    windows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return Response.json({ ok: true, maintenanceWindows: windows });
  } catch (error) {
    console.error('[api/alert-routing] list maintenance error:', error);
    return serverErrorResponse();
  }
}

export async function createMaintenanceWindow(
  companyId: number,
  userId: number,
  body: unknown,
): Promise<Response> {
  const parsed = maintenanceSchema.safeParse(body);
  if (!parsed.success) return badRequestResponse('Invalid maintenance window', parsed.error.flatten());
  if (!(await serviceBelongsToCompany(companyId, parsed.data.serviceId))) {
    return notFoundResponse('Service not found');
  }

  try {
    const window = await db.orm.public.MaintenanceWindow.create({
      companyId,
      serviceId: parsed.data.serviceId ?? null,
      name: parsed.data.name,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      timezone: parsed.data.timezone,
      enabled: parsed.data.enabled,
      bypassSeverity: parsed.data.bypassSeverity ?? null,
      description: parsed.data.description ?? null,
      recurrence: parsed.data.recurrence && parsed.data.recurrence !== 'none' ? parsed.data.recurrence : null,
      recurrenceUntil: parsed.data.recurrenceUntil ?? null,
      serviceIds: (parsed.data.serviceIds ?? null) as never,
      createdById: userId,
    });
    void announceMaintenance(companyId, window.id);
    return Response.json({ ok: true, maintenanceWindow: window }, { status: 201 });
  } catch (error) {
    console.error('[api/alert-routing] create maintenance error:', error);
    return serverErrorResponse();
  }
}

export async function updateMaintenanceWindow(companyId: number, id: number, body: unknown): Promise<Response> {
  const parsed = maintenanceUpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return badRequestResponse('No valid maintenance fields to update', parsed.success ? undefined : parsed.error.flatten());
  }

  try {
    const existing = await db.orm.public.MaintenanceWindow.where({ id }).first();
    if (!existing || existing.companyId !== companyId) return notFoundResponse('Maintenance window not found');
    if (parsed.data.serviceId !== undefined && !(await serviceBelongsToCompany(companyId, parsed.data.serviceId))) {
      return notFoundResponse('Service not found');
    }

    const update: Record<string, unknown> = {};
    for (const field of ['serviceId', 'name', 'startsAt', 'endsAt', 'timezone', 'enabled', 'bypassSeverity', 'description', 'recurrence', 'recurrenceUntil', 'serviceIds'] as const) {
      if (parsed.data[field] !== undefined) update[field] = parsed.data[field];
    }
    await db.orm.public.MaintenanceWindow.where({ id }).update(update);
    const updated = await db.orm.public.MaintenanceWindow.where({ id }).first();
    return Response.json({ ok: true, maintenanceWindow: updated });
  } catch (error) {
    console.error('[api/alert-routing] update maintenance error:', error);
    return serverErrorResponse();
  }
}

export async function deleteMaintenanceWindow(companyId: number, id: number): Promise<Response> {
  try {
    const existing = await db.orm.public.MaintenanceWindow.where({ id }).first();
    if (!existing || existing.companyId !== companyId) return notFoundResponse('Maintenance window not found');
    await db.orm.public.MaintenanceWindow.where({ id }).delete();
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/alert-routing] delete maintenance error:', error);
    return serverErrorResponse();
  }
}

export async function deleteEscalationPolicy(companyId: number, id: number): Promise<Response> {
  try {
    const existing = await db.orm.public.EscalationPolicy.where({ id }).first();
    if (!existing || existing.companyId !== companyId) return notFoundResponse('Escalation policy not found');
    const inUse = await db.orm.public.IncidentEscalation.where({ policyId: id, status: 'active' }).first();
    if (inUse) return conflictResponse('This policy is escalating an open incident; disable it instead');
    await db.orm.public.IncidentEscalation.where({ policyId: id }).deleteAll();
    await db.orm.public.EscalationPolicy.where({ id }).delete();
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[api/alert-routing] delete policy error:', error);
    return serverErrorResponse();
  }
}

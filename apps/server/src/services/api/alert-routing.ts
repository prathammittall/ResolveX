import { z } from 'zod';
import { db } from '../../prisma/db.js';
import {
  badRequestResponse,
  conflictResponse,
  notFoundResponse,
  serverErrorResponse,
} from './auth.js';

const severityEnum = z.enum(['sev1', 'sev2', 'sev3', 'sev4']);
const targetTypeEnum = z.enum(['user', 'team', 'webhook']);
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
      await tx.orm.public.EscalationPolicy.where({ id }).update(update);

      if (parsed.data.steps) {
        await tx.orm.public.EscalationStep.where({ policyId: id }).delete();
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
      createdById: userId,
    });
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
    for (const field of ['serviceId', 'name', 'startsAt', 'endsAt', 'timezone', 'enabled', 'bypassSeverity'] as const) {
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

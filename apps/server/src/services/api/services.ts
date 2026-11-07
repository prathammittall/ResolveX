import { z } from 'zod';
import { db } from '../../prisma/db.js';
import {
  badRequestResponse,
  conflictResponse,
  notFoundResponse,
  serverErrorResponse,
} from './auth.js';

// --- Validation ---

const serviceTypeEnum = z.enum(['http', 'api', 'database', 'queue', 'worker', 'other']);
const environmentEnum = z.enum(['production', 'staging', 'development']);
const criticalityEnum = z.enum(['low', 'medium', 'high', 'critical']);

export const createServiceSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100, 'Name is too long'),
    description: z.string().trim().max(500).optional(),
    serviceType: serviceTypeEnum,
    environment: environmentEnum,
    criticality: criticalityEnum,
    monitoredUrl: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), 'Enter a valid URL'),
  })
  .strict();

export const updateServiceSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    serviceType: serviceTypeEnum.optional(),
    environment: environmentEnum.optional(),
    criticality: criticalityEnum.optional(),
    monitoredUrl: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), 'Enter a valid URL'),
  })
  .strict();

// --- Shaping ---

function shapeService(s: {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  serviceType: string;
  monitoredUrl: string | null;
  environment: string;
  criticality: string;
  healthStatus: string;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: s.id,
    companyId: s.companyId,
    name: s.name,
    description: s.description,
    serviceType: s.serviceType,
    monitoredUrl: s.monitoredUrl,
    environment: s.environment,
    criticality: s.criticality,
    healthStatus: s.healthStatus,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

// --- Handlers ---

/**
 * GET /api/services?status=&environment=
 */
export async function listServices(
  companyId: number,
  searchParams: URLSearchParams,
): Promise<Response> {
  try {
    const statusFilter = searchParams.get('status');
    const envFilter = searchParams.get('environment');

    const [services, incidents] = await Promise.all([
      db.orm.public.Service.where({ companyId }).all(),
      db.orm.public.Incident.where({ companyId }).all(),
    ]);

    // Map serviceId -> its single open (non-resolved) incident.
    const openByService = new Map<number, { id: number; severity: string; status: string; detectedAt: string }>();
    for (const inc of incidents) {
      if (inc.status !== 'resolved' && !openByService.has(inc.serviceId)) {
        openByService.set(inc.serviceId, {
          id: inc.id,
          severity: inc.severity,
          status: inc.status,
          detectedAt: inc.detectedAt,
        });
      }
    }

    let result = services;
    if (statusFilter) result = result.filter((s) => s.healthStatus === statusFilter);
    if (envFilter) result = result.filter((s) => s.environment === envFilter);

    result.sort((a, b) => a.name.localeCompare(b.name));

    const data = result.map((s) => ({
      ...shapeService(s),
      openIncident: openByService.get(s.id) ?? null,
    }));

    return Response.json({ ok: true, services: data });
  } catch (err) {
    console.error('[api/services] list error:', err);
    return serverErrorResponse();
  }
}

/**
 * GET /api/services/:id
 */
export async function getService(companyId: number, id: number): Promise<Response> {
  try {
    const service = await db.orm.public.Service.where({ id }).first();
    if (!service || service.companyId !== companyId) {
      return notFoundResponse('Service not found');
    }
    const [incidents, alerts] = await Promise.all([
      db.orm.public.Incident.where({ serviceId: id }).all(),
      db.orm.public.AlertEvent.where({ serviceId: id }).all(),
    ]);
    return Response.json({
      ok: true,
      service: shapeService(service),
      incidents: incidents.sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)),
      alertCount: alerts.length,
    });
  } catch (err) {
    console.error('[api/services] get error:', err);
    return serverErrorResponse();
  }
}

/**
 * POST /api/services
 */
export async function createService(payload: unknown, companyId: number): Promise<Response> {
  try {
    const parsed = createServiceSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequestResponse('Invalid service data', parsed.error.flatten());
    }
    const d = parsed.data;

    const existing = await db.orm.public.Service.where({ companyId, name: d.name }).first();
    if (existing) {
      return conflictResponse('A service with this name already exists');
    }

    const created = await db.orm.public.Service.create({
      companyId,
      name: d.name,
      description: d.description ?? null,
      serviceType: d.serviceType,
      monitoredUrl: d.monitoredUrl || null,
      environment: d.environment,
      criticality: d.criticality,
      healthStatus: 'unknown',
    });

    return Response.json({ ok: true, service: shapeService(created) }, { status: 201 });
  } catch (err) {
    console.error('[api/services] create error:', err);
    return serverErrorResponse();
  }
}

/**
 * PATCH /api/services/:id
 */
export async function updateService(
  companyId: number,
  id: number,
  payload: unknown,
): Promise<Response> {
  try {
    const parsed = updateServiceSchema.safeParse(payload);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return badRequestResponse('No valid fields to update', parsed.success ? undefined : parsed.error.flatten());
    }
    const d = parsed.data;

    const service = await db.orm.public.Service.where({ id }).first();
    if (!service || service.companyId !== companyId) {
      return notFoundResponse('Service not found');
    }

    if (d.name && d.name !== service.name) {
      const clash = await db.orm.public.Service.where({ companyId, name: d.name }).first();
      if (clash && clash.id !== id) {
        return conflictResponse('A service with this name already exists');
      }
    }

    const update: Record<string, unknown> = {};
    if (d.name !== undefined) update.name = d.name;
    if (d.description !== undefined) update.description = d.description || null;
    if (d.serviceType !== undefined) update.serviceType = d.serviceType;
    if (d.environment !== undefined) update.environment = d.environment;
    if (d.criticality !== undefined) update.criticality = d.criticality;
    if (d.monitoredUrl !== undefined) update.monitoredUrl = d.monitoredUrl || null;

    await db.orm.public.Service.where({ id }).update(update);
    const updated = await db.orm.public.Service.where({ id }).first();

    return Response.json({ ok: true, service: updated ? shapeService(updated) : null });
  } catch (err) {
    console.error('[api/services] update error:', err);
    return serverErrorResponse();
  }
}

/**
 * DELETE /api/services/:id
 */
export async function deleteService(companyId: number, id: number): Promise<Response> {
  try {
    const service = await db.orm.public.Service.where({ id }).first();
    if (!service || service.companyId !== companyId) {
      return notFoundResponse('Service not found');
    }
    // Cascade deletes incidents, events and alerts (FK onDelete: Cascade / SetNull).
    await db.orm.public.Service.where({ id }).delete();
    return Response.json({ ok: true, message: 'Service deleted' });
  } catch (err) {
    console.error('[api/services] delete error:', err);
    return serverErrorResponse();
  }
}

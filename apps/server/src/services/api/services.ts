import { z } from 'zod';
import { db } from '../../prisma/db.js';
import { assertSafeUrl } from '../../lib/safe-http.js';
import {
  badRequestResponse,
  conflictResponse,
  notFoundResponse,
  serverErrorResponse,
} from './auth.js';

// --- Validation ---

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .refine((v) => !v || /^https?:\/\/[^\s]+$/i.test(v), 'Enter a valid URL');

const catalogFields = {
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, 'Use 2-63 lowercase letters, digits and dashes').nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  ownerId: z.number().int().positive().nullable().optional(),
  backupOwnerId: z.number().int().positive().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  repositoryUrl: optionalUrl,
  docsUrl: optionalUrl,
  runbookUrl: optionalUrl,
  tags: z.array(z.string().trim().min(1).max(30)).max(20).nullable().optional(),
  currentVersion: z.string().trim().max(100).nullable().optional(),
};

const serviceTypeEnum = z.enum(['http', 'api', 'database', 'queue', 'worker', 'frontend', 'backend', 'microservice', 'external', 'other']);
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
    ...catalogFields,
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
    ...catalogFields,
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
  slug?: string | null;
  teamId?: string | null;
  ownerId?: number | null;
  backupOwnerId?: number | null;
  projectId?: string | null;
  repositoryUrl?: string | null;
  docsUrl?: string | null;
  runbookUrl?: string | null;
  tags?: unknown;
  currentVersion?: string | null;
  lastDeployedAt?: string | null;
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
    slug: s.slug ?? null,
    teamId: s.teamId ?? null,
    ownerId: s.ownerId ?? null,
    backupOwnerId: s.backupOwnerId ?? null,
    projectId: s.projectId ?? null,
    repositoryUrl: s.repositoryUrl ?? null,
    docsUrl: s.docsUrl ?? null,
    runbookUrl: s.runbookUrl ?? null,
    tags: Array.isArray(s.tags) ? s.tags : [],
    currentVersion: s.currentVersion ?? null,
    lastDeployedAt: s.lastDeployedAt ?? null,
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
      healthStatus: d.monitoredUrl ? 'pending' : 'unknown',
      slug: d.slug ?? null,
      teamId: d.teamId ?? null,
      ownerId: d.ownerId ?? null,
      backupOwnerId: d.backupOwnerId ?? null,
      projectId: d.projectId ?? null,
      repositoryUrl: d.repositoryUrl ?? null,
      docsUrl: d.docsUrl ?? null,
      runbookUrl: d.runbookUrl ?? null,
      tags: (d.tags ?? null) as never,
      currentVersion: d.currentVersion ?? null,
    });
    // A monitored URL on creation becomes a default HTTP monitor (validated against SSRF rules).
    if (d.monitoredUrl) {
      try {
        assertSafeUrl(d.monitoredUrl);
        await db.orm.public.Monitor.create({
          companyId,
          serviceId: created.id,
          name: 'Default health check',
          url: d.monitoredUrl,
          method: 'GET',
          expectedStatusCodes: [200] as never,
          intervalSeconds: 60,
          nextCheckAt: new Date().toISOString(),
        });
      } catch {
        // Unsafe/invalid URL: keep the service, skip the monitor.
      }
    }

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
    for (const key of ['slug', 'teamId', 'ownerId', 'backupOwnerId', 'projectId', 'repositoryUrl', 'docsUrl', 'runbookUrl', 'tags', 'currentVersion'] as const) {
      if (d[key] !== undefined) update[key] = d[key] === '' ? null : d[key];
    }

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

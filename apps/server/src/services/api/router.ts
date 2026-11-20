import {
  authenticate,
  badRequestResponse,
  notFoundResponse,
  unauthorizedResponse,
} from './auth.js';
import { getMetrics } from './metrics.js';
import {
  createService,
  deleteService,
  getService,
  listServices,
  updateService,
} from './services.js';
import {
  acknowledgeIncident,
  commentIncident,
  getIncident,
  listIncidents,
  resolveIncident,
} from './incidents.js';
import { listAlerts } from './alerts.js';
import { can, type Permission } from '../org/permissions.js';
import { orgRoutes } from './org-routes.js';
import { workRoutes } from './work-routes.js';
import { createServiceWebhookKey, listServiceWebhookKeys, revokeServiceWebhookKey } from './webhook-keys.js';
import { buildContext, runModules } from '../../lib/http.js';
import { sha256 } from '../../lib/crypto.js';
import { rememberOrgForCompany } from '../../lib/tenant-bridge.js';
import { db } from '../../prisma/db.js';
import type { UserTokenPayload } from '../auth/model.js';
import { agileRoutes } from './modules/agile.js';
import { opsRoutes } from './modules/ops.js';
import { incidentRoutes } from './modules/incidents.js';
import { collabRoutes } from './modules/collab.js';
import { integrationRoutes } from './modules/integrations.js';
import { analyticsRoutes } from './modules/analytics.js';
import {
  deleteEscalationPolicy,
  createEscalationPolicy,
  createMaintenanceWindow,
  deleteMaintenanceWindow,
  listEscalationPolicies,
  listMaintenanceWindows,
  updateEscalationPolicy,
  updateMaintenanceWindow,
} from './alert-routing.js';

/** Strip an optional leading `/api` prefix so the router works for both shapes. */
function normalizePath(pathname: string): string {
  const stripped = pathname.replace(/^\/api/, '');
  return stripped.length > 0 ? stripped : '/';
}

function forbiddenResponse(message = 'You do not have permission to perform this action'): Response {
  return Response.json({ ok: false, error: { code: 'FORBIDDEN', message } }, { status: 403 });
}

async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function parseId(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * API keys (`Authorization: Bearer rxk_...`) act as their creator within the key's organization,
 * limited to the role recorded on the key.
 */
async function authenticateApiKey(req: Request): Promise<UserTokenPayload | null> {
  const header = req.headers.get('authorization');
  const m = header ? /^Bearer\s+(rxk_\S+)$/.exec(header) : null;
  if (!m?.[1]) return null;
  const key = await db.orm.public.ApiKey.where({ keyHash: sha256(m[1]) }).first();
  if (!key || key.revokedAt || (key.expiresAt && Date.parse(key.expiresAt) < Date.now())) return null;
  const user = await db.orm.public.User.where({ id: key.userId }).first();
  if (!user) return null;
  if (!key.lastUsedAt || Date.now() - Date.parse(key.lastUsedAt) > 60_000) {
    await db.orm.public.ApiKey.where({ id: key.id }).update({ lastUsedAt: new Date().toISOString() });
  }
  return { userId: user.id, email: user.email, role: key.role, companyId: key.companyId, orgId: key.organizationId };
}

/**
 * Dashboard API router. Every route requires a valid access token and is
 * automatically scoped to the caller's companyId via the handlers.
 */
export async function dashboardRouter(req: Request): Promise<Response> {
  const { pathname, searchParams } = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = normalizePath(pathname);
  const segments = path.split('/').filter(Boolean);

  const auth = authenticate(req) ?? (await authenticateApiKey(req));
  if (!auth) return unauthorizedResponse();
  await rememberOrgForCompany(auth.companyId, auth.orgId).catch(() => undefined);

  const isWrite = method !== 'GET' && method !== 'HEAD';
  const need = (permission: Permission): Response | null => (can(auth.role, permission) ? null : forbiddenResponse());

  // Deny by default: unknown roles get nothing, not even reads.
  const baseDenied = need('org:read');
  if (baseDenied) return baseDenied;

  // Platform modules (each checks its own permissions; errors use the standard envelope).
  let bodyCache: Promise<unknown> | null = null;
  const readBody = () => (bodyCache ??= readJson(req));
  const ctx = buildContext(auth, req, segments, searchParams, readBody);
  const moduleResponse = await runModules(ctx, [agileRoutes, incidentRoutes, opsRoutes, collabRoutes, integrationRoutes, analyticsRoutes]);
  if (moduleResponse) return moduleResponse;

  // Organization, members, invitations, audit log (own permission checks).
  const orgResponse = await orgRoutes(
    auth,
    method,
    segments,
    searchParams,
    readBody,
    req.headers.get('x-request-id'),
  );
  if (orgResponse) return orgResponse;

  // Projects, workflow, tickets, comments (own permission checks).
  const workResponse = await workRoutes(
    auth,
    method,
    segments,
    searchParams,
    readBody,
    req.headers.get('x-request-id'),
  );
  if (workResponse) return workResponse;

  // Permission for the legacy dashboard routes, derived from the resource and verb.
  const resource = segments[0];
  const sub = segments[2];
  let required: Permission | null = null;
  if (resource === 'services' && sub === 'webhook-keys') required = isWrite ? 'webhook_keys:manage' : 'services:read';
  else if (resource === 'services') required = isWrite ? 'services:manage' : 'services:read';
  else if (resource === 'incidents') required = isWrite ? 'incidents:respond' : 'incidents:read';
  else if (resource === 'metrics' || resource === 'alerts') required = isWrite ? 'incidents:respond' : 'incidents:read';
  else if (resource === 'escalation-policies' || resource === 'maintenance-windows') {
    required = isWrite ? 'services:manage' : 'incidents:read';
  }
  if (required) {
    const denied = need(required);
    if (denied) return denied;
  }

  // GET /metrics
  if (path === '/metrics' && method === 'GET') {
    return getMetrics(auth.companyId);
  }

  // /escalation-policies[/id]
  if (segments[0] === 'escalation-policies') {
    if (segments.length === 1 && method === 'GET') return listEscalationPolicies(auth.companyId);
    if (segments.length === 1 && method === 'POST') {
      return createEscalationPolicy(auth.companyId, await readBody());
    }
    if (segments.length === 2) {
      const id = parseId(segments[1]);
      if (id === null) return badRequestResponse('Invalid escalation policy id');
      if (method === 'PATCH') return updateEscalationPolicy(auth.companyId, id, await readBody());
      if (method === 'DELETE') return deleteEscalationPolicy(auth.companyId, id);
    }
  }

  // /maintenance-windows[/id]
  if (segments[0] === 'maintenance-windows') {
    if (segments.length === 1 && method === 'GET') return listMaintenanceWindows(auth.companyId);
    if (segments.length === 1 && method === 'POST') {
      return createMaintenanceWindow(auth.companyId, auth.userId, await readBody());
    }
    if (segments.length === 2) {
      const id = parseId(segments[1]);
      if (id === null) return badRequestResponse('Invalid maintenance window id');
      if (method === 'PATCH') return updateMaintenanceWindow(auth.companyId, id, await readBody());
      if (method === 'DELETE') return deleteMaintenanceWindow(auth.companyId, id);
    }
  }

  // /services/:id/webhook-keys[/:keyId]
  if (segments[0] === 'services' && segments[2] === 'webhook-keys') {
    const serviceId = parseId(segments[1]);
    if (serviceId === null) return badRequestResponse('Invalid service id');
    if (segments.length === 3 && method === 'GET') return listServiceWebhookKeys(auth.companyId, serviceId);
    if (segments.length === 3 && method === 'POST') {
      return createServiceWebhookKey(auth.companyId, serviceId, auth.userId, await readBody());
    }
    if (segments.length === 4 && method === 'DELETE') {
      const keyId = parseId(segments[3]);
      if (keyId === null) return badRequestResponse('Invalid key id');
      return revokeServiceWebhookKey(auth.companyId, serviceId, keyId);
    }
  }

  // /services[/...]
  if (segments[0] === 'services') {
    if (segments.length === 1) {
      if (method === 'GET') return listServices(auth.companyId, searchParams);
      if (method === 'POST') return createService(await readBody(), auth.companyId);
    }
    if (segments.length === 2) {
      const id = parseId(segments[1]);
      if (id === null) return badRequestResponse('Invalid service id');
      if (method === 'GET') return getService(auth.companyId, id);
      if (method === 'PATCH') return updateService(auth.companyId, id, await readBody());
      if (method === 'DELETE') return deleteService(auth.companyId, id);
    }
  }

  // /incidents[/...]
  if (segments[0] === 'incidents') {
    if (segments.length === 1 && method === 'GET') {
      return listIncidents(auth.companyId, searchParams);
    }
    if (segments.length === 2 && method === 'GET') {
      const id = parseId(segments[1]);
      if (id === null) return badRequestResponse('Invalid incident id');
      return getIncident(auth.companyId, id);
    }
    if (segments.length === 3 && method === 'POST') {
      const id = parseId(segments[1]);
      if (id === null) return badRequestResponse('Invalid incident id');
      const action = segments[2];
      const body = await readBody();
      if (action === 'acknowledge') return acknowledgeIncident(auth.companyId, id, auth.userId, body);
      if (action === 'resolve') return resolveIncident(auth.companyId, id, auth.userId, body);
      if (action === 'comments') return commentIncident(auth.companyId, id, auth.userId, body);
    }
  }

  // GET /alerts
  if (path === '/alerts' && method === 'GET') {
    return listAlerts(auth.companyId, searchParams);
  }

  return notFoundResponse(`Route ${method} ${pathname} not found`);
}

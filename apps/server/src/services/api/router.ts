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
 * Dashboard API router. Every route requires a valid access token and is
 * automatically scoped to the caller's companyId via the handlers.
 */
export async function dashboardRouter(req: Request): Promise<Response> {
  const { pathname, searchParams } = new URL(req.url);
  const method = req.method.toUpperCase();
  const path = normalizePath(pathname);
  const segments = path.split('/').filter(Boolean);

  const auth = authenticate(req);
  if (!auth) return unauthorizedResponse();

  const isWrite = method !== 'GET' && method !== 'HEAD';
  const need = (permission: Permission): Response | null => (can(auth.role, permission) ? null : forbiddenResponse());

  // Deny by default: unknown roles get nothing, not even reads.
  const baseDenied = need('org:read');
  if (baseDenied) return baseDenied;

  // Organization, members, invitations, audit log (own permission checks).
  const orgResponse = await orgRoutes(
    auth,
    method,
    segments,
    searchParams,
    () => readJson(req),
    req.headers.get('x-request-id'),
  );
  if (orgResponse) return orgResponse;

  // Projects, workflow, tickets, comments (own permission checks).
  const workResponse = await workRoutes(
    auth,
    method,
    segments,
    searchParams,
    () => readJson(req),
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
  if (required) {
    const denied = need(required);
    if (denied) return denied;
  }

  // GET /metrics
  if (path === '/metrics' && method === 'GET') {
    return getMetrics(auth.companyId);
  }

  // /services/:id/webhook-keys[/:keyId]
  if (segments[0] === 'services' && segments[2] === 'webhook-keys') {
    const serviceId = parseId(segments[1]);
    if (serviceId === null) return badRequestResponse('Invalid service id');
    if (segments.length === 3 && method === 'GET') return listServiceWebhookKeys(auth.companyId, serviceId);
    if (segments.length === 3 && method === 'POST') {
      return createServiceWebhookKey(auth.companyId, serviceId, auth.userId, await readJson(req));
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
      if (method === 'POST') return createService(await readJson(req), auth.companyId);
    }
    if (segments.length === 2) {
      const id = parseId(segments[1]);
      if (id === null) return badRequestResponse('Invalid service id');
      if (method === 'GET') return getService(auth.companyId, id);
      if (method === 'PATCH') return updateService(auth.companyId, id, await readJson(req));
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
      const body = await readJson(req);
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

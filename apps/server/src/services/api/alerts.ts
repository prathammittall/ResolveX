import { db } from '../../prisma/db.js';
import { serverErrorResponse } from './auth.js';

/**
 * GET /api/alerts?serviceId=&status=
 *
 * AlertEvent has no companyId column, so we scope via the caller's services.
 * An optional `serviceId` filter further narrows the result set.
 */
export async function listAlerts(
  companyId: number,
  searchParams: URLSearchParams,
): Promise<Response> {
  try {
    const services = await db.orm.public.Service.where({ companyId }).all();
    const serviceName = new Map(services.map((s) => [s.id, s.name]));

    const serviceIdFilter = searchParams.get('serviceId');
    const statusFilter = searchParams.get('status');

    // Determine which service ids to query.
    let targetServiceIds = services.map((s) => s.id);
    if (serviceIdFilter) {
      const sid = Number(serviceIdFilter);
      if (!Number.isInteger(sid) || !targetServiceIds.includes(sid)) {
        return Response.json({ ok: true, alerts: [] });
      }
      targetServiceIds = [sid];
    }

    const batches = await Promise.all(
      targetServiceIds.map((sid) => db.orm.public.AlertEvent.where({ serviceId: sid }).all()),
    );
    let alerts = batches.flat();

    if (statusFilter) {
      alerts = alerts.filter((a) => a.processingStatus === statusFilter);
    }

    alerts.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

    const data = alerts.map((a) => ({
      id: a.id,
      serviceId: a.serviceId,
      serviceName: serviceName.get(a.serviceId) ?? 'Unknown',
      incidentId: a.incidentId,
      provider: a.provider,
      providerEventId: a.providerEventId,
      processingStatus: a.processingStatus,
      receivedAt: a.receivedAt,
    }));

    return Response.json({ ok: true, alerts: data });
  } catch (err) {
    console.error('[api/alerts] list error:', err);
    return serverErrorResponse();
  }
}

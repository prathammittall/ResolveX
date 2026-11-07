import { db } from '../../prisma/db.js';
import { serverErrorResponse } from './auth.js';

/**
 * GET /api/metrics — aggregate overview stats for the authenticated user's company.
 *
 * Counts are computed server-side and scoped to the caller's companyId so a
 * viewer never sees another tenant's data.
 */
export async function getMetrics(companyId: number): Promise<Response> {
  try {
    const services = await db.orm.public.Service.where({ companyId }).all();
    const incidents = await db.orm.public.Incident.where({ companyId }).all();

    // AlertEvent has no companyId column — scope via the company's services.
    const serviceIds = services.map((s) => s.id);
    const alertBatches = await Promise.all(
      serviceIds.map((id) => db.orm.public.AlertEvent.where({ serviceId: id }).all()),
    );
    const alerts = alertBatches.flat();

    const activeIncidents = incidents.filter((i) => i.status !== 'resolved');

    const metrics = {
      services: {
        total: services.length,
        healthy: services.filter((s) => s.healthStatus === 'healthy').length,
        degraded: services.filter((s) => s.healthStatus === 'degraded').length,
        down: services.filter((s) => s.healthStatus === 'down').length,
        unknown: services.filter((s) => s.healthStatus === 'unknown').length,
      },
      incidents: {
        total: incidents.length,
        active: activeIncidents.length,
        open: incidents.filter((i) => i.status === 'open').length,
        acknowledged: incidents.filter((i) => i.status === 'acknowledged').length,
        investigating: incidents.filter((i) => i.status === 'investigating').length,
        mitigated: incidents.filter((i) => i.status === 'mitigated').length,
        resolved: incidents.filter((i) => i.status === 'resolved').length,
      },
      severity: {
        sev1: activeIncidents.filter((i) => i.severity === 'sev1').length,
        sev2: activeIncidents.filter((i) => i.severity === 'sev2').length,
        sev3: activeIncidents.filter((i) => i.severity === 'sev3').length,
        sev4: activeIncidents.filter((i) => i.severity === 'sev4').length,
      },
      alerts: {
        total: alerts.length,
        processed: alerts.filter((a) => a.processingStatus === 'processed').length,
        pending: alerts.filter((a) => a.processingStatus === 'pending').length,
        failed: alerts.filter((a) => a.processingStatus === 'failed').length,
        ignored: alerts.filter((a) => a.processingStatus === 'ignored').length,
      },
    };

    return Response.json({ ok: true, metrics });
  } catch (err) {
    console.error('[api/metrics] error:', err);
    return serverErrorResponse();
  }
}

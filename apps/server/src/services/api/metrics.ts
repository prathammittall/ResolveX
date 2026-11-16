import { db } from '../../prisma/db.js';
import { serverErrorResponse } from './auth.js';


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
    const [escalationBatches, queueJobs, deliveries] = await Promise.all([
      Promise.all(incidents.map((incident) => db.orm.public.IncidentEscalation.where({ incidentId: incident.id }).all())),
      db.orm.public.QueueJob.where({ companyId }).all(),
      db.orm.public.NotificationDelivery.where({ companyId }).all(),
    ]);

    const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
    const companyEscalations = escalationBatches.flat();
    const acknowledgedIncidents = incidents.filter((incident) => incident.firstAcknowledgedAt && incident.mttaSeconds != null);
    const averageMttaSeconds =
      acknowledgedIncidents.length > 0
        ? Math.round(
            acknowledgedIncidents.reduce((total, incident) => total + (incident.mttaSeconds ?? 0), 0) /
              acknowledgedIncidents.length,
          )
        : null;
    const averageMttaBySeverity = (severity: string) => {
      const matched = acknowledgedIncidents.filter((incident) => incident.severity === severity);
      return matched.length > 0
        ? Math.round(matched.reduce((total, incident) => total + (incident.mttaSeconds ?? 0), 0) / matched.length)
        : null;
    };

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
      mtta: {
        averageSeconds: averageMttaSeconds,
        acknowledgedIncidents: acknowledgedIncidents.length,
        sev1Seconds: averageMttaBySeverity('sev1'),
        sev2Seconds: averageMttaBySeverity('sev2'),
        sev3Seconds: averageMttaBySeverity('sev3'),
        sev4Seconds: averageMttaBySeverity('sev4'),
      },
      escalation: {
        active: companyEscalations.filter((escalation) => escalation.status === 'active').length,
        acknowledged: companyEscalations.filter((escalation) => escalation.status === 'acknowledged').length,
        exhausted: companyEscalations.filter((escalation) => escalation.status === 'exhausted').length,
        cancelled: companyEscalations.filter((escalation) => escalation.status === 'cancelled').length,
        unacknowledgedActiveIncidents: activeIncidents.filter((incident) => !incident.acknowledgedAt).length,
      },
      queue: {
        pending: queueJobs.filter((job) => job.status === 'pending').length,
        processing: queueJobs.filter((job) => job.status === 'processing').length,
        failed: queueJobs.filter((job) => job.status === 'failed').length,
      },
      notifications: {
        delivered: deliveries.filter((delivery) => delivery.status === 'delivered').length,
        failed: deliveries.filter((delivery) => delivery.status === 'failed').length,
        pending: deliveries.filter((delivery) => delivery.status === 'pending').length,
      },
    };

    return Response.json({ ok: true, metrics });
  } catch (err) {
    console.error('[api/metrics] error:', err);
    return serverErrorResponse();
  }
}

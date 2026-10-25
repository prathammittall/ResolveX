export type AlertEventType = 'firing' | 'recovery';

export type IncidentSeverityValue = 'sev1' | 'sev2' | 'sev3' | 'sev4';

export type AlertWebhookPayload = {
  eventId: string;
  serviceId: number;
  severity: IncidentSeverityValue;
  message: string;
  eventType: AlertEventType;
  occurredAt?: string;
};

export type AlertProcessOutcome =
  | 'incident_created'
  | 'incident_updated'
  | 'recovery_recorded'
  | 'already_processed';

export type AlertProcessResult = {
  ok: true;
  duplicate: boolean;
  outcome: AlertProcessOutcome;
  alertEventId: number;
  incidentId: number | null;
  serviceId: number;
  companyId: number;
};

export type AlertErrorBody = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/** Stable provider name for the alerts webhook ingestion path. */
export const ALERT_WEBHOOK_PROVIDER = 'alerts-webhook';

/** Maximum accepted alert message length (characters). */
export const MAX_ALERT_MESSAGE_LENGTH = 4000;

/**
 * Recovery never auto-resolves incidents in v1.
 * Service health reflects monitoring; Incident.status is the responder workflow.
 */
export const AUTO_RESOLVE_ON_RECOVERY = false;

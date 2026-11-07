/**
 * Webhook authentication is per-service and database-backed; see `webhook-keys.ts`.
 *
 * A request must present `Authorization: Bearer rxwh_...`. The key identifies exactly one service of
 * one company, so ownership is never taken from the request body and a leaked key cannot affect other
 * services or tenants. Replays are harmless: every alert carries an `eventId` that is deduplicated by
 * a database unique constraint, so re-sending a captured request is a no-op.
 */
export type WebhookAuthHeaders = {
  authorization?: string | null;
};

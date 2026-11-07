import { withTenant, type TenantTx } from '../../prisma/tenant.js';

export type AuditEntry = {
  organizationId: string;
  actorId: number | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
};

/** Metadata keys that must never be persisted, whatever a caller passes. */
const REDACTED = /token|secret|password|hash|authorization|cookie/i;

function sanitize(metadata: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!metadata) return null;
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !REDACTED.test(key)));
}

/** Write an audit row inside the caller's transaction so the log and the action commit (or roll back) together. */
export async function recordAudit(tx: TenantTx, entry: AuditEntry): Promise<void> {
  await tx.orm.public.AuditLog.create({
    organizationId: entry.organizationId,
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    metadata: sanitize(entry.metadata) as never,
    requestId: entry.requestId ?? null,
  });
}

export type AuditLogView = {
  id: string;
  actorId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  requestId: string | null;
  createdAt: string;
};

/** Newest first, bounded, keyset-paginated by `before` (the createdAt of the last row of the previous page). */
export async function listAuditLogs(
  organizationId: string,
  options: { limit?: number; before?: string } = {},
): Promise<{ logs: AuditLogView[]; nextBefore: string | null }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const before = options.before;
  const rows = await withTenant(organizationId, async (tx) => {
    // Explicit organizationId filter: correctness must not depend on RLS alone (a BYPASSRLS role skips it).
    const scoped = tx.orm.public.AuditLog.where({ organizationId });
    const base = before ? scoped.where((a) => a.createdAt.lt(before as never)) : scoped;
    return await base
      .orderBy((a) => a.createdAt.desc())
      .limit(limit + 1)
      .all();
  });
  const page = rows.slice(0, limit);
  return {
    logs: page.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      metadata: r.metadata,
      requestId: r.requestId,
      createdAt: r.createdAt,
    })),
    nextBefore: rows.length > limit ? (page[page.length - 1]?.createdAt ?? null) : null,
  };
}

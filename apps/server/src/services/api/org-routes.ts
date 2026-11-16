import { z } from 'zod';
import {
  acceptInvitation,
  can,
  changeMemberRole,
  createInvitation,
  getOrganization,
  isOrgError,
  isRole,
  listAuditLogs,
  listInvitations,
  listMemberships,
  listMembers,
  removeMember,
  revokeInvitation,
  type Actor,
  type Permission,
  type Role,
} from '../org/index.js';
import type { UserTokenPayload } from '../auth/model.js';

const roleSchema = z.enum(['owner', 'admin', 'responder', 'member', 'viewer']);
const inviteSchema = z.object({ email: z.string().trim().toLowerCase().email().max(255), role: roleSchema }).strict();
const roleChangeSchema = z.object({ role: roleSchema }).strict();
const acceptSchema = z.object({ token: z.string().min(1).max(200) }).strict();

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (code: string, message: string, status: number, details?: unknown) =>
  json({ ok: false, error: { code, message, details } }, status);

function parseUserId(value: string | undefined): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): { data: z.infer<S> } | { error: Response } {
  const parsed = schema.safeParse(body);
  return parsed.success
    ? { data: parsed.data }
    : { error: fail('VALIDATION_ERROR', 'Invalid request', 400, parsed.error.flatten()) };
}

/**
 * Organization, member, invitation and audit-log routes. Returns `null` when the path is not one of
 * these so the caller can keep routing. Every route checks the permission matrix first.
 */
export async function orgRoutes(
  auth: UserTokenPayload,
  method: string,
  segments: string[],
  searchParams: URLSearchParams,
  readJson: () => Promise<unknown>,
  requestId: string | null,
): Promise<Response | null> {
  const require = (permission: Permission): Response | null =>
    can(auth.role, permission) ? null : fail('FORBIDDEN', 'You do not have permission to perform this action', 403);

  const role: Role = isRole(auth.role) ? auth.role : 'viewer';
  const actor: Actor = { userId: auth.userId, orgId: auth.orgId, role, requestId };

  try {
    // GET /organizations — every organization the caller belongs to (for the switcher).
    if (segments[0] === 'organizations' && segments.length === 1 && method === 'GET') {
      const memberships = await listMemberships(auth.userId);
      return json({
        ok: true,
        organizations: memberships.map((m) => ({
          id: m.organizationId,
          name: m.organizationName,
          role: m.role,
          current: m.organizationId === auth.orgId,
        })),
      });
    }

    // POST /invitations/accept — any signed-in user may redeem an invitation addressed to their email.
    if (segments[0] === 'invitations' && segments[1] === 'accept' && method === 'POST') {
      const parsed = parseBody(acceptSchema, await readJson());
      if ('error' in parsed) return parsed.error;
      const result = await acceptInvitation({ id: auth.userId, email: auth.email }, parsed.data.token, requestId);
      return json({ ok: true, ...result });
    }

    if (segments[0] === 'audit-logs' && segments.length === 1 && method === 'GET') {
      const denied = require('audit:read');
      if (denied) return denied;
      const limit = Number(searchParams.get('limit') ?? 50);
      const before = searchParams.get('before') ?? undefined;
      if (before && Number.isNaN(Date.parse(before))) return fail('VALIDATION_ERROR', 'Invalid before cursor', 400);
      return json({ ok: true, ...(await listAuditLogs(auth.orgId, { limit: Number.isFinite(limit) ? limit : 50, before })) });
    }

    if (segments[0] !== 'org') return null;

    // GET /org
    if (segments.length === 1 && method === 'GET') {
      const denied = require('org:read');
      if (denied) return denied;
      return json({ ok: true, organization: await getOrganization(auth.orgId), role });
    }

    // /org/members[/:userId]
    if (segments[1] === 'members') {
      if (segments.length === 2 && method === 'GET') {
        const denied = require('members:read');
        if (denied) return denied;
        return json({ ok: true, members: await listMembers(auth.orgId) });
      }
      const userId = parseUserId(segments[2]);
      if (segments.length === 3 && userId !== null) {
        if (method === 'PATCH') {
          const denied = require('members:update');
          if (denied) return denied;
          const parsed = parseBody(roleChangeSchema, await readJson());
          if ('error' in parsed) return parsed.error;
          await changeMemberRole(actor, userId, parsed.data.role);
          return json({ ok: true });
        }
        if (method === 'DELETE') {
          // Anyone may leave; removing someone else needs members:remove.
          if (userId !== auth.userId) {
            const denied = require('members:remove');
            if (denied) return denied;
          }
          await removeMember(actor, userId);
          return json({ ok: true });
        }
      }
    }

    // /org/invitations[/:id]
    if (segments[1] === 'invitations') {
      if (segments.length === 2 && method === 'GET') {
        const denied = require('members:invite');
        if (denied) return denied;
        return json({ ok: true, invitations: await listInvitations(auth.orgId) });
      }
      if (segments.length === 2 && method === 'POST') {
        const denied = require('members:invite');
        if (denied) return denied;
        const parsed = parseBody(inviteSchema, await readJson());
        if ('error' in parsed) return parsed.error;
        const created = await createInvitation(actor, parsed.data);
        // The token is shown exactly once, here.
        return json({ ok: true, invitation: created.invitation, token: created.token, emailSent: created.emailSent }, 201);
      }
      if (segments.length === 3 && method === 'DELETE') {
        const denied = require('members:invite');
        if (denied) return denied;
        await revokeInvitation(actor, segments[2] ?? '');
        return json({ ok: true });
      }
    }

    return null;
  } catch (error) {
    if (isOrgError(error)) return fail(error.code, error.message, error.status, error.details);
    console.error('[api/org] error:', error instanceof Error ? error.message : 'unknown');
    return fail('INTERNAL', 'Internal server error', 500);
  }
}

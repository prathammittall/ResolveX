import { createHash, randomBytes } from 'node:crypto';
import { db } from '../../prisma/db.js';
import { applyContext, withContext, withTenant } from '../../prisma/tenant.js';
import { isUniqueViolation } from '../incident-engine/errors.js';
import { recordAudit } from './audit.js';
import { OrgError } from './errors.js';
import type { Actor } from './members.js';
import { canAssignRole, isRole, type Role } from './permissions.js';

const TOKEN_PREFIX = 'rxinv_';
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const hashInvitationToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export type InvitationView = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
};

function toView(row: {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}): InvitationView {
  const status = row.acceptedAt
    ? 'accepted'
    : row.revokedAt
      ? 'revoked'
      : Date.parse(row.expiresAt) <= Date.now()
        ? 'expired'
        : 'pending';
  return {
    id: row.id,
    email: row.email,
    role: isRole(row.role) ? row.role : 'member',
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    status,
  };
}

/**
 * Create an invitation. The secret token is returned once; only its hash is stored. (Delivering it by
 * email is the Integrations phase; until then the inviter shares the link themselves.)
 */
export async function createInvitation(
  actor: Actor,
  input: { email: string; role: Role },
): Promise<{ invitation: InvitationView; token: string }> {
  const email = input.email.trim().toLowerCase();
  if (!canAssignRole(actor.role, input.role)) {
    throw new OrgError('FORBIDDEN', 'You cannot invite someone with that role', 403);
  }

  const existingUser = await db.orm.public.User.where({ email }).first();
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString();

  try {
    return await withTenant(actor.orgId, async (tx) => {
      if (existingUser) {
        const already = await tx.orm.public.Membership.where({ organizationId: actor.orgId, userId: existingUser.id }).first();
        if (already) throw new OrgError('CONFLICT', 'That person is already a member', 409);
      }
      const row = await tx.orm.public.Invitation.create({
        organizationId: actor.orgId,
        email,
        role: input.role,
        tokenHash: hashInvitationToken(token),
        invitedById: actor.userId,
        expiresAt,
      });
      await recordAudit(tx, {
        organizationId: actor.orgId,
        actorId: actor.userId,
        action: 'invitation.created',
        entityType: 'invitation',
        entityId: row.id,
        metadata: { email, role: input.role },
        requestId: actor.requestId,
      });
      return { invitation: toView(row), token };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new OrgError('CONFLICT', 'A pending invitation for that email already exists', 409);
    }
    throw error;
  }
}

export async function listInvitations(orgId: string): Promise<InvitationView[]> {
  const rows = await withTenant(orgId, async (tx) => await tx.orm.public.Invitation.where({ organizationId: orgId }).all());
  return rows.map(toView).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function revokeInvitation(actor: Actor, invitationId: string): Promise<void> {
  await withTenant(actor.orgId, async (tx) => {
    const row = await tx.orm.public.Invitation.where({ id: invitationId, organizationId: actor.orgId }).forUpdate().first();
    if (!row) throw new OrgError('NOT_FOUND', 'Invitation not found', 404);
    if (row.acceptedAt) throw new OrgError('CONFLICT', 'Invitation was already accepted', 409);
    if (!row.revokedAt) {
      await tx.orm.public.Invitation.where({ id: row.id }).update({ revokedAt: new Date().toISOString() });
      await recordAudit(tx, {
        organizationId: actor.orgId,
        actorId: actor.userId,
        action: 'invitation.revoked',
        entityType: 'invitation',
        entityId: row.id,
        metadata: { email: row.email },
        requestId: actor.requestId,
      });
    }
  });
}

/**
 * Accept an invitation as an authenticated user. Every failure mode returns the same error so a
 * token holder learns nothing about invitations they cannot use. The invitation is bound to an
 * email: a leaked token is useless to anyone signed in as a different address.
 */
export async function acceptInvitation(
  user: { id: number; email: string },
  token: string,
  requestId?: string | null,
): Promise<{ organizationId: string; role: Role }> {
  const invalid = () => new OrgError('INVALID_INVITATION', 'This invitation is invalid or has expired', 400);
  if (!token.startsWith(TOKEN_PREFIX) || token.length > 200) throw invalid();
  const tokenHash = hashInvitationToken(token);

  return withContext({ inviteHash: tokenHash }, async (tx) => {
    // The by-token policy grants SELECT only, so this first read cannot take a row lock.
    const found = await tx.orm.public.Invitation.where({ tokenHash }).first();
    if (!found) throw invalid();

    // The organization is known now: switch the context to it, then re-read the invitation under a
    // lock so two concurrent acceptances cannot both succeed.
    await applyContext(tx, { orgId: found.organizationId, userId: user.id });
    const invitation = await tx.orm.public.Invitation.where({ id: found.id }).forUpdate().first();
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      Date.parse(invitation.expiresAt) <= Date.now() ||
      invitation.email !== user.email.trim().toLowerCase() ||
      !isRole(invitation.role)
    ) {
      throw invalid();
    }

    const existing = await tx.orm.public.Membership.where({
      organizationId: invitation.organizationId,
      userId: user.id,
    }).first();
    if (existing) throw new OrgError('CONFLICT', 'You are already a member of this organization', 409);

    await tx.orm.public.Membership.create({
      organizationId: invitation.organizationId,
      userId: user.id,
      role: invitation.role,
    });
    await tx.orm.public.Invitation.where({ id: invitation.id }).update({ acceptedAt: new Date().toISOString() });
    await recordAudit(tx, {
      organizationId: invitation.organizationId,
      actorId: user.id,
      action: 'invitation.accepted',
      entityType: 'invitation',
      entityId: invitation.id,
      metadata: { role: invitation.role },
      requestId,
    });
    return { organizationId: invitation.organizationId, role: invitation.role };
  });
}

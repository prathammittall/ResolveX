import { db } from '../../prisma/db.js';
import { withTenant, type TenantTx } from '../../prisma/tenant.js';
import { recordAudit } from './audit.js';
import { OrgError } from './errors.js';
import { canAssignRole, isRole, type Role } from './permissions.js';

export type Actor = { userId: number; orgId: string; role: Role; requestId?: string | null };

export type MemberView = {
  userId: number;
  email: string;
  name: string | null;
  role: Role;
  joinedAt: string;
};

export async function getOrganization(orgId: string) {
  const org = await withTenant(orgId, (tx) => tx.orm.public.Organization.where({ id: orgId }).first());
  if (!org) throw new OrgError('NOT_FOUND', 'Organization not found', 404);
  return { id: org.id, name: org.name, slug: org.slug, createdAt: org.createdAt };
}

export async function listMembers(orgId: string): Promise<MemberView[]> {
  const memberships = await withTenant(orgId, async (tx) => await tx.orm.public.Membership.where({ organizationId: orgId }).all());
  const members: MemberView[] = [];
  for (const m of memberships) {
    if (!isRole(m.role)) continue;
    const user = await db.orm.public.User.where({ id: m.userId }).first();
    if (user) members.push({ userId: user.id, email: user.email, name: user.name, role: m.role, joinedAt: m.createdAt });
  }
  return members.sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

/** Count owners so the organization can never be left without one. */
async function ownerCount(tx: TenantTx, organizationId: string): Promise<number> {
  const owners = await tx.orm.public.Membership.where({ organizationId, role: 'owner' }).all();
  return owners.length;
}

export async function changeMemberRole(actor: Actor, targetUserId: number, newRole: Role): Promise<void> {
  await withTenant(actor.orgId, async (tx) => {
    const target = await tx.orm.public.Membership.where({ organizationId: actor.orgId, userId: targetUserId }).forUpdate().first();
    if (!target || !isRole(target.role)) throw new OrgError('NOT_FOUND', 'Member not found', 404);
    // Both the new role and the member's current role must be ones the actor may touch.
    if (!canAssignRole(actor.role, newRole) || !canAssignRole(actor.role, target.role)) {
      throw new OrgError('FORBIDDEN', 'You cannot assign or change that role', 403);
    }
    if (target.role === 'owner' && newRole !== 'owner' && (await ownerCount(tx, actor.orgId)) <= 1) {
      throw new OrgError('LAST_OWNER', 'An organization must keep at least one owner', 409);
    }
    if (target.role === newRole) return;
    await tx.orm.public.Membership.where({ id: target.id }).update({ role: newRole });
    await recordAudit(tx, {
      organizationId: actor.orgId,
      actorId: actor.userId,
      action: 'member.role_changed',
      entityType: 'user',
      entityId: String(targetUserId),
      metadata: { from: target.role, to: newRole },
      requestId: actor.requestId,
    });
  });
}

export async function removeMember(actor: Actor, targetUserId: number): Promise<void> {
  await withTenant(actor.orgId, async (tx) => {
    const target = await tx.orm.public.Membership.where({ organizationId: actor.orgId, userId: targetUserId }).forUpdate().first();
    if (!target || !isRole(target.role)) throw new OrgError('NOT_FOUND', 'Member not found', 404);
    if (targetUserId !== actor.userId && !canAssignRole(actor.role, target.role)) {
      throw new OrgError('FORBIDDEN', 'You cannot remove that member', 403);
    }
    if (target.role === 'owner' && (await ownerCount(tx, actor.orgId)) <= 1) {
      throw new OrgError('LAST_OWNER', 'An organization must keep at least one owner', 409);
    }
    await tx.orm.public.Membership.where({ id: target.id }).delete();
    await recordAudit(tx, {
      organizationId: actor.orgId,
      actorId: actor.userId,
      action: 'member.removed',
      entityType: 'user',
      entityId: String(targetUserId),
      metadata: { role: target.role },
      requestId: actor.requestId,
    });
  });
}

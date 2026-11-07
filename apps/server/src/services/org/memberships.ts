import { randomBytes, randomUUID } from 'node:crypto';
import { db } from '../../prisma/db.js';
import { applyContext, withContext, type TenantTx } from '../../prisma/tenant.js';
import { isRole, type Role } from './permissions.js';

export type OrgMembership = { organizationId: string; organizationName: string; role: Role };

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'org'}-${randomBytes(3).toString('hex')}`;
}

/**
 * Create an organization with `userId` as its owner. Runs inside the caller's transaction; sets the
 * tenant context to the new organization so the row-level-security WITH CHECK clauses pass.
 */
export async function createOrganizationWithOwner(
  tx: TenantTx,
  args: { userId: number; companyId: number | null; name: string; role?: Role },
): Promise<string> {
  const organizationId = randomUUID();
  await applyContext(tx, { orgId: organizationId });
  await tx.orm.public.Organization.create({
    id: organizationId,
    name: args.name,
    slug: slugify(args.name),
    companyId: args.companyId,
  });
  await tx.orm.public.Membership.create({
    organizationId,
    userId: args.userId,
    role: args.role ?? 'owner',
  });
  return organizationId;
}

/**
 * Which organization (and role in it) a user is acting in. Users with several memberships get the
 * organization matching their legacy company first, otherwise the oldest membership. A user that
 * predates the tenancy tables and has no membership is provisioned one from their legacy company.
 */
export async function resolveMembership(
  user: { id: number; companyId: number; role: string },
  preferredOrgId?: string,
): Promise<OrgMembership> {
  const found = await withContext({ userId: user.id }, async (tx) => {
    const memberships = await tx.orm.public.Membership.where({ userId: user.id }).all();
    const rows: Array<OrgMembership & { companyId: number | null; createdAt: string }> = [];
    for (const m of memberships) {
      const org = await tx.orm.public.Organization.where({ id: m.organizationId }).first();
      if (org && isRole(m.role)) {
        rows.push({
          organizationId: org.id,
          organizationName: org.name,
          role: m.role,
          companyId: org.companyId,
          createdAt: m.createdAt,
        });
      }
    }
    return rows;
  });

  const preferred =
    (preferredOrgId ? found.find((m) => m.organizationId === preferredOrgId) : undefined) ??
    found.find((m) => m.companyId === user.companyId) ??
    [...found].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (preferred) {
    return { organizationId: preferred.organizationId, organizationName: preferred.organizationName, role: preferred.role };
  }
  return provisionMembership(user);
}

async function provisionMembership(user: { id: number; companyId: number; role: string }): Promise<OrgMembership> {
  const role: Role = isRole(user.role) ? user.role : 'member';
  return db.transaction(async (tx) => {
    const company = await tx.orm.public.Company.where({ id: user.companyId }).first();
    const name = company?.name ?? 'Workspace';
    const organizationId = await createOrganizationWithOwner(tx, {
      userId: user.id,
      companyId: user.companyId,
      name,
      role,
    });
    return { organizationId, organizationName: name, role };
  });
}

/** Every organization the user belongs to, for the organization switcher. */
export async function listMemberships(userId: number): Promise<OrgMembership[]> {
  return withContext({ userId }, async (tx) => {
    const memberships = await tx.orm.public.Membership.where({ userId }).all();
    const result: Array<OrgMembership & { createdAt: string }> = [];
    for (const m of memberships) {
      const org = await tx.orm.public.Organization.where({ id: m.organizationId }).first();
      if (org && isRole(m.role)) {
        result.push({ organizationId: org.id, organizationName: org.name, role: m.role, createdAt: m.createdAt });
      }
    }
    return result
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(({ organizationId, organizationName, role }) => ({ organizationId, organizationName, role }));
  });
}

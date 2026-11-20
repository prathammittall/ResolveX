import { db } from '../prisma/db.js';

const cache = new Map<number, string>();

/**
 * Organization id for a legacy integer companyId. Background workers only know companyId but must enter
 * the organization's RLS context to touch work tables (projects, tasks) or memberships.
 */
export async function orgIdForCompany(companyId: number): Promise<string | null> {
  const hit = cache.get(companyId);
  if (hit) return hit;
  const company = await db.orm.public.Company.where({ id: companyId }).first();
  let orgId = company?.organizationId ?? null;
  if (!orgId) {
    // Works where RLS is not enforced for the connecting role (e.g. migration-time owner); otherwise the
    // value is filled by rememberOrgForCompany on the next authenticated request.
    const org = await db.orm.public.Organization.where({ companyId }).first().catch(() => null);
    orgId = org?.id ?? null;
    if (orgId) await db.orm.public.Company.where({ id: companyId }).update({ organizationId: orgId });
  }
  if (orgId) cache.set(companyId, orgId);
  return orgId;
}

/** Called on authenticated requests (which carry both ids) so workers can always resolve the bridge. */
export async function rememberOrgForCompany(companyId: number, orgId: string): Promise<void> {
  if (cache.get(companyId) === orgId) return;
  const company = await db.orm.public.Company.where({ id: companyId }).first();
  if (company && company.organizationId !== orgId) {
    await db.orm.public.Company.where({ id: companyId }).update({ organizationId: orgId });
  }
  cache.set(companyId, orgId);
}

import { ParamRef, RawQueryAst } from '@prisma/orm-family-sql/relational-core/ast';
import { planFromAst } from '@prisma/orm-family-sql/relational-core/plan';
import { db } from './db.js';
import contractJson from './contract.json' with { type: 'json' };

export type TenantTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Identity the database policies key on. Each field maps to a transaction-local Postgres setting:
 *  - orgId      -> app.org_id      rows of one organization (all tenant tables)
 *  - userId     -> app.user_id     a signed-in user listing their own memberships/organizations
 *  - inviteHash -> app.invite_hash locating one invitation by the hash of its secret token
 */
export type TenantContext = { orgId?: string; userId?: number; inviteHash?: string };

const SETTINGS: Array<[keyof TenantContext, string]> = [
  ['orgId', 'app.org_id'],
  ['userId', 'app.user_id'],
  ['inviteHash', 'app.invite_hash'],
];

/**
 * Plan for `SELECT set_config(<name>, <value>, true)`. The third argument makes the setting
 * transaction-local, so it vanishes at COMMIT/ROLLBACK and can never leak to another request that
 * reuses the pooled connection.
 */
function setConfigPlan(name: string, value: string) {
  const ast = RawQueryAst.affectedCount([
    `SELECT set_config('${name}', `,
    new ParamRef(value, { codec: { codecId: 'pg/text@1' } }),
    ', true)',
  ]);
  return planFromAst(ast as never, contractJson as never, 'tenant-context');
}

/** Apply a context to an open transaction (also used to switch org mid-transaction, e.g. accepting an invite). */
export async function applyContext(tx: TenantTx, context: TenantContext): Promise<void> {
  const runner = tx as unknown as { execute(plan: unknown): Promise<unknown> };
  for (const [key, setting] of SETTINGS) {
    const value = context[key];
    if (value !== undefined) await runner.execute(setConfigPlan(setting, String(value)));
  }
}

/**
 * Run `fn` in a transaction whose queries are filtered by Postgres row-level security for `context`.
 * With nothing set, tenant tables return no rows (fail closed), so forgetting this wrapper yields
 * nothing instead of leaking data. Requires the app to connect as a role that is neither a
 * superuser nor BYPASSRLS.
 */
export async function withContext<T>(context: TenantContext, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await applyContext(tx, context);
    return fn(tx);
  });
}

export const withTenant = <T>(orgId: string, fn: (tx: TenantTx) => Promise<T>): Promise<T> =>
  withContext({ orgId }, fn);

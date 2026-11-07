import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { db } from '../../prisma/db.js';
import { withContext, withTenant } from '../../prisma/tenant.js';
import { register } from '../auth/controller.js';
import { can, canAssignRole, hashInvitationToken } from './index.js';

type Account = { userId: number; email: string; orgId: string; companyId: number; token: string; refresh: string };

const suffix = randomUUID().slice(0, 8);
const accounts: Account[] = [];
let server: Server;
let base: string;

async function newAccount(label: string): Promise<Account> {
  const email = `${label}-${suffix}@example.com`;
  const result = await register({ email, password: 'SecurePassword123!', companyName: `${label} Co ${suffix}` });
  const account = {
    userId: result.user.id,
    email,
    orgId: result.user.orgId,
    companyId: result.user.companyId,
    token: result.tokens.accessToken,
    refresh: result.tokens.refreshToken,
  };
  accounts.push(account);
  return account;
}

const call = (account: Account, method: string, path: string, body?: unknown) =>
  fetch(`${base}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

beforeAll(async () => {
  const app = createApp({ allowedOrigins: ['http://localhost:3001'] });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const a of accounts) {
    try {
      await withTenant(a.orgId, (tx) => tx.orm.public.Organization.where({ id: a.orgId }).delete());
      await db.orm.public.Company.where({ id: a.companyId }).delete();
    } catch {
      // best-effort cleanup of a disposable database
    }
  }
});

describe('permission matrix', () => {
  it('denies by default and separates roles', () => {
    expect(can('viewer', 'incidents:read')).toBe(true);
    expect(can('viewer', 'incidents:respond')).toBe(false);
    expect(can('responder', 'incidents:respond')).toBe(true);
    expect(can('responder', 'services:manage')).toBe(false);
    expect(can('admin', 'audit:read')).toBe(true);
    expect(can('member', 'audit:read')).toBe(false);
    expect(can('superuser', 'org:read')).toBe(false);
    expect(can(undefined, 'org:read')).toBe(false);
  });

  it('only owners may create or touch owners', () => {
    expect(canAssignRole('owner', 'owner')).toBe(true);
    expect(canAssignRole('admin', 'owner')).toBe(false);
    expect(canAssignRole('admin', 'admin')).toBe(true);
    expect(canAssignRole('responder', 'viewer')).toBe(false);
  });
});

describe('registration creates a tenant', () => {
  it('makes the registrant owner of a new organization and puts org + role in the token', async () => {
    const owner = await newAccount('alpha');
    const res = await call(owner, 'GET', '/org');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.organization.id).toBe(owner.orgId);
    expect(body.role).toBe('owner');

    const members = await (await call(owner, 'GET', '/org/members')).json();
    expect(members.members).toHaveLength(1);
    expect(members.members[0]).toMatchObject({ userId: owner.userId, role: 'owner' });
  });
});

describe('tenant isolation (Postgres row-level security)', () => {
  it('fails closed with no context and never crosses organizations', async () => {
    const a = await newAccount('iso-a');
    const b = await newAccount('iso-b');

    // No tenant context: nothing is visible, even though rows exist.
    expect(await db.orm.public.Membership.all()).toHaveLength(0);
    expect(await db.orm.public.Organization.all()).toHaveLength(0);

    // Org A's context sees only org A's rows and cannot fetch org B's by id.
    const seen = await withTenant(a.orgId, async (tx) => await tx.orm.public.Membership.all());
    expect(seen.every((m) => m.organizationId === a.orgId)).toBe(true);
    const peek = await withTenant(a.orgId, (tx) => tx.orm.public.Organization.where({ id: b.orgId }).first());
    expect(peek).toBeNull();

    // Writing into another organization is rejected by the policy's WITH CHECK.
    await expect(
      withTenant(a.orgId, (tx) =>
        tx.orm.public.Team.create({ organizationId: b.orgId, name: 'smuggled' }),
      ),
    ).rejects.toThrow();

    // A user context lists that user's own memberships and nobody else's.
    const mine = await withContext({ userId: a.userId }, async (tx) => await tx.orm.public.Membership.all());
    expect(mine.map((m) => m.userId)).toEqual([a.userId]);
  });

  it('does not leak members, invitations or audit logs across organizations over HTTP', async () => {
    const a = await newAccount('http-a');
    const b = await newAccount('http-b');
    await call(a, 'POST', '/org/invitations', { email: `someone-${suffix}@example.com`, role: 'member' });

    const bMembers = await (await call(b, 'GET', '/org/members')).json();
    expect(bMembers.members.map((m: { userId: number }) => m.userId)).toEqual([b.userId]);
    const bInvites = await (await call(b, 'GET', '/org/invitations')).json();
    expect(bInvites.invitations).toHaveLength(0);
    const bAudit = await (await call(b, 'GET', '/audit-logs')).json();
    expect(bAudit.logs.every((l: { action: string }) => l.action !== 'invitation.created')).toBe(true);
  });
});

describe('invitations', () => {
  it('invites, accepts once, binds to the invited email and never stores the token', async () => {
    const owner = await newAccount('inv-owner');
    const guest = await newAccount('inv-guest');
    const stranger = await newAccount('inv-stranger');

    const created = await call(owner, 'POST', '/org/invitations', { email: guest.email, role: 'responder' });
    expect(created.status).toBe(201);
    const { token, invitation } = await created.json();
    expect(token).toMatch(/^rxinv_/);
    expect(invitation.status).toBe('pending');

    // Only the hash is stored.
    const stored = await withTenant(owner.orgId, (tx) =>
      tx.orm.public.Invitation.where({ id: invitation.id }).first(),
    );
    expect(stored?.tokenHash).toBe(hashInvitationToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);

    // A different signed-in user cannot use it, and learns nothing about why.
    const wrong = await call(stranger, 'POST', '/invitations/accept', { token });
    expect(wrong.status).toBe(400);
    expect((await wrong.json()).error.code).toBe('INVALID_INVITATION');

    const accepted = await call(guest, 'POST', '/invitations/accept', { token });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).organizationId).toBe(owner.orgId);

    const members = await (await call(owner, 'GET', '/org/members')).json();
    const joined = members.members.find((m: { userId: number }) => m.userId === guest.userId);
    expect(joined.role).toBe('responder');

    // Single use.
    expect((await call(guest, 'POST', '/invitations/accept', { token })).status).toBe(400);
  });

  it('lets exactly one of several concurrent acceptances through', async () => {
    const owner = await newAccount('race-owner');
    const guest = await newAccount('race-guest');
    const { token } = await (await call(owner, 'POST', '/org/invitations', { email: guest.email, role: 'member' })).json();

    const statuses = (await Promise.all([1, 2, 3, 4].map(() => call(guest, 'POST', '/invitations/accept', { token })))).map(
      (r) => r.status,
    );
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    const members = await (await call(owner, 'GET', '/org/members')).json();
    expect(members.members.filter((m: { userId: number }) => m.userId === guest.userId)).toHaveLength(1);
  });

  it('rejects revoked tokens, duplicates and malformed tokens', async () => {
    const owner = await newAccount('inv2-owner');
    const guest = await newAccount('inv2-guest');

    const first = await (await call(owner, 'POST', '/org/invitations', { email: guest.email, role: 'viewer' })).json();
    const dup = await call(owner, 'POST', '/org/invitations', { email: guest.email, role: 'viewer' });
    expect(dup.status).toBe(409);

    expect((await call(owner, 'DELETE', `/org/invitations/${first.invitation.id}`)).status).toBe(200);
    expect((await call(guest, 'POST', '/invitations/accept', { token: first.token })).status).toBe(400);
    expect((await call(guest, 'POST', '/invitations/accept', { token: 'not-a-token' })).status).toBe(400);
  });

  it('only people with members:invite can invite, and nobody can invite above their own role', async () => {
    const owner = await newAccount('inv3-owner');
    const guest = await newAccount('inv3-guest');
    const invite = await (await call(owner, 'POST', '/org/invitations', { email: guest.email, role: 'viewer' })).json();
    await call(guest, 'POST', '/invitations/accept', { token: invite.token });

    // The guest signed in with their own org token; act as a viewer of the owner's org via a fresh token.
    const viewerToken = (await import('../auth/model.js')).signAccessToken({
      userId: guest.userId,
      email: guest.email,
      role: 'viewer',
      companyId: guest.companyId,
      orgId: owner.orgId,
    });
    const asViewer = { ...guest, token: viewerToken };
    expect((await call(asViewer, 'POST', '/org/invitations', { email: 'x@example.com', role: 'viewer' })).status).toBe(403);
    expect((await call(asViewer, 'GET', '/audit-logs')).status).toBe(403);

    const adminToken = (await import('../auth/model.js')).signAccessToken({
      userId: guest.userId,
      email: guest.email,
      role: 'admin',
      companyId: guest.companyId,
      orgId: owner.orgId,
    });
    const asAdmin = { ...guest, token: adminToken };
    expect((await call(asAdmin, 'POST', '/org/invitations', { email: 'y@example.com', role: 'owner' })).status).toBe(403);
  });
});

describe('member management and audit log', () => {
  it('protects the last owner, forbids admins from touching owners, and records an audit trail', async () => {
    const owner = await newAccount('mem-owner');
    const guest = await newAccount('mem-guest');
    const invite = await (await call(owner, 'POST', '/org/invitations', { email: guest.email, role: 'admin' })).json();
    await call(guest, 'POST', '/invitations/accept', { token: invite.token });

    const { signAccessToken } = await import('../auth/model.js');
    const asAdmin = {
      ...guest,
      token: signAccessToken({ userId: guest.userId, email: guest.email, role: 'admin', companyId: guest.companyId, orgId: owner.orgId }),
    };

    // An admin cannot demote or remove the owner, or promote themselves.
    expect((await call(asAdmin, 'PATCH', `/org/members/${owner.userId}`, { role: 'viewer' })).status).toBe(403);
    expect((await call(asAdmin, 'DELETE', `/org/members/${owner.userId}`)).status).toBe(403);
    expect((await call(asAdmin, 'PATCH', `/org/members/${guest.userId}`, { role: 'owner' })).status).toBe(403);

    // The sole owner cannot demote or remove themselves.
    const demote = await call(owner, 'PATCH', `/org/members/${owner.userId}`, { role: 'admin' });
    expect(demote.status).toBe(409);
    expect((await demote.json()).error.code).toBe('LAST_OWNER');
    expect((await call(owner, 'DELETE', `/org/members/${owner.userId}`)).status).toBe(409);

    // A legitimate change succeeds and is audited.
    expect((await call(owner, 'PATCH', `/org/members/${guest.userId}`, { role: 'viewer' })).status).toBe(200);

    const audit = await (await call(owner, 'GET', '/audit-logs')).json();
    const actions = audit.logs.map((l: { action: string }) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['invitation.created', 'invitation.accepted', 'member.role_changed']));
    const change = audit.logs.find((l: { action: string }) => l.action === 'member.role_changed');
    expect(change.metadata).toEqual({ from: 'admin', to: 'viewer' });
    expect(change.actorId).toBe(owner.userId);
    expect(change.requestId).toBeTruthy();
    expect(JSON.stringify(audit.logs)).not.toContain(invite.token);

    // Members can leave on their own.
    const leave = await call({ ...guest, token: signAccessToken({ userId: guest.userId, email: guest.email, role: 'viewer', companyId: guest.companyId, orgId: owner.orgId }) }, 'DELETE', `/org/members/${guest.userId}`);
    expect(leave.status).toBe(200);
  });

  it('paginates the audit log', async () => {
    const owner = await newAccount('page-owner');
    for (let i = 0; i < 3; i++) {
      await call(owner, 'POST', '/org/invitations', { email: `p${i}-${suffix}@example.com`, role: 'viewer' });
    }
    const first = await (await call(owner, 'GET', '/audit-logs?limit=2')).json();
    expect(first.logs).toHaveLength(2);
    expect(first.nextBefore).toBeTruthy();
    const second = await (await call(owner, 'GET', `/audit-logs?limit=2&before=${encodeURIComponent(first.nextBefore)}`)).json();
    expect(second.logs.length).toBeGreaterThan(0);
    const ids = new Set([...first.logs, ...second.logs].map((l: { id: string }) => l.id));
    expect(ids.size).toBe(first.logs.length + second.logs.length);
  });
});

describe('organization switching', () => {
  it('lists my organizations and re-issues the session for another one I belong to', async () => {
    const owner = await newAccount('sw-owner');
    const guest = await newAccount('sw-guest');
    const { token } = await (await call(owner, 'POST', '/org/invitations', { email: guest.email, role: 'responder' })).json();
    await call(guest, 'POST', '/invitations/accept', { token });

    const mine = await (await call(guest, 'GET', '/organizations')).json();
    expect(mine.organizations).toHaveLength(2);
    expect(mine.organizations.find((o: { current: boolean }) => o.current).id).toBe(guest.orgId);

    const switchTo = (organizationId: string, refresh: string) =>
      fetch(`${base}/api/auth/switch-org`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: `refreshToken=${refresh}`, Origin: 'http://localhost:3001' },
        body: JSON.stringify({ organizationId }),
      });

    const res = await switchTo(owner.orgId, guest.refresh);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.orgId).toBe(owner.orgId);
    expect(body.user.role).toBe('responder');

    const after = await (await call({ ...guest, token: body.tokens.accessToken }, 'GET', '/org')).json();
    expect(after.organization.id).toBe(owner.orgId);
    expect(after.role).toBe('responder');

    // /me reports the organization and role the session is acting in, not the user's default.
    const me = await (await call({ ...guest, token: body.tokens.accessToken }, 'GET', '/auth/me')).json();
    expect(me.user.orgId).toBe(owner.orgId);
    expect(me.user.role).toBe('responder');

    // The new refresh token keeps the user in the chosen organization.
    const refreshed = await fetch(`${base}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `refreshToken=${body.tokens.refreshToken}`, Origin: 'http://localhost:3001' },
      body: '{}',
    });
    expect((await refreshed.json()).user.orgId).toBe(owner.orgId);
  });

  it('refuses to switch into an organization the user does not belong to', async () => {
    const a = await newAccount('sw2-a');
    const b = await newAccount('sw2-b');
    const res = await fetch(`${base}/api/auth/switch-org`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `refreshToken=${a.refresh}`, Origin: 'http://localhost:3001' },
      body: JSON.stringify({ organizationId: b.orgId }),
    });
    expect(res.status).toBe(403);
  });
});

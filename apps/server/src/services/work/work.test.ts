import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { db } from '../../prisma/db.js';
import { withContext, withTenant } from '../../prisma/tenant.js';
import { register } from '../auth/controller.js';
import { signAccessToken } from '../auth/model.js';
import type { Role } from '../org/permissions.js';

type Account = { userId: number; email: string; orgId: string; companyId: number; token: string };

const suffix = randomUUID().slice(0, 6);
const created: Account[] = [];
let server: Server;
let base: string;

async function newOwner(label: string): Promise<Account> {
  const email = `${label}-${suffix}@example.com`;
  const r = await register({ email, password: 'SecurePassword123!', companyName: `${label} ${suffix}` });
  const a = { userId: r.user.id, email, orgId: r.user.orgId, companyId: r.user.companyId, token: r.tokens.accessToken };
  created.push(a);
  return a;
}

const call = (a: { token: string }, method: string, path: string, body?: unknown) =>
  fetch(`${base}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** A real member of `owner`'s organization with the given role (invited and accepted through the API). */
async function addMember(owner: Account, label: string, role: Role): Promise<Account> {
  const guest = await newOwner(label);
  const inv = await (await call(owner, 'POST', '/org/invitations', { email: guest.email, role })).json();
  const accepted = await call(guest, 'POST', '/invitations/accept', { token: inv.token });
  expect(accepted.status).toBe(200);
  return {
    ...guest,
    orgId: owner.orgId,
    token: signAccessToken({ userId: guest.userId, email: guest.email, role, companyId: guest.companyId, orgId: owner.orgId }),
  };
}

async function newProject(owner: Account, key: string) {
  const res = await call(owner, 'POST', '/projects', { name: `Project ${key}`, key });
  expect(res.status).toBe(201);
  return res.json() as Promise<{ project: { id: string }; statuses: Array<{ id: string; name: string; category: string }> }>;
}

beforeAll(async () => {
  const app = createApp({ allowedOrigins: [] });
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const a of created) {
    try {
      await withTenant(a.orgId, (tx) => tx.orm.public.Organization.where({ id: a.orgId }).delete());
      await db.orm.public.Company.where({ id: a.companyId }).delete();
    } catch {
      // best-effort cleanup of a disposable database
    }
  }
});

describe('projects and workflow', () => {
  it('lets an admin create a project with a default workflow, and rejects bad or duplicate keys', async () => {
    const owner = await newOwner('proj-owner');
    const { project, statuses } = await newProject(owner, 'PAY');
    expect(statuses.map((s) => s.name)).toEqual(['To Do', 'In Progress', 'In Review', 'Done']);
    expect(statuses.map((s) => s.category)).toEqual(['todo', 'in_progress', 'in_progress', 'done']);

    expect((await call(owner, 'POST', '/projects', { name: 'Dup', key: 'PAY' })).status).toBe(409);
    expect((await call(owner, 'POST', '/projects', { name: 'Bad', key: '1x' })).status).toBe(400);
    expect((await call(owner, 'POST', '/projects', { name: 'Lower', key: 'pay2' })).status).toBe(201); // normalised to PAY2

    const list = await (await call(owner, 'GET', '/projects')).json();
    expect(list.projects.map((p: { key: string }) => p.key).sort()).toEqual(['PAY', 'PAY2']);
    expect((await (await call(owner, 'GET', `/projects/${project.id}`)).json()).project.key).toBe('PAY');
  });

  it('only people with projects:manage can create projects or change the workflow', async () => {
    const owner = await newOwner('perm-owner');
    const member = await addMember(owner, 'perm-member', 'member');
    const viewer = await addMember(owner, 'perm-viewer', 'viewer');
    const { project, statuses } = await newProject(owner, 'PRM');

    expect((await call(member, 'POST', '/projects', { name: 'X', key: 'XX' })).status).toBe(403);
    expect((await call(member, 'POST', `/projects/${project.id}/statuses`, { name: 'Blocked', category: 'todo' })).status).toBe(403);
    expect((await call(viewer, 'POST', '/projects', { name: 'X', key: 'XY' })).status).toBe(403);
    expect((await call(viewer, 'GET', '/projects')).status).toBe(200); // read-only access

    // Admins can customise the workflow.
    const added = await call(owner, 'POST', `/projects/${project.id}/statuses`, { name: 'Blocked', category: 'in_progress' });
    expect(added.status).toBe(201);
    expect((await call(owner, 'POST', `/projects/${project.id}/statuses`, { name: 'Blocked', category: 'todo' })).status).toBe(409);
    const blockedId = (await added.json()).status.id;

    // A status holding tickets cannot be deleted; an empty one can; the last one cannot.
    const t = await (await call(owner, 'POST', `/projects/${project.id}/tasks`, { title: 'x', statusId: blockedId })).json();
    expect(t.task.status.name).toBe('Blocked');
    expect((await call(owner, 'DELETE', `/projects/${project.id}/statuses/${blockedId}`)).status).toBe(409);
    const emptyStatus = statuses[2]!.id;
    expect((await call(owner, 'DELETE', `/projects/${project.id}/statuses/${emptyStatus}`)).status).toBe(200);
  });
});

describe('tickets', () => {
  it('numbers tickets uniquely and resolves PAY-1 style refs, even under concurrent creation', async () => {
    const owner = await newOwner('num-owner');
    const { project } = await newProject(owner, 'NUM');
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => call(owner, 'POST', `/projects/${project.id}/tasks`, { title: `Ticket ${i}` })),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = (await Promise.all(results.map((r) => r.json()))).map((b) => b.task.number).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    const byRef = await (await call(owner, 'GET', '/tasks/NUM-3')).json();
    expect(byRef.task.ref).toBe('NUM-3');
    expect((await call(owner, 'GET', '/tasks/NUM-99')).status).toBe(404);
  });

  it('lets members work tickets but not manage assignment of other people; admins can allot work', async () => {
    const owner = await newOwner('asg-owner');
    const member = await addMember(owner, 'asg-member', 'member');
    const other = await addMember(owner, 'asg-other', 'member');
    const outsider = await newOwner('asg-outsider');
    const { project } = await newProject(owner, 'ASG');

    // A member can raise a ticket and assign it to themselves.
    const own = await call(member, 'POST', `/projects/${project.id}/tasks`, { title: 'Mine', assigneeId: member.userId });
    expect(own.status).toBe(201);
    expect((await own.json()).task.assignee.id).toBe(member.userId);

    // ...but not to someone else.
    expect((await call(member, 'POST', `/projects/${project.id}/tasks`, { title: 'Theirs', assigneeId: other.userId })).status).toBe(403);

    // The admin allots work to anyone in the organization, and only to people in the organization.
    const assigned = await call(owner, 'POST', `/projects/${project.id}/tasks`, { title: 'Allotted', assigneeId: other.userId, priority: 'high', dueDate: '2030-01-15', labels: ['backend'] });
    expect(assigned.status).toBe(201);
    const task = (await assigned.json()).task;
    expect(task.assignee.id).toBe(other.userId);
    expect(task.priority).toBe('high');
    expect(task.dueDate).toMatch(/^2030-01-15/);
    expect(task.labels).toEqual(['backend']);
    expect(task.reporter.id).toBe(owner.userId);
    expect((await call(owner, 'POST', `/projects/${project.id}/tasks`, { title: 'Bad', assigneeId: outsider.userId })).status).toBe(400);

    // Taking over someone else's ticket is an admin action; admins can reassign it.
    expect((await call(member, 'PATCH', `/tasks/${task.ref}`, { assigneeId: member.userId })).status).toBe(403);
    expect((await call(owner, 'PATCH', `/tasks/${task.ref}`, { assigneeId: member.userId })).status).toBe(200);
    // Anyone with edit rights can pick up an unassigned ticket for themselves.
    const free = (await (await call(owner, 'POST', `/projects/${project.id}/tasks`, { title: 'Unassigned' })).json()).task;
    expect((await call(member, 'PATCH', `/tasks/${free.ref}`, { assigneeId: member.userId })).status).toBe(200);
  });

  it('shows "My work" and records activity when a ticket moves and is reassigned', async () => {
    const owner = await newOwner('my-owner');
    const worker = await addMember(owner, 'my-worker', 'responder');
    const { project, statuses } = await newProject(owner, 'MY');
    const t = (await (await call(owner, 'POST', `/projects/${project.id}/tasks`, { title: 'Fix login', type: 'bug', assigneeId: worker.userId })).json()).task;

    const mine = await (await call(worker, 'GET', '/tasks?assignee=me')).json();
    expect(mine.tasks.map((x: { ref: string }) => x.ref)).toEqual(['MY-1']);
    expect((await (await call(owner, 'GET', '/tasks?assignee=me')).json()).tasks).toHaveLength(0);

    // The assignee moves it across the board.
    const inProgress = statuses.find((s) => s.name === 'In Progress')!;
    const moved = await call(worker, 'PATCH', `/tasks/${t.ref}`, { statusId: inProgress.id });
    expect(moved.status).toBe(200);
    expect((await moved.json()).task.status.name).toBe('In Progress');

    // A status from another project is rejected.
    const other = await newProject(owner, 'OTH');
    expect((await call(worker, 'PATCH', `/tasks/${t.ref}`, { statusId: other.statuses[0]!.id })).status).toBe(400);

    await call(worker, 'POST', `/tasks/${t.ref}/comments`, { body: 'On it' });
    const detail = await (await call(owner, 'GET', `/tasks/${t.ref}`)).json();
    expect(detail.comments).toHaveLength(1);
    expect(detail.comments[0].author.id).toBe(worker.userId);
    const types = detail.activity.map((a: { type: string }) => a.type);
    expect(types).toEqual(expect.arrayContaining(['created', 'assigned', 'status_changed', 'commented']));
    const change = detail.activity.find((a: { type: string }) => a.type === 'status_changed');
    expect(change.data).toEqual({ from: 'To Do', to: 'In Progress' });
  });

  it('enforces the epic > story/task/bug > subtask hierarchy', async () => {
    const owner = await newOwner('hier-owner');
    const { project } = await newProject(owner, 'HIE');
    const make = (body: object) => call(owner, 'POST', `/projects/${project.id}/tasks`, body);

    const epic = (await (await make({ title: 'Epic', type: 'epic' })).json()).task;
    expect((await make({ title: 'Orphan sub', type: 'subtask' })).status).toBe(400);
    expect((await make({ title: 'Epic child of epic', type: 'epic', parentId: epic.id })).status).toBe(400);
    const story = await make({ title: 'Story', type: 'story', parentId: epic.id });
    expect(story.status).toBe(201);
    const storyTask = (await story.json()).task;
    expect((await make({ title: 'Sub under epic', type: 'subtask', parentId: epic.id })).status).toBe(400);
    expect((await make({ title: 'Sub', type: 'subtask', parentId: storyTask.id })).status).toBe(201);

    const detail = await (await call(owner, 'GET', `/tasks/${storyTask.ref}`)).json();
    expect(detail.parent.ref).toBe(epic.ref);
    expect(detail.subtasks).toHaveLength(1);
  });

  it('keeps viewers read-only and lets only admins delete tickets', async () => {
    const owner = await newOwner('ro-owner');
    const viewer = await addMember(owner, 'ro-viewer', 'viewer');
    const member = await addMember(owner, 'ro-member', 'member');
    const { project } = await newProject(owner, 'RO');
    const t = (await (await call(owner, 'POST', `/projects/${project.id}/tasks`, { title: 'Read me' })).json()).task;

    expect((await call(viewer, 'GET', `/tasks/${t.ref}`)).status).toBe(200);
    expect((await call(viewer, 'POST', `/projects/${project.id}/tasks`, { title: 'no' })).status).toBe(403);
    expect((await call(viewer, 'PATCH', `/tasks/${t.ref}`, { title: 'no' })).status).toBe(403);
    expect((await call(viewer, 'POST', `/tasks/${t.ref}/comments`, { body: 'no' })).status).toBe(403);
    expect((await call(member, 'DELETE', `/tasks/${t.ref}`)).status).toBe(403);
    expect((await call(owner, 'DELETE', `/tasks/${t.ref}`)).status).toBe(200);
    expect((await call(owner, 'GET', `/tasks/${t.ref}`)).status).toBe(404);
  });
});

describe('tenant isolation for work data', () => {
  it('never exposes another organization’s projects or tickets, over HTTP or in the database', async () => {
    const a = await newOwner('iso-a');
    const b = await newOwner('iso-b');
    const { project } = await newProject(a, 'SEC');
    const t = (await (await call(a, 'POST', `/projects/${project.id}/tasks`, { title: 'Secret' })).json()).task;

    expect((await call(b, 'GET', `/projects/${project.id}`)).status).toBe(404);
    expect((await call(b, 'GET', `/tasks/${t.id}`)).status).toBe(404);
    expect((await call(b, 'GET', '/tasks/SEC-1')).status).toBe(404);
    expect((await call(b, 'PATCH', `/tasks/${t.id}`, { title: 'hacked' })).status).toBe(404);
    expect((await call(b, 'POST', `/projects/${project.id}/tasks`, { title: 'inject' })).status).toBe(404);
    expect((await (await call(b, 'GET', '/projects')).json()).projects).toHaveLength(0);
    expect((await (await call(b, 'GET', `/tasks?limit=50`)).json()).tasks).toHaveLength(0);

    // Row-level security: nothing visible without a tenant, and org B's context cannot see org A's rows.
    expect(await db.orm.public.Task.all()).toHaveLength(0);
    const seenByB = await withContext({ orgId: b.orgId }, async (tx) => await tx.orm.public.Task.all());
    expect(seenByB).toHaveLength(0);
  });
});

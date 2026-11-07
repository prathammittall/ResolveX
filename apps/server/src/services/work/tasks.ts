import { db } from '../../prisma/db.js';
import { withTenant, type TenantTx } from '../../prisma/tenant.js';
import { OrgError } from '../org/errors.js';
import type { Actor } from '../org/members.js';
import { can } from '../org/permissions.js';

export type TaskType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';
export type TaskPriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

export type UserRef = { id: number; name: string; email: string };

export type TaskView = {
  id: string;
  projectId: string;
  projectKey: string;
  number: number;
  ref: string;
  type: TaskType;
  title: string;
  description: string | null;
  status: { id: string; name: string; category: string };
  priority: TaskPriority;
  assignee: UserRef | null;
  reporter: UserRef | null;
  parentId: string | null;
  dueDate: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
};

export type TaskInput = {
  title: string;
  description?: string | null;
  type?: TaskType;
  priority?: TaskPriority;
  statusId?: string;
  assigneeId?: number | null;
  dueDate?: string | null;
  labels?: string[];
  parentId?: string | null;
};

const MAX_LIST = 500;

type TaskRow = {
  id: string;
  projectId: string;
  number: number;
  type: string;
  title: string;
  description: string | null;
  statusId: string;
  priority: string;
  assigneeId: number | null;
  reporterId: number | null;
  parentId: string | null;
  dueDate: string | null;
  labels: unknown;
  createdAt: string;
  updatedAt: string;
};

/** Resolve user ids to display info once per request (people list is small; org-scoped via membership). */
async function loadUsers(ids: Array<number | null>): Promise<Map<number, UserRef>> {
  const map = new Map<number, UserRef>();
  for (const id of new Set(ids.filter((i): i is number => i !== null))) {
    const u = await db.orm.public.User.where({ id }).first();
    if (u) map.set(id, { id: u.id, name: u.name || u.username || u.email.split('@')[0] || u.email, email: u.email });
  }
  return map;
}

function parseLabels(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

async function toViews(tx: TenantTx, orgId: string, rows: TaskRow[]): Promise<TaskView[]> {
  const projects = new Map<string, string>();
  const statuses = new Map<string, { id: string; name: string; category: string }>();
  for (const projectId of new Set(rows.map((r) => r.projectId))) {
    const p = await tx.orm.public.Project.where({ id: projectId, organizationId: orgId }).first();
    if (p) projects.set(projectId, p.key);
    const list = await tx.orm.public.ProjectStatus.where({ projectId, organizationId: orgId }).all();
    for (const s of list) statuses.set(s.id, { id: s.id, name: s.name, category: s.category });
  }
  const users = await loadUsers(rows.flatMap((r) => [r.assigneeId, r.reporterId]));
  return rows.map((r) => {
    const key = projects.get(r.projectId) ?? '?';
    return {
      id: r.id,
      projectId: r.projectId,
      projectKey: key,
      number: r.number,
      ref: `${key}-${r.number}`,
      type: r.type as TaskType,
      title: r.title,
      description: r.description,
      status: statuses.get(r.statusId) ?? { id: r.statusId, name: 'Unknown', category: 'todo' },
      priority: r.priority as TaskPriority,
      assignee: r.assigneeId !== null ? (users.get(r.assigneeId) ?? null) : null,
      reporter: r.reporterId !== null ? (users.get(r.reporterId) ?? null) : null,
      parentId: r.parentId,
      dueDate: r.dueDate,
      labels: parseLabels(r.labels),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

/** An assignee must belong to the organization; members may only assign themselves, admins anyone. */
async function checkAssignee(tx: TenantTx, actor: Actor, assigneeId: number | null | undefined): Promise<void> {
  if (assigneeId === null || assigneeId === undefined) return;
  if (assigneeId !== actor.userId && !can(actor.role, 'tasks:assign')) {
    throw new OrgError('FORBIDDEN', 'Only admins can assign work to other people', 403);
  }
  const member = await tx.orm.public.Membership.where({ organizationId: actor.orgId, userId: assigneeId }).first();
  if (!member) throw new OrgError('VALIDATION_ERROR', 'The assignee is not a member of this organization', 400);
}

/** Epics hold stories/tasks/bugs; subtasks hang off a story/task/bug; epics have no parent. */
async function checkParent(
  tx: TenantTx,
  actor: Actor,
  projectId: string,
  type: TaskType,
  parentId: string | null | undefined,
  selfId?: string,
): Promise<void> {
  if (parentId === null || parentId === undefined) {
    if (type === 'subtask') throw new OrgError('VALIDATION_ERROR', 'A subtask needs a parent ticket', 400);
    return;
  }
  if (type === 'epic') throw new OrgError('VALIDATION_ERROR', 'An epic cannot have a parent', 400);
  if (parentId === selfId) throw new OrgError('VALIDATION_ERROR', 'A ticket cannot be its own parent', 400);
  const parent = await tx.orm.public.Task.where({ id: parentId, projectId, organizationId: actor.orgId }).first();
  if (!parent) throw new OrgError('VALIDATION_ERROR', 'The parent ticket was not found in this project', 400);
  if (type === 'subtask' && !['story', 'task', 'bug'].includes(parent.type)) {
    throw new OrgError('VALIDATION_ERROR', 'A subtask must belong to a story, task or bug', 400);
  }
  if (type !== 'subtask' && parent.type !== 'epic') {
    throw new OrgError('VALIDATION_ERROR', 'Only an epic can be the parent of this ticket type', 400);
  }
}

async function addActivity(
  tx: TenantTx,
  actor: Actor,
  taskId: string,
  type: string,
  data?: Record<string, unknown>,
): Promise<void> {
  await tx.orm.public.TaskActivity.create({
    organizationId: actor.orgId,
    taskId,
    actorId: actor.userId,
    type,
    data: (data ?? null) as never,
  });
}

export async function createTask(actor: Actor, projectId: string, input: TaskInput): Promise<TaskView> {
  const created = await withTenant(actor.orgId, async (tx) => {
    // Lock the project row so concurrent creators get distinct, gap-free ticket numbers.
    const project = await tx.orm.public.Project.where({ id: projectId, organizationId: actor.orgId }).forUpdate().first();
    if (!project) throw new OrgError('NOT_FOUND', 'Project not found', 404);
    if (project.archivedAt) throw new OrgError('CONFLICT', 'This project is archived', 409);

    const statuses = await tx.orm.public.ProjectStatus.where({ projectId, organizationId: actor.orgId }).all();
    const ordered = [...statuses].sort((a, b) => a.position - b.position);
    const status = input.statusId ? ordered.find((s) => s.id === input.statusId) : ordered[0];
    if (!status) throw new OrgError('VALIDATION_ERROR', 'Unknown status for this project', 400);

    const type = input.type ?? 'task';
    await checkAssignee(tx, actor, input.assigneeId);
    await checkParent(tx, actor, projectId, type, input.parentId);

    const number = project.nextTaskNumber;
    await tx.orm.public.Project.where({ id: projectId }).update({ nextTaskNumber: number + 1 });

    const row = await tx.orm.public.Task.create({
      organizationId: actor.orgId,
      projectId,
      number,
      type,
      title: input.title,
      description: input.description ?? null,
      statusId: status.id,
      priority: input.priority ?? 'medium',
      assigneeId: input.assigneeId ?? null,
      reporterId: actor.userId,
      parentId: input.parentId ?? null,
      dueDate: input.dueDate ?? null,
      labels: (input.labels ?? []) as never,
    });
    await addActivity(tx, actor, row.id, 'created', { status: status.name });
    if (row.assigneeId !== null) await addActivity(tx, actor, row.id, 'assigned', { to: row.assigneeId });
    return row;
  });
  return (await getTask(actor.orgId, created.id)).task;
}

const REF = /^([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts either the task UUID or its human ref (PAY-12). */
async function findTask(tx: TenantTx, orgId: string, ref: string) {
  const m = REF.exec(ref);
  if (m) {
    const project = await tx.orm.public.Project.where({ organizationId: orgId, key: (m[1] ?? '').toUpperCase() }).first();
    if (!project) return null;
    return tx.orm.public.Task.where({ projectId: project.id, organizationId: orgId, number: Number(m[2]) }).first();
  }
  if (!UUID.test(ref)) return null;
  return tx.orm.public.Task.where({ id: ref, organizationId: orgId }).first();
}

export async function getTask(orgId: string, ref: string) {
  const data = await withTenant(orgId, async (tx) => {
    const row = await findTask(tx, orgId, ref);
    if (!row) return null;
    const [view] = await toViews(tx, orgId, [row]);
    const comments = await tx.orm.public.TaskComment.where({ taskId: row.id, organizationId: orgId }).all();
    const activities = await tx.orm.public.TaskActivity.where({ taskId: row.id, organizationId: orgId }).all();
    const children = await tx.orm.public.Task.where({ parentId: row.id, organizationId: orgId }).all();
    const parent = row.parentId
      ? await tx.orm.public.Task.where({ id: row.parentId, organizationId: orgId }).first()
      : null;
    const related = await toViews(tx, orgId, [...children, ...(parent ? [parent] : [])]);
    const statuses = await tx.orm.public.ProjectStatus.where({ projectId: row.projectId, organizationId: orgId }).all();
    return { view, comments, activities, children: related.filter((r) => r.parentId === row.id), parent: related.find((r) => r.id === row.parentId) ?? null, statuses };
  });
  if (!data) throw new OrgError('NOT_FOUND', 'Ticket not found', 404);

  const users = await loadUsers([
    ...data.comments.map((c) => c.authorId),
    ...data.activities.map((a) => a.actorId),
  ]);
  const name = (id: number | null) => (id !== null ? (users.get(id) ?? null) : null);
  return {
    task: data.view,
    parent: data.parent,
    subtasks: data.children.sort((a, b) => a.number - b.number),
    statuses: data.statuses
      .map((s) => ({ id: s.id, name: s.name, category: s.category, position: s.position }))
      .sort((a, b) => a.position - b.position),
    comments: data.comments
      .map((c) => ({ id: c.id, body: c.body, author: name(c.authorId), createdAt: c.createdAt }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    activity: data.activities
      .map((a) => ({ id: a.id, type: a.type, data: a.data, actor: name(a.actorId), createdAt: a.createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export type TaskFilter = {
  projectId?: string;
  assigneeId?: number;
  statusId?: string;
  type?: TaskType;
  limit?: number;
};

/** Newest first, hard-capped so a board or list can never become an unbounded query. */
export async function listTasks(orgId: string, filter: TaskFilter): Promise<{ tasks: TaskView[]; truncated: boolean }> {
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), MAX_LIST);
  const where: Record<string, unknown> = { organizationId: orgId };
  if (filter.projectId) where.projectId = filter.projectId;
  if (filter.assigneeId !== undefined) where.assigneeId = filter.assigneeId;
  if (filter.statusId) where.statusId = filter.statusId;
  if (filter.type) where.type = filter.type;

  return withTenant(orgId, async (tx) => {
    const rows = await tx.orm.public.Task.where(where as never)
      .orderBy((t) => t.createdAt.desc())
      .limit(limit + 1)
      .all();
    const page = rows.slice(0, limit);
    return { tasks: await toViews(tx, orgId, page), truncated: rows.length > limit };
  });
}

export async function updateTask(
  actor: Actor,
  ref: string,
  patch: Partial<Omit<TaskInput, 'statusId'>> & { statusId?: string },
): Promise<TaskView> {
  const id = await withTenant(actor.orgId, async (tx) => {
    const row = await findTask(tx, actor.orgId, ref);
    if (!row) throw new OrgError('NOT_FOUND', 'Ticket not found', 404);
    const locked = await tx.orm.public.Task.where({ id: row.id }).forUpdate().first();
    if (!locked) throw new OrgError('NOT_FOUND', 'Ticket not found', 404);

    const data: Record<string, unknown> = {};
    const changes: Array<[string, Record<string, unknown>?]> = [];

    if (patch.title !== undefined && patch.title !== locked.title) {
      data.title = patch.title;
      changes.push(['title_changed', { from: locked.title, to: patch.title }]);
    }
    if (patch.description !== undefined && patch.description !== locked.description) {
      data.description = patch.description;
      changes.push(['description_changed']);
    }
    if (patch.priority !== undefined && patch.priority !== locked.priority) {
      data.priority = patch.priority;
      changes.push(['priority_changed', { from: locked.priority, to: patch.priority }]);
    }
    if (patch.dueDate !== undefined && patch.dueDate !== locked.dueDate) {
      data.dueDate = patch.dueDate;
      changes.push(['due_date_changed', { to: patch.dueDate }]);
    }
    if (patch.labels !== undefined) {
      data.labels = patch.labels as never;
      changes.push(['labels_changed', { to: patch.labels }]);
    }
    if (patch.statusId !== undefined && patch.statusId !== locked.statusId) {
      const statuses = await tx.orm.public.ProjectStatus.where({ projectId: locked.projectId, organizationId: actor.orgId }).all();
      const to = statuses.find((s) => s.id === patch.statusId);
      if (!to) throw new OrgError('VALIDATION_ERROR', 'Unknown status for this project', 400);
      const from = statuses.find((s) => s.id === locked.statusId);
      data.statusId = to.id;
      changes.push(['status_changed', { from: from?.name ?? null, to: to.name }]);
    }
    if (patch.assigneeId !== undefined && patch.assigneeId !== locked.assigneeId) {
      // Taking over or releasing someone else's ticket is an assignment decision reserved for admins.
      if (locked.assigneeId !== null && locked.assigneeId !== actor.userId && !can(actor.role, 'tasks:assign')) {
        throw new OrgError('FORBIDDEN', 'Only admins can change who a ticket is assigned to', 403);
      }
      await checkAssignee(tx, actor, patch.assigneeId);
      data.assigneeId = patch.assigneeId;
      changes.push(['assigned', { from: locked.assigneeId, to: patch.assigneeId }]);
    }
    const nextType = patch.type ?? (locked.type as TaskType);
    if (patch.type !== undefined || patch.parentId !== undefined) {
      const nextParent = patch.parentId !== undefined ? patch.parentId : locked.parentId;
      await checkParent(tx, actor, locked.projectId, nextType, nextParent, locked.id);
      if (patch.type !== undefined && patch.type !== locked.type) {
        data.type = patch.type;
        changes.push(['type_changed', { from: locked.type, to: patch.type }]);
      }
      if (patch.parentId !== undefined && patch.parentId !== locked.parentId) data.parentId = patch.parentId;
    }

    if (Object.keys(data).length > 0) {
      await tx.orm.public.Task.where({ id: locked.id }).update(data as never);
      for (const [type, extra] of changes) await addActivity(tx, actor, locked.id, type, extra);
    }
    return locked.id;
  });
  return (await getTask(actor.orgId, id)).task;
}

export async function addComment(actor: Actor, ref: string, body: string) {
  await withTenant(actor.orgId, async (tx) => {
    const row = await findTask(tx, actor.orgId, ref);
    if (!row) throw new OrgError('NOT_FOUND', 'Ticket not found', 404);
    await tx.orm.public.TaskComment.create({
      organizationId: actor.orgId,
      taskId: row.id,
      authorId: actor.userId,
      body,
    });
    await addActivity(tx, actor, row.id, 'commented');
  });
  return (await getTask(actor.orgId, ref)).comments;
}

export async function deleteTask(actor: Actor, ref: string): Promise<void> {
  await withTenant(actor.orgId, async (tx) => {
    const row = await findTask(tx, actor.orgId, ref);
    if (!row) throw new OrgError('NOT_FOUND', 'Ticket not found', 404);
    // Detach children instead of deleting them with their parent.
    const children = await tx.orm.public.Task.where({ parentId: row.id, organizationId: actor.orgId }).all();
    for (const child of children) {
      await tx.orm.public.Task.where({ id: child.id }).update({ parentId: null });
    }
    await tx.orm.public.Task.where({ id: row.id }).delete();
  });
}

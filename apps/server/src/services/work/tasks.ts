import { and, not } from '@prisma/orm-postgres/orm-client';
import { db } from '../../prisma/db.js';
import { notifyUsers } from '../notify/index.js';
import { emitEvent } from '../integrations/webhooks.js';
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
  sprintId: string | null;
  storyPoints: number | null;
  position: number;
  startDate: string | null;
  serviceId: number | null;
  incidentId: number | null;
  completedAt: string | null;
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
  sprintId?: string | null;
  storyPoints?: number | null;
  position?: number;
  startDate?: string | null;
  serviceId?: number | null;
  incidentId?: number | null;
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
  sprintId: string | null;
  storyPoints: number | null;
  position: number;
  startDate: string | null;
  serviceId: number | null;
  incidentId: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Resolve user ids to display info once per request (people list is small; org-scoped via membership). */
async function loadUsers(ids: Array<number | null>): Promise<Map<number, UserRef>> {
  const map = new Map<number, UserRef>();
  const unique = [...new Set(ids.filter((i): i is number => i !== null))];
  if (unique.length === 0) return map;
  const users = await db.orm.public.User.where((u) => u.id.in(unique)).all();
  for (const u of users) map.set(u.id, { id: u.id, name: u.name || u.username || u.email.split('@')[0] || u.email, email: u.email });
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
      sprintId: r.sprintId,
      storyPoints: r.storyPoints,
      position: r.position,
      startDate: r.startDate,
      serviceId: r.serviceId,
      incidentId: r.incidentId,
      completedAt: r.completedAt,
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
      sprintId: input.sprintId ? await checkSprint(tx, actor.orgId, projectId, input.sprintId) : null,
      storyPoints: input.storyPoints ?? null,
      position: input.position ?? Date.now() / 1000,
      startDate: input.startDate ?? null,
      serviceId: input.serviceId ?? null,
      incidentId: input.incidentId ?? null,
      completedAt: status.category === 'done' ? new Date().toISOString() : null,
    });
    for (const watcher of new Set([actor.userId, row.assigneeId].filter((v): v is number => typeof v === 'number'))) {
      await tx.orm.public.TaskWatcher.create({ organizationId: actor.orgId, taskId: row.id, userId: watcher });
    }
    await addActivity(tx, actor, row.id, 'created', { status: status.name });
    if (row.assigneeId !== null) await addActivity(tx, actor, row.id, 'assigned', { to: row.assigneeId });
    return row;
  });
  const view = (await getTask(actor.orgId, created.id)).task;
  void afterTaskChange(actor, view, { assignedTo: view.assignee?.id ?? null, created: true, mentions: extractMentions(view.description) });
  return view;
}

/** Validate a sprint id belongs to the same project and is not completed. */
async function checkSprint(tx: TenantTx, orgId: string, projectId: string, sprintId: string): Promise<string> {
  const sprint = await tx.orm.public.Sprint.where({ id: sprintId, organizationId: orgId, projectId }).first();
  if (!sprint) throw new OrgError('VALIDATION_ERROR', 'Sprint not found in this project', 400);
  if (sprint.status === 'completed') throw new OrgError('VALIDATION_ERROR', 'That sprint is already completed', 400);
  return sprint.id;
}

/** `@alice` or `@alice@example.com` mentions in markdown text. */
export function extractMentions(text: string | null | undefined): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const m of text.matchAll(/(^|[\s(])@([a-zA-Z0-9._%+-]+(?:@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})?)/g)) found.add((m[2] ?? '').toLowerCase());
  return [...found].slice(0, 20);
}

/** Resolve mention handles (email, email local-part or username) to member user ids. */
async function resolveMentions(orgId: string, handles: string[]): Promise<number[]> {
  if (handles.length === 0) return [];
  const members = await withTenant(orgId, (tx) => tx.orm.public.Membership.where({ organizationId: orgId }).all());
  if (members.length === 0) return [];
  const users = await db.orm.public.User.where((u) => u.id.in(members.map((m) => m.userId))).all();
  const ids: number[] = [];
  for (const u of users) {
    const keys = [u.email.toLowerCase(), (u.email.split('@')[0] ?? '').toLowerCase(), (u.username ?? '').toLowerCase()];
    if (handles.some((h) => keys.includes(h))) ids.push(u.id);
  }
  return ids;
}

export async function companyIdFor(orgId: string): Promise<number | null> {
  const org = await withTenant(orgId, (tx) => tx.orm.public.Organization.where({ id: orgId }).first());
  return org?.companyId ?? null;
}

/** Notifications and webhooks after a ticket changes (best effort, outside the transaction). */
async function afterTaskChange(
  actor: Actor,
  task: TaskView,
  change: { assignedTo?: number | null; created?: boolean; statusTo?: string | null; mentions?: string[]; commentBody?: string },
): Promise<void> {
  try {
    const companyId = await companyIdFor(actor.orgId);
    if (companyId === null) return;
    const link = `/dashboard/tasks/${task.ref}`;
    if (change.assignedTo) {
      await notifyUsers(companyId, [change.assignedTo], {
        type: 'task.assigned',
        title: `${task.ref} assigned to you: ${task.title}`,
        body: `Priority ${task.priority}${task.dueDate ? ` · due ${task.dueDate.slice(0, 10)}` : ''}`,
        link,
        entityType: 'task',
        entityId: task.id,
        excludeUserId: actor.userId,
      });
    }
    const mentioned = await resolveMentions(actor.orgId, change.mentions ?? []);
    if (mentioned.length) {
      await notifyUsers(companyId, mentioned, {
        type: 'task.mentioned',
        title: `You were mentioned on ${task.ref}`,
        body: change.commentBody?.slice(0, 500) ?? task.title,
        link,
        entityType: 'task',
        entityId: task.id,
        excludeUserId: actor.userId,
      });
      await withTenant(actor.orgId, async (tx) => {
        for (const userId of mentioned) {
          const exists = await tx.orm.public.TaskWatcher.where({ taskId: task.id, userId }).first();
          if (!exists) await tx.orm.public.TaskWatcher.create({ organizationId: actor.orgId, taskId: task.id, userId });
        }
      });
    }
    if (change.commentBody !== undefined || change.statusTo) {
      const watchers = await withTenant(actor.orgId, (tx) => tx.orm.public.TaskWatcher.where({ taskId: task.id, organizationId: actor.orgId }).all());
      const ids = watchers.map((w) => w.userId).filter((id) => !mentioned.includes(id));
      await notifyUsers(companyId, ids, {
        type: change.commentBody !== undefined ? 'task.comment' : 'task.status',
        title: change.commentBody !== undefined ? `New comment on ${task.ref}` : `${task.ref} moved to ${change.statusTo}`,
        body: change.commentBody?.slice(0, 500) ?? task.title,
        link,
        entityType: 'task',
        entityId: task.id,
        excludeUserId: actor.userId,
      });
    }
    await emitEvent(companyId, change.created ? 'task.created' : 'task.updated', {
      task: { id: task.id, ref: task.ref, title: task.title, status: task.status.name, priority: task.priority, assigneeId: task.assignee?.id ?? null },
    });
  } catch {
    // Notifications never break ticket writes.
  }
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
    const watchers = await tx.orm.public.TaskWatcher.where({ taskId: row.id, organizationId: orgId }).all();
    const blockedBy = await tx.orm.public.TaskDependency.where({ taskId: row.id, organizationId: orgId }).all();
    const blocks = await tx.orm.public.TaskDependency.where({ dependsOnId: row.id, organizationId: orgId }).all();
    const depIds = [...blockedBy.map((d) => d.dependsOnId), ...blocks.map((d) => d.taskId)];
    const depRows = depIds.length ? await tx.orm.public.Task.where((t) => and(t.organizationId.eq(orgId), t.id.in(depIds))).all() : [];
    const depViews = await toViews(tx, orgId, depRows);
    const attachments = await tx.orm.public.TaskAttachment.select('id', 'fileName', 'contentType', 'sizeBytes', 'uploaderId', 'createdAt')
      .where({ taskId: row.id, organizationId: orgId })
      .all();
    const commentIds = comments.map((c) => c.id);
    const reactions = commentIds.length ? await tx.orm.public.CommentReaction.where((r) => and(r.organizationId.eq(orgId), r.commentId.in(commentIds))).all() : [];
    const sprint = row.sprintId ? await tx.orm.public.Sprint.where({ id: row.sprintId, organizationId: orgId }).first() : null;
    const extra = {
      watcherIds: watchers.map((w) => w.userId),
      blockedBy: blockedBy.map((d) => ({ dependencyId: d.id, task: depViews.find((v) => v.id === d.dependsOnId) ?? null })).filter((d) => d.task),
      blocks: blocks.map((d) => ({ dependencyId: d.id, task: depViews.find((v) => v.id === d.taskId) ?? null })).filter((d) => d.task),
      attachments,
      reactions,
      sprint: sprint ? { id: sprint.id, name: sprint.name, status: sprint.status } : null,
    };
    return { extra, view, comments, activities, children: related.filter((r) => r.parentId === row.id), parent: related.find((r) => r.id === row.parentId) ?? null, statuses };
  });
  if (!data) throw new OrgError('NOT_FOUND', 'Ticket not found', 404);

  const users = await loadUsers([
    ...data.comments.map((c) => c.authorId),
    ...data.activities.map((a) => a.actorId),
    ...data.extra.watcherIds,
    ...data.extra.attachments.map((a) => a.uploaderId),
  ]);
  const name = (id: number | null) => (id !== null ? (users.get(id) ?? null) : null);
  return {
    task: data.view,
    parent: data.parent,
    subtasks: data.children.sort((a, b) => a.number - b.number),
    statuses: data.statuses
      .map((s) => ({ id: s.id, name: s.name, category: s.category, position: s.position }))
      .sort((a, b) => a.position - b.position),
    watchers: data.extra.watcherIds.map((id) => name(id)).filter(Boolean),
    blockedBy: data.extra.blockedBy,
    blocks: data.extra.blocks,
    sprint: data.extra.sprint,
    attachments: data.extra.attachments.map((a) => ({ ...a, uploader: name(a.uploaderId) })),
    comments: data.comments
      .map((c) => ({
        id: c.id,
        body: c.body,
        author: name(c.authorId),
        createdAt: c.createdAt,
        editedAt: c.editedAt,
        reactions: Object.entries(
          data.extra.reactions
            .filter((r) => r.commentId === c.id)
            .reduce<Record<string, number[]>>((acc, r) => ((acc[r.emoji] ??= []).push(r.userId), acc), {}),
        ).map(([emoji, userIds]) => ({ emoji, count: userIds.length, userIds })),
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    activity: data.activities
      .map((a) => ({ id: a.id, type: a.type, data: a.data, actor: name(a.actorId), createdAt: a.createdAt }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

export type TaskFilter = {
  projectId?: string;
  assigneeId?: number | null;
  reporterId?: number;
  statusId?: string;
  statusCategory?: 'todo' | 'in_progress' | 'done' | 'open';
  type?: TaskType;
  priority?: TaskPriority;
  sprintId?: string | null;
  label?: string;
  q?: string;
  overdue?: boolean;
  dueFrom?: string;
  dueTo?: string;
  updatedSince?: string;
  serviceId?: number;
  incidentId?: number;
  watcherId?: number;
  sort?: 'created' | 'updated' | 'due' | 'priority' | 'position' | 'number';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

const PRIORITY_RANK: Record<string, number> = { highest: 0, high: 1, medium: 2, low: 3, lowest: 4 };

/** Filtered, sorted, paginated ticket search; hard-capped so a board or list can never become unbounded. */
export async function listTasks(orgId: string, filter: TaskFilter): Promise<{ tasks: TaskView[]; truncated: boolean; total: number }> {
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), MAX_LIST);
  const offset = Math.max(filter.offset ?? 0, 0);

  return withTenant(orgId, async (tx) => {
    let query = tx.orm.public.Task.where({ organizationId: orgId });
    if (filter.projectId) query = query.where({ projectId: filter.projectId });
    if (filter.assigneeId === null) query = query.where((t) => t.assigneeId.isNull());
    else if (filter.assigneeId !== undefined) query = query.where({ assigneeId: filter.assigneeId });
    if (filter.reporterId !== undefined) query = query.where({ reporterId: filter.reporterId });
    if (filter.statusId) query = query.where({ statusId: filter.statusId });
    if (filter.type) query = query.where({ type: filter.type });
    if (filter.priority) query = query.where({ priority: filter.priority });
    if (filter.sprintId === null) query = query.where((t) => t.sprintId.isNull());
    else if (filter.sprintId) query = query.where({ sprintId: filter.sprintId });
    if (filter.serviceId !== undefined) query = query.where({ serviceId: filter.serviceId });
    if (filter.incidentId !== undefined) query = query.where({ incidentId: filter.incidentId });
    if (filter.q) {
      const like = `%${filter.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      query = query.where((t) => t.title.ilike(like));
    }
    if (filter.dueFrom) query = query.where((t) => t.dueDate.gte(filter.dueFrom!));
    if (filter.dueTo) query = query.where((t) => t.dueDate.lte(filter.dueTo!));
    if (filter.updatedSince) query = query.where((t) => t.updatedAt.gte(filter.updatedSince!));
    if (filter.overdue) query = query.where((t) => t.dueDate.lt(new Date().toISOString()));
    if (filter.statusCategory) {
      const statuses = await tx.orm.public.ProjectStatus.where({ organizationId: orgId }).all();
      const wanted = statuses
        .filter((st) => (filter.statusCategory === 'open' ? st.category !== 'done' : st.category === filter.statusCategory))
        .map((st) => st.id);
      if (wanted.length === 0) return { tasks: [], truncated: false, total: 0 };
      query = query.where((t) => t.statusId.in(wanted));
    }
    if (filter.overdue && !filter.statusCategory) {
      const done = (await tx.orm.public.ProjectStatus.where({ organizationId: orgId, category: 'done' }).all()).map((st) => st.id);
      if (done.length) query = query.where((t) => not(t.statusId.in(done)));
    }
    if (filter.watcherId !== undefined) {
      const watched = await tx.orm.public.TaskWatcher.where({ organizationId: orgId, userId: filter.watcherId }).all();
      if (watched.length === 0) return { tasks: [], truncated: false, total: 0 };
      query = query.where((t) => t.id.in(watched.map((w) => w.taskId)));
    }

    const desc = (filter.order ?? 'desc') === 'desc';
    const sort = filter.sort ?? 'created';
    let rows;
    if (sort === 'priority' || filter.label) {
      // Priority needs a custom rank and labels live in JSON: sort/filter in memory over a bounded set.
      const all = await query.orderBy((t) => t.createdAt.desc()).limit(MAX_LIST * 4).all();
      const filtered = filter.label ? all.filter((r) => parseLabels(r.labels).includes(filter.label!)) : all;
      if (sort === 'priority') filtered.sort((a, b) => (PRIORITY_RANK[a.priority]! - PRIORITY_RANK[b.priority]!) * (desc ? 1 : -1));
      rows = filtered.slice(offset, offset + limit + 1);
    } else {
      const ordered =
        sort === 'updated'
          ? query.orderBy((t) => (desc ? t.updatedAt.desc() : t.updatedAt.asc()))
          : sort === 'due'
            ? query.orderBy((t) => (desc ? t.dueDate.desc({ nulls: 'last' }) : t.dueDate.asc({ nulls: 'last' })))
            : sort === 'position'
              ? query.orderBy([(t) => t.position.asc(), (t) => t.createdAt.asc()])
              : sort === 'number'
                ? query.orderBy((t) => (desc ? t.number.desc() : t.number.asc()))
                : query.orderBy((t) => (desc ? t.createdAt.desc() : t.createdAt.asc()));
      rows = await ordered.offset(offset).limit(limit + 1).all();
    }
    const page = rows.slice(0, limit);
    return { tasks: await toViews(tx, orgId, page), truncated: rows.length > limit, total: offset + rows.length };
  });
}

export async function updateTask(
  actor: Actor,
  ref: string,
  patch: Partial<Omit<TaskInput, 'statusId'>> & { statusId?: string },
): Promise<TaskView> {
  const notes: { assignedTo?: number | null; statusTo?: string | null; mentions?: string[] } = {};
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
      notes.mentions = extractMentions(patch.description).filter((m) => !extractMentions(locked.description).includes(m));
    }
    if (patch.sprintId !== undefined && patch.sprintId !== locked.sprintId) {
      data.sprintId = patch.sprintId ? await checkSprint(tx, actor.orgId, locked.projectId, patch.sprintId) : null;
      changes.push(['sprint_changed', { to: patch.sprintId }]);
    }
    if (patch.storyPoints !== undefined && patch.storyPoints !== locked.storyPoints) {
      data.storyPoints = patch.storyPoints;
      changes.push(['points_changed', { from: locked.storyPoints, to: patch.storyPoints }]);
    }
    if (patch.position !== undefined && patch.position !== locked.position) data.position = patch.position;
    if (patch.startDate !== undefined && patch.startDate !== locked.startDate) data.startDate = patch.startDate;
    if (patch.serviceId !== undefined && patch.serviceId !== locked.serviceId) {
      data.serviceId = patch.serviceId;
      changes.push(['service_linked', { to: patch.serviceId }]);
    }
    if (patch.incidentId !== undefined && patch.incidentId !== locked.incidentId) {
      data.incidentId = patch.incidentId;
      changes.push(['incident_linked', { to: patch.incidentId }]);
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
      data.completedAt = to.category === 'done' ? new Date().toISOString() : null;
      changes.push(['status_changed', { from: from?.name ?? null, to: to.name }]);
      notes.statusTo = to.name;
    }
    if (patch.assigneeId !== undefined && patch.assigneeId !== locked.assigneeId) {
      // Taking over or releasing someone else's ticket is an assignment decision reserved for admins.
      if (locked.assigneeId !== null && locked.assigneeId !== actor.userId && !can(actor.role, 'tasks:assign')) {
        throw new OrgError('FORBIDDEN', 'Only admins can change who a ticket is assigned to', 403);
      }
      await checkAssignee(tx, actor, patch.assigneeId);
      data.assigneeId = patch.assigneeId;
      changes.push(['assigned', { from: locked.assigneeId, to: patch.assigneeId }]);
      notes.assignedTo = patch.assigneeId;
      if (patch.assigneeId !== null) {
        const watching = await tx.orm.public.TaskWatcher.where({ taskId: locked.id, userId: patch.assigneeId }).first();
        if (!watching) await tx.orm.public.TaskWatcher.create({ organizationId: actor.orgId, taskId: locked.id, userId: patch.assigneeId });
      }
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
  const view = (await getTask(actor.orgId, id)).task;
  if (notes.assignedTo || notes.statusTo || notes.mentions?.length) void afterTaskChange(actor, view, notes);
  return view;
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
    const watching = await tx.orm.public.TaskWatcher.where({ taskId: row.id, userId: actor.userId }).first();
    if (!watching) await tx.orm.public.TaskWatcher.create({ organizationId: actor.orgId, taskId: row.id, userId: actor.userId });
  });
  const current = await getTask(actor.orgId, ref);
  void afterTaskChange(actor, current.task, { commentBody: body, mentions: extractMentions(body) });
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

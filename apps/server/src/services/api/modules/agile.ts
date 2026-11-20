import { z } from 'zod';
import { and } from '@prisma/orm-postgres/orm-client';
import { db } from '../../../prisma/db.js';
import { withTenant, type TenantTx } from '../../../prisma/tenant.js';
import { badRequest, conflict, displayName, intParam, isUuid, notFound, ok, parseBody, uuidParam, type RouteContext } from '../../../lib/http.js';
import { deleteTask, getTask, updateTask } from '../../work/tasks.js';

const uuid = z.string().uuid();
const isoDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((d) => `${d}T00:00:00.000Z`), z.string().datetime({ offset: true })]);

const sprintCreate = z.object({ name: z.string().trim().min(1).max(100), goal: z.string().trim().max(2000).nullable().optional(), startDate: isoDate.nullable().optional(), endDate: isoDate.nullable().optional() }).strict();
const sprintUpdate = sprintCreate.partial().strict();
const completeSchema = z.object({ moveOpenTo: z.union([uuid, z.literal('backlog')]).default('backlog') }).strict();
const bulkSchema = z
  .object({
    refs: z.array(z.string().min(1).max(40)).min(1).max(100),
    action: z.enum(['update', 'delete']),
    patch: z
      .object({
        statusId: uuid.optional(),
        assigneeId: z.number().int().positive().nullable().optional(),
        priority: z.enum(['lowest', 'low', 'medium', 'high', 'highest']).optional(),
        sprintId: uuid.nullable().optional(),
        labels: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
const filterSchema = z.object({ name: z.string().trim().min(1).max(80), scope: z.enum(['tasks', 'incidents']).default('tasks'), query: z.record(z.string(), z.string().max(200)), shared: z.boolean().default(false) }).strict();
const MAX_ATTACHMENT = Number(process.env.MAX_ATTACHMENT_BYTES) || 2 * 1024 * 1024;
const ALLOWED_TYPES = /^(image\/(png|jpeg|gif|webp)|application\/pdf|text\/(plain|csv|markdown)|application\/json|application\/zip)$/;
const attachmentSchema = z.object({ fileName: z.string().trim().min(1).max(200), contentType: z.string().max(100), contentBase64: z.string().max(Math.ceil(MAX_ATTACHMENT * 1.37) + 16) }).strict();

async function findTaskId(tx: TenantTx, orgId: string, ref: string): Promise<{ id: string; projectId: string }> {
  const m = /^([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/.exec(ref);
  let row = null;
  if (m) {
    const project = await tx.orm.public.Project.where({ organizationId: orgId, key: (m[1] ?? '').toUpperCase() }).first();
    if (project) row = await tx.orm.public.Task.where({ projectId: project.id, organizationId: orgId, number: Number(m[2]) }).first();
  } else if (isUuid(ref)) row = await tx.orm.public.Task.where({ id: ref, organizationId: orgId }).first();
  if (!row) throw notFound('Ticket');
  return { id: row.id, projectId: row.projectId };
}

/** Burndown series for a sprint: remaining story points (fallback: ticket count) per day. */
async function sprintBurndown(tx: TenantTx, orgId: string, sprint: { id: string; startDate: string | null; endDate: string | null; startedAt: string | null; completedAt: string | null; createdAt: string }) {
  const tasks = await tx.orm.public.Task.where({ organizationId: orgId, sprintId: sprint.id }).all();
  const usePoints = tasks.some((t) => (t.storyPoints ?? 0) > 0);
  const weight = (t: { storyPoints: number | null }) => (usePoints ? (t.storyPoints ?? 0) : 1);
  const total = tasks.reduce((a, t) => a + weight(t), 0);
  const start = Date.parse(sprint.startDate ?? sprint.startedAt ?? sprint.createdAt);
  const end = Date.parse(sprint.endDate ?? sprint.completedAt ?? new Date(start + 14 * 86_400_000).toISOString());
  const days = Math.max(1, Math.min(90, Math.ceil((end - start) / 86_400_000)));
  const series: Array<{ date: string; remaining: number | null; ideal: number }> = [];
  for (let i = 0; i <= days; i++) {
    const at = start + i * 86_400_000;
    const done = tasks.filter((t) => t.completedAt && Date.parse(t.completedAt) <= at).reduce((a, t) => a + weight(t), 0);
    series.push({ date: new Date(at).toISOString().slice(0, 10), remaining: at <= Date.now() ? total - done : null, ideal: Math.round((total - (total * i) / days) * 10) / 10 });
  }
  const completed = tasks.filter((t) => t.completedAt).reduce((a, t) => a + weight(t), 0);
  return { unit: usePoints ? 'points' : 'tickets', total, completed, remaining: total - completed, series, taskCount: tasks.length, doneCount: tasks.filter((t) => t.completedAt).length };
}

export async function agileRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments: seg, method, auth } = ctx;
  const orgId = auth.orgId;

  // ---- /projects/:id/sprints, /projects/:id/overview, /projects/:id/members, /projects/:id/activity, /projects/:id/velocity
  if (seg[0] === 'projects' && seg[1] && ['sprints', 'overview', 'members', 'activity', 'velocity'].includes(seg[2] ?? '')) {
    const projectId = uuidParam(seg[1], 'Project');
    const sub = seg[2];
    if (method === 'GET') ctx.need('projects:read');

    if (sub === 'sprints' && seg.length === 3) {
      if (method === 'GET') {
        const sprints = await withTenant(orgId, async (tx) => {
          const rows = await tx.orm.public.Sprint.where({ organizationId: orgId, projectId }).orderBy((s) => s.createdAt.desc()).all();
          const out = [];
          for (const s of rows) out.push({ ...s, progress: await sprintBurndown(tx, orgId, s).then(({ series: _s, ...rest }) => rest) });
          return out;
        });
        return ok({ sprints });
      }
      if (method === 'POST') {
        ctx.need('sprints:manage');
        const body = await parseBody(ctx, sprintCreate);
        const sprint = await withTenant(orgId, async (tx) => {
          const project = await tx.orm.public.Project.where({ id: projectId, organizationId: orgId }).first();
          if (!project) throw notFound('Project');
          return tx.orm.public.Sprint.create({ organizationId: orgId, projectId, name: body.name, goal: body.goal ?? null, startDate: body.startDate ?? null, endDate: body.endDate ?? null, status: 'planned' });
        });
        return ok({ sprint }, 201);
      }
    }
    if (sub === 'sprints' && seg[3]) {
      const sprintId = uuidParam(seg[3], 'Sprint');
      const action = seg[4];
      if (method === 'GET' && !action) {
        const data = await withTenant(orgId, async (tx) => {
          const sprint = await tx.orm.public.Sprint.where({ id: sprintId, organizationId: orgId, projectId }).first();
          if (!sprint) throw notFound('Sprint');
          return { sprint, burndown: await sprintBurndown(tx, orgId, sprint) };
        });
        return ok(data);
      }
      ctx.need('sprints:manage');
      const result = await withTenant(orgId, async (tx) => {
        const sprint = await tx.orm.public.Sprint.where({ id: sprintId, organizationId: orgId, projectId }).forUpdate().first();
        if (!sprint) throw notFound('Sprint');
        if (method === 'PATCH' && !action) {
          const body = sprintUpdate.parse(await ctx.readJson());
          return tx.orm.public.Sprint.where({ id: sprintId }).update(body as never);
        }
        if (method === 'DELETE' && !action) {
          if (sprint.status === 'active') throw conflict('Complete the sprint before deleting it');
          await tx.orm.public.Task.where({ organizationId: orgId, sprintId }).updateAll({ sprintId: null });
          await tx.orm.public.Sprint.where({ id: sprintId }).delete();
          return null;
        }
        if (method === 'POST' && action === 'start') {
          if (sprint.status !== 'planned') throw conflict('Only a planned sprint can be started');
          const active = await tx.orm.public.Sprint.where({ organizationId: orgId, projectId, status: 'active' }).first();
          if (active) throw conflict(`Sprint "${active.name}" is already active`);
          const now = new Date().toISOString();
          return tx.orm.public.Sprint.where({ id: sprintId }).update({
            status: 'active',
            startedAt: now,
            startDate: sprint.startDate ?? now,
            endDate: sprint.endDate ?? new Date(Date.now() + 14 * 86_400_000).toISOString(),
          });
        }
        if (method === 'POST' && action === 'complete') {
          if (sprint.status !== 'active') throw conflict('Only an active sprint can be completed');
          const body = completeSchema.parse((await ctx.readJson()) ?? {});
          const burn = await sprintBurndown(tx, orgId, sprint);
          const open = (await tx.orm.public.Task.where({ organizationId: orgId, sprintId }).all()).filter((t) => !t.completedAt);
          let target: string | null = null;
          if (body.moveOpenTo !== 'backlog') {
            const next = await tx.orm.public.Sprint.where({ id: body.moveOpenTo, organizationId: orgId, projectId }).first();
            if (!next || next.status === 'completed') throw badRequest('Target sprint is not available');
            target = next.id;
          }
          for (const t of open) await tx.orm.public.Task.where({ id: t.id }).update({ sprintId: target });
          return tx.orm.public.Sprint.where({ id: sprintId }).update({
            status: 'completed',
            completedAt: new Date().toISOString(),
            summary: { unit: burn.unit, committed: burn.total, completed: burn.completed, committedCount: burn.taskCount, completedCount: burn.doneCount, carriedOver: open.length } as never,
          });
        }
        throw notFound('Route');
      });
      return ok({ sprint: result });
    }

    if (sub === 'velocity' && method === 'GET') {
      const sprints = await withTenant(orgId, (tx) => tx.orm.public.Sprint.where({ organizationId: orgId, projectId, status: 'completed' }).orderBy((s) => s.completedAt.asc()).all());
      const points = sprints.map((s) => ({ id: s.id, name: s.name, completedAt: s.completedAt, ...((s.summary as Record<string, number>) ?? {}) }));
      const recent = points.slice(-3).map((p) => Number(p.completed ?? 0));
      return ok({ sprints: points, averageVelocity: recent.length ? Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 10) / 10 : null });
    }

    if (sub === 'members') {
      if (method === 'GET') {
        const rows = await withTenant(orgId, (tx) => tx.orm.public.ProjectMember.where({ organizationId: orgId, projectId }).all());
        const users = rows.length ? await db.orm.public.User.where((u) => u.id.in(rows.map((r) => r.userId))).all() : [];
        return ok({ members: rows.map((r) => ({ id: r.id, role: r.role, user: (() => { const u = users.find((x) => x.id === r.userId); return u ? { id: u.id, name: displayName(u), email: u.email, avatarUrl: u.avatarUrl } : null; })() })) });
      }
      ctx.need('projects:manage');
      if (method === 'POST' && seg.length === 3) {
        const body = await parseBody(ctx, z.object({ userId: z.number().int().positive(), role: z.enum(['lead', 'member']).default('member') }).strict());
        const row = await withTenant(orgId, async (tx) => {
          const member = await tx.orm.public.Membership.where({ organizationId: orgId, userId: body.userId }).first();
          if (!member) throw badRequest('That user is not a member of this organization');
          const existing = await tx.orm.public.ProjectMember.where({ projectId, userId: body.userId }).first();
          if (existing) return tx.orm.public.ProjectMember.where({ id: existing.id }).update({ role: body.role });
          return tx.orm.public.ProjectMember.create({ organizationId: orgId, projectId, userId: body.userId, role: body.role });
        });
        return ok({ member: row }, 201);
      }
      if (method === 'DELETE' && seg[3]) {
        const userId = intParam(seg[3], 'Member');
        await withTenant(orgId, (tx) => tx.orm.public.ProjectMember.where({ organizationId: orgId, projectId, userId }).delete());
        return ok();
      }
    }

    if (sub === 'activity' && method === 'GET') {
      const data = await withTenant(orgId, async (tx) => {
        const tasks = await tx.orm.public.Task.select('id', 'number', 'title').where({ organizationId: orgId, projectId }).all();
        if (tasks.length === 0) return { tasks, activity: [] };
        const activity = await tx.orm.public.TaskActivity.where((a) => and(a.organizationId.eq(orgId), a.taskId.in(tasks.map((t) => t.id))))
          .orderBy((a) => a.createdAt.desc())
          .limit(60)
          .all();
        return { tasks, activity };
      });
      const project = await withTenant(orgId, (tx) => tx.orm.public.Project.where({ id: projectId, organizationId: orgId }).first());
      const actors = [...new Set(data.activity.map((a) => a.actorId).filter((v): v is number => v !== null))];
      const users = actors.length ? await db.orm.public.User.where((u) => u.id.in(actors)).all() : [];
      return ok({
        activity: data.activity.map((a) => {
          const t = data.tasks.find((x) => x.id === a.taskId);
          return { id: a.id, type: a.type, data: a.data, createdAt: a.createdAt, actor: displayName(users.find((u) => u.id === a.actorId)), task: t ? { ref: `${project?.key}-${t.number}`, title: t.title } : null };
        }),
      });
    }

    if (sub === 'overview' && method === 'GET') {
      const data = await withTenant(orgId, async (tx) => {
        const project = await tx.orm.public.Project.where({ id: projectId, organizationId: orgId }).first();
        if (!project) throw notFound('Project');
        const statuses = await tx.orm.public.ProjectStatus.where({ organizationId: orgId, projectId }).all();
        const tasks = await tx.orm.public.Task.select('id', 'statusId', 'priority', 'type', 'assigneeId', 'dueDate', 'completedAt', 'createdAt', 'storyPoints').where({ organizationId: orgId, projectId }).all();
        const active = await tx.orm.public.Sprint.where({ organizationId: orgId, projectId, status: 'active' }).first();
        return { project, statuses, tasks, active, burndown: active ? await sprintBurndown(tx, orgId, active) : null };
      });
      const doneIds = new Set(data.statuses.filter((s) => s.category === 'done').map((s) => s.id));
      const now = Date.now();
      const open = data.tasks.filter((t) => !doneIds.has(t.statusId));
      const overdue = open.filter((t) => t.dueDate && Date.parse(t.dueDate) < now);
      const services = await db.orm.public.Service.where({ projectId }).all();
      const incidents = await db.orm.public.Incident.where({ projectId }).orderBy((i) => i.detectedAt.desc()).limit(10).all();
      const weekAgo = now - 7 * 86_400_000;
      const health =
        incidents.some((i) => i.status !== 'resolved' && (i.severity === 'sev1' || i.severity === 'sev2')) || services.some((s) => s.healthStatus === 'down')
          ? 'at_risk'
          : overdue.length > Math.max(3, open.length * 0.2)
            ? 'behind'
            : 'on_track';
      return ok({
        health,
        stats: {
          total: data.tasks.length,
          open: open.length,
          done: data.tasks.length - open.length,
          overdue: overdue.length,
          unassigned: open.filter((t) => t.assigneeId === null).length,
          createdLast7d: data.tasks.filter((t) => Date.parse(t.createdAt) >= weekAgo).length,
          completedLast7d: data.tasks.filter((t) => t.completedAt && Date.parse(t.completedAt) >= weekAgo).length,
          byStatus: data.statuses.sort((a, b) => a.position - b.position).map((s) => ({ id: s.id, name: s.name, category: s.category, count: data.tasks.filter((t) => t.statusId === s.id).length })),
          byPriority: ['highest', 'high', 'medium', 'low', 'lowest'].map((p) => ({ priority: p, count: open.filter((t) => t.priority === p).length })),
          byType: ['epic', 'story', 'task', 'bug', 'subtask'].map((p) => ({ type: p, count: open.filter((t) => t.type === p).length })),
        },
        activeSprint: data.active ? { ...data.active, burndown: data.burndown } : null,
        services: services.map((s) => ({ id: s.id, name: s.name, healthStatus: s.healthStatus, environment: s.environment })),
        incidents: incidents.map((i) => ({ id: i.id, title: i.title, severity: i.severity, status: i.status, detectedAt: i.detectedAt })),
      });
    }
  }

  // ---- /tasks/bulk
  if (seg[0] === 'tasks' && seg[1] === 'bulk' && method === 'POST') {
    const body = await parseBody(ctx, bulkSchema);
    ctx.need(body.action === 'delete' ? 'tasks:delete' : 'tasks:update');
    const results: Array<{ ref: string; ok: boolean; error?: string }> = [];
    for (const ref of body.refs) {
      try {
        if (body.action === 'delete') await deleteTask(ctx.actor, ref);
        else await updateTask(ctx.actor, ref, body.patch ?? {});
        results.push({ ref, ok: true });
      } catch (error) {
        results.push({ ref, ok: false, error: error instanceof Error ? error.message : 'failed' });
      }
    }
    return ok({ results });
  }

  // ---- /tasks/:ref/(watchers|dependencies|attachments|comments/:id[/reactions])
  if (seg[0] === 'tasks' && seg[1] && ['watchers', 'dependencies', 'attachments', 'comments'].includes(seg[2] ?? '') && seg.length >= 3) {
    const ref = decodeURIComponent(seg[1]);
    const sub = seg[2];
    if (sub === 'comments' && seg.length === 3) return null; // POST handled by work routes
    if (method === 'GET') ctx.need('projects:read');
    else ctx.need('tasks:update');

    if (sub === 'watchers') {
      // POST/DELETE toggles the caller's own watch.
      await withTenant(orgId, async (tx) => {
        const task = await findTaskId(tx, orgId, ref);
        const existing = await tx.orm.public.TaskWatcher.where({ taskId: task.id, userId: auth.userId }).first();
        if (method === 'POST' && !existing) await tx.orm.public.TaskWatcher.create({ organizationId: orgId, taskId: task.id, userId: auth.userId });
        if (method === 'DELETE' && existing) await tx.orm.public.TaskWatcher.where({ id: existing.id }).delete();
      });
      return ok({ watching: method === 'POST' });
    }

    if (sub === 'dependencies') {
      if (method === 'POST') {
        const body = await parseBody(ctx, z.object({ dependsOn: z.string().min(1).max(40) }).strict());
        await withTenant(orgId, async (tx) => {
          const task = await findTaskId(tx, orgId, ref);
          const blocker = await findTaskId(tx, orgId, body.dependsOn);
          if (task.id === blocker.id) throw badRequest('A ticket cannot depend on itself');
          // Reject a direct cycle (blocker already waits on this ticket).
          const reverse = await tx.orm.public.TaskDependency.where({ taskId: blocker.id, dependsOnId: task.id }).first();
          if (reverse) throw badRequest('That would create a circular dependency');
          const exists = await tx.orm.public.TaskDependency.where({ taskId: task.id, dependsOnId: blocker.id }).first();
          if (!exists) await tx.orm.public.TaskDependency.create({ organizationId: orgId, taskId: task.id, dependsOnId: blocker.id });
          await tx.orm.public.TaskActivity.create({ organizationId: orgId, taskId: task.id, actorId: auth.userId, type: 'dependency_added', data: { dependsOn: body.dependsOn } as never });
        });
        return ok({}, 201);
      }
      if (method === 'DELETE' && seg[3]) {
        const depId = uuidParam(seg[3], 'Dependency');
        await withTenant(orgId, (tx) => tx.orm.public.TaskDependency.where({ id: depId, organizationId: orgId }).delete());
        return ok();
      }
    }

    if (sub === 'attachments') {
      if (method === 'POST' && seg.length === 3) {
        const body = await parseBody(ctx, attachmentSchema);
        if (!ALLOWED_TYPES.test(body.contentType)) throw badRequest('This file type is not allowed');
        const buf = Buffer.from(body.contentBase64, 'base64');
        if (buf.length === 0 || buf.length > MAX_ATTACHMENT) throw badRequest(`Files must be between 1 byte and ${Math.round(MAX_ATTACHMENT / 1024)} KB`);
        const safeName = body.fileName.replace(/[^\w.\- ]+/g, '_').slice(0, 200);
        const row = await withTenant(orgId, async (tx) => {
          const task = await findTaskId(tx, orgId, ref);
          const created = await tx.orm.public.TaskAttachment.create({ organizationId: orgId, taskId: task.id, uploaderId: auth.userId, fileName: safeName, contentType: body.contentType, sizeBytes: buf.length, contentBase64: buf.toString('base64') });
          await tx.orm.public.TaskActivity.create({ organizationId: orgId, taskId: task.id, actorId: auth.userId, type: 'attachment_added', data: { fileName: safeName } as never });
          return created;
        });
        return ok({ attachment: { id: row.id, fileName: row.fileName, contentType: row.contentType, sizeBytes: row.sizeBytes, createdAt: row.createdAt } }, 201);
      }
      if (seg[3]) {
        const attId = uuidParam(seg[3], 'Attachment');
        if (method === 'GET') {
          const att = await withTenant(orgId, async (tx) => {
            const task = await findTaskId(tx, orgId, ref);
            return tx.orm.public.TaskAttachment.where({ id: attId, taskId: task.id, organizationId: orgId }).first();
          });
          if (!att) throw notFound('Attachment');
          // Served as a download with a locked-down content type so it can never execute in our origin.
          return new Response(Buffer.from(att.contentBase64, 'base64'), {
            status: 200,
            headers: {
              'content-type': att.contentType.startsWith('image/') || att.contentType === 'application/pdf' ? att.contentType : 'application/octet-stream',
              'content-disposition': `attachment; filename="${att.fileName.replace(/"/g, '')}"`,
              'content-security-policy': "default-src 'none'; sandbox",
              'x-content-type-options': 'nosniff',
            },
          });
        }
        if (method === 'DELETE') {
          await withTenant(orgId, async (tx) => {
            const att = await tx.orm.public.TaskAttachment.where({ id: attId, organizationId: orgId }).first();
            if (!att) throw notFound('Attachment');
            if (att.uploaderId !== auth.userId) ctx.need('tasks:delete');
            await tx.orm.public.TaskAttachment.where({ id: attId }).delete();
          });
          return ok();
        }
      }
    }

    if (sub === 'comments' && seg[3]) {
      const commentId = uuidParam(seg[3], 'Comment');
      if (seg[4] === 'reactions' && (method === 'POST' || method === 'DELETE')) {
        const body = await parseBody(ctx, z.object({ emoji: z.enum(['👍', '👎', '🎉', '❤️', '👀', '🚀', '😕']) }).strict());
        await withTenant(orgId, async (tx) => {
          const c = await tx.orm.public.TaskComment.where({ id: commentId, organizationId: orgId }).first();
          if (!c) throw notFound('Comment');
          const existing = await tx.orm.public.CommentReaction.where({ commentId, userId: auth.userId, emoji: body.emoji }).first();
          if (method === 'POST' && !existing) await tx.orm.public.CommentReaction.create({ organizationId: orgId, commentId, userId: auth.userId, emoji: body.emoji });
          if (method === 'DELETE' && existing) await tx.orm.public.CommentReaction.where({ id: existing.id }).delete();
        });
        return ok();
      }
      if (seg.length === 4 && (method === 'PATCH' || method === 'DELETE')) {
        await withTenant(orgId, async (tx) => {
          const c = await tx.orm.public.TaskComment.where({ id: commentId, organizationId: orgId }).first();
          if (!c) throw notFound('Comment');
          if (c.authorId !== auth.userId) {
            if (method === 'PATCH') throw badRequest('You can only edit your own comments');
            ctx.need('tasks:delete');
          }
          if (method === 'PATCH') {
            const body = z.object({ body: z.string().trim().min(1).max(10000) }).strict().parse(await ctx.readJson());
            await tx.orm.public.TaskComment.where({ id: commentId }).update({ body: body.body, editedAt: new Date().toISOString() });
          } else await tx.orm.public.TaskComment.where({ id: commentId }).delete();
        });
        return ok({ comments: (await getTask(orgId, ref)).comments });
      }
    }
  }

  // ---- /saved-filters
  if (seg[0] === 'saved-filters') {
    ctx.need('projects:read');
    if (method === 'GET' && seg.length === 1) {
      const rows = await withTenant(orgId, (tx) => tx.orm.public.SavedFilter.where({ organizationId: orgId }).orderBy((f) => f.name.asc()).all());
      return ok({ filters: rows.filter((f) => f.userId === auth.userId || f.shared).map((f) => ({ ...f, mine: f.userId === auth.userId })) });
    }
    if (method === 'POST' && seg.length === 1) {
      const body = await parseBody(ctx, filterSchema);
      const row = await withTenant(orgId, (tx) => tx.orm.public.SavedFilter.create({ organizationId: orgId, userId: auth.userId, name: body.name, scope: body.scope, query: body.query as never, shared: body.shared }));
      return ok({ filter: row }, 201);
    }
    if (method === 'DELETE' && seg[1]) {
      const id = uuidParam(seg[1], 'Filter');
      await withTenant(orgId, async (tx) => {
        const f = await tx.orm.public.SavedFilter.where({ id, organizationId: orgId }).first();
        if (!f) throw notFound('Filter');
        if (f.userId !== auth.userId) ctx.need('projects:manage');
        await tx.orm.public.SavedFilter.where({ id }).delete();
      });
      return ok();
    }
  }

  return null;
}

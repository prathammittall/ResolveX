import { z } from 'zod';
import { isOrgError } from '../org/errors.js';
import type { Actor } from '../org/members.js';
import { can, isRole, type Permission, type Role } from '../org/permissions.js';
import type { UserTokenPayload } from '../auth/model.js';
import {
  addStatus,
  createProject,
  deleteStatus,
  getProject,
  listProjects,
  updateProject,
  updateStatus,
} from '../work/projects.js';
import { addComment, createTask, deleteTask, getTask, listTasks, updateTask } from '../work/tasks.js';

const uuid = z.string().uuid();
const category = z.enum(['todo', 'in_progress', 'done']);
const taskType = z.enum(['epic', 'story', 'task', 'bug', 'subtask']);
const priority = z.enum(['lowest', 'low', 'medium', 'high', 'highest']);

// A date picker sends YYYY-MM-DD; store it as midnight UTC so it round-trips unchanged.
const dueDate = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((d) => `${d}T00:00:00.000Z`), z.string().datetime({ offset: true })])
  .nullable();
const labels = z.array(z.string().trim().min(1).max(30)).max(10);

const projectCreate = z
  .object({
    name: z.string().trim().min(1).max(100),
    key: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Key must be 2-10 letters/digits starting with a letter'),
    description: z.string().trim().max(2000).nullable().optional(),
  })
  .strict();
const projectUpdate = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    archived: z.boolean().optional(),
  })
  .strict();
const statusCreate = z.object({ name: z.string().trim().min(1).max(40), category }).strict();
const statusUpdate = z
  .object({ name: z.string().trim().min(1).max(40).optional(), category: category.optional(), position: z.number().int().min(0).max(100).optional() })
  .strict();

const taskCreate = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(20000).nullable().optional(),
    type: taskType.optional(),
    priority: priority.optional(),
    statusId: uuid.optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
    dueDate: dueDate.optional(),
    labels: labels.optional(),
    parentId: uuid.nullable().optional(),
  })
  .strict();
const taskUpdate = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(20000).nullable().optional(),
    type: taskType.optional(),
    priority: priority.optional(),
    statusId: uuid.optional(),
    assigneeId: z.number().int().positive().nullable().optional(),
    dueDate: dueDate.optional(),
    labels: labels.optional(),
    parentId: uuid.nullable().optional(),
  })
  .strict();
const commentCreate = z.object({ body: z.string().trim().min(1).max(10000) }).strict();

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (code: string, message: string, status: number, details?: unknown) =>
  json({ ok: false, error: { code, message, details } }, status);

function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): { data: z.infer<S> } | { error: Response } {
  const parsed = schema.safeParse(body);
  return parsed.success
    ? { data: parsed.data }
    : { error: fail('VALIDATION_ERROR', 'Invalid request', 400, parsed.error.flatten()) };
}

/**
 * Projects, workflow statuses, tickets and comments. Returns `null` when the path is not ours.
 * Reads need `projects:read`; creating/updating tickets and commenting need `tasks:create`/`tasks:update`;
 * project and workflow changes need `projects:manage`; deleting tickets needs `tasks:delete`.
 */
export async function workRoutes(
  auth: UserTokenPayload,
  method: string,
  segments: string[],
  searchParams: URLSearchParams,
  readJson: () => Promise<unknown>,
  requestId: string | null,
): Promise<Response | null> {
  const resource = segments[0];
  if (resource !== 'projects' && resource !== 'tasks') return null;

  const role: Role = isRole(auth.role) ? auth.role : 'viewer';
  const actor: Actor = { userId: auth.userId, orgId: auth.orgId, role, requestId };
  const need = (permission: Permission): Response | null =>
    can(auth.role, permission) ? null : fail('FORBIDDEN', 'You do not have permission to perform this action', 403);
  const denyIf = (p: Permission): Response | null => need(p);

  try {
    // ---- /projects ----
    if (resource === 'projects') {
      if (segments.length === 1 && method === 'GET') {
        const denied = denyIf('projects:read');
        if (denied) return denied;
        return json({ ok: true, projects: await listProjects(auth.orgId, searchParams.get('archived') === 'true') });
      }
      if (segments.length === 1 && method === 'POST') {
        const denied = denyIf('projects:manage');
        if (denied) return denied;
        const parsed = parse(projectCreate, await readJson());
        if ('error' in parsed) return parsed.error;
        return json({ ok: true, ...(await createProject(actor, parsed.data)) }, 201);
      }

      const projectId = segments[1] ?? '';
      if (!uuid.safeParse(projectId).success) return fail('NOT_FOUND', 'Project not found', 404);

      if (segments.length === 2 && method === 'GET') {
        const denied = denyIf('projects:read');
        if (denied) return denied;
        return json({ ok: true, ...(await getProject(auth.orgId, projectId)) });
      }
      if (segments.length === 2 && method === 'PATCH') {
        const denied = denyIf('projects:manage');
        if (denied) return denied;
        const parsed = parse(projectUpdate, await readJson());
        if ('error' in parsed) return parsed.error;
        return json({ ok: true, project: await updateProject(actor, projectId, parsed.data) });
      }

      // /projects/:id/tasks
      if (segments[2] === 'tasks' && segments.length === 3) {
        if (method === 'GET') {
          const denied = denyIf('projects:read');
          if (denied) return denied;
          return json({ ok: true, ...(await listTasks(auth.orgId, { projectId, ...filtersFrom(searchParams) })) });
        }
        if (method === 'POST') {
          const denied = denyIf('tasks:create');
          if (denied) return denied;
          const parsed = parse(taskCreate, await readJson());
          if ('error' in parsed) return parsed.error;
          return json({ ok: true, task: await createTask(actor, projectId, parsed.data) }, 201);
        }
      }

      // /projects/:id/statuses[/:statusId]
      if (segments[2] === 'statuses') {
        const denied = denyIf('projects:manage');
        if (denied) return denied;
        if (segments.length === 3 && method === 'POST') {
          const parsed = parse(statusCreate, await readJson());
          if ('error' in parsed) return parsed.error;
          return json({ ok: true, status: await addStatus(actor, projectId, parsed.data) }, 201);
        }
        const statusId = segments[3] ?? '';
        if (segments.length === 4 && uuid.safeParse(statusId).success) {
          if (method === 'PATCH') {
            const parsed = parse(statusUpdate, await readJson());
            if ('error' in parsed) return parsed.error;
            return json({ ok: true, status: await updateStatus(actor, projectId, statusId, parsed.data) });
          }
          if (method === 'DELETE') {
            await deleteStatus(actor, projectId, statusId);
            return json({ ok: true });
          }
        }
      }
      return null;
    }

    // ---- /tasks ----
    if (segments.length === 1 && method === 'GET') {
      const denied = denyIf('projects:read');
      if (denied) return denied;
      const filters = filtersFrom(searchParams);
      // `assignee=me` is the "My work" view.
      if (searchParams.get('assignee') === 'me') filters.assigneeId = auth.userId;
      return json({ ok: true, ...(await listTasks(auth.orgId, filters)) });
    }

    const ref = decodeURIComponent(segments[1] ?? '');
    if (ref.length === 0 || ref.length > 40) return fail('NOT_FOUND', 'Ticket not found', 404);

    if (segments.length === 2 && method === 'GET') {
      const denied = denyIf('projects:read');
      if (denied) return denied;
      return json({ ok: true, ...(await getTask(auth.orgId, ref)) });
    }
    if (segments.length === 2 && method === 'PATCH') {
      const denied = denyIf('tasks:update');
      if (denied) return denied;
      const parsed = parse(taskUpdate, await readJson());
      if ('error' in parsed) return parsed.error;
      return json({ ok: true, task: await updateTask(actor, ref, parsed.data) });
    }
    if (segments.length === 2 && method === 'DELETE') {
      const denied = denyIf('tasks:delete');
      if (denied) return denied;
      await deleteTask(actor, ref);
      return json({ ok: true });
    }
    if (segments[2] === 'comments' && segments.length === 3 && method === 'POST') {
      const denied = denyIf('tasks:update');
      if (denied) return denied;
      const parsed = parse(commentCreate, await readJson());
      if ('error' in parsed) return parsed.error;
      return json({ ok: true, comments: await addComment(actor, ref, parsed.data.body) }, 201);
    }
    return null;
  } catch (error) {
    if (isOrgError(error)) return fail(error.code, error.message, error.status, error.details);
    console.error('[api/work] error:', error instanceof Error ? error.message : 'unknown');
    return fail('INTERNAL', 'Internal server error', 500);
  }
}

function filtersFrom(params: URLSearchParams) {
  const filters: { assigneeId?: number; statusId?: string; type?: z.infer<typeof taskType>; limit?: number } = {};
  const assignee = Number(params.get('assigneeId'));
  if (Number.isInteger(assignee) && assignee > 0) filters.assigneeId = assignee;
  const status = params.get('statusId');
  if (status && uuid.safeParse(status).success) filters.statusId = status;
  const type = taskType.safeParse(params.get('type'));
  if (type.success) filters.type = type.data;
  const limit = Number(params.get('limit'));
  if (Number.isInteger(limit) && limit > 0) filters.limit = limit;
  return filters;
}

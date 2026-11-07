import { isUniqueViolation } from '../incident-engine/errors.js';
import { recordAudit } from '../org/audit.js';
import { OrgError } from '../org/errors.js';
import type { Actor } from '../org/members.js';
import { withTenant } from '../../prisma/tenant.js';

export type StatusCategory = 'todo' | 'in_progress' | 'done';

export type StatusView = { id: string; name: string; category: StatusCategory; position: number };

export type ProjectView = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  archived: boolean;
  createdAt: string;
};

/** The workflow every new project starts with; admins can change it afterwards. */
export const DEFAULT_STATUSES: Array<{ name: string; category: StatusCategory }> = [
  { name: 'To Do', category: 'todo' },
  { name: 'In Progress', category: 'in_progress' },
  { name: 'In Review', category: 'in_progress' },
  { name: 'Done', category: 'done' },
];

export function toProjectView(p: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
}): ProjectView {
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    archived: p.archivedAt !== null,
    createdAt: p.createdAt,
  };
}

const toStatusView = (s: { id: string; name: string; category: string; position: number }): StatusView => ({
  id: s.id,
  name: s.name,
  category: s.category as StatusCategory,
  position: s.position,
});

export async function createProject(
  actor: Actor,
  input: { name: string; key: string; description?: string | null },
): Promise<{ project: ProjectView; statuses: StatusView[] }> {
  try {
    return await withTenant(actor.orgId, async (tx) => {
      const project = await tx.orm.public.Project.create({
        organizationId: actor.orgId,
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        createdById: actor.userId,
      });
      const statuses: StatusView[] = [];
      for (const [position, s] of DEFAULT_STATUSES.entries()) {
        const row = await tx.orm.public.ProjectStatus.create({
          organizationId: actor.orgId,
          projectId: project.id,
          name: s.name,
          category: s.category,
          position,
        });
        statuses.push(toStatusView(row));
      }
      await recordAudit(tx, {
        organizationId: actor.orgId,
        actorId: actor.userId,
        action: 'project.created',
        entityType: 'project',
        entityId: project.id,
        metadata: { key: input.key, name: input.name },
        requestId: actor.requestId,
      });
      return { project: toProjectView(project), statuses };
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new OrgError('CONFLICT', `A project with key ${input.key} already exists`, 409);
    throw error;
  }
}

export async function listProjects(orgId: string, includeArchived = false): Promise<ProjectView[]> {
  const rows = await withTenant(orgId, async (tx) => await tx.orm.public.Project.where({ organizationId: orgId }).all());
  return rows
    .filter((p) => includeArchived || p.archivedAt === null)
    .map(toProjectView)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProject(orgId: string, projectId: string) {
  const result = await withTenant(orgId, async (tx) => {
    const project = await tx.orm.public.Project.where({ id: projectId, organizationId: orgId }).first();
    if (!project) return null;
    const statuses = await tx.orm.public.ProjectStatus.where({ projectId, organizationId: orgId }).all();
    return { project, statuses };
  });
  if (!result) throw new OrgError('NOT_FOUND', 'Project not found', 404);
  return {
    project: toProjectView(result.project),
    statuses: result.statuses.map(toStatusView).sort((a, b) => a.position - b.position),
  };
}

export async function updateProject(
  actor: Actor,
  projectId: string,
  patch: { name?: string; description?: string | null; archived?: boolean },
): Promise<ProjectView> {
  return withTenant(actor.orgId, async (tx) => {
    const project = await tx.orm.public.Project.where({ id: projectId, organizationId: actor.orgId }).forUpdate().first();
    if (!project) throw new OrgError('NOT_FOUND', 'Project not found', 404);
    const data: Record<string, unknown> = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.archived !== undefined) data.archivedAt = patch.archived ? new Date().toISOString() : null;
    if (Object.keys(data).length > 0) {
      await tx.orm.public.Project.where({ id: projectId }).update(data as never);
      await recordAudit(tx, {
        organizationId: actor.orgId,
        actorId: actor.userId,
        action: patch.archived === undefined ? 'project.updated' : patch.archived ? 'project.archived' : 'project.restored',
        entityType: 'project',
        entityId: projectId,
        metadata: { key: project.key },
        requestId: actor.requestId,
      });
    }
    const fresh = await tx.orm.public.Project.where({ id: projectId }).first();
    return toProjectView(fresh ?? project);
  });
}

// --- Configurable workflow statuses ---

export async function addStatus(
  actor: Actor,
  projectId: string,
  input: { name: string; category: StatusCategory },
): Promise<StatusView> {
  try {
    return await withTenant(actor.orgId, async (tx) => {
      const project = await tx.orm.public.Project.where({ id: projectId, organizationId: actor.orgId }).first();
      if (!project) throw new OrgError('NOT_FOUND', 'Project not found', 404);
      const existing = await tx.orm.public.ProjectStatus.where({ projectId, organizationId: actor.orgId }).all();
      const position = existing.reduce((max, s) => Math.max(max, s.position), -1) + 1;
      const row = await tx.orm.public.ProjectStatus.create({
        organizationId: actor.orgId,
        projectId,
        name: input.name,
        category: input.category,
        position,
      });
      await recordAudit(tx, {
        organizationId: actor.orgId,
        actorId: actor.userId,
        action: 'project.status_added',
        entityType: 'project',
        entityId: projectId,
        metadata: { name: input.name, category: input.category },
        requestId: actor.requestId,
      });
      return toStatusView(row);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new OrgError('CONFLICT', 'A status with that name already exists', 409);
    throw error;
  }
}

export async function updateStatus(
  actor: Actor,
  projectId: string,
  statusId: string,
  patch: { name?: string; category?: StatusCategory; position?: number },
): Promise<StatusView> {
  try {
    return await withTenant(actor.orgId, async (tx) => {
      const status = await tx.orm.public.ProjectStatus.where({ id: statusId, projectId, organizationId: actor.orgId }).first();
      if (!status) throw new OrgError('NOT_FOUND', 'Status not found', 404);
      await tx.orm.public.ProjectStatus.where({ id: statusId }).update(patch as never);
      const fresh = await tx.orm.public.ProjectStatus.where({ id: statusId }).first();
      return toStatusView(fresh ?? status);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new OrgError('CONFLICT', 'A status with that name already exists', 409);
    throw error;
  }
}

/** A status that still has tickets cannot be deleted, and a project always keeps at least one status. */
export async function deleteStatus(actor: Actor, projectId: string, statusId: string): Promise<void> {
  await withTenant(actor.orgId, async (tx) => {
    const status = await tx.orm.public.ProjectStatus.where({ id: statusId, projectId, organizationId: actor.orgId }).first();
    if (!status) throw new OrgError('NOT_FOUND', 'Status not found', 404);
    const all = await tx.orm.public.ProjectStatus.where({ projectId, organizationId: actor.orgId }).all();
    if (all.length <= 1) throw new OrgError('CONFLICT', 'A project needs at least one status', 409);
    const inUse = await tx.orm.public.Task.where({ projectId, statusId, organizationId: actor.orgId }).first();
    if (inUse) throw new OrgError('CONFLICT', 'Move or close the tickets in this status first', 409);
    await tx.orm.public.ProjectStatus.where({ id: statusId }).delete();
  });
}

import type { OrgRole } from './types';

/**
 * UI-only mirror of the server permission matrix (apps/server/src/services/org/permissions.ts).
 * It decides what to *show*; the API enforces every rule regardless of what the UI does.
 */
export const ROLES: OrgRole[] = ['owner', 'admin', 'manager', 'developer', 'responder', 'member', 'viewer'];

export type Permission =
  | 'org:manage'
  | 'members:invite'
  | 'teams:manage'
  | 'services:manage'
  | 'monitors:manage'
  | 'incidents:respond'
  | 'incidents:manage'
  | 'postmortems:write'
  | 'oncall:manage'
  | 'statuspages:manage'
  | 'deployments:create'
  | 'integrations:manage'
  | 'audit:read'
  | 'projects:manage'
  | 'sprints:manage'
  | 'tasks:create'
  | 'tasks:assign'
  | 'tasks:delete';

const OPS: Permission[] = ['services:manage', 'monitors:manage', 'incidents:manage', 'oncall:manage', 'statuspages:manage', 'deployments:create', 'teams:manage'];
const MANAGE: Permission[] = ['projects:manage', 'tasks:assign', 'tasks:delete', 'sprints:manage'];
const WORK: Permission[] = ['tasks:create', 'incidents:respond', 'postmortems:write'];
const ADMIN: Permission[] = ['org:manage', 'members:invite', 'integrations:manage', 'audit:read', ...OPS, ...MANAGE, ...WORK];

const MATRIX: Record<OrgRole, Set<Permission>> = {
  owner: new Set(ADMIN),
  admin: new Set(ADMIN),
  manager: new Set([...OPS, ...MANAGE, ...WORK]),
  developer: new Set([...WORK, 'deployments:create']),
  responder: new Set(WORK),
  member: new Set(WORK),
  viewer: new Set(),
};

export const can = (role: OrgRole | undefined, permission: Permission): boolean => Boolean(role && MATRIX[role]?.has(permission));

export const isAdmin = (role: OrgRole | undefined): boolean => role === 'owner' || role === 'admin';
export const canRespond = (role: OrgRole | undefined): boolean => can(role, 'incidents:respond');

/** Roles the given actor may assign (owners can assign anything, admins everything below owner). */
export function assignableRoles(actor: OrgRole | undefined): OrgRole[] {
  if (actor === 'owner') return ROLES;
  if (actor === 'admin') return ROLES.filter((r) => r !== 'owner');
  return [];
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  developer: 'Developer',
  responder: 'Responder',
  member: 'Member',
  viewer: 'Viewer',
};

export const ROLE_HELP: Record<OrgRole, string> = {
  owner: 'Full control, including other owners',
  admin: 'Manage people, integrations, services and keys; read the audit log',
  manager: 'Run projects, sprints, teams, services, monitors and on-call',
  developer: 'Work tickets, record deployments and respond to incidents',
  responder: 'Acknowledge, resolve and comment on incidents; work tickets',
  member: 'Work incidents and tickets',
  viewer: 'Read-only access',
};

/** Can raise and edit tickets (viewers cannot). */
export const canWork = (role: OrgRole | undefined): boolean => can(role, 'tasks:create');
/** Can create projects, change the workflow, assign work to other people and delete tickets. */
export const canManageWork = (role: OrgRole | undefined): boolean => can(role, 'projects:manage');

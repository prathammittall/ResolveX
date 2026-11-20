export type Role = 'owner' | 'admin' | 'manager' | 'developer' | 'responder' | 'member' | 'viewer';

export const ROLES: readonly Role[] = ['owner', 'admin', 'manager', 'developer', 'responder', 'member', 'viewer'];

export type Permission =
  | 'org:read'
  | 'org:manage'
  | 'members:read'
  | 'members:invite'
  | 'members:update'
  | 'members:remove'
  | 'teams:manage'
  | 'services:read'
  | 'services:manage'
  | 'monitors:manage'
  | 'webhook_keys:manage'
  | 'incidents:read'
  | 'incidents:respond'
  | 'incidents:manage'
  | 'postmortems:write'
  | 'oncall:manage'
  | 'statuspages:manage'
  | 'deployments:create'
  | 'integrations:manage'
  | 'audit:read'
  | 'projects:read'
  | 'projects:manage'
  | 'sprints:manage'
  | 'tasks:create'
  | 'tasks:update'
  | 'tasks:assign'
  | 'tasks:delete';

const ALL_READ: Permission[] = ['org:read', 'members:read', 'services:read', 'incidents:read', 'projects:read'];
const WORKER: Permission[] = ['tasks:create', 'tasks:update'];
const MANAGER: Permission[] = ['projects:manage', 'tasks:assign', 'tasks:delete', 'sprints:manage'];
const RESPONDER: Permission[] = ['incidents:respond', 'postmortems:write'];
const OPS_ADMIN: Permission[] = [
  'services:manage',
  'monitors:manage',
  'webhook_keys:manage',
  'incidents:manage',
  'oncall:manage',
  'statuspages:manage',
  'deployments:create',
  'teams:manage',
];
const ADMIN: Permission[] = [
  ...ALL_READ,
  'org:manage',
  'members:invite',
  'members:update',
  'members:remove',
  'integrations:manage',
  'audit:read',
  ...OPS_ADMIN,
  ...RESPONDER,
  ...WORKER,
  ...MANAGER,
];

/**
 * Single source of truth for what each role may do. Deny by default: a role or permission that is
 * not listed here is refused.
 *  - owner/admin: everything (only owners can touch other owners, see canAssignRole).
 *  - manager: runs delivery and operations (projects, sprints, teams, services, monitors, on-call) but
 *    cannot manage people, integrations or read the audit log.
 *  - developer: builds things (tickets, deployments) and works incidents.
 *  - responder / member: work incidents and tickets.
 *  - viewer: read-only.
 */
const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set<Permission>(ADMIN),
  admin: new Set<Permission>(ADMIN),
  manager: new Set<Permission>([...ALL_READ, ...OPS_ADMIN, ...RESPONDER, ...WORKER, ...MANAGER]),
  developer: new Set<Permission>([...ALL_READ, ...RESPONDER, ...WORKER, 'deployments:create']),
  responder: new Set<Permission>([...ALL_READ, ...RESPONDER, ...WORKER]),
  member: new Set<Permission>([...ALL_READ, ...RESPONDER, ...WORKER]),
  viewer: new Set<Permission>(ALL_READ),
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function can(role: string | undefined, permission: Permission): boolean {
  return isRole(role) && MATRIX[role].has(permission);
}

/** Permissions of a role, for the UI to mirror (the API still enforces every check). */
export function permissionsOf(role: string | undefined): Permission[] {
  return isRole(role) ? [...MATRIX[role]] : [];
}

/**
 * Role-assignment rule: nobody can grant or change a role above their own, and only an owner can
 * create, change or remove another owner (so admins cannot promote themselves or evict the owner).
 */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (target === 'owner') return actor === 'owner';
  return actor === 'owner' || actor === 'admin';
}

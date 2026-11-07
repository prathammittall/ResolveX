export type Role = 'owner' | 'admin' | 'responder' | 'member' | 'viewer';

export const ROLES: readonly Role[] = ['owner', 'admin', 'responder', 'member', 'viewer'];

export type Permission =
  | 'org:read'
  | 'members:read'
  | 'members:invite'
  | 'members:update'
  | 'members:remove'
  | 'services:read'
  | 'services:manage'
  | 'webhook_keys:manage'
  | 'incidents:read'
  | 'incidents:respond'
  | 'audit:read'
  | 'projects:read'
  | 'projects:manage'
  | 'tasks:create'
  | 'tasks:update'
  | 'tasks:assign'
  | 'tasks:delete';

const ALL_READ: Permission[] = ['org:read', 'members:read', 'services:read', 'incidents:read', 'projects:read'];
const WORKER: Permission[] = ['tasks:create', 'tasks:update'];
const MANAGER: Permission[] = ['projects:manage', 'tasks:assign', 'tasks:delete'];

/**
 * Single source of truth for what each role may do. Deny by default: a role or permission that is
 * not listed here is refused. `responder` and `member` can work incidents; only `owner`/`admin`
 * manage people, the service catalog, integrations keys and read the audit log.
 */
const MATRIX: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set<Permission>([
    ...ALL_READ,
    'members:invite',
    'members:update',
    'members:remove',
    'services:manage',
    'webhook_keys:manage',
    'incidents:respond',
    'audit:read',
    ...WORKER,
    ...MANAGER,
  ]),
  admin: new Set<Permission>([
    ...ALL_READ,
    'members:invite',
    'members:update',
    'members:remove',
    'services:manage',
    'webhook_keys:manage',
    'incidents:respond',
    'audit:read',
    ...WORKER,
    ...MANAGER,
  ]),
  responder: new Set<Permission>([...ALL_READ, 'incidents:respond', ...WORKER]),
  member: new Set<Permission>([...ALL_READ, 'incidents:respond', ...WORKER]),
  viewer: new Set<Permission>(ALL_READ),
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function can(role: string | undefined, permission: Permission): boolean {
  return isRole(role) && MATRIX[role].has(permission);
}

/**
 * Role-assignment rule: nobody can grant or change a role above their own, and only an owner can
 * create, change or remove another owner (so admins cannot promote themselves or evict the owner).
 */
export function canAssignRole(actor: Role, target: Role): boolean {
  if (target === 'owner') return actor === 'owner';
  return actor === 'owner' || actor === 'admin';
}

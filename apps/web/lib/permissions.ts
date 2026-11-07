import type { OrgRole } from './types';

/**
 * UI-only mirror of the server permission matrix (apps/server/src/services/org/permissions.ts).
 * It decides what to *show*; the API enforces every rule regardless of what the UI does.
 */
export const ROLES: OrgRole[] = ['owner', 'admin', 'responder', 'member', 'viewer'];

export const isAdmin = (role: OrgRole | undefined): boolean => role === 'owner' || role === 'admin';
export const canRespond = (role: OrgRole | undefined): boolean => role !== 'viewer' && role !== undefined;

/** Roles the given actor may assign (owners can assign anything, admins everything below owner). */
export function assignableRoles(actor: OrgRole | undefined): OrgRole[] {
  if (actor === 'owner') return ROLES;
  if (actor === 'admin') return ROLES.filter((r) => r !== 'owner');
  return [];
}

export const ROLE_LABEL: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  responder: 'Responder',
  member: 'Member',
  viewer: 'Viewer',
};

export const ROLE_HELP: Record<OrgRole, string> = {
  owner: 'Full control, including other owners',
  admin: 'Manage people, services and keys; read the audit log',
  responder: 'Acknowledge, resolve and comment on incidents',
  member: 'Work incidents; read-only elsewhere',
  viewer: 'Read-only access',
};

/** Can raise and edit tickets (viewers cannot). */
export const canWork = (role: OrgRole | undefined): boolean => role !== undefined && role !== 'viewer';
/** Can create projects, change the workflow, assign work to other people and delete tickets. */
export const canManageWork = isAdmin;

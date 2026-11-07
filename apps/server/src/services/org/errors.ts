export type OrgErrorCode =
  | 'VALIDATION_ERROR'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_INVITATION'
  | 'LAST_OWNER';

export class OrgError extends Error {
  constructor(
    readonly code: OrgErrorCode,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'OrgError';
  }
}

export const isOrgError = (e: unknown): e is OrgError => e instanceof OrgError;

export type AlertErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'SERVICE_NOT_FOUND'
  | 'MISCONFIGURED'
  | 'INTERNAL';

export class AlertProcessingError extends Error {
  readonly code: AlertErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AlertErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AlertProcessingError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAlertProcessingError(error: unknown): error is AlertProcessingError {
  return error instanceof AlertProcessingError;
}

/** Detect Postgres unique-violation (23505), including wrapped envelopes. */
export function isUniqueViolation(error: unknown): boolean {
  const seen = new Set<unknown>();
  const stack: unknown[] = [error];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object' || seen.has(current)) {
      continue;
    }
    seen.add(current);

    const record = current as Record<string, unknown>;
    if (record.sqlState === '23505') {
      return true;
    }
    if (typeof record.code === 'string' && record.code === '23505') {
      return true;
    }
    if (typeof record.message === 'string' && /unique|duplicate key/i.test(record.message)) {
      // Prefer sqlState when present; message match is a fallback for wrapped drivers.
      if (record.sqlState == null && record.code == null) {
        return true;
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object') {
        stack.push(value);
      }
    }
  }

  return false;
}

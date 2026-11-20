import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodeProcess from 'node:process';
import { z } from 'zod';
import { db as defaultDb } from '../../prisma/db.js';
import { createOrganizationWithOwner } from '../org/memberships.js';

export type DbClient = typeof defaultDb;

const MIN_SECRET_LENGTH = 32;

function requireSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = nodeProcess.env[name];
  if (!value || value.length < MIN_SECRET_LENGTH) {
    throw new Error(`${name} must be set to a random string of at least ${MIN_SECRET_LENGTH} characters`);
  }
  return value;
}

/** Resolved lazily so a missing secret fails loudly at boot (see assertAuthConfig) or first use, never silently. */
export const getAccessSecret = (): string => requireSecret('JWT_ACCESS_SECRET');
export const getRefreshSecret = (): string => requireSecret('JWT_REFRESH_SECRET');

/** Call once at startup to fail fast on missing/weak JWT secrets. */
export function assertAuthConfig(): void {
  getAccessSecret();
  getRefreshSecret();
}

export const ACCESS_TOKEN_EXPIRES_IN = nodeProcess.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
export const REFRESH_TOKEN_EXPIRES_IN = nodeProcess.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// --- Zod Schemas ---

export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address')
      .max(255),
    password: z
      .string()
      .min(6, 'Password must be at least 6 characters long')
      .max(128, 'Password cannot exceed 128 characters'),
    username: z
      .string()
      .trim()
      .min(2, 'Username must be at least 2 characters')
      .max(50, 'Username cannot exceed 50 characters')
      .optional(),
    name: z
      .string()
      .trim()
      .min(1, 'Name cannot be empty')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),
    companyName: z
      .string()
      .trim()
      .min(1, 'Company name cannot be empty')
      .max(100, 'Company name cannot exceed 100 characters')
      .optional(),
  })
  .strict();

export const loginSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address'),
    password: z.string().min(1, 'Password is required'),
  })
  .strict();

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().trim().min(1, 'Refresh token is required'),
  })
  .strict();

export const logoutSchema = z
  .object({
    refreshToken: z.string().trim().optional(),
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address'),
    otp: z
      .string()
      .trim()
      .min(4, 'OTP must be at least 4 digits')
      .max(10, 'OTP cannot exceed 10 digits'),
    otpToken: z.string().trim().optional(),
  })
  .strict();

export const resendOtpSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address'),
    otpToken: z.string().trim().optional(),
  })
  .strict();

// --- Types ---

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

export type UserTokenPayload = {
  userId: number;
  email: string;
  role: string;
  companyId: number;
  /** Organization the caller is acting in; the role is their role in it. */
  orgId: string;
};

export type RefreshTokenPayload = {
  userId: number;
  email: string;
  /** Unique per token so two tokens minted in the same second never collide. */
  jti?: string;
  /** Organization the session is acting in, so a refresh keeps the user in it. */
  orgId?: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
};

export type AuthUser = {
  id: number;
  email: string;
  username: string | null;
  name: string | null;
  role: 'owner' | 'admin' | 'manager' | 'developer' | 'responder' | 'member' | 'viewer';
  companyId: number;
  orgId: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
};

// --- Password Hashing ---

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --- JWT Token Generation & Verification ---

export function signAccessToken(
  payload: UserTokenPayload,
  secret = getAccessSecret(),
  expiresIn = ACCESS_TOKEN_EXPIRES_IN,
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function signRefreshToken(
  payload: RefreshTokenPayload,
  secret = getRefreshSecret(),
  expiresIn = REFRESH_TOKEN_EXPIRES_IN,
): string {
  return jwt.sign({ ...payload, jti: payload.jti ?? randomUUID() }, secret, {
    expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function generateTokenPair(
  user: { id: number; email: string; role: string; companyId: number; orgId: string },
  options?: {
    accessSecret?: string;
    refreshSecret?: string;
    accessExpiresIn?: string;
    refreshExpiresIn?: string;
  },
): TokenPair {
  const accessPayload: UserTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    orgId: user.orgId,
  };

  const refreshPayload: RefreshTokenPayload = {
    userId: user.id,
    email: user.email,
    orgId: user.orgId,
  };

  const accessToken = signAccessToken(
    accessPayload,
    options?.accessSecret,
    options?.accessExpiresIn,
  );
  const refreshToken = signRefreshToken(
    refreshPayload,
    options?.refreshSecret,
    options?.refreshExpiresIn,
  );

  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: options?.accessExpiresIn || ACCESS_TOKEN_EXPIRES_IN,
  };
}

export function verifyAccessToken(token: string, secret = getAccessSecret()): UserTokenPayload {
  const payload = jwt.verify(token, secret) as UserTokenPayload;
  // Tokens minted before organizations existed carry no orgId: treat them as expired so the client refreshes.
  if (typeof payload.orgId !== 'string' || payload.orgId.length === 0) {
    throw new jwt.JsonWebTokenError('token has no organization');
  }
  return payload;
}

export function verifyRefreshToken(
  token: string,
  secret = getRefreshSecret(),
): RefreshTokenPayload {
  return jwt.verify(token, secret) as RefreshTokenPayload;
}

// --- User Database Queries ---

export function formatAuthUser(
  user: {
    id: number;
    email: string;
    username: string | null;
    name: string | null;
    companyId: number;
    avatarUrl?: string | null;
    emailVerifiedAt?: string | null;
    createdAt: string;
    updatedAt: string;
  },
  membership: { organizationId: string; role: AuthUser['role'] },
): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    // The effective role is the membership role, not the legacy User.role column.
    role: membership.role,
    companyId: user.companyId,
    orgId: membership.organizationId,
    avatarUrl: user.avatarUrl ?? null,
    emailVerified: Boolean(user.emailVerifiedAt),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function findUserByEmail(client: DbClient, email: string) {
  return client.orm.public.User.where({ email: email.toLowerCase() }).first();
}

export async function findUserById(client: DbClient, id: number) {
  return client.orm.public.User.where({ id }).first();
}

/**
 * Create a company, its first user, and the organization they own, atomically: a failure leaves no
 * orphan rows. Public registration always produces a new tenant with the registrant as owner.
 */
export async function createAccount(
  client: DbClient,
  data: {
    email: string;
    passwordHash: string;
    name?: string | null;
    username?: string | null;
    companyName?: string;
  },
) {
  const orgName =
    data.companyName?.trim() ||
    (data.username ? `${data.username}'s Team` : `${data.email.split('@')[0]}'s Org`);

  return client.transaction(async (tx) => {
    const company = await tx.orm.public.Company.create({ name: orgName });
    const user = await tx.orm.public.User.create({
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name ?? null,
      username: data.username ?? null,
      role: 'owner',
      companyId: company.id,
    });
    const organizationId = await createOrganizationWithOwner(tx, {
      userId: user.id,
      companyId: company.id,
      name: orgName,
      role: 'owner',
    });
    return { user, membership: { organizationId, role: 'owner' as const } };
  });
}

// --- Refresh-token sessions (hashed, rotating, reuse-detecting) ---

/** Anything exposing the ORM: the root client or a transaction handle. */
export type OrmClient = Pick<DbClient, 'orm'>;

/** Only the hash is stored, so a database leak does not expose usable refresh tokens. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newSessionFamilyId(): string {
  return randomUUID();
}

function tokenExpiry(token: string): string {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) throw new Error('Refresh token has no expiry');
  return new Date(decoded.exp * 1000).toISOString();
}

export async function createSession(
  client: OrmClient,
  args: { userId: number; familyId: string; refreshToken: string },
) {
  return client.orm.public.Session.create({
    userId: args.userId,
    familyId: args.familyId,
    tokenHash: hashRefreshToken(args.refreshToken),
    expiresAt: tokenExpiry(args.refreshToken),
  });
}

/** Revoke every still-active session in a family (logout, or refresh-token reuse). */
export async function revokeSessionFamily(client: OrmClient, familyId: string): Promise<void> {
  const sessions = await client.orm.public.Session.where({ familyId }).all();
  const now = new Date().toISOString();
  for (const session of sessions) {
    if (!session.revokedAt) {
      await client.orm.public.Session.where({ id: session.id }).update({ revokedAt: now });
    }
  }
}

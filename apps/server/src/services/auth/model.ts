import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodeProcess from 'node:process';
import { z } from 'zod';
import { db as defaultDb } from '../../prisma/db.js';

export type DbClient = typeof defaultDb;

export const JWT_ACCESS_SECRET =
  nodeProcess.env.JWT_ACCESS_SECRET ||
  nodeProcess.env.JWT_SECRET ||
  'resolvex_access_secret_development_only_change_in_production';

export const JWT_REFRESH_SECRET =
  nodeProcess.env.JWT_REFRESH_SECRET ||
  'resolvex_refresh_secret_development_only_change_in_production';

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
    role: z
      .enum(['owner', 'admin', 'responder', 'member', 'viewer'])
      .optional()
      .default('member'),
    companyId: z.number().int().positive().optional(),
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
    userId: z.number().int().positive().optional(),
  })
  .strict();

// --- Types ---

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;

export type UserTokenPayload = {
  userId: number;
  email: string;
  role: string;
  companyId: number;
};

export type RefreshTokenPayload = {
  userId: number;
  email: string;
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
  role: 'owner' | 'admin' | 'responder' | 'member' | 'viewer';
  companyId: number;
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
  secret = JWT_ACCESS_SECRET,
  expiresIn = ACCESS_TOKEN_EXPIRES_IN,
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function signRefreshToken(
  payload: RefreshTokenPayload,
  secret = JWT_REFRESH_SECRET,
  expiresIn = REFRESH_TOKEN_EXPIRES_IN,
): string {
  return jwt.sign(payload, secret, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function generateTokenPair(
  user: { id: number; email: string; role: string; companyId: number },
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
  };

  const refreshPayload: RefreshTokenPayload = {
    userId: user.id,
    email: user.email,
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

export function verifyAccessToken(token: string, secret = JWT_ACCESS_SECRET): UserTokenPayload {
  return jwt.verify(token, secret) as UserTokenPayload;
}

export function verifyRefreshToken(
  token: string,
  secret = JWT_REFRESH_SECRET,
): RefreshTokenPayload {
  return jwt.verify(token, secret) as RefreshTokenPayload;
}

// --- User Database Queries ---

export function formatAuthUser(user: {
  id: number;
  email: string;
  username: string | null;
  name: string | null;
  role: 'owner' | 'admin' | 'responder' | 'member' | 'viewer';
  companyId: number;
  createdAt: string;
  updatedAt: string;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    name: user.name,
    role: user.role,
    companyId: user.companyId,
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

export async function createUserWithCompany(
  client: DbClient,
  data: {
    email: string;
    passwordHash: string;
    name?: string | null;
    username?: string | null;
    role?: 'owner' | 'admin' | 'responder' | 'member' | 'viewer';
    companyId?: number;
    companyName?: string;
  },
) {
  let targetCompanyId = data.companyId;

  if (!targetCompanyId) {
    const compName =
      data.companyName?.trim() ||
      (data.username ? `${data.username}'s Team` : `${data.email.split('@')[0]}'s Org`);

    const company = await client.orm.public.Company.create({
      name: compName,
    });
    targetCompanyId = company.id;
  }

  const user = await client.orm.public.User.create({
    email: data.email.toLowerCase(),
    passwordHash: data.passwordHash,
    name: data.name ?? null,
    username: data.username ?? null,
    role: data.role ?? 'member',
    companyId: targetCompanyId,
  });

  return user;
}

export async function updateUserRefreshToken(
  client: DbClient,
  userId: number,
  refreshToken: string | null,
) {
  return client.orm.public.User.where({ id: userId }).update({
    refreshToken,
  });
}

export async function clearUserRefreshToken(client: DbClient, userId: number) {
  return client.orm.public.User.where({ id: userId }).update({
    refreshToken: null,
  });
}

import { db as defaultDb } from '../../prisma/db.js';
import {
  clearUserRefreshToken,
  comparePassword,
  createUserWithCompany,
  findUserByEmail,
  findUserById,
  formatAuthUser,
  generateTokenPair,
  hashPassword,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  updateUserRefreshToken,
  verifyRefreshToken,
  type AuthUser,
  type DbClient,
  type LoginInput,
  type LogoutInput,
  type RefreshTokenInput,
  type RegisterInput,
  type TokenPair,
} from './model.js';

export type AuthErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'USER_NOT_FOUND'
  | 'COMPANY_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'INTERNAL';

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AuthErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export type AuthSuccessResult = {
  ok: true;
  user: AuthUser;
  tokens: TokenPair;
};

export type LogoutSuccessResult = {
  ok: true;
  message: string;
};

export type GetMeSuccessResult = {
  ok: true;
  user: AuthUser;
};

export type AuthControllerOptions = {
  db?: DbClient;
  accessSecret?: string;
  refreshSecret?: string;
  accessExpiresIn?: string;
  refreshExpiresIn?: string;
};

/**
 * Register a new user:
 * 1. Validates input schema (email, password, optional names/company).
 * 2. Checks email uniqueness.
 * 3. Hashes password using bcrypt.
 * 4. Creates user & company.
 * 5. Issues access token and refresh token via jsonwebtoken.
 * 6. Persists refresh token to user record.
 */
export async function register(
  input: RegisterInput | unknown,
  options: AuthControllerOptions = {},
): Promise<AuthSuccessResult> {
  const client = options.db ?? defaultDb;

  const parseResult = registerSchema.safeParse(input);
  if (!parseResult.success) {
    throw new AuthError(
      'VALIDATION_ERROR',
      'Validation failed for registration input',
      400,
      parseResult.error.flatten(),
    );
  }

  const data = parseResult.data;

  const existingUser = await findUserByEmail(client, data.email);
  if (existingUser) {
    throw new AuthError('EMAIL_ALREADY_EXISTS', 'Email is already registered', 409);
  }

  if (data.companyId) {
    const company = await client.orm.public.Company.where({ id: data.companyId }).first();
    if (!company) {
      throw new AuthError('COMPANY_NOT_FOUND', 'Company not found', 404);
    }
  }

  const hashedPassword = await hashPassword(data.password);

  const newUser = await createUserWithCompany(client, {
    email: data.email,
    passwordHash: hashedPassword,
    name: data.name,
    username: data.username,
    role: data.role,
    companyId: data.companyId,
    companyName: data.companyName,
  });

  const tokens = generateTokenPair(
    {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      companyId: newUser.companyId,
    },
    {
      accessSecret: options.accessSecret,
      refreshSecret: options.refreshSecret,
      accessExpiresIn: options.accessExpiresIn,
      refreshExpiresIn: options.refreshExpiresIn,
    },
  );

  await updateUserRefreshToken(client, newUser.id, tokens.refreshToken);

  return {
    ok: true,
    user: formatAuthUser(newUser),
    tokens,
  };
}

/**
 * Log in an existing user:
 * 1. Validates input email and password.
 * 2. Checks credentials and verifies bcrypt password hash.
 * 3. Generates new access and refresh token pair.
 * 4. Updates stored refresh token.
 */
export async function login(
  input: LoginInput | unknown,
  options: AuthControllerOptions = {},
): Promise<AuthSuccessResult> {
  const client = options.db ?? defaultDb;

  const parseResult = loginSchema.safeParse(input);
  if (!parseResult.success) {
    throw new AuthError(
      'VALIDATION_ERROR',
      'Validation failed for login input',
      400,
      parseResult.error.flatten(),
    );
  }

  const { email, password } = parseResult.data;

  const user = await findUserByEmail(client, email);
  if (!user || !user.passwordHash) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
  }

  const tokens = generateTokenPair(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    },
    {
      accessSecret: options.accessSecret,
      refreshSecret: options.refreshSecret,
      accessExpiresIn: options.accessExpiresIn,
      refreshExpiresIn: options.refreshExpiresIn,
    },
  );

  await updateUserRefreshToken(client, user.id, tokens.refreshToken);

  return {
    ok: true,
    user: formatAuthUser(user),
    tokens,
  };
}

/**
 * Refresh access token using a valid refresh token:
 * 1. Validates refresh token presence.
 * 2. Verifies token signature and expiration.
 * 3. Compares with token stored in user's record (prevents replay/revoked tokens).
 * 4. Issues rotated access and refresh tokens.
 */
export async function refresh(
  input: RefreshTokenInput | unknown,
  options: AuthControllerOptions = {},
): Promise<AuthSuccessResult> {
  const client = options.db ?? defaultDb;

  const parseResult = refreshTokenSchema.safeParse(input);
  if (!parseResult.success) {
    throw new AuthError(
      'VALIDATION_ERROR',
      'Refresh token is required',
      400,
      parseResult.error.flatten(),
    );
  }

  const { refreshToken: incomingToken } = parseResult.data;

  let decoded: { userId: number; email?: string };
  try {
    decoded = verifyRefreshToken(incomingToken, options.refreshSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid refresh token';
    throw new AuthError('INVALID_REFRESH_TOKEN', `Invalid or expired refresh token: ${message}`, 401);
  }

  const user = await findUserById(client, decoded.userId);
  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User associated with token not found', 404);
  }

  if (!user.refreshToken || user.refreshToken !== incomingToken) {
    throw new AuthError(
      'INVALID_REFRESH_TOKEN',
      'Refresh token has been revoked or already used',
      401,
    );
  }

  const tokens = generateTokenPair(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    },
    {
      accessSecret: options.accessSecret,
      refreshSecret: options.refreshSecret,
      accessExpiresIn: options.accessExpiresIn,
      refreshExpiresIn: options.refreshExpiresIn,
    },
  );

  await updateUserRefreshToken(client, user.id, tokens.refreshToken);

  return {
    ok: true,
    user: formatAuthUser(user),
    tokens,
  };
}

/**
 * Log out user by clearing the stored refresh token:
 * Accepts { refreshToken?: string, userId?: number }.
 */
export async function logout(
  input: LogoutInput | unknown,
  options: AuthControllerOptions = {},
): Promise<LogoutSuccessResult> {
  const client = options.db ?? defaultDb;

  const parseResult = logoutSchema.safeParse(input ?? {});
  const data = parseResult.success ? parseResult.data : {};

  let targetUserId = data.userId;

  if (!targetUserId && data.refreshToken) {
    try {
      const decoded = verifyRefreshToken(data.refreshToken, options.refreshSecret);
      targetUserId = decoded.userId;
    } catch {
      // If refresh token cannot be decoded, search user by exact token string match
      const matchingUser = await client.orm.public.User.where({
        refreshToken: data.refreshToken,
      }).first();
      if (matchingUser) {
        targetUserId = matchingUser.id;
      }
    }
  }

  if (targetUserId) {
    await clearUserRefreshToken(client, targetUserId);
  }

  return {
    ok: true,
    message: 'Logged out successfully',
  };
}

/**
 * Retrieve authenticated user profile by ID.
 */
export async function getMe(
  userId: number,
  options: AuthControllerOptions = {},
): Promise<GetMeSuccessResult> {
  const client = options.db ?? defaultDb;

  const user = await findUserById(client, userId);
  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  return {
    ok: true,
    user: formatAuthUser(user),
  };
}

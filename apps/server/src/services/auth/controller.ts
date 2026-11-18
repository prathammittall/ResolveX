import { randomUUID } from 'node:crypto';
import { db as defaultDb } from '../../prisma/db.js';
import { sendOtpEmail } from '../mailer.js';
import { resolveMembership } from '../org/memberships.js';
import {
  comparePassword,
  createAccount,
  findUserByEmail,
  findUserById,
  formatAuthUser,
  generateTokenPair,
  hashPassword,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema,
  verifyOtpSchema,
  resendOtpSchema,
  createSession,
  hashRefreshToken,
  newSessionFamilyId,
  revokeSessionFamily,
  verifyRefreshToken,
  type AuthUser,
  type DbClient,
  type LoginInput,
  type LogoutInput,
  type RefreshTokenInput,
  type RegisterInput,
  type VerifyOtpInput,
  type ResendOtpInput,
  type TokenPair,
} from './model.js';
import {
  canResendOtp,
  deleteOtp,
  generateOtpCode,
  getOtp,
  incrementOtpAttempts,
  MAX_OTP_ATTEMPTS,
  signOtpToken,
  storeOtp,
  verifyOtpToken,
} from './otp.js';

async function toMembership(user: { id: number; companyId: number; role: string }, preferredOrgId?: string) {
  const m = await resolveMembership(user, preferredOrgId);
  return { organizationId: m.organizationId, role: m.role };
}

export type AuthErrorCode =
  | 'VALIDATION_ERROR'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_REFRESH_TOKEN'
  | 'USER_NOT_FOUND'
  | 'COMPANY_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INTERNAL'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'RATE_LIMITED';

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
  requireOtp?: false;
};

export type LoginOtpRequiredResult = {
  ok: true;
  requireOtp: true;
  email: string;
  otpToken: string;
  message: string;
};

export type LoginResult = AuthSuccessResult | LoginOtpRequiredResult;

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
  skipOtp?: boolean;
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

  const hashedPassword = await hashPassword(data.password);

  // Public registration always creates a new tenant owned by this user.
  // Joining an existing organization goes through an invitation.
  const { user: newUser, membership } = await createAccount(client, {
    email: data.email,
    passwordHash: hashedPassword,
    name: data.name,
    username: data.username,
    companyName: data.companyName,
  });

  const tokens = generateTokenPair(
    {
      id: newUser.id,
      email: newUser.email,
      role: membership.role,
      companyId: newUser.companyId,
      orgId: membership.organizationId,
    },
    {
      accessSecret: options.accessSecret,
      refreshSecret: options.refreshSecret,
      accessExpiresIn: options.accessExpiresIn,
      refreshExpiresIn: options.refreshExpiresIn,
    },
  );

  await createSession(client, { userId: newUser.id, familyId: newSessionFamilyId(), refreshToken: tokens.refreshToken });

  return {
    ok: true,
    user: formatAuthUser(newUser, membership),
    tokens,
  };
}

/**
 * Log in an existing user:
 * 1. Validates input email and password.
 * 2. Verifies bcrypt password hash.
 * 3. By default, generates a 6-digit OTP, sends it to the user's email via Nodemailer,
 *    and requires OTP verification to complete authentication.
 * 4. If skipOtp option is enabled (e.g. for testing), completes session immediately.
 */
export async function login(
  input: LoginInput | unknown,
  options: AuthControllerOptions = {},
): Promise<LoginResult> {
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

  // If OTP requirement is explicitly skipped (e.g. in test suites)
  if (options.skipOtp === true || process.env.AUTH_REQUIRE_OTP === 'false') {
    const membership = await toMembership(user);
    const tokens = generateTokenPair(
      {
        id: user.id,
        email: user.email,
        role: membership.role,
        companyId: user.companyId,
        orgId: membership.organizationId,
      },
      {
        accessSecret: options.accessSecret,
        refreshSecret: options.refreshSecret,
        accessExpiresIn: options.accessExpiresIn,
        refreshExpiresIn: options.refreshExpiresIn,
      },
    );

    await createSession(client, { userId: user.id, familyId: newSessionFamilyId(), refreshToken: tokens.refreshToken });

    return {
      ok: true,
      user: formatAuthUser(user, membership),
      tokens,
    };
  }

  // Standard 2-Step OTP Authentication Flow:
  // Generate 6-digit OTP and store it with 10-minute validity
  const otp = generateOtpCode();
  storeOtp(user.email, { code: otp, userId: user.id });

  const otpToken = signOtpToken(
    { userId: user.id, email: user.email },
    options.accessSecret,
  );

  // Dispatch OTP email via Nodemailer
  await sendOtpEmail({
    to: user.email,
    otp,
    name: user.name ?? undefined,
  });

  return {
    ok: true,
    requireOtp: true,
    email: user.email,
    otpToken,
    message: 'A verification code has been sent to your email.',
  };
}

/**
 * Verify an OTP code submitted by the user after successful password validation:
 * 1. Validates the OTP input schema.
 * 2. Validates the signed otpToken if supplied.
 * 3. Compares the submitted code against the stored OTP code with attempt limiting.
 * 4. Upon successful verification, creates the authenticated session and returns tokens.
 */
export async function verifyOtp(
  input: VerifyOtpInput | unknown,
  options: AuthControllerOptions = {},
): Promise<AuthSuccessResult> {
  const client = options.db ?? defaultDb;

  const parseResult = verifyOtpSchema.safeParse(input);
  if (!parseResult.success) {
    throw new AuthError(
      'VALIDATION_ERROR',
      'Validation failed for OTP verification',
      400,
      parseResult.error.flatten(),
    );
  }

  const { email, otp, otpToken } = parseResult.data;

  // Validate otpToken if provided
  if (otpToken) {
    try {
      const payload = verifyOtpToken(otpToken, options.accessSecret);
      if (payload.email.toLowerCase() !== email.toLowerCase()) {
        throw new AuthError('INVALID_OTP', 'OTP session mismatch', 400);
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('INVALID_OTP', 'Invalid or expired OTP session. Please sign in again.', 400);
    }
  }

  const record = getOtp(email);
  if (!record) {
    throw new AuthError(
      'OTP_EXPIRED',
      'Verification code has expired or was not requested. Please try again.',
      400,
    );
  }

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    deleteOtp(email);
    throw new AuthError(
      'TOO_MANY_ATTEMPTS',
      'Too many invalid attempts. Please request a new verification code.',
      429,
    );
  }

  if (record.code !== otp.trim()) {
    const attempts = incrementOtpAttempts(email);
    const remaining = MAX_OTP_ATTEMPTS - attempts;
    if (remaining <= 0) {
      deleteOtp(email);
      throw new AuthError(
        'TOO_MANY_ATTEMPTS',
        'Too many invalid attempts. Please request a new verification code.',
        429,
      );
    }
    throw new AuthError(
      'INVALID_OTP',
      `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
      400,
    );
  }

  // OTP verified successfully: delete to prevent reuse
  deleteOtp(email);

  const user = await findUserByEmail(client, email);
  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  const membership = await toMembership(user);
  const tokens = generateTokenPair(
    {
      id: user.id,
      email: user.email,
      role: membership.role,
      companyId: user.companyId,
      orgId: membership.organizationId,
    },
    {
      accessSecret: options.accessSecret,
      refreshSecret: options.refreshSecret,
      accessExpiresIn: options.accessExpiresIn,
      refreshExpiresIn: options.refreshExpiresIn,
    },
  );

  await createSession(client, { userId: user.id, familyId: newSessionFamilyId(), refreshToken: tokens.refreshToken });

  return {
    ok: true,
    user: formatAuthUser(user, membership),
    tokens,
  };
}

/**
 * Resend a new OTP verification code to the user:
 * 1. Validates input schema and optional otpToken.
 * 2. Checks resend cooldown (30 seconds).
 * 3. Generates a new OTP, updates the store, and dispatches via Nodemailer.
 */
export async function resendOtp(
  input: ResendOtpInput | unknown,
  options: AuthControllerOptions = {},
): Promise<{ ok: true; message: string; otpToken: string }> {
  const client = options.db ?? defaultDb;

  const parseResult = resendOtpSchema.safeParse(input);
  if (!parseResult.success) {
    throw new AuthError(
      'VALIDATION_ERROR',
      'Validation failed for resend OTP input',
      400,
      parseResult.error.flatten(),
    );
  }

  const { email, otpToken } = parseResult.data;

  if (otpToken) {
    try {
      const payload = verifyOtpToken(otpToken, options.accessSecret);
      if (payload.email.toLowerCase() !== email.toLowerCase()) {
        throw new AuthError('INVALID_OTP', 'OTP session mismatch', 400);
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError('INVALID_OTP', 'Invalid or expired OTP session. Please sign in again.', 400);
    }
  }

  const user = await findUserByEmail(client, email);
  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  const cooldown = canResendOtp(email);
  if (!cooldown.allowed) {
    throw new AuthError(
      'RATE_LIMITED',
      `Please wait ${cooldown.waitSeconds} second${cooldown.waitSeconds === 1 ? '' : 's'} before requesting a new code.`,
      429,
    );
  }

  const otp = generateOtpCode();
  storeOtp(user.email, { code: otp, userId: user.id });
  const newOtpToken = signOtpToken({ userId: user.id, email: user.email }, options.accessSecret);

  await sendOtpEmail({
    to: user.email,
    otp,
    name: user.name ?? undefined,
  });

  return {
    ok: true,
    message: 'A new verification code has been sent to your email.',
    otpToken: newOtpToken,
  };
}

/**
 * Refresh access token using a valid refresh token:
 * 1. Validates refresh token presence.
 * 2. Verifies token signature and expiration.
 * 3. Rotates the hashed session; reuse of a spent token revokes the whole family.
 * 4. Issues new access and refresh tokens.
 */
export async function refresh(
  input: RefreshTokenInput | unknown,
  options: AuthControllerOptions = {},
  switchTo?: { organizationId: string },
): Promise<AuthSuccessResult> {
  const client = options.db ?? defaultDb;

  const parseResult = refreshTokenSchema.safeParse(input);
  if (!parseResult.success) {
    // A missing token is simply "no session" (401), not a malformed request: anonymous visitors hit this.
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token is required', 401);
  }

  const { refreshToken: incomingToken } = parseResult.data;

  let decoded: { userId: number; email?: string; orgId?: string };
  try {
    decoded = verifyRefreshToken(incomingToken, options.refreshSecret);
  } catch (err) {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
  }

  const user = await findUserById(client, decoded.userId);
  if (!user) {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
  }

  // A refresh keeps the organization the session was in; an explicit switch must target an organization
  // the user actually belongs to.
  const membership = await toMembership(user, switchTo?.organizationId ?? decoded.orgId);
  if (switchTo && membership.organizationId !== switchTo.organizationId) {
    throw new AuthError('FORBIDDEN', 'You are not a member of that organization', 403);
  }
  const tokens = generateTokenPair(
    { id: user.id, email: user.email, role: membership.role, companyId: user.companyId, orgId: membership.organizationId },
    {
      accessSecret: options.accessSecret,
      refreshSecret: options.refreshSecret,
      accessExpiresIn: options.accessExpiresIn,
      refreshExpiresIn: options.refreshExpiresIn,
    },
  );

  // Rotate atomically: lock the presented session, mark it used, issue its successor in the same family.
  // A token that was already used means it was stolen or replayed: revoke the whole family.
  const outcome = await client.transaction(async (tx) => {
    const session = await tx.orm.public.Session.where({ tokenHash: hashRefreshToken(incomingToken) })
      .forUpdate()
      .first();
    if (!session || session.userId !== user.id) return 'invalid' as const;
    if (session.revokedAt) {
      await revokeSessionFamily(tx, session.familyId);
      return 'reuse' as const;
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) return 'invalid' as const;

    await tx.orm.public.Session.where({ id: session.id }).update({ revokedAt: new Date().toISOString() });
    await createSession(tx, { userId: user.id, familyId: session.familyId, refreshToken: tokens.refreshToken });
    return 'rotated' as const;
  });

  if (outcome !== 'rotated') {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
  }

  return {
    ok: true,
    user: formatAuthUser(user, membership),
    tokens,
  };
}

/**
 * Log out by revoking the session family of the presented refresh token:
 * Accepts { refreshToken?: string }.
 */
export async function logout(
  input: LogoutInput | unknown,
  options: AuthControllerOptions = {},
): Promise<LogoutSuccessResult> {
  const client = options.db ?? defaultDb;

  const parseResult = logoutSchema.safeParse(input ?? {});
  const data = parseResult.success ? parseResult.data : {};

  // The session is identified only by the presented token's hash; a client-supplied userId is never trusted.
  if (data.refreshToken) {
    const session = await client.orm.public.Session.where({
      tokenHash: hashRefreshToken(data.refreshToken),
    }).first();
    if (session) await revokeSessionFamily(client, session.familyId);
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
  organizationId?: string,
): Promise<GetMeSuccessResult> {
  const client = options.db ?? defaultDb;

  const user = await findUserById(client, userId);
  if (!user) {
    throw new AuthError('USER_NOT_FOUND', 'User not found', 404);
  }

  return {
    ok: true,
    // Report the organization/role the session is actually acting in (from the access token).
    user: formatAuthUser(user, await toMembership(user, organizationId)),
  };
}

export type GoogleAuthInput = {
  credential?: string;
  email?: string;
  name?: string;
  picture?: string;
};

/**
 * Authenticate via Google OAuth / Google Identity Services:
 * 1. Parses Google credential JWT (or direct email/name for local dev/testing).
 * 2. Finds existing user by email or auto-provisions a new tenant/user with owner role.
 * 3. Generates session tokens and creates session family.
 */
export async function googleLogin(
  input: GoogleAuthInput | unknown,
  options: AuthControllerOptions = {},
): Promise<AuthSuccessResult> {
  const client = options.db ?? defaultDb;

  let email: string | undefined;
  let name: string | undefined;

  if (typeof input === 'object' && input !== null) {
    const raw = input as Record<string, unknown>;
    if (typeof raw.credential === 'string' && raw.credential) {
      try {
        const parts = raw.credential.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (payload && typeof payload.email === 'string') {
            const expectedAud = process.env.GOOGLE_CLIENT_ID;
            if (expectedAud && payload.aud && payload.aud !== expectedAud) {
              throw new AuthError('UNAUTHORIZED', 'Invalid Google token audience', 401);
            }
            email = payload.email.toLowerCase().trim();
            name = typeof payload.name === 'string' ? payload.name.trim() : undefined;
          }
        }
      } catch {
        // Fall back to direct fields if decode fails
      }
    }
    if (!email && typeof raw.email === 'string') {
      email = raw.email.toLowerCase().trim();
      name = typeof raw.name === 'string' ? raw.name.trim() : undefined;
    }
  }

  if (!email || !email.includes('@')) {
    throw new AuthError('VALIDATION_ERROR', 'A valid email from Google is required', 400);
  }

  let user = await findUserByEmail(client, email);

  if (!user) {
    const fallbackPassword = await hashPassword(randomUUID());
    const result = await createAccount(client, {
      email,
      passwordHash: fallbackPassword,
      name: name ?? email.split('@')[0],
      companyName: name ? `${name}'s Workspace` : `${email.split('@')[0]}'s Workspace`,
    });
    user = result.user;
  }

  const membership = await toMembership(user);
  const tokens = generateTokenPair(
    {
      id: user.id,
      email: user.email,
      role: membership.role,
      companyId: user.companyId,
      orgId: membership.organizationId,
    },
    {
      accessSecret: options.accessSecret,
      refreshSecret: options.refreshSecret,
      accessExpiresIn: options.accessExpiresIn,
      refreshExpiresIn: options.refreshExpiresIn,
    },
  );

  await createSession(client, { userId: user.id, familyId: newSessionFamilyId(), refreshToken: tokens.refreshToken });

  return {
    ok: true,
    user: formatAuthUser(user, membership),
    tokens,
  };
}

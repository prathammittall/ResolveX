import {
  isAuthError,
  login,
  verifyOtp,
  resendOtp,
  googleLogin,
  logout,
  refresh,
  register,
  getMe,
  type AuthControllerOptions,
} from './controller.js';
import {
  buildAuthCookies,
  buildLogoutCookies,
  jsonWithCookies,
  parseCookies,
} from './cookies.js';
import { verifyAccessToken } from './model.js';

function handleError(error: unknown): Response {
  if (isAuthError(error)) {
    return Response.json(
      { ok: false, error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  return Response.json(
    { ok: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 },
  );
}

export async function handleRegister(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    const data = await req.json();
    const result = await register(data, options);
    const cookies = buildAuthCookies(result.tokens, options);
    return jsonWithCookies(result, cookies, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function handleLogin(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    const data = await req.json();
    const result = await login(data, options);
    if (result.requireOtp) {
      return Response.json(result, { status: 200 });
    }
    const cookies = buildAuthCookies(result.tokens, options);
    return jsonWithCookies(result, cookies, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

export async function handleVerifyOtp(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    const data = await req.json();
    const result = await verifyOtp(data, options);
    const cookies = buildAuthCookies(result.tokens, options);
    return jsonWithCookies(result, cookies, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

export async function handleResendOtp(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    const data = await req.json();
    const result = await resendOtp(data, options);
    return Response.json(result, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

export async function handleGoogleLogin(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    const data = await req.json();
    const result = await googleLogin(data, options);
    const cookies = buildAuthCookies(result.tokens, options);
    return jsonWithCookies(result, cookies, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

export async function handleRefreshToken(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    let data: Record<string, unknown> = {};
    try {
      data = await req.json();
    } catch {
      data = {};
    }
    if (!data.refreshToken) {
      const cookies = parseCookies(req.headers.get('cookie'));
      const tokenFromCookie = cookies['refreshToken'] || cookies['refresh_token'];
      if (tokenFromCookie) {
        data = { ...data, refreshToken: tokenFromCookie };
      }
    }
    const result = await refresh(data, options);
    const cookies = buildAuthCookies(result.tokens, options);
    return jsonWithCookies(result, cookies, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /auth/switch-org {organizationId}: re-issue the session for another organization the user belongs to. */
export async function handleSwitchOrg(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const organizationId = body.organizationId;
    if (typeof organizationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(organizationId)) {
      return Response.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: 'organizationId is required' } },
        { status: 400 },
      );
    }
    const cookies = parseCookies(req.headers.get('cookie'));
    const refreshToken = cookies['refreshToken'] || cookies['refresh_token'];
    const result = await refresh({ refreshToken }, options, { organizationId });
    return jsonWithCookies(result, buildAuthCookies(result.tokens, options), { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

export async function handleLogout(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    let data: Record<string, unknown> = {};
    try {
      data = await req.json();
    } catch {
      data = {};
    }
    if (!data.refreshToken) {
      const cookies = parseCookies(req.headers.get('cookie'));
      const tokenFromCookie = cookies['refreshToken'] || cookies['refresh_token'];
      if (tokenFromCookie) {
        data = { ...data, refreshToken: tokenFromCookie };
      }
    }
    const result = await logout(data, options);
    const cookies = buildLogoutCookies();
    return jsonWithCookies(result, cookies, { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}

export async function handleGetMe(req: Request, options?: AuthControllerOptions): Promise<Response> {
  try {
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      const cookies = parseCookies(req.headers.get('cookie'));
      token = cookies['accessToken'] || cookies['access_token'] || null;
    }
    if (!token) {
      return Response.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Authorization token required' } },
        { status: 401 },
      );
    }
    const payload = verifyAccessToken(token, options?.accessSecret);
    return Response.json(await getMe(payload.userId, options, payload.orgId));
  } catch (err) {
    if (isAuthError(err)) return handleError(err);
    return Response.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      { status: 401 },
    );
  }
}

export async function authRouter(req: Request, options?: AuthControllerOptions): Promise<Response> {
  const { pathname } = new URL(req.url);
  const method = req.method.toUpperCase();

  if (method === 'POST') {
    if (pathname.endsWith('/register')) return handleRegister(req, options);
    if (pathname.endsWith('/login')) return handleLogin(req, options);
    if (pathname.endsWith('/verify-otp')) return handleVerifyOtp(req, options);
    if (pathname.endsWith('/resend-otp')) return handleResendOtp(req, options);
    if (pathname.endsWith('/google')) return handleGoogleLogin(req, options);
    if (pathname.endsWith('/refresh')) return handleRefreshToken(req, options);
    if (pathname.endsWith('/logout')) return handleLogout(req, options);
    if (pathname.endsWith('/switch-org')) return handleSwitchOrg(req, options);
  }
  if (method === 'GET' && pathname.endsWith('/me')) {
    return handleGetMe(req, options);
  }

  return Response.json(
    { ok: false, error: { code: 'NOT_FOUND', message: `Route not found` } },
    { status: 404 },
  );
}

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
  console.error('[auth.route] Unhandled error:', error);
  return Response.json(
    {
      ok: false,
      error: {
        code: 'INTERNAL',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    },
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

export function handleGoogleRedirect(req: Request): Response {
  const url = new URL(req.url);
  const appUrl = (process.env.APP_URL || `${url.protocol}//${url.host}`).replace(/\/$/, '');
  const redirectUri = `${appUrl}/api/auth/google/callback`;
  const next = url.searchParams.get('next') || '/dashboard';

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Response.redirect(`${appUrl}/login?error=Google+login+is+not+configured`, 302);
  }

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', clientId);
  googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid email profile');
  googleAuthUrl.searchParams.set('prompt', 'select_account');
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('state', next);

  return Response.redirect(googleAuthUrl.toString(), 302);
}

export async function handleGoogleCallback(req: Request, options?: AuthControllerOptions): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const state = url.searchParams.get('state') || '/dashboard';
  const target = state.startsWith('/') && !state.startsWith('//') && !state.includes('\\') ? state : '/dashboard';
  const appUrl = (process.env.APP_URL || `${url.protocol}//${url.host}`).replace(/\/$/, '');

  if (error || !code) {
    const errorMsg = error || 'Google sign-in was canceled';
    return Response.redirect(`${appUrl}/login?error=${encodeURIComponent(errorMsg)}`, 302);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId || '',
        client_secret: clientSecret || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      console.warn('Google token exchange failed:', tokenRes.status, errText);
      return Response.redirect(`${appUrl}/login?error=Google+authentication+failed`, 302);
    }

    const tokenData = (await tokenRes.json()) as { id_token?: string; access_token?: string };
    let email: string | undefined;
    let name: string | undefined;

    if (tokenData.id_token) {
      try {
        const parts = tokenData.id_token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          email = typeof payload.email === 'string' ? payload.email : undefined;
          name = typeof payload.name === 'string' ? payload.name : undefined;
        }
      } catch {
        // fallback
      }
    }

    if (!email && tokenData.access_token) {
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userinfoRes.ok) {
          const userinfo = (await userinfoRes.json()) as { email?: string; name?: string };
          email = typeof userinfo.email === 'string' ? userinfo.email : undefined;
          name = typeof userinfo.name === 'string' ? userinfo.name : undefined;
        }
      } catch {
        // fallback
      }
    }

    if (!email) {
      return Response.redirect(`${appUrl}/login?error=No+verified+email+received+from+Google`, 302);
    }

    const result = await googleLogin({ email, name, credential: tokenData.id_token }, options);
    const cookies = buildAuthCookies(result.tokens, options);

    const redirectResponse = new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}${target}` },
    });
    for (const cookie of cookies) {
      redirectResponse.headers.append('Set-Cookie', cookie);
    }
    return redirectResponse;
  } catch (err) {
    console.error('Failed to complete Google login callback:', err);
    return Response.redirect(`${appUrl}/login?error=Unexpected+login+error`, 302);
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
  if (method === 'GET') {
    if (pathname.endsWith('/me')) return handleGetMe(req, options);
    if (pathname.endsWith('/google/callback') || pathname.endsWith('/auth/google/callback')) {
      return handleGoogleCallback(req, options);
    }
    if (pathname.endsWith('/google') || pathname.endsWith('/auth/google')) {
      return handleGoogleRedirect(req);
    }
  }

  return Response.json(
    { ok: false, error: { code: 'NOT_FOUND', message: `Route not found` } },
    { status: 404 },
  );
}

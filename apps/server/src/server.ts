import 'dotenv/config';
import http from 'node:http';
import { Readable } from 'node:stream';
import { authRouter } from './services/auth/index.js';
import { processAlertWebhook, isAlertProcessingError, type AlertErrorBody } from './services/incident-engine/index.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Handle incoming web standard Request and return a web standard Response.
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const method = req.method.toUpperCase();

  // Root / Health check
  if (method === 'GET' && (pathname === '/' || pathname === '/health' || pathname === '/api/health')) {
    return Response.json({
      ok: true,
      service: 'ResolveX Server',
      status: 'healthy',
      port: PORT,
      timestamp: new Date().toISOString(),
    });
  }

  // Auth routes: /api/auth/* or /auth/* or /register, /login, /refresh, /logout, /me
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/auth') ||
    pathname === '/register' ||
    pathname === '/login' ||
    pathname === '/refresh' ||
    pathname === '/logout' ||
    pathname === '/me'
  ) {
    return authRouter(req);
  }

  // Webhook routes: /api/webhooks/alerts or /webhooks/alerts
  if (method === 'POST' && (pathname === '/api/webhooks/alerts' || pathname === '/webhooks/alerts')) {
    try {
      const rawBody = await req.text();
      const result = await processAlertWebhook({
        rawBody,
        headers: {
          authorization: req.headers.get('authorization'),
          signature: req.headers.get('x-webhook-signature'),
        },
      });

      const status = result.duplicate ? 200 : 201;
      return Response.json(result, { status });
    } catch (error) {
      if (isAlertProcessingError(error)) {
        const body: AlertErrorBody = {
          ok: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        };
        return Response.json(body, { status: error.status });
      }

      console.error('[webhooks/alerts] unexpected error:', error);
      const body: AlertErrorBody = {
        ok: false,
        error: {
          code: 'INTERNAL',
          message: 'Failed to process alert',
        },
      };
      return Response.json(body, { status: 500 });
    }
  }

  return Response.json(
    {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${method} ${pathname} not found`,
      },
    },
    { status: 404 },
  );
}

/**
 * Node HTTP Server adapter.
 */
const server = http.createServer(async (nodeReq, nodeRes) => {
  // CORS Headers
  const origin = nodeReq.headers.origin;
  if (origin) {
    nodeRes.setHeader('Access-Control-Allow-Origin', origin);
    nodeRes.setHeader('Access-Control-Allow-Credentials', 'true');
    nodeRes.setHeader('Vary', 'Origin');
  } else {
    nodeRes.setHeader('Access-Control-Allow-Origin', '*');
  }
  nodeRes.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  nodeRes.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Signature');

  if (nodeReq.method === 'OPTIONS') {
    nodeRes.statusCode = 204;
    nodeRes.end();
    return;
  }

  try {
    const protocol = nodeReq.headers['x-forwarded-proto'] || 'http';
    const host = nodeReq.headers.host || `localhost:${PORT}`;
    const serverUrl = `${protocol}://${host}`;
    const url = new URL(nodeReq.url || '/', serverUrl);

    const headers = new Headers();
    for (const [key, val] of Object.entries(nodeReq.headers)) {
      if (val !== undefined) {
        if (Array.isArray(val)) {
          val.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, val);
        }
      }
    }

    const hasBody = nodeReq.method !== 'GET' && nodeReq.method !== 'HEAD';
    const body = hasBody ? (Readable.toWeb(nodeReq) as ReadableStream) : null;

    const request = new Request(url.toString(), {
      method: nodeReq.method,
      headers,
      body,
      // @ts-ignore Node.js fetch duplex requirement when body is stream
      duplex: 'half',
    });

    const response = await handleRequest(request);

    nodeRes.statusCode = response.status;

    // Web standard Response headers can have multiple Set-Cookie headers.
    // getSetCookie() returns string[] with each cookie; nodeRes.setHeader accepts string[].
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];

    if (setCookies.length > 0) {
      nodeRes.setHeader('Set-Cookie', setCookies);
    }

    response.headers.forEach((val, key) => {
      // Set-Cookie is already set as an array above
      if (key.toLowerCase() === 'set-cookie') return;
      // Don't overwrite CORS headers if already set
      if (!nodeRes.hasHeader(key)) {
        nodeRes.setHeader(key, val);
      }
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeRes.write(value);
      }
    }
    nodeRes.end();
  } catch (err) {
    console.error('Unhandled server error:', err);
    if (!nodeRes.headersSent) {
      nodeRes.statusCode = 500;
      nodeRes.setHeader('Content-Type', 'application/json');
      nodeRes.end(JSON.stringify({ ok: false, error: { code: 'INTERNAL', message: 'Internal server error' } }));
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[server] ResolveX HTTP server running on http://localhost:${PORT}`);
});

export default server;

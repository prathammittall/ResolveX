import 'dotenv/config';
import { createApp } from './app.js';
import { assertAuthConfig } from './services/auth/index.js';
import { startWorkerLoops } from './worker.js';

// Fail fast on missing/weak secrets instead of falling back to defaults.
assertAuthConfig();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = createApp().listen(PORT, HOST, () => {
  console.log(`[server] ResolveX Express server running on http://localhost:${PORT}`);
});

// Run background worker loops embedded inside the server process unless explicitly disabled
// (e.g. In multi-container Docker environments where a dedicated worker container runs).
const workerController = new AbortController();
if (process.env.DISABLE_EMBEDDED_WORKER !== 'true') {
  startWorkerLoops(workerController.signal);
  console.log('[server] Embedded background worker loops started (monitoring, escalations, alerts)');
}

// Proxies (the Next.js rewrite, Traefik, load balancers) reuse idle connections for longer than Node's
// 5s default keep-alive; closing them first makes the proxy's next request fail with a 500 ("socket hang up").
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down`);
  workerController.abort();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;

import 'dotenv/config';
import http from 'node:http';
import { processNextQueueJob } from './services/incident-engine/queue-worker.js';
import { assertAuthConfig } from './services/auth/index.js';
import { pruneMonitorChecks, runDueMonitors } from './services/monitoring/engine.js';
import { deliverPendingEmails } from './services/notify/index.js';
import { deliverPendingWebhooks } from './services/integrations/webhooks.js';
import { log } from './lib/logger.js';

assertAuthConfig();

/**
 * Background worker — runs independently of any browser session, so monitoring, escalation and
 * delivery continue when nobody is logged in. All state lives in PostgreSQL and every loop claims work
 * with row-level locks / lease timestamps, so several worker replicas can run side by side.
 *
 * Loops:
 *  - escalation queue (QueueJob: notify / escalate)
 *  - API monitor scheduler (Monitor.nextCheckAt)
 *  - notification email delivery (Notification.emailStatus)
 *  - outgoing webhook delivery (WebhookDelivery)
 *  - retention (MonitorCheck history)
 */
const lastTick: Record<string, string> = {};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });

function loop(name: string, intervalMs: number, step: () => Promise<number | boolean | void>, signal: AbortSignal): Promise<void> {
  return (async () => {
    while (!signal.aborted) {
      let busy = false;
      try {
        const result = await step();
        busy = result === true || (typeof result === 'number' && result > 0);
      } catch (error) {
        log.error('worker.loop_error', { loop: name, error: error instanceof Error ? error.message : 'unknown' });
      }
      lastTick[name] = new Date().toISOString();
      if (!busy) await sleep(intervalMs, signal);
    }
  })();
}

/**
 * Start the background worker loops (monitoring, escalation, email, webhooks, retention).
 * Can be run embedded in the Express API process or independently in a dedicated worker process.
 */
export function startWorkerLoops(signal: AbortSignal): Promise<void>[] {
  log.info('worker.started', { pid: process.pid });
  return [
    loop('escalation', 1_000, () => processNextQueueJob(), signal),
    loop('monitors', 2_000, () => runDueMonitors(), signal),
    loop('emails', 5_000, () => deliverPendingEmails(), signal),
    loop('webhooks', 5_000, () => deliverPendingWebhooks(), signal),
    loop('retention', 3_600_000, async () => {
      await pruneMonitorChecks();
    }, signal),
  ];
}

// Standalone runner: when invoked directly via `tsx src/worker.ts` or `npm run worker`
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('worker.ts') || process.argv[1].endsWith('worker.js'));

if (isDirectRun) {
  const controller = new AbortController();
  const { signal } = controller;

  const healthPort = Number(process.env.WORKER_HEALTH_PORT);
  const healthServer =
    Number.isInteger(healthPort) && healthPort > 0
      ? http
          .createServer((_req, res) => {
            res.writeHead(signal.aborted ? 503 : 200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: !signal.aborted, loops: lastTick }));
          })
          .listen(healthPort)
      : null;

  function shutdown(sig: string) {
    if (signal.aborted) return;
    log.info('worker.stopping', { signal: sig });
    controller.abort();
    healthServer?.close();
    setTimeout(() => process.exit(1), 25_000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const loops = startWorkerLoops(signal);
  await Promise.all(loops);
  log.info('worker.stopped');
  process.exit(0);
}

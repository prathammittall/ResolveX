import 'dotenv/config';
import { runQueueWorker } from './services/incident-engine/queue-worker.js';
import { assertAuthConfig } from './services/auth/index.js';

assertAuthConfig();

const controller = new AbortController();
process.on('SIGTERM', () => controller.abort());
process.on('SIGINT', () => controller.abort());

console.log('[worker] ResolveX queue worker started');
await runQueueWorker({ signal: controller.signal });
console.log('[worker] ResolveX queue worker stopped');

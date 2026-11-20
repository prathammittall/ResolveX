/**
 * Minimal structured logger: one JSON object per line, so log shippers (Loki, CloudWatch, Dokploy)
 * can index fields. Never pass secrets, tokens or raw request bodies as fields.
 */
type Fields = Record<string, unknown>;
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL as Level) ?? 'info'] ?? LEVELS.info;
const pretty = process.env.LOG_FORMAT === 'pretty';

function write(level: Level, msg: string, fields?: Fields) {
  if (LEVELS[level] < threshold) return;
  const entry = { ts: new Date().toISOString(), level, msg, ...fields };
  const line = pretty ? `[${entry.ts}] ${level.toUpperCase()} ${msg} ${fields ? JSON.stringify(fields) : ''}` : JSON.stringify(entry);
  if (level === 'error' || level === 'warn') console.error(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Fields) => write('debug', msg, fields),
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
};

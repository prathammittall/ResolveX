import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { LookupFunction } from 'node:net';

/**
 * Outbound HTTP for user-supplied URLs (API monitors, customer webhooks).
 *
 * Defences against using ResolveX as an internal network scanner (SSRF):
 *  - only http/https, no credentials in the URL, only explicitly allowed ports;
 *  - every resolved address is checked against private, loopback, link-local, CGNAT, multicast and
 *    reserved ranges (IPv4 and IPv6, including IPv4-mapped IPv6);
 *  - the check runs inside the socket's DNS lookup, so the address we validated is the one we connect to
 *    (no DNS-rebinding window);
 *  - redirects are followed manually (bounded) and every hop is re-validated;
 *  - hard timeout and a response-size cap.
 *
 * Self-hosted installs that intentionally monitor internal services can set ALLOW_PRIVATE_NETWORK_TARGETS=true.
 */

export class UnsafeTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeTargetError';
  }
}

const allowPrivate = () => process.env.ALLOW_PRIVATE_NETWORK_TARGETS === 'true';

function allowedPorts(): Set<number> | null {
  const raw = process.env.OUTBOUND_ALLOWED_PORTS;
  if (raw === '*') return null;
  const ports = (raw ?? '80,443,8080,8443,3000,5000,8000,9000')
    .split(',')
    .map((p) => Number(p.trim()))
    .filter((p) => Number.isInteger(p) && p > 0 && p < 65536);
  return new Set(ports);
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const V4_BLOCKS: Array<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function isBlockedV4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  return V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedV6(ip: string): boolean {
  const lower = ip.toLowerCase().split('%')[0] ?? '';
  if (lower === '::' || lower === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return isBlockedV4(mapped[1]);
  if (/^::ffff:/.test(lower)) return true;
  const first = parseInt(lower.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (lower.startsWith('64:ff9b:')) return true; // NAT64
  if (lower.startsWith('2001:db8')) return true; // documentation
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return isBlockedV4(ip);
  if (family === 6) return isBlockedV6(ip);
  return true;
}

/** Validate a URL's static shape (scheme, credentials, port, literal IPs). Throws UnsafeTargetError. */
export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeTargetError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new UnsafeTargetError('Only HTTP and HTTPS URLs are allowed');
  if (url.username || url.password) throw new UnsafeTargetError('Credentials in the URL are not allowed; use headers');
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  const ports = allowedPorts();
  if (ports && !ports.has(port)) throw new UnsafeTargetError(`Port ${port} is not allowed`);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!allowPrivate()) {
    if (net.isIP(host) && isBlockedAddress(host)) throw new UnsafeTargetError('Private or reserved addresses are not allowed');
    const lowered = host.toLowerCase();
    if (lowered === 'localhost' || lowered.endsWith('.localhost') || lowered.endsWith('.internal') || lowered.endsWith('.local')) {
      throw new UnsafeTargetError('Internal host names are not allowed');
    }
  }
  return url;
}

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = (Array.isArray(addresses) ? addresses : []) as dns.LookupAddress[];
    if (list.length === 0) return callback(new UnsafeTargetError('Host did not resolve'), '', 0);
    if (!allowPrivate()) {
      const bad = list.find((a) => isBlockedAddress(a.address));
      if (bad) return callback(new UnsafeTargetError('Host resolves to a private or reserved address'), '', 0);
    }
    const chosen = list[0]!;
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, chosen.address, chosen.family);
  });
};

export type SafeRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBodyBytes?: number;
  maxRedirects?: number;
};

export type SafeResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
  latencyMs: number;
  finalUrl: string;
};

function once(req: SafeRequest, url: URL, deadline: number): Promise<SafeResponse & { location?: string }> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const lib = url.protocol === 'https:' ? https : http;
    const remaining = Math.max(deadline - Date.now(), 1);
    const maxBytes = req.maxBodyBytes ?? 256 * 1024;
    const r = lib.request(
      url,
      {
        method: req.method ?? 'GET',
        headers: { 'user-agent': 'ResolveX-Monitor/1.0', ...(req.headers ?? {}) },
        lookup: guardedLookup,
        timeout: remaining,
        agent: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on('data', (chunk: Buffer) => {
          if (truncated) return;
          size += chunk.length;
          if (size > maxBytes) {
            truncated = true;
            chunks.push(chunk.subarray(0, Math.max(0, maxBytes - (size - chunk.length))));
            res.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
        });
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(', ') : String(v);
          resolve({
            status: res.statusCode ?? 0,
            headers,
            body: Buffer.concat(chunks).toString('utf8'),
            truncated,
            latencyMs: Date.now() - started,
            finalUrl: url.toString(),
            location: typeof res.headers.location === 'string' ? res.headers.location : undefined,
          });
        };
        res.on('end', finish);
        res.on('close', finish);
        res.on('error', (e) => (done ? undefined : reject(e)));
      },
    );
    r.on('timeout', () => r.destroy(new Error(`Timed out after ${req.timeoutMs ?? 10_000}ms`)));
    r.on('error', reject);
    if (req.body && req.method && !['GET', 'HEAD'].includes(req.method.toUpperCase())) r.write(req.body);
    r.end();
  });
}

/** Perform a guarded request, following up to `maxRedirects` validated redirects. */
export async function safeRequest(req: SafeRequest): Promise<SafeResponse> {
  const timeoutMs = Math.min(Math.max(req.timeoutMs ?? 10_000, 500), 60_000);
  const deadline = Date.now() + timeoutMs;
  const started = Date.now();
  let url = assertSafeUrl(req.url);
  let method = req.method ?? 'GET';
  let body = req.body;
  for (let hop = 0; hop <= (req.maxRedirects ?? 5); hop++) {
    const res = await once({ ...req, method, body, timeoutMs }, url, deadline);
    if ([301, 302, 303, 307, 308].includes(res.status) && res.location) {
      url = assertSafeUrl(new URL(res.location, url).toString());
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
      continue;
    }
    return { ...res, latencyMs: Date.now() - started };
  }
  throw new UnsafeTargetError('Too many redirects');
}

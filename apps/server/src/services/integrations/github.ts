import { createHmac } from 'node:crypto';
import { db } from '../../prisma/db.js';
import { decryptSecret, encryptSecret, hmacSha256Hex, safeEqual } from '../../lib/crypto.js';
import { log } from '../../lib/logger.js';
import { recordDeployment } from '../api/modules/ops.js';

/**
 * GitHub integration:
 *  - OAuth (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET): connect an account; the token is stored AES-GCM encrypted.
 *  - Repository webhooks: each linked repo has its own secret; payloads are verified with X-Hub-Signature-256.
 *    push → commits, pull_request → PRs, deployment_status → Deployments on the linked service.
 *  - Task references (e.g. PAY-12) found in branch names, commit messages and PR titles link activity to tickets.
 */
export const githubConfigured = () => Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

function stateSecret() {
  return process.env.JWT_ACCESS_SECRET ?? 'unset';
}

export function githubAuthorizeUrl(companyId: number, userId: number): string {
  const payload = Buffer.from(JSON.stringify({ c: companyId, u: userId, e: Date.now() + 10 * 60_000 })).toString('base64url');
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
  const redirect = `${(process.env.PUBLIC_API_URL || process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '')}/api/integrations/github/callback`;
  const params = new URLSearchParams({ client_id: process.env.GITHUB_CLIENT_ID!, redirect_uri: redirect, scope: 'repo read:org', state: `${payload}.${sig}` });
  return `https://github.com/login/oauth/authorize?${params}`;
}

/** OAuth callback (unauthenticated route; the signed, expiring state carries the company and user). */
export async function handleGithubCallback(url: URL): Promise<Response> {
  const appUrl = (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  const back = (status: string) => Response.redirect(`${appUrl}/dashboard/integrations?github=${status}`, 302);
  try {
    const [payload, sig] = (url.searchParams.get('state') ?? '').split('.');
    const code = url.searchParams.get('code');
    if (!payload || !sig || !code) return back('invalid');
    const expected = createHmac('sha256', stateSecret()).update(payload).digest('base64url');
    if (!safeEqual(sig, expected)) return back('invalid');
    const state = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { c: number; u: number; e: number };
    if (Date.now() > state.e) return back('expired');
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code }),
      signal: AbortSignal.timeout(10_000),
    });
    const token = (await tokenRes.json()) as { access_token?: string; scope?: string };
    if (!token.access_token) return back('denied');
    const me = (await (await fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${token.access_token}`, 'user-agent': 'ResolveX' } })).json()) as { login?: string };
    const data = { accountLogin: me.login ?? 'unknown', accessTokenEncrypted: encryptSecret(token.access_token), scopes: token.scope ?? null, connectedById: state.u };
    const existing = await db.orm.public.GitHubConnection.where({ companyId: state.c }).first();
    if (existing) await db.orm.public.GitHubConnection.where({ id: existing.id }).update(data);
    else await db.orm.public.GitHubConnection.create({ companyId: state.c, ...data });
    return back('connected');
  } catch (error) {
    log.warn('github.callback_failed', { error: error instanceof Error ? error.message : 'unknown' });
    return back('error');
  }
}

export async function listRepoActivity(token: string, fullName: string) {
  const gh = (path: string) =>
    fetch(`https://api.github.com/repos/${fullName}${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'ResolveX' }, signal: AbortSignal.timeout(10_000) }).then(async (r) => {
      if (!r.ok) throw new Error(`GitHub returned HTTP ${r.status}`);
      return r.json() as Promise<Array<Record<string, any>>>;
    });
  const [commits, pulls] = await Promise.all([gh('/commits?per_page=10'), gh('/pulls?state=all&per_page=10')]);
  return {
    commits: commits.map((c) => ({ sha: c.sha, message: String(c.commit?.message ?? '').split('\n')[0], author: c.commit?.author?.name, url: c.html_url, date: c.commit?.author?.date })),
    pullRequests: pulls.map((p) => ({ number: p.number, title: p.title, state: p.merged_at ? 'merged' : p.state, author: p.user?.login, url: p.html_url, updatedAt: p.updated_at })),
  };
}

export function extractTaskRefs(...texts: Array<string | null | undefined>): string[] {
  const refs = new Set<string>();
  for (const t of texts) for (const m of (t ?? '').matchAll(/\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b/gi)) refs.add(`${m[1]!.toUpperCase()}-${m[2]}`);
  return [...refs].slice(0, 20);
}

/** Verified GitHub webhook receiver. */
export async function handleGithubWebhook(rawBody: string, headers: { signature: string | null; event: string | null; delivery: string | null }): Promise<Response> {
  const fail = (status: number, message: string) => Response.json({ ok: false, error: { code: 'WEBHOOK_REJECTED', message } }, { status });
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return fail(400, 'Invalid JSON');
  }
  const fullName: string | undefined = payload.repository?.full_name;
  if (!fullName || !headers.signature?.startsWith('sha256=')) return fail(401, 'Missing signature');
  const links = await db.orm.public.RepositoryLink.where({ fullName }).all();
  // Find the link whose secret verifies the signature (a repo may be linked by more than one org).
  const link = links.find((l) => {
    try {
      return safeEqual(`sha256=${hmacSha256Hex(decryptSecret(l.webhookSecretEncrypted), rawBody)}`, headers.signature!);
    } catch {
      return false;
    }
  });
  if (!link) return fail(401, 'Signature verification failed');
  const companyId = link.companyId;
  const store = async (kind: string, externalId: string, data: { title: string; url?: string; author?: string; state?: string; branch?: string; occurredAt?: string }, refs: string[]) => {
    const existing = await db.orm.public.GitHubEvent.where({ companyId, kind, externalId }).first();
    if (existing) return db.orm.public.GitHubEvent.where({ id: existing.id }).update({ state: data.state ?? null, title: data.title.slice(0, 500) });
    return db.orm.public.GitHubEvent.create({ companyId, repository: fullName, kind, externalId, title: data.title.slice(0, 500), url: data.url ?? null, author: data.author ?? null, state: data.state ?? null, branch: data.branch ?? null, taskRefs: refs as never, occurredAt: data.occurredAt ?? new Date().toISOString() });
  };
  const event = headers.event;
  if (event === 'ping') return Response.json({ ok: true, pong: true });
  if (event === 'push') {
    const branch = String(payload.ref ?? '').replace('refs/heads/', '');
    for (const c of (payload.commits ?? []).slice(0, 50)) {
      await store('commit', c.id, { title: String(c.message).split('\n')[0] ?? '', url: c.url, author: c.author?.username ?? c.author?.name, branch, occurredAt: c.timestamp }, extractTaskRefs(c.message, branch));
    }
  } else if (event === 'pull_request') {
    const pr = payload.pull_request;
    await store('pull_request', `${fullName}#${pr.number}`, { title: `#${pr.number} ${pr.title}`, url: pr.html_url, author: pr.user?.login, state: pr.merged ? 'merged' : pr.state, branch: pr.head?.ref, occurredAt: pr.updated_at }, extractTaskRefs(pr.title, pr.head?.ref, pr.body));
  } else if (event === 'deployment_status' && link.serviceId) {
    const d = payload.deployment;
    const s = payload.deployment_status;
    const service = await db.orm.public.Service.where({ id: link.serviceId, companyId }).first();
    const env = String(d.environment ?? 'production').toLowerCase();
    if (service) {
      await recordDeployment(companyId, service, {
        serviceId: service.id,
        environment: env.includes('prod') ? 'production' : env.includes('stag') ? 'staging' : 'development',
        version: String(d.ref ?? d.sha).slice(0, 100),
        commitSha: /^[0-9a-f]{7,40}$/i.test(d.sha ?? '') ? d.sha : null,
        repositoryUrl: payload.repository?.html_url ?? null,
        author: d.creator?.login ?? null,
        status: s.state === 'success' ? 'succeeded' : s.state === 'failure' || s.state === 'error' ? 'failed' : s.state === 'in_progress' ? 'in_progress' : 'pending',
        description: d.description ?? null,
        url: s.target_url ?? null,
        externalId: String(d.id),
        source: 'github',
      });
    }
  }
  return Response.json({ ok: true, delivery: headers.delivery });
}

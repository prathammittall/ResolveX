import { log } from '../../lib/logger.js';

/**
 * Optional AI assistant behind a provider abstraction. Configure with:
 *   AI_PROVIDER=anthropic|openai|ollama   AI_API_KEY=...   AI_MODEL=...   AI_BASE_URL=... (ollama/openai-compatible)
 * With no provider configured, `aiEnabled()` is false and callers fall back to the deterministic,
 * rule-based analysis below — the rest of ResolveX never depends on an AI service.
 */
export type AiMessage = { role: 'system' | 'user'; content: string };

export function aiEnabled(): boolean {
  const p = process.env.AI_PROVIDER;
  if (p === 'ollama') return Boolean(process.env.AI_BASE_URL);
  return (p === 'anthropic' || p === 'openai') && Boolean(process.env.AI_API_KEY);
}

export async function complete(messages: AiMessage[], maxTokens = 1200): Promise<string> {
  const provider = process.env.AI_PROVIDER;
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n\n');
  const signal = AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 45_000);
  try {
    if (provider === 'anthropic') {
      const res = await fetch(`${process.env.AI_BASE_URL || 'https://api.anthropic.com'}/v1/messages`, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.AI_API_KEY!, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
      });
      if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`);
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      return (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    }
    const base = provider === 'ollama' ? `${process.env.AI_BASE_URL!.replace(/\/$/, '')}/v1` : (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', ...(process.env.AI_API_KEY ? { authorization: `Bearer ${process.env.AI_API_KEY}` } : {}) },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'gpt-4o-mini', max_tokens: maxTokens, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (error) {
    log.warn('ai.request_failed', { provider, error: error instanceof Error ? error.message : 'unknown' });
    throw error;
  }
}

/** Deterministic hints from failure text — clearly labelled as heuristics, never as confirmed causes. */
export function heuristicHints(text: string): string[] {
  const t = text.toLowerCase();
  const hints: string[] = [];
  const rule = (re: RegExp, hint: string) => re.test(t) && hints.push(hint);
  rule(/timed out|timeout|etimedout/, 'Requests are timing out: check upstream latency, saturated connection pools, or a dependency that stopped responding.');
  rule(/econnrefused|connection refused/, 'Connection refused: the process may be down, crashed, or not listening on the expected port.');
  rule(/enotfound|did not resolve|eai_again/, 'DNS resolution failed: verify the hostname, DNS records and any recent infrastructure changes.');
  rule(/certificate|ssl|tls|self.signed/, 'TLS/certificate problem: check certificate expiry and the chain served by the endpoint.');
  rule(/status 5\d\d|http 5\d\d|unexpected status 5/, 'Server errors (5xx): inspect application logs and error tracking around the detection time.');
  rule(/status 4(01|03)|unexpected status 40[13]/, 'Authentication rejected (401/403): monitor credentials may have expired or been rotated.');
  rule(/status 404|unexpected status 404/, 'Endpoint not found (404): a deployment may have changed the route.');
  rule(/status 429|rate limit/, 'Rate limited (429): traffic spike or an aggressive client may be exhausting quotas.');
  rule(/slow response|latency/, 'Elevated latency: check database query times, CPU saturation and downstream dependencies.');
  rule(/does not contain|json|assert/, 'Response content changed: compare with the last good response and recent deployments.');
  rule(/deploy/, 'A deployment happened shortly before detection; consider rolling back if symptoms match.');
  if (hints.length === 0) hints.push('No known failure signature matched. Start from the first failing check, the service logs, and recent changes.');
  return hints;
}

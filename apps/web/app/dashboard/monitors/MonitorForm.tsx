'use client';

/**
 * Monitor types and the create/edit monitor modal (with a dry-run "Test" button), shared by the monitors
 * list, the monitor detail page and the service overview. Mirrors apps/server/src/services/api/modules/ops.ts.
 */
import React, { useEffect, useState } from 'react';
import { FlaskConical, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import type { IncidentSeverity, ServiceHealthStatus } from '../../../lib/types';
import { ErrorBanner, HealthBadge } from '../_components/ui';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../_components/kit';

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const;
export type HttpMethod = (typeof METHODS)[number];
export const SEVERITIES: IncidentSeverity[] = ['sev1', 'sev2', 'sev3', 'sev4'];

export type Assertion =
  | { type: 'body_contains'; value: string }
  | { type: 'body_not_contains'; value: string }
  | { type: 'header_equals'; name: string; value: string }
  | { type: 'json_path_equals'; path: string; value: string }
  | { type: 'latency_below'; ms: number };
export type AssertionType = Assertion['type'];
export const ASSERTION_LABEL: Record<AssertionType, string> = {
  body_contains: 'Body contains',
  body_not_contains: 'Body does not contain',
  header_equals: 'Header equals',
  json_path_equals: 'JSON path equals',
  latency_below: 'Latency below (ms)',
};

export type Monitor = {
  id: number;
  companyId: number;
  serviceId: number;
  name: string;
  url: string;
  method: HttpMethod;
  headerNames: string[];
  body: string | null;
  timeoutMs: number;
  intervalSeconds: number;
  expectedStatusCodes: number[] | null;
  assertions: Assertion[] | null;
  retries: number;
  failureThreshold: number;
  recoveryThreshold: number;
  degradedLatencyMs: number | null;
  severity: IncidentSeverity;
  autoCreateTask: boolean;
  enabled: boolean;
  status: ServiceHealthStatus;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastCheckedAt: string | null;
  nextCheckAt: string | null;
  lastLatencyMs: number | null;
  lastStatusCode: number | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CheckStats = { totalChecks: number; failures: number; uptimePercent: number | null; avgLatencyMs: number | null; p95LatencyMs: number | null; p99LatencyMs?: number | null };
export type SeriesPoint = { t: string; uptime: number | null; avgLatencyMs: number | null };
export type MonitorCheck = { id: number; monitorId: number; serviceId: number; status: ServiceHealthStatus; statusCode: number | null; latencyMs: number | null; error: string | null; attempt: number; checkedAt: string };
export type ServiceOption = { id: number; name: string; environment?: string };

type TestResult = { status: ServiceHealthStatus; statusCode: number | null; latencyMs: number | null; error: string | null; attempt?: number };

type HeaderRow = { key: string; value: string };
type FormState = {
  serviceId: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: HeaderRow[];
  headersDirty: boolean;
  body: string;
  timeoutMs: string;
  intervalSeconds: string;
  expectedStatusCodes: string;
  assertions: Assertion[];
  retries: string;
  failureThreshold: string;
  recoveryThreshold: string;
  degradedLatencyMs: string;
  severity: IncidentSeverity;
  autoCreateTask: boolean;
  enabled: boolean;
};

function initial(m: Monitor | null, defaultServiceId?: number | null): FormState {
  return {
    serviceId: m ? String(m.serviceId) : defaultServiceId ? String(defaultServiceId) : '',
    name: m?.name ?? '',
    method: m?.method ?? 'GET',
    url: m?.url ?? '',
    headers: [],
    headersDirty: !m,
    body: m?.body ?? '',
    timeoutMs: String(m?.timeoutMs ?? 10000),
    intervalSeconds: String(m?.intervalSeconds ?? 60),
    expectedStatusCodes: (m?.expectedStatusCodes ?? [200]).join(', '),
    assertions: m?.assertions ?? [],
    retries: String(m?.retries ?? 1),
    failureThreshold: String(m?.failureThreshold ?? 3),
    recoveryThreshold: String(m?.recoveryThreshold ?? 2),
    degradedLatencyMs: m?.degradedLatencyMs ? String(m.degradedLatencyMs) : '',
    severity: m?.severity ?? 'sev2',
    autoCreateTask: m?.autoCreateTask ?? true,
    enabled: m?.enabled ?? true,
  };
}

const HEADER_RE = /^[A-Za-z0-9-]{1,64}$/;

function intIn(v: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(v.trim())) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

/** Validate and build the request payload (without serviceId). Returns errors when invalid. */
function buildPayload(f: FormState): { payload?: Record<string, unknown>; errors: Record<string, string> } {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = 'Name is required';
  try {
    const u = new URL(f.url.trim());
    if (!/^https?:$/.test(u.protocol)) e.url = 'Use an http(s) URL';
  } catch {
    e.url = 'Enter a valid URL';
  }
  const timeoutMs = intIn(f.timeoutMs, 500, 60000);
  if (timeoutMs === null) e.timeoutMs = '500–60000 ms';
  const intervalSeconds = intIn(f.intervalSeconds, 30, 86400);
  if (intervalSeconds === null) e.intervalSeconds = '30–86400 seconds';
  const codes = f.expectedStatusCodes.split(/[\s,]+/).filter(Boolean).map(Number);
  if (codes.length === 0 || codes.length > 20 || codes.some((c) => !Number.isInteger(c) || c < 100 || c > 599)) e.expectedStatusCodes = 'Comma-separated HTTP codes (100–599), up to 20';
  const retries = intIn(f.retries, 0, 5);
  if (retries === null) e.retries = '0–5';
  const failureThreshold = intIn(f.failureThreshold, 1, 20);
  if (failureThreshold === null) e.failureThreshold = '1–20';
  const recoveryThreshold = intIn(f.recoveryThreshold, 1, 20);
  if (recoveryThreshold === null) e.recoveryThreshold = '1–20';
  let degradedLatencyMs: number | null = null;
  if (f.degradedLatencyMs.trim()) {
    degradedLatencyMs = intIn(f.degradedLatencyMs, 1, 60000);
    if (degradedLatencyMs === null) e.degradedLatencyMs = '1–60000 ms, or empty';
  }
  if (f.assertions.length > 10) e.assertions = 'At most 10 assertions';
  for (const a of f.assertions) {
    if ((a.type === 'body_contains' || a.type === 'body_not_contains') && !a.value.trim()) e.assertions = 'Body assertions need text';
    if (a.type === 'header_equals' && !a.name.trim()) e.assertions = 'Header assertions need a header name';
    if (a.type === 'json_path_equals' && !a.path.trim()) e.assertions = 'JSON path assertions need a path';
    if (a.type === 'latency_below' && (!Number.isInteger(a.ms) || a.ms < 1 || a.ms > 60000)) e.assertions = 'Latency assertion must be 1–60000 ms';
  }
  const payload: Record<string, unknown> = {
    name: f.name.trim(),
    url: f.url.trim(),
    method: f.method,
    body: f.method === 'GET' || f.method === 'HEAD' ? null : f.body ? f.body : null,
    timeoutMs,
    intervalSeconds,
    expectedStatusCodes: [...new Set(codes)],
    assertions: f.assertions,
    retries,
    failureThreshold,
    recoveryThreshold,
    degradedLatencyMs,
    severity: f.severity,
    autoCreateTask: f.autoCreateTask,
    enabled: f.enabled,
  };
  if (f.headersDirty) {
    const headers: Record<string, string> = {};
    for (const h of f.headers) {
      if (!h.key.trim() && !h.value) continue;
      if (!HEADER_RE.test(h.key.trim())) {
        e.headers = 'Header names may contain letters, digits and dashes only';
        continue;
      }
      headers[h.key.trim()] = h.value;
    }
    payload.headers = headers;
  }
  return Object.keys(e).length ? { errors: e } : { payload, errors: e };
}

export function MonitorFormModal({ open, monitor, services, defaultServiceId, onClose, onSaved }: { open: boolean; monitor: Monitor | null; services: ServiceOption[]; defaultServiceId?: number | null; onClose: () => void; onSaved: (m: Monitor) => void }) {
  const toast = useToast();
  const [f, setF] = useState<FormState>(() => initial(monitor, defaultServiceId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ result?: TestResult; error?: string } | null>(null);

  useEffect(() => {
    if (open) {
      setF(initial(monitor, defaultServiceId));
      setErrors({});
      setFormError(null);
      setTest(null);
    }
  }, [open, monitor, defaultServiceId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const setAssertion = (i: number, a: Assertion) => setF((s) => ({ ...s, assertions: s.assertions.map((x, j) => (j === i ? a : x)) }));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const { payload, errors: e } = buildPayload(f);
    if (!monitor && !f.serviceId) e.serviceId = 'Choose a service';
    setErrors(e);
    if (!payload || Object.keys(e).length) return;
    setSaving(true);
    try {
      const res = monitor
        ? await api.patch<{ monitor: Monitor }>(`/api/monitors/${monitor.id}`, payload)
        : await api.post<{ monitor: Monitor }>('/api/monitors', { ...payload, serviceId: Number(f.serviceId) });
      toast.success(monitor ? 'Monitor updated' : 'Monitor created');
      onSaved(res.monitor);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save monitor');
    } finally {
      setSaving(false);
    }
  }

  async function runTest() {
    const { payload, errors: e } = buildPayload(f);
    setErrors(e);
    if (!payload) return;
    setTesting(true);
    setTest(null);
    try {
      const res = await api.post<{ result: TestResult }>('/api/monitors/test', payload);
      setTest({ result: res.result });
    } catch (err) {
      setTest({ error: err instanceof Error ? err.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  }

  const showBody = f.method !== 'GET' && f.method !== 'HEAD';

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={monitor ? `Edit ${monitor.name}` : 'New monitor'}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={runTest} loading={testing} className="mr-auto">
            <FlaskConical className="h-4 w-4" /> Test
          </Button>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="monitor-form" loading={saving}>{monitor ? 'Save changes' : 'Create monitor'}</Button>
        </>
      }
    >
      <form id="monitor-form" onSubmit={save} className="space-y-4" noValidate>
        {formError && <ErrorBanner message={formError} />}
        {test && (
          <div className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] p-3 text-sm" role="status">
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Test result</div>
            {test.error ? (
              <p className="font-semibold text-[#dc2626]">{test.error}</p>
            ) : test.result ? (
              <div className="flex flex-wrap items-center gap-3 text-[#3d4a42]">
                <HealthBadge status={test.result.status} />
                <span>Status code: <b className="text-[#14201a]">{test.result.statusCode ?? '—'}</b></span>
                <span>Latency: <b className="text-[#14201a]">{test.result.latencyMs !== null ? `${test.result.latencyMs} ms` : '—'}</b></span>
                {test.result.error && <span className="w-full break-words text-[#991b1b]">{test.result.error}</span>}
              </div>
            ) : null}
            {monitor && !f.headersDirty && monitor.headerNames.length > 0 && (
              <p className="mt-1 text-xs text-[#5f6b64]">Saved header values are not sent in tests. Replace headers to test with them.</p>
            )}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Service" error={errors.serviceId} hint={monitor ? 'A monitor cannot be moved to another service.' : undefined}>
            <Select value={f.serviceId} onChange={(e) => set('serviceId', e.target.value)} disabled={Boolean(monitor)}>
              <option value="">Select a service…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.name}{s.environment ? ` (${s.environment})` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Name" error={errors.name}>
            <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Health endpoint" maxLength={100} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
          <Field label="Method">
            <Select value={f.method} onChange={(e) => set('method', e.target.value as HttpMethod)}>
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </Field>
          <Field label="URL" error={errors.url}>
            <Input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://api.example.com/health" maxLength={2000} />
          </Field>
        </div>

        <fieldset className="rounded-xl border border-[#dfdbcc] p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Request headers</legend>
          {!f.headersDirty ? (
            <div className="space-y-2">
              {monitor && monitor.headerNames.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {monitor.headerNames.map((n) => (
                      <span key={n} className="rounded-md border border-[#dfdbcc] bg-[#fbfaf6] px-2 py-0.5 font-mono text-xs text-[#3d4a42]">{n}: ••••••</span>
                    ))}
                  </div>
                  <p className="text-xs text-[#5f6b64]">Header values are write-only and never shown. Replace them to change.</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setF((s) => ({ ...s, headersDirty: true, headers: monitor.headerNames.map((n) => ({ key: n, value: '' })) }))}>Replace headers</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setF((s) => ({ ...s, headersDirty: true, headers: [] }))}>Remove all</Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-[#5f6b64]">No custom headers.</p>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setF((s) => ({ ...s, headersDirty: true, headers: [{ key: '', value: '' }] }))}><Plus className="h-3.5 w-3.5" /> Add header</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {f.headers.length === 0 && <p className="text-xs text-[#5f6b64]">{monitor && monitor.headerNames.length ? 'All headers will be removed on save.' : 'No custom headers.'}</p>}
              {f.headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <Input aria-label={`Header ${i + 1} name`} value={h.key} placeholder="Authorization" className="font-mono" onChange={(e) => setF((s) => ({ ...s, headers: s.headers.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) }))} />
                  <Input aria-label={`Header ${i + 1} value`} value={h.value} placeholder="value" type="password" autoComplete="off" className="font-mono" onChange={(e) => setF((s) => ({ ...s, headers: s.headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) }))} />
                  <button type="button" aria-label={`Remove header ${i + 1}`} onClick={() => setF((s) => ({ ...s, headers: s.headers.filter((_, j) => j !== i) }))} className="rounded-lg px-2 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {errors.headers && <p className="text-xs font-semibold text-[#dc2626]">{errors.headers}</p>}
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setF((s) => ({ ...s, headers: [...s.headers, { key: '', value: '' }] }))}><Plus className="h-3.5 w-3.5" /> Add header</Button>
                {monitor && monitor.headerNames.length > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setF((s) => ({ ...s, headersDirty: false, headers: [] }))}>Keep saved headers</Button>
                )}
              </div>
            </div>
          )}
        </fieldset>

        {showBody && (
          <Field label="Request body" hint="Sent as-is (e.g. JSON). Set a Content-Type header if needed.">
            <Textarea value={f.body} onChange={(e) => set('body', e.target.value)} className="font-mono text-xs" maxLength={64000} placeholder='{"ping": true}' />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Interval (s)" error={errors.intervalSeconds} hint="Minimum 30">
            <Input type="number" min={30} max={86400} value={f.intervalSeconds} onChange={(e) => set('intervalSeconds', e.target.value)} />
          </Field>
          <Field label="Timeout (ms)" error={errors.timeoutMs}>
            <Input type="number" min={500} max={60000} value={f.timeoutMs} onChange={(e) => set('timeoutMs', e.target.value)} />
          </Field>
          <Field label="Expected status codes" error={errors.expectedStatusCodes}>
            <Input value={f.expectedStatusCodes} onChange={(e) => set('expectedStatusCodes', e.target.value)} placeholder="200, 204" />
          </Field>
        </div>

        <fieldset className="rounded-xl border border-[#dfdbcc] p-3">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Assertions</legend>
          <div className="space-y-2">
            {f.assertions.length === 0 && <p className="text-xs text-[#5f6b64]">Only the status code is checked.</p>}
            {f.assertions.map((a, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <Select aria-label={`Assertion ${i + 1} type`} className="sm:w-52" value={a.type} onChange={(e) => setAssertion(i, blankAssertion(e.target.value as AssertionType))}>
                  {(Object.keys(ASSERTION_LABEL) as AssertionType[]).map((t) => <option key={t} value={t}>{ASSERTION_LABEL[t]}</option>)}
                </Select>
                {(a.type === 'body_contains' || a.type === 'body_not_contains') && (
                  <Input aria-label="Text" placeholder="text" value={a.value} onChange={(e) => setAssertion(i, { ...a, value: e.target.value })} maxLength={500} />
                )}
                {a.type === 'header_equals' && (
                  <>
                    <Input aria-label="Header name" placeholder="content-type" value={a.name} onChange={(e) => setAssertion(i, { ...a, name: e.target.value })} maxLength={100} />
                    <Input aria-label="Expected header value" placeholder="application/json" value={a.value} onChange={(e) => setAssertion(i, { ...a, value: e.target.value })} maxLength={500} />
                  </>
                )}
                {a.type === 'json_path_equals' && (
                  <>
                    <Input aria-label="JSON path" placeholder="status or data.items.0.id" value={a.path} onChange={(e) => setAssertion(i, { ...a, path: e.target.value })} maxLength={200} />
                    <Input aria-label="Expected JSON value" placeholder="ok" value={a.value} onChange={(e) => setAssertion(i, { ...a, value: e.target.value })} maxLength={500} />
                  </>
                )}
                {a.type === 'latency_below' && (
                  <Input aria-label="Max latency in ms" type="number" min={1} max={60000} value={Number.isFinite(a.ms) ? a.ms : ''} onChange={(e) => setAssertion(i, { ...a, ms: Number(e.target.value) })} />
                )}
                <button type="button" aria-label={`Remove assertion ${i + 1}`} onClick={() => setF((s) => ({ ...s, assertions: s.assertions.filter((_, j) => j !== i) }))} className="rounded-lg p-2 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626]">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {errors.assertions && <p className="text-xs font-semibold text-[#dc2626]">{errors.assertions}</p>}
            {f.assertions.length < 10 && (
              <Button type="button" size="sm" variant="secondary" onClick={() => setF((s) => ({ ...s, assertions: [...s.assertions, blankAssertion('body_contains')] }))}><Plus className="h-3.5 w-3.5" /> Add assertion</Button>
            )}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Retries" error={errors.retries} hint="0–5 per check">
            <Input type="number" min={0} max={5} value={f.retries} onChange={(e) => set('retries', e.target.value)} />
          </Field>
          <Field label="Failure threshold" error={errors.failureThreshold} hint="Fails before down">
            <Input type="number" min={1} max={20} value={f.failureThreshold} onChange={(e) => set('failureThreshold', e.target.value)} />
          </Field>
          <Field label="Recovery threshold" error={errors.recoveryThreshold} hint="Passes to recover">
            <Input type="number" min={1} max={20} value={f.recoveryThreshold} onChange={(e) => set('recoveryThreshold', e.target.value)} />
          </Field>
          <Field label="Degraded above (ms)" error={errors.degradedLatencyMs} hint="Optional">
            <Input type="number" min={1} max={60000} value={f.degradedLatencyMs} onChange={(e) => set('degradedLatencyMs', e.target.value)} placeholder="e.g. 1500" />
          </Field>
        </div>

        <div className="grid items-end gap-4 sm:grid-cols-3">
          <Field label="Incident severity">
            <Select value={f.severity} onChange={(e) => set('severity', e.target.value as IncidentSeverity)}>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
            </Select>
          </Field>
          <label className="flex items-center gap-2 py-2 text-sm text-[#14201a]">
            <input type="checkbox" checked={f.autoCreateTask} onChange={(e) => set('autoCreateTask', e.target.checked)} className="h-4 w-4 accent-[#177a43]" />
            Auto-create task on incident
          </label>
          <label className="flex items-center gap-2 py-2 text-sm text-[#14201a]">
            <input type="checkbox" checked={f.enabled} onChange={(e) => set('enabled', e.target.checked)} className="h-4 w-4 accent-[#177a43]" />
            Enabled
          </label>
        </div>
      </form>
    </Modal>
  );
}

function blankAssertion(type: AssertionType): Assertion {
  switch (type) {
    case 'header_equals':
      return { type, name: '', value: '' };
    case 'json_path_equals':
      return { type, path: '', value: '' };
    case 'latency_below':
      return { type, ms: 1000 };
    default:
      return { type, value: '' };
  }
}

export function describeAssertion(a: Assertion): string {
  switch (a.type) {
    case 'body_contains':
      return `Body contains "${a.value}"`;
    case 'body_not_contains':
      return `Body does not contain "${a.value}"`;
    case 'header_equals':
      return `Header ${a.name} = "${a.value}"`;
    case 'json_path_equals':
      return `JSON ${a.path} = "${a.value}"`;
    case 'latency_below':
      return `Latency < ${a.ms} ms`;
  }
}

export function formatInterval(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return s % 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s / 60}m`;
  return s % 3600 ? `${(s / 3600).toFixed(1)}h` : `${s / 3600}h`;
}

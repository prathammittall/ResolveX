'use client';

/** "Record deployment" form (POST /api/deployments), shared by the deployments page and the service overview. */
import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { ServiceEnvironment } from '../../../lib/types';
import { ErrorBanner } from '../_components/ui';
import { Button, Field, Input, Modal, Select, Textarea, useToast } from '../_components/kit';

export const DEPLOY_STATUSES = ['succeeded', 'failed', 'rolled_back', 'in_progress', 'pending'] as const;
export type DeployStatus = (typeof DEPLOY_STATUSES)[number];
export const DEPLOY_STATUS_TONE: Record<DeployStatus, 'green' | 'red' | 'amber' | 'blue' | 'slate'> = {
  succeeded: 'green',
  failed: 'red',
  rolled_back: 'amber',
  in_progress: 'blue',
  pending: 'slate',
};

export type Deployment = {
  id: number;
  serviceId: number;
  environment: ServiceEnvironment;
  version: string;
  commitSha: string | null;
  repositoryUrl: string | null;
  author: string | null;
  status: DeployStatus;
  description: string | null;
  url: string | null;
  source: string;
  externalId: string | null;
  deployedAt: string;
  createdAt: string;
};

type ServiceOpt = { id: number; name: string; environment: ServiceEnvironment; repositoryUrl?: string | null };

const blank = (svc?: ServiceOpt) => ({
  serviceId: svc ? String(svc.id) : '',
  environment: (svc?.environment ?? 'production') as ServiceEnvironment,
  version: '',
  commitSha: '',
  repositoryUrl: svc?.repositoryUrl ?? '',
  author: '',
  status: 'succeeded' as DeployStatus,
  description: '',
  url: '',
  deployedAt: '',
});

export function RecordDeploymentModal({ open, services, defaultServiceId, onClose, onSaved }: { open: boolean; services: ServiceOpt[]; defaultServiceId?: number | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState(() => blank(services.find((s) => s.id === defaultServiceId)));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setF(blank(services.find((s) => s.id === defaultServiceId)));
      setErrors({});
      setFormError(null);
    }
    // Reset only when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    const e: Record<string, string> = {};
    if (!f.serviceId) e.serviceId = 'Choose a service';
    if (!f.version.trim()) e.version = 'Version is required';
    if (f.commitSha.trim() && !/^[0-9a-f]{7,40}$/i.test(f.commitSha.trim())) e.commitSha = '7–40 hex characters';
    for (const k of ['repositoryUrl', 'url'] as const) {
      if (f[k].trim()) {
        try {
          new URL(f[k].trim());
        } catch {
          e[k] = 'Enter a valid URL';
        }
      }
    }
    if (f.deployedAt && Number.isNaN(Date.parse(f.deployedAt))) e.deployedAt = 'Invalid date';
    setErrors(e);
    if (Object.keys(e).length) return;
    const orNull = (v: string) => (v.trim() ? v.trim() : null);
    const body: Record<string, unknown> = {
      serviceId: Number(f.serviceId),
      environment: f.environment,
      version: f.version.trim(),
      commitSha: orNull(f.commitSha),
      repositoryUrl: orNull(f.repositoryUrl),
      author: orNull(f.author),
      status: f.status,
      description: orNull(f.description),
      url: orNull(f.url),
    };
    if (f.deployedAt) body.deployedAt = new Date(f.deployedAt).toISOString();
    setSaving(true);
    try {
      await api.post('/api/deployments', body);
      toast.success(`Deployment ${f.version.trim()} recorded`);
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to record deployment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record deployment"
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="deployment-form" loading={saving}>Record deployment</Button>
        </>
      }
    >
      <form id="deployment-form" onSubmit={submit} className="space-y-4" noValidate>
        {formError && <ErrorBanner message={formError} />}
        <Field label="Service" error={errors.serviceId}>
          <Select
            value={f.serviceId}
            onChange={(e) => {
              const svc = services.find((s) => String(s.id) === e.target.value);
              setF((s) => ({ ...s, serviceId: e.target.value, environment: svc?.environment ?? s.environment, repositoryUrl: s.repositoryUrl || svc?.repositoryUrl || '' }));
            }}
          >
            <option value="">Select a service…</option>
            {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.environment})</option>)}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Version" error={errors.version}>
            <Input value={f.version} onChange={(e) => set('version', e.target.value)} placeholder="v2.4.1" maxLength={100} />
          </Field>
          <Field label="Environment">
            <Select value={f.environment} onChange={(e) => set('environment', e.target.value as ServiceEnvironment)}>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(e) => set('status', e.target.value as DeployStatus)}>
              {DEPLOY_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Commit SHA" error={errors.commitSha}>
            <Input value={f.commitSha} onChange={(e) => set('commitSha', e.target.value)} placeholder="a1b2c3d" className="font-mono" maxLength={40} />
          </Field>
          <Field label="Author">
            <Input value={f.author} onChange={(e) => set('author', e.target.value)} placeholder="jane" maxLength={100} />
          </Field>
          <Field label="Deployed at" hint="Defaults to now" error={errors.deployedAt}>
            <Input type="datetime-local" value={f.deployedAt} onChange={(e) => set('deployedAt', e.target.value)} />
          </Field>
        </div>
        <Field label="Repository URL" error={errors.repositoryUrl}>
          <Input value={f.repositoryUrl} onChange={(e) => set('repositoryUrl', e.target.value)} placeholder="https://github.com/org/repo" />
        </Field>
        <Field label="Deployment URL" hint="Link to the CI run or release" error={errors.url}>
          <Input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://ci.example.com/runs/123" />
        </Field>
        <Field label="Description">
          <Textarea value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={2000} className="min-h-[64px]" placeholder="What changed?" />
        </Field>
      </form>
    </Modal>
  );
}

/** Link to a commit when the repository URL is known (GitHub/GitLab/Bitbucket style `/commit/<sha>`). */
export function commitHref(repositoryUrl: string | null | undefined, sha: string): string | null {
  if (!repositoryUrl) return null;
  return `${repositoryUrl.replace(/\.git$/, '').replace(/\/+$/, '')}/commit/${sha}`;
}

'use client';

/**
 * Create/edit form for a catalog service, shared by the service catalog and the service overview page.
 * Mirrors the server schema in apps/server/src/services/api/services.ts.
 */
import React, { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import type { ServiceCriticality, ServiceEnvironment, ServiceItem, ServiceType } from '../../../lib/types';
import { ErrorBanner } from '../_components/ui';
import { Button, Field, Input, MemberSelect, Modal, Select, Textarea, useApi, useToast } from '../_components/kit';

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  http: 'HTTP',
  api: 'REST API',
  database: 'Database',
  queue: 'Message queue',
  worker: 'Worker',
  frontend: 'Frontend',
  backend: 'Backend',
  microservice: 'Microservice',
  external: 'External',
  other: 'Other',
};
export const SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABEL) as ServiceType[];
export const ENVIRONMENTS: ServiceEnvironment[] = ['production', 'staging', 'development'];
export const CRITICALITIES: ServiceCriticality[] = ['low', 'medium', 'high', 'critical'];
export const CRITICALITY_TONE: Record<ServiceCriticality, 'slate' | 'blue' | 'amber' | 'red'> = { low: 'slate', medium: 'blue', high: 'amber', critical: 'red' };

export type TeamLite = { id: string; name: string };
export type ProjectLite = { id: string; name: string; key: string };

type FormState = {
  name: string;
  slug: string;
  description: string;
  serviceType: ServiceType;
  environment: ServiceEnvironment;
  criticality: ServiceCriticality;
  monitoredUrl: string;
  ownerId: number | null;
  backupOwnerId: number | null;
  teamId: string;
  projectId: string;
  repositoryUrl: string;
  docsUrl: string;
  runbookUrl: string;
  tags: string;
  currentVersion: string;
};

function initial(s: ServiceItem | null): FormState {
  return {
    name: s?.name ?? '',
    slug: s?.slug ?? '',
    description: s?.description ?? '',
    serviceType: s?.serviceType ?? 'api',
    environment: s?.environment ?? 'production',
    criticality: s?.criticality ?? 'medium',
    monitoredUrl: s?.monitoredUrl ?? '',
    ownerId: s?.ownerId ?? null,
    backupOwnerId: s?.backupOwnerId ?? null,
    teamId: s?.teamId ?? '',
    projectId: s?.projectId ?? '',
    repositoryUrl: s?.repositoryUrl ?? '',
    docsUrl: s?.docsUrl ?? '',
    runbookUrl: s?.runbookUrl ?? '',
    tags: (s?.tags ?? []).join(', '),
    currentVersion: s?.currentVersion ?? '',
  };
}

const URL_RE = /^https?:\/\/[^\s]+$/i;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function ServiceFormModal({ open, service, onClose, onSaved }: { open: boolean; service: ServiceItem | null; onClose: () => void; onSaved: (s: ServiceItem) => void }) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(() => initial(service));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const teams = useApi<{ teams: TeamLite[] }>(open ? '/api/teams' : null);
  const projects = useApi<{ projects: ProjectLite[] }>(open ? '/api/projects' : null);

  useEffect(() => {
    if (open) {
      setForm(initial(service));
      setErrors({});
      setFormError(null);
    }
  }, [open, service]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.slug.trim() && !SLUG_RE.test(form.slug.trim().toLowerCase())) e.slug = 'Use 2-63 lowercase letters, digits and dashes';
    for (const k of ['monitoredUrl', 'repositoryUrl', 'docsUrl', 'runbookUrl'] as const) {
      if (form[k].trim() && !URL_RE.test(form[k].trim())) e[k] = 'Enter a valid http(s) URL';
    }
    const tags = parseTags(form.tags);
    if (tags.length > 20) e.tags = 'At most 20 tags';
    else if (tags.some((t) => t.length > 30)) e.tags = 'Each tag must be 30 characters or fewer';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFormError(null);
    if (!validate()) return;
    const orNull = (v: string) => (v.trim() ? v.trim() : null);
    const tags = parseTags(form.tags);
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      serviceType: form.serviceType,
      environment: form.environment,
      criticality: form.criticality,
      monitoredUrl: form.monitoredUrl.trim(),
      slug: form.slug.trim() ? form.slug.trim().toLowerCase() : null,
      ownerId: form.ownerId,
      backupOwnerId: form.backupOwnerId,
      teamId: orNull(form.teamId),
      projectId: orNull(form.projectId),
      repositoryUrl: orNull(form.repositoryUrl),
      docsUrl: orNull(form.docsUrl),
      runbookUrl: orNull(form.runbookUrl),
      tags: tags.length ? tags : null,
      currentVersion: orNull(form.currentVersion),
    };
    if (!service) {
      // On create, omit empty optional strings so the server applies its defaults.
      if (!body.description) delete body.description;
      if (!body.monitoredUrl) delete body.monitoredUrl;
    }
    setSaving(true);
    try {
      const res = service ? await api.patch<{ service: ServiceItem }>(`/api/services/${service.id}`, body) : await api.post<{ service: ServiceItem }>('/api/services', body);
      toast.success(service ? 'Service updated' : 'Service created');
      onSaved(res.service);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save service');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={service ? `Edit ${service.name}` : 'Register service'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" form="service-form" loading={saving}>{service ? 'Save changes' : 'Register service'}</Button>
        </>
      }
    >
      <form id="service-form" onSubmit={submit} className="space-y-4" noValidate>
        {formError && <ErrorBanner message={formError} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="payments-api" maxLength={100} required />
          </Field>
          <Field label="Slug" hint="Optional short identifier, e.g. payments-api" error={errors.slug}>
            <Input value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="payments-api" maxLength={63} />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} maxLength={500} placeholder="What does this service do?" className="min-h-[64px]" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            <Select value={form.serviceType} onChange={(e) => set('serviceType', e.target.value as ServiceType)}>
              {SERVICE_TYPES.map((t) => <option key={t} value={t}>{SERVICE_TYPE_LABEL[t]}</option>)}
            </Select>
          </Field>
          <Field label="Environment">
            <Select value={form.environment} onChange={(e) => set('environment', e.target.value as ServiceEnvironment)}>
              {ENVIRONMENTS.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
            </Select>
          </Field>
          <Field label="Criticality">
            <Select value={form.criticality} onChange={(e) => set('criticality', e.target.value as ServiceCriticality)}>
              {CRITICALITIES.map((t) => <option key={t} value={t}>{cap(t)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Monitored URL" hint={service ? 'Reference URL. Manage health checks on the Monitors page.' : 'Optional. Creates a default health-check monitor.'} error={errors.monitoredUrl}>
          <Input value={form.monitoredUrl} onChange={(e) => set('monitoredUrl', e.target.value)} placeholder="https://api.example.com/health" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner">
            <MemberSelect value={form.ownerId} onChange={(v) => set('ownerId', v)} noneLabel="No owner" />
          </Field>
          <Field label="Backup owner">
            <MemberSelect value={form.backupOwnerId} onChange={(v) => set('backupOwnerId', v)} noneLabel="No backup owner" />
          </Field>
          <Field label="Team" hint={teams.error ? 'Could not load teams' : undefined}>
            <Select value={form.teamId} onChange={(e) => set('teamId', e.target.value)} disabled={teams.loading}>
              <option value="">No team</option>
              {(teams.data?.teams ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Project" hint={projects.error ? 'Could not load projects' : undefined}>
            <Select value={form.projectId} onChange={(e) => set('projectId', e.target.value)} disabled={projects.loading}>
              <option value="">No project</option>
              {(projects.data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Repository URL" error={errors.repositoryUrl}>
            <Input value={form.repositoryUrl} onChange={(e) => set('repositoryUrl', e.target.value)} placeholder="https://github.com/org/repo" />
          </Field>
          <Field label="Docs URL" error={errors.docsUrl}>
            <Input value={form.docsUrl} onChange={(e) => set('docsUrl', e.target.value)} placeholder="https://docs.example.com" />
          </Field>
          <Field label="Runbook URL" error={errors.runbookUrl}>
            <Input value={form.runbookUrl} onChange={(e) => set('runbookUrl', e.target.value)} placeholder="https://wiki.example.com/runbook" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tags" hint="Comma separated, up to 20" error={errors.tags}>
            <Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="payments, tier-1" />
          </Field>
          <Field label="Current version">
            <Input value={form.currentVersion} onChange={(e) => set('currentVersion', e.target.value)} placeholder="v2.4.1" maxLength={100} />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function parseTags(s: string): string[] {
  return [...new Set(s.split(',').map((t) => t.trim()).filter(Boolean))];
}
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

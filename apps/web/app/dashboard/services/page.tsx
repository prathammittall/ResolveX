'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Server,
  Loader2,
  AlertTriangle,
  ExternalLink,
  KeyRound,
} from 'lucide-react';
import Link from 'next/link';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { isAdmin } from '../../../lib/permissions';
import WebhookKeysModal from './WebhookKeysModal';
import type {
  ServiceItem,
  ServicesResponse,
  ServiceResponse,
  MessageResponse,
  ServiceType,
  ServiceEnvironment,
  ServiceCriticality,
} from '../../../lib/types';
import {
  cn,
  EmptyState,
  ErrorBanner,
  HealthBadge,
  PageLoader,
  SeverityBadge,
  StatusBadge,
} from '../_components/ui';

const SERVICE_TYPES: ServiceType[] = ['http', 'api', 'database', 'queue', 'worker', 'other'];
const ENVIRONMENTS: ServiceEnvironment[] = ['production', 'staging', 'development'];
const CRITICALITIES: ServiceCriticality[] = ['low', 'medium', 'high', 'critical'];

const criticalityCls: Record<ServiceCriticality, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  critical: 'bg-rose-100 text-rose-700',
};

interface FormState {
  name: string;
  description: string;
  serviceType: ServiceType;
  environment: ServiceEnvironment;
  criticality: ServiceCriticality;
  monitoredUrl: string;
}

const emptyForm: FormState = {
  name: '',
  description: '',
  serviceType: 'http',
  environment: 'production',
  criticality: 'medium',
  monitoredUrl: '',
};

export default function ServicesPage() {
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const [keysFor, setKeysFor] = useState<ServiceItem | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editing, setEditing] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<ServiceItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ServicesResponse>('/api/services');
      setServices(res.services);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setModalMode('create');
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(svc: ServiceItem) {
    setModalMode('edit');
    setEditing(svc);
    setForm({
      name: svc.name,
      description: svc.description ?? '',
      serviceType: svc.serviceType,
      environment: svc.environment,
      criticality: svc.criticality,
      monitoredUrl: svc.monitoredUrl ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Service name is required.');
      return;
    }
    if (form.monitoredUrl && !/^https?:\/\/[^\s]+$/i.test(form.monitoredUrl)) {
      setFormError('Monitored URL must be a valid http(s) URL.');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        serviceType: form.serviceType,
        environment: form.environment,
        criticality: form.criticality,
        monitoredUrl: form.monitoredUrl.trim() || undefined,
      };
      if (modalMode === 'create') {
        const res = await api.post<ServiceResponse>('/api/services', body);
        setServices((prev) => [...prev, res.service]);
      } else if (editing) {
        const res = await api.patch<ServiceResponse>(`/api/services/${editing.id}`, body);
        setServices((prev) => prev.map((s) => (s.id === editing.id ? res.service : s)));
      }
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save service');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await api.del<MessageResponse>(`/api/services/${confirmDelete.id}`);
      setServices((prev) => prev.filter((s) => s.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete service');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif-title text-2xl font-semibold text-slate-900">Services</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monitored services across your environments.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25396e] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#1b2b57] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            New Service
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {services.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No services yet"
          description={canManage ? 'Add your first monitored service so alerts can be ingested and grouped into incidents.' : 'An owner or admin needs to add services before alerts can be ingested.'}
          action={canManage && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-[#25396e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1b2b57]"
            >
              <Plus className="h-4 w-4" />
              Add a service
            </button>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Health</th>
                <th className="px-5 py-3">Type</th>
                <th className="hidden px-5 py-3 lg:table-cell">Environment</th>
                <th className="hidden px-5 py-3 md:table-cell">Criticality</th>
                <th className="hidden px-5 py-3 sm:table-cell">Open Incident</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((svc) => (
                <tr key={svc.id} className="group transition hover:bg-slate-50/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{svc.name}</p>
                        {svc.description && (
                          <p className="max-w-xs truncate text-xs text-slate-400">{svc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <HealthBadge status={svc.healthStatus} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm capitalize text-slate-600">{svc.serviceType}</span>
                  </td>
                  <td className="hidden px-5 py-3.5 lg:table-cell">
                    <span className="text-sm capitalize text-slate-600">{svc.environment}</span>
                  </td>
                  <td className="hidden px-5 py-3.5 md:table-cell">
                    <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize', criticalityCls[svc.criticality])}>
                      {svc.criticality}
                    </span>
                  </td>
                  <td className="hidden px-5 py-3.5 sm:table-cell">
                    {svc.openIncident ? (
                      <Link href={`/dashboard/incidents/${svc.openIncident.id}`} className="inline-flex items-center gap-2">
                        <SeverityBadge severity={svc.openIncident.severity} />
                        <StatusBadge status={svc.openIncident.status} />
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {svc.monitoredUrl && (
                        <a
                          href={svc.monitoredUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Open monitored URL"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => setKeysFor(svc)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Alert webhook keys"
                        aria-label={`Webhook keys for ${svc.name}`}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEdit(svc)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="Edit"
                            aria-label={`Edit ${svc.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(svc)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Delete"
                            aria-label={`Delete ${svc.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-title text-lg font-semibold text-slate-900">
                {modalMode === 'create' ? 'New Service' : 'Edit Service'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="payments-api"
                  className="input"
                  autoFocus
                />
              </Field>
              <Field label="Description" optional>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this service do?"
                  rows={2}
                  className="input resize-none"
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Type">
                  <Select value={form.serviceType} onChange={(v) => setForm({ ...form, serviceType: v as ServiceType })} options={SERVICE_TYPES} />
                </Field>
                <Field label="Environment">
                  <Select value={form.environment} onChange={(v) => setForm({ ...form, environment: v as ServiceEnvironment })} options={ENVIRONMENTS} />
                </Field>
                <Field label="Criticality">
                  <Select value={form.criticality} onChange={(v) => setForm({ ...form, criticality: v as ServiceCriticality })} options={CRITICALITIES} />
                </Field>
              </div>
              <Field label="Monitored URL" optional>
                <input
                  value={form.monitoredUrl}
                  onChange={(e) => setForm({ ...form, monitoredUrl: e.target.value })}
                  placeholder="https://api.example.com/health"
                  className="input"
                />
              </Field>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#25396e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b2b57] disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {modalMode === 'create' ? 'Create service' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </span>
              <h2 className="font-serif-title text-lg font-semibold text-slate-900">Delete service?</h2>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Deleting <span className="font-medium text-slate-800">{confirmDelete.name}</span> will also remove its incidents and alerts. This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {keysFor && <WebhookKeysModal service={keysFor} canManage={canManage} onClose={() => setKeysFor(null)} />}
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">
        {label}
        {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input capitalize">
      {options.map((o) => (
        <option key={o} value={o} className="capitalize">
          {o}
        </option>
      ))}
    </select>
  );
}

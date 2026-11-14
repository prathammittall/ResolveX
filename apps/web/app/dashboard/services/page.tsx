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
          <h1 className="font-serif-title text-2xl font-semibold text-[#171a1f] dark:text-white">Services</h1>
          <p className="mt-1 text-sm text-[#574f47] dark:text-zinc-400">
            Monitored services across your environments.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] active:scale-[0.98]"
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
              className="inline-flex items-center gap-2 rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs"
            >
              <Plus className="h-4 w-4" />
              Add a service
            </button>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb]/70 dark:bg-[#101117] shadow-xs">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#cbbaa9]/40 dark:border-white/10 bg-[#e2cfc0]/40 dark:bg-white/5 text-left text-xs font-semibold uppercase tracking-wide text-[#574f47] dark:text-zinc-400">
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Health</th>
                <th className="px-5 py-3">Type</th>
                <th className="hidden px-5 py-3 lg:table-cell">Environment</th>
                <th className="hidden px-5 py-3 md:table-cell">Criticality</th>
                <th className="hidden px-5 py-3 sm:table-cell">Open Incident</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#cbbaa9]/25 dark:divide-white/5">
              {services.map((svc) => (
                <tr key={svc.id} className="group transition hover:bg-[#cbbaa9]/20 dark:hover:bg-white/5">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-[#574f47] dark:text-zinc-400" />
                      <div>
                        <p className="text-sm font-medium text-[#171a1f] dark:text-white">{svc.name}</p>
                        {svc.description && (
                          <p className="max-w-xs truncate text-xs text-[#574f47] dark:text-zinc-400">{svc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <HealthBadge status={svc.healthStatus} />
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-sm capitalize text-[#574f47] dark:text-zinc-300">{svc.serviceType}</span>
                  </td>
                  <td className="hidden px-5 py-3.5 lg:table-cell">
                    <span className="text-sm capitalize text-[#574f47] dark:text-zinc-300">{svc.environment}</span>
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
                      <span className="text-xs text-[#574f47]/60 dark:text-zinc-500">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      {svc.monitoredUrl && (
                        <a
                          href={svc.monitoredUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 hover:text-[#171a1f] dark:hover:text-white transition"
                          title="Open monitored URL"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => setKeysFor(svc)}
                        className="rounded-lg p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 hover:text-[#171a1f] dark:hover:text-white transition"
                        title="Alert webhook keys"
                        aria-label={`Webhook keys for ${svc.name}`}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </button>
                      {canManage && (
                        <>
                          <button
                            onClick={() => openEdit(svc)}
                            className="rounded-lg p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 hover:text-[#171a1f] dark:hover:text-white transition"
                            title="Edit"
                            aria-label={`Edit ${svc.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(svc)}
                            className="rounded-lg p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-rose-500/10 hover:text-rose-600 transition"
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb] dark:bg-[#12131a] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-title text-lg font-semibold text-[#171a1f] dark:text-white">
                {modalMode === 'create' ? 'New Service' : 'Edit Service'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-[#574f47] dark:text-zinc-400 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <Field label="Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="payments-api"
                  className="w-full rounded-xl border border-[#cbbaa9] dark:border-white/10 bg-[#e2cfc0]/50 dark:bg-zinc-900 px-3 py-2 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414] focus:ring-2 focus:ring-[#ff5414]/20 placeholder-[#574f47]/50 dark:placeholder-zinc-500"
                  autoFocus
                />
              </Field>
              <Field label="Description" optional>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this service do?"
                  rows={2}
                  className="w-full rounded-xl border border-[#cbbaa9] dark:border-white/10 bg-[#e2cfc0]/50 dark:bg-zinc-900 px-3 py-2 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414] focus:ring-2 focus:ring-[#ff5414]/20 placeholder-[#574f47]/50 dark:placeholder-zinc-500 resize-none"
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
                  className="w-full rounded-xl border border-[#cbbaa9] dark:border-white/10 bg-[#e2cfc0]/50 dark:bg-zinc-900 px-3 py-2 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414] focus:ring-2 focus:ring-[#ff5414]/20 placeholder-[#574f47]/50 dark:placeholder-zinc-500"
                />
              </Field>

              {formError && (
                <div className="flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#574f47] dark:text-zinc-300 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#171a1f] dark:bg-[#ff5414] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2b2f38] dark:hover:bg-[#ff6830] transition shadow-xs disabled:opacity-60"
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
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-[#cbbaa9] dark:border-white/10 bg-[#eedccb] dark:bg-[#12131a] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </span>
              <h2 className="font-serif-title text-lg font-semibold text-[#171a1f] dark:text-white">Delete service?</h2>
            </div>
            <p className="mt-3 text-sm text-[#574f47] dark:text-zinc-400">
              Deleting <span className="font-medium text-[#171a1f] dark:text-white">{confirmDelete.name}</span> will also remove its incidents and alerts. This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-[#574f47] dark:text-zinc-300 hover:bg-[#cbbaa9]/30 dark:hover:bg-white/10 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-60"
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
      <label className="mb-1 block text-xs font-semibold text-[#171a1f] dark:text-zinc-200">
        {label}
        {optional && <span className="ml-1 font-normal text-[#574f47] dark:text-zinc-400">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-[#cbbaa9] dark:border-white/10 bg-[#e2cfc0]/50 dark:bg-zinc-900 px-3 py-2 text-sm text-[#171a1f] dark:text-white outline-none focus:border-[#ff5414] focus:ring-2 focus:ring-[#ff5414]/20 capitalize">
      {options.map((o) => (
        <option key={o} value={o} className="capitalize bg-[#eedccb] dark:bg-zinc-900 text-[#171a1f] dark:text-white">
          {o}
        </option>
      ))}
    </select>
  );
}

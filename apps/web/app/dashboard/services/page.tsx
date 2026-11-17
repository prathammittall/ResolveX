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
  ShieldCheck,
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
  low: 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1]',
  medium: 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]',
  high: 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a]',
  critical: 'bg-[#fee2e2] text-[#991b1b] border border-[#fecaca] font-bold',
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dfdbcc] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">Services</h1>
          <p className="mt-1 text-sm text-[#5f6b64]">
            Catalog of internal services, APIs, databases, and automated uptime checks.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="btn-kizupi-go text-sm px-4 py-2.5 cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Service
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {services.length === 0 ? (
        <EmptyState
          icon={Server}
          title="No services registered yet"
          description={canManage ? 'Add your first monitored service so telemetry and alerts can be ingested and linked to project tasks.' : 'An owner or admin needs to add services before alerts can be ingested.'}
          action={canManage && (
            <button
              onClick={openCreate}
              className="btn-kizupi-go text-sm px-4 py-2.5 cursor-pointer"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add a service
            </button>
          )}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#dfdbcc] bg-white shadow-[0_2px_0_#dfdbcc]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">Health</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Environment</th>
                  <th className="hidden px-5 py-3 md:table-cell">Criticality</th>
                  <th className="hidden px-5 py-3 sm:table-cell">Open Incident</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc]/50 text-sm">
                {services.map((svc) => (
                  <tr key={svc.id} className="group transition hover:bg-[#f6f4ec]">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#eeebe0] flex items-center justify-center text-[#177a43] shrink-0">
                          <Server className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-bold text-[#14201a]">{svc.name}</p>
                          {svc.description && (
                            <p className="max-w-xs truncate text-xs text-[#5f6b64]">{svc.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <HealthBadge status={svc.healthStatus} />
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#5f6b64] bg-[#eeebe0] px-2 py-0.5 rounded-md">{svc.serviceType}</span>
                    </td>
                    <td className="hidden px-5 py-3.5 lg:table-cell">
                      <span className="text-xs font-semibold capitalize text-[#3d4a42]">{svc.environment}</span>
                    </td>
                    <td className="hidden px-5 py-3.5 md:table-cell">
                      <span className={cn('inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize', criticalityCls[svc.criticality])}>
                        {svc.criticality}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3.5 sm:table-cell">
                      {svc.openIncident ? (
                        <Link href={`/dashboard/incidents/${svc.openIncident.id}`} className="inline-flex items-center gap-1.5 hover:opacity-80 transition">
                          <SeverityBadge severity={svc.openIncident.severity} />
                          <StatusBadge status={svc.openIncident.status} />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-[#177a43] font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5" /> Normal
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {svc.monitoredUrl && (
                          <a
                            href={svc.monitoredUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#14201a] transition"
                            title="Open monitored URL"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => setKeysFor(svc)}
                          className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#177a43] transition cursor-pointer"
                          title="Alert webhook keys"
                          aria-label={`Webhook keys for ${svc.name}`}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEdit(svc)}
                              className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] hover:text-[#14201a] transition cursor-pointer"
                              title="Edit"
                              aria-label={`Edit ${svc.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setConfirmDelete(svc)}
                              className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626] transition cursor-pointer"
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
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#14201a]/40 backdrop-blur-xs" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#dfdbcc] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-[#14201a]">
                  {modalMode === 'create' ? 'Register Service' : 'Edit Service'}
                </h2>
                <p className="mt-0.5 text-xs text-[#5f6b64]">Configure service endpoint, metadata, and criticality tier.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] transition cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <Field label="Service Name">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="payments-checkout-api"
                  className="w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20"
                  autoFocus
                />
              </Field>
              <Field label="Description" optional>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this service do?"
                  rows={2}
                  className="w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20 resize-none"
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
                  className="w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20"
                />
              </Field>

              {formError && (
                <div className="flex items-center gap-2 rounded-xl bg-[#fee2e2] border border-[#fca5a5] px-3.5 py-2 text-xs font-semibold text-[#991b1b]">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-kizupi-white text-sm px-4 py-2 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-kizupi-go text-sm px-5 py-2 cursor-pointer disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                  {modalMode === 'create' ? 'Register service' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-[#14201a]/40 backdrop-blur-xs" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-[#dfdbcc] bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fee2e2] text-[#dc2626]">
                <Trash2 className="h-5 w-5" />
              </span>
              <h2 className="font-display text-lg font-bold text-[#14201a]">Delete service?</h2>
            </div>
            <p className="mt-3 text-sm text-[#5f6b64]">
              Deleting <span className="font-bold text-[#14201a]">{confirmDelete.name}</span> will also remove its associated incidents and historical alerts. This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmDelete(null)}
                className="btn-kizupi-white text-xs px-3.5 py-2 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="btn-kizupi-ink text-xs px-4 py-2 cursor-pointer disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Delete service
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
      <label className="mb-1 block text-xs font-semibold text-[#14201a]">
        {label}
        {optional && <span className="ml-1 font-normal text-[#5f6b64]">(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] capitalize cursor-pointer">
      {options.map((o) => (
        <option key={o} value={o} className="capitalize bg-white text-[#14201a]">
          {o}
        </option>
      ))}
    </select>
  );
}

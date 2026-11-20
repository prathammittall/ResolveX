'use client';

/** Small helpers shared by the operations pages (on-call, escalation, maintenance, status pages, teams, integrations). */
import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useApi } from '../_components/kit';

export type TeamLite = { id: string; name: string };
export type ServiceLite = { id: number; name: string; healthStatus: string; environment?: string };
export type ProjectLite = { id: string; key: string; name: string };

/** ISO timestamp → value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value (browser local time) → ISO-8601 UTC string, or null when empty/invalid. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const FALLBACK_ZONES = ['UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney'];
export function timezones(current?: string | null): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
  } catch {
    zones = [];
  }
  if (zones.length === 0) zones = FALLBACK_ZONES;
  const set = new Set(['UTC', ...zones]);
  if (current) set.add(current);
  return [...set];
}

export function useTeams() {
  const { data } = useApi<{ teams: TeamLite[] }>('/api/teams');
  return data?.teams ?? [];
}
export function useServices() {
  const { data } = useApi<{ services: ServiceLite[] }>('/api/services');
  return data?.services ?? [];
}
export function useProjects() {
  const { data } = useApi<{ projects: ProjectLite[] }>('/api/projects');
  return data?.projects ?? [];
}

/** Read-only value with a copy button (for secrets shown once). */
export function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3 py-2 font-mono text-xs text-[#14201a]" />
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard can be blocked; the field stays selectable for a manual copy.
          }
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#dfdbcc] bg-white px-3 py-2 text-xs font-semibold text-[#14201a] hover:bg-[#eeebe0]"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-[#177a43]" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

/** Multi-select rendered as a checkbox list (keyboard-friendly, works on mobile). */
export function CheckList<T extends string | number>({ options, value, onChange, empty }: { options: Array<{ value: T; label: string; hint?: string }>; value: T[]; onChange: (v: T[]) => void; empty?: string }) {
  if (options.length === 0) return <p className="text-xs text-[#5f6b64]">{empty ?? 'Nothing to choose from yet.'}</p>;
  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[#dfdbcc] bg-white p-2">
      {options.map((o) => {
        const checked = value.includes(o.value);
        return (
          <label key={String(o.value)} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm text-[#14201a] hover:bg-[#f6f4ec]">
            <input type="checkbox" className="h-4 w-4 accent-[#177a43]" checked={checked} onChange={() => onChange(checked ? value.filter((v) => v !== o.value) : [...value, o.value])} />
            <span className="flex-1">{o.label}</span>
            {o.hint && <span className="text-xs text-[#5f6b64]">{o.hint}</span>}
          </label>
        );
      })}
    </div>
  );
}

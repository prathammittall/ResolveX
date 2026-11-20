'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Building2, Camera, CheckCircle2, LogOut, MailWarning, Moon, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { can, ROLE_HELP, ROLE_LABEL } from '../../../lib/permissions';
import type { OrganizationInfo, OrgRole } from '../../../lib/types';
import { ErrorBanner, SectionCard, formatDateTime } from '../_components/ui';
import { Avatar } from '../_components/work';
import { Button, Field, Input, Modal, PageHeader, Pill, Select, Skeleton, useApi, useConfirm, useToast } from '../_components/kit';
import { timezones } from '../oncall/_shared';

type Profile = { id: number; email: string; name: string | null; username: string | null; jobTitle: string | null; timezone: string | null; avatarUrl: string | null; emailVerified: boolean; createdAt: string };

const MAX_AVATAR_BYTES = 256 * 1024;

/** Resize an image file to fit 256×256 and encode it as a data URL small enough for the API (≤256 KB). */
async function resizeAvatar(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) throw new Error('Choose a PNG, JPEG, WebP or GIF image.');
  if (file.size > 15 * 1024 * 1024) throw new Error('That image is too large (max 15 MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file could not be read as an image.'));
      el.src = url;
    });
    const scale = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser cannot process images.');
    ctx.drawImage(img, 0, 0, w, h);
    const bytes = (dataUrl: string) => Math.floor(((dataUrl.split(',')[1] ?? '').length * 3) / 4);
    // Keep transparency for PNGs when the result is small enough; otherwise fall back to JPEG.
    if (file.type === 'image/png') {
      const png = canvas.toDataURL('image/png');
      if (bytes(png) <= MAX_AVATAR_BYTES) return png;
    }
    for (const q of [0.9, 0.8, 0.65, 0.5]) {
      const jpg = canvas.toDataURL('image/jpeg', q);
      if (bytes(jpg) <= MAX_AVATAR_BYTES) return jpg;
    }
    throw new Error('The image is still too large after resizing.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ProfileSection({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [name, setName] = useState(profile.name ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [jobTitle, setJobTitle] = useState(profile.jobTitle ?? '');
  const [timezone, setTimezone] = useState(profile.timezone ?? '');
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const zones = useMemo(() => timezones(timezone), [timezone]);

  async function patch(body: Partial<Profile>, message: string) {
    const res = await api.patch<{ profile: Partial<Profile> | null }>('/api/account/profile', body);
    onSaved({ ...profile, ...body, ...(res.profile ?? {}) });
    await refreshUser();
    toast.success(message);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Your name cannot be empty.');
    if (username && !/^[a-zA-Z0-9._-]{2,40}$/.test(username)) return setError('Usernames are 2–40 letters, digits, dots, dashes or underscores.');
    setSaving(true);
    try {
      await patch({ name: name.trim(), username: username.trim() || null, jobTitle: jobTitle.trim() || null, timezone: timezone || null }, 'Profile saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile');
    } finally {
      setSaving(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      const dataUrl = await resizeAvatar(file);
      await patch({ avatarUrl: dataUrl }, 'Avatar updated');
    } catch (err) {
      toast.error(err);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      await patch({ avatarUrl: null }, 'Avatar removed');
    } catch (err) {
      toast.error(err);
    } finally {
      setAvatarBusy(false);
    }
  }

  const display = profile.name || profile.email;

  return (
    <SectionCard title="Profile" subtitle="How you appear to teammates.">
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex flex-col items-center gap-3 md:w-44">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt="Your avatar" className="h-24 w-24 rounded-full border border-[#dfdbcc] object-cover" />
          ) : (
            <Avatar name={display} size={96} />
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={onFile} aria-label="Upload avatar" />
          <div className="flex flex-wrap justify-center gap-1.5">
            <Button size="sm" variant="secondary" loading={avatarBusy} onClick={() => fileRef.current?.click()}><Camera className="h-3.5 w-3.5" /> Upload</Button>
            {profile.avatarUrl && <Button size="sm" variant="ghost" disabled={avatarBusy} onClick={removeAvatar}><Trash2 className="h-3.5 w-3.5" /> Remove</Button>}
          </div>
          <p className="text-center text-[11px] text-[#5f6b64]">Resized to 256 px in your browser.</p>
        </div>
        <form onSubmit={save} className="flex-1 space-y-4">
          {error && <ErrorBanner message={error} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
            <Field label="Username" hint="Used for @mentions"><Input value={username} maxLength={40} onChange={(e) => setUsername(e.target.value)} autoComplete="username" spellCheck={false} /></Field>
            <Field label="Job title"><Input value={jobTitle} maxLength={100} onChange={(e) => setJobTitle(e.target.value)} placeholder="Site reliability engineer" autoComplete="organization-title" /></Field>
            <Field label="Timezone">
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                <option value="">Not set</option>
                {zones.map((z) => <option key={z} value={z}>{z}</option>)}
              </Select>
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={saving}>Save profile</Button>
          </div>
        </form>
      </div>
    </SectionCard>
  );
}

function AccountSection({ profile, role }: { profile: Profile; role: OrgRole }) {
  const toast = useToast();
  const confirm = useConfirm();
  const { logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState<string | null>(null);

  async function resend() {
    setSending(true);
    try {
      const res = await api.post<{ alreadyVerified?: boolean; emailSent?: boolean }>('/api/auth/verify-email/request');
      if (res.alreadyVerified) toast.success('Your email is already verified');
      else if (res.emailSent) toast.success(`Verification email sent to ${profile.email}`);
      else toast.error('The verification email could not be sent. Ask an admin to check the email (SMTP) settings.');
    } catch (e) {
      toast.error(e);
    } finally {
      setSending(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwDone(null);
    if (next.length < 8) return setPwError('The new password must be at least 8 characters.');
    if (next !== again) return setPwError('The new passwords do not match.');
    setPwSaving(true);
    try {
      const res = await api.post<{ message?: string }>('/api/account/password', { currentPassword: current, newPassword: next });
      setPwDone(res.message ?? 'Password changed.');
      setCurrent('');
      setNext('');
      setAgain('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setPwSaving(false);
    }
  }

  async function signOutEverywhere() {
    const ok = await confirm({ title: 'Sign out of all sessions?', message: 'Every browser and device signed in to your account, including this one, will be signed out.', confirmLabel: 'Sign out everywhere', danger: true });
    if (!ok) return;
    try {
      await api.del('/api/account/sessions');
      await logout();
      window.location.assign('/login');
    } catch (e) {
      toast.error(e);
    }
  }

  return (
    <SectionCard title="Account & security">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Email</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#14201a]">
              {profile.email}
              {profile.emailVerified ? <Pill tone="green"><CheckCircle2 className="h-3 w-3" /> Verified</Pill> : <Pill tone="amber"><MailWarning className="h-3 w-3" /> Not verified</Pill>}
            </div>
            {!profile.emailVerified && <p className="mt-1 text-xs text-[#5f6b64]">Verify your address to receive incident alerts and invitations by email.</p>}
          </div>
          {!profile.emailVerified && <Button variant="secondary" loading={sending} onClick={resend}>Resend verification email</Button>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfdbcc] pt-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Role in this organization</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Pill tone="green">{ROLE_LABEL[role]}</Pill>
              <span className="text-xs text-[#5f6b64]">{ROLE_HELP[role]}</span>
            </div>
          </div>
          <div className="text-xs text-[#5f6b64]">Member since {formatDateTime(profile.createdAt)}</div>
        </div>

        <form onSubmit={changePassword} className="space-y-3 border-t border-[#dfdbcc] pt-5">
          <h4 className="text-sm font-bold text-[#14201a]">Change password</h4>
          {pwError && <ErrorBanner message={pwError} />}
          {pwDone && <p role="status" className="rounded-xl border border-[#b2e2a8] bg-[#dcefd8] px-3 py-2 text-sm text-[#177a43]">{pwDone} You may need to sign in again.</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Current password"><Input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></Field>
            <Field label="New password" hint="At least 8 characters"><Input type="password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="Confirm new password"><Input type="password" required value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></Field>
          </div>
          <div className="flex justify-end"><Button type="submit" loading={pwSaving}>Change password</Button></div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#dfdbcc] pt-5">
          <div>
            <h4 className="text-sm font-bold text-[#14201a]">Sessions</h4>
            <p className="text-xs text-[#5f6b64]">Lost a device or signed in somewhere public? End every session at once.</p>
          </div>
          <Button variant="danger" onClick={signOutEverywhere}><LogOut className="h-4 w-4" /> Sign out everywhere</Button>
        </div>
      </div>
    </SectionCard>
  );
}

function OrganizationSection({ role }: { role: OrgRole }) {
  const toast = useToast();
  const { switchOrg } = useAuth();
  const canManage = can(role, 'org:manage');
  const { data, error, loading, reload } = useApi<{ organization: OrganizationInfo }>('/api/org');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (data) setName(data.organization.name);
  }, [data]);

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.patch('/api/org', { name: name.trim() });
      toast.success('Organization renamed');
      reload();
    } catch (err) {
      toast.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function create() {
    if (!newName.trim()) return setCreateError('Name the new organization.');
    setCreating(true);
    setCreateError(null);
    try {
      const res = await api.post<{ organization: { id: string; name: string } }>('/api/organizations', { name: newName.trim() });
      toast.success(`${res.organization.name} created — switching to it`);
      const sw = await switchOrg(res.organization.id);
      if (sw.ok) window.location.assign('/dashboard');
      else {
        toast.error(sw.error ?? 'Created, but could not switch. Use the organization switcher.');
        setCreateOpen(false);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create organization');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SectionCard title="Organization" action={<Button size="sm" variant="secondary" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5" /> New organization</Button>}>
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <Skeleton className="h-20 w-full" />
      ) : data ? (
        <div className="space-y-5">
          <form onSubmit={rename} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Organization name" className="flex-1" hint={canManage ? undefined : 'Only owners and admins can rename the organization.'}>
              <Input value={name} maxLength={100} disabled={!canManage} onChange={(e) => setName(e.target.value)} />
            </Field>
            {canManage && <Button type="submit" loading={saving} disabled={name.trim() === data.organization.name || !name.trim()}>Rename</Button>}
          </form>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Workspace identifier</dt>
              <dd className="mt-0.5"><code className="rounded-md bg-[#eeebe0] px-2 py-0.5 font-mono text-xs font-bold text-[#14201a]">{data.organization.slug}</code></dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wide text-[#5f6b64]">Created</dt>
              <dd className="mt-0.5 text-[#14201a]">{formatDateTime(data.organization.createdAt)}</dd>
            </div>
          </dl>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) window.location.assign(`/dashboard/accept-invite?token=${encodeURIComponent(code.trim())}`);
            }}
            className="flex flex-col gap-3 border-t border-[#dfdbcc] pt-5 sm:flex-row sm:items-end"
          >
            <Field label="Join another organization" hint="Paste an invitation token. It only works for the invited email address." className="flex-1">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="rxinv_…" autoComplete="off" spellCheck={false} className="font-mono" />
            </Field>
            <Button type="submit" variant="secondary" disabled={!code.trim()}>Join</Button>
          </form>
        </div>
      ) : null}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New organization"
        footer={<><Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={create} loading={creating}>Create & switch</Button></>}
      >
        <div className="space-y-3">
          {createError && <ErrorBanner message={createError} />}
          <p className="text-sm text-[#3d4a42]">You become the owner of the new organization. Your current organization is unaffected.</p>
          <Field label="Name"><Input value={newName} maxLength={100} onChange={(e) => setNewName(e.target.value)} placeholder="Acme Operations" /></Field>
        </div>
      </Modal>
    </SectionCard>
  );
}

export default function SettingsPage() {
  const { data, error, loading, setData } = useApi<{ profile: Profile; role: OrgRole; permissions: string[] }>('/api/account/profile');

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your profile, account security and organization." />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : data ? (
        <>
          <ProfileSection key={data.profile.id} profile={data.profile} onSaved={(p) => setData({ ...data, profile: p })} />
          <AccountSection profile={data.profile} role={data.role} />
          <OrganizationSection role={data.role} />
          <SectionCard title="Preferences">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/dashboard/notifications" className="flex items-start gap-3 rounded-xl border border-[#dfdbcc] p-3 hover:bg-[#f6f4ec]">
                <Bell className="mt-0.5 h-5 w-5 text-[#177a43]" />
                <span>
                  <span className="block text-sm font-semibold text-[#14201a]">Notification preferences</span>
                  <span className="block text-xs text-[#5f6b64]">Choose in-app and email notifications per event type.</span>
                </span>
              </Link>
              <div className="flex items-start gap-3 rounded-xl border border-[#dfdbcc] p-3">
                <Moon className="mt-0.5 h-5 w-5 text-[#177a43]" />
                <span>
                  <span className="block text-sm font-semibold text-[#14201a]">Theme</span>
                  <span className="block text-xs text-[#5f6b64]">Switch between light, dark and system themes with the theme toggle in the top bar. It is saved on this device.</span>
                </span>
              </div>
            </div>
          </SectionCard>
          <p className="flex items-center gap-1.5 text-xs text-[#5f6b64]"><Building2 className="h-3.5 w-3.5" /> Signed in to this organization as {data.profile.email}.</p>
        </>
      ) : null}
    </div>
  );
}

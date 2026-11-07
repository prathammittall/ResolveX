'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, MailPlus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { assignableRoles, isAdmin, ROLE_HELP, ROLE_LABEL } from '../../../lib/permissions';
import type { InvitationItem, MemberItem, OrgRole } from '../../../lib/types';
import { EmptyState, ErrorBanner, PageLoader, SectionCard, cn, formatDateTime, timeAgo } from '../_components/ui';

const roleStyle: Record<OrgRole, string> = {
  owner: 'bg-violet-50 text-violet-700 ring-violet-200',
  admin: 'bg-blue-50 text-blue-700 ring-blue-200',
  responder: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  member: 'bg-slate-100 text-slate-700 ring-slate-200',
  viewer: 'bg-amber-50 text-amber-700 ring-amber-200',
};

function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', roleStyle[role])}>
      {ROLE_LABEL[role]}
    </span>
  );
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback;
}

export default function TeamPage() {
  const { user } = useAuth();
  const admin = isAdmin(user?.role);
  const roles = assignableRoles(user?.role);

  const [members, setMembers] = useState<MemberItem[]>([]);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [issued, setIssued] = useState<{ email: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const m = await api.get<{ members: MemberItem[] }>('/api/org/members');
      setMembers(m.members);
      if (admin) {
        const i = await api.get<{ invitations: InvitationItem[] }>('/api/org/invitations');
        setInvitations(i.invitations);
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to load team'));
    } finally {
      setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setIssued(null);
    try {
      const res = await api.post<{ token: string }>('/api/org/invitations', { email, role: inviteRole });
      setIssued({ email, token: res.token });
      setEmail('');
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Failed to create invitation'));
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(member: MemberItem, role: OrgRole) {
    setBusyId(String(member.userId));
    setError(null);
    setNotice(null);
    try {
      await api.patch(`/api/org/members/${member.userId}`, { role });
      setNotice(`${member.email} is now ${ROLE_LABEL[role]}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Failed to change role'));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(member: MemberItem) {
    const self = member.userId === user?.id;
    if (!window.confirm(self ? 'Leave this organization?' : `Remove ${member.email} from the organization?`)) return;
    setBusyId(String(member.userId));
    setError(null);
    try {
      await api.del(`/api/org/members/${member.userId}`);
      if (self) {
        window.location.assign('/dashboard');
        return;
      }
      setNotice(`${member.email} was removed.`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove member'));
    } finally {
      setBusyId(null);
    }
  }

  async function revoke(inv: InvitationItem) {
    setBusyId(inv.id);
    setError(null);
    try {
      await api.del(`/api/org/invitations/${inv.id}`);
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Failed to revoke invitation'));
    } finally {
      setBusyId(null);
    }
  }

  async function copyLink() {
    if (!issued) return;
    const link = `${window.location.origin}/dashboard/accept-invite?token=${encodeURIComponent(issued.token)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy automatically. Select the link and copy it manually.');
    }
  }

  if (loading) return <PageLoader />;

  const inviteLink = issued
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/accept-invite?token=${encodeURIComponent(issued.token)}`
    : '';
  const pending = invitations.filter((i) => i.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif-title text-2xl font-semibold text-slate-900">Team</h1>
          <p className="mt-1 text-sm text-slate-500">People in this organization and what they can do.</p>
        </div>
        {admin && (
          <button
            type="button"
            onClick={() => {
              setIssued(null);
              setInviteOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[#25396e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1b2b57]"
          >
            <UserPlus className="h-4 w-4" />
            Add teammate
          </button>
        )}
      </div>

      {!admin && (
        <div role="note" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You’re a <strong>{ROLE_LABEL[user?.role ?? 'viewer']}</strong> in this organization. Only owners and admins can
          add teammates or change roles. Ask an owner to promote you if you need to.
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      {notice && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {admin && inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Add teammate">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setInviteOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-serif-title text-lg font-semibold text-slate-900">Add teammate</h2>
                <p className="mt-0.5 text-sm text-slate-500">They join with the role you pick once they accept.</p>
              </div>
              <button type="button" onClick={() => setInviteOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
            <div className="mt-5">
          <form onSubmit={invite} className="flex flex-col gap-4">
            <div className="flex-1">
              <label htmlFor="invite-email" className="mb-1 block text-sm font-medium text-slate-700">
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#25396e] focus:ring-2 focus:ring-[#25396e]/20"
              />
            </div>
            <div>
              <label htmlFor="invite-role" className="mb-1 block text-sm font-medium text-slate-700">
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#25396e] focus:ring-2 focus:ring-[#25396e]/20"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25396e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1c2c56] disabled:opacity-60"
            >
              <MailPlus className="h-4 w-4" />
              {inviting ? 'Creating…' : 'Create invitation'}
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-400">{ROLE_HELP[inviteRole]}</p>

          {issued && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4" role="status">
              <p className="text-sm font-medium text-amber-900">Invitation created for {issued.email}</p>
              <p className="mt-1 text-xs text-amber-800">
                Email delivery is not set up yet, so share this link yourself. It is shown only once and expires in 7
                days.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  aria-label="Invitation link"
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-slate-700"
                />
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-amber-200 hover:bg-amber-100"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
            </div>
          </div>
        </div>
      )}

      <SectionCard title={`Members (${members.length})`}>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No members" description="Members appear here once they join." />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-2 font-medium">Member</th>
                  <th className="px-5 py-2 font-medium">Role</th>
                  <th className="px-5 py-2 font-medium">Joined</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const self = m.userId === user?.id;
                  // Admins cannot edit owners; only owners can.
                  const editable = admin && (user?.role === 'owner' || m.role !== 'owner');
                  return (
                    <tr key={m.userId}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-800">
                          {m.name || m.email.split('@')[0]}
                          {self && <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-400">{m.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        {editable ? (
                          <select
                            aria-label={`Role for ${m.email}`}
                            value={m.role}
                            disabled={busyId === String(m.userId)}
                            onChange={(e) => changeRole(m, e.target.value as OrgRole)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                          >
                            {roles.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <RoleBadge role={m.role} />
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-500" title={formatDateTime(m.joinedAt)}>
                        {timeAgo(m.joinedAt)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {(self || editable) && (
                          <button
                            type="button"
                            onClick={() => remove(m)}
                            disabled={busyId === String(m.userId)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {self ? 'Leave' : 'Remove'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {admin && (
        <SectionCard title={`Pending invitations (${pending.length})`}>
          {pending.length === 0 ? (
            <p className="text-sm text-slate-500">No pending invitations.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{inv.email}</p>
                    <p className="text-xs text-slate-400">
                      {ROLE_LABEL[inv.role]} · expires {formatDateTime(inv.expiresAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(inv)}
                    disabled={busyId === inv.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}

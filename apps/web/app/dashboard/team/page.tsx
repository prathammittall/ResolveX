'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, MailPlus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { api, ApiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-context';
import { assignableRoles, isAdmin, ROLE_HELP, ROLE_LABEL } from '../../../lib/permissions';
import type { InvitationItem, MemberItem, OrgRole } from '../../../lib/types';
import { EmptyState, ErrorBanner, PageLoader, SectionCard, cn, formatDateTime, timeAgo } from '../_components/ui';

const roleStyle: Record<OrgRole, string> = {
  owner: 'bg-[#ede9fe] text-[#6d28d9] border border-[#ddd6fe] font-bold',
  admin: 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd] font-bold',
  responder: 'bg-[#dcefd8] text-[#15803d] border border-[#b2e2a8] font-bold',
  member: 'bg-[#f1f5f9] text-[#475569] border border-[#cbd5e1] font-semibold',
  viewer: 'bg-[#fef3c7] text-[#92400e] border border-[#fde68a] font-semibold',
};

function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs', roleStyle[role])}>
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
      const res = await api.post<{ token: string; emailSent: boolean }>('/api/org/invitations', { email, role: inviteRole });
      setIssued({ email, token: res.token });
      setNotice(
        res.emailSent
          ? `Invitation email sent to ${email}.`
          : `Invitation created, but the email could not be sent. Share the invitation link below.`,
      );
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dfdbcc] pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#14201a]">Team</h1>
          <p className="mt-1 text-sm text-[#5f6b64]">Organization members, role permissions, and active invitations.</p>
        </div>
        {admin && (
          <button
            type="button"
            onClick={() => {
              setIssued(null);
              setInviteOpen(true);
            }}
            className="btn-kizupi-go text-sm px-4 py-2.5 cursor-pointer"
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            Add teammate
          </button>
        )}
      </div>

      {!admin && (
        <div role="note" className="rounded-xl border border-[#fde68a] bg-[#fef3c7] px-4 py-3 text-sm text-[#92400e]">
          You’re a <strong>{ROLE_LABEL[user?.role ?? 'viewer']}</strong> in this organization. Only owners and admins can
          add teammates or change roles.
        </div>
      )}

      {error && <ErrorBanner message={error} />}
      {notice && (
        <div role="status" className="rounded-xl border border-[#b2e2a8] bg-[#dcefd8] px-4 py-3 text-sm font-semibold text-[#15803d]">
          {notice}
        </div>
      )}

      {admin && inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Add teammate">
          <div className="fixed inset-0 bg-[#14201a]/40 backdrop-blur-xs" onClick={() => setInviteOpen(false)} />
          <div className="relative w-full max-w-lg rounded-2xl border border-[#dfdbcc] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#dfdbcc] pb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-[#14201a]">Add teammate</h2>
                <p className="mt-0.5 text-xs text-[#5f6b64]">They join with the designated role once accepted.</p>
              </div>
              <button type="button" onClick={() => setInviteOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-[#5f6b64] hover:bg-[#eeebe0] transition cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            {error && <div className="mt-4"><ErrorBanner message={error} /></div>}
            <div className="mt-5">
              <form onSubmit={invite} className="flex flex-col gap-4">
                <div>
                  <label htmlFor="invite-email" className="mb-1 block text-xs font-semibold text-[#14201a]">
                    Email address
                  </label>
                  <input
                    id="invite-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teammate@company.com"
                    className="w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] focus:ring-2 focus:ring-[#177a43]/20 placeholder-[#5f6b64]/50"
                  />
                </div>
                <div>
                  <label htmlFor="invite-role" className="mb-1 block text-xs font-semibold text-[#14201a]">
                    Role
                  </label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                    className="w-full rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-3.5 py-2 text-sm text-[#14201a] outline-none transition focus:border-[#177a43] cursor-pointer"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r} className="bg-white text-[#14201a]">
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={inviting}
                  className="btn-kizupi-go text-sm px-4 py-2.5 cursor-pointer disabled:opacity-60"
                >
                  <MailPlus className="h-4 w-4 mr-1.5" />
                  {inviting ? 'Creating…' : 'Generate invitation link'}
                </button>
              </form>
              <p className="mt-2.5 text-xs text-[#5f6b64]">{ROLE_HELP[inviteRole]}</p>

              {issued && (
                <div className="mt-4 rounded-xl border border-[#fde68a] bg-[#fef3c7] p-4" role="status">
                  <p className="text-sm font-bold text-[#92400e]">Invitation created for {issued.email}</p>
                  <p className="mt-1 text-xs text-[#92400e]/80">
                    Share this link with your teammate. It expires in 7 days.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      readOnly
                      value={inviteLink}
                      aria-label="Invitation link"
                      onFocus={(e) => e.currentTarget.select()}
                      className="min-w-0 flex-1 rounded-xl border border-[#fde68a] bg-white px-3 py-2 font-mono text-xs text-[#14201a]"
                    />
                    <button
                      type="button"
                      onClick={copyLink}
                      className="btn-kizupi-go text-xs px-3.5 py-2 cursor-pointer"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SectionCard title={`Active Members (${members.length})`}>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No members" description="Members will appear here once they join." />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#dfdbcc] bg-[#fbfaf6] text-xs font-bold uppercase tracking-wide text-[#5f6b64]">
                  <th className="px-5 py-3">Member</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dfdbcc]/50">
                {members.map((m) => {
                  const self = m.userId === user?.id;
                  const editable = admin && (user?.role === 'owner' || m.role !== 'owner');
                  return (
                    <tr key={m.userId} className="hover:bg-[#f6f4ec] transition">
                      <td className="px-5 py-3.5">
                        <p className="font-bold text-[#14201a]">
                          {m.name || m.email.split('@')[0]}
                          {self && <span className="ml-2 text-xs font-semibold text-[#177a43] bg-[#dcefd8] px-2 py-0.5 rounded-full">(you)</span>}
                        </p>
                        <p className="text-xs text-[#5f6b64]">{m.email}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {editable ? (
                          <select
                            aria-label={`Role for ${m.email}`}
                            value={m.role}
                            disabled={busyId === String(m.userId)}
                            onChange={(e) => changeRole(m, e.target.value as OrgRole)}
                            className="rounded-xl border border-[#dfdbcc] bg-[#fbfaf6] px-2.5 py-1 text-xs text-[#14201a] outline-none focus:border-[#177a43] cursor-pointer"
                          >
                            {roles.map((r) => (
                              <option key={r} value={r} className="bg-white text-[#14201a]">
                                {ROLE_LABEL[r]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <RoleBadge role={m.role} />
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[#5f6b64]" title={formatDateTime(m.joinedAt)}>
                        {timeAgo(m.joinedAt)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {(self || editable) && (
                          <button
                            type="button"
                            onClick={() => remove(m)}
                            disabled={busyId === String(m.userId)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626] transition disabled:opacity-50 cursor-pointer"
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
            <p className="text-sm text-[#5f6b64]">No pending invitations.</p>
          ) : (
            <ul className="divide-y divide-[#dfdbcc]/50">
              {pending.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#14201a]">{inv.email}</p>
                    <p className="text-xs text-[#5f6b64]">
                      {ROLE_LABEL[inv.role]} · expires {formatDateTime(inv.expiresAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revoke(inv)}
                    disabled={busyId === inv.id}
                    className="rounded-lg px-3 py-1 text-xs font-bold text-[#5f6b64] hover:bg-[#fee2e2] hover:text-[#dc2626] transition disabled:opacity-50 cursor-pointer"
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

import { z } from 'zod';
import { and, or } from '@prisma/orm-postgres/orm-client';
import { db } from '../../../prisma/db.js';
import { withTenant } from '../../../prisma/tenant.js';
import { badRequest, conflict, displayName, intParam, notFound, ok, pageParams, parseBody, uuidParam, type RouteContext } from '../../../lib/http.js';
import { comparePassword, hashPassword, hashRefreshToken } from '../../auth/model.js';
import { parseCookies } from '../../auth/cookies.js';
import { NOTIFICATION_TYPES, resolvePrefs } from '../../notify/index.js';
import { permissionsOf } from '../../org/permissions.js';
import { recordAudit } from '../../org/audit.js';

const MAX_AVATAR_BYTES = 256 * 1024;
const profileSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    username: z.string().trim().regex(/^[a-zA-Z0-9._-]{2,40}$/).nullable().optional(),
    jobTitle: z.string().trim().max(100).nullable().optional(),
    timezone: z.string().trim().max(64).nullable().optional(),
    // data:image/(png|jpeg|webp);base64,...  — capped and type-checked; never SVG (script-capable).
    avatarUrl: z
      .string()
      .max(Math.ceil(MAX_AVATAR_BYTES * 1.37) + 40)
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'Avatar must be a PNG, JPEG or WebP image')
      .nullable()
      .optional(),
  })
  .strict();
const passwordSchema = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(8).max(200) }).strict();
const prefsSchema = z.object({ settings: z.record(z.enum(NOTIFICATION_TYPES), z.object({ inApp: z.boolean(), email: z.boolean() })) }).strict();
const teamSchema = z.object({ name: z.string().trim().min(1).max(80), description: z.string().trim().max(1000).nullable().optional() }).strict();

export async function collabRoutes(ctx: RouteContext): Promise<Response | null> {
  const { segments: seg, method, auth, searchParams } = ctx;
  const companyId = auth.companyId;
  const orgId = auth.orgId;

  // ================= Notifications =================
  if (seg[0] === 'notifications') {
    if (seg.length === 1 && method === 'GET') {
      const { limit, offset } = pageParams(searchParams, 30, 100);
      let q = db.orm.public.Notification.where({ userId: auth.userId, companyId });
      if (searchParams.get('unread') === 'true') q = q.where((n) => n.readAt.isNull());
      const type = searchParams.get('type');
      if (type) q = q.where({ type });
      const rows = await q.orderBy((n) => n.createdAt.desc()).offset(offset).limit(limit).all();
      const unread = await db.orm.public.Notification.where((n) => and(n.userId.eq(auth.userId), n.companyId.eq(companyId), n.readAt.isNull())).aggregate((a) => ({ count: a.count() }));
      return ok({ notifications: rows, unreadCount: unread.count });
    }
    if (seg[1] === 'unread-count' && method === 'GET') {
      const unread = await db.orm.public.Notification.where((n) => and(n.userId.eq(auth.userId), n.companyId.eq(companyId), n.readAt.isNull())).aggregate((a) => ({ count: a.count() }));
      return ok({ unreadCount: unread.count });
    }
    if (seg[1] === 'read-all' && method === 'POST') {
      await db.orm.public.Notification.where((n) => and(n.userId.eq(auth.userId), n.companyId.eq(companyId), n.readAt.isNull())).updateAll({ readAt: new Date().toISOString() });
      return ok();
    }
    if (seg[1] === 'preferences') {
      if (method === 'GET') {
        const row = await db.orm.public.NotificationPreference.where({ userId: auth.userId, companyId }).first();
        return ok({ types: NOTIFICATION_TYPES, settings: Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, resolvePrefs(row?.settings, t)])) });
      }
      if (method === 'PUT') {
        const body = await parseBody(ctx, prefsSchema);
        const existing = await db.orm.public.NotificationPreference.where({ userId: auth.userId, companyId }).first();
        if (existing) await db.orm.public.NotificationPreference.where({ id: existing.id }).update({ settings: body.settings as never });
        else await db.orm.public.NotificationPreference.create({ userId: auth.userId, companyId, settings: body.settings as never });
        return ok();
      }
    }
    if (seg[1] && /^\d+$/.test(seg[1])) {
      const id = intParam(seg[1], 'Notification');
      const n = await db.orm.public.Notification.where({ id, userId: auth.userId, companyId }).first();
      if (!n) throw notFound('Notification');
      if (method === 'PATCH') {
        const body = await parseBody(ctx, z.object({ read: z.boolean() }).strict());
        return ok({ notification: await db.orm.public.Notification.where({ id }).update({ readAt: body.read ? (n.readAt ?? new Date().toISOString()) : null }) });
      }
      if (method === 'DELETE') {
        await db.orm.public.Notification.where({ id }).delete();
        return ok();
      }
      if (seg[2] === 'retry-email' && method === 'POST') {
        if (n.emailStatus !== 'failed') throw conflict('Only failed deliveries can be retried');
        await db.orm.public.Notification.where({ id }).update({ emailStatus: 'pending', emailAttempts: 0, emailNextAttemptAt: new Date().toISOString(), emailError: null });
        return ok();
      }
    }
  }

  // ================= Account / profile =================
  if (seg[0] === 'account') {
    if (seg[1] === 'profile' && method === 'GET') {
      const u = await db.orm.public.User.where({ id: auth.userId }).first();
      if (!u) throw notFound('User');
      return ok({
        profile: { id: u.id, email: u.email, name: u.name, username: u.username, jobTitle: u.jobTitle, timezone: u.timezone, avatarUrl: u.avatarUrl, emailVerified: Boolean(u.emailVerifiedAt), createdAt: u.createdAt },
        role: ctx.role,
        permissions: permissionsOf(ctx.role),
      });
    }
    if (seg[1] === 'profile' && method === 'PATCH') {
      const body = await parseBody(ctx, profileSchema);
      if (body.avatarUrl) {
        const bytes = Buffer.from(body.avatarUrl.split(',')[1] ?? '', 'base64').length;
        if (bytes > MAX_AVATAR_BYTES) throw badRequest('Avatar must be 256 KB or smaller');
      }
      if (body.username) {
        const clash = await db.orm.public.User.where({ username: body.username }).first();
        if (clash && clash.id !== auth.userId) throw conflict('That username is taken');
      }
      const u = await db.orm.public.User.where({ id: auth.userId }).update(body as never);
      return ok({ profile: u ? { id: u.id, email: u.email, name: u.name, username: u.username, jobTitle: u.jobTitle, timezone: u.timezone, avatarUrl: u.avatarUrl } : null });
    }
    if (seg[1] === 'password' && method === 'POST') {
      const body = await parseBody(ctx, passwordSchema);
      const u = await db.orm.public.User.where({ id: auth.userId }).first();
      if (!u?.passwordHash || !(await comparePassword(body.currentPassword, u.passwordHash))) throw badRequest('Current password is incorrect');
      await db.orm.public.User.where({ id: auth.userId }).update({ passwordHash: await hashPassword(body.newPassword) });
      // Sign out every other session; keep the session family this request's refresh cookie belongs to.
      const refresh = parseCookies(ctx.req.headers.get('cookie'))['refreshToken'];
      const current = refresh ? await db.orm.public.Session.where({ tokenHash: hashRefreshToken(refresh) }).first() : null;
      const now = new Date().toISOString();
      if (current) {
        await db.orm.public.Session.where((s) => and(s.userId.eq(auth.userId), s.revokedAt.isNull(), s.familyId.neq(current.familyId))).updateAll({ revokedAt: now });
      } else {
        await db.orm.public.Session.where((s) => and(s.userId.eq(auth.userId), s.revokedAt.isNull())).updateAll({ revokedAt: now });
      }
      return ok({ message: 'Password changed. Other sessions were signed out.' });
    }
    if (seg[1] === 'sessions' && method === 'DELETE') {
      await db.orm.public.Session.where((s) => and(s.userId.eq(auth.userId), s.revokedAt.isNull())).updateAll({ revokedAt: new Date().toISOString() });
      return ok();
    }
  }

  // ================= Organization settings & creation =================
  if (seg[0] === 'org' && seg.length === 1 && method === 'PATCH') {
    ctx.need('org:manage');
    const body = await parseBody(ctx, z.object({ name: z.string().trim().min(1).max(100) }).strict());
    const org = await withTenant(orgId, async (tx) => {
      const updated = await tx.orm.public.Organization.where({ id: orgId }).update({ name: body.name });
      await recordAudit(tx, { organizationId: orgId, actorId: auth.userId, action: 'org.renamed', entityType: 'organization', entityId: orgId, metadata: { name: body.name }, requestId: ctx.requestId });
      return updated;
    });
    await db.orm.public.Company.where({ id: companyId }).update({ name: body.name });
    return ok({ organization: org });
  }
  if (seg[0] === 'organizations' && seg.length === 1 && method === 'POST') {
    const body = await parseBody(ctx, z.object({ name: z.string().trim().min(1).max(100) }).strict());
    const { createOrganizationWithOwner } = await import('../../org/memberships.js');
    const company = await db.orm.public.Company.create({ name: body.name });
    const organizationId = await db.transaction((tx) => createOrganizationWithOwner(tx, { name: body.name, companyId: company.id, userId: auth.userId }));
    await db.orm.public.Company.where({ id: company.id }).update({ organizationId });
    return ok({ organization: { id: organizationId, name: body.name } }, 201);
  }

  // ================= Teams =================
  if (seg[0] === 'teams') {
    if (method === 'GET') ctx.need('org:read');
    else ctx.need('teams:manage');
    if (seg.length === 1 && method === 'GET') {
      const data = await withTenant(orgId, async (tx) => ({
        teams: await tx.orm.public.Team.where({ organizationId: orgId }).orderBy((t) => t.name.asc()).all(),
        members: await tx.orm.public.TeamMember.where({ organizationId: orgId }).all(),
        projects: await tx.orm.public.Project.where({ organizationId: orgId }).all(),
      }));
      const users = data.members.length ? await db.orm.public.User.where((u) => u.id.in(data.members.map((m) => m.userId))).all() : [];
      const services = await db.orm.public.Service.where({ companyId }).all();
      return ok({
        teams: data.teams.map((t) => ({
          ...t,
          members: data.members.filter((m) => m.teamId === t.id).map((m) => {
            const u = users.find((x) => x.id === m.userId);
            return { userId: m.userId, isLead: m.isLead, name: displayName(u), email: u?.email ?? '', avatarUrl: u?.avatarUrl ?? null };
          }),
          projects: data.projects.filter((p) => p.teamId === t.id).map((p) => ({ id: p.id, key: p.key, name: p.name })),
          services: services.filter((s) => s.teamId === t.id).map((s) => ({ id: s.id, name: s.name, healthStatus: s.healthStatus })),
        })),
      });
    }
    if (seg.length === 1 && method === 'POST') {
      const body = await parseBody(ctx, teamSchema);
      const team = await withTenant(orgId, async (tx) => {
        const clash = await tx.orm.public.Team.where({ organizationId: orgId, name: body.name }).first();
        if (clash) throw conflict('A team with this name already exists');
        return tx.orm.public.Team.create({ organizationId: orgId, name: body.name, description: body.description ?? null });
      });
      return ok({ team }, 201);
    }
    const teamId = uuidParam(seg[1], 'Team');
    if (seg.length === 2 && method === 'PATCH') {
      const body = await parseBody(ctx, teamSchema.partial());
      return ok({ team: await withTenant(orgId, (tx) => tx.orm.public.Team.where({ id: teamId, organizationId: orgId }).update(body as never)) });
    }
    if (seg.length === 2 && method === 'DELETE') {
      await withTenant(orgId, (tx) => tx.orm.public.Team.where({ id: teamId, organizationId: orgId }).delete());
      return ok();
    }
    if (seg[2] === 'members' && method === 'POST') {
      const body = await parseBody(ctx, z.object({ userId: z.number().int().positive(), isLead: z.boolean().default(false) }).strict());
      await withTenant(orgId, async (tx) => {
        const team = await tx.orm.public.Team.where({ id: teamId, organizationId: orgId }).first();
        if (!team) throw notFound('Team');
        const member = await tx.orm.public.Membership.where({ organizationId: orgId, userId: body.userId }).first();
        if (!member) throw badRequest('That user is not a member of this organization');
        const existing = await tx.orm.public.TeamMember.where({ teamId, userId: body.userId }).first();
        if (existing) await tx.orm.public.TeamMember.where({ id: existing.id }).update({ isLead: body.isLead });
        else await tx.orm.public.TeamMember.create({ organizationId: orgId, teamId, userId: body.userId, isLead: body.isLead });
      });
      return ok({}, 201);
    }
    if (seg[2] === 'members' && seg[3] && method === 'DELETE') {
      const userId = intParam(seg[3], 'Member');
      await withTenant(orgId, (tx) => tx.orm.public.TeamMember.where({ teamId, userId, organizationId: orgId }).delete());
      return ok();
    }
    if (seg[2] === 'activity' && method === 'GET') {
      const data = await withTenant(orgId, async (tx) => {
        const members = await tx.orm.public.TeamMember.where({ teamId, organizationId: orgId }).all();
        const ids = members.map((m) => m.userId);
        const activity = ids.length ? await tx.orm.public.TaskActivity.where((a) => and(a.organizationId.eq(orgId), a.actorId.in(ids))).orderBy((a) => a.createdAt.desc()).limit(50).all() : [];
        const taskIds = [...new Set(activity.map((a) => a.taskId))];
        const tasks = taskIds.length ? await tx.orm.public.Task.where((t) => t.id.in(taskIds)).all() : [];
        const projects = await tx.orm.public.Project.where({ organizationId: orgId }).all();
        return { activity, tasks, projects, ids };
      });
      const users = data.ids.length ? await db.orm.public.User.where((u) => u.id.in(data.ids)).all() : [];
      return ok({
        activity: data.activity.map((a) => {
          const t = data.tasks.find((x) => x.id === a.taskId);
          const p = t ? data.projects.find((x) => x.id === t.projectId) : null;
          return { id: a.id, type: a.type, data: a.data, createdAt: a.createdAt, actor: displayName(users.find((u) => u.id === a.actorId)), task: t && p ? { ref: `${p.key}-${t.number}`, title: t.title } : null };
        }),
      });
    }
  }

  // ================= Global search =================
  if (seg[0] === 'search' && method === 'GET') {
    const raw = (searchParams.get('q') ?? '').trim().slice(0, 100);
    const types = new Set((searchParams.get('types') ?? 'tasks,projects,services,incidents,people,comments,docs').split(','));
    if (raw.length < 2) return ok({ results: [] });
    const like = `%${raw.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const results: Array<{ type: string; id: string; title: string; subtitle?: string; href: string }> = [];
    const work = await withTenant(orgId, async (tx) => ({
      projects: types.has('projects') ? await tx.orm.public.Project.where((p) => and(p.organizationId.eq(orgId), or(p.name.ilike(like), p.key.ilike(like)))).limit(5).all() : [],
      tasks: types.has('tasks') ? await tx.orm.public.Task.where((t) => and(t.organizationId.eq(orgId), or(t.title.ilike(like), t.description.ilike(like)))).orderBy((t) => t.updatedAt.desc()).limit(8).all() : [],
      comments: types.has('comments') ? await tx.orm.public.TaskComment.where((c) => and(c.organizationId.eq(orgId), c.body.ilike(like))).orderBy((c) => c.createdAt.desc()).limit(5).all() : [],
      allProjects: await tx.orm.public.Project.select('id', 'key').where({ organizationId: orgId }).all(),
      members: types.has('people') ? await tx.orm.public.Membership.where({ organizationId: orgId }).all() : [],
    }));
    const keyOf = (pid: string) => work.allProjects.find((p) => p.id === pid)?.key ?? '?';
    // Ticket ref like PAY-12 jumps straight to the ticket.
    const refMatch = /^([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/.exec(raw);
    if (refMatch) results.push({ type: 'task', id: raw.toUpperCase(), title: `Open ${raw.toUpperCase()}`, href: `/dashboard/tasks/${raw.toUpperCase()}` });
    for (const p of work.projects) results.push({ type: 'project', id: p.id, title: p.name, subtitle: p.key, href: `/dashboard/projects/${p.id}` });
    for (const t of work.tasks) results.push({ type: 'task', id: t.id, title: t.title, subtitle: `${keyOf(t.projectId)}-${t.number}`, href: `/dashboard/tasks/${keyOf(t.projectId)}-${t.number}` });
    if (work.comments.length) {
      const ts = await withTenant(orgId, (tx) => tx.orm.public.Task.where((t) => t.id.in(work.comments.map((c) => c.taskId))).all());
      for (const c of work.comments) {
        const t = ts.find((x) => x.id === c.taskId);
        if (t) results.push({ type: 'comment', id: c.id, title: c.body.slice(0, 120), subtitle: `on ${keyOf(t.projectId)}-${t.number}`, href: `/dashboard/tasks/${keyOf(t.projectId)}-${t.number}` });
      }
    }
    if (types.has('services')) {
      for (const s of await db.orm.public.Service.where((s) => and(s.companyId.eq(companyId), or(s.name.ilike(like), s.description.ilike(like), s.slug.ilike(like)))).limit(6).all()) {
        results.push({ type: 'service', id: String(s.id), title: s.name, subtitle: `${s.environment} · ${s.healthStatus}`, href: `/dashboard/services/${s.id}` });
      }
    }
    if (types.has('incidents')) {
      const asId = /^(inc-)?(\d+)$/i.exec(raw);
      for (const i of await db.orm.public.Incident.where((i) => and(i.companyId.eq(companyId), asId ? or(i.id.eq(Number(asId[2])), i.title.ilike(like)) : i.title.ilike(like))).orderBy((i) => i.detectedAt.desc()).limit(6).all()) {
        results.push({ type: 'incident', id: String(i.id), title: i.title, subtitle: `INC-${i.id} · ${i.severity.toUpperCase()} · ${i.status}`, href: `/dashboard/incidents/${i.id}` });
      }
    }
    if (types.has('people') && work.members.length) {
      for (const u of await db.orm.public.User.where((u) => and(u.id.in(work.members.map((m) => m.userId)), or(u.email.ilike(like), u.name.ilike(like), u.username.ilike(like)))).limit(5).all()) {
        results.push({ type: 'person', id: String(u.id), title: displayName(u), subtitle: u.email, href: `/dashboard/team?user=${u.id}` });
      }
    }
    if (types.has('docs')) {
      for (const s of await db.orm.public.Service.where((s) => and(s.companyId.eq(companyId), or(s.runbookUrl.isNotNull(), s.docsUrl.isNotNull()), s.name.ilike(like))).limit(4).all()) {
        if (s.runbookUrl) results.push({ type: 'doc', id: `rb-${s.id}`, title: `${s.name} runbook`, subtitle: s.runbookUrl, href: s.runbookUrl });
        if (s.docsUrl) results.push({ type: 'doc', id: `doc-${s.id}`, title: `${s.name} documentation`, subtitle: s.docsUrl, href: s.docsUrl });
      }
      for (const pm of await db.orm.public.Postmortem.where((p) => and(p.companyId.eq(companyId), or(p.summary.ilike(like), p.rootCause.ilike(like)))).limit(4).all()) {
        results.push({ type: 'doc', id: `pm-${pm.id}`, title: `Postmortem for incident #${pm.incidentId}`, subtitle: pm.summary?.slice(0, 80) ?? pm.status, href: `/dashboard/incidents/${pm.incidentId}/postmortem` });
      }
    }
    return ok({ results });
  }

  return null;
}

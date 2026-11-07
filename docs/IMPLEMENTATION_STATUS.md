# ResolveX — Implementation Status

Legend: `NOT STARTED` · `IN PROGRESS` · `IMPLEMENTED` (code exists, not proven) · `TESTED` (relevant tests actually passed) · `BLOCKED`

_Last updated: 2026-11-07 (audit phase). Baseline: server 41/41 tests pass; server & web type-check clean; web lint clean._

| Area | Feature | Status | Notes |
|---|---|---|---|
| Foundation | Project audit | TESTED | `PROJECT_AUDIT.md`; baseline commands run |
| Foundation | Roadmap | IMPLEMENTED | `IMPLEMENTATION_ROADMAP.md`; decisions D1–D5 pending |
| Foundation | CI pipeline | NOT STARTED | |
| Identity | Register / login / refresh / logout | TESTED | S1, S2, S3 fixed (security.test.ts); S5 fixed (hashed, rotating, reuse-detecting sessions) |
| Platform | Duplicate Next webhook route + `server` dependency in web | TESTED | removed (S15/S16); web no longer bundles DB code |
| Platform | Express 5 HTTP layer, CORS allow-list, request IDs, body limit | TESTED | `src/app.ts`; dashboard router now mounted |
| Identity | Tokens out of localStorage; cookie-only sessions with single-flight refresh | IMPLEMENTED | web only; verified by type-check/lint, not browser-tested (S7) |
| Platform | CSRF guard (origin allow-list for cookie-authenticated mutations) | TESTED | `csrfGuard` in `src/app.ts`; `CORS_ORIGINS` must include the web origin (S4) |
| Tenancy | Role checks on dashboard mutations (viewer read-only, services admin-only) | TESTED | coarse; full RBAC in Phase 4 |
| Identity | Refresh-token rotation with reuse detection | TESTED | `Session` table (migration `add_sessions`, applied to Neon); multi-device; legacy `User.refreshToken` column unused, drop later (contract step) |
| Identity | Rate limiting (login per IP and per IP+account, register, refresh, webhook, API) | TESTED | in-memory, single instance (`src/rate-limit.ts`); needs Redis store when scaled out; relies on correct `TRUST_PROXY` (S9) |
| Identity | Account lockout, password policy (min 6 today), email verification | NOT STARTED | |
| Tenancy | Schema: Organization, Membership, Invitation, Team, TeamMember, AuditLog (UUID PKs, native `@@rls` + policies) | IMPLEMENTED | migration `add_tenancy` verified on disposable Postgres (backfill of Company→Organization, User→Membership, RLS fail-closed) and applied to Neon; **no application code uses these tables yet** |
| Tenancy | Org-scoped tokens (orgId + membership role), registration creates org + owner atomically | TESTED | `src/services/org/`, `auth/`; legacy tokens without orgId are rejected so clients refresh |
| Tenancy | Permission matrix (deny by default) enforced on every dashboard/org route | TESTED | `org/permissions.ts`; legacy tables still keyed by `companyId`, not `organizationId` |
| Tenancy | Members: list, change role, remove (last-owner protection, only owners touch owners) | TESTED | `/api/org/members` |
| Tenancy | Invitations: create/list/revoke/accept (hashed token, email-bound, single-use, race-safe) | TESTED | `/api/org/invitations`, `/api/invitations/accept`; **email delivery not built** (token returned once to inviter) |
| Tenancy | Audit log written in the same transaction as the action; paginated read (admin+) | TESTED | `/api/audit-logs`; covers member/invitation events only so far |
| Tenancy | Org switching (`/api/auth/switch-org`, `/api/organizations`); `/me` and refresh keep the session's org | TESTED | refresh token carries orgId |
| Frontend | Post-login lands on /dashboard (honours safe `?next=`); role-aware sidebar, org switcher, Team, Audit log, Settings, invitation accept, per-service webhook keys; read-only roles lose action buttons | IMPLEMENTED | browser-tested by hand on local stack (register -> dashboard, invite -> accept via `next`, viewer gating, key creation -> real alert -> incident on Overview); no automated UI tests |
| Tenancy | Teams API/UI | NOT STARTED | `Team`/`TeamMember` tables exist |
| Foundation | Isolated test DB (local Docker, non-owner role, refuses non-local DB) | TESTED | `docker-compose.test.yml`, `.env.test`; suite 90 s -> ~13 s; resolves S14 |
| Tenancy | RBAC enforcement | NOT STARTED | roles exist, never checked (S6) |
| Tenancy | PostgreSQL RLS enforcement | TESTED locally / BLOCKED on Neon | policies exist, `withTenant` helper exists, but Neon role `neondb_owner` has BYPASSRLS so RLS is **not enforced** with current credentials; needs a dedicated non-BYPASSRLS app role (see roadmap note). Legacy tables (Service/Incident/…) not covered yet |
| Tenancy | Audit log | NOT STARTED | |
| Teams | Teams / ownership | NOT STARTED | |
| Projects | Projects with unique keys (PAY-12 style ticket refs), archive | TESTED | `services/work/`, `/api/projects`; migration `add_work_management` applied to Neon |
| Projects | Configurable workflow statuses per project (add, rename, recategorise, reorder, delete-if-empty) | TESTED | admin-only; Workflow tab |
| Projects | Tickets: epic/story/task/bug/subtask, priority, assignee, due date, labels, status, comments, activity history | TESTED | hierarchy rules enforced; gap-free numbering under concurrency; admins allot work to anyone, members only self-assign/pick up unassigned |
| Projects | Kanban board (drag between columns + keyboard-accessible select), backlog list, filters, ticket page, My work | IMPLEMENTED | browser-tested by hand (admin creates project/ticket assigned to a responder; responder sees it in My work; read-only gating); no automated UI tests |
| Projects | Attachments, ticket dependencies, sprints, rich-text/markdown, notifications on assignment | NOT STARTED | |
| Monitoring | Service catalog CRUD | IMPLEMENTED | untracked, **not mounted** in server, no tests |
| Monitoring | Endpoint model, secrets, scheduler, workers, results | NOT STARTED | |
| Monitoring | SSRF-safe HTTP client | NOT STARTED | `monitoredUrl` currently unvalidated for SSRF (S13) |
| Incidents | Alert webhook ingestion + grouping + idempotency | TESTED | per-service hashed keys (S8 fixed); `WebhookKey` migration applied; replay = no-op via eventId dedup; no HMAC signing yet (needs encrypted secret storage) |
| Incidents | Webhook key management API (create/list/revoke) | TESTED | `/api/services/:id/webhook-keys`, admin-only writes; **no UI yet** |
| Incidents | Incident list/detail/ack/resolve/comment API | IMPLEMENTED | untracked, **not mounted**, no tests |
| Incidents | Assign, link task, closed state, postmortem | NOT STARTED | |
| Incidents | Escalation, notifications, maintenance windows | NOT STARTED | |
| Agents | Go agent + server endpoints | NOT STARTED | |
| Integrations | Slack, Discord, email, webhooks, GitHub | NOT STARTED | credentials needed for real wiring |
| Analytics | Dashboard metrics | IMPLEMENTED | in-memory counting over unbounded reads; needs SQL aggregates; not mounted |
| Frontend | Landing, login, register | IMPLEMENTED | landing copy (testimonials/metrics) must be verified as non-fabricated |
| Frontend | Dashboard (overview, incidents, services, alerts) | IMPLEMENTED | backend routes unreachable today |
| Frontend | shadcn/ui, TanStack Query, Recharts, Socket.IO | NOT STARTED | |
| Platform | OpenAPI, `/api/v1`, request IDs, error envelope standard | NOT STARTED | |
| Platform | Docker / Compose / Traefik | NOT STARTED | |
| Platform | Observability (logs, Prometheus, Sentry, OTel) | NOT STARTED | |
| Platform | Load test / performance report | NOT STARTED | no capacity claims made |

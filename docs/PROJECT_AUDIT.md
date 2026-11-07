# ResolveX — Project Audit

**Date:** 2026-11-07 · **Commit audited:** `3bb50be` (+ uncommitted work in `apps/server/src/services/api/` and `apps/web/{app/dashboard,lib/api.ts,lib/types.ts}`)
**Method:** read-only inspection of source, configs and git history, plus baseline runs of type-check, lint and tests. No code was changed.

> Scope note: I read every server source file and the web auth/proxy/API-client layer in full. The marketing components (`Hero`, `Navbar`, …) and the dashboard page bodies were only skimmed. Findings about them are marked *(skimmed)*.

---

## 1. Executive summary

ResolveX today is a **small, early-stage incident-response MVP**, not yet the unified platform described in the README. What exists:

- Email/password auth with JWT access + refresh tokens (httpOnly cookies).
- A webhook that ingests monitoring alerts and creates/groups/updates incidents (the best-engineered part: idempotent, transactional, unique-index grouping).
- A dashboard API (services, incidents, alerts, metrics) and matching Next.js dashboard pages — **uncommitted, and not wired into the running server** (see §6).
- A marketing landing page, login and register pages.

What does **not** exist: organizations/memberships/RBAC, projects/tasks, endpoint monitoring (no scheduler, workers, Redis, queues), escalation/notifications, integrations, agents, billing, audit log, Docker/CI, any deployment config.

Baseline health: `tsc` clean (server & web), web lint clean, **41/41 server tests pass**. But there are **critical security defects in the existing auth** (§7) that must be fixed before any feature work, and the test suite runs against a shared cloud database (§9).

Estimated ratio: roughly **5–8 %** of the master prompt's scope is implemented.

---

## 2. Technology stack (actual)

| Layer | Present | Notes |
|---|---|---|
| Monorepo | npm workspaces + Turborepo `^2.11.10` | `apps/server`, `apps/web`, `packages/{ui,eslint-config,typescript-config}`. Root package is still named `my-turborepo`. |
| Runtime | Node, `engines: >=24` | **Dev machine runs Node 22.22.1** — engine mismatch (npm `engine-strict` is off, so silently ignored). |
| Language | TypeScript **7.0.2** | Very new major; `tsc` works. |
| Backend | **Hand-rolled `node:http` server** (`src/server.ts`) with Web-standard `Request`/`Response` handlers, run via `tsx` | No framework, no DI, no OpenAPI. Not NestJS. |
| ORM | **Prisma 8 RC "contract" ORM** (`@prisma/orm-postgres ^8.0.0-rc.18`, `prisma ^8.0.0-rc.24`, `@prisma/cli-engine`) | Not the classic Prisma Client. Schema in `src/prisma/contract.prisma`; client via `db.orm.public.<Model>`. Release-candidate software. A stray `@prisma/client ^7.10.1` sits in the *root* `package.json` and is unused. |
| Validation | Zod 4 | Used consistently in auth, incident engine, services API. |
| Auth libs | `bcryptjs` (cost 10), `jsonwebtoken` | |
| DB | PostgreSQL on **Neon** (pooled, us-east-2) | Single database used by dev **and tests**. |
| Frontend | Next.js **16.3.8**, React 19.2, Tailwind **4**, `lucide-react` | No shadcn/ui, TanStack Query, Zustand, Recharts or Socket.IO. `packages/ui` is still the Turborepo starter (`button`, `card`, `code`). |
| Tests | Vitest 5 | Server only. No web tests, no e2e. |
| Infra | **None** | No Dockerfile, compose, CI workflow, Redis, queue, or env docs beyond `.env.example`. |

## 3. Current architecture

```
Browser ──► Next.js (apps/web, :3001)
              ├─ app/page, /login, /register, /dashboard/*   (UI)
              ├─ app/api/webhooks/alerts/route.ts            (imports `server/incident-engine` and talks to the DB directly)
              └─ proxy.ts  ──rewrite /api/:path*──►  BACKEND_URL (default http://localhost:3000)
                                                       │
                                  apps/server/src/server.ts  (node:http)
                                    ├─ GET  /health
                                    ├─ /api/auth/*, /register, /login, /refresh, /logout, /me
                                    └─ POST /api/webhooks/alerts
                                                       │
                                               Prisma 8 contract ORM ──► Neon Postgres
```

Observations:

1. `apps/web` **depends on `server` as a workspace package** (`"server": "*"`, `transpilePackages: ['server']`) and the alert route handler imports the DB layer straight into Next. So the web app is both a client of the backend *and* a second backend process holding DB credentials. There are two parallel implementations of `POST /api/webhooks/alerts` (Next route and `server.ts`); which one runs depends on how `proxy.ts` and route precedence interact. This is accidental architecture and should be collapsed to one.
2. `proxy.ts` is exported as `proxy`, `middleware` *and* default, and silently falls back to `https://` for scheme-less `BACKEND_URL`. It rewrites **all** `/api/*` including the webhook, so the local Next route is probably shadowed. *(not runtime-verified)*
3. There is no layering convention beyond `services/<name>/{route,controller,model}`; the `api/` handlers mix HTTP, validation, queries and response shaping in one function.

## 4. Repository structure

```
apps/server/
  src/server.ts                    HTTP adapter + CORS + top-level routing
  src/prisma/{contract.prisma,contract.json,contract.d.ts,db.ts}
  src/services/auth/               model (zod, bcrypt, JWT, queries), controller, route, cookies, tests
  src/services/incident-engine/    alert webhook ingestion (+ tests)
  src/services/api/                UNTRACKED: router, auth guard, services, incidents, alerts, metrics
  migrations/snapshots/*           3 contract snapshots (Prisma 8 flow — not SQL migrations)
  prisma-8.md                      generated starter doc
apps/web/
  app/{page,login,register}/       landing + auth
  app/dashboard/**                 UNTRACKED: overview, incidents(+[id]), services, alerts
  app/api/webhooks/alerts/route.ts
  components/*                     marketing sections (Hero, Pricing, Testimonials, …)
  lib/{auth-context.tsx,api.ts,types.ts}
packages/{ui,eslint-config,typescript-config}
README.md                          1,285-line product spec (aspirational)
```

Hygiene: 16 files of real work are **uncommitted**; `apps/server/.env` is correctly git-ignored (`.env` pattern) and holds `DATABASE_URL`, `ALERT_WEBHOOK_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (values not read by me beyond key names). `.env.example` does **not** list the JWT secrets.

## 5. Database design

Models (`contract.prisma`): `Company`, `User`, `Post`, `Service`, `Incident`, `IncidentEvent`, `AlertEvent`. Enums for role, service type/env/criticality/health, incident severity/status, event type, alert processing status.

Good:
- `Incident` has a **partial unique index** `incident_one_unresolved_per_service` — DB-enforced incident grouping.
- `AlertEvent` unique `(serviceId, provider, providerEventId)` — DB-enforced idempotency.
- Composite indexes on `(companyId, status|severity|role|healthStatus|environment)`; `Service` unique `(companyId, name)`.
- `Incident.companyId` is denormalised so tenant filters don't need joins.

Problems / gaps versus the master prompt:
- **Integer autoincrement IDs everywhere** (prompt requires UUIDs). Integer IDs are enumerable, which makes IDOR bugs trivially exploitable. Changing PK types on a populated Neon DB is a data migration, not an edit.
- **Tenancy is `Company` + single `User.companyId`**: one user = one tenant, one role. No `Organization`/`Membership`/`Invitation`/`Team`. Role is a column on the user.
- `User.refreshToken` is a **single plaintext string column** (see §7).
- `AlertEvent` has no `companyId`; the API scopes via a service-id fan-out (N queries).
- `Post` is leftover scaffold from the Prisma starter and should be removed (after confirming it's empty).
- No `CheckResult`, `Endpoint`, `EndpointSecret`, `Project`, `Task`, `Sprint`, `Workflow`, `EscalationPolicy`, `Notification*`, `MonitoringAgent`, `AgentCredential`, `Integration`, `AlertRule`, `AuditLog`, `Subscription`, `UsageRecord`.
- No Row-Level Security; no partitioning/retention plan; no `deletedAt`; `AlertEvent` rows are never pruned.
- Migrations: only **contract snapshots** exist; I did not find SQL migration files. Whether Prisma 8 RC supports hand-written SQL (RLS policies, `PARTITION BY`, partial indexes beyond what the contract DSL expresses — the partial index here works) **has not been verified** and gates the RLS/partitioning design (see roadmap, decision D1).

## 6. Functional modules — what actually works

| Module | State | Evidence |
|---|---|---|
| Register / login / refresh / logout / me | Works, **but insecure** (§7) | 41 passing tests incl. `auth.test.ts` |
| Alert webhook → incident engine | Works, tested | `process-alert.test.ts` (concurrency/idempotency covered) |
| Health endpoint | Works | `server.ts` |
| Dashboard API (`/services`, `/incidents`, `/incidents/:id/{acknowledge,resolve,comments}`, `/alerts`, `/metrics`) | Code exists, type-checks, **untested and unreachable**: `dashboardRouter` is exported from `services/api/index.ts` but **never imported by `server.ts`** (grep confirms). Every dashboard page therefore 404s against the real backend. | `grep dashboardRouter` |
| Dashboard UI | Pages exist, lint/type clean; real API calls through `lib/api.ts` *(skimmed)* | |
| Landing page | Static marketing content incl. pricing & testimonials *(skimmed)*. Testimonials/metrics are presumably invented copy — must be flagged before launch. | |
| Everything else in the prompt | **Absent** | |

Other functional gaps inside the existing modules: no `assign` endpoint; `services` DELETE cascades to incidents; incident `resolve` updates incident and service health in separate statements (no transaction); `monitoredUrl` is stored but nothing ever requests it.

## 7. Security findings (existing code)

Severity: **C**ritical / **H**igh / **M**edium / **L**ow.

| # | Sev | Finding | Where |
|---|---|---|---|
| S1 | **C** | **Anyone can register as `owner` of *any* existing company.** `registerSchema` accepts client-supplied `role` and `companyId`; `createUserWithCompany` trusts both. Full tenant takeover with an integer guess. | `auth/model.ts` registerSchema, `createUserWithCompany` |
| S2 | **C** | **Hard-coded fallback JWT secrets** (`resolvex_access_secret_development_only…`) are used when env vars are unset; the server starts normally without them. A misconfigured prod deploy yields forgeable tokens. | `auth/model.ts:6-14` |
| S3 | **C** | **Unauthenticated logout-any-user:** `logout` accepts `{userId}` from the body and nulls that user's refresh token. | `auth/controller.ts` logout |
| S4 | **H** | **Reflected CORS with credentials:** `Access-Control-Allow-Origin: <any Origin>` + `Allow-Credentials: true`; `*` otherwise. Any website can make credentialed calls. Cookies are `SameSite=Lax`, which mitigates but doesn't remove this; there is no CSRF protection for the bearer-less cookie path. | `server.ts` |
| S5 | **H** | **Refresh tokens stored in plaintext, one per user.** DB leak = account takeover; a second login/device invalidates the first; no reuse detection (the "rotation" only compares to the last issued token). No token family / session table. | `User.refreshToken`, `controller.ts` |
| S6 | **H** | **No RBAC at all.** Role is in the JWT but no handler checks it: a `viewer` can create/delete services and resolve incidents. | `api/*.ts` (grep: zero role checks) |
| S7 | **H** | **Access tokens are also kept in `localStorage`** (`resolvex_auth_token`) despite httpOnly cookies being issued — defeats httpOnly; XSS = token theft. | `web/lib/auth-context.tsx`, `lib/api.ts` |
| S8 | **H** | **Single global webhook secret** authorises alerts for *every* service of *every* tenant (documented limitation). A leaked secret lets an attacker open/flood incidents anywhere. No replay protection (no timestamp/nonce in the HMAC). | `incident-engine/auth.ts` |
| S9 | **M** | No rate limiting or lockout on login/register/refresh; bcrypt cost 10; min password length 6; no email verification; user enumeration via `EMAIL_ALREADY_EXISTS`. | `auth/*` |
| S10 | **M** | `refresh` error response echoes JWT library messages; `USER_NOT_FOUND` returns 404 on refresh. | `controller.ts` |
| S11 | **M** | `X-Forwarded-Proto` / `Host` trusted unconditionally when building URLs; `x-forwarded-*` spoofable. | `server.ts` |
| S12 | **M** | No request-size limit on the generic path (only the webhook checks 64 kB *after* reading the whole body), no request IDs, no security headers, console logging of raw errors. | `server.ts` |
| S13 | **M** | `monitoredUrl` accepts any `http(s)://…` string, including `http://169.254.169.254/` and `localhost`. Harmless today (never fetched) — **becomes SSRF the moment monitoring is built**; validation must be replaced, not extended. | `api/services.ts` |
| S14 | **M** | Tests run against the **live Neon database** (`vitest.setup.ts` loads `apps/server/.env`). Fixtures are cleaned up per test, but a failed cleanup or a bug leaves rows in the same DB the app uses; there is no isolation from dev data. | `vitest.setup.ts` |
| S15 | **L** | Dual webhook implementations (Next route + server) double the attack surface. | §3 |
| S16 | **L** | Web app bundles `server` (and therefore DB code + secrets access) into Next server runtime. | `next.config.js` |

## 8. Performance and scalability bottlenecks

- **Unbounded reads everywhere.** `getMetrics`, `listServices`, `listIncidents`, `listAlerts` call `.all()` then filter/sort/count **in JavaScript**. `getMetrics` loads every service, every incident and *every alert row* (via N parallel per-service queries). Linear in total history; will collapse at a few thousand rows. Needs SQL aggregates, `LIMIT`/cursor pagination, and indexed filters.
- N+1 fan-out in `listAlerts`/`getMetrics` because `AlertEvent` lacks `companyId`.
- bcryptjs (pure JS) blocks the event loop under auth load; consider native `argon2`/`bcrypt` on a worker pool.
- Response streaming loop writes without backpressure handling.
- Test suite takes ~86 s for 41 tests because each call crosses to a remote Neon instance.
- No caching, no connection-pool tuning, no health/readiness separation.

## 9. Quality baseline (measured)

| Check | Result |
|---|---|
| `tsc --noEmit` apps/server | pass |
| `tsc --noEmit` apps/web (after `next typegen`) | pass |
| `eslint --max-warnings 0` apps/web | pass |
| `vitest run` apps/server | **3 files, 41 tests pass** (86 s) |
| Web tests / e2e / API tests for dashboard router | none |
| Server lint / formatting config | none (Prettier only at root, no CI) |
| `next build` | not run in this audit |

Not covered by any test: cross-tenant isolation of the dashboard API, role enforcement, CORS, the `proxy.ts` rewrite, webhook auth signature replay.

## 10. Missing functionality (vs. the master prompt)

Everything in prompt parts 3–11 apart from: JWT auth, incident ingestion/grouping, and partial incident lifecycle (`open → acknowledged → investigating → mitigated → resolved`; prompt wants `… → RESOLVED → CLOSED`, with no `mitigated`, and the current UI/API cannot set `investigating` or assign). Specifically absent: orgs/RBAC/invitations/teams, projects/tasks/boards, endpoint model + secrets vault, scheduler/BullMQ/workers/Redis, result storage & partitioning, escalation, notifications, integrations, Go agent, analytics, audit log, billing, OpenAPI, request IDs, rate limiting, observability, Docker, CI/CD, e2e/load tests, `/api/v1` versioning.

## 11. Reusable assets

Keep and build on:
- **Incident engine** (`incident-engine/*`): idempotent claim → transactional grouping → unique-index fallback. Its *patterns* are right; its *inputs* (shared secret, integer ids) must change.
- Zod-validated, `.strict()` schemas and the `{ ok, error:{code,message,details} }` error envelope — keep the envelope, standardise it.
- `cookies.ts` (+ tests): small, sound cookie helpers (works once `Secure`/`SameSite` policy is decided).
- Test fixtures pattern (create company → run → delete) — reusable once pointed at an isolated DB.
- Dashboard UI shell, `ui.tsx` primitives, `lib/api.ts` client, `lib/types.ts` — adapt to v1 endpoints.
- Turborepo/workspace layout and `packages/*` config.

Replace or retire: `Post` model, `my-turborepo` naming, starter `packages/ui` components, duplicate Next webhook route, `server` imported into web, localStorage token handling, hand-rolled router *(pending D2)*.

## 12. Recommended architectural improvements

1. **One backend, one DB client.** Web talks to the API over HTTP only. Remove `server` from `apps/web` dependencies; delete the Next webhook route.
2. **Auth hardening first** (S1–S3, S5–S7) — small, high-value, independent of the stack decision.
3. **Introduce tenancy properly** (`Organization`, `Membership`, `Invitation`, role per membership, org id in token/session) *before* building any new tenant-owned table, so every new table is born tenant-scoped.
4. **Move to UUID primary keys via an expand/contract migration**, not an in-place type change.
5. **Isolated test database** (Neon branch or local Postgres in Docker) with a guard that refuses to run tests if `DATABASE_URL` is not an allow-listed test target.
6. **Framework decision** (see roadmap D2): the prompt prefers NestJS; the existing server is only ~1.5 k lines, so migration is cheap *now* and expensive later. Recommended: adopt NestJS for DI/guards/OpenAPI/BullMQ integration, re-using the engine and Zod/DTO logic.
7. **ORM decision** (D1): Prisma 8 RC contract ORM vs. stable Prisma — must be decided on evidence (RLS, raw SQL migrations, partitioning, `FOR UPDATE`, transactions support), because it determines how multi-tenancy and time-series storage are done.
8. Queue/worker split (BullMQ + Redis) as separate entrypoints in the same repo, scaled independently.
9. Observability baseline (structured logs with request IDs and secret redaction) in the same pass as the framework move.

## 13. Open questions / not verified

- Contents and row counts of the Neon database (I did not query it). Any ID-type migration must start from a backup/branch.
- Whether `Post` or any table contains data worth keeping.
- Prisma 8 RC capabilities for SQL migrations / RLS / partitions.
- Runtime behaviour of the Next `proxy.ts` rewrite vs. the local webhook route.
- Whether Docker, Redis or a local Postgres are available on this machine.

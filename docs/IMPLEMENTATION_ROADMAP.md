# ResolveX — Implementation Roadmap

Companion to [PROJECT_AUDIT.md](./PROJECT_AUDIT.md). Status of each item lives in [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md). A phase is **done** only when its acceptance criteria pass *and* format, lint, type-check and the phase's tests are green.

## 0. Decisions needed before Phase 2 (owner: project owner)

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| **D1** | ORM / migrations — **RESOLVED 2026-11-07: keep Prisma 8 RC.** Spike (disposable Postgres 17): hand-written SQL migrations work via `migration new` + `rawSql(op)` but must ride along with a contract-changing migration (a same-contract raw migration is rejected as a no-op self-edge); `set_config('app.org_id', id, true)` runs inside `db.transaction` via `RawQueryAst` + `planFromAst` (`src/prisma/tenant.ts`), RLS scopes ORM queries in that transaction, fails closed with no tenant, and does not leak across pooled connections. App DB role must not be superuser/BYPASSRLS. Original options: | (a) keep Prisma 8 RC contract ORM; (b) move to stable Prisma (6/7) with SQL migrations | Run a 1-day spike on (a): can it ship hand-written SQL migrations (RLS policies, `PARTITION BY`, `SET LOCAL app.org_id`)? If yes keep it; if no, move to (b). The spike result is written into the audit. Don't guess. |
| **D2** | Backend framework | (a) keep hand-rolled `node:http`; (b) NestJS; (c) Express | **DECIDED 2026-11-07: (c) Express 5** (owner's call, replacing the NestJS recommendation). Existing handlers are Web `Request`/`Response` functions, wrapped by a thin adapter in `src/app.ts`; migrate them to native Express routers incrementally. DI/OpenAPI/BullMQ wiring will be done by hand (zod schemas → OpenAPI). Original note: **(b)** — only ~1.5 kLOC to port; gives DI, guards, DTO validation, Swagger, BullMQ modules the roadmap needs. Reuse the incident engine and Zod schemas inside Nest modules. |
| **D3** | Primary keys | Integers → UUIDs | UUIDs via expand/contract on a **Neon branch first**. Needs confirmation that existing data is disposable or must be preserved. |
| **D4** | Test database | Neon branch vs local Docker Postgres | Local Docker Postgres for tests/CI; Neon only for deployed envs. |
| **D5** | Hosting target | Compose on a VPS (per prompt) vs current Neon + Vercel/Render split | Compose is the stated goal; Neon can remain the DB. |

Until D1/D2 are answered, Phase 3 work is limited to changes that are valid under any outcome.

## 1. Sequence and dependencies

```
P1 Audit ─► P2 Architecture ─► P3 Security fixes ─► P4 Tenancy/RBAC ─► P5 Projects
                                         │                      │
                                         │                      ├─► P6 Public monitoring ─► P7 Incidents/alerting ─► P8 Agents
                                         └─ (test DB, CI) ──────┘                                  │
                                                                                                   └─► P9 Integrations/analytics ─► P10 Hardening/deploy
```
P5 and P6 are independent after P4 and can proceed in parallel. P7 needs P6 (thresholds, results) and P4 (ownership). P8 needs P6's check schema and executor.

## 2. Phases

### Phase 1 — Audit ✅ (this document set)
Acceptance: audit + roadmap + status files exist, findings verified against code and a measured baseline.

### Phase 2 — Architecture finalisation
Work: resolve D1–D5; write `docs/ARCHITECTURE.md` (module boundaries, request/queue flows, tenancy model, error envelope, `/api/v1` conventions); decide repo layout (`apps/api`, `apps/worker`, `apps/web`, `agents/go`, `packages/*`).
Risks: RC-ORM limitations discovered late. Mitigation: spike first.
Acceptance: written decisions; spike proves one RLS policy + one partitioned table + one transactional `SELECT … FOR UPDATE` round-trip under the chosen ORM.

### Phase 3 — Critical security & structural fixes
Order (each its own commit, each with a failing-first regression test):
1. **Commit the uncommitted work** on a branch so nothing is lost.
2. S1: remove `role`/`companyId` from public registration; registration creates a new org with the user as owner; joining only by invitation.
3. S2: fail fast at boot if `JWT_*` secrets are missing/short; remove fallbacks; update `.env.example`.
4. S3: logout derives the user from the token, never from the body.
5. S5: sessions table; hashed refresh tokens; rotation with reuse detection (reuse ⇒ revoke family).
6. S4: CORS allow-list from env; CSRF defence for cookie-authenticated mutations (double-submit or `Origin` check).
7. S7: stop persisting tokens in `localStorage`; rely on httpOnly cookies.
8. Mount the dashboard router (or its Nest successor) and cover it with tests; collapse the duplicate webhook route; remove `server` from `apps/web` deps.
9. S9/S12: rate limits, body-size limits, request IDs, secret-redacting logger, security headers.
10. Test isolation (D4) and `engines`/`.nvmrc` alignment; CI skeleton running format/lint/type-check/tests.
Acceptance: each S1–S3, S5–S7 has a test that fails on the old code and passes now; all existing 41 tests still pass; CI green.

### Phase 4 — Multi-tenancy, authentication, RBAC
**Progress (2026-11-07):** D1/D3 decided (Prisma 8; UUIDs for new tables). Tenancy tables, native RLS policies and the Company→Organization / User→Membership backfill are migrated. **Required before RLS counts as enforced:** create a dedicated app role without `BYPASSRLS`/superuser (managed-Postgres owner roles bypass RLS), e.g. `CREATE ROLE resolvex_app LOGIN PASSWORD '…' NOSUPERUSER NOBYPASSRLS; GRANT USAGE ON SCHEMA public TO resolvex_app; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO resolvex_app; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO resolvex_app; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO resolvex_app;` and point the API's `DATABASE_URL` at it while migrations keep using the owner. Remaining: org-scoped sessions/tokens, `withTenant` on every query path, invitations/teams/audit APIs, permission matrix, legacy tables → `organizationId`.

Work: `Organization`, `Membership(role)`, `Invitation`, `Team`, `TeamMember`; org-scoped session; permission matrix (`owner/admin/responder/member/viewer`) enforced by guards + service-layer checks; Postgres RLS (`app.org_id` set per transaction) on every tenant table; `AuditLog`; migrate `Company/User` data (expand/contract).
Risks: RLS + connection pooling (Neon pooler) — session variables must be `SET LOCAL` inside transactions.
Acceptance: automated cross-tenant suite (every list/get/mutate endpoint, org A token vs org B ids ⇒ 404/403, and raw-SQL probes confirming RLS blocks even if app code forgets the filter); role-matrix test; invitation flow test.

### Phase 5 — Project management
Work: `Project`, `Workflow/Status`, `Task` (epic/story/bug/subtask), comments, labels, attachments (S3-compatible, signed URLs), dependencies, sprints, boards; REST under `/api/v1`; UI (board, backlog, task drawer).
Acceptance: API + RLS tests; status-workflow transition tests; UI e2e: create project → create task → move on board → comment.

### Phase 6 — Public API monitoring
Work: `Service`, `Endpoint`, `EndpointSecret` (envelope-encrypted, write-only), `CheckResult` (time-partitioned, retention job); Redis + BullMQ scheduler (repeatable/deduplicated jobs, jittered), execution workers with concurrency limits, retries, DLQ, graceful shutdown, health endpoints; **SSRF-safe HTTP client** (resolve DNS once, block loopback/private/link-local/metadata, pin resolved IP, validate every redirect hop, response-size and time caps); assertions/latency/threshold evaluator; manual test endpoint.
Replaces: the permissive `monitoredUrl` validation (S13).
Acceptance: SSRF test matrix (127.0.0.0/8, ::1, 169.254.169.254, RFC1918, decimal/hex/octal IPs, IPv4-mapped IPv6, DNS rebinding fixture, redirect-to-internal); duplicate-job idempotency test; worker crash/retry test; secrets never appear in API responses or logs (asserted).
Benchmark (needed before any capacity claim): load test toward 5,000 endpoints; results recorded in `docs/PERFORMANCE_REPORT.md` — only measured numbers.

### Phase 7 — Incidents and alerting
Work: incident engine consumes monitoring state transitions (failure/recovery thresholds), one-incident-per-unhealthy-endpoint guarantee (reuse the partial-unique-index pattern), ownership routing service → team → assignee, lifecycle `OPEN→ACKNOWLEDGED→INVESTIGATING→RESOLVED→CLOSED` (+ migration of existing `mitigated`), maintenance windows, suppression, escalation policies/rules with delayed jobs, notification + attempts with retries, incident↔task link/auto-create, postmortem notes, timeline.
Acceptance: transition-table tests (illegal transitions rejected); "N consecutive failures ⇒ exactly one incident" under concurrent workers; notification retry doesn't create incidents; escalation fires only if unacknowledged; recovery threshold verified.

### Phase 8 — Private monitoring agents
Work: Go agent (`agents/go`): one-time enrollment token → scoped credential, outbound HTTPS only, pulls signed config, executes checks under allow-list (hosts/CIDRs/ports/protocols/redirects/size/time), batches/retries results with local spool, heartbeat + version, credential rotation and revocation; server endpoints `/api/v1/agents/*`; replay protection (nonce/timestamp or per-request signature).
Acceptance: revoked agent rejected on every endpoint; agent refuses out-of-scope destinations (table test); offline-then-reconnect delivers spooled results exactly once; Go unit tests + an integration test against a local API.

### Phase 9 — Integrations and analytics
Work: Slack / Discord / email / signed generic webhooks / GitHub behind a common `NotificationChannel` interface; **only wire a provider when credentials exist**, otherwise ship the interface + docs and mark BLOCKED; analytics endpoints (SQL aggregates, no in-memory counting) for dashboard: uptime %, MTTA/MTTR, workload.
Acceptance: provider contract tests with recorded fakes *labelled as such*; real-provider verification only with supplied credentials; analytics queries covered by tests with EXPLAIN checks on indexes.

### Phase 10 — Production hardening and deployment
Work: Dockerfiles, `docker-compose.yml` (web, api, postgres, redis, scheduler, workers, notifier, Traefik+TLS), health/readiness, backups + restore drill, migration job, `.env.production.example`, GitHub Actions (lint, types, unit, integration with service containers, build/push), Prometheus/Grafana/Sentry/OTel wiring, `SECURITY.md`, deployment guide, load-test report.
Acceptance: `docker compose up` from a clean checkout reaches a working app; restore drill documented with timings; CI green on a PR; dashboards show live metrics.

## 3. Cross-cutting requirements (every phase)

- Format (`prettier`), lint, type-check, relevant tests before a phase is reported complete; failing tests are never skipped silently.
- Migrations are additive/expand-contract and are first rehearsed on a branch/copy of the DB; no database resets.
- New tenant tables are born with `organizationId`, RLS policy, and a cross-tenant test.
- No mock data in product code paths; unavailable external credentials ⇒ interface + docs + BLOCKED status.
- Docs updated in the same PR as the behaviour (`ARCHITECTURE`, `DATABASE_ERD`, `SECURITY`, status file).

## 4. Top risks

| Risk | Impact | Mitigation |
|---|---|---|
| Prisma 8 RC gaps (RLS/partitions/raw SQL) | Rework of data layer | D1 spike before committing to design |
| ID-type migration on live data | Data loss / downtime | Neon branch rehearsal; expand/contract; backups |
| RLS with pooled connections | Cross-tenant leakage or broken queries | `SET LOCAL` in transaction; tests that bypass app filters |
| SSRF in monitor/agent | Internal network exposure | Dedicated hardened HTTP client, egress firewall, test matrix; never use plain `fetch` for user URLs |
| Scope (this is a multi-quarter product) | Half-built features reported as done | Strict status labels; vertical slices; TESTED only after passing tests |
| Capacity claims without load data | Misleading | `PERFORMANCE_REPORT.md` holds measured numbers only |

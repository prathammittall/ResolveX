# ResolveX --- Intelligent Engineering Operations Platform

> **One workspace to plan engineering work, monitor services, respond to
> incidents, and ship software with confidence.**

ResolveX is a unified, multi-tenant SaaS platform that combines project
management, API and service monitoring, incident response, and
engineering intelligence. It helps teams understand what is broken, what
is affected, who should respond, and what needs to happen next.

The platform is designed for startups, software teams, and larger
engineering organizations. It brings together workflows that are often
scattered across project trackers, uptime monitors, chat tools,
repositories, CI/CD systems, and incident-management products.

> **Project status:** Planning / MVP design\
> **Product type:** Full-stack SaaS\
> **Primary stack:** Next.js, TypeScript, Tailwind CSS, Prisma ORM,
> PostgreSQL\
> **Working name:** ResolveX (name can be changed before launch)

------------------------------------------------------------------------

## Table of Contents

-   [Vision](#vision)
-   [The Problem](#the-problem)
-   [Our Solution](#our-solution)
-   [Product Principles](#product-principles)
-   [Core Features](#core-features)
-   [Key User Workflows](#key-user-workflows)
-   [MVP Scope](#mvp-scope)
-   [Product Roadmap](#product-roadmap)
-   [Technology Stack](#technology-stack)
-   [High-Level Architecture](#high-level-architecture)
-   [Suggested Repository Structure](#suggested-repository-structure)
-   [Domain Model](#domain-model)
-   [API Design](#api-design)
-   [Security and Privacy](#security-and-privacy)
-   [Reliability and Observability](#reliability-and-observability)
-   [Local Development Setup](#local-development-setup)
-   [Environment Variables](#environment-variables)
-   [Database Workflow](#database-workflow)
-   [Testing Strategy](#testing-strategy)
-   [Deployment Strategy](#deployment-strategy)
-   [Non-Functional Requirements](#non-functional-requirements)
-   [Success Metrics](#success-metrics)
-   [Contribution Guidelines](#contribution-guidelines)
-   [License](#license)

------------------------------------------------------------------------

## Vision

Build an engineering operations platform that connects the full software
lifecycle:

**Plan → Build → Deploy → Monitor → Respond → Learn → Improve**

Traditional project-management tools track tasks. Monitoring tools
report service health. Incident tools coordinate response. ResolveX
connects these workflows so that service failures can become actionable
incidents, incidents can be routed to the right people, and the
resulting work can be tracked through resolution.

The long-term goal is to help engineering teams spend less time
coordinating tools and more time delivering reliable software.

## The Problem

Engineering teams commonly face these challenges:

-   **Fragmented information:** tasks, deployments, alerts, ownership
    records, and incident discussions live in different systems.
-   **Slow incident triage:** engineers must manually identify the
    affected service, inspect recent changes, and find the responsible
    team.
-   **Unclear ownership:** a service may have no explicit owner, backup
    responder, or maintained runbook.
-   **Noisy alerts:** repeated checks can create duplicate notifications
    and distract teams from actionable incidents.
-   **Hidden delivery risks:** dependencies, unresolved defects, slow
    reviews, and reliability problems can threaten releases.
-   **Recurring failures:** teams often repeat the same investigations
    because previous incidents and fixes are difficult to find.
-   **Limited operational visibility:** leaders lack a unified view of
    project delivery, service reliability, and engineering risks.

## Our Solution

ResolveX provides one workspace for:

1.  Managing organizations, teams, projects, tasks, and delivery
    workflows.
2.  Registering services and monitoring authorized HTTP endpoints.
3.  Detecting and verifying failures using configurable rules.
4.  Creating incidents and routing them using service ownership and
    escalation policies.
5.  Correlating incidents with deployments, code changes, dependencies,
    and historical incidents.
6.  Using AI to summarize evidence and suggest next steps---with clear
    boundaries and human approval for consequential actions.
7.  Measuring reliability, delivery health, recurring problems, and
    engineering operational load.

### Product differentiator

The core differentiator is **connected engineering context**. ResolveX
should not merely say that an endpoint is down. It should help answer:

-   Which service and environment are affected?
-   What is the potential blast radius?
-   Did a deployment or configuration change occur near the failure?
-   Who owns the service, and who is currently on call?
-   Has the team seen a similar issue before?
-   What is the next safe, useful action?

The platform must distinguish evidence from hypotheses. A recent
deployment may correlate with a failure without necessarily causing it.

------------------------------------------------------------------------

## Product Principles

-   **Reliable before intelligent:** deterministic monitoring and
    incident state transitions come before AI diagnosis.
-   **Actionable, not noisy:** deduplicate repeated failures and route
    alerts using explicit policies.
-   **Secure by default:** tenant isolation, least privilege, secret
    protection, and safe network access are foundational.
-   **Human-controlled automation:** production-changing actions require
    configured permissions and approval.
-   **Evidence-backed AI:** recommendations should reference actual
    events and data, state uncertainty, and avoid fabricated causes.
-   **Incremental architecture:** begin with a modular monolith and
    extract services only when scaling or isolation requires it.
-   **Customer choice:** support public endpoints first and
    private-network monitoring through a restricted customer-side agent.
-   **Measurable value:** prioritize features that improve recovery
    time, release safety, delivery predictability, or operational
    efficiency.

------------------------------------------------------------------------

## Core Features

### 1. Project and Task Management

-   Organizations and workspaces
-   Teams, memberships, roles, and invitations
-   Projects, tasks, subtasks, priorities, labels, and due dates
-   Task assignment, comments, activity history, and dependencies
-   Kanban board and filtered task views
-   Project status and milestone tracking
-   Links between tasks, services, incidents, deployments, and pull
    requests

**MVP goal:** a team can create and track work collaboratively with
tenant-scoped access control.

### 2. Service Catalog and Ownership

-   Register services, environments, and endpoints
-   Assign service owners and owning teams
-   Record service criticality and operational metadata
-   Link services to repositories and deployments
-   Maintain runbook links and escalation contacts
-   Represent service dependencies as the product evolves

**MVP goal:** every monitored endpoint belongs to a known service with
an explicit ownership path.

### 3. API and Service Monitoring

-   Configurable HTTP health checks
-   Supported methods and request configuration
-   Configurable intervals, timeouts, and expected status codes
-   Optional bounded response assertions
-   Check history, latency, failure reason, and last successful check
-   Health states such as `PENDING`, `HEALTHY`, `DEGRADED`, `DOWN`, and
    `UNKNOWN`
-   Maintenance windows and alert thresholds in a later iteration
-   Public monitoring workers and private monitoring agents

Monitoring runs in background workers. It must not depend on the browser
being open or a user remaining signed in.

### 4. Incident Management

-   Create incidents from verified monitoring conditions
-   Deduplicate repeated failures
-   Incident severity, status, owner, and timeline
-   Acknowledgment and investigation tracking
-   Recovery verification and resolution records
-   Related incidents and corrective-action tasks
-   Notification delivery status and escalation history
-   Post-incident report generation

Example lifecycle:

`OPEN → ACKNOWLEDGED → INVESTIGATING → RESOLVED`

A repeated failure after resolution may reopen the incident or create a
linked incident according to an explicit policy.

### 5. Intelligent Responder Routing

Recommended routing order:

1.  Active on-call responder for the affected service or team
2.  Primary service owner
3.  Backup on-call responder
4.  Team lead or escalation contact
5.  Organization-level fallback

Presence signals may inform routing but should not override the team's
declared on-call policy. Every escalation should be auditable and
idempotent.

### 6. Deployment Risk Intelligence

Future integration with GitHub and CI/CD providers can associate
deployments, commits, pull requests, and incidents.

Potential capabilities:

-   Display deployments on service health timelines
-   Flag elevated errors following a deployment
-   Identify unresolved critical issues before a release
-   Correlate changes with incidents without claiming causation
    prematurely
-   Prepare rollback recommendations for approval
-   Link the incident to the relevant repository and engineering task

### 7. Engineering Intelligence and AI Copilot

Potential capabilities:

-   Summarize incident timelines
-   Search previous incidents and runbooks
-   Suggest relevant service owners and diagnostic steps
-   Draft postmortems and corrective actions
-   Identify repeated operational problems
-   Explain project blockers and delivery risks
-   Answer questions using connected, permission-filtered engineering
    data

AI output must be traceable to source evidence. Logs, tickets, and
retrieved documents are untrusted input, not instructions. AI must not
receive unrestricted production access.

### 8. Advanced Roadmap Features

-   Service dependency graph and blast-radius analysis
-   Service-level objectives (SLOs) and error budgets
-   Release-readiness gates
-   API contract and breaking-change detection
-   Security finding remediation workflows
-   Cloud cost anomaly detection and cost attribution
-   Engineering portfolio dashboards
-   Permission-aware engineering knowledge search
-   Customer status pages
-   Enterprise SSO, advanced audit controls, and retention policies
-   Approved runbook automation

------------------------------------------------------------------------

## Key User Workflows

### Workflow A: Monitor an API

1.  A workspace member creates a service and registers an authorized
    endpoint.
2.  The backend validates the endpoint configuration and stores secret
    references separately.
3.  The scheduler queues a monitoring job.
4.  A worker performs the configured request with strict timeouts and
    network restrictions.
5.  The worker records a sanitized result.
6.  The health evaluator updates the endpoint state based on the latest
    valid results.
7.  The dashboard displays status, latency, and history.

### Workflow B: Detect and Route an Incident

1.  A configured failure policy is met.
2.  The incident engine opens or updates an incident idempotently.
3.  The engine resolves the service owner and applicable escalation
    policy.
4.  A notification job is queued.
5.  The responder is notified and can acknowledge the incident.
6.  If the acknowledgment deadline expires, the escalation policy
    advances to the next responder.
7.  Recovery is verified and the incident is resolved according to
    policy.
8.  The timeline preserves the sequence of checks, notifications,
    acknowledgments, and state transitions.

### Workflow C: Investigate a Deployment-Related Failure

1.  A service's error rate or check failures increase.
2.  The platform displays nearby deployment events and relevant changes.
3.  The incident view shows the evidence and its limitations.
4.  The AI copilot suggests diagnostic steps and links to relevant
    records.
5.  An authorized engineer decides whether to mitigate, roll back, or
    continue investigating.
6.  The outcome is recorded for future incident analysis.

### Workflow D: Monitor a Private API

1.  An organization registers a private monitoring agent.
2.  An administrator verifies and enrolls the agent with a scoped
    identity.
3.  The agent establishes an authenticated outbound connection to the
    platform.
4.  The platform assigns only explicitly authorized checks to that
    agent.
5.  The agent executes checks within its configured network scope and
    sends sanitized results.
6.  Administrators can revoke the agent or rotate its credentials.

The private agent should not expose an inbound management port or
provide an unrestricted remote shell.

------------------------------------------------------------------------

## MVP Scope

The first release should prove the complete monitoring-to-resolution
workflow.

### Must-have

-   [ ] Authentication and organization membership
-   [ ] Tenant-scoped roles and authorization
-   [ ] Projects, tasks, comments, and a basic Kanban board
-   [ ] Service registry, environments, and service ownership
-   [ ] Public endpoint configuration and background monitoring
-   [ ] Monitoring result history and health state transitions
-   [ ] Failure confirmation and incident deduplication
-   [ ] Incident lifecycle and event timeline
-   [ ] Owner-based routing and basic escalation
-   [ ] Email notifications with delivery tracking
-   [ ] Audit events for security-sensitive changes
-   [ ] Application logging, metrics, backups, and restore testing
-   [ ] Security testing for tenant isolation and SSRF protections

### Next release

-   [ ] Private monitoring agent with secure enrollment
-   [ ] GitHub integration and deployment events
-   [ ] On-call rotations and configurable escalation policies
-   [ ] Real-time incident updates
-   [ ] Evidence-grounded AI incident summaries
-   [ ] Service dependency mapping
-   [ ] SLO and error-budget reporting

### Later releases

-   [ ] Release readiness gates
-   [ ] API contract testing
-   [ ] Engineering knowledge search
-   [ ] Cost intelligence and security finding integrations
-   [ ] Advanced analytics, billing, and enterprise controls
-   [ ] Human-approved, policy-constrained remediation

------------------------------------------------------------------------

## Product Roadmap

  -----------------------------------------------------------------------
  Phase                   Focus                   Exit criteria
  ----------------------- ----------------------- -----------------------
  0                       Architecture and        Deployable application
                          foundations             skeleton,
                                                  authentication, tenant
                                                  isolation, CI

  1                       Unified workspace       Teams can manage
                                                  projects, tasks, and
                                                  service ownership

  2                       Public monitoring       Authorized endpoints
                                                  are monitored reliably
                                                  in the background

  3                       Incident response       A confirmed outage
                                                  creates one incident,
                                                  routes to a responder,
                                                  and records recovery

  4                       Private monitoring and  Secure private agent
                          integrations            and at least one
                                                  engineering integration

  5                       Intelligence            Evidence-backed
                                                  incident summaries and
                                                  useful operational
                                                  analytics

  6                       Production hardening    Tested recovery, load
                                                  and security tests,
                                                  quotas, auditability,
                                                  support runbooks
  -----------------------------------------------------------------------

Timelines depend on team size and scope. Do not treat the roadmap as a
launch commitment until each phase has passed its acceptance tests.

------------------------------------------------------------------------

## Technology Stack

### Required core stack

  -----------------------------------------------------------------------
  Technology                          Purpose
  ----------------------------------- -----------------------------------
  **Next.js**                         Web application, routing, server
                                      rendering where useful, dashboard
                                      UI

  **TypeScript**                      Type safety across application code

  **Tailwind CSS**                    Utility-first styling and
                                      responsive design

  **Prisma ORM**                      Type-safe database access, schema
                                      modeling, and migrations

  **PostgreSQL**                      Primary relational database and
                                      durable source of truth
  -----------------------------------------------------------------------

### Recommended supporting technologies

  -----------------------------------------------------------------------
  Technology              Purpose                 Status
  ----------------------- ----------------------- -----------------------
  React                   UI component model used Core framework
                          by Next.js              dependency

  Node.js                 JavaScript/TypeScript   Required runtime
                          runtime                 

  NestJS or Next.js Route Backend API and domain  Choose one API boundary
  Handlers                logic                   for the initial
                                                  implementation

  Redis                   Queue backing store and Recommended for
                          short-lived             background jobs
                          coordination            

  BullMQ                  Durable job processing  Recommended if using
                          and retries             Redis

  Zod                     Runtime validation for  Recommended
                          requests and            
                          environment variables   

  Auth.js or an OIDC      Authentication and      Select after reviewing
  provider                session integration     requirements

  Resend, SES, or another Email notifications     Choose one for the MVP
  email provider                                  

  Docker                  Repeatable local and    Recommended
                          deployment environments 

  Vitest or Jest          Unit and integration    Choose based on
                          testing                 framework

  Playwright              End-to-end browser      Recommended
                          tests                   

  OpenTelemetry           Traces, metrics, and    Add early for
                          logs instrumentation    operational visibility

  S3-compatible object    Attachments and         Add when needed
  storage                 exported reports        
  -----------------------------------------------------------------------

**Architecture note:** Next.js can handle the initial application API,
but continuous monitoring and reliable job execution should run in
background worker processes. If using NestJS, keep the API as a separate
app in the same monorepo. Avoid duplicating business logic between
Next.js route handlers and a second backend.

------------------------------------------------------------------------

## High-Level Architecture

``` text
                        ┌─────────────────────────┐
                        │      Next.js Web        │
                        │ Dashboard / Projects    │
                        │ Monitoring / Incidents  │
                        └────────────┬────────────┘
                                     │ HTTPS
                        ┌────────────▼────────────┐
                        │      Application API    │
                        │ Auth / Tenant Access    │
                        │ Domain Modules          │
                        └──────┬───────────┬──────┘
                               │           │
                    ┌──────────▼───┐   ┌───▼────────────┐
                    │ PostgreSQL   │   │ Redis / Queue │
                    │ Durable data │   │ Background jobs│
                    └──────────────┘   └───┬────────────┘
                                           │
                                  ┌────────▼─────────┐
                                  │ Scheduler/Workers│
                                  │ HTTP health checks│
                                  │ Incident evaluation│
                                  └───────┬──────────┘
                                          │
                          ┌───────────────┴─────────────┐
                          │                             │
                 ┌────────▼────────┐          ┌─────────▼─────────┐
                 │ Public endpoints│          │ Private agent     │
                 │ Egress restricted│         │ Customer network  │
                 └─────────────────┘          └───────────────────┘
```

### Architecture decisions

-   PostgreSQL is the source of truth for application data and incident
    state.
-   Redis supports queue processing and coordination; it is not the only
    record of an incident.
-   Monitoring workers run independently of the browser and web request
    lifecycle.
-   A transactional outbox or equivalent pattern should reliably publish
    jobs/events after database state changes.
-   Workers must be idempotent and use bounded retries, timeouts, and
    concurrency limits.
-   Private monitoring uses a separate, authenticated agent rather than
    unrestricted public-worker access to internal networks.
-   Begin with a modular monolith. Extract components into independent
    services only when scaling, reliability, or security isolation
    requires it.

------------------------------------------------------------------------

## Suggested Repository Structure

A monorepo is recommended so the web app, API, workers, and shared
contracts can evolve together.

``` text
resolvex/
├── apps/
│   ├── web/                    # Next.js frontend
│   ├── api/                    # Optional NestJS API app
│   ├── scheduler/              # Schedules monitoring jobs
│   ├── monitor-worker/         # Executes public endpoint checks
│   └── private-agent/          # Customer-side monitoring agent
├── packages/
│   ├── database/               # Prisma schema and migrations
│   ├── contracts/              # Shared DTOs and validation schemas
│   ├── config/                 # Environment validation
│   ├── auth/                   # Shared authorization utilities
│   ├── ui/                     # Shared UI components
│   └── test-utils/             # Test factories and helpers
├── infra/
│   ├── docker/
│   ├── deployment/
│   └── monitoring/
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── security/
│   └── runbooks/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

For a smaller MVP, start with `apps/web` and a worker process, then
introduce the separate API app and private agent as the design matures.
Do not create empty services solely to match the diagram.

### Suggested domain modules

-   `IdentityModule`
-   `OrganizationsModule`
-   `ProjectsModule`
-   `TasksModule`
-   `TeamsModule`
-   `ServicesModule`
-   `EndpointsModule`
-   `MonitoringModule`
-   `IncidentsModule`
-   `EscalationModule`
-   `AgentsModule`
-   `NotificationsModule`
-   `IntegrationsModule`
-   `AutomationModule`
-   `AIInsightsModule`
-   `AuditModule`
-   `BillingModule`

These can initially be modules in one backend application. Each module
should own its domain logic and expose explicit interfaces to other
modules.

------------------------------------------------------------------------

## Domain Model

The initial relational model should cover the following entities.

### Identity and tenancy

-   `User`
-   `Organization`
-   `OrganizationMembership`
-   `Invitation`
-   `Team`
-   `TeamMembership`

### Projects and delivery

-   `Project`
-   `Task`
-   `TaskComment`
-   `TaskDependency`
-   `TaskEvent`
-   `Deployment`

### Services and monitoring

-   `Service`
-   `ServiceEndpoint`
-   `EndpointSecret` or secret-manager reference
-   `MonitorAgent`
-   `MonitoringCheck`
-   `MonitoringResult`
-   `ServiceDependency`

### Incidents and response

-   `Incident`
-   `IncidentEvent`
-   `ServiceOwnership`
-   `OnCallSchedule`
-   `EscalationPolicy`
-   `NotificationDelivery`
-   `ProblemRecord`

### Intelligence and operations

-   `Integration`
-   `WebhookSubscription`
-   `AutomationRule`
-   `AutomationRun`
-   `AutomationApproval`
-   `AuditEvent`
-   `SLO`
-   `SLOMeasurement`
-   `KnowledgeSource`

### Data modeling guidelines

-   Use UUID identifiers and foreign keys.
-   Include `organizationId` on tenant-owned records where practical.
-   Enforce uniqueness for organization-scoped keys, such as
    `(organizationId, projectKey)`.
-   Prevent cross-tenant references using composite constraints where
    appropriate.
-   Index common access patterns, such as endpoint check history by time
    and incidents by organization and status.
-   Store timestamps in UTC; use IANA time zones for schedules and
    rotations.
-   Separate endpoint configuration from high-volume monitoring history.
-   Apply retention and partitioning strategies to monitoring history
    when data volume warrants them.
-   Store secrets separately, encrypted, and never return secret values
    in ordinary API responses.
-   Keep an append-only event history for important incident and
    administrative transitions.

The Prisma schema should be treated as the versioned source of truth for
database migrations.

------------------------------------------------------------------------

## API Design

Use a versioned REST API, for example `/api/v1`, with JSON payloads and
consistent error responses. Document the API with OpenAPI.

### Initial endpoints

  ---------------------------------------------------------------------------------------------
  Method                  Endpoint                                      Purpose
  ----------------------- --------------------------------------------- -----------------------
  `GET`                   `/api/v1/me`                                  Current user and
                                                                        accessible workspaces

  `POST`                  `/api/v1/organizations`                       Create organization

  `GET`                   `/api/v1/organizations/:orgId/projects`       List projects

  `POST`                  `/api/v1/organizations/:orgId/projects`       Create project

  `POST`                  `/api/v1/projects/:projectId/tasks`           Create task

  `PATCH`                 `/api/v1/tasks/:taskId`                       Update task

  `GET`                   `/api/v1/organizations/:orgId/services`       List services

  `POST`                  `/api/v1/organizations/:orgId/services`       Register service

  `POST`                  `/api/v1/services/:serviceId/endpoints`       Register endpoint

  `GET`                   `/api/v1/endpoints/:endpointId/health`        Current endpoint health

  `GET`                   `/api/v1/endpoints/:endpointId/checks`        Check history

  `GET`                   `/api/v1/organizations/:orgId/incidents`      List incidents

  `GET`                   `/api/v1/incidents/:incidentId`               Incident details and
                                                                        timeline

  `POST`                  `/api/v1/incidents/:incidentId/acknowledge`   Acknowledge incident

  `POST`                  `/api/v1/incidents/:incidentId/resolve`       Resolve incident

  `POST`                  `/api/v1/agents/enrollments`                  Begin private-agent
                                                                        enrollment
  ---------------------------------------------------------------------------------------------

### API requirements

-   Authenticate requests and authorize each resource within the active
    organization.
-   Never trust a client-supplied organization ID or actor ID as proof
    of authorization.
-   Validate request bodies, query parameters, URLs, headers, and
    pagination inputs.
-   Use cursor pagination for large collections.
-   Use idempotency keys for retryable mutations.
-   Apply rate limits and tenant usage quotas.
-   Return consistent error codes and a request ID.
-   Do not return raw secrets or sensitive internal errors.
-   Sign outgoing webhooks, include timestamps, and support retries and
    deduplication.

Example error:

``` json
{
  "error": {
    "code": "RESOURCE_NOT_ACCESSIBLE",
    "message": "The requested resource is unavailable.",
    "requestId": "req_example"
  }
}
```

### Monitoring result ingestion

Monitoring workers should authenticate independently and submit results
only for authorized checks. Each execution should have a unique ID so
duplicate or delayed submissions can be detected.

A monitoring result can include:

-   Check ID and execution ID
-   Endpoint ID
-   Start and finish timestamps
-   Outcome such as success, timeout, network error, or assertion
    failure
-   HTTP status, if available
-   Latency
-   Sanitized error code
-   Agent ID, when applicable

Do not trust a worker payload to change arbitrary incident state. The
backend should validate the result and run the health and incident state
machines.

------------------------------------------------------------------------

## Security and Privacy

Security is a launch requirement because the platform can hold customer
endpoint configurations, credentials, service metadata, and incident
information.

### Tenant isolation

-   Authorize every operation against the current user's organization
    membership and permissions.
-   Use database constraints and PostgreSQL row-level security as
    defense in depth where appropriate.
-   Test cross-tenant reads, updates, deletes, exports, and indirect
    relationships.
-   Avoid exposing whether another tenant's private resource exists.

### Monitoring and SSRF protection

Monitoring user-provided URLs creates a server-side request forgery
(SSRF) risk.

-   Allow only approved protocols and destination policies.
-   Block loopback, private, link-local, and cloud metadata addresses by
    default for public workers.
-   Validate DNS resolution and the actual connection destination.
-   Revalidate every redirect destination.
-   Enforce outbound network restrictions at the infrastructure layer.
-   Set strict timeouts, response-size limits, concurrency limits, and
    per-tenant quotas.
-   Do not permit arbitrary scripts or unrestricted request execution in
    the MVP.
-   Use a customer-side agent for explicitly approved private-network
    monitoring.

### Credentials

-   Encrypt stored credentials using managed keys or envelope
    encryption.
-   Keep secrets separate from ordinary endpoint configuration.
-   Support rotation and revocation.
-   Redact secrets from logs, traces, errors, notifications, and AI
    prompts.
-   Never expose stored credential values in normal API responses.

### Private agents

-   Give each agent a unique identity and narrow scope.
-   Use authenticated TLS and a secure enrollment process.
-   Provide revocation and credential rotation.
-   Restrict assigned checks to explicitly authorized destinations.
-   Avoid inbound management ports and unrestricted remote command
    execution.

### Application and AI security

-   Use secure session handling, CSRF protections where applicable,
    output encoding, and security headers.
-   Apply least-privilege roles and audit security-sensitive changes.
-   Treat logs, ticket content, and retrieved documents as untrusted
    input.
-   Send only the minimum required data to AI providers.
-   Require approval for production-changing actions.
-   Log AI recommendations and resulting human decisions without
    unnecessarily retaining sensitive prompt content.

------------------------------------------------------------------------

## Reliability and Observability

ResolveX must be able to monitor services reliably while also monitoring
its own components.

### Reliability requirements

-   Durable job processing and bounded retries
-   Idempotent monitoring jobs and incident transitions
-   Explicit handling for late, duplicated, and out-of-order results
-   Dead-letter handling for jobs that exhaust retries
-   Database transactions for related state changes
-   Transactional outbox or equivalent reliable event publication
-   Database backups and tested restore procedures
-   Health and readiness checks for web, API, scheduler, and worker
    processes
-   Alerting when monitoring jobs are delayed or queue depth grows
-   Rate limits and circuit breakers for downstream integrations

### Observability

Use structured logs with request IDs, trace IDs, organization IDs where
appropriate, and sanitized error codes. Do not log secrets or
unnecessary personal data.

Track metrics such as:

-   Monitoring checks scheduled, completed, failed, and delayed
-   Check execution duration and scheduling lag
-   Queue depth and job retry counts
-   Incident creation and acknowledgment latency
-   Notification delivery success and delay
-   API error rate and response latency
-   Database connection usage
-   Private agent heartbeat age
-   Integration failures and webhook retry counts

Use OpenTelemetry-compatible instrumentation where practical.

------------------------------------------------------------------------

## Local Development Setup

### Prerequisites

Install:

-   Node.js LTS compatible with the selected Next.js release
-   pnpm
-   Docker and Docker Compose
-   Git

The exact package versions should be pinned in the repository and
validated together.

### 1. Clone the repository

``` bash
git clone <your-repository-url>
cd resolvex
```

Replace the placeholder with the actual repository URL.

### 2. Install dependencies

For a pnpm monorepo:

``` bash
corepack enable
pnpm install
```

### 3. Configure environment variables

Create a local environment file based on the project's `.env.example`.
Do not commit real secrets.

``` bash
cp .env.example .env
```

Adjust the command if your operating system or workspace layout requires
a different path.

### 4. Start local infrastructure

If the repository contains a Docker Compose configuration for PostgreSQL
and Redis:

``` bash
docker compose up -d
```

Check container health before running migrations.

### 5. Configure Prisma

Once the Prisma schema and datasource are in place:

``` bash
pnpm prisma generate
pnpm prisma migrate dev
```

Run these commands from the workspace that owns the Prisma schema, or
use the repository's package scripts if they are configured.

### 6. Start development

Example root scripts, if implemented:

``` bash
pnpm dev
```

In a multi-app workspace, you may instead run the web app, API, and
workers individually through their respective package scripts.

### 7. Validate the setup

``` bash
pnpm lint
pnpm typecheck
pnpm test
```

These commands assume the corresponding scripts have been defined. The
repository should document the actual commands and required services.

------------------------------------------------------------------------

## Environment Variables

Maintain a documented `.env.example` with placeholders only. Validate
required variables at application startup.

Example categories:

``` dotenv
# Application
NODE_ENV=development
APP_URL=http://localhost:3000

# PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/resolvex?schema=public

# Redis / background jobs
REDIS_URL=redis://localhost:6379

# Authentication
AUTH_SECRET=replace-with-a-strong-random-secret
AUTH_URL=http://localhost:3000

# Email provider
EMAIL_FROM=alerts@example.com
EMAIL_PROVIDER_API_KEY=

# Secrets encryption
SECRETS_ENCRYPTION_KEY=

# Integrations (optional until implemented)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

This is an illustrative template, not a production-ready configuration.
Authentication variable names depend on the selected provider and
version. Use a proper secrets manager in production, separate
credentials across environments, and do not reuse development keys in
production.

Do not expose server secrets through variables prefixed with
`NEXT_PUBLIC_`. Those variables are intended for values safe to include
in browser code.

------------------------------------------------------------------------

## Database Workflow

Use Prisma migrations for schema changes.

Typical development workflow:

1.  Update `schema.prisma`.
2.  Create a migration with `prisma migrate dev`.
3.  Review the generated SQL and migration behavior.
4.  Regenerate the Prisma Client.
5.  Update fixtures, tests, and seed data if necessary.
6.  Test migration behavior against a clean database and a
    representative existing database.
7.  Deploy migrations as a controlled step before or alongside the
    compatible application release.

Do not use `prisma db push` as a substitute for a reviewed production
migration workflow.

For production, use the appropriate Prisma migration deployment command
in CI/CD, run migrations with a suitably restricted database role, and
plan for backward-compatible changes when multiple application instances
are running.

------------------------------------------------------------------------

## Testing Strategy

### Unit tests

Test:

-   Health state transitions
-   Failure thresholds and recovery rules
-   Incident deduplication
-   Responder selection and escalation
-   Authorization policies
-   Task and incident state transitions
-   API validation and quota calculations

### Integration tests

Test:

-   PostgreSQL persistence and tenant-scoped queries
-   Queue processing and retries
-   Worker result ingestion
-   Notification delivery handling
-   Database transaction and outbox behavior
-   Authentication and authorization across modules

### End-to-end tests

Test complete user workflows:

1.  Create an organization and invite a teammate.
2.  Create a project and assign a task.
3.  Register a service and authorized endpoint.
4.  Run a monitoring check against a controlled test server.
5.  Simulate repeated failure and verify one incident is created.
6.  Verify that the incident is assigned and a notification is queued.
7.  Acknowledge the incident and simulate recovery.
8.  Verify resolution and the complete event timeline.
9.  Confirm another organization cannot access any of those records.

### Security and resilience tests

-   SSRF attempts, unsafe redirects, and DNS rebinding scenarios
-   Cross-tenant access attempts
-   Oversized responses and slow endpoints
-   Duplicate jobs and out-of-order results
-   Worker termination during execution
-   Redis or database restart behavior
-   Invalid and expired agent credentials
-   Secret redaction in logs and notifications
-   Backup restoration and recovery drills

------------------------------------------------------------------------

## Deployment Strategy

Start with a modest, secure deployment and scale based on observed
usage.

### Recommended initial deployment

-   Next.js web application
-   Backend API, if separated from Next.js
-   One or more monitoring workers
-   Scheduler process
-   Managed PostgreSQL
-   Managed Redis
-   Secure secrets management
-   Centralized logs, metrics, and error tracking
-   Email provider for incident notifications

### Environments

Maintain separate development, staging, and production environments. Use
separate databases, credentials, and integration applications wherever
practical.

### Scaling strategy

Scale components independently when metrics justify it:

-   Add monitoring workers when queue lag or execution capacity requires
    it.
-   Add queue concurrency limits and per-tenant scheduling fairness.
-   Partition monitoring history when query and write volume warrants
    it.
-   Introduce dedicated services only when isolation or scaling needs
    are clear.
-   Consider separate regional monitoring workers when geographic
    coverage becomes important.

Do not promise availability or monitoring intervals that have not been
validated under load. Publish service objectives only after measuring
actual behavior.

------------------------------------------------------------------------

## Non-Functional Requirements

These are initial design goals to validate during implementation, not
existing guarantees.

  -----------------------------------------------------------------------
  Area                                Initial goal
  ----------------------------------- -----------------------------------
  Security                            Tenant-scoped authorization and
                                      SSRF controls before public launch

  Correctness                         Idempotent job handling and
                                      deterministic incident transitions

  Availability                        Establish measurable service
                                      objectives after baseline testing

  Performance                         Responsive dashboard and indexed,
                                      paginated queries

  Observability                       Logs, metrics, traces, and alerts
                                      for all critical processing paths

  Recovery                            Documented backup, restore, and
                                      incident procedures

  Scalability                         Independently scalable workers and
                                      bounded per-tenant resource use

  Maintainability                     TypeScript, shared validation,
                                      modular domains, automated tests

  Privacy                             Data minimization, retention
                                      controls, and secret redaction

  Accessibility                       Keyboard support, semantic markup,
                                      and accessible contrast
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## Success Metrics

Measure customer outcomes and platform reliability.

### Customer outcomes

-   Median time to acknowledge incidents
-   Median time to mitigate and resolve incidents
-   Percentage of incidents routed to the correct team on first
    assignment
-   Duplicate alert rate
-   Percentage of monitored services with verified ownership
-   Number of recurring incidents and corrective actions completed
-   Release failure rate where reliable deployment data is available
-   Time spent coordinating incidents and preparing reports

### Platform health

-   Monitoring scheduling lag
-   Check execution success rate, separated from endpoint health
-   Queue delay and retry rate
-   Notification delivery latency
-   Incident creation and recovery processing latency
-   API latency and error rate
-   Agent heartbeat freshness
-   Database recovery test results
-   Security issues found and resolved before release

A monitoring job failing to execute is different from the customer
endpoint being down. Keep those metrics separate.

------------------------------------------------------------------------

## Contribution Guidelines

Contributions should preserve the platform's security and reliability
guarantees.

1.  Open an issue describing the problem or proposed feature.
2.  Keep pull requests focused and document important architectural
    changes.
3.  Add or update tests for new behavior.
4.  Validate tenant authorization for every new resource or endpoint.
5.  Never commit credentials, customer data, or production logs.
6.  Document new environment variables and configuration.
7.  Include migrations for schema changes and review their production
    impact.
8.  Update API documentation when contracts change.
9.  Add observability for new background processing paths.
10. Require review for changes to authentication, authorization,
    monitoring network access, secret handling, or production
    automation.

### Development standards

-   TypeScript strict mode
-   Shared runtime validation for external inputs
-   Consistent error handling
-   Explicit state machines for incidents and other lifecycle-driven
    entities
-   Idempotency for retryable jobs and mutations
-   Structured logs with sensitive-data redaction
-   Reviewed database migrations
-   No production-changing automation without an explicit authorization
    model

------------------------------------------------------------------------

## License

Choose a license before making the repository public. If this will
become a commercial SaaS product, decide whether the codebase will be
proprietary, open source, or use a mixed licensing model. Add the
appropriate `LICENSE` file and third-party notices before distribution.

------------------------------------------------------------------------

## Final Note

ResolveX's first milestone is not to reproduce every feature in a mature
project-management suite. It is to prove one high-value workflow:

**Monitor an authorized service → verify a failure → identify the right
responder → notify and track the incident → verify recovery → capture
what the team learned.**

Build that workflow securely and reliably, connect it to project tasks,
and expand from there. That foundation gives the product a clear purpose
and a credible path toward becoming a unified engineering operations
platform.

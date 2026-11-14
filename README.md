# ResolveX

> **An advanced Jira with built-in API endpoint monitoring and automated incident alerts.**

ResolveX is a collaborative, multi-tenant project management and service health platform built for software engineering teams. It combines the familiar workflows of Jira—projects, Kanban boards, tasks, sprints, and team collaboration—with native background API monitoring and automated incident response.

When an API endpoint goes down, ResolveX doesn't just send a noisy alert. It verifies the outage, deduplicates repeated failures, opens an incident linked directly to your project board, and routes it to the service owner.

---

## Why ResolveX?

Traditional project trackers like Jira are completely blind to production health—every bug ticket has to be created and triaged manually after someone notices an outage in another tool. Meanwhile, standalone uptime monitors don't know who owns a service or what tasks are in flight.

**ResolveX bridges the gap between planning work and running services:**

| Capability | Traditional Project Trackers | ResolveX |
| :--- | :--- | :--- |
| **Project & Task Tracking** | Projects, Kanban boards, tasks, comments, assignees | Native collaborative boards, tasks, subtasks, and milestones |
| **Service & API Awareness** | Requires third-party plugins or manual webhooks | Built-in Service Catalog & background HTTP health checks |
| **Outage Detection** | Manual bug creation after user reports | Automatic incident & board task creation on verified downtime |
| **Alert Noise Control** | N/A | Failure threshold confirmation & smart incident deduplication |
| **Ownership & Routing** | Manual ticket assignment | Auto-routed to the designated Service Owner & escalation fallback |
| **Post-Incident Workflow** | Disconnected docs and tickets | Timeline tracking, recovery verification, and follow-up tasks |

---

## Core Features

### 1. Collaborative Project & Task Management (The Jira Core)
- **Multi-Tenant Workspaces:** Organizations, teams, role-based access control (RBAC), and member invitations.
- **Projects & Kanban Boards:** Interactive boards with customizable statuses, task priorities, due dates, labels, and filtering.
- **Rich Task Tracking:** Subtasks, task dependencies, markdown descriptions, threaded comments, and full activity history.
- **Engineering Links:** Connect tasks directly to services, monitored endpoints, active incidents, and deployments.

### 2. Service Catalog & Ownership
- **Service Registry:** Register microservices, environments (`production`, `staging`), and HTTP endpoints inside your workspace.
- **Explicit Ownership:** Assign primary service owners, backup responders, owning teams, and runbook links so nobody has to guess who is responsible during an outage.

### 3. Automated API & Endpoint Monitoring
- **Background Health Checks:** Reliable worker processes monitor public HTTP endpoints independently of user sessions.
- **Configurable Rules:** Customize HTTP methods, request headers, intervals, timeouts, expected status codes, and response assertions.
- **Health States & Metrics:** Track latency, check history, failure reasons, and real-time health states (`PENDING`, `HEALTHY`, `DEGRADED`, `DOWN`).

### 4. Smart Incident Management & Alerts
- **Verified Failure Triggering:** Requires configurable consecutive failures before triggering an incident—eliminating false positives from transient network blips.
- **Deduplication:** Repeated check failures attach to the active incident instead of flooding your board and inbox.
- **Structured Lifecycle:** Track incidents from `OPEN → ACKNOWLEDGED → INVESTIGATING → RESOLVED` with an immutable event timeline.
- **Owner-Based Escalation:** Automatically notifies the service owner and escalates to backup responders if unacknowledged within the SLA window.

---

## Tech Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend & API:** Next.js Route Handlers / Node.js, Zod validation
- **Database & ORM:** PostgreSQL, Prisma ORM
- **Background Jobs & Queues:** Redis, BullMQ (scheduled health checks, retries, alert delivery)
- **Authentication:** Auth.js / OIDC with tenant-scoped authorization
- **Notifications:** Resend / AWS SES (email alerts with delivery tracking)
- **Testing & Tooling:** Vitest, Playwright, Docker, pnpm

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────┐
│                     Next.js Web App                      │
│     Kanban Boards  │  Service Catalog  │  Incidents      │
└────────────────────────────┬─────────────────────────────┘
                             │ HTTPS / REST API
┌────────────────────────────▼─────────────────────────────┐
│                   Application Backend                    │
│     Tenant Auth  │  Task Engine  │  Incident State       │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
     ┌─────────▼─────────┐       ┌─────────▼─────────┐
     │    PostgreSQL     │       │   Redis / BullMQ  │
     │  Source of Truth  │       │  Job Scheduling   │
     └───────────────────┘       └─────────┬─────────┘
                                           │
                                 ┌─────────▼─────────┐
                                 │ Monitoring Workers│
                                 │ SSRF-Safe Checks  │
                                 └─────────┬─────────┘
                                           │
                                 ┌─────────▼─────────┐
                                 │ Customer APIs     │
                                 └───────────────────┘
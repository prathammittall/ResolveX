# ResolveX REST API

Base path: `/api`. Every response is JSON `{ ok: true, ... }` or `{ ok: false, error: { code, message, details? } }`.

**Authentication**
- Browser: httpOnly session cookies set by `/api/auth/login` (the web app proxies `/api/*` to the server).
- Programmatic: `Authorization: Bearer rxk_...` API key (Integrations → API keys). A key acts as its creator within one organization, limited to the role chosen when the key was created.
- Alert / deployment webhooks: per-service webhook key `Authorization: Bearer <key>` (Services → service → Webhook keys).

Roles: `owner`, `admin`, `manager`, `developer`, `responder`, `member`, `viewer`. The server enforces every permission; the UI only mirrors it.

Pagination: `?limit=&offset=` where supported. Timestamps are ISO-8601 strings.

---

## Account & organization
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/refresh`, GET `/auth/me` | session (existing) |
| POST | `/auth/switch-org` `{ organizationId }` | |
| POST | `/auth/verify-email` `{ token }` · `/auth/verify-email/request` | email verification |
| POST | `/auth/forgot-password` `{ email }` · `/auth/reset-password` `{ token, password }` | password reset |
| GET/PATCH | `/account/profile` | `{ name, username, jobTitle, timezone, avatarUrl (data:image/png|jpeg|webp;base64, ≤256KB) }`; GET also returns `role`, `permissions` |
| POST | `/account/password` `{ currentPassword, newPassword }` | revokes other sessions |
| DELETE | `/account/sessions` | sign out everywhere |
| GET | `/organizations` · POST `/organizations` `{ name }` | list / create (creator becomes owner) |
| GET/PATCH | `/org` (`{ name }`) | |
| GET | `/org/members` → `members[{ userId, email, name, role, joinedAt, avatarUrl, jobTitle }]` | PATCH `/org/members/:userId` `{ role }`, DELETE |
| GET/POST/DELETE | `/org/invitations[/:id]` `{ email, role }` | invite email sent when SMTP configured |
| POST | `/invitations/accept` `{ token }` | |
| GET | `/audit-logs?limit&before` | admin |

## Teams
`GET /teams` → `teams[{ id, name, description, members[{userId,name,email,isLead,avatarUrl}], projects[], services[] }]` · `POST /teams {name, description}` · `PATCH/DELETE /teams/:id` · `POST /teams/:id/members {userId,isLead}` · `DELETE /teams/:id/members/:userId` · `GET /teams/:id/activity`

## Notifications
`GET /notifications?unread=true&type=&limit&offset` → `{ notifications[{id,type,title,body,link,readAt,emailStatus,emailError,createdAt}], unreadCount }` · `GET /notifications/unread-count` · `POST /notifications/read-all` · `PATCH /notifications/:id {read}` · `DELETE /notifications/:id` · `POST /notifications/:id/retry-email` · `GET/PUT /notifications/preferences` `{ settings: { [type]: { inApp, email } } }` (GET also returns `types`).

## Search
`GET /search?q=&types=tasks,projects,services,incidents,people,comments,docs` → `results[{ type, id, title, subtitle, href }]`

## Projects, tickets, sprints
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/projects?archived=true` | create `{ name, key, description, leadId, teamId, color }` |
| GET/PATCH/DELETE | `/projects/:id` | PATCH `{ name, description, archived, leadId, teamId, color }`; DELETE only when archived |
| GET | `/projects/:id/overview` | `{ health: on_track|behind|at_risk, stats{total,open,done,overdue,unassigned,createdLast7d,completedLast7d,byStatus[],byPriority[],byType[]}, activeSprint{...,burndown}, services[], incidents[] }` |
| GET | `/projects/:id/activity` | `activity[{type,data,createdAt,actor,task{ref,title}}]` |
| GET/POST/DELETE | `/projects/:id/members[/:userId]` | `{ userId, role: lead|member }` |
| POST/PATCH/DELETE | `/projects/:id/statuses[/:statusId]` | workflow `{ name, category: todo|in_progress|done, position }` |
| GET/POST | `/projects/:id/sprints` | create `{ name, goal, startDate, endDate }`; list includes `progress{unit,total,completed,remaining,taskCount,doneCount}` |
| GET/PATCH/DELETE | `/projects/:id/sprints/:sprintId` | GET → `{ sprint, burndown{unit,total,completed,remaining,series[{date,remaining,ideal}]} }` |
| POST | `/projects/:id/sprints/:sprintId/start` · `/complete` `{ moveOpenTo: sprintId|'backlog' }` | |
| GET | `/projects/:id/velocity` | `{ sprints[{name,committed,completed,...}], averageVelocity }` |
| GET/POST | `/projects/:id/tasks` | same filters as `/tasks` |
| GET | `/tasks` | filters: `assignee=me`, `reporter=me`, `watching=me`, `assigneeId` (or `none`), `statusId`, `statusCategory=todo|in_progress|done|open`, `type`, `priority`, `sprintId` (or `backlog`), `label`, `q`, `overdue=true`, `dueFrom`, `dueTo`, `updatedSince`, `serviceId`, `sort=created|updated|due|priority|position|number`, `order=asc|desc`, `limit`, `offset` → `{ tasks, truncated, total }` |
| GET/PATCH/DELETE | `/tasks/:ref` (`PAY-12` or uuid) | GET → `{ task, parent, subtasks, statuses, comments[{id,body,author,createdAt,editedAt,reactions[{emoji,count,userIds}]}], activity, watchers, blockedBy[{dependencyId,task}], blocks[], attachments[{id,fileName,contentType,sizeBytes,uploader,createdAt}], sprint }` |
| | task fields | `title, description (markdown, @mentions notify), type, priority, statusId, assigneeId, dueDate, startDate, labels[], parentId, sprintId, storyPoints, position, serviceId, incidentId` |
| POST | `/tasks/:ref/comments` `{ body }` · PATCH/DELETE `/tasks/:ref/comments/:id` | |
| POST/DELETE | `/tasks/:ref/comments/:id/reactions` `{ emoji: 👍 👎 🎉 ❤️ 👀 🚀 😕 }` | |
| POST/DELETE | `/tasks/:ref/watchers` | toggles caller's watch |
| POST | `/tasks/:ref/dependencies` `{ dependsOn: ref }` · DELETE `/tasks/:ref/dependencies/:id` | |
| POST | `/tasks/:ref/attachments` `{ fileName, contentType, contentBase64 }` (≤2 MB; png/jpeg/gif/webp/pdf/txt/csv/md/json/zip) · GET/DELETE `/tasks/:ref/attachments/:id` | GET downloads |
| POST | `/tasks/bulk` `{ refs[], action: update|delete, patch{statusId,assigneeId,priority,sprintId,labels} }` | |
| GET/POST/DELETE | `/saved-filters[/:id]` `{ name, scope: tasks|incidents, query{...}, shared }` | |

## Services & monitoring
| Method | Path | Notes |
|---|---|---|
| GET/POST | `/services?status=&environment=` | fields: `name, description, serviceType (http|api|database|queue|worker|frontend|backend|microservice|external|other), environment, criticality (low..critical), monitoredUrl, slug, teamId, ownerId, backupOwnerId, projectId, repositoryUrl, docsUrl, runbookUrl, tags[], currentVersion`. A `monitoredUrl` on create also creates a default monitor. |
| GET/PATCH/DELETE | `/services/:id` | |
| GET | `/services/:id/overview` | `{ owner, backupOwner, team, maintenance, monitors[], uptime{day,week,month: {uptimePercent,avgLatencyMs,p95LatencyMs,failures,totalChecks}}, dailyUptime[{t,uptime,avgLatencyMs}], incidents[], deployments[], dependencies[{dependencyId,id,name,serviceType,healthStatus,kind}], dependents[] }` |
| GET | `/services/:id/metrics?hours=24` | `{ summary, series[{t,uptime,avgLatencyMs}], deployments[] }` (deployment markers) |
| POST/DELETE | `/services/:id/dependencies[/:depId]` `{ dependsOnId, kind: hard|soft }` | |
| GET/POST/DELETE | `/services/:id/webhook-keys[/:keyId]` | alert/deployment webhook keys |
| GET | `/dependency-map` | `{ nodes[{id,name,serviceType,environment,criticality,healthStatus,atRisk,openIncidentId}], edges[{id,from,to,kind}] }` (`from` depends on `to`) |
| GET/POST | `/monitors?serviceId=` | `{ serviceId, name, url, method, headers{}, body, timeoutMs, intervalSeconds(≥30), expectedStatusCodes[], assertions[{type: body_contains|body_not_contains|header_equals|json_path_equals|latency_below,...}], retries, failureThreshold, recoveryThreshold, degradedLatencyMs, severity, autoCreateTask, enabled }`. Header values are write-only (`headerNames` returned). |
| POST | `/monitors/test` | dry-run an unsaved config → `{ result{status,statusCode,latencyMs,error} }` |
| GET/PATCH/DELETE | `/monitors/:id` | GET → `{ monitor, stats24h, series }` |
| POST | `/monitors/:id/run` | check now |
| GET | `/monitors/:id/checks?status=&limit` | history |

Health states: `healthy`, `degraded`, `down`, `pending`, `maintenance` (`unknown` = never checked).

## Incidents
| Method | Path | Notes |
|---|---|---|
| GET | `/incidents?status=&severity=` · `/incidents/:id` | list / detail (events, alerts, escalation) |
| POST | `/incidents` `{ serviceId, title, description, severity, assigneeId, projectId, createTask }` | declare (dedupes onto an open incident for the service) |
| PATCH | `/incidents/:id` `{ status, severity, assigneeId, title, description, customerImpact, projectId, note }` | lifecycle: open → acknowledged → investigating → mitigated → resolved; reopen with `status: open` |
| GET | `/incidents/:id/context` | `{ incident, service, task, postmortem, relatedIncidents, recentDeployments, monitors, aiEnabled }` |
| GET | `/incidents/:id/timeline` | `{ events[{eventType,message,occurredAt,actorName}], checks[] }` |
| POST/DELETE | `/incidents/:id/task` `{ ref }` or `{ projectId }` | link existing / create linked bug |
| GET/PUT | `/incidents/:id/postmortem` `{ status: draft|in_review|published, summary, rootCause, customerImpact, contributingFactors, resolution, preventiveMeasures, lessonsLearned }` | |
| POST | `/incidents/:id/postmortem/action-items` `{ title, ownerId, dueDate, createTaskInProject }` · PATCH/DELETE `/postmortems/action-items/:id` | |
| GET | `/postmortems` | |
| POST | `/incidents/:id/assistant` `{ task: summary|root_cause|troubleshooting|postmortem_draft }` | `{ source: ai|heuristic, disclaimer, content }` |
| GET | `/incidents/groups` | correlated incident groups |
| POST | `/incidents/:id/acknowledge` · `/resolve` · `/comments` `{ message }` | legacy shortcuts |
| GET | `/alerts` | ingested alert events |

## Operations
- Escalation policies: `GET/POST /escalation-policies`, `PATCH/DELETE /escalation-policies/:id` — `{ name, serviceId, enabled, severities[], environment, teamId, activeHours{start,end,days[],timezone}, priority, steps[{delaySeconds,targetType: user|team|schedule|webhook,targetId,notificationChannels[in_app,email,webhook,sms]}] }`
- Maintenance: `GET/POST /maintenance-windows`, `PATCH/DELETE /maintenance-windows/:id` — `{ name, description, serviceId, serviceIds[], startsAt, endsAt, timezone, recurrence: none|daily|weekly, recurrenceUntil, bypassSeverity, enabled }`
- On-call: `GET/POST /oncall/schedules` `{ name, description, teamId, timezone, rotationHours, rotationStart, participants[userId] }` (GET includes `current{primaryUser,secondaryUser,shiftEnd}`, `overrides`), `PATCH/DELETE /oncall/schedules/:id`, `GET /oncall/schedules/:id/calendar?from=&days=` → `{ shifts[{userId,user,startsAt,endsAt}], overrides[] }`, `POST /oncall/schedules/:id/overrides {userId,startsAt,endsAt,reason}`, `DELETE /oncall/schedules/:id/overrides/:oid`, `GET /oncall/now`
- Deployments: `GET /deployments?serviceId=&environment=` (includes `serviceName`, `relatedIncidents`), `POST /deployments { serviceId, environment, version, commitSha, repositoryUrl, author, status, description, url }`
- Status pages: `GET/POST /status-pages` `{ name, slug, description, isPublic, brandColor, logoUrl, supportUrl, showIncidentHistory, serviceIds[] }`, `PATCH/DELETE /status-pages/:id`, `GET /status-pages/:id/preview`; public: `GET /public/status/:slug` (only `isPublic` pages; customer-safe fields only)

## Analytics
- `GET /analytics/overview?days=30` → `{ services{total,healthy,degraded,down,maintenance,unknown}, incidents{active,resolvedInRange,openedInRange,mttaSeconds,mttrSeconds,bySeverity[],activeList[]}, tasks{open,overdue,completedInRange}, monitoring{uptimePercent,avgLatencyMs,p95LatencyMs,totalChecks}, series[{date,incidents,uptime,avgLatencyMs,tasksCreated,tasksCompleted}], workload[{userId,name,openTasks,activeIncidents}] }`
- `GET /analytics/insights?days=30` → `{ mostUnreliableServices[], degradingLatency[], failingEndpoints[], recurringPatterns[], teamWorkload[], mttrSeconds, mttaSeconds, trend[], recommendations[] }`

## Integrations
- Outgoing webhooks (admin): `GET/POST /webhook-endpoints { name, url, events[], enabled }` (POST returns `secret` once), `PATCH/DELETE /webhook-endpoints/:id`, `POST /webhook-endpoints/:id/rotate-secret`, `POST /webhook-endpoints/:id/test`, `GET /webhook-endpoints/:id/deliveries`, `POST /webhook-endpoints/:id/deliveries/:deliveryId/retry`. Events: `incident.created, incident.acknowledged, incident.status_changed, incident.resolved, service.health_changed, deployment.created, task.created, task.updated, postmortem.published`. Headers: `X-ResolveX-Event`, `X-ResolveX-Delivery` (idempotency key), `X-ResolveX-Timestamp`, `X-ResolveX-Signature: t=<ts>,v1=<hex HMAC-SHA256(secret, "<ts>.<body>")>`.
- API keys (admin): `GET/POST /api-keys { name, role, expiresInDays }` (POST returns `key` once), `DELETE /api-keys/:id`
- GitHub: `GET /integrations/github` → `{ configured, connection, repositories, webhookUrl }`, `POST /integrations/github/connect` → `{ url }` (OAuth), `DELETE /integrations/github/connection`, `POST /integrations/github/repositories { fullName, projectId, serviceId }` (returns `webhookSecret` once), `PATCH/DELETE /integrations/github/repositories/:id`, `GET /integrations/github/repositories/:id/activity`, `GET /integrations/github/events?taskRef=PAY-12`. GitHub webhook target: `POST /api/webhooks/github` (push, pull_request, deployment_status; verified with `X-Hub-Signature-256`).

## Inbound webhooks
- `POST /webhooks/alerts` — `{ serviceId, eventId, eventType: firing|recovery, severity, message, occurredAt }` with service webhook key.
- `POST /webhooks/deployments` — deployment body (see above) with service webhook key.

// Domain types shared across dashboard views. These mirror the server response shapes.

export type ServiceType = 'http' | 'api' | 'database' | 'queue' | 'worker' | 'other';
export type ServiceEnvironment = 'production' | 'staging' | 'development';
export type ServiceCriticality = 'low' | 'medium' | 'high' | 'critical';
export type ServiceHealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';
export type IncidentSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';
export type IncidentStatus =
  | 'open'
  | 'acknowledged'
  | 'investigating'
  | 'mitigated'
  | 'resolved';
export type IncidentEventType =
  | 'created'
  | 'acknowledged'
  | 'status_change'
  | 'comment'
  | 'assignment'
  | 'resolved'
  | 'system';
export type AlertProcessingStatus = 'pending' | 'processed' | 'ignored' | 'failed';

export interface ServiceItem {
  id: number;
  companyId: number;
  name: string;
  description: string | null;
  serviceType: ServiceType;
  monitoredUrl: string | null;
  environment: ServiceEnvironment;
  criticality: ServiceCriticality;
  healthStatus: ServiceHealthStatus;
  createdAt: string;
  updatedAt: string;
  openIncident?: {
    id: number;
    severity: IncidentSeverity;
    status: IncidentStatus;
    detectedAt: string;
  } | null;
}

export interface IncidentItem {
  id: number;
  companyId: number;
  serviceId: number;
  title: string;
  description: string | null;
  severity: IncidentSeverity;
  status: IncidentStatus;
  assignedResponderId: number | null;
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  serviceName: string;
  assignedResponderName?: string | null;
}

export interface IncidentEventItem {
  id: number;
  incidentId: number;
  actorId: number | null;
  actorName: string | null;
  eventType: IncidentEventType;
  message: string;
  occurredAt: string;
}

export interface IncidentAlertItem {
  id: number;
  provider: string;
  providerEventId: string;
  processingStatus: AlertProcessingStatus;
  receivedAt: string;
}

export interface AlertItem {
  id: number;
  serviceId: number;
  serviceName: string;
  incidentId: number | null;
  provider: string;
  providerEventId: string;
  processingStatus: AlertProcessingStatus;
  receivedAt: string;
}

export interface Metrics {
  services: {
    total: number;
    healthy: number;
    degraded: number;
    down: number;
    unknown: number;
  };
  incidents: {
    total: number;
    active: number;
    open: number;
    acknowledged: number;
    investigating: number;
    mitigated: number;
    resolved: number;
  };
  severity: { sev1: number; sev2: number; sev3: number; sev4: number };
  alerts: {
    total: number;
    processed: number;
    pending: number;
    failed: number;
    ignored: number;
  };
}

// Response envelopes
export interface MetricsResponse {
  ok: true;
  metrics: Metrics;
}
export interface ServicesResponse {
  ok: true;
  services: ServiceItem[];
}
export interface ServiceResponse {
  ok: true;
  service: ServiceItem;
}
export interface IncidentsResponse {
  ok: true;
  incidents: IncidentItem[];
}
export interface IncidentDetailResponse {
  ok: true;
  incident: IncidentItem;
  events: IncidentEventItem[];
  alerts: IncidentAlertItem[];
}
export interface AlertsResponse {
  ok: true;
  alerts: AlertItem[];
}
export interface MessageResponse {
  ok: true;
  message?: string;
  incident?: IncidentItem;
  event?: IncidentEventItem;
}

// --- Organization, members, invitations, audit log ---

export type OrgRole = 'owner' | 'admin' | 'responder' | 'member' | 'viewer';

export interface OrganizationInfo {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  role: OrgRole;
  current: boolean;
}

export interface MemberItem {
  userId: number;
  email: string;
  name: string | null;
  role: OrgRole;
  joinedAt: string;
}

export interface InvitationItem {
  id: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  createdAt: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
}

export interface AuditLogItem {
  id: string;
  actorId: number | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: string;
}

export interface WebhookKeyItem {
  id: number;
  serviceId: number;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// --- Projects and tickets ---

export type StatusCategory = 'todo' | 'in_progress' | 'done';
export type TaskType = 'epic' | 'story' | 'task' | 'bug' | 'subtask';
export type TaskPriority = 'lowest' | 'low' | 'medium' | 'high' | 'highest';

export interface ProjectItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  archived: boolean;
  createdAt: string;
}

export interface StatusItem {
  id: string;
  name: string;
  category: StatusCategory;
  position: number;
}

export interface UserRef {
  id: number;
  name: string;
  email: string;
}

export interface TaskItem {
  id: string;
  projectId: string;
  projectKey: string;
  number: number;
  ref: string;
  type: TaskType;
  title: string;
  description: string | null;
  status: { id: string; name: string; category: StatusCategory };
  priority: TaskPriority;
  assignee: UserRef | null;
  reporter: UserRef | null;
  parentId: string | null;
  dueDate: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  body: string;
  author: UserRef | null;
  createdAt: string;
}

export interface TaskActivityItem {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
  actor: UserRef | null;
  createdAt: string;
}

export interface TaskDetail {
  task: TaskItem;
  parent: TaskItem | null;
  subtasks: TaskItem[];
  statuses: StatusItem[];
  comments: TaskComment[];
  activity: TaskActivityItem[];
}
